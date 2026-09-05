/* ============================================================
   Onglet COMPÉTENCES — cast (mana + cooldown + dégâts affichés),
   compteurs (charges/marques/CN/tranches), cooldowns sur tour partagé.
   Formules = SKILLS (data.jsx) → fns pures de game-logic.js. Le MJ saisit
   le nombre de dégâts dans « Subir » de l'ennemi (pas d'auto-application).
   ============================================================ */

/* Variables d'attaque à demander selon la compétence (non persistées). */
const SKILL_VARS = {
  tir_cible: ['firstHit'],
  attaque_sournoise: ['furtif'],
  pugilat: ['side', 'moved'],
  ecrasement: ['moved'],
  demi_ours: ['moved'],
  salve_corsaire: ['nbTargets'],
};

/* Type de dégâts de l'arme équipée (slot armePrincipale) → 'Physique'|'Magique'|'Hybride'. */
function weaponTypeOf(state, char) {
  const eqId = state.equipment && state.equipment.armePrincipale;
  const item = (eqId && state.inventory) ? state.inventory[eqId] : null;
  const w = (item && WEAPONS.find(x => x.name === item.name)) || WEAPONS.find(x => x.id === char.weaponId);
  return (w && w.cat) || 'Physique';
}

/* Mods de runes (miroir des autres pages). */
function runeModsOf(state) {
  const rs = state.runes || {};
  return sumRuneMods(Object.keys(rs.selected || {}).filter(id => rs.selected[id]), rs.choices || {}, buildRuneIndex(RUNES));
}

const CD_LOCKED = 999999; // sentinelle « 1×/combat » (débloqué par Nouveau combat)

/* ============================================================
   INITIATIVE — panneau joueur (lot 5)
   Le joueur lance son dé, attend la validation du MJ, puis déclare sa fin de tour.
   Spec : docs/superpowers/specs/2026-09-02-initiative-creneaux-design.md §2.1.bis / §2.5
   ============================================================ */

const INI_DOT = { pj: 'var(--gold)', ally: 'var(--buff)', enemy: 'var(--debuff)' };

/* Bandeau d'action du joueur : lancer son dé, ou déclarer sa fin de tour.
   C'est le seul endroit de l'app où un joueur écrit dans `combat/initiative` — et
   uniquement sur SES deux feuilles (`scores/<lui>/d6` et `done/<lui>`). */
function MyTurnBar({ me, meName, ini, toast, round }) {
  const { state, scores, done, joinRound, roll, setDone } = ini;
  const entry = scores[me];
  const status = initiativeStatus(entry);
  const active = state.active;
  /* Renfort arrivé en cours de combat (spec §2.4) : son score est validé, mais il
     n'entre qu'au round suivant. Sans ce cas explicite il lirait « ce n'est pas ton
     tour » round après round sans comprendre pourquoi il n'est dans aucun créneau. */
  const joinAt = combatantJoinRound({ joinRound: joinRound[me] });
  const late = joinAt > round ? joinAt : null;
  const isMySlot = !!(active && active.participants.indexOf(me) !== -1);
  const iAmDone = done[me] === true;

  const guard = (p, msg) => Promise.resolve(p).catch(() => toast(msg, 'debuff'));

  let body;
  if (status === 'idle' || status === 'reroll') {
    body = (
      <div className="row gap-3" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13 }}>
          {status === 'reroll'
            ? 'Le MJ demande un nouveau jet d’initiative.'
            : 'Lance ton initiative pour entrer dans l’ordre de tour.'}
        </span>
        <button className="btn btn-gold" onClick={() => guard(roll(me), 'Jet refusé : droits insuffisants')}>
          🎲 {status === 'reroll' ? 'Relancer' : 'Lancer l’initiative'}
        </button>
      </div>
    );
  } else if (status === 'pending') {
    body = (
      <span style={{ fontSize: 13 }}>
        Tu as fait <b className="mono" style={{ color: 'var(--gold-pale)' }}>{entry.d6}</b> —
        <span className="faint"> en attente de validation du MJ.</span>
      </span>
    );
  } else if (late) {
    body = (
      <span style={{ fontSize: 13 }}>
        Tu rejoins le combat au <b className="mono" style={{ color: 'var(--gold-pale)' }}>round {late}</b> —
        <span className="faint"> ton initiative est déjà validée.</span>
      </span>
    );
  } else if (!active) {
    body = <span className="faint" style={{ fontSize: 13 }}>Aucun créneau en cours.</span>;
  } else if (!isMySlot) {
    body = (
      <span style={{ fontSize: 13 }} className="faint">
        Créneau <b className="mono">{active.init}</b> en cours — ce n’est pas ton tour.
      </span>
    );
  } else if (iAmDone) {
    body = (
      <div className="row gap-3" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--buff-bright)' }}>✓ Tu as terminé ton tour.</span>
        <button className="btn btn-ghost btn-sm" onClick={() => guard(setDone(me, false), 'Action refusée : droits insuffisants')}>
          Annuler
        </button>
      </div>
    );
  } else {
    body = (
      <div className="row gap-3" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--gold-pale)' }}>▶ C’est ton tour (créneau {active.init}).</span>
        <button className="btn btn-gold" onClick={() => guard(setDone(me, true), 'Action refusée : droits insuffisants')}>
          J’ai fini
        </button>
      </div>
    );
  }

  return (
    <div className="panel" style={{ padding: '12px 14px', borderLeft: '3px solid var(--gold)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div className="col" style={{ gap: 2 }}>
          <span className="overline">Ton tour — {meName}</span>
          {body}
        </div>
        {status === 'ok' && (
          <span className="mono" style={{ fontSize: 12, color: 'var(--gold-pale)' }}>
            initiative {initiativeTotal(entry)}
          </span>
        )}
      </div>
    </div>
  );
}

/* Ordre des tours en lecture seule. Le créneau actif est encadré ; les combattants qui
   n'ont pas encore déclaré restent en clair, ceux qui ont fini sont barrés, et les
   non-participants (à terre avant l'ouverture) sont atténués. */
function InitiativeBoard({ ini, meta, me }) {
  const { state, scores, done } = ini;
  if (!state.slots.length) {
    return (
      <div className="panel" style={{ padding: '10px 14px' }}>
        <div className="overline" style={{ marginBottom: 6 }}>Ordre des tours</div>
        <span className="faint" style={{ fontSize: 12 }}>Aucune initiative validée pour l’instant.</span>
      </div>
    );
  }
  return (
    <div className="panel" style={{ padding: '10px 14px' }}>
      <div className="overline" style={{ marginBottom: 8 }}>Ordre des tours</div>
      <div className="row gap-2 wrap" style={{ alignItems: 'stretch' }}>
        {state.slots.map(slot => {
          const isActive = state.activeInit === slot.init;
          return (
            <div key={slot.init} style={{ borderRadius: 8, padding: '6px 9px', minWidth: 118,
              border: '1px solid ' + (isActive ? 'var(--line-gold)' : 'var(--line)'),
              background: isActive ? 'var(--bg-panel-2)' : 'var(--bg-inset)',
              opacity: slot.complete && !isActive ? 0.55 : 1 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span className="mono" style={{ fontSize: 11, color: isActive ? 'var(--gold-pale)' : 'var(--ink-faint)' }}>
                  {isActive ? '▶ ' : ''}Créneau {slot.init}
                </span>
              </div>
              {slot.members.map(id => {
                const m = meta[id] || { name: id, side: 'enemy' };
                const participant = slot.participants.indexOf(id) !== -1;
                const fini = done[id] === true;
                return (
                  <div key={id} className="row gap-2" style={{ alignItems: 'center', opacity: participant ? 1 : 0.45 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                      background: INI_DOT[m.side] || 'var(--debuff)' }} />
                    <span style={{ fontSize: 12, whiteSpace: 'nowrap',
                      fontWeight: id === me ? 700 : 400,
                      color: fini ? 'var(--ink-faint)' : 'var(--ink)',
                      textDecoration: fini ? 'line-through' : 'none' }}>
                      {m.name}
                    </span>
                    <span className="mono" style={{ fontSize: 10, marginLeft: 'auto',
                      color: fini ? 'var(--buff-bright)' : 'var(--ink-faint)' }}>
                      {!participant ? '·' : fini ? '✓' : '…'}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Pastille d'un combattant non-joueur, vue JOUEUR : ce qu'il a le droit de voir passe
   toujours par `enemyPublicView` (un allié est simplement créé en 'exact'). */
function CombatantChip({ c }) {
  const v = enemyPublicView(c);
  return (
    <span className="row gap-2" style={{ alignItems: 'center', fontSize: 12 }}>
      <span className="mono" style={{ color: v.ko ? 'var(--faint)' : 'var(--ink)' }}>{c.name}</span>
      {v.ko && <span className="mono" style={{ color: 'var(--faint)' }}>· KO</span>}
      {v.showBar && (
        <span style={{ display: 'inline-block', width: 64, height: 7, borderRadius: 99, background: 'var(--bg-inset)', border: '1px solid var(--line)', overflow: 'hidden', verticalAlign: 'middle' }}>
          <span style={{ display: 'block', height: '100%', width: v.pct + '%', background: isAlly(c) ? 'var(--buff-bright)' : 'var(--hp)' }} />
        </span>
      )}
      {v.text && <span className="mono faint">{v.text}</span>}
    </span>
  );
}

/* Ressources du lanceur, en tête de l'onglet Combat (collant au scroll : on regarde
   son mana au moment où on fait défiler les cartes de compétences).
   Les maxima viennent de `eff` — donc de la MÊME chaîne que la fiche (items + runes +
   passif + skillBuffs) : pas de chiffre divergent entre les deux onglets. */
function MyResources({ char, eff, state, activeBuffs, setHp, setMana, setInvItem, removeInvItem }) {
  const hp = state.hpCur || 0, mana = state.manaCur || 0, shield = state.shield || 0;
  return (
    <div className="panel" style={{ padding: '10px 14px', position: 'sticky', top: 0, zIndex: 5 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
        <span className="overline">Mes ressources</span>
        {hp <= 0 && <span className="badge" style={{ background: 'var(--bg-inset)', color: 'var(--hp)' }}>KO</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <ResourceBar kind="hp" cur={hp} max={eff.hp} />
        <ResourceBar kind="mana" cur={mana} max={eff.mana} />
        <ResourceBar kind="shield" cur={shield} max={Math.max(char.shieldMax || 0, shield)} />
      </div>
      <div style={{ marginTop: 9 }}>
        <ConsumablesRow char={char} maxHp={eff.hp} maxMana={eff.mana} activeBuffs={activeBuffs}
          inventory={state.inventory} setHp={setHp} setMana={setMana}
          setInvItem={setInvItem} removeInvItem={removeInvItem}
          empty="Aucune potion dans l'inventaire." />
      </div>
    </div>
  );
}

/* Petit stepper de compteur (max arbitraire, contrairement à NumberStepper borné 5). */
function CounterStepper({ label, value, max, color, onChange }) {
  const v = value || 0;
  return (
    <div className="row gap-2" style={{ alignItems: 'center' }}>
      <span className="overline" style={{ minWidth: 92 }}>{label}</span>
      <button className="btn btn-sm btn-ghost" onClick={() => onChange(Math.max(0, v - 1))} disabled={v <= 0}>−</button>
      <span className="mono" style={{ fontSize: 15, color: color || 'var(--gold-pale)', minWidth: 54, textAlign: 'center' }}>{v} / {max}</span>
      <button className="btn btn-sm btn-ghost" onClick={() => onChange(Math.min(max, v + 1))} disabled={v >= max}>+</button>
    </div>
  );
}

function PassiveCard({ kit, eff, base, counters, level, color, setCounter }) {
  const p = kit.passive || {};
  const ctr = p.counter;
  const max = ctr ? (typeof ctr.max === 'function' ? ctr.max(level) : ctr.max) : 0;
  const cur = ctr ? (counters[ctr.key] || 0) : 0;
  const bonus = sumPassiveMods(kit._id, counters, level, base); // { stat: n }
  return (
    <div className="panel" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="panel-head"><h3>⟡ {p.name || 'Passif'}</h3><span className="overline">Passif</span></div>
      <div style={{ padding: '10px 14px' }}>
        {p.note && <div className="faint" style={{ fontSize: 12.5, marginBottom: ctr ? 12 : 0, lineHeight: 1.5 }}>{p.note}</div>}
        {ctr && (
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <CounterStepper label={ctr.label} value={cur} max={max} color={color} onChange={(n) => setCounter(ctr.key, n)} />
            {p.statHint && bonus[p.statHint] ? (
              <span className="mono" style={{ fontSize: 13, color: 'var(--buff)' }}>
                +{bonus[p.statHint]} {p.statHint.toUpperCase()}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function ActiveCard({ sk, eff, baseCtx, color, ready, readyAt, turn, manaCur, onCast, locked, minLevel }) {
  const [vars, setVars] = useState({ firstHit: false, furtif: false, side: 'droite', moved: 0, nbTargets: 1, duration: (sk.duration ? sk.duration.min : 1) });
  if (locked) {
    return (
      <div className="panel" style={{ borderLeft: '3px solid var(--line-strong)', opacity: 0.5 }}>
        <div className="panel-head">
          <h3>⚔ {sk.name}</h3>
          <span className="badge" style={{ background: 'var(--bg-panel-2)', color: 'var(--gold-pale)' }}>🔒 Niveau {minLevel}</span>
        </div>
        <div style={{ padding: '10px 14px' }}>
          <div className="faint" style={{ fontSize: 12.5 }}>Se débloque au niveau {minLevel}.</div>
          {sk.note && <div className="faint" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>{sk.note}</div>}
        </div>
      </div>
    );
  }
  const needed = SKILL_VARS[sk.id] || [];
  const ctx = Object.assign({}, baseCtx, vars);
  const dmg = sk.dmg ? sk.dmg(eff, ctx) : null;
  const shield = sk.shield ? sk.shield(eff, ctx) : null;
  const heal = sk.heal ? sk.heal(eff, ctx) : null;
  const total = (dmg != null && sk.id === 'salve_corsaire') ? dmg * (vars.nbTargets || 1) : null;
  const enoughMana = manaCur >= (sk.mana || 0);
  const cdLabel = ready ? 'Prêt' : (readyAt === CD_LOCKED ? '1×/combat utilisé' : `prêt tour ${readyAt}`);
  const cdInfo = sk.kind === 'turn' ? '1×/tour'
    : sk.kind === 'combat' ? '1×/combat'
    : (sk.cd ? `CD ${sk.cd} tour${sk.cd > 1 ? 's' : ''}` : 'Sans CD');

  return (
    <div className="panel" style={{ borderLeft: `3px solid ${ready ? color : 'var(--line-strong)'}`, opacity: ready ? 1 : 0.7 }}>
      <div className="panel-head">
        <h3>⚔ {sk.name}</h3>
        <span className="row gap-2" style={{ alignItems: 'center' }}>
          <span className="badge" style={{ background: 'var(--bg-inset)' }}>{sk.mana} mana</span>
          <span className="badge" title="Cooldown de la compétence" style={{ background: 'var(--bg-inset)', color: 'var(--gold-pale)' }}>{cdInfo}</span>
          <span className="badge" style={{ background: ready ? 'var(--bg-inset)' : 'var(--bg-panel-2)', color: ready ? 'var(--buff)' : 'var(--gold-pale)' }}>{cdLabel}</span>
        </span>
      </div>
      <div style={{ padding: '10px 14px' }}>
        {/* Contrôles de variables d'attaque */}
        {(needed.length > 0 || sk.duration) && (
          <div className="row gap-3" style={{ flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            {needed.includes('firstHit') && <label className="row gap-1" style={{ fontSize: 12.5, alignItems: 'center' }}><input type="checkbox" checked={vars.firstHit} onChange={e => setVars(s => ({ ...s, firstHit: e.target.checked }))} /> 1er coup (+25%)</label>}
            {needed.includes('furtif') && <label className="row gap-1" style={{ fontSize: 12.5, alignItems: 'center' }}><input type="checkbox" checked={vars.furtif} onChange={e => setVars(s => ({ ...s, furtif: e.target.checked }))} /> Camouflé (×1,5)</label>}
            {needed.includes('side') && (
              <label className="row gap-1" style={{ fontSize: 12.5, alignItems: 'center' }}>Frappe
                <select value={vars.side} onChange={e => setVars(s => ({ ...s, side: e.target.value }))} style={{ background: 'var(--bg-inset)', color: 'var(--ink)', border: '1px solid var(--line-strong)', borderRadius: 5, padding: '3px 6px' }}>
                  <option value="gauche">Gauche</option><option value="droite">Droite</option>
                </select>
              </label>
            )}
            {needed.includes('moved') && <label className="row gap-1" style={{ fontSize: 12.5, alignItems: 'center' }}>Cases <input type="number" min="0" value={vars.moved} onChange={e => setVars(s => ({ ...s, moved: Math.max(0, e.target.value | 0) }))} style={{ width: 56, background: 'var(--bg-inset)', color: 'var(--ink)', border: '1px solid var(--line-strong)', borderRadius: 5, padding: '3px 6px' }} /></label>}
            {needed.includes('nbTargets') && <label className="row gap-1" style={{ fontSize: 12.5, alignItems: 'center' }}>Cibles <input type="number" min="1" value={vars.nbTargets} onChange={e => setVars(s => ({ ...s, nbTargets: Math.max(1, e.target.value | 0) }))} style={{ width: 56, background: 'var(--bg-inset)', color: 'var(--ink)', border: '1px solid var(--line-strong)', borderRadius: 5, padding: '3px 6px' }} /></label>}
            {sk.duration && (
              <label className="row gap-1" style={{ fontSize: 12.5, alignItems: 'center' }}>Durée
                <select value={vars.duration} onChange={e => setVars(s => ({ ...s, duration: Math.max(sk.duration.min, Math.min(sk.duration.max, e.target.value | 0)) }))} style={{ background: 'var(--bg-inset)', color: 'var(--ink)', border: '1px solid var(--line-strong)', borderRadius: 5, padding: '3px 6px' }}>
                  {Array.from({ length: sk.duration.max - sk.duration.min + 1 }, (_, i) => sk.duration.min + i).map(n => <option key={n} value={n}>{n} tour{n > 1 ? 's' : ''}</option>)}
                </select>
              </label>
            )}
          </div>
        )}
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div className="col" style={{ gap: 2 }}>
            {dmg != null ? (
              <span className="mono" style={{ fontSize: 22, color: 'var(--hp)', fontWeight: 700 }}>
                {dmg}{total != null ? <span style={{ fontSize: 13, color: 'var(--gold-pale)' }}> /cible · total {total}</span> : null}
                <span style={{ fontSize: 12, color: 'var(--faint)' }}> dégâts</span>
              </span>
            ) : shield != null ? (
              <span className="mono" style={{ fontSize: 22, color: 'var(--gold)', fontWeight: 700 }}>{shield}<span style={{ fontSize: 12, color: 'var(--faint)' }}> bouclier</span></span>
            ) : (
              <span className="faint" style={{ fontSize: 13 }}>Utilitaire (pas de dégât direct)</span>
            )}
            {heal != null && <span className="mono" style={{ fontSize: 12.5, color: 'var(--buff)' }}>soin allié {heal}</span>}
          </div>
          <button className="btn btn-gold" onClick={() => onCast(ctx, dmg, needed.includes('nbTargets') ? Math.max(1, vars.nbTargets || 1) : 1)} disabled={!ready || !enoughMana}
            title={!enoughMana ? 'Pas assez de mana' : (!ready ? 'En cooldown' : '')}>Lancer</button>
        </div>
        {sk.note && <div className="faint" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>{sk.note}</div>}
      </div>
    </div>
  );
}

function CompetencesBody({ char, staff }) {
  const toast = useToast();
  const { state, setField, setCounter, setCooldown, setSkillBuff, setInvItem, removeInvItem } = useCharState(char.id);
  const { turn } = useSharedTurn();
  const { enemies } = useMJEnemies();
  const { enemies: foes, allies } = splitCombatants(enemies);
  // Initiative. Les PV des 5 PJ viennent des FEUILLES `state/hpCur` (useAllHp) : le noeud
  // parent `characters` reste staff-only, un joueur n'y a pas acces.
  const allHp = useAllHp();
  const iniCombatants = CHARACTERS.map(c => ({ id: c.id, hp: allHp[c.id] }))
    .concat(enemies.map(e => ({ id: e.id, hp: e.hpCur })));
  const ini = useInitiative(iniCombatants, turn);
  const iniMeta = {};
  CHARACTERS.forEach(c => { iniMeta[c.id] = { name: c.name, side: 'pj' }; });
  enemies.forEach(e => { iniMeta[e.id] = { name: e.name, side: combatantSide(e) }; });
  const { addHit } = usePendingHits();
  const [targetId, setTargetId] = useState('');
  if (!state) return <div className="panel" style={{ margin: 20, padding: 20 }}>Chargement…</div>;

  const kit = SKILLS[char.id];
  const color = char.color || 'var(--gold)';
  const counters = state.counters || {};
  const cooldowns = state.cooldowns || {};
  const level = (state.level != null ? state.level : char.level) || 1;

  if (kit && kit.pending) {
    return (
      <div className="panel" style={{ margin: 20, padding: 20, borderLeft: `3px solid ${color}` }}>
        <h3 style={{ marginBottom: 8 }}>⟡ {char.name} — compétences en refonte</h3>
        <div className="faint" style={{ fontSize: 13, lineHeight: 1.6 }}>{kit.note}</div>
      </div>
    );
  }
  if (!kit) return <div className="panel" style={{ margin: 20, padding: 20 }}>Aucune compétence définie.</div>;

  const itemMods = sumItemMods(state.equipment, state.inventory);
  const base = charBaseStats(char, state);
  const passiveMods = sumPassiveMods(char.id, counters, level, base);
  const skillBuffMods = sumSkillBuffs(state.skillBuffs || {}, turn);
  // Buffs de la fiche (Bravoure +50 % AD, Aiguisage %Crit×2, Affaibli −50 % AD…) : ils
  // DOIVENT entrer dans le eff de cette page, sinon les dégâts affichés — et surtout ceux
  // envoyés au MJ — ignorent l'effet que le MJ vient d'appliquer. Les 3 autres pages
  // (fiche, MJ, Équipement) les passent déjà ; cette page était la seule à passer [].
  const activeBuffs = Object.keys(state.buffs || {});
  const eff = computeEffective(base, state.modifiers, activeBuffs, mergeMods(mergeMods(mergeMods(itemMods, runeModsOf(state)), passiveMods), skillBuffMods));
  const wType = weaponTypeOf(state, char);
  const baseCtx = { counters, level, wType, hpMax: base.hp };
  // Setters de ressources : même contrat que la fiche (valeur ou updater), pour que
  // ConsumablesRow soit branchable des deux côtés sans variante.
  const setHp   = (v) => setField('hpCur',   typeof v === 'function' ? v(state.hpCur || 0) : v);
  const setMana = (v) => setField('manaCur', typeof v === 'function' ? v(state.manaCur || 0) : v);
  const kitWithId = Object.assign({ _id: char.id }, kit);

  function cast(sk, ctx, dmgArg, nbHits) {
    ctx = ctx || baseCtx;
    nbHits = Math.max(1, nbHits || 1);
    const cost = sk.mana || 0;
    const skIndex = kit.actives.indexOf(sk);
    if (!skillUnlocked(skIndex, level)) {
      toast(`<b>${char.name}</b> — ${sk.name} se débloque au niveau ${skIndex + 1}`, 'gold');
      return;
    }
    // Dégâts/cible (réutilise le calcul de la carte ; repli si appel sans dmgArg).
    const dmg = sk.dmg ? (dmgArg != null ? dmgArg : sk.dmg(eff, ctx)) : null;
    // Garde « pas de cible » : une action à dégâts exige une cible (avant toute dépense).
    if (dmg != null && !targetId) {
      toast(`<b>${char.name}</b> — choisis une cible d'abord`, 'gold');
      return;
    }
    const manaCur = state.manaCur || 0;
    if (manaCur < cost) { toast(`<b>${char.name}</b> — pas assez de mana (${manaCur}/${cost})`, 'gold'); return; }
    setField('manaCur', manaCur - cost);
    if (sk.kind === 'combat') setCooldown(sk.id, CD_LOCKED);
    else setCooldown(sk.id, nextReadyAt(turn, sk.kind === 'turn' ? 1 : sk.cd));
    const logParts = []; // effets appliqués au lanceur, agrégés en une entrée de journal
    // Compteur conditionnel (ex. Mur de Givre : +1 charge de Glaciation si déjà ≥ 1).
    if (sk.counterBump) {
      const cb = sk.counterBump;
      const cur = counters[cb.key] || 0;
      if (cur >= (cb.min || 0)) setCounter(cb.key, Math.min(cb.max != null ? cb.max : cur + cb.by, cur + cb.by));
    }
    // Compteur fixé (ex. Éclat de l'âme : consomme toutes les charges → glaciation = 0).
    // Après calcul des dégâts (capturés via dmgArg), donc la conso n'affecte pas le coup.
    if (sk.counterSet) Object.keys(sk.counterSet).forEach(k => setCounter(k, sk.counterSet[k]));
    // Transformation (ex. Souverain Glacial) : pose une fenêtre de tours (souverainUntil = dernier tour
    // actif) → le passif Glaciation gagne +2 charges/coup pendant l'ultime (lu par glaciationOnHit).
    if (sk.transform) setCounter('souverainUntil', turn + (sk.transform.turns - 1));
    // Buff sur soi : snapshot de mods plats → effet de combat orange. selfBuff = % de la stat
    // de base ; selfBuffFlat = valeurs plates littérales (objet) ou fonction (eff, ctx) → objet
    // (ex. Mur de Givre = scaling par niveau, Souverain Glacial = PV par charge).
    const sbf = typeof sk.selfBuffFlat === 'function' ? (sk.selfBuffFlat(eff, ctx) || {}) : sk.selfBuffFlat;
    if (sk.selfBuff || sbf) {
      const flat = {};
      if (sk.selfBuff) Object.keys(sk.selfBuff).forEach(k => { const f = Math.round(sk.selfBuff[k] * (base[k] || 0)); if (f) flat[k] = (flat[k] || 0) + f; });
      if (sbf) Object.keys(sbf).forEach(k => { const f = Math.round(sbf[k]); if (f) flat[k] = (flat[k] || 0) + f; });
      // Durée optionnelle : until = tour de fin (turn + durée − 1). Sans sk.duration → permanent (null).
      let until = null, durTxt = '';
      if (sk.duration) {
        const d = Math.max(sk.duration.min, Math.min(sk.duration.max, (ctx.duration | 0) || sk.duration.min));
        until = turn + (d - 1);
        durTxt = ` (${d} tour${d > 1 ? 's' : ''})`;
      }
      setSkillBuff(sk.id, flat, until);
      if (flat.hp) {
        const newMax = (eff.hp || 0) + flat.hp;
        setField('hpCur', Math.min((state.hpCur || 0) + flat.hp, newMax));
      }
      logParts.push((flat.hp ? `+${flat.hp} PV` : 'effet de combat') + durTxt);
      toast(`<b>${char.name}</b> — ${sk.name} actif (effet de combat)`, 'gold');
    }
    // Bouclier au cast (one-shot, ajouté au pool).
    if (sk.shield) {
      const sh = sk.shield(eff, ctx);
      if (sh) { setField('shield', (state.shield || 0) + sh); logParts.push(`+${sh} bouclier`); toast(`<b>${char.name}</b> gagne ${sh} bouclier`, 'gold'); }
    }
    // Comp à dégâts + cible → N attaques en attente (un coup = une carte ; chacune son crit).
    if (dmg != null && targetId) {
      let anyCrit = false;
      for (let i = 0; i < nbHits; i++) {
        const cr = rollCrit(eff.crit || 0, eff.dcrit || 0);
        if (cr.didCrit) anyCrit = true;
        addHit({ attackerId: char.id, attackerName: char.name, skillId: sk.id, skillName: sk.name,
          type: (wType === 'Magique' ? 'magique' : 'physique'),
          computedDmg: dmg, critDmg: Math.round(dmg * cr.multiplier), didCrit: cr.didCrit,
          critMult: cr.multiplier, letha: eff.letha || 0, lethaMag: eff.lethaMag || 0,
          crit: eff.crit || 0, dcrit: eff.dcrit || 0,
          omni: eff.omni || 0, vol: eff.vol || 0, sapience: eff.sapience || 0, hpMax: eff.hp || 0, targetId });
      }
      const tgt = enemies.find(en => en.id === targetId);
      const suffix = nbHits > 1 ? ` ×${nbHits}` : '';
      pushLog(`<b>${char.name}</b> vise <b>${tgt ? tgt.name : 'un ennemi'}</b> avec <b>${sk.name}</b>${suffix} (${dmg}/coup${anyCrit ? ' — CRIT !' : ''}) — en attente MJ`, anyCrit ? 'buff' : 'gold');
      toast(`<b>${char.name}</b> — ${sk.name} : ${nbHits} coup(s) envoyé(s) au MJ`, 'buff');
    } else {
      pushLog(`<b>${char.name}</b> lance <b>${sk.name}</b>${logParts.length ? ' — ' + logParts.join(', ') : ''}`, logParts.length ? 'buff' : 'gold');
      toast(`<b>${char.name}</b> lance ${sk.name}`, 'buff');
    }
  }

  // Attaque de base : même flux que les comps (cible → attaque en attente MJ), sans mana ni cooldown.
  const eqWeaponName = (() => {
    const eqId = state.equipment && state.equipment.armePrincipale;
    const it = (eqId && state.inventory) ? state.inventory[eqId] : null;
    return (it && it.name) || (WEAPONS.find(w => w.id === char.weaponId) || {}).name || 'Arme';
  })();
  const basicDmg = (wType === 'Magique' ? (eff.ap || 0) : (eff.ad || 0));
  function basicAttack() {
    if (!targetId) { toast(`<b>${char.name}</b> — choisis une cible d'abord`, 'gold'); return; }
    const cr = rollCrit(eff.crit || 0, eff.dcrit || 0);
    const critDmg = Math.round(basicDmg * cr.multiplier);
    addHit({ attackerId: char.id, attackerName: char.name, skillId: 'basic', skillName: 'Attaque de base',
      type: (wType === 'Magique' ? 'magique' : 'physique'), computedDmg: basicDmg, critDmg,
      didCrit: cr.didCrit, critMult: cr.multiplier, letha: eff.letha || 0, lethaMag: eff.lethaMag || 0,
      crit: eff.crit || 0, dcrit: eff.dcrit || 0,
      omni: eff.omni || 0, vol: eff.vol || 0, sapience: eff.sapience || 0, hpMax: eff.hp || 0, targetId });
    const tgt = enemies.find(en => en.id === targetId);
    const shown = cr.didCrit ? `${critDmg} — CRITIQUE !` : `${basicDmg}`;
    pushLog(`<b>${char.name}</b> attaque <b>${tgt ? tgt.name : 'un ennemi'}</b> (${shown}) — en attente MJ`, cr.didCrit ? 'buff' : 'gold');
    toast(`<b>${char.name}</b> attaque (${shown}) — envoyé au MJ`, 'buff');
  }

  return (
    <div className="col gap-4" style={{ padding: 20 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ fontSize: 20 }}>Combat — {char.name}</h2>
        <span className="row gap-2" style={{ alignItems: 'center' }}>
          {staff && (
            <span className="row gap-1" style={{ alignItems: 'center' }}>
              <span className="overline">Niveau</span>
              <button className="btn btn-sm btn-ghost" onClick={() => setField('level', Math.max(1, level - 1))} disabled={level <= 1}>−</button>
              <span className="mono" style={{ fontSize: 15, color: 'var(--gold-pale)', minWidth: 22, textAlign: 'center' }}>{level}</span>
              <button className="btn btn-sm btn-ghost" onClick={() => setField('level', level + 1)}>+</button>
            </span>
          )}
          <span className="badge" style={{ background: 'var(--bg-inset)', color: 'var(--gold-pale)' }}>⏱ Tour {turn}</span>
        </span>
      </div>
      <MyResources char={char} eff={eff} state={state} activeBuffs={activeBuffs}
        setHp={setHp} setMana={setMana} setInvItem={setInvItem} removeInvItem={removeInvItem} />
      {enemies.length > 0 && (
        <div className="panel" style={{ padding: '10px 14px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div className="row gap-4 wrap" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div className="overline" style={{ marginBottom: 6 }}>Ennemis en jeu</div>
                  <div className="row gap-3 wrap">
                    {foes.length === 0
                      ? <span className="faint" style={{ fontSize: 12 }}>aucun</span>
                      : foes.map(e => <CombatantChip key={e.id} c={e} />)}
                  </div>
                </div>
                {allies.length > 0 && (
                  <div>
                    <div className="overline" style={{ marginBottom: 6, color: 'var(--buff-bright)' }}>Alliés</div>
                    <div className="row gap-3 wrap">
                      {allies.map(e => <CombatantChip key={e.id} c={e} />)}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <label className="row gap-2" style={{ alignItems: 'center', fontSize: 12.5 }}>Cible
              <select value={targetId} onChange={e => setTargetId(e.target.value)}
                style={{ background: 'var(--bg-inset)', color: 'var(--ink)', border: '1px solid var(--line-strong)', borderRadius: 6, padding: '6px 9px', fontSize: 13 }}>
                <option value="">— aucune —</option>
                {/* Les alliés restent ciblables (soin, tir fratricide) mais dans un groupe
                    séparé : on ne tape pas un PNJ allié par glissement de souris. */}
                {foes.filter(en => en.hpCur > 0).map(en => {
                  const v = enemyPublicView(en);
                  return <option key={en.id} value={en.id}>{en.name}{v.mode === 'exact' ? ` (${en.hpCur} PV)` : ''}</option>;
                })}
                {allies.filter(en => en.hpCur > 0).length > 0 && (
                  <optgroup label="Alliés">
                    {allies.filter(en => en.hpCur > 0).map(en => {
                      const v = enemyPublicView(en);
                      return <option key={en.id} value={en.id}>{en.name}{v.mode === 'exact' ? ` (${en.hpCur} PV)` : ''}</option>;
                    })}
                  </optgroup>
                )}
              </select>
            </label>
          </div>
        </div>
      )}
      {(() => {
        const sb = sumSkillBuffs(state.skillBuffs || {}, turn);
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
      <div className="panel" style={{ borderLeft: '3px solid var(--gold)' }}>
        <div className="panel-head">
          <h3>⚔ Attaque de base</h3>
          <span className="overline">{eqWeaponName} · {wType === 'Magique' ? 'AP' : 'AD'}</span>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 14px' }}>
          <span className="mono" style={{ fontSize: 22, color: 'var(--hp)', fontWeight: 700 }}>
            {basicDmg}<span style={{ fontSize: 12, color: 'var(--faint)' }}> dégâts</span>
          </span>
          <button className="btn btn-gold" onClick={basicAttack}>Attaquer</button>
        </div>
      </div>
      <PassiveCard kit={kitWithId} eff={eff} base={base} counters={counters} level={level} color={color} setCounter={setCounter} />
      <div className="comp-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {kit.actives.map((sk, i) => (
          <ActiveCard key={sk.id} sk={sk} eff={eff} baseCtx={baseCtx} color={color}
            ready={cooldownReady(cooldowns[sk.id], turn)} readyAt={cooldowns[sk.id]} turn={turn}
            manaCur={state.manaCur || 0} onCast={(ctx, dmg, nbHits) => cast(sk, ctx, dmg, nbHits)}
            locked={!skillUnlocked(i, level)} minLevel={i + 1} />
        ))}
      </div>
      <MyTurnBar me={char.id} meName={char.name} ini={ini} toast={toast} round={turn} />
      <InitiativeBoard ini={ini} meta={iniMeta} me={char.id} />
      <CombatLog canClear={false} />
    </div>
  );
}

function CompetencesPage({ lockedCharId }) {
  const [charId, setCharId] = useState(() => {
    if (lockedCharId) return lockedCharId;
    const id = localStorage.getItem('runeterra_identity');
    return (id && id !== 'mj' && CHARACTERS.some(c => c.id === id)) ? id : 'rathael';
  });
  const char = CHARACTERS.find(c => c.id === charId) || CHARACTERS[0];
  return (
    <div className="col" style={{ height: '100%', minHeight: 0 }}>
      {!lockedCharId && (
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8, alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid var(--line)', flex: '0 0 auto' }}>
          <span className="overline">Perso</span>
          <select value={charId} onChange={e => setCharId(e.target.value)}
            style={{ background: 'var(--bg-inset)', color: 'var(--ink)', border: '1px solid var(--line-strong)', borderRadius: 6, padding: '7px 10px', fontSize: 13 }}>
            {CHARACTERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto' }}>
        <CompetencesBody key={char.id} char={char} staff={!lockedCharId} />
      </div>
    </div>
  );
}

Object.assign(window, { CompetencesPage });
