# Moteur de stats refondu (fondation) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans pour implémenter ce plan tâche par tâche. Steps en cases `- [ ]`.

**Goal:** Remplacer le moteur de calcul des statistiques par le système refondu du MJ (4 caractéristiques → 8 stats dérivées, dépendantes du niveau), recâblé en calcul **live**, sans casser l'app.

**Architecture:** `computeStats(F,H,M,C,level)` devient une fonction pure et testée dans `game-logic.js` (escalade par tranches de 4 + socle de niveau + bonus de départ). Un helper `charBaseStats(char, state)` résout les caractéristiques effectives (`state.attrs ?? char.attrs`) et le niveau effectif (`state.level ?? char.level`) puis appelle `computeStats`. Tous les sites qui lisaient le `char.stats` figé appellent ce helper. Le `char.stats` baké à la création est supprimé.

**Tech Stack:** Zéro-build (React 18 + Babel standalone via CDN, `.jsx` chargés par `<script type="text/babel">`), pattern UMD + `Object.assign(window, …)`, tests `node --test`, vérif syntaxe `npx esbuild fichier >/dev/null`.

## Global Constraints

- **Zéro-build** : pas de bundler ; chaque fichier définit localement puis `Object.assign(window, {…})`. Ordre de chargement (index.html) : `game-logic.js` → `data.jsx` → `data-state.jsx` → `components.jsx` → `pages-*.jsx`. `computeStats`/`charBaseStats`/`escalationFactor` doivent vivre dans `game-logic.js` (chargé en premier, et seul module testé par `node --test`).
- **Aucune nouvelle règle RTDB** : `state/attrs` + `state/attrsLocked` sont couverts par `characters/$charId`. Ce sous-projet **n'écrit pas** ces clés (lecture seule via `charBaseStats` ; l'écriture viendra avec l'UI de respec).
- **Caractéristiques** : `F`=Force, `H`=Habileté, `M`=Mental, `C`=Magie/Cosmique. Caracs effectives = `state.attrs ?? char.attrs` ; niveau effectif = `state.level ?? char.level`.
- **Pas de Sapience dans le socle** : `computeStats` ne renvoie plus `sapience` ; la clé reste supportée en aval (items/compétences).
- **Vérif syntaxe obligatoire** après tout edit `.jsx`/`.js` : `npx esbuild <fichier> >/dev/null`.
- Source de règles : `info-mj/SPECIFICATION - Système refondu.md` + `docs/superpowers/specs/2026-06-21-moteur-stats-refondu-design.md`.

---

## Fichiers touchés

- `game-logic.js` — **Create** : `escalationFactor`, `computeStats(F,H,M,C,level)` (réécrit), `charBaseStats(char,state)`. **Modify** : `buildDefaultState` (utilise `computeStats`), bloc d'export.
- `data.jsx` — **Modify** : `mkChar` (ne bake plus `stats`, garde `attrs` ; n'appelle plus l'ancien `computeStats`), suppression de l'ancien `computeStats` local, retrait de `computeStats` de l'export `Object.assign`, mise à jour `LEVELS` (caps) + `ATTRIBUTES` (libellés).
- `data-state.jsx` — **Modify** : `resetCombat` (base live via `charBaseStats`).
- `components.jsx` — **Modify** : `AttackModal` (base live).
- `pages-mj.jsx` — **Modify** : `mjLive` (base live).
- `pages-sheet.jsx` — **Modify** : base live + masquage Sapience si 0.
- `pages-equip.jsx` — **Modify** : base live + caracs affichées effectives.
- `pages-competences.jsx` — **Modify** : base live (eff + `hpMax` + `selfBuff`).
- `pages-progression.jsx` — **Modify** : base live + retrait de la cellule Sapience.
- `test/game-logic.test.js` — **Modify** : tests `escalationFactor` + `computeStats` (§9).
- `CLAUDE.md` — **Modify** : doc moteur de stats.

---

## Task 1 : Fonction d'escalade `escalationFactor`

**Files:**
- Modify: `game-logic.js` (ajouter avant le bloc XP `function xpToNext`, ~ligne 454)
- Test: `test/game-logic.test.js`

**Interfaces:**
- Produces: `escalationFactor(points) -> number` (facteur cumulé d'escalade ; 0 pour 0 point ; table §4.3 pour 1..20 ; extension quadratique > 20).

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter à la fin de `test/game-logic.test.js` :

```js
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
```

- [ ] **Step 2 : Lancer les tests, vérifier l'échec**

Run: `node --test test/game-logic.test.js`
Expected: FAIL (`escalationFactor is not a function`).

- [ ] **Step 3 : Implémenter `escalationFactor`**

Dans `game-logic.js`, juste avant le commentaire `/* XP & niveau …` (~ligne 454) :

```js
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
```

Ajouter `escalationFactor` au bloc `return { … }` final (à côté de `xpToNext, applyXp, MAX_LEVEL`).

- [ ] **Step 4 : Lancer les tests, vérifier le succès**

Run: `node --test test/game-logic.test.js`
Expected: PASS (les 2 nouveaux tests verts, aucun régressé).

- [ ] **Step 5 : Commit**

```bash
git add game-logic.js test/game-logic.test.js
git commit -m "feat(refonte): escalationFactor (escalade §4.3 + zone PNJ)"
```

---

## Task 2 : `computeStats(F,H,M,C,level)` + `charBaseStats`

**Files:**
- Modify: `game-logic.js` (ajouter `computeStats` + `charBaseStats`, exports)
- Test: `test/game-logic.test.js`

**Interfaces:**
- Consumes: `escalationFactor` (Task 1).
- Produces:
  - `computeStats(F,H,M,C,level) -> { hp, mana, ad, ap, armure, resmag, crit, dcrit }` (pur ; sans `sapience`).
  - `charBaseStats(char, state) -> {…}` : résout `attrs = (state&&state.attrs) || char.attrs` et `level = (state&&state.level!=null?state.level:char.level)||1`, renvoie `computeStats(attrs.force, attrs.hab, attrs.mental, attrs.magie, level)`.

> Note : cette tâche est **purement additive** dans `game-logic.js`. L'ancien `computeStats` de `data.jsx` et `char.stats` restent en place — l'app n'est pas encore basculée (Task 3).

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter à la fin de `test/game-logic.test.js` :

```js
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
  // au-delà de 5, le bonus de départ ne grimpe plus (mais l'AD via Habileté oui)
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
```

- [ ] **Step 2 : Lancer les tests, vérifier l'échec**

Run: `node --test test/game-logic.test.js`
Expected: FAIL (`computeStats is not a function` — la version `game-logic` n'existe pas encore ; l'ancienne est dans `data.jsx`, non chargée par le test).

- [ ] **Step 3 : Implémenter `computeStats` + `charBaseStats`**

Dans `game-logic.js`, juste après `escalationFactor` :

```js
  /* --- Moteur de stats refondu (info-mj/SPECIFICATION) ---
     8 stats dérivées de 4 caracs + niveau. Magnitude escaladée, crit linéaire.
     Sans Sapience (retirée du socle). */
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

  /* Stats de base d'un perso, live : caracs/niveau effectifs (override state). */
  function charBaseStats(char, state) {
    var a = (state && state.attrs) || (char && char.attrs) || { force: 0, hab: 0, mental: 0, magie: 0 };
    var level = (state && state.level != null ? state.level : (char && char.level)) || 1;
    return computeStats(a.force, a.hab, a.mental, a.magie, level);
  }
```

Ajouter `computeStats, charBaseStats` au bloc `return { … }` final.

- [ ] **Step 4 : Lancer les tests, vérifier le succès**

Run: `node --test test/game-logic.test.js`
Expected: PASS (tous les nouveaux tests verts).

- [ ] **Step 5 : Commit**

```bash
git add game-logic.js test/game-logic.test.js
git commit -m "feat(refonte): computeStats(F,H,M,C,level) + charBaseStats (validés §9)"
```

---

## Task 3 : Bascule de l'app sur le moteur live (swap atomique)

**Files (un seul commit — l'app ne doit pas rester à moitié migrée) :**
- Modify: `game-logic.js` (`buildDefaultState`)
- Modify: `data.jsx` (`mkChar`, suppression ancien `computeStats`, export)
- Modify: `data-state.jsx` (`resetCombat`)
- Modify: `components.jsx` (`AttackModal`)
- Modify: `pages-mj.jsx` (`mjLive`)
- Modify: `pages-sheet.jsx`, `pages-equip.jsx`, `pages-competences.jsx`, `pages-progression.jsx`

**Interfaces:**
- Consumes: `computeStats`, `charBaseStats` (Task 2).

- [ ] **Step 1 : `buildDefaultState` (game-logic.js ~290) — base live**

Remplacer :
```js
      hpCur:   Math.round((char.hpCur || 0) * char.stats.hp),
      manaCur: Math.round((char.manaCur || 0) * char.stats.mana),
```
par :
```js
      hpCur:   Math.round((char.hpCur || 0) * charBaseStats(char, null).hp),
      manaCur: Math.round((char.manaCur || 0) * charBaseStats(char, null).mana),
```

- [ ] **Step 2 : `mkChar` (data.jsx ~102-106) — ne plus baker `stats`**

Remplacer :
```js
function mkChar(o) {
  const stats = computeStats(o.F, o.H, o.M, o.C);
  const modifiers = (window.DEFAULT_MODIFIERS && window.DEFAULT_MODIFIERS[o.id]) || {};
  return { ...o, attrs:{ force:o.F, hab:o.H, mental:o.M, magie:o.C }, stats, modifiers };
}
```
par :
```js
function mkChar(o) {
  const modifiers = (window.DEFAULT_MODIFIERS && window.DEFAULT_MODIFIERS[o.id]) || {};
  return { ...o, attrs:{ force:o.F, hab:o.H, mental:o.M, magie:o.C }, modifiers };
}
```

- [ ] **Step 3 : Supprimer l'ancien `computeStats` de data.jsx + l'export**

Supprimer entièrement le bloc `function computeStats(F, H, M, C) { … }` (data.jsx ~10-26, le commentaire « Moteur de stats » + la fonction). Dans `Object.assign(window, { … })` (~424), retirer `computeStats,` (la nouvelle vit dans game-logic, déjà sur `window`). Laisser `computeAttack` (inchangé).

- [ ] **Step 4 : `resetCombat` (data-state.jsx ~72) — base live**

Remplacer :
```js
      const baseMax = computeEffective(c.stats, st.modifiers, [],
        mergeMods(mergeMods(itemMods, runeMods), passiveMods));
```
par :
```js
      const baseMax = computeEffective(charBaseStats(c, st), st.modifiers, [],
        mergeMods(mergeMods(itemMods, runeMods), passiveMods));
```

- [ ] **Step 5 : `AttackModal` (components.jsx ~215-217) — base live**

Remplacer :
```js
  const launch = () => {
    const isCrit = Math.random() * 100 < char.stats.crit;
    const r = computeAttack({ weapon, stats: char.stats, lethality, isCrit });
```
par :
```js
  const launch = () => {
    const base = charBaseStats(char, null);
    const isCrit = Math.random() * 100 < base.crit;
    const r = computeAttack({ weapon, stats: base, lethality, isCrit });
```

- [ ] **Step 6 : `mjLive` (pages-mj.jsx ~22-24) — base live**

Remplacer :
```js
  const eff = computeEffective(c.stats, st ? st.modifiers : c.modifiers, buffs, mergeMods(mergeMods(mergeMods(itemMods, runeMods), passiveMods), skillBuffMods));
  const hp = st ? st.hpCur : Math.round(c.hpCur * c.stats.hp);
  const mana = st ? st.manaCur : Math.round(c.manaCur * c.stats.mana);
```
par :
```js
  const base = charBaseStats(c, st);
  const eff = computeEffective(base, st ? st.modifiers : c.modifiers, buffs, mergeMods(mergeMods(mergeMods(itemMods, runeMods), passiveMods), skillBuffMods));
  const hp = st ? st.hpCur : Math.round(c.hpCur * base.hp);
  const mana = st ? st.manaCur : Math.round(c.manaCur * base.mana);
```

- [ ] **Step 7 : `pages-sheet.jsx` (~306) — base live**

Remplacer :
```js
  const eff = computeEffective(char.stats, state.modifiers, activeBuffs, mergeMods(mergeMods(mergeMods(itemMods, runeMods), passiveMods), skillBuffMods));
```
par :
```js
  const eff = computeEffective(charBaseStats(char, state), state.modifiers, activeBuffs, mergeMods(mergeMods(mergeMods(itemMods, runeMods), passiveMods), skillBuffMods));
```

- [ ] **Step 8 : `pages-equip.jsx` (~159 + caracs affichées ~164-167) — base live**

Remplacer (~159) :
```js
  const eff = computeEffective(char.stats, state.modifiers, activeBuffs, mergeMods(bonuses, skillBuffMods));
```
par :
```js
  const eff = computeEffective(charBaseStats(char, state), state.modifiers, activeBuffs, mergeMods(bonuses, skillBuffMods));
```
Puis, pour afficher les caracs effectives, remplacer le bloc (~163-167) :
```js
    { k:'Force',          v:char.attrs.force,  col:'#e9dcc4' },
    { k:'Habileté',       v:char.attrs.hab,    col:'#e9dcc4' },
    { k:'Mental',         v:char.attrs.mental, col:'#e9dcc4' },
    { k:'Magie/Cosmique', v:char.attrs.magie,  col:'#e9dcc4' },
```
par (en s'appuyant sur `state.attrs` si présent) :
```js
    { k:'Force',          v:(state.attrs||char.attrs).force,  col:'#e9dcc4' },
    { k:'Habileté',       v:(state.attrs||char.attrs).hab,    col:'#e9dcc4' },
    { k:'Mental',         v:(state.attrs||char.attrs).mental, col:'#e9dcc4' },
    { k:'Magie/Cosmique', v:(state.attrs||char.attrs).magie,  col:'#e9dcc4' },
```

- [ ] **Step 9 : `pages-competences.jsx` (~173, 175, 194) — base live**

En tête du calcul (avant la ligne 173), ajouter :
```js
  const base = charBaseStats(char, state);
```
Remplacer (~173) `computeEffective(char.stats, …)` par `computeEffective(base, …)`.
Remplacer (~175) `hpMax: char.stats.hp` par `hpMax: base.hp`.
Remplacer (~194) `char.stats[k]` par `base[k]`.

- [ ] **Step 10 : `pages-progression.jsx` (~76) — base live**

En tête du composant (après `const a = char.attrs;` ~10), ajouter :
```js
  const base = charBaseStats(char, null);
```
Remplacer le tableau de stats (~76) `[['hp',char.stats.hp], … ,['sapience',char.stats.sapience]]` par (sans Sapience) :
```js
              {[['hp',base.hp],['mana',base.mana],['ad',base.ad],['ap',base.ap],['armure',base.armure],['resmag',base.resmag],['crit',base.crit+'%'],['dcrit',base.dcrit+'%']].map(([k,v]) => (
```

- [ ] **Step 11 : Vérifier la syntaxe de tous les fichiers modifiés**

Run :
```bash
for f in game-logic.js data.jsx data-state.jsx components.jsx pages-mj.jsx pages-sheet.jsx pages-equip.jsx pages-competences.jsx pages-progression.jsx; do npx esbuild "$f" >/dev/null && echo "OK $f"; done
```
Expected: `OK` pour les 9 fichiers, aucune erreur.

- [ ] **Step 12 : Vérifier qu'aucune référence `.stats` résiduelle ne subsiste**

Run: `grep -rn "char\.stats\|c\.stats" *.jsx components.jsx game-logic.js`
Expected: aucun résultat (toutes les références migrées).

- [ ] **Step 13 : Lancer la suite de tests**

Run: `node --test test/game-logic.test.js test/auth.test.js`
Expected: PASS (aucune régression).

- [ ] **Step 14 : Commit**

```bash
git add -A
git commit -m "feat(refonte): bascule app sur le moteur de stats live (charBaseStats)"
```

---

## Task 4 : Caps de niveau, libellés d'attributs, nettoyage Sapience UI

**Files:**
- Modify: `data.jsx` (`LEVELS`, `ATTRIBUTES`)
- Modify: `pages-sheet.jsx` (masquage Sapience si effective = 0)

**Interfaces:** aucune nouvelle (données + affichage).

- [ ] **Step 1 : Mettre les caps de `LEVELS` aux valeurs §3**

Dans `data.jsx`, remplacer les `limit` des niveaux 12→18 (actuellement bloqués à 16) par la table §3 (cap PJ = 20) :
```js
  { lvl:12, gain:2, total:25, limit:16 },
  { lvl:13, gain:1, total:26, limit:17 },
  { lvl:14, gain:1, total:27, limit:18 },
  { lvl:15, gain:2, total:29, limit:19 },
  { lvl:16, gain:1, total:30, limit:20 },
  { lvl:17, gain:1, total:31, limit:20 },
  { lvl:18, gain:2, total:33, limit:20 },
```
(Les niveaux 1→11 sont déjà corrects : 5,6,7,8,9,10,11,12,13,14,15.)

- [ ] **Step 2 : Mettre à jour les libellés `ATTRIBUTES` (page Progression)**

Dans `data.jsx`, remplacer le tableau `ATTRIBUTES` par les ratios refondus (palier × valeur, hors escalade, pour information joueur) :
```js
const ATTRIBUTES = [
  { key:'force', name:'Force',          color:'var(--hp)',     sub:['+20 AD / pt', '+20 PV / pt', '+4 Armure / pt', '+2 D.Crit / pt'] },
  { key:'hab',   name:'Habileté',       color:'var(--gold)',   sub:['+8 AD / pt', '+8 AP / pt', '+10% Crit / pt', '+6 D.Crit / pt', 'Départ : +20 PV/+1 Arm/+1 RM (max 5 pts)'] },
  { key:'mental',name:'Mental',         color:'var(--buff)',   sub:['+42 PV / pt', '+38 Mana / pt', '+3 AD/AP / pt', '+2% Crit / pt'] },
  { key:'magie', name:'Magie/Cosmique', color:'var(--silver)', sub:['+20 AP / pt', '+20 PV / pt', '+17 Mana / pt', '+4 Rés. Mag / pt', '+2 D.Crit / pt'] },
];
```

- [ ] **Step 3 : Masquer la Sapience sur la fiche si effective = 0**

Dans `pages-sheet.jsx`, repérer le rendu de la Sapience dans `SecondaryStats` (la stat `sapience` lue depuis `eff`). Entourer son affichage d'une condition `eff.sapience > 0` (afficher la ligne/chip seulement si une source — item/compétence — accorde de la Sapience). Si la valeur est rendue dans une liste, filtrer l'entrée `sapience` quand `!(eff.sapience > 0)`.

- [ ] **Step 4 : Vérifier la syntaxe**

Run: `npx esbuild data.jsx >/dev/null && npx esbuild pages-sheet.jsx >/dev/null && echo OK`
Expected: `OK`.

- [ ] **Step 5 : Lancer les tests**

Run: `node --test test/game-logic.test.js test/auth.test.js`
Expected: PASS.

- [ ] **Step 6 : Commit**

```bash
git add data.jsx pages-sheet.jsx
git commit -m "feat(refonte): caps de niveau §3 + libellés attributs + Sapience masquée si 0"
```

---

## Task 5 : Documentation + vérification finale

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1 : Mettre à jour la carte des fichiers (CLAUDE.md)**

Dans la description de `game-logic.js`, remplacer la mention de `computeStats` (actuellement décrit comme étant dans `data.jsx`) par : `computeStats(F,H,M,C,level)` (moteur refondu — escalade `escalationFactor`, socle de niveau, bonus de départ ; sans Sapience) + `charBaseStats(char,state)` (base live, caracs/niveau effectifs). Dans la description de `data.jsx`, retirer `computeStats` (déplacé) et noter que `mkChar` ne bake plus `stats` (calcul live). Dans le « Modèle de données Firebase », ajouter sous `state/` :
```
    attrs:       { force, hab, mental, magie }   ← override de caracs (respec) ; absent = repli char.attrs
    attrsLocked: true   ← verrou après respec unique (UI à venir) ; staff peut éditer
```
Mettre à jour la ligne backlog « Refonte » : sous-projet fondation **fait** (moteur live + modèle de données caracs), reste : respec UI, équipement, surcrit, zone PNJ.

- [ ] **Step 2 : Vérification finale complète**

Run :
```bash
node --test test/game-logic.test.js test/auth.test.js
for f in game-logic.js data.jsx data-state.jsx components.jsx pages-mj.jsx pages-sheet.jsx pages-equip.jsx pages-competences.jsx pages-progression.jsx; do npx esbuild "$f" >/dev/null && echo "OK $f"; done
```
Expected: tous les tests PASS + `OK` pour les 9 fichiers.

- [ ] **Step 3 : Vérification visuelle (manuelle, à signaler à l'utilisateur)**

Servir l'app (`python -m http.server 5050 --bind 127.0.0.1`) et vérifier, connecté en MJ : fiche d'un joueur (stats cohérentes, pas de `NaN`/`undefined`, Sapience absente), vue MJ (cartes OK), Équipement (caracs + stats), Progression (stats + caps), et que le **stepper de niveau** (onglet Compétences) fait varier PV/Armure/RM en direct.

- [ ] **Step 4 : Commit**

```bash
git add CLAUDE.md
git commit -m "docs(refonte): moteur de stats live + modèle caracs (CLAUDE.md)"
```

---

## Self-review (couverture spec)

- **Architecture live** → Tasks 2 (helper) + 3 (bascule des 3 sites + buildDefaultState + resetCombat + AttackModal + progression).
- **Formules computeStats** (matrice/valeurs/escalade/socle/bonus de départ) → Tasks 1 + 2, validées §9.
- **Modèle de données `state/attrs`/`attrsLocked`** → lecture via `charBaseStats` (Task 2), documenté (Task 5) ; écriture hors périmètre (respec UI).
- **Sapience retirée du socle + supportée en aval** → Task 2 (absente de `computeStats`) + Task 4 (UI masquée si 0).
- **`LEVELS` caps + `ATTRIBUTES`** → Task 4.
- **Zéro nouvelle règle RTDB** → respecté (lecture seule).
- **Hors périmètre** (respec UI, équipement, surcrit, PNJ) → non inclus ; `escalationFactor` laisse le hook PNJ (>20) prêt.
