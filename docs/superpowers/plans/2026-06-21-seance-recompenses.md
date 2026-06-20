# Cycle de séance + récompenses (sous-projet B) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (ou subagent-driven-development). Steps en cases `- [ ]`.

**Goal:** Rituel de séance côté MJ (modal début/visite, bandeau, clôture) qui distribue XP + argent aux joueurs en une fois.

**Architecture:** État de séance MJ-local (`localStorage`, hook `useSession`), modal de démarrage + bandeau dans `MJPage`, panneau de clôture (`SessionRewardsModal`) qui réutilise `addXp` (sous-projet A) pour l'XP et un nouvel orchestrateur `grantCoins` (don additif) pour l'argent ; loot d'objets délégué à l'onglet Inventaire commun (`go('inv')`).

**Tech Stack:** React 18 + Babel standalone (CDN, zéro build), Firebase RTDB compat, `node --test`.

## Global Constraints

- **Zéro build** : symboles définis localement puis accessibles via `window` (résolution nue). Pas d'`import`/`require` côté navigateur.
- **Toasts** : `const toast = useToast();` (hook, dans un composant). `pushLog` est global.
- **Aucune nouvelle règle RTDB** : `xp`/`coins` déjà en écriture staff sous `characters/$charId`. **Ne pas toucher `database.rules.json`.**
- **État de séance MJ-local** (`localStorage`), pas Firebase (zéro friction, testable sans console).
- `.jsx` vérifiés par `npx esbuild <fichier> >/dev/null`. Tests pure-logic : `node --test`.
- Commits fréquents, un par tâche.

---

### Task 1 : Orchestrateur `grantCoins` (data-state)

**Files:** Modify: `data-state.jsx` (ajouter `grantCoins` près de `addXp` ; ajouter à l'export `window`)

**Interfaces:**
- Consumes: `charPath`, `window.RTDB.getSnapshot`/`updatePath` (globals).
- Produces: `async grantCoins(charId, patch)` — **don additif** : ajoute `patch` (`{plat,or,arg,cuiv}`, valeurs ≥ 0) aux `coins` actuels du joueur. No-op si tout est 0.

- [ ] **Step 1 : Implémenter** — dans `data-state.jsx`, juste après la fonction `addXp` (sa `}` de fermeture), insérer :

```js
/* Don d'argent (orchestrateur, écriture staff) : AJOUTE le patch aux pièces du joueur
   (récompense, pas un transfert depuis le coffre). Dénominations < 0 ignorées. */
async function grantCoins(charId, patch) {
  const p = charPath(charId);
  const st = (await window.RTDB.getSnapshot(p)) || {};
  const cur = st.coins || {};
  const next = {};
  for (const k of ['plat', 'or', 'arg', 'cuiv']) {
    const add = Math.max(0, (patch && patch[k]) | 0);
    if (add) next[k] = (cur[k] || 0) + add;
  }
  if (Object.keys(next).length) window.RTDB.updatePath(`${p}/coins`, next);
}
```

- [ ] **Step 2 : Exporter** — dans le `Object.assign(window, { … })` final, ajouter `grantCoins` (sur la ligne `pushLog, useCombatLog, COMBAT_LOG, addXp,` → `… addXp, grantCoins,`).

- [ ] **Step 3 : Vérifier** — `npx esbuild data-state.jsx >/dev/null` (exit 0).

- [ ] **Step 4 : Commit** — `git commit -am "feat(seance): grantCoins (don additif d'argent)"`

---

### Task 2 : `useSession` + `SessionStartModal` + bandeau (MJPage)

**Files:** Modify: `pages-mj.jsx`

**Interfaces:**
- Consumes: `useState`/`useCallback` (globals).
- Produces: hook `useSession() -> { active, start(), close() }` ; composant `SessionStartModal({ onStart, onVisit })` ; intégration dans `MJPage` (modal au montage si pas de séance + bandeau + bouton Clôturer qui ouvre `rewards`).

- [ ] **Step 1 : Hook + modal de démarrage** — dans `pages-mj.jsx`, juste avant `function MJPage({ go }) {`, insérer :

```jsx
/* État de séance MJ-local (localStorage). v2 possible : partagé en Firebase. */
const SESSION_KEY = 'runeterra_session';
function useSession() {
  const [active, setActive] = useState(() => { try { return localStorage.getItem(SESSION_KEY) === '1'; } catch (e) { return false; } });
  const start = useCallback(() => { try { localStorage.setItem(SESSION_KEY, '1'); } catch (e) {} setActive(true); }, []);
  const close = useCallback(() => { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} setActive(false); }, []);
  return { active, start, close };
}
function SessionStartModal({ onStart, onVisit }) {
  return (
    <div className="modal-scrim" style={{ alignItems:'center' }}>
      <div style={{ width:'min(420px,100%)', background:'var(--bg-deep)', border:'1px solid var(--line-gold)', borderRadius:12, boxShadow:'var(--shadow-modal)', padding:'24px' }}>
        <h3 style={{ fontSize:20, marginBottom:6 }}>Ouverture de la table</h3>
        <p className="faint" style={{ fontSize:13, marginBottom:18 }}>Démarrer une séance (pour distribuer XP &amp; récompenses à la clôture) ou simplement visiter le site ?</p>
        <div className="col gap-2">
          <button className="btn btn-gold" style={{ justifyContent:'center' }} onClick={onStart}>🎲 Début de séance</button>
          <button className="btn btn-ghost" style={{ justifyContent:'center' }} onClick={onVisit}>Visite du site</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : États dans `MJPage`** — dans `MJPage`, après `const stOf = (id) => …;`, ajouter :

```jsx
  const { active, start, close } = useSession();
  const [decided, setDecided] = useState(false);
  const [rewards, setRewards] = useState(false);
```

- [ ] **Step 3 : Bandeau** — dans `MJPage`, repérer la fin de l'en-tête (la `</div>` qui ferme le `<div className="row" style={{ justifyContent:'space-between', padding:'16px 24px', …}}>`) suivie de `<div style={{ flex:1, overflow:'auto', padding:24 }}>`. Insérer **entre les deux** :

```jsx
        {active && (
          <div className="row" style={{ justifyContent:'space-between', alignItems:'center', padding:'10px 24px', background:'var(--bg-inset)', borderBottom:'1px solid var(--line-gold)' }}>
            <span className="mono" style={{ fontSize:13, color:'var(--gold-pale)' }}>🎲 Séance en cours</span>
            <button className="btn btn-sm btn-gold" onClick={() => setRewards(true)}>Clôturer la séance</button>
          </div>
        )}
```

- [ ] **Step 4 : Modals** — dans `MJPage`, repérer la fin du composant :

```jsx
      {full && <FullScreenSheet char={full} onClose={() => setFull(null)} />}
      {attacker && <EnemyAttackModal enemy={attacker} stOf={stOf} onClose={() => setAttacker(null)} />}
    </div>
  );
}
```

Insérer les 2 modals de séance **avant** `{full && …}` :

```jsx
      {!active && !decided && <SessionStartModal onStart={() => { start(); setDecided(true); }} onVisit={() => setDecided(true)} />}
      {rewards && <SessionRewardsModal onLoot={() => go('inv')} onCancel={() => setRewards(false)} onDone={() => { setRewards(false); close(); }} />}
      {full && <FullScreenSheet char={full} onClose={() => setFull(null)} />}
```

- [ ] **Step 5 : Vérifier** — `npx esbuild pages-mj.jsx >/dev/null`. **Échec attendu** à ce stade : `SessionRewardsModal is not defined` n'est PAS une erreur esbuild (référence runtime) — esbuild doit passer (exit 0). Si esbuild échoue, corriger la syntaxe.

- [ ] **Step 6 : Commit** — `git commit -am "feat(seance): useSession + modal début/visite + bandeau (MJPage)"`

---

### Task 3 : `SessionRewardsModal` (panneau de clôture)

**Files:** Modify: `pages-mj.jsx`

**Interfaces:**
- Consumes: `useToast`, `Avatar`, `CHARACTERS`, `addXp` (Task A), `grantCoins` (Task 1).
- Produces: `SessionRewardsModal({ onDone, onCancel, onLoot })` — tableau 5 persos (XP + 4 monnaies), « Distribuer & clôturer » applique `addXp`+`grantCoins` puis `onDone()`.

- [ ] **Step 1 : Implémenter** — dans `pages-mj.jsx`, juste après le composant `SessionStartModal` (sa `}` de fermeture), insérer :

```jsx
function SessionRewardsModal({ onDone, onCancel, onLoot }) {
  const toast = useToast();
  const [rows, setRows] = useState(() => {
    const o = {}; CHARACTERS.forEach(c => { o[c.id] = { xp:'', plat:'', or:'', arg:'', cuiv:'' }; }); return o;
  });
  const setVal = (id, k, v) => setRows(r => ({ ...r, [id]: { ...r[id], [k]: v } }));
  const num = (v) => Math.max(0, parseInt(v, 10) || 0);
  const fld = { width:54, background:'var(--bg-inset)', color:'var(--ink)', border:'1px solid var(--line-strong)', borderRadius:6, padding:'5px 6px', fontSize:12 };
  const apply = async () => {
    let totXp = 0, levelUps = 0;
    for (const c of CHARACTERS) {
      const r = rows[c.id]; const xp = num(r.xp);
      const coins = { plat:num(r.plat), or:num(r.or), arg:num(r.arg), cuiv:num(r.cuiv) };
      if (xp > 0) { const res = await addXp(c.id, xp); totXp += xp; levelUps += (res.levelsGained || 0); }
      if (coins.plat || coins.or || coins.arg || coins.cuiv) await grantCoins(c.id, coins);
    }
    toast(`Séance clôturée — <b>${totXp}</b> XP distribué${levelUps ? `, <b>${levelUps}</b> montée(s) de niveau` : ''}`, 'buff');
    onDone();
  };
  return (
    <div className="modal-scrim" style={{ alignItems:'stretch', padding:24 }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ width:'min(720px,100%)', margin:'auto', maxHeight:'100%', overflow:'auto', background:'var(--bg-deep)', border:'1px solid var(--line-gold)', borderRadius:12, boxShadow:'var(--shadow-modal)' }}>
        <div className="row" style={{ justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--line)' }}>
          <h3 style={{ fontSize:18 }}>Clôture de séance — récompenses</h3>
          <button className="btn btn-sm btn-ghost" onClick={onCancel}>✕</button>
        </div>
        <div style={{ padding:'12px 20px' }}>
          <div className="row" style={{ fontSize:10, color:'var(--ink-faint)', textTransform:'uppercase', letterSpacing:'.08em', paddingBottom:8 }}>
            <span style={{ flex:1 }}>Joueur</span>
            <span style={{ width:60, textAlign:'center' }}>XP</span>
            <span style={{ width:236, textAlign:'center' }}>Plat / Or / Arg / Cuiv</span>
          </div>
          {CHARACTERS.map(c => (
            <div key={c.id} className="row" style={{ alignItems:'center', gap:8, padding:'7px 0', borderTop:'1px solid var(--line)' }}>
              <span className="row gap-2" style={{ flex:1, alignItems:'center' }}>
                <Avatar char={c} size={28} radius={6} />
                <span style={{ fontSize:13, color:'var(--gold-pale)' }}>{c.name}</span>
              </span>
              <input type="number" min="0" value={rows[c.id].xp} onChange={e => setVal(c.id, 'xp', e.target.value)} placeholder="0" style={{ ...fld, width:56 }} />
              <span className="row gap-1">
                <input type="number" min="0" value={rows[c.id].plat} onChange={e => setVal(c.id, 'plat', e.target.value)} placeholder="0" style={fld} />
                <input type="number" min="0" value={rows[c.id].or} onChange={e => setVal(c.id, 'or', e.target.value)} placeholder="0" style={fld} />
                <input type="number" min="0" value={rows[c.id].arg} onChange={e => setVal(c.id, 'arg', e.target.value)} placeholder="0" style={fld} />
                <input type="number" min="0" value={rows[c.id].cuiv} onChange={e => setVal(c.id, 'cuiv', e.target.value)} placeholder="0" style={fld} />
              </span>
            </div>
          ))}
        </div>
        <div className="row" style={{ justifyContent:'space-between', alignItems:'center', padding:'14px 20px', borderTop:'1px solid var(--line)' }}>
          <button className="btn btn-ghost btn-sm" onClick={onLoot} title="Distribuer des objets via le coffre commun">Inventaire commun → (loot)</button>
          <span className="row gap-2">
            <button className="btn btn-ghost" onClick={onCancel}>Annuler</button>
            <button className="btn btn-gold" onClick={apply}>Distribuer &amp; clôturer</button>
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier** — `npx esbuild pages-mj.jsx >/dev/null` (exit 0).

- [ ] **Step 3 : Commit** — `git commit -am "feat(seance): SessionRewardsModal (distribution XP + argent à la clôture)"`

---

### Task 4 : Docs + vérification finale

**Files:** Modify: `CLAUDE.md`

- [ ] **Step 1 : Documenter `CLAUDE.md`** —
  (a) Description `data-state.jsx` : ajouter `grantCoins(charId, patch)` (don additif d'argent, orchestrateur).
  (b) Description `pages-mj.jsx` : ajouter le **cycle de séance** (`useSession` localStorage, `SessionStartModal`, bandeau « Séance en cours », `SessionRewardsModal` = distribution XP via `addXp` + argent via `grantCoins`, loot d'objets → onglet Inventaire commun).
  (c) Backlog : marquer **B (séance + récompenses) = FAIT (v1, MJ-local)** ; v2 éventuelle = état partagé + distribution d'objets intégrée.

- [ ] **Step 2 : Vérification complète** —
```bash
node --test test/game-logic.test.js test/auth.test.js
for f in data-state.jsx pages-mj.jsx; do npx esbuild "$f" >/dev/null && echo "OK $f"; done
```
Expected: tests PASS (77), `OK` pour chaque fichier.

- [ ] **Step 3 : Commit** — `git commit -am "docs(seance): cycle de séance + récompenses (sous-projet B v1)"`

---

## Self-review (couverture spec → tâches)

- État séance MJ-local (`useSession`/localStorage) → Task 2. ✅
- Modal début/visite à l'ouverture → Task 2 (Steps 1, 4). ✅
- Bandeau « Séance en cours » + Clôturer → Task 2 (Step 3). ✅
- Panneau clôture : XP (`addXp`) + argent (`grantCoins`) par joueur → Tasks 1, 3. ✅
- Loot d'objets via Inventaire commun (`go('inv')`) → Task 3 (bouton `onLoot`). ✅
- Aucune nouvelle règle RTDB → respecté. ✅
- Hors périmètre (séance partagée, distribution d'objets intégrée) → non implémenté (v2). ✅
