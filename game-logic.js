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
  function computeEffective(base, modifiers, activeBuffs) {
    modifiers = modifiers || {};
    activeBuffs = activeBuffs || [];
    const withMod = {};
    for (const k of Object.keys(base)) withMod[k] = base[k] + (modifiers[k] || 0);
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

    var dstPatch = {};
    var twinId = null, twin = null;
    for (var k in dstItems) { if (_sameKind(dstItems[k], src)) { twinId = k; twin = dstItems[k]; break; } }
    if (twin) {
      dstPatch[twinId] = Object.assign({}, twin, { qty: (twin.qty || 0) + move });
    } else {
      var fresh = makeItem({
        cat: src.cat, name: src.name, sub: src.sub, qty: move,
        ic: src.ic, img: src.img, type: src.type, mods: src.mods,
      });
      dstPatch[fresh.id] = fresh;
    }
    return { srcPatch: srcPatch, dstPatch: dstPatch };
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
    DEFAULT_MODIFIERS, BUFF_STAT_MAP, computeEffective,
    applyHealMods, buildDefaultState, makeItem, newItemId,
    EQUIP_TYPES, planItemTransfer,
  };
});
