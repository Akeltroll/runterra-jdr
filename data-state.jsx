/* ============================================================
   ÉTAT PARTAGÉ TEMPS RÉEL (Firebase RTDB) + identité
   ============================================================ */
const CAMPAIGN = 'campaign/runeterra';

function charPath(id) { return `${CAMPAIGN}/characters/${id}/state`; }

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

/* État d'un perso + setters pathés (chaque écriture est envoyée en temps réel). */
function useCharState(charId) {
  const [state, setState] = useState(null);
  useEffect(() => window.RTDB.subscribePath(charPath(charId), setState), [charId]);
  const setField = useCallback((f, v) => window.RTDB.updatePath(charPath(charId), { [f]: v }), [charId]);
  const setBuff  = useCallback((id, on) => window.RTDB.updatePath(`${charPath(charId)}/buffs`, { [id]: on ? true : null }), [charId]);
  const setMod   = useCallback((stat, v) => window.RTDB.updatePath(`${charPath(charId)}/modifiers`, { [stat]: v || null }), [charId]);
  const setInvItem    = useCallback((id, item) => window.RTDB.updatePath(`${charPath(charId)}/inventory`, { [id]: item }), [charId]);
  const removeInvItem = useCallback((id)       => window.RTDB.updatePath(`${charPath(charId)}/inventory`, { [id]: null }), [charId]);
  // Équipement (paperdoll) : map { [slotKey]: itemId }. Le patch permet une mise à
  // jour atomique multi-slots (déséquiper l'ancien slot d'un item en l'équipant ailleurs).
  const setEquipment  = useCallback((patch)    => window.RTDB.updatePath(`${charPath(charId)}/equipment`, patch), [charId]);
  return { state, setField, setBuff, setMod, setInvItem, removeInvItem, setEquipment };
}

/* Snapshot live de tous les persos (vue MJ). */
function useAllCharStates() {
  const [all, setAll] = useState(null);
  useEffect(() => window.RTDB.subscribePath(`${CAMPAIGN}/characters`, setAll), []);
  return all; // { charId: { state: {...} } }
}

/* Inventaire commun partagé (accès total). */
const SHARED_INV = `${CAMPAIGN}/sharedInventory`;
function useSharedInventory() {
  const [items, setItems] = useState(null); // null = en chargement ; {} = vide chargé
  useEffect(() => window.RTDB.subscribePath(SHARED_INV, (v) => setItems(v || {})), []);
  const setItem    = useCallback((id, item) => window.RTDB.updatePath(SHARED_INV, { [id]: item }), []);
  const removeItem = useCallback((id)       => window.RTDB.updatePath(SHARED_INV, { [id]: null }), []);
  return { items, setItem, removeItem }; // items = { id: item } | null
}

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

Object.assign(window, {
  useCharState, useAllCharStates, useSharedInventory, useAuthIdentity, useAllUsers, setUserAssignment,
  seedIfEmpty, charPath, CAMPAIGN,
});
