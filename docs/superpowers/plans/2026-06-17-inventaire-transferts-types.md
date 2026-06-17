# Inventaire — grille commune, transferts, types, pièces vivantes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner au coffre commun la grille visuelle de la page Équipement, permettre les transferts d'items et de pièces entre inventaire perso et coffre commun, et rendre le type d'item (catégorie + emplacement) explicite à la création.

**Architecture:** Logique pure testable dans `game-logic.js` (champ `type`, amorçage `coins`, calcul de transfert/fusion). Orchestration temps réel Firebase dans `data-state.jsx` (`useSharedCoins`, migration `coinsInit`, helpers `moveItem`/`moveCoins`). UI partagée dans `components.jsx` (composant `InventoryGrid` extrait de la page Équipement, `ItemActionMenu`, `AmountStepper`, éditeur d'item étendu). Câblage des deux pages (`pages-equip.jsx`, `pages-inventory.jsx`).

**Tech Stack:** React 18 + Babel standalone (zéro-build, CDN), Firebase RTDB (SDK compat), `node --test` pour la logique pure, `npx esbuild` pour la vérif de syntaxe `.jsx`.

## Global Constraints

- **Zéro-build** : chaque fichier `.jsx`/`.js` définit ses symboles localement PUIS `Object.assign(window, {...})`. Les autres scripts y accèdent par référence nue (résolue via `window`). Ordre de chargement (index.html) : firebase → firebase-config → game-logic → data → data-state → components → pages-* → shell. Un symbole utilisé par un fichier doit être défini par un fichier chargé AVANT.
- `game-logic.js` est **UMD** (testable en Node ET exposé sur `window`). Ne pas y mettre de JSX ni de dépendance navigateur.
- Toute écriture Firebase passe par les helpers `window.RTDB` (`updatePath`, `setPath`, `getSnapshot`, `subscribePath`).
- Les valeurs ABSOLUES (hpCur, manaCur, shield) et les quantités sont stockées telles quelles. `qty` 0 → item supprimé de la collection.
- Tests logique pure : `node --test test/game-logic.test.js`. Vérif syntaxe : `npx esbuild <fichier> >/dev/null`.
- `charId` ∈ {rathael, urskaar, smith, lunick, jett}. `lunick` s'affiche « Elias Crowe ».
- Co-author des commits : `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1 : Champ `type` sur les items + liste des emplacements

**Files:**
- Modify: `game-logic.js` (fonction `makeItem`, ~lignes 79-91 ; bloc `Object.assign` final)
- Test: `test/game-logic.test.js`

**Interfaces:**
- Produces : `makeItem(p)` renvoie désormais un objet incluant `type: p.type || ''`. Constante `EQUIP_TYPES` (tableau `{ value, label }`) exposée sur `window` et via l'export UMD.

- [ ] **Step 1 : Test d'échec — `makeItem` porte `type`**

Ajouter dans `test/game-logic.test.js` :

```js
test('makeItem porte un champ type (défaut vide)', () => {
  assert.equal(GL.makeItem({}).type, '');
  assert.equal(GL.makeItem({ type: 'helmet' }).type, 'helmet');
});

test('EQUIP_TYPES couvre les emplacements clés', () => {
  const vals = GL.EQUIP_TYPES.map(t => t.value);
  for (const v of ['helmet','chest','ring','weapon','accessory','boots'])
    assert.ok(vals.includes(v), 'manque ' + v);
});
```

(Le handle `GL` est déjà l'import de `game-logic.js` en haut du fichier de test ; sinon `const GL = require('../game-logic.js');`.)

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `node --test test/game-logic.test.js`
Expected: FAIL (`type` undefined / `EQUIP_TYPES` undefined).

- [ ] **Step 3 : Implémenter `type` + `EQUIP_TYPES`**

Dans `game-logic.js`, ajouter `type` dans `makeItem` :

```js
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
      type: p.type || '',   // emplacement (helmet/chest/ring/weapon/accessory/boots…) ; vide = non équipable
      mods: p.mods || {},
    };
  }
```

Définir la liste d'emplacements (avant le `return`/`Object.assign` final, dans la portée du module UMD) :

```js
  var EQUIP_TYPES = [
    { value:'helmet',    label:'Casque' },
    { value:'shoulders', label:'Épaules' },
    { value:'chest',     label:'Cuirasse' },
    { value:'gloves',    label:'Gants' },
    { value:'pants',     label:'Pantalon' },
    { value:'boots',     label:'Bottes' },
    { value:'belt',      label:'Ceinture' },
    { value:'weapon',    label:'Arme principale' },
    { value:'offhand',   label:'Arme secondaire' },
    { value:'shield',    label:'Bouclier' },
    { value:'amulet',    label:'Amulette' },
    { value:'ring',      label:'Anneau' },
    { value:'accessory', label:'Accessoire' },
  ];
```

Ajouter `EQUIP_TYPES` au bloc d'export UMD final (l'objet passé à `Object.assign`/`module.exports`), à côté de `makeItem`, `newItemId`, etc.

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `node --test test/game-logic.test.js`
Expected: PASS (tous les tests, anciens inclus).

- [ ] **Step 5 : Commit**

```bash
git add game-logic.js test/game-logic.test.js
git commit -m "feat(inv): champ type sur les items + EQUIP_TYPES (emplacements)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2 : `buildDefaultState` amorce `coins` + fix Kéminite

**Files:**
- Modify: `game-logic.js` (fonction `buildDefaultState`, ~lignes 94-117)
- Modify: `data.jsx` (item Kéminite de Rathäel, ~ligne 124)
- Test: `test/game-logic.test.js`

**Interfaces:**
- Produces : `buildDefaultState(char)` renvoie désormais aussi `coins: { plat, or, arg, cuiv }` (copie de `char.coins`, défaut 0).

- [ ] **Step 1 : Test d'échec — `buildDefaultState` renvoie `coins`**

Ajouter dans `test/game-logic.test.js` :

```js
test('buildDefaultState amorce coins depuis char.coins', () => {
  const char = {
    id:'t', stats:{ hp:1, mana:1 }, hpCur:10, manaCur:10,
    coins:{ plat:1, or:2, arg:3, cuiv:4 }, inv:[],
  };
  const st = GL.buildDefaultState(char);
  assert.deepEqual(st.coins, { plat:1, or:2, arg:3, cuiv:4 });
});

test('buildDefaultState coins défaut 0 si char.coins absent', () => {
  const char = { id:'t', stats:{ hp:1, mana:1 }, hpCur:0, manaCur:0, inv:[] };
  assert.deepEqual(GL.buildDefaultState(char).coins, { plat:0, or:0, arg:0, cuiv:0 });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `node --test test/game-logic.test.js`
Expected: FAIL (`st.coins` undefined).

- [ ] **Step 3 : Implémenter l'amorçage `coins`**

Dans `game-logic.js`, dans `buildDefaultState`, ajouter au bloc retourné (après `eau` / avant `buffs` ou à la suite, peu importe la position dans l'objet) :

```js
      coins: {
        plat: (char.coins && char.coins.plat) || 0,
        or:   (char.coins && char.coins.or)   || 0,
        arg:  (char.coins && char.coins.arg)  || 0,
        cuiv: (char.coins && char.coins.cuiv) || 0,
      },
```

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `node --test test/game-logic.test.js`
Expected: PASS.

- [ ] **Step 5 : Fix data — Kéminite = Butin**

Dans `data.jsx`, l'item Kéminite de Rathäel (chercher `Kéminite`) :

```js
      { cat:'Butin', name:'Kéminite', sub:'Sert à appeler Taliyah', qty:1, ic:'🔮', img:'ATH/Items/keminite.webp', type:'' },
```

(Passer `cat` de `'Butin'` — vérifier la valeur actuelle ; la ligne d'origine est `cat:'Butin'` dans le fichier mais l'item s'affiche en Consommable car catégorisé ainsi en base via l'ancien seed. Si la ligne `data.jsx` est déjà `Butin`, le correctif réel est le re-seed décrit en Task 4/verif. Mettre quand même `type:''` explicite ici.)

> Note pour l'implémenteur : si la ligne `data.jsx` indique déjà `cat:'Butin'`, le mauvais classement vient des données déjà écrites en Firebase (seed antérieur). La correction effective côté base se fait à la main en console OU en ré-éditant l'item via l'UI une fois la Task 9/10 livrée. Le plan garantit le bon défaut pour les futurs seeds.

- [ ] **Step 6 : Vérif syntaxe data.jsx + commit**

Run: `npx esbuild data.jsx >/dev/null && echo OK`
Expected: OK

```bash
git add game-logic.js data.jsx test/game-logic.test.js
git commit -m "feat(inv): buildDefaultState amorce les pièces (coins) + Kéminite=Butin

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3 : Logique pure de transfert/fusion d'items

**Files:**
- Modify: `game-logic.js` (nouvelle fonction `planItemTransfer` + export)
- Test: `test/game-logic.test.js`

**Interfaces:**
- Produces :
  `planItemTransfer(srcItems, dstItems, itemId, n)` → `{ srcPatch, dstPatch }`.
  - `srcItems`, `dstItems` : objets `{ [id]: item }` (peuvent être `{}`).
  - Retire `n` du stack `itemId` côté source : `srcPatch = { [itemId]: itemDécrémenté | null }` (null si qty atteint 0).
  - Côté destination : fusionne sur l'item « équivalent » (même `name`+`type`+`cat`) en incrémentant sa `qty` ; sinon crée un nouvel item via `makeItem` (nouvel id). `dstPatch = { [dstId]: item }`.
  - `n` est borné à la qty disponible. Si l'item source est absent ou `n<=0`, retourne `{ srcPatch:{}, dstPatch:{} }`.
  - Les deux patches sont destinés à `updatePath(srcCollectionPath, srcPatch)` et `updatePath(dstCollectionPath, dstPatch)`.

- [ ] **Step 1 : Tests d'échec — transfert partiel, total, fusion**

Ajouter dans `test/game-logic.test.js` :

```js
test('planItemTransfer — transfert partiel décrémente la source', () => {
  const src = { a: GL.makeItem({ id:'a', name:'Potion', cat:'Consommables', qty:3 }) };
  const { srcPatch, dstPatch } = GL.planItemTransfer(src, {}, 'a', 1);
  assert.equal(srcPatch.a.qty, 2);
  const dstItem = Object.values(dstPatch)[0];
  assert.equal(dstItem.qty, 1);
  assert.equal(dstItem.name, 'Potion');
});

test('planItemTransfer — transfert total supprime la source (null)', () => {
  const src = { a: GL.makeItem({ id:'a', name:'Épée', cat:'Équipement', type:'weapon', qty:1 }) };
  const { srcPatch } = GL.planItemTransfer(src, {}, 'a', 1);
  assert.equal(srcPatch.a, null);
});

test('planItemTransfer — fusion sur item équivalent côté destination', () => {
  const src = { a: GL.makeItem({ id:'a', name:'Potion', cat:'Consommables', qty:2 }) };
  const dst = { z: GL.makeItem({ id:'z', name:'Potion', cat:'Consommables', qty:5 }) };
  const { dstPatch } = GL.planItemTransfer(src, dst, 'a', 2);
  assert.equal(dstPatch.z.qty, 7);
});

test('planItemTransfer — n borné à la qty dispo', () => {
  const src = { a: GL.makeItem({ id:'a', name:'X', cat:'Butin', qty:2 }) };
  const { srcPatch, dstPatch } = GL.planItemTransfer(src, {}, 'a', 99);
  assert.equal(srcPatch.a, null);
  assert.equal(Object.values(dstPatch)[0].qty, 2);
});

test('planItemTransfer — item absent => patches vides', () => {
  const r = GL.planItemTransfer({}, {}, 'nope', 1);
  assert.deepEqual(r, { srcPatch:{}, dstPatch:{} });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `node --test test/game-logic.test.js`
Expected: FAIL (`planItemTransfer` undefined).

- [ ] **Step 3 : Implémenter `planItemTransfer`**

Dans `game-logic.js` (portée module UMD) :

```js
  function _sameKind(a, b) {
    return a && b && a.name === b.name && (a.type || '') === (b.type || '') && a.cat === b.cat;
  }
  function planItemTransfer(srcItems, dstItems, itemId, n) {
    srcItems = srcItems || {}; dstItems = dstItems || {};
    var src = srcItems[itemId];
    if (!src || !(n > 0)) return { srcPatch:{}, dstPatch:{} };
    var move = Math.min(n, src.qty || 0);
    if (move <= 0) return { srcPatch:{}, dstPatch:{} };

    var remain = (src.qty || 0) - move;
    var srcPatch = {};
    srcPatch[itemId] = (remain <= 0) ? null : Object.assign({}, src, { qty: remain });

    var dstPatch = {};
    var twinId = null, twin = null;
    for (var k in dstItems) { if (_sameKind(dstItems[k], src)) { twinId = k; twin = dstItems[k]; break; } }
    if (twin) {
      dstPatch[twinId] = Object.assign({}, twin, { qty: (twin.qty || 0) + move });
    } else {
      var fresh = makeItem({
        cat: src.cat, name: src.name, sub: src.sub, qty: move,
        ic: src.ic, img: src.img, type: src.type, mods: src.mods,
      });
      dstPatch[fresh.id] = fresh;
    }
    return { srcPatch: srcPatch, dstPatch: dstPatch };
  }
```

Ajouter `planItemTransfer` au bloc d'export UMD final.

- [ ] **Step 4 : Lancer, vérifier le succès**

Run: `node --test test/game-logic.test.js`
Expected: PASS (tous).

- [ ] **Step 5 : Commit**

```bash
git add game-logic.js test/game-logic.test.js
git commit -m "feat(inv): planItemTransfer — logique pure de transfert/fusion d'items

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4 : data-state — `useSharedCoins`, migration `coinsInit`, helpers de transfert

**Files:**
- Modify: `data-state.jsx` (ajouts ; bloc `Object.assign` final ~lignes 100-103)
- Test: vérif syntaxe `npx esbuild` (pas de test unitaire : dépend de `window.RTDB`)

**Interfaces:**
- Consumes : `planItemTransfer` (game-logic), `charPath`, `SHARED_INV`, `CAMPAIGN`, `window.RTDB`.
- Produces :
  - `useSharedCoins()` → `{ coins, setCoin }` où `coins = { plat,or,arg,cuiv } | null`, `setCoin(key, value)` écrit la valeur absolue.
  - `useCharState` renvoie en plus `setCoin(key, value)` (écrit `state/coins/{key}`).
  - `moveItem(fromPath, toPath, fromItems, toItems, itemId, n)` — applique `planItemTransfer` via deux `updatePath`.
  - `moveCoins(fromPath, toPath, fromCoins, toCoins, key, n)` — arithmétique bornée ≥0, deux `updatePath`.
  - `SHARED_COINS` = `` `${CAMPAIGN}/sharedCoins` ``.

- [ ] **Step 1 : Ajouter la migration `coinsInit` à `useCharState` + `setCoin`**

Dans `useCharState`, après le `setEquipment` existant, ajouter :

```js
  const setCoin = useCallback((key, value) =>
    window.RTDB.updatePath(`${charPath(charId)}/coins`, { [key]: Math.max(0, value | 0) }), [charId]);
```

Et l'inclure dans l'objet retourné :

```js
  return { state, setField, setBuff, setMod, setInvItem, removeInvItem, setEquipment, setCoin };
```

> La migration `coinsInit` est portée par les pages (comme `invInit`), pas par le hook — voir Tasks 9/10. On garde le hook minimal.

- [ ] **Step 2 : Ajouter `useSharedCoins` + `SHARED_COINS`**

Après `useSharedInventory` :

```js
const SHARED_COINS = `${CAMPAIGN}/sharedCoins`;
function useSharedCoins() {
  const [coins, setCoins] = useState(null);
  useEffect(() => window.RTDB.subscribePath(SHARED_COINS, (v) =>
    setCoins(v || { plat:0, or:0, arg:0, cuiv:0 })), []);
  const setCoin = useCallback((key, value) =>
    window.RTDB.updatePath(SHARED_COINS, { [key]: Math.max(0, value | 0) }), []);
  return { coins, setCoin };
}
```

- [ ] **Step 3 : Ajouter les orchestrateurs `moveItem` / `moveCoins`**

```js
/* Transfert d'item entre deux collections RTDB ({id:item}). Utilise la logique
   pure planItemTransfer puis applique les deux patches en temps réel. */
function moveItem(fromPath, toPath, fromItems, toItems, itemId, n) {
  const { srcPatch, dstPatch } = planItemTransfer(fromItems, toItems, itemId, n);
  if (Object.keys(srcPatch).length) window.RTDB.updatePath(fromPath, srcPatch);
  if (Object.keys(dstPatch).length) window.RTDB.updatePath(toPath, dstPatch);
}

/* Transfert de pièces (une dénomination) entre deux objets coins, montant borné. */
function moveCoins(fromPath, toPath, fromCoins, toCoins, key, n) {
  const avail = (fromCoins && fromCoins[key]) || 0;
  const m = Math.max(0, Math.min(n | 0, avail));
  if (m <= 0) return;
  window.RTDB.updatePath(fromPath, { [key]: avail - m });
  window.RTDB.updatePath(toPath, { [key]: ((toCoins && toCoins[key]) || 0) + m });
}
```

- [ ] **Step 4 : Exposer sur `window`**

Étendre le `Object.assign(window, {...})` final :

```js
Object.assign(window, {
  useCharState, useAllCharStates, useSharedInventory, useSharedCoins,
  useAuthIdentity, useAllUsers, setUserAssignment,
  seedIfEmpty, charPath, CAMPAIGN, SHARED_INV, SHARED_COINS, moveItem, moveCoins,
});
```

(Ajouter `SHARED_INV` à l'export s'il n'y est pas déjà — il est utilisé par les pages pour les chemins de transfert.)

- [ ] **Step 5 : Vérif syntaxe + commit**

Run: `npx esbuild data-state.jsx >/dev/null && echo OK`
Expected: OK

```bash
git add data-state.jsx
git commit -m "feat(inv): useSharedCoins + setCoin + moveItem/moveCoins (orchestration RTDB)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5 : Règles RTDB — `sharedCoins`

**Files:**
- Modify: `database.rules.json` (sous `campaign/runeterra`, à côté de `sharedInventory`)

**Interfaces:** aucune (config serveur). À republier en console Firebase au déploiement.

- [ ] **Step 1 : Ajouter le nœud `sharedCoins`**

Dans `database.rules.json`, sous `"runeterra"`, après le bloc `"sharedInventory"` :

```json
        "sharedCoins": {
          ".read": "auth != null && root.child('users').child(auth.uid).child('role').exists()",
          ".write": "auth != null && root.child('users').child(auth.uid).child('role').exists()"
        },
```

(Respecter la virgule JSON entre les blocs frères.)

- [ ] **Step 2 : Valider le JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('database.rules.json','utf8')); console.log('JSON OK')"`
Expected: `JSON OK`

- [ ] **Step 3 : Commit**

```bash
git add database.rules.json
git commit -m "feat(inv): règles RTDB sharedCoins (R/W participant inscrit)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

> ⚠️ Au déploiement : republier `database.rules.json` en console (comme pour `sharedInventory`), sinon les pièces communes sont inaccessibles.

---

### Task 6 : `components.jsx` — constantes partagées + composant `InventoryGrid`

**Files:**
- Modify: `components.jsx` (nouvelles constantes + composant `InventoryGrid` + export)
- Modify: `pages-equip.jsx` (supprimer les constantes déplacées, référencer celles de `components.jsx`)
- Test: vérif syntaxe `npx esbuild`

**Interfaces:**
- Consumes : `EQUIP_TYPES` (game-logic).
- Produces (sur `window`) :
  - Constantes : `INV_CAT_STYLE`, `INV_CAT_FALLBACK`, `invCatStyle(item)`, `INV_FILTERS`, `INV_COINS`, `invFmt(n)`, `invThumbStyle(item, inset)`.
  - `InventoryGrid({ items, coins, filter, setFilter, onItemClick, onCoinClick, onAdd, onDropItem, capacity, title })` — rend la grille (cases 7 colonnes, badge qty, filtres, ligne monnaie, bouton « + Ajouter »). `items` = `{ id:item }`. `onItemClick(item, event)`, `onCoinClick(coinKey, event)`, `onAdd()`. `onDropItem(itemId)` optionnel (drop sur la grille = déséquiper, page Équipement). `capacity` (nombre, défaut 120) pour l'indicateur « X / cap ».

> Décision de structure : ces constantes étaient locales à `pages-equip.jsx` (`EQUIP_CAT_STYLE`, `EQUIP_FILTERS`, `EQUIP_COINS`, `equipFmt`, `equipCatStyle`, `itemThumbStyle`). Elles deviennent partagées dans `components.jsx` (chargé avant les pages) sous des noms `INV_*`/`inv*`. `pages-equip.jsx` les référence ensuite. `EQUIP_SLOTS`, `EQUIP_GRID_AREAS`, `EQUIP_PORTRAITS`, `equipTypeForItem`, `parseConsumableEffect` RESTENT dans `pages-equip.jsx` (spécifiques au paperdoll).

- [ ] **Step 1 : Ajouter les constantes partagées dans `components.jsx`**

Avant `InvItemRow` (qui est vers la ligne 378), ajouter :

```jsx
/* --- Inventaire : styles/format partagés (grille Équipement ET coffre commun) --- */
const INV_CAT_STYLE = {
  'Équipement':   { border:'rgba(200,155,60,0.55)',  glow:'rgba(200,155,60,0.30)'  },
  'Consommables': { border:'rgba(43,111,176,0.55)',  glow:'rgba(43,111,176,0.30)'  },
  'Butin':        { border:'rgba(139,224,255,0.42)', glow:'rgba(139,224,255,0.16)' },
};
const INV_CAT_FALLBACK = { border:'rgba(160,128,72,0.45)', glow:'rgba(160,128,72,0.22)' };
const invCatStyle = (it) => (it && INV_CAT_STYLE[it.cat]) || INV_CAT_FALLBACK;
const INV_FILTERS = [
  { key:'all', label:'Tout' }, { key:'Équipement', label:'Équip.' },
  { key:'Consommables', label:'Conso.' }, { key:'Butin', label:'Butin' },
];
const INV_COINS = [
  { key:'cuiv', label:'Fer',     img:'ATH/Items/piece-fer.webp',     col:'#b0b0b0' },
  { key:'arg',  label:'Bronze',  img:'ATH/Items/piece-bronze.webp',  col:'#cd9a6a' },
  { key:'or',   label:'Or',      img:'ATH/Items/piece-or.webp',      col:'#eccf8f' },
  { key:'plat', label:'Mythril', img:'ATH/Items/piece-mythril.webp', col:'#b8d4e8' },
];
const invFmt = (n) => Number(n || 0).toLocaleString('fr-FR');
const invThumbStyle = (item, inset) => ({
  position:'absolute', inset, cursor:'grab', display:'flex', alignItems:'center', justifyContent:'center',
  ...(item.img ? { backgroundImage:`url(${item.img})`, backgroundSize:'contain', backgroundRepeat:'no-repeat',
    backgroundPosition:'center', filter:'drop-shadow(0 2px 6px rgba(0,0,0,0.8))' } : {}),
  fontSize:18,
});
```

- [ ] **Step 2 : Ajouter le composant `InventoryGrid`**

Toujours dans `components.jsx` (après les constantes ci-dessus) :

```jsx
/* Grille d'inventaire dark-fantasy réutilisable (page Équipement + coffre commun).
   N'gère PAS les actions : remonte les clics au parent via onItemClick/onCoinClick. */
function InventoryGrid({ items, coins, filter, setFilter, onItemClick, onCoinClick, onAdd, onDropItem, capacity = 120, title = 'INVENTAIRE' }) {
  const list = items ? Object.values(items).filter(it => it.qty == null || it.qty > 0) : [];
  const filtered = list.filter(it => filter === 'all' || it.cat === filter);
  const N = Math.max(49, Math.ceil(filtered.length / 7) * 7);
  const cells = Array.from({ length:N }, (_, i) => filtered[i] || null);
  const panelBg = 'linear-gradient(155deg,#1c1713 0%,#130f0c 55%,#0d0a08 100%)';
  const cornerStyle = (h, v) => ({ position:'absolute', [h]:6, [v]:6, width:14, height:14,
    [`border${h[0].toUpperCase()}${h.slice(1)}`]:'2px solid rgba(185,150,80,0.55)',
    [`border${v[0].toUpperCase()}${v.slice(1)}`]:'2px solid rgba(185,150,80,0.55)' });
  return (
    <div style={{ position:'relative', display:'flex', flexDirection:'column', height:'100%', minHeight:0,
      border:'1px solid rgba(160,128,72,0.3)', borderRadius:4, background:panelBg,
      boxShadow:'inset 0 0 55px rgba(0,0,0,0.5)', padding:'12px 12px 0',
      fontFamily:"'EB Garamond',serif", color:'#d8c8a8' }}>
      <div style={cornerStyle('left','top')} /><div style={cornerStyle('right','top')} />
      <div style={cornerStyle('left','bottom')} /><div style={cornerStyle('right','bottom')} />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', position:'relative', marginBottom:10, flex:'0 0 auto' }}>
        <span style={{ fontFamily:"'Cinzel',serif", fontSize:14, fontWeight:600, letterSpacing:3, color:'#c2a05a' }}>{title}</span>
        {onAdd && <button onClick={onAdd} title="Ajouter un objet"
          style={{ position:'absolute', right:0, top:-2, background:'transparent', color:'#c2a05a',
            border:'1px solid rgba(160,128,72,0.4)', borderRadius:4, padding:'2px 8px', cursor:'pointer',
            fontFamily:"'Cinzel',serif", fontSize:11 }}>+ Ajouter</button>}
      </div>
      <div style={{ display:'flex', gap:4, marginBottom:10, flex:'0 0 auto' }}>
        {INV_FILTERS.map(ft => {
          const on = filter === ft.key;
          return <div key={ft.key} onClick={() => setFilter(ft.key)}
            style={{ flex:1, textAlign:'center', fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:0.4,
              padding:'7px 2px', cursor:'pointer', textTransform:'uppercase', borderRadius:3,
              border:'1px solid ' + (on ? 'rgba(160,128,72,0.5)' : 'rgba(160,128,72,0.16)'),
              color:on ? '#eccf8f' : 'rgba(190,170,135,0.5)',
              background:on ? 'linear-gradient(180deg,#2a1f16,#1a130e)' : 'transparent' }}>{ft.label}</div>;
        })}
      </div>
      <div onDragOver={onDropItem ? (e) => e.preventDefault() : undefined}
        onDrop={onDropItem ? (e) => { e.preventDefault(); const id = e.dataTransfer.getData('text'); if (id) onDropItem(id); } : undefined}
        style={{ flex:'1 1 auto', overflowY:'auto', overflowX:'hidden', minHeight:0 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:5, paddingBottom:8 }}>
          {cells.map((item, i) => {
            const cs = invCatStyle(item);
            return (
              <div key={i} style={{ position:'relative', aspectRatio:'1', borderRadius:3,
                background:item ? 'rgba(12,8,7,0.7)' : 'radial-gradient(circle at 50% 30%,#1b1510,#0e0a08)',
                border:'1px solid ' + (item ? cs.border : 'rgba(160,128,72,0.16)'),
                boxShadow:item ? 'inset 0 0 14px ' + cs.glow : 'none',
                display:'flex', alignItems:'center', justifyContent:'center', overflow:'visible' }}>
                {item && (
                  <div draggable="true"
                    onDragStart={(e) => e.dataTransfer.setData('text', item.id)}
                    onClick={(e) => onItemClick && onItemClick(item, e)}
                    style={{ ...invThumbStyle(item, '3px'), cursor:'pointer' }}>
                    {!item.img && (item.ic || '◆')}
                  </div>
                )}
                {item && item.qty > 1 && (
                  <span style={{ position:'absolute', right:3, bottom:1, fontFamily:"'EB Garamond',serif",
                    fontSize:13, fontWeight:600, color:'#f0e6d2', textShadow:'0 1px 3px #000,0 0 5px #000',
                    pointerEvents:'none', zIndex:1 }}>{invFmt(item.qty)}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 4px 6px',
        borderTop:'1px solid rgba(160,128,72,0.16)', flex:'0 0 auto' }}>
        {INV_COINS.map(c => (
          <div key={c.key} onClick={onCoinClick ? (e) => onCoinClick(c.key, e) : undefined}
            style={{ display:'flex', alignItems:'center', gap:4, cursor:onCoinClick ? 'pointer' : 'default' }}>
            <div style={{ width:30, height:30, flex:'0 0 30px', background:`url(${c.img}) center/contain no-repeat` }} />
            <span style={{ fontFamily:"'EB Garamond',serif", fontSize:13, color:c.col, minWidth:32 }}>
              {invFmt((coins && coins[c.key]) || 0)}
            </span>
          </div>
        ))}
        <div style={{ flex:1 }} />
        <span style={{ fontFamily:"'Cinzel',serif", fontSize:11, color:'#c2a05a', letterSpacing:0.5 }}>
          {list.length} / {capacity}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3 : Exposer `InventoryGrid` + constantes sur `window`**

Étendre le `Object.assign(window, {...})` final de `components.jsx` pour ajouter :
`InventoryGrid, INV_CAT_STYLE, INV_CAT_FALLBACK, invCatStyle, INV_FILTERS, INV_COINS, invFmt, invThumbStyle`.

- [ ] **Step 4 : Vérif syntaxe**

Run: `npx esbuild components.jsx >/dev/null && echo OK`
Expected: OK

- [ ] **Step 5 : Commit**

```bash
git add components.jsx
git commit -m "feat(inv): InventoryGrid réutilisable + constantes INV_* partagées

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7 : `components.jsx` — `AmountStepper` + `ItemActionMenu`

**Files:**
- Modify: `components.jsx`
- Test: vérif syntaxe

**Interfaces:**
- Produces :
  - `AmountStepper({ max, x, y, label, confirmLabel, onConfirm, onClose })` — popover ancré (`position:fixed` à `x,y`), valeur 1→`max`, +/- + champ, bouton de validation → `onConfirm(n)`. Si `max<=1`, peut être contourné par l'appelant (transfert direct).
  - `ItemActionMenu({ item, x, y, actions, onClose })` — popover ancré listant `actions` = tableau `{ label, onClick, danger }`. Ferme au clic extérieur / Échap.

- [ ] **Step 1 : Ajouter `AmountStepper`**

```jsx
/* Popover ancré pour choisir un montant (transfert de pile, pièces). */
function AmountStepper({ max, x, y, label, confirmLabel = 'Valider', onConfirm, onClose }) {
  const [n, setN] = useState(1);
  const clamp = (v) => Math.max(1, Math.min(max, v | 0 || 1));
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:200 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position:'fixed', left:Math.min(x, window.innerWidth-220), top:Math.min(y, window.innerHeight-130),
        background:'var(--bg-panel-2,#181410)', border:'1px solid var(--line-gold,rgba(160,128,72,0.5))', borderRadius:8,
        padding:12, width:200, boxShadow:'0 8px 30px rgba(0,0,0,0.6)', color:'var(--ink,#e9dcc4)' }}>
        {label && <div style={{ fontSize:12, marginBottom:8 }}>{label}</div>}
        <div className="row gap-2" style={{ alignItems:'center', justifyContent:'center' }}>
          <button className="btn btn-sm btn-ghost" onClick={() => setN(v => clamp(v - 1))}>−</button>
          <input type="number" min="1" max={max} value={n} onChange={(e) => setN(clamp(e.target.value))}
            style={{ width:60, textAlign:'center', background:'var(--bg-inset,#0d0a08)', color:'inherit',
              border:'1px solid var(--line,rgba(160,128,72,0.3))', borderRadius:6, padding:'5px' }} />
          <button className="btn btn-sm btn-ghost" onClick={() => setN(v => clamp(v + 1))}>+</button>
        </div>
        <div className="row gap-2" style={{ marginTop:10, justifyContent:'space-between' }}>
          <button className="btn btn-sm btn-ghost" onClick={() => setN(max)}>Max ({max})</button>
          <button className="btn btn-sm btn-gold" onClick={() => { onConfirm(clamp(n)); onClose(); }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Ajouter `ItemActionMenu`**

```jsx
/* Popover d'actions ancré (clic sur un item de la grille). */
function ItemActionMenu({ item, x, y, actions, onClose }) {
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:200 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position:'fixed', left:Math.min(x, window.innerWidth-200), top:Math.min(y, window.innerHeight-40-actions.length*34),
        background:'var(--bg-panel-2,#181410)', border:'1px solid var(--line-gold,rgba(160,128,72,0.5))', borderRadius:8,
        minWidth:170, padding:6, boxShadow:'0 8px 30px rgba(0,0,0,0.6)', color:'var(--ink,#e9dcc4)' }}>
        <div style={{ fontSize:12, fontWeight:600, padding:'4px 8px 6px', color:'var(--gold-pale,#eccf8f)',
          borderBottom:'1px solid var(--line,rgba(160,128,72,0.2))', marginBottom:4 }}>{item.name}</div>
        {actions.map((a, i) => (
          <button key={i} onClick={() => { a.onClick(); onClose(); }}
            style={{ display:'block', width:'100%', textAlign:'left', background:'transparent', border:'none',
              color:a.danger ? 'var(--debuff-bright,#e0463f)' : 'inherit', padding:'7px 8px', borderRadius:5,
              cursor:'pointer', fontSize:13 }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover,rgba(255,255,255,0.05))'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>{a.label}</button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3 : Exposer sur `window`**

Ajouter `AmountStepper, ItemActionMenu` au `Object.assign(window, {...})` final.

- [ ] **Step 4 : Vérif syntaxe + commit**

Run: `npx esbuild components.jsx >/dev/null && echo OK`
Expected: OK

```bash
git add components.jsx
git commit -m "feat(inv): AmountStepper + ItemActionMenu (popovers de transfert/actions)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8 : `components.jsx` — éditeur d'item étendu (Catégorie + Emplacement)

**Files:**
- Modify: `components.jsx` (fonction `InvItemRow`, bloc d'édition `if (edit)`, ~lignes 394-423)
- Test: vérif syntaxe

**Interfaces:**
- Consumes : `EQUIP_TYPES` (game-logic, sur `window`).
- Produces : `InvItemRow({ item, editable, onSave, onRemove, startEdit })` — gère `d.type` ; l'emplacement n'est affiché/écrit que si `d.cat === 'Équipement'` ; `startEdit` ouvre directement en mode édition (utilisé par les modals des Tasks 9/10).

- [ ] **Step 1 : Ajouter le prop `startEdit` à `InvItemRow`**

Dans `components.jsx`, modifier la signature et l'état initial de `InvItemRow` :

```jsx
function InvItemRow({ item, editable, onSave, onRemove, startEdit }) {
  const [edit, setEdit] = useState(!!startEdit);
```

(Le reste du composant est inchangé.)

- [ ] **Step 2 : Ajouter le sélecteur d'emplacement dans le formulaire**

Dans `InvItemRow`, dans le bloc `if (edit)`, juste après la `<div className="row gap-2">` contenant le `<select>` catégorie + l'input qty (la ligne se termine par le champ qty), insérer un sélecteur d'emplacement conditionnel. Remplacer le `<select>` catégorie pour qu'un changement de catégorie hors Équipement remette `type` à vide :

```jsx
          <select style={{ ...fld, width:'auto' }} value={d.cat}
            onChange={e => setD({ ...d, cat: e.target.value, type: e.target.value === 'Équipement' ? d.type : '' })}>
            {['Équipement','Consommables','Butin'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input style={{ ...fld, width:64 }} type="number" min="1" value={d.qty}
            onChange={e => setD({ ...d, qty: parseInt(e.target.value) || 1 })} />
        </div>
        {d.cat === 'Équipement' && (
          <select style={fld} value={d.type || ''} onChange={e => setD({ ...d, type: e.target.value })}>
            <option value="">— Emplacement —</option>
            {EQUIP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        )}
```

> Note : repérer la balise de fermeture `</div>` de la ligne catégorie+qty existante et placer le sélecteur d'emplacement juste APRÈS, avant le bloc image. Ne pas dupliquer la `</div>`.

- [ ] **Step 3 : Forcer `type:''` hors Équipement à l'enregistrement**

Dans le bouton « Enregistrer » du formulaire, sécuriser la valeur de `type` :

```jsx
          <button className="btn btn-sm btn-gold" onClick={() => { onSave({ ...d, type: d.cat === 'Équipement' ? (d.type || '') : '' }); setEdit(false); }}>Enregistrer</button>
```

- [ ] **Step 4 : Vérif syntaxe + commit**

Run: `npx esbuild components.jsx >/dev/null && echo OK`
Expected: OK

```bash
git add components.jsx
git commit -m "feat(inv): éditeur d'item — Catégorie + Emplacement (type)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9 : Câblage page Équipement (grille partagée + menu + transferts + pièces vivantes)

**Files:**
- Modify: `pages-equip.jsx` (`EquipBody` : remplacer la colonne inventaire par `InventoryGrid` + menu d'actions + transferts ; migration `coinsInit` ; pièces live ; supprimer constantes déplacées)
- Test: vérif syntaxe + manuel

**Interfaces:**
- Consumes : `InventoryGrid`, `ItemActionMenu`, `AmountStepper` (components), `useSharedInventory`, `useSharedCoins`, `moveItem`, `moveCoins`, `SHARED_INV`, `SHARED_COINS`, `charPath` (data-state), `invCatStyle`/`invThumbStyle`/`invFmt` (components), `EQUIP_TYPES`.
- L'éditeur d'item de la grille réutilise `InvItemRow` via un petit modal local OU via `InventoryPanel` ? → On ouvre l'éditeur en réutilisant `InvItemRow` dans un modal (voir Step 4).

- [ ] **Step 1 : Remplacer les constantes locales par celles de components**

Dans `pages-equip.jsx`, SUPPRIMER les définitions désormais dans `components.jsx` : `EQUIP_CAT_STYLE`, `EQUIP_CAT_FALLBACK`, `equipCatStyle`, `EQUIP_FILTERS`, `EQUIP_COINS`, `equipFmt`. Remplacer leurs usages par les équivalents `INV_*`/`inv*` :
- `equipFmt` → `invFmt`
- `equipCatStyle` → `invCatStyle`
- `EQUIP_COINS` → `INV_COINS`
- `EQUIP_FILTERS` → `INV_FILTERS`

Garder `EQUIP_SLOTS`, `EQUIP_GRID_AREAS`, `EQUIP_PORTRAITS`, `equipTypeForItem`, `parseConsumableEffect`, `itemThumbStyle` (le paperdoll les utilise encore ; `itemThumbStyle` reste local pour les slots).

> `equipTypeForItem` lit déjà `it.type` en priorité (ligne ~66) — aucun changement nécessaire, les nouveaux items typés tomberont dans le bon slot.

- [ ] **Step 2 : Ajouter les hooks commun + état des popovers + migration coins**

Dans `EquipBody`, ajouter aux hooks existants :

```jsx
  const { items: sharedItems, setItem: setSharedItem } = useSharedInventory();
  const { coins: sharedCoins, setCoin: setSharedCoin } = useSharedCoins();
  const { setCoin } = useCharState(char.id);   // déjà destructuré : ajouter setCoin à la ligne existante
  const [menu, setMenu] = useState(null);       // { item, x, y }
  const [stepper, setStepper] = useState(null);  // { kind:'item'|'coin', ... }
  const [editing, setEditing] = useState(null);  // item en cours d'édition (modal)
```

> Ajouter `setCoin` à la déstructuration existante `const { state, setEquipment, setField, setInvItem, removeInvItem } = useCharState(char.id);` → `..., setCoin }`.

Migration `coinsInit` (à côté du `useEffect` `invInit`) :

```jsx
  useEffect(() => {
    if (state && state.coinsInit === undefined) {
      const coins = (state.coins && Object.keys(state.coins).length)
        ? state.coins : buildDefaultState(char).coins;
      window.RTDB.updatePath(charPath(char.id), { coins, coinsInit: true });
    }
  }, [state, char.id]);
```

- [ ] **Step 3 : Définir les actions d'item + transferts**

Dans `EquipBody`, calculer la monnaie live (`state.coins` repli `char.coins`) et les handlers :

```jsx
  const coins = state.coins || char.coins || { plat:0, or:0, arg:0, cuiv:0 };

  const sendToCommon = (item, n) => {
    moveItem(`${charPath(char.id)}/inventory`, SHARED_INV, itemsById, sharedItems || {}, item.id, n);
  };
  const openItemMenu = (item, e) => {
    e.stopPropagation(); setTip(null);
    const actions = [];
    if (equipTypeForItem(item)) actions.push({ label:'Équiper', onClick:() => autoEquip(item.id) });
    if (item.cat === 'Consommables' && parseConsumableEffect(item)) actions.push({ label:'Utiliser', onClick:() => consumeItem(item) });
    actions.push({ label:'Envoyer au commun', onClick:() => {
      if ((item.qty || 1) > 1) setStepper({ kind:'item', dir:'toCommon', item, x:e.clientX, y:e.clientY });
      else sendToCommon(item, 1);
    }});
    actions.push({ label:'Éditer', onClick:() => setEditing(item) });
    actions.push({ label:'Supprimer', danger:true, onClick:() => removeInvItem(item.id) });
    setMenu({ item, x:e.clientX, y:e.clientY, actions });
  };
  const openCoinMenu = (key, e) => {
    const max = coins[key] || 0;
    if (max <= 0) return;
    setStepper({ kind:'coin', dir:'toCommon', coinKey:key, max, x:e.clientX, y:e.clientY });
  };
  const addItem = () => { const it = makeItem({ cat:'Butin', name:'Nouvel objet' }); setInvItem(it.id, it); setEditing(it); };
```

- [ ] **Step 4 : Remplacer la colonne DROITE (inventaire) par `InventoryGrid`**

Remplacer tout le bloc `{/* ---- DROITE : INVENTAIRE ---- */}` (la `<div flex:'0 0 390px' …>` jusqu'à sa fermeture, ~lignes 351-424) par :

```jsx
        {/* ---- DROITE : INVENTAIRE (grille partagée) ---- */}
        <div style={{ flex:'0 0 390px', minHeight:0, zIndex:2 }}>
          <InventoryGrid items={inventoryForGrid} coins={coins} filter={filter} setFilter={setFilter}
            onItemClick={openItemMenu} onCoinClick={openCoinMenu} onAdd={addItem}
            onDropItem={(id) => { if (slotOfItem(id)) unequip(id); }} capacity={120} />
        </div>
```

où `inventoryForGrid` = items non équipés :

```jsx
  const inventoryForGrid = {};
  for (const it of allItems) if (!equippedIds.has(it.id)) inventoryForGrid[it.id] = it;
```

(La grille filtre déjà `qty>0` en interne.)

- [ ] **Step 5 : Rendre les popovers (menu / stepper / éditeur)**

Avant la fermeture du composant (à côté du rendu du tooltip / useMenu existant — l'ancien `useMenu` de consommable est remplacé par `menu`), ajouter :

```jsx
      {menu && <ItemActionMenu item={menu.item} x={menu.x} y={menu.y} actions={menu.actions} onClose={() => setMenu(null)} />}
      {stepper && stepper.kind === 'item' && (
        <AmountStepper max={stepper.item.qty} x={stepper.x} y={stepper.y}
          label={`Envoyer combien de « ${stepper.item.name} » au commun ?`} confirmLabel="Envoyer"
          onConfirm={(n) => sendToCommon(stepper.item, n)} onClose={() => setStepper(null)} />
      )}
      {stepper && stepper.kind === 'coin' && (
        <AmountStepper max={stepper.max} x={stepper.x} y={stepper.y}
          label="Déposer combien au commun ?" confirmLabel="Déposer"
          onConfirm={(n) => moveCoins(`${charPath(char.id)}/coins`, SHARED_COINS, coins, sharedCoins || {}, stepper.coinKey, n)}
          onClose={() => setStepper(null)} />
      )}
      {editing && (
        <div className="modal-scrim" onClick={() => setEditing(null)} style={{ display:'flex', alignItems:'center', justifyContent:'center', zIndex:210 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width:'min(420px,92vw)', background:'var(--bg-deep)', border:'1px solid var(--line-gold)', borderRadius:12, padding:16 }}>
            <InvItemRow item={editing} editable={true} startEdit={true}
              onSave={(it) => { setInvItem(it.id, it); setEditing(null); }}
              onRemove={(id) => { removeInvItem(id); setEditing(null); }} />
          </div>
        </div>
      )}
```

> `InvItemRow` doit accepter un prop `startEdit` pour s'ouvrir directement en mode édition dans le modal. Ajouter dans `components.jsx` : `const [edit, setEdit] = useState(!!startEdit);` (signature `InvItemRow({ item, editable, onSave, onRemove, startEdit })`). Faire ce micro-ajustement ici.

- [ ] **Step 6 : Retirer l'ancien `useMenu` consommable**

Supprimer l'état `useMenu` / `openUseMenu` et le rendu associé (remplacés par `menu`/`openItemMenu`). Conserver `consumeItem` (appelé par l'action « Utiliser »). Conserver `tip`/tooltip.

- [ ] **Step 7 : Vérif syntaxe + commit**

Run: `npx esbuild pages-equip.jsx >/dev/null && echo OK` puis `npx esbuild components.jsx >/dev/null && echo OK`
Expected: OK / OK

```bash
git add pages-equip.jsx components.jsx
git commit -m "feat(inv): page Équipement sur InventoryGrid — menu d'actions, transferts, pièces vivantes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10 : Câblage page Inventaire commun (grille + sharedCoins + transferts vers perso)

**Files:**
- Modify: `pages-inventory.jsx` (`CommonInventoryPage` : remplacer `InventoryPanel` par `InventoryGrid` + menu + transferts + choix du perso destinataire)
- Test: vérif syntaxe + manuel

**Interfaces:**
- Consumes : `InventoryGrid`, `ItemActionMenu`, `AmountStepper`, `InvItemRow` (components), `useSharedInventory`, `useSharedCoins`, `useAuthIdentity`, `useAllCharStates`, `moveItem`, `moveCoins`, `SHARED_INV`, `SHARED_COINS`, `charPath`, `makeItem`, `CHARACTERS`, `isStaff`.

- [ ] **Step 1 : Réécrire `CommonInventoryPage`**

```jsx
function CommonInventoryPage() {
  const { items, setItem, removeItem } = useSharedInventory();
  const { coins: sharedCoins, setCoin: setSharedCoin } = useSharedCoins();
  const { role, charId } = useAuthIdentity();
  const all = useAllCharStates();
  const [filter, setFilter] = useState('all');
  const [menu, setMenu] = useState(null);
  const [stepper, setStepper] = useState(null);   // { kind, item|coinKey, dest, x, y, max }
  const [editing, setEditing] = useState(null);
  const [destPick, setDestPick] = useState(null);  // { item|coinKey, kind, x, y } pour le MJ

  const charInv = (id) => (all && all[id] && all[id].state && all[id].state.inventory) || {};
  const charCoins = (id) => (all && all[id] && all[id].state && all[id].state.coins) || { plat:0, or:0, arg:0, cuiv:0 };

  const takeItem = (item, n, destCharId) => {
    moveItem(SHARED_INV, `${charPath(destCharId)}/inventory`, items || {}, charInv(destCharId), item.id, n);
  };
  const takeCoins = (key, n, destCharId) => {
    moveCoins(SHARED_COINS, `${charPath(destCharId)}/coins`, sharedCoins || {}, charCoins(destCharId), key, n);
  };

  // Destinataire : joueur = sa fiche ; MJ/admin = sélection (destPick → liste de persos).
  const resolveDest = (onDest, e, payload) => {
    if (!isStaff(role)) { if (charId) onDest(charId); return; }
    setDestPick({ ...payload, x:e.clientX, y:e.clientY, onDest });
  };

  const openItemMenu = (item, e) => {
    e.stopPropagation();
    const actions = [
      { label:'Prendre', onClick:() => resolveDest((dest) => {
          if ((item.qty || 1) > 1) setStepper({ kind:'item', item, dest, x:e.clientX, y:e.clientY, max:item.qty });
          else takeItem(item, 1, dest);
        }, e, {}) },
      { label:'Éditer', onClick:() => setEditing(item) },
      { label:'Supprimer', danger:true, onClick:() => removeItem(item.id) },
    ];
    setMenu({ item, x:e.clientX, y:e.clientY, actions });
  };
  const openCoinMenu = (key, e) => {
    const max = (sharedCoins && sharedCoins[key]) || 0;
    if (max <= 0) return;
    resolveDest((dest) => setStepper({ kind:'coin', coinKey:key, dest, x:e.clientX, y:e.clientY, max }), e, {});
  };
  const addItem = () => { const it = makeItem({ cat:'Butin', name:'Nouvel objet' }); setItem(it.id, it); setEditing(it); };

  return (
    <div className="col" style={{ height:'100%', minHeight:0, padding:16 }}>
      <h2 style={{ marginBottom:4 }}>Inventaire commun</h2>
      <p className="dim" style={{ fontSize:13, marginBottom:12 }}>Coffre partagé de l'équipe. Cliquez un objet pour le prendre, l'éditer ou le supprimer.</p>
      <div style={{ flex:'1 1 auto', minHeight:0, maxWidth:760 }}>
        {items === null
          ? <div className="dim">Chargement…</div>
          : <InventoryGrid items={items} coins={sharedCoins} filter={filter} setFilter={setFilter}
              onItemClick={openItemMenu} onCoinClick={openCoinMenu} onAdd={addItem} title="INVENTAIRE COMMUN" capacity={240} />}
      </div>

      {menu && <ItemActionMenu item={menu.item} x={menu.x} y={menu.y} actions={menu.actions} onClose={() => setMenu(null)} />}
      {destPick && (
        <ItemActionMenu item={{ name:'Donner à…' }} x={destPick.x} y={destPick.y}
          actions={CHARACTERS.map(c => ({ label:c.name, onClick:() => destPick.onDest(c.id) }))}
          onClose={() => setDestPick(null)} />
      )}
      {stepper && stepper.kind === 'item' && (
        <AmountStepper max={stepper.max} x={stepper.x} y={stepper.y}
          label={`Prendre combien de « ${stepper.item.name} » ?`} confirmLabel="Prendre"
          onConfirm={(n) => takeItem(stepper.item, n, stepper.dest)} onClose={() => setStepper(null)} />
      )}
      {stepper && stepper.kind === 'coin' && (
        <AmountStepper max={stepper.max} x={stepper.x} y={stepper.y}
          label="Retirer combien du commun ?" confirmLabel="Retirer"
          onConfirm={(n) => takeCoins(stepper.coinKey, n, stepper.dest)} onClose={() => setStepper(null)} />
      )}
      {editing && (
        <div className="modal-scrim" onClick={() => setEditing(null)} style={{ display:'flex', alignItems:'center', justifyContent:'center', zIndex:210 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width:'min(420px,92vw)', background:'var(--bg-deep)', border:'1px solid var(--line-gold)', borderRadius:12, padding:16 }}>
            <InvItemRow item={editing} editable={true} startEdit={true}
              onSave={(it) => { setItem(it.id, it); setEditing(null); }}
              onRemove={(id) => { removeItem(id); setEditing(null); }} />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2 : Vérif syntaxe + commit**

Run: `npx esbuild pages-inventory.jsx >/dev/null && echo OK`
Expected: OK

```bash
git add pages-inventory.jsx
git commit -m "feat(inv): coffre commun en grille — transferts vers perso, pièces, choix destinataire (MJ)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 11 : Vérification finale (tests, syntaxe, manuel) + doc

**Files:**
- Modify: `CLAUDE.md` (sections Modèle de données, pages-equip/inventory, Décisions, État actuel)
- Test: suite complète

- [ ] **Step 1 : Logique pure**

Run: `node --test test/game-logic.test.js`
Expected: PASS (anciens + `type`, `coins`, `planItemTransfer`).

- [ ] **Step 2 : Syntaxe de tous les fichiers touchés**

Run: `for f in game-logic.js data.jsx data-state.jsx components.jsx pages-equip.jsx pages-inventory.jsx; do npx esbuild "$f" >/dev/null && echo "OK $f"; done`
Expected: OK pour chacun (note : `game-logic.js` est UMD, esbuild le parse aussi).

- [ ] **Step 3 : Validation JSON des règles**

Run: `node -e "JSON.parse(require('fs').readFileSync('database.rules.json','utf8')); console.log('JSON OK')"`
Expected: `JSON OK`

- [ ] **Step 4 : Test manuel (servir le site)**

Run (terminal séparé) : `python -m http.server 5050 --bind 127.0.0.1`
Vérifier (idéalement 2 onglets pour le temps réel) :
- Coffre commun = grille (icônes, badges qty, filtres, monnaie), bouton « + Ajouter ».
- Créer un item : Catégorie Équipement → champ Emplacement apparaît ; Conso/Butin → pas d'emplacement.
- Clic item perso (page Équipement) → menu (Équiper/Utiliser/Envoyer au commun/Éditer/Supprimer).
- « Envoyer au commun » d'une pile (qty>1) → sélecteur de montant ; qty=1 → direct. L'item apparaît côté commun (fusion si équivalent).
- Coffre commun → « Prendre » : joueur = sa fiche ; MJ = choix du perso. Pièces idem (Déposer/Retirer).
- Badge quantité visible (1/2/3…). Kéminite affichée en Butin (filtre Butin).

- [ ] **Step 5 : Mettre à jour `CLAUDE.md`**

Documenter : item `{…, type}` ; `state/coins` + `coinsInit` ; `sharedCoins` + règle RTDB (à republier) ; `InventoryGrid`/`ItemActionMenu`/`AmountStepper` ; coffre commun en grille ; transferts `moveItem`/`moveCoins` + `planItemTransfer` ; éditeur Catégorie+Emplacement ; Kéminite=Butin. Mettre à jour « État actuel » et retirer du backlog ce qui est fait.

- [ ] **Step 6 : Commit**

```bash
git add CLAUDE.md
git commit -m "docs(inv): CLAUDE.md — types d'items, pièces vivantes, transferts, grille commune

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (auteur du plan)

**Spec coverage :**
- Coffre commun en grille → Tasks 6, 10. ✅
- Transfert qty>1 = sélecteur de montant, qty=1 direct → Tasks 7, 9, 10. ✅
- Type = Catégorie + Emplacement → Tasks 1, 8. ✅
- Surfaces Équipement + Commun, fiche inchangée → Tasks 9, 10 (fiche non touchée). ✅
- Pièces vivantes + coffre commun + transfert + MJ ajuste → Tasks 2, 4, 9, 10. ✅
- Fusion auto (name+type+cat) → Task 3. ✅
- Destination joueur=sa fiche / MJ=choix → Task 10. ✅
- Règles RTDB sharedCoins → Task 5. ✅
- Fix Kéminite → Task 2. ✅
- Hors périmètre (mods) : non planifié, conforme. ✅

**Placeholder scan :** aucun TODO/TBD ; tout pas de code montre le code. ✅

**Type consistency :** `planItemTransfer(srcItems,dstItems,itemId,n)→{srcPatch,dstPatch}` cohérent (Tasks 3,4) ; `moveItem`/`moveCoins` signatures cohérentes (Tasks 4,9,10) ; `InventoryGrid` props cohérentes (Tasks 6,9,10) ; `InvItemRow` gagne `startEdit` (Tasks 8/9 micro-ajustement, utilisé en 9,10) ; `EQUIP_TYPES` (Task 1) consommé en Task 8. ✅

> Point d'attention pour l'implémenteur (Task 9) : `InvItemRow` reçoit `startEdit` — le micro-ajout de ce prop est décrit en Task 9 Step 5 ; si la Task 8 est faite par un autre worker, ajouter `startEdit` dès la Task 8 (signature `InvItemRow({ item, editable, onSave, onRemove, startEdit })`, `useState(!!startEdit)`).
