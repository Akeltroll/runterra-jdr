# Outil de campagne Runeterra — Plan d'implémentation (v1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer la maquette en outil de campagne temps réel partagé (Firebase RTDB + GitHub Pages) avec fatigue/eau éditables, modificateurs de stats, buffs appliqués au calcul, vue MJ live, identité et export/import.

**Architecture:** Front zéro-build (React + Babel via CDN) inchangé. Logique de jeu pure isolée dans `game-logic.js` (testable en Node + chargée en navigateur). État mutable par perso dans Firebase Realtime Database, synchro live via listeners. Règles du jeu restent dans `data.jsx`.

**Tech Stack:** React 18 (CDN), Babel standalone, Firebase compat SDK 10.x (CDN), Node `node:test` (tests dev uniquement).

---

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `game-logic.js` (NEW) | Fonctions pures : clamp, modificateurs, stats effectives, soins, seed. UMD (Node + window). |
| `test/game-logic.test.js` (NEW) | Tests unitaires `node:test`. |
| `firebase-config.js` (NEW) | Init Firebase + helpers `window.RTDB`. |
| `database.rules.json` (NEW) | Règles de sécurité RTDB (à coller dans la console). |
| `data-state.jsx` (NEW) | Hooks React : `useCharState`, `useAllCharStates`, `useIdentity`, seeding. |
| `data.jsx` (MOD) | Attache `modifiers` par défaut aux persos. |
| `components.jsx` (MOD) | `NumberStepper`, `IdentityModal`, `ExportImportPanel`. |
| `pages-sheet.jsx` (MOD) | Fatigue/eau éditables, modificateurs, stats effectives, HealPanel live. |
| `pages-mj.jsx` (MOD) | Tableau de bord temps réel. |
| `index.html` (MOD) | Scripts Firebase + game-logic, portail d'identité. |

---

## Task 1 : Module logique — clamp & jauges

**Files:**
- Create: `game-logic.js`
- Test: `test/game-logic.test.js`

- [ ] **Step 1: Écrire le test qui échoue**

```js
// test/game-logic.test.js
const test = require('node:test');
const assert = require('node:assert');
const L = require('../game-logic.js');

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
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `node --test test/game-logic.test.js`
Expected: FAIL (`Cannot find module '../game-logic.js'`)

- [ ] **Step 3: Implémentation minimale**

```js
// game-logic.js
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') Object.assign(window, api);
})(typeof self !== 'undefined' ? self : this, function () {
  const clamp = (v, min, max) => Math.max(min, Math.min(max, Math.round(v)));
  const clampGauge = (v) => clamp(v, 0, 5);
  return { clamp, clampGauge };
});
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `node --test test/game-logic.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add game-logic.js test/game-logic.test.js
git commit -m "feat(logic): clamp et clampGauge avec tests"
```

---

## Task 2 : Modificateurs par défaut + stats effectives

**Files:**
- Modify: `game-logic.js`
- Test: `test/game-logic.test.js`

- [ ] **Step 1: Ajouter les tests qui échouent**

```js
// Ajouter à test/game-logic.test.js
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
  // (100 + 10) * (1 + 0.5) = 165
  assert.equal(eff.ad, 165);
  // hp/mana = base + modificateur, jamais touché par les buffs
  assert.equal(eff.hp, 495);
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
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `node --test test/game-logic.test.js`
Expected: FAIL (`L.DEFAULT_MODIFIERS is undefined`)

- [ ] **Step 3: Implémentation**

```js
// Dans game-logic.js, AVANT le `return`, ajouter :
  const DEFAULT_MODIFIERS = {
    rathael: { ad: 10 },
    urskaar: { hp: 50 },
    smith:   { ad: 20, crit: 10 },
    lunick:  { ad: 20 },
    jett:    {},
  };

  // buff -> { stat: deltaAdditif }. Cas spéciaux gérés à part.
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

  function computeEffective(base, modifiers, activeBuffs) {
    modifiers = modifiers || {};
    activeBuffs = activeBuffs || [];
    const withMod = {};
    for (const k of Object.keys(base)) withMod[k] = base[k] + (modifiers[k] || 0);
    // somme additive des % par stat
    const pct = {};
    for (const id of activeBuffs) {
      const map = BUFF_STAT_MAP[id];
      if (!map) continue;
      for (const [stat, delta] of Object.entries(map)) pct[stat] = (pct[stat] || 0) + delta;
    }
    const eff = {};
    for (const k of Object.keys(withMod)) {
      // hp/mana non affectés par les buffs (cohérent Excel)
      if (k === 'hp' || k === 'mana') { eff[k] = withMod[k]; continue; }
      eff[k] = Math.round(withMod[k] * (1 + (pct[k] || 0)));
    }
    if (activeBuffs.includes('aiguisage')) eff.crit = (withMod.crit || 0) * 2;
    return eff;
  }
```

Puis ajouter au `return` : `DEFAULT_MODIFIERS, BUFF_STAT_MAP, computeEffective`.

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `node --test test/game-logic.test.js`
Expected: PASS (tous les tests)

- [ ] **Step 5: Commit**

```bash
git add game-logic.js test/game-logic.test.js
git commit -m "feat(logic): modificateurs par defaut et stats effectives"
```

---

## Task 3 : Soins modifiés + seed d'état + ratio→absolu

**Files:**
- Modify: `game-logic.js`
- Test: `test/game-logic.test.js`

- [ ] **Step 1: Tests qui échouent**

```js
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
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `node --test test/game-logic.test.js`
Expected: FAIL (`L.applyHealMods is undefined`)

- [ ] **Step 3: Implémentation**

```js
// Dans game-logic.js, avant le return :
  function applyHealMods(amount, activeBuffs) {
    activeBuffs = activeBuffs || [];
    let f = 1;
    if (activeBuffs.includes('miracule')) f += 0.5;
    if (activeBuffs.includes('hemorragie')) f -= 0.5;
    return Math.round(amount * f);
  }

  function buildDefaultState(char) {
    const arr = char.buffs || [];
    const buffs = {};
    for (const id of arr) buffs[id] = true;
    return {
      hpCur:  Math.round((char.hpCur || 0) * char.stats.hp),
      manaCur: Math.round((char.manaCur || 0) * char.stats.mana),
      shield: char.shieldCur || 0,
      fatigue: char.fatigue || 0,
      eau: char.eau || 0,
      buffs,
      modifiers: DEFAULT_MODIFIERS[char.id] || {},
    };
  }
```

Ajouter au `return` : `applyHealMods, buildDefaultState`.

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `node --test test/game-logic.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add game-logic.js test/game-logic.test.js
git commit -m "feat(logic): soins modifies et construction etat par defaut"
```

---

## Task 4 : Charger game-logic + brancher modificateurs dans data.jsx

**Files:**
- Modify: `index.html` (après le bloc hooks React, avant `data.jsx`)
- Modify: `data.jsx:110-113` (fonction `mkChar`)

- [ ] **Step 1: Ajouter le script dans index.html**

Juste après le `<script>` qui expose les hooks (`window.useState = ...`), AVANT `<script type="text/babel" src="data.jsx">` :

```html
<!-- Logique de jeu pure (testable en Node, chargée ici en global) -->
<script src="game-logic.js"></script>
```

- [ ] **Step 2: Brancher les modificateurs dans mkChar**

Remplacer `data.jsx:110-113` :

```js
function mkChar(o) {
  const stats = computeStats(o.F, o.H, o.M, o.C);
  const modifiers = (window.DEFAULT_MODIFIERS && window.DEFAULT_MODIFIERS[o.id]) || {};
  return { ...o, attrs:{ force:o.F, hab:o.H, mental:o.M, magie:o.C }, stats, modifiers };
}
```

- [ ] **Step 3: Vérifier en navigateur**

Servir le dossier : `npx serve -l 5050 .` puis ouvrir `http://localhost:5050/Chroniques%20de%20Runeterra.html`.
Console (F12) : `window.computeEffective` doit être une fonction, aucune erreur rouge.
Expected: page identique à avant, pas d'erreur console.

- [ ] **Step 4: Commit**

```bash
git add index.html data.jsx "Chroniques de Runeterra.html"
git commit -m "feat: charge game-logic et branche modificateurs sur les persos"
```

---

## Task 5 : Config Firebase + helpers RTDB + règles

**Files:**
- Create: `firebase-config.js`
- Create: `database.rules.json`
- Modify: `Chroniques de Runeterra.html` (scripts SDK, avant game-logic.js)

- [ ] **Step 1: Ajouter les SDK Firebase compat dans le HTML**

Avant `<script src="game-logic.js">` :

```html
<!-- Firebase (compat = objet global `firebase`, compatible zéro-build) -->
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js" crossorigin="anonymous"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js" crossorigin="anonymous"></script>
<script src="firebase-config.js"></script>
```

**Sécurité (SRI) :** comme les scripts React/Babel existants, ajouter `integrity="sha384-…"` aux deux balises Firebase. Calculer les empreintes à l'implémentation :
```bash
for f in firebase-app-compat.js firebase-database-compat.js; do
  echo -n "$f sha384-"; curl -s "https://www.gstatic.com/firebasejs/10.12.2/$f" | openssl dgst -sha384 -binary | openssl base64 -A; echo
done
```
Insérer chaque valeur dans l'attribut `integrity` correspondant.

- [ ] **Step 2: Créer firebase-config.js**

```js
// firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyDNJ5yLzA9ojTgTPS0j7MkHr5bJyTfpLVM",
  authDomain: "runeterra-jdr.firebaseapp.com",
  databaseURL: "https://runeterra-jdr-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "runeterra-jdr",
  storageBucket: "runeterra-jdr.firebasestorage.app",
  messagingSenderId: "789190754320",
  appId: "1:789190754320:web:843f535b5f652e28e98a95",
};
firebase.initializeApp(firebaseConfig);
const _db = firebase.database();

window.RTDB = {
  subscribePath(path, cb) {
    const ref = _db.ref(path);
    const handler = ref.on('value', (snap) => cb(snap.val()));
    return () => ref.off('value', handler);
  },
  updatePath(path, patch) { return _db.ref(path).update(patch); },
  setPath(path, value) { return _db.ref(path).set(value); },
  async getSnapshot(path) { const s = await _db.ref(path).get(); return s.val(); },
};
```

- [ ] **Step 3: Créer database.rules.json**

```json
{
  "rules": {
    "campaign": {
      "runeterra": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

- [ ] **Step 4: Vérifier la connexion**

Recharger la page. Console :
```js
window.RTDB.setPath('campaign/runeterra/_ping', Date.now()).then(()=>console.log('ok'));
```
Expected : `ok` affiché, et dans la console Firebase (Realtime Database) la valeur `_ping` apparaît sous `campaign/runeterra`.
Ensuite supprimer le ping : `window.RTDB.setPath('campaign/runeterra/_ping', null)`.

- [ ] **Step 5: Commit**

```bash
git add firebase-config.js database.rules.json "Chroniques de Runeterra.html"
git commit -m "feat: integration firebase rtdb et regles de securite"
```

---

## Task 6 : Hooks d'état + seeding (data-state.jsx)

**Files:**
- Create: `data-state.jsx`
- Modify: `Chroniques de Runeterra.html` (charger data-state.jsx après data.jsx)

- [ ] **Step 1: Créer data-state.jsx**

```jsx
/* État partagé temps réel (Firebase) + identité */
const CAMPAIGN = 'campaign/runeterra';

function charPath(id) { return `${CAMPAIGN}/characters/${id}/state`; }

/* Amorçage : si la campagne n'existe pas, écrit l'état par défaut des 5 persos. */
async function seedIfEmpty() {
  const existing = await window.RTDB.getSnapshot(`${CAMPAIGN}/characters`);
  if (existing) return;
  const all = {};
  for (const c of CHARACTERS) all[c.id] = { state: buildDefaultState(c) };
  await window.RTDB.setPath(`${CAMPAIGN}/characters`, all);
}

function useCharState(charId) {
  const [state, setState] = useState(null);
  useEffect(() => window.RTDB.subscribePath(charPath(charId), setState), [charId]);
  const setField  = useCallback((f, v) => window.RTDB.updatePath(charPath(charId), { [f]: v }), [charId]);
  const setBuff   = useCallback((id, on) => window.RTDB.updatePath(`${charPath(charId)}/buffs`, { [id]: on ? true : null }), [charId]);
  const setMod    = useCallback((stat, v) => window.RTDB.updatePath(`${charPath(charId)}/modifiers`, { [stat]: v || null }), [charId]);
  return { state, setField, setBuff, setMod };
}

function useAllCharStates() {
  const [all, setAll] = useState(null);
  useEffect(() => window.RTDB.subscribePath(`${CAMPAIGN}/characters`, setAll), []);
  return all; // { charId: { state: {...} } }
}

function useIdentity() {
  const [id, setId] = useState(() => localStorage.getItem('runeterra_identity') || null);
  const set = (v) => { localStorage.setItem('runeterra_identity', v); setId(v); };
  return [id, set];
}

Object.assign(window, { useCharState, useAllCharStates, useIdentity, seedIfEmpty, charPath, CAMPAIGN });
```

- [ ] **Step 2: Charger data-state.jsx dans le HTML**

Après `<script type="text/babel" src="data.jsx"></script>` :

```html
<script type="text/babel" src="data-state.jsx"></script>
```

- [ ] **Step 3: Appeler le seed au démarrage**

Dans le composant `App` (bloc shell du HTML), ajouter au début du corps :

```jsx
  useEffect(() => { seedIfEmpty(); }, []);
```

- [ ] **Step 4: Vérifier le seeding**

Recharger une fois. Dans la console Firebase, `campaign/runeterra/characters` doit contenir les 5 persos avec `state` (hpCur, manaCur, fatigue, eau, buffs, modifiers).
Expected : 5 entrées avec valeurs absolues (ex. rathael.state.hpCur = 495).

- [ ] **Step 5: Commit**

```bash
git add data-state.jsx "Chroniques de Runeterra.html"
git commit -m "feat: hooks etat temps reel et seeding firebase"
```

---

## Task 7 : Écran d'identité

**Files:**
- Modify: `components.jsx` (ajouter `IdentityModal`)
- Modify: `Chroniques de Runeterra.html` (App : portail d'identité)

- [ ] **Step 1: Ajouter IdentityModal dans components.jsx**

```jsx
function IdentityModal({ onPick }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(8,8,14,.92)', display:'grid', placeItems:'center', zIndex:1000 }}>
      <div className="panel" style={{ padding:'28px 32px', maxWidth:520, textAlign:'center' }}>
        <h2 style={{ marginBottom:6 }}>Qui es-tu ?</h2>
        <p className="dim" style={{ fontSize:13, marginBottom:18 }}>Choisis ton personnage (ou MJ). Modifiable plus tard.</p>
        <div className="row gap-2 wrap" style={{ justifyContent:'center', marginBottom:14 }}>
          {CHARACTERS.map(c => (
            <button key={c.id} className="btn btn-ghost" onClick={() => onPick(c.id)}>{c.name}</button>
          ))}
        </div>
        <button className="btn btn-gold" onClick={() => onPick('mj')}>🎲 Je suis le MJ</button>
      </div>
    </div>
  );
}
Object.assign(window, { IdentityModal });
```

- [ ] **Step 2: Brancher dans App**

Dans `App`, après les hooks existants :

```jsx
  const [identity, setIdentity] = useIdentity();
```

Et juste après l'ouverture de `<ToastProvider>` :

```jsx
      {!identity && <IdentityModal onPick={setIdentity} />}
```

Faire pointer la route par défaut : si `identity === 'mj'` → `'mj'`, sinon `'sheet'`. Remplacer l'init de route :

```jsx
  const [route, _setRoute] = useState(() => localStorage.getItem('runeterra_route') || (localStorage.getItem('runeterra_identity') === 'mj' ? 'mj' : 'sheet'));
```

- [ ] **Step 3: Vérifier**

Vider le localStorage (`localStorage.clear()` en console) puis recharger : la modale apparaît. Choisir un perso → la modale disparaît, on arrive sur la fiche.
Expected : choix mémorisé au rechargement (plus de modale).

- [ ] **Step 4: Commit**

```bash
git add components.jsx "Chroniques de Runeterra.html"
git commit -m "feat: ecran d identite (joueur / MJ)"
```

---

## Task 8 : Fatigue & Eau éditables (le cœur de la demande)

**Files:**
- Modify: `components.jsx` (ajouter `NumberStepper`)
- Modify: `pages-sheet.jsx` (CombatColumn + SheetBody pour passer l'état)

- [ ] **Step 1: Ajouter NumberStepper dans components.jsx**

```jsx
function NumberStepper({ label, value, color, min = 0, max = 5, onChange }) {
  const v = value == null ? 0 : value;
  return (
    <div className="panel" style={{ padding:'12px 14px', flex:1, background:'var(--bg-inset)' }}>
      <div className="overline" style={{ marginBottom:8 }}>{label}</div>
      <div className="row gap-1" style={{ marginBottom:8 }}>
        {Array.from({ length: max }).map((_, i) => (
          <div key={i} style={{ flex:1, height:10, borderRadius:3, background: i < v ? color : 'var(--bg-panel-2)', border:'1px solid var(--line)' }}></div>
        ))}
      </div>
      <div className="row gap-2" style={{ justifyContent:'space-between', alignItems:'center' }}>
        <button className="btn btn-sm btn-ghost" onClick={() => onChange(clampGauge(v - 1))} disabled={v <= min}>−</button>
        <span className="mono" style={{ fontSize:14, color:'var(--gold-pale)' }}>{v} / {max}</span>
        <button className="btn btn-sm btn-ghost" onClick={() => onChange(clampGauge(v + 1))} disabled={v >= max}>+</button>
        <button className="btn btn-sm btn-ghost" onClick={() => onChange(0)} title="Remettre à zéro">↺</button>
      </div>
    </div>
  );
}
Object.assign(window, { NumberStepper });
```

- [ ] **Step 2: Remplacer le bloc "Ressources de survie" dans CombatColumn**

`pages-sheet.jsx:220-226`. CombatColumn reçoit déjà l'état ; ajouter `fatigue, eau, setField` à ses props (voir Step 3). Remplacer le panneau :

```jsx
      <div className="panel">
        <div className="panel-head"><h3>Ressources de survie</h3><span className="overline">temps réel</span></div>
        <div className="row gap-3" style={{ padding:'16px' }}>
          <NumberStepper label="Fatigue" value={fatigue} color="var(--debuff)" onChange={(v) => setField('fatigue', v)} />
          <NumberStepper label="Eau" value={eau} color="var(--mana-bright)" onChange={(v) => setField('eau', v)} />
        </div>
      </div>
```

Et supprimer la fonction locale `counter` devenue inutile dans CombatColumn.

- [ ] **Step 3: Câbler l'état Firebase dans SheetBody**

Remplacer le corps de `SheetBody` (`pages-sheet.jsx:280-313`) pour utiliser `useCharState` au lieu des `useState` locaux dérivés des ratios :

```jsx
function SheetBody({ char, variant }) {
  const [modal, setModal] = useState(false);
  const { state, setField, setBuff, setMod } = useCharState(char.id);
  if (!state) return <div style={{ padding:40 }} className="dim">Chargement…</div>;
  const hp = state.hpCur, mana = state.manaCur, shield = state.shield;
  const setHp     = (v) => setField('hpCur',  typeof v === 'function' ? v(hp) : v);
  const setMana   = (v) => setField('manaCur', typeof v === 'function' ? v(mana) : v);
  const setShield = (v) => setField('shield',  typeof v === 'function' ? v(shield) : v);
  const activeBuffs = Object.keys(state.buffs || {});
  const eff = computeEffective(char.stats, state.modifiers, activeBuffs);
  return (
    <div style={{ padding:'20px 24px' }}>
      <div style={{ display:'grid', gridTemplateColumns:'minmax(300px,1fr) minmax(300px,1fr) minmax(320px,1.05fr)', gap:20, alignItems:'start' }} className="sheet-grid">
        <div className="col gap-5">
          <div className="panel">
            <div className="panel-head"><h3>Vitalité</h3>
              <span className="overline">{variant === 'a' ? 'Tablettes' : variant === 'b' ? 'Hextech' : 'Codex'}</span>
            </div>
            <div style={{ padding:'16px' }}><ResourceStack char={char} eff={eff} variant={variant} hp={hp} mana={mana} shield={shield} /></div>
          </div>
          <div className="panel">
            <div className="panel-head"><h3>Statistiques</h3></div>
            <div style={{ padding:'16px' }}><SecondaryStats stats={eff} variant={variant} /></div>
          </div>
        </div>
        <CombatColumn char={char} onAttack={() => setModal(true)}
          hp={hp} setHp={setHp} mana={mana} setMana={setMana} shield={shield} setShield={setShield}
          fatigue={state.fatigue} eau={state.eau} setField={setField} activeBuffs={activeBuffs} />
        <BuffInvColumn char={char} activeBuffs={activeBuffs} setBuff={setBuff} setMod={setMod} modifiers={state.modifiers} />
      </div>
      {modal && <AttackModal char={char} onClose={() => setModal(false)} />}
    </div>
  );
}
```

Mettre à jour la signature de `CombatColumn` (`pages-sheet.jsx:155`) :

```jsx
function CombatColumn({ char, onAttack, hp, setHp, mana, setMana, shield, setShield, fatigue, eau, setField, activeBuffs }) {
```

`ResourceStack` doit utiliser `eff.hp`/`eff.mana` pour les max. Modifier ses usages de `char.stats.hp`→`eff.hp`, `char.stats.mana`→`eff.mana` (le bouclier garde `char.shieldMax`).

- [ ] **Step 4: Vérifier en deux onglets**

`npx serve -l 5050 .`, ouvrir la fiche dans deux onglets. Cliquer +/− sur Fatigue dans l'onglet 1.
Expected : la jauge bouge **dans les deux onglets** quasi instantanément.

- [ ] **Step 5: Commit**

```bash
git add components.jsx pages-sheet.jsx
git commit -m "feat: fatigue et eau editables, fiche branchee sur l etat temps reel"
```

---

## Task 9 : Stats effectives + éditeur de modificateurs

**Files:**
- Modify: `pages-sheet.jsx` (BuffInvColumn : buffs live + panneau modificateurs)

- [ ] **Step 1: Mettre BuffInvColumn sur l'état partagé**

Remplacer la signature et la gestion des buffs (`pages-sheet.jsx:103-129`) :

```jsx
function BuffInvColumn({ char, activeBuffs, setBuff, setMod, modifiers }) {
  const toast = useToast();
  const active = new Set(activeBuffs);
  const toggle = (b) => {
    const on = !active.has(b.id);
    setBuff(b.id, on);
    if (on) toast(`<b>${char.name}</b> — ${b.name} ${b.type === 'buff' ? 'activé' : 'subi'}`, b.type);
  };
  const cats = ['Équipement', 'Consommables', 'Butin'];
  const MOD_STATS = [['hp','HP'],['mana','Mana'],['ad','AD'],['ap','AP'],['armure','Armure'],['resmag','Rés.Mag'],['crit','%Crit'],['dcrit','%D.Crit'],['sapience','Sapience']];
```

(Le reste du JSX de la liste des buffs reste identique : `on={active.has(b.id)} onToggle={() => toggle(b)}`.)

- [ ] **Step 2: Ajouter le panneau "Modificateurs" avant l'inventaire**

Juste avant le `<div className="panel">` de l'inventaire :

```jsx
      <div className="panel">
        <div className="panel-head"><h3>Modificateurs</h3><span className="overline">ajustements MJ</span></div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, padding:'14px 16px' }}>
          {MOD_STATS.map(([k, lbl]) => (
            <label key={k} className="col" style={{ gap:3 }}>
              <span className="overline" style={{ fontSize:9 }}>{lbl}</span>
              <input type="number" value={(modifiers && modifiers[k]) || 0}
                onChange={(e) => setMod(k, parseInt(e.target.value) || 0)}
                style={{ background:'var(--bg-inset)', color:'var(--gold-pale)', border:'1px solid var(--line-strong)', borderRadius:6, padding:'5px 8px', fontFamily:'var(--font-mono)', fontSize:12, textAlign:'right', width:'100%' }} />
            </label>
          ))}
        </div>
      </div>
```

- [ ] **Step 3: Vérifier**

Activer "Bravoure" → l'AD affiché doit augmenter de 50% (vérifier la valeur dans "Statistiques"). Changer un modificateur AD → la valeur et l'effectif suivent, et le second onglet se met à jour.
Expected : stats effectives correctes, synchro live.

- [ ] **Step 4: Commit**

```bash
git add pages-sheet.jsx
git commit -m "feat: buffs appliques au calcul et editeur de modificateurs"
```

---

## Task 10 : HealPanel branché Firebase + soins modifiés

**Files:**
- Modify: `pages-sheet.jsx` (HealPanel)

- [ ] **Step 1: Appliquer les soins/bouclier modifiés**

Dans `HealPanel` (`pages-sheet.jsx:232-277`), ajouter `activeBuffs` aux props et appliquer `applyHealMods` aux gains de soin/bouclier/potion (pas aux dégâts ni au mana) :

```jsx
function HealPanel({ char, hp, setHp, mana, setMana, shield, setShield, activeBuffs }) {
  const toast = useToast();
  const maxHp = char.stats.hp, maxMana = char.stats.mana, maxShield = char.shieldMax;
  const [amt, setAmt] = useState(50);
  const clampV = (v, m) => Math.max(0, Math.min(m, Math.round(v)));
  const potHp = Math.round(15 + maxHp * 0.15);
  const potMana = Math.round(10 + maxMana * 0.10);
  const usePotionHp   = () => { const g = applyHealMods(potHp, activeBuffs); setHp(h => clampV(h + g, maxHp)); toast(`<b>${char.name}</b> Potion de soin · +${g} PV`, 'buff'); };
  const usePotionMana = () => { setMana(v => clampV(v + potMana, maxMana)); toast(`<b>${char.name}</b> Potion de mana · +${potMana}`, 'gold'); };
  const healHp    = () => { const g = applyHealMods(amt, activeBuffs); setHp(h => clampV(h + g, maxHp)); toast(`<b>${char.name}</b> reçoit ${g} soins`, 'buff'); };
  const dmgHp     = () => { setHp(h => clampV(h - amt, maxHp)); toast(`<b>${char.name}</b> subit ${amt} dégâts`, 'debuff'); };
  const addShield = () => { const g = applyHealMods(amt, activeBuffs); setShield(s => clampV(s + g, maxShield)); toast(`<b>${char.name}</b> gagne ${g} bouclier`, 'gold'); };
  const recupMana = () => { setMana(v => clampV(v + amt, maxMana)); toast(`<b>${char.name}</b> récupère ${amt} mana`, 'gold'); };
```

(Le JSX du panneau reste inchangé en dessous.)

- [ ] **Step 2: Passer activeBuffs à HealPanel**

Dans `CombatColumn`, où `<HealPanel ... />` est rendu, ajouter `activeBuffs={activeBuffs}`.

- [ ] **Step 3: Vérifier**

Avec Miraculé actif, "Soigner 50" doit ajouter 75. Sans buff, +50. Le second onglet reflète les PV.
Expected : soins modifiés corrects + synchro.

- [ ] **Step 4: Commit**

```bash
git add pages-sheet.jsx
git commit -m "feat: soins et boucliers modifies par miracule/hemorragie, live"
```

---

## Task 11 : Vue MJ temps réel

**Files:**
- Modify: `pages-mj.jsx`

- [ ] **Step 1: Lire l'état live et l'afficher**

Au début du composant principal de `pages-mj.jsx`, remplacer les valeurs statiques par :

```jsx
  const all = useAllCharStates();
```

Pour chaque perso `c` de `CHARACTERS`, lire `const st = (all && all[c.id] && all[c.id].state) || null;` et afficher, si `st` :
- PV : `st.hpCur` / `computeEffective(c.stats, st.modifiers, Object.keys(st.buffs||{})).hp`
- Mana, Bouclier (`st.shield` / `c.shieldMax`)
- Fatigue `st.fatigue`/5, Eau `st.eau`/5
- pastilles des buffs actifs `Object.keys(st.buffs||{})`

Réutiliser `ResourceBar` (components.jsx) pour les barres. Garder la mise en page existante des cartes perso, en remplaçant seulement les sources de données.

- [ ] **Step 2: Vérifier**

Ouvrir la vue MJ dans un onglet, une fiche joueur dans un autre. Modifier PV/fatigue côté joueur.
Expected : la carte du perso se met à jour live dans la vue MJ.

- [ ] **Step 3: Commit**

```bash
git add pages-mj.jsx
git commit -m "feat: vue MJ tableau de bord temps reel"
```

---

## Task 12 : Export / Import JSON

**Files:**
- Modify: `components.jsx` (ExportImportPanel)
- Modify: `pages-mj.jsx` (intégrer le panneau dans la vue MJ)

- [ ] **Step 1: Ajouter ExportImportPanel dans components.jsx**

```jsx
function ExportImportPanel() {
  const toast = useToast();
  const doExport = async () => {
    const data = await window.RTDB.getSnapshot(CAMPAIGN);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `runeterra-sauvegarde-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    toast('Sauvegarde exportée', 'gold');
  };
  const doImport = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (!confirm('Remplacer tout l état actuel par cette sauvegarde ?')) return;
      await window.RTDB.setPath(CAMPAIGN, JSON.parse(reader.result));
      toast('Sauvegarde importée', 'buff');
    };
    reader.readAsText(file);
  };
  return (
    <div className="row gap-2 wrap">
      <button className="btn btn-sm btn-ghost" onClick={doExport}>⬇ Exporter</button>
      <label className="btn btn-sm btn-ghost" style={{ cursor:'pointer' }}>
        ⬆ Importer<input type="file" accept="application/json" onChange={doImport} style={{ display:'none' }} />
      </label>
    </div>
  );
}
Object.assign(window, { ExportImportPanel });
```

- [ ] **Step 2: Placer le panneau dans la vue MJ**

Dans `pages-mj.jsx`, dans l'en-tête de la page, ajouter `<ExportImportPanel />`.

- [ ] **Step 3: Vérifier**

Cliquer Exporter → un fichier JSON est téléchargé avec les 5 persos. Modifier une valeur, puis Importer ce fichier → l'état revient à la sauvegarde (visible live).
Expected : export/import fonctionnels.

- [ ] **Step 4: Commit**

```bash
git add components.jsx pages-mj.jsx
git commit -m "feat: export et import JSON de la sauvegarde"
```

---

## Task 13 : Déploiement GitHub Pages + règles RTDB

**Files:** aucun fichier code ; étapes de mise en ligne.

- [ ] **Step 1: Créer .gitignore et README minimal**

```bash
printf "node_modules/\n*.log\n.DS_Store\n" > .gitignore
```

- [ ] **Step 2: Initialiser et pousser**

```bash
git init
git add -A
git commit -m "feat: outil de campagne Runeterra v1 (temps reel)"
git remote add origin https://github.com/Akeltroll/runterra-jdr.git
git branch -M main
git push -u origin main
```

- [ ] **Step 3: Activer GitHub Pages**

Repo → Settings → Pages → Source : *Deploy from a branch* → `main` / `/ (root)` → Save.
Renommer `Chroniques de Runeterra.html` en `index.html` (Pages sert `index.html` par défaut). Mettre à jour le commit.
Expected : site accessible sur `https://akeltroll.github.io/runterra-jdr/`.

- [ ] **Step 4: Appliquer les règles RTDB**

Console Firebase → Realtime Database → onglet **Règles** → coller le contenu de `database.rules.json` → Publier.
Expected : lecture/écriture limitées à `campaign/runeterra`.

- [ ] **Step 5: Test final à deux**

Ouvrir l'URL en ligne sur deux appareils, choisir des identités différentes, modifier des jauges.
Expected : synchro temps réel entre appareils.

---

## Notes d'exécution
- `index.html` est le nom cible final ; pendant le dev le fichier s'appelle encore `Chroniques de Runeterra.html`. Le renommage se fait en Task 13 (Step 3) — adapter les commandes `git add` en conséquence.
- Tests : seuls Tasks 1–3 sont en TDD strict (logique pure). Le reste se vérifie en navigateur (deux onglets) car cela dépend de Firebase + DOM.
