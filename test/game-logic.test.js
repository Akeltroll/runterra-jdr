const test = require('node:test');
const assert = require('node:assert');
const L = require('../game-logic.js');

/* --- Task 1 : bornage --- */
test('clamp borne entre min et max et arrondit', () => {
  assert.equal(L.clamp(150, 0, 100), 100);
  assert.equal(L.clamp(-5, 0, 100), 0);
  assert.equal(L.clamp(42.6, 0, 100), 43);
});

test('clampGauge borne une jauge 0..5', () => {
  assert.equal(L.clampGauge(7), 5);
  assert.equal(L.clampGauge(-1), 0);
  assert.equal(L.clampGauge(3), 3);
});

/* --- Task 2 : modificateurs + stats effectives --- */
test('DEFAULT_MODIFIERS reflète les colonnes C de l Excel', () => {
  assert.equal(L.DEFAULT_MODIFIERS.rathael.ad, 10);
  assert.equal(L.DEFAULT_MODIFIERS.urskaar.hp, 50);
  assert.equal(L.DEFAULT_MODIFIERS.smith.ad, 20);
  assert.equal(L.DEFAULT_MODIFIERS.smith.crit, 10);
  assert.equal(L.DEFAULT_MODIFIERS.lunick.ad, 20);
  assert.deepEqual(L.DEFAULT_MODIFIERS.jett, {});
});

test('computeEffective ajoute modificateurs puis buffs (additif)', () => {
  const base = { hp:495, mana:265, ad:100, ap:50, armure:40, resmag:30, crit:20, dcrit:160, sapience:8 };
  const eff = L.computeEffective(base, { ad:10 }, ['bravoure']);
  assert.equal(eff.ad, 165); // (100 + 10) * 1.5
  assert.equal(eff.hp, 495); // hp non touché par les buffs
});

test('buffs opposés s annulent', () => {
  const base = { hp:1, mana:1, ad:100, ap:1, armure:1, resmag:1, crit:1, dcrit:1, sapience:1 };
  const eff = L.computeEffective(base, {}, ['bravoure', 'affaibli']);
  assert.equal(eff.ad, 100);
});

test('aiguisage double le crit', () => {
  const base = { hp:1, mana:1, ad:1, ap:1, armure:1, resmag:1, crit:20, dcrit:1, sapience:1 };
  const eff = L.computeEffective(base, {}, ['aiguisage']);
  assert.equal(eff.crit, 40);
});

/* --- Bonus d'items équipés (item.mods) --- */
test('sumItemMods somme les mods des seuls items équipés', () => {
  const itemsById = {
    a: L.makeItem({ id:'a', mods:{ ad:10, armure:5 } }),
    b: L.makeItem({ id:'b', mods:{ ad:5 } }),
    c: L.makeItem({ id:'c', mods:{ ap:99 } }),   // non équipé
  };
  const equipment = { weapon:'a', chest:'b', ring:null };
  assert.deepEqual(L.sumItemMods(equipment, itemsById), { ad:15, armure:5 });
});

test('sumItemMods tolère slots vides, ids manquants et mods absents', () => {
  const itemsById = { a: L.makeItem({ id:'a' }) };   // mods = {}
  assert.deepEqual(L.sumItemMods({ weapon:'a', x:'ghost', y:null }, itemsById), {});
  assert.deepEqual(L.sumItemMods(null, null), {});
});

test('computeEffective ajoute itemMods au même étage que les modificateurs (amplifié par buffs)', () => {
  const base = { hp:495, mana:265, ad:100, ap:50, armure:40, resmag:30, crit:20, dcrit:160, sapience:8 };
  const eff = L.computeEffective(base, { ad:10 }, ['bravoure'], { ad:20 });
  assert.equal(eff.ad, 195); // (100 + 10 + 20) * 1.5
  assert.equal(eff.hp, 495); // hp non touché par les buffs
});

test('computeEffective expose une stat présente uniquement dans itemMods', () => {
  const base = { hp:1, mana:1, ad:1, ap:1, armure:1, resmag:1, crit:1, dcrit:1, sapience:1 };
  const eff = L.computeEffective(base, {}, [], { vol:5 });
  assert.equal(eff.vol, 5);
});

test('computeEffective reste rétrocompatible sans 4e argument', () => {
  const base = { hp:1, mana:1, ad:100, ap:1, armure:1, resmag:1, crit:1, dcrit:1, sapience:1 };
  assert.equal(L.computeEffective(base, { ad:10 }, []).ad, 110);
});

/* --- Task 3 : soins modifiés + seed --- */
test('applyHealMods applique miracule/hemorragie', () => {
  assert.equal(L.applyHealMods(100, []), 100);
  assert.equal(L.applyHealMods(100, ['miracule']), 150);
  assert.equal(L.applyHealMods(100, ['hemorragie']), 50);
  assert.equal(L.applyHealMods(100, ['miracule', 'hemorragie']), 100);
});

test('buildDefaultState convertit ratios en valeurs absolues', () => {
  const char = {
    id:'rathael', hpCur:1.0, manaCur:205/265, shieldCur:99,
    fatigue:1, eau:3, buffs:['bravoure'],
    stats:{ hp:495, mana:265 }, shieldMax:200,
  };
  const s = L.buildDefaultState(char);
  assert.equal(s.hpCur, 495);
  assert.equal(s.manaCur, 205);
  assert.equal(s.shield, 99);
  assert.equal(s.fatigue, 1);
  assert.equal(s.eau, 3);
  assert.deepEqual(s.buffs, { bravoure: true });
  assert.equal(s.modifiers.ad, 10);
});

test('makeItem remplit les valeurs par défaut et conserve celles fournies', () => {
  const it = L.makeItem({ id: 'x1', name: 'Claymore', cat: 'Équipement' });
  assert.equal(it.id, 'x1');
  assert.equal(it.name, 'Claymore');
  assert.equal(it.cat, 'Équipement');
  assert.equal(it.qty, 1);
  assert.equal(it.sub, '');
  assert.equal(it.img, '');
  assert.deepEqual(it.mods, {});
});

test('buildDefaultState produit un inventaire indexé par id depuis char.inv', () => {
  const char = {
    id: 'rathael',
    stats: { hp: 100, mana: 50 },
    hpCur: 1, manaCur: 1, shieldCur: 0, fatigue: 0, eau: 0, buffs: [],
    inv: [
      { cat: 'Équipement', name: 'Claymore', sub: '2H', qty: 1, ic: '⚔' },
      { cat: 'Consommables', name: 'Potion', sub: 'soin', qty: 2, ic: '🧪' },
    ],
  };
  const st = L.buildDefaultState(char);
  const ids = Object.keys(st.inventory);
  assert.equal(ids.length, 2);
  assert.equal(ids[0], 'rathael_inv_0');
  assert.equal(st.inventory['rathael_inv_0'].name, 'Claymore');
  assert.equal(st.inventory['rathael_inv_1'].qty, 2);
});

test('buildDefaultState gère un perso sans inventaire', () => {
  const char = { id: 'x', stats: { hp: 1, mana: 1 }, inv: undefined };
  const st = L.buildDefaultState(char);
  assert.deepEqual(st.inventory, {});
});

test('makeItem porte un champ type (défaut vide)', () => {
  assert.equal(L.makeItem({}).type, '');
  assert.equal(L.makeItem({ type: 'helmet' }).type, 'helmet');
});

test('EQUIP_TYPES couvre les emplacements clés', () => {
  const vals = L.EQUIP_TYPES.map(t => t.value);
  for (const v of ['helmet','chest','ring','weapon','accessory','boots'])
    assert.ok(vals.includes(v), 'manque ' + v);
});

test('buildDefaultState amorce coins depuis char.coins', () => {
  const char = {
    id:'t', stats:{ hp:1, mana:1 }, hpCur:10, manaCur:10,
    coins:{ plat:1, or:2, arg:3, cuiv:4 }, inv:[],
  };
  const st = L.buildDefaultState(char);
  assert.deepEqual(st.coins, { plat:1, or:2, arg:3, cuiv:4 });
});

test('buildDefaultState coins défaut 0 si char.coins absent', () => {
  const char = { id:'t', stats:{ hp:1, mana:1 }, hpCur:0, manaCur:0, inv:[] };
  assert.deepEqual(L.buildDefaultState(char).coins, { plat:0, or:0, arg:0, cuiv:0 });
});

test('planItemTransfer — transfert partiel décrémente la source', () => {
  const src = { a: L.makeItem({ id:'a', name:'Potion', cat:'Consommables', qty:3 }) };
  const { srcPatch, dstPatch } = L.planItemTransfer(src, {}, 'a', 1);
  assert.equal(srcPatch.a.qty, 2);
  const dstItem = Object.values(dstPatch)[0];
  assert.equal(dstItem.qty, 1);
  assert.equal(dstItem.name, 'Potion');
});

test('planItemTransfer — transfert total supprime la source (null)', () => {
  const src = { a: L.makeItem({ id:'a', name:'Épée', cat:'Équipement', type:'weapon', qty:1 }) };
  const { srcPatch } = L.planItemTransfer(src, {}, 'a', 1);
  assert.equal(srcPatch.a, null);
});

test('planItemTransfer — fusion sur item équivalent côté destination', () => {
  const src = { a: L.makeItem({ id:'a', name:'Potion', cat:'Consommables', qty:2 }) };
  const dst = { z: L.makeItem({ id:'z', name:'Potion', cat:'Consommables', qty:5 }) };
  const { dstPatch } = L.planItemTransfer(src, dst, 'a', 2);
  assert.equal(dstPatch.z.qty, 7);
});

test('planItemTransfer — n borné à la qty dispo', () => {
  const src = { a: L.makeItem({ id:'a', name:'X', cat:'Butin', qty:2 }) };
  const { srcPatch, dstPatch } = L.planItemTransfer(src, {}, 'a', 99);
  assert.equal(srcPatch.a, null);
  assert.equal(Object.values(dstPatch)[0].qty, 2);
});

test('planItemTransfer — item absent => patches vides', () => {
  const r = L.planItemTransfer({}, {}, 'nope', 1);
  assert.deepEqual(r, { srcPatch:{}, dstPatch:{} });
});

test('fillStacks — inventaire vide crée une pile', () => {
  const patch = L.fillStacks({}, { name:'Potion', cat:'Consommables', type:'' }, 3);
  const piles = Object.values(patch);
  assert.equal(piles.length, 1);
  assert.equal(piles[0].qty, 3);
  assert.equal(piles[0].name, 'Potion');
});

test('fillStacks — fusionne dans une pile partielle de même genre', () => {
  const items = { z: L.makeItem({ id:'z', name:'Potion', cat:'Consommables', qty:5 }) };
  const patch = L.fillStacks(items, { name:'Potion', cat:'Consommables', type:'' }, 4);
  assert.equal(patch.z.qty, 9);
  assert.equal(Object.keys(patch).length, 1);
});

test('fillStacks — déborde au-delà de STACK_MAX (95 + 10 => 99 + 6)', () => {
  const items = { z: L.makeItem({ id:'z', name:'Potion', cat:'Consommables', qty:95 }) };
  const patch = L.fillStacks(items, { name:'Potion', cat:'Consommables', type:'' }, 10);
  assert.equal(patch.z.qty, 99);
  const others = Object.entries(patch).filter(([k]) => k !== 'z').map(([, v]) => v);
  assert.equal(others.length, 1);
  assert.equal(others[0].qty, 6);
});

test('fillStacks — 100 dans un inventaire vide => 99 + 1', () => {
  const patch = L.fillStacks({}, { name:'Potion', cat:'Consommables', type:'' }, 100);
  const qtys = Object.values(patch).map(p => p.qty).sort((a, b) => b - a);
  assert.deepEqual(qtys, [99, 1]);
});

test('fillStacks — ne fusionne pas des items de genre différent', () => {
  const items = { z: L.makeItem({ id:'z', name:'Potion', cat:'Consommables', qty:5 }) };
  const patch = L.fillStacks(items, { name:'Épée', cat:'Équipement', type:'weapon' }, 1);
  assert.equal(patch.z, undefined);
  assert.equal(Object.values(patch)[0].name, 'Épée');
});

test('fillStacks — STACK_MAX vaut 99', () => {
  assert.equal(L.STACK_MAX, 99);
});

test('planItemAdd — enveloppe fillStacks et renvoie { patch }', () => {
  const r = L.planItemAdd({}, { name:'Potion', cat:'Consommables', type:'' }, 2);
  assert.ok(r.patch);
  assert.equal(Object.values(r.patch)[0].qty, 2);
});

/* --- Récap : pagination en doubles-pages --- */
test('paginate regroupe les pages en doubles-pages', () => {
  assert.deepEqual(L.paginate([]), []);
  assert.deepEqual(L.paginate(['a']), [['a']]);
  assert.deepEqual(L.paginate(['a','b']), [['a','b']]);
  assert.deepEqual(L.paginate(['a','b','c']), [['a','b'],['c']]);
  assert.deepEqual(L.paginate(['a','b','c','d']), [['a','b'],['c','d']]);
});

test('paginate tolère null/undefined', () => {
  assert.deepEqual(L.paginate(null), []);
  assert.deepEqual(L.paginate(undefined), []);
});

test('planItemTransfer — crédit qui dépasse 99 déborde côté destination', () => {
  const src = { a: L.makeItem({ id:'a', name:'Potion', cat:'Consommables', qty:10 }) };
  const dst = { z: L.makeItem({ id:'z', name:'Potion', cat:'Consommables', qty:95 }) };
  const { srcPatch, dstPatch } = L.planItemTransfer(src, dst, 'a', 10);
  assert.equal(srcPatch.a, null);                 // 10 déplacés => source vidée
  assert.equal(dstPatch.z.qty, 99);               // pile existante remplie au max
  const extra = Object.entries(dstPatch).filter(([k]) => k !== 'z').map(([, v]) => v);
  assert.equal(extra.length, 1);
  assert.equal(extra[0].qty, 6);                  // surplus dans une nouvelle pile
});

/* --- Runes : logique pure --- */
const RFAM = [{
  key:'f', name:'F', color:'#fff', theme:'t', capstone:'c', paths:[
    { key:'p', name:'P', nodes:[
      { id:'a', tier:'mineure',      name:'A', desc:'+50 HP', mods:{ hp:50 } },
      { id:'b', tier:'avancee',      name:'B', desc:'reminder', kind:'reminder' },
      { id:'c', tier:'fondamentale', name:'C', desc:'+30 AD/AP', mods:{ adp:30 } },
    ]},
  ],
}];
const RIDX = L.buildRuneIndex(RFAM);

test('buildRuneIndex calcule coût, prev et next', () => {
  assert.equal(RIDX.a.cost, 1);
  assert.equal(RIDX.b.cost, 2);
  assert.equal(RIDX.a.prevId, null);
  assert.equal(RIDX.a.nextId, 'b');
  assert.equal(RIDX.c.prevId, 'b');
  assert.equal(RIDX.c.nextId, null);
  assert.equal(RIDX.a.familyKey, 'f');
});

test('runeBudget = niveau', () => {
  assert.equal(L.runeBudget(2), 2);
  assert.equal(L.runeBudget(undefined), 0);
});

test('runeSpent additionne les coûts', () => {
  assert.equal(L.runeSpent(['a','c'], RIDX), 3);
  assert.equal(L.runeSpent([], RIDX), 0);
});

test('canSelectRune respecte prérequis et budget', () => {
  assert.equal(L.canSelectRune('a', [], RIDX, 2).ok, true);
  assert.equal(L.canSelectRune('b', [], RIDX, 5).ok, false);          // prérequis a manquant
  assert.equal(L.canSelectRune('c', ['a','b'], RIDX, 4).ok, false);   // 3+2 > 4
  assert.equal(L.canSelectRune('c', ['a','b'], RIDX, 5).ok, true);
  assert.equal(L.canSelectRune('a', ['a'], RIDX, 5).ok, false);       // déjà pris
});

test('canDeselectRune protège un prérequis utilisé', () => {
  assert.equal(L.canDeselectRune('a', ['a','b'], RIDX).ok, false);    // b dépend de a
  assert.equal(L.canDeselectRune('b', ['a','b'], RIDX).ok, true);
  assert.equal(L.canDeselectRune('a', ['a'], RIDX).ok, true);
});

test('sumRuneMods ne somme que les plats et résout adp', () => {
  assert.deepEqual(L.sumRuneMods(['a','c'], { c:'ap' }, RIDX), { hp:50, ap:30 });
  assert.deepEqual(L.sumRuneMods(['a','c'], {}, RIDX), { hp:50, ad:30 });   // défaut ad
  assert.deepEqual(L.sumRuneMods(['b'], {}, RIDX), {});                      // reminder ignoré
});

test('mergeMods additionne deux objets de mods', () => {
  assert.deepEqual(L.mergeMods({ hp:50, ad:10 }, { ad:20, ap:5 }), { hp:50, ad:30, ap:5 });
});

/* --- Combat (vue MJ ennemis) : mitigation Excel + bouclier/HP --- */
test('mitigateDamage — physique : AR/(AR+120)', () => {
  // AR=120 → réduction 0.5 → ceil(100*0.5)=50
  assert.equal(L.mitigateDamage(100, 'physique', { armure: 120 }), 50);
});

test('mitigateDamage — magique utilise resmag', () => {
  assert.equal(L.mitigateDamage(100, 'magique', { resmag: 120 }), 50);
});

test('mitigateDamage — brut ignore toute défense', () => {
  assert.equal(L.mitigateDamage(100, 'brut', { armure: 999, resmag: 999 }), 100);
});

test("mitigateDamage — léthalité réduit l'armure sans passer sous 0", () => {
  // armure 50, léthalité 80 → AR efficace 0 → aucune réduction
  assert.equal(L.mitigateDamage(100, 'physique', { armure: 50 }, 80), 100);
});

test('mitigateDamage — armure 0 = dégâts pleins', () => {
  assert.equal(L.mitigateDamage(40, 'physique', { armure: 0 }), 40);
});

test('applyDamageToPools — bouclier absorbe tout, HP intacts', () => {
  assert.deepEqual(L.applyDamageToPools({ hpCur: 100, shield: 30 }, 20),
    { hpCur: 100, shield: 10, ko: false });
});

test('applyDamageToPools — excédent passe aux HP, bouclier à 0', () => {
  assert.deepEqual(L.applyDamageToPools({ hpCur: 100, shield: 30 }, 50),
    { hpCur: 80, shield: 0, ko: false });
});

test('applyDamageToPools — sans bouclier', () => {
  assert.deepEqual(L.applyDamageToPools({ hpCur: 100, shield: 0 }, 40),
    { hpCur: 60, shield: 0, ko: false });
});

test('applyDamageToPools — KO si dégâts >= HP', () => {
  assert.deepEqual(L.applyDamageToPools({ hpCur: 40, shield: 0 }, 40),
    { hpCur: 0, shield: 0, ko: true });
});

/* ============================================================
   COMPÉTENCES (plan 2026-06-19) — logique pure
   ============================================================ */

/* --- Task 1 : base d'arme + helpers de cooldown --- */
test('skillBaseDamage selon le type d arme', () => {
  const eff = { ad: 80, ap: 40 };
  assert.equal(L.skillBaseDamage('Physique', eff), 80);
  assert.equal(L.skillBaseDamage('Magique', eff), 40);
  assert.equal(L.skillBaseDamage('Hybride', eff), 60);
});

test('cooldownReady : prêt si pas de readyAt ou tour atteint', () => {
  assert.equal(L.cooldownReady(undefined, 3), true);
  assert.equal(L.cooldownReady(5, 5), true);
  assert.equal(L.cooldownReady(5, 4), false);
});

test('nextReadyAt = tour + cd', () => {
  assert.equal(L.nextReadyAt(3, 3), 6);
  assert.equal(L.nextReadyAt(7, 1), 8);
});

/* --- Task 2 : Elias (Fab.gs) --- */
test('Elias passif AD/charge et max charges (niv 2/4)', () => {
  assert.equal(L.eliasPassiveAD(2), 15);
  assert.equal(L.eliasMaxStacks(2), 5);
  assert.equal(L.eliasPassiveAD(4), 25);
  assert.equal(L.eliasMaxStacks(4), 6);
});
test('Elias compétences (script Fab.gs)', () => {
  const eff = { ad: 100, ap: 0 };
  assert.equal(L.dmgEliasC1('Physique', eff, false), 100);
  assert.equal(L.dmgEliasC1('Physique', eff, true), 125);
  assert.equal(L.dmgEliasC2(eff), 150);
  assert.equal(L.dmgEliasC3(eff), 250);
  assert.equal(L.dmgEliasC4(eff, 1), 250);
  assert.equal(L.skillHeal(250, 0.05), 12);
});

/* --- Task 3 : Smith (Erwan.gs) --- */
test('Smith formules (Erwan.gs)', () => {
  assert.equal(L.dmgSmithPassif({ ap: 100 }), 100);
  assert.equal(L.dmgSmithC1('Physique', { ad: 80, ap: 0 }, false), 80);
  assert.equal(L.dmgSmithC1('Physique', { ad: 80, ap: 0 }, true), 120);
  assert.equal(L.dmgSmithC3({ ad: 150 }), 200);
  assert.equal(L.smithBleedPct({ ad: 250 }), 15);
});

/* --- Task 4 : Urskaar (Baptiste.gs + kit C3/C4) --- */
test('Urskaar Voie de l ours', () => {
  assert.equal(L.bearBonusPct(4), 0);
  assert.equal(L.bearBonusPct(5), 150);
  assert.equal(L.bearBonusPct(8), 175);
  assert.equal(L.bearTranches(5), 1);
  assert.equal(L.bearTranches(8), 2);
  const eff = { ad: 100, ap: 50 };
  assert.equal(L.dmgUrskaarC1(eff, 'gauche', 0), 100);
  assert.equal(L.dmgUrskaarC1(eff, 'droite', 0), 150);
  assert.equal(L.dmgUrskaarC1(eff, 'droite', 8), 175);
  assert.equal(L.dmgUrskaarC2(eff, 5), 175);
  assert.equal(L.urskaarC3Shield({ ap: 50 }, 1000), 400);
  assert.equal(L.dmgUrskaarC4(eff, 5), 125);
});

/* --- Task 5 : Jett (Steph.gs) --- */
test('Jett Nano-hextech', () => {
  assert.equal(L.jettEngins({ ad: 0 }, false), 1);
  assert.equal(L.jettEngins({ ad: 150 }, false), 3);
  assert.equal(L.jettEngins({ ad: 150 }, true), 6);
  assert.equal(L.dmgJettPoison({ ap: 100 }), 75);
  assert.equal(L.dmgJettForce({ ad: 100 }), 75);
  assert.equal(L.dmgJettC2({ ad: 100 }), 100);
  assert.equal(L.healJettC2({ ap: 100 }), 150);
});

/* --- Task 6 : sumPassiveMods --- */
test('sumPassiveMods : Elias = +AD par charge (niv 2)', () => {
  assert.deepEqual(L.sumPassiveMods('lunick', { chasseur: 3 }, 2), { ad: 45 });
  assert.deepEqual(L.sumPassiveMods('lunick', {}, 2), {});
  assert.deepEqual(L.sumPassiveMods('smith', { marques: 2 }, 2), {});
  assert.deepEqual(L.sumPassiveMods('rathael', { glaciation: 3 }, 2), {});
});

/* --- Buffs sur soi : sumSkillBuffs --- */
test('sumSkillBuffs somme les mods plats par compétence', () => {
  assert.deepEqual(L.sumSkillBuffs({ demi_ours: { hp: 60, ad: 30 }, autre: { ad: 10 } }), { hp: 60, ad: 40 });
  assert.deepEqual(L.sumSkillBuffs({}), {});
  assert.deepEqual(L.sumSkillBuffs(null), {});
});

/* --- Déblocage par niveau : skillUnlocked --- */
test('skillUnlocked : active n° i requiert niveau i+1', () => {
  assert.equal(L.skillUnlocked(0, 1), true);   // C1 niv 1
  assert.equal(L.skillUnlocked(1, 2), true);   // C2 niv 2
  assert.equal(L.skillUnlocked(2, 2), false);  // C3 niv 2 -> verrouillé
  assert.equal(L.skillUnlocked(2, 3), true);   // C3 niv 3
  assert.equal(L.skillUnlocked(3, 3), false);  // C4 niv 3 -> verrouillé
  assert.equal(L.skillUnlocked(3, 4), true);   // C4 niv 4
});

/* --- Task XP : courbe & application --- */
test('xpToNext croît avec le niveau (formule générique)', () => {
  assert.equal(L.xpToNext(1), 100);
  assert.equal(L.xpToNext(2), 200);
  assert.equal(L.xpToNext(5), 500);
});
test('applyXp : gain sans montée de niveau', () => {
  assert.deepEqual(L.applyXp(2, 50, 100), { level: 2, xp: 150, levelsGained: 0 });
});
test('applyXp : gain pile au seuil → +1 niveau, xp remis à 0', () => {
  assert.deepEqual(L.applyXp(2, 0, 200), { level: 3, xp: 0, levelsGained: 1 });
});
test('applyXp : report du surplus sur le niveau suivant', () => {
  // niv2 (seuil 200) : 150 + 100 = 250 → +1 niveau, reste 50
  assert.deepEqual(L.applyXp(2, 150, 100), { level: 3, xp: 50, levelsGained: 1 });
});
test('applyXp : gros gain → montée multi-niveaux + report', () => {
  // niv1→ seuils 100/200/300 : 650 → -100(n2) -200(n3) -300(n4), reste 50
  assert.deepEqual(L.applyXp(1, 0, 650), { level: 4, xp: 50, levelsGained: 3 });
});
test('applyXp : gain nul = no-op', () => {
  assert.deepEqual(L.applyXp(2, 30, 0), { level: 2, xp: 30, levelsGained: 0 });
});
