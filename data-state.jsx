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
  const setCoin       = useCallback((key, value) =>
    window.RTDB.updatePath(`${charPath(charId)}/coins`, { [key]: Math.max(0, value | 0) }), [charId]);
  const setRuneSelected = useCallback((nodeId, on) =>
    window.RTDB.updatePath(`${charPath(charId)}/runes/selected`, { [nodeId]: on ? true : null }), [charId]);
  const setRuneChoice = useCallback((nodeId, choice) =>
    window.RTDB.updatePath(`${charPath(charId)}/runes/choices`, { [nodeId]: choice || null }), [charId]);
  const resetRunes = useCallback(() =>
    window.RTDB.setPath(`${charPath(charId)}/runes`, null), [charId]);
  // Compétences : compteurs (charges/marques/CN/tranches) + cooldowns (readyAt = n° de tour).
  const setCounter  = useCallback((key, value) =>
    window.RTDB.updatePath(`${charPath(charId)}/counters`, { [key]: Math.max(0, value | 0) || null }), [charId]);
  const setCooldown = useCallback((skillId, readyAt) =>
    window.RTDB.updatePath(`${charPath(charId)}/cooldowns`, { [skillId]: readyAt || null }), [charId]);
  // Buff sur soi : snapshot des mods plats d'une compétence (effacé par « ⟲ Combat »).
  const setSkillBuff = useCallback((skillId, mods) =>
    window.RTDB.updatePath(`${charPath(charId)}/skillBuffs`, { [skillId]: mods || null }), [charId]);
  return { state, setField, setBuff, setMod, setInvItem, removeInvItem, setEquipment, setCoin,
    setRuneSelected, setRuneChoice, resetRunes, setCounter, setCooldown, setSkillBuff };
}

/* Compteur de tour PARTAGÉ (combat). Écriture staff (règle RTDB combat/turn).
   « Nouveau combat » = remet le tour à 1 et purge compteurs + cooldowns de tous. */
const COMBAT_TURN = `${CAMPAIGN}/combat/turn`;
function useSharedTurn() {
  const [turn, setTurn] = useState(1);
  useEffect(() => window.RTDB.subscribePath(COMBAT_TURN, (v) => setTurn(Number.isFinite(v) && v >= 1 ? v : 1)), []);
  const persist = useCallback((n) => window.RTDB.setPath(COMBAT_TURN, Math.max(1, n | 0)), []);
  const resetCombat = useCallback(() => {
    window.RTDB.setPath(COMBAT_TURN, 1);
    CHARACTERS.forEach((c) => {
      window.RTDB.setPath(`${charPath(c.id)}/counters`, null);
      window.RTDB.setPath(`${charPath(c.id)}/cooldowns`, null);
      window.RTDB.setPath(`${charPath(c.id)}/skillBuffs`, null);
    });
    window.RTDB.setPath(COMBAT_LOG, null);
  }, []);
  return { turn, nextTurn: () => persist(turn + 1), prevTurn: () => persist(turn - 1), resetCombat };
}

/* Ennemis PARTAGÉS (Firebase). Lecture tout inscrit, écriture staff (règle combat/enemies).
   API identique à l'ancien hook localStorage : la vue MJ ne change pas. */
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

/* File d'attaques en attente : le joueur PROPOSE (au cast), le MJ résout (ajuste + applique).
   Lecture tout inscrit, écriture tout inscrit (création) ; le staff applique/supprime. */
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
/* Applique des dégâts (déjà ajustés par le MJ) à un ennemi : réduction armure/resmag puis pool HP. */
function applyHitToEnemy(enemy, finalDmg, type) {
  const dmg = mitigateDamage(Math.max(0, finalDmg | 0), type, { armure: enemy.armure || 0, resmag: enemy.resmag || 0 });
  const res = applyDamageToPools({ hpCur: enemy.hpCur || 0, shield: 0 }, dmg);
  window.RTDB.updatePath(`${ENEMIES}/${enemy.id}`, { hpCur: res.hpCur });
  return { applied: dmg, hpCur: res.hpCur };
}

/* Journal de combat PARTAGÉ : file d'événements (dégâts résolus, KO…) que tout
   inscrit lit. Écriture tout inscrit (règle combat/log). ~30 derniers affichés.
   « ⟲ Combat » (resetCombat) le purge. */
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

/* Monnaie partagée (coffre commun). */
const SHARED_COINS = `${CAMPAIGN}/sharedCoins`;
function useSharedCoins() {
  const [coins, setCoins] = useState(null);
  useEffect(() => window.RTDB.subscribePath(SHARED_COINS, (v) =>
    setCoins(v || { plat:0, or:0, arg:0, cuiv:0 })), []);
  const setCoin = useCallback((key, value) =>
    window.RTDB.updatePath(SHARED_COINS, { [key]: Math.max(0, value | 0) }), []);
  return { coins, setCoin };
}

/* Transfert d'item entre deux collections RTDB ({id:item}). Utilise la logique
   pure planItemTransfer puis applique les deux patches en temps réel.
   NB : transfert NON atomique (2 écritures sur des sous-arbres distincts). On
   crédite la destination AVANT de débiter la source : si la 2e écriture échoue,
   on a une duplication (récupérable) plutôt qu'une perte. */
function moveItem(fromPath, toPath, fromItems, toItems, itemId, n) {
  const { srcPatch, dstPatch } = planItemTransfer(fromItems, toItems, itemId, n);
  if (Object.keys(dstPatch).length) window.RTDB.updatePath(toPath, dstPatch);
  if (Object.keys(srcPatch).length) window.RTDB.updatePath(fromPath, srcPatch);
}

/* Transfert de pièces (une dénomination) entre deux objets coins, montant borné.
   Crédit-avant-débit, même raison que moveItem (échec → duplication récupérable). */
function moveCoins(fromPath, toPath, fromCoins, toCoins, key, n) {
  const avail = (fromCoins && fromCoins[key]) || 0;
  const m = Math.max(0, Math.min(n | 0, avail));
  if (m <= 0) return;
  window.RTDB.updatePath(toPath, { [key]: ((toCoins && toCoins[key]) || 0) + m });
  window.RTDB.updatePath(fromPath, { [key]: avail - m });
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
  useCharState, useAllCharStates, useSharedInventory, useSharedCoins,
  useAuthIdentity, useAllUsers, setUserAssignment,
  seedIfEmpty, charPath, CAMPAIGN, SHARED_INV, SHARED_COINS, moveItem, moveCoins,
  useSharedTurn, COMBAT_TURN,
  useMJEnemies, makeEnemy, newEnemyId, ENEMIES,
  usePendingHits, applyHitToEnemy, PENDING_HITS,
  pushLog, useCombatLog, COMBAT_LOG,
});
