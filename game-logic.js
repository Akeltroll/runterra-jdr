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
      carry:  Number(p.carry) || 0,    // bonus de capacité de charge PERSONNELLE (canal 'p') — objet équipé
      carryGroup: Number(p.carryGroup) || 0,  // bonus de capacité de charge du GROUPE (canal 'g') — coffre commun
      armorClass: p.armorClass || '',  // '' | 'legere' | 'intermediaire' | 'lourde' (armures)
    };
  }

  /* --- Transfert/fusion d'items : logique pure --- */
  function _sameKind(a, b) {
    return a && b && a.name === b.name && (a.type || '') === (b.type || '') && a.cat === b.cat
      && (a.armorClass || '') === (b.armorClass || '');
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
        weight: Number(e.weight) || 0, carry: Number(e.carry) || 0, carryGroup: Number(e.carryGroup) || 0, armorClass: e.armorClass || '' };
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
  function sumRuneMods(selectedIds, choices, index) {
    selectedIds = selectedIds || []; choices = choices || {}; index = index || {};
    var out = {};
    for (var i = 0; i < selectedIds.length; i++) {
      var e = index[selectedIds[i]];
      if (!e || !e.mods) continue;
      for (var k in e.mods) {
        var v = Number(e.mods[k]) || 0; if (!v) continue;
        var stat = k;
        var pair = ADP_KEYS[k];
        if (pair) stat = (choices[e.id] === 'ap') ? pair[1] : pair[0];
        out[stat] = (out[stat] || 0) + v;
      }
    }
    return out;
  }
  /* Une rune propose-t-elle un choix AD/AP ? (pilote l'affichage du toggle) */
  function runeHasAdpChoice(node) {
    if (!node || !node.mods) return false;
    for (var k in ADP_KEYS) if (node.mods[k] != null) return true;
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

  /* Une entree de score : { d6, bonus, ok, reroll }.
     `d6`     = le jet (1..6), ecrit par le JOUEUR pour son perso, par le MJ pour les PNJ
     `bonus`  = preparation au combat (-2..+2) + bonus personnels, ecrit par le MJ
     `ok`     = validation du MJ ; tant qu'elle manque le score n'entre pas en jeu
     `reroll` = le MJ a refuse le jet et en demande un autre */
  function initiativeTotal(entry) {
    if (!entry || entry.d6 == null) return null;
    var d6 = Math.max(1, Math.min(INIT_DIE, entry.d6 | 0));
    return d6 + (entry.bonus | 0);
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
     ⚠️ RÈGLE MJ (2026-08-17, figée) : la léthalité (letha/lethaMag) et les soins liés
     aux dégâts (vol de vie, sapience, omnivamp) ne dérivent JAMAIS des caractéristiques.
     Elles viennent exclusivement de l'équipement, des runes et des modificateurs — ne
     pas les ajouter ici. C'est aussi pour ça que la Sapience a été retirée du socle. */
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
    var s = computeStats(attrs.force, attrs.hab, attrs.mental, attrs.magie, level);
    return {
      hpMax: s.hp, hpCur: s.hp,
      manaMax: s.mana, manaCur: s.mana,
      atk: Math.max(s.ad, s.ap),
      armure: s.armure, resmag: s.resmag,
      crit: s.crit, dcrit: s.dcrit,
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
    COIN_VALUE, planCoinConvert, COIN_PER_WEIGHT, coinsWeight,
    COIN_NAME, coinsAmountText, coinsDeltaText, coinsDeltaValue, LOG_MAX, staleLogIds,
    coinInt, sanitizeCampaignCoins, planCoinMove,
    CARRY_BASE, CARRY_PER_FORCE, carriedWeight, carryCapacity, weightStatus, weightStatusPct, comfortPct,
    carryBaseRaw, groupCarryBase, GROUP_CARRY_RATIO, groupCarryCapacity, groupComfortPct,
    TRANSPORT_SLOTS, transportAccepts, sumTransportCarry,
    ARMOR_CLASSES, armorWeightReduction, armorEffectiveWeight,
    paginate,
    RUNE_COST, buildRuneIndex, runeBudget, runeSpent,
    canSelectRune, canDeselectRune, sumRuneMods, mergeMods, ADP_KEYS, runeHasAdpChoice,
    mitigateDamage, applyDamageToPools, lifestealHeal, critInfo, rollCrit, enemyPublicView,
    combatantSide, isAlly, splitCombatants,
    INIT_DIE, rollInitiative, initiativeTotal, initiativeStatus, initiativeReady,
    combatantJoinRound, initiativeJoinOnValidate, initiativeSlots, slotParticipants, initiativeState,
    skillBaseDamage, cooldownReady, nextReadyAt, skillUnlocked,
    eliasPassiveAD, eliasMaxStacks, dmgEliasC1, dmgEliasC2, dmgEliasC3, dmgEliasC4, skillHeal,
    dmgSmithPassif, dmgSmithC1, dmgSmithC3, smithBleedPct,
    dmgRathaelC1, rathaelC2Buff, dmgRathaelC3, rathaelUltHpBonus, glaciationOnHit, glaciationDecay,
    bearBonusPct, bearTranches, dmgUrskaarC1, dmgUrskaarC2, urskaarC3Shield, dmgUrskaarC4,
    jettEngins, dmgJettPoison, dmgJettForce, dmgJettC2, healJettC2,
    sumPassiveMods, sumSkillBuffs, statBreakdown, parseConsumableEffect, carouselTransforms, planReorder,
    runeRadialLayout,
    xpToNext, applyXp, applyXpLoss, MAX_LEVEL,
    escalationFactor, computeStats, charBaseStats, attrSum, respecValid, npcStatsFromAttrs,
  };
});
