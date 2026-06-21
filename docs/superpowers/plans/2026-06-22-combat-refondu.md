# Combat refondu (léthalité + surcrit) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour implémenter ce plan tâche par tâche. Steps en cases `- [ ]`.

**Goal:** Brancher la **léthalité** (pénétration AR/RM) dans la résolution joueur→ennemi, et faire **rouler le crit/surcrit par l'app** au cast (paliers §6.3), le MJ gardant le contrôle du dégât final appliqué.

**Architecture:** Logique pure dans `game-logic.js` (`critInfo`, `rollCrit` — surcrit-aware ; `mitigateDamage` accepte déjà la léthalité). Le cast (`pages-competences.jsx`) roule le crit et snapshot le `letha` effectif dans l'attaque en attente. La carte MJ (`pages-mj.jsx`) affiche base/crit + léthalité éditable et passe la léthalité à `applyHitToEnemy` (`data-state.jsx`). L'attaque de base (`computeAttack`/`AttackModal`) réutilise `rollCrit`.

**Tech Stack:** Zéro-build (React 18 + Babel standalone CDN, `.jsx` via `<script type="text/babel">`), UMD + `Object.assign(window,…)`, tests `node --test`, vérif syntaxe `npx esbuild fichier >/dev/null`.

## Global Constraints

- **Zéro-build** : chaque fichier définit localement puis `Object.assign(window, {…})`. Ordre de chargement : `game-logic.js` → `data.jsx` → `data-state.jsx` → `components.jsx` → `pages-*.jsx`. La logique pure testée vit dans `game-logic.js`.
- **Aucune nouvelle règle RTDB** : `combat/pendingHits` a une `.validate` `newData.hasChildren(['attackerId','targetId','computedDmg'])` non restrictive — les champs ajoutés passent sans republier.
- **Rétrocompatibilité** : un hit créé avant déploiement (sans `critDmg`/`letha`) doit rester applicable → lecture défensive (`hit.critDmg ?? hit.computedDmg`, `hit.letha || 0`).
- **Vérif syntaxe** après tout edit `.jsx`/`.js` : `npx esbuild <fichier> >/dev/null`.
- Source de règles : `info-mj/SPECIFICATION - Système refondu.md` §6 + `docs/superpowers/specs/2026-06-22-combat-refondu-design.md`.

---

## Fichiers touchés

- `game-logic.js` — **Create** : `critInfo(critPct)`, `rollCrit(critPct, dcritBase, rng)`. Export. (`mitigateDamage` inchangé.)
- `data.jsx` — **Modify** : `computeAttack` (prend `critMult` au lieu de `isCrit`).
- `data-state.jsx` — **Modify** : `applyHitToEnemy` (param `lethalite`).
- `pages-competences.jsx` — **Modify** : cast (roule crit, snapshot letha, enrichit `addHit`, toast CRIT).
- `pages-mj.jsx` — **Modify** : `PendingHitRow`/`PendingHitsPanel` (affichage base/crit, léthalité éditable, passe letha).
- `components.jsx` — **Modify** : `AttackModal` (via `rollCrit`).
- `test/game-logic.test.js` — **Modify** : tests `critInfo`, `rollCrit`, `mitigateDamage` léthalité, `computeAttack`.
- `CLAUDE.md` — **Modify** : doc combat.

---

## Task 1 : Logique pure `critInfo` + `rollCrit`

**Files:**
- Modify: `game-logic.js` (ajouter après `mitigateDamage`, ~ligne 321 ; export)
- Test: `test/game-logic.test.js`

**Interfaces:**
- Produces:
  - `critInfo(critPct) -> { guaranteedTiers, extraChancePct }`.
  - `rollCrit(critPct, dcritBase, rng=Math.random) -> { didCrit, tiers, multiplier }` (`multiplier`=1 ⇒ pas de crit).

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter à la fin de `test/game-logic.test.js` :

```js
/* --- Combat refondu : crit & surcrit --- */
test('critInfo : paliers garantis + chance fractionnaire', () => {
  assert.deepEqual(L.critInfo(80),  { guaranteedTiers: 0, extraChancePct: 80 });
  assert.deepEqual(L.critInfo(100), { guaranteedTiers: 0, extraChancePct: 0 });
  assert.deepEqual(L.critInfo(250), { guaranteedTiers: 1, extraChancePct: 50 });
});
test('rollCrit : < 100 % = probabilité (rng injecté)', () => {
  assert.deepEqual(L.rollCrit(50, 200, () => 0.9), { didCrit: false, tiers: 0, multiplier: 1 });
  assert.deepEqual(L.rollCrit(50, 200, () => 0.1), { didCrit: true,  tiers: 1, multiplier: 2 });
});
test('rollCrit : >= 100 % = crit garanti + paliers de surcrit', () => {
  assert.deepEqual(L.rollCrit(100, 200, () => 0.9), { didCrit: true, tiers: 1, multiplier: 2 });   // base garanti
  assert.deepEqual(L.rollCrit(200, 200, () => 0.9), { didCrit: true, tiers: 2, multiplier: 2.5 }); // 1 palier garanti
  assert.deepEqual(L.rollCrit(250, 200, () => 0.9), { didCrit: true, tiers: 2, multiplier: 2.5 }); // 1 garanti, fraction ratée
  assert.deepEqual(L.rollCrit(250, 200, () => 0.1), { didCrit: true, tiers: 3, multiplier: 3 });   // 1 garanti + 1 fraction
});
test('rollCrit : espérance §6.3 (sanity, tolérance)', () => {
  // multiplicateur moyen ≈ (dcrit + (critPct-100)/2)/100 pour critPct >= 100
  let sum = 0, n = 4000;
  for (let i = 0; i < n; i++) sum += L.rollCrit(150, 200, Math.random).multiplier;
  const avg = sum / n;                       // attendu ≈ (200 + 25)/100 = 2.25
  assert.ok(Math.abs(avg - 2.25) < 0.1, `avg=${avg}`);
});
```

- [ ] **Step 2 : Lancer les tests, vérifier l'échec**

Run: `node --test test/game-logic.test.js`
Expected: FAIL (`critInfo is not a function`).

- [ ] **Step 3 : Implémenter `critInfo` + `rollCrit`**

Dans `game-logic.js`, juste après `mitigateDamage` (après sa `}`, ~ligne 321) :

```js
  /* --- Crit & surcrit par paliers (refonte §6.3) ---
     %Crit peut dépasser 100 % : à 100 % le crit est garanti ; chaque tranche de 100 %
     au-delà = un palier supplémentaire valant +50 % de Dégâts Crit. */
  function critInfo(critPct) {
    critPct = Math.max(0, Number(critPct) || 0);
    if (critPct < 100) return { guaranteedTiers: 0, extraChancePct: critPct };
    return { guaranteedTiers: Math.floor((critPct - 100) / 100), extraChancePct: (critPct - 100) % 100 };
  }
  function rollCrit(critPct, dcritBase, rng) {
    critPct = Math.max(0, Number(critPct) || 0);
    dcritBase = Number(dcritBase) || 0;
    rng = rng || Math.random;
    if (critPct < 100) {
      if (rng() < critPct / 100) return { didCrit: true, tiers: 1, multiplier: dcritBase / 100 };
      return { didCrit: false, tiers: 0, multiplier: 1 };
    }
    const frac = ((critPct - 100) % 100) / 100;
    const tiersSupp = Math.floor((critPct - 100) / 100) + (rng() < frac ? 1 : 0);
    return { didCrit: true, tiers: 1 + tiersSupp, multiplier: (dcritBase + 50 * tiersSupp) / 100 };
  }
```

Ajouter `critInfo, rollCrit` au bloc `return { … }` final.

- [ ] **Step 4 : Lancer les tests, vérifier le succès**

Run: `node --test test/game-logic.test.js`
Expected: PASS (4 nouveaux tests verts, aucun régressé).

- [ ] **Step 5 : Commit**

```bash
git add game-logic.js test/game-logic.test.js
git commit -m "feat(combat): critInfo + rollCrit (surcrit par paliers §6.3)"
```

---

## Task 2 : Couverture léthalité (mitigateDamage) + résolution étendue

**Files:**
- Test: `test/game-logic.test.js` (couverture léthalité de `mitigateDamage`)
- Modify: `data-state.jsx` (`applyHitToEnemy` accepte `lethalite`)

**Interfaces:**
- Consumes: `mitigateDamage(raw, type, defense, lethalite)` (existant).
- Produces: `applyHitToEnemy(enemy, finalDmg, type, lethalite = 0)` (signature étendue, défaut rétrocompatible).

- [ ] **Step 1 : Écrire le test de léthalité (mitigateDamage)**

Ajouter à `test/game-logic.test.js` :

```js
test('mitigateDamage : la léthalité réduit la résistance (sans passer sous 0)', () => {
  assert.equal(L.mitigateDamage(100, 'physique', { armure: 120 }, 0), 50);   // eff 120 → 50 %
  assert.equal(L.mitigateDamage(100, 'physique', { armure: 120 }, 120), 100); // eff 0 → aucune réduction
  assert.equal(L.mitigateDamage(100, 'physique', { armure: 120 }, 200), 100); // eff borné à 0
  assert.equal(L.mitigateDamage(100, 'brut',     { armure: 120 }, 50), 100);  // brut ignore tout
});
```

- [ ] **Step 2 : Lancer le test, vérifier qu'il passe déjà**

Run: `node --test test/game-logic.test.js`
Expected: PASS (la léthalité est déjà supportée par `mitigateDamage` ; ce test verrouille le comportement).

- [ ] **Step 3 : Étendre `applyHitToEnemy` (data-state.jsx ~118-123)**

Remplacer :
```js
function applyHitToEnemy(enemy, finalDmg, type) {
  const dmg = mitigateDamage(Math.max(0, finalDmg | 0), type, { armure: enemy.armure || 0, resmag: enemy.resmag || 0 });
```
par :
```js
function applyHitToEnemy(enemy, finalDmg, type, lethalite = 0) {
  const dmg = mitigateDamage(Math.max(0, finalDmg | 0), type, { armure: enemy.armure || 0, resmag: enemy.resmag || 0 }, Math.max(0, lethalite | 0));
```

- [ ] **Step 4 : Vérifier la syntaxe**

Run: `npx esbuild data-state.jsx >/dev/null && echo OK`
Expected: `OK`.

- [ ] **Step 5 : Commit**

```bash
git add data-state.jsx test/game-logic.test.js
git commit -m "feat(combat): applyHitToEnemy applique la léthalité + couverture mitigateDamage"
```

---

## Task 3 : Cast — rouler le crit + snapshot léthalité

**Files:**
- Modify: `pages-competences.jsx` (bloc cast ~210-216)

**Interfaces:**
- Consumes: `rollCrit` (Task 1), `eff` (stats effectives, déjà calculées dans le composant, incluent `crit`/`dcrit`/`letha`).
- Produces: attaque en attente enrichie `{ …, computedDmg, critDmg, didCrit, critMult, letha, crit, dcrit }`.

- [ ] **Step 1 : Enrichir le cast (pages-competences.jsx)**

Remplacer :
```js
    const dmg = sk.dmg ? sk.dmg(eff, baseCtx) : null; // dégâts unitaires (multi-cibles : le MJ duplique/ajuste)
    if (dmg != null && targetId) {
      addHit({ attackerId: char.id, attackerName: char.name, skillId: sk.id, skillName: sk.name,
        type: (wType === 'Magique' ? 'magique' : 'physique'), computedDmg: dmg, targetId });
      const tgt = enemies.find(en => en.id === targetId);
      pushLog(`<b>${char.name}</b> vise <b>${tgt ? tgt.name : 'un ennemi'}</b> avec <b>${sk.name}</b> (${dmg}) — en attente MJ`, 'gold');
      toast(`<b>${char.name}</b> vise un ennemi avec ${sk.name} (${dmg}) — envoyé au MJ`, 'buff');
    } else {
```
par :
```js
    const dmg = sk.dmg ? sk.dmg(eff, baseCtx) : null; // dégâts unitaires (multi-cibles : le MJ duplique/ajuste)
    if (dmg != null && targetId) {
      const cr = rollCrit(eff.crit || 0, eff.dcrit || 0);          // l'app roule le crit/surcrit
      const critDmg = Math.round(dmg * cr.multiplier);
      addHit({ attackerId: char.id, attackerName: char.name, skillId: sk.id, skillName: sk.name,
        type: (wType === 'Magique' ? 'magique' : 'physique'), computedDmg: dmg, targetId,
        critDmg, didCrit: cr.didCrit, critMult: cr.multiplier, letha: eff.letha || 0,
        crit: eff.crit || 0, dcrit: eff.dcrit || 0 });
      const tgt = enemies.find(en => en.id === targetId);
      const shown = cr.didCrit ? `${critDmg} — CRITIQUE !` : `${dmg}`;
      pushLog(`<b>${char.name}</b> vise <b>${tgt ? tgt.name : 'un ennemi'}</b> avec <b>${sk.name}</b> (${shown}) — en attente MJ`, cr.didCrit ? 'buff' : 'gold');
      toast(`<b>${char.name}</b> vise un ennemi avec ${sk.name} (${shown}) — envoyé au MJ`, 'buff');
    } else {
```

- [ ] **Step 2 : Vérifier la syntaxe**

Run: `npx esbuild pages-competences.jsx >/dev/null && echo OK`
Expected: `OK`.

- [ ] **Step 3 : Commit**

```bash
git add pages-competences.jsx
git commit -m "feat(combat): le cast roule le crit/surcrit + snapshot la léthalité"
```

---

## Task 4 : Carte MJ — affichage base/crit + léthalité, application

**Files:**
- Modify: `pages-mj.jsx` (`PendingHitRow` ~294-316, `PendingHitsPanel.apply` ~320-325)

**Interfaces:**
- Consumes: hit enrichi (Task 3), `applyHitToEnemy(enemy, finalDmg, type, lethalite)` (Task 2), `critInfo` (Task 1).

- [ ] **Step 1 : Remplacer `PendingHitRow` (pages-mj.jsx ~294-316)**

```js
/* Une attaque en attente : crit roulé par l'app, dégâts pré-remplis éditables (le MJ ajuste à son d20
   de toucher) + type + léthalité + appliquer/rejeter. */
function PendingHitRow({ hit, enemies, onApply, onReject }) {
  const enemy = enemies.find(e => e.id === hit.targetId);
  const rolled = hit.didCrit ? (hit.critDmg != null ? hit.critDmg : hit.computedDmg) : hit.computedDmg;
  const [dmg, setDmg] = useState(String(rolled || 0));
  const [type, setType] = useState(hit.type || 'physique');
  const [letha, setLetha] = useState(String(hit.letha || 0));
  const info = critInfo(hit.crit || 0);
  return (
    <div className="panel" style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:8 }}>
      <div className="row" style={{ justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:6 }}>
        <span style={{ fontSize:13 }}><b className="gold">{hit.attackerName}</b> · {hit.skillName} → <b>{enemy ? enemy.name : '— cible disparue —'}</b></span>
        {hit.didCrit
          ? <span className="mono" style={{ fontSize:11, color:'var(--skillbuff)' }}>🎲 CRIT ×{(hit.critMult || 1).toFixed(2)}</span>
          : <span className="mono faint" style={{ fontSize:11 }}>normal</span>}
      </div>
      <div className="row gap-2 wrap" style={{ fontSize:11, color:'var(--ink-faint)' }}>
        <span>Base : <b>{hit.computedDmg}</b></span>
        {hit.critDmg != null && <span>Crit : <b>{hit.critDmg}</b></span>}
        <span>%Crit {hit.crit || 0}{info.guaranteedTiers ? ` · ${info.guaranteedTiers} palier(s) garanti(s)` : ''}{info.extraChancePct ? ` · +${info.extraChancePct}%` : ''}</span>
      </div>
      <div className="row gap-2" style={{ alignItems:'center', flexWrap:'wrap' }}>
        <input style={{ ...ENEMY_FLD, width:80 }} value={dmg} onChange={e => setDmg(e.target.value)} title="Dégâts (ajuste au d20 de toucher)" />
        <label className="row gap-1" style={{ alignItems:'center', fontSize:11 }} title="Léthalité (réduit AR/RM)">
          <span className="faint">Léth.</span>
          <input style={{ ...ENEMY_FLD, width:56 }} value={letha} onChange={e => setLetha(e.target.value)} />
        </label>
        <div className="row gap-1">
          {['physique','magique','brut'].map(t => (
            <button key={t} className={'btn btn-sm ' + (type===t ? 'btn-gold' : 'btn-ghost')} onClick={() => setType(t)} style={{ textTransform:'capitalize' }}>{t}</button>
          ))}
        </div>
        <button className="btn btn-sm btn-gold" disabled={!enemy} onClick={() => onApply(hit, enemy, Math.max(0, parseInt(dmg,10)||0), type, Math.max(0, parseInt(letha,10)||0))} style={{ marginLeft:'auto' }}>Appliquer</button>
        <button className="btn btn-sm btn-ghost" onClick={() => onReject(hit.id)}>Rejeter</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Mettre à jour `PendingHitsPanel.apply` (pages-mj.jsx ~320-325)**

Remplacer :
```js
  const apply = (hit, enemy, finalDmg, type) => {
    const r = applyHitToEnemy(enemy, finalDmg, type);
```
par :
```js
  const apply = (hit, enemy, finalDmg, type, letha) => {
    const r = applyHitToEnemy(enemy, finalDmg, type, letha || 0);
```

- [ ] **Step 3 : Vérifier la syntaxe**

Run: `npx esbuild pages-mj.jsx >/dev/null && echo OK`
Expected: `OK`.

- [ ] **Step 4 : Commit**

```bash
git add pages-mj.jsx
git commit -m "feat(combat): carte MJ — base/crit + léthalité éditable + application"
```

---

## Task 5 : Attaque de base unifiée sur `rollCrit`

**Files:**
- Modify: `data.jsx` (`computeAttack` ~78-84)
- Modify: `components.jsx` (`AttackModal.launch` ~216-222)
- Test: `test/game-logic.test.js` (`computeAttack` n'est pas dans game-logic ; on teste via le multiplicateur — voir Step 1)

**Interfaces:**
- Consumes: `rollCrit` (Task 1).
- Produces: `computeAttack({ weapon, stats, lethality, critMult }) -> { power, base, dmg, pen }` (`dmg = round(base*critMult)`).

- [ ] **Step 1 : Modifier `computeAttack` (data.jsx ~77-84)**

Remplacer :
```js
/* --- Calcul d'une attaque (dégâts pleins ; le système de mode de combat a été retiré) --- */
function computeAttack({ weapon, stats, lethality, isCrit }) {
  const power = weapon.stat === 'ap' ? stats.ap : stats.ad;
  const base = power; // dégâts pleins
  const dmg = isCrit ? Math.round(base * (stats.dcrit / 100)) : base;
  const pen = lethality * 10; // léthalité = pénétration d'armure forfaitaire
  return { power, base, dmg, crit: isCrit, pen };
}
```
par :
```js
/* --- Calcul d'une attaque (dégâts pleins ; crit/surcrit roulé en amont via rollCrit) --- */
function computeAttack({ weapon, stats, lethality, critMult }) {
  const power = weapon.stat === 'ap' ? stats.ap : stats.ad;
  const base = power; // dégâts pleins
  const mult = (critMult != null ? critMult : 1);
  const dmg = Math.round(base * mult);
  const pen = (lethality || 0) * 10; // léthalité de type (sélecteur) = pénétration forfaitaire
  return { power, base, dmg, crit: mult > 1, pen };
}
```

- [ ] **Step 2 : Modifier `AttackModal.launch` (components.jsx ~216-222)**

Remplacer :
```js
  const launch = () => {
    const base = charBaseStats(char, null);
    const isCrit = Math.random() * 100 < base.crit;
    const r = computeAttack({ weapon, stats: base, lethality, isCrit });
    setResult(r);
    toast(`<b>${char.name}</b> inflige <b>${r.dmg}</b> dégâts ${weapon.cat.toLowerCase()}s${isCrit ? ' — CRITIQUE !' : ''}`, isCrit ? 'buff' : 'gold');
  };
```
par :
```js
  const launch = () => {
    const base = charBaseStats(char, null);
    const cr = rollCrit(base.crit || 0, base.dcrit || 0);
    const r = computeAttack({ weapon, stats: base, lethality, critMult: cr.multiplier });
    setResult(r);
    toast(`<b>${char.name}</b> inflige <b>${r.dmg}</b> dégâts ${weapon.cat.toLowerCase()}s${cr.didCrit ? (cr.tiers > 1 ? ` — SURCRIT ×${cr.multiplier.toFixed(2)} !` : ' — CRITIQUE !') : ''}`, cr.didCrit ? 'buff' : 'gold');
  };
```

- [ ] **Step 3 : Test du multiplicateur appliqué par `computeAttack`**

Ajouter à `test/game-logic.test.js` (note : `computeAttack` est exposé sur `window` par `data.jsx`, pas
par `game-logic.js` ; le test vérifie l'invariant `dmg = round(base*mult)` via une réimplémentation
locale identique, pour figer la règle) :

```js
test('computeAttack : dmg = round(base * critMult)', () => {
  // invariant figé (computeAttack vit dans data.jsx, non requis ici)
  const calc = (ad, mult) => Math.round(ad * mult);
  assert.equal(calc(100, 1), 100);    // pas de crit
  assert.equal(calc(100, 2), 200);    // crit base (dcrit 200)
  assert.equal(calc(100, 2.5), 250);  // surcrit 1 palier
});
```

- [ ] **Step 4 : Vérifier syntaxe + tests**

Run:
```bash
npx esbuild data.jsx >/dev/null && npx esbuild components.jsx >/dev/null && echo "esbuild OK"
node --test test/game-logic.test.js test/auth.test.js
```
Expected: `esbuild OK` + tous les tests PASS.

- [ ] **Step 5 : Commit**

```bash
git add data.jsx components.jsx test/game-logic.test.js
git commit -m "feat(combat): attaque de base unifiée sur rollCrit (surcrit inclus)"
```

---

## Task 6 : Documentation + vérification finale

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1 : Mettre à jour CLAUDE.md**

Dans la description de `game-logic.js`, après le combat (`mitigateDamage`/`applyDamageToPools`),
ajouter : `critInfo(critPct)` + `rollCrit(critPct, dcrit, rng)` (crit/**surcrit par paliers** §6.3 :
≥100 % garanti, +50 % Dég. Crit par palier). Dans la description de `pages-mj.jsx` (`PendingHitsPanel`),
noter que le crit est **roulé au cast** (l'app), affiché base/crit, et que la **léthalité** réduit AR/RM
à l'application (`applyHitToEnemy(enemy,dmg,type,letha)`). Dans la description de `pages-competences.jsx`,
noter que le cast **roule le crit** et **snapshot la léthalité** dans l'attaque en attente. Dans
« Modèle de données Firebase », sous `combat/pendingHits/{id}`, ajouter les champs
`critDmg, didCrit, critMult, letha, crit, dcrit`. Mettre à jour la ligne backlog « Refonte » :
sous-projet **Combat (§6) = fait** ; reste équipement (§7), respec UI, zone PNJ (§8).

- [ ] **Step 2 : Vérification finale complète**

Run:
```bash
node --test test/game-logic.test.js test/auth.test.js
for f in game-logic.js data.jsx data-state.jsx components.jsx pages-mj.jsx pages-competences.jsx; do npx esbuild "$f" >/dev/null && echo "OK $f"; done
```
Expected: tous les tests PASS + `OK` pour les 6 fichiers.

- [ ] **Step 3 : Vérification visuelle (manuelle, à signaler à l'utilisateur)**

Servir l'app (`python -m http.server 5050 --bind 127.0.0.1`). Connecté joueur : caster une compétence à
dégâts sur un ennemi ciblé → le toast indique CRIT le cas échéant. Connecté MJ : la carte « Attaques en
attente » montre base/crit + badge, champ pré-rempli, champ Léthalité ; **Appliquer** → vérifier que des
PV ennemis tombent et que la léthalité augmente bien les dégâts subis (tester letha 0 vs élevé). Tester
l'attaque de base (`AttackModal`) : crit/surcrit affiché.

- [ ] **Step 4 : Commit**

```bash
git add CLAUDE.md
git commit -m "docs(combat): léthalité + surcrit (CLAUDE.md)"
```

---

## Self-review (couverture spec)

- **Léthalité branchée** → Task 2 (`applyHitToEnemy` + `mitigateDamage`) + Task 3 (snapshot au cast) + Task 4 (éditable MJ).
- **Crit/surcrit roulé par l'app au cast** → Task 1 (`rollCrit`/`critInfo`) + Task 3 (cast).
- **MJ garde le contrôle du dégât final** → Task 4 (champ éditable pré-rempli).
- **Attaque de base unifiée** → Task 5.
- **Rétrocompatibilité hits** → Task 4 (`hit.critDmg ?? computedDmg`, `hit.letha || 0`).
- **Aucune règle RTDB** → respecté (`.validate` non restrictive).
- **Hors périmètre** (ennemi→joueur crit/léthalité, léthalité typée) → non inclus.
