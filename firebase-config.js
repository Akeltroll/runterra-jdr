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

/* Connexion anonyme : aucun mot de passe pour les joueurs, mais les règles
   exigent un utilisateur authentifié (auth != null) → bloque les accès
   non authentifiés depuis internet. `ready` résout quand la session est prête. */
const _authReady = firebase.auth().signInAnonymously()
  .then(() => true)
  .catch((e) => { console.error('Connexion anonyme Firebase échouée :', e); return false; });

/* Helpers temps réel exposés globalement */
window.RTDB = {
  ready: _authReady,
  subscribePath(path, cb) {
    const ref = _db.ref(path);
    const handler = ref.on('value', (snap) => cb(snap.val()));
    return () => ref.off('value', handler); // fonction de désabonnement
  },
  updatePath(path, patch) { return _db.ref(path).update(patch); },
  setPath(path, value) { return _db.ref(path).set(value); },
  async getSnapshot(path) { const s = await _db.ref(path).get(); return s.val(); },
};
