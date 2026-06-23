# Catalogue d'objets éditable (Feature B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre au staff d'ajouter / éditer / supprimer les objets de la liste de base directement depuis la modale « + Ajouter », avec persistance Firebase partagée.

**Architecture:** Le catalogue sort du code en dur (`ITEM_CATALOG`) vers un nœud Firebase `campaign/runeterra/catalog` (lecture inscrits, écriture staff). Un hook `useItemCatalog(canSeed)` s'y abonne, l'amorce une seule fois depuis `ITEM_CATALOG` (marqueur `catalogInit`), et expose des setters. `ItemCatalogPicker` lit ce hook et, en mode staff, affiche des boutons Éditer/Supprimer + « Nouvel objet de base » (édition via `InvItemRow` réutilisé en modal).

**Tech Stack:** Zéro-build (React 18 + Babel standalone via CDN), `game-logic.js` (UMD, testé en Node), Firebase RTDB compat, règles `database.rules.json`.

## Global Constraints

- **Zéro build** : chaque `.jsx`/`.js` définit localement puis `Object.assign(window, {...})`. Accès aux autres modules par référence nue (résolue via `window`). Ordre de chargement : `game-logic.js` → `data.jsx` → `data-state.jsx` → `components.jsx` → `pages-*`.
- **Catalogue = seul consommateur** : `ITEM_CATALOG` n'est lu aujourd'hui que par `ItemCatalogPicker` (`components.jsx`). Ne pas créer d'autre consommateur.
- **Amorçage unique** : si `catalog` vide ET `catalogInit` absent ET `canSeed` (staff) → semer depuis `ITEM_CATALOG` puis poser `catalogInit=true`. Ensuite Firebase fait foi (supprimer tout ne re-sème pas). `ITEM_CATALOG` reste dans le code comme graine + repli pendant le chargement.
- **Écriture staff uniquement** : `catalog`/`catalogInit` en écriture = rôle `mj` ou `admin` (règle RTDB).
- **Entrée catalogue** = `{ id, cat, name, sub, ic, img, type, mods }` (mêmes champs qu'un item ; `id` = clé Firebase). `entry.id` n'est PAS utilisé à l'ajout en inventaire (`fillStacks` régénère via `makeItem`).
- **Suppression sûre** : retirer un objet du catalogue n'affecte pas les inventaires déjà remplis (copies).
- **Vérif syntaxe** : `npx esbuild <fichier> >/dev/null`. **Tests** : `node --test`.
- **Déploiement** : republier `database.rules.json` en console Firebase + bumper le jeton `?v=` dans `index.html`.

---

### Task 1 : Helpers purs `buildCatalogSeed` + `catalogArray` (logique pure)

**Files:**
- Modify: `game-logic.js` (ajout de 2 fonctions près de `planItemAdd`, ~ligne 171 ; ajout aux exports ~ligne 690)
- Test: `test/game-logic.test.js` (ajout de 2 tests)

**Interfaces:**
- Produces:
  - `buildCatalogSeed(entries) -> { [id]: { id, cat, name, sub, ic, img, type, mods } }` — transforme la liste plate en map Firebase, `id` généré par `newItemId()`.
  - `catalogArray(map, inited, fallback) -> Array` — si `inited` falsy → `fallback` (copie) ; sinon `Object.values(map)` trié par `cat+name`.

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à la fin de `test/game-logic.test.js` :

```js
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
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `node --test test/game-logic.test.js`
Expected: FAIL (`buildCatalogSeed`/`catalogArray` non définis → `L.buildCatalogSeed is not a function`).

- [ ] **Step 3: Implémenter les 2 fonctions**

Dans `game-logic.js`, juste après la fonction `planItemAdd` (après sa fermeture `}` à `game-logic.js:171`), insérer :

```js
  /* Amorçage du catalogue partagé : transforme la liste ITEM_CATALOG (sans id)
     en map { id: {id,cat,name,sub,ic,img,type,mods} } prête pour Firebase. */
  function buildCatalogSeed(entries) {
    entries = entries || [];
    var out = {};
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i] || {};
      var id = newItemId();
      out[id] = { id: id, cat: e.cat || 'Butin', name: e.name || 'Objet', sub: e.sub || '',
        ic: e.ic || '', img: e.img || '', type: e.type || '', mods: e.mods || {} };
    }
    return out;
  }

  /* Catalogue exposé à l'UI : si amorcé (inited) → liste live triée (cat puis nom) ;
     sinon repli sur le catalogue en dur (chargement / pré-amorçage). */
  function catalogArray(map, inited, fallback) {
    if (!inited) return (fallback || []).slice();
    return Object.keys(map || {}).map(function (k) { return map[k]; })
      .sort(function (a, b) { return ((a.cat || '') + (a.name || '')).localeCompare((b.cat || '') + (b.name || '')); });
  }
```

- [ ] **Step 4: Ajouter aux exports**

Dans le bloc `Object.assign(window, { ... })` de `game-logic.js` (la ligne listant `makeItem`, `newItemId`, `fillStacks`, `planItemAdd`…), ajouter `buildCatalogSeed, catalogArray`. Repérer la ligne contenant `planItemAdd` dans cet objet et y ajouter les deux noms, p. ex. :

```js
    fillStacks, planItemAdd, buildCatalogSeed, catalogArray, EQUIP_TYPES,
```

(Adapter à la ligne réelle ; l'essentiel est que `buildCatalogSeed` et `catalogArray` soient dans l'objet exporté.)

- [ ] **Step 5: Lancer les tests pour vérifier le succès**

Run: `node --test test/game-logic.test.js`
Expected: PASS (tout vert, dont les 2 nouveaux tests).

- [ ] **Step 6: Commit**

```bash
git add game-logic.js test/game-logic.test.js
git commit -m "feat(catalogue): helpers purs buildCatalogSeed + catalogArray (amorçage/lecture du catalogue partagé)"
```

---

### Task 2 : Règles RTDB pour `catalog` + `catalogInit`

**Files:**
- Modify: `database.rules.json` (ajout de 2 blocs sous `campaign/runeterra`, après `sharedCoins`)

**Interfaces:**
- Produces: nœuds `campaign/runeterra/catalog/{itemId}` (lecture inscrits, écriture staff, `.validate` id/name/cat) et `campaign/runeterra/catalogInit` (booléen, écriture staff).

- [ ] **Step 1: Ajouter les blocs**

Dans `database.rules.json`, après le bloc `"sharedCoins": { … },` (qui se termine ligne 31 par `},`), insérer :

```json
        "catalog": {
          ".read": "auth != null && root.child('users').child(auth.uid).child('role').exists()",
          ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'mj' || root.child('users').child(auth.uid).child('role').val() === 'admin')",
          "$itemId": {
            ".validate": "newData.hasChildren(['id', 'name', 'cat'])"
          }
        },
        "catalogInit": {
          ".read": "auth != null && root.child('users').child(auth.uid).child('role').exists()",
          ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'mj' || root.child('users').child(auth.uid).child('role').val() === 'admin')",
          ".validate": "newData.isBoolean()"
        },
```

(Les lectures cascadent : un `joueur` lit `catalog` même si le parent `campaign/runeterra/.read` est staff-only, comme pour `sharedInventory`.)

- [ ] **Step 2: Vérifier que le JSON reste valide**

Run: `node -e "JSON.parse(require('fs').readFileSync('database.rules.json','utf8')); console.log('JSON OK')"`
Expected: `JSON OK`

- [ ] **Step 3: Commit**

```bash
git add database.rules.json
git commit -m "feat(catalogue): règles RTDB catalog + catalogInit (lecture inscrits, écriture staff)"
```

---

### Task 3 : Hook `useItemCatalog(canSeed)` (temps réel + amorçage)

**Files:**
- Modify: `data-state.jsx` (ajout constantes + hook après `useSharedInventory`, ~ligne 230 ; ajout aux exports ~ligne 313)

**Interfaces:**
- Consumes: `buildCatalogSeed`, `catalogArray` (Task 1, globales via `window`).
- Produces: `useItemCatalog(canSeed) -> { catalog: Array, seeded: boolean, setCatalogItem(id,item), removeCatalogItem(id) }`. `catalog` = liste live triée si amorcé, sinon repli `ITEM_CATALOG`. Amorce une fois si `canSeed && !seeded && vide`.

- [ ] **Step 1: Ajouter constantes + hook**

Dans `data-state.jsx`, juste après la fonction `useSharedInventory` (après sa fermeture `}` à `data-state.jsx:230`), insérer :

```js
/* Catalogue d'objets de base PARTAGÉ (éditable par le staff depuis le picker).
   Lecture tout inscrit, écriture staff. Amorçage unique depuis ITEM_CATALOG. */
const CATALOG = `${CAMPAIGN}/catalog`;
const CATALOG_INIT = `${CAMPAIGN}/catalogInit`;
function useItemCatalog(canSeed) {
  const [map, setMap] = useState(null);             // null = en chargement ; {} = vide chargé
  const [inited, setInited] = useState(undefined);  // undefined = inconnu
  useEffect(() => window.RTDB.subscribePath(CATALOG, (v) => setMap(v || {})), []);
  useEffect(() => window.RTDB.subscribePath(CATALOG_INIT, (v) => setInited(!!v)), []);
  // Amorçage unique : staff + jamais amorcé + vide → sème depuis ITEM_CATALOG.
  useEffect(() => {
    if (!canSeed) return;
    if (inited === undefined || map === null) return;     // pas encore chargé
    if (inited || Object.keys(map).length) return;        // déjà amorcé / non vide
    window.RTDB.updatePath(CATALOG, buildCatalogSeed(window.ITEM_CATALOG || []));
    window.RTDB.setPath(CATALOG_INIT, true);
  }, [canSeed, inited, map]);
  const catalog = catalogArray(map, !!inited, window.ITEM_CATALOG || []);
  const setCatalogItem    = useCallback((id, item) => window.RTDB.updatePath(CATALOG, { [id]: item }), []);
  const removeCatalogItem = useCallback((id)        => window.RTDB.updatePath(CATALOG, { [id]: null }), []);
  return { catalog, seeded: !!inited, setCatalogItem, removeCatalogItem };
}
```

- [ ] **Step 2: Ajouter aux exports**

Dans le `Object.assign(window, { … })` final de `data-state.jsx` (vers la ligne 313, contenant `useSharedInventory, useSharedCoins`), ajouter `useItemCatalog, CATALOG`. Par exemple remplacer :

```js
  useCharState, useAllCharStates, useSharedInventory, useSharedCoins,
```
par :
```js
  useCharState, useAllCharStates, useSharedInventory, useSharedCoins, useItemCatalog, CATALOG,
```

- [ ] **Step 3: Vérifier la syntaxe**

Run: `npx esbuild data-state.jsx >/dev/null`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add data-state.jsx
git commit -m "feat(catalogue): hook useItemCatalog (temps réel + amorçage unique depuis ITEM_CATALOG)"
```

---

### Task 4 : `ItemCatalogPicker` éditable (UI staff) + branchement des 3 sites

**Files:**
- Modify: `components.jsx:661-712` (`ItemCatalogPicker`)
- Modify: `pages-sheet.jsx:163` (prop `staff`)
- Modify: `pages-equip.jsx:455` (prop `staff`)
- Modify: `pages-inventory.jsx:169` (prop `staff`)

**Interfaces:**
- Consumes: `useItemCatalog(canSeed)` (Task 3), `InvItemRow` (même fichier), `makeItem` (global).
- Produces: picker lisant le catalogue live ; en mode staff amorcé, boutons Éditer/Supprimer par objet + « Nouvel objet de base » + éditeur modal.

- [ ] **Step 1: En-tête du composant — signature + hook + état d'édition**

Remplacer (`components.jsx:661-664`) :
```js
function ItemCatalogPicker({ initialFilter, onPick, onCustom, onClose }) {
  const [filter, setFilter] = useState(initialFilter || 'all');
  const [picked, setPicked] = useState(null);   // { entry, x, y }
  const list = (window.ITEM_CATALOG || []).filter(e => filter === 'all' || e.cat === filter);
```
par :
```js
function ItemCatalogPicker({ initialFilter, onPick, onCustom, onClose, staff }) {
  const [filter, setFilter] = useState(initialFilter || 'all');
  const [picked, setPicked] = useState(null);    // { entry, x, y }
  const [editing, setEditing] = useState(null);  // item édité (modal réutilisant InvItemRow)
  const { catalog, seeded, setCatalogItem, removeCatalogItem } = useItemCatalog(!!staff);
  const manage = !!staff && seeded;              // édition dispo une fois le catalogue amorcé
  const miniBtn = { background:'var(--bg-deep)', border:'1px solid var(--line)', borderRadius:5, padding:'0 5px', fontSize:11, lineHeight:1.6, cursor:'pointer', color:'var(--ink)' };
  const list = catalog.filter(e => filter === 'all' || e.cat === filter);
```

- [ ] **Step 2: Vignette — clé stable + boutons staff**

Remplacer le `{list.map(...)}` (`components.jsx:683-696`) :
```js
          {list.map((entry, i) => (
            <div key={i} onClick={(e) => setPicked({ entry, x:e.clientX, y:e.clientY })}
              title={entry.sub || entry.name}
              style={{ cursor:'pointer', borderRadius:8, border:'1px solid var(--line)', padding:8,
                display:'flex', flexDirection:'column', alignItems:'center', gap:6, textAlign:'center',
                background:'var(--bg-inset)' }}>
              <span style={{ width:44, height:44, display:'grid', placeItems:'center', fontSize:24, overflow:'hidden' }}>
                {entry.img
                  ? <img src={entry.img} alt="" style={{ width:'100%', height:'100%', objectFit:'contain' }} />
                  : (entry.ic || '◆')}
              </span>
              <span style={{ fontSize:11, lineHeight:1.2, color:'var(--ink)' }}>{entry.name}</span>
            </div>
          ))}
```
par :
```js
          {list.map((entry, i) => (
            <div key={entry.id || i} onClick={(e) => setPicked({ entry, x:e.clientX, y:e.clientY })}
              title={entry.sub || entry.name}
              style={{ position:'relative', cursor:'pointer', borderRadius:8, border:'1px solid var(--line)', padding:8,
                display:'flex', flexDirection:'column', alignItems:'center', gap:6, textAlign:'center',
                background:'var(--bg-inset)' }}>
              {manage && entry.id && (
                <div className="row gap-1" style={{ position:'absolute', top:2, right:2 }}>
                  <button title="Éditer" style={miniBtn} onClick={(ev) => { ev.stopPropagation(); setEditing(entry); }}>✎</button>
                  <button title="Supprimer du catalogue" style={{ ...miniBtn, color:'var(--debuff-bright,#e0463f)' }}
                    onClick={(ev) => { ev.stopPropagation(); if (window.confirm(`Supprimer « ${entry.name} » du catalogue de base ?`)) removeCatalogItem(entry.id); }}>🗑</button>
                </div>
              )}
              <span style={{ width:44, height:44, display:'grid', placeItems:'center', fontSize:24, overflow:'hidden' }}>
                {entry.img
                  ? <img src={entry.img} alt="" style={{ width:'100%', height:'100%', objectFit:'contain' }} />
                  : (entry.ic || '◆')}
              </span>
              <span style={{ fontSize:11, lineHeight:1.2, color:'var(--ink)' }}>{entry.name}</span>
            </div>
          ))}
```

- [ ] **Step 3: Pied — bouton « Nouvel objet de base »**

Remplacer le pied (`components.jsx:698-702`) :
```js
        <div className="row" style={{ justifyContent:'space-between', alignItems:'center',
          marginTop:12, paddingTop:12, borderTop:'1px solid var(--line)' }}>
          <button className="btn btn-sm btn-ghost" onClick={onCustom}>+ Objet personnalisé</button>
          <span className="faint" style={{ fontSize:11 }}>{list.length} objets</span>
        </div>
```
par :
```js
        <div className="row" style={{ justifyContent:'space-between', alignItems:'center',
          marginTop:12, paddingTop:12, borderTop:'1px solid var(--line)', gap:8, flexWrap:'wrap' }}>
          <span className="row gap-2">
            <button className="btn btn-sm btn-ghost" onClick={onCustom}>+ Objet personnalisé</button>
            {manage && (
              <button className="btn btn-sm btn-ghost" title="Ajouter un objet à la liste de base"
                onClick={() => setEditing(makeItem({ cat: filter === 'all' ? 'Butin' : filter, name: 'Nouvel objet' }))}>
                + Nouvel objet de base
              </button>
            )}
          </span>
          <span className="faint" style={{ fontSize:11 }}>{list.length} objets</span>
        </div>
```

- [ ] **Step 4: Éditeur modal — réutilise `InvItemRow`**

Juste après le bloc `{picked && ( <AmountStepper … /> )}` (`components.jsx:704-709`), avant la fermeture `</div>` du scrim extérieur (ligne 710), insérer :
```js
      {editing && (
        <div className="modal-scrim" onClick={() => setEditing(null)}
          style={{ display:'flex', alignItems:'center', justifyContent:'center', zIndex:205 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width:'min(420px,92vw)', background:'var(--bg-deep)', border:'1px solid var(--line-gold)', borderRadius:12, padding:16 }}>
            <InvItemRow item={editing} editable={true} startEdit={true}
              onSave={(it) => { setCatalogItem(it.id, it); setEditing(null); }}
              onRemove={(id) => { removeCatalogItem(id); setEditing(null); }} />
          </div>
        </div>
      )}
```

- [ ] **Step 5: Brancher `staff` aux 3 sites d'ouverture**

`pages-sheet.jsx:163`, remplacer :
```js
        <ItemCatalogPicker initialFilter={catCat}
```
par :
```js
        <ItemCatalogPicker initialFilter={catCat} staff={canEdit}
```

`pages-equip.jsx:455`, remplacer :
```js
        <ItemCatalogPicker
          onPick={(entry, n) => {
            const { patch } = planItemAdd(inventoryForGrid, entry, n);
```
par :
```js
        <ItemCatalogPicker staff={staff}
          onPick={(entry, n) => {
            const { patch } = planItemAdd(inventoryForGrid, entry, n);
```

`pages-inventory.jsx:169`, remplacer :
```js
        <ItemCatalogPicker
          onPick={(entry, n) => {
            const { patch } = planItemAdd(items || {}, entry, n);
```
par :
```js
        <ItemCatalogPicker staff={staff}
          onPick={(entry, n) => {
            const { patch } = planItemAdd(items || {}, entry, n);
```

- [ ] **Step 6: Vérifier la syntaxe**

Run:
```bash
for f in components.jsx pages-sheet.jsx pages-equip.jsx pages-inventory.jsx; do npx esbuild "$f" >/dev/null && echo "$f OK"; done
```
Expected: les 4 « OK ».

- [ ] **Step 7: Tests de non-régression**

Run: `node --test test/game-logic.test.js test/auth.test.js`
Expected: PASS.

- [ ] **Step 8: Vérification manuelle** (après republication des règles RTDB — voir Déploiement)

Servir le site, se connecter en **MJ**, ouvrir une fiche → Inventaire → **+ Ajouter** :
1. Le picker s'ouvre, peuplé (amorçage Firebase au 1er affichage staff).
2. Chaque vignette montre **✎** et **🗑** (coin haut-droit) ; le pied a **+ Nouvel objet de base**.
3. **✎** sur une potion → éditeur → changer le nom / l'image → Enregistrer → la vignette se met à jour (et persiste après rechargement).
4. **🗑** sur une potion → confirmation → l'objet disparaît de la liste (et ne réapparaît pas après rechargement).
5. **+ Nouvel objet de base** → éditeur vierge → remplir + image → Enregistrer → apparaît dans la liste.
6. Cliquer le **corps** d'une vignette (pas les boutons) → `AmountStepper` → l'objet est bien ajouté à l'inventaire (flux d'ajout inchangé).
7. Recharger en **joueur** : la liste reflète les modifs du MJ (lecture seule, pas de boutons d'édition).

- [ ] **Step 9: Commit**

```bash
git add components.jsx pages-sheet.jsx pages-equip.jsx pages-inventory.jsx
git commit -m "feat(catalogue): ItemCatalogPicker éditable (staff) — Éditer/Supprimer/Nouvel objet de base, persistance Firebase"
```

---

## Déploiement

- [ ] **Republier `database.rules.json`** en console Firebase (Realtime Database → Règles) — sinon l'amorçage et l'écriture du catalogue sont bloqués (le picker resterait en repli `ITEM_CATALOG` sans pouvoir éditer).
- [ ] Bumper le jeton `?v=…` dans `index.html` (search-replace de l'ancienne valeur, ex. `20260623-1` → `20260623-2`) + `window.APPV`.
- [ ] Commit du bump + merge/push sur `main` (GitHub Pages).

## Self-Review (rempli à la rédaction)

- **Couverture spec** : nœud `catalog/{itemId}` ✓ (Task 2) ; lecture inscrits / écriture staff ✓ (Task 2) ; `catalogInit` ✓ (Task 2/3) ; amorçage unique depuis `ITEM_CATALOG` ✓ (Task 1 `buildCatalogSeed` + Task 3 hook) ; ne re-sème pas après suppression totale ✓ (Task 3 : décision basée sur `inited`, pas sur la vacuité — `catalogArray(map,true,fb)` renvoie `[]` ; Task 1 test couvre) ; repli pendant chargement ✓ (Task 1 `catalogArray` + Task 3) ; hook `useItemCatalog` ✓ (Task 3) ; picker lit le hook ✓ (Task 4) ; ✎/🗑 par objet + « Nouvel objet de base » staff ✓ (Task 4) ; édition via `InvItemRow` (cat/type/mods/upload image) ✓ (Task 4 modal) ; suppression sûre (copies) ✓ (contrainte, `fillStacks` régénère les ids) ; règle RTDB à republier ✓ (Déploiement).
- **Placeholders** : aucun.
- **Type consistency** : `useItemCatalog(canSeed) -> { catalog, seeded, setCatalogItem(id,item), removeCatalogItem(id) }` (Task 3) ↔ consommé tel quel dans le picker (Task 4). `buildCatalogSeed`/`catalogArray` (Task 1) ↔ appelés dans le hook (Task 3). `setCatalogItem(it.id, it)` ↔ `InvItemRow.onSave(it)` renvoie l'item complet (id inclus, de `makeItem`). Cohérent.
