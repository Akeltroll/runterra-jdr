# Plateau partagé — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Note d'exécution (ce repo) :** exécution **inline** (subagents sans tests/git ici). UI JSX zéro-build = pas de tests unitaires (vérif `npx esbuild` + chargement headless + vérif manuelle sur le serveur local). La logique de combat (`mitigateDamage`/`applyDamageToPools`) est déjà pure et testée : **pas de nouveau test à écrire**, juste ne pas casser les 69 verts.

**Goal:** Les ennemis deviennent partagés (Firebase) ; au cast d'une comp à dégâts le joueur cible un ennemi → crée une « attaque en attente » que le MJ ajuste (son d20) et applique sur les PV de l'ennemi.

**Architecture:** Migration de `useMJEnemies` (localStorage → `combat/enemies` Firebase, API inchangée) + nouveau nœud `combat/pendingHits` (file de propositions). Le cast écrit une proposition ; la Vue MJ la résout via les helpers de combat existants (`mitigateDamage`→`applyDamageToPools` sur l'ennemi). Aucune formule dé→dégâts (champ éditable, jugement MJ).

**Tech Stack:** React 18 + Babel standalone (CDN, zéro build), Firebase RTDB compat, `node --test`.

## Global Constraints

- **Zéro build** : symboles définis localement puis `Object.assign(window, {...})`, accès par référence nue. Ordre `index.html` : `game-logic.js` → `data.jsx` → `data-state.jsx` → `components.jsx` → `pages-*.jsx`.
- **Hooks Firebase = `data-state.jsx`** (avec les autres `use*`/`RTDB`).
- **Le joueur ne modifie jamais les PV d'un ennemi** : il crée une proposition (`pendingHits`) ; seul le staff applique (règle RTDB).
- **Réutiliser** `mitigateDamage(raw, type, {armure, resmag})` + `applyDamageToPools({hpCur, shield}, dmg)` (déjà testés) ; type ∈ `'physique'|'magique'|'brut'`.
- **Republier `database.rules.json`** au merge (ajouts `combat/enemies` + `combat/pendingHits`, en plus de `combat/turn`).
- Branche `feat/competences` (on empile). Commits français, `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Hors périmètre** : buffs sur soi (SP3, spec séparée).

## File Structure

- **Modify** `data-state.jsx` — `ENEMIES`/`PENDING_HITS` consts ; `newEnemyId`/`makeEnemy` (déplacés depuis pages-mj) ; `useMJEnemies` (Firebase) ; `usePendingHits` (+`addHit`/`removeHit`/`applyHitToEnemy`). Exports.
- **Modify** `pages-mj.jsx` — retire le bloc ennemis localStorage (garde `ENEMY_FLD`) ; `EnemyCard` édite armure/resmag ; nouvelle section `PendingHitsPanel` au-dessus des ennemis.
- **Modify** `pages-competences.jsx` — bandeau ennemis lecture seule + sélecteur cible sur les comps à dégâts + `addHit` au cast.
- **Modify** `database.rules.json` — `combat/enemies` + `combat/pendingHits`.
- **Modify** `CLAUDE.md` — doc.

---

## Task 1 : Ennemis en Firebase (`useMJEnemies` migré) + règle RTDB

**Files:** Modify `data-state.jsx`, `database.rules.json`.
**Interfaces — Produces:** `ENEMIES = 'campaign/runeterra/combat/enemies'`, `makeEnemy(name)`, `newEnemyId()`, `useMJEnemies() -> { enemies: Array, addEnemy(name), updateEnemy(id, patch), removeEnemy(id) }` (API identique à l'ancien hook local).

- [ ] **Step 1 : Ajouter le hook Firebase** dans `data-state.jsx` (après `useSharedTurn`) :

```jsx
const ENEMIES = `${CAMPAIGN}/combat/enemies`;
let _enemySeq = 0;
function newEnemyId() { return 'enemy_' + Date.now().toString(36) + '_' + (_enemySeq++); }
function makeEnemy(name) {
  return { id: newEnemyId(), name: name || 'Ennemi', hpCur: 100, hpMax: 100,
    manaCur: 0, manaMax: 0, atk: 10, armure: 0, resmag: 0, note: '' };
}
function useMJEnemies() {
  const [map, setMap] = useState(null);
  useEffect(() => window.RTDB.subscribePath(ENEMIES, (v) => setMap(v || {})), []);
  const enemies = map ? Object.values(map).sort((a, b) => (a.id < b.id ? -1 : 1)) : [];
  const addEnemy = useCallback((name) => { const e = makeEnemy(name); window.RTDB.updatePath(ENEMIES, { [e.id]: e }); }, []);
  const updateEnemy = useCallback((id, patch) => window.RTDB.updatePath(`${ENEMIES}/${id}`, patch), []);
  const removeEnemy = useCallback((id) => window.RTDB.updatePath(ENEMIES, { [id]: null }), []);
  return { enemies, addEnemy, updateEnemy, removeEnemy };
}
```

- [ ] **Step 2 : Exporter** — ajouter `useMJEnemies, makeEnemy, newEnemyId, ENEMIES` au `Object.assign(window, {...})` de `data-state.jsx`.

- [ ] **Step 3 : Règle RTDB** — dans `database.rules.json`, sous `combat` (à côté de `turn`) :

```json
"enemies": {
  ".read": "auth != null && root.child('users').child(auth.uid).child('role').exists()",
  ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'mj' || root.child('users').child(auth.uid).child('role').val() === 'admin')"
}
```

- [ ] **Step 4 : Vérif** — `npx esbuild data-state.jsx >/dev/null && echo OK` ; `node -e "JSON.parse(require('fs').readFileSync('database.rules.json','utf8'));console.log('JSON OK')"`.
- [ ] **Step 5 : Commit** — `git commit -am "feat(plateau): ennemis partagés en Firebase (useMJEnemies migré) + règle RTDB"`

### Task 2 : Nettoyer pages-mj + armure/resmag éditables

**Files:** Modify `pages-mj.jsx`.
**Interfaces — Consumes:** `useMJEnemies` (Task 1, désormais global).

- [ ] **Step 1 : Retirer le bloc local** — supprimer dans `pages-mj.jsx` les lignes `ENEMIES_KEY`, `_enemySeq`, `newEnemyId`, `makeEnemy`, `loadEnemies` **et la fonction locale `useMJEnemies`** (le commentaire « Ennemis (local au MJ…) » et le code jusqu'à la fin de `useMJEnemies`). **Garder `ENEMY_FLD`** (utilisé par EnemyCard/EnemyAttackModal). `useMJEnemies` est maintenant résolu via `window` (data-state.jsx).

- [ ] **Step 2 : Champs armure/resmag dans l'édition d'ennemi** — dans `EnemyCard`, le formulaire d'édition (`if (edit) { … }`), après `{field("Dégât d'attaque", 'atk')}` :

```jsx
{field("Armure", 'armure')}
{field("Rés. magique", 'resmag')}
```

- [ ] **Step 3 : Vérif** — `npx esbuild pages-mj.jsx >/dev/null && echo OK`. Sur le serveur local (MJ connecté) : ajouter un ennemi, recharger la page → **l'ennemi persiste** (Firebase) ; éditer armure/resmag.
- [ ] **Step 4 : Commit** — `git commit -am "feat(plateau): vue MJ lit les ennemis partagés + armure/resmag éditables"`

### Task 3 : File d'attaques en attente (`usePendingHits` + orchestrateur)

**Files:** Modify `data-state.jsx`, `database.rules.json`.
**Interfaces — Produces:** `PENDING_HITS`, `usePendingHits() -> { hits: Array, addHit(hit), removeHit(id) }`, `applyHitToEnemy(enemy, finalDmg, type)` (applique les dégâts à l'ennemi en Firebase ; ne touche pas la file).
- `hit` = `{ id, attackerId, attackerName, skillId, skillName, type, computedDmg, targetId, ts }` (`addHit` génère `id`+`ts`).

- [ ] **Step 1 : Hook + orchestrateur** dans `data-state.jsx` (après `useMJEnemies`) :

```jsx
const PENDING_HITS = `${CAMPAIGN}/combat/pendingHits`;
function usePendingHits() {
  const [map, setMap] = useState(null);
  useEffect(() => window.RTDB.subscribePath(PENDING_HITS, (v) => setMap(v || {})), []);
  const hits = map ? Object.values(map).sort((a, b) => (a.ts || 0) - (b.ts || 0)) : [];
  const addHit = useCallback((hit) => {
    const id = 'hit_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e4);
    window.RTDB.updatePath(PENDING_HITS, { [id]: Object.assign({ id, ts: Date.now() }, hit) });
  }, []);
  const removeHit = useCallback((id) => window.RTDB.updatePath(PENDING_HITS, { [id]: null }), []);
  return { hits, addHit, removeHit };
}
// Applique des dégâts (déjà ajustés par le MJ) à un ennemi : réduction armure/resmag puis pool HP.
function applyHitToEnemy(enemy, finalDmg, type) {
  const dmg = mitigateDamage(Math.max(0, finalDmg | 0), type, { armure: enemy.armure || 0, resmag: enemy.resmag || 0 });
  const res = applyDamageToPools({ hpCur: enemy.hpCur || 0, shield: 0 }, dmg);
  window.RTDB.updatePath(`${ENEMIES}/${enemy.id}`, { hpCur: res.hpCur });
  return { applied: dmg, hpCur: res.hpCur };
}
```

- [ ] **Step 2 : Exporter** — ajouter `usePendingHits, applyHitToEnemy, PENDING_HITS` au `Object.assign(window, {...})`.

- [ ] **Step 3 : Règle RTDB** — sous `combat`, à côté de `enemies` :

```json
"pendingHits": {
  ".read": "auth != null && root.child('users').child(auth.uid).child('role').exists()",
  "$hitId": {
    ".write": "auth != null && root.child('users').child(auth.uid).child('role').exists()",
    ".validate": "newData.hasChildren(['attackerId', 'targetId', 'computedDmg'])"
  }
}
```

- [ ] **Step 4 : Vérif** — `npx esbuild data-state.jsx >/dev/null && echo OK` ; JSON rules OK.
- [ ] **Step 5 : Commit** — `git commit -am "feat(plateau): file pendingHits + applyHitToEnemy + règle RTDB"`

### Task 4 : Vue MJ — section « Attaques en attente »

**Files:** Modify `pages-mj.jsx`.
**Interfaces — Consumes:** `usePendingHits`, `applyHitToEnemy`, `useMJEnemies` (pour résoudre la cible).

- [ ] **Step 1 : Composant `PendingHitsPanel`** — ajouter dans `pages-mj.jsx` (avant `MJPage`) :

```jsx
function PendingHitRow({ hit, enemies, onApply, onReject }) {
  const enemy = enemies.find(e => e.id === hit.targetId);
  const [dmg, setDmg] = useState(String(hit.computedDmg || 0));
  const [type, setType] = useState(hit.type || 'physique');
  return (
    <div className="panel" style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:8 }}>
      <div className="row" style={{ justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:6 }}>
        <span style={{ fontSize:13 }}><b className="gold">{hit.attackerName}</b> · {hit.skillName} → <b>{enemy ? enemy.name : '— cible disparue —'}</b></span>
        <span className="mono faint" style={{ fontSize:11 }}>calculé : {hit.computedDmg}</span>
      </div>
      <div className="row gap-2" style={{ alignItems:'center', flexWrap:'wrap' }}>
        <input style={{ ...ENEMY_FLD, width:80 }} value={dmg} onChange={e => setDmg(e.target.value)} title="Dégâts (ajuste au d20)" />
        <div className="row gap-1">
          {['physique','magique','brut'].map(t => (
            <button key={t} className={'btn btn-sm ' + (type===t ? 'btn-gold' : 'btn-ghost')} onClick={() => setType(t)} style={{ textTransform:'capitalize' }}>{t}</button>
          ))}
        </div>
        <button className="btn btn-sm btn-gold" disabled={!enemy} onClick={() => onApply(hit, enemy, Math.max(0, parseInt(dmg,10)||0), type)} style={{ marginLeft:'auto' }}>Appliquer</button>
        <button className="btn btn-sm btn-ghost" onClick={() => onReject(hit.id)}>Rejeter</button>
      </div>
    </div>
  );
}
function PendingHitsPanel({ enemies }) {
  const { hits, removeHit } = usePendingHits();
  if (!hits.length) return null;
  const apply = (hit, enemy, finalDmg, type) => {
    const r = applyHitToEnemy(enemy, finalDmg, type);
    toast(`<b>${hit.attackerName}</b> inflige <b>${r.applied}</b> (${type}) à <b>${enemy.name}</b>${r.hpCur === 0 ? ' — KO !' : ''}`, r.hpCur === 0 ? 'debuff' : 'gold');
    removeHit(hit.id);
  };
  return (
    <div style={{ marginBottom:24 }}>
      <h3 style={{ fontSize:16, marginBottom:12 }}>Attaques en attente <span className="mono faint" style={{ fontSize:12 }}>· {hits.length}</span></h3>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:12 }}>
        {hits.map(h => <PendingHitRow key={h.id} hit={h} enemies={enemies} onApply={apply} onReject={removeHit} />)}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Brancher dans `MJPage`** — juste avant le bloc `<div style={{ marginTop:28 }}>` (section Ennemis), insérer : `<PendingHitsPanel enemies={enemies} />`. (`enemies` est déjà disponible via `useMJEnemies` dans `MJPage`.)

- [ ] **Step 3 : Vérif** — `npx esbuild pages-mj.jsx >/dev/null && echo OK`. (Test fonctionnel complet après Task 5, quand le cast crée des hits.)
- [ ] **Step 4 : Commit** — `git commit -am "feat(plateau): vue MJ — section Attaques en attente (éditable, appliquer/rejeter)"`

### Task 5 : Compétences — bandeau ennemis + ciblage au cast

**Files:** Modify `pages-competences.jsx`.
**Interfaces — Consumes:** `useMJEnemies` (lecture), `usePendingHits` (`addHit`).

- [ ] **Step 1 : Lire ennemis + file dans `CompetencesBody`** — après `const { turn } = useSharedTurn();` :

```jsx
const { enemies } = useMJEnemies();
const { addHit } = usePendingHits();
const [targetId, setTargetId] = useState('');
```

- [ ] **Step 2 : Bandeau ennemis (lecture seule)** — dans le rendu de `CompetencesBody`, après la ligne titre/tour :

```jsx
{enemies.length > 0 && (
  <div className="panel" style={{ padding:'10px 14px' }}>
    <div className="overline" style={{ marginBottom:6 }}>Ennemis en jeu</div>
    <div className="row gap-3 wrap">
      {enemies.map(e => <span key={e.id} className="mono" style={{ fontSize:12, color: e.hpCur === 0 ? 'var(--faint)' : 'var(--ink)' }}>{e.name} · {e.hpCur}/{e.hpMax} PV</span>)}
    </div>
  </div>
)}
```

- [ ] **Step 3 : Cible + envoi au cast** — étendre `cast(sk)` : si la comp inflige des dégâts (`sk.dmg` renvoie un nombre pour le `ctx` courant), créer un `pendingHit`. Le type vient du type d'arme (`wType`) :

```jsx
function cast(sk) {
  const cost = sk.mana || 0;
  const manaCur = state.manaCur || 0;
  if (manaCur < cost) { toast(`<b>${char.name}</b> — pas assez de mana (${manaCur}/${cost})`, 'gold'); return; }
  setField('manaCur', manaCur - cost);
  if (sk.kind === 'combat') setCooldown(sk.id, CD_LOCKED);
  else setCooldown(sk.id, nextReadyAt(turn, sk.kind === 'turn' ? 1 : sk.cd));
  const dmg = sk.dmg ? sk.dmg(eff, baseCtx) : null; // dégâts unitaires (multi-cibles : le MJ duplique/ajuste)
  if (dmg != null && targetId) {
    addHit({ attackerId: char.id, attackerName: char.name, skillId: sk.id, skillName: sk.name,
      type: (wType === 'Magique' ? 'magique' : 'physique'), computedDmg: dmg, targetId });
    toast(`<b>${char.name}</b> vise un ennemi avec ${sk.name} (${dmg}) — envoyé au MJ`, 'buff');
  } else {
    toast(`<b>${char.name}</b> lance ${sk.name}`, 'buff');
  }
}
```

- [ ] **Step 4 : Sélecteur de cible dans `ActiveCard`** — pour les comps à dégâts, ajouter un `<select>` de cible. Passer `enemies`, `targetId`, `setTargetId` en props à `ActiveCard` et, si `dmg != null && enemies.length`, afficher avant le bouton Lancer :

```jsx
<select value={targetId} onChange={e => setTargetId(e.target.value)} style={{ background:'var(--bg-inset)', color:'var(--ink)', border:'1px solid var(--line-strong)', borderRadius:5, padding:'4px 6px', fontSize:12 }}>
  <option value="">— cible —</option>
  {enemies.filter(en => en.hpCur > 0).map(en => <option key={en.id} value={en.id}>{en.name} ({en.hpCur} PV)</option>)}
</select>
```

(Le bouton **Lancer** reste actif sans cible — un cast sans cible ne fait que mana/CD ; avec cible, il crée l'attaque en attente.)

- [ ] **Step 5 : Vérif** — `npx esbuild pages-competences.jsx >/dev/null && echo OK`. Test bout-en-bout sur le serveur local : MJ crée un ennemi → joueur (autre onglet/connexion) voit le bandeau, choisit la cible, lance une comp à dégâts → l'attaque apparaît dans « Attaques en attente » du MJ → le MJ ajuste/applique → PV de l'ennemi baissent.
- [ ] **Step 6 : Commit** — `git commit -am "feat(plateau): Compétences — bandeau ennemis + ciblage + envoi au MJ"`

### Task 6 : Doc + suite de tests

**Files:** Modify `CLAUDE.md`.

- [ ] **Step 1 : Doc** — dans `CLAUDE.md` : modèle de données (`combat/enemies`, `combat/pendingHits`) ; `pages-mj.jsx` (section Attaques en attente, ennemis partagés) ; `pages-competences.jsx` (ciblage) ; `data-state.jsx` (`useMJEnemies` Firebase, `usePendingHits`, `applyHitToEnemy`) ; note de republication RTDB ; « État actuel ».
- [ ] **Step 2 : Tests** — `node --test test/game-logic.test.js test/auth.test.js` → **69 verts** (aucune régression ; aucun nouveau test attendu).
- [ ] **Step 3 : Chargement headless** — vérifier 0 erreur console + globaux définis (`useMJEnemies`, `usePendingHits`, `applyHitToEnemy`, `CompetencesPage`) via un script Playwright temporaire (puis le supprimer).
- [ ] **Step 4 : Commit** — `git commit -am "docs(plateau): ennemis partagés + attaques en attente"`

---

## Self-Review (couverture de la spec)

- Ennemis → Firebase + lecture inscrits / écriture staff → Task 1 (+règle), Task 2. ✅
- `useMJEnemies` API inchangée → Task 1. ✅
- armure/resmag ennemis (pour `mitigateDamage`) → Task 1 (défaut), Task 2 (édition). ✅
- `pendingHits` (proposition par le joueur) + règle → Task 3, Task 5. ✅
- Résolution MJ éditable (d20) + appliquer/rejeter via `mitigateDamage`/`applyDamageToPools` → Task 3 (`applyHitToEnemy`), Task 4. ✅
- Bandeau ennemis lecture seule + sélecteur cible côté joueur → Task 5. ✅
- Attaques ennemi→joueur inchangées (déjà éditables) → aucun changement (conforme spec). ✅
- Republication RTDB → Tasks 1, 3 (+ note). ✅

**Hors périmètre (conforme spec) :** buffs sur soi (SP3) ; auto-roll d20.
