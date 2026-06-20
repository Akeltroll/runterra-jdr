# Buffs sur soi + Journal de combat — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Note d'exécution (ce repo) :** inline (subagents sans tests/git). UI JSX = vérif `esbuild` + chargement headless + manuel. Seule la logique pure de `game-logic.js` est testée.

**Goal:** Persister/partager le fil des événements de combat, et appliquer réellement les buffs sur soi des compétences (stats temporaires de combat, effacées par « ⟲ Combat »), affichés en orange.

**Architecture:** `combat/log` (file d'événements partagée, alimentée par les résolutions de dégâts) + `state/skillBuffs` (mods plats par compétence, snapshot au cast) sommés dans `computeEffective` ; couleur orange distincte pour les stats skill-buffées. `resetCombat` efface log + skillBuffs.

**Tech Stack:** React 18 + Babel standalone (CDN), Firebase RTDB compat, `node --test`.

## Global Constraints

- **Zéro build** : `Object.assign(window, {...})` + référence nue. Ordre : `game-logic.js` → `data.jsx` → `data-state.jsx` → `components.jsx` → `pages-*.jsx`.
- **Hooks Firebase = `data-state.jsx`** ; **logique pure testée = `game-logic.js`**.
- **+30% PV max = max plus grand, SANS soin** (pas de débordement au reset). Un bonus **plat** sur PV passe déjà dans `computeEffective` (seuls les % étaient exclus des PV).
- **Couleur skill-buff = orange `--skillbuff: #E8923C`** (priorité sur le vert items/runes).
- **`resetCombat` (« ⟲ Combat ») efface `skillBuffs` ET `combat/log`.**
- **Republier `database.rules.json`** au merge (ajout `combat/log`).
- Branche `feat/competences`. Commits français + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## File Structure

- **Modify** `data-state.jsx` — `COMBAT_LOG` + `pushLog`/`useCombatLog`/`clearLog` ; `setSkillBuff` (sur `useCharState`) ; `resetCombat` efface `skillBuffs`+log. Exports.
- **Modify** `game-logic.js` + `test/game-logic.test.js` — `sumSkillBuffs` (pur, testé).
- **Modify** `runeterra.css` — var `--skillbuff`.
- **Modify** `data.jsx` — `selfBuff` sur Urskaar C4 (`demi_ours`).
- **Modify** `components.jsx` — composant `CombatLog`.
- **Modify** `pages-mj.jsx` — `CombatLog` sous le plateau ; `pushLog` dans `PendingHitsPanel.apply` + `EnemyAttackModal.submit`.
- **Modify** `pages-competences.jsx` — cast applique `selfBuff`+bouclier ; merge `skillBuffMods` ; panneau orange « effets actifs » ; `CombatLog` en bas.
- **Modify** `pages-sheet.jsx`, `pages-equip.jsx` — merge `skillBuffMods` dans `computeEffective` ; équip colore orange.
- **Modify** `database.rules.json` — `combat/log`.

---

## PART A — Journal de combat

### Task 1 : Infra `combat/log` (data-state) + règle RTDB

**Files:** Modify `data-state.jsx`, `database.rules.json`.
**Interfaces — Produces:** `COMBAT_LOG`, `pushLog(text, kind)`, `useCombatLog() -> { entries: Array, clearLog() }`. `entries` triées du plus récent au plus ancien, ~30 max. `resetCombat` efface aussi le log.

- [ ] **Step 1 : Hook + helper** dans `data-state.jsx` (après `usePendingHits`/`applyHitToEnemy`) :

```jsx
const COMBAT_LOG = `${CAMPAIGN}/combat/log`;
function pushLog(text, kind) {
  const id = 'log_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e4);
  window.RTDB.updatePath(COMBAT_LOG, { [id]: { id, ts: Date.now(), text: String(text || ''), kind: kind || 'gold' } });
}
function useCombatLog() {
  const [map, setMap] = useState(null);
  useEffect(() => window.RTDB.subscribePath(COMBAT_LOG, (v) => setMap(v || {})), []);
  const entries = map ? Object.values(map).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 30) : [];
  const clearLog = useCallback(() => window.RTDB.setPath(COMBAT_LOG, null), []);
  return { entries, clearLog };
}
```

- [ ] **Step 2 : `resetCombat` efface le log** — dans `useSharedTurn`, ajouter dans `resetCombat` (après la boucle CHARACTERS) :

```jsx
    window.RTDB.setPath(COMBAT_LOG, null);
```

- [ ] **Step 3 : Exporter** — ajouter `pushLog, useCombatLog, COMBAT_LOG` au `Object.assign(window, {...})`.

- [ ] **Step 4 : Règle RTDB** — sous `combat`, à côté de `pendingHits` :

```json
"log": {
  ".read": "auth != null && root.child('users').child(auth.uid).child('role').exists()",
  "$logId": {
    ".write": "auth != null && root.child('users').child(auth.uid).child('role').exists()",
    ".validate": "newData.child('text').isString()"
  }
}
```

- [ ] **Step 5 : Vérif** — `npx esbuild data-state.jsx >/dev/null && echo OK` ; JSON rules OK.
- [ ] **Step 6 : Commit** — `git commit -am "feat(log): combat/log (pushLog/useCombatLog) + règle RTDB + reset"`

### Task 2 : Composant `CombatLog` + branchements

**Files:** Modify `components.jsx`, `pages-mj.jsx`, `pages-competences.jsx`.
**Interfaces — Consumes:** `useCombatLog`, `pushLog`, `renderToastMsg` (rendu sûr `<b>`).

- [ ] **Step 1 : Composant** dans `components.jsx` (près des toasts) :

```jsx
function CombatLog({ canClear }) {
  const { entries, clearLog } = useCombatLog();
  const COL = { gold: 'var(--gold-pale)', buff: 'var(--buff-bright)', debuff: 'var(--debuff-bright)' };
  return (
    <div className="panel" style={{ padding:'12px 14px' }}>
      <div className="row" style={{ justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div className="overline">Journal de combat</div>
        {canClear && entries.length > 0 && <button className="btn btn-sm btn-ghost" onClick={clearLog}>Vider</button>}
      </div>
      {entries.length === 0
        ? <div className="faint" style={{ fontSize:12 }}>Aucun événement.</div>
        : <div className="col gap-1" style={{ maxHeight:220, overflow:'auto' }}>
            {entries.map(e => (
              <div key={e.id} style={{ fontSize:12.5, lineHeight:1.5, color: COL[e.kind] || 'var(--ink)' }}>
                {renderToastMsg(e.text)}
              </div>
            ))}
          </div>}
    </div>
  );
}
```

- [ ] **Step 2 : Exporter** — ajouter `CombatLog` au `Object.assign(window, {...})` de `components.jsx`.

- [ ] **Step 3 : `pushLog` à la résolution joueur→ennemi** — dans `pages-mj.jsx`, `PendingHitsPanel`, fonction `apply`, après le `toast(...)` existant :

```jsx
    pushLog(`<b>${hit.attackerName}</b> inflige <b>${r.applied}</b> (${type}) à <b>${enemy.name}</b>${r.hpCur === 0 ? ' — KO !' : ''}`, r.hpCur === 0 ? 'debuff' : 'gold');
```

- [ ] **Step 4 : `pushLog` à l'attaque ennemi→joueur** — dans `pages-mj.jsx`, `EnemyAttackModal`, `submit`, après le `toast(...)` existant (qui contient `degats`, `type`, `c.name`, `res.ko`) :

```jsx
    pushLog(`<b>${enemy.name}</b> inflige <b>${degats}</b> (${type}) à <b>${c.name}</b>${res.ko ? ' — KO !' : ''}`, res.ko ? 'debuff' : 'gold');
```

- [ ] **Step 5 : Afficher dans la vue MJ** — dans `MJPage`, après la section Ennemis (fin du `<div style={{ marginTop:28 }}>` qui contient les ennemis), ajouter : `<div style={{ marginTop:28 }}><CombatLog canClear={true} /></div>`.

- [ ] **Step 6 : Afficher sur Compétences** — dans `CompetencesBody`, tout en bas du `return` (après la grille de comps), ajouter : `<CombatLog canClear={false} />`.

- [ ] **Step 7 : Vérif** — `for f in components pages-mj pages-competences; do npx esbuild $f.jsx >/dev/null; done && echo OK`.
- [ ] **Step 8 : Commit** — `git commit -am "feat(log): composant CombatLog + journal sous plateau & Compétences"`

---

## PART B — Buffs sur soi

### Task 3 : `sumSkillBuffs` (logique pure, TDD) + couleur CSS

**Files:** Modify `game-logic.js`, `test/game-logic.test.js`, `runeterra.css`.
**Interfaces — Produces:** `sumSkillBuffs(skillBuffs) -> { [stat]: number }` (somme des mods plats de chaque skill-buff).

- [ ] **Step 1 : Test qui échoue** — ajouter dans `test/game-logic.test.js` :

```js
test('sumSkillBuffs somme les mods plats par compétence', () => {
  assert.deepEqual(L.sumSkillBuffs({ demi_ours: { hp: 60, ad: 30 }, autre: { ad: 10 } }), { hp: 60, ad: 40 });
  assert.deepEqual(L.sumSkillBuffs({}), {});
  assert.deepEqual(L.sumSkillBuffs(null), {});
});
```

- [ ] **Step 2 : Échec** — `node --test test/game-logic.test.js` → FAIL.

- [ ] **Step 3 : Implémenter** dans `game-logic.js` (près de `sumPassiveMods`) :

```js
function sumSkillBuffs(skillBuffs) {
  skillBuffs = skillBuffs || {};
  const out = {};
  for (const id of Object.keys(skillBuffs)) {
    const m = skillBuffs[id] || {};
    for (const k of Object.keys(m)) { const v = Number(m[k]) || 0; if (v) out[k] = (out[k] || 0) + v; }
  }
  return out;
}
```

Ajouter `sumSkillBuffs` au `return { … }` de `game-logic.js`.

- [ ] **Step 4 : Succès** — `node --test test/game-logic.test.js` → PASS.

- [ ] **Step 5 : Var CSS** — dans `runeterra.css`, à côté de `--buff` (≈ ligne 41) : `  --skillbuff:     #E8923C;   /* bonus temporaire de compétence (orange) */`.

- [ ] **Step 6 : Commit** — `git commit -am "feat(buff): sumSkillBuffs (logique pure) + couleur --skillbuff"`

### Task 4 : État `skillBuffs` + `selfBuff` (data) + merge stats

**Files:** Modify `data-state.jsx`, `data.jsx`, `pages-sheet.jsx`, `pages-mj.jsx`, `pages-equip.jsx`.
**Interfaces — Produces:** `useCharState` rend `setSkillBuff(skillId, mods)` ; `resetCombat` efface `skillBuffs` ; `SKILLS.urskaar.actives[demi_ours].selfBuff`.

- [ ] **Step 1 : Setter** — dans `useCharState`, après `setCooldown` :

```jsx
const setSkillBuff = useCallback((skillId, mods) =>
  window.RTDB.updatePath(`${charPath(charId)}/skillBuffs`, { [skillId]: mods || null }), [charId]);
```

Ajouter `setSkillBuff` à l'objet retourné par `useCharState`.

- [ ] **Step 2 : `resetCombat` efface skillBuffs** — dans `resetCombat`, dans la boucle `CHARACTERS.forEach`, ajouter : `window.RTDB.setPath(\`${charPath(c.id)}/skillBuffs\`, null);`.

- [ ] **Step 3 : `selfBuff` sur Urskaar C4** — dans `data.jsx`, l'entrée `demi_ours`, ajouter le champ `selfBuff` (pourcentages de la stat de base) :

```jsx
{ id: 'demi_ours', name: 'On ne m\'arrêtera pas', mana: 100, cd: 0, kind: 'combat',
  dmg: (eff, c) => dmgUrskaarC4(eff, c.moved), selfBuff: { hp: 0.30, ad: 0.30, armure: 0.30 },
  note: 'Transfo 5 tours : +30% PV/AD/Armure. Déplacement : 100% AD (+25%/tranche) par unité. 1×/combat.' },
```

- [ ] **Step 4 : Merge `skillBuffMods` dans les 3 `computeEffective`** — chaque site calcule `skillBuffMods` et le merge (et le garde à part pour la couleur). `pages-sheet.jsx` :

```jsx
const passiveMods = sumPassiveMods(char.id, state.counters || {}, char.level || 1);
const skillBuffMods = sumSkillBuffs(state.skillBuffs || {});
const eff = computeEffective(char.stats, state.modifiers, activeBuffs, mergeMods(mergeMods(mergeMods(itemMods, runeMods), passiveMods), skillBuffMods));
```

`pages-mj.jsx` (`mjLive`) :

```jsx
const passiveMods = st ? sumPassiveMods(c.id, st.counters || {}, c.level || 1) : {};
const skillBuffMods = st ? sumSkillBuffs(st.skillBuffs || {}) : {};
const eff = computeEffective(c.stats, st ? st.modifiers : c.modifiers, buffs, mergeMods(mergeMods(mergeMods(itemMods, runeMods), passiveMods), skillBuffMods));
```

`pages-equip.jsx` :

```jsx
const passiveMods = sumPassiveMods(char.id, state.counters || {}, char.level || 1);
const skillBuffMods = sumSkillBuffs(state.skillBuffs || {});
const bonuses = mergeMods(mergeMods(sumItemMods(equipment, itemsById), runeMods), passiveMods);  // items+runes+passif -> vert
const eff = computeEffective(char.stats, state.modifiers, activeBuffs, mergeMods(bonuses, skillBuffMods));
```

- [ ] **Step 5 : Vérif** — `for f in data data-state pages-sheet pages-mj pages-equip; do npx esbuild $f.jsx >/dev/null; done && echo OK`.
- [ ] **Step 6 : Commit** — `git commit -am "feat(buff): état skillBuffs + selfBuff Urskaar C4 + merge dans computeEffective"`

### Task 5 : Cast applique le buff + couleur orange

**Files:** Modify `pages-competences.jsx`, `pages-equip.jsx`.
**Interfaces — Consumes:** `setSkillBuff`, `sumSkillBuffs`, `urskaarC3Shield` (via `sk.shield`), `skillBuffMods`.

- [ ] **Step 1 : `setSkillBuff` dans `CompetencesBody`** — étendre la déstructuration : `const { state, setField, setCounter, setCooldown, setSkillBuff } = useCharState(char.id);`.

- [ ] **Step 2 : Cast applique selfBuff + bouclier** — dans `cast(sk)`, après la pose du cooldown (avant le bloc dégâts/targetId) :

```jsx
    if (sk.selfBuff) {
      const flat = {};
      Object.keys(sk.selfBuff).forEach(k => { const f = Math.round(sk.selfBuff[k] * (char.stats[k] || 0)); if (f) flat[k] = f; });
      setSkillBuff(sk.id, flat);
      toast(`<b>${char.name}</b> — ${sk.name} actif (effet de combat)`, 'gold');
    }
    if (sk.shield) {
      const sh = sk.shield(eff, baseCtx);
      if (sh) { setField('shield', (state.shield || 0) + sh); toast(`<b>${char.name}</b> gagne ${sh} bouclier`, 'gold'); }
    }
```

- [ ] **Step 3 : Panneau « Effets de combat actifs » (orange)** — dans le rendu de `CompetencesBody`, après le bandeau ennemis, afficher les skill-buffs actifs :

```jsx
{(() => {
  const sb = sumSkillBuffs(state.skillBuffs || {});
  const keys = Object.keys(sb);
  if (!keys.length) return null;
  return (
    <div className="panel" style={{ padding: '10px 14px', borderLeft: '3px solid var(--skillbuff)' }}>
      <div className="overline" style={{ marginBottom: 6 }}>Effets de combat actifs</div>
      <div className="row gap-3 wrap">
        {keys.map(k => <span key={k} className="mono" style={{ fontSize: 12.5, color: 'var(--skillbuff)' }}>+{sb[k]} {k.toUpperCase()}</span>)}
      </div>
    </div>
  );
})()}
```

- [ ] **Step 4 : Orange sur l'Équipement** — dans `pages-equip.jsx`, remplacer `scol` pour prioriser l'orange si la stat est skill-buffée :

```jsx
const scol = (k) => (skillBuffMods[k] ? 'var(--skillbuff)' : (bonuses[k] ? '#9fd07a' : '#e9dcc4'));
```

- [ ] **Step 5 : Vérif** — `for f in pages-competences pages-equip; do npx esbuild $f.jsx >/dev/null; done && echo OK`.
- [ ] **Step 6 : Commit** — `git commit -am "feat(buff): cast applique skill-buff + bouclier ; couleur orange (Compétences + Équipement)"`

---

### Task 6 : Doc + tests + headless

**Files:** Modify `CLAUDE.md`.

- [ ] **Step 1 : Doc** — `CLAUDE.md` : modèle de données (`combat/log`, `state/skillBuffs`) ; `data-state.jsx` (`useCombatLog`/`pushLog`, `setSkillBuff`) ; `components.jsx` (`CombatLog`) ; `pages-competences.jsx` (buff actif + journal) ; couleur orange ; règle `combat/log` ; « État actuel ».
- [ ] **Step 2 : Tests** — `node --test test/game-logic.test.js test/auth.test.js` → tout vert (1 nouveau test `sumSkillBuffs`).
- [ ] **Step 3 : Chargement headless** — 0 erreur console + globaux (`CombatLog`, `useCombatLog`, `sumSkillBuffs`) définis (script Playwright temporaire, puis supprimé).
- [ ] **Step 4 : Commit** — `git commit -am "docs(buff/log): buffs sur soi + journal de combat"`

---

## Self-Review (couverture de la spec)

- `combat/log` + `pushLog` + branchements (résolution joueur→ennemi, ennemi→joueur) → Tasks 1, 2. ✅
- `CombatLog` sous plateau (MJ) + Compétences + « Vider » staff + reset vide le log → Tasks 1 (reset), 2. ✅
- `skillBuffs` plats snapshot au cast + `sumSkillBuffs` (testé) + merge `computeEffective` → Tasks 3, 4. ✅
- +30% PV max sans soin (plat) → Task 4 (selfBuff hp:0.30 → flat via `char.stats.hp`), Task 5 (cast, pas de heal). ✅
- Bouclier C3 au pool → Task 5 (`sk.shield`). ✅
- `resetCombat` efface skillBuffs (+log) → Tasks 1, 4. ✅
- Couleur orange `--skillbuff` (Compétences panel + Équipement scol) → Tasks 3, 5. ✅
- Règle RTDB `combat/log` + republication → Task 1 (+ note). ✅

**Hors périmètre (conforme spec) :** expiration au tour ; retrait manuel d'un buff ; crit Smith C4 ; orange sur la fiche (les nombres y augmentent déjà — orange réservé à Équipement + panneau Compétences).
