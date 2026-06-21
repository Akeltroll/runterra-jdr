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
      });
      patch[fresh.id] = fresh;
      remaining -= take;
    }
    return patch;
  }

  function planItemAdd(items, entry, qty) {
    return { patch: fillStacks(items, entry, qty) };
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
      hpCur:   Math.round((char.hpCur || 0) * char.stats.hp),
      manaCur: Math.round((char.manaCur || 0) * char.stats.mana),
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

  /* Passif calculable → mods plats (mergés dans computeEffective). Elias seul
     pour l'instant ; Rathael (pct) en pause ; Jett/Smith/Urskaar = pas de bonus net. */
  function sumPassiveMods(charId, counters, level) {
    counters = counters || {};
    if (charId === 'lunick') { // Elias — Instinct du Chasseur
      const stacks = Math.max(0, counters.chasseur | 0);
      if (!stacks) return {};
      return { ad: stacks * eliasPassiveAD(level) };
    }
    return {};
  }

  /* Buffs sur soi (compétences) : somme des mods plats snapshotés au cast,
     toutes compétences confondues. Mergé dans computeEffective (couche items). */
  function sumSkillBuffs(skillBuffs) {
    skillBuffs = skillBuffs || {};
    const out = {};
    for (const id of Object.keys(skillBuffs)) {
      const m = skillBuffs[id] || {};
      for (const k of Object.keys(m)) { const v = Number(m[k]) || 0; if (v) out[k] = (out[k] || 0) + v; }
    }
    return out;
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

  return {
    clamp, clampGauge,
    DEFAULT_MODIFIERS, BUFF_STAT_MAP, computeEffective, sumItemMods,
    applyHealMods, buildDefaultState, makeItem, newItemId,
    EQUIP_TYPES, planItemTransfer,
    STACK_MAX, fillStacks, planItemAdd,
    paginate,
    RUNE_COST, buildRuneIndex, runeBudget, runeSpent,
    canSelectRune, canDeselectRune, sumRuneMods, mergeMods,
    mitigateDamage, applyDamageToPools,
    skillBaseDamage, cooldownReady, nextReadyAt, skillUnlocked,
    eliasPassiveAD, eliasMaxStacks, dmgEliasC1, dmgEliasC2, dmgEliasC3, dmgEliasC4, skillHeal,
    dmgSmithPassif, dmgSmithC1, dmgSmithC3, smithBleedPct,
    bearBonusPct, bearTranches, dmgUrskaarC1, dmgUrskaarC2, urskaarC3Shield, dmgUrskaarC4,
    jettEngins, dmgJettPoison, dmgJettForce, dmgJettC2, healJettC2,
    sumPassiveMods, sumSkillBuffs,
    xpToNext, applyXp, MAX_LEVEL,
  };
});
