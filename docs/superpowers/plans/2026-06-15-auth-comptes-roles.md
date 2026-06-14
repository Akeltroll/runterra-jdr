# Authentification par comptes & rôles — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la connexion anonyme par de vrais comptes (identifiant + mot de passe) avec cloisonnement par rôle (joueur/mj/admin) appliqué côté serveur : un joueur n'accède qu'à sa fiche.

**Architecture:** Projet « zéro build » (React 18 + Babel standalone via CDN, fichiers `.jsx` chargés en `<script type="text/babel">`, globals via `Object.assign(window, …)`). La logique pure va dans un module UMD testable en Node (`auth.js`, calqué sur `game-logic.js`). L'auth Firebase Email/Password remplace l'anonyme dans `firebase-config.js`. Un nœud `/users/{uid}` (rôle + perso) est consulté par les règles RTDB pour autoriser/refuser côté serveur. L'UI (login, écran d'attente, nav filtrée, page Admin) lit ce nœud pour décider de l'affichage.

**Tech Stack:** React 18 (UMD CDN), Firebase compat 10.12.2 (auth + database), Babel standalone, Node `node:test` (tests purs), Playwright (smoke test).

**Référence spec :** `docs/superpowers/specs/2026-06-15-auth-comptes-roles-design.md`

---

## Structure des fichiers

| Fichier | Rôle |
|---------|------|
| `auth.js` (CREATE) | Logique pure UMD : `usernameToEmail`, `ROLES`, `isStaff`, `isAdmin`, `isPending`, `pagesForRole`, `canSeePage`. Testable en Node + exposé sur `window`. |
| `test/auth.test.js` (CREATE) | Tests unitaires des helpers purs (`node --test`). |
| `firebase-config.js` (MODIFY) | Retirer l'anonyme ; auth Email/Password ; helpers `signIn`/`signOut`/`onAuth`/`currentUser`. |
| `data-state.jsx` (MODIFY) | Remplacer `useIdentity` par `useAuthIdentity` (+ auto-inscription) ; ajouter `useAllUsers`, `setUserAssignment`. Gater `seedIfEmpty` au staff. |
| `components.jsx` (MODIFY) | Retirer `IdentityModal` ; ajouter `LoginScreen`, `PendingScreen`, `SignOutButton`. |
| `pages-admin.jsx` (CREATE) | Page Admin : tableau des comptes, attribution rôle + perso. |
| `pages-sheet.jsx` (MODIFY) | `SheetPage` accepte `lockedCharId` : masque le sélecteur de perso pour un joueur. |
| `index.html` (MODIFY) | Charger `auth.js` + `pages-admin.jsx` ; refonte du `App` (gating auth/rôle, nav filtrée, déconnexion). |
| `database.rules.json` (MODIFY) | Règles strictes basées sur `/users/{uid}`. |
| `test/smoke.mjs` (MODIFY) | Se connecter avec un compte de test au lieu de l'anonyme. |
| `CLAUDE.md` (MODIFY) | Doc : auth comptes + rôles, modèle `/users`, check-list déploiement. |

**Ordre de chargement dans `index.html`** (important) : firebase SDK → **`auth.js`** → `firebase-config.js` → `game-logic.js` → `data.jsx` → `data-state.jsx` → `components.jsx` → `pages-*.jsx` (+ **`pages-admin.jsx`**) → shell. `auth.js` doit précéder `firebase-config.js` (qui utilise `usernameToEmail`).

---

## Task 1 : Logique pure d'auth (`auth.js`) — TDD

**Files:**
- Create: `auth.js`
- Test: `test/auth.test.js`

- [ ] **Step 1 : Écrire les tests qui échouent**

Create `test/auth.test.js` :

```js
const test = require('node:test');
const assert = require('node:assert');
const A = require('../auth.js');

test('usernameToEmail normalise et suffixe le domaine factice', () => {
  assert.equal(A.usernameToEmail('Jett'), 'jett@runeterra.local');
  assert.equal(A.usernameToEmail('  AkelTroll '), 'akeltroll@runeterra.local');
  assert.equal(A.usernameToEmail('jean.bap_01'), 'jean.bap_01@runeterra.local');
});

test('usernameToEmail refuse les entrées invalides (null)', () => {
  assert.equal(A.usernameToEmail(''), null);
  assert.equal(A.usernameToEmail('a'), null);            // trop court
  assert.equal(A.usernameToEmail('jett espace'), null);  // espace interne
  assert.equal(A.usernameToEmail('jett@x'), null);       // caractère interdit
  assert.equal(A.usernameToEmail(42), null);
});

test('isStaff / isAdmin', () => {
  assert.equal(A.isStaff('mj'), true);
  assert.equal(A.isStaff('admin'), true);
  assert.equal(A.isStaff('joueur'), false);
  assert.equal(A.isAdmin('admin'), true);
  assert.equal(A.isAdmin('mj'), false);
});

test('isPending = joueur sans perso attribué', () => {
  assert.equal(A.isPending({ role: 'joueur' }), true);
  assert.equal(A.isPending({ role: 'joueur', charId: '' }), true);
  assert.equal(A.isPending({ role: 'joueur', charId: 'jett' }), false);
  assert.equal(A.isPending({ role: 'mj' }), false);
  assert.equal(A.isPending(null), false);
});

test('canSeePage filtre selon le rôle', () => {
  assert.equal(A.canSeePage('sheet', 'joueur'), true);
  assert.equal(A.canSeePage('mj', 'joueur'), false);
  assert.equal(A.canSeePage('admin', 'joueur'), false);
  assert.equal(A.canSeePage('mj', 'mj'), true);
  assert.equal(A.canSeePage('admin', 'mj'), false);
  assert.equal(A.canSeePage('admin', 'admin'), true);
  assert.deepEqual(A.pagesForRole('joueur'), ['sheet']);
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `node --test test/auth.test.js`
Expected: FAIL (`Cannot find module '../auth.js'`).

- [ ] **Step 3 : Écrire `auth.js`**

Create `auth.js` :

```js
/* ============================================================
   LOGIQUE D'AUTH PURE — Chroniques de Runeterra
   Aucune dépendance React/DOM/Firebase : testable en Node,
   et exposée sur `window` côté navigateur (UMD léger).
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') Object.assign(window, api);
})(typeof self !== 'undefined' ? self : this, function () {

  const EMAIL_DOMAIN = 'runeterra.local';
  const ROLES = ['joueur', 'mj', 'admin'];

  /* Pseudo -> e-mail factice pour Firebase Email/Password.
     Renvoie null si le pseudo est invalide. */
  function usernameToEmail(username) {
    if (typeof username !== 'string') return null;
    const u = username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{2,30}$/.test(u)) return null;
    return u + '@' + EMAIL_DOMAIN;
  }

  const isStaff = (role) => role === 'mj' || role === 'admin';
  const isAdmin = (role) => role === 'admin';

  /* Un compte joueur sans perso attribué est « en attente ». */
  const isPending = (rec) => !!rec && rec.role === 'joueur' && !rec.charId;

  /* Pages visibles selon le rôle (ids alignés sur PAGES dans index.html). */
  const PAGE_ACCESS = {
    joueur: ['sheet'],
    mj:     ['lobby', 'mj', 'sheet', 'journal', 'prog', 'ds'],
    admin:  ['lobby', 'mj', 'sheet', 'journal', 'prog', 'ds', 'admin'],
  };
  const pagesForRole = (role) => PAGE_ACCESS[role] || [];
  const canSeePage = (pageId, role) => pagesForRole(role).indexOf(pageId) !== -1;

  /* Page d'accueil par défaut selon le rôle. */
  const defaultRoute = (role) => (role === 'joueur' ? 'sheet' : 'mj');

  return {
    EMAIL_DOMAIN, ROLES, usernameToEmail,
    isStaff, isAdmin, isPending,
    pagesForRole, canSeePage, defaultRoute,
  };
});
```

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

Run: `node --test test/auth.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5 : Commit**

```bash
git add auth.js test/auth.test.js
git commit -m "feat(auth): helpers purs usernameToEmail + roles (testes)"
```

---

## Task 2 : Auth Email/Password dans `firebase-config.js`

**Files:**
- Modify: `firebase-config.js` (remplace les lignes 15-33, la partie auth anonyme + helpers)

- [ ] **Step 1 : Remplacer la connexion anonyme + helpers**

Dans `firebase-config.js`, remplacer tout le bloc à partir du commentaire `/* Connexion anonyme …` (ligne 15) jusqu'à la fin du fichier par :

```js
/* Auth Email/Password (les pseudos sont mappés en e-mails factices côté UI).
   `ready` résout dès que l'état d'auth initial est connu (connecté OU non).
   La sécurité réelle est dans database.rules.json (cloisonnement par /users). */
const _auth = firebase.auth();
let _currentUser = null;
let _resolveReady;
const _authReady = new Promise((res) => { _resolveReady = res; });
const _authCbs = new Set();
let _readyDone = false;
_auth.onAuthStateChanged((user) => {
  _currentUser = user;
  if (!_readyDone) { _readyDone = true; _resolveReady(true); }
  _authCbs.forEach((cb) => cb(user));
});

/* Helpers temps réel + auth exposés globalement */
window.RTDB = {
  ready: _authReady,
  get currentUser() { return _currentUser; },
  /* Abonnement aux changements d'état d'auth. Rappelle immédiatement avec l'état courant. */
  onAuth(cb) { _authCbs.add(cb); cb(_currentUser); return () => _authCbs.delete(cb); },
  signIn(username, password) {
    const email = usernameToEmail(username);
    if (!email) return Promise.reject(new Error('auth/invalid-username'));
    return _auth.signInWithEmailAndPassword(email, password);
  },
  signOut() { return _auth.signOut(); },
  subscribePath(path, cb) {
    const ref = _db.ref(path);
    const handler = ref.on('value', (snap) => cb(snap.val()));
    return () => ref.off('value', handler); // fonction de désabonnement
  },
  updatePath(path, patch) { return _db.ref(path).update(patch); },
  setPath(path, value) { return _db.ref(path).set(value); },
  async getSnapshot(path) { const s = await _db.ref(path).get(); return s.val(); },
};
```

> Note : `usernameToEmail` est fourni par `auth.js`, chargé **avant** ce fichier (voir Task 7).

- [ ] **Step 2 : Vérifier la syntaxe**

Run: `node -e "require('./firebase-config.js')" 2>&1 | head -5 || true`
Expected: une erreur du type `firebase is not defined` (NORMAL hors navigateur) — l'important est l'**absence d'erreur de syntaxe** (`SyntaxError`). Si `SyntaxError`, corriger.

- [ ] **Step 3 : Commit**

```bash
git add firebase-config.js
git commit -m "feat(auth): firebase-config bascule de anonyme vers email/password"
```

---

## Task 3 : Hooks d'identité & d'admin dans `data-state.jsx`

**Files:**
- Modify: `data-state.jsx` (remplace `useIdentity` lignes 35-40 ; gate `seedIfEmpty` ; étend l'export ligne 42)

- [ ] **Step 1 : Gater `seedIfEmpty` au staff (lecture/écriture campagne réservée)**

Dans `data-state.jsx`, remplacer la fonction `seedIfEmpty` (lignes 10-16) par :

```js
/* Amorçage : si la campagne n'existe pas encore, écrit l'état par défaut
   des 5 persos. Réservé au staff (mj/admin) : un joueur n'a pas le droit de
   lire/écrire la collection entière (règles RTDB). Sans-effet si déjà amorcé. */
async function seedIfEmpty(role) {
  if (!isStaff(role)) return;
  const existing = await window.RTDB.getSnapshot(`${CAMPAIGN}/characters`);
  if (existing) return;
  const all = {};
  for (const c of CHARACTERS) all[c.id] = { state: buildDefaultState(c) };
  await window.RTDB.setPath(`${CAMPAIGN}/characters`, all);
}
```

- [ ] **Step 2 : Remplacer `useIdentity` par `useAuthIdentity` + hooks admin**

Dans `data-state.jsx`, remplacer la fonction `useIdentity` (lignes 35-40) par :

```js
/* Identité dérivée de l'auth Firebase + /users/{uid}.
   - user undefined/null : pas connecté.
   - rec undefined : enregistrement /users en cours de chargement.
   - À la 1re connexion (rec absent), auto-inscription « en attente »
     (role joueur, sans perso) — autorisée et contrainte par les règles RTDB. */
function useAuthIdentity() {
  const [user, setUser] = useState(window.RTDB.currentUser);
  const [rec, setRec] = useState(undefined);
  useEffect(() => window.RTDB.onAuth(setUser), []);
  useEffect(() => {
    if (!user) { setRec(undefined); return; }
    setRec(undefined);
    const unsub = window.RTDB.subscribePath(`users/${user.uid}`, (val) => {
      if (val == null) {
        const username = (user.email || '').split('@')[0];
        window.RTDB.setPath(`users/${user.uid}`, { username, role: 'joueur' })
          .catch((e) => console.error('Auto-inscription /users échouée :', e));
        // le subscribe se redéclenchera après l'écriture
      } else {
        setRec(val);
      }
    });
    return unsub;
  }, [user]);
  const loading = user === undefined || (!!user && rec === undefined);
  return {
    user,
    uid: user ? user.uid : null,
    username: rec ? rec.username : null,
    role: rec ? rec.role : null,
    charId: rec ? rec.charId : null,
    rec: rec || null,
    loading,
  };
}

/* Liste de tous les comptes (page Admin). Réservé admin par les règles. */
function useAllUsers() {
  const [users, setUsers] = useState(null);
  useEffect(() => window.RTDB.subscribePath('users', setUsers), []);
  return users; // { uid: { username, role, charId } }
}

/* Attribution rôle + perso d'un compte (page Admin). charId vide => retiré. */
function setUserAssignment(uid, role, charId) {
  return window.RTDB.updatePath(`users/${uid}`, { role, charId: charId || null });
}
```

- [ ] **Step 3 : Mettre à jour l'export global (ligne 42)**

Remplacer la ligne `Object.assign(window, { useCharState, useAllCharStates, useIdentity, seedIfEmpty, charPath, CAMPAIGN });` par :

```js
Object.assign(window, {
  useCharState, useAllCharStates, useAuthIdentity, useAllUsers, setUserAssignment,
  seedIfEmpty, charPath, CAMPAIGN,
});
```

- [ ] **Step 4 : Vérifier la syntaxe**

Run: `npx esbuild data-state.jsx --loader:.jsx=jsx >/dev/null && echo SYNTAXE_OK`
Expected: `SYNTAXE_OK`.

- [ ] **Step 5 : Commit**

```bash
git add data-state.jsx
git commit -m "feat(auth): useAuthIdentity + hooks admin, seed reserve au staff"
```

---

## Task 4 : Écran de connexion, écran d'attente, déconnexion (`components.jsx`)

**Files:**
- Modify: `components.jsx` (remplace `IdentityModal` lignes 248-263 ; met à jour l'export lignes 318-322)

- [ ] **Step 1 : Remplacer `IdentityModal` par `LoginScreen` + `PendingScreen` + `SignOutButton`**

Dans `components.jsx`, remplacer la fonction `IdentityModal` (lignes 248-263) par :

```jsx
/* --- Écran de connexion (bloque tout tant qu'on n'est pas authentifié) --- */
function LoginScreen({ onSubmit }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await onSubmit(u, p);
    } catch (e2) {
      setErr('Identifiant ou mot de passe incorrect.');
      setBusy(false);
    }
  };
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(8,8,14,.92)', display:'grid', placeItems:'center', zIndex:1000 }}>
      <form className="panel" onSubmit={submit} style={{ padding:'28px 32px', maxWidth:380, width:'90%' }}>
        <div className="row gap-2" style={{ alignItems:'center', justifyContent:'center', marginBottom:6 }}>
          <div className="crest" style={{ width:30, height:30, position:'relative' }}><i></i><b>R</b></div>
          <h2 style={{ margin:0 }}>Chroniques de Runeterra</h2>
        </div>
        <p className="dim" style={{ fontSize:13, textAlign:'center', marginBottom:18 }}>Connecte-toi pour accéder à ta fiche.</p>
        <input className="fld" placeholder="Nom d'utilisateur" value={u} autoFocus autoComplete="username"
          onChange={(e) => setU(e.target.value)}
          style={{ display:'block', width:'100%', marginBottom:10, padding:'9px 11px', background:'var(--bg-inset)', color:'var(--ink)', border:'1px solid var(--line-strong)', borderRadius:6, fontSize:14, boxSizing:'border-box' }} />
        <input className="fld" type="password" placeholder="Mot de passe" value={p} autoComplete="current-password"
          onChange={(e) => setP(e.target.value)}
          style={{ display:'block', width:'100%', marginBottom:12, padding:'9px 11px', background:'var(--bg-inset)', color:'var(--ink)', border:'1px solid var(--line-strong)', borderRadius:6, fontSize:14, boxSizing:'border-box' }} />
        {err && <div style={{ color:'var(--hp)', fontSize:12, marginBottom:10, textAlign:'center' }}>{err}</div>}
        <button className="btn btn-gold" type="submit" disabled={busy || !u || !p} style={{ width:'100%' }}>
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}

/* --- Compte connecté mais sans perso attribué --- */
function PendingScreen({ username, onSignOut }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(8,8,14,.92)', display:'grid', placeItems:'center', zIndex:1000 }}>
      <div className="panel" style={{ padding:'28px 32px', maxWidth:440, textAlign:'center' }}>
        <h2 style={{ marginBottom:6 }}>Compte en attente</h2>
        <p className="dim" style={{ fontSize:13, marginBottom:18 }}>
          Bonjour <b>{username}</b> — ton personnage n'a pas encore été attribué par le MJ.
          Reviens un peu plus tard.
        </p>
        <button className="btn btn-ghost" onClick={onSignOut}>Se déconnecter</button>
      </div>
    </div>
  );
}

/* --- Bouton de déconnexion (topbar) --- */
function SignOutButton({ username, role, onSignOut }) {
  return (
    <div className="row gap-2" style={{ alignItems:'center' }}>
      <span className="session">{username} · {role}</span>
      <button className="btn btn-sm btn-ghost" onClick={onSignOut}>Déconnexion</button>
    </div>
  );
}
```

- [ ] **Step 2 : Mettre à jour l'export global**

Dans le bloc `Object.assign(window, { … })` (lignes 318-322), remplacer `IdentityModal,` par `LoginScreen, PendingScreen, SignOutButton,`.

- [ ] **Step 3 : Vérifier la syntaxe**

Run: `npx esbuild components.jsx --loader:.jsx=jsx >/dev/null && echo SYNTAXE_OK`
Expected: `SYNTAXE_OK`.

- [ ] **Step 4 : Commit**

```bash
git add components.jsx
git commit -m "feat(auth): ecran de connexion + ecran d attente + deconnexion"
```

---

## Task 5 : Page Admin (`pages-admin.jsx`)

**Files:**
- Create: `pages-admin.jsx`

- [ ] **Step 1 : Créer la page Admin**

Create `pages-admin.jsx` :

```jsx
/* ============================================================
   PAGE ADMIN — attribution rôle + perso aux comptes
   Lecture/écriture de /users réservées à l'admin (règles RTDB).
   Les mots de passe se gèrent dans la console Firebase, pas ici.
   ============================================================ */
function AdminUserRow({ uid, rec }) {
  const toast = useToast();
  const [role, setRole] = useState(rec.role || 'joueur');
  const [charId, setCharId] = useState(rec.charId || '');
  const dirty = role !== (rec.role || 'joueur') || charId !== (rec.charId || '');
  const save = async () => {
    try {
      await setUserAssignment(uid, role, charId);
      toast(`Compte « ${rec.username} » mis à jour`, 'buff');
    } catch (e) {
      toast('Échec de la mise à jour (droits admin ?)', 'debuff');
    }
  };
  const selStyle = { background:'var(--bg-inset)', color:'var(--ink)', border:'1px solid var(--line-strong)', borderRadius:6, padding:'6px 9px', fontSize:13 };
  return (
    <div className="row gap-3 wrap" style={{ alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--line)' }}>
      <span className="mono" style={{ minWidth:140, color:'var(--gold-pale)' }}>{rec.username || '(sans nom)'}</span>
      <select value={role} onChange={(e) => setRole(e.target.value)} style={selStyle}>
        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <select value={charId} onChange={(e) => setCharId(e.target.value)} style={selStyle}>
        <option value="">— aucun perso —</option>
        {CHARACTERS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <button className="btn btn-sm btn-gold" onClick={save} disabled={!dirty}>Enregistrer</button>
    </div>
  );
}

function AdminPage() {
  const users = useAllUsers();
  return (
    <div className="col" style={{ height:'100%', minHeight:0, overflow:'auto' }}>
      <div style={{ padding:'18px 24px' }}>
        <h2 style={{ marginBottom:4 }}>Administration des comptes</h2>
        <p className="dim" style={{ fontSize:13, marginBottom:16 }}>
          Attribue à chaque compte son rôle et son personnage. Les comptes apparaissent
          ici après leur première connexion. Création/réinitialisation des mots de passe :
          console Firebase.
        </p>
        <div className="panel" style={{ padding:'8px 16px' }}>
          {users == null && <div className="dim" style={{ padding:'12px 0' }}>Chargement…</div>}
          {users != null && Object.keys(users).length === 0 && (
            <div className="dim" style={{ padding:'12px 0' }}>Aucun compte pour l'instant.</div>
          )}
          {users != null && Object.keys(users).map((uid) => (
            <AdminUserRow key={uid} uid={uid} rec={users[uid]} />
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AdminPage, AdminUserRow });
```

- [ ] **Step 2 : Vérifier la syntaxe**

Run: `npx esbuild pages-admin.jsx --loader:.jsx=jsx >/dev/null && echo SYNTAXE_OK`
Expected: `SYNTAXE_OK`.

- [ ] **Step 3 : Commit**

```bash
git add pages-admin.jsx
git commit -m "feat(admin): page d attribution role + perso par compte"
```

---

## Task 6 : Verrouiller le sélecteur de perso pour un joueur (`pages-sheet.jsx`)

**Files:**
- Modify: `pages-sheet.jsx` (signature `SheetPage` ligne 320 ; init `charId` lignes 321-324 ; bloc sélecteur lignes 343-349)

- [ ] **Step 1 : Accepter la prop `lockedCharId` et l'utiliser pour l'état initial**

Dans `pages-sheet.jsx`, remplacer la signature et l'initialisation (lignes 320-324) :

```jsx
function SheetPage({ lockedCharId }) {
  const [charId, setCharId] = useState(() => {
    if (lockedCharId) return lockedCharId;
    const id = localStorage.getItem('runeterra_identity');
    return (id && id !== 'mj' && CHARACTERS.some(c => c.id === id)) ? id : 'rathael';
  });
```

- [ ] **Step 2 : Masquer le sélecteur quand `lockedCharId` est fourni**

Remplacer le bloc `<div className="row gap-2">` du sélecteur de perso (lignes 343-349) par :

```jsx
          {!lockedCharId && (
            <div className="row gap-2">
              <span className="overline">Perso</span>
              <select value={charId} onChange={e => setCharId(e.target.value)}
                style={{ background:'var(--bg-inset)', color:'var(--ink)', border:'1px solid var(--line-strong)', borderRadius:6, padding:'7px 10px', fontSize:13 }}>
                {CHARACTERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
```

- [ ] **Step 3 : Vérifier la syntaxe**

Run: `npx esbuild pages-sheet.jsx --loader:.jsx=jsx >/dev/null && echo SYNTAXE_OK`
Expected: `SYNTAXE_OK`.

- [ ] **Step 4 : Commit**

```bash
git add pages-sheet.jsx
git commit -m "feat(auth): SheetPage verrouille le perso pour un joueur"
```

---

## Task 7 : Refonte du shell `App` + chargement des scripts (`index.html`)

**Files:**
- Modify: `index.html` (ajout `<script>` auth.js ligne ~81 et pages-admin.jsx ligne ~96 ; refonte du shell lignes 99-138)

- [ ] **Step 1 : Charger `auth.js` avant `firebase-config.js`**

Dans `index.html`, juste **avant** la ligne `<script src="firebase-config.js"></script>` (ligne 81), insérer :

```html
<!-- Logique d'auth pure (chargée avant firebase-config qui l'utilise) -->
<script src="auth.js"></script>
```

- [ ] **Step 2 : Charger la page Admin**

Après la ligne `<script type="text/babel" src="pages-ds.jsx"></script>` (ligne 96), ajouter :

```html
<script type="text/babel" src="pages-admin.jsx"></script>
```

- [ ] **Step 3 : Réécrire le shell `App`**

Remplacer tout le contenu du dernier `<script type="text/babel">` (lignes 99-138, de `const PAGES = [` jusqu'à `ReactDOM.createRoot(...).render(<App />);` inclus) par :

```jsx
const PAGES = [
  { id:'lobby',   label:'Accueil',      render:() => <LobbyPage go={setRoute} /> },
  { id:'mj',      label:'Vue MJ',       render:() => <MJPage go={setRoute} /> },
  { id:'sheet',   label:'Fiche Joueur', render:(auth) => <SheetPage lockedCharId={auth.role === 'joueur' ? auth.charId : null} /> },
  { id:'journal', label:'Journal',      render:() => <JournalPage /> },
  { id:'prog',    label:'Progression',  render:() => <ProgressionPage /> },
  { id:'ds',      label:'Design System',render:() => <DesignSystemPage /> },
  { id:'admin',   label:'Admin',        render:() => <AdminPage /> },
];
let setRoute; // remonté par App pour la navigation depuis les pages

function App() {
  const auth = useAuthIdentity();
  const [ready, setReady] = useState(false);
  const [route, _setRoute] = useState(() => localStorage.getItem('runeterra_route') || null);
  setRoute = (r) => { _setRoute(r); localStorage.setItem('runeterra_route', r); };

  useEffect(() => { window.RTDB.ready.then(() => setReady(true)); }, []);
  useEffect(() => { if (auth.role) seedIfEmpty(auth.role); }, [auth.role]);

  // Tant que l'état d'auth n'est pas connu : rien (ni login ni contenu).
  if (!ready || auth.loading) {
    return <div className="page hex-bg" style={{ display:'grid', placeItems:'center', height:'100vh' }}><div className="dim">Connexion…</div></div>;
  }
  // Pas connecté : uniquement l'écran de connexion.
  if (!auth.user) {
    return <ToastProvider><LoginScreen onSubmit={(u, p) => window.RTDB.signIn(u, p)} /></ToastProvider>;
  }
  // Connecté mais sans perso attribué.
  if (isPending(auth.rec)) {
    return <ToastProvider><PendingScreen username={auth.username} onSignOut={() => window.RTDB.signOut()} /></ToastProvider>;
  }

  // Navigation filtrée par rôle.
  const allowed = PAGES.filter(p => canSeePage(p.id, auth.role));
  const fallback = defaultRoute(auth.role);
  const activeId = allowed.some(p => p.id === route) ? route : fallback;
  const cur = allowed.find(p => p.id === activeId) || allowed[0];

  return (
    <ToastProvider>
      <div className="topbar">
        <div className="brand">
          <div className="crest"><i></i><b>R</b></div>
          <span className="ttl">Chroniques de Runeterra</span>
        </div>
        <nav className="nav">
          {allowed.map(p => (
            <button key={p.id} className={p.id === activeId ? 'active' : ''} onClick={() => setRoute(p.id)}>{p.label}</button>
          ))}
        </nav>
        <SignOutButton username={auth.username} role={auth.role} onSignOut={() => window.RTDB.signOut()} />
      </div>
      <div className="page hex-bg">{cur.render(auth)}</div>
    </ToastProvider>
  );
}
ReactDOM.createRoot(document.getElementById('app')).render(<App />);
```

> Changements clés : `comp` → `render(auth)` (pour passer `lockedCharId`) ; gating auth/rôle ; nav filtrée ; route par défaut selon le rôle ; déconnexion dans la topbar.

- [ ] **Step 4 : Vérifier la syntaxe du shell**

Le shell inline n'est pas un fichier isolé : extraire-le mentalement n'est pas nécessaire, mais vérifier qu'aucune balise n'est cassée. Lancer le serveur et ouvrir la page (voir Task 9 pour le smoke complet). Vérif rapide ici :

Run: `npx esbuild index.html --loader:.html=text >/dev/null && echo FICHIER_LU`
Expected: `FICHIER_LU` (esbuild ne parse pas le JSX inline ; ce contrôle vérifie surtout que le fichier est lisible). La vraie vérification est le smoke test (Task 9).

- [ ] **Step 5 : Commit**

```bash
git add index.html
git commit -m "feat(auth): shell App gating auth/role + nav filtree + chargement scripts"
```

---

## Task 8 : Règles RTDB strictes (`database.rules.json`)

**Files:**
- Modify: `database.rules.json` (remplace tout le contenu)

- [ ] **Step 1 : Écrire les règles strictes**

Remplacer tout le contenu de `database.rules.json` par :

```json
{
  "rules": {
    "users": {
      ".read": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'",
      "$uid": {
        ".read": "auth != null && (auth.uid === $uid || root.child('users').child(auth.uid).child('role').val() === 'admin')",
        ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'admin' || (auth.uid === $uid && !data.exists() && newData.child('role').val() === 'joueur' && !newData.hasChild('charId')))",
        "role":     { ".validate": "newData.isString() && (newData.val() === 'joueur' || newData.val() === 'mj' || newData.val() === 'admin')" },
        "username": { ".validate": "newData.isString()" },
        "charId":   { ".validate": "newData.isString()" },
        "$other":   { ".validate": false }
      }
    },
    "campaign": {
      "runeterra": {
        ".read":  "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'mj' || root.child('users').child(auth.uid).child('role').val() === 'admin')",
        ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'",
        "characters": {
          "$charId": {
            ".read":  "auth != null && root.child('users').child(auth.uid).child('charId').val() === $charId",
            ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'mj' || root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('charId').val() === $charId)"
          }
        }
      }
    }
  }
}
```

> Logique : `/users` lisible par l'admin (liste) ; chacun lit son propre `/users/{uid}` ; écriture réservée à l'admin **sauf** l'auto-inscription contrainte (joueur, sans perso, une fois). Côté `campaign/runeterra` : lecture/écriture globale pour staff/admin (Vue MJ + export/import), et au niveau `$charId` un joueur lit/écrit **uniquement** son perso. La lecture `runeterra` est false pour un joueur, mais la règle `$charId` lui ouvre son seul perso (les règles RTDB cascadent vers le bas, jamais vers le haut).

- [ ] **Step 2 : Vérifier que le JSON est valide**

Run: `node -e "JSON.parse(require('fs').readFileSync('database.rules.json','utf8')); console.log('JSON_OK')"`
Expected: `JSON_OK`.

- [ ] **Step 3 : Commit**

```bash
git add database.rules.json
git commit -m "feat(securite): regles RTDB strictes basees sur /users (roles)"
```

> ⚠️ **Ne pas publier ces règles dans la console maintenant** — elles casseraient le site v1 (anonyme) encore en ligne. Publication = étape de déploiement (Task 10 / check-list).

---

## Task 9 : Adapter le smoke test (`test/smoke.mjs`)

**Files:**
- Modify: `test/smoke.mjs`

**Pré-requis pour exécuter ce test (à faire une fois, côté Firebase) :** un **compte de test** doit exister et être **attribué à un perso**. Le smoke ci-dessous utilise les variables d'environnement `SMOKE_USER` / `SMOKE_PASS` (avec un repli sur un compte dédié `smoke` attribué à Rathäel). Ce compte se crée comme les autres (console → Authentication, puis attribution via page Admin), et **n'est testable qu'une fois les nouvelles règles publiées**.

- [ ] **Step 1 : Réécrire le smoke pour se connecter**

Remplacer le bloc « 1) écran d'identité » et « 2) choisir Rathäel » (lignes 13-18) par :

```js
// 1) écran de connexion
const USER = process.env.SMOKE_USER || 'smoke';
const PASS = process.env.SMOKE_PASS || 'smoke-pass';
await page.getByPlaceholder('Nom d\'utilisateur').waitFor({ timeout: 15000 });
console.log('OK  écran de connexion affiché');

// 2) se connecter avec le compte de test (attribué à un perso côté Admin)
await page.getByPlaceholder('Nom d\'utilisateur').fill(USER);
await page.getByPlaceholder('Mot de passe').fill(PASS);
await page.getByRole('button', { name: 'Se connecter' }).click();
```

- [ ] **Step 2 : Retirer l'étape Vue MJ (réservée au staff)**

Le compte de test est un **joueur** : il n'a pas la Vue MJ. Supprimer le bloc « 5) vue MJ » (lignes 46-49) :

```js
// (supprimé) — le compte de test est un joueur, pas d'accès Vue MJ
```

- [ ] **Step 3 : Exécuter le smoke (nécessite serveur + règles publiées + compte de test)**

Run (dans deux terminaux) :
```bash
python -m http.server 5050 --bind 127.0.0.1      # terminal A
SMOKE_USER=smoke SMOKE_PASS=<motdepasse> node test/smoke.mjs   # terminal B
```
Expected: `✅ SMOKE TEST PASSÉ` (écran de connexion → fiche chargée → Fatigue 0→1 via Firebase, sans erreur console).

> Si les règles strictes ne sont pas encore publiées, ce test échouera à l'étape Firebase — c'est attendu hors déploiement. La validation locale du reste (Tasks 1-8) se fait via `node --test` et les contrôles de syntaxe.

- [ ] **Step 4 : Commit**

```bash
git add test/smoke.mjs
git commit -m "test: smoke test se connecte via compte de test (au lieu de anonyme)"
```

---

## Task 10 : Documentation `CLAUDE.md` + check-list de déploiement

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1 : Mettre à jour la section Auth**

Dans `CLAUDE.md`, remplacer la puce `- **Auth** : connexion **anonyme** …` par :

```markdown
- **Auth** : comptes **identifiant + mot de passe** (Firebase Email/Password). Le
  pseudo est mappé en e-mail factice `pseudo@runeterra.local` (`usernameToEmail`
  dans `auth.js`). 3 rôles dans `/users/{uid}` : `joueur` (sa fiche seule), `mj`
  (toutes les fiches, lecture/écriture), `admin` (+ page Admin d'attribution).
  Mots de passe créés/réinitialisés dans la **console Firebase**.
```

- [ ] **Step 2 : Documenter le modèle `/users` et la check-list**

Dans `CLAUDE.md`, sous la section « Modèle de données Firebase », ajouter après le bloc existant :

```markdown

/users/{uid}/  ← rôles & attribution (écrit par l'admin ; auto-inscription « en attente » à la 1re connexion)
    username, role (joueur|mj|admin), charId (si joueur)

**Check-list de déploiement (bascule anonyme → comptes) :**
1. Pousser le code sur `main` (GitHub Pages).
2. Console → Authentication : créer les comptes joueurs (`pseudo@runeterra.local` + mdp).
3. Console → Realtime Database / Données : vérifier `/users/{adminUID}` = `{username, role:"admin"}`.
4. Console → Realtime Database / Règles : publier `database.rules.json` (strictes).
5. Console → Authentication : **désactiver** le provider « Anonyme ».
6. Chaque joueur se connecte une fois → attribuer son perso via la page Admin.
```

- [ ] **Step 3 : Mettre à jour la carte des fichiers et « État actuel »**

Dans la section « Carte des fichiers », ajouter :

```markdown
- `auth.js` — logique d'auth pure (UMD) : `usernameToEmail`, `ROLES`, `isStaff`,
  `isAdmin`, `isPending`, `pagesForRole`, `canSeePage`, `defaultRoute`.
- `pages-admin.jsx` — page Admin : attribution rôle + perso par compte.
```

Et dans « État actuel », ajouter une ligne :

```markdown
- v2 (auth comptes + rôles) implémentée. **Restant utilisateur** : exécuter la
  check-list de déploiement ci-dessus (publier règles + désactiver l'anonyme).
```

- [ ] **Step 4 : Commit**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md auth comptes + roles + check-list deploiement"
```

---

## Vérification finale (après toutes les tasks)

- [ ] `node --test test/auth.test.js` → 5 tests PASS.
- [ ] `node --test test/game-logic.test.js` → 8 tests PASS (non régressé).
- [ ] Contrôles de syntaxe esbuild OK sur les `.jsx` modifiés.
- [ ] `node -e "JSON.parse(...)"` sur `database.rules.json` → `JSON_OK`.
- [ ] (Déploiement) Smoke test vert une fois règles publiées + compte de test attribué.

## Notes d'implémentation

- **Pendant tout le développement**, ne pas publier les règles strictes ni
  désactiver l'anonyme : le site v1 en ligne doit continuer de marcher. Tout se
  bascule à la fin via la check-list.
- Le **premier admin** (`/users/{adminUID}`) se crée à la main dans la console
  (onglet Données), une seule fois — déjà le compte créé côté Authentication.
- Pas de création de compte depuis l'app (hors périmètre) : passage par la console.
```
