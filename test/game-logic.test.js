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
});

test('mitigateDamage : la léthalité magique réduit la rés. magique (miroir du physique)', () => {
  // Même formule que le physique : eff = max(0, RM − léth), réduction = eff/(eff+120).
  assert.equal(L.mitigateDamage(100, 'magique', { resmag: 120 }, 0), 50);
  assert.equal(L.mitigateDamage(100, 'magique', { resmag: 120 }, 60), 67);  // eff 60 → 33 % réduit
  assert.equal(L.mitigateDamage(100, 'magique', { resmag: 120 }, 120), 100); // eff 0
  assert.equal(L.mitigateDamage(100, 'magique', { resmag: 120 }, 999), 100); // borné à 0
  // La léthalité magique n'agit PAS sur l'armure (le type pilote la stat visée).
  assert.equal(L.mitigateDamage(100, 'physique', { armure: 120, resmag: 0 }, 0), 50);
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
test('escalationFactor : table de référence §4.3', () => {
  assert.equal(L.escalationFactor(0), 0);
  assert.equal(L.escalationFactor(4), 4.00);
  assert.equal(L.escalationFactor(8), 8.72);
  assert.ok(approx(L.escalationFactor(13), 15.93, 0.001));
  assert.equal(L.escalationFactor(16), 20.86);
  assert.equal(L.escalationFactor(20), 28.62);
});
test('escalationFactor : zone PNJ (>20) quadratique', () => {
  // §8 : Force 25 → facteur 45.82
  assert.ok(approx(L.escalationFactor(25), 45.82, 0.01));
});

/* --- Refonte : computeStats (profils §9, niveau 18) --- */
test('computeStats : PV des 5 profils types §9 (±2)', () => {
  // (F,H,M,C) à 33 pts, niveau 18
  assert.ok(approx(L.computeStats(13, 0, 20, 0, 18).hp, 2111)); // Tank
  assert.ok(approx(L.computeStats(20, 0, 0, 13, 18).hp, 1481)); // Carry
  assert.ok(approx(L.computeStats(0, 0, 13, 20, 18).hp, 1832)); // Mage
  assert.ok(approx(L.computeStats(13, 20, 0, 0, 18).hp, 1009)); // Assassin
  assert.ok(approx(L.computeStats(20, 13, 0, 0, 18).hp, 1262)); // Bruiser
});
test('computeStats : crit/dcrit linéaires', () => {
  const s = L.computeStats(0, 20, 0, 0, 18);
  assert.equal(s.crit, 205);   // 5 + 10*20
  assert.equal(s.dcrit, 270);  // 150 + 6*20
});
test('computeStats : socle + bonus de départ au niveau 1, caracs nulles', () => {
  const s = L.computeStats(0, 0, 0, 0, 1);
  assert.equal(s.hp, 80);      // 50 universel + 30*1 socle
  assert.equal(s.mana, 50);    // 50 universel
  assert.equal(s.armure, 1);   // 1*level
  assert.equal(s.resmag, 1);   // 1*level
  assert.equal(s.ad, 20);      // fondu = max(0, 20 - 0)
  assert.equal(s.ap, 20);      // fondu
});
test('computeStats : bonus Habileté plafonné à 5 points', () => {
  const s = L.computeStats(0, 5, 0, 0, 1);
  assert.equal(s.hp, 180);     // 80 + 20*min(5,5)
  assert.equal(s.armure, 6);   // 1*level + 1*min(5,5)
  assert.equal(s.resmag, 6);
  // au-delà de 5, le bonus de départ ne grimpe plus
  assert.equal(L.computeStats(0, 8, 0, 0, 1).hp, 180);
});
test('computeStats : pas de Sapience dans la base', () => {
  assert.equal(L.computeStats(20, 20, 20, 20, 18).sapience, undefined);
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
test('rollCrit : espérance §6.3 (sanity, tolérance)', () => {
  let sum = 0, n = 4000;
  for (let i = 0; i < n; i++) sum += L.rollCrit(150, 200, Math.random).multiplier;
  const avg = sum / n;                       // attendu ≈ (200 + 25)/100 = 2.25
  assert.ok(Math.abs(avg - 2.25) < 0.1, `avg=${avg}`);
});
test('mitigateDamage : la léthalité réduit la résistance (sans passer sous 0)', () => {
  assert.equal(L.mitigateDamage(100, 'physique', { armure: 120 }, 0), 50);   // eff 120 → 50 %
  assert.equal(L.mitigateDamage(100, 'physique', { armure: 120 }, 120), 100); // eff 0 → aucune réduction
  assert.equal(L.mitigateDamage(100, 'physique', { armure: 120 }, 200), 100); // eff borné à 0
  assert.equal(L.mitigateDamage(100, 'brut',     { armure: 120 }, 50), 100);  // brut ignore tout
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
test('dmgRathaelC1 (rééquilibrée) : ratios par niveau × multiplicateur de charges', () => {
  const eff = { ad: 100, armure: 50, resmag: 30 };
  // niveau 2 : adRatio 0,30 ; arRatio 0,45 → base = 25 + floor(30) + floor(80*0,45=36) = 91
  assert.equal(L.dmgRathaelC1(eff, 0, 2), 91);
  assert.equal(L.dmgRathaelC1(eff, 5, 2), Math.floor(91 * 2));   // ×2 à 5 charges
  assert.equal(L.dmgRathaelC1(eff, 2, 2), Math.floor(91 * 1.4));
  // niveau 4 : adRatio 0,35 ; arRatio 0,50 → base = 25 + 35 + 40 = 100
  assert.equal(L.dmgRathaelC1(eff, 0, 4), 100);
});
test('dmgRathaelC1 : charges plafonnées à 5 (pas de surplus)', () => {
  const eff = { ad: 100, armure: 50, resmag: 30 };
  assert.equal(L.dmgRathaelC1(eff, 9, 2), L.dmgRathaelC1(eff, 5, 2));
});
test('rathaelC2Buff : 15 + 5/2 niveaux (floor)', () => {
  assert.equal(L.rathaelC2Buff(2), 20);   // 15 + 5*1
  assert.equal(L.rathaelC2Buff(4), 25);   // 15 + 5*2
  assert.equal(L.rathaelC2Buff(1), 15);   // 15 + 5*0
});
test('dmgRathaelC3 : base AP + (AR+RM) scalée × charges (max ×3,5)', () => {
  const eff = { ap: 100, armure: 50, resmag: 30 };
  // niveau 2 : arRatio 0,60 → base = 50 + floor(60) + floor(80*0,60=48) = 158
  assert.equal(L.dmgRathaelC3(eff, 0, 2), 158);
  assert.equal(L.dmgRathaelC3(eff, 5, 2), Math.floor(158 * 3.5)); // +250% à 5 charges
  assert.equal(L.dmgRathaelC3(eff, 9, 2), L.dmgRathaelC3(eff, 5, 2)); // plafond 5
});
test('lifestealHeal : séparation par source (attaque de base vs compétence)', () => {
  const s = { omni: 10, vol: 20, sapience: 30 };
  // Attaque de base (isBasic=true) : vol si physique, sapience si magique, jamais omni
  assert.equal(L.lifestealHeal(100, 'physique', s, true), 20);  // vol
  assert.equal(L.lifestealHeal(100, 'magique', s, true), 30);   // sapience
  assert.equal(L.lifestealHeal(100, 'brut', s, true), 0);       // ni vol ni sapience
  // Compétence (isBasic=false) : omnivamp seul, quel que soit le type
  assert.equal(L.lifestealHeal(100, 'physique', s, false), 10);
  assert.equal(L.lifestealHeal(100, 'magique', s, false), 10);
  assert.equal(L.lifestealHeal(100, 'brut', s, false), 10);
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
