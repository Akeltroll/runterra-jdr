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
  // Buff sur soi : snapshot des mods plats d'une compétence + durée optionnelle
  // (until = n° de tour de fin ; null = permanent jusqu'au « ⟲ Combat »). Effacé par « ⟲ Combat ».
  const setSkillBuff = useCallback((skillId, mods, until) =>
    window.RTDB.updatePath(`${charPath(charId)}/skillBuffs`,
      { [skillId]: mods ? { mods, until: until != null ? until : null } : null }), [charId]);
  // Respec : écrit les 4 caracs + la répartition de l'Habileté (AD/AP/Mana) + le verrou,
  // atomiquement (sanitisé en entiers ≥ 0).
  // ⚠️ `habSplit` est écrit dans la MÊME opération que `attrs` : les deux doivent rester
  // cohérents (somme ≤ hab). Un habSplit écrit seul après une baisse d'Habileté laisserait
  // une valeur hors bornes — la fonction `habSplit` la normaliserait à la lecture, mais la
  // base mentirait. Absent → on n'écrit rien et le défaut par carac dominante s'applique.
  // `habAd: null` purge l'ancienne forme (AD seul) qui a vécu une journée.
  const setAttrs = useCallback((attrs, locked, split, mentSplit) => {
    const a = attrs || {};
    const clean = {
      force: Math.max(0, a.force | 0), hab: Math.max(0, a.hab | 0),
      mental: Math.max(0, a.mental | 0), magie: Math.max(0, a.magie | 0),
    };
    const patch = { attrs: clean, attrsLocked: locked ? true : null, attrsOpen: null };
    if (split) {
      patch.habSplit = habSplit(clean.force, clean.hab, clean.magie, split);
      patch.habAd = null;
      patch.habSplitOpen = null;   // confirmer referme la fenêtre de redistribution
    }
    // Répartition du Mental (PV/Mana). Écrite dans la MÊME opération que `attrs`, pour
    // la même raison que `habSplit` : une répartition seule, après une baisse de Mental,
    // laisserait une somme hors bornes (mentalSplit la normaliserait à la lecture, mais
    // la base mentirait).
    if (mentSplit) {
      patch.mentalSplit = mentalSplit(clean.mental, mentSplit);
      patch.mentalSplitOpen = null;
    }
    return window.RTDB.updatePath(charPath(charId), patch);
  }, [charId]);
  /* Rouvre (ou referme) la répartition d'Habileté pour le JOUEUR : tant que le drapeau
     est posé, la page Progression ne lui oppose plus le plancher de ses points déjà
     placés. Réservé au staff côté UI, refermé automatiquement à la confirmation.
     ⚠️ On ne remet PAS `habSplit` à null pour rouvrir : le joueur repartirait du défaut
     par carac dominante au lieu de sa propre répartition, ce qui lui ferait perdre son
     placement au moment même où on lui rend la main. */
  const setHabSplitOpen = useCallback((open) =>
    window.RTDB.updatePath(charPath(charId), { habSplitOpen: open ? true : null }), [charId]);
  /* Même mécanisme pour la répartition du Mental (PV/Mana). Drapeau SÉPARÉ de
     `habSplitOpen` : le MJ doit pouvoir rendre l'une sans rendre l'autre. */
  const setMentalSplitOpen = useCallback((open) =>
    window.RTDB.updatePath(charPath(charId), { mentalSplitOpen: open ? true : null }), [charId]);
  /* Rouvre (ou referme) la RESPEC des caractéristiques elles-mêmes. Même mécanisme et
     même drapeau-esprit que `habSplitOpen`/`mentalSplitOpen`, mais drapeau SÉPARÉ : le
     plancher des caracs et celui des répartitions ne se lèvent pas pour les mêmes raisons.
     ⚠️ À ne pas confondre avec `attrsLocked`, qui est l'inverse et un cran plus dur :
     `attrsLocked` gèle TOUTE la page (le joueur ne peut même plus placer ses nouveaux
     points), `attrsOpen` ne fait que suspendre le plancher « pas en dessous de tes valeurs
     déjà confirmées ». Décocher `attrsLocked` ne rend donc PAS la respec — c'est ce
     drapeau-ci qui la rend. Refermé automatiquement à la confirmation suivante (cf.
     `attrsOpen: null` dans le patch de `setAttrs`). */
  const setAttrsOpen = useCallback((open) =>
    window.RTDB.updatePath(charPath(charId), { attrsOpen: open ? true : null }), [charId]);
  const setAttrsLocked = useCallback((locked) =>
    window.RTDB.updatePath(charPath(charId), { attrsLocked: locked ? true : null }), [charId]);
  return { state, setField, setBuff, setMod, setInvItem, removeInvItem, setEquipment,
    setRuneSelected, setRuneChoice, resetRunes, setCounter, setCooldown, setSkillBuff, setAttrs, setAttrsLocked, setAttrsOpen, setHabSplitOpen, setMentalSplitOpen };
}

/* Compteur de tour PARTAGÉ (combat). Écriture staff (règle RTDB combat/turn).
   « Nouveau combat » = remet le tour à 1 et purge compteurs + cooldowns de tous. */
const COMBAT_TURN = `${CAMPAIGN}/combat/turn`;
/* Initiative & créneaux de tour. Lecture tout inscrit (héritée du nœud `combat`),
   écriture staff SAUF deux feuilles ouvertes au joueur pour SON perso : `done/$id`
   (« j'ai fini ») et `scores/$id/d6` (son jet). Voir la spec §6 —
   docs/superpowers/specs/2026-09-02-initiative-creneaux-design.md */
const INITIATIVE = `${CAMPAIGN}/combat/initiative`;
function useSharedTurn() {
  const [turn, setTurn] = useState(1);
  useEffect(() => window.RTDB.subscribePath(COMBAT_TURN, (v) => setTurn(Number.isFinite(v) && v >= 1 ? v : 1)), []);
  const persist = useCallback((n) => window.RTDB.setPath(COMBAT_TURN, Math.max(1, n | 0)), []);
  const resetCombat = useCallback(async () => {
    window.RTDB.setPath(COMBAT_TURN, 1);
    for (const c of CHARACTERS) {
      const p = charPath(c.id);
      const st = (await window.RTDB.getSnapshot(p)) || {};
      const itemMods = sumItemMods(st.equipment, st.inventory);
      const runesSt = st.runes || {};
      const runeMods = sumRuneMods(
        Object.keys(runesSt.selected || {}).filter((id) => runesSt.selected[id]),
        runesSt.choices || {}, buildRuneIndex(RUNES));
      const lvl = (st.level != null ? st.level : c.level) || 1;
      const cbase = charBaseStats(c, st);
      const passiveMods = sumPassiveMods(c.id, st.counters || {}, lvl, cbase);
      // Max de base SANS skillBuffs (les buffs BUFFS n'affectent pas les PV max).
      const baseMax = computeEffective(cbase, st.modifiers, [],
        mergeMods(mergeMods(itemMods, runeMods), passiveMods));
      const patch = { counters: null, cooldowns: null, skillBuffs: null };
      if (st.hpCur != null) patch.hpCur = Math.min(st.hpCur, baseMax.hp);
      patch.shield = Math.min(st.shield || 0, c.shieldMax || 0);
      window.RTDB.updatePath(p, patch);
    }
    // La purge du journal est une ecriture SUR LE NOEUD combat/log. Elle a longtemps
    // ete refusee au role `mj` (le noeud n'avait de .write que sur $logId) et echouait
    // EN SILENCE. On remonte desormais l'echec a l'appelant, qui toaste.
    let logCleared = true;
    try { await window.RTDB.setPath(COMBAT_LOG, null); }
    catch (e) { logCleared = false; console.error('Purge du journal de combat refusee :', e); }
    // Nouveau combat = nouvelle initiative : scores, declarations, horodatages de KO
    // et arrivees tardives repartent de zero. Meme precaution de `catch` que ci-dessus
    // (ecriture SUR LE NOEUD, cf. les 3 bugs silencieux de permission de 2026-08-21).
    let initCleared = true;
    try { await window.RTDB.setPath(INITIATIVE, null); }
    catch (e) { initCleared = false; console.error('Purge de l\'initiative refusee :', e); }
    // La file d'actions n'etait PAS purgee (defaut anterieur, depuis pendingHits) : une
    // attaque non resolue survivait a un nouveau combat et restait applicable, avec des
    // degats calcules sur des stats d'avant. Meme precaution de catch : ecriture SUR LE NOEUD.
    let queueCleared = true;
    try { await window.RTDB.setPath(PENDING_ACTIONS, null); }
    catch (e) { queueCleared = false; console.error('Purge des actions en attente refusee :', e); }
    return { logCleared, initCleared, queueCleared };
  }, []);
  // Fin de tour : avance le tour, puis applique la perte de Glaciation de Rathael (-3 s'il
  // n'a pas subi de dégâts ce tour-ci). Le tour qui se termine est `turn`.
  const nextTurn = useCallback(async () => {
    const ending = turn;
    persist(ending + 1);
    // Fin de ROUND : les « j'ai fini » du round qui s'achève sont purgés d'un coup, et
    // tous les créneaux redeviennent à jouer. C'est la SEULE écriture de la mécanique
    // de créneaux — le passage d'un créneau au suivant, lui, est purement dérivé.
    let doneCleared = true;
    try { await window.RTDB.setPath(`${INITIATIVE}/done`, null); }
    catch (e) { doneCleared = false; console.error('Purge des fins de tour refusee :', e); }
    const p = charPath('rathael');
    const st = (await window.RTDB.getSnapshot(p)) || {};
    const dec = glaciationDecay(st.counters || {}, ending);
    if (dec) {
      const before = Math.max(0, (st.counters || {}).glaciation | 0);
      window.RTDB.updatePath(`${p}/counters`, { glaciation: dec.glaciation || null });
      pushLog(`<b>Rathäel</b> ne subit aucun dégât : Glaciation ${before} → ${dec.glaciation}`, 'debuff');
    }
    return { doneCleared };
  }, [turn]);
  return { turn, nextTurn, prevTurn: () => persist(turn - 1), resetCombat };
}

/* PV courants des 5 PJ, lisibles par TOUT inscrit.
   ⚠️ Ne surtout PAS passer par `useAllCharStates()` : ce hook s'abonne au nœud PARENT
   `characters`, resté staff-only — pour un joueur il vaut `null` (cf. le bug de bourse
   écrasée du 2026-08-21). On s'abonne aux FEUILLES `state/hpCur`, seules ouvertes par
   la règle du 2026-09-02. Même motif que `useGroupCarry` pour `attrs`/`level`.
   N'alimente que de l'affichage et le calcul des créneaux : aucune écriture n'en dépend. */
function useAllHp() {
  const [hp, setHp] = useState({});
  useEffect(() => {
    const offs = [];
    CHARACTERS.forEach((c) => {
      offs.push(window.RTDB.subscribePath(`${charPath(c.id)}/hpCur`, (v) =>
        setHp((prev) => Object.assign({}, prev, { [c.id]: v }))));
    });
    return () => offs.forEach((off) => { if (typeof off === 'function') off(); });
  }, []);
  return hp;
}

/* Initiative : jets, validation MJ, déclarations de fin de tour et créneaux.
   `combatants` = liste NORMALISÉE `[{ id, hp }]` construite par l'appelant (les PJ
   viennent de `characters`, les PNJ de `combat/enemies`) ; `round` = `combat/turn`.
   Le `joinRound` est recollé ici : il vit dans le nœud initiative, pas sur le combattant.
   Tout le calcul est délégué à `initiativeState` (game-logic, pur et testé) — ce hook
   ne fait que l'abonnement Firebase et les écritures. */
function useInitiative(combatants, round) {
  const [node, setNode] = useState(null);
  useEffect(() => window.RTDB.subscribePath(INITIATIVE, (v) => setNode(v || {})), []);
  const scores = (node && node.scores) || {};
  const done = (node && node.done) || {};
  const ko = (node && node.ko) || {};
  const joinRound = (node && node.joinRound) || {};
  const list = (combatants || []).map(c => Object.assign({}, c, { joinRound: joinRound[c.id] }));
  const state = initiativeState(list, scores, done, ko, round);

  /* --- Écritures OUVERTES AU JOUEUR pour son propre perso (règle RTDB par feuille) --- */
  // Le jet est fait par l'APP (jamais saisi) et n'écrit QUE la feuille `d6` : un joueur
  // n'a pas le droit d'écrire `bonus`/`ok`/`reroll`, sinon il s'auto-validerait.
  const roll = useCallback((id) => {
    const d6 = rollInitiative();
    return window.RTDB.setPath(`${INITIATIVE}/scores/${id}/d6`, d6);
  }, []);
  const setDone = useCallback((id, v) =>
    window.RTDB.setPath(`${INITIATIVE}/done/${id}`, v ? true : null), []);

  /* --- Écritures STAFF (héritées du .write mj+admin de campaign/runeterra) --- */
  const setBonus = useCallback((id, n) =>
    window.RTDB.setPath(`${INITIATIVE}/scores/${id}/bonus`, n | 0), []);
  /* Valider un score, c'est faire ENTRER le combattant en jeu — donc c'est ici que se
     décide à quel round il entre (spec §2.4). Le calcul est délégué à
     `initiativeJoinOnValidate` (pur, testé) ; il ne rend un round que si le combat est
     déjà engagé, et jamais si le MJ en a déjà choisi un à la main.
     ⚠️ L'écriture est faite ICI et pas au jet : un joueur n'a le droit d'écrire que la
     feuille `d6` de son score, `joinRound` retombe sur le `.write` staff. Le calculer
     au `roll` donnerait un `PERMISSION_DENIED` côté joueur.
     Renvoie le round d'entrée posé (ou `null`), pour que l'appelant puisse le dire. */
  const validate = useCallback(async (id) => {
    const join = initiativeJoinOnValidate(round, done, joinRound[id]);
    await window.RTDB.updatePath(`${INITIATIVE}/scores/${id}`, { ok: true, reroll: null });
    if (join != null) await window.RTDB.updatePath(`${INITIATIVE}/joinRound`, { [id]: join });
    return join;
  }, [round, done, joinRound]);
  // Refuser = effacer le jet et demander une relance. Le joueur revoit le bouton « Lancer ».
  const refuse = useCallback((id) =>
    window.RTDB.updatePath(`${INITIATIVE}/scores/${id}`, { ok: null, d6: null, reroll: true }), []);
  const clearScore = useCallback((id) =>
    window.RTDB.updatePath(`${INITIATIVE}/scores`, { [id]: null }), []);
  const setJoinRound = useCallback((id, r) =>
    window.RTDB.updatePath(`${INITIATIVE}/joinRound`, { [id]: r == null ? null : Math.max(1, r | 0) }), []);

  /* Horodatage du KO (spec §4.2) : appelé aux 3 endroits où des PV tombent à 0.
     On n'enregistre QUE la transition vivant → à terre, et seulement si un créneau est
     en cours : c'est ce qui permet de distinguer « mort pendant son propre créneau »
     (il agit quand même) de « mort avant » (il est sauté). Une entrée périmée est
     inoffensive : `slotParticipants` teste d'abord les PV, un ressuscité rejoue. */
  const stampKo = useCallback((id, hpBefore, hpAfter) => {
    if (!id) return;
    if (!((Number(hpBefore) || 0) > 0 && (Number(hpAfter) || 0) <= 0)) return;
    const init = state.activeInit;
    if (init == null) return;
    window.RTDB.updatePath(`${INITIATIVE}/ko`, { [id]: { round: Math.max(1, round | 0), init } });
  }, [state.activeInit, round]);

  /* Filet du MJ : un joueur absent ne doit pas geler la table. Coche d'un coup tout
     ce qui reste en attente sur le créneau actif. */
  const forceSlot = useCallback(() => {
    if (!state.active || !state.active.pending.length) return;
    const patch = {};
    state.active.pending.forEach(id => { patch[id] = true; });
    return window.RTDB.updatePath(`${INITIATIVE}/done`, patch);
  }, [state.active]);

  return { state, scores, done, ko, joinRound,
    roll, setDone, setBonus, validate, refuse, clearScore, setJoinRound, stampKo, forceSlot };
}

/* Ennemis PARTAGÉS (Firebase). Lecture tout inscrit, écriture staff (règle combat/enemies).
   API identique à l'ancien hook localStorage : la vue MJ ne change pas. */
const ENEMIES = `${CAMPAIGN}/combat/enemies`;
let _enemySeq = 0;
function newEnemyId() { return 'enemy_' + Date.now().toString(36) + '_' + (_enemySeq++); }
/* `side` = camp du combattant ('enemy' par défaut, cf. combatantSide). Un PNJ allié est
   créé visible des joueurs (reveal 'exact') : masquer les PV d'un allié n'a pas de sens,
   alors qu'un ennemi reste caché tant que le MJ n'en décide pas autrement. Le défaut est
   posé ICI, à la création — `enemyPublicView` n'est pas touchée. */
function makeEnemy(name, side) {
  const ally = side === 'ally';
  return { id: newEnemyId(), name: name || (ally ? 'Allié' : 'Ennemi'), hpCur: 100, hpMax: 100,
    manaCur: 0, manaMax: 0, atk: 10, armure: 0, resmag: 0, note: '',
    crit: 0, dcrit: 200, lethaAD: 0, lethaAP: 0, rescrit: 0,
    side: ally ? 'ally' : 'enemy',
    reveal: ally ? 'exact' : 'hidden', revealPct: 100 };
}
function useMJEnemies() {
  const [map, setMap] = useState(null);
  useEffect(() => window.RTDB.subscribePath(ENEMIES, (v) => setMap(v || {})), []);
  const enemies = map ? Object.values(map).sort((a, b) => (a.id < b.id ? -1 : 1)) : [];
  const addEnemy = useCallback((name, side) => { const e = makeEnemy(name, side); window.RTDB.updatePath(ENEMIES, { [e.id]: e }); }, []);
  const updateEnemy = useCallback((id, patch) => window.RTDB.updatePath(`${ENEMIES}/${id}`, patch), []);
  const removeEnemy = useCallback((id) => window.RTDB.updatePath(ENEMIES, { [id]: null }), []);
  return { enemies, addEnemy, updateEnemy, removeEnemy };
}

/* File d'ACTIONS en attente : le joueur PROPOSE (au cast), le MJ résout instance par
   instance. Remplace `combat/pendingHits`, qui ne savait transporter qu'un coup de
   dégâts sur une cible.
   Spec : docs/superpowers/specs/2026-09-06-actions-en-attente-design.md
   Lecture tout inscrit ; écriture MJ ou propriétaire de l'action (règle RTDB). */
const PENDING_ACTIONS = `${CAMPAIGN}/combat/pendingActions`;
function usePendingActions() {
  const [map, setMap] = useState(null);
  useEffect(() => window.RTDB.subscribePath(PENDING_ACTIONS, (v) => setMap(v || {})), []);
  const actions = map ? Object.values(map).sort((a, b) => (a.ts || 0) - (b.ts || 0)) : [];
  /* Écrit l'action et ses instances EN UNE SEULE opération : une action à moitié
     déposée serait résolue à moitié par le MJ. */
  const addAction = useCallback((action, instances) => {
    const id = 'act_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e4);
    const inst = {};
    (instances || []).forEach((it, i) => {
      const iid = 'i' + (i + 1);
      inst[iid] = Object.assign({ id: iid }, it);
    });
    return window.RTDB.updatePath(PENDING_ACTIONS,
      { [id]: Object.assign({ id, ts: Date.now(), appliedCount: 0, instances: inst }, action) });
  }, []);
  const removeAction = useCallback((id) => window.RTDB.updatePath(PENDING_ACTIONS, { [id]: null }), []);
  /* Retire une instance résolue. `applied` incrémente `appliedCount`, SEUL champ muté
     après création : c'est lui qui interdit de rembourser une compétence dont un coup
     a déjà porté (cf. actionRefundPlan). La dernière instance emporte l'action entière —
     sinon un nœud vide traînerait dans la file du MJ. */
  const resolveInstance = useCallback((action, instId, applied) => {
    const rest = Object.keys((action && action.instances) || {}).filter((k) => k !== instId);
    if (!rest.length) return window.RTDB.updatePath(PENDING_ACTIONS, { [action.id]: null });
    const patch = { [`${action.id}/instances/${instId}`]: null };
    if (applied) patch[`${action.id}/appliedCount`] = (action.appliedCount | 0) + 1;
    return window.RTDB.updatePath(PENDING_ACTIONS, patch);
  }, []);
  return { actions, addAction, removeAction, resolveInstance };
}

/* Applique une instance de SOIN. Un soin ignore armure et critique : c'est un simple
   remplissage de pool, plafonné au max de la cible.
   ⚠️ Le plafond vient de l'appelant (`hpMax`) : seul le MJ voit les stats effectives
   d'un PJ, et `healCharacter` refuse déjà de dépasser le courant si on lui ment. */
function healEnemy(enemy, amount) {
  const heal = Math.max(0, amount | 0);
  if (!enemy || !heal) return { healed: 0, hpCur: (enemy && enemy.hpCur) || 0 };
  const cur = Math.max(0, enemy.hpCur | 0);
  const cap = Math.max(cur, enemy.hpMax | 0);
  const next = Math.min(cur + heal, cap);
  if (next !== cur) window.RTDB.updatePath(`${ENEMIES}/${enemy.id}`, { hpCur: next });
  return { healed: next - cur, hpCur: next };
}

/* Applique une instance de STATUT sur un PJ : buff de compétence, bouclier, compteurs,
   transformation, et le soin PV d'un buff de PV. Tout est snapshoté au cast
   (`buildSelfEffect`, game-logic) — ici on ne fait qu'écrire.
   ⚠️ C'est le SEUL endroit où un effet de compétence entre en base depuis la refonte
   du 2026-09-06 : `cast()` n'écrit plus rien. Une instance `narrative` n'écrit rien du
   tout — « Appliquer » y vaut accusé de réception. */
async function applyStatusToCharacter(charId, skillId, payload) {
  payload = payload || {};
  if (!charId || payload.narrative) return { applied: false };
  const p = charPath(charId);
  const st = (await window.RTDB.getSnapshot(p)) || {};
  const patch = {};
  if (payload.mods && Object.keys(payload.mods).length) {
    patch[`skillBuffs/${skillId}`] = { mods: payload.mods, until: payload.until != null ? payload.until : null };
  }
  if (payload.shield) patch.shield = Math.max(0, st.shield | 0) + Math.max(0, payload.shield | 0);
  if (payload.hpGain) {
    // Un buff de PV déplace le plafond ET remplit la jauge (décision figée). Le
    // nouveau max a été snapshoté au cast : le recalculer ici demanderait toute la
    // chaîne d'effectifs, que cet orchestrateur n'a pas.
    const cur = Math.max(0, st.hpCur | 0);
    patch.hpCur = Math.min(cur + Math.max(0, payload.hpGain | 0), Math.max(cur, payload.hpMax | 0));
  }
  if (payload.counters) Object.keys(payload.counters).forEach((k) => {
    patch[`counters/${k}`] = Math.max(0, payload.counters[k] | 0) || null;
  });
  if (payload.transformUntil) patch['counters/souverainUntil'] = payload.transformUntil;
  if (Object.keys(patch).length) await window.RTDB.updatePath(p, patch);
  return { applied: true };
}

/* Rembourse une action rejetée par le MJ : le mana revient (plafonné au max snapshoté
   au cast) et le cooldown retrouve sa valeur d'AVANT (null = comp de nouveau prête).
   `plan` vient de `actionRefundPlan` (game-logic, pur) ; `restoreCd` distingue une
   annulation complète d'un simple rendu de `manaPer`.
   ⚠️ Relecture en base avant écriture, comme `healCharacter` : le mana a pu bouger
   entre le cast et le verdict du MJ (potion, autre sort), et un patch calculé sur
   l'état de la carte MJ écraserait ce mouvement. Écriture staff. */
async function refundCast(plan) {
  if (!plan || !plan.attackerId) return { mana: 0, manaCur: null };
  const p = charPath(plan.attackerId);
  const st = (await window.RTDB.getSnapshot(p)) || {};
  const cur = Math.max(0, Number(st.manaCur) || 0);
  const next = refundManaValue(cur, plan.mana, plan.manaMax);
  const patch = {};
  if (next !== cur) patch.manaCur = next;
  if (plan.restoreCd && plan.skillId && plan.skillId !== 'basic') {
    patch[`cooldowns/${plan.skillId}`] = plan.cdPrev != null ? plan.cdPrev : null;
  }
  if (Object.keys(patch).length) await window.RTDB.updatePath(p, patch);
  return { mana: next - cur, manaCur: next, cd: !!plan.restoreCd };
}

/* Applique des dégâts (déjà ajustés par le MJ) à un ennemi : réduction armure/resmag puis pool HP. */
function applyHitToEnemy(enemy, finalDmg, type, lethalite = 0) {
  const dmg = mitigateDamage(Math.max(0, finalDmg | 0), type, { armure: enemy.armure || 0, resmag: enemy.resmag || 0 }, Math.max(0, lethalite | 0));
  const res = applyDamageToPools({ hpCur: enemy.hpCur || 0, shield: 0 }, dmg);
  window.RTDB.updatePath(`${ENEMIES}/${enemy.id}`, { hpCur: res.hpCur });
  return { applied: dmg, hpCur: res.hpCur };
}
/* Applique des dégâts (déjà ajustés par le MJ) à un PJ : mitigation par SES stats
   effectives, bouclier d'abord puis PV. Miroir de `applyHitToEnemy` pour l'autre camp.
   L'appelant fournit `target` = { armure, resmag, hpCur, shield } : seul le MJ voit la
   fiche complète d'un PJ, c'est donc lui qui calcule le `eff` (via mjLive) et le passe.

   ⚠️ Le passif de Rathael (Chair gelée, +1 charge de Glaciation par coup subi) est
   traité ICI et non au site d'appel : c'est le seul endroit du code où « un PJ subit
   des dégâts » est vrai, et les deux appelants — une attaque de PNJ (EnemyAttackModal)
   et désormais une attaque d'un autre PJ (PendingActionsPanel) — doivent le déclencher à
   l'identique. Il vivait dans EnemyAttackModal ; l'y laisser aurait fait qu'une gifle
   entre joueurs ne chargerait pas Rathael, sans que rien ne le signale.
   Renvoie `glaciation` (nouvelle valeur) pour que l'appelant journalise. */
function applyHitToCharacter(charId, target, finalDmg, type, lethalite, turn, counters) {
  const t = target || {};
  const dmg = mitigateDamage(Math.max(0, finalDmg | 0), type,
    { armure: t.armure || 0, resmag: t.resmag || 0 }, Math.max(0, lethalite | 0));
  const res = applyDamageToPools({ hpCur: t.hpCur || 0, shield: t.shield || 0 }, dmg);
  window.RTDB.updatePath(charPath(charId), { hpCur: res.hpCur, shield: res.shield });
  let glaciation = null;
  if (charId === 'rathael' && dmg > 0) {
    const gp = glaciationOnHit(counters, turn);
    if (gp) {
      window.RTDB.updatePath(`${charPath(charId)}/counters`, gp);
      if (gp.glaciation != null) glaciation = gp.glaciation;
    }
  }
  return { applied: dmg, hpCur: res.hpCur, shield: res.shield, ko: res.ko, glaciation };
}

/* Soin de l'attaquant (vol de vie / sapience / omnivamp) : ajoute `amount` à ses PV,
   plafonné à maxHp (snapshot au cast). Orchestrateur staff (lit l'état, écrit hpCur). */
async function healCharacter(charId, amount, maxHp) {
  amount = Math.max(0, amount | 0);
  if (!charId || !amount) return { healed: 0, hpCur: null };
  const st = (await window.RTDB.getSnapshot(charPath(charId))) || {};
  const cur = Math.max(0, Number(st.hpCur) || 0);
  const cap = Math.max(cur, Number(maxHp) || cur);   // ne jamais dépasser le max (ni baisser)
  const next = Math.min(cur + amount, cap);
  if (next === cur) return { healed: 0, hpCur: cur };
  window.RTDB.updatePath(charPath(charId), { hpCur: next });
  return { healed: next - cur, hpCur: next };
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

/* Journal d'ÉCONOMIE — nœud SÉPARÉ de combat/log (décision MJ du 2026-08-21).
   Deux différences volontaires avec le journal de combat :
     - « ⟲ Combat » (resetCombat) ne le purge PAS : l'historique d'argent survit
       aux combats, c'est précisément son intérêt ;
     - il est réservé au MJ : le nœud n'a pas de `.read` propre, il hérite donc du
       `.read` staff de campaign/runeterra (les joueurs, eux, ont besoin d'y
       ÉCRIRE — un transfert depuis le coffre commun est une action de joueur).
   Plafonné à LOG_MAX entrées, élaguées côté staff (useEconomyLog). */
const ECONOMY_LOG = `${CAMPAIGN}/economyLog`;
function pushEconomyLog(text, kind) {
  const id = 'eco_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e4);
  window.RTDB.updatePath(ECONOMY_LOG, { [id]: { id, ts: Date.now(), text: String(text || ''), kind: kind || 'gold' } });
}
function useEconomyLog() {
  const [map, setMap] = useState(null);
  useEffect(() => window.RTDB.subscribePath(ECONOMY_LOG, (v) => setMap(v || {})), []);
  // Élagage : rien ne purge ce journal, on borne donc sa taille à la lecture.
  // Seul le staff peut lire ce nœud (règle RTDB), donc seul lui monte ce hook :
  // l'écriture d'élagage est toujours autorisée ici.
  useEffect(() => {
    if (!map) return;
    const stale = staleLogIds(map, LOG_MAX);
    if (!stale.length) return;
    const patch = {}; stale.forEach((id) => { patch[id] = null; });
    window.RTDB.updatePath(ECONOMY_LOG, patch);
  }, [map]);
  const entries = map ? Object.values(map).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, LOG_MAX) : [];
  const clearLog = useCallback(() => window.RTDB.setPath(ECONOMY_LOG, null), []);
  return { entries, clearLog };
}
/* Nom lisible d'une bourse depuis son chemin RTDB (texte de journal). */
function purseName(path) {
  if (path === SHARED_COINS) return 'coffre commun';
  const m = /\/characters\/([^/]+)\//.exec(String(path || ''));
  const c = m && CHARACTERS.find((x) => x.id === m[1]);
  return c ? c.name : (m ? m[1] : 'bourse');
}

/* Don d'XP (orchestrateur, écriture staff). Lit l'état du perso ciblé, applique le
   gain via applyXp (montée auto + report du surplus), écrit { level, xp }. Journalise
   la montée (pushLog). Retourne le résultat pour que l'appelant puisse toaster. */
async function addXp(charId, gain) {
  gain = Math.max(0, gain | 0);
  if (!gain) return { level: null, xp: null, levelsGained: 0 };
  const c = CHARACTERS.find(x => x.id === charId);
  const p = charPath(charId);
  const st = (await window.RTDB.getSnapshot(p)) || {};
  const curLevel = (st.level != null ? st.level : (c ? c.level : 1)) || 1;
  const curXp = Math.max(0, st.xp | 0);
  const res = applyXp(curLevel, curXp, gain);
  window.RTDB.updatePath(p, { level: res.level, xp: res.xp });
  if (res.levelsGained > 0) pushLog(`<b>${c ? c.name : charId}</b> passe niveau <b>${res.level}</b> !`, 'buff');
  return res;
}

/* Retrait d'XP (orchestrateur, écriture staff) : miroir d'addXp. Redescend de niveau
   si on passe sous 0 (plancher niveau 1 / xp 0). pushLog si perte de niveau. */
async function removeXp(charId, loss) {
  loss = Math.max(0, loss | 0);
  if (!loss) return { level: null, xp: null, levelsLost: 0 };
  const c = CHARACTERS.find(x => x.id === charId);
  const p = charPath(charId);
  const st = (await window.RTDB.getSnapshot(p)) || {};
  const curLevel = (st.level != null ? st.level : (c ? c.level : 1)) || 1;
  const curXp = Math.max(0, st.xp | 0);
  const res = applyXpLoss(curLevel, curXp, loss);
  window.RTDB.updatePath(p, { level: res.level, xp: res.xp });
  if (res.levelsLost > 0) pushLog(`<b>${c ? c.name : charId}</b> redescend niveau <b>${res.level}</b>.`, 'debuff');
  return res;
}

/* Les 4 dénominations, dans l'ordre de valeur croissante (source unique). */
const COIN_KEYS = ['cuiv', 'arg', 'or', 'plat'];

/* Don d'argent (orchestrateur, écriture staff) : AJOUTE le patch aux pièces du joueur
   (récompense, pas un transfert depuis le coffre). Dénominations < 0 ignorées. */
async function grantCoins(charId, patch) {
  const p = charPath(charId);
  const st = (await window.RTDB.getSnapshot(p)) || {};
  const cur = st.coins || {};
  const next = {}, added = {};
  for (const k of COIN_KEYS) {
    const add = Math.max(0, (patch && patch[k]) | 0);
    if (add) { next[k] = (cur[k] || 0) + add; added[k] = add; }
  }
  if (!Object.keys(next).length) return;
  window.RTDB.updatePath(`${p}/coins`, next);
  const c = CHARACTERS.find((x) => x.id === charId);
  pushEconomyLog(`<b>${c ? c.name : charId}</b> reçoit ${coinsAmountText(added)} (récompense)`, 'buff');
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

/* Catalogue d'objets de base PARTAGÉ (éditable par le staff depuis le picker).
   Lecture tout inscrit, écriture staff. Amorçage unique depuis ITEM_CATALOG. */
const CATALOG = `${CAMPAIGN}/catalog`;
const CATALOG_INIT = `${CAMPAIGN}/catalogInit`;
function useItemCatalog(canSeed) {
  const [map, setMap] = useState(null);             // null = en chargement ; {} = vide chargé
  const [inited, setInited] = useState(undefined);  // undefined = inconnu
  useEffect(() => window.RTDB.subscribePath(CATALOG, (v) => setMap(v || {})), []);
  useEffect(() => window.RTDB.subscribePath(CATALOG_INIT, (v) => setInited(!!v)), []);
  // Amorçage unique : staff + jamais amorcé + vide → sème depuis ITEM_CATALOG.
  useEffect(() => {
    if (!canSeed) return;
    if (inited === undefined || map === null) return;     // pas encore chargé
    if (inited || Object.keys(map).length) return;        // déjà amorcé / non vide
    window.RTDB.updatePath(CATALOG, buildCatalogSeed(window.ITEM_CATALOG || []));
    window.RTDB.setPath(CATALOG_INIT, true);
  }, [canSeed, inited, map]);
  const catalog = catalogArray(map, !!inited, window.ITEM_CATALOG || []);
  const setCatalogItem    = useCallback((id, item) => window.RTDB.updatePath(CATALOG, { [id]: item }), []);
  const removeCatalogItem = useCallback((id)        => window.RTDB.updatePath(CATALOG, { [id]: null }), []);
  return { catalog, seeded: !!inited, setCatalogItem, removeCatalogItem };
}

/* Monnaie partagée (coffre commun). */
const SHARED_COINS = `${CAMPAIGN}/sharedCoins`;
function useSharedCoins() {
  const [coins, setCoins] = useState(null);
  useEffect(() => window.RTDB.subscribePath(SHARED_COINS, (v) =>
    setCoins(v || { plat:0, or:0, arg:0, cuiv:0 })), []);
  return { coins };
}

/* Attelage du groupe : { [slotKey]: itemId } — les 5 emplacements de transport du coffre
   commun (TRANSPORT_SLOTS). Un objet n'apporte sa capacité de groupe (`carryGroup`) que
   PLACÉ dans un de ces slots, pas par simple présence dans le coffre.
   R/W pour tout participant inscrit, comme sharedInventory : ranger la monture n'est pas
   un acte de MJ. */
const SHARED_TRANSPORT = `${CAMPAIGN}/sharedTransport`;
function useSharedTransport() {
  const [transport, setTransport] = useState(null);   // null = en chargement ; {} = vide chargé
  useEffect(() => window.RTDB.subscribePath(SHARED_TRANSPORT, (v) => setTransport(v || {})), []);
  const setSlot = useCallback((slotKey, itemId) =>
    window.RTDB.updatePath(SHARED_TRANSPORT, { [slotKey]: itemId || null }), []);
  return { transport, setSlot };
}

/* Profils de portage des 5 personnages, pour la capacité COMMUNE du coffre.
   ⚠️ NE PAS remplacer par useAllCharStates() : ce hook s'abonne au nœud PARENT
   `campaign/runeterra/characters`, resté staff-only. Ouvrir un enfant n'ouvre pas le
   parent (version lecture de la leçon des journaux) — l'abonnement serait rejeté et
   retomberait silencieusement sur null pour un joueur. On s'abonne donc aux chemins
   FEUILLES `state/attrs` et `state/level`, les deux seuls ouverts aux inscrits.
   ⚠️ Ce hook n'alimente QUE de l'affichage. Aucune écriture ne doit en dépendre : c'est
   exactement ce qui a écrasé la bourse d'Elias le 2026-08-21 (valeur nulle → écriture
   d'un montant faux). Une jauge fausse est une gêne, une écriture fausse une corruption.
   `attrs`/`level` sont ABSENTS par défaut (cas nominal aujourd'hui) : on replie sur
   `char.attrs` / `char.level` de data.jsx, comme le fait déjà charBaseStats. */
function useGroupCarry() {
  const [live, setLive] = useState({});   // { [charId]: { attrs, level } }
  useEffect(() => {
    const offs = [];
    CHARACTERS.forEach((c) => {
      offs.push(window.RTDB.subscribePath(`${charPath(c.id)}/attrs`, (v) =>
        setLive((prev) => ({ ...prev, [c.id]: { ...(prev[c.id] || {}), attrs: v } }))));
      offs.push(window.RTDB.subscribePath(`${charPath(c.id)}/level`, (v) =>
        setLive((prev) => ({ ...prev, [c.id]: { ...(prev[c.id] || {}), level: v } }))));
    });
    return () => offs.forEach((off) => { if (typeof off === 'function') off(); });
  }, []);
  return CHARACTERS.map((c) => {
    const st = live[c.id] || {};
    const a = st.attrs || c.attrs || {};
    return { charId: c.id, name: c.name,
      force: a.force || 0, mental: a.mental || 0, hab: a.hab || 0,
      level: (st.level != null ? st.level : c.level) || 1 };
  });
}

/* Écriture LIBRE d'une bourse (édition MJ) : valeurs ABSOLUES, clampées à un entier >= 0.
   Seules les dénominations présentes dans `patch` sont écrites (les autres restent
   intactes : updatePath = merge). Renvoie le patch réellement écrit — l'appelant s'en
   sert pour son toast. Contrairement à grantCoins (additif, positif seulement), cette
   voie permet de FIXER une valeur, donc aussi d'en retirer. */
async function writeCoins(path, patch) {
  const next = {};
  for (const k of COIN_KEYS) {
    if (!patch || patch[k] == null) continue;
    next[k] = Math.max(0, patch[k] | 0);
  }
  if (!Object.keys(next).length) return next;
  // Lecture préalable : `patch` est ABSOLU, le delta n'existe que par rapport à
  // l'état d'avant. C'est ce delta qui a un sens au journal (« +2 or, −15 cuivre »).
  const before = (await window.RTDB.getSnapshot(path)) || {};
  window.RTDB.updatePath(path, next);
  const txt = coinsDeltaText(before, next);
  if (txt) {
    const v = coinsDeltaValue(before, next);   // 0 = compensé : un change de monnaie
    pushEconomyLog(`Bourse de <b>${purseName(path)}</b> ajustée par le MJ : ${txt}`,
      v > 0 ? 'buff' : v < 0 ? 'debuff' : 'gold');
  }
  return next;
}
const setCharCoins   = (charId, patch) => writeCoins(`${charPath(charId)}/coins`, patch);
const setSharedCoins = (patch)         => writeCoins(SHARED_COINS, patch);

/* Transfert d'item entre deux collections RTDB ({id:item}). Utilise la logique
   pure planItemTransfer puis applique les deux patches en temps réel.
   NB : transfert NON atomique (2 écritures sur des sous-arbres distincts). On
   crédite la destination AVANT de débiter la source : si la 2e écriture échoue,
   on a une duplication (récupérable) plutôt qu'une perte. */
async function moveItem(fromPath, toPath, fromItems, toItems, itemId, n) {
  // ⚠️ Ne PAS se fier aux `fromItems`/`toItems` de l'appelant — voir moveCoins juste
  // en dessous pour le detail. Ici la consequence etait moins grave (l'item ne
  // fusionnait pas avec la pile existante et creait un doublon, sans rien detruire),
  // mais la cause est la meme, donc le correctif aussi.
  const src = (await window.RTDB.getSnapshot(fromPath)) || {};
  const dst = (await window.RTDB.getSnapshot(toPath)) || {};
  const { srcPatch, dstPatch } = planItemTransfer(src, dst, itemId, n);
  if (Object.keys(dstPatch).length) window.RTDB.updatePath(toPath, dstPatch);
  if (Object.keys(srcPatch).length) window.RTDB.updatePath(fromPath, srcPatch);
}

/* Transfert de pièces (une dénomination) entre deux objets coins, montant borné.
   Crédit-avant-débit, même raison que moveItem (échec → duplication récupérable). */
async function moveCoins(fromPath, toPath, fromCoins, toCoins, key, n) {
  // ⚠️ Ne PAS se fier aux `fromCoins`/`toCoins` de l'appelant (gardes pour compatibilite
  // de signature, mais ignores). REGRESSION CORRIGEE le 2026-08-21 : sur la page
  // Inventaire commun, `toCoins` venait de useAllCharStates(), qui lit le noeud
  // `campaign/runeterra/characters` — REFUSE a un joueur par les regles RTDB (il ne
  // peut lire que SA fiche). L'abonnement etait rejete, la valeur retombait sur le
  // repli {0,0,0,0}, et la bourse du joueur etait ECRASEE par le montant pris au lieu
  // d'etre creditee (6 argent + 4 pris = 4). Invisible en MJ, qui lit tout.
  // On relit donc les deux bourses en base : elles sont lisibles par l'auteur legitime
  // du transfert dans les deux sens, et `getSnapshot` REJETTE si l'acces est refuse —
  // le transfert est abandonne plutot que d'ecrire une valeur fausse.
  const src = (await window.RTDB.getSnapshot(fromPath)) || {};
  const dst = (await window.RTDB.getSnapshot(toPath)) || {};
  const plan = planCoinMove(src, dst, key, n);
  if (!plan) return;
  window.RTDB.updatePath(toPath, { [key]: plan.to });
  window.RTDB.updatePath(fromPath, { [key]: plan.from });
  // Le seul mouvement d'argent que les JOUEURS déclenchent — donc le plus utile à tracer.
  pushEconomyLog(`${coinsAmountText({ [key]: plan.moved })} : <b>${purseName(fromPath)}</b> → <b>${purseName(toPath)}</b>`, 'gold');
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

/* Supprime un compte de /users (page Admin, réservé admin). Efface le mapping rôle/perso ;
   le compte Firebase Auth subsiste (se ré-inscrira « joueur en attente » à sa prochaine connexion). */
function removeUser(uid) {
  return window.RTDB.setPath(`users/${uid}`, null);
}

Object.assign(window, {
  useCharState, useAllCharStates, useSharedInventory, useSharedCoins, useItemCatalog, CATALOG,
  useAuthIdentity, useAllUsers, setUserAssignment, removeUser,
  seedIfEmpty, charPath, CAMPAIGN, SHARED_INV, SHARED_COINS, moveItem, moveCoins,
  useSharedTurn, COMBAT_TURN,
  useInitiative, INITIATIVE, useAllHp,
  useMJEnemies, makeEnemy, newEnemyId, ENEMIES,
  usePendingActions, applyHitToEnemy, applyHitToCharacter, healCharacter, healEnemy,
  applyStatusToCharacter, refundCast, PENDING_ACTIONS,
  pushLog, useCombatLog, COMBAT_LOG, addXp, removeXp, grantCoins,
  pushEconomyLog, useEconomyLog, ECONOMY_LOG, purseName,
  COIN_KEYS, setCharCoins, setSharedCoins,
  useSharedTransport, SHARED_TRANSPORT, useGroupCarry,
});
