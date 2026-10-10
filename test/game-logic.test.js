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
test('applyHealBonus : la stat `soins` est ADDITIVE producteur + receveur', () => {
  // aucun bonus
  assert.equal(L.applyHealBonus(100, {}), 100);
  // producteur seul / receveur seul / les deux (additif, pas multiplicatif : 110 x 1,2 ferait 132)
  assert.equal(L.applyHealBonus(100, { producerSoins: 10 }), 110);
  assert.equal(L.applyHealBonus(100, { receiverSoins: 20 }), 120);
  assert.equal(L.applyHealBonus(100, { producerSoins: 10, receiverSoins: 20 }), 130);
  // producteur = receveur -> compte UNE FOIS, comme producteur (decision MJ 2026-10-05)
  assert.equal(L.applyHealBonus(100, { producerSoins: 10, receiverSoins: 20, sameActor: true }), 110);
  // une potion n'a pas de producteur : seul le receveur compte
  assert.equal(L.applyHealBonus(100, { receiverSoins: 18 }), 118);
});

test('applyHealBonus : Miracule sur le RECU, Hemorragie sur tout', () => {
  // Miracule = +50 % des soins RECUS (sens corrige le 2026-10-05) : cote receveur seulement
  assert.equal(L.applyHealBonus(100, { receiverBuffs: ['miracule'] }), 150);
  assert.equal(L.applyHealBonus(100, { producerBuffs: ['miracule'] }), 100);
  // Hemorragie = -50 %, que le porteur soigne ou soit soigne
  assert.equal(L.applyHealBonus(100, { receiverBuffs: ['hemorragie'] }), 50);
  assert.equal(L.applyHealBonus(100, { producerBuffs: ['hemorragie'] }), 50);
  // des deux cotes : applique UNE SEULE FOIS (« reduit de 50 % », pas un cumul a 25 %)
  assert.equal(L.applyHealBonus(100, { producerBuffs: ['hemorragie'], receiverBuffs: ['hemorragie'] }), 50);
  // les deux buffs : 1,5 x 0,5
  assert.equal(L.applyHealBonus(100, { receiverBuffs: ['miracule', 'hemorragie'] }), 75);
  // la stat et les buffs se composent : (1 + 0,20) x 1,5
  assert.equal(L.applyHealBonus(100, { receiverSoins: 20, receiverBuffs: ['miracule'] }), 180);
});

test('lifestealHeal : regle PROPRE (Miracule +25 %, Hemorragie -50 %), `soins` exclu', () => {
  // 10 % d'omnivamp sur 200 degats = 20, sans buff
  assert.equal(L.lifestealHeal(200, 'physique', { omni: 10 }, false), 20);
  assert.equal(L.lifestealHeal(200, 'physique', { omni: 10 }, false, ['miracule']), 25);   // +25 %, PAS +50 %
  assert.equal(L.lifestealHeal(200, 'physique', { omni: 10 }, false, ['hemorragie']), 10); // -50 %
  assert.equal(L.lifestealHeal(200, 'physique', { omni: 10 }, false, ['miracule', 'hemorragie']), 13);
  // le vol de vie ne compte que sur une attaque de BASE, et le multiplicateur s'y applique aussi
  assert.equal(L.lifestealHeal(200, 'physique', { vol: 10 }, true, ['miracule']), 25);
  assert.equal(L.lifestealHeal(200, 'physique', { vol: 10 }, false), 0);
});

test('buildDefaultState convertit ratios en valeurs absolues', () => {
  // base dérivée des caracs + niveau (moteur refondu), pas d'un champ stats figé
  const char = {
    id:'rathael', hpCur:1.0, manaCur:0.5, shieldCur:99,
    fatigue:1, eau:3, buffs:['bravoure'],
    attrs:{ force:4, hab:3, mental:4, magie:1 }, level:2, shieldMax:200,
  };
  const base = L.computeStats(4, 3, 4, 1, 2);
  const s = L.buildDefaultState(char);
  assert.equal(s.hpCur, base.hp);                       // ratio 1.0
  assert.equal(s.manaCur, Math.round(0.5 * base.mana)); // ratio 0.5
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
  for (const v of ['helmet','armor','ring','weapon','accessory','boots'])
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

test('sumRuneMods : lethaAdp suit le MÊME choix AD/AP que la rune (Sadisme)', () => {
  const fam = [{ key:'d', name:'D', color:'#fff', theme:'t', capstone:'c', paths:[
    { key:'s', name:'S', nodes:[
      { id:'sad', tier:'mineure', name:'+15 AD ou AP et 10 léthalité', desc:'', mods:{ adp:15, lethaAdp:10 } },
    ]},
  ]}];
  const idx = L.buildRuneIndex(fam);
  // AD choisi → AD + léthalité PHYSIQUE
  assert.deepEqual(L.sumRuneMods(['sad'], { sad:'ad' }, idx), { ad:15, letha:10 });
  // AP choisi → AP + léthalité MAGIQUE (les deux clés suivent le même choix)
  assert.deepEqual(L.sumRuneMods(['sad'], { sad:'ap' }, idx), { ap:15, lethaMag:10 });
  // sans choix explicite → défaut AD
  assert.deepEqual(L.sumRuneMods(['sad'], {}, idx), { ad:15, letha:10 });
});

test('runeHasAdpChoice détecte toute clé « au choix AD/AP »', () => {
  assert.equal(L.runeHasAdpChoice({ mods:{ adp:30 } }), true);
  assert.equal(L.runeHasAdpChoice({ mods:{ lethaAdp:10 } }), true);
  assert.equal(L.runeHasAdpChoice({ mods:{ hp:50 } }), false);
  assert.equal(L.runeHasAdpChoice({ kind:'reminder' }), false);
  assert.equal(L.runeHasAdpChoice(null), false);
  // un adp porté UNIQUEMENT par la pente compte aussi (sinon pas de toggle AD/AP)
  assert.equal(L.runeHasAdpChoice({ perLevel:{ adp:3 } }), true);
  assert.equal(L.runeHasAdpChoice({ perLevel:{ hp:6 } }), false);
});

test('runeNodeMods : socle + pente par niveau (2026-10-03)', () => {
  const agr = { id:'agr', mods:{ adp:24 }, perLevel:{ adp:3 } };
  assert.deepEqual(L.runeNodeMods(agr, 2),  { adp:30 });   // 24 + 3×2
  assert.deepEqual(L.runeNodeMods(agr, 10), { adp:54 });
  assert.deepEqual(L.runeNodeMods(agr, 18), { adp:78 });
  // niveau absent/0/négatif → niveau 1, JAMAIS 0 (un appelant qui oublie ne doit pas annuler la pente)
  assert.deepEqual(L.runeNodeMods(agr),     { adp:27 });
  assert.deepEqual(L.runeNodeMods(agr, 0),  { adp:27 });
  assert.deepEqual(L.runeNodeMods(agr, -5), { adp:27 });
  // une stat peut avoir un socle sans pente et inversement
  assert.deepEqual(L.runeNodeMods({ mods:{ hp:55, omni:5 }, perLevel:{ hp:6 } }, 2), { hp:67, omni:5 });
  // pente décimale : arrondie, jamais laissée en flottant
  assert.deepEqual(L.runeNodeMods({ mods:{ adp:12 }, perLevel:{ adp:1.5 } }, 5), { adp:20 });  // 12+7,5 → 20
  // rune plate : inchangée ; rune sans mods : vide
  assert.deepEqual(L.runeNodeMods({ mods:{ hp:100 } }, 18), { hp:100 });
  assert.deepEqual(L.runeNodeMods({ kind:'reminder' }, 18), {});
  assert.deepEqual(L.runeNodeMods(null, 18), {});
});

test('runeNodeMods : progression par PALIERS (levelSteps, Mobilité 2026-10-03)', () => {
  // table du MJ : 1-5 -> 5 % de crit, 6-11 -> 6 %, 12-18 -> 7 %
  const mob = { id:'mob', levelSteps:[
    { from:1,  mods:{ crit:5 } },
    { from:6,  mods:{ crit:6 } },
    { from:12, mods:{ crit:7 } },
  ]};
  for (const l of [1, 2, 3, 4, 5])        assert.deepEqual(L.runeNodeMods(mob, l), { crit:5 }, 'niv ' + l);
  for (const l of [6, 7, 10, 11])         assert.deepEqual(L.runeNodeMods(mob, l), { crit:6 }, 'niv ' + l);
  for (const l of [12, 15, 18, 30])       assert.deepEqual(L.runeNodeMods(mob, l), { crit:7 }, 'niv ' + l);
  // un palier REMPLACE le precedent, il ne s'empile pas
  assert.deepEqual(L.runeNodeMods(mob, 18), { crit:7 });
  // niveau absent/0 -> premier palier (jamais rien)
  assert.deepEqual(L.runeNodeMods(mob), { crit:5 });
  assert.deepEqual(L.runeNodeMods(mob, 0), { crit:5 });
  // cumul des trois sources : socle + pente + palier
  const mix = { id:'mix', mods:{ hp:10 }, perLevel:{ hp:2 }, levelSteps:[{ from:1, mods:{ crit:5 } }, { from:10, mods:{ crit:9 } }] };
  assert.deepEqual(L.runeNodeMods(mix, 2),  { hp:14, crit:5 });
  assert.deepEqual(L.runeNodeMods(mix, 10), { hp:30, crit:9 });
  // aucun levelSteps -> runeLevelStep rend null, rien ne change
  assert.equal(L.runeLevelStep({ mods:{ hp:1 } }, 5), null);
  assert.equal(L.runeLevelStep(null, 5), null);
});

test('runeHasAdpChoice : un adp porté par un PALIER compte aussi', () => {
  assert.equal(L.runeHasAdpChoice({ levelSteps:[{ from:1, mods:{ adp:5 } }] }), true);
  assert.equal(L.runeHasAdpChoice({ levelSteps:[{ from:1, mods:{ crit:5 } }] }), false);
});

test('sumRuneMods : la pente suit le niveau ET le choix AD/AP', () => {
  const fam = [{ key:'c', name:'C', color:'#fff', theme:'t', paths:[
    { key:'t', name:'T', nodes:[
      { id:'ten', tier:'mineure', name:'+37 HP et 11 AD ou AP', desc:'',
        mods:{ hp:37, adp:11 }, perLevel:{ hp:4, adp:2 } },
    ]},
  ]}];
  const idx = L.buildRuneIndex(fam);
  assert.deepEqual(L.sumRuneMods(['ten'], {}, idx, 2),         { hp:45, ad:15 });
  assert.deepEqual(L.sumRuneMods(['ten'], { ten:'ap' }, idx, 2), { hp:45, ap:15 });
  assert.deepEqual(L.sumRuneMods(['ten'], {}, idx, 18),        { hp:109, ad:47 });
});

/* --- Runes « N domaines au choix » (pick, 2026-10-04) --- */
const PICK2 = { id:'dur', pick:{ count:2, options:[
  { key:'vit',    label:'Vitalité',     mods:{ hp:35 }, perLevel:{ hp:5 } },
  { key:'armure', label:'Armure',       mods:{ armure:16 } },
  { key:'resmag', label:'Rés. magique', mods:{ resmag:16 } },
]}};

test('runePickKeys : choix normalisé, tronqué, complété par défaut', () => {
  assert.deepEqual(L.runePickKeys(PICK2, 'vit,armure'),  ['vit', 'armure']);
  assert.deepEqual(L.runePickKeys(PICK2, 'armure,vit'),  ['armure', 'vit']);   // ordre du joueur conservé
  // choix absent / vide / inconnu → les `count` PREMIÈRES options (bonus déterministe)
  assert.deepEqual(L.runePickKeys(PICK2, null),          ['vit', 'armure']);
  assert.deepEqual(L.runePickKeys(PICK2, ''),            ['vit', 'armure']);
  assert.deepEqual(L.runePickKeys(PICK2, 'nawak'),       ['vit', 'armure']);
  // choix partiel → complété ; trop de clés → tronqué ; doublon ignoré ; espaces tolérés
  assert.deepEqual(L.runePickKeys(PICK2, 'resmag'),              ['resmag', 'vit']);
  assert.deepEqual(L.runePickKeys(PICK2, 'vit,armure,resmag'),   ['vit', 'armure']);
  assert.deepEqual(L.runePickKeys(PICK2, 'vit,vit'),             ['vit', 'armure']);
  assert.deepEqual(L.runePickKeys(PICK2, ' vit , resmag '),      ['vit', 'resmag']);
  // un nœud sans pick n'a pas de domaines
  assert.deepEqual(L.runePickKeys({ mods:{ hp:10 } }, 'vit'), []);
  assert.equal(L.runeHasPick(PICK2), true);
  assert.equal(L.runeHasPick({ mods:{ hp:10 } }), false);
  assert.equal(L.runePickCount(PICK2), 2);
});

test('runePickToggle : le plus ancien choix cède la place, jamais moins de `count`', () => {
  assert.equal(L.runePickToggle(PICK2, 'vit,armure', 'resmag'), 'armure,resmag');  // 'vit' sort
  assert.equal(L.runePickToggle(PICK2, 'armure,resmag', 'vit'), 'resmag,vit');
  // cliquer un domaine DÉJÀ retenu ne le retire pas (sinon la rune gravée vaudrait moins)
  assert.equal(L.runePickToggle(PICK2, 'vit,armure', 'vit'),    'vit,armure');
  assert.equal(L.runePickToggle(PICK2, 'vit,armure', 'armure'), 'vit,armure');
  // clé inconnue : sans effet ; nœud sans pick : le choix passe tel quel
  assert.equal(L.runePickToggle(PICK2, 'vit,armure', 'nawak'),  'vit,armure');
  assert.equal(L.runePickToggle({ mods:{ hp:1 } }, 'ad', 'ap'), 'ad');
});

test('runeNodeMods : les domaines retenus s\'ajoutent, pente comprise', () => {
  assert.deepEqual(L.runeNodeMods(PICK2, 2,  'vit,armure'),    { hp:45, armure:16 });
  assert.deepEqual(L.runeNodeMods(PICK2, 18, 'vit,armure'),    { hp:125, armure:16 });  // 35 + 5×18
  assert.deepEqual(L.runeNodeMods(PICK2, 18, 'armure,resmag'), { armure:16, resmag:16 });
  // sans choix : les deux premières options, jamais rien
  assert.deepEqual(L.runeNodeMods(PICK2, 2),                   { hp:45, armure:16 });
  // un pick de 1 parmi 2 cumule avec les mods de base du nœud
  const cc = { id:'cc', mods:{ rescrit:25, hp:20 }, perLevel:{ hp:3 }, pick:{ count:1, options:[
    { key:'armure', label:'Armure', mods:{ armure:8 } },
    { key:'resmag', label:'Rés. magique', mods:{ resmag:8 } },
  ]}};
  assert.deepEqual(L.runeNodeMods(cc, 2,  'armure'), { rescrit:25, hp:26, armure:8 });
  assert.deepEqual(L.runeNodeMods(cc, 18, 'resmag'), { rescrit:25, hp:74, resmag:8 });
});

test('runeNodeMods : pente ACCELEREE (`accel`, mana 2026-10-05)', () => {
  // gain du niveau L = perLevel + accel x (L-1)  =>  total = mods + perLevel.L + accel.L(L-1)/2
  const man = { id:'man', mods:{ mana:60 }, perLevel:{ mana:13.5, ap:2 }, accel:{ mana:0.75 } };
  assert.deepEqual(L.runeNodeMods(man, 2),  { mana:88,  ap:4 });   // 60 + 27 + 0,75x1   = 87,75
  assert.deepEqual(L.runeNodeMods(man, 10), { mana:229, ap:20 });  // 60 + 135 + 0,75x45 = 228,75
  assert.deepEqual(L.runeNodeMods(man, 18), { mana:418, ap:36 });  // 60 + 243 + 0,75x153 = 417,75
  // au niveau 1, `accel` n'ajoute RIEN (L(L-1)/2 = 0) : la pente n'a pas encore acceleree
  assert.deepEqual(L.runeNodeMods(man, 1), { mana:74, ap:2 });
  // accel sans perLevel, et accel nul : les deux restent lisibles
  assert.deepEqual(L.runeNodeMods({ mods:{ mana:10 }, accel:{ mana:2 } }, 4), { mana:22 });  // 10 + 2x6
  assert.deepEqual(L.runeNodeMods({ mods:{ mana:10 }, accel:{ mana:0 } }, 9), { mana:10 });
});

test('runePick : les GROUPES tiennent « 2 domaines parmi 3 » (Presage)', () => {
  const pre = { id:'pre', pick:{ count:2, options:[
    { key:'off_ad', group:'off',  mods:{ ad:12 }, perLevel:{ ad:1.5 } },
    { key:'off_ap', group:'off',  mods:{ ap:12 }, perLevel:{ ap:1.5 } },
    { key:'def_ar', group:'def',  mods:{ armure:16 } },
    { key:'def_rm', group:'def',  mods:{ resmag:16 } },
    { key:'soins',  group:'heal', mods:{ soins:9 } },
  ]}};
  // defaut : jamais deux options du MEME groupe (sinon la rune vaudrait moins que son cout)
  assert.deepEqual(L.runePickKeys(pre, null), ['off_ad', 'def_ar']);
  // un choix qui doublonne un groupe est nettoye, puis complete par un groupe libre
  assert.deepEqual(L.runePickKeys(pre, 'off_ad,off_ap'), ['off_ad', 'def_ar']);
  assert.deepEqual(L.runePickKeys(pre, 'soins,def_rm'), ['soins', 'def_rm']);
  // changer de SOUS-choix (AD -> AP) remplace la soeur, PAS l'autre domaine
  assert.equal(L.runePickToggle(pre, 'off_ad,def_ar', 'off_ap'), 'def_ar,off_ap');
  assert.equal(L.runePickToggle(pre, 'off_ad,def_ar', 'def_rm'), 'off_ad,def_rm');
  // changer de DOMAINE fait sortir le plus ancien
  assert.equal(L.runePickToggle(pre, 'off_ad,def_ar', 'soins'), 'def_ar,soins');
  // les mods suivent, pente comprise
  assert.deepEqual(L.runeNodeMods(pre, 18, 'off_ap,soins'), { ap:39, soins:9 });
  assert.deepEqual(L.runeNodeMods(pre, 2,  'def_rm,soins'), { resmag:16, soins:9 });
});

test('sumRuneMods résout les domaines au choix (vraie data.jsx)', () => {
  const idx = L.buildRuneIndex([{ key:'v', name:'V', color:'#fff', theme:'t', paths:[
    { key:'d', name:'D', nodes:[PICK2] },
  ]}]);
  assert.deepEqual(L.sumRuneMods(['dur'], { dur:'armure,resmag' }, idx, 18), { armure:16, resmag:16 });
  assert.deepEqual(L.sumRuneMods(['dur'], { dur:'vit,resmag' },    idx, 2),  { hp:45, resmag:16 });
  // choix absent → défaut, pas de bonus perdu
  assert.deepEqual(L.sumRuneMods(['dur'], {}, idx, 2), { hp:45, armure:16 });
});

test('mitigateDamage : la léthalité magique réduit la rés. magique (miroir du physique)', () => {
  // Même formule que le physique : eff = max(0, RM − léth), réduction = eff/(eff+100).
  assert.equal(L.mitigateDamage(100, 'magique', { resmag: 100 }, 0), 50);
  assert.equal(L.mitigateDamage(100, 'magique', { resmag: 100 }, 50), 67);  // eff 50 → 33 % réduit
  assert.equal(L.mitigateDamage(100, 'magique', { resmag: 100 }, 100), 100); // eff 0
  assert.equal(L.mitigateDamage(100, 'magique', { resmag: 100 }, 999), 100); // borné à 0
  // La léthalité magique n'agit PAS sur l'armure (le type pilote la stat visée).
  assert.equal(L.mitigateDamage(100, 'physique', { armure: 100, resmag: 0 }, 0), 50);
});

test('mergeMods additionne deux objets de mods', () => {
  assert.deepEqual(L.mergeMods({ hp:50, ad:10 }, { ad:20, ap:5 }), { hp:50, ad:30, ap:5 });
});

/* --- Combat (vue MJ ennemis) : mitigation Excel + bouclier/HP --- */
test('mitigateDamage — physique : AR/(AR+100)', () => {
  // MITIGATION_K = 100 depuis le 2026-09-12 (était 120). AR=K → réduction 0.5.
  assert.equal(L.mitigateDamage(100, 'physique', { armure: 100 }), 50);
  // Verrou explicite de la constante : à AR=120 la réduction vaut 120/220, pas 0.5.
  assert.equal(L.mitigateDamage(100, 'physique', { armure: 120 }), 46); // ceil(100*(1-120/220))
  assert.equal(L.mitigateDamage(100, 'physique', { armure: 300 }), 25); // 300/400 = 75 % réduit
});

test('mitigateDamage — magique utilise resmag', () => {
  assert.equal(L.mitigateDamage(100, 'magique', { resmag: 100 }), 50);
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

test('verrous 1x/combat et 1x/jour : « Combat » garde ceux du jour, « Nouveau jour » ne leve qu eux', () => {
  assert.notEqual(L.SKILL_CD_DAY, L.SKILL_CD_COMBAT);
  assert.equal(L.skillLockValue({ kind: 'day' }, 4), L.SKILL_CD_DAY);
  assert.equal(L.skillLockValue({ kind: 'combat' }, 4), L.SKILL_CD_COMBAT);
  assert.equal(L.skillLockValue({ kind: 'turn', cd: 1 }, 4), 5);
  assert.equal(L.skillLockValue({ kind: 'cd', cd: 3 }, 4), 7);
  assert.equal(L.cooldownReady(L.SKILL_CD_DAY, 500), false);
  const cds = { salve_corsaire: L.SKILL_CD_DAY, dash_tactique: 7, w_decimation: L.SKILL_CD_COMBAT };
  // « ⟲ Combat » : tout part SAUF le verrou du jour (la Decimation d arme reste 1x/combat)
  assert.deepEqual(L.cooldownsAfterCombat(cds), { salve_corsaire: L.SKILL_CD_DAY });
  assert.equal(L.cooldownsAfterCombat({ dash_tactique: 7 }), null);   // null = noeud supprime
  assert.equal(L.cooldownsAfterCombat(undefined), null);
  // « ☀ Nouveau jour » : ne touche pas aux cooldowns d un combat en cours
  assert.deepEqual(L.dayUnlockPatch(cds), { salve_corsaire: null });
  assert.equal(L.dayUnlockPatch({ dash_tactique: 7 }), null);
});

test('nextReadyAt = tour + cd', () => {
  assert.equal(L.nextReadyAt(3, 3), 6);
  assert.equal(L.nextReadyAt(7, 1), 8);
});

/* --- Task 2 : Elias (Fab.gs) --- */
test('Elias passif : 6 % de l AD de base par charge, 5 charges + 1 tous les 4 niveaux (2026-10-10)', () => {
  assert.equal(L.eliasPassiveAD(187, 1), 11);    // 15 avant, au niveau 2
  assert.equal(L.eliasPassiveAD(187, 5), 56);    // +56 a pleines charges (c etait +75)
  assert.equal(L.eliasPassiveAD(100, 0), 0);
  assert.deepEqual([1, 4, 5, 9, 13, 17, 18].map(L.eliasMaxStacks), [5, 5, 6, 7, 8, 9, 9]);
});
test('Elias competences, rang 1 du 2026-10-10 (ratios deja convertis x0,6)', () => {
  const eff = { ad: 100, ap: 0, hp: 500 };
  assert.equal(L.dmgEliasC1(eff, false), 66);
  assert.equal(L.dmgEliasC1(eff, true), 82);         // +25 % au premier coup
  assert.equal(L.dmgEliasC2(eff), 66);
  assert.equal(L.dmgEliasC3(eff, false), 96);        // a distance
  assert.equal(L.dmgEliasC3(eff, true), 84);         // en melee
  assert.equal(L.dmgEliasC4(eff), 78);
  assert.equal(L.eliasC4Heal(eff, 1), 40);           // 8 % des PV max par cible touchee
  assert.equal(L.eliasC4Heal(eff, 4), 160);
  assert.equal(L.eliasC4Heal(eff, 0), 0);
  assert.equal(L.skillHeal(250, 0.05), 12);
});

/* --- Task 3 : Smith (Erwan.gs) --- */
test('Smith, rang 1 du 2026-10-10 : Attaque sournoise en multiple de l attaque de base', () => {
  assert.equal(L.dmgSmithPassif({ ap: 100 }), 100);                       // Fletrissement : non converti
  const eff = { ad: 100, ap: 0 };
  assert.equal(L.dmgSmithC1('Physique', eff, false, false), 60);          // x1   = l attaque de base
  assert.equal(L.dmgSmithC1('Physique', eff, true, false), 90);           // x1,5 camoufle
  assert.equal(L.dmgSmithC1('Physique', eff, false, true), 120);          // x2   cible marquee
  assert.equal(L.dmgSmithC1('Physique', eff, true, true), 270);           // x4,5 marquee ET camoufle (pas x3)
  assert.equal(L.dmgSmithC1('Magique', { ad: 100, ap: 50 }, false, false), 30);   // suit le type d arme
  assert.deepEqual([L.smithC1CritBonus(true), L.smithC1CritBonus(false)], [30, 0]);
  assert.equal(L.dmgSmithC3({ ad: 150 }), 108);                           // 72 % AD
  assert.equal(L.smithBleed({ ad: 150 }), 30);                            // 20 % AD, un NOMBRE de degats bruts
  assert.equal(L.smithBleedPct, undefined);                               // l ancien pourcentage est abandonne
});

/* --- Task 4 : Urskaar (Baptiste.gs + kit C3/C4) --- */
test('Urskaar Voie de l ours', () => {
  assert.equal(L.bearBonusPct(4), 0);
  assert.equal(L.bearBonusPct(5), 50);      // +50 % de l attaque de base a 5 cases annoncees
  assert.equal(L.bearBonusPct(8), 75);      // +25 % par tranche de 3 cases
  assert.equal(L.bearBonusPct(11), 100);
  assert.equal(L.bearTranches(5), 1);
  assert.equal(L.bearTranches(8), 2);
  const eff = { ad: 100, ap: 50 };
  // C1 gauche : 72 % AD + 18 % par tranche ; droite : 54 % + 6 %, etourdit a 50 % + 10 %
  assert.deepEqual([0, 5, 8, 11].map(m => L.dmgUrskaarC1(eff, 'gauche', m)), [72, 90, 108, 126]);
  assert.deepEqual([0, 5, 8, 11].map(m => L.dmgUrskaarC1(eff, 'droite', m)), [54, 60, 66, 72]);
  assert.deepEqual([0, 5, 8, 11, 40].map(L.urskaarStunPct), [50, 60, 70, 80, 100]);
  assert.deepEqual([0, 5, 8].map(m => L.dmgUrskaarC2(eff, m)), [90, 105, 120]);
  assert.equal(L.urskaarC3Shield({ ap: 0 }, 1000), 300);
  assert.equal(L.urskaarC3Shield({ ap: 50 }, 1000), 500);    // +20 % par 50 AP
  assert.equal(L.urskaarC3Shield({ ap: 25 }, 1000), 400);    // calcul continu, pas par paliers
  assert.deepEqual([0, 5, 8].map(m => L.dmgUrskaarC4(eff, m)), [42, 54, 66]);
  // allie adjacent : le quart de ce qu un ennemi subirait (10,5 % AD + 3 % par tranche)
  assert.deepEqual([0, 5].map(m => L.dmgUrskaarC4Ally({ ad: 200 }, m)), [21, 27]);
});

/* --- Task 5 : Jett (Steph.gs) --- */
test('Jett Nano-hextech', () => {
  assert.equal(L.jettEngins({ ad: 0 }, false), 1);
  assert.equal(L.jettEngins({ ad: 150 }, false), 3);
  assert.equal(L.jettEngins({ ad: 150 }, true), 6);
  // paliers d AD : 50 / 125 / 225 / 375 / 550 (le 5e ajoute le 2026-10-10)
  assert.deepEqual([49, 50, 125, 225, 375, 549, 550, 900].map(ad => L.jettEngins({ ad }, false)), [1, 2, 3, 4, 5, 5, 6, 6]);
  assert.equal(L.dmgJettPoison({ ap: 100 }), 45);     // 15 + 30 % AP
  assert.equal(L.dmgJettForce({ ad: 100 }), 45);      // 15 + 30 % AD
  assert.equal(L.dmgJettC2({ ad: 100 }), 36);
  assert.equal(L.healJettC2({ ap: 100 }), 120);       // 40 + 80 % AP = 2 x le soin de la C1
  assert.equal(L.healJettC1({ ap: 100 }), 60);        // 20 + 40 % AP
  assert.equal(L.shieldJettC1({ ap: 100 }), 75);      // 25 + 50 % AP
  assert.equal(L.jettC1ManaPct({ ap: 100 }), 17.5);   // 15 % + 1 % par 40 AP
});
test('Jett C1 Remodulation : 10 configurations equiprobables, chacune avec son effet', () => {
  assert.equal(L.JETT_C1_EFFECTS.length, 10);
  // chance egale : dix tranches de 10 %
  const seen = L.JETT_C1_EFFECTS.map((e, i) => L.jettC1Roll(() => (i + 0.5) / 10));
  assert.deepEqual(seen, L.JETT_C1_EFFECTS.map(e => e.id));
  assert.equal(L.jettC1Roll(() => 0.999999), 'mana');
  const eff = { ad: 100, ap: 200 };
  assert.equal(L.jettC1Damage(eff, 'poison'), 75);          // sur l AP
  assert.equal(L.jettC1Damage(eff, 'attraction'), 45);      // sur l AD
  assert.equal(L.jettC1Damage(eff, 'repoussement'), 45);
  assert.equal(L.jettC1Damage(eff, 'flash'), null);
  assert.equal(L.jettC1Damage(eff, ''), null);
  assert.equal(L.jettC1Effect('poison').dmgType, 'magique');
  assert.equal(L.jettC1Heal(eff, 'soin'), 100);
  assert.equal(L.jettC1Heal(eff, 'poison'), null);
  assert.deepEqual(L.jettC1Boon(eff, 'bouclier'), { shield: 125, label: 'Bouclier de 125' });
  assert.equal(L.jettC1Boon(eff, 'mana').manaPct, 20);
  assert.equal(L.jettC1Boon(eff, 'soin'), null);
});

/* --- Task 6 : sumPassiveMods --- */
test('sumPassiveMods : Elias = 6 % de l AD de BASE par charge, plafonne aux charges du niveau', () => {
  assert.deepEqual(L.sumPassiveMods('lunick', { chasseur: 3 }, 2, { ad: 200 }), { ad: 36 });
  assert.deepEqual(L.sumPassiveMods('lunick', { chasseur: 5 }, 2, { ad: 200 }), { ad: 60 });
  // un compteur reste au-dessus du nouveau plafond (6 charges au niveau 4 avant le 2026-10-10)
  assert.deepEqual(L.sumPassiveMods('lunick', { chasseur: 6 }, 4, { ad: 200 }), { ad: 60 });
  assert.deepEqual(L.sumPassiveMods('lunick', { chasseur: 6 }, 5, { ad: 200 }), { ad: 72 });
  assert.deepEqual(L.sumPassiveMods('lunick', { chasseur: 3 }, 2), {});          // sans stats de base : rien
  assert.deepEqual(L.sumPassiveMods('lunick', {}, 2, { ad: 200 }), {});
  // la case « toutes les cibles touchees » est un aide-memoire : aucun effet sur le calcul
  assert.deepEqual(L.sumPassiveMods('lunick', { chasseur: 3, chasseurTous: 1 }, 2, { ad: 200 }), { ad: 36 });
  assert.deepEqual(L.sumPassiveMods('smith', { marques: 2 }, 2), {});
  assert.deepEqual(L.sumPassiveMods('rathael', { glaciation: 3 }, 2), {});
});

/* --- Buffs sur soi : sumSkillBuffs --- */
test('sumSkillBuffs somme les mods plats par compétence', () => {
  assert.deepEqual(L.sumSkillBuffs({ demi_ours: { hp: 60, ad: 30 }, autre: { ad: 10 } }), { hp: 60, ad: 40 });
  assert.deepEqual(L.sumSkillBuffs({}), {});
  assert.deepEqual(L.sumSkillBuffs(null), {});
});

test('sumSkillBuffs : nouvelle forme {mods,until} + filtrage par tour', () => {
  const buffs = { mur_de_givre: { mods: { armure: 20, resmag: 20 }, until: 3 } };
  assert.deepEqual(L.sumSkillBuffs(buffs, 3), { armure: 20, resmag: 20 }); // tour <= until : actif
  assert.deepEqual(L.sumSkillBuffs(buffs, 4), {});                          // tour > until : expiré
  assert.deepEqual(L.sumSkillBuffs(buffs), { armure: 20, resmag: 20 });     // sans tour : pas de filtre
  assert.deepEqual(L.sumSkillBuffs({ x: { mods: { ad: 5 }, until: null } }, 99), { ad: 5 }); // until null = permanent
  // mélange ancienne (plate) + nouvelle forme, filtrage actif
  assert.deepEqual(L.sumSkillBuffs({ a: { ad: 10 }, b: { mods: { ad: 5 }, until: 2 } }, 1), { ad: 15 });
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

/* --- Task XP : courbe officielle du MJ (180 + 100*level), cap niveau 18 --- */
test('xpToNext suit la table du MJ (180 + 100*level)', () => {
  assert.equal(L.xpToNext(1), 280);
  assert.equal(L.xpToNext(2), 380);
  assert.equal(L.xpToNext(5), 680);
  assert.equal(L.xpToNext(17), 1880);
});
test('xpToNext au cap (niveau 18) = Infinity', () => {
  assert.equal(L.xpToNext(18), Infinity);
  assert.equal(L.MAX_LEVEL, 18);
});
test('applyXp : gain sans montée de niveau', () => {
  assert.deepEqual(L.applyXp(2, 50, 100), { level: 2, xp: 150, levelsGained: 0 });
});
test('applyXp : gain pile au seuil → +1 niveau, xp remis à 0', () => {
  assert.deepEqual(L.applyXp(2, 0, 380), { level: 3, xp: 0, levelsGained: 1 });
});
test('applyXp : report du surplus sur le niveau suivant', () => {
  // niv2 (seuil 380) : 150 + 300 = 450 → +1 niveau, reste 70
  assert.deepEqual(L.applyXp(2, 150, 300), { level: 3, xp: 70, levelsGained: 1 });
});
test('applyXp : gros gain → montée multi-niveaux + report', () => {
  // niv1→ seuils 280/380/480 : 1190 → -280(n2) -380(n3) -480(n4), reste 50
  assert.deepEqual(L.applyXp(1, 0, 1190), { level: 4, xp: 50, levelsGained: 3 });
});
test('applyXp : gain nul = no-op', () => {
  assert.deepEqual(L.applyXp(2, 30, 0), { level: 2, xp: 30, levelsGained: 0 });
});
test('applyXp : montée jusqu’au cap, surplus jeté', () => {
  // depuis le niveau 17, un gros gain mène au cap 18 et fige l'XP à 0
  assert.deepEqual(L.applyXp(17, 0, 99999), { level: 18, xp: 0, levelsGained: 1 });
  // au cap, plus aucune progression
  assert.deepEqual(L.applyXp(18, 0, 5000), { level: 18, xp: 0, levelsGained: 0 });
});

/* --- Refonte : escalade --- */
const approx = (a, b, tol = 2) => Math.abs(a - b) <= tol;
/* ⚠️ Table RECALIBRÉE le 2026-09-05 (décision A/B) : escalade locale ramenée à
   +1 %/point, `p × (1 + 0,010·(p−1))`. Elle ne correspond plus au §4.3 de la spec
   hypermétrique — ce qu'elle perd est rendu par `globalEscalation` (test suivant). */
test('escalationFactor : escalade locale +1 %/point', () => {
  assert.equal(L.escalationFactor(0), 0);
  assert.ok(approx(L.escalationFactor(4), 4.12, 0.001));
  assert.ok(approx(L.escalationFactor(8), 8.56, 0.001));
  assert.ok(approx(L.escalationFactor(13), 14.56, 0.001));
  assert.ok(approx(L.escalationFactor(16), 18.40, 0.001));
  assert.ok(approx(L.escalationFactor(20), 23.80, 0.001));
});
test('escalationFactor : zone PNJ (>20) reste quadratique', () => {
  // Le mult marginal repart de celui du 20e point (1.38) et gagne 0,5 par point.
  assert.ok(approx(L.escalationFactor(25), 38.20, 0.01));
  // strictement croissant et accélérant : un gros monstre reste hors barème PJ
  const d21 = L.escalationFactor(21) - L.escalationFactor(20);
  const d25 = L.escalationFactor(25) - L.escalationFactor(24);
  assert.ok(d25 > d21);
});
test('globalEscalation : +0,49 % par point placé, toutes caracs confondues', () => {
  assert.equal(L.globalEscalation(0), 1);
  assert.ok(approx(L.globalEscalation(10), 1.049, 0.0001));   // budget niveau 2
  assert.ok(approx(L.globalEscalation(34), 1.1666, 0.0001));  // budget niveau 18
});
test('la spécialisation reste payante mais ne domine plus (décision B)', () => {
  // Prime d'un build 2 caracs sur un build 3 caracs, au budget du niveau 18 (34 pts).
  const g = L.globalEscalation(34);
  const val = (...pts) => pts.reduce((s, p) => s + L.escalationFactor(p), 0) * g;
  const deux = val(20, 14), trois = val(12, 11, 11);
  const prime = deux / trois - 1;
  // avant : +15 % (le système poussait mécaniquement vers des builds purs)
  assert.ok(prime > 0.03 && prime < 0.09, `prime = ${(prime * 100).toFixed(1)} %`);
  // 17/17 doit rester quasi équivalent à 20/14 : pas de piège à répartir
  assert.ok(Math.abs(val(17, 17) / deux - 1) < 0.02);
});

/* --- Refonte 2026-09-04 : computeStats (nouvelle répartition des caracs) ---
   ⚠️ Les PV ci-dessous NE SONT PLUS les cibles du §9 de la spec hypermétrique : la
   répartition a été rechiffrée par le MJ (Mental 60 PV/pt, Force 20, Magie 10, plus
   de bonus d'armure d'Habileté...). Ce test verrouille le NOUVEAU modèle contre une
   régression silencieuse, il ne prouve pas la conformité à l'ancienne spec. */
test('computeStats : PV des 5 profils types, niveau 18 (±2)', () => {
  // (F,H,M,C) à 33 pts, niveau 18
  assert.ok(approx(L.computeStats(13, 0, 20, 0, 18).hp, 2587)); // Tank
  assert.ok(approx(L.computeStats(20, 0, 0, 13, 18).hp, 1312)); // Carry
  assert.ok(approx(L.computeStats(0, 0, 13, 20, 18).hp, 1881)); // Mage
  assert.ok(approx(L.computeStats(13, 20, 0, 0, 18).hp, 1003)); // Assassin
  assert.ok(approx(L.computeStats(20, 13, 0, 0, 18).hp, 1218)); // Bruiser
});
test('computeStats : les pourcentages sont LINÉAIRES (jamais escaladés)', () => {
  // esc(20) = 23.80 : si le crit était escaladé on lirait 65 % et non 55 %.
  const s = L.computeStats(0, 20, 0, 0, 18);
  assert.equal(s.crit, 55);    // 5 + 2.5*20   (recalibré 2026-09-05)
  assert.equal(s.dcrit, 230);  // 150 + 4*20
  // Rés. crit : 3 %/pt de Mental, sur les points bruts → 60 % à 20 points (pas 86 %).
  assert.equal(L.computeStats(0, 0, 20, 0, 18).rescrit, 60);
});
test('computeStats : seules Force et Habileté portent AD, Magie et Habileté portent AP', () => {
  // Le Mental ne donne plus ni AD/AP, ni crit, ni dégâts crit.
  const m = L.computeStats(0, 0, 20, 0, 1);
  assert.equal(m.crit, 5);
  assert.equal(m.dcrit, 150);
  assert.equal(m.ad, 20);   // fondu seul
  assert.equal(m.ap, 20);
  // La Force et la Magie ne donnent plus de dégâts crit.
  assert.equal(L.computeStats(20, 0, 0, 13, 18).dcrit, 150);
});
test('computeStats : Force/Magie donnent 1 AR/RM de socle + 2 par point dirige', () => {
  // BASE_AR_RM = 5 accorde a tout le monde des le niveau 1 (patch du 2026-09-09).
  // Defaut (tout en degats) : 1 AR par point de Force, escalade, + 1 par niveau.
  assert.equal(L.computeStats(4, 0, 0, 0, 2).armure, 11);  // 5 (socle) + 2 (niveau) + 1*4.20
  assert.equal(L.computeStats(0, 0, 0, 4, 2).resmag, 11);
  // Tout en defense : socle 1 + 2 par point dirige = 3 par point.
  assert.equal(L.computeStats(4, 0, 0, 0, 2, null, null, { ad: 0, armure: 4 }).armure, 20);
  assert.equal(L.computeStats(0, 0, 0, 4, 2, null, null, null, { ap: 0, resmag: 4 }).resmag, 20);
  assert.equal(L.computeStats(0, 0, 0, 0, 18).armure, 23); // 5 (socle) + 18 (niveau)
});
/* --- Repartition Force / Magie : degats / defense (2026-09-06) --- */
test('forceSplit / magieSplit : defaut TOUT EN DEGATS, sur- et sous-allocation', () => {
  assert.deepEqual(L.forceSplit(5, null), { ad: 5, armure: 0 });      // jamais confirmee
  assert.deepEqual(L.magieSplit(5, null), { ap: 5, resmag: 0 });
  assert.deepEqual(L.forceSplit(0, null), { ad: 0, armure: 0 });
  assert.deepEqual(L.forceSplit(4, { ad: 2, armure: 2 }), { ad: 2, armure: 2 });
  // sur-allocation : servie dans l'ordre ad -> armure, coupee au budget
  assert.deepEqual(L.forceSplit(4, { ad: 9, armure: 9 }), { ad: 4, armure: 0 });
  assert.deepEqual(L.magieSplit(4, { ap: 9, resmag: 9 }), { ap: 4, resmag: 0 });
  // sous-allocation : le reliquat part en degats, jamais perdu
  assert.deepEqual(L.forceSplit(4, { armure: 1 }), { ad: 3, armure: 1 });
  assert.deepEqual(L.magieSplit(4, { resmag: 1 }), { ap: 3, resmag: 1 });
  assert.deepEqual(L.forceSplit(4, { ad: -5, armure: 2 }), { ad: 2, armure: 2 });
});
test('computeStats : un point de Force vaut +10 AD OU +2 Armure (socle 15 AD + 1 AR)', () => {
  // Force 6, niveau 1 : esc(6) = 6.30 x globalEscalation(6) = 1.0294 -> eF = 6.485.
  const s = (sp) => L.computeStats(6, 0, 0, 0, 1, null, null, sp);
  const off = s({ ad: 6, armure: 0 }), def = s({ ad: 0, armure: 6 });
  assert.equal(off.ad, 162);      // 15*6.485 (socle) + 10*6.485 (dirige) + 0 de fondu
  assert.equal(off.armure, 12);   // 5 (socle AR/RM) + 1 (niveau) + 1*6.485, rien de dirige
  assert.equal(def.ad, 97);       // socle seul : 15*6.485
  assert.equal(def.armure, 25);   // 5 + 1 + 6.485 + 2*6.485
  // ⚠️ Le defaut (absent) reproduit EXACTEMENT l'ancien AD de 25/pt : c'est ce qui garde
  // valide la matrice de TTK du 2026-09-05, batie sur l'AD. Seule l'armure baisse.
  assert.equal(L.computeStats(6, 0, 0, 0, 1).ad, off.ad);
  assert.equal(L.computeStats(6, 0, 0, 0, 1).armure, off.armure);
});
test('computeStats : repartir la Force ne coute rien (escalade au prorata)', () => {
  const nu = L.computeStats(0, 0, 0, 0, 18);
  // Valeur totale d'un point = son AD + son armure convertie au taux du socle (10 AD <-> 2 AR).
  const val = (sp) => { const s = L.computeStats(20, 0, 0, 0, 18, null, null, sp);
    return (s.ad - nu.ad) + (s.armure - nu.armure) * 5; };
  const tout = val({ ad: 20, armure: 0 });
  assert.ok(Math.abs(val({ ad: 10, armure: 10 }) - tout) <= 3);
  assert.ok(Math.abs(val({ ad: 0, armure: 20 }) - tout) <= 3);
});
test('computeStats : la Magie est le MIROIR exact de la Force', () => {
  const f = L.computeStats(7, 0, 0, 0, 5, null, null, { ad: 3, armure: 4 });
  const c = L.computeStats(0, 0, 0, 7, 5, null, null, null, { ap: 3, resmag: 4 });
  assert.equal(f.ad, c.ap);
  assert.equal(f.armure, c.resmag);
});
test('computeStats : socle de niveau au niveau 1, caracs nulles', () => {
  const s = L.computeStats(0, 0, 0, 0, 1);
  assert.equal(s.hp, 80);      // 50 universel + 30*1 socle
  assert.equal(s.mana, 65);    // 50 universel + 15*1 socle
  assert.equal(s.armure, 6);   // BASE_AR_RM 5 + 1*level (l'Habileté ne donne plus d'AR/RM)
  assert.equal(s.resmag, 6);
  assert.equal(s.ad, 20);      // fondu = max(0, 20 - 0)
  assert.equal(s.ap, 20);      // fondu
  assert.equal(s.rescrit, 0);
});
test('computeStats : bonus de départ Habileté dégressif 25/20/15/10/5, plafonné', () => {
  // PV cumulés attendus par point d'Habileté (socle 80 au niveau 1).
  assert.deepEqual([1, 2, 3, 4, 5].map(h => L.computeStats(0, h, 0, 0, 1).hp),
    [105, 125, 140, 150, 155]);
  // au-delà de 5, le bonus de départ ne grimpe plus
  assert.equal(L.computeStats(0, 8, 0, 0, 1).hp, 155);
  // et il ne donne plus ni armure ni rés. magique
  assert.equal(L.computeStats(0, 5, 0, 0, 1).armure, 6);   // socle seul, rien de l'Habileté
  assert.equal(L.computeStats(0, 5, 0, 0, 1).resmag, 6);
});
test('computeStats : pas de Sapience ni de léthalité dans la base', () => {
  const s = L.computeStats(20, 20, 20, 20, 18);
  assert.equal(s.sapience, undefined);
  assert.equal(s.letha, undefined);
  assert.equal(s.lethaMag, undefined);
});
test('habSplit : defaut par carac de degats dominante (Force >= Magie -> AD)', () => {
  assert.deepEqual(L.habSplit(3, 6, 2, null), { ad: 6, ap: 0, mana: 0 });   // Smith F3/C2
  assert.deepEqual(L.habSplit(1, 6, 4, null), { ad: 0, ap: 6, mana: 0 });   // Jett  F1/C4
  assert.deepEqual(L.habSplit(0, 4, 0, null), { ad: 4, ap: 0, mana: 0 });   // egalite -> AD
  assert.deepEqual(L.habSplit(3, 0, 2, null), { ad: 0, ap: 0, mana: 0 });   // aucun point
});
test('habSplit : normalise une repartition sur- ou sous-allouee', () => {
  assert.deepEqual(L.habSplit(3, 6, 2, { ad: 2, ap: 2, mana: 2 }), { ad: 2, ap: 2, mana: 2 });
  // sur-allocation : servie dans l'ordre ad -> ap -> mana, coupee au budget
  assert.deepEqual(L.habSplit(3, 6, 2, { ad: 5, ap: 5, mana: 5 }), { ad: 5, ap: 1, mana: 0 });
  // sous-allocation : le reliquat part sur la destination par defaut, jamais perdu
  assert.deepEqual(L.habSplit(3, 6, 2, { ad: 2 }),            { ad: 6, ap: 0, mana: 0 });
  assert.deepEqual(L.habSplit(1, 6, 4, { mana: 2 }),          { ad: 0, ap: 4, mana: 2 });
  // valeurs negatives ignorees
  assert.deepEqual(L.habSplit(3, 6, 2, { ad: -5, ap: 6, mana: 0 }), { ad: 0, ap: 6, mana: 0 });
});
test('computeStats : un point d\u2019Habilete vaut +5 AD, +5 AP OU +10 Mana', () => {
  const nu = L.computeStats(0, 0, 0, 0, 1);
  const d = (sp, k) => L.computeStats(0, 6, 0, 0, 1, sp)[k] - nu[k];
  // esc(6) = 6.30, x globalEscalation(6) = 1.0294 -> facteur moyen 6.485 par point
  assert.equal(d({ ad: 6, ap: 0, mana: 0 }, 'ad'), 32);     // 5 * 6.485
  assert.equal(d({ ad: 0, ap: 6, mana: 0 }, 'ap'), 32);
  assert.equal(d({ ad: 0, ap: 0, mana: 6 }, 'mana'), 65);   // 10 * 6.485
  // le Mana d'Habilete s'ajoute au socle sans toucher AD/AP
  assert.equal(d({ ad: 0, ap: 0, mana: 6 }, 'ad'), 0);
});
test('computeStats : l\u2019escalade est GARANTIE a chaque point (repartir ne coute rien)', () => {
  const nu = L.computeStats(0, 0, 0, 0, 18);
  const att = (sp) => (L.computeStats(0, 20, 0, 0, 18, sp).ad - nu.ad)
                    + (L.computeStats(0, 20, 0, 0, 18, sp).ap - nu.ap);
  const tout = att({ ad: 20, ap: 0, mana: 0 });
  // 10/10 doit rendre AUTANT que 20/0 (a l'arrondi pres) : c'est tout l'enjeu du ruling.
  assert.ok(Math.abs(att({ ad: 10, ap: 10, mana: 0 }) - tout) <= 2);
  assert.ok(Math.abs(att({ ad: 7, ap: 13, mana: 0 }) - tout) <= 2);
  // et un point vaut le meme facteur quelle que soit la destination
  const mana = L.computeStats(0, 20, 0, 0, 18, { mana: 20 }).mana - nu.mana;
  assert.ok(Math.abs(mana - 2 * tout) <= 2);   // 10/pt contre 5/pt (a l'arrondi pres)
});
/* --- Répartition du Mental : PV / Mana (2026-09-05, décision D) --- */
test('mentalSplit : defaut TOUT EN PV, sur- et sous-allocation normalisees', () => {
  assert.deepEqual(L.mentalSplit(5, null), { hp: 5, mana: 0 });       // jamais confirmee
  assert.deepEqual(L.mentalSplit(0, null), { hp: 0, mana: 0 });
  assert.deepEqual(L.mentalSplit(4, { hp: 2, mana: 2 }), { hp: 2, mana: 2 });
  // sur-allocation : servie dans l'ordre hp -> mana, coupee au budget
  assert.deepEqual(L.mentalSplit(4, { hp: 9, mana: 9 }), { hp: 4, mana: 0 });
  // sous-allocation : le reliquat part en PV, jamais perdu
  assert.deepEqual(L.mentalSplit(4, { mana: 1 }), { hp: 3, mana: 1 });
  assert.deepEqual(L.mentalSplit(4, { hp: -5, mana: 2 }), { hp: 2, mana: 2 });
});
test('computeStats : le defaut du Mental PRESERVE les PV a l’unite pres', () => {
  // 45 PV de socle + 15 diriges = 60 PV/pt, l'ancien coefficient. C'est ce qui garantit
  // que la matrice de TTK figee le 2026-09-05 reste valide sans migration.
  for (const m of [1, 4, 13, 20]) {
    const socle = L.computeStats(0, 0, 0, 0, 18).hp;
    const gain = L.computeStats(0, 0, m, 0, 18).hp - socle;
    const esc = L.escalationFactor(m) * L.globalEscalation(m);
    assert.ok(Math.abs(gain - 60 * esc) <= 1, `M=${m} : ${gain} vs ${(60 * esc).toFixed(1)}`);
  }
});
test('computeStats : un point de Mental vaut 45 PV + 15 Mana, +15 au choix', () => {
  const nu = L.computeStats(0, 0, 0, 0, 1);
  const d = (sp, k) => L.computeStats(0, 0, 1, 0, 1, null, sp)[k] - nu[k];
  assert.equal(d({ hp: 1, mana: 0 }, 'hp'), 60);     // 45 socle + 15 diriges
  assert.equal(d({ hp: 1, mana: 0 }, 'mana'), 15);   // socle seul
  assert.equal(d({ hp: 0, mana: 1 }, 'hp'), 45);     // socle seul
  assert.equal(d({ hp: 0, mana: 1 }, 'mana'), 30);   // 15 socle + 15 diriges
});
test('computeStats : repartir le Mental ne coute rien (escalade au prorata)', () => {
  const nu = L.computeStats(0, 0, 0, 0, 18);
  const tot = (sp) => (L.computeStats(0, 0, 20, 0, 18, null, sp).hp - nu.hp)
                    + (L.computeStats(0, 0, 20, 0, 18, null, sp).mana - nu.mana);
  const ref = tot({ hp: 20, mana: 0 });
  assert.ok(Math.abs(tot({ hp: 10, mana: 10 }) - ref) <= 2);
  assert.ok(Math.abs(tot({ hp: 3, mana: 17 }) - ref) <= 2);
});
test('computeStats : la repartition du Mental ne touche PAS la res. crit', () => {
  const a = L.computeStats(0, 0, 8, 0, 4, null, { hp: 8 });
  const b = L.computeStats(0, 0, 8, 0, 4, null, { mana: 8 });
  assert.equal(a.rescrit, b.rescrit);
  assert.equal(a.rescrit, 24);   // 3 %/pt sur les points bruts
});
test('charBaseStats : state.mentalSplit prime, defaut tout-PV sinon', () => {
  const char = { attrs: { force: 0, hab: 0, mental: 6, magie: 0 }, level: 3 };
  const parDefaut = L.charBaseStats(char, null);
  assert.deepEqual(parDefaut, L.computeStats(0, 0, 6, 0, 3, null, { hp: 6, mana: 0 }));
  const enMana = L.charBaseStats(char, { mentalSplit: { hp: 0, mana: 6 } });
  assert.ok(enMana.mana > parDefaut.mana);
  assert.ok(enMana.hp < parDefaut.hp);
});
test('computeStats : la repartition ne touche NI le crit NI les degats crit NI les PV', () => {
  const a = L.computeStats(0, 6, 0, 0, 1, { ad: 6 });
  const b = L.computeStats(0, 6, 0, 0, 1, { mana: 6 });
  assert.equal(a.crit, b.crit);
  assert.equal(a.dcrit, b.dcrit);
  assert.equal(a.hp, b.hp);      // le bonus de PV de depart suit le TOTAL d'Habilete
});
test('charBaseStats : state.habSplit prime, defaut sinon, compat habAd', () => {
  const char = { attrs: { force: 1, hab: 6, mental: 0, magie: 4 }, level: 1 };
  // aucune repartition enregistree -> defaut (F1 < C4 -> tout AP)
  assert.deepEqual(L.charBaseStats(char, null), L.computeStats(1, 6, 0, 4, 1, { ap: 6 }));
  // state.habSplit prime sur le defaut
  assert.deepEqual(L.charBaseStats(char, { habSplit: { ad: 2, ap: 2, mana: 2 } }),
    L.computeStats(1, 6, 0, 4, 1, { ad: 2, ap: 2, mana: 2 }));
  // compat : l'ancienne forme `habAd` (AD seul) est encore relue
  assert.deepEqual(L.charBaseStats(char, { habAd: 6 }), L.computeStats(1, 6, 0, 4, 1, { ad: 6 }));
});
test('charBaseStats : repli char.attrs / override state.attrs', () => {
  const char = { attrs: { force: 4, hab: 3, mental: 4, magie: 1 }, level: 2 };
  assert.deepEqual(L.charBaseStats(char, null), L.computeStats(4, 3, 4, 1, 2));
  const st = { attrs: { force: 6, hab: 0, mental: 5, magie: 0 }, level: 5 };
  assert.deepEqual(L.charBaseStats(char, st), L.computeStats(6, 0, 5, 0, 5));
});

/* --- Combat refondu : crit & surcrit --- */
test('critInfo : paliers garantis + chance fractionnaire', () => {
  assert.deepEqual(L.critInfo(80),  { guaranteedTiers: 0, extraChancePct: 80 });
  assert.deepEqual(L.critInfo(100), { guaranteedTiers: 0, extraChancePct: 0 });
  assert.deepEqual(L.critInfo(250), { guaranteedTiers: 1, extraChancePct: 50 });
});
test('rollCrit : < 100 % = probabilité (rng injecté)', () => {
  assert.deepEqual(L.rollCrit(50, 200, () => 0.9), { didCrit: false, tiers: 0, multiplier: 1 });
  assert.deepEqual(L.rollCrit(50, 200, () => 0.1), { didCrit: true,  tiers: 1, multiplier: 2 });
});
test('rollCrit : >= 100 % = crit garanti + paliers de surcrit', () => {
  assert.deepEqual(L.rollCrit(100, 200, () => 0.9), { didCrit: true, tiers: 1, multiplier: 2 });
  assert.deepEqual(L.rollCrit(200, 200, () => 0.9), { didCrit: true, tiers: 2, multiplier: 2.5 });
  assert.deepEqual(L.rollCrit(250, 200, () => 0.9), { didCrit: true, tiers: 2, multiplier: 2.5 });
  assert.deepEqual(L.rollCrit(250, 200, () => 0.1), { didCrit: true, tiers: 3, multiplier: 3 });
});
test('critMultAfterResist : réduit la part AU-DESSUS de 100 %', () => {
  // exemple du MJ : crit à 150 %, 15 % de rés. crit → 142,5 %
  assert.ok(approx(L.critMultAfterResist(1.5, 15), 1.425, 1e-9));
  assert.ok(approx(L.critMultAfterResist(1.5, 60), 1.2, 1e-9));
  // vaut aussi pour les paliers de surcrit : 250 % − 60 % → 1 + 1,5*0,4
  assert.ok(approx(L.critMultAfterResist(2.5, 60), 1.6, 1e-9));
});
test('critMultAfterResist : un crit ne fait JAMAIS moins que le coup normal', () => {
  assert.equal(L.critMultAfterResist(1.5, 100), 1);
  assert.equal(L.critMultAfterResist(1.5, 250), 1);   // rés. bornée à 100 %
  assert.equal(L.critMultAfterResist(1.5, -30), 1.5); // rés. négative ignorée
});
test('critMultAfterResist : sans crit (×1), rien à réduire', () => {
  assert.equal(L.critMultAfterResist(1, 50), 1);
  assert.equal(L.critMultAfterResist(undefined, 50), 1);
});
test('rollCrit : espérance §6.3 (sanity, tolérance)', () => {
  let sum = 0, n = 4000;
  for (let i = 0; i < n; i++) sum += L.rollCrit(150, 200, Math.random).multiplier;
  const avg = sum / n;                       // attendu ≈ (200 + 25)/100 = 2.25
  assert.ok(Math.abs(avg - 2.25) < 0.1, `avg=${avg}`);
});
test('mitigateDamage : la léthalité réduit la résistance (sans passer sous 0)', () => {
  assert.equal(L.mitigateDamage(100, 'physique', { armure: 100 }, 0), 50);   // eff 100 → 50 %
  assert.equal(L.mitigateDamage(100, 'physique', { armure: 100 }, 100), 100); // eff 0 → aucune réduction
  assert.equal(L.mitigateDamage(100, 'physique', { armure: 100 }, 200), 100); // eff borné à 0
  assert.equal(L.mitigateDamage(100, 'brut',     { armure: 100 }, 50), 100);  // brut ignore tout
});
test('attrSum : somme des 4 caractéristiques (entiers, tolère les clés absentes)', () => {
  assert.equal(L.attrSum({ force: 4, hab: 3, mental: 4, magie: 1 }), 12);
  assert.equal(L.attrSum({ force: 5 }), 5);
  assert.equal(L.attrSum(null), 0);
});
test('respecValid : somme = budget ET chaque caracs ∈ [0, cap]', () => {
  // niveau 2 : budget 12, cap 6
  assert.equal(L.respecValid({ force: 6, hab: 6, mental: 0, magie: 0 }, 12, 6), true);
  assert.equal(L.respecValid({ force: 4, hab: 3, mental: 4, magie: 1 }, 12, 6), true);
  assert.equal(L.respecValid({ force: 7, hab: 5, mental: 0, magie: 0 }, 12, 6), false); // 7 > cap
  assert.equal(L.respecValid({ force: 4, hab: 3, mental: 4, magie: 0 }, 12, 6), false); // somme 11 ≠ 12
  assert.equal(L.respecValid({ force: 4, hab: 4, mental: 4, magie: 1 }, 12, 6), false); // somme 13 ≠ 12
});
test('respecValid : plancher par caracs (on ne peut pas descendre sous les valeurs confirmées)', () => {
  const floor = { force: 4, hab: 3, mental: 4, magie: 1 }; // niveau 2 confirmé (somme 12)
  // niveau 3 : budget 15, cap 7 ; on ajoute 3 points sur force (4→7) sans rien retirer
  assert.equal(L.respecValid({ force: 7, hab: 3, mental: 4, magie: 1 }, 15, 7, floor), true);
  // retirer 1 en force (4→3) sous le plancher → invalide même si la somme = budget
  assert.equal(L.respecValid({ force: 3, hab: 4, mental: 4, magie: 4 }, 15, 7, floor), false);
  // sans plancher (staff) : même répartition acceptée tant que somme/cap OK
  assert.equal(L.respecValid({ force: 3, hab: 4, mental: 4, magie: 4 }, 15, 7), true);
});
test('dmgRathaelC1 (rang 1 du 2026-10-10) : 50 % AD x (1 + 1 %/% de PV manquants + 20 %/charge)', () => {
  // tableau du §8.1 de la spec, AD 112 (niveau 2)
  const eff = { ad: 112, armure: 500, resmag: 500 };            // les resistances ne comptent plus
  assert.equal(L.dmgRathaelC1(eff, 0, 0), 56);                   // frais : moins qu une attaque de base (67)
  assert.equal(L.dmgRathaelC1(eff, 1, 10), 72);                  // x1,3
  assert.equal(L.dmgRathaelC1(eff, 2, 30), 95);                  // x1,7
  assert.equal(L.dmgRathaelC1(eff, 5, 70), 151);                 // x2,7
  assert.equal(L.dmgRathaelC1(eff, 5, 90), 162);                 // x2,9
});
test('dmgRathaelC1 : charges plafonnées à 5, PV manquants bornés a 0..100', () => {
  const eff = { ad: 100 };
  assert.equal(L.dmgRathaelC1(eff, 9, 0), L.dmgRathaelC1(eff, 5, 0));
  assert.equal(L.dmgRathaelC1(eff, 0, 250), 100);               // plafond : x2 a 0 PV
  assert.equal(L.dmgRathaelC1(eff, 0, -40), 50);
  assert.equal(L.missingHpPct(150, 200), 25);
  assert.equal(L.missingHpPct(260, 200), 0);                     // PV au-dessus du max (buff) : rien ne manque
  assert.equal(L.missingHpPct(0, 200), 100);
  assert.equal(L.missingHpPct(null, 200), 0);                    // PV inconnus : pas de bonus invente
  assert.equal(L.missingHpPct(50, 0), 0);
});
test('rathaelC2Buff : 15 + 5/2 niveaux (floor)', () => {
  assert.equal(L.rathaelC2Buff(2), 20);   // 15 + 5*1
  assert.equal(L.rathaelC2Buff(4), 25);   // 15 + 5*2
  assert.equal(L.rathaelC2Buff(1), 15);   // 15 + 5*0
});
test('dmgRathaelC3 : base AP + (AR+RM) scalée × charges (max ×3,5)', () => {
  const eff = { ap: 100, armure: 50, resmag: 30 };
  // rang 1 du 2026-10-10 : bonus fixe retire, puis x0,9.
  // niveau 2 : arRatio 0,54 → base = floor(54) + floor(80*0,54=43,2) = 97
  assert.equal(L.dmgRathaelC3(eff, 0, 2), 97);
  assert.equal(L.dmgRathaelC3(eff, 0, 4), 104);                   // arRatio 0,63 → 54 + 50
  assert.equal(L.dmgRathaelC3(eff, 5, 2), Math.floor(97 * 3.5)); // +250% à 5 charges
  assert.equal(L.dmgRathaelC3(eff, 9, 2), L.dmgRathaelC3(eff, 5, 2)); // plafond 5
});
test('lifestealHeal : omnivamp universelle, CUMULÉE avec vol/sapience (2026-09-09)', () => {
  const s = { omni: 10, vol: 20, sapience: 30 };
  // Attaque de base : vol (ou sapience) + omni. Le cumul est la règle, pas un max.
  assert.equal(L.lifestealHeal(100, 'physique', s, true), 30);  // vol 20 + omni 10
  assert.equal(L.lifestealHeal(100, 'magique', s, true), 40);   // sapience 30 + omni 10
  assert.equal(L.lifestealHeal(100, 'brut', s, true), 10);      // omni seule (type non départagé)
  // Compétence : omnivamp seule, quel que soit le type — vol/sapience restent hors jeu.
  assert.equal(L.lifestealHeal(100, 'physique', s, false), 10);
  assert.equal(L.lifestealHeal(100, 'magique', s, false), 10);
  assert.equal(L.lifestealHeal(100, 'brut', s, false), 10);
  // Sans omnivamp, le comportement d'avant le 2026-09-09 est strictement conservé.
  const t = { vol: 20, sapience: 30 };
  assert.equal(L.lifestealHeal(100, 'physique', t, true), 20);
  assert.equal(L.lifestealHeal(100, 'magique', t, true), 30);
  assert.equal(L.lifestealHeal(100, 'brut', t, true), 0);
  assert.equal(L.lifestealHeal(100, 'physique', t, false), 0);
  // Omnivamp seule : elle porte maintenant l'attaque de base, ce qu'elle ne faisait pas.
  assert.equal(L.lifestealHeal(100, 'physique', { omni: 10 }, true), 10);
  // Exemple MJ : attaque de base AD, 10% vol, 100 phys mitigés à 50 → 5 HP
  assert.equal(L.lifestealHeal(50, 'physique', { vol: 10 }, true), 5);
  // bornes : sans stat → 0 ; dégâts 0 → 0 ; arrondi
  assert.equal(L.lifestealHeal(100, 'physique', {}, true), 0);
  assert.equal(L.lifestealHeal(0, 'physique', s, true), 0);
  assert.equal(L.lifestealHeal(55, 'physique', { vol: 25 }, true), 14); // round(13.75)
});
test('rathaelUltHpBonus : 20% PV base/charge, plafonné à +100%', () => {
  assert.equal(L.rathaelUltHpBonus(0, 100), 0);
  assert.equal(L.rathaelUltHpBonus(3, 100), 60);   // 3*20% = 60
  assert.equal(L.rathaelUltHpBonus(5, 100), 100);  // plafond +100%
  assert.equal(L.rathaelUltHpBonus(9, 100), 100);  // charges plafonnées à 5
});
test('sumPassiveMods Rathael : +10%/charge des AR/RM de base (flat depuis base)', () => {
  const base = { armure: 40, resmag: 20 };
  assert.deepEqual(L.sumPassiveMods('rathael', { glaciation: 0 }, 2, base), {});
  // 3 charges → +30% : armure floor(40*1.30)-40 = 52-40 = 12 ; resmag floor(20*1.30)-20 = 26-20 = 6
  assert.deepEqual(L.sumPassiveMods('rathael', { glaciation: 3 }, 2, base), { armure: 12, resmag: 6 });
  // sans base fourni → pas de bonus calculable
  assert.deepEqual(L.sumPassiveMods('rathael', { glaciation: 3 }, 2), {});
});
test('glaciationOnHit : +1 charge par coup (max 5, tout stackable en 1 tour) + marque le tour touché', () => {
  assert.deepEqual(L.glaciationOnHit({}, 1), { glaciation: 1, glaciationHitTurn: 1 });
  // plusieurs coups le même tour s'empilent (plus de cap 2/tour)
  assert.deepEqual(L.glaciationOnHit({ glaciation: 1, glaciationHitTurn: 1 }, 1), { glaciation: 2, glaciationHitTurn: 1 });
  assert.deepEqual(L.glaciationOnHit({ glaciation: 4, glaciationHitTurn: 1 }, 1), { glaciation: 5, glaciationHitTurn: 1 });
  // au max (5) : pas de gain mais on marque le coup du tour (pour annuler la perte)
  assert.deepEqual(L.glaciationOnHit({ glaciation: 5, glaciationHitTurn: 1 }, 2), { glaciationHitTurn: 2 });
  // au max ET déjà touché ce tour : rien à écrire
  assert.equal(L.glaciationOnHit({ glaciation: 5, glaciationHitTurn: 2 }, 2), null);
});
test('glaciationOnHit : +2 charges/coup pendant Souverain Glacial (souverainUntil ≥ tour)', () => {
  // fenêtre d'ultime active (souverainUntil >= turn) → +2 par coup
  assert.deepEqual(L.glaciationOnHit({ souverainUntil: 4 }, 1), { glaciation: 2, glaciationHitTurn: 1 });
  // plafonné à 5 (3 + 2)
  assert.deepEqual(L.glaciationOnHit({ glaciation: 3, souverainUntil: 4 }, 4), { glaciation: 5, glaciationHitTurn: 4 });
  // 4 + 2 plafonné à 5
  assert.deepEqual(L.glaciationOnHit({ glaciation: 4, souverainUntil: 4 }, 4), { glaciation: 5, glaciationHitTurn: 4 });
  // fenêtre expirée (turn > souverainUntil) → +1 normal
  assert.deepEqual(L.glaciationOnHit({ souverainUntil: 4 }, 5), { glaciation: 1, glaciationHitTurn: 5 });
});
test('glaciationDecay : -3 charges en fin de tour sans dégâts subis', () => {
  // pas touché ce tour (glaciationHitTurn ≠ 3) → -3
  assert.deepEqual(L.glaciationDecay({ glaciation: 5, glaciationHitTurn: 2 }, 3), { glaciation: 2 });
  assert.deepEqual(L.glaciationDecay({ glaciation: 2 }, 3), { glaciation: 0 });
  // touché ce tour-ci → pas de perte
  assert.equal(L.glaciationDecay({ glaciation: 5, glaciationHitTurn: 3 }, 3), null);
  // déjà à 0 → rien
  assert.equal(L.glaciationDecay({ glaciation: 0 }, 3), null);
});
test('enemyPublicView : caché (défaut) = nom seul, aucune barre', () => {
  assert.deepEqual(L.enemyPublicView({ hpCur: 70, hpMax: 100 }),
    { mode: 'hidden', ko: false, showBar: false, pct: null, text: '' });
});
test('enemyPublicView : barre figée au revealPct (ignore les vrais PV)', () => {
  assert.deepEqual(L.enemyPublicView({ hpCur: 13, hpMax: 100, reveal: 'bar', revealPct: 50 }),
    { mode: 'bar', ko: false, showBar: true, pct: 50, text: '' });
  // revealPct borné 0–100
  assert.equal(L.enemyPublicView({ hpCur: 13, hpMax: 100, reveal: 'bar', revealPct: 150 }).pct, 100);
});
test('enemyPublicView : exact = barre live + PV chiffrés', () => {
  assert.deepEqual(L.enemyPublicView({ hpCur: 30, hpMax: 120, reveal: 'exact' }),
    { mode: 'exact', ko: false, showBar: true, pct: 25, text: '30/120 PV' });
});
test('enemyPublicView : KO toujours signalé quel que soit le mode', () => {
  assert.deepEqual(L.enemyPublicView({ hpCur: 0, hpMax: 100, reveal: 'hidden' }),
    { mode: 'hidden', ko: true, showBar: false, pct: 0, text: 'KO' });
  assert.equal(L.enemyPublicView({ hpCur: 0, hpMax: 100, reveal: 'exact' }).ko, true);
});
test('computeAttack : dmg = round(base * critMult)', () => {
  // invariant figé (computeAttack vit dans data.jsx, non requis ici)
  const calc = (ad, mult) => Math.round(ad * mult);
  assert.equal(calc(100, 1), 100);    // pas de crit
  assert.equal(calc(100, 2), 200);    // crit base (dcrit 200)
  assert.equal(calc(100, 2.5), 250);  // surcrit 1 palier
});

/* --- Catalogue d'objets partagé : buildCatalogSeed / catalogArray --- */
test('buildCatalogSeed : map {id:item}, ids uniques, champs préservés + défauts', () => {
  const src = [{ cat: 'Consommables', name: 'Potion', sub: 'soin', ic: '🧪', img: 'a.webp', type: '', mods: { hp: 5 } },
               { cat: 'Butin', name: 'Carte' }];
  const map = L.buildCatalogSeed(src);
  const keys = Object.keys(map);
  assert.equal(keys.length, 2);
  assert.equal(new Set(keys).size, 2);                 // ids uniques
  assert.equal(map[keys[0]].id, keys[0]);              // id = clé
  const pot = Object.values(map).find(e => e.name === 'Potion');
  assert.equal(typeof pot.id, 'string');
  assert.equal(pot.cat, 'Consommables');
  assert.deepEqual(pot.mods, { hp: 5 });
  const carte = Object.values(map).find(e => e.name === 'Carte');
  assert.deepEqual(carte.mods, {});                    // défauts appliqués
  assert.equal(carte.sub, '');
});

test('catalogArray : repli si non amorcé, live trié si amorcé', () => {
  const fb = [{ cat: 'Butin', name: 'X' }];
  assert.deepEqual(L.catalogArray({}, false, fb), fb);  // non amorcé -> repli
  assert.deepEqual(L.catalogArray({}, true, fb), []);   // amorcé vide -> vide (pas de repli)
  const map = { i2: { id: 'i2', cat: 'Butin', name: 'Bbb' }, i1: { id: 'i1', cat: 'Butin', name: 'Aaa' } };
  assert.deepEqual(L.catalogArray(map, true, fb).map(e => e.name), ['Aaa', 'Bbb']); // trié cat+nom
});

/* --- Retrait d'XP : applyXpLoss --- */
test('applyXpLoss : retrait simple dans le niveau courant', () => {
  assert.deepEqual(L.applyXpLoss(3, 200, 50), { level: 3, xp: 150, levelsLost: 0 });
});
test('applyXpLoss : cascade d\'un niveau (miroir applyXp)', () => {
  // xpToNext(4) = 180 + 100*4 = 580 ; perdre 30 depuis niv5/xp0 -> niv4/xp550
  assert.deepEqual(L.applyXpLoss(5, 0, 30), { level: 4, xp: 550, levelsLost: 1 });
  // round-trip : monter 30 depuis niv4/xp550 redonne niv5/xp0
  assert.deepEqual(L.applyXp(4, 550, 30), { level: 5, xp: 0, levelsGained: 1 });
});
test('applyXpLoss : cascade multi-niveaux + plancher niveau 1 / xp 0', () => {
  assert.deepEqual(L.applyXpLoss(3, 0, 99999), { level: 1, xp: 0, levelsLost: 2 });
});
test('applyXpLoss : perte nulle ou négative = inchangé', () => {
  assert.deepEqual(L.applyXpLoss(2, 100, 0), { level: 2, xp: 100, levelsLost: 0 });
  assert.deepEqual(L.applyXpLoss(2, 100, -50), { level: 2, xp: 100, levelsLost: 0 });
});

/* --- Poids de la monnaie (guide d'économie §3) --- */
test('coinsWeight : bourse vide / absente = 0', () => {
  assert.equal(L.coinsWeight({}), 0);
  assert.equal(L.coinsWeight(null), 0);
  assert.equal(L.coinsWeight(undefined), 0);
  assert.equal(L.coinsWeight({ inconnu: 5000 }), 0);   // clé hors barème ignorée
});
test('coinsWeight : barème du guide — 67 or / 100 argent / 200 cuivre / 200 platine = 1 unité', () => {
  assert.equal(L.coinsWeight({ or: 67 }), 1);
  assert.equal(L.coinsWeight({ arg: 100 }), 1);
  assert.equal(L.coinsWeight({ cuiv: 200 }), 1);
  assert.equal(L.coinsWeight({ plat: 200 }), 1);
  // repère explicite du guide : « un trésor de 500 pièces d'argent pèse 5 unités »
  assert.equal(L.coinsWeight({ arg: 500 }), 5);
  // ...« la même valeur en cuivre pèserait 25 unités » (500 arg = 50 000 cuiv)
  assert.equal(L.coinsWeight({ cuiv: 50000 }), 250);
  // l'or est bien la PLUS LOURDE et le platine la PLUS LÉGÈRE (barème non monotone)
  assert.ok(L.coinsWeight({ or: 100 }) > L.coinsWeight({ arg: 100 }));
  assert.ok(L.coinsWeight({ plat: 100 }) < L.coinsWeight({ arg: 100 }));
});
test('coinsWeight : valeur EXACTE, aucun arrondi (199 cuivres ne pèsent pas 0)', () => {
  assert.equal(L.coinsWeight({ cuiv: 199 }), 199 / 200);       // 0,995 — pas 0
  assert.ok(L.coinsWeight({ cuiv: 199 }) > 0.99);
  assert.equal(L.coinsWeight({ or: 1 }), 1 / 67);
  // 4 bourses de 199 cuivres pèsent ~4 unités, pas 0 (le contrôle du choix « exact en interne »)
  assert.ok(Math.abs(L.coinsWeight({ cuiv: 796 }) - 3.98) < 1e-9);
});
test('coinsWeight : les 4 dénominations s\'additionnent ; négatifs plancés à 0', () => {
  assert.equal(L.coinsWeight({ cuiv: 200, arg: 100, or: 67, plat: 200 }), 4);
  assert.equal(L.coinsWeight({ cuiv: 100, arg: 50 }), 0.5 + 0.5);
  assert.equal(L.coinsWeight({ or: -100, arg: 100 }), 1);
});

/* --- Système de poids : carriedWeight / carryCapacity / weightStatus --- */
test('carriedWeight : la bourse compte dans la charge (4e param optionnel)', () => {
  const items = { a: { weight: 3, qty: 2 } };
  // sans 4e param : résultat INCHANGÉ (non-régression des appels existants)
  assert.equal(L.carriedWeight(items), 6);
  assert.equal(L.carriedWeight(items, 20, {}), 6);
  // avec bourse : objets + pièces
  assert.equal(L.carriedWeight(items, 0, {}, { arg: 400 }), 6 + 4);
  assert.equal(L.carriedWeight({}, 0, {}, { or: 67 }), 1);
  assert.equal(L.carriedWeight(items, 0, {}, {}), 6);   // bourse vide = rien de plus
  // la réduction Mental de l'armure équipée reste appliquée en présence d'une bourse
  const eq = { a: { id: 'a', weight: 20, qty: 1 } };
  assert.equal(L.carriedWeight(eq, 20, { armure: 'a' }, { arg: 100 }), 12 + 1);
});
test('carriedWeight : somme weight×qty, qty 0 ignorée, vide = 0', () => {
  assert.equal(L.carriedWeight({}), 0);
  const items = { a: { weight: 3, qty: 2 }, b: { weight: 5, qty: 0 }, c: { weight: 1, qty: 4 } };
  assert.equal(L.carriedWeight(items), 3 * 2 + 1 * 4); // 10
});
test('carryCapacity : 30 + force×5 + mental×niveau÷10 + carry équipés (arrondi inférieur)', () => {
  const itemsById = { belt: { id: 'belt', carry: 20 }, ring: { id: 'ring' } };
  // 30 + force 4 ×5 = 50, + ceinture 20 = 70 (mental 0, niveau 1)
  assert.equal(L.carryCapacity(4, 0, 1, { ceinture: 'belt', anneau1: 'ring' }, itemsById), 30 + 4 * 5 + 20);
  // sans équipement, mental/niveau nuls
  assert.equal(L.carryCapacity(6, 0, 1, {}, {}), 30 + 6 * 5);
  // terme Mental×Niveau÷10 + arrondi inférieur : Jett F1 M1 niv2 → 30+5+0,2 = 35,2 → 35
  assert.equal(L.carryCapacity(1, 1, 2, {}, {}), 35);
  // fidélité au tableau de la spec : tank F13 M20 niv18 → 30+65+36 = 131
  assert.equal(L.carryCapacity(13, 20, 18, {}, {}), 131);
  // et niv1 → 30+65+2 = 97
  assert.equal(L.carryCapacity(13, 20, 1, {}, {}), 97);
});
test('weightStatus : pct, seuil de confort et 3 états', () => {
  // hab 0 → confort 60% ; cap 50 → confort 30
  const a = L.weightStatus(25, 50, 0);
  assert.equal(a.pct, 0.5);
  assert.equal(a.over, false);
  assert.equal(a.comfort, 30);
  assert.equal(a.state, 'leger');                             // 25 ≤ 30
  assert.equal(L.weightStatus(40, 50, 0).state, 'encombre');  // 30 < 40 ≤ 50
  assert.equal(L.weightStatus(60, 50, 0).state, 'surcharge'); // > 50
  assert.equal(L.weightStatus(60, 50, 0).over, true);
  assert.equal(L.weightStatus(40, 50, 15).state, 'leger');    // hab 15 → confort 45 ; 40 ≤ 45
  assert.equal(L.weightStatus(40, 50, 20).comfort, 45);       // plafond 90% même à hab 20
  assert.equal(L.weightStatus(10, 0, 5).state, 'surcharge');  // cap 0 → tout surcharge
});
/* --- Attelage du groupe : slots de transport du coffre commun (§6 du doc MJ) ---
   ⚠️ Règle arrêtée par le MJ le 2026-08-21 : le canal 'g' ne se déclenche PAS par simple
   présence dans le coffre (dix sacs en vrac gonfleraient la capacité de +200), mais seulement
   quand l'objet occupe un des 5 emplacements d'attelage. */
test('TRANSPORT_SLOTS : 2 montures + 3 sacs, clés uniques', () => {
  assert.equal(L.TRANSPORT_SLOTS.length, 5);
  const keys = L.TRANSPORT_SLOTS.map(s => s.key);
  assert.equal(new Set(keys).size, 5);
  assert.equal(L.TRANSPORT_SLOTS.filter(s => s.accepts.includes('mount')).length, 2);
  assert.equal(L.TRANSPORT_SLOTS.filter(s => s.accepts.includes('pack')).length, 3);
});
test('transportAccepts : il faut apporter quelque chose au groupe', () => {
  const monture = L.TRANSPORT_SLOTS[0], sac = L.TRANSPORT_SLOTS[2];
  // carryGroup nul ou absent : refusé partout, même avec le bon type
  assert.equal(L.transportAccepts(monture, { type: 'mount' }), false);
  assert.equal(L.transportAccepts(monture, { type: 'mount', carryGroup: 0 }), false);
  // un `carry` PERSONNEL ne suffit pas : ce n'est pas le même canal
  assert.equal(L.transportAccepts(sac, { type: 'pack', carry: 30 }), false);
  assert.equal(L.transportAccepts(monture, { type: 'mount', carryGroup: 50 }), true);
  assert.equal(L.transportAccepts(null, { carryGroup: 5 }), false);
  assert.equal(L.transportAccepts(monture, null), false);
});
test('transportAccepts : le type est respecté, mais un objet NON typé passe partout', () => {
  const monture = L.TRANSPORT_SLOTS[0], sac = L.TRANSPORT_SLOTS[2];
  assert.equal(L.transportAccepts(monture, { type: 'pack', carryGroup: 20 }), false);
  assert.equal(L.transportAccepts(sac, { type: 'mount', carryGroup: 50 }), false);
  // tolérance voulue : le champ « Emplacement » n'existe que pour cat==='Équipement',
  // donc un sac rangé en Butin ne PEUT pas être typé — il ne doit pas être refusé pour ça.
  assert.equal(L.transportAccepts(sac, { carryGroup: 20 }), true);
  assert.equal(L.transportAccepts(monture, { type: '', carryGroup: 20 }), true);
});
test('sumTransportCarry : seuls les objets ATTELÉS comptent', () => {
  const items = {
    ch: { id: 'ch', type: 'mount', carryGroup: 50 },
    sac: { id: 'sac', type: 'pack', carryGroup: 20 },
    range: { id: 'range', type: 'pack', carryGroup: 99 },   // dans le coffre, PAS attelé
  };
  assert.equal(L.sumTransportCarry({}, items), 0);          // rien d'attelé = 0
  assert.equal(L.sumTransportCarry({ monture1: 'ch' }, items), 50);
  // l'exemple du §9 du doc MJ : sac large 20 + chameau 50 = 70
  assert.equal(L.sumTransportCarry({ monture1: 'ch', sac1: 'sac' }, items), 70);
  // `range` a le plus gros bonus du coffre mais n'est pas attelé : il ne compte pas
  assert.equal(L.sumTransportCarry({ sac1: 'sac' }, items), 20);
});
test('sumTransportCarry : robuste aux états partiels', () => {
  assert.equal(L.sumTransportCarry(null, null), 0);
  const items = { sac: { id: 'sac', carryGroup: 20 } };
  // référence orpheline (objet pris par un joueur ou supprimé) : ignorée, pas de crash
  assert.equal(L.sumTransportCarry({ sac1: 'disparu' }, items), 0);
  assert.equal(L.sumTransportCarry({ sac1: null }, items), 0);
  // pile vidée : ne porte plus rien
  assert.equal(L.sumTransportCarry({ sac1: 'sac' }, { sac: { carryGroup: 20, qty: 0 } }), 0);
  // compté PAR PILE, pas par unité
  assert.equal(L.sumTransportCarry({ sac1: 'sac' }, { sac: { carryGroup: 20, qty: 3 } }), 20);
  // même objet dans deux slots : compté une seule fois
  assert.equal(L.sumTransportCarry({ sac1: 'sac', sac2: 'sac' }, items), 20);
  // une clé qui n'est pas un slot connu est ignorée
  assert.equal(L.sumTransportCarry({ inconnu: 'sac' }, items), 0);
});

/* --- Capacité et confort COMMUNS du coffre (§3-4 du doc MJ) --- */
test('carryBaseRaw : terme brut NON arrondi et SANS bonus d\'objet', () => {
  assert.equal(L.carryBaseRaw(4, 4, 2), 50.8);    // Rathäel
  assert.equal(L.carryBaseRaw(6, 5, 2), 61);      // Urskaar
  assert.equal(L.carryBaseRaw(1, 1, 2), 35.2);    // Jett
  assert.equal(L.carryBaseRaw(0, 0, 1), 30);      // socle garanti
  assert.equal(L.carryBaseRaw(0, 0, 0), 30);      // niveau planché à 1
  // c'est bien le même terme que carryCapacity, qui l'arrondit et y ajoute les bonus
  assert.equal(L.carryCapacity(1, 1, 2, {}, {}), Math.floor(L.carryBaseRaw(1, 1, 2)));
});
test('groupCarryBase : conforme au §9 du doc MJ (4 joueurs) = 352', () => {
  const profiles = [
    { force: 12, mental: 8,  hab: 10, level: 10 },   // 98
    { force: 6,  mental: 14, hab: 4,  level: 10 },   // 74
    { force: 20, mental: 0,  hab: 0,  level: 10 },   // 130
    { force: 0,  mental: 20, hab: 15, level: 10 },   // 50
  ];
  // la SOMME brute reste exactement celle du document — c'est le ratio qui s'en écarte, pas elle
  assert.equal(L.groupCarryBase(profiles), 352);
  assert.equal(L.groupComfortPct(profiles), 0.745);              // (80+68+60+90)/4
  // avec le ratio de groupe : floor(352 x 0,30) + 70 d'attelage = 105 + 70 = 175
  assert.equal(L.groupCarryCapacity(profiles, 70), 175);
  assert.equal(L.groupCarryCapacity(profiles, 0), 105);
});
test('GROUP_CARRY_RATIO : le coffre ne vaut qu\'une FRACTION de la capacité du groupe', () => {
  // Écart assumé au §3 du doc MJ (arbitré par le MJ le 2026-08-21) : le coffre est un stockage
  // SÉPARÉ des sacs persos ; à pleine somme le groupe aurait ~494 unités et le coffre ne serait
  // jamais encombré. Voir le commentaire de GROUP_CARRY_RATIO dans game-logic.js.
  assert.ok(L.GROUP_CARRY_RATIO > 0 && L.GROUP_CARRY_RATIO <= 1);
  const p1 = [{ force: 0, mental: 0, hab: 0, level: 1 }];       // base brute = 30
  assert.equal(L.groupCarryCapacity(p1, 0), Math.floor(30 * L.GROUP_CARRY_RATIO));
  // le ratio NE s'applique PAS à l'attelage : le bonus passe entier
  assert.equal(L.groupCarryCapacity(p1, 50), Math.floor(30 * L.GROUP_CARRY_RATIO) + 50);
  assert.equal(L.groupCarryCapacity([], 50), 50);               // sans joueur, il reste l'attelage
  assert.equal(L.groupCarryCapacity([], 0), 0);
});
test('groupCarryCapacity : groupe RÉEL de data.jsx (niveau 2) = 74, attelable jusqu\'à +N', () => {
  const profiles = [
    { force: 4, mental: 4, hab: 3, level: 2 },   // Rathäel  50,8
    { force: 6, mental: 5, hab: 1, level: 2 },   // Urskaar  61,0
    { force: 3, mental: 1, hab: 6, level: 2 },   // Smith    45,2
    { force: 5, mental: 3, hab: 4, level: 2 },   // Elias    55,6
    { force: 1, mental: 1, hab: 6, level: 2 },   // Jett     35,2
  ];
  // l'arrondi se fait UNE SEULE FOIS à la fin : floor(247,8 x 0,30) = floor(74,34) = 74.
  // Arrondir chaque joueur d'abord donnerait 73 — c'est le piège que ce test verrouille.
  assert.equal(L.groupCarryBase(profiles), 247.8);
  assert.equal(L.groupCarryCapacity(profiles, 0), 74);
  assert.notEqual(L.groupCarryCapacity(profiles, 0), 73);
  assert.equal(L.groupComfortPct(profiles), 0.68);               // (66+62+72+68+72)/5
  assert.equal(L.weightStatusPct(0, 74, 0.68).comfort, 50);      // seuil de confort du coffre
  // un attelage relève la capacité à hauteur de son bonus PLEIN
  assert.equal(L.groupCarryCapacity(profiles, 20), 94);
  assert.equal(L.groupCarryCapacity(profiles, 50), 124);
});
test('groupComfortPct : moyenne bornée à 90 % par joueur ; groupe vide = 60 %', () => {
  assert.equal(L.groupComfortPct([]), 0.60);
  assert.equal(L.groupComfortPct(null), 0.60);
  assert.equal(L.groupComfortPct([{ hab: 0 }]), 0.60);
  assert.equal(L.groupComfortPct([{ hab: 15 }]), 0.90);
  // hab 20 reste plafonné à 90 % : il ne tire pas la moyenne au-delà
  assert.equal(L.groupComfortPct([{ hab: 20 }, { hab: 20 }]), 0.90);
  assert.equal(L.groupComfortPct([{ hab: 0 }, { hab: 15 }]), 0.75);
});
test('weightStatusPct : les 3 états aux bornes exactes', () => {
  // coffre du groupe actuel : seuil = floor(0,68 x 74) = 50 ; capacité = 74
  assert.equal(L.weightStatusPct(50, 74, 0.68).state, 'leger');       // W = seuil -> encore léger
  assert.equal(L.weightStatusPct(51, 74, 0.68).state, 'encombre');
  assert.equal(L.weightStatusPct(74, 74, 0.68).state, 'encombre');    // W = capacité -> pas encore surchargé
  assert.equal(L.weightStatusPct(75, 74, 0.68).state, 'surcharge');
  assert.equal(L.weightStatusPct(75, 74, 0.68).over, true);
  // weightStatus(hab) n'est plus qu'un appel à weightStatusPct(comfortPct(hab)) : même résultat
  assert.deepEqual(L.weightStatus(40, 50, 15), L.weightStatusPct(40, 50, L.comfortPct(15)));
});

test('makeItem / transferts : carryGroup est porté par le modèle d\'item', () => {
  assert.equal(L.makeItem({}).carryGroup, 0);
  assert.equal(L.makeItem({ name: 'Sac large', carryGroup: 20 }).carryGroup, 20);
  // le bonus survit à un transfert vers une autre grille (coffre → fiche)
  const src = { s1: L.makeItem({ id: 's1', name: 'Sac large', carryGroup: 20, qty: 1 }) };
  const { dstPatch } = L.planItemTransfer(src, {}, 's1', 1);
  assert.equal(Object.values(dstPatch)[0].carryGroup, 20);
  // ...et à un ajout depuis le catalogue
  const { patch } = L.planItemAdd({}, { cat: 'Butin', name: 'Sac large', carryGroup: 20 }, 1);
  assert.equal(Object.values(patch)[0].carryGroup, 20);
});

test('comfortPct : 60% + hab×2%, plafond 90%', () => {
  assert.equal(L.comfortPct(0), 0.60);
  assert.equal(L.comfortPct(5), 0.70);
  assert.equal(L.comfortPct(15), 0.90);
  assert.equal(L.comfortPct(20), 0.90);
});

/* --- B-6 : réduction du poids d'armure par le Mental (spec §5.1) --- */
test('armorWeightReduction : −5%/pt (≤5) puis −1%/pt, plafond −40%', () => {
  assert.equal(L.armorWeightReduction(0), 0);
  assert.equal(L.armorWeightReduction(5), 0.25);
  assert.equal(Math.round(L.armorWeightReduction(10) * 100), 30);
  assert.equal(Math.round(L.armorWeightReduction(13) * 100), 33);
  assert.equal(L.armorWeightReduction(20), 0.40);
  assert.equal(L.armorWeightReduction(30), 0.40);   // plafond maintenu au-delà
  assert.equal(L.armorWeightReduction(-5), 0);      // négatif borné à 0
});
test('armorEffectiveWeight : base × (1−réduction), arrondi inférieur (repères spec)', () => {
  // Légère (4)
  assert.equal(L.armorEffectiveWeight(4, 0), 4);
  assert.equal(L.armorEffectiveWeight(4, 5), 3);
  assert.equal(L.armorEffectiveWeight(4, 10), 2);   // 2.8 → 2
  assert.equal(L.armorEffectiveWeight(4, 20), 2);   // 2.4 → 2
  // Intermédiaire (10)
  assert.equal(L.armorEffectiveWeight(10, 5), 7);   // 7.5 → 7
  assert.equal(L.armorEffectiveWeight(10, 10), 7);
  assert.equal(L.armorEffectiveWeight(10, 13), 6);  // 6.7 → 6
  assert.equal(L.armorEffectiveWeight(10, 20), 6);
  // Lourde (20)
  assert.equal(L.armorEffectiveWeight(20, 0), 20);
  assert.equal(L.armorEffectiveWeight(20, 5), 15);
  assert.equal(L.armorEffectiveWeight(20, 10), 14);
  assert.equal(L.armorEffectiveWeight(20, 13), 13); // 13.4 → 13
  assert.equal(L.armorEffectiveWeight(20, 20), 12);
});
test('carriedWeight : réduction Mental sur l\'armure ÉQUIPÉE seulement', () => {
  const items = {
    a1: { id:'a1', weight:20, qty:1, type:'armor', armorClass:'lourde' },  // armure lourde
    w1: { id:'w1', weight:5,  qty:1, type:'weapon' },                       // arme (pas de réduction)
    f1: { id:'f1', weight:3,  qty:2, type:'' },                             // fourniment ×2
  };
  // Sans équipement : tout à plat = 20 + 5 + 6 = 31
  assert.equal(L.carriedWeight(items), 31);
  assert.equal(L.carriedWeight(items, 20, {}), 31);
  // Armure équipée (slot armure), Mental 20 : 20→12, total = 12 + 5 + 6 = 23
  assert.equal(L.carriedWeight(items, 20, { armure:'a1' }), 23);
  // Mental 5 : 20→15, total = 15 + 5 + 6 = 26
  assert.equal(L.carriedWeight(items, 5, { armure:'a1' }), 26);
  // L'arme dans un autre slot n'est jamais réduite
  assert.equal(L.carriedWeight(items, 20, { armePrincipale:'w1' }), 31);
});
test('makeItem : défauts weight/carry à 0, valeurs préservées', () => {
  assert.equal(L.makeItem({}).weight, 0);
  assert.equal(L.makeItem({}).carry, 0);
  const it = L.makeItem({ weight: 3, carry: 20 });
  assert.equal(it.weight, 3);
  assert.equal(it.carry, 20);
});

/* --- statBreakdown : décomposition base / +mod / +stuff --- */
test('statBreakdown : base seule = effective, deltas à 0', () => {
  const base = { ad: 100, armure: 30, hp: 400, mana: 200, ap: 0, resmag: 10, crit: 5, dcrit: 200 };
  const b = L.statBreakdown(base, {}, [], {});
  assert.equal(b.ad.base, 100);
  assert.equal(b.ad.mod, 0);
  assert.equal(b.ad.stuff, 0);
  assert.equal(b.ad.effective, 100);
});
test('statBreakdown : modificateur isolé en delta mod', () => {
  const base = { ad: 100, armure: 30, hp: 400, mana: 200, ap: 0, resmag: 10, crit: 5, dcrit: 200 };
  const b = L.statBreakdown(base, { ad: 10 }, [], {});
  assert.equal(b.ad.mod, 10);
  assert.equal(b.ad.stuff, 0);
  assert.equal(b.ad.effective, 110);
});
test('statBreakdown : bonus de stuff isolé en delta stuff', () => {
  const base = { ad: 100, armure: 30, hp: 400, mana: 200, ap: 0, resmag: 10, crit: 5, dcrit: 200 };
  const b = L.statBreakdown(base, {}, [], { armure: 15 });
  assert.equal(b.armure.base, 30);
  assert.equal(b.armure.mod, 0);
  assert.equal(b.armure.stuff, 15);
  assert.equal(b.armure.effective, 45);
});
test('statBreakdown : mod + stuff combinés', () => {
  const base = { ad: 100, armure: 30, hp: 400, mana: 200, ap: 0, resmag: 10, crit: 5, dcrit: 200 };
  const b = L.statBreakdown(base, { ad: 10 }, [], { ad: 20 });
  assert.equal(b.ad.mod, 10);
  assert.equal(b.ad.stuff, 20);
  assert.equal(b.ad.effective, 130);
});

test('statBreakdown : champ buff présent + somme cohérente (base+buff+mod+stuff = effective)', () => {
  const base = { ad: 100, armure: 30 };
  const b = L.statBreakdown(base, { ad: 10 }, [], { armure: 5 });
  assert.equal(b.ad.buff, 0);
  assert.equal(b.ad.base + b.ad.buff + b.ad.mod + b.ad.stuff, b.ad.effective);
  assert.equal(b.armure.base + b.armure.buff + b.armure.mod + b.armure.stuff, b.armure.effective);
});

test('parseConsumableEffect : descriptions chiffrées + repli par nom', () => {
  assert.deepEqual(L.parseConsumableEffect({ cat:'Consommables', sub:'Rend 10 + 10% Mana' }), { kind:'mana', flat:10, pct:10 });
  assert.deepEqual(L.parseConsumableEffect({ cat:'Consommables', sub:'Rend 15 + 15% PV' }), { kind:'hp', flat:15, pct:15 });
  assert.deepEqual(L.parseConsumableEffect({ cat:'Consommables', name:'Potion soin mineur' }), { kind:'hp', flat:15, pct:15 });
  assert.deepEqual(L.parseConsumableEffect({ cat:'Consommables', name:'Potion mana mineur' }), { kind:'mana', flat:10, pct:10 });
  assert.equal(L.parseConsumableEffect({ cat:'Équipement', name:'Épée' }), null);
  assert.equal(L.parseConsumableEffect(null), null);
});

test('carouselTransforms : slider horizontal plat — carte active centrée, voisins symétriques, wrap', () => {
  const t = L.carouselTransforms(5, 0);
  assert.equal(t.length, 5);
  assert.equal(t[0].offset, 0);
  assert.equal(t[0].translateX, 0);
  assert.ok(t[0].scale > t[1].scale);   // active plus grande
  assert.equal(t[0].opacity, 1);
  assert.equal(t[0].zIndex, 5);
  assert.equal(t[1].offset, 1);
  assert.equal(t[4].offset, -1);
  assert.equal(t[1].translateX, -t[4].translateX);  // décalage horizontal symétrique
});
test('planReorder : déplace un item à la position d un autre + réindexe', () => {
  const items = {
    a: { id:'a', order:0 }, b: { id:'b', order:1 }, c: { id:'c', order:2 },
  };
  // déplacer c en position de a (début) → ordre c, a, b
  const patch = L.planReorder(items, 'c', 'a');
  assert.equal(patch.c, 0);
  assert.equal(patch.a, 1);
  assert.equal(patch.b, 2);
});
test('planReorder : targetId null = envoyer en fin', () => {
  const items = { a:{ id:'a', order:0 }, b:{ id:'b', order:1 }, c:{ id:'c', order:2 } };
  const patch = L.planReorder(items, 'a', null);   // a → fin : b, c, a
  assert.equal(patch.a, 2);
  assert.equal(patch.b, 0);
  assert.equal(patch.c, 1);
});
test('planReorder : drop sur soi-même ou id inconnu = aucun changement', () => {
  const items = { a:{ id:'a', order:0 }, b:{ id:'b', order:1 } };
  assert.deepEqual(L.planReorder(items, 'a', 'a'), {});
  assert.deepEqual(L.planReorder(items, 'zzz', 'a'), {});
});
test('planReorder : items sans order conservent leur ordre d insertion comme base', () => {
  const items = { x:{ id:'x' }, y:{ id:'y' }, z:{ id:'z' } };
  const patch = L.planReorder(items, 'z', 'x');   // z, x, y
  assert.equal(patch.z, 0);
  assert.equal(patch.x, 1);
  assert.equal(patch.y, 2);
});

test('runeRadialLayout : 5 familles, 9 nœuds + 9 segments chacune, cœur sur l anneau', () => {
  const fams = [1,2,3,4,5].map(i => ({
    key:'f'+i, name:'F'+i, color:'#fff', theme:'t',
    paths:[0,1,2].map(p => ({ key:'p'+p, nodes:[
      { id:`f${i}_p${p}_1`, tier:'mineure', name:'a' },
      { id:`f${i}_p${p}_2`, tier:'avancee', name:'b' },
      { id:`f${i}_p${p}_3`, tier:'fondamentale', name:'c' },
    ]})),
  }));
  const lay = L.runeRadialLayout(fams);
  assert.equal(lay.families.length, 5);
  assert.equal(lay.families[0].nodes.length, 9);
  assert.equal(lay.families[0].segments.length, 9);
  // cœur sur l'anneau (distance au centre ≈ ring)
  const c = lay.families[0].core, cx = lay.center;
  const dCore = Math.hypot(c.x - cx, c.y - cx);
  assert.ok(Math.abs(dCore - lay.ring) < 1);
});
test('runeRadialLayout : mineure plus proche du centre que la fondamentale (même voie)', () => {
  const fams = [{ key:'f', name:'F', color:'#fff', theme:'t',
    paths:[{ key:'p', nodes:[
      { id:'m', tier:'mineure', name:'m' },
      { id:'a', tier:'avancee', name:'a' },
      { id:'g', tier:'fondamentale', name:'g' },
    ]}] }];
  const lay = L.runeRadialLayout(fams);
  const cx = lay.center;
  const ns = lay.families[0].nodes;
  const d = (n) => Math.hypot(n.x - cx, n.y - cx);
  assert.ok(d(ns[0]) < d(ns[1]) && d(ns[1]) < d(ns[2]));
  // chaque segment référence la rune extérieure qui l'illumine
  assert.equal(lay.families[0].segments[0].outerId, 'm');
  assert.equal(lay.families[0].segments[2].outerId, 'g');
});

test('carouselTransforms : active = dernier index, wrap correct', () => {
  const t = L.carouselTransforms(5, 4);
  assert.equal(t[4].offset, 0);
  assert.equal(t[0].offset, 1);
  assert.equal(t[3].offset, -1);
});

/* --- Monnaie : conversion entre dénominations --- */
test('planCoinConvert : vers le haut, seuls les multiples passent et le reste est laissé', () => {
  const r = L.planCoinConvert({ cuiv: 250, arg: 3 }, 'cuiv', 'arg', 250);
  assert.equal(r.spent, 200);
  assert.equal(r.gained, 2);
  assert.equal(r.unit, 100);
  assert.deepEqual(r.patch, { cuiv: 50, arg: 5 });   // 50 cuivres non convertis, jamais perdus
});

test('planCoinConvert : vers le bas, conversion exacte', () => {
  assert.deepEqual(L.planCoinConvert({ or: 2 }, 'or', 'cuiv', 1).patch, { or: 1, cuiv: 10000 });
  assert.deepEqual(L.planCoinConvert({ plat: 1 }, 'plat', 'arg', 1).patch, { plat: 0, arg: 1000 });
  assert.deepEqual(L.planCoinConvert({ arg: 5 }, 'arg', 'cuiv', 5).patch, { arg: 0, cuiv: 500 });
});

test('planCoinConvert : taux officiels de la chaîne (100/100/10)', () => {
  assert.equal(L.planCoinConvert({ cuiv: 100 }, 'cuiv', 'arg', 100).gained, 1);
  assert.equal(L.planCoinConvert({ arg: 100 }, 'arg', 'or', 100).gained, 1);
  assert.equal(L.planCoinConvert({ or: 10 }, 'or', 'plat', 10).gained, 1);
  assert.equal(L.planCoinConvert({ cuiv: 100000 }, 'cuiv', 'plat', 100000).gained, 1);
});

test('planCoinConvert : montant borné au solde disponible', () => {
  const r = L.planCoinConvert({ cuiv: 150 }, 'cuiv', 'arg', 9999);
  assert.equal(r.spent, 100);
  assert.deepEqual(r.patch, { cuiv: 50, arg: 1 });
});

test('planCoinConvert : renvoie null quand rien ne peut être converti', () => {
  assert.equal(L.planCoinConvert({ cuiv: 50 }, 'cuiv', 'arg', 50), null);   // sous le seuil
  assert.equal(L.planCoinConvert({ cuiv: 0 }, 'cuiv', 'arg', 100), null);   // solde nul
  assert.equal(L.planCoinConvert({ cuiv: 100 }, 'cuiv', 'cuiv', 100), null); // même dénomination
  assert.equal(L.planCoinConvert({ cuiv: 100 }, 'cuiv', 'xxx', 100), null);  // clé inconnue
  assert.equal(L.planCoinConvert(null, 'cuiv', 'arg', 100), null);           // bourse absente
  assert.equal(L.planCoinConvert({ cuiv: 100 }, 'cuiv', 'arg', -5), null);   // montant négatif
});

test('planCoinConvert : aller-retour sans perte sur un multiple exact', () => {
  const up = L.planCoinConvert({ cuiv: 10000 }, 'cuiv', 'or', 10000);
  assert.deepEqual(up.patch, { cuiv: 0, or: 1 });
  const down = L.planCoinConvert(up.patch, 'or', 'cuiv', 1);
  assert.deepEqual(down.patch, { or: 0, cuiv: 10000 });
});

/* --- Journal d'économie : formatage des mouvements de pièces --- */
test('coinsAmountText : montant lisible, de la plus forte à la plus faible', () => {
  assert.equal(L.coinsAmountText({ cuiv: 15, or: 2 }), '2 or, 15 cuivre');
  assert.equal(L.coinsAmountText({ plat: 1, arg: 3 }), '1 platine, 3 argent');
});

test('coinsAmountText : zéros, clés inconnues et bourse vide sont ignorés', () => {
  assert.equal(L.coinsAmountText({ or: 0, cuiv: 5, xxx: 9 }), '5 cuivre');
  assert.equal(L.coinsAmountText({}), '');
  assert.equal(L.coinsAmountText(null), '');
});

test('coinsDeltaText : signe explicite dans les deux sens', () => {
  assert.equal(L.coinsDeltaText({ or: 1, cuiv: 20 }, { or: 3, cuiv: 5 }), '+2 or, −15 cuivre');
  assert.equal(L.coinsDeltaText({}, { arg: 4 }), '+4 argent');
});

test('coinsDeltaText : un patch PARTIEL laisse les clés absentes inchangées', () => {
  // `after` ne porte que l'or : l'argent de `before` ne doit produire aucun delta.
  assert.equal(L.coinsDeltaText({ or: 5, arg: 99 }, { or: 7 }), '+2 or');
  assert.equal(L.coinsDeltaText({ or: 5 }, { or: 5 }), '');   // rien n'a bougé
});

test('coinsDeltaValue : signe du mouvement, en cuivre', () => {
  assert.ok(L.coinsDeltaValue({ or: 1 }, { or: 3 }) > 0);          // enrichissement
  assert.ok(L.coinsDeltaValue({ arg: 10 }, { arg: 4 }) < 0);       // retrait
  // Change de monnaie : 100 cuivre échangés contre 1 argent → valeur nette nulle.
  assert.equal(L.coinsDeltaValue({ cuiv: 100, arg: 0 }, { cuiv: 0, arg: 1 }), 0);
});

/* --- Journal : élagage (le journal d'économie n'est jamais purgé) --- */
test("staleLogIds : ne rend rien tant que le plafond n'est pas dépassé", () => {
  const map = { a: { ts: 1 }, b: { ts: 2 } };
  assert.deepEqual(L.staleLogIds(map, 30), []);
  assert.deepEqual(L.staleLogIds({}, 30), []);
  assert.deepEqual(L.staleLogIds(null, 30), []);
});

test('staleLogIds : rend les plus ANCIENS au-delà du plafond', () => {
  const map = { a: { ts: 30 }, b: { ts: 10 }, c: { ts: 20 }, d: { ts: 40 } };
  assert.deepEqual(L.staleLogIds(map, 2).sort(), ['b', 'c']);   // on garde d(40) et a(30)
  assert.equal(L.staleLogIds(map, 0).length, 4);
});

test('staleLogIds : plafond par défaut = LOG_MAX', () => {
  const map = {};
  for (let i = 0; i < L.LOG_MAX + 5; i++) map['e' + i] = { ts: i };
  assert.equal(L.staleLogIds(map).length, 5);
  assert.ok(!L.staleLogIds(map).includes('e' + (L.LOG_MAX + 4)));   // la plus récente est gardée
});

/* --- Durcissement RTDB : les pièces amorcées doivent être des entiers >= 0 --- */
test('coinInt : normalise en entier >= 0 (contrat de la règle RTDB)', () => {
  assert.equal(L.coinInt(5), 5);
  assert.equal(L.coinInt(-3), 0);        // signe refusé par la règle
  assert.equal(L.coinInt(2.7), 2);       // décimale refusée par la règle
  assert.equal(L.coinInt('4'), 4);       // chaîne refusée par la règle
  assert.equal(L.coinInt(undefined), 0);
  assert.equal(L.coinInt('x'), 0);       // NaN
});

test("buildDefaultState : coins toujours entiers >= 0, même si le perso est mal saisi", () => {
  // L'amorçage écrit tout le sous-arbre `state` d'un coup : une seule valeur non
  // entière ferait échouer le seed ENTIER une fois le .validate publié.
  const char = { id: 'x', level: 1, attrs: { force: 5, hab: 5, mental: 5, magie: 5 },
    coins: { plat: -2, or: 3.9, arg: '7', cuiv: null } };
  const st = L.buildDefaultState(char);
  assert.deepEqual(st.coins, { plat: 0, or: 3, arg: 7, cuiv: 0 });
  for (const k of Object.keys(st.coins)) {
    assert.ok(Number.isInteger(st.coins[k]) && st.coins[k] >= 0, k);
  }
});

test("sanitizeCampaignCoins : aligne une vieille sauvegarde sur le contrat de la règle", () => {
  const data = {
    sharedCoins: { or: 2.5, cuiv: -1, arg: 4 },
    characters: { a: { state: { coins: { arg: '7' } } }, b: { state: {} }, c: null },
  };
  assert.equal(sanitizeCampaignCoins_count(data), 3);   // or, cuiv, arg('7') — arg:4 déjà conforme
  assert.deepEqual(data.sharedCoins, { or: 2, cuiv: 0, arg: 4 });
  assert.deepEqual(data.characters.a.state.coins, { arg: 7 });
});

function sanitizeCampaignCoins_count(d) { return L.sanitizeCampaignCoins(d); }

test('sanitizeCampaignCoins : tolère une sauvegarde vide ou malformée', () => {
  assert.equal(L.sanitizeCampaignCoins(null), 0);
  assert.equal(L.sanitizeCampaignCoins({}), 0);
  assert.equal(L.sanitizeCampaignCoins({ characters: { a: {} } }), 0);
});

/* --- Regression 2026-08-21 : bourse ECRASEE au lieu d'etre creditee --- */
test('planCoinMove : CREDITE la destination, ne la remplace pas', () => {
  // Le bug : la destination etait lue via useAllCharStates(), refuse a un joueur
  // par les regles RTDB -> repli {0,0,0,0} -> 6 argent + 4 pris donnait 4.
  const plan = L.planCoinMove({ arg: 10 }, { arg: 6 }, 'arg', 4);
  assert.equal(plan.moved, 4);
  assert.equal(plan.to, 10);     // 6 + 4, surtout PAS 4
  assert.equal(plan.from, 6);    // 10 - 4
});

test('planCoinMove : borne le montant au solde de la source', () => {
  const plan = L.planCoinMove({ or: 3 }, { or: 1 }, 'or', 99);
  assert.equal(plan.moved, 3);
  assert.equal(plan.from, 0);
  assert.equal(plan.to, 4);
});

test('planCoinMove : destination vide ou absente = simple credit', () => {
  assert.deepEqual(L.planCoinMove({ cuiv: 5 }, {}, 'cuiv', 5), { moved: 5, from: 0, to: 5 });
  assert.deepEqual(L.planCoinMove({ cuiv: 5 }, null, 'cuiv', 2), { moved: 2, from: 3, to: 2 });
});

test('planCoinMove : rend null quand rien ne peut bouger', () => {
  assert.equal(L.planCoinMove({ arg: 0 }, { arg: 6 }, 'arg', 4), null);   // source vide
  assert.equal(L.planCoinMove({ arg: 5 }, { arg: 6 }, 'arg', 0), null);   // montant nul
  assert.equal(L.planCoinMove({ arg: 5 }, { arg: 6 }, 'arg', -3), null);  // montant negatif
  assert.equal(L.planCoinMove(null, {}, 'arg', 4), null);                 // source absente
});

/* --- Camp des combattants non-joueurs (PNJ alliés) --- */
test('combatantSide : `side` absent = ennemi (aucune migration a ecrire)', () => {
  assert.equal(L.combatantSide({ name: 'Gobelin' }), 'enemy');
  assert.equal(L.combatantSide({ name: 'Gobelin', side: 'enemy' }), 'enemy');
  assert.equal(L.combatantSide({ name: 'Clerc', side: 'ally' }), 'ally');
  // valeur inconnue ou entree vide => ennemi, jamais d'allie par accident
  assert.equal(L.combatantSide({ side: 'bidon' }), 'enemy');
  assert.equal(L.combatantSide(null), 'enemy');
  assert.equal(L.combatantSide(undefined), 'enemy');
});
test('isAlly : vrai pour le seul camp allie', () => {
  assert.equal(L.isAlly({ side: 'ally' }), true);
  assert.equal(L.isAlly({ side: 'enemy' }), false);
  assert.equal(L.isAlly({}), false);
});
test('splitCombatants : repartit par camp en preservant l ordre d origine', () => {
  const list = [
    { id: 'a', side: 'enemy' }, { id: 'b', side: 'ally' },
    { id: 'c' }, { id: 'd', side: 'ally' },
  ];
  const out = L.splitCombatants(list);
  assert.deepEqual(out.enemies.map(c => c.id), ['a', 'c']);   // 'c' sans `side` = ennemi
  assert.deepEqual(out.allies.map(c => c.id), ['b', 'd']);
});
test('splitCombatants : liste vide ou absente = deux camps vides', () => {
  assert.deepEqual(L.splitCombatants([]), { enemies: [], allies: [] });
  assert.deepEqual(L.splitCombatants(null), { enemies: [], allies: [] });
});

/* --- Initiative & creneaux de tour --- */
/* Raccourcis : score valide, en attente, refuse. */
const okS = (d6, bonus) => ({ d6, bonus: bonus || 0, ok: true });
/* Combattants normalises {id, hp, joinRound}. */
const cbt = (id, hp, joinRound) => ({ id, hp: hp == null ? 100 : hp, joinRound });

test('rollInitiative : borne 1..6, rng injectable', () => {
  assert.equal(L.rollInitiative(() => 0), 1);
  assert.equal(L.rollInitiative(() => 0.5), 4);
  assert.equal(L.rollInitiative(() => 0.9999), 6);
  // rng() === 1 ne doit JAMAIS produire 7
  assert.equal(L.rollInitiative(() => 1), 6);
  // rng absurde => borne basse, pas de NaN
  assert.equal(L.rollInitiative(() => NaN), 1);
  // sans rng : reste dans la plage
  for (let i = 0; i < 200; i++) {
    const v = L.rollInitiative();
    assert.ok(v >= 1 && v <= 6 && Number.isInteger(v), 'hors plage : ' + v);
  }
});

test('initiativeTotal : d6 + bonus, bonus negatif accepte', () => {
  assert.equal(L.initiativeTotal({ d6: 4, bonus: 2 }), 6);
  // bonus de KIT (Urskaar, Voie de l ours : +1) : s ajoute au de et au bonus du MJ
  assert.equal(L.initiativeTotal({ d6: 4, kit: 1 }), 5);
  assert.equal(L.initiativeTotal({ d6: 4, bonus: -2, kit: 1 }), 3);
  assert.equal(L.initiativeBonus({ bonus: 2, kit: 1 }), 3);
  assert.equal(L.initiativeBonus(null), 0);
  assert.equal(L.initiativeTotal({ d6: 4, bonus: -2 }), 2);
  assert.equal(L.initiativeTotal({ d6: 1, bonus: -3 }), -2);   // total negatif possible
  assert.equal(L.initiativeTotal({ d6: 5 }), 5);               // bonus absent = 0
  assert.equal(L.initiativeTotal({ bonus: 3 }), null);         // pas de jet = pas de score
  assert.equal(L.initiativeTotal(null), null);
  // d6 hors plage borne (une valeur ecrite a la main en console ne passe pas)
  assert.equal(L.initiativeTotal({ d6: 9, bonus: 0 }), 6);
  assert.equal(L.initiativeTotal({ d6: 0, bonus: 0 }), 1);
});

test('initiativeStatus : cycle jet -> validation MJ', () => {
  assert.equal(L.initiativeStatus(null), 'idle');
  assert.equal(L.initiativeStatus({}), 'idle');
  assert.equal(L.initiativeStatus({ d6: 4 }), 'pending');            // attend le MJ
  assert.equal(L.initiativeStatus({ d6: 4, ok: true }), 'ok');
  assert.equal(L.initiativeStatus({ reroll: true }), 'reroll');      // MJ a refuse
  assert.equal(L.initiativeReady({ d6: 4, ok: true }), true);
  assert.equal(L.initiativeReady({ d6: 4 }), false);
});

test('initiativeSlots : tri decroissant, ex aequo regroupes', () => {
  const slots = L.initiativeSlots(
    [cbt('a'), cbt('b'), cbt('c'), cbt('d')],
    { a: okS(5), b: okS(6), c: okS(5), d: okS(3) }, 1);
  assert.deepEqual(slots.map(s => s.init), [6, 5, 3]);
  assert.deepEqual(slots[1].members, ['a', 'c']);      // ordre d'origine preserve
  assert.deepEqual(slots[0].members, ['b']);           // creneau a un seul membre
});

test('initiativeSlots : un score non valide par le MJ n entre PAS en jeu', () => {
  const slots = L.initiativeSlots(
    [cbt('a'), cbt('b'), cbt('c')],
    { a: okS(5), b: { d6: 6 }, c: { reroll: true } }, 1);
  assert.deepEqual(slots.map(s => s.init), [5]);
  assert.deepEqual(slots[0].members, ['a']);
});

test('initiativeSlots : le retardataire ne rejoint qu au round suivant', () => {
  const list = [cbt('a'), cbt('renfort', 100, 3)];
  const sc = { a: okS(2), renfort: okS(6) };
  // arrive au round 3 : absent des rounds 1 et 2, meme avec un meilleur score
  assert.deepEqual(L.initiativeSlots(list, sc, 2).map(s => s.init), [2]);
  assert.deepEqual(L.initiativeSlots(list, sc, 3).map(s => s.init), [6, 2]);
  // joinRound absent = present des le debut
  assert.equal(L.combatantJoinRound({ id: 'x' }), 1);
  assert.equal(L.combatantJoinRound({ id: 'x', joinRound: 4 }), 4);
});

test('initiativeJoinOnValidate : entree immediate au tout debut du combat', () => {
  // round 1, personne n'a encore declare : c'est l'ajout de setup, il joue tout de suite
  assert.equal(L.initiativeJoinOnValidate(1, {}, null), null);
  assert.equal(L.initiativeJoinOnValidate(1, { a: false }, null), null);
});

test('initiativeJoinOnValidate : combat engage => entree au round suivant', () => {
  // round 1 mais quelqu'un a fini son tour : le combat est lance
  assert.equal(L.initiativeJoinOnValidate(1, { a: true }, null), 2);
  // round > 1 : engage meme si personne n'a encore agi ce round-ci
  assert.equal(L.initiativeJoinOnValidate(3, {}, null), 4);
  assert.equal(L.initiativeJoinOnValidate(3, { a: true }, null), 4);
});

test('initiativeJoinOnValidate : un choix manuel du MJ n est jamais ecrase', () => {
  // renfort annonce pour le round 7 : la validation ne le ramene pas a round+1
  assert.equal(L.initiativeJoinOnValidate(3, { a: true }, 7), null);
  assert.equal(L.initiativeJoinOnValidate(1, {}, 2), null);
});

test('slotParticipants : KO AVANT son creneau => saute', () => {
  const byId = { mort: { id: 'mort', hp: 0 }, vif: { id: 'vif', hp: 30 } };
  const ko = { mort: { round: 1, init: 6 } };   // tue au creneau 6
  // son creneau a lui est 3 : il ne le joue pas
  assert.deepEqual(L.slotParticipants(['mort', 'vif'], byId, ko, 1, 3), ['vif']);
});

test('slotParticipants : KO PENDANT son propre creneau => agit quand meme', () => {
  const byId = { mort: { id: 'mort', hp: 0 }, vif: { id: 'vif', hp: 30 } };
  const ko = { mort: { round: 1, init: 3 } };   // tue AU creneau 3, qui est le sien
  assert.deepEqual(L.slotParticipants(['mort', 'vif'], byId, ko, 1, 3), ['mort', 'vif']);
});

test('slotParticipants : KO d un round anterieur => reste hors jeu', () => {
  const byId = { mort: { id: 'mort', hp: 0 } };
  const ko = { mort: { round: 1, init: 3 } };
  assert.deepEqual(L.slotParticipants(['mort'], byId, ko, 2, 3), []);
});

test('initiativeState : creneau partiellement declare => toujours actif', () => {
  const list = [cbt('a'), cbt('b'), cbt('c')];
  const sc = { a: okS(6), b: okS(6), c: okS(4) };
  const st = L.initiativeState(list, sc, { a: true }, {}, 1);
  assert.equal(st.activeInit, 6);
  assert.deepEqual(st.active.pending, ['b']);
  assert.equal(st.complete, false);
});

test('initiativeState : creneau entierement declare => le suivant s active', () => {
  const list = [cbt('a'), cbt('b'), cbt('c')];
  const sc = { a: okS(6), b: okS(6), c: okS(4) };
  const st = L.initiativeState(list, sc, { a: true, b: true }, {}, 1);
  assert.equal(st.activeInit, 4);          // aucune ecriture n'a ete necessaire
  assert.deepEqual(st.active.pending, ['c']);
  assert.equal(st.complete, false);
});

test('initiativeState : tous les creneaux declares => round complet', () => {
  const list = [cbt('a'), cbt('b')];
  const sc = { a: okS(6), b: okS(4) };
  const st = L.initiativeState(list, sc, { a: true, b: true }, {}, 1);
  assert.equal(st.active, null);
  assert.equal(st.activeInit, null);
  assert.equal(st.complete, true);
});

test('initiativeState : creneau entierement KO avant ouverture => saute, PAS de blocage', () => {
  const list = [cbt('mort1', 0), cbt('mort2', 0), cbt('vif', 50)];
  const sc = { mort1: okS(6), mort2: okS(6), vif: okS(2) };
  const ko = { mort1: { round: 1, init: 9 }, mort2: { round: 1, init: 9 } };
  const st = L.initiativeState(list, sc, {}, ko, 1);
  assert.deepEqual(st.slots[0].participants, []);   // creneau 6 : personne a jouer
  assert.equal(st.slots[0].complete, true);
  assert.equal(st.activeInit, 2);                   // on est passe directement au suivant
});

test('initiativeState : un `done` parasite (combattant absent) est ignore', () => {
  const st = L.initiativeState([cbt('a')], { a: okS(5) }, { fantome: true }, {}, 1);
  assert.equal(st.activeInit, 5);
  assert.deepEqual(st.active.pending, ['a']);
});

test('initiativeState : plateau vide ou sans score => pas de plantage, round non complet', () => {
  const vide = L.initiativeState([], {}, {}, {}, 1);
  assert.deepEqual(vide.slots, []);
  assert.equal(vide.active, null);
  assert.equal(vide.complete, false);           // rien a jouer != round termine
  const nul = L.initiativeState(null, null, null, null, 0);
  assert.deepEqual(nul.slots, []);
  assert.equal(nul.complete, false);
  // des combattants mais aucun score valide
  const sansScore = L.initiativeState([cbt('a')], {}, {}, {}, 1);
  assert.deepEqual(sansScore.slots, []);
  assert.equal(sansScore.complete, false);
});

/* --- Assistant caracs -> stats PNJ (lot 6) --- */
test('npcStatsFromAttrs : patch complet, coherent avec computeStats', () => {
  const a = { force: 5, hab: 3, mental: 4, magie: 2 };
  const s = L.computeStats(5, 3, 4, 2, 6);
  const p = L.npcStatsFromAttrs(a, 6);
  assert.equal(p.hpMax, s.hp);
  assert.equal(p.hpCur, s.hp);          // le PNJ nait au maximum
  assert.equal(p.manaMax, s.mana);
  assert.equal(p.manaCur, s.mana);
  assert.equal(p.armure, s.armure);
  assert.equal(p.resmag, s.resmag);
  assert.equal(p.crit, s.crit);
  assert.equal(p.dcrit, s.dcrit);
  // l'ennemi n'a qu'un champ `atk` : la plus elevee de AD/AP
  assert.equal(p.atk, Math.max(s.ad, s.ap));
});
test('npcStatsFromAttrs : un profil magique prend son AP comme attaque', () => {
  const p = L.npcStatsFromAttrs({ force: 0, hab: 0, mental: 0, magie: 10 }, 5);
  const s = L.computeStats(0, 0, 0, 10, 5);
  assert.ok(s.ap > s.ad, 'profil cense etre magique');
  assert.equal(p.atk, s.ap);
});
test('npcStatsFromAttrs : zone PNJ (>20 pts) — croissance SUPER-LINEAIRE', () => {
  const atk = (f) => L.npcStatsFromAttrs({ force: f, hab: 0, mental: 0, magie: 0 }, 10).atk;
  // Meme ecart de 6 points, une fois SOUS le seuil PNJ et une fois AU-DESSUS :
  // au-dela de 20 l'escalade devient quadratique (§8), le second gain doit dominer.
  const dansLaNorme = atk(20) - atk(14);
  const zonePNJ     = atk(26) - atk(20);
  assert.ok(zonePNJ > dansLaNorme,
    `zone PNJ non appliquee : +${dansLaNorme} sous le seuil contre +${zonePNJ} au-dessus`);
  // NB : ne PAS tester ce ratio sur hpMax — son socle plat (50 + 30*niveau) dilue
  // l'escalade et masque la propriete qu'on veut verifier.
});
test('npcStatsFromAttrs : arguments absents = pas de plantage', () => {
  const p = L.npcStatsFromAttrs(null, null);
  assert.ok(Number.isFinite(p.hpMax) && p.hpMax > 0);
  assert.ok(Number.isFinite(p.atk));
});

/* ============================================================
   MODES D'ATTAQUE DE BASE (2026-09-06)
   ============================================================ */
test("BASIC_MODES : table de ratios verrouillee (decision MJ du 2026-09-06)", () => {
  const r = {};
  L.BASIC_MODES.forEach((m) => { r[m.id] = m.mult; });
  assert.deepEqual(r, {
    normal: 1, retenu: 0.5, poing: 0.25, botte: 0.15, bousculade: 0.1, gifle: 0.05,
  });
  // Le premier mode est le defaut de l'UI : il DOIT etre l'attaque pleine.
  assert.equal(L.BASIC_MODES[0].id, 'normal');
  assert.equal(L.BASIC_MODES[0].mult, 1);
});
test("BASIC_MODES : seule l'attaque pleine peut faire un coup critique", () => {
  // Ruling MJ : un geste de mepris ne doit pas pouvoir sortir un gros chiffre.
  L.BASIC_MODES.forEach((m) => {
    assert.equal(m.crit === true, m.id === 'normal', `crit incoherent pour ${m.id}`);
  });
});
test('basicModeDamage : ratio applique et arrondi', () => {
  assert.equal(L.basicModeDamage(504, 'normal'), 504);
  assert.equal(L.basicModeDamage(504, 'gifle'), 25);    // 25.2 -> 25
  assert.equal(L.basicModeDamage(504, 'botte'), 76);    // 75.6 -> 76
  assert.equal(L.basicModeDamage(101, 'retenu'), 51);   // 50.5 -> 51
});
test('basicModeDamage : pas de plancher artificiel a 1', () => {
  // Une gifle sur une puissance derisoire rend 0, et c'est une information juste :
  // le MJ ajuste le champ a la resolution comme pour n'importe quelle attaque.
  assert.equal(L.basicModeDamage(9, 'gifle'), 0);
  assert.equal(L.basicModeDamage(0, 'normal'), 0);
});
test('basicMode : id inconnu ou absent = attaque pleine', () => {
  // Un mode retire du code ne doit pas transformer une attaque en coup a 0.
  assert.equal(L.basicMode('mode_disparu').id, 'normal');
  assert.equal(L.basicMode(undefined).id, 'normal');
  assert.equal(L.basicModeDamage(200, 'mode_disparu'), 200);
});
test('basicModeDamage : puissance invalide = 0, jamais NaN', () => {
  assert.equal(L.basicModeDamage(null, 'gifle'), 0);
  assert.equal(L.basicModeDamage(-50, 'normal'), 0);
});

/* ============================================================
   ACTIONS EN ATTENTE (spec 2026-09-06)
   ============================================================ */

/* Competences de reference, calquees sur les vraies formes de data.jsx. */
const SK_DMG    = { id: 'frappe', name: 'Frappe', mana: 20, dmg: () => 120 };
const SK_MULTI  = { id: 'salve', name: 'Salve', mana: 60, dmg: () => 90,
  targeting: { damage: { max: null } } };
const SK_MIXTE  = { id: 'align', name: 'Alignement', mana: 40, dmg: () => 100, heal: () => 80,
  targeting: { damage: { min: 0, max: null }, heal: { camp: 'allies', min: 0, max: null } } };
const SK_STATUT = { id: 'mur', name: 'Mur de Givre', mana: 50, dmg: () => null,
  duration: { min: 1, max: 2 },
  selfBuffFlat: () => ({ armure: 20, resmag: 20 }),
  counterBump: { key: 'glaciation', by: 1, min: 1, max: 5 } };
const SK_NARR   = { id: 'fondu', name: 'Fondu au noir', mana: 40, dmg: () => null };
const EFF = { crit: 0, dcrit: 150, mana: 300, hp: 500, ad: 200, letha: 0, lethaMag: 0 };

/* --- skillTargeting --- */
test('skillTargeting : une comp a degats cible 1 ennemi par defaut', () => {
  const t = L.skillTargeting(SK_DMG, EFF, {});
  assert.deepEqual(t.damage, { camp: 'any', min: 1, max: 1 });
  assert.equal(t.heal, undefined);
  assert.equal(t.status, undefined);
});
test('skillTargeting : dmg() qui rend null ne cree PAS d effet de degats', () => {
  // Cinq comps declarent `dmg: () => null` (Fondu au noir, Ralliement, Mur de Givre,
  // Ailes de Givre, Souverain Glacial) : tester `!!sk.dmg` leur donnerait une ligne
  // « Degats » vide et exigerait une cible pour rien.
  assert.equal(L.skillTargeting(SK_NARR, EFF, {}).damage, undefined);
  assert.equal(L.skillTargeting(SK_STATUT, EFF, {}).damage, undefined);
});
test('skillTargeting : comp mixte = deux effets, chacun son camp', () => {
  const t = L.skillTargeting(SK_MIXTE, EFF, {});
  assert.equal(t.damage.max, null);
  assert.equal(t.heal.camp, 'allies');
  assert.equal(t.heal.min, 0);
});
test('skillTargeting : un effet sur soi donne un effet status implicite', () => {
  const t = L.skillTargeting(SK_STATUT, EFF, {});
  assert.equal(t.status.camp, 'self');
});

/* --- castSelectionValid --- */
test('castSelectionValid : refuse un lancement sans cible', () => {
  const t = L.skillTargeting(SK_DMG, EFF, {});
  const r = L.castSelectionValid(t, { damage: [] });
  assert.equal(r.ok, false);
  assert.equal(r.effect, 'damage');
  assert.match(r.reason, /au moins 1 cible/);
});
test('castSelectionValid : refuse au-dela du max', () => {
  const t = L.skillTargeting(SK_DMG, EFF, {});
  assert.equal(L.castSelectionValid(t, { damage: ['a', 'b'] }).ok, false);
});
test('castSelectionValid : max null = illimite', () => {
  const t = L.skillTargeting(SK_MULTI, EFF, {});
  assert.equal(L.castSelectionValid(t, { damage: ['a', 'b', 'c', 'd'] }).ok, true);
});
test('castSelectionValid : un effet sur soi n exige aucune cible', () => {
  const t = L.skillTargeting(SK_STATUT, EFF, {});
  assert.equal(L.castSelectionValid(t, {}).ok, true);
});
test('castSelectionValid : une comp a effets TOUS optionnels exige quand meme une cible', () => {
  // Alignement de sequence : min 0 des deux cotes. Sans garde globale, « Lancer »
  // partirait avec zero cible et brulerait 40 mana en « effet en table ».
  const t = L.skillTargeting(SK_MIXTE, EFF, {});
  const r = L.castSelectionValid(t, { damage: [], heal: [] });
  assert.equal(r.ok, false);
  assert.match(r.reason, /au moins une cible/);
});
test('castSelectionValid : une comp SANS effet ciblable reste lancable', () => {
  // Fondu au noir ne cible rien : la garde globale ne doit pas la bloquer.
  assert.equal(L.castSelectionValid(L.skillTargeting(SK_NARR, EFF, {}), {}).ok, true);
});
test('castSelectionValid : min 0 laisse passer un effet non cible', () => {
  // Alignement peut ne blesser personne ou ne soigner personne selon la scene.
  const t = L.skillTargeting(SK_MIXTE, EFF, {});
  assert.equal(L.castSelectionValid(t, { damage: ['g1'], heal: [] }).ok, true);
});

/* --- buildCastPlan --- */
const OPTS = { turn: 3, base: { hp: 400, ad: 180, armure: 40 }, selfId: 'rathael',
  wType: 'Physique', cdPrev: null, rng: () => 0.99 };   // rng haut = jamais de crit

test('castSelectionValid : sans cible, refuse — sauf si la competence a aussi un effet sur son lanceur', () => {
  const zone = { id: 'z', dmg: () => 50, targeting: { damage: { min: 0, max: null } } };
  assert.equal(L.castSelectionValid(L.skillTargeting(zone, EFF, {}), {}).ok, false);
  // transformation + pietinement optionnel (C4 d Urskaar) : lancable sans rien pietiner
  // un effet sur soi ne suffit pas (Surcharge de Jett : cellules consommees pour rien) …
  const surcharge = Object.assign({}, zone, { counterSet: { cn: 0 } });
  assert.equal(L.castSelectionValid(L.skillTargeting(surcharge, EFF, {}), {}).ok, false);
  // … il faut que la competence DECLARE son ciblage optionnel
  const transfo = Object.assign({}, zone, { selfBuff: { hp: 0.3 }, targeting: { damage: { min: 0, max: null, optional: true } } });
  const t = L.skillTargeting(transfo, EFF, {});
  assert.equal(L.castSelectionValid(t, {}).ok, true);
  const p = L.buildCastPlan(transfo, EFF, {}, {}, OPTS);
  assert.deepEqual(p.instances.map(i => [i.kind, !!i.narrative]), [['status', false]]);
  assert.equal(L.castSelectionValid(t, { damage: ['g1', 'g2', 'g3'] }).ok, true);
});
test('buildCastPlan : N cibles = N instances de degats, une par cible', () => {
  const p = L.buildCastPlan(SK_MULTI, EFF, {}, { damage: ['g1', 'g2', 'g3'] }, OPTS);
  assert.equal(p.instances.length, 3);
  assert.deepEqual(p.instances.map(i => i.targetId), ['g1', 'g2', 'g3']);
  assert.deepEqual(p.instances.map(i => i.seq), [1, 2, 3]);
  p.instances.forEach(i => { assert.equal(i.kind, 'damage'); assert.equal(i.computedDmg, 90); });
});
test('buildCastPlan : comp mixte = degats aux ennemis ET soin aux allies', () => {
  const p = L.buildCastPlan(SK_MIXTE, EFF, {}, { damage: ['g1', 'g2'], heal: ['urskaar'] }, OPTS);
  assert.equal(p.instances.length, 3);
  assert.deepEqual(p.instances.map(i => i.kind), ['damage', 'damage', 'heal']);
  assert.equal(p.instances[2].targetId, 'urskaar');
  assert.equal(p.instances[2].amount, 80);
});
test('buildCastPlan : le cout appartient a l ACTION, pas a l instance', () => {
  // 3 cibles ne coutent pas 3x60 mana : c'est le pivot des regles de remboursement.
  const p = L.buildCastPlan(SK_MULTI, EFF, {}, { damage: ['g1', 'g2', 'g3'] }, OPTS);
  assert.equal(p.cost.mana, 60);
  assert.equal(p.cost.manaPer, 0);
  assert.equal(p.cost.manaMax, 300);
});
test('skillManaCost : grille du reequilibrage (cout du niveau 2, +8 % par niveau, C4 fixes)', () => {
  // [cout niveau 2, niveau 10, niveau 18] — §3 du plan du 2026-10-10
  const grid = [[10, 16, 23], [28, 46, 64], [13, 21, 30], [21, 34, 48], [26, 43, 59], [15, 25, 34],
    [27, 44, 62], [50, 82, 114], [30, 49, 68], [32, 52, 73]];
  grid.forEach(([n2, n10, n18]) => {
    const sk = { mana: n2 };
    assert.deepEqual([L.skillManaCost(sk, 2), L.skillManaCost(sk, 10), L.skillManaCost(sk, 18)], [n2, n10, n18]);
  });
  assert.equal(L.skillManaCost({ mana: 100, manaFixed: true }, 18), 100);   // C4 : cout fixe
  assert.equal(L.skillManaCost({ mana: 28 }), 28);                          // niveau absent = niveau 2
  assert.equal(L.skillManaCost({ mana: 50 }, 1), 46);                       // sous le niveau 2 : la pente continue
  assert.equal(L.skillManaCost({ mana: 0 }, 18), 0);
  assert.equal(L.skillManaCost(null, 5), 0);
  // cout par cible : meme pente (Surcharge de Jett, 13 + 4 par cellule)
  const sur = { mana: 13, manaPer: 4 };
  assert.deepEqual([L.skillManaPer(sur, 2), L.skillManaPer(sur, 10), L.skillManaPer(sur, 18)], [4, 7, 9]);
});
test('buildCastPlan : le cout suit le niveau du lanceur (opts.level, a defaut ctx.level)', () => {
  const sel = { damage: ['g1'] };
  assert.equal(L.buildCastPlan(SK_MULTI, EFF, {}, sel, Object.assign({}, OPTS, { level: 10 })).cost.mana, 98);
  assert.equal(L.buildCastPlan(SK_MULTI, EFF, { level: 18 }, sel, OPTS).cost.mana, 137);
  const fixe = Object.assign({}, SK_MULTI, { manaFixed: true });
  assert.equal(L.buildCastPlan(fixe, EFF, { level: 18 }, sel, OPTS).cost.mana, 60);
});
test('withKitInitiative : le bonus de kit est pose a la lecture, jamais dans les scores lus', () => {
  const scores = { urskaar: { d6: 3, bonus: 1, ok: true }, smith: { d6: 5, ok: true } };
  const out = L.withKitInitiative(scores, { urskaar: 1 });
  assert.deepEqual(out.urskaar, { d6: 3, bonus: 1, ok: true, kit: 1 });
  assert.equal(out.smith, scores.smith);                          // intact
  assert.equal(scores.urskaar.kit, undefined);                    // l objet lu n est pas modifie
  assert.equal(L.initiativeTotal(out.urskaar), 5);
  // pas encore lance : une entree vide porte le bonus, sans creer de score
  const vide = L.withKitInitiative({}, { urskaar: 1 });
  assert.deepEqual(vide.urskaar, { kit: 1 });
  assert.equal(L.initiativeTotal(vide.urskaar), null);
  assert.equal(L.initiativeStatus(vide.urskaar), 'idle');
  // il change de creneau : 3 + 1 (MJ) + 1 (kit) = 5
  const slots = L.initiativeSlots([{ id: 'urskaar', hp: 10 }, { id: 'smith', hp: 10 }], out, 1);
  assert.deepEqual(slots, [{ init: 5, members: ['urskaar', 'smith'] }]);
});
test('buildCastPlan : champs des rangs 1 — noCrit, critBonus, dmgType, dmgLabel', () => {
  const sel = { damage: ['g1'] };
  const eff = Object.assign({}, EFF, { crit: 40 });
  const jamais = Object.assign({}, OPTS, { rng: () => 0.5 });     // 0,5 : crit a 70 %, pas a 40 %
  let p = L.buildCastPlan(SK_MULTI, eff, {}, sel, jamais);
  assert.deepEqual([p.instances[0].didCrit, p.instances[0].crit], [false, 40]);
  p = L.buildCastPlan(Object.assign({}, SK_MULTI, { critBonus: () => 30 }), eff, {}, sel, jamais);
  assert.deepEqual([p.instances[0].didCrit, p.instances[0].crit], [true, 70]);
  p = L.buildCastPlan(Object.assign({}, SK_MULTI, { noCrit: true, critBonus: () => 100 }), eff, {}, sel, jamais);
  assert.deepEqual([p.instances[0].didCrit, p.instances[0].crit, p.instances[0].critDmg], [false, 0, 90]);
  // type impose par la competence (poison de Jett), sinon celui de l arme
  p = L.buildCastPlan(Object.assign({}, SK_MULTI, { dmgType: () => 'magique' }), EFF, {}, sel, OPTS);
  assert.equal(p.instances[0].type, 'magique');
  p = L.buildCastPlan(Object.assign({}, SK_MULTI, { dmgType: () => null }), EFF, {}, sel, OPTS);
  assert.equal(p.instances[0].type, 'physique');
  p = L.buildCastPlan(Object.assign({}, SK_MULTI, { dmgLabel: () => 'Saignement : 30 bruts par tour' }), EFF, {}, sel, OPTS);
  assert.equal(p.instances[0].label, 'Saignement : 30 bruts par tour');
});
test('buildCastPlan : selfHeal = un soin du lanceur, proportionnel aux cibles touchees', () => {
  const sk = Object.assign({}, SK_MULTI, { selfHeal: (eff, c, n) => 40 * n });
  const p = L.buildCastPlan(sk, EFF, {}, { damage: ['g1', 'g2', 'g3'] }, OPTS);
  assert.deepEqual(p.instances.map(i => i.kind), ['damage', 'damage', 'damage', 'heal']);
  const h = p.instances[3];
  assert.deepEqual([h.targetId, h.amount, h.sameActor], ['rathael', 120, true]);
});
test('buildCastPlan + resolveBoon : bouclier ou mana donne a un allie', () => {
  const bouclier = { id: 'remod', name: 'Remodulation', mana: 32, dmg: () => null, boon: () => ({ shield: 100, label: 'Bouclier de 100' }) };
  assert.deepEqual(L.skillTargeting(bouclier, EFF, {}).boon, { camp: 'allies', min: 1, max: 1 });
  assert.equal(L.castSelectionValid(L.skillTargeting(bouclier, EFF, {}), {}).ok, false);    // il faut une cible
  const eff = Object.assign({}, EFF, { soins: 10 });
  let p = L.buildCastPlan(bouclier, eff, {}, { boon: ['urskaar'] }, OPTS);
  assert.equal(p.instances.length, 1);                              // pas d instance narrative en plus
  const inst = p.instances[0];
  assert.deepEqual([inst.kind, inst.targetId, inst.boon, inst.shield, inst.healBonus, inst.sameActor],
    ['status', 'urskaar', true, 100, 10, false]);
  // `soins` : producteur 10 % + receveur 20 % (additif)
  assert.equal(L.resolveBoon(inst, { soins: 20, buffs: [] }).shield, 130);
  // sur soi : le producteur compte seul
  p = L.buildCastPlan(bouclier, eff, {}, { boon: ['rathael'] }, OPTS);
  assert.equal(L.resolveBoon(p.instances[0], { soins: 10, buffs: [] }).shield, 110);
  // mana : pourcentage du mana max DU RECEVEUR, inconnu du lanceur
  const mana = { id: 'remod', name: 'Remodulation', mana: 32, dmg: () => null, boon: () => ({ manaPct: 17.5, label: 'Mana' }) };
  p = L.buildCastPlan(mana, EFF, {}, { boon: ['smith'] }, OPTS);
  assert.deepEqual(L.resolveBoon(p.instances[0], { manaMax: 400 }), { label: '+70 mana', manaGain: 70, manaMax: 400 });
  // sans configuration tiree : ni degats, ni soin, ni bienfait → une instance narrative
  const vide = { id: 'remod', name: 'Remodulation', mana: 32, dmg: () => null, heal: () => null, boon: () => null };
  p = L.buildCastPlan(vide, EFF, {}, {}, Object.assign({}, OPTS, { narrative: 'Configuration a tirer en table' }));
  assert.deepEqual([p.instances.length, p.instances[0].narrative, p.instances[0].label], [1, true, 'Configuration a tirer en table']);
});
test('Jett C3 Surcharge destructrice : cout par cellule, degats, mana rendu aux allies', () => {
  assert.equal(L.dmgJettC3({ ad: 100 }, 3), 138);                  // 60 + 6 x niveau + 60 % AD
  assert.equal(L.dmgJettC3({ ad: 100 }, 18), 228);
  assert.deepEqual(L.jettC3Boon({ ap: 200 }), { manaPct: 20, manaFlat: 50, label: 'Mana : 20 % de son mana max + 50' });
  assert.equal(L.resolveBoon(Object.assign({ boon: true }, L.jettC3Boon({ ap: 200 })), { manaMax: 300 }).manaGain, 110);
  // cout : 13 + 4 par cellule au niveau 2 ; 21 + 7 au niveau 10 ; 30 + 9 au niveau 18 (§3 du plan)
  const sk = { id: 'surcharge', mana: 13, manaPer: 4, manaCount: (c) => c.counters.cn, dmg: () => 100, counterSet: { cn: 0 },
    targeting: { damage: { min: 0, max: null } } };
  const cn = (n) => ({ counters: { cn: n } });
  assert.deepEqual([L.skillCastCost(sk, 2, cn(0)), L.skillCastCost(sk, 2, cn(3)), L.skillCastCost(sk, 10, cn(3)), L.skillCastCost(sk, 18, cn(3))],
    [13, 25, 42, 57]);
  const p = L.buildCastPlan(sk, EFF, Object.assign({ level: 2 }, cn(3)), { damage: ['g1', 'g2'] }, OPTS);
  assert.equal(p.cost.mana, 25);
  // ⚠️ un cout par CELLULE n est pas un cout par cible : rien n est rendu en retirant une instance
  assert.equal(p.cost.manaPer, 0);
  // les cellules sont consommees : une instance sur le lanceur remet le compteur a zero
  const self = p.instances.find(i => i.kind === 'status');
  assert.deepEqual(self.counters, { cn: 0 });
});
test('Jett C4 Nano-hex : stats sur le plafond de carac du niveau, un bonus par cellule', () => {
  // niveau 4 : plafond 7 → PV 40,5 x 7, AD = AP = 13,5 x 7, Armure = RM = 2 x 7
  let s = L.nanoHexStats(7, {});
  assert.deepEqual([s.hp, s.ad, s.ap, s.armure, s.resmag, s.crit, s.dcrit], [284, 95, 95, 14, 14, 5, 150]);
  assert.deepEqual([s.attack, s.ray, s.cells], [80, 80, 0]);         // 12 + 72 % de 95
  // 5 cellules en AD : +75 % de l AD de BASE (additif), le rayon ne bouge pas
  s = L.nanoHexStats(7, { ad: 5 });
  assert.deepEqual([s.ad, s.attack, s.ray, s.cells], [165, 130, 80, 5]);
  s = L.nanoHexStats(7, { hp: 2, crit: 1, dcrit: 1, armure: 1, resmag: 2 });
  assert.deepEqual([s.hp, s.crit, s.dcrit, s.armure, s.resmag, s.cells], [340, 25, 170, 26, 38, 7]);
  assert.equal(L.allocTotal({ ad: 2, hp: 1, x: -4 }), 3);
  // actions libres : le Nano-hex frappe avec SA fiche, rien de Jett ne passe (ni lethalite ni vol de vie)
  assert.equal(L.nanoHexSummon(7, { ap: 2 }).ray, L.nanoHexStats(7, { ap: 2 }).ray);
  assert.deepEqual(L.nanoHexEff({ crit: 25, dcrit: 170, hpMax: 324 }),
    { crit: 25, dcrit: 170, hp: 324, letha: 0, lethaMag: 0, vol: 0, sapience: 0, omni: 0, soins: 0, mana: 0 });
  assert.equal(L.nanoHexEff(null).dcrit, 150);
  const fiche = L.nanoHexSummon(7, { ad: 5 });
  assert.deepEqual([fiche.name, fiche.hpMax, fiche.hpCur, fiche.atk, fiche.crit, fiche.dcrit], ['Nano-hex', 284, 284, 130, 5, 150]);
  // le cast depose la fiche dans une instance `summon` ; le MJ en fait un PNJ allie
  const sk = { id: 'nano_hex', mana: 100, manaFixed: true, dmg: () => null, counterSet: { cn: 0 },
    summon: (eff, c) => L.nanoHexSummon(7, c.alloc) };
  const p = L.buildCastPlan(sk, EFF, { level: 18, alloc: { ad: 5 }, counters: { cn: 5 } }, {}, OPTS);
  assert.equal(p.cost.mana, 100);                                    // cout fixe
  assert.deepEqual(p.instances.map(i => [i.kind, !!i.summon, !!i.narrative]), [['status', true, false], ['status', false, false]]);
  assert.equal(p.instances[0].summon.atk, 130);
});
test('buildCastPlan : effet sur soi = une instance status sur le lanceur', () => {
  const ctx = { counters: { glaciation: 2 }, duration: 2 };
  const p = L.buildCastPlan(SK_STATUT, EFF, ctx, {}, OPTS);
  assert.equal(p.instances.length, 1);
  const st = p.instances[0];
  assert.equal(st.kind, 'status');
  assert.equal(st.targetId, 'rathael');
  assert.deepEqual(st.mods, { armure: 20, resmag: 20 });
  assert.equal(st.until, 4);                        // turn 3 + (2 tours - 1)
  assert.deepEqual(st.counters, { glaciation: 3 }); // counterBump +1
});
test('buildCastPlan : counterBump sous son minimum ne se declenche pas', () => {
  // Mur de Givre ne donne sa charge que si Rathael en a deja au moins une.
  const p = L.buildCastPlan(SK_STATUT, EFF, { counters: {}, duration: 1 }, {}, OPTS);
  assert.equal(p.instances[0].counters, null);
});
test('buildCastPlan : une comp sans effet chiffre produit une instance NARRATIVE', () => {
  // Sinon Fondu au noir (40 mana, CD 3) ecrirait une action vide et resterait
  // hors du controle du MJ — pire qu'avant la refonte.
  const p = L.buildCastPlan(SK_NARR, EFF, {}, {},
    Object.assign({}, OPTS, { narrative: 'Camouflage 3 tours' }));
  assert.equal(p.instances.length, 1);
  assert.equal(p.instances[0].kind, 'status');
  assert.equal(p.instances[0].narrative, true);
  assert.equal(p.instances[0].label, 'Camouflage 3 tours');
  assert.equal(p.cost.mana, 40);
});
test('buildCastPlan : un buff de PV snapshote le gain ET le nouveau plafond', () => {
  const sk = { id: 'ours', mana: 100, dmg: () => 300, selfBuff: { hp: 0.30, ad: 0.30 } };
  const p = L.buildCastPlan(sk, EFF, {}, { damage: ['g1'] }, OPTS);
  const st = p.instances.find(i => i.kind === 'status');
  assert.equal(st.mods.hp, 120);        // 30 % de 400 (stat de BASE)
  assert.equal(st.hpGain, 120);
  assert.equal(st.hpMax, 620);          // eff.hp 500 + 120
});
test('buildCastPlan : noCrit ne roule pas le de et envoie le %Crit a 0', () => {
  // Ruling MJ : un mode d'attaque reduit (gifle) ne neutralise pas le resultat
  // apres coup, il ne lance pas — et la carte du MJ doit dire la verite de CE coup.
  const p = L.buildCastPlan(SK_DMG, Object.assign({}, EFF, { crit: 100 }), {},
    { damage: ['g1'] }, Object.assign({}, OPTS, { noCrit: true }));
  assert.equal(p.instances[0].didCrit, false);
  assert.equal(p.instances[0].critMult, 1);
  assert.equal(p.instances[0].crit, 0);
});

/* --- actionRefundPlan --- */
function mkAction(over) {
  return Object.assign({ attackerId: 'jett', attackerName: 'Jett', skillId: 'align',
    skillName: 'Alignement', source: 'skill', appliedCount: 0,
    cost: { mana: 40, manaPer: 0, manaMax: 300, cdPrev: null },
    instances: { i1: {}, i2: {}, i3: {} } }, over);
}

test('actionRefundPlan : annuler la competence rembourse tout', () => {
  const p = L.actionRefundPlan(mkAction(), 'cancel');
  assert.equal(p.mana, 40);
  assert.equal(p.restoreCd, true);
  assert.equal(p.cdPrev, null);
});
test('actionRefundPlan : rejeter UNE instance parmi d autres ne rembourse rien', () => {
  assert.equal(L.actionRefundPlan(mkAction(), 'instance'), null);
});
test('actionRefundPlan : rejeter la DERNIERE instance = annulation complete', () => {
  // Regle du MJ : on garde cette logique jusqu'a ce qu'il n'y ait plus d'instances,
  // auquel cas on revient au cas ou le MJ a annule la competence entiere.
  const p = L.actionRefundPlan(mkAction({ instances: { i3: {} } }), 'instance');
  assert.ok(p);
  assert.equal(p.mana, 40);
  assert.equal(p.restoreCd, true);
});
test('actionRefundPlan : une instance DEJA APPLIQUEE coupe tout remboursement', () => {
  // Une salve sur 3 gnolls dont 2 meurent ne doit pas devenir gratuite.
  assert.equal(L.actionRefundPlan(mkAction({ appliedCount: 1, instances: { i3: {} } }), 'instance'), null);
  assert.equal(L.actionRefundPlan(mkAction({ appliedCount: 2 }), 'cancel'), null);
});
test('actionRefundPlan : Echec ne rembourse jamais rien', () => {
  assert.equal(L.actionRefundPlan(mkAction(), 'fail'), null);
  assert.equal(L.actionRefundPlan(mkAction({ instances: { i1: {} } }), 'fail'), null);
});
test('actionRefundPlan : manaPer rend la part de la cible rejetee, sans le cooldown', () => {
  // Prevu pour le jour ou un kit facture a la cible ; vaut 0 partout aujourd'hui.
  const p = L.actionRefundPlan(
    mkAction({ cost: { mana: 40, manaPer: 10, manaMax: 300, cdPrev: null } }), 'instance');
  assert.equal(p.mana, 10);
  assert.equal(p.restoreCd, false);
});
test('actionRefundPlan : le cooldown d avant le cast est restitue tel quel', () => {
  const p = L.actionRefundPlan(
    mkAction({ cost: { mana: 40, manaPer: 0, manaMax: 300, cdPrev: 7 } }), 'cancel');
  assert.equal(p.cdPrev, 7);
});
test('actionRefundPlan : une attaque de base ne rembourse rien', () => {
  const a = mkAction({ source: 'basic', skillId: 'basic',
    cost: { mana: 0, manaPer: 0, manaMax: 300, cdPrev: null }, instances: { i1: {} } });
  assert.equal(L.actionRefundPlan(a, 'instance'), null);
  assert.equal(L.actionRefundPlan(a, 'cancel'), null);
});

test('refundManaValue : plafonne au max, ne baisse jamais le courant', () => {
  assert.equal(L.refundManaValue(100, 40, 300), 140);
  assert.equal(L.refundManaValue(280, 40, 300), 300);   // plafond
  assert.equal(L.refundManaValue(320, 40, 300), 320);   // deja au-dessus : inchange
  assert.equal(L.refundManaValue(100, 40, 0), 140);     // plafond inconnu : somme brute
  assert.equal(L.refundManaValue(0, 0, 300), 0);
});

/* ============================================================
   ARMES ET MAÎTRISES (livraison 1, spec 2026-09-14)
   ============================================================ */
const W = (id, weaponCat, extra) => L.makeItem(Object.assign({ id, name: id, cat: 'Équipement', type: 'weapon', weaponCat }, extra || {}));

test('armes — référentiel : 38 catégories, toutes les propriétés existent, explosifs absents', () => {
  assert.equal(L.WEAPON_CATEGORIES.length, 38);
  L.WEAPON_CATEGORIES.forEach(c => c.props.forEach(p => assert.ok(L.WEAPON_PROPERTIES[p], c.id + ' → ' + p)));
  assert.equal(L.WEAPON_CATEGORIES.filter(c => /xplosif/.test(c.name)).length, 0);
  assert.deepEqual(L.WEAPON_CATEGORIES.filter(c => c.mini).map(c => c.id).sort(),
    ['dague', 'epee_courte', 'hachette', 'masse_armes', 'sarbacane']);
  assert.equal(L.weaponCategory('orbe').mini, false);   // décision MJ 8b
  assert.deepEqual(L.WEAPON_TIER_MODS.base, { phys: { ad: 15 }, mag: { ap: 15 }, hyb: { ad: 10, ap: 10 } });
});

test('armes — weaponCat traverse makeItem, la fusion, le transfert et l amorçage du catalogue', () => {
  assert.equal(L.makeItem({}).weaponCat, '');
  const src = { a: W('a', 'dague', { qty: 2 }) };
  const { dstPatch } = L.planItemTransfer(src, {}, 'a', 1);
  assert.equal(Object.values(dstPatch)[0].weaponCat, 'dague');
  // même nom, même type, catégorie différente : pas de fusion
  const dst = { x: W('x', 'epee_courte', { name: 'a', qty: 1 }) };
  const p2 = L.fillStacks(dst, src.a, 1);
  assert.equal(Object.keys(p2).includes('x'), false);
  const seed = L.buildCatalogSeed([{ name: 'Dague', type: 'weapon', weaponCat: 'dague' }]);
  assert.equal(Object.values(seed)[0].weaponCat, 'dague');
});

test('armes — loadout : 2H, poly à deux mains, 1H, mains nues', () => {
  const items = { c: W('c', 'claymore'), e: W('e', 'epee_longue'), g: W('g', 'gantelet'), s: L.makeItem({ id: 's', type: 'shield' }) };
  let lo = L.weaponLoadout({ armePrincipale: 'c' }, items);
  assert.equal(lo.attacker.id, 'c'); assert.equal(lo.twoHanded, true); assert.deepEqual(lo.issues, []);
  lo = L.weaponLoadout({ armePrincipale: 'e' }, items);
  assert.equal(lo.twoHanded, true);                              // poly, main libre
  lo = L.weaponLoadout({ armePrincipale: 'e', armeSecondaire: 's' }, items);
  assert.equal(lo.twoHanded, false);                             // poly + bouclier
  lo = L.weaponLoadout({ armePrincipale: 'c', armeSecondaire: 's' }, items);
  assert.deepEqual(lo.issues, ['two_handed_blocked']);
  lo = L.weaponLoadout({ armePrincipale: 'g' }, items);
  assert.equal(lo.twoHanded, false);
  lo = L.weaponLoadout({}, items);
  assert.equal(lo.attacker, null);
});

test('armes — loadout : mini + mini, poly + mini (l arme non mini attaque), deux non mini', () => {
  const items = { d1: W('d1', 'dague'), d2: W('d2', 'dague'), a: W('a', 'arbalete_legere'), h: W('h', 'hachette'), g: W('g', 'gantelet') };
  let lo = L.weaponLoadout({ armePrincipale: 'd1', armeSecondaire: 'd2' }, items);
  assert.equal(lo.pair, 'mini+mini'); assert.equal(lo.attacker.id, 'd1');
  lo = L.weaponLoadout({ armePrincipale: 'h', armeSecondaire: 'a' }, items);
  assert.equal(lo.pair, 'main+mini'); assert.equal(lo.attacker.id, 'a'); assert.equal(lo.support.id, 'h');
  assert.equal(lo.twoHanded, false);                             // l'arbalète poly est tenue à une main
  lo = L.weaponLoadout({ armePrincipale: 'a', armeSecondaire: 'g' }, items);
  assert.deepEqual(lo.issues, ['two_non_mini']);
});

test('armes — profil : −25 % sans maîtrise, et les propriétés perdues', () => {
  const items = { c: W('c', 'claymore') };
  const lo = L.weaponLoadout({ armePrincipale: 'c' }, items);
  const eff = { ad: 400, ap: 100 };
  let p = L.basicAttackProfile(lo, { claymore: true }, eff, {});
  assert.equal(p.power, 240); assert.equal(p.mastered, true); assert.deepEqual(p.props.map(x => x.id), ['balayage']);   // 400 x 60 %
  p = L.basicAttackProfile(lo, {}, eff, {});
  assert.equal(p.power, 180); assert.equal(p.malusPct, 25); assert.deepEqual(p.props, []);
  assert.deepEqual(p.lostProps, ['balayage']);
  assert.equal(p.dmgType, 'physique'); assert.equal(p.wType, 'Physique');
});

test('armes — profil : mini-arme seule 36 % (60 % x 60 %), non maîtrisée elle garde tout ; deux mini-armes 60 %', () => {
  const items = { d1: W('d1', 'dague'), d2: W('d2', 'dague') };
  const eff = { ad: 500 };
  let p = L.basicAttackProfile(L.weaponLoadout({ armePrincipale: 'd1' }, items), {}, eff, {});
  assert.equal(p.power, 180); assert.equal(p.mastered, true); assert.deepEqual(p.props.map(x => x.id), ['fourberie']);
  assert.equal(p.ratio, 0.6);                                    // `ratio` reste relatif à une arme normale
  p = L.basicAttackProfile(L.weaponLoadout({ armePrincipale: 'd1', armeSecondaire: 'd2' }, items), {}, eff, {});
  assert.equal(p.power, 300); assert.equal(p.ratio, 1);
  assert.deepEqual(p.props.map(x => x.id), ['fourberie']);       // même propriété : une seule fois
});

test('armes — profil : poly + mini offre les deux propriétés ; celle de l arme non maîtrisée disparaît', () => {
  const items = { e: W('e', 'epee_longue'), d: W('d', 'dague') };
  const lo = L.weaponLoadout({ armePrincipale: 'e', armeSecondaire: 'd' }, items);
  let p = L.basicAttackProfile(lo, { epee_longue: true }, { ad: 100 }, {});
  assert.deepEqual(p.props.map(x => x.id + ':' + x.source), ['parade_riposte:attacker', 'fourberie:support']);
  assert.equal(p.power, 60);
  p = L.basicAttackProfile(lo, {}, { ad: 100 }, {});
  assert.deepEqual(p.props.map(x => x.id), ['fourberie']);
  assert.equal(p.power, 45);
});

test('armes — profil : le choix hybride bascule la stat ET le type ; arc hextech en cellules sans dégâts', () => {
  const items = { p: W('p', 'pistolet_hextech'), a: W('a', 'arc_hextech') };
  const eff = { ad: 200, ap: 300 };
  const m = { pistolet_hextech: true, arc_hextech: true };
  let p = L.basicAttackProfile(L.weaponLoadout({ armePrincipale: 'p' }, items), m, eff, {});
  assert.equal(p.stat, 'ad'); assert.equal(p.power, 120);
  p = L.basicAttackProfile(L.weaponLoadout({ armePrincipale: 'p' }, items), m, eff, { mode: 'ap' });
  assert.equal(p.stat, 'ap'); assert.equal(p.dmgType, 'magique'); assert.equal(p.wType, 'Magique'); assert.equal(p.power, 180);
  p = L.basicAttackProfile(L.weaponLoadout({ armePrincipale: 'a' }, items), m, eff, {});
  assert.equal(p.mode.id, 'cellules'); assert.equal(p.damage, false);
  p = L.basicAttackProfile(L.weaponLoadout({ armePrincipale: 'a' }, items), m, eff, { mode: 'ad' });
  assert.equal(p.damage, true); assert.equal(p.dmgType, 'physique'); assert.equal(p.power, 120);
  p = L.basicAttackProfile(L.weaponLoadout({ armePrincipale: 'p' }, items), m, eff, { mode: 'inconnu' });
  assert.equal(p.mode.id, 'ad');                                 // mode inconnu : mode par défaut
});

test('armes — attaque de base à 60 % : échelle globale, multipliée avec mini-arme et maîtrise (MJ 2026-10-10)', () => {
  assert.equal(L.BASIC_ATTACK_RATIO, 0.6);
  const items = { c: W('c', 'claymore'), d1: W('d1', 'dague'), d2: W('d2', 'dague') };
  const eff = { ad: 1000, ap: 200 };
  const P = (eq, m) => L.basicAttackProfile(L.weaponLoadout(eq, items), m, eff, {});
  assert.equal(P({ armePrincipale: 'c' }, { claymore: true }).power, 600);
  assert.equal(P({ armePrincipale: 'c' }, {}).power, 450);                        // x0,75 par-dessus
  assert.equal(P({ armePrincipale: 'd1' }, {}).power, 360);                       // mini seule : 36 %
  assert.equal(P({ armePrincipale: 'd1', armeSecondaire: 'd2' }, {}).power, 600); // 36 % + 24 % = une arme normale
  assert.equal(P({}, {}).power, 600);                                             // mains nues
  assert.equal(Math.round(P({ armePrincipale: 'd1' }, {}).scale * 100), 36);
});

test('armes — une arme sans catégorie reste neutre (comportement d avant la livraison)', () => {
  const items = { x: L.makeItem({ id: 'x', type: 'weapon', name: 'Épée + Bouclier' }) };
  const p = L.basicAttackProfile(L.weaponLoadout({ armePrincipale: 'x' }, items), {}, { ad: 80 }, {});
  assert.equal(p.power, 48); assert.equal(p.mastered, true); assert.deepEqual(p.issues, []);
  const bare = L.basicAttackProfile(L.weaponLoadout({}, items), {}, { ad: 80 }, {});
  assert.equal(bare.name, 'Mains nues'); assert.equal(bare.power, 48);
});

test('armes — sumItemMods : une arme en accessoire ne donne rien, un accessoire normal si', () => {
  const items = { d: W('d', 'dague', { mods: { ad: 15 } }), r: L.makeItem({ id: 'r', type: 'accessory', mods: { crit: 5 } }) };
  assert.deepEqual(L.sumItemMods({ accessoire1: 'd', accessoire2: 'r' }, items), { crit: 5 });
  assert.deepEqual(L.sumItemMods({ armeSecondaire: 'd' }, items), { ad: 15 });
});

test('armes — Canalisation : +50 +10/niveau seulement maîtrisée et en main ; Plénitude +5 crit +10 dcrit', () => {
  const items = { b: W('b', 'baton_magique', { mods: { ap: 15 } }), o: W('o', 'orbe') };
  assert.deepEqual(L.sumItemMods({ armePrincipale: 'b' }, items, { baton_magique: true }, 2), { mana: 70, ap: 15 });
  assert.deepEqual(L.sumItemMods({ armePrincipale: 'b' }, items, { baton_magique: true }, 18), { mana: 230, ap: 15 });
  assert.deepEqual(L.sumItemMods({ armePrincipale: 'b' }, items, {}, 18), { ap: 15 });
  assert.deepEqual(L.sumWeaponPropMods({ armePrincipale: 'o' }, items, { orbe: true }, 5), { crit: 5, dcrit: 10 });
  assert.deepEqual(L.sumWeaponPropMods({ accessoire1: 'o' }, items, { orbe: true }, 5), {});
});

test('armes — equipSlotCheck : 2H, deux non mini, accessoires', () => {
  const items = { c: W('c', 'claymore'), e: W('e', 'epee_longue'), g: W('g', 'gantelet'), d: W('d', 'dague'),
    s: L.makeItem({ id: 's', type: 'shield' }), r: L.makeItem({ id: 'r', type: 'accessory' }) };
  const H = ['weapon'], OFF = ['offhand', 'shield', 'weapon'], ACC = ['accessory'];
  assert.equal(L.equipSlotCheck({ armeSecondaire: 's' }, items, 'c', 'armePrincipale', 'weapon', H).ok, false);
  assert.equal(L.equipSlotCheck({ armePrincipale: 'c' }, items, 's', 'armeSecondaire', 'shield', OFF).ok, false);
  assert.equal(L.equipSlotCheck({ armePrincipale: 'e' }, items, 'g', 'armeSecondaire', 'weapon', OFF).ok, false);
  assert.equal(L.equipSlotCheck({ armePrincipale: 'e' }, items, 'd', 'armeSecondaire', 'weapon', OFF).ok, true);
  assert.equal(L.equipSlotCheck({ armePrincipale: 'e' }, items, 's', 'armeSecondaire', 'shield', OFF).ok, true);
  // l'objet change de main : l'autre main se libère, pas de faux conflit
  assert.equal(L.equipSlotCheck({ armePrincipale: 'c' }, items, 'c', 'armeSecondaire', 'weapon', OFF).ok, true);
  assert.equal(L.equipSlotCheck({}, items, 'd', 'accessoire1', 'weapon', ACC).ok, true);
  assert.equal(L.equipSlotCheck({}, items, 'g', 'accessoire1', 'weapon', ACC).ok, false);
  assert.equal(L.equipSlotCheck({}, items, 'r', 'accessoire1', 'accessory', ACC).ok, true);
  assert.equal(L.equipSlotCheck({}, items, 'r', 'armePrincipale', 'accessory', H).ok, false);
});

test('armes — mini-arme de soutien avec une arme non mini : propriété oui, stats non (MJ 2026-09-15)', () => {
  const items = { a: W('a', 'arbalete_legere', { mods: { ad: 15 } }), h: W('h', 'hachette', { mods: { ad: 15 } }),
    h2: W('h2', 'hachette', { mods: { ad: 15 } }) };
  const m = { arbalete_legere: true };
  // quel que soit l'emplacement de la mini-arme
  assert.deepEqual(L.sumItemMods({ armePrincipale: 'a', armeSecondaire: 'h' }, items, m, 2), { ad: 15 });
  assert.deepEqual(L.sumItemMods({ armePrincipale: 'h', armeSecondaire: 'a' }, items, m, 2), { ad: 15 });
  const p = L.basicAttackProfile(L.weaponLoadout({ armePrincipale: 'a', armeSecondaire: 'h' }, items), m, { ad: 100 }, {});
  assert.deepEqual(p.props.map(x => x.id), ['brisage']);
  // deux mini-armes : les deux comptent
  assert.deepEqual(L.sumItemMods({ armePrincipale: 'h', armeSecondaire: 'h2' }, items, {}, 2), { ad: 30 });
});

/* ============================================================
   ARMES — LIVRAISON 2 : propriétés automatisées
   ⚠️ rng : chaque instance de dégâts qui roule le crit consomme UN tirage (crit 0 → jamais de crit).
   ============================================================ */
const rngSeq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
/* `power` = puissance d'attaque PLEINE d'une arme normale : la stat est remontée de 1/0,6 pour que
   les ratios des propriétés se lisent sur 100 (l'échelle de l'attaque de base a son propre test). */
const prof = (cat, masteries, power, extraItems) => {
  const items = Object.assign({ w: W('w', cat) }, extraItems || {});
  const eq = { armePrincipale: 'w' };
  if (extraItems && extraItems.s) eq.armeSecondaire = 's';
  return L.basicAttackProfile(L.weaponLoadout(eq, items), masteries || { [cat]: true },
    { ad: (power || 100) / L.BASIC_ATTACK_RATIO, ap: (power || 100) / L.BASIC_ATTACK_RATIO }, {});
};
const WEFF = { ad: 100, ap: 100, hp: 1000, mana: 400, crit: 0, dcrit: 150 };
const atk = (p, input) => L.buildWeaponAttack(p, WEFF, Object.assign({ turn: 3, selfId: 'me', rng: rngSeq(0.99),
  active: L.weaponActiveProps(p) }, input));

test('armes L2 — une seule source de propriétés par tour ; défaut = arme d attaque', () => {
  const items = { e: W('e', 'epee_longue'), d: W('d', 'dague') };
  const p = L.basicAttackProfile(L.weaponLoadout({ armePrincipale: 'e', armeSecondaire: 'd' }, items), { epee_longue: true }, WEFF, {});
  assert.deepEqual(L.weaponPropSources(p), ['attacker', 'support']);
  assert.deepEqual(L.weaponActiveProps(p), ['parade_riposte']);
  assert.deepEqual(L.weaponActiveProps(p, 'support'), ['fourberie']);
  // arme d'attaque sans propriété (arbalète) : la mini-arme joue par défaut
  const it2 = { a: W('a', 'arbalete_legere'), h: W('h', 'hachette') };
  const p2 = L.basicAttackProfile(L.weaponLoadout({ armePrincipale: 'a', armeSecondaire: 'h' }, it2), { arbalete_legere: true }, WEFF, {});
  assert.deepEqual(L.weaponActiveProps(p2), ['brisage']);
});

test('armes L2 — Balayage : 3 cibles à 80 %, pas deux tours d affilée', () => {
  const p = prof('claymore');
  assert.equal(L.weaponAttackTargeting(['balayage'], { sweep: true }, {}, 3).damage.max, 3);
  const r = atk(p, { targets: ['a', 'b', 'c'], toggles: { sweep: true }, rng: rngSeq(0.99, 0.99, 0.99) });
  assert.equal(r.ok, true);
  assert.deepEqual(r.instances.map(i => i.computedDmg), [80, 80, 80]);
  assert.deepEqual(r.cooldown, { key: 'w_balayage', readyAt: 5 });
  assert.equal(r.cost.cdKey, 'w_balayage');
  const again = atk(p, { targets: ['a'], toggles: { sweep: true }, cooldowns: { w_balayage: 5 }, turn: 4 });
  assert.equal(again.ok, false);
  assert.equal(atk(p, { targets: ['a', 'b'], toggles: {} }).ok, false);   // sans Balayage : une cible
});

test('armes L2 — Attaque double : 2 × 65 %, une cible reçoit les deux', () => {
  const p = prof('epee_courte', {});
  const r = atk(p, { targets: ['a'], toggles: { double: true }, rng: rngSeq(0.99, 0.99) });
  assert.deepEqual(r.instances.map(i => [i.targetId, i.computedDmg]), [['a', 39], ['a', 39]]);   // 100 × 60 % × 65 %
  assert.equal(r.cooldown, null);
});

test('armes L2 — Duel : 125 % sur la cible désignée, perdu en changeant de cible, re-désigné si elle tombe', () => {
  const p = prof('rapiere');
  let r = atk(p, { targets: ['a'] });
  assert.equal(r.instances[0].computedDmg, 125); assert.equal(r.combat.duelTarget, 'a');
  r = atk(p, { targets: ['b'], weaponCombat: { duelTarget: 'a' } });
  assert.equal(r.instances[0].computedDmg, 100); assert.equal(r.combat.duelTarget, null);
  r = atk(p, { targets: ['b'], weaponCombat: { duelTarget: 'a' }, isKo: id => id === 'a' });
  assert.equal(r.instances[0].computedDmg, 125); assert.equal(r.combat.duelTarget, 'b');
});

test('armes L2/L3 — Concentration : CASE À COCHER ; crit doublé sur la cible ; relâcher ou changer = 1 tour de rechargement', () => {
  const p = prof('arc_court');
  const eff = Object.assign({}, WEFF, { crit: 20 });
  const go = (extra) => L.buildWeaponAttack(p, eff, Object.assign({ turn: 3, selfId: 'me', active: ['concentration'], rng: rngSeq(0.99) }, extra));
  // non cochée et aucune concentration en cours : rien
  let r = go({ targets: ['a'] });
  assert.equal(r.instances[0].crit, 20); assert.equal(r.combat.concTarget, null); assert.equal(r.cooldown, null);
  // cochée : désignation, crit doublé
  r = go({ targets: ['a'], toggles: { concentrate: true } });
  assert.equal(r.instances[0].crit, 40); assert.equal(r.combat.concTarget, 'a');
  // concentration en cours, case non touchée (absente) : on la garde
  r = go({ targets: ['a'], weaponCombat: { concTarget: 'a' } });
  assert.equal(r.instances[0].crit, 40); assert.equal(r.combat.concTarget, 'a');
  // décochée pendant une concentration : relâchée, rechargement
  r = go({ targets: ['a'], weaponCombat: { concTarget: 'a' }, toggles: { concentrate: false } });
  assert.equal(r.instances[0].crit, 20); assert.equal(r.combat.concTarget, null);
  assert.deepEqual(r.cooldown, { key: 'w_concentration', readyAt: 4 });
  // autre cible : perdue, rechargement
  r = go({ targets: ['b'], weaponCombat: { concTarget: 'a' } });
  assert.equal(r.instances[0].crit, 20); assert.equal(r.combat.concTarget, null);
  assert.deepEqual(r.cooldown, { key: 'w_concentration', readyAt: 4 });
  // cochée mais en rechargement : pas de désignation
  r = go({ targets: ['b'], toggles: { concentrate: true }, cooldowns: { w_concentration: 4 } });
  assert.equal(r.instances[0].crit, 20); assert.equal(r.combat.concTarget, null);
});

test('armes L2 — Combo : la relance redonne l attaque (cible libre), cumulable, expire avec le tour', () => {
  const p = prof('gantelet');
  // crit(0.99) · relance(0.1) : un seul coup, une relance ouverte — aucune instance ajoutée
  let r = atk(p, { targets: ['a'], rng: rngSeq(0.99, 0.1) });
  assert.equal(r.instances.length, 1);
  assert.deepEqual(r.combat.combo, { round: 3, chain: 1 });
  // la relance vise une AUTRE cible et relance encore
  r = atk(p, { targets: ['b'], weaponCombat: { combo: { round: 3, chain: 1 } }, rng: rngSeq(0.99, 0.2) });
  assert.deepEqual(r.instances.map(i => i.targetId), ['b']);
  assert.equal(r.label, 'Combo : relance 1 · Combo : nouvelle relance');
  assert.deepEqual(r.combat.combo, { round: 3, chain: 2 });
  // le dé échoue : la chaîne s'arrête
  r = atk(p, { targets: ['c'], weaponCombat: { combo: { round: 3, chain: 2 } }, rng: rngSeq(0.99, 0.5) });
  assert.equal(r.combat.combo, null); assert.equal(r.label, 'Combo : relance 2');
  // relance d'un tour passé : ignorée
  r = atk(p, { targets: ['a'], weaponCombat: { combo: { round: 2, chain: 1 } }, rng: rngSeq(0.99, 0.5) });
  assert.equal(r.label, '');
  // plafond de sécurité
  r = atk(p, { targets: ['a'], weaponCombat: { combo: { round: 3, chain: 10 } }, rng: rngSeq(0.99, 0.0) });
  assert.equal(r.combat.combo, null);
});

test('armes L2 — Quitte ou double : 130 % ou 100 % + 8 % PV max en bruts sur soi', () => {
  const p = prof('nunchaku');
  let r = atk(p, { targets: ['a'], toggles: { risky: true }, rng: rngSeq(0.2, 0.99) });
  assert.deepEqual(r.instances.map(i => i.computedDmg), [130]);
  r = atk(p, { targets: ['a'], toggles: { risky: true }, rng: rngSeq(0.7, 0.99) });
  assert.equal(r.instances.length, 2);
  assert.deepEqual([r.instances[1].targetId, r.instances[1].type, r.instances[1].computedDmg, r.instances[1].crit], ['me', 'brut', 80, 0]);
});

test('armes L2 — Canalisation : 5 % du mana payé au cast, ×2 en bruts', () => {
  const p = prof('baton_magique');
  const r = atk(p, { targets: ['a'], toggles: { channel: true }, manaCur: 300 });
  assert.equal(r.cost.mana, 20);
  assert.deepEqual([r.instances[1].type, r.instances[1].computedDmg], ['brut', 40]);
  assert.equal(atk(p, { targets: ['a'], toggles: { channel: true }, manaCur: 10 }).ok, false);
});

test('armes L2 — Fourberie dans le dos : +10 % crit et +20 % dégâts crit', () => {
  const p = prof('dague', {});
  const r = atk(p, { targets: ['a'], toggles: { backstab: true } });
  assert.deepEqual([r.instances[0].crit, r.instances[0].dcrit], [10, 170]);
});

test('armes L2 — Plénitude : un crit rend 5 % du mana max', () => {
  const p = prof('orbe');
  const eff = Object.assign({}, WEFF, { crit: 50 });
  const r = L.buildWeaponAttack(p, eff, { turn: 1, selfId: 'me', targets: ['a'], active: ['plenitude'], rng: rngSeq(0.1) });
  const st = r.instances.find(i => i.kind === 'status');
  assert.deepEqual([st.targetId, st.manaGain, st.manaMax], ['me', 20, 400]);
  const miss = L.buildWeaponAttack(p, eff, { turn: 1, selfId: 'me', targets: ['a'], active: ['plenitude'], rng: rngSeq(0.9) });
  assert.equal(miss.instances.some(i => i.kind === 'status'), false);
});

test('armes L2 — Connexion astrale : d6 = 1 renvoyée, 4 à 150 %, 5 critique, 6 double', () => {
  const p = prof('relique');
  let r = atk(p, { targets: ['a'], rng: rngSeq(0.0, 0.99) });
  assert.equal(r.instances[0].targetId, 'me');
  r = atk(p, { targets: ['a'], rng: rngSeq(0.55, 0.99) });                 // floor(3,3)+1 = 4
  assert.equal(r.instances[0].computedDmg, 150);
  r = atk(p, { targets: ['a'], rng: rngSeq(0.7, 0.99) });                  // 5 : crit garanti
  assert.equal(r.instances[0].didCrit, true);
  r = atk(p, { targets: ['a', 'b'], rng: rngSeq(0.99, 0.99, 0.99) });       // 6
  assert.deepEqual(r.instances.map(i => i.targetId), ['a', 'b']);
});

test('armes L2 — Purge : retrait (CD 2) ; sinon 110 % si prête ; 100 % en rechargement', () => {
  const p = prof('tronconneuse_hextech');
  let r = atk(p, { targets: ['a'], toggles: { purgeHasBuff: true } });
  assert.equal(r.instances[0].narrative, true); assert.equal(r.instances[0].targetId, 'a');
  assert.deepEqual(r.cooldown, { key: 'w_purge', readyAt: 5 });
  r = atk(p, { targets: ['a'] });
  assert.equal(r.instances[0].computedDmg, 110);
  r = atk(p, { targets: ['a'], cooldowns: { w_purge: 5 } });
  assert.equal(r.instances[0].computedDmg, 100);
});

test('armes L2 — Décimation : 50 % sur toutes les cibles, soin égal, 1×/combat', () => {
  const p = prof('hache_double');
  assert.equal(L.weaponAttackTargeting(['decimation'], { decimation: true }, {}, 1).damage.max, null);
  const r = atk(p, { targets: ['a', 'b', 'c'], toggles: { decimation: true }, rng: rngSeq(0.99, 0.99, 0.99) });
  assert.deepEqual(r.instances.map(i => i.kind), ['damage', 'damage', 'damage', 'heal']);
  assert.equal(r.instances[3].amount, 150);
  assert.equal(r.cooldown.readyAt, 999999);
  assert.equal(atk(p, { targets: ['a'], toggles: { decimation: true }, cooldowns: { w_decimation: 999999 } }).ok, false);
});

test('armes L2 — Focalisation : +15 % du mana max, rechargement 2 tours', () => {
  const r = L.buildFocalisation(WEFF, { turn: 2, selfId: 'me' });
  assert.equal(r.instances[0].manaGain, 60);
  assert.deepEqual(r.cooldown, { key: 'w_focalisation', readyAt: 4 });
  assert.equal(L.buildFocalisation(WEFF, { turn: 3, selfId: 'me', cooldowns: { w_focalisation: 4 } }).ok, false);
});

test('armes L2 — remboursement : le rechargement d une propriété revient via cost.cdKey', () => {
  const action = { attackerId: 'me', skillId: 'basic', source: 'basic', appliedCount: 0,
    cost: { mana: 0, manaMax: 400, cdPrev: null, cdKey: 'w_balayage' }, instances: { i1: {}, i2: {} } };
  const plan = L.actionRefundPlan(action, 'cancel');
  assert.equal(plan.cdKey, 'w_balayage'); assert.equal(plan.restoreCd, true); assert.equal(plan.cdPrev, null);
  assert.equal(L.actionRefundPlan({ attackerId: 'me', skillId: 'basic', source: 'basic', cost: { mana: 0 } }, 'cancel'), null);
});

/* ============================================================
   ARMES — LIVRAISON 3 : propriétés assistées (dé roulé par l'app, effet narratif)
   ============================================================ */
test('armes L3 — Assommage : 10 % d étourdir, sans rechargement', () => {
  const p = prof('marteau_guerre');
  // crit(0.99) · assommage(0.05 réussi) · frappe entravante(0.9 ratée)
  let r = atk(p, { targets: ['a'], rng: rngSeq(0.99, 0.05, 0.9) });
  const st = r.instances.filter(i => i.kind === 'status');
  assert.equal(st.length, 1); assert.equal(st[0].targetId, 'a'); assert.equal(st[0].narrative, true);
  assert.match(st[0].label, /Assommage/); assert.equal(st[0].cdKey, undefined);
  r = atk(p, { targets: ['a'], rng: rngSeq(0.99, 0.5, 0.9) });
  assert.equal(r.instances.filter(i => i.kind === 'status').length, 0);
});

test('armes L3 — Brisage : 50 %, rechargement 3 porté par l instance ; en rechargement : pas de jet', () => {
  const p = prof('hache_guerre');
  let r = atk(p, { targets: ['a'], rng: rngSeq(0.99, 0.2) });
  const st = r.instances.find(i => i.kind === 'status');
  assert.match(st.label, /Brisé/);
  assert.deepEqual([st.cdKey, st.cdPrev], ['w_brisage', null]);
  assert.deepEqual(r.cooldown, { key: 'w_brisage', readyAt: 6 });
  r = atk(p, { targets: ['a'], rng: rngSeq(0.99, 0.8) });
  assert.equal(r.instances.some(i => i.kind === 'status'), false); assert.equal(r.cooldown, null);
  r = atk(p, { targets: ['a'], cooldowns: { w_brisage: 6 }, rng: rngSeq(0.99, 0.0) });
  assert.equal(r.instances.some(i => i.kind === 'status'), false);
});

test('armes L3 — Frappe entravante : Affaiblissement par défaut, Ralentissement au choix', () => {
  const p = prof('marteau_guerre');
  let r = atk(p, { targets: ['a'], rng: rngSeq(0.99, 0.9, 0.1) });
  assert.match(r.instances.find(i => i.kind === 'status').label, /Affaiblissement/);
  r = atk(p, { targets: ['a'], toggles: { entrave: 'ralenti' }, rng: rngSeq(0.99, 0.9, 0.1) });
  const st = r.instances.find(i => i.kind === 'status');
  assert.match(st.label, /Ralentissement/); assert.equal(st.cdKey, 'w_frappe_entravante');
});

test('armes L3 — Estropiaison : 50 %, durée roulée (1er tour garanti, 25 % d arrêt, 5 max)', () => {
  const p = prof('morgenstern');
  // crit · estropie(0.1) · continue(0.9) · continue(0.9) · arrêt(0.1)
  let r = atk(p, { targets: ['a'], rng: rngSeq(0.99, 0.1, 0.9, 0.9, 0.1) });
  assert.match(r.instances.find(i => i.kind === 'status').label, /pendant 3 tours/);
  r = atk(p, { targets: ['a'], rng: rngSeq(0.99, 0.1, 0.9, 0.9, 0.9, 0.9, 0.9) });
  assert.match(r.instances.find(i => i.kind === 'status').label, /pendant 5 tours/);
});

test('armes L3 — Désarmement : remplace les dégâts, 20 % de récupérer l arme, rechargement 2', () => {
  const p = prof('tonfa');
  let r = atk(p, { targets: ['a'], toggles: { disarm: true }, rng: rngSeq(0.1) });
  assert.deepEqual(r.instances.map(i => i.kind), ['status']);
  assert.match(r.instances[0].label, /récupère/);
  assert.deepEqual(r.cooldown, { key: 'w_desarmement', readyAt: 5 });
  r = atk(p, { targets: ['a'], toggles: { disarm: true }, rng: rngSeq(0.9) });
  assert.match(r.instances[0].label, /tombe au sol/);
  assert.equal(atk(p, { targets: ['a'], toggles: { disarm: true }, cooldowns: { w_desarmement: 5 } }).ok, false);
  r = atk(p, { targets: ['a'] });                                   // sans la case : attaque normale
  assert.deepEqual(r.instances.map(i => i.kind), ['damage']);
});

test('armes L3 — Parade/Riposte : candidat requis, parade narrative, riposte 50 %, rechargement 3', () => {
  const p = prof('epee_longue');
  assert.equal(L.buildParade(p, WEFF, { turn: 2, selfId: 'me' }).ok, false);
  let r = L.buildParade(p, WEFF, { turn: 2, selfId: 'me', candidate: 'g1', rng: rngSeq(0.3, 0.99) });
  assert.deepEqual(r.instances.map(i => i.kind), ['status', 'damage']);
  assert.equal(r.instances[1].computedDmg, 100);
  assert.deepEqual(r.cooldown, { key: 'w_parade_riposte', readyAt: 5 });
  r = L.buildParade(p, WEFF, { turn: 2, selfId: 'me', candidate: 'g1', rng: rngSeq(0.7) });
  assert.deepEqual(r.instances.map(i => i.kind), ['status']);
  assert.equal(L.buildParade(p, WEFF, { turn: 3, selfId: 'me', candidate: 'g1', cooldowns: { w_parade_riposte: 5 } }).ok, false);
});

test('armes L3 — retirer un débuff rend SON rechargement, même après application des dégâts', () => {
  const action = { attackerId: 'me', skillId: 'basic', source: 'basic', appliedCount: 1,
    cost: { mana: 0, cdKey: 'w_brisage', cdPrev: null }, instances: { i2: { id: 'i2' } } };
  const plan = L.actionRefundPlan(action, 'instance', { id: 'i2', cdKey: 'w_brisage', cdPrev: 2 });
  assert.deepEqual([plan.cdKey, plan.cdPrev, plan.restoreCd, plan.mana], ['w_brisage', 2, true, 0]);
  // une instance sans rechargement : règle habituelle (rien, dégâts déjà appliqués)
  assert.equal(L.actionRefundPlan(action, 'instance', { id: 'i2' }), null);
});
