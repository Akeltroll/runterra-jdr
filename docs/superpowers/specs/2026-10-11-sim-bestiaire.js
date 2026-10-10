// Simulation de DURÉE : les 5 PJ nus contre des monstres du bestiaire (spec 2026-10-11 §10).
// Usage : node docs/superpowers/specs/2026-10-11-sim-bestiaire.js
//
// Modèle volontairement grossier — il mesure un ORDRE DE GRANDEUR de durée, pas une issue :
//  - chaque combattant sort ses dégâts moyens par round (crit moyen compris) × 0,625 (d20 :
//    1-5 échec, 6-10 demi, 11-20 plein), mitigés par l'armure ou la RM de la cible ;
//  - PJ : stat d'attaque × ratio de son kit au rang 1 (attaque de base + C1 + C2 ou C3, C4 exclues) ;
//  - les PJ concentrent leurs coups sur le monstre le plus entamé, le surplus passe au suivant ;
//  - monstres : 'focus' = ils achèvent le PJ le plus fragile ; 'spread' = dégâts répartis ;
//  - PAS de soins, de boucliers, de contrôles, de potions, de C4, ni de régénération.
//    Les vrais combats sont donc plus longs et plus favorables aux PJ que ce que dit ce modèle.
const path = require('path');
const L = require(path.join(__dirname, '..', '..', '..', 'game-logic.js'));

const D20 = 0.625;
// Ratio de dégâts par round de chaque kit, en multiples de sa stat d'attaque (cf. REF_ROUND_RATIO).
const KIT = { rathael: 1.75, urskaar: 2.0, smith: 2.4, lunick: 2.1, jett: 0.85 };
const TYPE = { jett: 'magique' };

function party(level) {
  const pb = L.npcPointBudget(level);
  return L.NPC_REF_PROFILES.map(p => {
    const a = L.npcScaleProfile(p.attrs, pb.budget, pb.cap);
    const s = L.computeStats(a[0], a[1], a[2], a[3], level);
    return { id: p.id, hp: s.hp, hpMax: s.hp, armure: s.armure, resmag: s.resmag,
      dmg: Math.max(s.ad, s.ap) * KIT[p.id] * L.critAverage(s.crit, s.dcrit) * D20, type: TYPE[p.id] || 'physique' };
  });
}
function monster(level, rank, arch, tilt, kOverride) {
  let s = L.npcSuggestStats(level, rank, arch, tilt || 0);
  let hp = s.hpMax, dmg = s.roundDmg;
  if (kOverride) { hp *= kOverride; dmg /= kOverride; }   // au-delà de la plage du curseur
  return { rank, hp, hpMax: hp, armure: s.armure, resmag: s.resmag, dmg: dmg * D20,
    type: L.npcArchetype(arch).main === 'ap' ? 'magique' : 'physique' };
}
const mit = (raw, type, tgt) => raw * 100 / (100 + (type === 'magique' ? tgt.resmag : tgt.armure));

function pour(pool, type, targets) {           // verse `pool` de dégâts bruts, le surplus passe au suivant
  for (const t of targets) {
    if (pool <= 0) break;
    if (t.hp <= 0) continue;
    const need = t.hp / (100 / (100 + (type === 'magique' ? t.resmag : t.armure)));
    const used = Math.min(pool, need);
    t.hp -= mit(used, type, t); if (t.hp < 1e-6) t.hp = 0;
    pool -= used;
  }
}
function fight(level, monsters, mode) {
  const P = party(level), M = monsters.map(m => ({ ...m }));
  const hp0 = P.reduce((a, c) => a + c.hpMax, 0);
  for (let t = 1; t <= 200; t++) {
    for (const p of P) if (p.hp > 0)
      pour(p.dmg, p.type, M.filter(m => m.hp > 0).sort((a, b) => a.hp - b.hp));
    if (!M.some(m => m.hp > 0)) return res(t, 'PJ', P, hp0);
    for (const m of M) if (m.hp > 0) {
      const alive = P.filter(p => p.hp > 0);
      if (mode === 'spread') alive.forEach(p => pour(m.dmg / alive.length, m.type, [p]));
      else pour(m.dmg, m.type, alive.sort((a, b) => a.hp - b.hp));
    }
    if (!P.some(p => p.hp > 0)) return res(t, 'monstres', P, hp0);
  }
  return { rounds: '>200' };
}
const res = (t, w, P, hp0) => ({ rounds: t, winner: w, left: P.filter(p => p.hp > 0).length,
  hpPct: Math.round(100 * P.reduce((a, c) => a + c.hp, 0) / hp0) });

const rep = (n, f) => Array.from({ length: n }, f);
const SCENARIOS = [
  ['FAIBLE 100 % : 1 standard',              (l) => [monster(l, 'standard', 'bruiser')]],
  ['FAIBLE 100 % : 2 sbires',                (l) => rep(2, () => monster(l, 'sbire', 'bruiser'))],
  ['MOYENNE 250 % : 1 élite + 1 sbire',      (l) => [monster(l, 'elite', 'bruiser'), monster(l, 'sbire', 'bruiser')]],
  ['MOYENNE 250 % : 2 standards + 1 sbire',  (l) => [...rep(2, () => monster(l, 'standard', 'bruiser')), monster(l, 'sbire', 'bruiser')]],
  ['DURE 500 % : 5 standards (miroir)',      (l) => rep(5, () => monster(l, 'standard', 'bruiser'))],
  ['DURE 500 % : 1 boss',                    (l) => [monster(l, 'boss', 'bruiser')]],
  ['DURE 500 % : 1 élite + 6 sbires',        (l) => [monster(l, 'elite', 'bruiser'), ...rep(6, () => monster(l, 'sbire', 'bruiser'))]],
  ['DURE 500 % : 2 élites + 1 standard',     (l) => [...rep(2, () => monster(l, 'elite', 'bruiser')), monster(l, 'standard', 'bruiser')]],
  ['DURE 500 % : 10 sbires',                 (l) => rep(10, () => monster(l, 'sbire', 'bruiser'))],
  ['EXTRÊME 1000 % : 1 boss + 5 standards',  (l) => [monster(l, 'boss', 'bruiser'), ...rep(5, () => monster(l, 'standard', 'bruiser'))]],
];
const fmt = r => typeof r.rounds !== 'number' ? '>200' :
  `${String(r.rounds).padStart(2)} r. ${r.winner === 'PJ' ? `PJ (${r.left}/5, ${r.hpPct} % PV)` : 'DÉFAITE'}`;

if (require.main === module) {
  for (const level of [2, 10, 18]) {
    const ref = L.refPlayer(level);
    console.log(`\n===== NIVEAU ${level} — référentiel : ${Math.round(ref.hp)} PV, ${Math.round(ref.roundDmg)} dégâts/round affichés =====`);
    console.log('scénario'.padEnd(42), '| monstres concentrés'.padEnd(30), '| monstres répartis');
    for (const [name, mk] of SCENARIOS)
      console.log(name.padEnd(42), '|', fmt(fight(level, mk(level), 'focus')).padEnd(28), '|', fmt(fight(level, mk(level), 'spread')));
    console.log('\n-- Curseur endurance / violence, à puissance constante (k = PV ×k, dégâts ÷k) --');
    for (const [rank, others] of [['standard', 4], ['elite', 1], ['boss', 0]]) {
      const line = [1, 1.5, 2, 3, 4, 6].map(k => {
        const ms = rep(rank === 'standard' ? 5 : rank === 'elite' ? 2 : 1, () => monster(level, rank, 'bruiser', 0, k));
        if (rank === 'elite') ms.push(monster(level, 'standard', 'bruiser', 0, k));
        const r = fight(level, ms, 'spread');
        return `k=${k}: ${r.rounds} r.${r.winner === 'PJ' ? ` (${r.hpPct} %)` : ' DÉF.'}`;
      }).join(' | ');
      console.log(`${rank.padEnd(9)} ${line}`);
    }
  }
}
module.exports = { fight, monster, party };
