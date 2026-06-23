# Mur de Givre — durée 1/2 tours (Feature A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre au lanceur de Mur de Givre (Rathael C2) de choisir 1 ou 2 tours au cast, et faire expirer automatiquement le buff +Armure/+RM au bout de la durée choisie.

**Architecture:** Les buffs de soi (`state/skillBuffs/{skillId}`) passent d'une forme plate `{ [stat]: n }` à une forme `{ mods:{ [stat]: n }, until:<n° de tour>|null }`. La logique pure `sumSkillBuffs` devient consciente de la forme et filtre les buffs expirés selon le tour courant (passé en argument). Le cast calcule `until = turn + (durée − 1)`. Aucune écriture de purge : un buff expiré cesse simplement d'être sommé (et disparaît du panneau orange).

**Tech Stack:** Zéro-build (React 18 + Babel standalone via CDN), `game-logic.js` (UMD, testé en Node), Firebase RTDB compat. Tests : `node --test`.

## Global Constraints

- **Zéro build** : chaque `.jsx`/`.js` définit localement puis `Object.assign(window, {...})`. Accès aux autres modules par référence nue (résolue via `window`). Ne pas casser cet ordre.
- **Compat de données** : un buff déjà écrit sous l'ancienne forme plate `{ [stat]: n }` doit rester lisible (traité comme `{ mods:<plat>, until:null }`). Pas de migration de données.
- **`currentTurn` optionnel** : `sumSkillBuffs(skillBuffs, currentTurn)` sans 2e argument ne filtre pas par le temps (mais comprend la nouvelle forme). Garantit qu'aucun appelant existant n'est cassé.
- **Sémantique de durée** : cast au tour `T`, durée `D ∈ {1,2}` → `until = T + (D − 1)`. Actif tant que `currentTurn <= until`.
- **Aucune nouvelle règle RTDB** (`skillBuffs` déjà couvert par `characters/$charId`).
- **Vérif syntaxe** d'un `.jsx`/`.js` : `npx esbuild <fichier> >/dev/null`.
- **Cache-busting** : bumper le jeton `?v=` dans `index.html` au déploiement (dernière étape).

---

### Task 1 : `sumSkillBuffs` conscient de la forme + filtrage par tour (logique pure)

**Files:**
- Modify: `game-logic.js:582-590` (fonction `sumSkillBuffs`)
- Test: `test/game-logic.test.js:457-462` (ajout d'un test)

**Interfaces:**
- Produces: `sumSkillBuffs(skillBuffs, currentTurn?) -> { [stat]: number }`. Comprend les deux formes d'entrée (plate `{stat:n}` et `{mods,until}`). Si `currentTurn` est un nombre fini et `until != null && currentTurn > until`, le buff est ignoré.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter après le test existant `test('sumSkillBuffs somme les mods plats par compétence', …)` (vers `test/game-logic.test.js:462`) :

```js
test('sumSkillBuffs : nouvelle forme {mods,until} + filtrage par tour', () => {
  const buffs = { mur_de_givre: { mods: { armure: 20, resmag: 20 }, until: 3 } };
  assert.deepEqual(L.sumSkillBuffs(buffs, 3), { armure: 20, resmag: 20 }); // tour <= until : actif
  assert.deepEqual(L.sumSkillBuffs(buffs, 4), {});                          // tour > until : expiré
  assert.deepEqual(L.sumSkillBuffs(buffs), { armure: 20, resmag: 20 });     // sans tour : pas de filtre
  assert.deepEqual(L.sumSkillBuffs({ x: { mods: { ad: 5 }, until: null } }, 99), { ad: 5 }); // until null = permanent
  // mélange ancienne (plate) + nouvelle forme, filtrage actif
  assert.deepEqual(L.sumSkillBuffs({ a: { ad: 10 }, b: { mods: { ad: 5 }, until: 2 } }, 1), { ad: 15 });
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `node --test test/game-logic.test.js`
Expected: FAIL sur le nouveau test (la forme `{mods,until}` est sommée comme des stats `mods`/`until`, ou non filtrée).

- [ ] **Step 3: Implémenter le minimum**

Remplacer la fonction `sumSkillBuffs` (`game-logic.js:580-590`) par :

```js
  /* Buffs sur soi (compétences) : somme des mods plats snapshotés au cast.
     Forme d'une entrée : ancienne plate { [stat]: n } (compat), ou nouvelle
     { mods:{ [stat]: n }, until:<n° de tour>|null } (avec durée).
     currentTurn (optionnel) : si fourni, un buff dont until != null && currentTurn > until
     est expiré → ignoré. Sans currentTurn, aucun filtrage temporel. */
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
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `node --test test/game-logic.test.js`
Expected: PASS (tous, dont l'ancien test `sumSkillBuffs somme les mods plats` qui reste vert grâce à la compat).

- [ ] **Step 5: Commit**

```bash
git add game-logic.js test/game-logic.test.js
git commit -m "feat(combat): sumSkillBuffs comprend la forme {mods,until} + filtrage par tour"
```

---

### Task 2 : Les appelants de `sumSkillBuffs` passent le tour courant

**Files:**
- Modify: `pages-competences.jsx:175` et `:329`
- Modify: `pages-sheet.jsx:273` (ajout hook) et `:297`
- Modify: `pages-equip.jsx:77` (ajout hook) et `:159`
- Modify: `pages-mj.jsx:13` (signature `mjLive`), `:22`, `:70`, `:287`

**Interfaces:**
- Consumes: `sumSkillBuffs(skillBuffs, currentTurn?)` (Task 1).
- Produces: tous les sites de lecture filtrent les buffs expirés selon le tour partagé. Aucun changement de comportement tant que rien n'écrit `until` (Task 4), donc étape sûre.

- [ ] **Step 1: `pages-competences.jsx` — passer `turn` aux 2 appels**

`turn` est déjà en portée (`const { turn } = useSharedTurn();`, ligne 150).

Ligne 175, remplacer :
```js
  const skillBuffMods = sumSkillBuffs(state.skillBuffs || {});
```
par :
```js
  const skillBuffMods = sumSkillBuffs(state.skillBuffs || {}, turn);
```

Ligne 329, remplacer :
```js
        const sb = sumSkillBuffs(state.skillBuffs || {});
```
par :
```js
        const sb = sumSkillBuffs(state.skillBuffs || {}, turn);
```

- [ ] **Step 2: `pages-sheet.jsx` — lire le tour + le passer**

Après la ligne 273 (`const { state, setField, setBuff, setMod, setInvItem, removeInvItem } = useCharState(char.id);`), ajouter :
```js
  const { turn } = useSharedTurn();
```

Ligne 297, remplacer :
```js
  const skillBuffMods = sumSkillBuffs(state.skillBuffs || {});
```
par :
```js
  const skillBuffMods = sumSkillBuffs(state.skillBuffs || {}, turn);
```

- [ ] **Step 3: `pages-equip.jsx` — lire le tour + le passer**

Après la ligne 77 (`const { state, setEquipment, setField, setInvItem, removeInvItem } = useCharState(char.id);`), ajouter :
```js
  const { turn } = useSharedTurn();
```

Ligne 159, remplacer :
```js
  const skillBuffMods = sumSkillBuffs(state.skillBuffs || {});  // buffs de compétence -> orange
```
par :
```js
  const skillBuffMods = sumSkillBuffs(state.skillBuffs || {}, turn);  // buffs de compétence -> orange
```

- [ ] **Step 4: `pages-mj.jsx` — `mjLive` reçoit le tour**

Ligne 13, remplacer la signature :
```js
function mjLive(c, st) {
```
par :
```js
function mjLive(c, st, turn) {
```

Ligne 22, remplacer :
```js
  const skillBuffMods = st ? sumSkillBuffs(st.skillBuffs || {}) : {};
```
par :
```js
  const skillBuffMods = st ? sumSkillBuffs(st.skillBuffs || {}, turn) : {};
```

Ligne 70 (`MJCompactCard`, qui a déjà le prop `turn`), remplacer :
```js
  const L = mjLive(c, st);
```
par :
```js
  const L = mjLive(c, st, turn);
```

Ligne 287 (`EnemyAttackModal.submit`, `turn` est en portée — utilisé ligne 293), remplacer :
```js
    const L = mjLive(c, st);
```
par :
```js
    const L = mjLive(c, st, turn);
```

(NE PAS toucher la ligne 37 `MJSidebarRow` : pas de `turn` en portée, et elle n'utilise que `hpPct` — Mur de Givre buffe armure/resmag, pas les PV. `mjLive(c, st)` sans tour reste correct grâce au paramètre optionnel.)

- [ ] **Step 5: Vérifier la syntaxe des fichiers modifiés**

Run:
```bash
npx esbuild pages-competences.jsx pages-sheet.jsx pages-equip.jsx pages-mj.jsx >/dev/null
```
Expected: aucune erreur.

- [ ] **Step 6: Lancer les tests (non-régression)**

Run: `node --test test/game-logic.test.js test/auth.test.js`
Expected: PASS (tout vert).

- [ ] **Step 7: Commit**

```bash
git add pages-competences.jsx pages-sheet.jsx pages-equip.jsx pages-mj.jsx
git commit -m "feat(combat): les vues passent le tour courant à sumSkillBuffs (expiration des buffs)"
```

---

### Task 3 : `mur_de_givre` déclare une durée + texte clarifié (data)

**Files:**
- Modify: `data.jsx:409-415` (entrée `mur_de_givre`)

**Interfaces:**
- Produces: `SKILLS.rathael.actives[1]` (id `mur_de_givre`) porte `duration: { min: 1, max: 2 }`. C'est le drapeau lu par l'UI (Task 4, `ActiveCard`) et par `cast` pour calculer `until`.

- [ ] **Step 1: Ajouter le champ `duration` et réécrire la note**

Remplacer l'entrée (`data.jsx:409-415`) :
```js
      { id: 'mur_de_givre', name: 'Mur de Givre', mana: 50, cd: 3, kind: 'cd',
        dmg: () => null,
        selfBuffFlat: (eff, c) => { const v = rathaelC2Buff(c.level); return { armure: v, resmag: v }; },
        counterBump: { key: 'glaciation', by: 1, min: 1, max: 5 },
        note: 'Inamovible ce tour, +Armure / +Résistance magique (15 +5/2 niv, soit 20 au niv 2). Provoque un ennemi '
          + 'adjacent (le forçant à cibler Rathael). Si ≥1 charge de Glaciation : +1 charge. En état Âme fendue : '
          + 'immobilise les ennemis adjacents.' },
```
par :
```js
      { id: 'mur_de_givre', name: 'Mur de Givre', mana: 50, cd: 3, kind: 'cd',
        dmg: () => null,
        duration: { min: 1, max: 2 },
        selfBuffFlat: (eff, c) => { const v = rathaelC2Buff(c.level); return { armure: v, resmag: v }; },
        counterBump: { key: 'glaciation', by: 1, min: 1, max: 5 },
        note: 'PE = Pendant l\'Effet (choisis 1 ou 2 tours au lancement). PE : inamovible, +Armure / +Résistance '
          + 'magique (15 +5/2 niv, soit 20 au niv 2) ; un ennemi adjacent est provoqué (forcé de cibler Rathael) ; '
          + 'en état Âme fendue, immobilise les ennemis adjacents. Si ≥1 charge de Glaciation : +1 charge.' },
```

- [ ] **Step 2: Vérifier la syntaxe**

Run: `npx esbuild data.jsx >/dev/null`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add data.jsx
git commit -m "feat(combat): Mur de Givre — durée 1/2 tours (duration) + note PE clarifiée"
```

---

### Task 4 : Écriture du buff avec `until` (setSkillBuff + cast + sélecteur de durée)

**Files:**
- Modify: `data-state.jsx:45-47` (`setSkillBuff`)
- Modify: `pages-competences.jsx:73-145` (`ActiveCard` : état + sélecteur)
- Modify: `pages-competences.jsx:215-227` (bloc buff de `cast`)

**Interfaces:**
- Consumes: `sk.duration = { min, max }` (Task 3) ; `sumSkillBuffs(..., turn)` côté lecture (Task 2).
- Produces: `setSkillBuff(skillId, mods, until)` écrit `{ mods, until: until ?? null }`. Le cast d'une compétence avec `duration` écrit `until = turn + (durée − 1)` selon le choix de la carte.

- [ ] **Step 1: `setSkillBuff` accepte `until` et écrit la nouvelle forme**

Remplacer (`data-state.jsx:45-47`) :
```js
  // Buff sur soi : snapshot des mods plats d'une compétence (effacé par « ⟲ Combat »).
  const setSkillBuff = useCallback((skillId, mods) =>
    window.RTDB.updatePath(`${charPath(charId)}/skillBuffs`, { [skillId]: mods || null }), [charId]);
```
par :
```js
  // Buff sur soi : snapshot des mods plats d'une compétence + durée optionnelle
  // (until = n° de tour de fin ; null = permanent jusqu'au « ⟲ Combat »). Effacé par « ⟲ Combat ».
  const setSkillBuff = useCallback((skillId, mods, until) =>
    window.RTDB.updatePath(`${charPath(charId)}/skillBuffs`,
      { [skillId]: mods ? { mods, until: until != null ? until : null } : null }), [charId]);
```

- [ ] **Step 2: `cast` calcule `until` et le transmet**

Dans `cast` (`pages-competences.jsx`), le bloc buff sur soi (lignes 215-227). Remplacer :
```js
    const sbf = typeof sk.selfBuffFlat === 'function' ? (sk.selfBuffFlat(eff, ctx) || {}) : sk.selfBuffFlat;
    if (sk.selfBuff || sbf) {
      const flat = {};
      if (sk.selfBuff) Object.keys(sk.selfBuff).forEach(k => { const f = Math.round(sk.selfBuff[k] * (base[k] || 0)); if (f) flat[k] = (flat[k] || 0) + f; });
      if (sbf) Object.keys(sbf).forEach(k => { const f = Math.round(sbf[k]); if (f) flat[k] = (flat[k] || 0) + f; });
      setSkillBuff(sk.id, flat);
      if (flat.hp) {
        const newMax = (eff.hp || 0) + flat.hp;
        setField('hpCur', Math.min((state.hpCur || 0) + flat.hp, newMax));
      }
      logParts.push(flat.hp ? `+${flat.hp} PV` : 'effet de combat');
      toast(`<b>${char.name}</b> — ${sk.name} actif (effet de combat)`, 'gold');
    }
```
par :
```js
    const sbf = typeof sk.selfBuffFlat === 'function' ? (sk.selfBuffFlat(eff, ctx) || {}) : sk.selfBuffFlat;
    if (sk.selfBuff || sbf) {
      const flat = {};
      if (sk.selfBuff) Object.keys(sk.selfBuff).forEach(k => { const f = Math.round(sk.selfBuff[k] * (base[k] || 0)); if (f) flat[k] = (flat[k] || 0) + f; });
      if (sbf) Object.keys(sbf).forEach(k => { const f = Math.round(sbf[k]); if (f) flat[k] = (flat[k] || 0) + f; });
      // Durée optionnelle : until = tour de fin (turn + durée − 1). Sans sk.duration → permanent (null).
      let until = null, durTxt = '';
      if (sk.duration) {
        const d = Math.max(sk.duration.min, Math.min(sk.duration.max, (ctx.duration | 0) || sk.duration.min));
        until = turn + (d - 1);
        durTxt = ` (${d} tour${d > 1 ? 's' : ''})`;
      }
      setSkillBuff(sk.id, flat, until);
      if (flat.hp) {
        const newMax = (eff.hp || 0) + flat.hp;
        setField('hpCur', Math.min((state.hpCur || 0) + flat.hp, newMax));
      }
      logParts.push((flat.hp ? `+${flat.hp} PV` : 'effet de combat') + durTxt);
      toast(`<b>${char.name}</b> — ${sk.name} actif (effet de combat)`, 'gold');
    }
```

- [ ] **Step 3: `ActiveCard` — état `duration` + sélecteur 1/2 tours**

Dans `ActiveCard` (`pages-competences.jsx:74`), remplacer l'init de `vars` :
```js
  const [vars, setVars] = useState({ firstHit: false, furtif: false, side: 'droite', moved: 0, nbTargets: 1 });
```
par :
```js
  const [vars, setVars] = useState({ firstHit: false, furtif: false, side: 'droite', moved: 0, nbTargets: 1, duration: (sk.duration ? sk.duration.min : 1) });
```

Puis la ligne de garde du bloc de contrôles (`pages-competences.jsx:109`), remplacer :
```js
        {needed.length > 0 && (
```
par :
```js
        {(needed.length > 0 || sk.duration) && (
```

Et, à l'intérieur de ce bloc, juste avant sa fermeture `</div>` (après le contrôle `nbTargets`, `pages-competences.jsx:121`), ajouter le sélecteur de durée :
```js
            {sk.duration && (
              <label className="row gap-1" style={{ fontSize: 12.5, alignItems: 'center' }}>Durée
                <select value={vars.duration} onChange={e => setVars(s => ({ ...s, duration: Math.max(sk.duration.min, Math.min(sk.duration.max, e.target.value | 0)) }))} style={{ background: 'var(--bg-inset)', color: 'var(--ink)', border: '1px solid var(--line-strong)', borderRadius: 5, padding: '3px 6px' }}>
                  {Array.from({ length: sk.duration.max - sk.duration.min + 1 }, (_, i) => sk.duration.min + i).map(n => <option key={n} value={n}>{n} tour{n > 1 ? 's' : ''}</option>)}
                </select>
              </label>
            )}
```

(`ctx = Object.assign({}, baseCtx, vars)` à la ligne 90 inclut donc `ctx.duration`, lu par `cast`.)

- [ ] **Step 4: Vérifier la syntaxe**

Run:
```bash
npx esbuild data-state.jsx pages-competences.jsx >/dev/null
```
Expected: aucune erreur.

- [ ] **Step 5: Lancer les tests (non-régression)**

Run: `node --test test/game-logic.test.js test/auth.test.js`
Expected: PASS.

- [ ] **Step 6: Vérification manuelle**

Servir le site (`python -m http.server 5050 --bind 127.0.0.1`), se connecter en MJ, onglet Combat → Rathael :
1. La carte Mur de Givre affiche un sélecteur **Durée : 1 tour / 2 tours**.
2. Choisir « 2 tours » puis Lancer → panneau orange « Effets de combat actifs » montre +20 ARMURE / +20 RESMAG ; le journal indique « effet de combat (2 tours) ».
3. Vue MJ : la carte Rathael montre l'armure/RM augmentée.
4. Avancer le tour partagé (⏭ Fin de tour) **une** fois → buff encore actif (until = T+1). Avancer **une 2e** fois → buff disparu (panneau orange vide, armure/RM revenues à la normale).
5. Refaire avec « 1 tour » → buff disparaît après **une seule** avance de tour.

- [ ] **Step 7: Commit**

```bash
git add data-state.jsx pages-competences.jsx
git commit -m "feat(combat): Mur de Givre — choix 1/2 tours au cast + auto-expiration du buff"
```

---

## Déploiement

- [ ] Bumper le jeton `?v=…` (cache-busting) dans `index.html` (search-replace de l'ancienne valeur, ex. `20260622-1` → `20260623-1`) et `window.APPV`.
- [ ] Commit du bump + push (branche `feat/mur-de-givre-duree` puis merge sur `main`, ou directement selon préférence).
- Aucune règle RTDB à republier.

## Self-Review (rempli à la rédaction)

- **Couverture spec** : forme `{mods,until}` ✓ (Task 1) ; filtrage par tour ✓ (Task 1) ; compat plate ✓ (Task 1) ; appelants passent le tour ✓ (Task 2) ; `duration` sur `mur_de_givre` ✓ (Task 3) ; sélecteur 1/2 tours ✓ (Task 4) ; `until = T+(D−1)` ✓ (Task 4) ; `setSkillBuff(…, until)` ✓ (Task 4) ; texte PE clarifié ✓ (Task 3) ; journal mentionne la durée ✓ (Task 4) ; zéro règle RTDB ✓.
- **Placeholders** : aucun.
- **Cohérence des types** : `setSkillBuff(skillId, mods, until)` (Task 4) ↔ écrit `{mods, until}` ↔ lu par `sumSkillBuffs` (Task 1) ↔ alimenté par `cast` (Task 4) avec `until = turn + (d−1)`. `sk.duration = {min,max}` (Task 3) lu par `ActiveCard` et `cast` (Task 4). Cohérent.
