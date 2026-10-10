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

  /* --- Bonus de stats des items équipés : somme des item.mods ---
     + les stats d'arme que la maîtrise débloque (`sumWeaponPropMods`, Canalisation/Plénitude).
     ⚠️ Une arme rangée en ACCESSOIRE ne donne rien (décision MJ 5c du 2026-09-14) : elle
     signale seulement une mini-arme à portée de main.
     ⚠️ `masteries` et `level` sont à passer par TOUS les appelants (fiche, Combat,
     Équipement, MJ, resetCombat) : en oublier un fait diverger le mana max d'une page. */
  function sumItemMods(equipment, itemsById, masteries, level) {
    equipment = equipment || {};
    itemsById = itemsById || {};
    const out = sumWeaponPropMods(equipment, itemsById, masteries, level);
    // ⚠️ Mini-arme tenue AVEC une arme non mini : sa propriété reste utilisable, mais ses stats ne
    // comptent PAS (décision MJ du 2026-09-15). Ses stats ne s'ajoutent qu'en paire mini + mini.
    const support = mutedSupport(equipment, itemsById);
    for (const slot of Object.keys(equipment)) {
      const id = equipment[slot];
      if (!id) continue;
      const it = itemsById[id];
      if (!it || !it.mods) continue;
      if (isAccessorySlot(slot) && isWeaponItem(it)) continue;
      if (support && it === support) continue;
      for (const k of Object.keys(it.mods)) {
        const v = Number(it.mods[k]) || 0;
        if (v) out[k] = (out[k] || 0) + v;
      }
    }
    return out;
  }

  /* --- Soins et boucliers : la stat `soins` + Miraculé / Hémorragie (2026-10-05) ---
     Règles du MJ, à ne pas réinterpréter :
       · `soins` (% du porteur) compte CÔTÉ PRODUCTEUR **et** CÔTÉ RECEVEUR, en ADDITIF ;
       · producteur = receveur → compté UNE SEULE FOIS, comme producteur ;
       · Miraculé = +50 % sur les soins/boucliers **REÇUS** (sens corrigé le 2026-10-05) ;
       · Hémorragie = −50 % sur TOUT soin/bouclier, produit comme reçu — appliqué une fois
         même si les deux côtés l'ont (« réduit de 50 % », pas « se cumule ») ;
       · ⚠️ NE s'applique PAS au vol de vie / omnivamp : ils ont leur propre règle
         (`lifestealHeal`, Miraculé +25 % / Hémorragie −50 %) ;
       · ⚠️ NE s'applique PAS à une hausse de PV MAX (`hpGain` d'un `selfBuff.hp` :
         Urskaar C4, ultime de Rathäel) — c'est un plafond déplacé, pas un soin.
     Une potion n'a pas de producteur : seul le receveur compte. */
  function healMultiplier(o) {
    o = o || {};
    var pct = Number(o.producerSoins) || 0;
    if (!o.sameActor) pct += Number(o.receiverSoins) || 0;
    var f = Math.max(0, 1 + pct / 100);
    var rb = o.receiverBuffs || [], pb = o.producerBuffs || [];
    if (rb.indexOf('miracule') !== -1) f *= 1.5;
    if (rb.indexOf('hemorragie') !== -1 || pb.indexOf('hemorragie') !== -1) f *= 0.5;
    return f;
  }
  function applyHealBonus(amount, o) {
    return Math.max(0, Math.round((Number(amount) || 0) * healMultiplier(o)));
  }
  /* Vol de vie / omnivamp : règle PROPRE, volontairement différente (le gain est
     inconditionnel, donc il ne reçoit pas le même traitement que les soins ciblés).
     Miraculé +25 %, Hémorragie −50 %. `buffs` = ceux de celui qui encaisse le gain. */
  function lifestealMultiplier(buffs) {
    buffs = buffs || [];
    var f = 1;
    if (buffs.indexOf('miracule') !== -1) f *= 1.25;
    if (buffs.indexOf('hemorragie') !== -1) f *= 0.5;
    return f;
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
      carry:  Number(p.carry) || 0,    // bonus de capacité de charge PERSONNELLE (canal 'p') — objet équipé
      carryGroup: Number(p.carryGroup) || 0,  // bonus de capacité de charge du GROUPE (canal 'g') — coffre commun
      armorClass: p.armorClass || '',  // '' | 'legere' | 'intermediaire' | 'lourde' (armures)
      weaponCat: p.weaponCat || '',    // id de WEAPON_CATEGORIES ('' = pas une arme, ou arme neutre)
    };
  }

  /* --- Transfert/fusion d'items : logique pure --- */
  function _sameKind(a, b) {
    return a && b && a.name === b.name && (a.type || '') === (b.type || '') && a.cat === b.cat
      && (a.armorClass || '') === (b.armorClass || '') && (a.weaponCat || '') === (b.weaponCat || '');
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
      weight: src.weight, carry: src.carry, carryGroup: src.carryGroup, armorClass: src.armorClass,
      weaponCat: src.weaponCat,
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
        weight: entry.weight, carry: entry.carry, carryGroup: entry.carryGroup, armorClass: entry.armorClass,
        weaponCat: entry.weaponCat,
      });
      patch[fresh.id] = fresh;
      remaining -= take;
    }
    return patch;
  }

  function planItemAdd(items, entry, qty) {
    return { patch: fillStacks(items, entry, qty) };
  }

  /* --- Monnaie : dénominations et conversion (guide d'économie du MJ) ---------
     Chaîne officielle : 100 cuivre = 1 argent, 100 argent = 1 or, 10 or = 1 platine.
     Les valeurs sont exprimées en CUIVRE (unité de base) ; tous les rapports entre
     deux dénominations voisines ou non sont donc des entiers dans les deux sens. */
  var COIN_VALUE = { cuiv: 1, arg: 100, or: 10000, plat: 100000 };

  /* Poids des pièces (guide d'économie du MJ §3 « Le poids de votre bourse ») :
     combien de pièces il faut pour UNE unité de poids.
     ⚠️ Ce barème n'est PAS monotone avec la valeur, et ce n'est pas une coquille :
     l'OR est la pièce la PLUS LOURDE (frappée large et épaisse, on la soupèse pour
     vérifier qu'elle est vraie) et le PLATINE la PLUS LÉGÈRE (à peine plus grand
     qu'un ongle de pouce). Ne pas « corriger » l'ordre. */
  var COIN_PER_WEIGHT = { cuiv: 200, arg: 100, or: 67, plat: 200 };

  /* Poids total d'une bourse, valeur EXACTE (fractionnaire — décision MJ du 2026-08-21 :
     on garde la précision en interne et on n'arrondit qu'à l'affichage, sinon une bourse
     de 199 cuivres pèserait 0 et le poids disparaîtrait par petits paquets).
     Repères du guide : 67 or = 1 · 100 argent = 1 · 200 cuivre = 1 · 500 argent = 5. */
  function coinsWeight(coins) {
    var tot = 0;
    for (var k in COIN_PER_WEIGHT) {
      var n = Math.max(0, Number((coins && coins[k]) || 0));
      tot += n / COIN_PER_WEIGHT[k];
    }
    return tot;
  }

  /* Plan de conversion PUR : convertit `n` pièces de `fromKey` vers `toKey`.
       - vers le bas (or → cuivre) : exact, tout le montant demandé est converti ;
       - vers le haut (cuivre → argent) : seuls les multiples entiers passent, le
         reste est LAISSÉ dans la bourse (jamais perdu, jamais arrondi en faveur
         de personne).
     `n` est borné au solde disponible. Renvoie null si la conversion ne donne
     rien (clés inconnues ou identiques, solde nul, montant sous le seuil du
     premier échange) ; sinon { spent, gained, unit, patch } où `unit` = combien
     de `fromKey` valent UN `toKey`, et `patch` = valeurs ABSOLUES des 2 clés. */
  function planCoinConvert(coins, fromKey, toKey, n) {
    var vf = COIN_VALUE[fromKey], vt = COIN_VALUE[toKey];
    if (!vf || !vt || fromKey === toKey) return null;
    var have = Math.max(0, ((coins && coins[fromKey]) || 0) | 0);
    var want = Math.min(Math.max(0, n | 0), have);
    var spent, gained;
    if (vf >= vt) { gained = want * (vf / vt); spent = want; }        // vers le bas : exact
    else { var unit = vt / vf; gained = Math.floor(want / unit); spent = gained * unit; }
    if (spent <= 0 || gained <= 0) return null;
    var patch = {};
    patch[fromKey] = have - spent;
    patch[toKey] = (((coins && coins[toKey]) || 0) | 0) + gained;
    return { spent: spent, gained: gained, unit: vt / vf, patch: patch };
  }

  /* Assainit les pieces d'une sauvegarde importee (MUTE `data`, rend le nombre de
     valeurs corrigees). L'import ecrit TOUT le sous-arbre campagne d'un coup : une
     seule piece non entiere ferait echouer l'import ENTIER une fois le .validate
     publie (doc durcissement monnaie §6). On aligne donc la sauvegarde sur le
     contrat de la regle plutot que de la laisser etre rejetee en bloc. */
  function sanitizeCampaignCoins(data) {
    var fixed = 0;
    function fix(purse) {
      if (!purse || typeof purse !== 'object') return;
      for (var k in purse) {
        var norm = coinInt(purse[k]);
        if (purse[k] !== norm) { purse[k] = norm; fixed++; }
      }
    }
    if (!data || typeof data !== 'object') return 0;
    fix(data.sharedCoins);
    var chars = data.characters || {};
    for (var id in chars) {
      var st = chars[id] && chars[id].state;
      if (st) fix(st.coins);
    }
    return fixed;
  }

  /* Plan de transfert de pieces (PUR) : borne `n` au solde disponible et rend les
     valeurs ABSOLUES a ecrire de chaque cote. null si rien ne bouge.
     Extrait de moveCoins pour etre testable : la regression « bourse ecrasee au
     lieu d'etre creditee » venait d'un etat de destination faux, pas du calcul. */
  function planCoinMove(fromCoins, toCoins, key, n) {
    var avail = coinInt(fromCoins && fromCoins[key]);
    var m = Math.max(0, Math.min(n | 0, avail));
    if (m <= 0) return null;
    var dst = coinInt(toCoins && toCoins[key]);
    return { moved: m, from: avail - m, to: dst + m };
  }

  /* --- Journal d'économie : formatage des mouvements de pièces ---------------
     Textes purs (donc testables) partagés par tous les orchestrateurs qui
     déplacent de l'argent. L'UI garde ses propres libellés capitalisés dans
     INV_COINS (components.jsx) : même ordre, même sens, autre usage. */
  var COIN_NAME = { cuiv: 'cuivre', arg: 'argent', or: 'or', plat: 'platine' };

  /* Normalise une valeur de piece en entier >= 0 (NaN/undefined/negatif/decimal -> 0
     ou troncature). Meme contrat que la regle RTDB `state/coins/$coin`. */
  function coinInt(v) { var n = Math.floor(Number(v) || 0); return n > 0 ? n : 0; }
  var COIN_DESC = ['plat', 'or', 'arg', 'cuiv'];   // de la plus forte à la plus faible

  /* Montant lisible : { or:2, cuiv:15 } → « 2 or, 15 cuivre ». Zéros et clés
     inconnues ignorés ; '' si le montant est vide. */
  function coinsAmountText(coins) {
    var parts = [];
    for (var i = 0; i < COIN_DESC.length; i++) {
      var k = COIN_DESC[i];
      var n = Math.abs((coins && coins[k]) | 0);
      if (n) parts.push(n + ' ' + COIN_NAME[k]);
    }
    return parts.join(', ');
  }

  /* Delta lisible entre deux bourses : « +2 or, −15 cuivre » (signe explicite,
     tiret demi-cadratin comme partout dans l'UI). `after` peut être un patch
     PARTIEL : une clé absente est réputée inchangée. '' si rien n'a bougé. */
  function coinsDeltaText(before, after) {
    var parts = [];
    for (var i = 0; i < COIN_DESC.length; i++) {
      var k = COIN_DESC[i];
      if (!after || after[k] == null) continue;
      var d = (after[k] | 0) - ((before && before[k]) | 0);
      if (d) parts.push((d > 0 ? '+' : '−') + Math.abs(d) + ' ' + COIN_NAME[k]);
    }
    return parts.join(', ');
  }

  /* Valeur nette d'un delta, en CUIVRE : > 0 = enrichissement, < 0 = retrait,
     0 = neutre ou compensé (un change de monnaie, typiquement). Sert à colorer
     l'entrée de journal sans avoir à deviner l'intention. */
  function coinsDeltaValue(before, after) {
    var tot = 0;
    for (var k in COIN_VALUE) {
      if (!after || after[k] == null) continue;
      tot += ((after[k] | 0) - ((before && before[k]) | 0)) * COIN_VALUE[k];
    }
    return tot;
  }

  /* --- Journal : plafond d'entrées -------------------------------------------
     Le journal de combat est purgé par « ⟲ Combat » ; celui d'économie ne l'est
     JAMAIS (c'est tout son intérêt), donc sans élagage il grossirait sans fin.
     staleLogIds rend les ids à SUPPRIMER pour ne garder que les `max` plus
     récents. Tri déterministe : à horodatage égal, l'id départage. */
  var LOG_MAX = 30;
  function staleLogIds(map, max) {
    max = max == null ? LOG_MAX : Math.max(0, max | 0);
    var all = [];
    for (var id in (map || {})) all.push({ id: id, ts: (map[id] && map[id].ts) || 0 });
    if (all.length <= max) return [];
    all.sort(function (a, b) { return (b.ts - a.ts) || (a.id < b.id ? 1 : -1); });
    return all.slice(max).map(function (e) { return e.id; });
  }

  /* --- Système de poids porté (affichage seul ; le MJ arbitre la surcharge) --- */
  var CARRY_BASE = 30;        // capacité de base commune (plancher garanti) — spec poids/encombrement
  var CARRY_PER_FORCE = 5;    // capacité gagnée par point de Force

  /* `coins` (optionnel) = bourse à compter dans la charge (les pièces pèsent, cf. coinsWeight).
     Paramètre plutôt qu'addition sur chaque site d'appel : c'est le seul moyen qu'un futur
     écran affichant une charge ne puisse pas oublier le poids de l'argent. */
  function carriedWeight(items, mental, equipment, coins) {
    items = items || {};
    equipment = equipment || {};
    var armorId = equipment.armure || null;   // objet dans le slot Armure → réduction Mental (§5.1)
    var tot = 0;
    for (var k in items) {
      var it = items[k] || {};
      var w = Number(it.weight) || 0;
      if (armorId && k === armorId) w = armorEffectiveWeight(w, mental);   // armure équipée allégée
      tot += w * (Number(it.qty) || 0);
    }
    return tot + (coins ? coinsWeight(coins) : 0);
  }

  function carryCapacity(force, mental, level, equipment, itemsById) {
    force = Number(force) || 0;
    mental = Number(mental) || 0;
    level = Math.max(1, Number(level) || 1);
    equipment = equipment || {}; itemsById = itemsById || {};
    var bonus = 0;
    for (var slot in equipment) {
      var id = equipment[slot]; if (!id) continue;
      var it = itemsById[id]; if (it) bonus += Number(it.carry) || 0;
    }
    /* Charge max = 30 + Force×5 + Mental×Niveau÷10 + bonus 'carry' des objets équipés,
       arrondi à l'inférieur (spec « Système de poids et d'encombrement »).
       Le terme brut vit dans `carryBaseRaw`, partagé avec le calcul de capacité commune. */
    return Math.floor(carryBaseRaw(force, mental, level) + bonus);
  }

  /* --- Attelage du groupe : slots de transport du COFFRE COMMUN ---------------
     Le canal 'g' (§6 du doc « Système de poids — Inventaire commun ») ne se déclenche
     PAS par simple présence dans le coffre — sinon dix sacs rangés en vrac gonfleraient
     la capacité de +200. Décision MJ du 2026-08-21 : un objet n'apporte sa capacité de
     groupe que **placé dans un emplacement de transport actif**, et il y en a 5.
     Ces slots vivent sur le coffre COMMUN (nœud partagé `sharedTransport`), pas sur le
     paperdoll perso : c'est ce qui permet de garder les inventaires personnels privés. */
  var TRANSPORT_SLOTS = [
    { key:'monture1', label:'Monture 1',  accepts:['mount'] },
    { key:'monture2', label:'Monture 2',  accepts:['mount'] },
    { key:'sac1',     label:'Sac 1',      accepts:['pack']  },
    { key:'sac2',     label:'Sac 2',      accepts:['pack']  },
    { key:'sac3',     label:'Sac 3',      accepts:['pack']  },
  ];

  /* Un slot d'attelage accepte-t-il cet objet ?
     Règle en deux temps, volontairement TOLÉRANTE :
       1. l'objet doit apporter quelque chose au groupe (`carryGroup > 0`) — sinon il n'a
          rien à faire dans un attelage ;
       2. son `type` doit être accepté par le slot... SAUF s'il n'a pas de type du tout,
          auquel cas il passe partout. Le champ « Emplacement » de l'éditeur n'apparaît que
          pour cat==='Équipement' : un sac rangé en Butin ne PEUT pas être typé, et on ne va
          pas le refuser pour ça. */
  function transportAccepts(slot, item) {
    if (!slot || !item) return false;
    if (!(Number(item.carryGroup) > 0)) return false;
    var t = item.type || '';
    if (!t) return true;
    return (slot.accepts || []).indexOf(t) !== -1;
  }

  /* Σ des bonus de capacité de GROUPE réellement actifs = les objets placés dans les slots
     d'attelage. `transport` = { [slotKey]: itemId }, `items` = le coffre commun.
     Le bonus est compté PAR PILE et non par unité (deux ceintures empilées ne doublent pas
     la capacité), comme `carryCapacity` le fait déjà pour le canal personnel. */
  function sumTransportCarry(transport, items) {
    var tr = transport || {}, inv = items || {}, seen = {}, tot = 0;
    for (var i = 0; i < TRANSPORT_SLOTS.length; i++) {
      var id = tr[TRANSPORT_SLOTS[i].key];
      if (!id || seen[id]) continue;              // même objet sur 2 slots = compté 1 fois
      seen[id] = true;
      var it = inv[id];
      if (!it) continue;                          // référence orpheline (objet pris/supprimé)
      if ((it.qty != null) && !(it.qty > 0)) continue;   // pile vide = rien
      tot += Number(it.carryGroup) || 0;
    }
    return tot;
  }

  /* Seuil de confort = 60% + Habileté×2% (plafond 90%), en fraction de la charge max. */
  function comfortPct(hab) {
    hab = Number(hab) || 0;
    return Math.min(90, 60 + hab * 2) / 100;
  }

  /* --- Capacité COMMUNE du coffre (§3-4 du doc « Inventaire commun ») ---------
     Capacité = grandeur EXTENSIVE → on SOMME les capacités de base des joueurs.
     Confort  = grandeur INTENSIVE → on fait la MOYENNE des conforts individuels.
     `profiles` = [{ force, mental, hab, level }], un par personnage.

     ⚠️ Pourquoi ne pas réutiliser `carryCapacity()` ici, alors qu'elle a la même formule :
       1. elle arrondit à l'inférieur INDIVIDUELLEMENT, alors que le doc arrondit une seule
          fois à la fin (⌊ Σ … ⌋). Sur le groupe actuel l'écart vaut 1 unité (246 vs 247) ;
       2. elle ajoute le bonus `carry` PERSONNEL des objets équipés, que le §3 exclut
          explicitement du calcul commun.
     D'où `carryBaseRaw` : le terme brut, non arrondi et sans bonus, partagé par les deux. */
  function carryBaseRaw(force, mental, level) {
    force = Number(force) || 0;
    mental = Number(mental) || 0;
    level = Math.max(1, Number(level) || 1);
    return CARRY_BASE + force * CARRY_PER_FORCE + (mental * level) / 10;
  }

  /* Somme BRUTE des capacités de base, non arrondie — c'est le « Σ_i » du §3 du doc MJ,
     conservé tel quel pour rester vérifiable contre son exemple chiffré (§9 : 352). */
  function groupCarryBase(profiles) {
    var list = profiles || [], tot = 0;
    for (var i = 0; i < list.length; i++) {
      var p = list[i] || {};
      tot += carryBaseRaw(p.force, p.mental, p.level);
    }
    return tot;
  }

  /* ⚠️ ÉCART ASSUMÉ AU DOC MJ, arbitré par le MJ le 2026-08-21 après essai en jeu.
     Le §3 du doc pose « Capacité commune = Σ des capacités individuelles ». Mais dans l'app le
     coffre est un stockage SÉPARÉ des sacs persos : à pleine somme, le groupe disposerait de
     247 (sacs) + 247 (coffre) = ~494, soit le double de sa capacité réelle, et le seuil
     d'encombrement du coffre (167) ne serait jamais atteint — une armure lourde pèse 20.
     Le coffre ne représente donc qu'une FRACTION de la capacité collective : ce que le groupe
     peut porter en plus de ce qu'il a déjà sur le dos.
     Le ratio est le curseur d'équilibrage de ce système : une seule ligne à changer.
     À 30 %, le groupe actuel a 74 de coffre — cohérent avec les ordres de grandeur du guide
     d'économie (« quatre brigands dépouillés = 22 unités », charge perso de 30 à 80 au niveau 1). */
  var GROUP_CARRY_RATIO = 0.30;

  /* Le ratio NE s'applique PAS au bonus d'attelage : une monture est intégralement dédiée au
     portage collectif, il n'y a rien à en défalquer. C'est aussi ce qui donne son intérêt à
     l'attelage — un chameau à +50 pèse plus lourd dans le calcul que tout le groupe réuni. */
  function groupCarryCapacity(profiles, bonusGroup) {
    return Math.floor(groupCarryBase(profiles) * GROUP_CARRY_RATIO + (Number(bonusGroup) || 0));
  }

  /* Moyenne des seuils de confort individuels — chaque joueur compte à parts égales.
     Groupe vide : on retombe sur le plancher individuel (60 %) plutôt que 0, qui mettrait
     un coffre vide en « Encombré ». */
  function groupComfortPct(profiles) {
    var list = profiles || [];
    if (!list.length) return comfortPct(0);
    var tot = 0;
    for (var i = 0; i < list.length; i++) tot += comfortPct((list[i] || {}).hab);
    return tot / list.length;
  }

  /* Compare le poids porté au seuil de confort et à la charge max → état d'encombrement.
     États (affichage seul ; les malus sont arbitrés sur Roll20) :
       'leger'     : poids ≤ seuil de confort
       'encombre'  : seuil de confort < poids ≤ charge max
       'surcharge' : poids > charge max */
  function weightStatus(carried, cap, hab) {
    return weightStatusPct(carried, cap, comfortPct(hab));
  }

  /* Même chose, mais le seuil de confort est donné directement en fraction (0..1) au lieu
     d'être dérivé d'une Habileté. C'est ce qu'il faut au coffre COMMUN, dont le confort est
     une MOYENNE de plusieurs joueurs et ne correspond donc à l'Habileté de personne. */
  function weightStatusPct(carried, cap, cPct) {
    carried = Number(carried) || 0; cap = Number(cap) || 0;
    cPct = Number(cPct) || 0;
    var comfort = Math.floor(cPct * cap);
    var state = carried > cap ? 'surcharge' : (carried > comfort ? 'encombre' : 'leger');
    return { pct: cap > 0 ? carried / cap : 0, over: carried > cap,
             comfort: comfort, comfortPct: cPct, state: state };
  }

  /* --- Armures : classes + réduction du poids par le Mental (spec §5.1) --- */
  /* Classes d'armure : libellé (affichage) + poids de base par défaut. */
  var ARMOR_CLASSES = [
    { value:'legere',        label:'Légère',        baseWeight:4  },
    { value:'intermediaire', label:'Intermédiaire', baseWeight:10 },
    { value:'lourde',        label:'Lourde',        baseWeight:20 },
  ];

  /* Réduction du poids d'armure par le Mental (endurance à porter) :
     −5 %/pt sur les 5 premiers points, puis −1 %/pt au-delà, plafond −40 %.
     Indépendante du niveau. Repères : M0→0, M5→0.25, M10→0.30, M13→0.33, M20→0.40. */
  function armorWeightReduction(mental) {
    var m = Math.max(0, Number(mental) || 0);
    var r = m <= 5 ? 0.05 * m : 0.25 + 0.01 * (m - 5);
    return Math.min(0.40, r);
  }

  /* Poids d'armure effectif = poids de base × (1 − réduction), arrondi à l'entier inférieur. */
  function armorEffectiveWeight(baseWeight, mental) {
    var w = Math.max(0, Number(baseWeight) || 0);
    return Math.floor(w * (1 - armorWeightReduction(mental)));
  }

  /* ============================================================
     ARMES ET MAÎTRISES — référentiel + profil d'attaque de base
     Spec : docs/superpowers/specs/2026-09-14-armes-maitrises-design.md
     Sources : document MJ « Nouveau système de gestion des attaques de base (2) »
     (catégories) + docs/armes-maitrises.md (valeurs RÉVISÉES des propriétés).
     ============================================================ */

  /* Modes d'une arme = stat de calcul + type de dégâts. Une arme hybride a DEUX modes,
     choisis par le joueur dans l'onglet Combat (décision MJ du 2026-09-14) — ce n'est
     plus la « moyenne AD/AP » du §6.1 de la SPECIFICATION. */
  var WEAPON_MODES = {
    phys: [ { id: 'ad', label: 'Physique', stat: 'ad', dmgType: 'physique' } ],
    mag:  [ { id: 'ap', label: 'Magique',  stat: 'ap', dmgType: 'magique' } ],
    hyb:  [ { id: 'ad', label: 'Physique', stat: 'ad', dmgType: 'physique' },
            { id: 'ap', label: 'Magique',  stat: 'ap', dmgType: 'magique' } ],
  };

  /* Bonus de stat par palier (SPECIFICATION §7.1, confirmé MJ le 2026-09-14). */
  var WEAPON_TIER_MODS = {
    base: { phys: { ad: 15 }, mag: { ap: 15 }, hyb: { ad: 10, ap: 10 } },
    sup:  { phys: { ad: 30 }, mag: { ap: 30 }, hyb: { ad: 20, ap: 20 } },
    leg:  { phys: { ad: 70 }, mag: { ap: 70 }, hyb: { ad: 45, ap: 45 } },
  };
  var WEAPON_TIERS = [
    { value: 'base', label: 'De base' }, { value: 'sup', label: 'Supérieure' }, { value: 'leg', label: 'Légendaire' },
  ];

  /* Propriétés. `text` = version RÉVISÉE (2026-09-12), jamais celle d'origine du document MJ.
     `passiveMods(level)` = statistique d'arme que SEULE la maîtrise débloque (MJ, 2026-09-15) :
     elle est donnée en permanence, quelle que soit la propriété lancée ce tour. */
  var WEAPON_PROPERTIES = {
    adaptation:           { name: 'Adaptation', text: 'Choix physique/magique à chaque attaque ; la vulnérabilité de la cible n\'est connue qu\'après avoir testé les deux types.' },
    assommage:            { name: 'Assommage', text: '10 % de chances d\'étourdir la cible pour sa prochaine action.' },
    attaque_double:       { name: 'Attaque double', text: '2 attaques de base à 65 % dans le même tour, cibles libres. Sans rechargement.' },
    attaque_lente:        { name: 'Attaque lente', malus: true, text: 'Déplacement limité à 2 cases si le personnage attaque avec cette arme.' },
    balayage:             { name: 'Balayage', text: 'Jusqu\'à 3 cibles à portée, 80 % des dégâts. Pas deux tours d\'affilée.' },
    brisage:              { name: 'Brisage', text: '50 % d\'infliger Brisé (−50 % armure) pendant 2 tours. Rechargement 3 tours.' },
    canalisation:         { name: 'Canalisation', text: 'Canalise 5 % du mana max en dégâts bruts ×2 sur l\'attaque de base. Maîtrisée : +50 Mana + 10 Mana par niveau.',
                            passiveMods: function (level) { return { mana: 50 + 10 * (Math.max(1, level | 0)) }; } },
    combo:                { name: 'Combo', text: 'Après une attaque de base, 25 % de chances d\'en relancer une (cumulable).' },
    concentration:        { name: 'Concentration', text: 'Désigne une cible : chance de critique doublée (Aiguisage) tant qu\'elle reste visée. 1 tour de rechargement si la concentration est perdue.' },
    connexion_astrale:    { name: 'Connexion astrale', text: 'd6 à chaque attaque : 1 renvoyée sur soi · 2 presciente (tour suivant) · 3 normale · 4 à 150 % · 5 critique · 6 double.' },
    danse_martiale:       { name: 'Danse martiale', text: 'Après un déplacement de 5 cases ou plus, attaque toutes les cibles adjacentes croisées (60 %, peut critiquer), sans attaque d\'opportunité.' },
    dechiffrage:          { name: 'Déchiffrage', text: 'Permet d\'utiliser les sorts et rituels d\'un parchemin de son école de magie sans contrainte.' },
    decimation:           { name: 'Décimation', text: '1×/combat : attire les ennemis à 2 cases, 50 % d\'une attaque de base à tous les adjacents, soigne de 100 % des dégâts infligés.' },
    desarmement:          { name: 'Désarmement', text: 'Au lieu de dégâts : désarmement garanti, 20 % de récupérer l\'arme. La cible peut la ramasser au tour suivant en perdant une action. Rechargement 2 tours.' },
    duel:                 { name: 'Duel', text: 'Désigne une cible : 125 % des dégâts contre elle. Perdu si on attaque ailleurs ou si la cible tombe.' },
    enchantement:         { name: 'Enchantement', text: 'Règle de fabrication : écrire sorts et rituels sur grimoire (statique) ou parchemin (usage limité).' },
    estropiaison:         { name: 'Estropiaison', text: '50 % d\'infliger Saignement : 8 % des PV max physiques par tour, 5 tours max, 25 % d\'arrêt par tour.' },
    focalisation:         { name: 'Focalisation', text: 'Confère 15 % du mana max. Rechargement 2 tours.' },
    fourberie:            { name: 'Fourberie', text: 'Dans le dos : +2 au jet, +10 % de critique et +20 % de dégâts critiques.' },
    frappe_entravante:    { name: 'Frappe entravante', text: '50 % si l\'attaque touche : Ralentissement ou Affaiblissement (−50 % AD) pendant 2 tours. Rechargement 3 tours.' },
    iaido:                { name: 'Iaido', text: 'Katana au fourreau : déplacement et attaque sans attaque d\'opportunité ; attaque en réaction contre un ennemi qui finit adjacent.' },
    invocation:           { name: 'Invocation', text: 'Invoque les échos d\'une divinité totémique, contrôlés au lieu des attaques de base.' },
    maniement_risque:     { name: 'Maniement risqué', malus: true, text: 'Imprévus possibles : blesser le porteur ou ses alliés, perdre le contrôle de l\'arme.' },
    parade_riposte:       { name: 'Parade/Riposte', text: 'Désigne UN candidat par tour : annule son attaque de base, 50 % de riposter s\'il est à portée. Rechargement 3 tours après activation.' },
    plenitude:            { name: 'Plénitude', text: 'Maîtrisée : +5 % de critique et +10 % de dégâts critiques. Un coup critique rend 5 % du mana max.',
                            passiveMods: function () { return { crit: 5, dcrit: 10 }; } },
    projection_defensive: { name: 'Projection défensive', text: 'Repousse une cible adjacente de 2 cases ; à terre si elle heurte un obstacle.' },
    purge:                { name: 'Purge', text: 'Retire le bouclier ou un buff de la cible (rechargement 2 tours après retrait) ; sinon, prête, l\'arme frappe à 110 %.' },
    quitte_ou_double:     { name: 'Quitte ou double', text: 'Approche risquée : 50 % de frapper à 130 %, sinon 100 % et 8 % des PV max en dégâts bruts sur soi.' },
    recul:                { name: 'Recul', text: 'Repousse la cible de 2 cases, +50 % de dégâts physiques contre un obstacle.' },
    repositionnement:     { name: 'Repositionnement', text: 'Après une attaque réussie, +2 cases de déplacement sans attaque d\'opportunité.' },
    technologie_hextech:  { name: 'Technologie hextech', text: 'Module propre à chaque arme hextech, à découvrir en jeu (pas encore implémenté).' },
    usage_limite:         { name: 'Usage limité', malus: true, text: 'L\'arme peut être détruite après usage.' },
  };

  /* 37 catégories du document MJ (les 4 explosifs sont des CONSOMMABLES, décision MJ du
     2026-09-14) + l'arc hextech de Jett. `mini` est un drapeau de catégorie, pas une
     propriété : ratio 60 %, exemption de maîtrise, accessoire autorisé, dual wield. */
  function _wc(id, name, kind, hands, range, props, extra) {
    return Object.assign({ id: id, name: name, kind: kind, hands: hands, range: range, mini: false,
      props: props || [], modes: WEAPON_MODES[kind] }, extra || {});
  }
  var WEAPON_CATEGORIES = [
    _wc('epee_courte', 'Épée courte', 'phys', 'poly', '1', ['attaque_double'], { mini: true }),
    _wc('dague', 'Dague', 'phys', '1H', '1', ['fourberie'], { mini: true }),
    _wc('epee_longue', 'Épée longue', 'phys', 'poly', '1-2', ['parade_riposte']),
    _wc('claymore', 'Claymore', 'phys', '2H', '2', ['balayage']),
    _wc('rapiere', 'Rapière', 'phys', '1H', '1', ['duel', 'repositionnement']),
    _wc('cimeterre', 'Cimeterre/Sabre', 'phys', '1H', '1-2', ['danse_martiale']),
    _wc('katana', 'Katana', 'phys', '2H', '1', ['iaido']),
    _wc('hache_guerre', 'Hache de guerre simple', 'phys', 'poly', '1-2', ['brisage']),
    _wc('hache_double', 'Hache double', 'phys', '2H', '1-2', ['decimation']),
    _wc('hachette', 'Hachette', 'phys', '1H', '1 / 6', ['brisage'], { mini: true }),
    _wc('marteau_guerre', 'Marteau de guerre', 'phys', '2H', '1-2', ['assommage', 'frappe_entravante']),
    _wc('masse_armes', 'Masse d\'armes', 'phys', '1H', '1 / 6', ['assommage', 'focalisation'], { mini: true }),
    _wc('gantelet', 'Gantelet renforcé', 'phys', '1H', '1', ['combo']),
    _wc('morgenstern', 'Morgenstern', 'phys', '2H', '1-2', ['estropiaison']),
    _wc('arc_court', 'Arc court', 'phys', '2H', '6', ['concentration']),
    _wc('arc_long', 'Arc long', 'phys', '2H', '10', ['concentration', 'attaque_lente']),
    _wc('arbalete_legere', 'Arbalète légère', 'phys', 'poly', '5', []),
    _wc('arbalete_lourde', 'Arbalète lourde', 'phys', '2H', '8', []),
    _wc('sarbacane', 'Sarbacane', 'phys', '1H', '5', ['attaque_double'], { mini: true }),
    _wc('baton_combat', 'Bâton de combat', 'phys', '2H', '1-2', ['projection_defensive']),
    _wc('nunchaku', 'Nunchaku', 'phys', '1H', '1', ['quitte_ou_double', 'maniement_risque']),
    _wc('tonfa', 'Tonfa', 'phys', '1H', '1', ['desarmement']),
    _wc('baton_magique', 'Bâton magique', 'mag', 'poly', '6', ['canalisation']),
    _wc('sceptre', 'Sceptre', 'mag', '1H', '5', ['quitte_ou_double']),
    _wc('baguette', 'Baguette', 'mag', '1H', '4', ['duel']),
    _wc('totem_runique', 'Totem runique', 'mag', '2H', 'N/A', ['invocation']),
    _wc('grimoire', 'Grimoire', 'mag', '2H', '6', ['enchantement']),
    _wc('parchemins', 'Parchemins', 'mag', '2H', '6', ['dechiffrage', 'enchantement', 'usage_limite']),
    _wc('orbe', 'Orbe', 'mag', '1H', '5', ['plenitude']),
    _wc('relique', 'Relique lunaire/solaire', 'mag', '2H', '6', ['connexion_astrale']),
    _wc('pistolet_hextech', 'Pistolet hextech', 'hyb', '1H', '12', ['technologie_hextech']),
    _wc('revolver_lourd', 'Revolver lourd', 'phys', '1H', '12', ['recul']),
    _wc('fusil_precision', 'Fusil de précision', 'phys', '2H', '14', ['concentration', 'attaque_lente']),
    _wc('lance_grenade_hextech', 'Lance-grenade hextech', 'hyb', '2H', '10', ['technologie_hextech']),
    _wc('tronconneuse_hextech', 'Tronçonneuse hextech', 'hyb', '2H', '1', ['purge', 'maniement_risque']),
    _wc('lance_flamme', 'Lance-flamme', 'mag', '2H', '2-3', ['maniement_risque']),
    _wc('disque_energetique', 'Disque énergétique', 'hyb', '1H', '6', ['adaptation']),
    /* Arc hextech (Jett, décision MJ du 2026-09-14) : pseudo arc court qui tire aussi des
       cellules nano-hextech. Mode cellules = AUCUN dégât (c'est son passif) ; stats +10/+10
       malgré tout, d'où `kind:'hyb'` pour le palier. Mode par défaut : cellules. */
    _wc('arc_hextech', 'Arc hextech', 'hyb', '2H', '6', ['concentration'], {
      modes: [ { id: 'cellules', label: 'Cellules nano-hextech', stat: 'ap', dmgType: 'magique', damage: false },
               { id: 'ad', label: 'Arc court', stat: 'ad', dmgType: 'physique' } ] }),
  ];
  var HANDS_LABEL = { '1H': 'Une main', '2H': 'Deux mains', poly: 'Polyvalente' };
  var WEAPON_KIND_LABEL = { phys: 'Physique', mag: 'Magique', hyb: 'Hybride' };
  var HAND_SLOTS = ['armePrincipale', 'armeSecondaire'];

  function weaponCategory(id) {
    if (!id) return null;
    for (var i = 0; i < WEAPON_CATEGORIES.length; i++) if (WEAPON_CATEGORIES[i].id === id) return WEAPON_CATEGORIES[i];
    return null;
  }
  /* Un objet est-il une arme ? Son `type` d'emplacement OU sa catégorie suffit : une dague
     rangée dans un accessoire reste une arme (et ne donne alors rien, décision 5c). */
  function isWeaponItem(it) {
    return !!(it && (it.type === 'weapon' || it.weaponCat));
  }
  function isMiniWeapon(it) {
    var c = it && weaponCategory(it.weaponCat);
    return !!(c && c.mini);
  }
  function isAccessorySlot(slot) {
    return /^accessoire/.test(slot || '');
  }

  /* Ce que le personnage tient en main. Une arme sans catégorie (objet ancien ou unique)
     est traitée en arme NEUTRE : une main, pas mini, maîtrisée, sans propriété — elle
     garde exactement le comportement d'avant la livraison.
     → { attacker, support, pair, twoHanded, issues[] }
       attacker = l'arme qui porte l'attaque de base ; support = la mini-arme de l'autre main
       pair = 'mini+mini' | 'main+mini' | null ; twoHanded = tenue à deux mains effective */
  function weaponLoadout(equipment, itemsById) {
    equipment = equipment || {}; itemsById = itemsById || {};
    var main = itemsById[equipment.armePrincipale] || null;
    var off = itemsById[equipment.armeSecondaire] || null;
    var mainW = isWeaponItem(main) ? main : null;
    var offW = isWeaponItem(off) ? off : null;
    var out = { attacker: null, support: null, pair: null, twoHanded: false, issues: [] };
    var catOf = function (it) { return it ? weaponCategory(it.weaponCat) : null; };
    if (mainW && offW) {
      var mm = isMiniWeapon(mainW), om = isMiniWeapon(offW);
      if (mm && om) { out.attacker = mainW; out.support = offW; out.pair = 'mini+mini'; }
      else if (mm !== om) {
        out.attacker = mm ? offW : mainW; out.support = mm ? mainW : offW; out.pair = 'main+mini';
      } else { out.attacker = mainW; out.issues.push('two_non_mini'); }
      if ((catOf(mainW) || {}).hands === '2H' || (catOf(offW) || {}).hands === '2H') out.issues.push('two_handed_blocked');
      return out;
    }
    var w = mainW || offW;
    if (!w) return out;
    out.attacker = w;
    var other = mainW ? off : main;   // bouclier ou objet non-arme dans l'autre main
    var c = catOf(w);
    if (c && c.hands === '2H') { out.twoHanded = true; if (other) out.issues.push('two_handed_blocked'); }
    else if (c && c.hands === 'poly' && !other) out.twoHanded = true;
    return out;
  }

  /* Une propriété d'arme est-elle utilisable ? Maîtrise requise, SAUF mini-arme (décision 4). */
  function weaponMastered(it, masteries) {
    var c = it && weaponCategory(it.weaponCat);
    if (!c) return true;          // arme neutre : aucun malus
    if (c.mini) return true;
    return !!(masteries && masteries[c.id]);
  }

  /* Stats d'arme débloquées par la maîtrise (Canalisation, Plénitude), des armes TENUES EN
     MAIN. Une même propriété ne compte qu'une fois. */
  /* La mini-arme de soutien d'une paire « arme non mini + mini-arme » : ses stats sont muettes. */
  function mutedSupport(equipment, itemsById) {
    var lo = weaponLoadout(equipment, itemsById);
    return lo.pair === 'main+mini' ? lo.support : null;
  }
  function sumWeaponPropMods(equipment, itemsById, masteries, level) {
    equipment = equipment || {}; itemsById = itemsById || {};
    var out = {}, seen = {};
    var support = mutedSupport(equipment, itemsById);
    HAND_SLOTS.forEach(function (slot) {
      var it = itemsById[equipment[slot]];
      if (!isWeaponItem(it) || !weaponMastered(it, masteries) || it === support) return;
      var c = weaponCategory(it.weaponCat);
      (c ? c.props : []).forEach(function (pid) {
        var p = WEAPON_PROPERTIES[pid];
        if (!p || !p.passiveMods || seen[pid]) return;
        seen[pid] = true;
        var m = p.passiveMods(level) || {};
        Object.keys(m).forEach(function (k) { out[k] = (out[k] || 0) + m[k]; });
      });
    });
    return out;
  }

  /* Profil de l'attaque de base (livraison 1 : ratio, maîtrise, type ; les propriétés
     sont listées, pas encore automatisées).
     choice = { mode } (weaponChoice persisté) ; atkMode = id de BASIC_MODES.
     Composition MULTIPLICATIVE (docs/armes-maitrises.md) : ratio mini × maîtrise × geste.

     ⚠️ `BASIC_ATTACK_RATIO` (décision MJ du 2026-10-10, rééquilibrage des compétences) :
     l'attaque de base vaut 60 % de l'AD/AP. C'est une ÉCHELLE GLOBALE, multipliée avec tout
     le reste — arme normale 60 %, mini-arme seule 36 %, deux mini-armes 60 % (36 + 24), sans
     maîtrise ×0,75 par-dessus. `ratio` reste RELATIF à une arme normale (les écarts chiffrés
     de docs/armes-maitrises.md ne bougent pas) ; `scale` est la part réelle de la stat.
     Les compétences n'y passent pas (`skillBaseDamage`) : ne pas l'appliquer ailleurs. */
  var BASIC_ATTACK_RATIO = 0.6;
  function basicAttackProfile(loadout, masteries, eff, choice) {
    loadout = loadout || {}; eff = eff || {}; choice = choice || {};
    var w = loadout.attacker;
    var cat = w ? weaponCategory(w.weaponCat) : null;
    var modes = cat ? cat.modes : WEAPON_MODES.phys;
    var mode = modes[0];
    for (var i = 0; i < modes.length; i++) if (modes[i].id === choice.mode) mode = modes[i];
    var mastered = weaponMastered(w, masteries);
    var ratio = loadout.pair === 'mini+mini' ? 1 : (cat && cat.mini ? 0.6 : 1);
    if (!mastered) ratio *= 0.75;
    var props = [], seen = {};
    var addProps = function (it, source) {
      var c = it && weaponCategory(it.weaponCat);
      if (!c || !weaponMastered(it, masteries)) return;
      c.props.forEach(function (pid) {
        if (seen[pid] || !WEAPON_PROPERTIES[pid]) return;
        seen[pid] = true; props.push({ id: pid, source: source, itemName: it.name });
      });
    };
    addProps(w, 'attacker');
    addProps(loadout.support, 'support');
    var lost = (w && cat && !mastered) ? cat.props.slice() : [];
    return {
      weapon: w, cat: cat, name: w ? w.name : 'Mains nues',
      modes: modes, mode: mode, stat: mode.stat, dmgType: mode.dmgType,
      wType: mode.dmgType === 'magique' ? 'Magique' : 'Physique',
      damage: mode.damage !== false,
      ratio: ratio, scale: ratio * BASIC_ATTACK_RATIO, mastered: mastered, malusPct: mastered ? 0 : 25,
      power: Math.round((eff[mode.stat] || 0) * ratio * BASIC_ATTACK_RATIO),
      props: props, lostProps: lost,
      twoHanded: !!loadout.twoHanded, pair: loadout.pair || null, issues: loadout.issues || [],
    };
  }

  /* ============================================================
     ARMES — LIVRAISON 2 : propriétés automatisées (spec §5, lot 2)
     Le joueur PROPOSE, le MJ RÉSOUT : le plan ne fait que construire des instances
     (dégâts / soin / statut) et dire ce qui se paie au cast (mana, rechargement,
     cible marquée). Rien d'autre n'est écrit côté joueur.
     ============================================================ */
  var WEAPON_CD_LOCKED = 999999;   // même sentinelle « 1×/combat » que les compétences
  /* Propriétés du lot 2 qui modifient l'attaque de base (Focalisation est une action à part). */
  var LOT2_ATTACK_PROPS = ['duel', 'attaque_double', 'balayage', 'combo', 'quitte_ou_double', 'canalisation',
    'fourberie', 'plenitude', 'concentration', 'connexion_astrale', 'purge', 'decimation'];
  function weaponCdKey(propId) { return 'w_' + propId; }
  /* Livraison 3 : propriétés ASSISTÉES — l'app roule le dé, l'effet sur la cible reste narratif
     (les débuffs sur cible sont hors périmètre mécanique depuis le 2026-09-06). */
  var LOT3_ASSISTED_PROPS = ['assommage', 'brisage', 'frappe_entravante', 'estropiaison', 'desarmement', 'parade_riposte'];

  /* Sources de propriétés tenues en main : 'attacker' et/ou 'support'. */
  function weaponPropSources(profile) {
    var out = [];
    (profile && profile.props || []).forEach(function (p) { if (out.indexOf(p.source) === -1) out.push(p.source); });
    return out;
  }
  /* « Jamais deux propriétés dans le même tour » (décision MJ 5a') : avec deux armes, le
     joueur choisit la SOURCE (l'arme) dont les propriétés jouent ce tour. Une arme porte
     parfois deux propriétés (marteau : Assommage + Frappe entravante) : elles jouent
     ensemble, le chiffrage du 2026-09-12 les compose ainsi.
     Défaut : l'arme d'attaque si elle a une propriété, sinon la mini-arme de soutien. */
  function weaponActiveSource(profile, wanted) {
    var srcs = weaponPropSources(profile);
    if (wanted && srcs.indexOf(wanted) !== -1) return wanted;
    return srcs.indexOf('attacker') !== -1 ? 'attacker' : (srcs[0] || null);
  }
  function weaponActiveProps(profile, wanted) {
    var src = weaponActiveSource(profile, wanted);
    return (profile && profile.props || []).filter(function (p) { return p.source === src; })
      .map(function (p) { return p.id; });
  }

  /* Ciblage de l'attaque selon les options cochées. `camp:'any'` : on peut toujours viser
     un camarade (règle du 2026-09-06). */
  function weaponAttackTargeting(active, toggles, cooldowns, turn) {
    active = active || []; toggles = toggles || {};
    var has = function (id) { return active.indexOf(id) !== -1; };
    var ready = function (id) { return cooldownReady((cooldowns || {})[weaponCdKey(id)], turn); };
    var max = 1;
    if (has('attaque_double') && toggles.double) max = 2;
    if (has('connexion_astrale')) max = 2;
    if (has('balayage') && toggles.sweep && ready('balayage')) max = 3;
    if (has('decimation') && toggles.decimation && ready('decimation')) max = null;
    if (has('desarmement') && toggles.disarm) max = 1;
    return { damage: { camp: 'any', min: 1, max: max } };
  }

  /* Plan d'une attaque de base PLEINE avec les propriétés du tour.
     input = { turn, selfId, targets:[ids], active:[propIds], toggles:{ double, sweep, risky,
       channel, backstab, purgeHasBuff, decimation, concentrate, disarm, entrave }, weaponCombat:{ duelTarget, concTarget, combo },
       cooldowns, isKo(id), manaCur, rng }
     → { ok, reason, label, instances, cost:{ mana, manaPer, manaMax, cdPrev, cdKey },
         cooldown:{ key, readyAt }|null, combat:{ duelTarget, concTarget }, notes:[] } */
  function buildWeaponAttack(profile, eff, input) {
    eff = eff || {}; input = input || {};
    var rng = input.rng || Math.random;
    var turn = input.turn || 1;
    var active = input.active || [];
    var tg = input.toggles || {};
    var cds = input.cooldowns || {};
    var wc = input.weaponCombat || {};
    var isKo = input.isKo || function () { return false; };
    var has = function (id) { return active.indexOf(id) !== -1; };
    var ready = function (id) { return cooldownReady(cds[weaponCdKey(id)], turn); };
    var targets = (input.targets || []).slice();
    var notes = [];
    // `combo` : une relance en attente est CONSOMMÉE par ce coup ; le bloc Combo en rouvre une si le dé réussit.
    var combat = { duelTarget: wc.duelTarget || null, concTarget: wc.concTarget || null, combo: null };
    var fail = function (reason) { return { ok: false, reason: reason, instances: [], cost: null, cooldown: null, combat: combat, notes: notes, label: '' }; };
    if (!targets.length) return fail('Choisis une cible');
    var spec = weaponAttackTargeting(active, tg, cds, turn).damage;
    if (spec.max != null && targets.length > spec.max) return fail(spec.max + ' cible' + (spec.max > 1 ? 's' : '') + ' au maximum');

    var power = profile.power || 0;
    var type = profile.dmgType || 'physique';
    var crit0 = eff.crit || 0, dcrit0 = eff.dcrit || 0;
    var labels = [];
    if (has('fourberie') && tg.backstab) { crit0 += 10; dcrit0 += 20; labels.push('Fourberie (dans le dos, +2 au jet)'); }
    var cost = { mana: 0, manaPer: 0, manaMax: Math.max(0, eff.mana | 0), cdPrev: null, cdKey: null };
    var cooldown = null;
    var setCd = function (id, readyAt) {
      var key = weaponCdKey(id);
      cooldown = { key: key, readyAt: readyAt };
      cost.cdKey = key; cost.cdPrev = cds[key] != null ? cds[key] : null;
    };
    var instances = [], seq = 0;
    var dmgInst = function (tid, mult, label, opts) {
      opts = opts || {};
      var computed = Math.max(0, Math.round(power * mult));
      var critPct = opts.critPct != null ? opts.critPct : crit0;
      var cr = opts.noCrit ? { didCrit: false, multiplier: 1 } : rollCrit(critPct, dcrit0, rng);
      var inst = { seq: ++seq, kind: 'damage', targetId: tid, computedDmg: computed,
        critDmg: Math.round(computed * cr.multiplier), didCrit: cr.didCrit, critMult: cr.multiplier,
        type: opts.type || type, letha: eff.letha || 0, lethaMag: eff.lethaMag || 0,
        crit: opts.noCrit ? 0 : critPct, dcrit: dcrit0, vol: eff.vol || 0, sapience: eff.sapience || 0,
        omni: eff.omni || 0, hpMax: eff.hp || 0, modeId: 'normal' };
      if (label) inst.label = label;
      if (opts.raw != null) { inst.computedDmg = opts.raw; inst.critDmg = opts.raw; }
      instances.push(inst);
      return inst;
    };

    /* Débuff NARRATIF sur la cible (livraison 3). Quand il pose un rechargement, l'instance porte
       `cdKey`/`cdPrev` : si le MJ la retire (l'attaque a raté en table, le débuff n'a pas pris),
       `actionRefundPlan(action, 'instance', inst)` rend le rechargement. */
    var debuff = function (tid, label, cdProp, readyAt) {
      var inst = { seq: ++seq, kind: 'status', targetId: tid, narrative: true, label: label };
      if (cdProp) {
        setCd(cdProp, readyAt);
        inst.cdKey = weaponCdKey(cdProp); inst.cdPrev = cost.cdPrev;
      }
      instances.push(inst);
      return inst;
    };

    /* --- Duel : 125 % contre la cible désignée ; attaquer ailleurs perd la désignation --- */
    var duelMult = function (tid) { return 1; };
    if (has('duel')) {
      var cur = combat.duelTarget && !isKo(combat.duelTarget) ? combat.duelTarget : null;
      var t0 = targets[0];
      if (!cur || cur === t0) { combat.duelTarget = t0; duelMult = function (tid) { return tid === t0 ? 1.25 : 1; }; labels.push('Duel'); }
      else { combat.duelTarget = null; notes.push('duel perdu (autre cible)'); }
    }
    /* --- Concentration : crit doublé contre la cible désignée ; changer de cible = 1 tour de rechargement --- */
    /* Concentration = CHOIX du joueur (case à cocher, MJ 2026-09-15). `toggles.concentrate`
       absent = on garde l'état courant : cochée si une concentration est en cours, sinon non.
       Relâcher ou changer de cible = concentration perdue, 1 tour de rechargement. */
    var concCrit = function (tid) { return crit0; };
    if (has('concentration')) {
      var cc = combat.concTarget && !isKo(combat.concTarget) ? combat.concTarget : null;
      var wantConc = tg.concentrate === undefined ? !!cc : !!tg.concentrate;
      var t1 = targets[0];
      if (!wantConc) {
        if (cc) { combat.concTarget = null; setCd('concentration', turn + 1); notes.push('concentration relâchée (1 tour de rechargement)'); }
      } else if (cc && cc !== t1) { combat.concTarget = null; setCd('concentration', turn + 1); notes.push('concentration perdue (1 tour de rechargement)'); }
      else if (cc === t1 || ready('concentration')) {
        combat.concTarget = t1; concCrit = function (tid) { return tid === t1 ? crit0 * 2 : crit0; }; labels.push('Concentration');
      } else notes.push('concentration en rechargement');
    }
    var mainMult = function (tid) { return duelMult(tid); };
    var critFor = function (tid) { return concCrit(tid); };

    var disarming = has('desarmement') && tg.disarm;
    if (disarming) {
      if (!ready('desarmement')) return fail('Désarmement en rechargement');
      var td = targets[0];
      var grab = rng() < 0.2;
      debuff(td, 'Désarmement : cible désarmée' + (grab ? ', le lanceur récupère son arme (20 %)' : ', son arme tombe au sol')
        + '. Elle peut la ramasser à son prochain tour en perdant une action, sauf si quelqu\'un l\'a prise entre-temps.',
        'desarmement', turn + 2);
      labels.push('Désarmement' + (grab ? ' (arme récupérée)' : ''));
    } else if (has('decimation') && tg.decimation) {
      if (!ready('decimation')) return fail('Décimation déjà utilisée ce combat');
      var total = 0;
      targets.forEach(function (tid) { total += dmgInst(tid, 0.5 * mainMult(tid), 'Décimation 50 %', { critPct: critFor(tid) }).computedDmg; });
      // Soin sur soi : producteur = receveur, `soins` compté une fois (2026-10-05).
      instances.push({ seq: ++seq, kind: 'heal', targetId: input.selfId, amount: total,
        healBonus: eff.soins || 0, sameActor: true, producerBuffs: input.buffs || [],
        label: 'Décimation : soin égal aux dégâts infligés (ajuster après mitigation)' });
      setCd('decimation', WEAPON_CD_LOCKED);
      labels.push('Décimation');
    } else if (has('balayage') && tg.sweep) {
      if (!ready('balayage')) return fail('Balayage : pas deux tours d\'affilée');
      targets.forEach(function (tid) { dmgInst(tid, 0.8 * mainMult(tid), 'Balayage 80 %', { critPct: critFor(tid) }); });
      setCd('balayage', turn + 2);
      labels.push('Balayage');
    } else if (has('attaque_double') && tg.double) {
      var a = targets[0], b = targets[1] || targets[0];
      dmgInst(a, 0.65 * mainMult(a), 'Attaque double 1/2 · 65 %', { critPct: critFor(a) });
      dmgInst(b, 0.65 * mainMult(b), 'Attaque double 2/2 · 65 %', { critPct: critFor(b) });
      labels.push('Attaque double');
    } else if (has('connexion_astrale')) {
      var d6 = Math.min(6, 1 + Math.floor(rng() * 6));
      var t = targets[0];
      labels.push('Connexion astrale ' + d6);
      if (d6 === 1) dmgInst(input.selfId, mainMult(t), 'd6 = 1 : attaque renvoyée sur le lanceur', { critPct: critFor(t) });
      else if (d6 === 2) dmgInst(t, mainMult(t), 'd6 = 2 : presciente — à appliquer au tour ' + (turn + 1), { critPct: critFor(t) });
      else if (d6 === 3) dmgInst(t, mainMult(t), 'd6 = 3 : attaque classique', { critPct: critFor(t) });
      else if (d6 === 4) dmgInst(t, 1.5 * mainMult(t), 'd6 = 4 : améliorée 150 %', { critPct: critFor(t) });
      else if (d6 === 5) dmgInst(t, mainMult(t), 'd6 = 5 : critique', { critPct: Math.max(100, critFor(t)) });
      else {
        var t2 = targets[1] || t;
        dmgInst(t, mainMult(t), 'd6 = 6 : double attaque 1/2', { critPct: critFor(t) });
        dmgInst(t2, mainMult(t2), 'd6 = 6 : double attaque 2/2', { critPct: critFor(t2) });
      }
      if (d6 !== 6 && targets.length > 1) notes.push('2ᵉ cible ignorée (d6 ≠ 6)');
    } else if (has('quitte_ou_double') && tg.risky) {
      var t3 = targets[0];
      if (rng() < 0.5) { dmgInst(t3, 1.3 * mainMult(t3), 'Quitte ou double : réussi · 130 %', { critPct: critFor(t3) }); labels.push('Quitte ou double réussi'); }
      else {
        dmgInst(t3, mainMult(t3), 'Quitte ou double : raté · 100 %', { critPct: critFor(t3) });
        var selfDmg = Math.round((eff.hp || 0) * 0.08);
        dmgInst(input.selfId, 1, 'Quitte ou double : blessure, 8 % des PV max en bruts', { type: 'brut', noCrit: true, raw: selfDmg });
        labels.push('Quitte ou double raté');
      }
    } else {
      var t4 = targets[0];
      var mult = mainMult(t4);
      if (has('purge')) {
        if (tg.purgeHasBuff) {
          if (!ready('purge')) return fail('Purge en rechargement');
          instances.push({ seq: ++seq, kind: 'status', targetId: t4, narrative: true,
            label: 'Purge : retirer le bouclier, sinon un buff de statistiques, sinon un autre buff' });
          setCd('purge', turn + 2);
          labels.push('Purge');
        } else if (ready('purge')) { mult *= 1.1; labels.push('Purge 110 %'); }
      }
      dmgInst(t4, mult, null, { critPct: critFor(t4) });
    }

    /* --- Livraison 3 : débuffs roulés par l'app sur la cible principale (effet narratif) --- */
    var tMain = targets[0];
    if (!disarming && has('assommage')) {
      if (rng() < 0.1) { debuff(tMain, 'Assommage (10 %) : étourdi pour sa prochaine action'); labels.push('Assommage'); }
      else notes.push('assommage raté (10 %)');
    }
    if (!disarming && has('brisage')) {
      if (!ready('brisage')) notes.push('Brisage en rechargement');
      else if (rng() < 0.5) { debuff(tMain, 'Brisé (50 %) : −50 % d\'armure pendant 2 tours (jusqu\'au tour ' + (turn + 1) + ') · si l\'attaque touche', 'brisage', turn + 3); labels.push('Brisage'); }
      else notes.push('brisage raté (50 %)');
    }
    if (!disarming && has('frappe_entravante')) {
      var slow = tg.entrave === 'ralenti';
      if (!ready('frappe_entravante')) notes.push('Frappe entravante en rechargement');
      else if (rng() < 0.5) {
        debuff(tMain, (slow ? 'Ralentissement (50 %) : déplacement réduit de moitié' : 'Affaiblissement (50 %) : −50 % d\'AD')
          + ' pendant 2 tours (jusqu\'au tour ' + (turn + 1) + ') · si l\'attaque touche', 'frappe_entravante', turn + 3);
        labels.push('Frappe entravante');
      } else notes.push('frappe entravante ratée (50 %)');
    }
    if (!disarming && has('estropiaison')) {
      if (rng() < 0.5) {
        var ticks = 1;
        while (ticks < 5 && rng() >= 0.25) ticks++;
        debuff(tMain, 'Saignement (50 %) : 8 % des PV max en dégâts physiques par tour, pendant ' + ticks
          + ' tour' + (ticks > 1 ? 's' : '') + ' (arrêt à 25 %/tour déjà roulé) · si l\'attaque touche');
        labels.push('Estropiaison ' + ticks + ' t.');
      } else notes.push('estropiaison ratée (50 %)');
    }

    /* --- Canalisation : 5 % du mana max en bruts ×2, payé au cast --- */
    if (has('canalisation') && tg.channel) {
      var spend = Math.round((eff.mana || 0) * 0.05);
      if ((input.manaCur || 0) < spend) return fail('Pas assez de mana pour canaliser (' + spend + ')');
      cost.mana = spend;
      dmgInst(targets[0], 1, 'Canalisation : ' + spend + ' mana ×2 en bruts', { type: 'brut', noCrit: true, raw: spend * 2 });
      labels.push('Canalisation');
    }
    /* --- Combo : 25 % de relance, cumulable (plafond de sécurité 10) ---
       ⚠️ La relance REDONNE L'ATTAQUE au joueur (décision MJ du 2026-09-15) : elle n'ajoute
       aucune instance sur la même cible. Le plan renvoie `combat.combo = { round, chain }` ;
       l'onglet Combat affiche « relance disponible » et le coup suivant, sur la cible de son
       choix, est la relance n° chain — qui retente elle-même les 25 %. Une relance non jouée
       expire avec le tour. */
    if (has('combo')) {
      var chainIn = wc.combo && wc.combo.round === turn ? (wc.combo.chain | 0) : 0;
      if (chainIn) labels.push('Combo : relance ' + chainIn);
      if (chainIn < 10 && rng() < 0.25) {
        combat.combo = { round: turn, chain: chainIn + 1 };
        labels.push('Combo : nouvelle relance');
      }
    }
    /* --- Plénitude : un crit rend 5 % du mana max --- */
    if (has('plenitude') && instances.some(function (i) { return i.kind === 'damage' && i.didCrit && i.targetId !== input.selfId; })) {
      var gain = Math.round((eff.mana || 0) * 0.05);
      instances.push({ seq: ++seq, kind: 'status', targetId: input.selfId, manaGain: gain, manaMax: eff.mana || 0,
        label: 'Plénitude : +' + gain + ' mana (critique)' });
    }
    return { ok: true, reason: '', label: labels.join(' · '), instances: instances, cost: cost,
      cooldown: cooldown, combat: combat, notes: notes };
  }

  /* Parade/Riposte (épée longue) : réaction, action à part. Le porteur a désigné UN candidat
     pour le tour ; quand ce candidat l'attaque, la parade annule son attaque de base et roule
     50 % de riposte. Rechargement 3 tours, qui ne court qu'APRÈS activation (révision du 2026-09-12). */
  function buildParade(profile, eff, input) {
    eff = eff || {}; input = input || {};
    var rng = input.rng || Math.random;
    var turn = input.turn || 1, cds = input.cooldowns || {}, key = weaponCdKey('parade_riposte');
    if (!input.candidate) return { ok: false, reason: 'Désigne d\'abord un candidat' };
    if (!cooldownReady(cds[key], turn)) return { ok: false, reason: 'Parade en rechargement' };
    var instances = [{ seq: 1, kind: 'status', targetId: input.candidate, narrative: true,
      label: 'Parade : son attaque de base contre le porteur est annulée' }];
    var riposte = rng() < 0.5;
    if (riposte) {
      var power = (profile && profile.power) || 0;
      var cr = rollCrit(eff.crit || 0, eff.dcrit || 0, rng);
      instances.push({ seq: 2, kind: 'damage', targetId: input.candidate, computedDmg: power,
        critDmg: Math.round(power * cr.multiplier), didCrit: cr.didCrit, critMult: cr.multiplier,
        type: (profile && profile.dmgType) || 'physique', letha: eff.letha || 0, lethaMag: eff.lethaMag || 0,
        crit: eff.crit || 0, dcrit: eff.dcrit || 0, vol: eff.vol || 0, sapience: eff.sapience || 0,
        omni: eff.omni || 0, hpMax: eff.hp || 0, modeId: 'normal', label: 'Riposte (50 %) : si l\'ennemi est à portée' });
    }
    return { ok: true, reason: '', riposte: riposte, instances: instances,
      cost: { mana: 0, manaPer: 0, manaMax: Math.max(0, eff.mana | 0), cdPrev: cds[key] != null ? cds[key] : null, cdKey: key },
      cooldown: { key: key, readyAt: turn + 3 } };
  }

  /* Focalisation (masse d'armes) : action à part, sans attaque. +15 % du mana max, CD 2. */
  function buildFocalisation(eff, input) {
    eff = eff || {}; input = input || {};
    var turn = input.turn || 1, cds = input.cooldowns || {}, key = weaponCdKey('focalisation');
    if (!cooldownReady(cds[key], turn)) return { ok: false, reason: 'Focalisation en rechargement' };
    var gain = Math.round((eff.mana || 0) * 0.15);
    return { ok: true, reason: '',
      instances: [{ seq: 1, kind: 'status', targetId: input.selfId, manaGain: gain, manaMax: eff.mana || 0,
        label: 'Focalisation : +' + gain + ' mana' }],
      cost: { mana: 0, manaPer: 0, manaMax: Math.max(0, eff.mana | 0), cdPrev: cds[key] != null ? cds[key] : null, cdKey: key },
      cooldown: { key: key, readyAt: turn + 2 } };
  }

  /* Un objet peut-il aller dans cet emplacement ? `type` = `equipTypeForItem(item)`,
     `accepts` = `EQUIP_SLOTS[slot].accepts` (pages-equip.jsx).
     Règles d'arme (spec §3.4) : une arme 2H exige l'autre main vide ; deux armes non mini
     sont interdites ; seules les mini-armes vont en accessoire.
     → { ok, reason } */
  function equipSlotCheck(equipment, itemsById, itemId, slot, type, accepts) {
    equipment = equipment || {}; itemsById = itemsById || {};
    var it = itemsById[itemId];
    if (!it) return { ok: false, reason: 'Objet introuvable' };
    var weapon = isWeaponItem(it);
    if (isAccessorySlot(slot)) {
      if (weapon) return isMiniWeapon(it) ? { ok: true, reason: '' }
        : { ok: false, reason: 'Seules les mini-armes se rangent en accessoire' };
      return (accepts || []).indexOf(type) !== -1 ? { ok: true, reason: '' } : { ok: false, reason: 'Emplacement incompatible' };
    }
    if ((accepts || []).indexOf(type) === -1 && !(weapon && HAND_SLOTS.indexOf(slot) !== -1)) {
      return { ok: false, reason: 'Emplacement incompatible' };
    }
    var hand = HAND_SLOTS.indexOf(slot);
    if (hand === -1) return { ok: true, reason: '' };
    var otherSlot = HAND_SLOTS[1 - hand];
    var otherId = equipment[otherSlot];
    if (otherId === itemId) otherId = null;            // l'objet change de main : l'autre se libère
    var other = otherId ? itemsById[otherId] : null;
    if (!other) return { ok: true, reason: '' };
    var c = weapon ? weaponCategory(it.weaponCat) : null;
    var oc = isWeaponItem(other) ? weaponCategory(other.weaponCat) : null;
    if ((c && c.hands === '2H') || (oc && oc.hands === '2H')) {
      return { ok: false, reason: 'Arme à deux mains : libère l\'autre main d\'abord' };
    }
    if (weapon && isWeaponItem(other) && !isMiniWeapon(it) && !isMiniWeapon(other)) {
      return { ok: false, reason: 'Deux armes non mini ne se tiennent pas ensemble' };
    }
    return { ok: true, reason: '' };
  }

  /* Libellé court d'une catégorie : « Dague · Une main · portée 1 · Mini-arme ». */
  function weaponCatLabel(cat) {
    if (!cat) return '';
    return [cat.name, WEAPON_KIND_LABEL[cat.kind], HANDS_LABEL[cat.hands] || cat.hands,
      'portée ' + cat.range].concat(cat.mini ? ['Mini-arme'] : []).join(' · ');
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
        weight: Number(e.weight) || 0, carry: Number(e.carry) || 0, carryGroup: Number(e.carryGroup) || 0, armorClass: e.armorClass || '',
        weaponCat: e.weaponCat || '' };
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
    { value:'armor',     label:'Armure' },
    { value:'boots',     label:'Bottes' },
    { value:'belt',      label:'Ceinture' },
    { value:'weapon',    label:'Arme principale' },
    { value:'offhand',   label:'Arme secondaire' },
    { value:'shield',    label:'Bouclier' },
    { value:'amulet',    label:'Amulette' },
    { value:'ring',      label:'Anneau' },
    { value:'accessory', label:'Accessoire' },
    /* Transport de GROUPE : ces deux types ne vont dans AUCUN slot du paperdoll perso
       (`EQUIP_SLOTS`) — on ne s'équipe pas d'un chameau. Ils ne servent qu'aux slots
       d'attelage du coffre commun (`TRANSPORT_SLOTS`). */
    { value:'mount',     label:'Monture (groupe)' },
    { value:'pack',      label:'Sac / Contenant (groupe)' },
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

  /* Clés de rune « au choix AD/AP » : [statSiAD, statSiAP]. Le choix est porté par
     la rune (choices[nodeId]), donc toutes les clés d'une même rune suivent le MÊME
     choix — ex. Sadisme (adp + lethaAdp) : AD → +AD et léthalité physique ;
     AP → +AP et léthalité magique. */
  var ADP_KEYS = {
    adp:      ['ad', 'ap'],
    lethaAdp: ['letha', 'lethaMag'],
  };

  /* --- Runes « N domaines au choix » (2026-10-04) ------------------------------------
     Un nœud peut porter `pick:{ count, options:[{ key, label, short, mods, perLevel }] }` :
     le joueur retient `count` options parmi `options`, et reçoit leurs `mods`/`perLevel`.
     Sert à Volonté : CC choisit sa résistance (1 parmi 2), Durabilité ses domaines
     (2 parmi 3 : Vitalité / Armure / Rés. Mag).
     ⚠️ Le choix vit dans le MÊME champ que le choix AD/AP (`runes/choices/{nodeId}`),
     sérialisé en liste de clés séparées par des virgules (« vit,armure »). Un nœud porte
     donc SOIT un `adp`, SOIT un `pick`, jamais les deux — rien ne le vérifie, mais un
     nœud mixte verrait son `choices` écrasé par l'un ou l'autre.
     ⚠️ Un choix absent n'annule RIEN : on retombe sur les `count` premières options, pour
     que la rune gravée donne toujours un bonus déterministe (même idiome que `adp` → 'ad').
     ⚠️ Les options rendent des stats RÉELLES (hp/armure/resmag), pas des clés `ADP_KEYS` :
     elles sont donc résolues dès `runeNodeMods`, et le tooltip les lit sans traduction. */
  function runePickOptions(node) {
    var opts = node && node.pick && node.pick.options;
    return (opts && opts.length) ? opts : null;
  }
  function runeHasPick(node) { return !!runePickOptions(node); }
  function runePickCount(node) {
    var opts = runePickOptions(node);
    if (!opts) return 0;
    return Math.max(1, Math.min((node.pick.count | 0) || 1, opts.length));
  }
  /* Groupe d'une option (2026-10-05) : une option peut porter `group`, et on ne retient
     JAMAIS deux options du même groupe. C'est ce qui permet « 2 DOMAINES parmi 3 » quand un
     domaine offre lui-même un sous-choix — Présage : offensif (AD ou AP), défensif (AR ou RM),
     soins. Soit 5 options pour 3 groupes. Une option sans `group` est seule dans le sien. */
  function runePickGroup(opt) { return (opt && opt.group) || (opt && opt.key) || ''; }
  /* Clés retenues, dans l'ordre de choix du joueur, complétées par défaut jusqu'à `count`.
     ⚠️ Le défaut saute les options d'un groupe déjà pris : sans ça, une rune non cliquée
     donnerait deux fois le même domaine et vaudrait moins que son coût. */
  function runePickKeys(node, choice) {
    var opts = runePickOptions(node);
    if (!opts) return [];
    var n = runePickCount(node), byKey = {}, out = [], seen = {}, i;
    for (i = 0; i < opts.length; i++) byKey[opts[i].key] = opts[i];
    String(choice == null ? '' : choice).split(',').forEach(function (k) {
      k = k.trim();
      var o = byKey[k];
      if (!o || out.indexOf(k) !== -1 || out.length >= n) return;
      var g = runePickGroup(o);
      if (seen[g]) return;
      seen[g] = true; out.push(k);
    });
    for (i = 0; i < opts.length && out.length < n; i++) {
      var g2 = runePickGroup(opts[i]);
      if (out.indexOf(opts[i].key) !== -1 || seen[g2]) continue;
      seen[g2] = true; out.push(opts[i].key);
    }
    return out;
  }
  function runePickedOptions(node, choice) {
    var opts = runePickOptions(node);
    if (!opts) return [];
    var keys = runePickKeys(node, choice), out = [], i, j;
    for (i = 0; i < keys.length; i++)
      for (j = 0; j < opts.length; j++) if (opts[j].key === keys[i]) out.push(opts[j]);
    return out;
  }
  /* Clic sur une option → nouvelle valeur de `choices[nodeId]`.
     Option déjà retenue : rien (on ne descend jamais sous `count`, sinon la rune
     gravée vaudrait moins que son coût). Sinon elle entre, et le choix le PLUS ANCIEN
     cède la place — un pick de 2 parmi 3 se pilote ainsi en un clic. */
  function runePickToggle(node, choice, key) {
    var opts = runePickOptions(node);
    if (!opts) return choice || null;
    var keys = runePickKeys(node, choice), n = runePickCount(node), byKey = {}, i;
    for (i = 0; i < opts.length; i++) byKey[opts[i].key] = opts[i];
    if (!byKey[key] || keys.indexOf(key) !== -1) return keys.join(',');
    /* Même groupe = sous-choix du MÊME domaine (AD → AP) : la sœur sort, pas le plus ancien.
       Sinon le joueur perdrait un domaine en changeant simplement d'avis sur AD/AP. */
    var g = runePickGroup(byKey[key]);
    keys = keys.filter(function (k) { return runePickGroup(byKey[k]) !== g; });
    keys.push(key);
    while (keys.length > n) keys.shift();
    return keys.join(',');
  }
  /* Bonus d'une rune AU NIVEAU DU PORTEUR (2026-10-03) : `mods` est le socle, `perLevel`
     l'incrément par niveau. Une rune `mods:{adp:24}, perLevel:{adp:3}` vaut donc +30 au
     niveau 2 et +78 au niveau 18.
     ⚠️ Motif, à ne pas défaire : un bonus PLAT vaut 100 % de l'étalon au niveau 2 et 60 %
     au niveau 18, parce que le personnage quadruple sur la campagne alors que la rune ne
     bouge pas (diagnostic chiffré du 2026-09-15, §5.1 — 7 runes étaient ainsi gelées).
     ⚠️ `level` est à passer par TOUS les appelants de `sumRuneMods` (fiche, Combat,
     Équipement, MJ, resetCombat) — même piège que `sumItemMods` : en oublier un fait
     diverger les stats d'une page. Absent → niveau 1, JAMAIS 0 (idiome `passiveMods`).
     Renvoie les clés BRUTES (`adp`/`lethaAdp` non résolus) : c'est `sumRuneMods` qui
     tranche AD/AP. Arrondi ici, donc un `perLevel` décimal reste exploitable.
     `choice` ne sert qu'aux runes à `pick` (domaines au choix) : leurs options donnent des
     stats réelles, donc elles sont résolues ici et pas dans `sumRuneMods`. */
  function runeNodeMods(node, level, choice) {
    var lv = Math.max(1, level | 0), out = {}, k;
    if (!node) return out;
    for (k in (node.mods || {})) out[k] = Number(node.mods[k]) || 0;
    for (k in (node.perLevel || {})) out[k] = (out[k] || 0) + (Number(node.perLevel[k]) || 0) * lv;
    /* `accel` = la PENTE elle-même grandit (2026-10-05, décision MJ) : le gain du niveau L
       vaut `perLevel + accel × (L−1)`, donc le total ajoute `accel × L(L−1)/2`.
       ⚠️ Raison d'être : le prix du MANA DÉCROÎT (1 PV = 1 mana au niveau 1, 3 au niveau 18).
       Une quantité linéaire sert donc trop de valeur tôt et pas assez tard. Mesuré sur
       Manifestation : +11 % au niveau 2 en linéaire, +1 % en accéléré, à ancre n18 identique.
       ⚠️ N'a de sens QUE pour une stat dont le prix décroît — sur une stat à prix croissant
       (armure, crit, soins) elle compose dans le mauvais sens. Le mana est la seule du barème. */
    for (k in (node.accel || {})) out[k] = (out[k] || 0) + (Number(node.accel[k]) || 0) * lv * (lv - 1) / 2;
    var step = runeLevelStep(node, lv);
    if (step) for (k in step) out[k] = (out[k] || 0) + (Number(step[k]) || 0);
    var picked = runePickedOptions(node, choice);
    for (var i = 0; i < picked.length; i++) {
      for (k in (picked[i].mods || {})) out[k] = (out[k] || 0) + (Number(picked[i].mods[k]) || 0);
      for (k in (picked[i].perLevel || {}))
        out[k] = (out[k] || 0) + (Number(picked[i].perLevel[k]) || 0) * lv;
    }
    for (k in out) { out[k] = Math.round(out[k]); if (!out[k]) delete out[k]; }
    return out;
  }
  /* `levelSteps` = progression PAR PALIERS, pour une rune qui ne grandit pas linéairement
     (Mobilité : 1-5, puis 6-11, puis 12-18 — décision MJ du 2026-10-03). Liste ordonnée de
     `{ from, mods }` ; on retient le DERNIER palier dont `from` <= niveau, et ses `mods`
     s'ajoutent à `mods` et `perLevel`.
     ⚠️ Un palier REMPLACE le précédent, il ne s'empile pas : `from:6 {crit:6}` vaut 6 % de
     crit au total, pas 5 + 6. C'est ce qui permet d'écrire une table de MJ telle quelle.
     ⚠️ Un escalier crée des SAUTS de puissance aux frontières (mesuré sur Mobilité : +96 %
     au niveau 6, +55 % au niveau 12). C'est voulu — à ne pas lisser sans le MJ. */
  function runeLevelStep(node, level) {
    var steps = (node && node.levelSteps) || [];
    var lv = Math.max(1, level | 0), pick = null;
    for (var i = 0; i < steps.length; i++) if ((steps[i].from | 0) <= lv) pick = steps[i];
    return pick ? (pick.mods || null) : null;
  }
  function sumRuneMods(selectedIds, choices, index, level) {
    selectedIds = selectedIds || []; choices = choices || {}; index = index || {};
    var out = {};
    for (var i = 0; i < selectedIds.length; i++) {
      var e = index[selectedIds[i]];
      if (!e) continue;
      var mods = runeNodeMods(e, level, choices[e.id]);
      for (var k in mods) {
        var v = mods[k];
        var stat = k;
        var pair = ADP_KEYS[k];
        if (pair) stat = (choices[e.id] === 'ap') ? pair[1] : pair[0];
        out[stat] = (out[stat] || 0) + v;
      }
    }
    return out;
  }
  /* Une rune propose-t-elle un choix AD/AP ? (pilote l'affichage du toggle)
     ⚠️ Regarde les TROIS sources (`mods`, `perLevel`, `levelSteps`) : une rune peut n'avoir
     d'adp que dans sa pente ou dans un palier. */
  function runeHasAdpChoice(node) {
    if (!node) return false;
    var steps = (node && node.levelSteps) || [];
    for (var k in ADP_KEYS) {
      if (node.mods && node.mods[k] != null) return true;
      if (node.perLevel && node.perLevel[k] != null) return true;
      for (var i = 0; i < steps.length; i++)
        if (steps[i].mods && steps[i].mods[k] != null) return true;
    }
    return false;
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
      // Entiers >= 0 imposes : la regle RTDB `state/coins/$coin` valide type ET signe,
      // et l'amorcage ecrit tout le sous-arbre `state` d'un coup — une seule valeur
      // non entiere ferait echouer le seed ENTIER (cf. doc durcissement monnaie §6).
      coins: {
        plat: coinInt(char.coins && char.coins.plat),
        or:   coinInt(char.coins && char.coins.or),
        arg:  coinInt(char.coins && char.coins.arg),
        cuiv: coinInt(char.coins && char.coins.cuiv),
      },
    };
  }

  /* --- Combat (vue MJ ennemis) : reproduit le moteur Excel (Codes App Script) --- */
  /* Constante de mitigation : réduction = AR / (AR + MITIGATION_K).
     ⚠️ Passée de 120 à 100 le 2026-09-12 (décision MJ) — c'est la valeur de League of
     Legends. Motif : l'armure paraissait trop peu contribuante. Chaque point d'armure
     vaut ~+41 % de plus qu'avant (mesuré : 3,87 → 4,42 PV sur le bruiser de référence),
     et la réduction affichée passe de 20,5 % à 23,7 % pour un PJ niveau 10.
     Ce qui a été vérifié avant de trancher :
       - le TTK du calibrage de septembre TIENT (amplitude ADC→ADC du niveau 1 au 18 :
         0,47 attaque en K=120, 0,41 en K=100) — rien à recalibrer ;
       - aucune migration : la mitigation est calculée à la résolution, jamais stockée.
     ⚠️ Trois effets connus et assumés :
       - le gain est concentré à HAUT niveau (+1,6 % d'EHP au niveau 2, +4,5 % au 18) —
         baisser K ne corrige PAS l'encaissement à bas niveau, où le problème est le
         NOMBRE de points d'armure (6-11), pas leur rendement ;
       - les gros PNJ en profitent plus que les PJ (un boss à 200 d'armure encaisse
         +12 % ; c'est proportionnel à l'armure possédée) ;
       - la léthalité est amplifiée (+7,1 % → +8,3 % de dégâts pour 10 de léthalité).
     Le barème de valeur des stats en dépend : voir docs/bareme-stats.md. */
  var MITIGATION_K = 100;
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
    const reduction = eff / (eff + MITIGATION_K);
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

  /* --- Résistance critique (refonte 2026-09-04) ---
     Le défenseur ne réduit PAS la chance de crit : il réduit la part de dégâts que le
     crit ajoute AU-DESSUS d'un coup normal. Un crit à 150 % contre 15 % de rés. crit
     inflige 100 + 50×0,85 = 142,5 % ; contre 60 %, 100 + 50×0,40 = 120 %.
     ⚠️ C'est cette forme (réduction de la part > 100 %, pas du multiplicateur entier)
     qui garantit qu'un critique ne peut JAMAIS faire moins qu'un coup normal — pas
     besoin de plancher artificiel. Elle vaut aussi pour les paliers de surcrit
     (×2,5 → 1 + 1,5×(1−r)). La résistance est bornée à 100 % : au-delà, un crit
     rendrait des dégâts inférieurs au coup de base.
     S'applique APRÈS le jet (`rollCrit`) et AVANT la mitigation armure/rés. mag. */
  function critMultAfterResist(multiplier, rescritPct) {
    var m = Number(multiplier);
    if (!isFinite(m) || m <= 1) return 1;           // pas de crit : rien à réduire
    var r = Math.max(0, Math.min(100, Number(rescritPct) || 0));
    return 1 + (m - 1) * (1 - r / 100);
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
     ⚠️ RÈGLE CHANGÉE LE 2026-09-09 : l'omnivamp s'applique désormais à TOUTES les
     sources, attaque de base comprise, et se CUMULE avec le vol de vie / la sapience.
     Vol de vie et sapience restent, elles, réservées à l'attaque de base et départagées
     par le type. Donc :
       attaque de base physique : vol + omni       | magique : sapience + omni | brut : omni
       compétence (tout type)   : omni
     Le cumul est délibéré (ruling MJ) : sans lui, l'omnivamp serait INUTILE à quiconque
     possède déjà du vol de vie, alors qu'elle est censée en être la version universelle.
     Conséquence de tarif : l'omnivamp vaut ~1,25× le vol de vie (elle porte aussi les
     dégâts de compétence, cf. le ratio de rotation optimale), et montera vers 1,50×
     quand les compétences seront rééquilibrées — voir docs/bareme-stats.md. */
  function lifestealHeal(applied, type, stats, isBasic, buffs) {
    applied = Math.max(0, Number(applied) || 0);
    stats = stats || {};
    let pct = Number(stats.omni) || 0;
    if (isBasic) {
      pct += type === 'physique' ? (Number(stats.vol) || 0)
           : type === 'magique'  ? (Number(stats.sapience) || 0)
           : 0;
    }
    // ⚠️ `soins` n'entre PAS ici (décision MJ) : seul Miraculé/Hémorragie module le drain.
    return Math.round(applied * Math.max(0, pct) / 100 * lifestealMultiplier(buffs));
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

  /* --- Camp d'un combattant non-joueur (PNJ) ---
     Le noeud `combat/enemies` porte desormais les DEUX camps : ennemis et PNJ allies.
     `side` absent => 'enemy', exactement comme `reveal` absent => 'hidden' : aucune
     migration a ecrire, les documents deja en base restent des ennemis.
     Un allie reste un combattant a part entiere (il encaisse, il frappe) : tout le
     moteur de combat — mitigateDamage, applyDamageToPools, enemyPublicView — s'applique
     a lui sans changement. Seuls le ciblage et l'affichage distinguent les camps. */
  function combatantSide(c) {
    return (c && c.side === 'ally') ? 'ally' : 'enemy';
  }
  function isAlly(c) { return combatantSide(c) === 'ally'; }
  /* Repartit une liste de combattants par camp en preservant l'ordre d'origine. */
  function splitCombatants(list) {
    var out = { enemies: [], allies: [] };
    (list || []).forEach(function (c) {
      out[isAlly(c) ? 'allies' : 'enemies'].push(c);
    });
    return out;
  }

  /* ============================================================
     INITIATIVE & CRENEAUX DE TOUR — logique pure
     Regles du MJ : docs/superpowers/specs/2026-09-02-initiative-creneaux-design.md
     Resume : score = 1d6 + bonus ; les EX AEQUO forment un CRENEAU et jouent
     simultanement ; on ne passe au creneau suivant que quand tous ses participants
     ont declare leur fin de tour. Le round vit toujours dans `combat/turn` : ces
     fonctions ne le remplacent pas, elles s'empilent dessus.
     ============================================================ */

  var INIT_DIE = 6;

  /* Jet d'initiative. `rng` injectable (meme idiome que rollCrit) => testable.
     La randomisation est faite par l'APP, jamais saisie a la main par le joueur. */
  function rollInitiative(rng) {
    var r = typeof rng === 'function' ? rng() : Math.random();
    if (!(r >= 0)) r = 0;                      // NaN / valeur absurde => borne basse
    if (r > 0.9999999) r = 0.9999999;          // rng() === 1 ne doit pas donner 7
    return 1 + Math.floor(r * INIT_DIE);
  }

  /* Une entree de score : { d6, bonus, ok, reroll } (+ `kit`, jamais en base).
     `d6`     = le jet (1..6), ecrit par le JOUEUR pour son perso, par le MJ pour les PNJ
     `bonus`  = preparation au combat (-2..+2), ecrit par le MJ
     `ok`     = validation du MJ ; tant qu'elle manque le score n'entre pas en jeu
     `reroll` = le MJ a refuse le jet et en demande un autre
     `kit`    = bonus PERSONNEL porte par le kit (Urskaar, Voie de l'ours : +1). Il n'est
                JAMAIS ecrit en base : `withKitInitiative` le pose a la lecture, depuis
                `SKILLS[id].passive.initBonus`. Aucune regle RTDB n'a donc change. */
  function initiativeBonus(entry) { return entry ? (entry.bonus | 0) + (entry.kit | 0) : 0; }
  function initiativeTotal(entry) {
    if (!entry || entry.d6 == null) return null;
    var d6 = Math.max(1, Math.min(INIT_DIE, entry.d6 | 0));
    return d6 + initiativeBonus(entry);
  }
  /* Scores lus en base + bonus de kit `{ id: n }` → scores enrichis de `kit`. Un combattant
     sans entree en recoit une (vide) des qu'il a un bonus de kit, pour que le MJ le voie
     AVANT le jet. Pur : ne modifie pas `scores`. */
  function withKitInitiative(scores, kitBonus) {
    scores = scores || {}; kitBonus = kitBonus || {};
    var out = {};
    Object.keys(scores).forEach(function (id) { out[id] = scores[id]; });
    Object.keys(kitBonus).forEach(function (id) {
      var n = kitBonus[id] | 0;
      if (n) out[id] = Object.assign({}, scores[id] || {}, { kit: n });
    });
    return out;
  }

  /* 'idle'   : pas encore lance          'pending' : lance, attend le MJ
     'reroll' : refuse, a relancer        'ok'      : valide, entre dans les creneaux */
  function initiativeStatus(entry) {
    if (!entry || entry.d6 == null) return (entry && entry.reroll) ? 'reroll' : 'idle';
    return entry.ok === true ? 'ok' : 'pending';
  }
  function initiativeReady(entry) { return initiativeStatus(entry) === 'ok'; }

  /* Round a partir duquel un combattant entre en jeu. Absent = 1 (present des le
     debut). Un retardataire lance son de normalement mais ne rejoint qu'au ROUND
     ENTIER SUIVANT : sans ca il pourrait surgir sur un creneau deja depasse, en
     amont de joueurs qui ont deja agi ce round. */
  function combatantJoinRound(c) {
    var j = c && c.joinRound;
    return (j == null) ? 1 : Math.max(1, j | 0);
  }

  /* Round d'entree a poser QUAND LE MJ VALIDE un score (spec §2.4, automatise le
     2026-09-03 apres test du MJ : le poser a la main en plein combat, ca s'oublie).
     Renvoie le round a ecrire, ou `null` s'il n'y a rien a ecrire.

     « Combat deja engage » = round > 1 OU quelqu'un a deja declare sa fin de tour
     dans ce round. C'est le critere du MJ, volontairement plus large que la seule
     justification « ne pas surgir en amont de qui a deja agi » : au round 3, meme si
     personne n'a encore agi, le nouveau venu n'etait pas la aux rounds 1 et 2 et son
     arrivee se joue au round suivant. Le cas « tout debut de combat » (round 1, aucune
     declaration) reste l'ajout de setup : entree immediate.

     `existingJoin` non nul = le MJ a deja choisi un round a la main : on n'ecrase PAS
     (un renfort annonce pour le round 7 ne doit pas retomber a round+1 a la validation). */
  function initiativeJoinOnValidate(round, done, existingJoin) {
    if (existingJoin != null) return null;
    round = Math.max(1, round | 0);
    var engaged = round > 1;
    if (!engaged) {
      var d = done || {};
      for (var k in d) { if (d[k] === true) { engaged = true; break; } }
    }
    return engaged ? round + 1 : null;
  }

  /* Creneaux du round : valeurs distinctes de score, triees DECROISSANT.
     `combatants` = [{ id, hp, joinRound }] (forme normalisee : les PJ viennent de
     `characters`, les PNJ de `combat/enemies`, l'appelant les uniformise).
     N'entrent que les combattants presents ce round ET dont le score est valide. */
  function initiativeSlots(combatants, scores, round) {
    scores = scores || {};
    round = Math.max(1, round | 0);
    var byInit = {};
    (combatants || []).forEach(function (c) {
      if (!c || c.id == null) return;
      if (combatantJoinRound(c) > round) return;
      var entry = scores[c.id];
      if (!initiativeReady(entry)) return;
      var t = initiativeTotal(entry);
      if (t == null) return;
      if (!byInit[t]) byInit[t] = [];
      byInit[t].push(c.id);
    });
    return Object.keys(byInit)
      .map(Number)
      .sort(function (a, b) { return b - a; })
      .map(function (init) { return { init: init, members: byInit[init] }; });
  }

  /* Participants REELS d'un creneau — applique la regle du KO differe.
     Un combattant a 0 PV ne participe pas... SAUF s'il est tombe pendant CE creneau
     de CE round : le MJ veut qu'il joue quand meme son action (tuer un monstre dans
     son creneau lui laisse le temps de riposter). D'ou l'horodatage `ko`. */
  function slotParticipants(members, byId, ko, round, init) {
    ko = ko || {}; byId = byId || {};
    round = Math.max(1, round | 0);
    return (members || []).filter(function (id) {
      var c = byId[id];
      var hp = c ? (Number(c.hp) || 0) : 0;
      if (hp > 0) return true;
      var k = ko[id];
      return !!(k && (k.round | 0) === round && Number(k.init) === Number(init));
    });
  }

  /* Etat complet du round, en UN appel (ce que l'UI consomme).
     Le creneau actif est DERIVE, jamais stocke : c'est le premier dont les
     participants n'ont pas tous declare. Consequence : quand le dernier membre
     coche « j'ai fini », le creneau suivant s'active pour tout le monde SANS
     aucune ecriture supplementaire — donc sans course entre deux clics simultanes.
     Un creneau dont tous les membres sont KO avant ouverture a 0 participant :
     il est complet d'office et se saute tout seul (pas de blocage de table). */
  function initiativeState(combatants, scores, done, ko, round) {
    done = done || {};
    round = Math.max(1, round | 0);
    var byId = {};
    (combatants || []).forEach(function (c) { if (c && c.id != null) byId[c.id] = c; });
    var slots = initiativeSlots(combatants, scores, round).map(function (s) {
      var participants = slotParticipants(s.members, byId, ko, round, s.init);
      var pending = participants.filter(function (id) { return done[id] !== true; });
      return {
        init: s.init, members: s.members, participants: participants,
        pending: pending, complete: pending.length === 0,
      };
    });
    var active = null;
    for (var i = 0; i < slots.length; i++) {
      if (!slots[i].complete) { active = slots[i]; break; }
    }
    return {
      slots: slots,
      active: active,
      activeInit: active ? active.init : null,
      // « Fin de round » ne s'allume que s'il y avait quelque chose a jouer.
      complete: active === null && slots.length > 0,
    };
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

  /* ------------------------------------------------------------
     MODES D'ATTAQUE DE BASE (2026-09-06)
     Gestes nommés à ratio FIXE appliqués à la puissance d'attaque (AD ou AP selon
     l'arme, cf. skillBaseDamage). Le mode ne change ni la cible, ni le type de dégâts,
     ni la léthalité : il ne fait que rogner le nombre.

     ⚠️ À NE PAS CONFONDRE avec l'ancien `ATTACK_MODES` (offensif/équilibré/défensif),
     retiré en juin (f509f42) et définitivement abandonné : c'était une POSTURE, choisie
     pour le tour et multipliant TOUTE l'attaque. Ici chaque entrée est un geste choisi
     coup par coup, et `normal` (100 %) reste le défaut.

     ⚠️ `crit:false` = ce mode ne peut PAS faire de coup critique (ruling MJ du
     2026-09-06). Un geste de mépris ne doit pas pouvoir sortir un gros chiffre : à
     20 d'Habileté le multiplicateur de crit vaut ×2,30, ce qui ferait d'une gifle
     critique un demi coup de poing. Seule l'attaque pleine roule le dé.
     ------------------------------------------------------------ */
  var BASIC_MODES = [
    { id: 'normal',     label: 'Attaque',       ic: '⚔',  mult: 1.00, crit: true  },
    { id: 'retenu',     label: 'Coup retenu',   ic: '🗡', mult: 0.50, crit: false, note: 'Plat de lame' },
    { id: 'poing',      label: 'Coup de poing', ic: '🤛',   mult: 0.25, crit: false },
    { id: 'botte',      label: 'Botter le cul', ic: '🦶',    mult: 0.15, crit: false },
    { id: 'bousculade', label: 'Bousculade',    ic: '🫱',   mult: 0.10, crit: false },
    { id: 'gifle',      label: 'Gifle',         ic: '👋',   mult: 0.05, crit: false },
  ];
  /* Mode par id ; un id inconnu (ou absent) retombe sur l'attaque pleine — un mode
     disparu du code ne doit pas transformer une attaque en coup à 0. */
  function basicMode(id) {
    for (var i = 0; i < BASIC_MODES.length; i++) if (BASIC_MODES[i].id === id) return BASIC_MODES[i];
    return BASIC_MODES[0];
  }
  /* Dégâts affichés/envoyés pour un mode. Pas de plancher artificiel à 1 : une gifle
     qui rend 0 sur une puissance dérisoire est une information juste, et le MJ ajuste
     le champ à la résolution comme pour n'importe quelle attaque. */
  function basicModeDamage(power, id) {
    return Math.max(0, Math.round(Math.max(0, power || 0) * basicMode(id).mult));
  }

  /* Verrous « une fois par… », rangés dans `cooldowns/<skillId>` comme un readyAt inatteignable.
       SKILL_CD_COMBAT — 1×/combat : levé par « ⟲ Combat » (qui purge les cooldowns).
       SKILL_CD_DAY    — 1×/JOUR (règle G4 du 2026-10-10 : toutes les C4) : « ⟲ Combat » le
                         GARDE, seul le bouton MJ « ☀ Nouveau jour » le lève.
     ⚠️ Deux valeurs distinctes exprès : c'est la valeur qui dit quel bouton lève le verrou,
     aucun autre champ en base. `WEAPON_CD_LOCKED` (propriétés d'armes) vaut SKILL_CD_COMBAT
     et reste 1×/combat. Le remboursement d'une action annulée (`cdPrev`) marche tel quel. */
  var SKILL_CD_COMBAT = 999999;
  var SKILL_CD_DAY = 999998;
  /* Verrou à poser au cast selon `sk.kind`. */
  function skillLockValue(sk, turn) {
    if (sk && sk.kind === 'day') return SKILL_CD_DAY;
    if (sk && sk.kind === 'combat') return SKILL_CD_COMBAT;
    return nextReadyAt(turn, sk && sk.kind === 'turn' ? 1 : ((sk && sk.cd) || 0));
  }
  /* Cooldowns qui SURVIVENT à « ⟲ Combat » : les verrous du jour, et eux seuls.
     → objet à écrire, ou null s'il ne reste rien (null = suppression du nœud). */
  function cooldownsAfterCombat(cooldowns) {
    var out = {}, n = 0;
    Object.keys(cooldowns || {}).forEach(function (k) {
      if (cooldowns[k] === SKILL_CD_DAY) { out[k] = SKILL_CD_DAY; n++; }
    });
    return n ? out : null;
  }
  /* « ☀ Nouveau jour » : patch qui lève les verrous du jour sans toucher aux autres
     cooldowns (un combat peut être en cours). → { skillId: null }, ou null s'il n'y a rien. */
  function dayUnlockPatch(cooldowns) {
    var out = {}, n = 0;
    Object.keys(cooldowns || {}).forEach(function (k) {
      if (cooldowns[k] === SKILL_CD_DAY) { out[k] = null; n++; }
    });
    return n ? out : null;
  }

  /* Cooldown stocké comme « n° de tour de disponibilité » (readyAt). */
  function cooldownReady(readyAt, currentTurn) {
    if (readyAt == null) return true;
    return currentTurn >= readyAt;
  }
  function nextReadyAt(currentTurn, cd) {
    return currentTurn + (cd | 0);
  }
  /* ============================================================
     ACTIONS EN ATTENTE — ciblage, plan de cast, remboursement
     Spec : docs/superpowers/specs/2026-09-06-actions-en-attente-design.md
     Contrat : un joueur propose UNE ACTION composée de N INSTANCES, chacune
     portant UN effet (dégâts / soin / statut) sur UNE cible. Le MJ résout
     instance par instance. AUCUN effet n'est écrit au cast — c'est ce qui rend
     le rejet exact : il n'y a jamais rien à défaire.
     ============================================================ */

  var EFFECT_LABEL = { damage: 'Dégâts', heal: 'Soin', status: 'Effet', boon: 'Bienfait' };

  /* Une compétence a-t-elle un effet sur son lanceur ? (buff, bouclier, compteur,
     transformation) — c'est ce qui donne son instance `status`. */
  function hasSelfEffect(sk) {
    return !!(sk && (sk.shield || sk.selfBuff || sk.selfBuffFlat
      || sk.counterBump || sk.counterSet || sk.transform));
  }

  /* Ce qu'une compétence peut cibler, effet par effet :
       { damage: {camp,min,max}, heal: {...}, status: {camp:'self'} }
     `camp` ∈ 'foes' | 'allies' | 'any' | 'self' ; `max: null` = illimité.
     ⚠️ Dérivée des champs EXISTANTS de `SKILLS` : on n'a pas réécrit les 18 kits.
     Le test « cette comp fait-elle des dégâts ? » ne peut PAS être `!!sk.dmg` —
     cinq compétences déclarent `dmg: () => null` (Fondu au noir, Ralliement, Mur
     de Givre, Ailes de Givre, Souverain Glacial). Il faut évaluer la fonction.
     Un champ `targeting` optionnel dans data.jsx surcharge au cas par cas. */
  function skillTargeting(sk, eff, ctx) {
    var out = {};
    if (!sk) return out;
    var over = sk.targeting || {};
    var dmg = typeof sk.dmg === 'function' ? sk.dmg(eff || {}, ctx || {}) : null;
    var heal = typeof sk.heal === 'function' ? sk.heal(eff || {}, ctx || {}) : null;
    if (dmg != null) out.damage = Object.assign({ camp: 'any', min: 1, max: 1 }, over.damage);
    if (heal != null) out.heal = Object.assign({ camp: 'allies', min: 1, max: 1 }, over.heal);
    // « Bienfait » : bouclier ou mana donné à UN AUTRE (C1 de Jett) — voir `buildCastPlan`.
    var boon = typeof sk.boon === 'function' ? sk.boon(eff || {}, ctx || {}) : null;
    if (boon != null) out.boon = Object.assign({ camp: 'allies', min: 1, max: 1 }, over.boon);
    if (hasSelfEffect(sk)) out.status = Object.assign({ camp: 'self', min: 1, max: 1 }, over.status);
    return out;
  }

  /* La sélection de cibles du joueur est-elle lançable ? Alimente l'état désactivé
     du bouton « Lancer » et son infobulle. Les effets sur soi sont implicites. */
  function castSelectionValid(targeting, selection) {
    var t = targeting || {}, s = selection || {};
    var keys = Object.keys(t), aimable = 0, total = 0;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], spec = t[k] || {};
      if (spec.camp === 'self') continue;
      aimable++;
      var n = (s[k] || []).length;
      total += n;
      var min = spec.min == null ? 1 : spec.min;
      var max = spec.max;
      var lbl = EFFECT_LABEL[k] || k;
      if (n < min) return { ok: false, effect: k,
        reason: lbl + ' : choisis au moins ' + min + ' cible' + (min > 1 ? 's' : '') };
      if (max != null && n > max) return { ok: false, effect: k,
        reason: lbl + ' : ' + max + ' cible' + (max > 1 ? 's' : '') + ' au maximum' };
    }
    // ⚠️ Garde globale : une compétence dont TOUS les effets sont optionnels (Alignement
    // de séquence peut ne blesser personne ou ne soigner personne) passerait la boucle
    // avec zéro cible et partirait en « effet en table » — 40 mana pour rien.
    // Exception DÉCLARÉE par la compétence (`optional: true` sur l'effet ciblable) : la
    // transformation d'Urskaar se lance sans rien piétiner — son instance `status` sur le
    // lanceur garantit que l'action n'est pas vide. La Surcharge de Jett, elle, a aussi un
    // effet sur soi (cellules remises à zéro) mais reste gardée : sans cible, elle ne fait rien.
    var allOptional = keys.every(function (k) { return t[k].camp === 'self' || t[k].optional === true; });
    if (aimable > 0 && total === 0 && !(allOptional && t.status)) return { ok: false, effect: null,
      reason: 'Choisis au moins une cible' };
    return { ok: true, effect: null, reason: '' };
  }

  /* Effet sur le lanceur, snapshoté au cast et appliqué SEULEMENT à la résolution.
     Reprend à l'identique les calculs qui vivaient dans `cast()` : selfBuff (% de la
     stat de BASE), selfBuffFlat (valeurs plates ou fonction), durée, bouclier,
     counterBump/counterSet, transformation. */
  function buildSelfEffect(sk, eff, ctx, opts) {
    if (!hasSelfEffect(sk)) return null;
    eff = eff || {}; ctx = ctx || {}; opts = opts || {};
    var turn = opts.turn || 1, base = opts.base || {};
    var out = { label: '', mods: null, until: null, shield: 0, counters: null,
      transformUntil: null, hpGain: 0, hpMax: eff.hp || 0 };
    var parts = [];
    var flat = {};
    if (sk.selfBuff) Object.keys(sk.selfBuff).forEach(function (k) {
      var f = Math.round(sk.selfBuff[k] * (base[k] || 0)); if (f) flat[k] = (flat[k] || 0) + f;
    });
    var sbf = typeof sk.selfBuffFlat === 'function' ? (sk.selfBuffFlat(eff, ctx) || {}) : sk.selfBuffFlat;
    if (sbf) Object.keys(sbf).forEach(function (k) {
      var f = Math.round(sbf[k]); if (f) flat[k] = (flat[k] || 0) + f;
    });
    if (Object.keys(flat).length) {
      out.mods = flat;
      var txt = Object.keys(flat).map(function (k) { return '+' + flat[k] + ' ' + k.toUpperCase(); }).join(', ');
      if (sk.duration) {
        var d = Math.max(sk.duration.min, Math.min(sk.duration.max, (ctx.duration | 0) || sk.duration.min));
        out.until = turn + (d - 1);
        txt += ' (' + d + ' tour' + (d > 1 ? 's' : '') + ')';
      }
      parts.push(txt);
      // Un buff de PV déplace le plafond ET remplit la jauge (décision figée) : on
      // snapshote le nouveau max pour que la résolution n'ait pas à le recalculer.
      if (flat.hp) { out.hpGain = flat.hp; out.hpMax = (eff.hp || 0) + flat.hp; }
    }
    if (typeof sk.shield === 'function') {
      // Bouclier TOUJOURS sur soi : producteur = receveur, donc `soins` compte une fois
      // (décision MJ du 2026-10-05) et tout est résolu dès le cast.
      var sh = Math.max(0, sk.shield(eff, ctx) | 0);
      sh = applyHealBonus(sh, { producerSoins: eff.soins || 0, sameActor: true,
        producerBuffs: opts.buffs || [], receiverBuffs: opts.buffs || [] });
      if (sh) { out.shield = sh; parts.push('+' + sh + ' bouclier'); }
    }
    var counters = {}, cur = ctx.counters || {};
    if (sk.counterBump) {
      var cb = sk.counterBump, c0 = cur[cb.key] | 0;
      if (c0 >= (cb.min || 0)) {
        counters[cb.key] = Math.min(cb.max != null ? cb.max : c0 + cb.by, c0 + cb.by);
        parts.push(cb.key + ' → ' + counters[cb.key]);
      }
    }
    if (sk.counterSet) Object.keys(sk.counterSet).forEach(function (k) {
      counters[k] = sk.counterSet[k] | 0; parts.push(k + ' → ' + counters[k]);
    });
    if (Object.keys(counters).length) out.counters = counters;
    if (sk.transform) {
      out.transformUntil = turn + (sk.transform.turns - 1);
      parts.push('transformation ' + sk.transform.turns + ' tours');
    }
    out.label = parts.join(' · ') || 'effet';
    return out;
  }

  /* Coût en mana d'une compétence (règle G5 du rééquilibrage, 2026-10-10) :
       coût(niveau) = arrondi(coût du niveau 2 × (1 + 8 % × (niveau − 2)))
     `sk.mana` de SKILLS est le coût AU NIVEAU 2. `sk.manaFixed` (les C4) = coût fixe.
     Niveau absent → coût du niveau 2. `skillManaPer` : même pente pour un coût PAR CIBLE
     (`manaPer`, ex. « 4 par cellule » de la Surcharge de Jett). */
  var MANA_COST_PER_LEVEL = 0.08;
  function scaleManaCost(base, level, fixed) {
    base = Math.max(0, Number(base) || 0);
    if (fixed) return Math.round(base);
    var lvl = level == null ? 2 : (Number(level) || 2);
    return Math.max(0, Math.round(base * (1 + MANA_COST_PER_LEVEL * (lvl - 2))));
  }
  function skillManaCost(sk, level) { return sk ? scaleManaCost(sk.mana, level, sk.manaFixed) : 0; }
  function skillManaPer(sk, level) { return sk ? scaleManaCost(sk.manaPer, level, sk.manaFixed) : 0; }
  /* Coût RÉEL d'un cast. Une compétence à `manaCount(ctx)` paie en plus `manaPer` par UNITÉ
     comptée (Surcharge de Jett : 13 + 4 par cellule consommée). ⚠️ Ce n'est PAS un coût par
     cible : rien n'en est rendu quand le MJ retire une instance (voir `buildCastPlan`). */
  function skillCastCost(sk, level, ctx) {
    var n = sk && typeof sk.manaCount === 'function' ? Math.max(0, sk.manaCount(ctx || {}) | 0) : 0;
    return skillManaCost(sk, level) + (n ? skillManaPer(sk, level) * n : 0);
  }

  /* Le plan complet d'un cast : ce qu'il coûte, et la liste des instances à déposer
     dans la file du MJ. Pur — `opts.rng` rend les jets de critique déterministes.
     opts = { turn, base, wType, selfId, cdPrev, rng, narrative, level }
     Champs optionnels d'une compétence lus ici (rangs 1 du 2026-10-10) :
       noCrit            — la compétence ne roule pas le dé (Tir Ciblé, Salve) ;
       critBonus(eff,ctx)— points de crit ajoutés pour CE cast (Attaque sournoise camouflée) ;
       dmgType(eff,ctx)  — type de dégâts imposé, sinon celui de l'arme (poison de Jett) ;
       dmgLabel(eff,ctx) — rappel porté par chaque instance de dégâts, lu par le MJ ;
       selfHeal(eff,ctx,n) — soin du LANCEUR, n = nombre de cibles de dégâts (Salve) ;
       boon(eff,ctx)     — bouclier `{shield}` ou mana `{manaPct, manaFlat}` donné à une cible
                           alliée : instance `status` marquée `boon`, convertie par `resolveBoon` ;
       summon(eff,ctx)   — fiche d'un COMPAGNON (Nano-hex) : instance `status` marquée `summon`,
                           que le MJ transforme en PNJ allié à la validation.
     ⚠️ Le coût dépend du NIVEAU (`opts.level`, à défaut `ctx.level`) : c'est le seul endroit
     où le plan le lit, et l'appelant doit payer exactement `cost.mana`. */
  function buildCastPlan(sk, eff, ctx, selection, opts) {
    eff = eff || {}; ctx = ctx || {}; selection = selection || {}; opts = opts || {};
    var magic = opts.wType === 'Magique';
    var selfId = opts.selfId || '';
    var castLevel = opts.level != null ? opts.level : ctx.level;
    var instances = [], seq = 0;
    var dmg = typeof sk.dmg === 'function' ? sk.dmg(eff, ctx) : null;
    var noCrit = !!(opts.noCrit || sk.noCrit);
    var critPct = (eff.crit || 0) + (typeof sk.critBonus === 'function' ? (Number(sk.critBonus(eff, ctx)) || 0) : 0);
    var dmgType = (typeof sk.dmgType === 'function' && sk.dmgType(eff, ctx)) || (magic ? 'magique' : 'physique');
    var dmgLabel = typeof sk.dmgLabel === 'function' ? sk.dmgLabel(eff, ctx) : '';
    var nDmg = dmg != null ? (selection.damage || []).length : 0;
    if (dmg != null) (selection.damage || []).forEach(function (tid) {
      // Un jet de critique PAR instance : trois cibles = trois jets, comme la salve
      // le faisait déjà. `opts.noCrit` sert aux modes d'attaque réduits (une gifle
      // ne roule pas le dé — ruling MJ du 2026-09-06), `sk.noCrit` aux compétences sans crit.
      var cr = noCrit ? { didCrit: false, multiplier: 1 }
        : rollCrit(critPct, eff.dcrit || 0, opts.rng);
      var inst = { seq: ++seq, kind: 'damage', targetId: tid,
        computedDmg: dmg, critDmg: Math.round(dmg * cr.multiplier),
        didCrit: cr.didCrit, critMult: cr.multiplier,
        type: dmgType,
        letha: eff.letha || 0, lethaMag: eff.lethaMag || 0,
        crit: noCrit ? 0 : critPct, dcrit: eff.dcrit || 0,
        vol: eff.vol || 0, sapience: eff.sapience || 0, omni: eff.omni || 0,
        hpMax: eff.hp || 0 };
      if (dmgLabel) inst.label = dmgLabel;
      instances.push(inst);
    });
    var heal = typeof sk.heal === 'function' ? sk.heal(eff, ctx) : null;
    if (heal != null) (selection.heal || []).forEach(function (tid) {
      /* Côté PRODUCTEUR snapshoté au cast (contrat du 2026-09-06) ; le côté RECEVEUR est
         ajouté à la résolution par le MJ, qui est le seul à connaître les stats de la cible.
         ⚠️ Sur soi, le producteur compte seul (`sameActor`) : pas de double compte. */
      instances.push({ seq: ++seq, kind: 'heal', targetId: tid, amount: Math.max(0, Math.round(heal)),
        healBonus: eff.soins || 0, sameActor: tid === selfId, producerBuffs: opts.buffs || [] });
    });
    /* Soin du LANCEUR proportionnel au nombre de cibles (Salve du Corsaire). Producteur =
       receveur : `soins` compté une fois. Le MJ ajuste le montant si une cible est manquée. */
    var selfHeal = typeof sk.selfHeal === 'function' && nDmg > 0 ? sk.selfHeal(eff, ctx, nDmg) : null;
    if (selfHeal) instances.push({ seq: ++seq, kind: 'heal', targetId: selfId, amount: Math.max(0, Math.round(selfHeal)),
      healBonus: eff.soins || 0, sameActor: true, producerBuffs: opts.buffs || [],
      label: 'pour ' + nDmg + ' cible' + (nDmg > 1 ? 's' : '') + ' touchée' + (nDmg > 1 ? 's' : '') + ' (ajuster si une cible est manquée)' });
    /* Bienfait donné à un AUTRE (bouclier, mana). Côté producteur snapshoté, comme un soin ;
       le côté receveur — et le mana max de la cible — sont lus par le MJ (`resolveBoon`). */
    var boon = typeof sk.boon === 'function' ? sk.boon(eff, ctx) : null;
    if (boon != null) (selection.boon || []).forEach(function (tid) {
      instances.push(Object.assign({ seq: ++seq, kind: 'status', targetId: tid, boon: true,
        healBonus: eff.soins || 0, sameActor: tid === selfId, producerBuffs: opts.buffs || [] }, boon));
    });
    var summon = typeof sk.summon === 'function' ? sk.summon(eff, ctx) : null;
    if (summon) instances.push({ seq: ++seq, kind: 'status', targetId: selfId, summon: summon,
      label: 'Invoque ' + summon.name + ' — ' + (summon.note || '') });
    var self = buildSelfEffect(sk, eff, ctx, opts);
    if (self) instances.push(Object.assign({ seq: ++seq, kind: 'status', targetId: selfId }, self));
    // ⚠️ Une compétence sans AUCUN effet chiffré (Fondu au noir, Voile dimensionnel,
    // Ailes de Givre) produirait une action VIDE : le MJ ne verrait rien, et une comp
    // à 40 mana / CD 3 resterait hors de son contrôle — pire qu'avant la refonte.
    // Elle reçoit donc une instance narrative sur son lanceur, à accepter ou rejeter.
    if (!instances.length) instances.push({ seq: 1, kind: 'status', targetId: selfId,
      narrative: true, label: opts.narrative || 'Effet géré en table' });
    return { instances: instances,
      // `manaPer` du plan = mana rendu PAR INSTANCE retirée : nul pour un coût par unité (`manaCount`).
      cost: { mana: skillCastCost(sk, castLevel, ctx),
        manaPer: typeof sk.manaCount === 'function' ? 0 : skillManaPer(sk, castLevel),
        manaMax: Math.max(0, eff.mana | 0),
        cdPrev: opts.cdPrev != null ? opts.cdPrev : null } };
  }

  /* Convertit un BIENFAIT (instance `status` marquée `boon`) en ce que
     `applyStatusToCharacter` sait écrire. Appelée par le MJ à la résolution : lui seul
     connaît le receveur. receiver = { soins, buffs:[], manaMax }.
       bouclier → `soins` producteur + receveur (une seule fois si c'est le même), comme un soin ;
       mana     → `manaPct` % du mana max DU RECEVEUR, plafonné à ce max par l'orchestrateur. */
  function resolveBoon(inst, receiver) {
    inst = inst || {}; receiver = receiver || {};
    var out = { label: inst.label || '' };
    if (inst.shield) {
      out.shield = applyHealBonus(Math.max(0, inst.shield | 0), { producerSoins: inst.healBonus || 0,
        receiverSoins: receiver.soins || 0, sameActor: !!inst.sameActor,
        producerBuffs: inst.producerBuffs || [], receiverBuffs: receiver.buffs || [] });
      out.label = 'Bouclier de ' + out.shield;
    }
    if (inst.manaPct || inst.manaFlat) {
      var max = Math.max(0, receiver.manaMax | 0);
      out.manaGain = Math.floor(max * (inst.manaPct || 0) / 100 + 1e-9) + Math.max(0, inst.manaFlat | 0);
      out.manaMax = max;
      out.label = '+' + out.manaGain + ' mana';
    }
    return out;
  }

  /* Remboursement d'une action rejetée. `mode` :
       'cancel'   — « ↺ Annuler la compétence » : tout retiré
       'instance' — « ✕ » sur une instance
       'fail'     — « ⊘ Échec » : tout retiré, RIEN rendu (l'action a eu lieu, elle rate)
     Règles (§6 de la spec, arbitrage MJ du 2026-09-06) :
       · une instance rejetée alors que d'autres restent ne rend QUE `manaPer`
         (mana facturé à la cible), qui vaut 0 pour toutes les comps actuelles ;
       · rejeter la DERNIÈRE instance revient à annuler la compétence → tout rendu ;
       · mais si le MJ a déjà APPLIQUÉ une instance, la compétence a eu lieu : plus
         rien n'est rendu, jamais. Sans ce garde-fou une salve sur 3 gnolls dont 2
         meurent serait remboursée. */
  function actionRefundPlan(action, mode, inst) {
    if (!action || mode === 'fail') return null;
    // Débuff d'arme retiré par le MJ (l'attaque a raté, il n'a pas pris) : on rend SON
    // rechargement, même si les dégâts de l'action ont déjà été appliqués (livraison armes 3).
    if (mode === 'instance' && inst && inst.cdKey && action.attackerId) {
      return { attackerId: action.attackerId, attackerName: action.attackerName || '',
        skillId: action.skillId, skillName: action.skillName || action.skillId,
        mana: 0, manaMax: 0, cdPrev: inst.cdPrev != null ? inst.cdPrev : null, restoreCd: true, cdKey: inst.cdKey };
    }
    var cost = action.cost || {};
    var applied = Math.max(0, action.appliedCount | 0);
    var remaining = action.instances ? Object.keys(action.instances).length : 0;
    var full = { attackerId: action.attackerId, attackerName: action.attackerName || '',
      skillId: action.skillId, skillName: action.skillName || action.skillId,
      mana: Math.max(0, cost.mana | 0), manaMax: Math.max(0, cost.manaMax | 0),
      cdPrev: cost.cdPrev != null ? cost.cdPrev : null, restoreCd: true,
      // Rechargement d'une PROPRIÉTÉ D'ARME (Balayage, Purge, Décimation…) : sa clé n'est pas
      // l'id de l'action (`basic`), elle est portée par le coût (livraison armes 2).
      cdKey: cost.cdKey || null };
    if (!full.attackerId) return null;
    if (applied > 0) return null;
    if (mode === 'instance' && remaining > 1) {
      var per = Math.max(0, cost.manaPer | 0);
      if (!per) return null;
      return Object.assign({}, full, { mana: per, restoreCd: false });
    }
    if (!full.mana && full.cdPrev == null && !cost.mana && !cost.cdKey) {
      // Attaque de base : ni mana ni cooldown, rien à rendre.
      if (action.source === 'basic') return null;
    }
    return full;
  }
  /* Mana après remboursement : jamais au-dessus du plafond du lanceur, jamais en
     dessous de son mana courant (il a pu boire une potion entre-temps). Sans
     plafond connu (`max` à 0), on rend simplement la somme. */
  function refundManaValue(cur, amount, max) {
    const c = Math.max(0, cur | 0);
    const cap = (max | 0) > 0 ? Math.max(c, max | 0) : c + Math.max(0, amount | 0);
    return Math.min(c + Math.max(0, amount | 0), cap);
  }

  /* Déblocage des compétences par niveau : active n° i (0-based) requiert le niveau i+1. */
  function skillUnlocked(index, level) {
    return (Number(level) || 0) >= (Number(index) || 0) + 1;
  }

  /* --- Elias : passif Instinct du Chasseur (réécrit le 2026-10-10) ---
     6 % de son AD de BASE par charge (c'était 10 + 5/niveau en plat : +121 % d'AD au niveau 18).
     Charges max : 5 + 1 tous les 4 niveaux (5 / 6 / 7 / 8 / 9 aux niveaux 1 / 5 / 9 / 13 / 17).
     ⚠️ AD de BASE (`charBaseStats`), pas l'AD effective : le passif ne se nourrit ni de
     l'équipement ni de lui-même. Non amélioré par les rangs. */
  var ELIAS_PASSIVE_PCT = 6;
  function eliasMaxStacks(level) { return 5 + Math.floor(((level || 1) - 1) / 4); }
  function eliasPassiveAD(baseAd, stacks) {
    return Math.floor((Number(baseAd) || 0) * ELIAS_PASSIVE_PCT * Math.max(0, stacks | 0) / 100 + 1e-9);
  }
  /* ⚠️ RANGS 1 DU RÉÉQUILIBRAGE (2026-10-10, plan `2026-10-10-competences-patchs-a-appliquer.md` §2).
     Les dégâts de compétence sont en % d'AD/AP, SANS bonus fixe : les ratios ci-dessous ont
     DÉJÀ reçu la conversion ×0,6. Quatre exceptions voulues par le MJ : Attaque sournoise,
     Frappe Irritée, Flétrissement (non converties) et Éclat de l'âme (×0,9). Ne pas les
     « réaligner ». `pctOf` calcule en pourcentages ENTIERS : `ad × (0.72 + 0.18)` en flottant
     peut rendre 89,99 et perdre un point au `floor`. */
  function pctOf(v, pct) { return Math.floor((Number(v) || 0) * pct / 100 + 1e-9); }

  function dmgEliasC1(eff, firstHit) {          // Tir Ciblé : 66 % AD, sans crit ; 1er coup +25 %
    const d = pctOf(eff.ad, 66);
    return firstHit ? Math.floor(d * 1.25) : d;
  }
  function dmgEliasC2(eff) { return pctOf(eff.ad, 66); }                          // Dash : s'il finit au corps à corps
  function dmgEliasC3(eff, melee) { return pctOf(eff.ad, melee ? 84 : 96); }     // Frappe Duale : mêlée / distance
  function dmgEliasC4(eff) { return pctOf(eff.ad, 78); }                          // Salve : par cible, sans crit
  /* Salve : soin de 8 % de SES PV max par cible touchée (remplace « 5 % du total »). */
  function eliasC4Heal(eff, nbTargets) { return pctOf((eff.hp || 0) * Math.max(0, nbTargets | 0), 8); }
  function skillHeal(total, pct) { return Math.floor((total || 0) * (pct || 0)); }

  /* --- Smith (Erwan.gs) --- */
  function dmgSmithPassif(eff) { return Math.floor(50 + 0.5 * (eff.ap || 0)); }   // Flétrissement : NON converti
  /* Attaque sournoise : un MULTIPLE DE L'ATTAQUE DE BASE (60 % des dégâts d'arme), pas un ratio
     propre. ×1 normale · ×1,5 camouflé · ×2 cible marquée · ×4,5 marquée ET camouflée (le
     produit serait ×3 : le ×4,5 est une décision MJ, pas une erreur).
     ⚠️ Elle passe par `skillBaseDamage`, pas par le profil d'arme : elle ne subit ni le ratio
     des mini-armes ni le malus de maîtrise, comme avant. */
  function smithC1Mult(furtif, marked) { return furtif && marked ? 4.5 : (marked ? 2 : (furtif ? 1.5 : 1)); }
  function dmgSmithC1(wType, eff, furtif, marked) {
    return Math.floor(skillBaseDamage(wType, eff) * BASIC_ATTACK_RATIO * smithC1Mult(furtif, marked) + 1e-9);
  }
  function smithC1CritBonus(furtif) { return furtif ? 30 : 0; }   // +30 points de crit sous camouflage
  function dmgSmithC3(eff) { return pctOf(eff.ad, 72); }           // Chaînes : la cible choisie
  /* Saignement des Chaînes : 20 % de l'AD par tour, en dégâts BRUTS (un NOMBRE, plus un % :
     l'ancien `smithBleedPct` « 5 % + 5 %/100 AD » est abandonné). Non converti. */
  function smithBleed(eff) { return pctOf(eff.ad, 20); }

  /* --- Urskaar (Baptiste.gs + kit C3/C4) : Voie de l'ours ---
     ⚠️ La TRANCHE se compte sur le déplacement ANNONCÉ (« a l'intention de parcourir X cases »),
     partout : 1 tranche à 5 cases, +1 par 3 cases (règle G7). */
  /* Passif : bonus de l'ATTAQUE DE BASE, en % de l'attaque de base (pas de l'AD) —
     +50 % à 5 cases annoncées, +25 % par tranche de 3 cases en plus. */
  function bearBonusPct(moved) {
    if (moved < 5) return 0;
    return 50 + Math.floor((moved - 5) / 3) * 25;
  }
  function bearTranches(moved) {
    if (moved < 5) return 0;
    return 1 + Math.floor((moved - 5) / 3);
  }
  /* C1 : la gauche est le coup de dégâts (72 % AD + 18 %/tranche), la droite le coup de
     contrôle (54 % AD + 6 %/tranche, étourdit à 50 % + 10 %/tranche). */
  function dmgUrskaarC1(eff, side, moved) {
    const t = bearTranches(moved);
    return side === 'droite' ? pctOf(eff.ad, 54 + 6 * t) : pctOf(eff.ad, 72 + 18 * t);
  }
  function urskaarStunPct(moved) { return Math.min(100, 50 + 10 * bearTranches(moved)); }
  function dmgUrskaarC2(eff, moved) { return pctOf(eff.ad, 90 + 15 * bearTranches(moved)); }
  /* C3 : bouclier de 30 % des PV max + 20 % par 50 AP — calcul CONTINU (0,4 % par point d'AP),
     non converti. */
  function urskaarC3Shield(eff, hpMax) {
    return Math.floor((0.30 + 0.20 * ((eff.ap || 0) / 50)) * (hpMax || 0) + 1e-9);
  }
  /* C4 : piétinement par unité traversée. Un allié adjacent qui rate sa sauvegarde subit le
     QUART de ce qu'un ennemi subirait (10,5 % AD + 3 %/tranche). */
  function dmgUrskaarC4(eff, moved) { return pctOf(eff.ad, 42 + 12 * bearTranches(moved)); }
  function dmgUrskaarC4Ally(eff, moved) { return pctOf(eff.ad, 10.5 + 3 * bearTranches(moved)); }

  /* --- Jett (Steph.gs) : Nano-hextech --- */
  function jettEngins(eff, isCrit) {
    const ad = eff.ad || 0;
    let n = 1;
    if (ad >= 50) n++;
    if (ad >= 125) n++;
    if (ad >= 225) n++;
    if (ad >= 375) n++;
    if (ad >= 550) n++;   // 5e palier du kit d'origine, absent du code jusqu'au 2026-10-10 (décision MJ)
    return isCrit ? n * 2 : n;
  }
  function dmgJettPoison(eff) { return 15 + pctOf(eff.ap, 30); }
  function dmgJettForce(eff) { return 15 + pctOf(eff.ad, 30); }
  function dmgJettC2(eff) { return pctOf(eff.ad, 36); }
  function healJettC2(eff) { return 40 + pctOf(eff.ap, 80); }
  /* C1 Remodulation : trois tirages de SOUTIEN (non convertis). */
  function healJettC1(eff) { return 20 + pctOf(eff.ap, 40); }
  function shieldJettC1(eff) { return 25 + pctOf(eff.ap, 50); }
  /* Mana rendu : 15 % du mana max DE LA CIBLE + 1 % par 40 AP (continu). Le lanceur ne connaît
     pas le mana max d'un autre PJ (fiches cloisonnées) : il n'envoie que le POURCENTAGE, le MJ
     le convertit à la résolution (`resolveBoon`). */
  function jettC1ManaPct(eff) { return 15 + (Number(eff.ap) || 0) / 40; }
  /* Les 10 configurations, tirées à chance ÉGALE (réglage provisoire du MJ, 2026-10-10).
     `kind` : narrative (effet en table) · damage · heal · shield · mana. */
  var JETT_C1_EFFECTS = [
    { id: 'champ',        label: 'Champ électrique', kind: 'narrative' },
    { id: 'poison',       label: 'Poison',           kind: 'damage', stat: 'ap', dmgType: 'magique' },
    { id: 'duplication',  label: 'Duplication',      kind: 'narrative' },
    { id: 'flash',        label: 'Flash',            kind: 'narrative' },
    { id: 'repoussement', label: 'Repoussement',     kind: 'damage', stat: 'ad', dmgType: 'physique' },
    { id: 'attraction',   label: 'Attraction',       kind: 'damage', stat: 'ad', dmgType: 'physique' },
    { id: 'fumigene',     label: 'Fumigène',         kind: 'narrative' },
    { id: 'soin',         label: 'Soin',             kind: 'heal' },
    { id: 'bouclier',     label: 'Bouclier',         kind: 'shield' },
    { id: 'mana',         label: 'Mana',             kind: 'mana' },
  ];
  function jettC1Effect(id) {
    for (var i = 0; i < JETT_C1_EFFECTS.length; i++) if (JETT_C1_EFFECTS[i].id === id) return JETT_C1_EFFECTS[i];
    return null;
  }
  function jettC1Roll(rng) {
    var r = (rng || Math.random)();
    return JETT_C1_EFFECTS[Math.min(JETT_C1_EFFECTS.length - 1, Math.floor(r * JETT_C1_EFFECTS.length))].id;
  }
  /* Ce que vaut la configuration tirée, effet par effet (null = cet effet n'existe pas). */
  function jettC1Damage(eff, config) {
    var e = jettC1Effect(config);
    if (!e || e.kind !== 'damage') return null;
    return e.stat === 'ap' ? dmgJettPoison(eff) : dmgJettForce(eff);
  }
  function jettC1Heal(eff, config) { return config === 'soin' ? healJettC1(eff) : null; }
  function jettC1Boon(eff, config) {
    if (config === 'bouclier') { var sh = shieldJettC1(eff); return { shield: sh, label: 'Bouclier de ' + sh }; }
    if (config === 'mana') {
      var p = Math.round(jettC1ManaPct(eff) * 10) / 10;
      return { manaPct: p, label: 'Mana : ' + String(p).replace('.', ',') + ' % de son mana max' };
    }
    return null;
  }

  /* C3 Surcharge destructrice (créée le 2026-10-10) : consomme les cellules (CN). Ennemis
     adjacents à une CN : 60 + 6 × niveau + 60 % AD, et Hémorragie 2 tours. Alliés adjacents :
     mana rendu = 20 % de LEUR mana max + 25 % AP. Une cible ne compte qu'une fois. */
  function dmgJettC3(eff, level) { return 60 + 6 * Math.max(1, level | 0) + pctOf(eff.ad, 60); }
  function jettC3Boon(eff) {
    var flat = pctOf(eff.ap, 25);
    return { manaPct: 20, manaFlat: flat, label: 'Mana : 20 % de son mana max + ' + flat };
  }

  /* C4 Nano-hex (créée le 2026-10-10) : un COMPAGNON. Ses stats ne dépendent PAS de celles de
     Jett mais du PLAFOND PAR CARAC de son niveau (`LEVELS[niveau].limit`, passé en `cap`) :
       PV = 40,5 × cap · AD = AP = 13,5 × cap · Armure = RM = 2 × cap · crit 5 % · dégâts crit 150 %.
     Chaque cellule consommée donne UN bonus au choix de Jett (`alloc = { id: nombre }`) ;
     les % portent sur la stat de BASE du Nano-hex (additifs entre cellules).
     Attaque : 12 + 72 % de son AD, chaque tour, peut criter. Rayon : 12 + 72 % de son AP PAR
     CIBLE, 1 tour sur 2, sans crit. (Valeurs déjà converties ×0,6.) */
  var NANOHEX_CN_OPTIONS = [
    { id: 'hp',     label: '+10 % PV' },
    { id: 'ad',     label: '+15 % AD' },
    { id: 'ap',     label: '+15 % AP' },
    { id: 'crit',   label: '+20 crit' },
    { id: 'dcrit',  label: '+20 dég. crit' },
    { id: 'armure', label: '+12 Armure' },
    { id: 'resmag', label: '+12 RM' },
  ];
  function allocTotal(alloc) {
    var n = 0;
    Object.keys(alloc || {}).forEach(function (k) { n += Math.max(0, alloc[k] | 0); });
    return n;
  }
  function nanoHexStats(cap, alloc) {
    cap = Math.max(0, Number(cap) || 0);
    var a = {};
    NANOHEX_CN_OPTIONS.forEach(function (o) { a[o.id] = Math.max(0, (alloc || {})[o.id] | 0); });
    var hp = Math.round(40.5 * cap * (1 + 0.10 * a.hp));
    var ad = Math.round(13.5 * cap * (1 + 0.15 * a.ad));
    var ap = Math.round(13.5 * cap * (1 + 0.15 * a.ap));
    return { hp: hp, ad: ad, ap: ap, armure: 2 * cap + 12 * a.armure, resmag: 2 * cap + 12 * a.resmag,
      crit: 5 + 20 * a.crit, dcrit: 150 + 20 * a.dcrit,
      attack: 12 + pctOf(ad, 72), ray: 12 + pctOf(ap, 72), cells: allocTotal(a) };
  }
  /* La fiche à poser comme PNJ allié (forme de `combat/enemies`). */
  function nanoHexSummon(cap, alloc) {
    var s = nanoHexStats(cap, alloc);
    return { name: 'Nano-hex', hpMax: s.hp, hpCur: s.hp, atk: s.attack, ray: s.ray, armure: s.armure, resmag: s.resmag,
      crit: s.crit, dcrit: s.dcrit,
      note: 'PV ' + s.hp + ' · AD ' + s.ad + ' · AP ' + s.ap + ' · Attaque ' + s.attack + ' (chaque tour, peut criter) · Rayon '
        + s.ray + ' par cible (magique, 1 tour sur 2, sans crit) · portée 2, 5 cases · joue au créneau de Jett · '
        + s.cells + ' CN' };
  }

  /* Stats avec lesquelles le Nano-hex FRAPPE (actions libres de Jett) : son critique à lui,
     ni léthalité ni vol de vie — rien de ce que porte Jett ne passe dans ses coups. */
  function nanoHexEff(nano) {
    nano = nano || {};
    return { crit: nano.crit | 0, dcrit: (nano.dcrit | 0) || 150, hp: nano.hpMax | 0,
      letha: 0, lethaMag: 0, vol: 0, sapience: 0, omni: 0, soins: 0, mana: 0 };
  }

  /* --- Rathael : Chair gelée, âme fendue ---
     C1 Frappe Irritée (rang 1 du 2026-10-10, NON convertie) =
       50 % AD × (1 + 0,01 × %PV manquants + 0,20 × charges).
     Plus de terme Armure+RM, plus de bonus fixe, plus de scaling par niveau : « fiable mais
     faible, modérée quand il est mal en point ». À froid elle fait MOINS qu'une attaque de
     base (0,5 contre 0,6), c'est voulu. charges = Glaciation (0..5). */
  function missingHpPct(hpCur, hpMax) {
    hpMax = Number(hpMax) || 0;
    if (hpCur == null || hpMax <= 0) return 0;
    return Math.max(0, Math.min(100, 100 * (1 - (Number(hpCur) || 0) / hpMax)));
  }
  function dmgRathaelC1(eff, charges, missingPct) {
    const ad = (eff && eff.ad) || 0;
    const miss = Math.max(0, Math.min(100, Number(missingPct) || 0));
    const mult = 1 + 0.01 * miss + 0.20 * Math.max(0, Math.min(5, charges | 0));
    return Math.floor(ad * 0.5 * mult + 1e-9);
  }

  /* C2 Mur de Givre : Armure/RM accordés = 15 + 5/2 niv (floor(niv/2)). Valeur unique pour AR et RM. */
  function rathaelC2Buff(level) { return 15 + 5 * Math.floor(Math.max(1, level | 0) / 2); }

  /* C3 Éclat de l'âme : dégâts magiques AoE qui consomment toutes les charges de Glaciation.
     base = 54 % AP + (45 % + 9 %/2 niv) (Armure+RM) — rang 1 du 2026-10-10 : bonus fixe retiré,
     puis conversion ×0,9 (exception MJ, pas ×0,6) ;
     chaque charge ajoute +50% de la base (max +250% à 5 charges → ×3,5). */
  function dmgRathaelC3(eff, charges, level) {
    const ap = (eff && eff.ap) || 0;
    const armure = (eff && eff.armure) || 0;
    const rm = (eff && eff.resmag) || 0;
    const lv = Math.max(1, level | 0);
    const base = pctOf(ap, 54) + pctOf(armure + rm, 45 + 9 * Math.floor(lv / 2));
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
     Elias (6 % de l'AD de BASE par charge) et Rathael (Armure/RM +10%/charge des stats de BASE). */
  function sumPassiveMods(charId, counters, level, base) {
    counters = counters || {};
    if (charId === 'lunick') { // Elias — Instinct du Chasseur
      // Charges plafonnées au max du NIVEAU : le plafond a baissé le 2026-10-10, un compteur
      // resté au-dessus en base ne doit pas donner plus que la règle.
      const stacks = Math.min(eliasMaxStacks(level), Math.max(0, counters.chasseur | 0));
      if (!stacks || !base) return {};
      const ad = eliasPassiveAD(base.ad, stacks);
      return ad ? { ad: ad } : {};
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

  /* Réordonne un inventaire (objet {id:item}) : déplace draggedId à la position de targetId
     (ou en fin si targetId est null). Trie par `item.order` (les items sans order gardent leur
     ordre d'insertion, placés à la suite), insère, puis réindexe 0..n-1. Retourne un patch
     {itemId: nouvelOrder} ne contenant QUE les items dont l'order a changé (pur, testé). */
  function reorderOrdVal(it) { return typeof it.order === 'number' ? it.order : Number.MAX_SAFE_INTEGER; }
  function planReorder(items, draggedId, targetId) {
    if (targetId === draggedId) return {};
    var arr = Object.values(items || {}).slice();
    arr.sort(function (a, b) { return reorderOrdVal(a) - reorderOrdVal(b); });
    var from = arr.findIndex(function (it) { return it.id === draggedId; });
    if (from < 0) return {};
    var moved = arr.splice(from, 1)[0];
    if (targetId == null) {
      arr.push(moved);
    } else {
      var to = arr.findIndex(function (it) { return it.id === targetId; });
      if (to < 0) arr.push(moved); else arr.splice(to, 0, moved);
    }
    var patch = {};
    arr.forEach(function (it, i) { if (it.order !== i) patch[it.id] = i; });
    return patch;
  }

  /* Disposition radiale (constellation) de l'arbre de runes : les familles rayonnent d'un cœur
     central, chaque famille sur un secteur de 360/n, ses voies en éventail, chaque voie = une
     chaîne de nœuds du centre vers le bord (mineure proche → fondamentale sur la jante). Pur.
     Retourne { size, center, ring, families:[{ key,name,color,theme, core:{x,y},
       nodes:[{id,tier,name,x,y}], segments:[{x1,y1,x2,y2,outerId}] }] }.
     `outerId` = id du nœud extérieur dont la sélection illumine le segment (faisceau centre→rune). */
  function runeRadialLayout(families, opts) {
    opts = opts || {};
    var size = opts.size || 1000;
    var c = size / 2;
    var ring = opts.ring || 165;                       // anneau central (cœurs de famille)
    var radii = opts.radii || [305, 405, 470];         // mineure / avancée / fondamentale
    var spread = (opts.pathSpreadDeg != null ? opts.pathSpreadDeg : 21) * Math.PI / 180;
    var start = (opts.startDeg != null ? opts.startDeg : -90) * Math.PI / 180;
    var n = families.length || 1;
    var out = { size: size, center: c, ring: ring, families: [] };
    families.forEach(function (fam, fi) {
      var base = start + (2 * Math.PI) * (fi / n);
      var core = { x: c + ring * Math.cos(base), y: c + ring * Math.sin(base) };
      var nodes = [], segments = [];
      (fam.paths || []).forEach(function (p, pi) {
        var ang = base + (pi - 1) * spread;            // -spread, 0, +spread
        var prev = core;
        (p.nodes || []).forEach(function (node, ti) {
          var r = radii[ti] != null ? radii[ti] : radii[radii.length - 1];
          var pt = { x: c + r * Math.cos(ang), y: c + r * Math.sin(ang) };
          nodes.push({ id: node.id, tier: node.tier, name: node.name, x: pt.x, y: pt.y });
          segments.push({ x1: prev.x, y1: prev.y, x2: pt.x, y2: pt.y, outerId: node.id });
          prev = pt;
        });
      });
      out.families.push({ key: fam.key, name: fam.name, color: fam.color, theme: fam.theme,
        core: core, nodes: nodes, segments: segments });
    });
    return out;
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

  /* --- Escalade anti-aplatissement (recalibrée 2026-09-05, décision B) ---
     Facteur cumulé par caractéristique. Escalade LOCALE : chaque point placé dans une
     caractéristique en relève le rendement de +1 %, soit `p × (1 + 0,010·(p−1))`.
     ⚠️ Elle est volontairement PLUS PLATE qu'avant (~+2,3 %/pt, table §4.3) : l'ancienne
     donnait +15 % à un build 2 caracs contre un build 3 caracs, ce qui poussait
     mécaniquement vers des répartitions pures et cassait le calibrage dès qu'un joueur
     optimisait. Ce qu'elle perd est rendu par `globalEscalation` (ci-dessous), si bien
     que le TOTAL au niveau 18 en 20/14 est resté identique (46.2) — ne pas remonter
     l'une sans baisser l'autre.
     Au-delà de 20 (zone PNJ §8) : le mult marginal repart de celui du 20e point (1.38)
     et gagne 0,5 par point → croissance quadratique conservée pour les gros monstres.
     Voir docs/superpowers/specs/2026-09-05-calibrage-attaques-base-design.md §3. */
  var ESC_PER_POINT = 0.010;   // escalade locale : +1 % de rendement par point placé
  var ESC_CAP = 20;            // au-delà, zone PNJ
  function escalationFactor(points) {
    points = Math.max(0, points | 0);
    if (points <= ESC_CAP) return points * (1 + ESC_PER_POINT * (points - 1));
    var f = ESC_CAP * (1 + ESC_PER_POINT * (ESC_CAP - 1));
    var marginal = f - (ESC_CAP - 1) * (1 + ESC_PER_POINT * (ESC_CAP - 2));
    for (var k = 1; k <= points - ESC_CAP; k++) f += marginal + 0.5 * k;
    return f;
  }

  /* --- Escalade GLOBALE (2026-09-05, décision B) ---
     Chaque point placé, quelle que soit sa caractéristique, relève très légèrement le
     rendement de TOUS les points déjà placés (+0,49 %). C'est ce qui compense l'escalade
     locale réduite sans réintroduire de prime à la concentration : la prime d'un build
     2 caracs sur un build 3 caracs tombe de 15 % à 6 %.
     ⚠️ `total` = somme des 4 caractéristiques. Comme un joueur place toujours TOUS ses
     points, il vaut en pratique le budget de son niveau : cette fonction est donc
     mathématiquement équivalente à un multiplicateur de niveau. Ne pas promettre aux
     joueurs qu'un point de Force « boostera leur Magie » — ils verront simplement leurs
     stats monter un peu à chaque niveau. */
  var GLOBAL_ESC_PER_POINT = 0.0049;
  function globalEscalation(total) {
    return 1 + GLOBAL_ESC_PER_POINT * Math.max(0, total | 0);
  }

  /* Bonus de départ d'Habileté : PV dégressifs sur les 5 premiers points (25/20/15/10/5),
     soit 75 PV au plafond. Table CUMULÉE, indexée par min(H,5).
     ⚠️ L'Habileté ne donne plus d'armure ni de rés. magique (refonte 2026-09-04). */
  var HAB_START_HP = [0, 25, 45, 60, 70, 75];

  /* --- Répartition de l'Habileté : AD / AP / Mana (refonte 2026-09-04) ---
     Chaque point d'Habileté donne, au choix du joueur (onglet Progression),
     **+5 AD**, **+5 AP** ou **+10 Mana**. Stocké dans `state.habSplit` = nombre de
     points par destination `{ad, ap, mana}`.
     ⚠️ **L'ESCALADE EST GARANTIE À CHAQUE POINT** (ruling MJ, 2026-09-04) : le facteur
     est calculé sur le TOTAL d'Habileté puis distribué au prorata, si bien qu'un point
     vaut autant où qu'il aille. **Répartir ne coûte donc RIEN** — c'est délibéré, le MJ
     veut encourager des répartitions personnelles. ⚠️ Ne PAS revenir à une escalade
     appliquée à chaque part séparément (une version intermédiaire le faisait) : ça
     pénalisait l'hybridation de ~20 % à 20 points, exactement l'inverse de l'intention.
     ⚠️ Défaut quand rien n'est enregistré : tout du côté de la carac de dégâts
     dominante (Force ≥ Magie → AD, sinon AP). C'est ce qui donne une valeur juste aux
     5 PJ existants **sans migration de données** — Jett (F1/C4) part en AP, les quatre
     autres en AD. Ce n'est qu'un défaut : le joueur le change quand il veut, et tant
     qu'il n'a rien confirmé la page Progression ne lui oppose aucun plancher. */
  var HAB_DESTS = ['ad', 'ap', 'mana'];
  function defaultHabSplit(F, H, C) {
    H = Math.max(0, H | 0);
    return (F | 0) >= (C | 0) ? { ad: H, ap: 0, mana: 0 } : { ad: 0, ap: H, mana: 0 };
  }
  /* Normalise une répartition stockée. `split` accepte aussi l'ancienne forme
     `{ad}` seule (compat : le champ `habAd` d'une version antérieure d'un jour).
     ⚠️ Sur-allocation : on sert les destinations dans l'ordre ad → ap → mana et on
     coupe au budget. Sous-allocation (le joueur a gagné un niveau et n'a pas encore
     placé son point) : le RELIQUAT PART SUR LA DESTINATION PAR DÉFAUT plutôt que
     d'être perdu — un point non placé qui ne rendrait rien serait un vol silencieux. */
  function habSplit(F, H, C, split) {
    H = Math.max(0, H | 0);
    if (split == null) return defaultHabSplit(F, H, C);
    var out = { ad: 0, ap: 0, mana: 0 }, left = H;
    for (var i = 0; i < HAB_DESTS.length; i++) {
      var k = HAB_DESTS[i];
      var n = Math.max(0, Math.min(left, split[k] | 0));
      out[k] = n; left -= n;
    }
    if (left > 0) {
      var d = defaultHabSplit(F, left, C);
      out.ad += d.ad; out.ap += d.ap; out.mana += d.mana;
    }
    return out;
  }

  /* --- Répartition du Mental : PV / Mana (2026-09-05, décision D) ---
     Chaque point de Mental donne un SOCLE garanti de 45 PV + 15 Mana, plus **15 points
     dirigés** au choix du joueur : soit +15 PV, soit +15 Mana. Stocké dans
     `state.mentalSplit` = nombre de points par destination `{hp, mana}`.
     Tout en PV → 60 PV + 15 Mana ; tout en Mana → 45 PV + 30 Mana.
     ⚠️ Le total par point passe de 80 (60 PV + 20 Mana) à 75 : la flexibilité se paie
     de 5 points de Mana. Volontaire (décision MJ) — ne pas « rattraper » le socle.
     ⚠️ Même ruling que l'Habileté : l'escalade est distribuée AU PRORATA du total, donc
     un point vaut autant où qu'il aille et répartir ne coûte rien.
     ⚠️ `mentalSplit` absent = jamais confirmé → défaut TOUT EN PV. C'est ce qui garantit
     que les PV des personnages existants ne bougent pas d'un point (45 + 15 = 60, l'ancien
     coefficient) et que la matrice de TTK figée le 2026-09-05 reste valide. Seul le Mana
     baisse. Ne pas changer ce défaut sans re-vérifier la matrice. */
  var MENTAL_DESTS = ['hp', 'mana'];
  var MENTAL_BASE_HP = 45, MENTAL_BASE_MANA = 15, MENTAL_DIRECTED = 15;
  function defaultMentalSplit(M) {
    return { hp: Math.max(0, M | 0), mana: 0 };
  }
  /* Normalise une répartition stockée. Sur-allocation : servie dans l'ordre hp → mana,
     coupée au budget. Sous-allocation : le reliquat part sur le défaut (PV), jamais perdu. */
  function mentalSplit(M, split) {
    M = Math.max(0, M | 0);
    if (split == null) return defaultMentalSplit(M);
    var out = { hp: 0, mana: 0 }, left = M;
    for (var i = 0; i < MENTAL_DESTS.length; i++) {
      var k = MENTAL_DESTS[i];
      var n = Math.max(0, Math.min(left, split[k] | 0));
      out[k] = n; left -= n;
    }
    if (left > 0) out.hp += left;
    return out;
  }

  /* --- Répartition de la Force et de la Magie : dégâts / défense (2026-09-06) ---
     Les deux caracs sont en MIROIR, décision MJ :
       Force : socle garanti 15 AD + 1 Armure (+ 20 PV, 5 Mana), puis chaque point
               dirige **+10 AD** OU **+2 Armure**.
       Magie : socle garanti 15 AP + 1 Rés.Mag (+ 10 PV, 30 Mana), puis chaque point
               dirige **+10 AP** OU **+2 Rés.Mag**.
     Tout en dégâts → 25 AD/AP et 1 AR/RM ; tout en défense → 15 AD/AP et 3 AR/RM.
     ⚠️ Les deux destinations n'ont PAS le même taux (10 contre 2) : c'est voulu, une
     unité d'armure vaut bien plus qu'une unité d'AD (réduction en AR/(AR+120)).
     ⚠️ Même ruling que l'Habileté et le Mental : l'escalade est distribuée AU PRORATA
     du total, donc un point vaut autant où qu'il aille et répartir ne coûte rien.
     ⚠️ **CONTRAIRE au Mental (décision D), AUCUNE répartition ne reproduit l'ancien
     coefficient** : avant, un point de Force donnait 25 AD **et** 2 Armure. Le défaut
     tout-dégâts garde les 25 AD (donc la matrice de TTK du 2026-09-05, bâtie sur l'AD,
     reste valide) mais **fait tomber l'armure de 2 à 1 par point**. C'est le prix du
     choix : la défense doit désormais être payée. Un profil qui veut son armure d'avant
     place la moitié de ses points en défense (2 AR/pt, mais 20 AD au lieu de 25).
     ⚠️ Absent = jamais confirmé → défaut **tout en dégâts** (AD pour la Force, AP pour
     la Magie) : c'est le seul défaut qui préserve la puissance offensive des 5 PJ sans
     migration. Ne pas le changer sans re-vérifier la matrice de TTK. */
  var FORCE_DESTS = ['ad', 'armure'];
  var FORCE_BASE_AD = 15, FORCE_BASE_AR = 1;
  var FORCE_DIRECTED = { ad: 10, armure: 2 };
  var MAGIE_DESTS = ['ap', 'resmag'];
  var MAGIE_BASE_AP = 15, MAGIE_BASE_RM = 1;
  var MAGIE_DIRECTED = { ap: 10, resmag: 2 };
  /* Socle d'armure et de résistance magique accordé à TOUT LE MONDE dès le niveau 1
     (patch de durabilité, décision MJ du 2026-09-09). Gain mécanique réel : +3,3 à
     +4,0 % d'EHP seulement, uniforme sur toute la campagne — la mitigation ne peut pas
     faire plus avec une constante de 120 face aux 6-9 d'armure d'un PJ niveau 2.
     ⚠️ La raison de ce patch est de LECTURE, pas d'arithmétique : « 2 de Rés. Mag » se
     lit comme une passoire sur une fiche, « 7 » apaise. Ne pas le monter en croyant
     corriger l'encaissement à bas niveau — ça ne marche pas par ce levier (les PV et
     les armures d'équipement profil PV, si). Et attention, l'augmenter DIMINUE la
     valeur marginale de chaque point d'armure d'objet (elle vaut PV/(AR+120)).
     Aucune migration : armure et resmag sont calculées en live, jamais stockées. */
  var BASE_AR_RM = 5;
  function defaultForceSplit(F) { return { ad: Math.max(0, F | 0), armure: 0 }; }
  function defaultMagieSplit(C) { return { ap: Math.max(0, C | 0), resmag: 0 }; }
  /* Normalisent une répartition stockée, même contrat que habSplit/mentalSplit :
     sur-allocation servie dans l'ordre des DESTS puis coupée au budget ; sous-allocation
     reversée sur le défaut (dégâts), jamais perdue. */
  function forceSplit(F, split) {
    F = Math.max(0, F | 0);
    if (split == null) return defaultForceSplit(F);
    var out = { ad: 0, armure: 0 }, left = F;
    for (var i = 0; i < FORCE_DESTS.length; i++) {
      var k = FORCE_DESTS[i];
      var n = Math.max(0, Math.min(left, split[k] | 0));
      out[k] = n; left -= n;
    }
    if (left > 0) out.ad += left;
    return out;
  }
  function magieSplit(C, split) {
    C = Math.max(0, C | 0);
    if (split == null) return defaultMagieSplit(C);
    var out = { ap: 0, resmag: 0 }, left = C;
    for (var i = 0; i < MAGIE_DESTS.length; i++) {
      var k = MAGIE_DESTS[i];
      var n = Math.max(0, Math.min(left, split[k] | 0));
      out[k] = n; left -= n;
    }
    if (left > 0) out.ap += left;
    return out;
  }

  /* --- Moteur de stats refondu (info-mj/SPECIFICATION, révisé 2026-09-04) ---
     9 stats dérivées de 4 caracs + niveau. Magnitude escaladée, POURCENTAGES LINÉAIRES.
     ⚠️ Cette asymétrie est volontaire : `escalationFactor` ne s'applique qu'aux grandeurs
     de magnitude (PV/Mana/AD/AP/AR/RM). Le crit, les dégâts crit et la résistance critique
     se calculent sur les points BRUTS — les escalader ferait exploser des pourcentages
     (3 %/pt de Mental donnerait 86 % de rés. crit à 20 points au lieu de 60 %).
     ⚠️ RÈGLE MJ (2026-08-17, figée) : la léthalité (letha/lethaMag) et les soins liés
     aux dégâts (vol de vie, sapience, omnivamp) ne dérivent JAMAIS des caractéristiques.
     Elles viennent exclusivement de l'équipement, des runes et des modificateurs — ne
     pas les ajouter ici. C'est aussi pour ça que la Sapience a été retirée du socle.
     Répartition (2026-09-04) — par point :
       Force     20 PV,  5 Mana, 25 AD, 2 Armure
       Habileté  bonus de départ (table ci-dessus), au choix par point +5 AD **OU**
                 +5 AP **OU** +10 Mana (cf. habSplit), 2,5 %Crit, 4 %D.Crit
       Mental    45 PV + 15 Mana garantis, puis 15 points AU CHOIX (+15 PV **OU**
                 +15 Mana, cf. mentalSplit), 3 %Rés.Crit
       Magie     10 PV, 30 Mana, 25 AP, 2 Rés. Magique
     La Force et la Magie ne donnent plus de dégâts crit ; le Mental ne donne plus ni
     crit, ni AD/AP.
     ⚠️ Crit RECALIBRÉ le 2026-09-05 (décision C) : `5 + 2,5·H` / `150 + 4·H` au lieu de
     `5 + 10·H` / `150 + 6·H`. Les deux se MULTIPLIANT, l'ancienne paire valait ×3,23 de
     dégâts moyens à 20 d'Habileté contre ×1,02 sans Habileté — un multiplicateur de
     puissance déguisé en aléa, qui faisait qu'Urskaar avait le meilleur AD du jeu au
     niveau 18 en infligeant le moins de dégâts réels. La nouvelle paire plafonne à
     ×1,71 (coup critique ×2,30). Conséquence assumée : le surcrit (§6.3, seuil 100 %)
     n'est plus atteignable par les caracs seules — il passe par l'équipement et les runes.
     `hab` (6e param, optionnel) = répartition `{ad, ap, mana}` des points d'Habileté ;
     absent → défaut par carac dominante (voir `habSplit`). Crit, dégâts crit et bonus
     de PV de départ restent calculés sur le TOTAL d'Habileté : seule la valeur
     « dirigeable » (attaque / mana) est répartie. */
  function computeStats(F, H, M, C, level, hab, ment, force, magie) {
    F = Math.max(0, F | 0); H = Math.max(0, H | 0);
    M = Math.max(0, M | 0); C = Math.max(0, C | 0);
    level = Math.max(1, level | 0);
    // Escalade globale (2026-09-05) : facteur commun tiré du TOTAL de points placés.
    // Il multiplie les 4 magnitudes escaladées — jamais les pourcentages (voir ci-dessus).
    var g = globalEscalation(F + H + M + C);
    // eH n'existe plus : l'Habileté escalade PAR PART (AD / AP), pas en bloc.
    var eF = escalationFactor(F) * g, eM = escalationFactor(M) * g, eC = escalationFactor(C) * g;
    var habPV = HAB_START_HP[Math.min(H, 5)];  // bonus de départ Habileté plafonné
    var fondu = Math.max(0, 20 - 4 * (F + C)); // frappe de base des profils sans dégâts
    var hs = habSplit(F, H, C, hab);           // points d'Habileté dirigés AD / AP / Mana
    // Escalade GARANTIE À CHAQUE POINT : facteur moyen du total, appliqué au prorata.
    // Un point vaut donc pareil où qu'il aille, et répartir ne coûte rien.
    var hUnit = H > 0 ? escalationFactor(H) * g / H : 0;
    var ms = mentalSplit(M, ment);             // points de Mental dirigés PV / Mana
    var mUnit = M > 0 ? escalationFactor(M) * g / M : 0;
    var fs = forceSplit(F, force);             // points de Force dirigés AD / Armure
    var fUnit = F > 0 ? escalationFactor(F) * g / F : 0;
    var cs = magieSplit(C, magie);             // points de Magie dirigés AP / Rés.Mag
    var cUnit = C > 0 ? escalationFactor(C) * g / C : 0;
    return {
      hp:      Math.round(50 + 30 * level + 20 * eF + 10 * eC
                 + MENTAL_BASE_HP * eM + MENTAL_DIRECTED * mUnit * ms.hp + habPV),
      mana:    Math.round(50 + 15 * level + 5 * eF + 30 * eC
                 + MENTAL_BASE_MANA * eM + MENTAL_DIRECTED * mUnit * ms.mana
                 + 10 * hUnit * hs.mana),
      ad:      Math.round(FORCE_BASE_AD * eF + FORCE_DIRECTED.ad * fUnit * fs.ad
                 + 5 * hUnit * hs.ad + fondu),
      ap:      Math.round(MAGIE_BASE_AP * eC + MAGIE_DIRECTED.ap * cUnit * cs.ap
                 + 5 * hUnit * hs.ap + fondu),
      armure:  Math.round(BASE_AR_RM + level + FORCE_BASE_AR * eF + FORCE_DIRECTED.armure * fUnit * fs.armure),
      resmag:  Math.round(BASE_AR_RM + level + MAGIE_BASE_RM * eC + MAGIE_DIRECTED.resmag * cUnit * cs.resmag),
      crit:    5 + 2.5 * H,
      dcrit:   150 + 4 * H,
      rescrit: 3 * M,
    };
  }

  /* Assistant de génération des stats d'un PNJ depuis ses 4 caractéristiques.
     ⚠️ C'est un ASSISTANT, pas un modèle dérivé : il renvoie un patch de valeurs PLATES
     que le MJ écrit dans les champs de l'ennemi, lesquels restent la source de vérité.
     Ne PAS transformer ça en calcul live — `applySubir` et `applyHitToEnemy` écrivent
     `hpCur` en direct, un max recalculé à la lecture entrerait en conflit avec les
     dégâts déjà encaissés. Le MJ garde donc le droit de faire un monstre qui n'obéit
     à aucune arithmétique de PJ : il génère, puis il corrige à la main.
     `escalationFactor` gère déjà la zone PNJ au-delà de 20 points (croissance
     quadratique, §8 de la spec hypermétrique) : les gros monstres sont prévus.
     L'ennemi n'a qu'un champ `atk` : on y met la plus élevée de AD/AP. */
  function npcStatsFromAttrs(attrs, level) {
    attrs = attrs || {};
    var s = computeStats(attrs.force, attrs.hab, attrs.mental, attrs.magie, level,
      attrs.habSplit, attrs.mentalSplit, attrs.forceSplit, attrs.magieSplit);
    return {
      hpMax: s.hp, hpCur: s.hp,
      manaMax: s.mana, manaCur: s.mana,
      atk: Math.max(s.ad, s.ap),
      armure: s.armure, resmag: s.resmag,
      crit: s.crit, dcrit: s.dcrit, rescrit: s.rescrit,
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
    // Répartition de l'Habileté : `state.habSplit` si le joueur l'a confirmée, sinon
    // `char.habSplit`, sinon le défaut par carac dominante (habSplit).
    // Compat : `state.habAd` (forme d'un jour, AD seul) est encore relu.
    var hs = (state && state.habSplit) || (char && char.habSplit) || null;
    if (!hs && state && state.habAd != null) hs = { ad: state.habAd };
    // Répartition du Mental (PV/Mana) : même contrat. Absente → défaut tout en PV.
    var ms = (state && state.mentalSplit) || (char && char.mentalSplit) || null;
    // Répartitions Force (AD/Armure) et Magie (AP/Rés.Mag) : même contrat.
    // Absentes → défaut tout en dégâts (forceSplit/magieSplit).
    var fsp = (state && state.forceSplit) || (char && char.forceSplit) || null;
    var csp = (state && state.magieSplit) || (char && char.magieSplit) || null;
    return computeStats(a.force, a.hab, a.mental, a.magie, level, hs, ms, fsp, csp);
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

  /* ============================================================
     BESTIAIRE — dimensionnement des ennemis et PNJ (2026-10-11)
     Spec : docs/superpowers/specs/2026-10-11-bestiaire-design.md
     Tout se mesure contre un PJ DE RÉFÉRENCE du même niveau : la moyenne des 5 profils
     de la campagne, NUS (ni équipement, ni runes, ni buffs — décision MJ).
     ⚠️ Comme `npcStatsFromAttrs`, ces fonctions SUGGÈRENT : les champs de la fiche du
     monstre restent la source de vérité, le MJ corrige ce qu'il veut.
     ============================================================ */

  /* ⚠️ COPIE de `LEVELS` (data.jsx) : budget = `total` + CREATION_BONUS, cap = `limit`.
     game-logic ne lit pas data.jsx (logique pure) — à resynchroniser si LEVELS bouge. */
  var NPC_POINT_BUDGET = [8, 10, 11, 12, 13, 15, 16, 18, 19, 21, 23, 25, 26, 28, 30, 32, 33, 34];
  var NPC_POINT_CAP    = [5, 6, 7, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 20];
  /* Au-delà de 18 (« endgame ») : pente moyenne de LEVELS (~1,5 point par niveau), le plafond
     suit ; `escalationFactor` gère déjà la zone PNJ au-delà de 20 points. */
  function npcPointBudget(level) {
    level = Math.max(1, level | 0);
    if (level <= NPC_POINT_BUDGET.length) return { budget: NPC_POINT_BUDGET[level - 1], cap: NPC_POINT_CAP[level - 1] };
    var b = Math.round(34 + 1.5 * (level - 18));
    return { budget: b, cap: Math.max(20, Math.round(b / 1.7)) };
  }

  /* Les 5 profils de la campagne [Force, Habileté, Mental, Magie] : seules les PROPORTIONS
     comptent, elles sont étirées au budget du niveau. */
  var NPC_REF_PROFILES = [
    { id: 'rathael', attrs: [4, 3, 4, 1] },
    { id: 'urskaar', attrs: [6, 1, 5, 0] },
    { id: 'smith',   attrs: [3, 6, 1, 2] },
    { id: 'lunick',  attrs: [5, 4, 3, 0] },
    { id: 'jett',    attrs: [1, 6, 1, 4] },
  ];
  /* Étire un profil à `budget` points (plus fort reste, plafond `cap` par carac). Une carac
     à 0 dans le profil reste à 0. */
  function npcScaleProfile(attrs, budget, cap) {
    var sum = 0, i;
    for (i = 0; i < 4; i++) sum += attrs[i];
    var out = [0, 0, 0, 0], rest = [];
    if (sum <= 0) return out;
    for (i = 0; i < 4; i++) {
      var exact = attrs[i] * budget / sum;
      out[i] = Math.min(cap, Math.floor(exact));
      rest.push({ i: i, r: exact - Math.floor(exact) });
    }
    rest.sort(function (a, b) { return b.r - a.r || a.i - b.i; });
    var left = budget - (out[0] + out[1] + out[2] + out[3]);
    for (var guard = 0; left > 0 && guard < 400; guard++) {
      var k = rest[guard % 4].i;
      if (attrs[k] > 0 && out[k] < cap) { out[k]++; left--; }
    }
    return out;
  }

  /* Multiplicateur moyen d'un coup, critique compris (sans les paliers de surcrit). */
  function critAverage(critPct, dcritPct) {
    var c = Math.max(0, Math.min(100, Number(critPct) || 0)) / 100;
    var d = Math.max(100, Number(dcritPct) || 100) / 100;
    return 1 + c * (d - 1);
  }

  /* Dégâts qu'un PJ sort par round, en multiples de sa stat d'attaque (hors critique).
     Un PJ joue chaque tour attaque de base (0,6) + C1 + C2 ou C3 ; les C4 (1×/jour) sont
     hors compte. Moyenne des 5 kits au rang 1 (2026-10-10) pondérés par leurs délais :
     Elias ~2,1 · Smith ~2,4 · Urskaar ~2,0 · Rathäel ~1,75 · Jett ~0,85 (soutien).
     ⚠️ À recaler si les kits changent (lot G des compétences : rangs 2 à 5). */
  var REF_ROUND_RATIO = 1.8;

  /* PV effectifs : moyenne des PV effectifs physiques et magiques (mitigation AR/(AR+K)). */
  function npcEhpFactor(armure, resmag) {
    var a = Math.max(0, Number(armure) || 0), r = Math.max(0, Number(resmag) || 0);
    return ((MITIGATION_K + a) / MITIGATION_K + (MITIGATION_K + r) / MITIGATION_K) / 2;
  }
  function npcEhp(stats) {
    stats = stats || {};
    return Math.max(0, Number(stats.hpMax != null ? stats.hpMax : stats.hp) || 0) * npcEhpFactor(stats.armure, stats.resmag);
  }

  var REF_PLAYER_CACHE = {};
  function refPlayer(level) {
    level = Math.max(1, level | 0);
    if (REF_PLAYER_CACHE[level]) return REF_PLAYER_CACHE[level];
    var pb = npcPointBudget(level), n = NPC_REF_PROFILES.length;
    var acc = { hp: 0, atk: 0, armure: 0, resmag: 0, crit: 0, dcrit: 0, rescrit: 0, hit: 0 };
    NPC_REF_PROFILES.forEach(function (p) {
      var a = npcScaleProfile(p.attrs, pb.budget, pb.cap);
      var s = computeStats(a[0], a[1], a[2], a[3], level);
      var atk = Math.max(s.ad, s.ap);
      acc.hp += s.hp; acc.atk += atk; acc.armure += s.armure; acc.resmag += s.resmag;
      acc.crit += s.crit; acc.dcrit += s.dcrit; acc.rescrit += s.rescrit;
      acc.hit += atk * critAverage(s.crit, s.dcrit);
    });
    var r = { level: level };
    Object.keys(acc).forEach(function (k) { r[k] = acc[k] / n; });
    r.hpMax = r.hp;
    r.ehp = npcEhp(r);
    r.roundDmg = REF_ROUND_RATIO * r.hit;            // dégâts AFFICHÉS par round, crit moyen compris
    delete r.hit;
    REF_PLAYER_CACHE[level] = r;
    return r;
  }

  /* --- Rangs ---
     Puissance = PV effectifs × dégâts par round, rapportés au référentiel. Un monstre de
     puissance n vaut n standards tués l'un après l'autre : il a leurs PV cumulés et leurs
     dégâts MOYENS pendant qu'ils tombent. ⚠️ Doubler PV et dégâts ne double pas la puissance. */
  /* `tilt` = position PAR DÉFAUT du curseur endurance ↔ violence (décision MJ du 2026-10-11,
     réglage « intermédiaire ») : standard PV ×1,5, élite ×2, boss ×3 — soit ~5, 7 et 10 rounds
     pour une rencontre dure dans le simulateur, qui ignore soins et contrôles. Microbe et
     sbire restent neutres. */
  var NPC_RANKS = [
    { id: 'microbe',  label: 'Microbe',  power: 0.1, tilt: 0 },
    { id: 'sbire',    label: 'Sbire',    power: 0.5, tilt: 0 },
    { id: 'standard', label: 'Standard', power: 1,   tilt: 58 },
    { id: 'elite',    label: 'Élite',    power: 2,   tilt: 100 },
    { id: 'boss',     label: 'Boss',     power: 5,   tilt: 158 },
  ];
  function npcRank(id) {
    for (var i = 0; i < NPC_RANKS.length; i++) if (NPC_RANKS[i].id === id) return NPC_RANKS[i];
    return NPC_RANKS[2];
  }
  function npcPowerMults(n) {
    n = Math.max(0, Number(n) || 0);
    return n >= 1 ? { hp: n, dmg: (n + 1) / 2 } : { hp: n, dmg: 2 * n / (1 + n) };
  }
  function npcPowerProduct(n) { var m = npcPowerMults(n); return m.hp * m.dmg; }
  /* Réciproque : la puissance n dont le produit PV × dégâts vaut P. */
  function npcPowerFromProduct(P) {
    P = Math.max(0, Number(P) || 0);
    return P >= 1 ? (-1 + Math.sqrt(1 + 8 * P)) / 2 : (P + Math.sqrt(P * P + 8 * P)) / 4;
  }
  /* Rang le plus proche d'une puissance (échelle logarithmique). */
  function npcRankForPower(n) {
    n = Math.max(1e-6, Number(n) || 0);
    var best = NPC_RANKS[0], bd = Infinity;
    NPC_RANKS.forEach(function (r) { var d = Math.abs(Math.log(n / r.power)); if (d < bd) { bd = d; best = r; } });
    return best;
  }

  /* --- Archétypes : DÉPLACENT le budget (hp × dmg ≈ 1, sauf les soutiens dont le reste est
     en effets non chiffrés). `hp` s'entend en PV EFFECTIFS : un monstre plus armuré paie ses
     résistances en PV bruts. `ar`/`rm`/`crit`/`rescrit` = multiples du référentiel.
     `main` = stat d'attaque ; `tpl` = gabarit d'attaques (NPC_ATTACK_TEMPLATES). */
  var NPC_ARCHETYPES = [
    { id: 'bruiser',   label: 'Bruiser',           hp: 1,   dmg: 1,    main: 'ad', ar: 1,   rm: 1,   crit: 1,    rescrit: 1,   tpl: 'std' },
    { id: 'tank_phys', label: 'Tank physique',     hp: 1.4, dmg: 0.7,  main: 'ad', ar: 3,   rm: 1,   crit: 0.5,  rescrit: 1.5, tpl: 'std' },
    { id: 'tank_mag',  label: 'Tank magique',      hp: 1.4, dmg: 0.7,  main: 'ad', ar: 1,   rm: 3,   crit: 0.5,  rescrit: 1.5, tpl: 'std' },
    { id: 'colosse',   label: 'Colosse',           hp: 1.4, dmg: 0.7,  main: 'ad', ar: 1,   rm: 1,   crit: 0.5,  rescrit: 1,   tpl: 'std' },
    { id: 'assassin',  label: 'Assassin',          hp: 0.7, dmg: 1.4,  main: 'ad', ar: 0.6, rm: 0.6, crit: 2,    rescrit: 0.5, tpl: 'burst' },
    { id: 'tireur',    label: 'Tireur (carry AD)', hp: 0.8, dmg: 1.25, main: 'ad', ar: 0.7, rm: 0.7, crit: 1.75, rescrit: 0.5, tpl: 'std' },
    { id: 'mage',      label: 'Mage (burst)',      hp: 0.8, dmg: 1.25, main: 'ap', ar: 0.7, rm: 1.5, crit: 0.5,  rescrit: 0.5, tpl: 'mage' },
    { id: 'mage_zone', label: 'Mage de zone',      hp: 0.8, dmg: 1.25, main: 'ap', ar: 0.7, rm: 1.5, crit: 0.5,  rescrit: 0.5, tpl: 'zone' },
    { id: 'soutien_fragile',   label: 'Soutien fragile',   hp: 0.7, dmg: 0.6, main: 'ap', ar: 0.7, rm: 1,   crit: 0.5, rescrit: 0.5, tpl: 'soutien' },
    { id: 'soutien_resistant', label: 'Soutien résistant', hp: 1.2, dmg: 0.5, main: 'ap', ar: 1.2, rm: 1.2, crit: 0.5, rescrit: 1,   tpl: 'soutien' },
  ];
  function npcArchetype(id) {
    for (var i = 0; i < NPC_ARCHETYPES.length; i++) if (NPC_ARCHETYPES[i].id === id) return NPC_ARCHETYPES[i];
    return NPC_ARCHETYPES[0];
  }

  /* Curseur endurance ↔ violence : à PUISSANCE CONSTANTE, échange des dégâts contre des PV.
     tilt ∈ [−200, +300] ; +100 = PV ×2 et dégâts ÷2, +200 = ×4 et ÷4, −100 l'inverse, 0 = neutre.
     C'est le levier de DURÉE des combats : mesuré le 2026-10-11 (sim-bestiaire.js), une
     rencontre « dure » dure ~4 rounds à 0, ~7 à +100, ~10 à +158 (×3), ~13 à +200 (×4),
     pour la MÊME usure du groupe (spec §10). */
  function npcTiltFactor(tilt) {
    var t = Math.max(-200, Math.min(300, Number(tilt) || 0));
    return Math.pow(2, t / 100);
  }

  /* Dégâts affichés par round que sortent des stats données, sans connaître les attaques. */
  function npcRoundDmgFromStats(stats) {
    stats = stats || {};
    var atk = Math.max(Number(stats.ad) || 0, Number(stats.ap) || 0, 0);
    return REF_ROUND_RATIO * atk * critAverage(stats.crit, stats.dcrit);
  }

  /* Stats SUGGÉRÉES d'un monstre. `roundDmg` = son budget de dégâts affichés par round
     (crit moyen compris), à répartir entre attaque de base et compétences. */
  function npcSuggestStats(level, rankId, archetypeId, tilt) {
    var ref = refPlayer(level), rk = npcRank(rankId), ar = npcArchetype(archetypeId);
    var m = npcPowerMults(rk.power), k = npcTiltFactor(tilt);
    var armure = Math.round(ref.armure * ar.ar), resmag = Math.round(ref.resmag * ar.rm);
    var hpMax = Math.max(1, Math.round(ref.ehp * m.hp * ar.hp * k / npcEhpFactor(armure, resmag)));
    var crit = Math.round(ref.crit * ar.crit), dcrit = Math.round(ref.dcrit);
    var roundDmg = ref.roundDmg * m.dmg * ar.dmg / k;
    var stat = Math.max(1, Math.round(roundDmg / (REF_ROUND_RATIO * critAverage(crit, dcrit))));
    return {
      hpMax: hpMax,
      ad: ar.main === 'ad' ? stat : 0, ap: ar.main === 'ap' ? stat : 0,
      armure: armure, resmag: resmag,
      crit: crit, dcrit: dcrit, rescrit: Math.round(ref.rescrit * ar.rescrit),
      lethaAD: 0, lethaAP: 0,
      roundDmg: Math.round(roundDmg),
    };
  }

  /* Puissance RÉELLE de stats (éventuellement retouchées à la main), au niveau donné.
     `roundDmg` optionnel = dégâts par round réellement posés par ses attaques ; absent, on
     les déduit de la stat d'attaque. Renvoie n (1 = un standard). */
  function npcPowerOf(stats, level, roundDmg) {
    var ref = refPlayer(level);
    var dmg = roundDmg != null ? Math.max(0, Number(roundDmg) || 0) : npcRoundDmgFromStats(stats);
    if (!(ref.ehp > 0) || !(ref.roundDmg > 0)) return 0;
    return npcPowerFromProduct((npcEhp(stats) / ref.ehp) * (dmg / ref.roundDmg));
  }
  /* La même puissance, vue depuis un groupe d'un AUTRE niveau (budget de rencontre). */
  function npcPowerAtLevel(power, level, partyLevel) {
    level = Math.max(1, level | 0); partyLevel = Math.max(1, partyLevel | 0);
    if (level === partyLevel) return Math.max(0, Number(power) || 0);
    var a = refPlayer(level), b = refPlayer(partyLevel);
    return npcPowerFromProduct(npcPowerProduct(power) * (a.ehp * a.roundDmg) / (b.ehp * b.roundDmg));
  }

  /* --- Fiche de bestiaire ---
     Les champs de stats de la fiche sont la SOURCE DE VÉRITÉ. Quand le MJ change un
     paramètre (niveau, rang, archétype, curseur), `npcReparam` fait SUIVRE les champs qui
     valaient encore la suggestion et laisse intacts ceux qu'il a retouchés à la main. */
  var NPC_STAT_KEYS = ['hpMax', 'ad', 'ap', 'armure', 'resmag', 'crit', 'dcrit', 'rescrit', 'lethaAD', 'lethaAP'];
  var NPC_LEVEL_MAX = 40;
  function npcDefaultTilt(rankId) { return npcRank(rankId).tilt || 0; }
  function npcParams(m) {
    m = m || {};
    var rank = npcRank(m.rank).id;
    return {
      level: Math.max(1, Math.min(NPC_LEVEL_MAX, (m.level | 0) || 1)),
      rank: rank, archetype: npcArchetype(m.archetype).id,
      tilt: m.tilt == null ? npcDefaultTilt(rank) : Math.max(-200, Math.min(300, Math.round(Number(m.tilt) || 0))),
    };
  }
  /* Valeurs suggérées de TOUS les champs chiffrés d'une fiche (stats + XP). */
  function npcSuggestSheet(m) {
    var p = npcParams(m), s = npcSuggestStats(p.level, p.rank, p.archetype, p.tilt), out = {};
    NPC_STAT_KEYS.forEach(function (k) { out[k] = s[k]; });
    out.xp = npcMonsterXp(p.level, npcRank(p.rank).power);
    return out;
  }
  function npcNewMonster(init) {
    var p = npcParams(init || {});
    return Object.assign({ name: (init && init.name) || 'Nouveau monstre', side: 'enemy', note: '', img: '' },
      p, npcSuggestSheet(p));
  }
  /* Patch à écrire quand des PARAMÈTRES changent. Changer de rang emmène aussi le curseur,
     s'il était encore sur le défaut de l'ancien rang. */
  function npcReparam(monster, change) {
    var before = npcParams(monster), raw = Object.assign({}, before, change || {});
    if (change && change.rank != null && change.tilt == null && before.tilt === npcDefaultTilt(before.rank)) raw.tilt = null;
    var after = npcParams(raw);
    var was = npcSuggestSheet(before), now = npcSuggestSheet(after), patch = Object.assign({}, after);
    Object.keys(now).forEach(function (k) {
      if (monster[k] == null || Number(monster[k]) === was[k]) patch[k] = now[k];
    });
    return patch;
  }
  /* Copie à poser dans `combat/enemies` (forme de `makeEnemy`, sans l'id). `index`/`count`
     numérotent les copies. ⚠️ La vue MJ n'a qu'UN champ `atk`, et son bouton « ⚔ Attaque » le
     propose tel quel comme montant du coup (crit roulé par-dessus) : il reçoit donc le coup
     NORMAL de l'attaque de base de la fiche (lot 3), PAS la stat AD/AP — une attaque de base
     n'en fait que ~60 %. Sans attaque de base chiffrée, repli sur la plus élevée de AD / AP. */
  function npcToEnemy(monster, index, count) {
    var m = monster || {}, n = function (v) { return Math.max(0, Math.round(Number(v) || 0)); };
    var ally = m.side === 'ally';
    var basic = npcMonsterAttacks(m).filter(function (a) { return a.kind === 'basic' && n(a.dmg) > 0; })[0];
    return {
      name: (m.name || 'Monstre') + (count > 1 ? ' ' + ((index | 0) + 1) : ''),
      hpCur: Math.max(1, n(m.hpMax)), hpMax: Math.max(1, n(m.hpMax)), manaCur: 0, manaMax: 0,
      atk: basic ? n(basic.dmg) : Math.max(n(m.ad), n(m.ap)), armure: n(m.armure), resmag: n(m.resmag),
      crit: n(m.crit), dcrit: n(m.dcrit) || 200, rescrit: n(m.rescrit),
      lethaAD: n(m.lethaAD), lethaAP: n(m.lethaAP), note: '',
      side: ally ? 'ally' : 'enemy', reveal: ally ? 'exact' : 'hidden', revealPct: 100,
      npcLevel: npcParams(m).level, rank: npcParams(m).rank, bestiaryId: m.id || null,
    };
  }

  /* --- Attaques et compétences (indicatif MJ) ---
     Une attaque : { kind:'basic'|'skill', type:'physique'|'magique'|'brut', targets 1-5,
     cd 1-10, dmg (coup NORMAL, par cible), crit (défaut true), once (1×/combat : hors budget) }.
     Zone : des dégâts étalés valent moins que des dégâts concentrés, donc une zone sur N
     cibles inflige NPC_AOE_SHARE[N] de sa monocible équivalente À CHAQUE cible. */
  var NPC_AOE_SHARE = [1, 0.65, 0.5, 0.4, 0.35];
  function npcAoeShare(targets) {
    var n = Math.max(1, Math.min(NPC_AOE_SHARE.length, targets | 0));
    return NPC_AOE_SHARE[n - 1];
  }
  var NPC_DMG_SPREAD = 0.15;   // fourchette basse-haute affichée : ±15 %
  function npcAttackAvg(att, stats) {
    att = att || {};
    var d = Math.max(0, Number(att.dmg) || 0);
    return att.crit === false ? d : d * critAverage(stats && stats.crit, stats && stats.dcrit);
  }
  /* Ce que l'attaque consomme du budget par round : sa monocible équivalente, étalée sur son délai. */
  function npcAttackCost(att, stats) {
    att = att || {};
    if (att.once) return 0;
    return npcAttackAvg(att, stats) / npcAoeShare(att.targets) / Math.max(1, att.cd | 0);
  }
  function npcBudgetUsage(attacks, stats, budget) {
    var used = 0;
    (attacks || []).forEach(function (a) { used += npcAttackCost(a, stats); });
    budget = Math.max(0, Number(budget) || 0);
    return { used: used, budget: budget, pct: budget > 0 ? used / budget * 100 : 0, left: budget - used };
  }
  /* Lecture d'une attaque : chiffre à ANNONCER (avant mitigation) et ce qu'ENCAISSE la
     défense donnée (le PJ de référence par défaut côté page). `type` force l'affichage
     physique / magique / brut ; absent, celui de l'attaque. */
  function npcAttackView(att, stats, defense, type) {
    att = att || {}; stats = stats || {}; defense = defense || {};
    var t = type || att.type || 'physique';
    var d = Math.max(0, Number(att.dmg) || 0);
    var canCrit = att.crit !== false;
    var critMult = canCrit ? Math.max(100, Number(stats.dcrit) || 100) / 100 : 1;
    var leth = t === 'physique' ? stats.lethaAD : t === 'magique' ? stats.lethaAP : 0;
    var taken = function (x) { return mitigateDamage(x, t, defense, leth); };
    var n = Math.max(1, Math.min(NPC_AOE_SHARE.length, att.targets | 0));
    var avg = npcAttackAvg(att, stats);
    return {
      type: t, targets: n,
      normal: Math.round(d), low: Math.round(d * (1 - NPC_DMG_SPREAD)), high: Math.round(d * (1 + NPC_DMG_SPREAD)),
      crit: canCrit ? Math.round(d * critMult) : null,
      avg: Math.round(avg), total: Math.round(avg * n),
      taken: {
        normal: taken(d),
        crit: canCrit ? taken(d * critMultAfterResist(critMult, defense.rescrit)) : null,
      },
    };
  }

  /* Gabarits d'attaques : `share` = part du budget par round. Le monstre suit l'économie
     d'actions des PJ (attaque de base + C1 + C2 OU C3). Les soutiens gardent C2/C3 pour
     leurs effets (dégâts 0, à décrire dans les notes). */
  var NPC_ATTACK_TEMPLATES = {
    std:     [ { key: 'aa', name: 'Attaque de base', kind: 'basic', share: 0.30, cd: 1, targets: 1 },
               { key: 'c1', name: 'Compétence 1',    kind: 'skill', share: 0.30, cd: 1, targets: 1 },
               { key: 'c2', name: 'Compétence 2',    kind: 'skill', share: 0.20, cd: 2, targets: 1 },
               { key: 'c3', name: 'Compétence 3 (zone)', kind: 'skill', share: 0.20, cd: 3, targets: 2 } ],
    burst:   [ { key: 'aa', name: 'Attaque de base', kind: 'basic', share: 0.25, cd: 1, targets: 1 },
               { key: 'c1', name: 'Compétence 1',    kind: 'skill', share: 0.25, cd: 1, targets: 1 },
               { key: 'c2', name: 'Coup fatal',      kind: 'skill', share: 0.50, cd: 3, targets: 1 } ],
    mage:    [ { key: 'aa', name: 'Attaque de base', kind: 'basic', share: 0.20, cd: 1, targets: 1 },
               { key: 'c1', name: 'Sort 1',          kind: 'skill', share: 0.35, cd: 1, targets: 1 },
               { key: 'c2', name: 'Sort 2',          kind: 'skill', share: 0.25, cd: 2, targets: 1 },
               { key: 'c3', name: 'Sort 3 (zone)',   kind: 'skill', share: 0.20, cd: 3, targets: 2 } ],
    zone:    [ { key: 'aa', name: 'Attaque de base', kind: 'basic', share: 0.20, cd: 1, targets: 1 },
               { key: 'c1', name: 'Sort 1 (zone)',   kind: 'skill', share: 0.30, cd: 1, targets: 2 },
               { key: 'c2', name: 'Sort 2 (zone)',   kind: 'skill', share: 0.25, cd: 2, targets: 3 },
               { key: 'c3', name: 'Sort 3 (zone)',   kind: 'skill', share: 0.25, cd: 3, targets: 4 } ],
    soutien: [ { key: 'aa', name: 'Attaque de base', kind: 'basic', share: 0.50, cd: 1, targets: 1 },
               { key: 'c1', name: 'Compétence 1',    kind: 'skill', share: 0.50, cd: 1, targets: 1 },
               { key: 'c2', name: 'Soutien 1',       kind: 'skill', share: 0,    cd: 2, targets: 1 },
               { key: 'c3', name: 'Soutien 2',       kind: 'skill', share: 0,    cd: 3, targets: 1 } ],
  };
  /* Attaques par défaut d'un monstre : le gabarit de son archétype, chiffré sur `budget`. */
  function npcBuildAttacks(archetypeId, stats, budget) {
    var ar = npcArchetype(archetypeId), tpl = NPC_ATTACK_TEMPLATES[ar.tpl] || NPC_ATTACK_TEMPLATES.std;
    var avgMult = critAverage(stats && stats.crit, stats && stats.dcrit);
    budget = Math.max(0, Number(budget) || 0);
    return tpl.map(function (t, i) {
      return {
        id: t.key, order: i, name: t.name, kind: t.kind,
        type: ar.main === 'ap' ? 'magique' : 'physique',
        targets: t.targets, cd: t.cd, note: '',
        dmg: Math.round(t.share * budget * t.cd * npcAoeShare(t.targets) / avgMult),
      };
    });
  }

  /* Attaques d'une fiche, triées. ⚠️ `attacks` ABSENT = jamais touchées : on rend le gabarit
     de l'archétype chiffré sur le budget COURANT, si bien qu'il suit niveau, rang, archétype
     et curseur. La première retouche les écrit en base (elles deviennent absolues) ; la jauge
     de budget dit alors l'écart et `npcFitAttacks` les recale d'un clic. */
  function npcMonsterAttacks(m) {
    m = m || {};
    if (!m.attacks || typeof m.attacks !== 'object')
      return npcBuildAttacks(npcParams(m).archetype, m, npcRoundDmgFromStats(m));
    return Object.keys(m.attacks).map(function (k) { return m.attacks[k]; })
      .filter(function (a) { return a && a.id; })
      .sort(function (a, b) { return (a.order | 0) - (b.order | 0) || (a.id < b.id ? -1 : 1); });
  }
  /* Recale TOUTES les attaques comptées au budget, en gardant leurs proportions. */
  function npcFitAttacks(attacks, stats, budget) {
    var u = npcBudgetUsage(attacks, stats, budget);
    if (!(u.used > 0) || !(u.budget > 0)) return (attacks || []).slice();
    var f = u.budget / u.used;
    return attacks.map(function (a) {
      return a.once ? a : Object.assign({}, a, { dmg: Math.max(0, Math.round((Number(a.dmg) || 0) * f)) });
    });
  }
  /* Nouvelle compétence : délai 2, monocible, chiffrée sur ce qui reste du budget (au moins 10 %). */
  function npcNewAttack(attacks, stats, budget, main) {
    var u = npcBudgetUsage(attacks, stats, budget), cd = 2;
    var share = Math.max(0.1 * u.budget, u.left);
    var order = 0;
    (attacks || []).forEach(function (a) { order = Math.max(order, (a.order | 0) + 1); });
    return { id: 'att_' + Date.now().toString(36) + '_' + order, order: order, name: 'Nouvelle compétence', kind: 'skill',
      type: main === 'ap' ? 'magique' : 'physique', targets: 1, cd: cd, note: '',
      dmg: Math.round(share * cd / critAverage(stats && stats.crit, stats && stats.dcrit)) };
  }

  /* --- Rencontres ---
     Budget = somme des puissances, chacune ramenée au niveau du GROUPE. ⚠️ Approximation :
     exacte tant que le groupe tue les monstres un par un, optimiste dès que les zones jouent. */
  function npcEncounterBudget(entries, partyLevel) {
    var sum = 0;
    (entries || []).forEach(function (e) {
      if (!e) return;
      var count = Math.max(0, e.count == null ? 1 : e.count | 0);
      sum += count * npcPowerAtLevel(e.power, e.level || partyLevel, partyLevel);
    });
    return sum;
  }
  /* Difficulté = budget PAR PJ (1 = le miroir). Bornes à mi-chemin géométrique des repères MJ. */
  var NPC_DIFFICULTY = [
    { id: 'faible',  label: 'Faible',  perPj: 0.2 },
    { id: 'moyenne', label: 'Moyenne', perPj: 0.5 },
    { id: 'dure',    label: 'Dure',    perPj: 1 },
    { id: 'extreme', label: 'Extrême', perPj: 2 },
  ];
  function npcDifficulty(budget, partySize) {
    var perPj = Math.max(0, Number(budget) || 0) / Math.max(1, partySize | 0);
    var d = NPC_DIFFICULTY[NPC_DIFFICULTY.length - 1];
    for (var i = 0; i < NPC_DIFFICULTY.length - 1; i++) {
      if (perPj < Math.sqrt(NPC_DIFFICULTY[i].perPj * NPC_DIFFICULTY[i + 1].perPj)) { d = NPC_DIFFICULTY[i]; break; }
    }
    return { id: d.id, label: d.label, perPj: perPj };
  }

  /* --- XP ---
     Règle MJ : un niveau = 1 rencontre extrême, 2 dures, 4 moyennes ou 8 faibles.
     `npcXpForLevel` = xpToNext SANS le plafond du niveau 18 (un monstre peut le dépasser). */
  function npcXpForLevel(level) { return 180 + 100 * Math.max(1, level | 0); }
  /* Cagnotte d'un monstre (à partager entre les PJ) : 100 % de puissance = un demi-niveau d'UN PJ. */
  function npcMonsterXp(level, power) {
    return Math.round(npcXpForLevel(level) * Math.max(0, Number(power) || 0) * 0.5);
  }
  var NPC_XP_CURVE = [[0, 0], [0.2, 0.125], [0.5, 0.25], [1, 0.5], [2, 1]];   // budget par PJ → fraction de niveau
  function npcEncounterXp(budget, partyLevel, partySize) {
    partySize = Math.max(1, partySize | 0);
    var perPj = Math.max(0, Number(budget) || 0) / partySize;
    var c = NPC_XP_CURVE, frac = c[c.length - 1][1] + (perPj - c[c.length - 1][0]) * 0.5;
    for (var i = 1; i < c.length; i++) {
      if (perPj <= c[i][0]) {
        frac = c[i - 1][1] + (perPj - c[i - 1][0]) * (c[i][1] - c[i - 1][1]) / (c[i][0] - c[i - 1][0]);
        break;
      }
    }
    var need = npcXpForLevel(partyLevel);
    var perPlayer = Math.round(frac * need);
    // `bonus` = ce que la courbe du MJ donne de plus que la somme des cagnottes des monstres.
    return { perPj: perPj, fraction: frac, perPlayer: perPlayer, total: perPlayer * partySize,
      bonus: perPlayer - Math.round(perPj * 0.5 * need) };
  }

  return {
    NPC_REF_PROFILES, NPC_RANKS, NPC_ARCHETYPES, NPC_AOE_SHARE, NPC_DMG_SPREAD, NPC_ATTACK_TEMPLATES,
    NPC_DIFFICULTY, NPC_XP_CURVE, REF_ROUND_RATIO,
    npcPointBudget, npcScaleProfile, critAverage, npcEhpFactor, npcEhp, refPlayer,
    npcRank, npcPowerMults, npcPowerProduct, npcPowerFromProduct, npcRankForPower,
    NPC_STAT_KEYS, NPC_LEVEL_MAX, npcDefaultTilt, npcParams, npcSuggestSheet, npcNewMonster, npcReparam, npcToEnemy,
    npcArchetype, npcTiltFactor, npcRoundDmgFromStats, npcSuggestStats, npcPowerOf, npcPowerAtLevel,
    npcAoeShare, npcAttackAvg, npcAttackCost, npcBudgetUsage, npcAttackView, npcBuildAttacks,
    npcMonsterAttacks, npcFitAttacks, npcNewAttack,
    npcEncounterBudget, npcDifficulty, npcXpForLevel, npcMonsterXp, npcEncounterXp,
    clamp, clampGauge,
    DEFAULT_MODIFIERS, BUFF_STAT_MAP, computeEffective, sumItemMods,
    healMultiplier, applyHealBonus, lifestealMultiplier, buildDefaultState, makeItem, newItemId,
    EQUIP_TYPES, planItemTransfer,
    STACK_MAX, fillStacks, planItemAdd, buildCatalogSeed, catalogArray,
    COIN_VALUE, planCoinConvert, COIN_PER_WEIGHT, coinsWeight,
    COIN_NAME, coinsAmountText, coinsDeltaText, coinsDeltaValue, LOG_MAX, staleLogIds,
    coinInt, sanitizeCampaignCoins, planCoinMove,
    CARRY_BASE, CARRY_PER_FORCE, carriedWeight, carryCapacity, weightStatus, weightStatusPct, comfortPct,
    carryBaseRaw, groupCarryBase, GROUP_CARRY_RATIO, groupCarryCapacity, groupComfortPct,
    TRANSPORT_SLOTS, transportAccepts, sumTransportCarry,
    ARMOR_CLASSES, armorWeightReduction, armorEffectiveWeight,
    paginate,
    RUNE_COST, buildRuneIndex, runeBudget, runeSpent,
    canSelectRune, canDeselectRune, sumRuneMods, runeNodeMods, runeLevelStep,
    mergeMods, ADP_KEYS, runeHasAdpChoice,
    runePickOptions, runeHasPick, runePickCount, runePickKeys, runePickedOptions, runePickToggle, runePickGroup,
    mitigateDamage, applyDamageToPools, lifestealHeal, critInfo, rollCrit, critMultAfterResist, enemyPublicView,
    combatantSide, isAlly, splitCombatants,
    INIT_DIE, rollInitiative, initiativeTotal, initiativeBonus, withKitInitiative, initiativeStatus, initiativeReady,
    combatantJoinRound, initiativeJoinOnValidate, initiativeSlots, slotParticipants, initiativeState,
    skillBaseDamage, cooldownReady, nextReadyAt, skillUnlocked,
    EFFECT_LABEL, hasSelfEffect, skillTargeting, castSelectionValid, buildSelfEffect,
    SKILL_CD_COMBAT, SKILL_CD_DAY, skillLockValue, cooldownsAfterCombat, dayUnlockPatch,
    buildCastPlan, actionRefundPlan, refundManaValue, skillManaCost, skillManaPer, MANA_COST_PER_LEVEL,
    BASIC_MODES, basicMode, basicModeDamage,
    WEAPON_MODES, WEAPON_TIER_MODS, WEAPON_TIERS, WEAPON_PROPERTIES, WEAPON_CATEGORIES,
    HANDS_LABEL, WEAPON_KIND_LABEL, HAND_SLOTS, weaponCategory, isWeaponItem, isMiniWeapon,
    isAccessorySlot, weaponLoadout, weaponMastered, sumWeaponPropMods, basicAttackProfile, BASIC_ATTACK_RATIO,
    equipSlotCheck, weaponCatLabel,
    LOT2_ATTACK_PROPS, weaponCdKey, weaponPropSources, weaponActiveSource, weaponActiveProps,
    weaponAttackTargeting, buildWeaponAttack, buildFocalisation, LOT3_ASSISTED_PROPS, buildParade,
    eliasPassiveAD, eliasMaxStacks, dmgEliasC1, dmgEliasC2, dmgEliasC3, dmgEliasC4, eliasC4Heal, skillHeal,
    dmgSmithPassif, dmgSmithC1, smithC1Mult, smithC1CritBonus, dmgSmithC3, smithBleed,
    urskaarStunPct, dmgUrskaarC4Ally, missingHpPct, resolveBoon, skillCastCost, pctOf, nanoHexEff,
    dmgJettC3, jettC3Boon, NANOHEX_CN_OPTIONS, allocTotal, nanoHexStats, nanoHexSummon,
    healJettC1, shieldJettC1, jettC1ManaPct, JETT_C1_EFFECTS, jettC1Effect, jettC1Roll, jettC1Damage, jettC1Heal, jettC1Boon,
    dmgRathaelC1, rathaelC2Buff, dmgRathaelC3, rathaelUltHpBonus, glaciationOnHit, glaciationDecay,
    bearBonusPct, bearTranches, dmgUrskaarC1, dmgUrskaarC2, urskaarC3Shield, dmgUrskaarC4,
    jettEngins, dmgJettPoison, dmgJettForce, dmgJettC2, healJettC2,
    sumPassiveMods, sumSkillBuffs, statBreakdown, parseConsumableEffect, carouselTransforms, planReorder,
    runeRadialLayout,
    xpToNext, applyXp, applyXpLoss, MAX_LEVEL,
    escalationFactor, globalEscalation, computeStats, charBaseStats, attrSum, respecValid, npcStatsFromAttrs,
    defaultHabSplit, habSplit, HAB_DESTS,
    defaultMentalSplit, mentalSplit, MENTAL_DESTS,
    defaultForceSplit, forceSplit, FORCE_DESTS, FORCE_DIRECTED,
    defaultMagieSplit, magieSplit, MAGIE_DESTS, MAGIE_DIRECTED,
  };
});
