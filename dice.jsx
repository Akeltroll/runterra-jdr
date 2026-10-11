/* ============================================================
   LANCEUR DE DÉS (2026-10-11) — tiroir flottant, le même sur les onglets de DICE_PAGES.
   Trois états : fermé (pastille), compact (tests + dés), déployé (+ combinaisons + journal).
   La logique des jets est pure (game-logic.js : rollDice, parseDiceFormula…) ; le journal
   vit dans `/dice` (data-state.jsx : useDiceLog, pushDiceRoll).
   ⚠️ INDÉPENDANT du combat : un jet n'écrit rien d'autre que son entrée de journal.
   ⚠️ Le dé est tiré dans le navigateur du lanceur (confiance assumée, décision MJ) ; en
   contrepartie le journal rappelle le mode, le bonus/malus et l'avantage de chaque jet.
   ============================================================ */
const DICE_PAGES = ['competences', 'sheet', 'equip', 'mj'];
const DICE_SELF = '__self';
const DICE_ATTRS = [
  { key: 'force',  name: 'Force',    label: 'Test de Force' },
  { key: 'hab',    name: 'Habileté', label: 'Test d’Habileté' },
  { key: 'mental', name: 'Mental',   label: 'Test de Mental' },
  { key: 'magie',  name: 'Magie',    label: 'Test de Magie' },
];
const DICE_SPIN_MS = 550;
const diceSigned = (v) => (v < 0 ? '−' + Math.abs(v) : '+' + v);
const dicePref = {
  get(k, d) { try { const v = localStorage.getItem('runeterra_dice_' + k); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('runeterra_dice_' + k, v); } catch (e) {} },
};

/* Roulement de dés synthétisé (WebAudio) : aucun fichier son à héberger. */
let _diceAudio = null;
function playDiceSound() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    _diceAudio = _diceAudio || new AC();
    const ctx = _diceAudio, t0 = ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const len = Math.floor(ctx.sampleRate * 0.03);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let j = 0; j < len; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / len);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800 + Math.random() * 2200;
      const g = ctx.createGain(); g.gain.value = 0.25 * (1 - i / 8);
      src.connect(bp); bp.connect(g); g.connect(ctx.destination);
      src.start(t0 + i * 0.075 + Math.random() * 0.03);
    }
  } catch (e) { /* pas de son : le jet reste valable */ }
}

/* « d20 + d4 : 15 + 2 = 17 » — dés à gauche, valeurs à droite, d20 écarté barré.
   `spin` : les dés défilent le temps du roulement, le total est masqué. */
function DiceLine({ entry, spin }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!spin) return;
    const t = setInterval(() => setTick((x) => x + 1), 60);
    return () => clearInterval(t);
  }, [spin]);
  const nat = spin ? null : diceNatural(entry);
  let first = true;
  return (
    <div className="dice-line mono">
      <span className="dice-formula">{diceFormulaText(entry)}</span>
      <span className="faint"> : </span>
      {diceRollTokens(entry).map((k, i) => {
        if (k.dropped) return <s key={i} className="dice-dropped" title="Dé écarté">{spin ? '?' : k.text}</s>;
        const op = first ? (k.sign < 0 ? '−' : '') : (k.sign < 0 ? ' − ' : ' + ');
        first = false;
        return (
          <React.Fragment key={i}>{op}
            <span className={k.mod ? 'dice-mod' : 'dice-die'} title={k.mod ? (k.label || 'modificateur') : 'd' + k.sides}>
              {spin && !k.mod ? rollDie(k.sides) : k.text}
            </span>
          </React.Fragment>
        );
      })}
      <span className="faint"> = </span>
      <b className={'dice-total' + (nat ? ' ' + nat : '')}>{spin ? '…' : entry.total}</b>
    </div>
  );
}

/* Une entrée de journal : qui, quel jet, le détail, puis le rappel bonus / naturel / DD. */
function DiceEntry({ entry, spin }) {
  if (!entry || !entry.terms) return null;
  const nat = spin ? null : diceNatural(entry);
  const ok = spin ? null : diceOutcome(entry.total, entry.dd);
  const mods = (entry.mods || []).filter((m) => m.label);
  const t = new Date(entry.ts || Date.now());
  const hh = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
  return (
    <div className={'dice-entry' + (entry.secret ? ' is-secret' : '')}>
      <div className="dice-entry-head">
        {entry.secret && <span title="Jet secret">🔒</span>}
        <b>{entry.who}</b>
        {entry.by && <span className="faint">({entry.by})</span>}
        <span className="dim">· {entry.label}</span>
        {entry.adv && <span className={'dice-tag ' + entry.adv}>{entry.adv === 'adv' ? 'Avantage' : 'Désavantage'}</span>}
        <span className="grow" />
        <span className="faint">{hh}</span>
      </div>
      <DiceLine entry={entry} spin={spin} />
      {!spin && (mods.length > 0 || nat || ok != null) && (
        <div className="dice-entry-foot">
          {mods.length > 0 && <span className="faint">{mods.map((m) => `${m.label} ${diceSigned(m.value)}`).join(' · ')}</span>}
          {nat && <span className={'dice-tag ' + nat}>{nat === 'crit' ? '20 naturel' : '1 naturel'}</span>}
          {ok != null && <span className={'dice-tag ' + (ok ? 'ok' : 'ko')}>DD {entry.dd} : {ok ? 'réussite' : 'échec'}</span>}
        </div>
      )}
    </div>
  );
}

function DiceTray({ auth }) {
  const toast = useToast();
  const staff = isStaff(auth.role);
  const isMj = auth.role === 'mj';
  const { entries, loaded, clearLog } = useDiceLog(auth.uid, auth.role);
  const { enemies } = useMJEnemies();

  const [mode, _setMode] = useState(() => dicePref.get('mode', 'closed'));   // closed | compact | full
  const setMode = (m) => { _setMode(m); dicePref.set('mode', m); };
  const [mute, _setMute] = useState(() => dicePref.get('mute', '0') === '1');
  const setMute = (v) => { _setMute(v); dicePref.set('mute', v ? '1' : '0'); };
  const [adv, setAdv] = useState(null);
  const [bonus, setBonus] = useState(0);
  const [dd, setDd] = useState('');
  const [secret, setSecret] = useState(false);
  const [formula, setFormula] = useState('');
  const [last, setLast] = useState(null);
  const [spin, setSpin] = useState(false);
  const spinTimer = useRef(null);
  useEffect(() => () => clearTimeout(spinTimer.current), []);

  // Qui lance : un joueur = son perso ; le staff choisit (lui-même, un PJ, un PNJ ou un ennemi).
  const selfName = isMj ? 'MJ' : (auth.username || 'Admin');
  const [rollerSel, setRollerSel] = useState(auth.charId || DICE_SELF);
  const rollerId = staff ? rollerSel : auth.charId;
  const pcChar = CHARACTERS.find((c) => c.id === rollerId) || null;
  const npc = !pcChar && staff ? enemies.find((e) => e.id === rollerId) : null;
  const who = pcChar ? pcChar.name : npc ? npc.name : selfName;
  const pc = useCharAttrsLevel(pcChar ? pcChar.id : null);
  const actives = (pcChar && SKILLS[pcChar.id] && SKILLS[pcChar.id].actives) || [];

  // Toast à l'arrivée du jet de quelqu'un d'autre. Le premier chargement ne toaste rien.
  const seen = useRef(null);
  useEffect(() => {
    if (!loaded) return;
    const fresh = seen.current ? entries.filter((e) => !seen.current.has(e.id)) : [];
    seen.current = seen.current || new Set();
    entries.forEach((e) => seen.current.add(e.id));
    fresh.forEach((e) => {
      if (e.uid === auth.uid || !e.terms || Date.now() - (e.ts || 0) > 120000) return;
      const nat = diceNatural(e);
      toast(`🎲 ${e.secret ? '🔒 ' : ''}<b>${e.who}</b> — ${e.label} : <b>${e.total}</b>`,
        nat === 'crit' ? 'buff' : nat === 'fumble' ? 'debuff' : 'gold');
    });
  }, [entries, loaded]);

  const bonusMods = () => (bonus ? [{ label: bonus < 0 ? 'malus' : 'bonus', value: bonus }] : []);
  const launch = (spec, kind, label) => {
    if (!spec) return;
    const roll = rollDice(spec, { adv });
    const entry = {
      who, whoId: pcChar ? pcChar.id : npc ? npc.id : null,
      by: staff && who !== selfName && rollerId !== auth.charId ? selfName : null,
      kind, label, terms: roll.terms, mods: roll.mods, adv: roll.adv, dropped: roll.dropped, total: roll.total,
      dd: diceOutcome(0, dd) == null ? null : Number(dd),
    };
    pushDiceRoll(auth.uid, entry, secret).catch((e) => {
      console.error('Jet non enregistré :', e);
      toast('Jet non enregistré au journal : droits insuffisants', 'debuff');
    });
    setLast({ ...entry, ts: Date.now(), secret: secret || null });
    setSpin(true);
    clearTimeout(spinTimer.current);
    spinTimer.current = setTimeout(() => setSpin(false), DICE_SPIN_MS);
    if (!mute) playDiceSound();
    // Avantage, bonus et DD valent pour UN jet ; « secret » reste coché (le MJ enchaîne).
    setAdv(null); setBonus(0); setDd('');
  };
  const rollAttr = (a) => {
    const v = pc ? (pc.attrs[a.key] || 0) : null;
    const mods = v == null ? [] : [{ label: `${a.name} ${v}`, value: attrTestBonus(v) }];
    launch(diceTestSpec(mods.concat(bonusMods())), 'attr', a.label);
  };
  const rollSkill = (label) => launch(diceTestSpec(bonusMods()), 'skill', label);
  const rollFree = (sides) => launch(diceSpec([{ n: 1, sides, sign: 1 }], bonusMods()), 'free', 'Jet libre');
  const rollFormula = () => {
    const spec = parseDiceFormula(formula);
    if (!spec) { toast('Formule illisible — exemple : <b>2d20 + d4 + 3</b>', 'debuff'); return; }
    launch(diceSpec(spec.terms, spec.mods.concat(bonusMods())), 'free', 'Jet libre');
  };
  // Les boutons « + dN » composent la formule : une seule représentation de la combinaison.
  const addToFormula = (sides) => {
    const cur = parseDiceFormula(formula) || { terms: [], mods: [] };
    const terms = cur.terms.map((t) => ({ ...t }));
    const hit = terms.find((t) => t.sides === sides && t.sign === 1);
    if (hit) hit.n = Math.min(DICE_MAX_COUNT, hit.n + 1); else terms.push({ n: 1, sides, sign: 1 });
    const next = diceSpec(terms, cur.mods);
    if (next) setFormula(diceFormulaText(next));
  };
  const doClear = () => {
    if (!window.confirm('Vider tout le journal de dés, jets secrets compris ?')) return;
    clearLog().catch((e) => { console.error('Purge du journal de dés refusée :', e); toast('Journal non vidé : droits insuffisants', 'debuff'); });
  };

  if (mode === 'closed') {
    return (
      <button className="dice-fab" onClick={() => setMode('compact')} title="Ouvrir le lanceur de dés">
        🎲{last && !spin && <b className="mono">{last.total}</b>}
      </button>
    );
  }
  const full = mode === 'full';
  const allies = enemies.filter((e) => isAlly(e)), foes = enemies.filter((e) => !isAlly(e));
  return (
    <div className={'dice-tray' + (full ? ' is-full' : '')}>
      <div className="dice-head">
        <span className="dice-title">🎲 Dés</span>
        {staff ? (
          <select className="dice-roller" value={rollerId} onChange={(e) => setRollerSel(e.target.value)} title="Qui lance ?">
            <option value={DICE_SELF}>{selfName}</option>
            <optgroup label="Personnages">{CHARACTERS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
            {allies.length > 0 && <optgroup label="PNJ alliés">{allies.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</optgroup>}
            {foes.length > 0 && <optgroup label="Ennemis">{foes.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</optgroup>}
          </select>
        ) : <span className="dice-roller-name">{who}</span>}
        <span className="grow" />
        <button className="dice-icon" onClick={() => setMute(!mute)} title={mute ? 'Activer le son' : 'Couper le son'}>{mute ? '🔇' : '🔊'}</button>
        <button className="dice-icon" onClick={() => setMode(full ? 'compact' : 'full')} title={full ? 'Réduire' : 'Déployer : combinaisons et journal'}>{full ? '▾' : '▴'}</button>
        <button className="dice-icon" onClick={() => setMode('closed')} title="Fermer">✕</button>
      </div>

      <div className="dice-result">
        {last ? <DiceEntry entry={last} spin={spin} /> : <div className="faint" style={{ fontSize: 12 }}>Choisis un test ou un dé.</div>}
      </div>

      <div className="dice-opts">
        <div className="dice-seg" title="Avantage / désavantage : 2d20, on garde le meilleur ou le pire. Vaut pour un lancer à un seul d20.">
          <button className={adv === 'dis' ? 'on dis' : ''} onClick={() => setAdv(adv === 'dis' ? null : 'dis')}>Désav.</button>
          <button className={adv === 'adv' ? 'on adv' : ''} onClick={() => setAdv(adv === 'adv' ? null : 'adv')}>Avantage</button>
        </div>
        <div className="dice-step" title="Bonus ou malus du prochain jet">
          <button onClick={() => setBonus(bonus - 1)}>−</button>
          <input value={bonus === 0 ? '' : diceSigned(bonus)} placeholder="±0"
            onChange={(e) => setBonus(parseInt(e.target.value.replace('−', '-'), 10) || 0)} />
          <button onClick={() => setBonus(bonus + 1)}>+</button>
        </div>
        <label className="dice-dd" title="Degré de difficulté (optionnel) : affiche réussite ou échec">
          DD <input value={dd} placeholder="—" inputMode="numeric" onChange={(e) => setDd(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} />
        </label>
        <button className={'dice-secret' + (secret ? ' on' : '')} onClick={() => setSecret(!secret)}
          title={isMj ? 'Jet secret : toi seul le vois' : 'Jet secret : seuls toi et le MJ le voyez'}>
          {secret ? '🔒 Secret' : '🔓 Public'}
        </button>
      </div>

      <div className="dice-sec">Tests de caractéristique{pc ? '' : ' (d20 + bonus)'}</div>
      <div className="dice-grid g4">
        {DICE_ATTRS.map((a) => (
          <button key={a.key} className="dice-btn" onClick={() => rollAttr(a)}
            title={pc ? `d20 + ⌊${a.name} ${pc.attrs[a.key] || 0} / 4⌋` : 'd20 + bonus saisi'}>
            {a.name}{pc && <i>{diceSigned(attrTestBonus(pc.attrs[a.key] || 0))}</i>}
          </button>
        ))}
      </div>

      <div className="dice-sec">Tests de compétence</div>
      {actives.length > 0 ? (
        <div className="dice-grid g2">
          {actives.map((sk, i) => {
            const locked = pc && !skillUnlocked(i, pc.level);
            return (
              <button key={sk.id} className="dice-btn skill" disabled={locked} onClick={() => rollSkill(`C${i + 1} · ${sk.name}`)}
                title={locked ? `Niveau ${i + 1} requis` : `d20 + bonus — ${sk.name}`}>
                <i>C{i + 1}</i>{sk.name}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="dice-grid g2">
          <button className="dice-btn" onClick={() => rollSkill('Test de compétence')} title="d20 + bonus saisi">Compétence</button>
        </div>
      )}

      <div className="dice-sec">Dés</div>
      <div className="dice-grid g8">
        {DICE_SIDES.map((s) => <button key={s} className="dice-btn die" onClick={() => rollFree(s)} title={`Lancer 1d${s}`}>d{s}</button>)}
      </div>

      {full && (
        <React.Fragment>
          <div className="dice-sec">Combinaison</div>
          <div className="dice-grid g8">
            {DICE_SIDES.map((s) => <button key={s} className="dice-btn add" onClick={() => addToFormula(s)} title={`Ajouter 1d${s} à la combinaison`}>+d{s}</button>)}
          </div>
          <div className="dice-formula-row">
            <input className="mono" value={formula} placeholder="2d20 + d4 + 3" onChange={(e) => setFormula(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') rollFormula(); }} />
            {formula && <button className="dice-icon" onClick={() => setFormula('')} title="Effacer">✕</button>}
            <button className="btn btn-sm btn-gold" onClick={rollFormula} disabled={!formula.trim()}>Lancer</button>
          </div>

          <div className="dice-sec row">
            <span>Journal de dés</span><span className="grow" />
            {isMj && entries.length > 0 && <button className="dice-icon" style={{ width: 'auto', padding: '0 8px' }} onClick={doClear}>Vider</button>}
          </div>
          <div className="dice-log">
            {entries.length === 0
              ? <div className="faint" style={{ fontSize: 12 }}>Aucun jet.</div>
              : entries.map((e) => <DiceEntry key={e.id} entry={e} />)}
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

/* Le tiroir est un calque global : son plantage ne doit pas emporter la page dessous. */
class DiceBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('Plantage du lanceur de dés :', error); }
  render() { return this.state.failed ? null : this.props.children; }
}

Object.assign(window, { DiceTray, DiceBoundary, DiceEntry, DiceLine, DICE_PAGES, playDiceSound });
