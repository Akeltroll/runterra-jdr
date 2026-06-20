# Compétences — correctifs de playtest — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Note d'exécution (ce repo) :** inline (subagents sans tests/git). UI JSX = vérif `esbuild` + chargement headless + manuel. Seule la logique pure de `game-logic.js` est testée.

**Goal:** Corriger 4 retours de playtest : les buffs de ressource remplissent la jauge, les compétences se débloquent par niveau (avec stepper staff), et l'omnivamp/vol de vie s'affiche sur la fiche.

**Architecture:** Helper pur `skillUnlocked` (gating) ; niveau effectif `state.level ?? char.level` threadé aux sites qui lisent `char.level` ; soin au cast + jauges à max dynamique ; `resetCombat` async qui ramène PV/bouclier aux caps de base via `computeEffective` sans skillBuffs ; fix d'affichage `SecondaryStats`.

**Tech Stack:** React 18 + Babel standalone (CDN), Firebase RTDB compat, `node --test`.

## Global Constraints

- **Zéro build** : `Object.assign(window, {...})` + référence nue. Ordre : `game-logic.js` → `data.jsx` → `data-state.jsx` → `components.jsx` → `pages-*.jsx`.
- **Logique pure testée = `game-logic.js`** ; **hooks Firebase = `data-state.jsx`**.
- **Pas de `??` ni `?.`** dans le code (non utilisés dans ce repo) : utiliser `x != null ? x : y`.
- **Niveau effectif** = `state.level` si défini, sinon `char.level`, sinon `1`.
- **Active n° i (0-based) → niveau requis i+1.** Passif toujours dispo.
- **Reset combat** ramène au cap de base : PV `min(hpCur, baseMaxHp)`, bouclier `min(shield, char.shieldMax)`, efface counters/cooldowns/skillBuffs, tour=1, vide `combat/log`.
- Branche `feat/competences-playtest`. Commits français + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## File Structure

- **Modify** `game-logic.js` + `test/game-logic.test.js` — `skillUnlocked` (pur, testé).
- **Modify** `pages-competences.jsx` — niveau effectif, gating des cartes, garde-fou `cast`, stepper niveau staff, soin au cast.
- **Modify** `pages-sheet.jsx` — jauge bouclier à max dynamique ; niveau effectif pour `sumPassiveMods` ; fix omni/vol dans `SecondaryStats`.
- **Modify** `pages-mj.jsx` — jauge bouclier à max dynamique ; niveau effectif pour `sumPassiveMods`.
- **Modify** `pages-equip.jsx` — niveau effectif pour `sumPassiveMods`.
- **Modify** `pages-runes.jsx` — niveau effectif pour `runeBudget`.
- **Modify** `data-state.jsx` — `resetCombat` async : clamp PV/bouclier aux caps de base.
- **Modify** `CLAUDE.md` — doc.

---

## Task 1 : `skillUnlocked` (logique pure, TDD)

**Files:** Modify `game-logic.js`, `test/game-logic.test.js`.
**Interfaces — Produces:** `skillUnlocked(index, level) -> boolean` (`level >= index + 1`).

- [ ] **Step 1 : Test qui échoue** — ajouter dans `test/game-logic.test.js` (après le test `sumSkillBuffs`) :

```js
test('skillUnlocked : active n° i requiert niveau i+1', () => {
  assert.equal(L.skillUnlocked(0, 1), true);   // C1 niv 1
  assert.equal(L.skillUnlocked(1, 2), true);   // C2 niv 2
  assert.equal(L.skillUnlocked(2, 2), false);  // C3 niv 2 -> verrouillé
  assert.equal(L.skillUnlocked(2, 3), true);   // C3 niv 3
  assert.equal(L.skillUnlocked(3, 3), false);  // C4 niv 3 -> verrouillé
  assert.equal(L.skillUnlocked(3, 4), true);   // C4 niv 4
});
```

- [ ] **Step 2 : Échec** — `node --test test/game-logic.test.js` → FAIL (`skillUnlocked is not a function`).

- [ ] **Step 3 : Implémenter** dans `game-logic.js` (près de `cooldownReady`/`nextReadyAt`) :

```js
  function skillUnlocked(index, level) {
    return (Number(level) || 0) >= (Number(index) || 0) + 1;
  }
```

Ajouter `skillUnlocked` au `return { … }` de `game-logic.js` (à côté de `cooldownReady, nextReadyAt`).

- [ ] **Step 4 : Succès** — `node --test test/game-logic.test.js` → PASS.

- [ ] **Step 5 : Commit** — `git commit -am "feat(comp): skillUnlocked (déblocage par niveau, logique pure)"`

---

## Task 2 : Gating par niveau + stepper staff (Compétences)

**Files:** Modify `pages-competences.jsx`.
**Interfaces — Consumes:** `skillUnlocked`, `setField` (sur `useCharState`). **Produces:** `ActiveCard` reçoit `locked` + `minLevel` ; `CompetencesBody` calcule `level` effectif et affiche le stepper staff.

- [ ] **Step 1 : Niveau effectif** — dans `CompetencesBody`, remplacer `const level = char.level || 1;` par :

```jsx
  const level = (state.level != null ? state.level : char.level) || 1;
```

- [ ] **Step 2 : Garde-fou `cast`** — au tout début de `function cast(sk)`, après la ligne `const cost = sk.mana || 0;`, ajouter le refus si verrouillé :

```jsx
    const skIndex = kit.actives.indexOf(sk);
    if (!skillUnlocked(skIndex, level)) {
      toast(`<b>${char.name}</b> — ${sk.name} se débloque au niveau ${skIndex + 1}`, 'gold');
      return;
    }
```

- [ ] **Step 3 : Passer `locked`/`minLevel` à `ActiveCard`** — dans le `.map`, remplacer le bloc `kit.actives.map(sk => ( … ))` par (ajout de l'index + props) :

```jsx
        {kit.actives.map((sk, i) => (
          <ActiveCard key={sk.id} sk={sk} eff={eff} baseCtx={baseCtx} color={color}
            ready={cooldownReady(cooldowns[sk.id], turn)} readyAt={cooldowns[sk.id]} turn={turn}
            manaCur={state.manaCur || 0} onCast={() => cast(sk)}
            locked={!skillUnlocked(i, level)} minLevel={i + 1} />
        ))}
```

- [ ] **Step 4 : `ActiveCard` rend l'état verrouillé** — modifier la signature et le rendu de `ActiveCard`. Remplacer la ligne de signature :

```jsx
function ActiveCard({ sk, eff, baseCtx, color, ready, readyAt, turn, manaCur, onCast }) {
```

par :

```jsx
function ActiveCard({ sk, eff, baseCtx, color, ready, readyAt, turn, manaCur, onCast, locked, minLevel }) {
```

Puis, juste avant le `return (` de `ActiveCard`, ajouter le rendu court-circuité quand verrouillé :

```jsx
  if (locked) {
    return (
      <div className="panel" style={{ borderLeft: '3px solid var(--line-strong)', opacity: 0.5 }}>
        <div className="panel-head">
          <h3>⚔ {sk.name}</h3>
          <span className="badge" style={{ background: 'var(--bg-panel-2)', color: 'var(--gold-pale)' }}>🔒 Niveau {minLevel}</span>
        </div>
        <div style={{ padding: '10px 14px' }}>
          <div className="faint" style={{ fontSize: 12.5 }}>Se débloque au niveau {minLevel}.</div>
          {sk.note && <div className="faint" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>{sk.note}</div>}
        </div>
      </div>
    );
  }
```

- [ ] **Step 5 : Stepper de niveau (staff)** — dans le `return` de `CompetencesBody`, dans la ligne d'en-tête (le `<div className="row">` qui contient le `<h2>` et le badge `⏱ Tour {turn}`), ajouter le stepper **avant** le badge de tour. Remplacer :

```jsx
        <span className="badge" style={{ background: 'var(--bg-inset)', color: 'var(--gold-pale)' }}>⏱ Tour {turn}</span>
```

par :

```jsx
        <span className="row gap-2" style={{ alignItems: 'center' }}>
          {staff && (
            <span className="row gap-1" style={{ alignItems: 'center' }}>
              <span className="overline">Niveau</span>
              <button className="btn btn-sm btn-ghost" onClick={() => setField('level', Math.max(1, level - 1))} disabled={level <= 1}>−</button>
              <span className="mono" style={{ fontSize: 15, color: 'var(--gold-pale)', minWidth: 22, textAlign: 'center' }}>{level}</span>
              <button className="btn btn-sm btn-ghost" onClick={() => setField('level', level + 1)}>+</button>
            </span>
          )}
          <span className="badge" style={{ background: 'var(--bg-inset)', color: 'var(--gold-pale)' }}>⏱ Tour {turn}</span>
        </span>
```

- [ ] **Step 6 : Vérif** — `npx esbuild pages-competences.jsx >/dev/null && echo OK`.
- [ ] **Step 7 : Commit** — `git commit -am "feat(comp): déblocage par niveau (cartes verrouillées + garde-fou) + stepper niveau staff"`

---

## Task 3 : Niveau effectif threadé (fiche / MJ / équip / runes)

**Files:** Modify `pages-sheet.jsx`, `pages-mj.jsx`, `pages-equip.jsx`, `pages-runes.jsx`.
**Interfaces — Consumes:** `state.level` (par fiche). Niveau effectif = `state.level != null ? state.level : char.level`.

- [ ] **Step 1 : Fiche** — dans `pages-sheet.jsx`, remplacer :

```jsx
  const passiveMods = sumPassiveMods(char.id, state.counters || {}, char.level || 1);
```

par :

```jsx
  const effLevel = (state.level != null ? state.level : char.level) || 1;
  const passiveMods = sumPassiveMods(char.id, state.counters || {}, effLevel);
```

- [ ] **Step 2 : MJ** — dans `pages-mj.jsx` (`mjLive`), remplacer :

```jsx
  const passiveMods = st ? sumPassiveMods(c.id, st.counters || {}, c.level || 1) : {};
```

par :

```jsx
  const effLevel = (st && st.level != null ? st.level : c.level) || 1;
  const passiveMods = st ? sumPassiveMods(c.id, st.counters || {}, effLevel) : {};
```

- [ ] **Step 3 : Équipement** — dans `pages-equip.jsx`, remplacer :

```jsx
  const passiveMods = sumPassiveMods(char.id, state.counters || {}, char.level || 1);
```

par :

```jsx
  const effLevel = (state.level != null ? state.level : char.level) || 1;
  const passiveMods = sumPassiveMods(char.id, state.counters || {}, effLevel);
```

- [ ] **Step 4 : Runes** — dans `pages-runes.jsx`, remplacer :

```jsx
  const budget = runeBudget(char.level) + bonus;
```

par :

```jsx
  const effLevel = (state.level != null ? state.level : char.level) || 1;
  const budget = runeBudget(effLevel) + bonus;
```

- [ ] **Step 5 : Vérif** — `for f in pages-sheet pages-mj pages-equip pages-runes; do npx esbuild $f.jsx >/dev/null || exit 1; done && echo OK`.
- [ ] **Step 6 : Commit** — `git commit -am "feat(comp): niveau effectif (state.level) branché sur passif + budget de runes"`

---

## Task 4 : Buffs de ressource remplissent la jauge (cast + jauges)

**Files:** Modify `pages-competences.jsx`, `pages-sheet.jsx`, `pages-mj.jsx`.
**Interfaces — Consumes:** `setField`, `eff`, `state.hpCur`, `state.shield`, `char.shieldMax`.

- [ ] **Step 1 : Soin au cast** — dans `pages-competences.jsx`, `cast(sk)`, dans le bloc `if (sk.selfBuff) { … }`, après `setSkillBuff(sk.id, flat);` et avant le `toast(...)`, ajouter le soin si le buff donne des PV :

```jsx
      if (flat.hp) {
        const newMax = (eff.hp || 0) + flat.hp;
        setField('hpCur', Math.min((state.hpCur || 0) + flat.hp, newMax));
      }
```

(`eff.hp` est calculé sans ce buff — non encore écrit dans `state.skillBuffs` — donc `newMax = eff.hp + flat.hp`.)

- [ ] **Step 2 : Jauge bouclier dynamique (fiche)** — dans `pages-sheet.jsx`, remplacer les **deux** occurrences `max={char.shieldMax}` des jauges (la `<Gauge … label="Bouclier" />` et la `<ResourceBar kind="shield" … />`) par `max={Math.max(char.shieldMax || 0, shield)}`. Concrètement :

```jsx
        <Gauge cur={shield} max={Math.max(char.shieldMax || 0, shield)} color="var(--shield)" label="Bouclier" />
```

et

```jsx
        <ResourceBar kind="shield" cur={shield} max={Math.max(char.shieldMax || 0, shield)} big={big} segments={variant==='b'?10:0} />
```

(Ne pas toucher `maxShield = char.shieldMax` dans `HealPanel` : le plafond d'ajout manuel reste le cap de base.)

- [ ] **Step 3 : Jauge bouclier dynamique (MJ)** — dans `pages-mj.jsx`, remplacer :

```jsx
        <ResourceBar kind="shield" cur={L.shield} max={c.shieldMax || 0} />
```

par :

```jsx
        <ResourceBar kind="shield" cur={L.shield} max={Math.max(c.shieldMax || 0, L.shield)} />
```

- [ ] **Step 4 : Vérif** — `for f in pages-competences pages-sheet pages-mj; do npx esbuild $f.jsx >/dev/null || exit 1; done && echo OK`.
- [ ] **Step 5 : Commit** — `git commit -am "feat(comp): buffs de ressource remplissent la jauge (soin PV au cast + bouclier à max dynamique)"`

---

## Task 5 : `resetCombat` ramène PV/bouclier aux caps de base

**Files:** Modify `data-state.jsx`.
**Interfaces — Consumes (refs globales game-logic) :** `computeEffective`, `sumItemMods`, `sumRuneMods`, `buildRuneIndex`, `sumPassiveMods`, `mergeMods`, `RUNES`, `window.RTDB.getSnapshot`.

- [ ] **Step 1 : Réécrire `resetCombat`** — dans `useSharedTurn` (`data-state.jsx`), remplacer le `resetCombat` actuel par une version **async** qui plafonne PV et bouclier au cap de base (sans `skillBuffs`) :

```jsx
  const resetCombat = useCallback(async () => {
    window.RTDB.setPath(COMBAT_TURN, 1);
    for (const c of CHARACTERS) {
      const p = charPath(c.id);
      const st = (await window.RTDB.getSnapshot(p)) || {};
      const itemMods = sumItemMods(st.equipment, st.inventory);
      const runesSt = st.runes || {};
      const runeMods = sumRuneMods(
        Object.keys(runesSt.selected || {}).filter((id) => runesSt.selected[id]),
        runesSt.choices || {}, buildRuneIndex(RUNES));
      const lvl = (st.level != null ? st.level : c.level) || 1;
      const passiveMods = sumPassiveMods(c.id, st.counters || {}, lvl);
      // Max de base SANS skillBuffs (les buffs BUFFS n'affectent pas les PV max).
      const baseMax = computeEffective(c.stats, st.modifiers, [],
        mergeMods(mergeMods(itemMods, runeMods), passiveMods));
      const patch = { counters: null, cooldowns: null, skillBuffs: null };
      if (st.hpCur != null) patch.hpCur = Math.min(st.hpCur, baseMax.hp);
      patch.shield = Math.min(st.shield || 0, c.shieldMax || 0);
      window.RTDB.updatePath(p, patch);
    }
    window.RTDB.setPath(COMBAT_LOG, null);
  }, []);
```

- [ ] **Step 2 : Vérif** — `npx esbuild data-state.jsx >/dev/null && echo OK`.
- [ ] **Step 3 : Commit** — `git commit -am "feat(comp): reset combat ramène PV/bouclier aux caps de base (sans skillBuffs)"`

---

## Task 6 : Fix affichage omnivamp / vol de vie (fiche)

**Files:** Modify `pages-sheet.jsx`.
**Interfaces — Consumes:** `eff` passé en `stats` à `SecondaryStats`.

- [ ] **Step 1 : Lire `eff` au lieu de `'0%'`** — dans `pages-sheet.jsx`, `SecondaryStats`, remplacer :

```jsx
    ['sapience', stats.sapience, false], ['omni', '0%', true], ['vol', '0%', false],
```

par :

```jsx
    ['sapience', stats.sapience, false],
    ['omni', (stats.omni || 0) + '%', true],
    ['vol', (stats.vol || 0) + '%', false],
```

- [ ] **Step 2 : Vérif** — `npx esbuild pages-sheet.jsx >/dev/null && echo OK`.
- [ ] **Step 3 : Commit** — `git commit -am "fix(fiche): omnivamp/vol de vie lus depuis les stats effectives (au lieu de 0% en dur)"`

---

## Task 7 : Doc + tests + headless

**Files:** Modify `CLAUDE.md`.

- [ ] **Step 1 : Doc** — `CLAUDE.md` :
  - Modèle de données : `state/level` (entier ≥ 1, niveau effectif, défaut `char.level`).
  - `data-state.jsx` : `resetCombat` async (plafonne PV/bouclier aux caps de base).
  - `pages-competences.jsx` : déblocage par niveau (`skillUnlocked`, cartes verrouillées 🔒) + stepper niveau staff + soin au cast.
  - `pages-sheet.jsx` : jauge bouclier à max dynamique + fix omni/vol.
  - `game-logic.js` : `skillUnlocked`.
  - Décisions figées : active n° i → niveau i+1 ; reset = retour total aux caps de base ; niveau effectif `state.level`.
  - « État actuel » : nouvelle entrée pour ces correctifs.
- [ ] **Step 2 : Tests** — `node --test test/game-logic.test.js test/auth.test.js` → tout vert (1 nouveau test `skillUnlocked`).
- [ ] **Step 3 : Chargement headless** — servir le site (`python -m http.server 5050 --bind 127.0.0.1`), charger `index.html` via Playwright (script temporaire `test/_tmp_headless.mjs`), vérifier 0 erreur console (hors Firebase) + `skillUnlocked` défini sur `window`, puis **supprimer le script**.
- [ ] **Step 4 : Commit** — `git commit -am "docs(comp): correctifs playtest (niveaux, jauges buff, omni/vol)"`

---

## Self-Review (couverture de la spec)

- **Partie 1** — soin PV au cast (Task 4 Step 1), bouclier max dynamique fiche+MJ (Task 4 Steps 2-3), reset PV/bouclier aux caps de base (Task 5). ✅
- **Partie 2** — `skillUnlocked` testé (Task 1), gating cartes + garde-fou cast (Task 2 Steps 2-4), niveau effectif threadé (Task 3). ✅
- **Partie 3** — stepper niveau staff persisté `state/level` (Task 2 Step 5), aucune règle RTDB (déjà couvert). ✅
- **Partie 4** — `SecondaryStats` lit `eff.omni`/`eff.vol` (Task 6). ✅

**Hors périmètre (conforme spec) :** re-validation des runes sur-dépensées si baisse de niveau ; comps manquantes / refonte Rathael.
