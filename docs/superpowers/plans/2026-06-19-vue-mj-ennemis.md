# Vue MJ + gestion des ennemis (v1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner au MJ une vue d'ensemble sans scroll horizontal et un suivi des ennemis en combat (HP/mana locaux, application des dégâts dans les deux sens).

**Architecture:** Logique de combat pure et testée dans `game-logic.js` (reproduit le moteur Excel). Ennemis stockés en `localStorage` (zéro Firebase). UI dans `pages-mj.jsx` : grille responsive + section Ennemis + modal d'attaque qui écrit les HP du joueur ciblé dans Firebase (droits staff déjà en place).

**Tech Stack:** React 18 + Babel standalone (zéro build), Firebase RTDB compat, `node --test` pour la logique pure.

## Global Constraints

- **Zéro build** : chaque `.js`/`.jsx` définit localement puis `Object.assign(window, {...})`. Références nues résolues via `window`.
- **Mitigation = moteur Excel** (`info-mj/Codes App Script.md`) : `réduction = max(0, AR−léthalité)/(max(0, AR−léthalité)+120)`, `dégâtsFinaux = ceil(dégâts × (1−réduction))`. L'armure réduit **avant** le bouclier. `brut` = aucune réduction.
- **Bouclier puis HP** : le bouclier absorbe d'abord ; excédent aux HP ; KO si HP atteint 0.
- **Ennemis = `localStorage`** (clé `runeterra_mj_enemies`), aucun accès Firebase, aucune règle RTDB à republier.
- Écriture des HP joueur via `window.RTDB.updatePath(charPath(charId), { hpCur, shield })` (`charPath` et `CAMPAIGN` sont exposés sur `window`).
- Toasts : `const toast = useToast(); toast('<b>…</b>', 'gold'|'buff'|'debuff')` (seul `<b>` autorisé).

---

### Task 1 : Logique de combat pure (`game-logic.js`)

**Files:**
- Modify: `game-logic.js` (ajout des fonctions avant le `return { ... }` final, + ajout aux exports)
- Test: `test/game-logic.test.js`

**Interfaces:**
- Produces:
  - `mitigateDamage(raw, type, defense, lethalite=0) -> number` (entier). `type ∈ {'physique','magique','brut'}`. `defense = { armure, resmag }`.
  - `applyDamageToPools(pools, degats) -> { hpCur, shield, ko }`. `pools = { hpCur, shield }`.

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter en fin de `test/game-logic.test.js` (le fichier importe déjà `require('../game-logic.js')` — réutiliser le même destructuring ou en ajouter un) :

```js
const { mitigateDamage, applyDamageToPools } = require('../game-logic.js');

test('mitigateDamage — physique : AR/(AR+120)', () => {
  // AR=120 → réduction 0.5 → ceil(100*0.5)=50
  assert.equal(mitigateDamage(100, 'physique', { armure: 120 }), 50);
});

test('mitigateDamage — magique utilise resmag', () => {
  assert.equal(mitigateDamage(100, 'magique', { resmag: 120 }), 50);
});

test('mitigateDamage — brut ignore toute défense', () => {
  assert.equal(mitigateDamage(100, 'brut', { armure: 999, resmag: 999 }), 100);
});

test('mitigateDamage — léthalité réduit l\'armure sans passer sous 0', () => {
  // armure 50, léthalité 80 → AR efficace 0 → aucune réduction
  assert.equal(mitigateDamage(100, 'physique', { armure: 50 }, 80), 100);
});

test('mitigateDamage — armure 0 = dégâts pleins', () => {
  assert.equal(mitigateDamage(40, 'physique', { armure: 0 }), 40);
});

test('applyDamageToPools — bouclier absorbe tout, HP intacts', () => {
  assert.deepEqual(applyDamageToPools({ hpCur: 100, shield: 30 }, 20),
    { hpCur: 100, shield: 10, ko: false });
});

test('applyDamageToPools — excédent passe aux HP, bouclier à 0', () => {
  assert.deepEqual(applyDamageToPools({ hpCur: 100, shield: 30 }, 50),
    { hpCur: 80, shield: 0, ko: false });
});

test('applyDamageToPools — sans bouclier', () => {
  assert.deepEqual(applyDamageToPools({ hpCur: 100, shield: 0 }, 40),
    { hpCur: 60, shield: 0, ko: false });
});

test('applyDamageToPools — KO si dégâts >= HP', () => {
  assert.deepEqual(applyDamageToPools({ hpCur: 40, shield: 0 }, 40),
    { hpCur: 0, shield: 0, ko: true });
});
```

> Note : si `assert` et `test` sont déjà importés en tête du fichier, ne pas réimporter — ajouter seulement le `const { mitigateDamage, applyDamageToPools } = require('../game-logic.js');` (ou compléter le destructuring existant).

- [ ] **Step 2 : Lancer les tests, vérifier l'échec**

Run: `node --test test/game-logic.test.js`
Expected: FAIL (`mitigateDamage is not a function`).

- [ ] **Step 3 : Implémenter dans `game-logic.js`**

Juste avant le `return { ... };` final, ajouter :

```js
  /* --- Combat (vue MJ ennemis) : reproduit le moteur Excel (Codes App Script) --- */
  // Mitigation par armure / résistance magique. type ∈ {'physique','magique','brut'}.
  // La léthalité réduit l'AR/RM prise en compte, sans passer sous 0. brut = aucune réduction.
  function mitigateDamage(raw, type, defense, lethalite) {
    const dmg = Math.max(0, Number(raw) || 0);
    const leth = Math.max(0, Number(lethalite) || 0);
    let stat;
    if (type === 'physique') stat = Number((defense && defense.armure) || 0);
    else if (type === 'magique') stat = Number((defense && defense.resmag) || 0);
    else return dmg; // brut (ou type inconnu) : pas de mitigation
    const eff = Math.max(0, stat - leth);
    const reduction = eff / (eff + 120);
    return Math.ceil(dmg * (1 - reduction));
  }

  // Applique des dégâts DÉJÀ mitigés : bouclier d'abord, puis HP. KO si HP atteint 0.
  function applyDamageToPools(pools, degats) {
    const hpCur = Math.max(0, Number((pools && pools.hpCur) || 0));
    let shield = Math.max(0, Number((pools && pools.shield) || 0));
    let d = Math.max(0, Number(degats) || 0);
    if (shield > 0) {
      if (d <= shield) return { hpCur, shield: shield - d, ko: false };
      d -= shield; shield = 0;
    }
    if (d >= hpCur) return { hpCur: 0, shield, ko: true };
    return { hpCur: hpCur - d, shield, ko: false };
  }
```

Puis ajouter `mitigateDamage, applyDamageToPools` à l'objet du `return` final (sur la ligne des exports).

- [ ] **Step 4 : Lancer les tests, vérifier le succès**

Run: `node --test test/game-logic.test.js`
Expected: PASS (tous les tests, anciens + 9 nouveaux).

- [ ] **Step 5 : Commit**

```bash
git add game-logic.js test/game-logic.test.js
git commit -m "feat(combat): mitigateDamage + applyDamageToPools (moteur Excel, testés)"
```

---

### Task 2 : Grille responsive (fin du scroll horizontal)

**Files:**
- Modify: `pages-mj.jsx` (`MJPage` zone principale + `MJCompactCard` largeur + sous-titre en-tête)

**Interfaces:**
- Consumes: rien de nouveau.
- Produces: rien (changement visuel interne).

- [ ] **Step 1 : Passer la liste des cartes en grille**

Dans `MJPage`, remplacer :

```jsx
        <div style={{ flex:1, overflow:'auto', padding:24 }}>
          <div className="row gap-4" style={{ alignItems:'stretch', minWidth:'min-content', paddingBottom:8 }}>
            {CHARACTERS.map(c => <MJCompactCard key={c.id} c={c} st={stOf(c.id)} onFull={() => setFull(c)} />)}
          </div>
        </div>
```

par :

```jsx
        <div style={{ flex:1, overflow:'auto', padding:24 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:16, alignItems:'start', paddingBottom:8 }}>
            {CHARACTERS.map(c => <MJCompactCard key={c.id} c={c} st={stOf(c.id)} onFull={() => setFull(c)} />)}
          </div>
        </div>
```

- [ ] **Step 2 : Rendre `MJCompactCard` flexible en largeur**

Dans `MJCompactCard`, remplacer l'ouverture du panel :

```jsx
    <div className="panel" style={{ width:300, flex:'none', display:'flex', flexDirection:'column',
      borderColor: danger ? 'rgba(200,48,42,.45)' : 'var(--line)' }}>
```

par (suppression de `width:300, flex:'none'`) :

```jsx
    <div className="panel" style={{ display:'flex', flexDirection:'column',
      borderColor: danger ? 'rgba(200,48,42,.45)' : 'var(--line)' }}>
```

- [ ] **Step 3 : Retirer la mention de scroll horizontal**

Dans l'en-tête de `MJPage`, remplacer :

```jsx
            <span className="faint" style={{ fontSize:12 }}>Vue d'ensemble temps réel — faites défiler horizontalement</span>
```

par :

```jsx
            <span className="faint" style={{ fontSize:12 }}>Vue d'ensemble temps réel</span>
```

- [ ] **Step 4 : Vérification syntaxe**

Run: `npx esbuild pages-mj.jsx >/dev/null`
Expected: aucune erreur.

- [ ] **Step 5 : Commit**

```bash
git add pages-mj.jsx
git commit -m "feat(mj): grille responsive des cartes joueurs (fin du scroll horizontal)"
```

---

### Task 3 : Ennemis — état local, cartes, édition & « Subir »

**Files:**
- Modify: `pages-mj.jsx` (helpers ennemis + hook `useMJEnemies` + `EnemyCard` + section dans `MJPage`)

**Interfaces:**
- Consumes: `useState` (global React), `ResourceBar` (composant global), `CHARACTERS`.
- Produces (utilisés par Task 4) :
  - `useMJEnemies() -> { enemies, addEnemy(name?), updateEnemy(id, patch), removeEnemy(id) }`
  - `EnemyCard({ enemy, onUpdate, onRemove, onAttack })` (appelle `onAttack(enemy)` au clic « Attaque »).

- [ ] **Step 1 : Helpers + hook localStorage**

En haut de `pages-mj.jsx` (après le bloc de commentaire d'en-tête, avant `function mjLive`), ajouter :

```jsx
/* --- Ennemis (local au MJ, localStorage — zéro Firebase) --- */
// Style de champ (le projet n'a pas de classe CSS d'input ; cf. InvItemRow).
const ENEMY_FLD = { background:'var(--bg-inset)', color:'var(--ink)', border:'1px solid var(--line-strong)', borderRadius:6, padding:'5px 8px', fontSize:12, width:'100%', boxSizing:'border-box' };
const ENEMIES_KEY = 'runeterra_mj_enemies';
let _enemySeq = 0;
function newEnemyId() { return 'enemy_' + Date.now().toString(36) + '_' + (_enemySeq++); }
function makeEnemy(name) {
  return { id: newEnemyId(), name: name || 'Ennemi', hpCur: 100, hpMax: 100, manaCur: 0, manaMax: 0, atk: 10 };
}
function loadEnemies() {
  try { const a = JSON.parse(localStorage.getItem(ENEMIES_KEY) || '[]'); return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}
function useMJEnemies() {
  const [enemies, setEnemies] = useState(loadEnemies);
  const persist = (next) => { setEnemies(next); try { localStorage.setItem(ENEMIES_KEY, JSON.stringify(next)); } catch (e) {} };
  const addEnemy = (name) => persist([...enemies, makeEnemy(name)]);
  const updateEnemy = (id, patch) => persist(enemies.map(e => e.id === id ? { ...e, ...patch } : e));
  const removeEnemy = (id) => persist(enemies.filter(e => e.id !== id));
  return { enemies, addEnemy, updateEnemy, removeEnemy };
}
```

- [ ] **Step 2 : Composant `EnemyCard`**

Ajouter, avant `function MJPage` :

```jsx
function EnemyCard({ enemy, onUpdate, onRemove, onAttack }) {
  const [edit, setEdit] = useState(false);
  const [subir, setSubir] = useState('');
  const danger = enemy.hpMax > 0 && (enemy.hpCur / enemy.hpMax) * 100 < 40;
  const num = (v) => Math.max(0, parseInt(v, 10) || 0);
  const applySubir = () => {
    const n = num(subir);
    if (n <= 0) return;
    onUpdate(enemy.id, { hpCur: Math.max(0, enemy.hpCur - n) });
    setSubir('');
  };

  if (edit) {
    const field = (label, key, full) => (
      <label className="col" style={{ gap:4, flex: full ? '1 1 100%' : '1 1 45%' }}>
        <span className="overline">{label}</span>
        <input style={ENEMY_FLD} defaultValue={enemy[key]}
          onChange={e => onUpdate(enemy.id, { [key]: key === 'name' ? e.target.value : num(e.target.value) })} />
      </label>
    );
    return (
      <div className="panel" style={{ display:'flex', flexDirection:'column', gap:10, padding:14 }}>
        <div className="row wrap gap-2">
          {field('Nom', 'name', true)}
          {field('HP actuels', 'hpCur')}
          {field('HP max', 'hpMax')}
          {field('Mana actuel', 'manaCur')}
          {field('Mana max', 'manaMax')}
          {field('Dégât d\'attaque', 'atk')}
        </div>
        <div className="row gap-2" style={{ justifyContent:'flex-end' }}>
          <button className="btn btn-sm btn-ghost" onClick={() => onRemove(enemy.id)} style={{ marginRight:'auto', color:'var(--debuff-bright)' }}>Supprimer</button>
          <button className="btn btn-sm btn-gold" onClick={() => setEdit(false)}>OK</button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel" style={{ display:'flex', flexDirection:'column',
      borderColor: danger ? 'rgba(200,48,42,.45)' : 'var(--line)' }}>
      <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontFamily:'var(--font-display)', fontSize:15, color:'var(--gold-pale)', flex:1, minWidth:0 }}>{enemy.name}</span>
        <button className="btn btn-sm btn-ghost" onClick={() => setEdit(true)} title="Éditer" style={{ padding:'4px 8px' }}>✎</button>
      </div>
      <div className="col gap-2" style={{ padding:'12px 14px' }}>
        <ResourceBar kind="hp" cur={enemy.hpCur} max={enemy.hpMax} />
        {enemy.manaMax > 0 && <ResourceBar kind="mana" cur={enemy.manaCur} max={enemy.manaMax} />}
      </div>
      <div className="row gap-2" style={{ padding:'0 14px 14px', alignItems:'center' }}>
        <button className="btn btn-sm btn-gold" onClick={() => onAttack(enemy)} style={{ whiteSpace:'nowrap' }}>⚔ Attaque</button>
        <input placeholder="Subir…" value={subir}
          onChange={e => setSubir(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') applySubir(); }}
          style={{ ...ENEMY_FLD, width:70 }} />
        <button className="btn btn-sm btn-ghost" onClick={applySubir} title="Appliquer les dégâts subis">🛡</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3 : Brancher la section Ennemis dans `MJPage`**

Dans `MJPage`, ajouter le hook avec les autres états :

```jsx
  const { enemies, addEnemy, updateEnemy, removeEnemy } = useMJEnemies();
  const [attacker, setAttacker] = useState(null); // ennemi en cours d'attaque (Task 4)
```

Puis, dans la zone principale, **après** la `<div>` de la grille des cartes joueurs et **avant** la fermeture de `</div>` du conteneur scrollable (`flex:1, overflow:'auto'`), ajouter la section :

```jsx
          <div style={{ marginTop:28 }}>
            <div className="row" style={{ justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <h3 style={{ fontSize:16 }}>Ennemis <span className="mono faint" style={{ fontSize:12 }}>· {enemies.length}</span></h3>
              <button className="btn btn-sm btn-gold" onClick={() => addEnemy()}>+ Ajouter un ennemi</button>
            </div>
            {enemies.length === 0
              ? <div className="faint" style={{ fontSize:12 }}>Aucun ennemi. Ajoutez-en un pour suivre ses HP en combat.</div>
              : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:16, alignItems:'start' }}>
                  {enemies.map(e => (
                    <EnemyCard key={e.id} enemy={e} onUpdate={updateEnemy} onRemove={removeEnemy} onAttack={setAttacker} />
                  ))}
                </div>}
          </div>
```

> `setAttacker` sera consommé par le modal d'attaque en Task 4. Pour cette task, le clic « ⚔ Attaque » ne fait encore rien de visible (state posé) — c'est attendu.

- [ ] **Step 4 : Vérification syntaxe**

Run: `npx esbuild pages-mj.jsx >/dev/null`
Expected: aucune erreur.

- [ ] **Step 5 : Commit**

```bash
git add pages-mj.jsx
git commit -m "feat(mj): ennemis locaux (localStorage) — cartes, édition, dégâts subis"
```

---

### Task 4 : Modal d'attaque ennemi → joueur (écrit les HP en Firebase)

**Files:**
- Modify: `pages-mj.jsx` (composant `EnemyAttackModal` + rendu conditionnel dans `MJPage`)

**Interfaces:**
- Consumes: `mitigateDamage`, `applyDamageToPools` (Task 1) ; `mjLive` ; `useToast` ; `charPath` ; `CHARACTERS` ; `attacker`/`setAttacker` et `ENEMY_FLD` (Task 3).
- Produces: boucle de combat complète.

- [ ] **Step 1 : Composant `EnemyAttackModal`**

Ajouter, avant `function MJPage` :

```jsx
function EnemyAttackModal({ enemy, stOf, onClose }) {
  const toast = useToast();
  const [amount, setAmount] = useState(String(enemy.atk || 0));
  const [type, setType] = useState('physique');
  const [targetId, setTargetId] = useState(CHARACTERS[0] ? CHARACTERS[0].id : '');

  const submit = () => {
    const raw = Math.max(0, parseInt(amount, 10) || 0);
    const c = CHARACTERS.find(x => x.id === targetId);
    if (!c || raw <= 0) { onClose(); return; }
    const L = mjLive(c, stOf(c.id));
    const degats = mitigateDamage(raw, type, { armure: L.eff.armure, resmag: L.eff.resmag });
    const res = applyDamageToPools({ hpCur: L.hp, shield: L.shield }, degats);
    window.RTDB.updatePath(charPath(c.id), { hpCur: res.hpCur, shield: res.shield });
    toast(`<b>${enemy.name}</b> inflige <b>${degats}</b> (${type}) à <b>${c.name}</b>${res.ko ? ' — KO !' : ''}`,
      res.ko ? 'debuff' : 'gold');
    onClose();
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="panel" onClick={e => e.stopPropagation()} style={{ width:'min(420px,100%)', padding:18, display:'flex', flexDirection:'column', gap:14 }}>
        <h3 style={{ fontSize:17 }}>Attaque — {enemy.name}</h3>
        <label className="col" style={{ gap:4 }}>
          <span className="overline">Dégâts</span>
          <input style={ENEMY_FLD} value={amount} onChange={e => setAmount(e.target.value)} autoFocus />
        </label>
        <div className="col" style={{ gap:4 }}>
          <span className="overline">Type</span>
          <div className="row gap-2">
            {['physique', 'magique', 'brut'].map(t => (
              <button key={t} className={'btn btn-sm ' + (type === t ? 'btn-gold' : 'btn-ghost')}
                onClick={() => setType(t)} style={{ flex:1, textTransform:'capitalize' }}>{t}</button>
            ))}
          </div>
        </div>
        <label className="col" style={{ gap:4 }}>
          <span className="overline">Cible</span>
          <select style={ENEMY_FLD} value={targetId} onChange={e => setTargetId(e.target.value)}>
            {CHARACTERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <div className="row gap-2" style={{ justifyContent:'flex-end' }}>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-sm btn-gold" onClick={submit}>Infliger</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Rendu conditionnel dans `MJPage`**

Dans le `return` de `MJPage`, à côté du `{full && <FullScreenSheet .../>}`, ajouter :

```jsx
      {attacker && <EnemyAttackModal enemy={attacker} stOf={stOf} onClose={() => setAttacker(null)} />}
```

- [ ] **Step 3 : Vérification syntaxe**

Run: `npx esbuild pages-mj.jsx >/dev/null`
Expected: aucune erreur.

- [ ] **Step 4 : Re-run de toute la suite de tests (non-régression)**

Run: `node --test test/game-logic.test.js test/auth.test.js`
Expected: PASS (tous verts).

- [ ] **Step 5 : Commit**

```bash
git add pages-mj.jsx
git commit -m "feat(mj): attaque ennemi -> joueur (mitigation Excel, écrit HP/bouclier en Firebase)"
```

---

### Task 5 : Documentation projet

**Files:**
- Modify: `CLAUDE.md` (carte des fichiers `pages-mj.jsx` + section État actuel)

**Interfaces:** aucune (doc).

- [ ] **Step 1 : Mettre à jour la carte de `pages-mj.jsx`**

Dans `CLAUDE.md`, à la ligne décrivant `pages-mj.jsx`, ajouter une phrase :

```
Grille responsive (plus de scroll horizontal). **Section Ennemis** (locaux,
`localStorage` `runeterra_mj_enemies` — zéro Firebase) : `useMJEnemies`,
`EnemyCard` (HP/mana, édition inline, « Subir » = dégâts joueurs→ennemi),
`EnemyAttackModal` (ennemi→joueur : `mitigateDamage`+`applyDamageToPools`,
écrit `hpCur`/`shield` du joueur en Firebase).
```

- [ ] **Step 2 : Ajouter une entrée « État actuel »**

Ajouter sous « État actuel » :

```
- **Vue MJ — ennemis (v1)** : grille responsive + suivi d'ennemis locaux
  (`localStorage`). Logique de combat pure testée (`mitigateDamage`,
  `applyDamageToPools`, moteur Excel). Attaque ennemi→joueur écrit les HP/bouclier
  en Firebase. **Zéro règle RTDB.** v2 éventuelle : plateau partagé (joueurs voient
  les ennemis). Spec/plan : `docs/superpowers/{specs,plans}/2026-06-19-vue-mj-ennemis*`.
```

- [ ] **Step 3 : Mentionner les nouvelles fonctions de `game-logic.js`**

Dans la description de `game-logic.js` (carte des fichiers), ajouter à la liste : `mitigateDamage`, `applyDamageToPools`.

- [ ] **Step 4 : Commit**

```bash
git add CLAUDE.md
git commit -m "docs: vue MJ ennemis (carte fichiers + état actuel)"
```

---

## Notes d'exécution

- Pas de test UI (cohérent avec le projet) ; vérif visuelle manuelle après merge :
  ajouter un ennemi, l'éditer, « Subir » des dégâts (HP ennemi descend), « Attaque »
  sur un joueur avec/ sans bouclier et chaque type (les HP du joueur descendent en
  temps réel, KO à 0).
- Aucune action console Firebase, aucune règle RTDB à republier.
