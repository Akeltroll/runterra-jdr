/* Configuration Firebase (web). La clé API web est publique par nature :
   la sécurité repose sur les règles de la Realtime Database (database.rules.json). */
const firebaseConfig = {
  apiKey: "AIzaSyDNJ5yLzA9ojTgTPS0j7MkHr5bJyTfpLVM",
  authDomain: "runeterra-jdr.firebaseapp.com",
  databaseURL: "https://runeterra-jdr-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "runeterra-jdr",
  storageBucket: "runeterra-jdr.firebasestorage.app",
  messagingSenderId: "789190754320",
  appId: "1:789190754320:web:843f535b5f652e28e98a95",
};
firebase.initializeApp(firebaseConfig);
const _db = firebase.database();

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
