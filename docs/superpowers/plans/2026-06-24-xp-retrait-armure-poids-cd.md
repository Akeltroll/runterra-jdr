# Retrait XP · Fusion Armure · Poids · CD visible — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter le retrait d'XP (MJ), fusionner les 4 slots d'armure en un seul, introduire un système de poids porté (affichage seul), et afficher le cooldown intrinsèque sur les cartes de Combat.

**Architecture:** Logique pure ajoutée à `game-logic.js` (testée en Node), orchestrateur d'écriture dans `data-state.jsx`, UI dans `pages-mj.jsx` / `pages-equip.jsx` / `pages-sheet.jsx` / `pages-competences.jsx` / `components.jsx`. Tout l'état vit dans `characters/$charId/state` et des champs d'items déjà autorisés.

**Tech Stack:** Zéro-build (React 18 + Babel standalone via CDN), `game-logic.js` (UMD), Firebase RTDB compat, tests `node --test`.

## Global Constraints

- **Zéro build** : chaque `.jsx`/`.js` définit localement puis `Object.assign(window, {...})`. Accès aux autres modules par référence nue (résolue via `window`).
- **Aucune nouvelle règle RTDB** : état dans `characters/$charId/state` ; champs d'items (`weight`/`carry`) couverts par les `.validate` existants (non restrictifs sur ces clés).
- **Vérif syntaxe** : `npx esbuild <fichier> >/dev/null`. **Tests** : `node --test test/game-logic.test.js test/auth.test.js`.
- **Déploiement** : bumper le jeton `?v=` dans `index.html` (+ `window.APPV`).
- **Env** : Windows, git via PowerShell (`git` indisponible dans Bash). `node`/`npx` OK dans les deux.

---

### Task 1 : Retrait d'XP (logique pure + orchestrateur + UI MJ)

**Files:**
- Modify: `game-logic.js` (ajout `applyXpLoss` après `applyXp` ~ligne 705 ; export ~ligne 717)
- Modify: `data-state.jsx` (ajout `removeXp` après `addXp` ~ligne 199 ; export)
- Modify: `pages-mj.jsx:113-122` (bouton « − XP »)
- Test: `test/game-logic.test.js`

**Interfaces:**
- Consumes: `xpToNext`, `MAX_LEVEL` (déjà dans `game-logic.js`), `addXp`/`charPath`/`pushLog` (patterns existants).
- Produces:
  - `applyXpLoss(level, xp, loss) -> { level, xp, levelsLost }`
  - `removeXp(charId, loss) -> Promise<{ level, xp, levelsLost }>`

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à la fin de `test/game-logic.test.js` :

```js
/* --- Retrait d'XP : applyXpLoss --- */
test('applyXpLoss : retrait simple dans le niveau courant', () => {
  assert.deepEqual(L.applyXpLoss(3, 200, 50), { level: 3, xp: 150, levelsLost: 0 });
});
test('applyXpLoss : cascade d\'un niveau (miroir applyXp)', () => {
  // xpToNext(4) = 180 + 100*4 = 580 ; perdre 30 depuis niv5/xp0 -> niv4/xp550
  assert.deepEqual(L.applyXpLoss(5, 0, 30), { level: 4, xp: 550, levelsLost: 1 });
  // round-trip : monter 30 depuis niv4/xp550 redonne niv5/xp0
  assert.deepEqual(L.applyXp(4, 550, 30), { level: 5, xp: 0, levelsGained: 1 });
});
test('applyXpLoss : cascade multi-niveaux + plancher niveau 1 / xp 0', () => {
  assert.deepEqual(L.applyXpLoss(3, 0, 99999), { level: 1, xp: 0, levelsLost: 2 });
});
test('applyXpLoss : perte nulle ou négative = inchangé', () => {
  assert.deepEqual(L.applyXpLoss(2, 100, 0), { level: 2, xp: 100, levelsLost: 0 });
  assert.deepEqual(L.applyXpLoss(2, 100, -50), { level: 2, xp: 100, levelsLost: 0 });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `node --test test/game-logic.test.js`
Expected: FAIL (`L.applyXpLoss is not a function`).

- [ ] **Step 3: Implémenter `applyXpLoss`**

Dans `game-logic.js`, juste après la fonction `applyXp` (après sa fermeture `}` ~ligne 705), insérer :

```js
  function applyXpLoss(level, xp, loss) {
    level = Math.max(1, level | 0);
    xp = Math.max(0, xp | 0) - Math.max(0, loss | 0);
    let levelsLost = 0;
    while (xp < 0 && level > 1) { level -= 1; xp += xpToNext(level); levelsLost += 1; }
    if (xp < 0) xp = 0;   // plancher niveau 1
    return { level, xp, levelsLost };
  }
```

- [ ] **Step 4: Ajouter à l'export**

Dans `game-logic.js`, repérer la ligne d'export contenant `applyXp` (avec `xpToNext`, `MAX_LEVEL`). Y ajouter `applyXpLoss`. Exemple — si la ligne est :

```js
    xpToNext, applyXp, MAX_LEVEL,
```
la remplacer par :
```js
    xpToNext, applyXp, applyXpLoss, MAX_LEVEL,
```
(Si `applyXp` est sur une autre ligne d'export, ajouter `applyXpLoss` juste à côté.)

- [ ] **Step 5: Lancer les tests pour vérifier le succès**

Run: `node --test test/game-logic.test.js`
Expected: PASS (tout vert).

- [ ] **Step 6: Implémenter l'orchestrateur `removeXp`**

Dans `data-state.jsx`, juste après la fonction `addXp` (après sa fermeture `}` ~ligne 199), insérer :

```js
/* Retrait d'XP (orchestrateur, écriture staff) : miroir d'addXp. Redescend de niveau
   si on passe sous 0 (plancher niveau 1 / xp 0). pushLog si perte de niveau. */
async function removeXp(charId, loss) {
  loss = Math.max(0, loss | 0);
  if (!loss) return { level: null, xp: null, levelsLost: 0 };
  const c = CHARACTERS.find(x => x.id === charId);
  const p = charPath(charId);
  const st = (await window.RTDB.getSnapshot(p)) || {};
  const curLevel = (st.level != null ? st.level : (c ? c.level : 1)) || 1;
  const curXp = Math.max(0, st.xp | 0);
  const res = applyXpLoss(curLevel, curXp, loss);
  window.RTDB.updatePath(p, { level: res.level, xp: res.xp });
  if (res.levelsLost > 0) pushLog(`<b>${c ? c.name : charId}</b> redescend niveau <b>${res.level}</b>.`, 'debuff');
  return res;
}
```

- [ ] **Step 7: Ajouter `removeXp` à l'export de `data-state.jsx`**

Dans le `Object.assign(window, { … })` de `data-state.jsx`, repérer la ligne contenant `addXp` et ajouter `removeXp` juste à côté. Exemple :
```js
  addXp, removeXp, grantCoins,
```

- [ ] **Step 8: Ajouter le bouton « − XP » dans la vue MJ**

Dans `pages-mj.jsx`, le bloc XP (~ligne 113-122) contient un input `xpIn` + un bouton « + XP ». Juste après le bouton « + XP » (après sa fermeture `</button>` ~ligne 121), ajouter :

```jsx
          <button className="btn btn-sm btn-ghost" title="Retirer de l'XP" onClick={async () => {
            const n = Math.max(0, parseInt(xpIn, 10) || 0); if (!n) return;
            const res = await removeXp(c.id, n);
            if (res.levelsLost > 0) toast(`<b>${c.name}</b> redescend niveau <b>${res.level}</b>.`, 'debuff');
            setXpIn('');
          }}>− XP</button>
```

- [ ] **Step 9: Vérifier la syntaxe**

Run: `npx esbuild data-state.jsx >/dev/null && npx esbuild pages-mj.jsx >/dev/null`
Expected: aucune erreur.

- [ ] **Step 10: Commit**

```bash
git add game-logic.js test/game-logic.test.js data-state.jsx pages-mj.jsx
git commit -m "feat(xp): retrait d'XP (applyXpLoss + removeXp + bouton MJ)"
```

---

### Task 2 : Poids — logique pure + plomberie des champs d'item

**Files:**
- Modify: `game-logic.js` (champs `weight`/`carry` dans `makeItem` ~ligne 99 ; copie dans `fillStacks` ~ligne 159 et `planItemTransfer` ~ligne 130 et `buildCatalogSeed` ~ligne 181 ; helpers + constantes après `planItemAdd` ~ligne 171 ; export)
- Test: `test/game-logic.test.js`

**Interfaces:**
- Consumes: `makeItem` (même fichier).
- Produces:
  - `CARRY_BASE` (=10), `CARRY_PER_FORCE` (=5) — constantes exportées, tunables.
  - `carriedWeight(items) -> number`
  - `carryCapacity(force, equipment, itemsById) -> number`
  - `weightStatus(carried, cap) -> { pct, over }`
  - champs item `weight` (défaut 0) et `carry` (défaut 0) propagés par `makeItem`/`fillStacks`/`planItemTransfer`/`buildCatalogSeed`.

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à la fin de `test/game-logic.test.js` :

```js
/* --- Système de poids : carriedWeight / carryCapacity / weightStatus --- */
test('carriedWeight : somme weight×qty, qty 0 ignorée, vide = 0', () => {
  assert.equal(L.carriedWeight({}), 0);
  const items = { a: { weight: 3, qty: 2 }, b: { weight: 5, qty: 0 }, c: { weight: 1, qty: 4 } };
  assert.equal(L.carriedWeight(items), 3 * 2 + 1 * 4); // 10
});
test('carryCapacity : base + force×facteur + carry des items équipés', () => {
  const itemsById = { belt: { id: 'belt', carry: 20 }, ring: { id: 'ring' } };
  // CARRY_BASE 10 + force 4 ×5 = 30, + ceinture 20 = 50
  assert.equal(L.carryCapacity(4, { ceinture: 'belt', anneau1: 'ring' }, itemsById), 10 + 4 * 5 + 20);
  // sans équipement
  assert.equal(L.carryCapacity(6, {}, {}), 10 + 6 * 5);
});
test('weightStatus : pct et dépassement', () => {
  assert.deepEqual(L.weightStatus(25, 50), { pct: 0.5, over: false });
  assert.equal(L.weightStatus(60, 50).over, true);
  assert.deepEqual(L.weightStatus(10, 0), { pct: 0, over: true }); // cap 0 -> tout dépasse
});
test('makeItem : défauts weight/carry à 0, valeurs préservées', () => {
  assert.equal(L.makeItem({}).weight, 0);
  assert.equal(L.makeItem({}).carry, 0);
  const it = L.makeItem({ weight: 3, carry: 20 });
  assert.equal(it.weight, 3);
  assert.equal(it.carry, 20);
});
```

- [ ] **Step 2: Lancer les tests pour vérifier l'échec**

Run: `node --test test/game-logic.test.js`
Expected: FAIL (`L.carriedWeight is not a function`, et `makeItem({}).weight` = undefined).

- [ ] **Step 3: Ajouter les champs `weight`/`carry` à `makeItem`**

Dans `game-logic.js`, fonction `makeItem` (~ligne 109-110), après la ligne `mods: p.mods || {},`, ajouter :

```js
      weight: Number(p.weight) || 0,   // poids unitaire porté (affichage seul)
      carry:  Number(p.carry) || 0,    // bonus de capacité de charge (ceinture/équipement)
```

- [ ] **Step 4: Propager `weight`/`carry` dans les copies d'items**

(a) `fillStacks` (~ligne 159-162) : dans l'objet passé à `makeItem`, ajouter `weight: entry.weight, carry: entry.carry,` :

```js
      var fresh = makeItem({
        cat: entry.cat, name: entry.name, sub: entry.sub, qty: take,
        ic: entry.ic, img: entry.img, type: entry.type, mods: entry.mods,
        weight: entry.weight, carry: entry.carry,
      });
```

(b) `planItemTransfer` (~ligne 130-131) : l'objet copié vers `makeItem` liste les champs `cat,name,sub,ic,img,type,mods` ; y ajouter `weight: src.weight, carry: src.carry,` :

```js
      cat: src.cat, name: src.name, sub: src.sub,
      ic: src.ic, img: src.img, type: src.type, mods: src.mods,
      weight: src.weight, carry: src.carry,
```

(c) `buildCatalogSeed` (~ligne 181-182) : l'objet `out[id]` liste `{ id, cat, name, sub, ic, img, type, mods }` ; y ajouter `weight` et `carry` :

```js
      out[id] = { id: id, cat: e.cat || 'Butin', name: e.name || 'Objet', sub: e.sub || '',
        ic: e.ic || '', img: e.img || '', type: e.type || '', mods: e.mods || {},
        weight: Number(e.weight) || 0, carry: Number(e.carry) || 0 };
```

- [ ] **Step 5: Ajouter les helpers + constantes de poids**

Dans `game-logic.js`, juste après la fonction `planItemAdd` (après sa fermeture `}` ~ligne 171), insérer :

```js
  /* --- Système de poids porté (affichage seul ; le MJ arbitre la surcharge) --- */
  var CARRY_BASE = 10;        // capacité de base commune
  var CARRY_PER_FORCE = 5;    // capacité gagnée par point de Force

  function carriedWeight(items) {
    items = items || {};
    var tot = 0;
    for (var k in items) { var it = items[k] || {}; tot += (Number(it.weight) || 0) * (Number(it.qty) || 0); }
    return tot;
  }

  function carryCapacity(force, equipment, itemsById) {
    force = Number(force) || 0;
    equipment = equipment || {}; itemsById = itemsById || {};
    var bonus = 0;
    for (var slot in equipment) {
      var id = equipment[slot]; if (!id) continue;
      var it = itemsById[id]; if (it) bonus += Number(it.carry) || 0;
    }
    return CARRY_BASE + force * CARRY_PER_FORCE + bonus;
  }

  function weightStatus(carried, cap) {
    carried = Number(carried) || 0; cap = Number(cap) || 0;
    return { pct: cap > 0 ? carried / cap : 0, over: carried > cap };
  }
```

- [ ] **Step 6: Ajouter aux exports**

Dans le `Object.assign(window, { … })` de `game-logic.js`, sur la ligne contenant `STACK_MAX, fillStacks, planItemAdd, buildCatalogSeed, catalogArray,`, ajouter à la suite :
```js
    CARRY_BASE, CARRY_PER_FORCE, carriedWeight, carryCapacity, weightStatus,
```

- [ ] **Step 7: Lancer les tests pour vérifier le succès**

Run: `node --test test/game-logic.test.js`
Expected: PASS (tout vert, dont les nouveaux tests poids/makeItem).

- [ ] **Step 8: Vérifier la syntaxe**

Run: `npx esbuild game-logic.js >/dev/null` (UMD — esbuild valide la syntaxe).
Expected: aucune erreur.

- [ ] **Step 9: Commit**

```bash
git add game-logic.js test/game-logic.test.js
git commit -m "feat(poids): helpers carriedWeight/carryCapacity/weightStatus + champs item weight/carry"
```

---

### Task 3 : Poids — UI (éditeur d'item + jauges)

**Files:**
- Modify: `components.jsx` (`InvItemRow` éditeur ~ligne 559-611 : champs Poids + Capacité ; save ~ligne 609)
- Modify: `pages-equip.jsx` (jauge poids après la grille de stats ~ligne 351 ; calcul ~ligne 156-161)
- Modify: `pages-sheet.jsx` (total poids dans l'inventaire perso)

**Interfaces:**
- Consumes: `carriedWeight`, `carryCapacity`, `weightStatus` (Task 2). `state.attrs ?? char.attrs` pour la Force.
- Produces: champs éditeur `weight` (tous items) / `carry` (Équipement) ; jauge poids sur Équipement + total sur la fiche.

- [ ] **Step 1: Champs Poids + Capacité dans l'éditeur `InvItemRow`**

Dans `components.jsx`, dans le bloc `if (edit) { return ( … ) }`, juste **avant** le bloc image (le commentaire `{/* Image : téléversement… */}` ~ligne 593), insérer :

```jsx
        <div className="row gap-2" style={{ alignItems:'center' }}>
          <label className="row gap-1" style={{ alignItems:'center', fontSize:11, color:'var(--ink-soft)' }}>
            Poids
            <input style={{ ...fld, width:70 }} type="number" min="0" step="0.5"
              value={d.weight != null ? d.weight : ''} placeholder="0"
              onChange={e => setD({ ...d, weight: Math.max(0, parseFloat(e.target.value) || 0) })} />
          </label>
          {d.cat === 'Équipement' && (
            <label className="row gap-1" style={{ alignItems:'center', fontSize:11, color:'var(--ink-soft)' }}>
              Capacité (+charge)
              <input style={{ ...fld, width:70 }} type="number" min="0" step="1"
                value={d.carry != null ? d.carry : ''} placeholder="0"
                onChange={e => setD({ ...d, carry: Math.max(0, parseFloat(e.target.value) || 0) })} />
            </label>
          )}
        </div>
```

- [ ] **Step 2: Préserver weight/carry à l'enregistrement**

Dans `components.jsx`, le bouton « Enregistrer » (~ligne 609) appelle `onSave({ ...d, type: …, mods: … })`. `weight` est dans `...d` (conservé pour tous). `carry` doit être remis à 0 hors Équipement. Remplacer le `onClick` du bouton Enregistrer par :

```jsx
          <button className="btn btn-sm btn-gold" onClick={() => { const isEq = d.cat === 'Équipement'; onSave({ ...d, type: isEq ? (d.type || '') : '', mods: isEq ? (d.mods || {}) : {}, weight: Math.max(0, Number(d.weight) || 0), carry: isEq ? (Math.max(0, Number(d.carry) || 0)) : 0 }); setEdit(false); }}>Enregistrer</button>
```

- [ ] **Step 3: Vérifier la syntaxe de components.jsx**

Run: `npx esbuild components.jsx >/dev/null`
Expected: aucune erreur.

- [ ] **Step 4: Jauge de poids sur la page Équipement**

Dans `pages-equip.jsx`, après le calcul `eff` (~ligne 161), ajouter le calcul du poids. Insérer après la ligne `const eff = computeEffective(...)` :

```js
  const carryForce = (state.attrs && state.attrs.force != null ? state.attrs.force : (char.attrs ? char.attrs.force : 0)) || 0;
  const weightCarried = carriedWeight(itemsById);
  const weightCap = carryCapacity(carryForce, equipment, itemsById);
  const weightOver = weightStatus(weightCarried, weightCap).over;
```

Puis, dans le JSX, juste **après** la grille de stats (la fermeture `</div>` de la grille `ATTRIBUTS/COMBAT/SURVIE` ~ligne 351), insérer une barre de poids :

```jsx
          <div style={{ marginTop:12, paddingTop:10, borderTop:'1px solid rgba(160,128,72,0.15)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:4 }}>
              <span style={{ fontFamily:"'Cinzel',serif", letterSpacing:1, color:'#c2a05a' }}>POIDS</span>
              <span style={{ color: weightOver ? 'var(--hp)' : '#9a8b76' }}>{weightCarried} / {weightCap}</span>
            </div>
            <div style={{ height:7, borderRadius:4, background:'var(--bg-inset)', overflow:'hidden', border:'1px solid rgba(160,128,72,0.18)' }}>
              <div style={{ height:'100%', width:`${Math.min(100, weightStatus(weightCarried, weightCap).pct * 100)}%`,
                background: weightOver ? 'var(--hp)' : 'linear-gradient(90deg,#7a5a2a,#c2a05a)', transition:'width .2s' }} />
            </div>
          </div>
```

- [ ] **Step 5: Vérifier la syntaxe de pages-equip.jsx**

Run: `npx esbuild pages-equip.jsx >/dev/null`
Expected: aucune erreur.

- [ ] **Step 6: Total de poids sur l'inventaire de la fiche**

Dans `pages-sheet.jsx`, repérer le panneau d'inventaire perso (recherche `InventoryPanel` ou `inventory`). Calculer la Force et le poids près du rendu de l'inventaire (utiliser la variable d'état déjà disponible — `state.inventory`, `state.equipment`, `state.attrs`/`char.attrs`). Ajouter, au-dessus ou sous le titre de l'inventaire perso, une ligne lecture seule :

```jsx
        <div className="row" style={{ justifyContent:'space-between', fontSize:11.5, color:'var(--faint)', padding:'2px 0' }}>
          <span>Poids porté</span>
          <span style={{ color: weightStatus(carriedWeight(state.inventory || {}), carryCapacity((state.attrs && state.attrs.force != null ? state.attrs.force : (char.attrs ? char.attrs.force : 0)) || 0, state.equipment || {}, state.inventory || {})).over ? 'var(--hp)' : 'var(--faint)' }}>
            {carriedWeight(state.inventory || {})} / {carryCapacity((state.attrs && state.attrs.force != null ? state.attrs.force : (char.attrs ? char.attrs.force : 0)) || 0, state.equipment || {}, state.inventory || {})}
          </span>
        </div>
```

(Adapter l'emplacement au JSX réel de la section inventaire ; le calcul est autonome et ne dépend que de `state` + `char`.)

- [ ] **Step 7: Vérifier la syntaxe de pages-sheet.jsx**

Run: `npx esbuild pages-sheet.jsx >/dev/null`
Expected: aucune erreur.

- [ ] **Step 8: Commit**

```bash
git add components.jsx pages-equip.jsx pages-sheet.jsx
git commit -m "feat(poids): éditeur poids/capacité + jauge poids (Équipement + fiche)"
```

---

### Task 4 : Fusion des slots d'armure

**Files:**
- Modify: `pages-equip.jsx:17-35` (`EQUIP_SLOTS` + `EQUIP_GRID_AREAS`)
- Modify: `pages-equip.jsx` (migration `armureInit` dans `EquipBody`, après la migration `coinsInit` ~ligne 112)

**Interfaces:**
- Consumes: `setEquipment`, `state.equipment`, `charPath` (existants).
- Produces: slot unique `armure` (accepte 4 types) ; migration unique `armureInit`.

- [ ] **Step 1: Remplacer les 4 slots par `armure`**

Dans `pages-equip.jsx`, dans `EQUIP_SLOTS` (~ligne 17-33), **supprimer** les 4 lignes `epaules`, `cuirasse`, `gants`, `pantalon`, et **ajouter** une ligne `armure` (la placer après `casque`) :

```js
  casque:         { label:'Casque',          accepts:['helmet'],                    area:'casque'   },
  armure:         { label:'Armure',          accepts:['shoulders','chest','gloves','pants'], area:'armure' },
```

- [ ] **Step 2: Recomposer la grille**

Dans `pages-equip.jsx`, remplacer `EQUIP_GRID_AREAS` (~ligne 34-35) par une grille où `armure` occupe les lignes libérées en colonne gauche (les autres slots inchangés) :

```js
const EQUIP_GRID_AREAS =
  "'casque armeP armeP amulette' 'armure armeP armeP anneau1' 'armure armeP armeP anneau2' 'armure armeS armeS ceinture' 'acc1 armeS armeS bottes' 'acc2 acc3 wnone wnone'";
```

- [ ] **Step 3: Migration unique `armureInit`**

Dans `pages-equip.jsx`, dans `EquipBody`, juste après le `useEffect` de migration `coinsInit` (~ligne 112), ajouter :

```js
  // Migration unique : fusion des 4 anciens slots d'armure en un seul `armure`.
  // Sans nettoyage, les clés obsolètes resteraient sommées par sumItemMods (bonus fantômes).
  useEffect(() => {
    if (!state || state.armureInit !== undefined) return;
    const eq = state.equipment || {};
    const OLD = ['epaules', 'cuirasse', 'gants', 'pantalon'];
    const hasOld = OLD.some(k => eq[k]);
    const patch = {};
    if (hasOld && !eq.armure) {
      const firstFilled = OLD.find(k => eq[k]);
      if (firstFilled) patch.armure = eq[firstFilled];
    }
    OLD.forEach(k => { if (eq[k] !== undefined) patch[k] = null; });
    if (Object.keys(patch).length) setEquipment(patch);
    window.RTDB.updatePath(charPath(char.id), { armureInit: true });
  }, [state, char.id]);
```

- [ ] **Step 4: Vérifier la syntaxe**

Run: `npx esbuild pages-equip.jsx >/dev/null`
Expected: aucune erreur.

- [ ] **Step 5: Tests de non-régression**

Run: `node --test test/game-logic.test.js test/auth.test.js`
Expected: PASS (aucune logique pure touchée ici, mais on confirme le vert global).

- [ ] **Step 6: Commit**

```bash
git add pages-equip.jsx
git commit -m "feat(equip): fusion des 4 slots d'armure en un slot unique (migration armureInit)"
```

---

### Task 5 : CD intrinsèque visible sur les cartes de Combat

**Files:**
- Modify: `pages-competences.jsx` (`ActiveCard` ~ligne 96-106 : badge CD persistant)

**Interfaces:**
- Consumes: `sk.kind` / `sk.cd` (déjà dans les données `SKILLS`).
- Produces: badge CD lisible sans lancer la compétence.

- [ ] **Step 1: Dériver le libellé CD intrinsèque**

Dans `pages-competences.jsx`, dans `ActiveCard`, juste après la ligne `const cdLabel = …` (~ligne 96), ajouter :

```js
  const cdInfo = sk.kind === 'turn' ? '1×/tour'
    : sk.kind === 'combat' ? '1×/combat'
    : (sk.cd ? `CD ${sk.cd} tour${sk.cd > 1 ? 's' : ''}` : 'Sans CD');
```

- [ ] **Step 2: Afficher le badge CD persistant**

Dans `pages-competences.jsx`, dans le `panel-head` de `ActiveCard`, le `<span className="row gap-2">` contient le badge mana puis le badge d'état. Insérer le badge CD **entre** le badge mana et le badge d'état. Remplacer (~ligne 102-105) :

```jsx
        <span className="row gap-2" style={{ alignItems: 'center' }}>
          <span className="badge" style={{ background: 'var(--bg-inset)' }}>{sk.mana} mana</span>
          <span className="badge" style={{ background: ready ? 'var(--bg-inset)' : 'var(--bg-panel-2)', color: ready ? 'var(--buff)' : 'var(--gold-pale)' }}>{cdLabel}</span>
        </span>
```
par :
```jsx
        <span className="row gap-2" style={{ alignItems: 'center' }}>
          <span className="badge" style={{ background: 'var(--bg-inset)' }}>{sk.mana} mana</span>
          <span className="badge" title="Cooldown de la compétence" style={{ background: 'var(--bg-inset)', color: 'var(--gold-pale)' }}>{cdInfo}</span>
          <span className="badge" style={{ background: ready ? 'var(--bg-inset)' : 'var(--bg-panel-2)', color: ready ? 'var(--buff)' : 'var(--gold-pale)' }}>{cdLabel}</span>
        </span>
```

- [ ] **Step 3: Vérifier la syntaxe**

Run: `npx esbuild pages-competences.jsx >/dev/null`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add pages-competences.jsx
git commit -m "feat(combat): badge CD intrinsèque persistant sur les cartes de compétence"
```

---

## Déploiement (après les 5 tâches)

- [ ] **Bump du cache** : dans `index.html`, remplacer le jeton `?v=` courant (ex. `20260624-1` → `20260624-2`) sur tous les scripts/CSS locaux **et** `window.APPV`. Méthode sûre (UTF-8 sans BOM, fins de ligne préservées) :

```powershell
$path = (Resolve-Path index.html).Path
$text = [System.IO.File]::ReadAllText($path).Replace('20260624-1','20260624-2')
[System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
```

- [ ] **Vérif globale** : `node --test test/game-logic.test.js test/auth.test.js` (tout vert) + `npx esbuild` sur les 5 fichiers modifiés.
- [ ] **Commit du bump** + merge/push sur `main` (GitHub Pages). **Aucune règle RTDB à republier.**
- [ ] **Vérif manuelle** (Ctrl+Shift+R) : (1) MJ → carte joueur → « − XP » retire l'XP, redescend de niveau au passage sous 0 ; (2) Équipement → 1 seul slot Armure, item d'armure équipé après migration, jauge Poids visible (rouge en surcharge) ; (3) éditer un item → champs Poids (+ Capacité sur Équipement) → persiste ; (4) Combat → chaque carte de compétence montre son CD (`1×/tour` / `CD N tours` / `1×/combat`) sans avoir à lancer.

## Self-Review

- **Couverture spec** : retrait XP `applyXpLoss`+`removeXp`+bouton MJ ✓ (Task 1) ; fusion 4→1 slot armure + migration anti-bonus-fantôme ✓ (Task 4) ; poids champs item + capacité Force+ceinture + helpers ✓ (Task 2) ; UI poids (éditeur + jauge Équipement + total fiche) ✓ (Task 3) ; CD visible sur cartes ✓ (Task 5) ; aucune règle RTDB ✓ ; bump `?v=` ✓ (Déploiement).
- **Placeholders** : aucun (Task 3 Step 6 invite à adapter l'emplacement JSX exact, mais fournit le calcul complet et autonome).
- **Type consistency** : `applyXpLoss(level,xp,loss)->{level,xp,levelsLost}` (Task 1) ↔ consommé par `removeXp` ✓ ; `carriedWeight(items)`, `carryCapacity(force,equipment,itemsById)`, `weightStatus(carried,cap)->{pct,over}` (Task 2) ↔ appelés tels quels (Task 3) ✓ ; champs `weight`/`carry` posés par `makeItem` (Task 2) ↔ édités par `InvItemRow` (Task 3) ✓ ; `cdInfo` dérivé de `sk.kind`/`sk.cd` présents dans `SKILLS` ✓ (Task 5).
