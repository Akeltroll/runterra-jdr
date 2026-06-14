/* ============================================================
   ÉTAT PARTAGÉ TEMPS RÉEL (Firebase RTDB) + identité
   ============================================================ */
const CAMPAIGN = 'campaign/runeterra';

function charPath(id) { return `${CAMPAIGN}/characters/${id}/state`; }

/* Amorçage : si la campagne n'existe pas encore, écrit l'état par défaut
   des 5 persos (dérivé des définitions de data.jsx). */
async function seedIfEmpty() {
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
  return { state, setField, setBuff, setMod };
}

/* Snapshot live de tous les persos (vue MJ). */
function useAllCharStates() {
  const [all, setAll] = useState(null);
  useEffect(() => window.RTDB.subscribePath(`${CAMPAIGN}/characters`, setAll), []);
  return all; // { charId: { state: {...} } }
}

/* Identité locale (perso choisi ou 'mj'), mémorisée dans le navigateur. */
function useIdentity() {
  const [id, setId] = useState(() => localStorage.getItem('runeterra_identity') || null);
  const set = (v) => { localStorage.setItem('runeterra_identity', v); setId(v); };
  return [id, set];
}

Object.assign(window, { useCharState, useAllCharStates, useIdentity, seedIfEmpty, charPath, CAMPAIGN });
