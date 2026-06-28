# Refonte fiche joueur — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre la fiche joueur (`pages-sheet.jsx`) lisible et intuitive — layout B (3 colonnes thématiques), breakdown des stats par source, consommables réels liés à l'inventaire, outils libres réservés au MJ, grille d'inventaire dark-fantasy adaptative — sans toucher au moteur de règles.

**Architecture :** Logique pure ajoutée dans `game-logic.js` (`statBreakdown`, `parseConsumableEffect` déplacé), testée en Node. UI réorganisée dans `pages-sheet.jsx` (retrait du système `variant`), grille réutilisée depuis `components.jsx` (`InventoryGrid` + props `minCells`/`grow`). Animations CSS dans `runeterra.css`.

**Tech Stack :** React 18 + Babel standalone via CDN (zéro-build), Firebase RTDB compat, `node --test`, `npx esbuild` (vérif syntaxe).

## Global Constraints

- **Zéro-build** : chaque fichier `.jsx`/`.js` définit ses fonctions localement PUIS `Object.assign(window, { ... })`. Toute nouvelle fonction exportée doit être ajoutée à ce bloc. L'ordre de chargement dans `index.html` compte.
- **Aucune nouvelle règle RTDB, aucun changement de schéma Firebase.** On lit/écrit les chemins existants (`hpCur`, `manaCur`, `shield`, `fatigue`, `eau`, `inventory`, `coins`, `modifiers`).
- **UI en français.** La grille d'inventaire utilise les polices `'Cinzel'`/`'EB Garamond'` (déjà câblées dans `InventoryGrid`).
- **Cache-busting au déploiement** : bumper le jeton `?v=…` dans `index.html` + `window.APPV` (dernière tâche).
- **Tests** : `node --test test/game-logic.test.js` doit rester vert ; vérif syntaxe `npx esbuild <fichier>.jsx >/dev/null` sur chaque `.jsx` modifié.
- **Catégorie consommable** = chaîne exacte `'Consommables'` (pluriel).

---

### Task 1 : `statBreakdown` — décomposition des stats par source (logique pure)

**Files:**
- Modify: `game-logic.js` (ajouter la fonction + l'exporter dans le `Object.assign(window, …)` final)
- Test: `test/game-logic.test.js`

**Interfaces:**
- Consumes: `computeEffective(base, modifiers, buffs, itemMods)` (déjà dans `game-logic.js`).
- Produces: `statBreakdown(base, modifiers, buffs, stuffMods)` → `{ [stat]: { effective, base, mod, stuff } }`. `base` = objet stats de base ; `modifiers` = `state.modifiers` ; `buffs` = tableau d'ids de buffs actifs ; `stuffMods` = mods plats fusionnés (items + runes + passif + skillBuffs). `mod`/`stuff` = deltas marginaux entiers (peuvent être 0).

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter à la fin de `test/game-logic.test.js` :

```javascript
test('statBreakdown : base seule = effective, deltas à 0', () => {
  const base = { ad: 100, armure: 30, hp: 400, mana: 200, ap: 0, resmag: 10, crit: 5, dcrit: 200 };
  const b = L.statBreakdown(base, {}, [], {});
  assert.equal(b.ad.base, 100);
  assert.equal(b.ad.mod, 0);
  assert.equal(b.ad.stuff, 0);
  assert.equal(b.ad.effective, 100);
});
test('statBreakdown : modificateur isolé en delta mod', () => {
  const base = { ad: 100, armure: 30, hp: 400, mana: 200, ap: 0, resmag: 10, crit: 5, dcrit: 200 };
  const b = L.statBreakdown(base, { ad: 10 }, [], {});
  assert.equal(b.ad.mod, 10);
  assert.equal(b.ad.stuff, 0);
  assert.equal(b.ad.effective, 110);
});
test('statBreakdown : bonus de stuff isolé en delta stuff', () => {
  const base = { ad: 100, armure: 30, hp: 400, mana: 200, ap: 0, resmag: 10, crit: 5, dcrit: 200 };
  const b = L.statBreakdown(base, {}, [], { armure: 15 });
  assert.equal(b.armure.base, 30);
  assert.equal(b.armure.mod, 0);
  assert.equal(b.armure.stuff, 15);
  assert.equal(b.armure.effective, 45);
});
test('statBreakdown : mod + stuff combinés', () => {
  const base = { ad: 100, armure: 30, hp: 400, mana: 200, ap: 0, resmag: 10, crit: 5, dcrit: 200 };
  const b = L.statBreakdown(base, { ad: 10 }, [], { ad: 20 });
  assert.equal(b.ad.mod, 10);
  assert.equal(b.ad.stuff, 20);
  assert.equal(b.ad.effective, 130);
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run : `node --test test/game-logic.test.js`
Expected : FAIL (`L.statBreakdown is not a function`).

- [ ] **Step 3 : Implémenter `statBreakdown`**

Dans `game-logic.js`, juste après la définition de `sumPassiveMods` (ou tout autre helper de stats), ajouter :

```javascript
  /* Décompose chaque stat effective en sources : base / +modificateurs / +stuff (items+runes+
     passif+skillBuffs). Les buffs étant multiplicatifs (appliqués au-dessus du socle), on calcule
     des deltas MARGINAUX honnêtes : on recompose computeEffective avec/sans chaque source.
     base = socle brut ; mod = effet des modificateurs ; stuff = effet des mods plats. */
  function statBreakdown(base, modifiers, buffs, stuffMods) {
    base = base || {};
    var effBase = computeEffective(base, {}, buffs, {});
    var effMod  = computeEffective(base, modifiers || {}, buffs, {});
    var effFull = computeEffective(base, modifiers || {}, buffs, stuffMods || {});
    var out = {};
    Object.keys(effFull).forEach(function (k) {
      out[k] = {
        effective: Math.round(effFull[k] || 0),
        base: Math.round(base[k] || 0),
        mod: Math.round((effMod[k] || 0) - (effBase[k] || 0)),
        stuff: Math.round((effFull[k] || 0) - (effMod[k] || 0)),
      };
    });
    return out;
  }
```

Puis ajouter `statBreakdown` au bloc `Object.assign(window, { … })` final de `game-logic.js` (à côté de `computeEffective`, `sumPassiveMods`, etc.).

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run : `node --test test/game-logic.test.js`
Expected : PASS (toute la suite verte).

- [ ] **Step 5 : Commit**

```bash
git add game-logic.js test/game-logic.test.js
git commit -m "feat(stats): statBreakdown — décomposition base/mod/stuff (logique pure testée)"
```

---

### Task 2 : Déplacer `parseConsumableEffect` en logique partagée

**Files:**
- Modify: `game-logic.js` (ajouter la fonction + export)
- Modify: `pages-equip.jsx:59-68` (retirer la définition locale, le global prend le relais)
- Test: `test/game-logic.test.js`

**Interfaces:**
- Produces: `parseConsumableEffect(item)` → `{ kind:'hp'|'mana', flat:number, pct:number }` ou `null`. Réutilisé par la fiche (Task 5) et l'Équipement.

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter à `test/game-logic.test.js` :

```javascript
test('parseConsumableEffect : descriptions chiffrées + repli par nom', () => {
  assert.deepEqual(L.parseConsumableEffect({ cat:'Consommables', sub:'Rend 10 + 10% Mana' }), { kind:'mana', flat:10, pct:10 });
  assert.deepEqual(L.parseConsumableEffect({ cat:'Consommables', sub:'Rend 15 + 15% PV' }), { kind:'hp', flat:15, pct:15 });
  assert.deepEqual(L.parseConsumableEffect({ cat:'Consommables', name:'Potion de soin' }), { kind:'hp', flat:15, pct:15 });
  assert.deepEqual(L.parseConsumableEffect({ cat:'Consommables', name:'Potion de mana' }), { kind:'mana', flat:10, pct:10 });
  assert.equal(L.parseConsumableEffect({ cat:'Équipement', name:'Épée' }), null);
  assert.equal(L.parseConsumableEffect(null), null);
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run : `node --test test/game-logic.test.js`
Expected : FAIL (`L.parseConsumableEffect is not a function`).

- [ ] **Step 3 : Déplacer la fonction dans `game-logic.js`**

Ajouter dans `game-logic.js` (près des helpers d'items `makeItem`/`fillStacks`) :

```javascript
  /* Lit l'effet d'un consommable depuis sa description ("Rend X + Y% HP/Mana") ou par repli sur
     son nom (potion de soin/mana standard). Renvoie { kind, flat, pct } ou null. */
  function parseConsumableEffect(it) {
    if (!it || it.cat !== 'Consommables') return null;
    var txt = (it.sub || '') + ' ' + (it.name || '');
    var m = txt.match(/Rend\s+(\d+)\s*\+\s*(\d+)\s*%\s*(HP|PV|Mana)/i);
    if (m) return { kind: /mana/i.test(m[3]) ? 'mana' : 'hp', flat: parseInt(m[1], 10), pct: parseInt(m[2], 10) };
    if (/potion\s+soin/i.test(it.name || '')) return { kind: 'hp', flat: 15, pct: 15 };
    if (/potion\s+mana/i.test(it.name || '')) return { kind: 'mana', flat: 10, pct: 10 };
    return null;
  }
```

Ajouter `parseConsumableEffect` au bloc `Object.assign(window, { … })` final.

- [ ] **Step 4 : Retirer la définition locale dans `pages-equip.jsx`**

Supprimer les lignes `pages-equip.jsx:59-68` (toute la `function parseConsumableEffect(it) { … }`). Le reste de `pages-equip.jsx` continue d'appeler `parseConsumableEffect(...)` qui est désormais résolu via `window`. (Vérifier que `game-logic.js` est bien chargé avant `pages-equip.jsx` dans `index.html` — c'est déjà le cas.)

- [ ] **Step 5 : Lancer le test + vérif syntaxe**

Run : `node --test test/game-logic.test.js` → PASS
Run : `npx esbuild pages-equip.jsx >/dev/null` → aucune erreur

- [ ] **Step 6 : Commit**

```bash
git add game-logic.js pages-equip.jsx test/game-logic.test.js
git commit -m "refactor(consommables): parseConsumableEffect → game-logic (partagé fiche/équipement)"
```

---

### Task 3 : `InventoryGrid` — props `minCells` + `grow`

**Files:**
- Modify: `components.jsx:380-462` (`InventoryGrid`)

**Interfaces:**
- Produces: `InventoryGrid({ …, minCells = 49, grow = false })`. `minCells` = nombre plancher de cases (défaut 49 = 7×7 pour commun/Équipement ; plus petit pour la fiche). `grow=true` = la grille s'étend avec le contenu au lieu de scroller en interne (la page défile).

- [ ] **Step 1 : Ajouter les props à la signature**

Remplacer `components.jsx:380` :

```javascript
function InventoryGrid({ items, coins, filter, setFilter, onItemClick, onCoinClick, onAdd, onDropItem, capacity = 120, title = 'INVENTAIRE', minCells = 49, grow = false }) {
```

- [ ] **Step 2 : Utiliser `minCells` pour le calcul du nombre de cases**

Remplacer `components.jsx:383` :

```javascript
  const N = Math.max(minCells, Math.ceil(filtered.length / 7) * 7);
```

- [ ] **Step 3 : Gérer `grow` sur le conteneur racine et la zone scrollable**

Dans le `<div>` racine (`components.jsx:390-393`), remplacer `height:'100%', minHeight:0,` par un style conditionnel :

```javascript
      ...(grow ? {} : { height:'100%', minHeight:0 }),
```

Dans la zone scrollable (`components.jsx:414-416`), remplacer `style={{ flex:'1 1 auto', overflowY:'auto', overflowX:'hidden', minHeight:0 }}` par :

```javascript
        style={ grow ? { overflow:'visible' } : { flex:'1 1 auto', overflowY:'auto', overflowX:'hidden', minHeight:0 } }>
```

- [ ] **Step 4 : Vérif syntaxe**

Run : `npx esbuild components.jsx >/dev/null`
Expected : aucune erreur. (Les appels existants — Inventaire commun, Équipement — n'utilisent pas les nouvelles props : comportement inchangé via les défauts.)

- [ ] **Step 5 : Commit**

```bash
git add components.jsx
git commit -m "feat(inventory): InventoryGrid props minCells + grow (réutilisable hors plein-écran)"
```

---

### Task 4 : `SecondaryStats` — rendu breakdown (retrait `variant`)

**Files:**
- Modify: `pages-sheet.jsx:57-104` (`SecondaryStats`)

**Interfaces:**
- Consumes: `statBreakdown(...)` (Task 1) — fourni via la prop `breakdown` (objet `{ [stat]: {effective, base, mod, stuff} }`), calculé par `SheetBody` (Task 6).
- Produces: `SecondaryStats({ breakdown })` (la prop `variant` et `stats` disparaissent).

- [ ] **Step 1 : Remplacer entièrement `SecondaryStats`**

Remplacer `pages-sheet.jsx:57-104` par :

```javascript
/* ---- Grille de stats secondaires avec décomposition base / +mod / +stuff ---- */
function SecondaryStats({ breakdown }) {
  const b = breakdown || {};
  const items = [
    ['ad', false], ['ap', true], ['armure', false], ['resmag', true],
    ['crit', false], ['dcrit', false],
    ...((b.letha && b.letha.effective > 0) ? [['letha', false]] : []),
    ...((b.sapience && b.sapience.effective > 0) ? [['sapience', false]] : []),
    ['omni', true], ['vol', false],
  ];
  const pct = (k) => k === 'crit' || k === 'dcrit' || k === 'omni' || k === 'vol';
  const sources = (d) => {
    if (!d) return null;
    const parts = [`base ${d.base}`];
    if (d.mod) parts.push(`${d.mod > 0 ? '+' : ''}${d.mod} mod`);
    if (d.stuff) parts.push(`${d.stuff > 0 ? '+' : ''}${d.stuff} stuff`);
    return parts.join(' · ');
  };
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
      {items.map(([k, magic]) => {
        const d = b[k];
        const val = d ? d.effective : 0;
        return (
          <div key={k} style={{ padding:'9px 11px', borderRadius:8,
            background:'linear-gradient(180deg, var(--bg-panel-2), var(--bg-inset))',
            border:'1px solid ' + (magic ? 'var(--silver-deep)' : 'var(--line-gold)') }}>
            <div className="row" style={{ justifyContent:'space-between', alignItems:'baseline' }}>
              <span className="overline" style={{ fontSize:9 }}>{STAT_LABEL[k]}</span>
              <span className="mono" style={{ fontSize:16, fontWeight:700, color: magic ? 'var(--silver)' : 'var(--gold-pale)' }}>{val}{pct(k) ? '%' : ''}</span>
            </div>
            <div className="faint" style={{ fontSize:10, fontFamily:'var(--font-mono)', marginTop:2 }}>{sources(d)}</div>
          </div>
        );
      })}
    </div>
  );
}
```

(Note : `STAT_LABEL` est déjà utilisé dans le fichier. `StatChip`, `STAT_GLYPH` ne sont plus référencés par `SecondaryStats` mais peuvent rester définis ailleurs ; ne pas les supprimer dans cette tâche.)

- [ ] **Step 2 : Vérif syntaxe**

Run : `npx esbuild pages-sheet.jsx >/dev/null`
Expected : aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add pages-sheet.jsx
git commit -m "feat(fiche): SecondaryStats affiche le breakdown base/+mod/+stuff"
```

---

### Task 5 : `HealPanel` → consommables réels + outils libres MJ only

**Files:**
- Modify: `pages-sheet.jsx:226-273` (`HealPanel`)

**Interfaces:**
- Consumes: `parseConsumableEffect` (Task 2), `applyHealMods` (existant), `setInvItem(id, item)` / `removeInvItem(id)` (passés par `SheetBody`), `staff` (booléen `isStaff(role)`).
- Produces: `HealPanel({ char, eff, hp, setHp, mana, setMana, shield, setShield, activeBuffs, inventory, setInvItem, removeInvItem, staff })`.

- [ ] **Step 1 : Remplacer entièrement `HealPanel`**

Remplacer `pages-sheet.jsx:226-273` par :

```javascript
/* ---- Panneau Consommables & ressources (temps réel) ---- */
function HealPanel({ char, eff, hp, setHp, mana, setMana, shield, setShield, activeBuffs, inventory, setInvItem, removeInvItem, staff }) {
  const toast = useToast();
  const maxHp = eff.hp, maxMana = eff.mana, maxShield = char.shieldMax;
  const [amt, setAmt] = useState(50);
  const clampV = (v, m) => Math.max(0, Math.min(m, Math.round(v)));

  // Consommables = items de l'inventaire (cat Consommables, qty>0, effet parsable).
  const consumables = Object.values(inventory || {})
    .filter(it => it.cat === 'Consommables' && (it.qty || 0) > 0 && parseConsumableEffect(it));
  const consume = (it) => {
    const fx = parseConsumableEffect(it); if (!fx) return;
    if (fx.kind === 'hp') {
      const gain = applyHealMods(fx.flat + Math.round(maxHp * fx.pct / 100), activeBuffs);
      setHp(h => clampV(h + gain, maxHp));
      toast(`<b>${char.name}</b> utilise ${it.name} · +${gain} PV`, 'buff');
    } else {
      const gain = fx.flat + Math.round(maxMana * fx.pct / 100);
      setMana(v => clampV(v + gain, maxMana));
      toast(`<b>${char.name}</b> utilise ${it.name} · +${gain} mana`, 'gold');
    }
    const q = (it.qty || 1) - 1;
    if (q <= 0) removeInvItem(it.id); else setInvItem(it.id, { ...it, qty: q });
  };
  const consumValue = (it) => { const fx = parseConsumableEffect(it); if (!fx) return 0; return fx.flat + Math.round((fx.kind === 'hp' ? maxHp : maxMana) * fx.pct / 100); };

  const healHp    = () => { const g = applyHealMods(amt, activeBuffs); setHp(h => clampV(h + g, maxHp)); toast(`<b>${char.name}</b> reçoit ${g} soins`, 'buff'); };
  const dmgHp     = () => { setHp(h => clampV(h - amt, maxHp));     toast(`<b>${char.name}</b> subit ${amt} dégâts`, 'debuff'); };
  const addShield = () => { const g = applyHealMods(amt, activeBuffs); setShield(s => clampV(s + g, maxShield)); toast(`<b>${char.name}</b> gagne ${g} bouclier`, 'gold'); };
  const recupMana = () => { setMana(v => clampV(v + amt, maxMana)); toast(`<b>${char.name}</b> récupère ${amt} mana`, 'gold'); };

  return (
    <div className="panel">
      <div className="panel-head"><h3>Consommables</h3><span className="overline">temps réel</span></div>
      <div className="col gap-4" style={{ padding:'16px' }}>
        <div>
          {consumables.length === 0
            ? <div className="faint" style={{ fontSize:12 }}>Aucun consommable dans l'inventaire.</div>
            : <div className="row gap-2 wrap">
                {consumables.map(it => {
                  const fx = parseConsumableEffect(it);
                  return (
                    <button key={it.id} className={'btn btn-sm ' + (fx.kind === 'hp' ? 'btn-hp' : 'btn-mana')} onClick={() => consume(it)}>
                      {fx.kind === 'hp' ? '🧪' : '🔵'} {it.name} · +{consumValue(it)} <span className="faint">×{it.qty}</span>
                    </button>
                  );
                })}
              </div>}
        </div>

        {staff && (
          <>
            <div>
              <div className="row" style={{ justifyContent:'space-between', marginBottom:7 }}>
                <span className="overline">Ajustement MJ (montant)</span>
                <input type="number" value={amt} min="0" onChange={e => setAmt(Math.max(0, parseInt(e.target.value) || 0))}
                  style={{ width:80, background:'var(--bg-inset)', color:'var(--gold-pale)', border:'1px solid var(--line-strong)', borderRadius:6, padding:'5px 8px', fontFamily:'var(--font-mono)', fontSize:13, textAlign:'right' }} />
              </div>
              <div className="row gap-2 wrap">
                <button className="btn btn-sm btn-hp" onClick={healHp}>♥ Soigner</button>
                <button className="btn btn-sm btn-shield" onClick={addShield}>🛡 Bouclier</button>
                <button className="btn btn-sm btn-mana" onClick={recupMana}>🔷 Mana</button>
                <button className="btn btn-sm btn-ghost" onClick={dmgHp}>− Dégâts</button>
              </div>
            </div>
            <div className="row gap-2 wrap">
              <button className="btn btn-sm btn-ghost" onClick={() => { setHp(maxHp); toast(`<b>${char.name}</b> — PV au maximum`, 'buff'); }}>↺ PV max</button>
              <button className="btn btn-sm btn-ghost" onClick={() => { setMana(maxMana); toast(`<b>${char.name}</b> — Mana au maximum`, 'gold'); }}>↺ Mana max</button>
              <button className="btn btn-sm btn-ghost" onClick={() => setShield(0)}>↺ Bouclier 0</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Vérif syntaxe**

Run : `npx esbuild pages-sheet.jsx >/dev/null`
Expected : aucune erreur (les nouvelles props seront branchées en Task 6 ; à ce stade le fichier compile mais `HealPanel` n'a pas encore tous ses arguments — c'est attendu).

- [ ] **Step 3 : Commit**

```bash
git add pages-sheet.jsx
git commit -m "feat(fiche): HealPanel = consommables réels (gating qty) + outils libres MJ only"
```

---

### Task 6 : `SheetBody`/`SheetPage` — layout B, retrait `variant`, câblage

**Files:**
- Modify: `pages-sheet.jsx` (`ResourceStack` 6-55, `CombatColumn` 182-224, `BuffInvColumn` 106-180, `SheetBody` 276-343, `SheetPage` 345-394)

**Interfaces:**
- Consumes: `statBreakdown` (Task 1), `SecondaryStats({breakdown})` (Task 4), `HealPanel({…, inventory, setInvItem, removeInvItem, staff})` (Task 5).
- Produces: fiche réorganisée en 3 colonnes thématiques, sans système `variant`.

- [ ] **Step 1 : Simplifier `ResourceStack` (retrait des variantes b/c)**

Remplacer `pages-sheet.jsx:6-55` par :

```javascript
/* ---- Jauges PV / Mana / Bouclier ---- */
function ResourceStack({ char, eff, hp, mana, shield }) {
  return (
    <div className="col gap-3">
      <div>
        <div className="row" style={{ justifyContent:'space-between', marginBottom:5 }}><span className="overline">Points de vie</span></div>
        <ResourceBar kind="hp" cur={hp} max={eff.hp} />
      </div>
      <div>
        <div className="row" style={{ justifyContent:'space-between', marginBottom:5 }}><span className="overline">Mana</span></div>
        <ResourceBar kind="mana" cur={mana} max={eff.mana} />
      </div>
      <div>
        <div className="row" style={{ justifyContent:'space-between', marginBottom:5 }}><span className="overline">Bouclier</span></div>
        <ResourceBar kind="shield" cur={shield} max={Math.max(char.shieldMax || 0, shield)} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Extraire des panneaux réutilisables (Arme, Buffs, Survie)**

Remplacer `CombatColumn` (`pages-sheet.jsx:182-224`) et la partie Buffs/Modificateurs de `BuffInvColumn` par trois petits composants. Ajouter, à la place de `CombatColumn`, ces composants :

```javascript
/* ---- Panneau arme équipée (info, lecture seule) ---- */
function WeaponPanel({ weapon, eff }) {
  const estimate = weapon.stat === 'ap' ? eff.ap : eff.ad;
  return (
    <div className="panel">
      <div className="panel-head"><h3>Arme équipée</h3>
        <span className={'buff ' + (weapon.cat === 'Magique' ? 'is-buff' : 'is-debuff')} style={{ cursor:'default' }}>
          <span className="dot">{weapon.cat === 'Magique' ? '✦' : '⚔'}</span>{weapon.cat}
        </span>
      </div>
      <div style={{ padding:'16px' }}>
        <div className="row gap-3" style={{ marginBottom:14 }}>
          <div style={{ width:52, height:52, flex:'none', borderRadius:10, display:'grid', placeItems:'center', fontSize:26,
            background:'linear-gradient(135deg, var(--bg-panel-2), var(--bg-inset))', border:'1px solid var(--line-gold)' }}>{weapon.ic}</div>
          <div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:18, color:'var(--gold-pale)' }}>{weapon.name}</div>
            <div className="faint" style={{ fontSize:12 }}>{weapon.cat} · {weapon.type} · base {weapon.stat.toUpperCase()}</div>
          </div>
        </div>
        <div className="row" style={{ justifyContent:'space-between', padding:'12px 14px', background:'var(--bg-inset)', borderRadius:8, border:'1px solid var(--line)' }}>
          <span className="dim" style={{ fontSize:12 }}>Dégâts estimés</span>
          <span className="mono" style={{ fontSize:22, fontWeight:700, color:'var(--gold-bright)' }}>{estimate}</span>
        </div>
      </div>
    </div>
  );
}

/* ---- Panneau buffs/débuffs ---- */
function BuffsPanel({ char, activeBuffs, setBuff }) {
  const toast = useToast();
  const active = new Set(activeBuffs);
  const toggle = (b) => {
    const on = !active.has(b.id);
    setBuff(b.id, on);
    if (on) toast(`<b>${char.name}</b> — ${b.name} ${b.type === 'buff' ? 'activé' : 'subi'}`, b.type);
  };
  return (
    <div className="panel">
      <div className="panel-head"><h3>Effets actifs</h3><span className="mono faint" style={{ fontSize:11 }}>{active.size} actifs</span></div>
      <div style={{ padding:'14px 16px' }}>
        <div className="overline" style={{ marginBottom:8 }}>Bonus</div>
        <div className="row gap-2 wrap" style={{ marginBottom:14 }}>
          {BUFFS.filter(b => b.type === 'buff').map(b => <BuffBadge key={b.id} buff={b} on={active.has(b.id)} onToggle={() => toggle(b)} />)}
        </div>
        <div className="overline" style={{ marginBottom:8 }}>Malus</div>
        <div className="row gap-2 wrap">
          {BUFFS.filter(b => b.type === 'debuff').map(b => <BuffBadge key={b.id} buff={b} on={active.has(b.id)} onToggle={() => toggle(b)} />)}
        </div>
      </div>
    </div>
  );
}

/* ---- Panneau ressources de survie (Fatigue / Eau) ---- */
function SurvivePanel({ fatigue, eau, setField }) {
  return (
    <div className="panel">
      <div className="panel-head"><h3>Ressources de survie</h3><span className="overline">temps réel</span></div>
      <div className="row gap-3" style={{ padding:'16px' }}>
        <NumberStepper label="Fatigue" value={fatigue} color="var(--debuff)" onChange={(v) => setField('fatigue', v)} />
        <NumberStepper label="Eau" value={eau} color="var(--mana-bright)" onChange={(v) => setField('eau', v)} />
      </div>
    </div>
  );
}

/* ---- Panneau modificateurs (MJ) ---- */
function ModifiersPanel({ modifiers, setMod }) {
  const MOD_STATS = [['hp','HP'],['mana','Mana'],['ad','AD'],['ap','AP'],['armure','Armure'],['resmag','Rés.Mag'],['crit','%Crit'],['dcrit','%D.Crit'],['letha','Léthalité'],['sapience','Sapience'],['vol','Vol vie%'],['omni','Omnivamp%']];
  return (
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
  );
}
```

Supprimer l'ancien `BuffInvColumn` (`pages-sheet.jsx:106-180`) — son contenu est désormais réparti entre `BuffsPanel`, `ModifiersPanel` et l'inventaire (Task 7).

- [ ] **Step 3 : Réécrire `SheetBody` en layout B**

Remplacer le `return (...)` de `SheetBody` (`pages-sheet.jsx:313-342`) par :

```javascript
  const breakdown = statBreakdown(sheetBase, state.modifiers, activeBuffs,
    mergeMods(mergeMods(mergeMods(itemMods, runeMods), passiveMods), skillBuffMods));
  const force = (state.attrs && state.attrs.force != null) ? state.attrs.force : (char.attrs ? char.attrs.force : 0);
  return (
    <div style={{ padding:'20px 24px' }}>
      <div className="panel" style={{ padding:'10px 16px', marginBottom:16 }}>
        <XpBar level={effLevel} xp={state.xp || 0} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'minmax(300px,1fr) minmax(300px,1fr) minmax(320px,1.05fr)', gap:20, alignItems:'start' }} className="sheet-grid">
        {/* COLONNE 1 — VITALITÉ & RESSOURCES */}
        <div className="col gap-5">
          <div className="panel">
            <div className="panel-head"><h3>Vitalité</h3></div>
            <div style={{ padding:'16px' }}><ResourceStack char={char} eff={eff} hp={hp} mana={mana} shield={shield} /></div>
          </div>
          <SurvivePanel fatigue={state.fatigue} eau={state.eau} setField={setField} />
          <HealPanel char={char} eff={eff} hp={hp} setHp={setHp} mana={mana} setMana={setMana} shield={shield} setShield={setShield}
            activeBuffs={activeBuffs} inventory={state.inventory} setInvItem={setInvItem} removeInvItem={removeInvItem} staff={canEdit} />
        </div>
        {/* COLONNE 2 — COMBAT & STATS */}
        <div className="col gap-5">
          <div className="panel">
            <div className="panel-head"><h3>Statistiques</h3></div>
            <div style={{ padding:'16px' }}><SecondaryStats breakdown={breakdown} /></div>
          </div>
          <WeaponPanel weapon={equippedWeapon} eff={eff} />
          <BuffsPanel char={char} activeBuffs={activeBuffs} setBuff={setBuff} />
        </div>
        {/* COLONNE 3 — INVENTAIRE (+ modificateurs MJ) */}
        <FicheInventoryColumn char={char} state={state} canEdit={canEdit} force={force}
          setInvItem={setInvItem} removeInvItem={removeInvItem} setMod={setMod} />
      </div>
    </div>
  );
```

(`FicheInventoryColumn` est créé en Task 7. Pour CETTE tâche, créer un stub temporaire afin que le fichier compile : voir Step 4.)

- [ ] **Step 4 : Stub temporaire `FicheInventoryColumn`**

Ajouter ce composant (sera remplacé en Task 7) :

```javascript
function FicheInventoryColumn({ char, state, canEdit, force, setInvItem, removeInvItem, setMod }) {
  return (
    <div className="col gap-5">
      <InventoryPanel items={state.inventory} editable={canEdit} onSave={(it) => setInvItem(it.id, it)} onRemove={removeInvItem} />
      {canEdit && <ModifiersPanel modifiers={state.modifiers} setMod={setMod} />}
    </div>
  );
}
```

- [ ] **Step 5 : Nettoyer `SheetPage` (retrait du toggle styles)**

Dans `SheetPage` (`pages-sheet.jsx:345-394`) :
- Supprimer `const [variant, setVariant] = useState('a');` et `const variants = [...]`.
- Supprimer le bloc des 3 boutons de style (`pages-sheet.jsx:379-383`).
- Supprimer la ligne d'annotation « Direction visuelle » (`pages-sheet.jsx:387-389`).
- Remplacer `<SheetBody char={char} variant={variant} />` par `<SheetBody char={char} />`.
- Dans la signature `function SheetBody({ char, variant })` → `function SheetBody({ char })`.

- [ ] **Step 6 : Vérif syntaxe**

Run : `npx esbuild pages-sheet.jsx >/dev/null`
Expected : aucune erreur.

- [ ] **Step 7 : Commit**

```bash
git add pages-sheet.jsx
git commit -m "feat(fiche): layout B (3 colonnes thématiques) + retrait du système de styles variant"
```

---

### Task 7 : Inventaire de la fiche en `InventoryGrid` adaptatif

**Files:**
- Modify: `pages-sheet.jsx` (`FicheInventoryColumn` créé en Task 6)

**Interfaces:**
- Consumes: `InventoryGrid` (Task 3, props `minCells`/`grow`), `ItemActionMenu`, `ItemCatalogPicker`, `planItemAdd`, `parseConsumableEffect`, `applyHealMods`, `INV_FILTERS`.
- Produces: colonne 3 = grille dark-fantasy adaptative + menu d'actions + modificateurs MJ.

- [ ] **Step 1 : Remplacer le stub `FicheInventoryColumn`**

Remplacer le composant stub par :

```javascript
function FicheInventoryColumn({ char, state, canEdit, force, setInvItem, removeInvItem, setMod }) {
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const [menu, setMenu] = useState(null);       // { item, x, y, actions }
  const [editing, setEditing] = useState(null);  // item édité (modal)
  const [catCat, setCatCat] = useState(null);     // picker catalogue
  const inv = state.inventory || {};
  const eff = state._eff;                          // stats effectives passées par SheetBody

  const consume = (it) => {
    const fx = parseConsumableEffect(it); if (!fx) { setMenu(null); return; }
    if (fx.kind === 'hp') {
      const gain = applyHealMods(fx.flat + Math.round((eff.hp || 0) * fx.pct / 100), Object.keys(state.buffs || {}));
      window.RTDB.updatePath(charPath(char.id), { hpCur: Math.min(eff.hp || 0, (state.hpCur || 0) + gain) });
      toast(`<b>${char.name}</b> utilise ${it.name} · +${gain} PV`, 'buff');
    } else {
      const gain = fx.flat + Math.round((eff.mana || 0) * fx.pct / 100);
      window.RTDB.updatePath(charPath(char.id), { manaCur: Math.min(eff.mana || 0, (state.manaCur || 0) + gain) });
      toast(`<b>${char.name}</b> utilise ${it.name} · +${gain} mana`, 'gold');
    }
    const q = (it.qty || 1) - 1;
    if (q <= 0) removeInvItem(it.id); else setInvItem(it.id, { ...it, qty: q });
    setMenu(null);
  };
  const openMenu = (item, e) => {
    e.stopPropagation();
    const actions = [];
    if (item.cat === 'Consommables' && parseConsumableEffect(item)) actions.push({ label:'Utiliser', onClick:() => consume(item) });
    if (canEdit) {
      actions.push({ label:'Éditer', onClick:() => { setEditing(item); setMenu(null); } });
      actions.push({ label:'Supprimer', danger:true, onClick:() => { removeInvItem(item.id); setMenu(null); } });
    }
    if (!actions.length) return;
    setMenu({ item, x: e.clientX, y: e.clientY, actions });
  };

  return (
    <div className="col gap-5">
      <div className="panel" style={{ padding:0, overflow:'hidden' }}>
        <InventoryGrid items={inv} coins={state.coins || char.coins} filter={filter} setFilter={setFilter}
          minCells={21} grow={true} onItemClick={openMenu} onAdd={canEdit ? (cat) => setCatCat(cat) : undefined} />
      </div>
      {canEdit && <ModifiersPanel modifiers={state.modifiers} setMod={setMod} />}
      {menu && <ItemActionMenu {...menu} onClose={() => setMenu(null)} />}
      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:420 }}>
            <InvItemRow item={editing} editable startEdit
              onSave={(it) => { setInvItem(it.id, it); setEditing(null); }}
              onRemove={() => { removeInvItem(editing.id); setEditing(null); }} />
          </div>
        </div>
      )}
      {catCat && (
        <ItemCatalogPicker initialFilter={catCat} staff={canEdit}
          onPick={(entry, n) => { const { patch } = planItemAdd(inv, entry, n); Object.entries(patch).forEach(([id, it]) => setInvItem(id, it)); setCatCat(null); }}
          onCustom={() => { const it = makeItem({ cat: catCat, name:'Nouvel objet' }); setInvItem(it.id, it); setCatCat(null); }}
          onClose={() => setCatCat(null)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2 : Passer `eff` à `FicheInventoryColumn` via l'état**

Dans `SheetBody`, juste avant le `return`, ajouter `eff` à l'objet passé. Le plus simple : passer `eff` en prop explicite. Modifier l'appel (Task 6, Step 3) à `FicheInventoryColumn` pour ajouter `state={{ ...state, _eff: eff }}` **n'est pas idéal** ; à la place, ajouter une prop dédiée. Remplacer la balise par :

```javascript
        <FicheInventoryColumn char={char} state={state} eff={eff} canEdit={canEdit} force={force}
          setInvItem={setInvItem} removeInvItem={removeInvItem} setMod={setMod} />
```

Et dans `FicheInventoryColumn`, remplacer la signature par `function FicheInventoryColumn({ char, state, eff, canEdit, force, setInvItem, removeInvItem, setMod }) {` et supprimer la ligne `const eff = state._eff;`.

- [ ] **Step 3 : Vérifier la disponibilité de `modal-backdrop`/`modal`**

Run : `grep -n "modal-backdrop" runeterra.css`
Si la classe n'existe pas, remplacer le wrapper de modal d'édition par un overlay inline :

```javascript
        <div onClick={() => setEditing(null)} style={{ position:'fixed', inset:0, background:'rgba(8,8,14,.8)', display:'grid', placeItems:'center', zIndex:1000 }}>
          <div className="panel" onClick={e => e.stopPropagation()} style={{ maxWidth:420, width:'90%', padding:16 }}>
```

(et fermer le `</div></div>` en conséquence). Choisir cette variante si `modal-backdrop` est absent.

- [ ] **Step 4 : Vérif syntaxe**

Run : `npx esbuild pages-sheet.jsx >/dev/null`
Expected : aucune erreur.

- [ ] **Step 5 : Commit**

```bash
git add pages-sheet.jsx
git commit -m "feat(fiche): inventaire en InventoryGrid adaptatif (minCells réduit, grow) + menu d'actions"
```

---

### Task 8 : Animations légères (jauges + flash)

**Files:**
- Modify: `runeterra.css` (keyframes + transition)
- Modify: `components.jsx` (`ResourceBar` — transition de largeur si absente)

**Interfaces:**
- Produces: jauges PV/mana avec transition de remplissage CSS. (Le flash dégât/soin est optionnel — n'implémenter que la transition de jauge dans cette tâche pour rester ciblé.)

- [ ] **Step 1 : Vérifier la transition sur `ResourceBar`**

Run : `grep -n "transition" components.jsx`
Repérer le `<div>` de remplissage de `ResourceBar` (la barre intérieure dont la largeur dépend de `cur/max`). S'assurer qu'il porte `transition:'width .4s ease'` dans son style inline. Si absent, l'ajouter au style de la barre intérieure.

- [ ] **Step 2 : Ajouter une classe d'animation de jauge dans `runeterra.css`**

Ajouter à la fin de `runeterra.css` :

```css
/* Remplissage des jauges (fiche) */
.gauge-fill { transition: width .4s ease; }
```

(Appliquée seulement si `ResourceBar` ne gère pas déjà la transition inline ; sinon cette tâche se limite au Step 1.)

- [ ] **Step 3 : Vérif syntaxe**

Run : `npx esbuild components.jsx >/dev/null`
Expected : aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add runeterra.css components.jsx
git commit -m "feat(fiche): transition de remplissage des jauges PV/mana"
```

---

### Task 9 : Vérification finale + cache-bump

**Files:**
- Modify: `index.html` (jeton `?v=…` + `window.APPV`)

- [ ] **Step 1 : Suite de tests complète**

Run : `node --test test/game-logic.test.js && node --test test/auth.test.js`
Expected : toutes les suites vertes.

- [ ] **Step 2 : Vérif syntaxe de tous les `.jsx` modifiés**

Run : `for f in pages-sheet.jsx pages-equip.jsx components.jsx; do npx esbuild "$f" >/dev/null && echo "OK $f"; done`
Expected : `OK` pour les trois.

- [ ] **Step 3 : Bumper le cache**

Dans `index.html`, repérer le jeton de version courant (ex. `20260624-2`) et l'incrémenter partout (search-replace, ex. → `20260628-1`), y compris `window.APPV`.

Run : `grep -c "20260628-1" index.html`
Expected : nombre > 0 (et 0 occurrence de l'ancien jeton).

- [ ] **Step 4 : Vérification visuelle en local (manuel)**

Servir le site (`python -m http.server 5050 --bind 127.0.0.1`), ouvrir la fiche d'un joueur :
- Les stats affichent `base · +mod · +stuff` ; un item équipé avec `mods` montre un delta `stuff`.
- Les consommables n'apparaissent que si possédés ; cliquer décrémente et fait disparaître à 0.
- En tant que joueur (rôle non-staff), les outils d'ajustement (Soigner/Dégâts/↺ max) sont absents ; en staff, présents.
- L'inventaire est la grille dark-fantasy, quelques cases vides, qui grandit avec le contenu.
- Plus de boutons de style « Tablettes/Hextech/Codex ».

- [ ] **Step 5 : Commit**

```bash
git add index.html
git commit -m "chore(fiche): cache-bump 20260628-1 + vérif finale refonte fiche"
```

---

## Self-review (couverture de la spec)

- Layout B (3 colonnes thématiques) → Task 6. ✅
- Retrait du toggle 3-styles + `variant` → Tasks 4, 6. ✅
- Breakdown stats base/+mod/+stuff → Task 1 (pur) + Task 4 (rendu). ✅
- Consommables réels (inventaire, gating qty, plus de potion = plus de bouton) → Task 2 + Task 5 (panneau) + Task 7 (menu grille). ✅
- Valeurs réelles affichées (potion mana 39, soin 81) → découle de Task 5 (calcul live `flat + pct% du max`). ✅
- Outils libres → MJ only → Task 5. ✅
- Fatigue/Eau gardés → Task 6 (`SurvivePanel`). ✅
- `InventoryGrid` adaptatif (`minCells`/`grow`) → Task 3 + Task 7. ✅
- Modificateurs MJ-only → Task 6 (`ModifiersPanel`, rendu si `canEdit`). ✅
- Animations légères → Task 8. ✅
- Zéro règle RTDB / zéro schéma → respecté (réutilise `setField`/`setInvItem`/`removeInvItem`/`updatePath`). ✅
- Cache-bump → Task 9. ✅
```
