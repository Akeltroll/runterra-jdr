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
