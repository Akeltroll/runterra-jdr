# Inventaire perso + commun — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer l'inventaire statique par un système d'objets temps réel — un inventaire personnel éditable par perso + un inventaire commun partagé accessible à tous.

**Architecture:** Le modèle d'item et l'inventaire par défaut vont dans `game-logic.js` (pur, testé). L'inventaire est stocké comme **objet indexé par id** dans Firebase (`/characters/{id}/state/inventory` et `/campaign/runeterra/sharedInventory`), édité via des hooks dans `data-state.jsx`. Un composant `InventoryPanel` réutilisable sert la fiche (perso) et une nouvelle page (commun). Le champ `mods` de chaque item est prévu mais vide (bonus de stats hookés plus tard).

**Tech Stack:** React 18 (UMD CDN), Firebase compat 10.12.2, Babel standalone, Node `node:test`.

**Référence spec :** `docs/superpowers/specs/2026-06-16-inventaire-design.md`

---

## Structure des fichiers

| Fichier | Rôle |
|---------|------|
| `game-logic.js` (MODIFY) | `makeItem`, `newItemId` ; `buildDefaultState` produit `inventory` (objet indexé). |
| `test/game-logic.test.js` (MODIFY) | Tests `makeItem` + inventaire dans `buildDefaultState`. |
| `database.rules.json` (MODIFY) | Nœud `sharedInventory` accessible à tout compte connecté. |
| `data-state.jsx` (MODIFY) | `useCharState` : setters inventaire perso ; `useSharedInventory()`. |
| `components.jsx` (MODIFY) | `InvItemRow` (affichage + édition inline) + `InventoryPanel` réutilisable. |
| `pages-sheet.jsx` (MODIFY) | Inventaire perso live + éditable ; seed-on-load si absent. |
| `pages-inventory.jsx` (CREATE) | Page « Inventaire commun ». |
| `auth.js` (MODIFY) | Page `inv` ajoutée à tous les rôles. |
| `test/auth.test.js` (MODIFY) | `canSeePage('inv', …)`. |
| `index.html` (MODIFY) | Charge `pages-inventory.jsx` + entrée PAGES `inv`. |

**Modèle d'item :** `{ id, cat:'Équipement'|'Consommables'|'Butin', name, sub, qty, ic, img, mods }`.
On **conserve `cat`** (pas de découpage arme/armure tant qu'il n'y a pas de slots).
`mods` reste vide — hook futur des bonus.

---

## Task 1 : Modèle d'item + inventaire par défaut (`game-logic.js`) — TDD

**Files:**
- Modify: `game-logic.js`
- Test: `test/game-logic.test.js`

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter à la fin de `test/game-logic.test.js` (avant aucune fermeture globale ; ce sont des `test(...)` de premier niveau) :

```js
test('makeItem remplit les valeurs par défaut et conserve celles fournies', () => {
  const it = G.makeItem({ id: 'x1', name: 'Claymore', cat: 'Équipement' });
  assert.equal(it.id, 'x1');
  assert.equal(it.name, 'Claymore');
  assert.equal(it.cat, 'Équipement');
  assert.equal(it.qty, 1);          // défaut
  assert.equal(it.sub, '');         // défaut
  assert.equal(it.img, '');         // défaut
  assert.deepEqual(it.mods, {});    // défaut (hook futur)
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
  const st = G.buildDefaultState(char);
  const ids = Object.keys(st.inventory);
  assert.equal(ids.length, 2);
  assert.equal(ids[0], 'rathael_inv_0');                 // id déterministe
  assert.equal(st.inventory['rathael_inv_0'].name, 'Claymore');
  assert.equal(st.inventory['rathael_inv_1'].qty, 2);
});

test('buildDefaultState gère un perso sans inventaire', () => {
  const char = { id: 'x', stats: { hp: 1, mana: 1 }, inv: undefined };
  const st = G.buildDefaultState(char);
  assert.deepEqual(st.inventory, {});
});
```

> Note : `G` est l'import du module en haut du fichier de test. Vérifier qu'il existe : la 1re ligne doit contenir `const G = require('../game-logic.js');`. Si l'import porte un autre nom, l'adapter dans les nouveaux tests.

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `node --test test/game-logic.test.js`
Expected: FAIL (`G.makeItem is not a function` et `st.inventory` undefined).

- [ ] **Step 3 : Implémenter dans `game-logic.js`**

Juste **avant** la fonction `buildDefaultState` (vers la ligne 73), insérer :

```js
  /* --- Inventaire : modèle d'item + helpers --- */
  let _itemSeq = 0;
  function newItemId() {
    _itemSeq += 1;
    return 'it_' + Date.now().toString(36) + '_' + _itemSeq.toString(36);
  }
  function makeItem(p) {
    p = p || {};
    return {
      id:   p.id || newItemId(),
      cat:  p.cat || 'Butin',
      name: p.name || 'Objet',
      sub:  p.sub || '',
      qty:  (p.qty == null) ? 1 : p.qty,
      ic:   p.ic || '',
      img:  p.img || '',
      mods: p.mods || {},   // vide pour l'instant — hook futur des bonus de stats
    };
  }
```

Dans `buildDefaultState`, juste avant le `return {`, ajouter :

```js
    const inventory = {};
    (char.inv || []).forEach((it, i) => {
      const id = `${char.id}_inv_${i}`;
      inventory[id] = makeItem({ id, cat: it.cat, name: it.name, sub: it.sub, qty: it.qty, ic: it.ic });
    });
```

Et ajouter `inventory,` dans l'objet retourné (après `modifiers: ...`).

Enfin, ajouter `makeItem, newItemId,` à l'objet `return { ... }` final du module.

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

Run: `node --test test/game-logic.test.js`
Expected: PASS (tous les tests, anciens + 3 nouveaux).

- [ ] **Step 5 : Commit**

```bash
git add game-logic.js test/game-logic.test.js
git commit -m "feat(inv): modele d item + inventaire par defaut dans buildDefaultState"
```

---

## Task 2 : Règles RTDB — nœud `sharedInventory` (`database.rules.json`)

**Files:**
- Modify: `database.rules.json`

- [ ] **Step 1 : Ajouter le nœud partagé**

Dans `database.rules.json`, à l'intérieur de `"runeterra": { ... }`, ajouter une entrée
`sharedInventory` à côté de `characters` (accès total pour tout compte connecté) :

```json
        "sharedInventory": {
          ".read": "auth != null",
          ".write": "auth != null"
        },
```

Le bloc `runeterra` devient (extrait) :

```json
      "runeterra": {
        ".read":  "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'mj' || root.child('users').child(auth.uid).child('role').val() === 'admin')",
        ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'",
        "sharedInventory": {
          ".read": "auth != null",
          ".write": "auth != null"
        },
        "characters": {
```

- [ ] **Step 2 : Vérifier que le JSON est valide**

Run: `node -e "JSON.parse(require('fs').readFileSync('database.rules.json','utf8')); console.log('JSON_OK')"`
Expected: `JSON_OK`.

- [ ] **Step 3 : Commit**

```bash
git add database.rules.json
git commit -m "feat(inv): regles RTDB - sharedInventory accessible a tout compte connecte"
```

> ⚠️ **À republier dans la console Firebase** (Realtime Database → Règles) au déploiement, sinon l'inventaire commun est inaccessible aux joueurs.

---

## Task 3 : Hooks inventaire (`data-state.jsx`)

**Files:**
- Modify: `data-state.jsx`

- [ ] **Step 1 : Ajouter les setters d'inventaire perso dans `useCharState`**

Dans `useCharState` (lignes 21-28), avant le `return`, ajouter :

```js
  const setInvItem    = useCallback((id, item) => window.RTDB.updatePath(`${charPath(charId)}/inventory`, { [id]: item }), [charId]);
  const removeInvItem = useCallback((id)       => window.RTDB.updatePath(`${charPath(charId)}/inventory`, { [id]: null }), [charId]);
```

Et étendre le `return` : `return { state, setField, setBuff, setMod, setInvItem, removeInvItem };`

- [ ] **Step 2 : Ajouter le hook d'inventaire commun**

Après `useAllCharStates` (vers la ligne 35), ajouter :

```js
/* Inventaire commun partagé (accès total). */
const SHARED_INV = `${CAMPAIGN}/sharedInventory`;
function useSharedInventory() {
  const [items, setItems] = useState(null);
  useEffect(() => window.RTDB.subscribePath(SHARED_INV, setItems), []);
  const setItem    = useCallback((id, item) => window.RTDB.updatePath(SHARED_INV, { [id]: item }), []);
  const removeItem = useCallback((id)       => window.RTDB.updatePath(SHARED_INV, { [id]: null }), []);
  return { items, setItem, removeItem }; // items = { id: item } | null
}
```

- [ ] **Step 3 : Exporter le nouveau hook**

Dans le `Object.assign(window, { ... })` final, ajouter `useSharedInventory,`.

- [ ] **Step 4 : Vérifier la syntaxe**

Run: `npx esbuild data-state.jsx --loader:.jsx=jsx >/dev/null && echo SYNTAXE_OK`
Expected: `SYNTAXE_OK`.

- [ ] **Step 5 : Commit**

```bash
git add data-state.jsx
git commit -m "feat(inv): hooks setters inventaire perso + useSharedInventory"
```

---

## Task 4 : Composants UI réutilisables (`components.jsx`)

**Files:**
- Modify: `components.jsx`

- [ ] **Step 1 : Ajouter `InvItemRow` + `InventoryPanel`**

Avant le `Object.assign(window, { ... })` final de `components.jsx`, ajouter :

```jsx
/* --- Ligne d'item : affichage + édition inline (inventaire perso & commun) --- */
function InvItemRow({ item, editable, onSave, onRemove }) {
  const [edit, setEdit] = useState(false);
  const [d, setD] = useState(item);
  useEffect(() => setD(item), [item]);
  const fld = { background:'var(--bg-inset)', color:'var(--ink)', border:'1px solid var(--line-strong)', borderRadius:6, padding:'5px 8px', fontSize:12, width:'100%', boxSizing:'border-box' };
  if (edit) {
    return (
      <div className="col gap-2" style={{ padding:'8px', border:'1px solid var(--line-gold)', borderRadius:8 }}>
        <input style={fld} value={d.name} placeholder="Nom" onChange={e => setD({ ...d, name: e.target.value })} />
        <input style={fld} value={d.sub} placeholder="Description" onChange={e => setD({ ...d, sub: e.target.value })} />
        <div className="row gap-2">
          <select style={{ ...fld, width:'auto' }} value={d.cat} onChange={e => setD({ ...d, cat: e.target.value })}>
            {['Équipement','Consommables','Butin'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input style={{ ...fld, width:64 }} type="number" min="1" value={d.qty} onChange={e => setD({ ...d, qty: parseInt(e.target.value) || 1 })} />
          <input style={fld} value={d.img} placeholder="items/xxx.webp" onChange={e => setD({ ...d, img: e.target.value })} />
        </div>
        <div className="row gap-2" style={{ justifyContent:'flex-end' }}>
          <button className="btn btn-sm btn-ghost" onClick={() => { setD(item); setEdit(false); }}>Annuler</button>
          <button className="btn btn-sm btn-gold" onClick={() => { onSave(d); setEdit(false); }}>Enregistrer</button>
        </div>
      </div>
    );
  }
  return (
    <div className="row gap-2" style={{ alignItems:'center', padding:'6px 8px', background:'var(--bg-inset)', borderRadius:8, border:'1px solid var(--line)' }}>
      <span style={{ width:26, height:26, flex:'none', borderRadius:6, display:'grid', placeItems:'center', fontSize:15, background:'var(--bg-panel-2)', overflow:'hidden' }}>
        {item.img ? <img src={item.img} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : (item.ic || '◆')}
      </span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, color:'var(--ink)' }}>{item.name}{item.qty > 1 ? <span className="faint mono" style={{ fontSize:11 }}> ×{item.qty}</span> : null}</div>
        {item.sub ? <div className="faint" style={{ fontSize:11 }}>{item.sub}</div> : null}
      </div>
      {editable && (
        <span className="row gap-1">
          <button className="btn btn-sm btn-ghost" title="Éditer" onClick={() => setEdit(true)}>✎</button>
          <button className="btn btn-sm btn-ghost" title="Supprimer" onClick={() => onRemove(item.id)}>✕</button>
        </span>
      )}
    </div>
  );
}

/* --- Panneau d'inventaire réutilisable (perso = char.id ; commun = page dédiée) --- */
function InventoryPanel({ items, editable, onSave, onRemove }) {
  const cats = ['Équipement', 'Consommables', 'Butin'];
  const list = items ? Object.values(items) : [];
  const add = (cat) => { const it = makeItem({ cat, name: 'Nouvel objet' }); onSave(it); };
  return (
    <div className="col gap-4">
      {cats.map(cat => {
        const inCat = list.filter(i => i.cat === cat);
        return (
          <div key={cat}>
            <div className="row" style={{ justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
              <span className="overline">{cat}</span>
              {editable && <button className="btn btn-sm btn-ghost" onClick={() => add(cat)}>+ Ajouter</button>}
            </div>
            {inCat.length === 0
              ? <div className="faint" style={{ fontSize:11 }}>—</div>
              : <div className="col gap-2">{inCat.map(it => <InvItemRow key={it.id} item={it} editable={editable} onSave={onSave} onRemove={onRemove} />)}</div>}
          </div>
        );
      })}
    </div>
  );
}
```

Puis ajouter `InvItemRow, InventoryPanel,` dans le `Object.assign(window, { ... })` final.

> Note : `makeItem` est fourni globalement par `game-logic.js` (chargé avant `components.jsx`). `useState`/`React` sont déjà globaux (React UMD).

- [ ] **Step 2 : Vérifier la syntaxe**

Run: `npx esbuild components.jsx --loader:.jsx=jsx >/dev/null && echo SYNTAXE_OK`
Expected: `SYNTAXE_OK`.

- [ ] **Step 3 : Commit**

```bash
git add components.jsx
git commit -m "feat(inv): composants InvItemRow + InventoryPanel reutilisables"
```

---

## Task 5 : Inventaire perso live + éditable (`pages-sheet.jsx`)

**Files:**
- Modify: `pages-sheet.jsx`

- [ ] **Step 1 : Seed-on-load + passage des setters dans `SheetBody`**

Dans `SheetBody` (ligne 274), remplacer :

```js
  const { state, setField, setBuff, setMod } = useCharState(char.id);
  if (!state) return <div style={{ padding:40 }} className="dim">Chargement…</div>;
```

par :

```js
  const { state, setField, setBuff, setMod, setInvItem, removeInvItem } = useCharState(char.id);
  useEffect(() => {
    if (state && state.inventory === undefined) {
      // migration : initialise l'inventaire depuis les valeurs par défaut du perso
      window.RTDB.updatePath(charPath(char.id), { inventory: buildDefaultState(char).inventory });
    }
  }, [state, char.id]);
  if (!state) return <div style={{ padding:40 }} className="dim">Chargement…</div>;
```

> `charPath` et `buildDefaultState` sont globaux. Un joueur peut écrire sa propre fiche (règles RTDB), le staff toutes : le seed fonctionne dans les deux cas.

- [ ] **Step 2 : Passer l'inventaire + setters à `BuffInvColumn`**

À la ligne 303, remplacer :

```jsx
        <BuffInvColumn char={char} activeBuffs={activeBuffs} setBuff={setBuff} setMod={setMod} modifiers={state.modifiers} />
```

par :

```jsx
        <BuffInvColumn char={char} activeBuffs={activeBuffs} setBuff={setBuff} setMod={setMod} modifiers={state.modifiers}
          inventory={state.inventory} onSaveItem={setInvItem} onRemoveItem={removeInvItem} />
```

- [ ] **Step 3 : Remplacer le rendu statique de l'inventaire dans `BuffInvColumn`**

Modifier la signature (ligne 103) :

```js
function BuffInvColumn({ char, activeBuffs, setBuff, setMod, modifiers, inventory, onSaveItem, onRemoveItem }) {
```

Remplacer le panneau Inventaire (lignes 143-161, de `<div className="panel">` contenant `<h3>Inventaire</h3>` jusqu'à son `</div>` fermant) par :

```jsx
      <div className="panel">
        <div className="panel-head"><h3>Inventaire</h3>
          <span className="mono faint" style={{ fontSize:11 }}>{inventory ? Object.keys(inventory).length : 0} objets</span>
        </div>
        <div className="col gap-4" style={{ padding:'14px 16px' }}>
          <InventoryPanel items={inventory} editable={true} onSave={(it) => onSaveItem(it.id, it)} onRemove={onRemoveItem} />
          <div>
            <div className="overline" style={{ marginBottom:7 }}>Bourse</div>
            <Coins coins={char.coins} />
          </div>
        </div>
      </div>
```

> On supprime ainsi l'usage de `char.inv` et l'ancien `cats.map(... InvItem ...)`. `cats` n'était utilisé que par ce bloc : **retirer sa déclaration** (ligne 111, `const cats = [...]`) pour éviter une variable morte. `Coins` et `char.coins` restent inchangés.

- [ ] **Step 4 : Vérifier la syntaxe**

Run: `npx esbuild pages-sheet.jsx --loader:.jsx=jsx >/dev/null && echo SYNTAXE_OK`
Expected: `SYNTAXE_OK`.

- [ ] **Step 5 : Commit**

```bash
git add pages-sheet.jsx
git commit -m "feat(inv): inventaire perso temps reel + editable sur la fiche"
```

---

## Task 6 : Page « Inventaire commun » (`pages-inventory.jsx`)

**Files:**
- Create: `pages-inventory.jsx`

- [ ] **Step 1 : Créer la page**

Create `pages-inventory.jsx` :

```jsx
/* ============================================================
   PAGE — INVENTAIRE COMMUN (coffre partagé, accès total)
   ============================================================ */
function CommonInventoryPage() {
  const { items, setItem, removeItem } = useSharedInventory();
  return (
    <div className="col" style={{ height:'100%', minHeight:0, overflow:'auto' }}>
      <div style={{ padding:'18px 24px', maxWidth:760 }}>
        <h2 style={{ marginBottom:4 }}>Inventaire commun</h2>
        <p className="dim" style={{ fontSize:13, marginBottom:16 }}>
          Coffre partagé de l'équipe. Tout le monde peut consulter, déposer et prendre des objets.
        </p>
        <div className="panel" style={{ padding:'14px 16px' }}>
          {items === null
            ? <div className="dim" style={{ padding:'8px 0' }}>Chargement…</div>
            : <InventoryPanel items={items} editable={true} onSave={(it) => setItem(it.id, it)} onRemove={removeItem} />}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CommonInventoryPage });
```

- [ ] **Step 2 : Vérifier la syntaxe**

Run: `npx esbuild pages-inventory.jsx --loader:.jsx=jsx >/dev/null && echo SYNTAXE_OK`
Expected: `SYNTAXE_OK`.

- [ ] **Step 3 : Commit**

```bash
git add pages-inventory.jsx
git commit -m "feat(inv): page inventaire commun (coffre partage)"
```

---

## Task 7 : Accès page pour tous les rôles (`auth.js`) — TDD

**Files:**
- Modify: `auth.js`
- Test: `test/auth.test.js`

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter dans `test/auth.test.js` (le module est importé en haut comme `A`) :

```js
test("la page inv (inventaire commun) est visible par tous les roles", () => {
  assert.equal(A.canSeePage('inv', 'joueur'), true);
  assert.equal(A.canSeePage('inv', 'mj'), true);
  assert.equal(A.canSeePage('inv', 'admin'), true);
});
```

- [ ] **Step 2 : Lancer pour vérifier l'échec**

Run: `node --test test/auth.test.js`
Expected: FAIL (`inv` absent de `PAGE_ACCESS`).

- [ ] **Step 3 : Ajouter `inv` à tous les rôles**

Dans `auth.js`, remplacer `PAGE_ACCESS` (lignes 31-35) par :

```js
  const PAGE_ACCESS = {
    joueur: ['sheet', 'inv'],
    mj:     ['lobby', 'mj', 'sheet', 'journal', 'prog', 'ds', 'inv'],
    admin:  ['lobby', 'mj', 'sheet', 'journal', 'prog', 'ds', 'inv', 'admin'],
  };
```

- [ ] **Step 4 : Lancer pour vérifier le succès**

Run: `node --test test/auth.test.js`
Expected: PASS (anciens + nouveau test).

- [ ] **Step 5 : Commit**

```bash
git add auth.js test/auth.test.js
git commit -m "feat(inv): page inventaire commun accessible a tous les roles"
```

---

## Task 8 : Chargement + routing (`index.html`)

**Files:**
- Modify: `index.html`

- [ ] **Step 1 : Charger la nouvelle page**

Après la ligne `<script type="text/babel" src="pages-admin.jsx"></script>` (ligne 99), ajouter :

```html
<script type="text/babel" src="pages-inventory.jsx"></script>
```

- [ ] **Step 2 : Ajouter l'entrée dans `PAGES`**

Dans le tableau `PAGES` (lignes 103-111), ajouter avant la ligne `{ id:'admin', ... }` :

```jsx
  { id:'inv',     label:'Inventaire commun', render:() => <CommonInventoryPage /> },
```

- [ ] **Step 3 : Vérifier que le fichier est lisible (le JSX inline n'est pas parsé par esbuild)**

Run: `npx esbuild index.html --loader:.html=text >/dev/null && echo FICHIER_LU`
Expected: `FICHIER_LU`.

- [ ] **Step 4 : Commit**

```bash
git add index.html
git commit -m "feat(inv): chargement page inventaire commun + entree de navigation"
```

---

## Vérification finale (après toutes les tasks)

- [ ] `node --test test/game-logic.test.js test/auth.test.js` → tout PASS (anciens + nouveaux).
- [ ] `node -e "JSON.parse(require('fs').readFileSync('database.rules.json','utf8'))"` → `JSON_OK`.
- [ ] Contrôles esbuild OK sur tous les `.jsx` modifiés/créés.
- [ ] **Test manuel** (serveur local + Firebase) :
  - Ouvrir la fiche d'un perso → l'inventaire s'affiche (migré depuis les défauts), on peut **ajouter / éditer / supprimer** un item, et la quantité se met à jour.
  - Ouvrir « Inventaire commun » → déposer un objet ; vérifier qu'il apparaît **en temps réel** sur un 2e compte connecté.
  - Un joueur voit bien l'onglet « Inventaire commun » et sa seule fiche.
- [ ] ⚠️ **Déploiement** : republier `database.rules.json` dans la console Firebase, sinon l'inventaire commun est inaccessible aux joueurs.

## Notes d'implémentation

- **Inventaire = objet indexé par id** (pas un tableau) dans Firebase : indispensable pour
  `update({ [id]: item })` / `update({ [id]: null })` sans collision ni réindexation.
- Le seed-on-load (Task 5) migre les persos déjà amorcés (qui n'ont pas `inventory`).
  Les futurs amorçages passent par `buildDefaultState` (déjà étendu en Task 1).
- `mods` reste vide : quand un item aura des stats, le brancher dans `computeEffective`
  (tâche d'une future itération « équipement / slots »).
