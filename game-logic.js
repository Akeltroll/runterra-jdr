/* ============================================================
   LOGIQUE DE JEU PURE — Chroniques de Runeterra
   Aucune dépendance React/DOM/Firebase : testable en Node,
   et exposée sur `window` côté navigateur (UMD léger).
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') Object.assign(window, api);
})(typeof self !== 'undefined' ? self : this, function () {

  /* --- Bornage --- */
  const clamp = (v, min, max) => Math.max(min, Math.min(max, Math.round(v)));
  const clampGauge = (v) => clamp(v, 0, 5);

  /* --- Modificateurs manuels par défaut (colonne C des grilles Excel) --- */
  const DEFAULT_MODIFIERS = {
    rathael: { ad: 10 },
    urskaar: { hp: 50 },
    smith:   { ad: 20, crit: 10 },
    lunick:  { ad: 20 },
    jett:    {},
  };

  /* --- Table buff -> { stat: delta additif }. Cas spéciaux gérés à part. --- */
  const BUFF_STAT_MAP = {
    peaufer:   { armure: 0.5 },
    brise:     { armure: -0.5 },
    esprit:    { resmag: 0.5 },
    chocmag:   { resmag: -0.5 },
    inflex:    { armure: 0.5, resmag: 0.5 },
    aneanti:   { armure: -0.5, resmag: -0.5 },
    bravoure:  { ad: 0.5 },
    affaibli:  { ad: -0.5 },
    foi:       { ap: 0.5 },
    erosion:   { ap: -0.5 },
    heroisme:  { ad: 0.5, ap: 0.5 },
    epuise:    { ad: -0.5, ap: -0.5 },
  };

  /* --- Stats effectives = (base + modificateur) puis buffs additifs ---
     HP/Mana ne sont pas affectés par les buffs (cohérent avec l'Excel).
     Aiguisage = cas spécial (% Crit doublé). */
  function computeEffective(base, modifiers, activeBuffs, itemMods) {
    modifiers = modifiers || {};
    activeBuffs = activeBuffs || [];
    itemMods = itemMods || {};
    const withMod = {};
    const keys = new Set([...Object.keys(base), ...Object.keys(modifiers), ...Object.keys(itemMods)]);
    for (const k of keys) withMod[k] = (base[k] || 0) + (modifiers[k] || 0) + (itemMods[k] || 0);
    const pct = {};
    for (const id of activeBuffs) {
      const map = BUFF_STAT_MAP[id];
      if (!map) continue;
      for (const stat of Object.keys(map)) pct[stat] = (pct[stat] || 0) + map[stat];
    }
    const eff = {};
    for (const k of Object.keys(withMod)) {
      if (k === 'hp' || k === 'mana') { eff[k] = withMod[k]; continue; }
      eff[k] = Math.round(withMod[k] * (1 + (pct[k] || 0)));
    }
    if (activeBuffs.indexOf('aiguisage') !== -1) eff.crit = (withMod.crit || 0) * 2;
    return eff;
  }

  /* --- Bonus de stats des items équipés : somme des item.mods --- */
  function sumItemMods(equipment, itemsById) {
    equipment = equipment || {};
    itemsById = itemsById || {};
    const out = {};
    for (const slot of Object.keys(equipment)) {
      const id = equipment[slot];
      if (!id) continue;
      const it = itemsById[id];
      if (!it || !it.mods) continue;
      for (const k of Object.keys(it.mods)) {
        const v = Number(it.mods[k]) || 0;
        if (v) out[k] = (out[k] || 0) + v;
      }
    }
    return out;
  }

  /* --- Soins/boucliers reçus : Miraculé +50%, Hémorragie -50% (additif) --- */
  function applyHealMods(amount, activeBuffs) {
    activeBuffs = activeBuffs || [];
    let f = 1;
    if (activeBuffs.indexOf('miracule') !== -1) f += 0.5;
    if (activeBuffs.indexOf('hemorragie') !== -1) f -= 0.5;
    return Math.round(amount * f);
  }

  /* --- Inventaire : modèle d'item + helpers --- */
  let _itemSeq = 0;
  function newItemId() {
    _itemSeq += 1;
    return 'it_' + Date.now().toString(36) + '_' + _itemSeq.toString(36);
  }
  function makeItem(p) {
    p = p || {};
    return {
      id:   p.id || newItemId(),
      cat:  p.cat || 'Butin',
      name: p.name || 'Objet',
      sub:  p.sub || '',
      qty:  (p.qty == null) ? 1 : p.qty,
      ic:   p.ic || '',
      img:  p.img || '',
      type: p.type || '',   // emplacement (helmet/chest/ring/weapon/accessory/boots…) ; vide = non équipable
      mods: p.mods || {},   // vide pour l'instant — hook futur des bonus de stats
      weight: Number(p.weight) || 0,   // poids unitaire porté (affichage seul)
      carry:  Number(p.carry) || 0,    // bonus de capacité de charge (ceinture/équipement)
    };
  }

  /* --- Transfert/fusion d'items : logique pure --- */
  function _sameKind(a, b) {
    return a && b && a.name === b.name && (a.type || '') === (b.type || '') && a.cat === b.cat;
  }
  function planItemTransfer(srcItems, dstItems, itemId, n) {
    srcItems = srcItems || {}; dstItems = dstItems || {};
    var src = srcItems[itemId];
    if (!src || !(n > 0)) return { srcPatch:{}, dstPatch:{} };
    var move = Math.min(n, src.qty || 0);
    if (move <= 0) return { srcPatch:{}, dstPatch:{} };

    var remain = (src.qty || 0) - move;
    var srcPatch = {};
    srcPatch[itemId] = (remain <= 0) ? null : Object.assign({}, src, { qty: remain });

    var dstPatch = fillStacks(dstItems, {
      cat: src.cat, name: src.name, sub: src.sub,
      ic: src.ic, img: src.img, type: src.type, mods: src.mods,
      weight: src.weight, carry: src.carry,
    }, move);
    return { srcPatch: srcPatch, dstPatch: dstPatch };
  }

  /* --- Plafond de pile + ajout depuis un catalogue (logique pure) --- */
  var STACK_MAX = 99;

  function fillStacks(items, entry, qty) {
    items = items || {};
    var patch = {};
    var remaining = qty | 0;
    if (remaining <= 0) return patch;
    // 1) remplir les piles existantes de même genre, sous le plafond
    for (var k in items) {
      if (remaining <= 0) break;
      var it = items[k];
      if (!_sameKind(it, entry)) continue;
      var cur = it.qty || 0;
      if (cur >= STACK_MAX) continue;
      var space = STACK_MAX - cur;
      var add = Math.min(space, remaining);
      patch[k] = Object.assign({}, it, { qty: cur + add });
      remaining -= add;
    }
    // 2) créer de nouvelles piles (≤ STACK_MAX) pour le surplus
    while (remaining > 0) {
      var take = Math.min(STACK_MAX, remaining);
      var fresh = makeItem({
        cat: entry.cat, name: entry.name, sub: entry.sub, qty: take,
        ic: entry.ic, img: entry.img, type: entry.type, mods: entry.mods,
        weight: entry.weight, carry: entry.carry,
      });
      patch[fresh.id] = fresh;
      remaining -= take;
    }
    return patch;
  }

  function planItemAdd(items, entry, qty) {
    return { patch: fillStacks(items, entry, qty) };
  }

  /* --- Système de poids porté (affichage seul ; le MJ arbitre la surcharge) --- */
  var CARRY_BASE = 10;        // capacité de base commune
  var CARRY_PER_FORCE = 5;    // capacité gagnée par point de Force

  function carriedWeight(items) {
    items = items || {};
    var tot = 0;
    for (var k in items) { var it = items[k] || {}; tot += (Number(it.weight) || 0) * (Number(it.qty) || 0); }
    return tot;
  }

  function carryCapacity(force, equipment, itemsById) {
    force = Number(force) || 0;
    equipment = equipment || {}; itemsById = itemsById || {};
    var bonus = 0;
    for (var slot in equipment) {
      var id = equipment[slot]; if (!id) continue;
      var it = itemsById[id]; if (it) bonus += Number(it.carry) || 0;
    }
    return CARRY_BASE + force * CARRY_PER_FORCE + bonus;
  }

  function weightStatus(carried, cap) {
    carried = Number(carried) || 0; cap = Number(cap) || 0;
    return { pct: cap > 0 ? carried / cap : 0, over: carried > cap };
  }

  /* Amorçage du catalogue partagé : transforme la liste ITEM_CATALOG (sans id)
     en map { id: {id,cat,name,sub,ic,img,type,mods} } prête pour Firebase. */
  function buildCatalogSeed(entries) {
    entries = entries || [];
    var out = {};
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i] || {};
      var id = newItemId();
      out[id] = { id: id, cat: e.cat || 'Butin', name: e.name || 'Objet', sub: e.sub || '',
        ic: e.ic || '', img: e.img || '', type: e.type || '', mods: e.mods || {},
        weight: Number(e.weight) || 0, carry: Number(e.carry) || 0 };
    }
    return out;
  }

  /* Catalogue exposé à l'UI : si amorcé (inited) → liste live triée (cat puis nom) ;
     sinon repli sur le catalogue en dur (chargement / pré-amorçage). */
  function catalogArray(map, inited, fallback) {
    if (!inited) return (fallback || []).slice();
    return Object.keys(map || {}).map(function (k) { return map[k]; })
      .sort(function (a, b) { return ((a.cat || '') + (a.name || '')).localeCompare((b.cat || '') + (b.name || '')); });
  }

  /* --- Liste des types d'emplacements d'équipement --- */
  var EQUIP_TYPES = [
    { value:'helmet',    label:'Casque' },
    { value:'shoulders', label:'Épaules' },
    { value:'chest',     label:'Cuirasse' },
    { value:'gloves',    label:'Gants' },
    { value:'pants',     label:'Pantalon' },
    { value:'boots',     label:'Bottes' },
    { value:'belt',      label:'Ceinture' },
    { value:'weapon',    label:'Arme principale' },
    { value:'offhand',   label:'Arme secondaire' },
    { value:'shield',    label:'Bouclier' },
    { value:'amulet',    label:'Amulette' },
    { value:'ring',      label:'Anneau' },
    { value:'accessory', label:'Accessoire' },
  ];

  /* --- Runes : coûts par palier + index + validation + somme des bonus plats --- */
  var RUNE_COST = { mineure:1, avancee:2, fondamentale:2 };

  function buildRuneIndex(families) {
    families = families || [];
    var idx = {};
    for (var f = 0; f < families.length; f++) {
      var fam = families[f]; var paths = fam.paths || [];
      for (var p = 0; p < paths.length; p++) {
        var nodes = paths[p].nodes || [];
        for (var n = 0; n < nodes.length; n++) {
          var node = nodes[n];
          idx[node.id] = Object.assign({}, node, {
            cost: RUNE_COST[node.tier] || 0,
            familyKey: fam.key, pathKey: paths[p].key,
            prevId: n > 0 ? nodes[n - 1].id : null,
            nextId: n < nodes.length - 1 ? nodes[n + 1].id : null,
          });
        }
      }
    }
    return idx;
  }

  function runeBudget(level) { return level || 0; }

  function runeSpent(selectedIds, index) {
    selectedIds = selectedIds || []; index = index || {};
    var s = 0;
    for (var i = 0; i < selectedIds.length; i++) {
      var e = index[selectedIds[i]];
      if (e) s += e.cost || 0;
    }
    return s;
  }

  function canSelectRune(nodeId, selectedIds, index, budget) {
    index = index || {}; selectedIds = selectedIds || [];
    var node = index[nodeId];
    if (!node) return { ok:false, reason:'Rune inconnue' };
    if (selectedIds.indexOf(nodeId) !== -1) return { ok:false, reason:'Déjà sélectionnée' };
    if (node.prevId && selectedIds.indexOf(node.prevId) === -1)
      return { ok:false, reason:'Prérequis manquant' };
    if (runeSpent(selectedIds, index) + (node.cost || 0) > (budget || 0))
      return { ok:false, reason:'Points insuffisants' };
    return { ok:true };
  }

  function canDeselectRune(nodeId, selectedIds, index) {
    index = index || {}; selectedIds = selectedIds || [];
    var node = index[nodeId];
    if (!node) return { ok:false, reason:'Rune inconnue' };
    if (node.nextId && selectedIds.indexOf(node.nextId) !== -1)
      return { ok:false, reason:"Prérequis d'une rune supérieure" };
    return { ok:true };
  }

  function sumRuneMods(selectedIds, choices, index) {
    selectedIds = selectedIds || []; choices = choices || {}; index = index || {};
    var out = {};
    for (var i = 0; i < selectedIds.length; i++) {
      var e = index[selectedIds[i]];
      if (!e || !e.mods) continue;
      for (var k in e.mods) {
        var v = Number(e.mods[k]) || 0; if (!v) continue;
        var stat = k;
        if (k === 'adp') stat = (choices[e.id] === 'ap') ? 'ap' : 'ad';
        out[stat] = (out[stat] || 0) + v;
      }
    }
    return out;
  }

  function mergeMods(a, b) {
    var out = {}; var k;
    a = a || {}; b = b || {};
    for (k in a) out[k] = (out[k] || 0) + (Number(a[k]) || 0);
    for (k in b) out[k] = (out[k] || 0) + (Number(b[k]) || 0);
    return out;
  }

  /* --- Récap : regroupe une liste de pages en doubles-pages [[p1,p2],[p3,p4],…] --- */
  function paginate(pages) {
    pages = pages || [];
    var out = [];
    for (var i = 0; i < pages.length; i += 2) out.push(pages.slice(i, i + 2));
    return out;
  }

  /* --- État de départ d'un perso (conversion ratios -> valeurs absolues) --- */
  function buildDefaultState(char) {
    const arr = char.buffs || [];
    const buffs = {};
    for (const id of arr) buffs[id] = true;
    const inventory = {};
    (char.inv || []).forEach((it, i) => {
      const id = `${char.id}_inv_${i}`;
      inventory[id] = makeItem({ id, cat: it.cat, name: it.name, sub: it.sub, qty: it.qty, ic: it.ic, img: it.img, type: it.type });
    });
    return {
      hpCur:   Math.round((char.hpCur || 0) * charBaseStats(char, null).hp),
      manaCur: Math.round((char.manaCur || 0) * charBaseStats(char, null).mana),
      shield:  char.shieldCur || 0,
      fatigue: char.fatigue || 0,
      eau:     char.eau || 0,
      buffs:   buffs,
      modifiers: DEFAULT_MODIFIERS[char.id] || {},
      inventory,
      equipment: {},   // paperdoll { [slotKey]: itemId } — rempli via la page Équipement
      coins: {
        plat: (char.coins && char.coins.plat) || 0,
        or:   (char.coins && char.coins.or)   || 0,
        arg:  (char.coins && char.coins.arg)  || 0,
        cuiv: (char.coins && char.coins.cuiv) || 0,
      },
    };
  }

  /* --- Combat (vue MJ ennemis) : reproduit le moteur Excel (Codes App Script) --- */
  // Mitigation par armure / résistance magique. type ∈ {'physique','magique','brut'}.
  // La léthalité réduit l'AR/RM prise en compte, sans passer sous 0. brut = aucune réduction.
  function mitigateDamage(raw, type, defense, lethalite) {
    const dmg = Math.max(0, Number(raw) || 0);
    const leth = Math.max(0, Number(lethalite) || 0);
    let stat;
    if (type === 'physique') stat = Number((defense && defense.armure) || 0);
    else if (type === 'magique') stat = Number((defense && defense.resmag) || 0);
    else return dmg; // brut (ou type inconnu) : pas de mitigation
    const eff = Math.max(0, stat - leth);
    const reduction = eff / (eff + 120);
    return Math.ceil(dmg * (1 - reduction));
  }

  /* --- Crit & surcrit par paliers (refonte §6.3) ---
     %Crit peut dépasser 100 % : à 100 % le crit est garanti ; chaque tranche de 100 %
     au-delà = un palier supplémentaire valant +50 % de Dégâts Crit. */
  function critInfo(critPct) {
    critPct = Math.max(0, Number(critPct) || 0);
    if (critPct < 100) return { guaranteedTiers: 0, extraChancePct: critPct };
    return { guaranteedTiers: Math.floor((critPct - 100) / 100), extraChancePct: (critPct - 100) % 100 };
  }
  function rollCrit(critPct, dcritBase, rng) {
    critPct = Math.max(0, Number(critPct) || 0);
    dcritBase = Number(dcritBase) || 0;
    rng = rng || Math.random;
    if (critPct < 100) {
      if (rng() < critPct / 100) return { didCrit: true, tiers: 1, multiplier: dcritBase / 100 };
      return { didCrit: false, tiers: 0, multiplier: 1 };
    }
    const frac = ((critPct - 100) % 100) / 100;
    const tiersSupp = Math.floor((critPct - 100) / 100) + (rng() < frac ? 1 : 0);
    return { didCrit: true, tiers: 1 + tiersSupp, multiplier: (dcritBase + 50 * tiersSupp) / 100 };
  }

  // Applique des dégâts DÉJÀ mitigés : bouclier d'abord, puis HP. KO si HP atteint 0.
  function applyDamageToPools(pools, degats) {
    const hpCur = Math.max(0, Number((pools && pools.hpCur) || 0));
    let shield = Math.max(0, Number((pools && pools.shield) || 0));
    let d = Math.max(0, Number(degats) || 0);
    if (shield > 0) {
      if (d <= shield) return { hpCur, shield: shield - d, ko: false };
      d -= shield; shield = 0;
    }
    if (d >= hpCur) return { hpCur: 0, shield, ko: true };
    return { hpCur: hpCur - d, shield, ko: false };
  }

  /* --- Vol de vie / Sapience / Omnivamp ---
     Soin rendu à l'attaquant = % des dégâts RÉELLEMENT infligés (post-mitigation).
     Séparation PAR SOURCE (ruling MJ) :
       attaque de base (isBasic) : vol de vie si physique, sapience si magique (jamais omni) ;
       compétence                : omnivamp seul, quel que soit le type (jamais vol/sapience). */
  function lifestealHeal(applied, type, stats, isBasic) {
    applied = Math.max(0, Number(applied) || 0);
    stats = stats || {};
    let pct;
    if (isBasic) {
      pct = type === 'physique' ? (Number(stats.vol) || 0)
          : type === 'magique'  ? (Number(stats.sapience) || 0)
          : 0;
    } else {
      pct = Number(stats.omni) || 0;
    }
    return Math.round(applied * Math.max(0, pct) / 100);
  }

  /* --- Visibilité des PV ennemis côté joueur ---
     Le MJ pilote par ennemi ce que les joueurs voient :
       reveal 'hidden' (défaut) : nom seul, aucune barre, aucun chiffre ;
       reveal 'bar'             : barre FIGÉE au % choisi (revealPct), ne suit pas les vrais dégâts ;
       reveal 'exact'           : barre live + PV chiffrés (vrais hpCur/hpMax).
     KO (hpCur ≤ 0) : toujours signalé (la mort est observable), quel que soit le mode.
     Renvoie de quoi rendre l'UI sans qu'elle connaisse les vrais PV en mode caché/barre. */
  function enemyPublicView(enemy) {
    const e = enemy || {};
    const hpCur = Math.max(0, Number(e.hpCur) || 0);
    const hpMax = Math.max(0, Number(e.hpMax) || 0);
    const mode = e.reveal === 'bar' || e.reveal === 'exact' ? e.reveal : 'hidden';
    if (hpMax > 0 && hpCur <= 0) return { mode, ko: true, showBar: false, pct: 0, text: 'KO' };
    if (mode === 'exact') {
      const pct = hpMax > 0 ? clamp((hpCur / hpMax) * 100, 0, 100) : 0;
      return { mode, ko: false, showBar: true, pct, text: hpCur + '/' + hpMax + ' PV' };
    }
    if (mode === 'bar') {
      const pct = clamp(Number(e.revealPct != null ? e.revealPct : 100), 0, 100);
      return { mode, ko: false, showBar: true, pct, text: '' };
    }
    return { mode, ko: false, showBar: false, pct: null, text: '' };
  }

  /* ============================================================
     COMPÉTENCES (actif/passif) — logique pure
     Source des formules : info-mj/Codes App Script.md (le script prime).
     ============================================================ */

  /* Dégâts de base d'une arme selon son type (cf. computeBaseDamage_ du Sheet). */
  function skillBaseDamage(wType, eff) {
    const ad = Math.floor((eff && eff.ad) || 0);
    const ap = Math.floor((eff && eff.ap) || 0);
    if (wType === 'Magique') return ap;
    if (wType === 'Hybride') return Math.floor((ad + ap) / 2);
    return ad; // Physique par défaut
  }

  /* Cooldown stocké comme « n° de tour de disponibilité » (readyAt). */
  function cooldownReady(readyAt, currentTurn) {
    if (readyAt == null) return true;
    return currentTurn >= readyAt;
  }
  function nextReadyAt(currentTurn, cd) {
    return currentTurn + (cd | 0);
  }
  /* Déblocage des compétences par niveau : active n° i (0-based) requiert le niveau i+1. */
  function skillUnlocked(index, level) {
    return (Number(level) || 0) >= (Number(index) || 0) + 1;
  }

  /* --- Elias (Fab.gs) : passif Instinct du Chasseur (AD plat par charge) --- */
  function eliasPassiveAD(level) { return 10 + 5 * ((level || 1) - 1); }
  function eliasMaxStacks(level) { return 5 + Math.floor(((level || 1) - 1) / 3); }
  function dmgEliasC1(wType, eff, firstHit) {
    let d = skillBaseDamage(wType, eff);
    if (firstHit) d = Math.floor(d * 1.25);
    return d;
  }
  function dmgEliasC2(eff) { return Math.floor(50 + (eff.ad || 0)); }
  function dmgEliasC3(eff) { return Math.floor(100 + 1.5 * (eff.ad || 0)); }
  function dmgEliasC4(eff, nbTargets) { return Math.floor(50 + 2.0 * (eff.ad || 0)); }
  function skillHeal(total, pct) { return Math.floor((total || 0) * (pct || 0)); }

  /* --- Smith (Erwan.gs) --- */
  function dmgSmithPassif(eff) { return Math.floor(50 + 0.5 * (eff.ap || 0)); }
  function dmgSmithC1(wType, eff, furtif) {
    let d = skillBaseDamage(wType, eff);
    if (furtif) d = Math.floor(d * 1.5);
    return d;
  }
  function dmgSmithC3(eff) { return Math.floor(50 + (eff.ad || 0)); }
  function smithBleedPct(eff) { return 5 + Math.floor((eff.ad || 0) / 100) * 5; }

  /* --- Urskaar (Baptiste.gs + kit C3/C4) : Voie de l'ours --- */
  function bearBonusPct(moved) {
    if (moved < 5) return 0;
    return 150 + Math.floor((moved - 5) / 3) * 25;
  }
  function bearTranches(moved) {
    if (moved < 5) return 0;
    return 1 + Math.floor((moved - 5) / 3);
  }
  function dmgUrskaarC1(eff, side, moved) {
    const base = Math.floor(eff.ad || 0);
    if (side === 'droite') {
      const pct = Math.max(150, bearBonusPct(moved));
      return Math.floor(base * (pct / 100));
    }
    return base;
  }
  function dmgUrskaarC2(eff, moved) {
    const t = bearTranches(moved);
    return Math.floor((eff.ad || 0) * (1.5 + 0.25 * t));
  }
  function urskaarC3Shield(eff, hpMax) {
    return Math.floor((0.30 + 0.10 * ((eff.ap || 0) / 50)) * (hpMax || 0));
  }
  function dmgUrskaarC4(eff, moved) {
    const t = bearTranches(moved);
    return Math.floor((eff.ad || 0) * (1 + 0.25 * t));
  }

  /* --- Jett (Steph.gs) : Nano-hextech --- */
  function jettEngins(eff, isCrit) {
    const ad = eff.ad || 0;
    let n = 1;
    if (ad >= 50) n++;
    if (ad >= 125) n++;
    if (ad >= 225) n++;
    if (ad >= 375) n++;
    return isCrit ? n * 2 : n;
  }
  function dmgJettPoison(eff) { return Math.floor(25 + 0.5 * (eff.ap || 0)); }
  function dmgJettForce(eff) { return Math.floor(25 + 0.5 * (eff.ad || 0)); }
  function dmgJettC2(eff) { return Math.floor(50 + 0.5 * (eff.ad || 0)); }
  function healJettC2(eff) { return Math.floor(50 + 1.0 * (eff.ap || 0)); }

  /* --- Rathael : Chair gelée, âme fendue (le SCRIPT prime sur la description) ---
     C1 Frappe Irritée (rééquilibrée) =
       25 + (30% + 5%/4 niv) AD + (40% + 5%/2 niv) (Armure+RM), × (1 + 0,20 × charges).
     charges = compteur de Glaciation (0..5) ; +100% à 5 charges. Paliers = floor(niv/N). */
  function dmgRathaelC1(eff, charges, level) {
    const ad = (eff && eff.ad) || 0;
    const armure = (eff && eff.armure) || 0;
    const rm = (eff && eff.resmag) || 0;
    const lv = Math.max(1, level | 0);
    const adRatio = 0.30 + 0.05 * Math.floor(lv / 4);
    const arRatio = 0.40 + 0.05 * Math.floor(lv / 2);
    const base = 25 + Math.floor(ad * adRatio) + Math.floor((armure + rm) * arRatio);
    const mult = 1 + 0.20 * Math.max(0, Math.min(5, charges | 0));
    return Math.floor(base * mult);
  }

  /* C2 Mur de Givre : Armure/RM accordés = 15 + 5/2 niv (floor(niv/2)). Valeur unique pour AR et RM. */
  function rathaelC2Buff(level) { return 15 + 5 * Math.floor(Math.max(1, level | 0) / 2); }

  /* C3 Éclat de l'âme : dégâts magiques AoE qui consomment toutes les charges de Glaciation.
     base = 50 + 60% AP + (50% + 10%/2 niv) (Armure+RM) ;
     chaque charge ajoute +50% de la base (max +250% à 5 charges → ×3,5). */
  function dmgRathaelC3(eff, charges, level) {
    const ap = (eff && eff.ap) || 0;
    const armure = (eff && eff.armure) || 0;
    const rm = (eff && eff.resmag) || 0;
    const lv = Math.max(1, level | 0);
    const arRatio = 0.50 + 0.10 * Math.floor(lv / 2);
    const base = 50 + Math.floor(ap * 0.60) + Math.floor((armure + rm) * arRatio);
    const mult = 1 + 0.50 * Math.max(0, Math.min(5, charges | 0));
    return Math.floor(base * mult);
  }

  /* Ultime Souverain Glacial : bonus de PV = 20% des PV de BASE par charge, plafonné à +100% (5 charges).
     baseHp = PV de base (avant équipement/mods). Snapshot au cast. */
  function rathaelUltHpBonus(charges, baseHp) {
    const c = Math.max(0, Math.min(5, charges | 0));
    return Math.floor(Math.min(c * 0.20, 1.0) * (baseHp || 0));
  }

  /* Passif Rathael : +1 charge de Glaciation à chaque coup subi (max 5, tout stackable en 1 tour).
     Pendant Souverain Glacial (ultime), +2 charges/coup : actif tant que turn <= counters.souverainUntil
     (fenêtre posée au cast de l'ultime). Marque aussi glaciationHitTurn = n° du tour où il a été touché
     (pour la non-perte de fin de tour). Renvoie un patch counters, ou null si rien à écrire. */
  function glaciationOnHit(counters, turn) {
    counters = counters || {};
    turn = Math.max(1, turn | 0);
    var charges = Math.max(0, Math.min(5, counters.glaciation | 0));
    var perHit = (counters.souverainUntil && turn <= counters.souverainUntil) ? 2 : 1;
    if (charges >= 5) {                                  // au max : on note quand même le coup du tour
      return counters.glaciationHitTurn === turn ? null : { glaciationHitTurn: turn };
    }
    return { glaciation: Math.min(5, charges + perHit), glaciationHitTurn: turn };
  }

  /* Fin de tour : si Rathael n'a PAS subi de dégâts ce tour (glaciationHitTurn ≠ tour qui se termine),
     il perd 3 charges de Glaciation (min 0). Renvoie un patch { glaciation } ou null. */
  function glaciationDecay(counters, endingTurn) {
    counters = counters || {};
    endingTurn = Math.max(1, endingTurn | 0);
    var charges = Math.max(0, Math.min(5, counters.glaciation | 0));
    if (charges <= 0) return null;
    if (counters.glaciationHitTurn === endingTurn) return null; // touché ce tour → pas de perte
    return { glaciation: Math.max(0, charges - 3) };
  }

  /* Passif calculable → mods plats (mergés dans computeEffective).
     Elias (AD/charge, plat) et Rathael (Armure/RM +10%/charge des stats de BASE). */
  function sumPassiveMods(charId, counters, level, base) {
    counters = counters || {};
    if (charId === 'lunick') { // Elias — Instinct du Chasseur
      const stacks = Math.max(0, counters.chasseur | 0);
      if (!stacks) return {};
      return { ad: stacks * eliasPassiveAD(level) };
    }
    if (charId === 'rathael') { // Chair gelée — +10%/charge des AR/RM de BASE
      const charges = Math.max(0, Math.min(5, counters.glaciation | 0));
      if (!charges || !base) return {};
      const out = {};
      const bA = Math.floor((base.armure || 0) * (1 + 0.10 * charges)) - (base.armure || 0);
      const bR = Math.floor((base.resmag || 0) * (1 + 0.10 * charges)) - (base.resmag || 0);
      if (bA) out.armure = bA;
      if (bR) out.resmag = bR;
      return out;
    }
    return {};
  }

  /* Lit l'effet d'un consommable depuis sa description ("Rend X + Y% HP/Mana") ou par repli sur
     son nom (potion de soin/mana standard). Renvoie { kind, flat, pct } ou null. */
  function parseConsumableEffect(it) {
    if (!it || it.cat !== 'Consommables') return null;
    var txt = (it.sub || '') + ' ' + (it.name || '');
    var m = txt.match(/Rend\s+(\d+)\s*\+\s*(\d+)\s*%\s*(HP|PV|Mana)/i);
    if (m) return { kind: /mana/i.test(m[3]) ? 'mana' : 'hp', flat: parseInt(m[1], 10), pct: parseInt(m[2], 10) };
    if (/potion\s+soin/i.test(it.name || '')) return { kind: 'hp', flat: 15, pct: 15 };
    if (/potion\s+mana/i.test(it.name || '')) return { kind: 'mana', flat: 10, pct: 10 };
    return null;
  }

  /* Positionnement d'un carrousel horizontal plat (slider) : pour chaque carte, l'offset signé le
     plus court par rapport à la carte active (avec wrap autour de l'anneau) → décalage horizontal.
     Carte active : centrée, agrandie, surélevée, au-dessus ; voisines : de face, plus petites et atténuées. */
  function carouselTransforms(count, activeIndex) {
    count = Math.max(1, count | 0);
    var SPACING = 150;
    var out = [];
    for (var i = 0; i < count; i++) {
      var off = i - activeIndex;
      while (off > count / 2) off -= count;
      while (off < -count / 2) off += count;
      var abs = Math.abs(off);
      out.push({
        offset: off,
        translateX: off * SPACING,
        translateY: off === 0 ? -10 : 0,
        scale: off === 0 ? 1.12 : Math.max(0.7, 0.92 - (abs - 1) * 0.14),
        opacity: abs > 2 ? 0 : (off === 0 ? 1 : Math.max(0.4, 0.9 - (abs - 1) * 0.45)),
        zIndex: count - abs,
      });
    }
    return out;
  }

  /* Décompose chaque stat effective en sources : base / +modificateurs / +stuff (items+runes+
     passif+skillBuffs). Les buffs étant multiplicatifs (appliqués au-dessus du socle), on calcule
     des deltas MARGINAUX honnêtes : on recompose computeEffective avec/sans chaque source.
     base = socle brut ; mod = effet des modificateurs ; stuff = effet des mods plats. */
  function statBreakdown(base, modifiers, buffs, stuffMods) {
    base = base || {};
    var effBase = computeEffective(base, {}, buffs, {});
    var effMod  = computeEffective(base, modifiers || {}, buffs, {});
    var effFull = computeEffective(base, modifiers || {}, buffs, stuffMods || {});
    var out = {};
    Object.keys(effFull).forEach(function (k) {
      out[k] = {
        effective: Math.round(effFull[k] || 0),
        base: Math.round(base[k] || 0),
        buff: Math.round((effBase[k] || 0) - (base[k] || 0)),
        mod: Math.round((effMod[k] || 0) - (effBase[k] || 0)),
        stuff: Math.round((effFull[k] || 0) - (effMod[k] || 0)),
      };
    });
    return out;
  }

  /* Buffs sur soi (compétences) : somme des mods plats snapshotés au cast.
     Forme d'une entrée : ancienne plate { [stat]: n } (compat), ou nouvelle
     { mods:{ [stat]: n }, until:<n° de tour>|null } (avec durée).
     currentTurn (optionnel) : si fourni, un buff dont until != null && currentTurn > until
     est expiré → ignoré. Sans currentTurn, aucun filtrage temporel.
     Mergé dans computeEffective (couche items). */
  function sumSkillBuffs(skillBuffs, currentTurn) {
    skillBuffs = skillBuffs || {};
    const hasTurn = Number.isFinite(currentTurn);
    const out = {};
    for (const id of Object.keys(skillBuffs)) {
      const e = skillBuffs[id] || {};
      const isNew = e && typeof e === 'object' && e.mods && typeof e.mods === 'object';
      const mods = isNew ? e.mods : e;
      const until = isNew ? e.until : null;
      if (hasTurn && until != null && currentTurn > until) continue; // expiré
      for (const k of Object.keys(mods)) { const v = Number(mods[k]) || 0; if (v) out[k] = (out[k] || 0) + v; }
    }
    return out;
  }

  /* --- Escalade anti-aplatissement (refonte) ---
     Facteur cumulé par caractéristique. Table §4.3 (mult/pt : 1.00, 1.18, 1.39,
     1.64, 1.94 par tranche de 4). Au-delà de 20 (zone PNJ §8) : mult du point
     (20+k) = 1.94 + 0.5*k → croissance quadratique. */
  var ESC_CUMUL = [0, 1.00, 2.00, 3.00, 4.00, 5.18, 6.36, 7.54, 8.72, 10.11,
    11.50, 12.90, 14.29, 15.93, 17.58, 19.22, 20.86, 22.80, 24.74, 26.68, 28.62];
  function escalationFactor(points) {
    points = Math.max(0, points | 0);
    if (points <= 20) return ESC_CUMUL[points];
    var f = ESC_CUMUL[20];
    for (var k = 1; k <= points - 20; k++) f += 1.94 + 0.5 * k;
    return f;
  }

  /* --- Moteur de stats refondu (info-mj/SPECIFICATION) ---
     8 stats dérivées de 4 caracs + niveau. Magnitude escaladée, crit linéaire.
     Sans Sapience (retirée du socle). */
  function computeStats(F, H, M, C, level) {
    F = Math.max(0, F | 0); H = Math.max(0, H | 0);
    M = Math.max(0, M | 0); C = Math.max(0, C | 0);
    level = Math.max(1, level | 0);
    var eF = escalationFactor(F), eH = escalationFactor(H),
        eM = escalationFactor(M), eC = escalationFactor(C);
    var nH = Math.min(H, 5);                 // bonus de départ Habileté plafonné
    var habPV = 20 * nH, habRes = nH;        // +20 PV, +1 Arm, +1 RM / pt (max 5)
    var fondu = Math.max(0, 20 - 4 * (F + C)); // frappe de base des profils sans dégâts
    return {
      hp:     Math.round(50 + 30 * level + 20 * eF + 20 * eC + 42 * eM + habPV),
      mana:   Math.round(50 + 17 * eF + 17 * eC + 38 * eM),
      ad:     Math.round(20 * eF + 8 * eH + 3 * eM + fondu),
      ap:     Math.round(20 * eC + 8 * eH + 3 * eM + fondu),
      armure: Math.round(level + 4 * eF + habRes),
      resmag: Math.round(level + 4 * eC + habRes),
      crit:   5 + 10 * H + 2 * M,
      dcrit:  150 + 2 * F + 2 * C + 6 * H,
    };
  }

  /* --- Respec : répartition des 4 caractéristiques (logique pure) ---
     budget = points répartissables (LEVELS.total + bonus de création) ; cap = plafond par caracs. */
  function attrSum(attrs) {
    attrs = attrs || {};
    return (attrs.force | 0) + (attrs.hab | 0) + (attrs.mental | 0) + (attrs.magie | 0);
  }
  /* floor (optionnel) = plancher PAR caracs (ex. valeurs déjà confirmées) : on ne peut pas
     descendre en dessous. Absent → plancher 0 (compat). */
  function respecValid(attrs, budget, cap, floor) {
    attrs = attrs || {};
    floor = floor || {};
    budget = budget | 0; cap = cap | 0;
    const keys = ['force', 'hab', 'mental', 'magie'];
    for (const k of keys) {
      const v = attrs[k] | 0;
      if (v < (floor[k] | 0) || v > cap) return false;
    }
    return attrSum(attrs) === budget;
  }

  /* Stats de base d'un perso, live : caracs/niveau effectifs (override state). */
  function charBaseStats(char, state) {
    var a = (state && state.attrs) || (char && char.attrs) || { force: 0, hab: 0, mental: 0, magie: 0 };
    var level = (state && state.level != null ? state.level : (char && char.level)) || 1;
    return computeStats(a.force, a.hab, a.mental, a.magie, level);
  }

  /* XP & niveau : courbe officielle du MJ (info-mj/tableau_XP.png).
     XP requis pour passer du niveau L au L+1 = 180 + 100*L (lvl1→2 = 280, lvl17→18 = 1880).
     Niveau max = 18 (cap) ; au cap, xpToNext = Infinity et l'XP intra-niveau est figée à 0.
     xp = progression DANS le niveau courant ; le surplus reporte en cascade. */
  var MAX_LEVEL = 18;
  function xpToNext(level) {
    level = Math.max(1, level | 0);
    if (level >= MAX_LEVEL) return Infinity;
    return 180 + 100 * level;
  }
  function applyXp(level, xp, gain) {
    level = Math.max(1, level | 0);
    xp = Math.max(0, xp | 0) + Math.max(0, gain | 0);
    let levelsGained = 0;
    while (level < MAX_LEVEL && xp >= xpToNext(level)) { xp -= xpToNext(level); level += 1; levelsGained += 1; }
    if (level >= MAX_LEVEL) xp = 0;
    return { level, xp, levelsGained };
  }
  function applyXpLoss(level, xp, loss) {
    level = Math.max(1, level | 0);
    xp = Math.max(0, xp | 0) - Math.max(0, loss | 0);
    let levelsLost = 0;
    while (xp < 0 && level > 1) { level -= 1; xp += xpToNext(level); levelsLost += 1; }
    if (xp < 0) xp = 0;   // plancher niveau 1
    return { level, xp, levelsLost };
  }

  return {
    clamp, clampGauge,
    DEFAULT_MODIFIERS, BUFF_STAT_MAP, computeEffective, sumItemMods,
    applyHealMods, buildDefaultState, makeItem, newItemId,
    EQUIP_TYPES, planItemTransfer,
    STACK_MAX, fillStacks, planItemAdd, buildCatalogSeed, catalogArray,
    CARRY_BASE, CARRY_PER_FORCE, carriedWeight, carryCapacity, weightStatus,
    paginate,
    RUNE_COST, buildRuneIndex, runeBudget, runeSpent,
    canSelectRune, canDeselectRune, sumRuneMods, mergeMods,
    mitigateDamage, applyDamageToPools, lifestealHeal, critInfo, rollCrit, enemyPublicView,
    skillBaseDamage, cooldownReady, nextReadyAt, skillUnlocked,
    eliasPassiveAD, eliasMaxStacks, dmgEliasC1, dmgEliasC2, dmgEliasC3, dmgEliasC4, skillHeal,
    dmgSmithPassif, dmgSmithC1, dmgSmithC3, smithBleedPct,
    dmgRathaelC1, rathaelC2Buff, dmgRathaelC3, rathaelUltHpBonus, glaciationOnHit, glaciationDecay,
    bearBonusPct, bearTranches, dmgUrskaarC1, dmgUrskaarC2, urskaarC3Shield, dmgUrskaarC4,
    jettEngins, dmgJettPoison, dmgJettForce, dmgJettC2, healJettC2,
    sumPassiveMods, sumSkillBuffs, statBreakdown, parseConsumableEffect, carouselTransforms,
    xpToNext, applyXp, applyXpLoss, MAX_LEVEL,
    escalationFactor, computeStats, charBaseStats, attrSum, respecValid,
  };
});
