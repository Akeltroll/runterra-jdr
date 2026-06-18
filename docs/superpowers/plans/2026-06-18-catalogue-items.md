# Catalogue d'items pour l'ajout MJ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre au staff d'ajouter des items depuis un catalogue pré-enregistré (avec quantité, fusion et plafond de pile à 99) au lieu de remplir un item vierge.

**Architecture:** Logique pure de remplissage de piles (`fillStacks` + `planItemAdd`) dans `game-logic.js`, réutilisée aussi par `planItemTransfer`. Un catalogue de données `ITEM_CATALOG` dans `data.jsx`. Un composant modal réutilisable `ItemCatalogPicker` (`components.jsx`) branché sur les trois boutons « + Ajouter » du staff (Équipement, fiche, inventaire commun).

**Tech Stack:** React 18 + Babel standalone (CDN, zéro-build, fichiers `.jsx` via `<script type="text/babel">`). Logique pure en UMD testée par `node --test`. Firebase RTDB (compat) pour la persistance. Plateforme dev : Windows (PowerShell + Git Bash).

## Global Constraints

- Zéro-build : pas de bundler. Chaque fichier définit ses symboles puis `Object.assign(window, {…})` ; les autres scripts y accèdent par référence nue (résolue via `window`). Ordre de chargement dans `index.html` : firebase → firebase-config → game-logic → data → data-state → components → pages-* → shell.
- Logique pure dans `game-logic.js` uniquement (aucune dépendance React/DOM/Firebase) ; exposée via le `return {…}` de la factory UMD (ligne ~170).
- Édition réservée au staff : tout point d'ajout reste derrière `isStaff(role)` (déjà en place).
- Plafond de pile : `STACK_MAX = 99`. Seuls les nouveaux ajouts/transferts le respectent ; une pile déjà > 99 en base n'est pas re-découpée.
- Les pièces de bourse (`coins`/`sharedCoins`, images `piece-*.webp`) sont hors catalogue.
- Tests : `node --test test/game-logic.test.js test/auth.test.js` (26 verts actuellement). Syntaxe JSX : `npx esbuild <fichier>.jsx >/dev/null`.
- Aucune règle RTDB à modifier/republier.
- Messages de commit en français, terminés par `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1 : `STACK_MAX` + `fillStacks` + `planItemAdd` (logique pure)

**Files:**
- Modify: `game-logic.js` (ajouter après `planItemTransfer`, ~ligne 122 ; export ~ligne 170)
- Test: `test/game-logic.test.js` (ajouter après les tests `planItemTransfer`, ~ligne 163)

**Interfaces:**
- Consumes: `makeItem(p)`, `_sameKind(a, b)` (déjà dans le scope de la factory).
- Produces:
  - `STACK_MAX` = `99` (number)
  - `fillStacks(items, entry, qty)` → `patch` : objet `{ [itemId]: item }`. Remplit les piles existantes de même genre (`name`+`type`+`cat`) jusqu'à `STACK_MAX`, puis crée de nouvelles piles (≤ `STACK_MAX`) pour le surplus. `entry` = `{ cat, name, sub, ic, img, type, mods }`.
  - `planItemAdd(items, entry, qty)` → `{ patch }` (enveloppe `fillStacks`).

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à la fin de `test/game-logic.test.js` :

```javascript
test('fillStacks — inventaire vide crée une pile', () => {
  const patch = L.fillStacks({}, { name:'Potion', cat:'Consommables', type:'' }, 3);
  const piles = Object.values(patch);
  assert.equal(piles.length, 1);
  assert.equal(piles[0].qty, 3);
  assert.equal(piles[0].name, 'Potion');
});

test('fillStacks — fusionne dans une pile partielle de même genre', () => {
  const items = { z: L.makeItem({ id:'z', name:'Potion', cat:'Consommables', qty:5 }) };
  const patch = L.fillStacks(items, { name:'Potion', cat:'Consommables', type:'' }, 4);
  assert.equal(patch.z.qty, 9);
  assert.equal(Object.keys(patch).length, 1);
});

test('fillStacks — déborde au-delà de STACK_MAX (95 + 10 => 99 + 6)', () => {
  const items = { z: L.makeItem({ id:'z', name:'Potion', cat:'Consommables', qty:95 }) };
  const patch = L.fillStacks(items, { name:'Potion', cat:'Consommables', type:'' }, 10);
  assert.equal(patch.z.qty, 99);
  const others = Object.entries(patch).filter(([k]) => k !== 'z').map(([, v]) => v);
  assert.equal(others.length, 1);
  assert.equal(others[0].qty, 6);
});

test('fillStacks — 100 dans un inventaire vide => 99 + 1', () => {
  const patch = L.fillStacks({}, { name:'Potion', cat:'Consommables', type:'' }, 100);
  const qtys = Object.values(patch).map(p => p.qty).sort((a, b) => b - a);
  assert.deepEqual(qtys, [99, 1]);
});

test('fillStacks — ne fusionne pas des items de genre différent', () => {
  const items = { z: L.makeItem({ id:'z', name:'Potion', cat:'Consommables', qty:5 }) };
  const patch = L.fillStacks(items, { name:'Épée', cat:'Équipement', type:'weapon' }, 1);
  assert.equal(patch.z, undefined);
  assert.equal(Object.values(patch)[0].name, 'Épée');
});

test('fillStacks — STACK_MAX vaut 99', () => {
  assert.equal(L.STACK_MAX, 99);
});

test('planItemAdd — enveloppe fillStacks et renvoie { patch }', () => {
  const r = L.planItemAdd({}, { name:'Potion', cat:'Consommables', type:'' }, 2);
  assert.ok(r.patch);
  assert.equal(Object.values(r.patch)[0].qty, 2);
});
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `node --test test/game-logic.test.js`
Expected: FAIL (`L.fillStacks is not a function`, `L.planItemAdd is not a function`, `L.STACK_MAX` undefined).

- [ ] **Step 3: Implémenter `STACK_MAX`, `fillStacks`, `planItemAdd`**

Dans `game-logic.js`, juste après la fonction `planItemTransfer` (après sa `}` de fin, ~ligne 122) :

```javascript
  /* --- Plafond de pile + ajout depuis un catalogue (logique pure) --- */
  var STACK_MAX = 99;

  function fillStacks(items, entry, qty) {
    items = items || {};
    var patch = {};
    var remaining = qty | 0;
    if (remaining <= 0) return patch;
    // 1) remplir les piles existantes de même genre, sous le plafond
    for (var k in items) {
      if (remaining <= 0) break;
      var it = items[k];
      if (!_sameKind(it, entry)) continue;
      var cur = it.qty || 0;
      if (cur >= STACK_MAX) continue;
      var space = STACK_MAX - cur;
      var add = Math.min(space, remaining);
      patch[k] = Object.assign({}, it, { qty: cur + add });
      remaining -= add;
    }
    // 2) créer de nouvelles piles (≤ STACK_MAX) pour le surplus
    while (remaining > 0) {
      var take = Math.min(STACK_MAX, remaining);
      var fresh = makeItem({
        cat: entry.cat, name: entry.name, sub: entry.sub, qty: take,
        ic: entry.ic, img: entry.img, type: entry.type, mods: entry.mods,
      });
      patch[fresh.id] = fresh;
      remaining -= take;
    }
    return patch;
  }

  function planItemAdd(items, entry, qty) {
    return { patch: fillStacks(items, entry, qty) };
  }
```

Puis ajouter les symboles au `return {…}` final (~ligne 170). Remplacer :

```javascript
    EQUIP_TYPES, planItemTransfer,
```

par :

```javascript
    EQUIP_TYPES, planItemTransfer,
    STACK_MAX, fillStacks, planItemAdd,
```

- [ ] **Step 4: Lancer les tests pour vérifier le succès**

Run: `node --test test/game-logic.test.js`
Expected: PASS (tous les nouveaux tests verts, anciens toujours verts).

- [ ] **Step 5: Commit**

```bash
git add game-logic.js test/game-logic.test.js
git commit -m "feat(inv): fillStacks/planItemAdd + STACK_MAX (plafond de pile 99)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2 : Refactor `planItemTransfer` pour respecter le plafond

**Files:**
- Modify: `game-logic.js` (corps de `planItemTransfer`, ~lignes 109-120)
- Test: `test/game-logic.test.js` (ajouter un cas de débordement)

**Interfaces:**
- Consumes: `fillStacks` (Task 1), `makeItem`.
- Produces: `planItemTransfer(srcItems, dstItems, itemId, n)` → `{ srcPatch, dstPatch }` inchangé en signature ; le crédit destination passe désormais par `fillStacks` (fusion + débordement à 99).

- [ ] **Step 1: Écrire le test de débordement qui échoue**

Ajouter à `test/game-logic.test.js` (après les tests `planItemTransfer` existants) :

```javascript
test('planItemTransfer — crédit qui dépasse 99 déborde côté destination', () => {
  const src = { a: L.makeItem({ id:'a', name:'Potion', cat:'Consommables', qty:10 }) };
  const dst = { z: L.makeItem({ id:'z', name:'Potion', cat:'Consommables', qty:95 }) };
  const { srcPatch, dstPatch } = L.planItemTransfer(src, dst, 'a', 10);
  assert.equal(srcPatch.a, null);                 // 10 déplacés => source vidée
  assert.equal(dstPatch.z.qty, 99);               // pile existante remplie au max
  const extra = Object.entries(dstPatch).filter(([k]) => k !== 'z').map(([, v]) => v);
  assert.equal(extra.length, 1);
  assert.equal(extra[0].qty, 6);                  // surplus dans une nouvelle pile
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `node --test test/game-logic.test.js`
Expected: FAIL (l'ancien code fusionne dans `z` → `z.qty` = 105, pas de pile supplémentaire).

- [ ] **Step 3: Refactorer le crédit destination via `fillStacks`**

Dans `game-logic.js`, remplacer le bloc de `planItemTransfer` qui construit `dstPatch` (de `var dstPatch = {};` jusqu'à juste avant `return { srcPatch: srcPatch, dstPatch: dstPatch };`) par :

```javascript
    var dstPatch = fillStacks(dstItems, {
      cat: src.cat, name: src.name, sub: src.sub,
      ic: src.ic, img: src.img, type: src.type, mods: src.mods,
    }, move);
```

(Supprime l'ancienne recherche `twinId`/`twin` et la création manuelle `fresh` — `fillStacks` s'en charge.)

- [ ] **Step 4: Lancer tous les tests**

Run: `node --test test/game-logic.test.js test/auth.test.js`
Expected: PASS (nouveau cas + les 5 cas `planItemTransfer` existants toujours verts).

- [ ] **Step 5: Commit**

```bash
git add game-logic.js test/game-logic.test.js
git commit -m "refactor(inv): planItemTransfer crédite via fillStacks (plafond 99)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3 : `ITEM_CATALOG` dans `data.jsx` + correction catégorie kéminite

**Files:**
- Modify: `data.jsx` (ajouter la constante avant l'`Object.assign(window,…)` ~ligne 250 ; corriger `cat` de la kéminite dans les inventaires par défaut, ~lignes 124 et 138)

**Interfaces:**
- Produces: `window.ITEM_CATALOG` — tableau d'entrées `{ cat, name, sub, ic, img, type }`.

- [ ] **Step 1: Corriger la catégorie de la kéminite dans les inventaires par défaut**

Dans `data.jsx`, l'item kéminite de Rathäel (~ligne 124) :

```javascript
      { cat:'Butin', name:'Kéminite', sub:'Sert à appeler Taliyah', qty:1, ic:'🔮', img:'ATH/Items/keminite.webp', type:'' },
```

devient :

```javascript
      { cat:'Consommables', name:'Kéminite', sub:'Sert à appeler Taliyah', qty:1, ic:'🔮', img:'ATH/Items/keminite.webp', type:'' },
```

Et celui d'Urskaar (~ligne 138) :

```javascript
      { cat:'Butin', name:'Kéminite', sub:'Appel Taliyah', qty:1, ic:'🔮', img:'ATH/Items/keminite.webp' },
```

devient :

```javascript
      { cat:'Consommables', name:'Kéminite', sub:'Appel Taliyah', qty:1, ic:'🔮', img:'ATH/Items/keminite.webp' },
```

- [ ] **Step 2: Ajouter la constante `ITEM_CATALOG`**

Dans `data.jsx`, juste avant `Object.assign(window, {` (~ligne 250) :

```javascript
/* --- Catalogue d'items pré-enregistrés (ajout rapide par le staff) ---
   Entrées sans id/qty (générés à l'ajout). Paliers de potions = proposition
   ajustable. Pièces de bourse exclues (système coins séparé). */
const ITEM_CATALOG = [
  // Consommables — potions de soin
  { cat:'Consommables', name:'Potion soin mineur',        sub:'Rend 15 + 15% HP',  ic:'🧪', img:'ATH/Items/potion-soin-mineur.webp',        type:'' },
  { cat:'Consommables', name:'Potion soin intermédiaire', sub:'Rend 30 + 20% HP',  ic:'🧪', img:'ATH/Items/potion-soin-intermediaire.webp', type:'' },
  { cat:'Consommables', name:'Potion soin avancé',        sub:'Rend 50 + 25% HP',  ic:'🧪', img:'ATH/Items/potion-soin-avance.webp',        type:'' },
  { cat:'Consommables', name:'Potion soin ultime',        sub:'Rend 100 + 30% HP', ic:'🧪', img:'ATH/Items/potion-soin-ultime.webp',        type:'' },
  // Consommables — potions de mana
  { cat:'Consommables', name:'Potion mana mineur',        sub:'Rend 10 + 10% Mana', ic:'🔵', img:'ATH/Items/potion-mana-mineur.webp',        type:'' },
  { cat:'Consommables', name:'Potion mana intermédiaire', sub:'Rend 25 + 15% Mana', ic:'🔵', img:'ATH/Items/potion-mana-intermediaire.webp', type:'' },
  { cat:'Consommables', name:'Potion mana avancé',        sub:'Rend 40 + 20% Mana', ic:'🔵', img:'ATH/Items/potion-mana-avance.webp',        type:'' },
  { cat:'Consommables', name:'Potion mana ultime',        sub:'Rend 75 + 25% Mana', ic:'🔵', img:'ATH/Items/potion-mana-ultime.webp',        type:'' },
  // Consommables — divers
  { cat:'Consommables', name:'Potion néfaste inconnue',   sub:'Effet inconnu — à vos risques', ic:'☠', img:'ATH/Items/potion-nefaste-inconnu.webp', type:'' },
  { cat:'Consommables', name:'Kéminite',                  sub:'Sert à appeler Taliyah', ic:'🔮', img:'ATH/Items/keminite.webp',               type:'' },
  { cat:'Consommables', name:'Cristal explosif',          sub:'Explose à l\'impact',    ic:'💥', img:'ATH/Items/cristal-explosif.webp',        type:'' },
  { cat:'Consommables', name:'Cristal très explosif',     sub:'Explosion majeure',      ic:'💥', img:'ATH/Items/cristal-tres-explosif.webp',   type:'' },
  // Butin
  { cat:'Butin', name:'Relique lunaire',        sub:'Connexion astrale (lune)',   ic:'🌙', img:'ATH/Items/relique-lunaire.webp',     type:'' },
  { cat:'Butin', name:'Relique solaire',        sub:'Connexion astrale (soleil)', ic:'☀', img:'ATH/Items/relique-solaire.webp',     type:'' },
  { cat:'Butin', name:'Pierre de transmutation', sub:'Transmute la matière',      ic:'🪨', img:'ATH/Items/pierre-transmutation.webp', type:'' },
  { cat:'Butin', name:'Butin de monstre',       sub:'Dépouille à revendre',       ic:'🦴', img:'ATH/Items/loot-mob.webp',           type:'' },
  { cat:'Butin', name:'Carte',                  sub:'Indique un lieu',            ic:'🗺', img:'ATH/Items/carte.webp',              type:'' },
  { cat:'Butin', name:'Boussole',               sub:'Indique le nord',            ic:'🧭', img:'ATH/Items/boussole.webp',           type:'' },
  { cat:'Butin', name:'Parchemin',              sub:'Texte ancien',               ic:'📜', img:'ATH/Items/parchemin.webp',          type:'' },
  { cat:'Butin', name:'Gourde',                 sub:'Contient de l\'eau',         ic:'🧴', img:'ATH/Items/gourde.webp',             type:'' },
  { cat:'Butin', name:'Boîte à outils',         sub:'Outils de réparation',       ic:'🧰', img:'ATH/Items/boite-a-outils.webp',     type:'' },
  { cat:'Butin', name:'Livre : L\'Histoire de Runeterra', sub:'Lecture',          ic:'📖', img:'ATH/Items/livre-histoire.webp',     type:'' },
  { cat:'Butin', name:'Tricorne',               sub:'Couvre-chef de pirate',      ic:'🎩', img:'ATH/Items/tricorne.webp',           type:'' },
  // Équipement — armes (dague => accessory ; autres => weapon)
  { cat:'Équipement', name:'Claymore',         sub:'2H · +10 AD (fin de traversée)', ic:'⚔', img:'ATH/Armes/claymore.webp',      type:'weapon' },
  { cat:'Équipement', name:'Épée + Bouclier',  sub:'1H',                              ic:'🛡', img:'ATH/Armes/epee-bouclier.webp', type:'weapon' },
  { cat:'Équipement', name:'Épée courte',      sub:'1H',                              ic:'⚔', img:'ATH/Armes/epee-courte.webp',   type:'weapon' },
  { cat:'Équipement', name:'Épée non identifiée', sub:'Non identifiée',               ic:'⚔', img:'ATH/Armes/epee-ni.webp',       type:'weapon' },
  { cat:'Équipement', name:'Arbalète légère',  sub:'Portée',                          ic:'🎯', img:'ATH/Armes/arbalete.webp',      type:'weapon' },
  { cat:'Équipement', name:'Arc hextech',      sub:'Portée · Physique',               ic:'🏹', img:'ATH/Armes/arc-hextech.webp',   type:'weapon' },
  { cat:'Équipement', name:'Gantelet renforcé', sub:'1H',                             ic:'🥊', img:'ATH/Armes/gantelet.webp',      type:'weapon' },
  { cat:'Équipement', name:'Hachette',         sub:'Arme secondaire · brisage',       ic:'🪓', img:'ATH/Armes/hachette.webp',      type:'weapon' },
  { cat:'Équipement', name:'Dague',            sub:'1H',                              ic:'🗡', img:'ATH/Armes/dague.webp',         type:'accessory' },
];
```

Puis l'ajouter à l'export. Remplacer :

```javascript
  computeStats, computeAttack, CHARACTERS, BUFFS, WEAPONS,
  LEVELS, ATTRIBUTES, JOURNAL, RUNE,
```

par :

```javascript
  computeStats, computeAttack, CHARACTERS, BUFFS, WEAPONS,
  LEVELS, ATTRIBUTES, JOURNAL, RUNE, ITEM_CATALOG,
```

- [ ] **Step 3: Vérifier la syntaxe**

Run: `npx esbuild data.jsx >/dev/null`
Expected: aucune sortie (succès).

- [ ] **Step 4: Commit**

```bash
git add data.jsx
git commit -m "feat(inv): ITEM_CATALOG + kéminite passe en Consommables

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4 : Composant `ItemCatalogPicker` + badge OR + prop `onAdd` sur `InventoryPanel`

**Files:**
- Modify: `components.jsx` (badge qty ~ligne 462 ; nouveau composant `ItemCatalogPicker` avant le bloc `Object.assign` ~ligne 646 ; signature + bouton de `InventoryPanel` ~lignes 622-634 ; export ~ligne 651)

**Interfaces:**
- Consumes: `INV_FILTERS`, `AmountStepper`, `window.ITEM_CATALOG`, `makeItem` (tous globaux).
- Produces:
  - `ItemCatalogPicker({ initialFilter, onPick, onCustom, onClose })` — modal. `onPick(entry, qty)` appelé après le stepper ; `onCustom()` pour l'item vierge ; `onClose()` pour fermer.
  - `InventoryPanel({ items, editable, onSave, onRemove, onAdd })` — nouveau prop optionnel `onAdd(cat)` : si fourni, « + Ajouter » délègue au parent ; sinon comportement vierge interne inchangé.

- [ ] **Step 1: Passer le badge de quantité en OR**

Dans `components.jsx`, dans `InventoryGrid` (~ligne 460-463), remplacer la couleur du badge :

```javascript
                {item && item.qty > 1 && (
                  <span style={{ position:'absolute', right:3, bottom:1, fontFamily:"'EB Garamond',serif",
                    fontSize:13, fontWeight:600, color:'#f0e6d2', textShadow:'0 1px 3px #000,0 0 5px #000',
                    pointerEvents:'none', zIndex:1 }}>{invFmt(item.qty)}</span>
                )}
```

par (seul `color` change : crème → doré) :

```javascript
                {item && item.qty > 1 && (
                  <span style={{ position:'absolute', right:3, bottom:1, fontFamily:"'EB Garamond',serif",
                    fontSize:13, fontWeight:700, color:'#eccf8f', textShadow:'0 1px 3px #000,0 0 5px #000',
                    pointerEvents:'none', zIndex:1 }}>{invFmt(item.qty)}</span>
                )}
```

- [ ] **Step 2: Ajouter le prop `onAdd(cat)` à `InventoryPanel`**

Remplacer la signature (~ligne 622) :

```javascript
function InventoryPanel({ items, editable, onSave, onRemove }) {
```

par :

```javascript
function InventoryPanel({ items, editable, onSave, onRemove, onAdd }) {
```

et le bouton « + Ajouter » (~ligne 634) :

```javascript
              {editable && <button className="btn btn-sm btn-ghost" onClick={() => add(cat)}>+ Ajouter</button>}
```

par (délègue à `onAdd` si fourni, sinon ajout vierge interne) :

```javascript
              {editable && <button className="btn btn-sm btn-ghost" onClick={() => (onAdd ? onAdd(cat) : add(cat))}>+ Ajouter</button>}
```

- [ ] **Step 3: Ajouter le composant `ItemCatalogPicker`**

Dans `components.jsx`, juste avant le bloc final `Object.assign(window, {` (~ligne 646) :

```javascript
/* --- Catalogue d'items : modal de sélection rapide (staff) ---
   Clic sur une entrée -> AmountStepper -> onPick(entry, qty).
   Le scrim est sous le zIndex de l'AmountStepper (200) pour qu'il s'affiche par-dessus. */
function ItemCatalogPicker({ initialFilter, onPick, onCustom, onClose }) {
  const [filter, setFilter] = useState(initialFilter || 'all');
  const [picked, setPicked] = useState(null);   // { entry, x, y }
  const list = (window.ITEM_CATALOG || []).filter(e => filter === 'all' || e.cat === filter);
  return (
    <div className="modal-scrim" onClick={onClose}
      style={{ display:'flex', alignItems:'center', justifyContent:'center', zIndex:190 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width:'min(560px,94vw)', maxHeight:'88vh',
        display:'flex', flexDirection:'column', background:'var(--bg-deep)',
        border:'1px solid var(--line-gold)', borderRadius:12, padding:16 }}>
        <div className="row" style={{ justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <h3 style={{ margin:0 }}>Catalogue d'objets</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div style={{ display:'flex', gap:4, marginBottom:12 }}>
          {INV_FILTERS.map(ft => (
            <button key={ft.key} className={'btn btn-sm ' + (filter === ft.key ? 'btn-gold' : 'btn-ghost')}
              style={{ flex:1 }} onClick={() => setFilter(ft.key)}>{ft.label}</button>
          ))}
        </div>
        <div style={{ flex:'1 1 auto', overflowY:'auto', minHeight:0, display:'grid',
          gridTemplateColumns:'repeat(auto-fill,minmax(92px,1fr))', gap:8 }}>
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
        </div>
        <div className="row" style={{ justifyContent:'space-between', alignItems:'center',
          marginTop:12, paddingTop:12, borderTop:'1px solid var(--line)' }}>
          <button className="btn btn-sm btn-ghost" onClick={onCustom}>+ Objet personnalisé</button>
          <span className="faint" style={{ fontSize:11 }}>{list.length} objets</span>
        </div>
      </div>
      {picked && (
        <AmountStepper max={999} x={picked.x} y={picked.y}
          label={`Ajouter combien de « ${picked.entry.name} » ?`} confirmLabel="Ajouter"
          onConfirm={(n) => { onPick(picked.entry, n); setPicked(null); }}
          onClose={() => setPicked(null)} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Exporter `ItemCatalogPicker`**

Dans le bloc `Object.assign(window, {` (~ligne 651), remplacer :

```javascript
  AmountStepper, ItemActionMenu,
```

par :

```javascript
  AmountStepper, ItemActionMenu, ItemCatalogPicker,
```

- [ ] **Step 5: Vérifier la syntaxe**

Run: `npx esbuild components.jsx >/dev/null`
Expected: aucune sortie (succès).

- [ ] **Step 6: Commit**

```bash
git add components.jsx
git commit -m "feat(inv): ItemCatalogPicker + badge qty OR + InventoryPanel onAdd

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5 : Brancher le picker sur la page Équipement

**Files:**
- Modify: `pages-equip.jsx` (état ~ligne 90 ; `onAdd` de la grille ~ligne 370 ; rendu du picker ~ligne 449, juste avant la fermeture de `EquipBody`)

**Interfaces:**
- Consumes: `ItemCatalogPicker`, `planItemAdd`, `setInvItem`, `addItem`, `inventoryForGrid`, `toast`, `staff`, `char` (tous déjà dans `EquipBody`).

- [ ] **Step 1: Ajouter l'état du picker**

Dans `pages-equip.jsx`, après la ligne `const [editing, setEditing] = useState(null);` (~ligne 90) :

```javascript
  const [catalog, setCatalog] = useState(false);   // ouverture du catalogue d'ajout
```

- [ ] **Step 2: Ouvrir le picker depuis le « + » de la grille**

Remplacer (~ligne 370-371) :

```javascript
          <InventoryGrid items={inventoryForGrid} coins={coins} filter={filter} setFilter={setFilter}
            onItemClick={openItemMenu} onCoinClick={openCoinMenu} onAdd={staff ? addItem : undefined}
```

par :

```javascript
          <InventoryGrid items={inventoryForGrid} coins={coins} filter={filter} setFilter={setFilter}
            onItemClick={openItemMenu} onCoinClick={openCoinMenu} onAdd={staff ? () => setCatalog(true) : undefined}
```

- [ ] **Step 3: Rendre le picker**

Dans `pages-equip.jsx`, juste après le bloc `{editing && ( … )}` (~ligne 449), avant le `</div>` de fin de `EquipBody` :

```javascript
      {catalog && (
        <ItemCatalogPicker
          onPick={(entry, n) => {
            const { patch } = planItemAdd(inventoryForGrid, entry, n);
            Object.entries(patch).forEach(([id, it]) => setInvItem(id, it));
            setCatalog(false);
            toast(`<b>${char.name}</b> — ${entry.name} ×${n} ajouté`, 'gold');
          }}
          onCustom={() => { setCatalog(false); addItem(); }}
          onClose={() => setCatalog(false)} />
      )}
```

- [ ] **Step 4: Vérifier la syntaxe**

Run: `npx esbuild pages-equip.jsx >/dev/null`
Expected: aucune sortie (succès).

- [ ] **Step 5: Commit**

```bash
git add pages-equip.jsx
git commit -m "feat(equip): bouton + Ajouter ouvre le catalogue d'items

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6 : Brancher le picker sur la fiche joueur (par catégorie)

**Files:**
- Modify: `pages-sheet.jsx` (`BuffInvColumn` : état + `onAdd` sur `InventoryPanel` + rendu du picker, ~lignes 103-153)

**Interfaces:**
- Consumes: `ItemCatalogPicker`, `planItemAdd`, `makeItem`, props existants `inventory`, `onSaveItem(id, it)`, `canEdit`.

- [ ] **Step 1: Ajouter l'état du picker dans `BuffInvColumn`**

Dans `pages-sheet.jsx`, au début du corps de `BuffInvColumn` (après `const active = new Set(activeBuffs);`, ~ligne 105) :

```javascript
  const [catCat, setCatCat] = useState(null);   // catégorie pré-filtrée ; null = picker fermé
```

- [ ] **Step 2: Déléguer « + Ajouter » au picker**

Remplacer l'appel `InventoryPanel` (~ligne 147) :

```javascript
          <InventoryPanel items={inventory} editable={canEdit} onSave={(it) => onSaveItem(it.id, it)} onRemove={onRemoveItem} />
```

par :

```javascript
          <InventoryPanel items={inventory} editable={canEdit} onSave={(it) => onSaveItem(it.id, it)}
            onRemove={onRemoveItem} onAdd={canEdit ? (cat) => setCatCat(cat) : undefined} />
```

- [ ] **Step 3: Rendre le picker**

Dans `BuffInvColumn`, juste avant le `</div>` final qui ferme le `return` (après le dernier `</div>` de la colonne, ~ligne 154), ajouter (à l'intérieur du conteneur racine `<div className="col gap-5">`) :

```javascript
      {catCat && (
        <ItemCatalogPicker initialFilter={catCat}
          onPick={(entry, n) => {
            const { patch } = planItemAdd(inventory, entry, n);
            Object.entries(patch).forEach(([id, it]) => onSaveItem(id, it));
            setCatCat(null);
          }}
          onCustom={() => { const it = makeItem({ cat: catCat, name:'Nouvel objet' }); onSaveItem(it.id, it); setCatCat(null); }}
          onClose={() => setCatCat(null)} />
      )}
```

- [ ] **Step 4: Vérifier la syntaxe**

Run: `npx esbuild pages-sheet.jsx >/dev/null`
Expected: aucune sortie (succès).

- [ ] **Step 5: Commit**

```bash
git add pages-sheet.jsx
git commit -m "feat(sheet): + Ajouter ouvre le catalogue (pré-filtré par catégorie)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7 : Brancher le picker sur l'inventaire commun

**Files:**
- Modify: `pages-inventory.jsx` (`CommonInventoryPage` : état ~ligne 89 ; `onAdd` ~ligne 133 ; rendu du picker ~ligne 166, avant le `</div>` de fin)

**Interfaces:**
- Consumes: `ItemCatalogPicker`, `planItemAdd`, `setItem` (de `useSharedInventory`), `addItem`, `items`, `staff`.

- [ ] **Step 1: Ajouter l'état du picker**

Dans `pages-inventory.jsx`, après `const [destPick, setDestPick] = useState(null);` (~ligne 90) :

```javascript
  const [catalog, setCatalog] = useState(false);   // ouverture du catalogue d'ajout
```

- [ ] **Step 2: Ouvrir le picker depuis le « + »**

Remplacer (~ligne 132-134) :

```javascript
            : <InventoryGrid items={items} coins={sharedCoins} filter={filter} setFilter={setFilter}
                onItemClick={(item) => setSelectedId(item.id)} onCoinClick={openCoinMenu} onAdd={staff ? addItem : undefined}
                title="INVENTAIRE COMMUN" capacity={240} />}
```

par :

```javascript
            : <InventoryGrid items={items} coins={sharedCoins} filter={filter} setFilter={setFilter}
                onItemClick={(item) => setSelectedId(item.id)} onCoinClick={openCoinMenu} onAdd={staff ? () => setCatalog(true) : undefined}
                title="INVENTAIRE COMMUN" capacity={240} />}
```

- [ ] **Step 3: Rendre le picker**

Dans `pages-inventory.jsx`, juste après le bloc `{editing && ( … )}` (~ligne 166), avant le `</div>` de fin de `CommonInventoryPage` :

```javascript
      {catalog && (
        <ItemCatalogPicker
          onPick={(entry, n) => {
            const { patch } = planItemAdd(items || {}, entry, n);
            Object.entries(patch).forEach(([id, it]) => setItem(id, it));
            setCatalog(false);
          }}
          onCustom={() => { setCatalog(false); addItem(); }}
          onClose={() => setCatalog(false)} />
      )}
```

- [ ] **Step 4: Vérifier la syntaxe**

Run: `npx esbuild pages-inventory.jsx >/dev/null`
Expected: aucune sortie (succès).

- [ ] **Step 5: Commit**

```bash
git add pages-inventory.jsx
git commit -m "feat(inv-commun): + Ajouter ouvre le catalogue d'items

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8 : Mise à jour de la documentation (CLAUDE.md)

**Files:**
- Modify: `CLAUDE.md` (carte des fichiers, décisions figées, état actuel)

- [ ] **Step 1: Mettre à jour CLAUDE.md**

Appliquer ces changements de contenu :

1. Dans la section `game-logic.js` de la carte des fichiers, ajouter après la mention de `planItemTransfer` : la constante `STACK_MAX` (=99), `fillStacks(items,entry,qty)` (remplissage de piles + débordement, logique pure testée) et `planItemAdd(items,entry,qty)` ; préciser que `planItemTransfer` crédite désormais la destination via `fillStacks` (plafond 99).
2. Dans la section `data.jsx`, ajouter `ITEM_CATALOG` (catalogue d'items pré-enregistrés pour l'ajout staff).
3. Dans la section `components.jsx`, ajouter `ItemCatalogPicker` (modal de sélection rapide) et noter le prop `onAdd(cat)` de `InventoryPanel` (délègue l'ajout au parent) + badge quantité en OR.
4. Dans « Décisions figées », corriger la ligne Kéminite : **Kéminite = Consommable** (au lieu de Butin) — catalogue + inventaires par défaut. Ajouter une ligne : **Plafond de pile = 99** (`STACK_MAX`), débordement automatique sur une nouvelle case, appliqué à l'ajout catalogue et aux transferts.
5. Dans « État actuel », ajouter une entrée datée 2026-06-18 : catalogue d'items + picker branché sur les 3 « + Ajouter » staff, plafond de pile 99, badge OR ; tests verts (game-logic+auth) ; aucune règle RTDB à republier.

- [ ] **Step 2: Lancer la suite de tests complète (non-régression)**

Run: `node --test test/game-logic.test.js test/auth.test.js`
Expected: PASS (tous verts).

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: catalogue d'items, STACK_MAX, kéminite -> Consommable

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Vérification manuelle finale (après Task 7, avant Task 8 ou en parallèle)

Servir le site (`python -m http.server 5050 --bind 127.0.0.1`), se connecter en MJ :

1. **Page Équipement** → « + Ajouter » → le catalogue s'ouvre → onglets de filtre OK → clic « Potion soin mineur » → stepper → mettre 3 → « Ajouter » → la potion apparaît en grille, badge **3 doré** en bas à droite.
2. Réajouter la même potion ×98 → vérifier le **débordement** : une case 99 + une case 2 (fusion + nouvelle pile).
3. **Fiche joueur** (plein écran MJ) → « + Ajouter » sous *Consommables* → le catalogue s'ouvre **pré-filtré** sur Consommables.
4. **Inventaire commun** → « + Ajouter » → catalogue → ajout → item visible, temps réel (vérifier sur un 2e onglet).
5. **« + Objet personnalisé »** dans le picker → crée bien un item vierge éditable (filet de sécurité).
6. Se connecter en **joueur** : aucun « + Ajouter » visible (verrouillage staff intact).

## Self-Review (auteur du plan)

- **Couverture spec :** catalogue (T3) ; picker réutilisable + onPick/onCustom (T4) ; fillStacks/planItemAdd + STACK_MAX (T1) ; refactor planItemTransfer (T2) ; badge OR (T4) ; branchements ×3 (T5/T6/T7) ; kéminite→Consommable (T3) ; doc (T8). ✅
- **Placeholders :** aucun — code complet à chaque étape. ✅
- **Cohérence des types :** `fillStacks(items, entry, qty)` → `patch {id:item}` ; `planItemAdd` → `{ patch }` ; appliqué partout via `Object.entries(patch).forEach(([id,it]) => setX(id, it))`. `ItemCatalogPicker` props identiques sur les 3 pages. ✅
- **Note z-index :** le scrim du picker est à `zIndex:190` (< 200) pour que l'`AmountStepper` (z200) s'affiche par-dessus.
