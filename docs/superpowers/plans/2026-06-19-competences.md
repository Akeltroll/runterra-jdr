# Compétences (actif/passif) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Note d'exécution (ce repo) :** les subagents implémenteurs ne peuvent PAS lancer tests/git ici → exécution **inline**. UI en JSX zéro-build = pas de tests unitaires (vérif syntaxe `npx esbuild` + vérif visuelle) ; seule la logique pure de `game-logic.js` est testée par `node --test`.

**Goal:** Donner aux joueurs Urskaar / Smith / Jett / Elias un onglet « Compétences » qui calcule les dégâts au clic, suit charges & cooldowns (tour partagé), et branche le passif d'Elias sur ses stats — Rathael resté en pause.

**Architecture:** Formules de dégâts = fonctions pures nommées dans `game-logic.js` (testées Node), référencées par une table `SKILLS` (`data.jsx`). État live par perso sous `/characters/{id}/state` (`counters`, `cooldowns`) + un compteur de tour **partagé** `campaign/runeterra/combat/turn`. Cooldown stocké comme **n° de tour de disponibilité** (`readyAt`) → « Fin de tour » n'incrémente qu'une valeur. Le passif calculable (Elias, +AD/charge, plat) est sommé par `sumPassiveMods` et mergé dans le 4e param de `computeEffective` aux 3 sites existants (aucun changement de signature). UI = nouvelle page `pages-competences.jsx` + ligne charges/CD sur les cartes de la Vue MJ.

**Tech Stack:** React 18 + Babel standalone (CDN, zéro build), Firebase RTDB compat, `node --test` pour la logique pure.

## Global Constraints

- **Zéro build** : chaque `.jsx`/`.js` définit ses symboles puis `Object.assign(window, {...})` ; accès par référence nue. Ordre de chargement dans `index.html` : `game-logic.js` → `data.jsx` → `data-state.jsx` → `components.jsx` → `pages-*.jsx`.
- **`game-logic.js` = UMD pur** (testable Node + `window`), **aucune** dépendance React/Firebase.
- **Le script `.gs` prime** sur le texte des kits (source : `info-mj/Codes App Script.md`).
- **Rathael = HORS périmètre** (carte « à venir » seulement, pas de comps).
- **Nouveau combat** : remet à zéro **toutes** les charges + cooldowns + tour (décision MJ).
- Niveau des persos = **2** (`char.level` / `LEVELS`) ; le passif AD d'Elias en dépend.
- Toute valeur de dégât affichée est un **entier** (`Math.floor`, comme le script).
- Commits fréquents, messages en français, finir par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Table de référence des formules (source `Codes App Script.md`)

`eff` = stats effectives (`eff.ad`, `eff.ap`, `eff.armure`, `eff.resmag`…). `wType` = type d'arme équipée (`'Physique'|'Magique'|'Hybride'`).

- **Base d'arme** : `skillBaseDamage(wType, eff)` = Physique→`⌊eff.ad⌋`, Magique→`⌊eff.ap⌋`, Hybride→`⌊(eff.ad+eff.ap)/2⌋`.
- **Elias** : passif AD/charge = `(10 + 5·(level−1))` (=15 au niv 2), max charges `5 + ⌊(level−1)/3⌋` (=5 au niv 2). C1 = `skillBaseDamage` ×1,25 si 1er coup, soin `⌊dmg·0,05⌋`, pas de crit. C2 = `⌊50 + eff.ad⌋` (si fin de dash au CàC, sinon 0). C3 = `⌊100 + 1,5·eff.ad⌋`. C4 = `⌊50 + 2·eff.ad⌋` /cible, soin `⌊total·0,05⌋`, pas de crit.
- **Smith** : passif = `⌊50 + 0,5·eff.ap⌋` (magique). C1 = `skillBaseDamage` ; ×1,5 si furtif ; crit ×(critDmg% [+30 si furtif]). C2 = utilitaire (0 dmg). C3 = `⌊50 + eff.ad⌋`, saignement `5 + ⌊eff.ad/100⌋·5` %. C4 = utilitaire ; soin `⌊pct·HPmax_cible⌋` (pct 0,10 / 0,50 ultime).
- **Urskaar** : `bearBonusPct(moved)` = `moved<5 ? 0 : 150 + 25·⌊(moved−5)/3⌋`. `bearTranches(moved)` = `moved<5 ? 0 : 1 + ⌊(moved−5)/3⌋`. C1 (Pugilat) base `⌊eff.ad⌋` ; gauche = base ; droite = `⌊base · max(150, bearBonusPct)/100⌋`. C2 (Écrasement) = `⌊eff.ad · (1,5 + 0,25·tranches)⌋`, portée `3+tranches`. C3 (kit, script muet) = bouclier `⌊(0,30 + 0,10·(eff.ap/50))·HPmax⌋`, 0 dmg. C4 (kit) = `⌊eff.ad · (1 + 0,25·tranches)⌋` /unité, transfo narrative.
- **Jett** : `jettEngins(eff, isCrit)` = `(1 + (ad≥50) + (ad≥125) + (ad≥225) + (ad≥375))` ×(isCrit?2:1). C1 Remodulation (50 mana) : Poison `⌊25 + 0,5·eff.ap⌋`, Repoussement/Attraction `⌊25 + 0,5·eff.ad⌋` (autres configs = rappel). C2 (kit) : dégâts `⌊50 + 0,5·eff.ad⌋`, soin allié `⌊50 + 1,0·eff.ap⌋`.

---

## File Structure

- **Modify** `game-logic.js` — ajoute les fonctions pures : `skillBaseDamage`, `cooldownReady`, `nextReadyAt`, formules par perso (`dmg*`/`bear*`/`jett*`), `eliasPassiveAD`, `eliasMaxStacks`, `sumPassiveMods`. (Exposées via le `Object.assign(window, …)` existant.)
- **Modify** `data.jsx` — ajoute `SKILLS` (table métadonnées par perso, référence les `dmg*`).
- **Modify** `data-state.jsx` — ajoute setters `setCounter`/`setCooldown` à `useCharState`, hook `useSharedTurn`, helper `resetCombat`. Constante `COMBAT_TURN`.
- **Modify** `pages-sheet.jsx:301`, `pages-mj.jsx:47`, `pages-equip.jsx:156` — merge `sumPassiveMods(...)` dans le 4e param de `computeEffective`.
- **Create** `pages-competences.jsx` — page `CompetencesPage` (cartes passif/actives, cast, steppers, cooldowns, sélecteur perso staff).
- **Modify** `pages-mj.jsx` — migre `useMJTurn` (local) → `useSharedTurn` ; ajoute ligne charges/CD par carte joueur + bouton « Nouveau combat ».
- **Modify** `index.html` — script `pages-competences.jsx` + entrée `PAGES` (`competences`).
- **Modify** `database.rules.json` — nœud `combat/turn` (lecture inscrits, écriture staff).
- **Modify** `test/game-logic.test.js` — tests des nouvelles fonctions pures.
- **Modify** `CLAUDE.md` — doc de la feature (dernier commit).

---

## PART 1 — Moteur de calcul (`game-logic.js`, TDD)

### Task 1 : Base d'arme + helpers de cooldown

**Files:** Modify `game-logic.js` ; Test `test/game-logic.test.js`
**Interfaces — Produces:**
- `skillBaseDamage(wType, eff) -> number`
- `cooldownReady(readyAt, currentTurn) -> boolean` (prêt si `readyAt` absent/≤ tour courant)
- `nextReadyAt(currentTurn, cd) -> number` (= `currentTurn + cd` ; `cd` en tours, `1×/combat` géré ailleurs)

- [ ] **Step 1 : Test qui échoue** — ajouter dans `test/game-logic.test.js` :

```js
const { skillBaseDamage, cooldownReady, nextReadyAt } = require('../game-logic.js');

test('skillBaseDamage selon le type d\'arme', () => {
  const eff = { ad: 80, ap: 40 };
  assert.equal(skillBaseDamage('Physique', eff), 80);
  assert.equal(skillBaseDamage('Magique', eff), 40);
  assert.equal(skillBaseDamage('Hybride', eff), 60);
});

test('cooldownReady : prêt si pas de readyAt ou tour atteint', () => {
  assert.equal(cooldownReady(undefined, 3), true);
  assert.equal(cooldownReady(5, 5), true);
  assert.equal(cooldownReady(5, 4), false);
});

test('nextReadyAt = tour + cd', () => {
  assert.equal(nextReadyAt(3, 3), 6);
  assert.equal(nextReadyAt(7, 1), 8);
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec** — `node --test test/game-logic.test.js` → FAIL (`skillBaseDamage is not a function`).

- [ ] **Step 3 : Implémenter** dans `game-logic.js` (avant le `Object.assign(window, …)` final) :

```js
function skillBaseDamage(wType, eff) {
  const ad = Math.floor(eff && eff.ad || 0);
  const ap = Math.floor(eff && eff.ap || 0);
  if (wType === 'Magique') return ap;
  if (wType === 'Hybride') return Math.floor((ad + ap) / 2);
  return ad; // Physique par défaut
}
function cooldownReady(readyAt, currentTurn) {
  if (readyAt == null) return true;
  return currentTurn >= readyAt;
}
function nextReadyAt(currentTurn, cd) {
  return currentTurn + (cd | 0);
}
```

Puis ajouter `skillBaseDamage, cooldownReady, nextReadyAt` à l'objet exporté (`Object.assign(window, {...})` ET l'export Node `module.exports` existant).

- [ ] **Step 4 : Lancer, vérifier le succès** — `node --test test/game-logic.test.js` → PASS.

- [ ] **Step 5 : Commit** — `git add game-logic.js test/game-logic.test.js && git commit -m "feat(comp): helpers base d'arme + cooldown (readyAt)"`

### Task 2 : Formules d'Elias + passif AD

**Interfaces — Produces:** `eliasPassiveAD(level) -> number`, `eliasMaxStacks(level) -> number`, `dmgEliasC1(wType, eff, firstHit) -> number`, `dmgEliasC2(eff) -> number`, `dmgEliasC3(eff) -> number`, `dmgEliasC4(eff, nbTargets) -> number`, `skillHeal(total, pct) -> number`

- [ ] **Step 1 : Test qui échoue** :

```js
const { eliasPassiveAD, eliasMaxStacks, dmgEliasC1, dmgEliasC2, dmgEliasC3, dmgEliasC4, skillHeal } = require('../game-logic.js');

test('Elias passif AD/charge et max charges (niv 2)', () => {
  assert.equal(eliasPassiveAD(2), 15);
  assert.equal(eliasMaxStacks(2), 5);
  assert.equal(eliasPassiveAD(4), 25);
  assert.equal(eliasMaxStacks(4), 6);
});

test('Elias compétences (script Fab.gs)', () => {
  const eff = { ad: 100, ap: 0 };
  assert.equal(dmgEliasC1('Physique', eff, false), 100);
  assert.equal(dmgEliasC1('Physique', eff, true), 125);   // ×1,25 premier coup
  assert.equal(dmgEliasC2(eff), 150);                      // 50 + ad
  assert.equal(dmgEliasC3(eff), 250);                      // 100 + 1,5·ad
  assert.equal(dmgEliasC4(eff, 1), 250);                   // 50 + 2·ad
  assert.equal(skillHeal(250, 0.05), 12);                  // ⌊250·0,05⌋
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec** — FAIL.

- [ ] **Step 3 : Implémenter** :

```js
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
```

(`dmgEliasC4` rend les dégâts **individuels** ; le total = `dmg × nbTargets`, calculé côté UI. `nbTargets` est gardé en signature pour cohérence d'appel.)

- [ ] **Step 4 : Succès** — PASS.
- [ ] **Step 5 : Commit** — `git commit -am "feat(comp): formules Elias + passif AD (Fab.gs)"`

### Task 3 : Formules de Smith

**Interfaces — Produces:** `dmgSmithPassif(eff) -> number`, `dmgSmithC1(wType, eff, furtif) -> number`, `dmgSmithC3(eff) -> number`, `smithBleedPct(eff) -> number`

- [ ] **Step 1 : Test qui échoue** :

```js
const { dmgSmithPassif, dmgSmithC1, dmgSmithC3, smithBleedPct } = require('../game-logic.js');

test('Smith formules (Erwan.gs)', () => {
  assert.equal(dmgSmithPassif({ ap: 100 }), 100);          // 50 + 0,5·ap
  assert.equal(dmgSmithC1('Physique', { ad: 80, ap: 0 }, false), 80);
  assert.equal(dmgSmithC1('Physique', { ad: 80, ap: 0 }, true), 120); // ×1,5 furtif
  assert.equal(dmgSmithC3({ ad: 150 }), 200);              // 50 + ad
  assert.equal(smithBleedPct({ ad: 250 }), 15);            // 5 + ⌊250/100⌋·5
});
```

- [ ] **Step 2 : Échec** — FAIL.
- [ ] **Step 3 : Implémenter** :

```js
function dmgSmithPassif(eff) { return Math.floor(50 + 0.5 * (eff.ap || 0)); }
function dmgSmithC1(wType, eff, furtif) {
  let d = skillBaseDamage(wType, eff);
  if (furtif) d = Math.floor(d * 1.5);
  return d;
}
function dmgSmithC3(eff) { return Math.floor(50 + (eff.ad || 0)); }
function smithBleedPct(eff) { return 5 + Math.floor((eff.ad || 0) / 100) * 5; }
```

- [ ] **Step 4 : Succès** — PASS.
- [ ] **Step 5 : Commit** — `git commit -am "feat(comp): formules Smith (Erwan.gs)"`

### Task 4 : Formules d'Urskaar (Voie de l'ours)

**Interfaces — Produces:** `bearBonusPct(moved) -> number`, `bearTranches(moved) -> number`, `dmgUrskaarC1(eff, side, moved) -> number`, `dmgUrskaarC2(eff, moved) -> number`, `urskaarC3Shield(eff, hpMax) -> number`, `dmgUrskaarC4(eff, moved) -> number`

- [ ] **Step 1 : Test qui échoue** :

```js
const { bearBonusPct, bearTranches, dmgUrskaarC1, dmgUrskaarC2, urskaarC3Shield, dmgUrskaarC4 } = require('../game-logic.js');

test('Urskaar Voie de l\'ours (Baptiste.gs)', () => {
  assert.equal(bearBonusPct(4), 0);
  assert.equal(bearBonusPct(5), 150);
  assert.equal(bearBonusPct(8), 175);
  assert.equal(bearTranches(5), 1);
  assert.equal(bearTranches(8), 2);
  const eff = { ad: 100, ap: 50 };
  assert.equal(dmgUrskaarC1(eff, 'gauche', 0), 100);       // base AD
  assert.equal(dmgUrskaarC1(eff, 'droite', 0), 150);       // min 150%
  assert.equal(dmgUrskaarC1(eff, 'droite', 8), 175);       // 175%
  assert.equal(dmgUrskaarC2(eff, 5), 175);                 // ad·(1,5+0,25·1)
  assert.equal(urskaarC3Shield({ ap: 50 }, 1000), 400);    // (0,30+0,10)·1000
  assert.equal(dmgUrskaarC4(eff, 5), 125);                 // ad·(1+0,25·1)
});
```

- [ ] **Step 2 : Échec** — FAIL.
- [ ] **Step 3 : Implémenter** :

```js
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
```

- [ ] **Step 4 : Succès** — PASS.
- [ ] **Step 5 : Commit** — `git commit -am "feat(comp): formules Urskaar (Baptiste.gs + kit C3/C4)"`

### Task 5 : Formules de Jett (Nano-hextech)

**Interfaces — Produces:** `jettEngins(eff, isCrit) -> number`, `dmgJettPoison(eff) -> number`, `dmgJettForce(eff) -> number`, `dmgJettC2(eff) -> number`, `healJettC2(eff) -> number`

- [ ] **Step 1 : Test qui échoue** :

```js
const { jettEngins, dmgJettPoison, dmgJettForce, dmgJettC2, healJettC2 } = require('../game-logic.js');

test('Jett Nano-hextech (Steph.gs)', () => {
  assert.equal(jettEngins({ ad: 0 }, false), 1);
  assert.equal(jettEngins({ ad: 150 }, false), 3);   // 1 + (≥50) + (≥125)
  assert.equal(jettEngins({ ad: 150 }, true), 6);    // ×2 crit
  assert.equal(dmgJettPoison({ ap: 100 }), 75);      // 25 + 0,5·ap
  assert.equal(dmgJettForce({ ad: 100 }), 75);       // 25 + 0,5·ad
  assert.equal(dmgJettC2({ ad: 100 }), 75);          // 50 + 0,5·ad
  assert.equal(healJettC2({ ap: 100 }), 150);        // 50 + 1,0·ap
});
```

- [ ] **Step 2 : Échec** — FAIL.
- [ ] **Step 3 : Implémenter** :

```js
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
```

- [ ] **Step 4 : Succès** — PASS.
- [ ] **Step 5 : Commit** — `git commit -am "feat(comp): formules Jett (Steph.gs)"`

### Task 6 : `sumPassiveMods` (passif calculable → stats)

**Interfaces — Produces:** `sumPassiveMods(charId, counters, level) -> { [stat]: number }` (objet plat, vide si pas de passif calculable). Pour `lunick` (Elias) : `{ ad: chasseurStacks × eliasPassiveAD(level) }`.

- [ ] **Step 1 : Test qui échoue** :

```js
const { sumPassiveMods } = require('../game-logic.js');

test('sumPassiveMods : Elias = +AD par charge de chasseur (niv 2)', () => {
  assert.deepEqual(sumPassiveMods('lunick', { chasseur: 3 }, 2), { ad: 45 });
  assert.deepEqual(sumPassiveMods('lunick', {}, 2), {});           // 0 charge -> rien
  assert.deepEqual(sumPassiveMods('smith', { marques: 2 }, 2), {}); // pas de passif net
  assert.deepEqual(sumPassiveMods('rathael', { glaciation: 3 }, 2), {}); // en pause
});
```

- [ ] **Step 2 : Échec** — FAIL.
- [ ] **Step 3 : Implémenter** :

```js
function sumPassiveMods(charId, counters, level) {
  counters = counters || {};
  if (charId === 'lunick') { // Elias — Instinct du Chasseur (plat, +AD/charge)
    const stacks = Math.max(0, counters.chasseur | 0);
    if (!stacks) return {};
    return { ad: stacks * eliasPassiveAD(level) };
  }
  return {}; // Rathael (pct) en pause ; Jett/Smith/Urskaar = pas de bonus net auto
}
```

- [ ] **Step 4 : Succès** — `node --test test/game-logic.test.js` → tout PASS.
- [ ] **Step 5 : Commit** — `git commit -am "feat(comp): sumPassiveMods (passif Elias plat)"`

---

## PART 2 — Données & état

### Task 7 : Table `SKILLS` (`data.jsx`)

**Files:** Modify `data.jsx` (avant le `Object.assign(window, {...})`).
**Interfaces — Produces:** `SKILLS` = `{ [charId]: { passive, actives:[...] } }`.
- `passive` = `{ name, counter:{ key, label, max }, note, statHint? }` (`counter` omis si aucun ; `max` peut être une fn `(level)=>n`).
- `active` = `{ id, name, mana, cd, kind:'turn'|'cd'|'combat', dmg, note }`. `dmg(eff, ctx)` rend un nombre ou `null` (utilitaire). `ctx` = `{ counters, level, wType, hpMax, firstHit, furtif, side, moved, nbTargets }`. `kind` : `'turn'`=1×/tour (cd 1), `'cd'`=CD en tours (`cd`), `'combat'`=1×/combat.

- [ ] **Step 1 : Écrire `SKILLS`** (référence les `dmg*` de Task 2-5 ; Rathael = placeholder « à venir ») :

```jsx
const SKILLS = {
  lunick: { // Elias Crowe
    passive: { name: 'Instinct du Chasseur', counter: { key: 'chasseur', label: 'Charges', max: (lvl) => eliasMaxStacks(lvl) },
      note: '+ AD par charge (calculé sur tes stats). 1 charge par nouvelle cible blessée, reset entre combats.', statHint: 'ad' },
    actives: [
      { id: 'tir_cible', name: 'Tir Ciblé', mana: 10, cd: 1, kind: 'turn',
        dmg: (eff, c) => dmgEliasC1(c.wType, eff, c.firstHit), note: 'Arme à distance. 1er coup : +25% & +2 au jet. Soin 5% des dégâts. Pas de crit.' },
      { id: 'dash_tactique', name: 'Dash Tactique', mana: 30, cd: 3, kind: 'cd',
        dmg: (eff) => dmgEliasC2(eff), note: 'Rayon 6. Si fin au CàC : 50 + 100% AD et −1 CD. Sinon repositionnement (0 dégât).' },
      { id: 'frappe_duale', name: 'Frappe Duale', mana: 30, cd: 3, kind: 'cd',
        dmg: (eff) => dmgEliasC3(eff), note: 'À distance : repousse 4 cases. Mêlée : marque (+25% dégâts subis).' },
      { id: 'salve_corsaire', name: 'Salve du Corsaire', mana: 60, cd: 0, kind: 'combat',
        dmg: (eff) => dmgEliasC4(eff), note: 'Arme à distance. Dégâts par cible ; soin 5% du total. Pas de crit. 1×/combat.' },
    ],
  },
  smith: {
    passive: { name: 'Flétrissement de la rose', counter: { key: 'marques', label: 'Marques', max: 9 },
      note: 'Focalise l\'arcane : 50 + 0,5 AP magiques + marque (1×/combat). Propagation à la mort.' },
    actives: [
      { id: 'attaque_sournoise', name: 'Attaque sournoise', mana: 30, cd: 1, kind: 'turn',
        dmg: (eff, c) => dmgSmithC1(c.wType, eff, c.furtif), note: 'Dégâts d\'arme. Si camouflé/invisible : ×1,5 (+30% crit). Peut critiquer.' },
      { id: 'fondu_au_noir', name: 'Fondu au noir', mana: 40, cd: 3, kind: 'cd',
        dmg: () => null, note: 'Camouflage 3 tours, +3 mobilité 2 tours. Peut se troquer en fumigène 5×5.' },
      { id: 'chaines', name: 'Chaînes estropiantes', mana: 60, cd: 4, kind: 'cd',
        dmg: (eff) => dmgSmithC3(eff), note: 'Cône 8 cases. Exécute < 10% HP. Cible : 50 + 100% AD + saignement. Peut critiquer.' },
      { id: 'voile', name: 'Voile dimensionnel', mana: 80, cd: 0, kind: 'combat',
        dmg: () => null, note: 'Dimension A×B. Immunité 50%. Si cible supprimée : soin 10% (50% ult) PV/mana cible + bonus crit.' },
    ],
  },
  urskaar: {
    passive: { name: 'Voie de l\'ours', counter: { key: 'tranches', label: 'PM bonus', max: 3 },
      note: '+2 init. Après 5 cases : prochaine AA +150% (+25%/3 cases) et +1 PM (max 3). Les tranches boostent C2/C4.' },
    actives: [
      { id: 'pugilat', name: 'Maîtrise du pugilat', mana: 30, cd: 1, kind: 'turn',
        dmg: (eff, c) => dmgUrskaarC1(eff, c.side, c.moved), note: 'Gauche : AA classique, pas d\'attaque d\'opportunité. Droite : AA améliorée (min 150%), 50% étourdir.' },
      { id: 'ecrasement', name: 'Écrasement', mana: 50, cd: 3, kind: 'cd',
        dmg: (eff, c) => dmgUrskaarC2(eff, c.moved), note: 'Bond. Dégâts AD·(1,5 + 0,25·tranches), portée 3+tranches, zone adjacente. Pas d\'attaque d\'opportunité.' },
      { id: 'ralliement', name: 'Ralliement', mana: 100, cd: 5, kind: 'cd',
        dmg: () => null, shield: (eff, c) => urskaarC3Shield(eff, c.hpMax), note: 'Bouclier (30% +10%/50 AP des PV) + Peau de Fer ; alliés : Bravoure 2 tours. +1 charisme (permanent).' },
      { id: 'demi_ours', name: 'On ne m\'arrêtera pas', mana: 100, cd: 0, kind: 'combat',
        dmg: (eff, c) => dmgUrskaarC4(eff, c.moved), note: 'Transfo 5 tours : +30% PV/AD/Armure. Déplacement : 100% AD (+25%/tranche) par unité. 1×/combat.' },
    ],
  },
  jett: {
    passive: { name: 'Nano-hextech', counter: { key: 'cn', label: 'Cellules (CN)', max: 99 },
      note: 'AA ne fait plus de dégâts : crée des CN (1 + paliers AD, ×2 crit). Récup CN = +10 mana/CN.' },
    actives: [
      { id: 'remodulation', name: 'Remodulation expérimentale', mana: 50, cd: 1, kind: 'turn',
        dmg: (eff) => dmgJettForce(eff), note: 'Config aléatoire (15 mana × CN au Sheet ; ici coût fixe 50). Poison 25+0,5 AP ; Repouss./Attract. 25+0,5 AD ; autres : effets.' },
      { id: 'alignement', name: 'Alignement de séquence', mana: 40, cd: 3, kind: 'cd',
        dmg: (eff) => dmgJettC2(eff), heal: (eff) => healJettC2(eff), note: 'Stun 2 tours + 50 + 50% AD aux ennemis. Soigne les alliés de 50 + 100% AP.' },
    ],
  },
  rathael: { pending: true, passive: { name: 'Chair gelée, âme fendue' },
    actives: [], note: 'En cours de refonte par le MJ (trop de compteurs). Comps à venir.' },
};
```

- [ ] **Step 2 : Exposer** — ajouter `SKILLS` au `Object.assign(window, {...})` de `data.jsx`.
- [ ] **Step 3 : Vérif syntaxe** — `npx esbuild data.jsx >/dev/null && echo OK` → `OK`.
- [ ] **Step 4 : Commit** — `git commit -am "feat(comp): table SKILLS (Elias/Smith/Urskaar/Jett ; Rathael pending)"`

### Task 8 : Brancher `sumPassiveMods` sur les stats effectives

**Files:** Modify `pages-sheet.jsx:301`, `pages-mj.jsx:43-47`, `pages-equip.jsx:155-156`.
**Interfaces — Consumes:** `sumPassiveMods` (Task 6), `mergeMods` (existant).

- [ ] **Step 1 : `pages-sheet.jsx`** — autour de la ligne 297-301, après `itemMods` :

```jsx
const itemMods = sumItemMods(state.equipment, state.inventory);
const passiveMods = sumPassiveMods(char.id, state.counters || {}, char.level || 1);
const eff = computeEffective(char.stats, state.modifiers, activeBuffs,
  mergeMods(mergeMods(itemMods, runeMods), passiveMods));
```

- [ ] **Step 2 : `pages-mj.jsx`** — dans `mjLive`, après `itemMods` (ligne 43) :

```jsx
const itemMods = st ? sumItemMods(st.equipment, st.inventory) : {};
const passiveMods = st ? sumPassiveMods(c.id, st.counters || {}, c.level || 1) : {};
const eff = computeEffective(c.stats, st ? st.modifiers : c.modifiers, buffs,
  mergeMods(mergeMods(itemMods, runeMods), passiveMods));
```

- [ ] **Step 3 : `pages-equip.jsx`** — ligne 155-156 :

```jsx
const passiveMods = sumPassiveMods(char.id, state.counters || {}, char.level || 1);
const bonuses = mergeMods(mergeMods(sumItemMods(equipment, itemsById), runeMods), passiveMods);
const eff = computeEffective(char.stats, state.modifiers, activeBuffs, bonuses);
```

- [ ] **Step 4 : Vérif syntaxe** — `for f in pages-sheet pages-mj pages-equip; do npx esbuild $f.jsx >/dev/null; done && echo OK`.
- [ ] **Step 5 : Commit** — `git commit -am "feat(comp): passif calculable branché sur computeEffective (Elias AD)"`

### Task 9 : Setters d'état + tour partagé (`data-state.jsx`)

**Files:** Modify `data-state.jsx`.
**Interfaces — Produces:** `useCharState` rend en plus `setCounter(key, value)`, `setCooldown(skillId, readyAt)` ; `useSharedTurn() -> { turn, nextTurn, prevTurn, resetCombat }` ; constante `COMBAT_TURN`.

- [ ] **Step 1 : Constante + setters** — après la définition de `setCoin` dans `useCharState` :

```jsx
const setCounter  = useCallback((key, value) =>
  window.RTDB.updatePath(`${charPath(charId)}/counters`, { [key]: Math.max(0, value | 0) || null }), [charId]);
const setCooldown = useCallback((skillId, readyAt) =>
  window.RTDB.updatePath(`${charPath(charId)}/cooldowns`, { [skillId]: readyAt || null }), [charId]);
```

Ajouter `setCounter, setCooldown` à l'objet retourné par `useCharState`.

- [ ] **Step 2 : Constante `COMBAT_TURN`** — près de `CAMPAIGN` :

```jsx
const COMBAT_TURN = `${CAMPAIGN}/combat/turn`;
```

- [ ] **Step 3 : Hook `useSharedTurn`** — nouveau hook (reset combat = MJ écrit tour + purge counters/cooldowns de tous les persos) :

```jsx
function useSharedTurn() {
  const [turn, setTurn] = useState(1);
  useEffect(() => window.RTDB.subscribePath(COMBAT_TURN, (v) => setTurn(Number.isFinite(v) && v >= 1 ? v : 1)), []);
  const persist = useCallback((n) => window.RTDB.setPath(COMBAT_TURN, Math.max(1, n | 0)), []);
  const resetCombat = useCallback(() => {
    window.RTDB.setPath(COMBAT_TURN, 1);
    Object.keys(CHARACTERS).forEach((id) => {
      window.RTDB.setPath(`${CAMPAIGN}/characters/${id}/state/counters`, null);
      window.RTDB.setPath(`${CAMPAIGN}/characters/${id}/state/cooldowns`, null);
    });
  }, []);
  return { turn, nextTurn: () => persist(turn + 1), prevTurn: () => persist(turn - 1), resetCombat };
}
```

- [ ] **Step 4 : Exposer** — ajouter `useSharedTurn`, `COMBAT_TURN`, `setCounter`/`setCooldown` (via le retour de `useCharState`) au `Object.assign(window, {...})` de `data-state.jsx`.
- [ ] **Step 5 : Vérif syntaxe** — `npx esbuild data-state.jsx >/dev/null && echo OK`.
- [ ] **Step 6 : Commit** — `git commit -am "feat(comp): setters counters/cooldowns + tour partagé (useSharedTurn)"`

### Task 10 : Règle RTDB du tour partagé

**Files:** Modify `database.rules.json`.
**Interfaces — Consumes:** chemin `campaign/runeterra/combat/turn`.

- [ ] **Step 1 : Ajouter la règle** — sous `campaign/runeterra`, à côté de `sharedCoins`, un nœud `combat` :

```json
"combat": {
  ".read": "auth != null && root.child('users').child(auth.uid).exists()",
  "turn": {
    ".write": "root.child('users').child(auth.uid).child('role').val() == 'mj' || root.child('users').child(auth.uid).child('role').val() == 'admin'",
    ".validate": "newData.isNumber() && newData.val() >= 1"
  }
}
```

(Suivre la forme exacte des règles voisines `sharedInventory`/`sharedCoins` du fichier ; écriture staff seulement, lecture tout inscrit.)

- [ ] **Step 2 : Vérif JSON** — `node -e "JSON.parse(require('fs').readFileSync('database.rules.json','utf8')); console.log('JSON OK')"`.
- [ ] **Step 3 : Commit** — `git commit -am "feat(comp): règle RTDB combat/turn (lecture inscrits, écriture staff)"`
- [ ] **Step 4 : ⚠️ Note de déploiement** — à republier en console Firebase (comme `sharedCoins`), sinon le tour partagé est bloqué en écriture. Ne PAS oublier au merge.

---

## PART 3 — Interface

### Task 11 : Page `Compétences` (`pages-competences.jsx`)

**Files:** Create `pages-competences.jsx`.
**Interfaces — Consumes:** `SKILLS`, `useCharState` (+`setCounter`/`setCooldown`/`setField`), `useSharedTurn`, `CHARACTERS`, `computeEffective`+`mergeMods`+`sumItemMods`+`sumPassiveMods`, `WEAPONS`, `cooldownReady`/`nextReadyAt`, `applyHealMods`. **Produces:** `CompetencesPage({ lockedCharId })`.

- [ ] **Step 1 : Écrire la page** — structure (suivre le style des autres pages, sélecteur perso staff comme `RuneTreePage`) :

```jsx
function CompetencesPage({ lockedCharId }) {
  const ids = Object.keys(CHARACTERS);
  const [sel, setSel] = useState(lockedCharId || ids[0]);
  const charId = lockedCharId || sel;
  const char = CHARACTERS[charId];
  const { state, setField, setCounter, setCooldown } = useCharState(charId);
  const { turn } = useSharedTurn();
  if (!state) return <div className="card">Chargement…</div>;

  const kit = SKILLS[charId];
  const counters = state.counters || {};
  const cooldowns = state.cooldowns || {};
  const wType = weaponTypeOf(state, char); // util locale : type de l'arme équipée via WEAPONS
  const itemMods = sumItemMods(state.equipment, state.inventory);
  const runeMods = runeModsOf(state, char);  // miroir des autres pages (sumRuneMods+mergeMods)
  const passiveMods = sumPassiveMods(charId, counters, char.level || 1);
  const eff = computeEffective(char.stats, state.modifiers, [], mergeMods(mergeMods(itemMods, runeMods), passiveMods));

  function cast(sk) {
    const cost = sk.mana || 0;
    const manaCur = state.manaCur || 0;
    if (manaCur < cost) { window.toast && window.toast(`Pas assez de mana (${manaCur}/${cost})`); return; }
    setField('manaCur', manaCur - cost);
    if (sk.kind === 'combat') setCooldown(sk.id, 999999);        // bloqué jusqu'à Nouveau combat
    else setCooldown(sk.id, nextReadyAt(turn, sk.kind === 'turn' ? 1 : sk.cd));
  }

  if (kit && kit.pending) return (/* carte « Rathael — refonte en cours » */);

  return (
    <div>
      {!lockedCharId && <CharPicker ids={ids} sel={sel} onSel={setSel} />}
      <PassiveCard kit={kit} eff={eff} counters={counters} setCounter={setCounter} level={char.level || 1} />
      {kit.actives.map((sk) => (
        <ActiveCard key={sk.id} sk={sk} eff={eff} ctx={{ counters, level: char.level || 1, wType, hpMax: char.stats.hp }}
          ready={cooldownReady(cooldowns[sk.id], turn)} readyAt={cooldowns[sk.id]} turn={turn} onCast={() => cast(sk)} isStaff={/* gate */} />
      ))}
    </div>
  );
}
```

- `PassiveCard` : nom + note + (si `counter`) stepper `[−] valeur [+]` (`setCounter`, borné `0..max`) + effet de stat en vert si `statHint` (ex. `+45 AD`).
- `ActiveCard` : nom, badge mana, badge CD (`ready ? 'Prêt' : (readyAt===999999 ? '1×/combat' : 'tour '+readyAt)`), **dégâts calculés** `sk.dmg(eff, ctx)` (masqué si `null`), bouton **Lancer** (désactivé si pas prêt ou mana insuffisant), note narrative en `faint`.
- `weaponTypeOf(state, char)` : lit l'arme du slot `armePrincipale` (`state.equipment`) reliée à `WEAPONS` par nom (repli `char.weaponId`) → `WEAPONS[...].type` (`'Physique'|'Magique'|'Hybride'`). Repli `'Physique'`.
- Steppers de compteur : pour `firstHit`/`furtif`/`side`/`moved`/`nbTargets` (variables d'attaque non persistées), un petit contrôle local `useState` dans `ActiveCard` (toggle « 1er coup » / « furtif », champ « cases parcourues », etc.) selon le perso. Réinjecté dans `ctx` au calcul.
- **Gate édition** : steppers de compteur éditables par tous (le joueur gère ses charges), cast idem ; sélecteur perso visible staff seulement (`lockedCharId` = joueur verrouillé).

- [ ] **Step 2 : Vérif syntaxe** — `npx esbuild pages-competences.jsx >/dev/null && echo OK`.
- [ ] **Step 3 : Commit** — `git commit -am "feat(comp): page Compétences (cast, charges, cooldowns)"`

### Task 12 : Câblage navigation (`index.html`)

**Files:** Modify `index.html`.

- [ ] **Step 1 : Charger le script** — ajouter après `pages-runes.jsx` : `<script type="text/babel" src="pages-competences.jsx"></script>`.
- [ ] **Step 2 : Entrée `PAGES`** — après `runes` (ligne ~116) : `{ id:'competences', label:'Compétences', render:(auth) => <CompetencesPage lockedCharId={auth.role === 'joueur' ? auth.charId : null} /> },`.
- [ ] **Step 3 : Vérif** — servir (`python -m http.server 5050`) → l'onglet « Compétences » apparaît, sélectionnable. Vérif visuelle d'une carte + cast (mana décrémente, badge CD passe à « tour N »).
- [ ] **Step 4 : Commit** — `git commit -am "feat(comp): onglet Compétences dans la nav"`

### Task 13 : Intégration Vue MJ (tour partagé + lecture charges/CD)

**Files:** Modify `pages-mj.jsx`.

- [ ] **Step 1 : Migrer le tour** — supprimer `useMJTurn`/`loadTurn`/`TURN_KEY` (lignes 28-38) ; dans `MJPage` remplacer `const { turn, nextTurn, prevTurn, resetTurn } = useMJTurn();` par `const { turn, nextTurn, prevTurn, resetCombat } = useSharedTurn();`.
- [ ] **Step 2 : En-tête** — remplacer le bouton « ↺ » (resetTurn) par **« Nouveau combat »** (`onClick={resetCombat}`, avec `confirm()` « Réinitialiser tour + toutes les charges/cooldowns ? »). Garder `◂` (prevTurn) et « Fin de tour ▸ » (nextTurn).
- [ ] **Step 3 : Ligne charges/CD par carte joueur** — dans le rendu de chaque carte (près de `mjLive`), ajouter une ligne compacte lisant `st.counters` et `st.cooldowns` : afficher les charges nommées (`SKILLS[c.id].passive.counter.label` : valeur) et les compétences en cooldown (`SKILLS[c.id].actives` filtrées par `!cooldownReady(st.cooldowns[id], turn)` → « Nom : prêt tour N » / « 1×/combat utilisé »). Lecture seule.
- [ ] **Step 4 : Vérif syntaxe** — `npx esbuild pages-mj.jsx >/dev/null && echo OK`.
- [ ] **Step 5 : Vérif comportement** — « Fin de tour » incrémente le tour partagé ; une compétence lancée côté joueur apparaît en cooldown sur la carte MJ et redevient « prêt » quand le tour atteint `readyAt` ; « Nouveau combat » vide charges + cooldowns de tous.
- [ ] **Step 6 : Commit** — `git commit -am "feat(comp): vue MJ — tour partagé + charges/cooldowns par joueur + Nouveau combat"`

### Task 14 : Doc `CLAUDE.md`

- [ ] **Step 1** — ajouter une puce `pages-competences.jsx` à la carte des fichiers + mettre à jour « État actuel » (compétences Elias/Smith/Urskaar/Jett déployées, Rathael en pause) + le modèle de données (`counters`, `cooldowns`, `combat/turn`) + la note de republication RTDB.
- [ ] **Step 2 : Lancer toute la suite** — `node --test test/game-logic.test.js test/auth.test.js` → tout vert ; compter les tests.
- [ ] **Step 3 : Commit** — `git commit -am "docs: compétences (Elias/Smith/Urskaar/Jett) + tour partagé"`

---

## Self-Review (couverture de la spec)

- Onglet Compétences + cast (mana/CD/dégâts) → Tasks 11-12. ✅
- Vue MJ (charges/CD visibles, tour partagé) → Task 13. ✅
- Cooldowns sur tour partagé (`readyAt`) → Tasks 1, 9, 10, 13. ✅
- Nouveau combat = reset toutes charges → Task 9 (`resetCombat`), Task 13. ✅
- Passif calculable (Elias plat) branché sur les 3 sites → Tasks 6, 8. ✅
- Formules = scripts `.gs` (script prime) → Tasks 2-5 (Smith/Urskaar/Elias/Jett vérifiés ligne à ligne ; Urskaar C3/C4 = kit, script muet). ✅
- Rathael hors périmètre (placeholder) → Task 7 (`pending`), Task 11. ✅
- Règle RTDB `combat/turn` + republication → Task 10. ✅

**Manques connus / hors périmètre (attendus) :** Rathael (refonte MJ) ; Jett C3/C4 et Rathael C4 (non fournis) ; application auto des dégâts aux ennemis (Phase 2, le MJ saisit le nombre dans « Subir »).
