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

  return {
    clamp, clampGauge,
    DEFAULT_MODIFIERS, BUFF_STAT_MAP, computeEffective, sumItemMods,
    applyHealMods, buildDefaultState, makeItem, newItemId,
    EQUIP_TYPES, planItemTransfer,
    STACK_MAX, fillStacks, planItemAdd,
    paginate,
    RUNE_COST, buildRuneIndex, runeBudget, runeSpent,
    canSelectRune, canDeselectRune, sumRuneMods, mergeMods,
  };
});
