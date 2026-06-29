/* ============================================================
   PAGE — ARBRE DE RUNES
   5 familles, sélection stricte (points = niveau), persistée
   temps réel (state/runes). Bonus plats -> stats ; conditionnel
   -> rappels. Contenu figé : RUNES (data.jsx).
   ============================================================ */
const RUNE_INDEX = buildRuneIndex(RUNES);

/* Glyphe décoratif + libellé par palier. */
const RUNE_GLYPH = { mineure:'◆', avancee:'◇', fondamentale:'⬢' };
const RUNE_TIER_LABEL = { mineure:'Mineure', avancee:'Avancée', fondamentale:'Fondamentale' };

function RuneNode({ node, state, choice, capstone, onClick, onChoice, onHover }) {
  const isAdp = node.mods && node.mods.adp != null;
  return (
    <div className="rune-cell">
      <div className={'rune-hex tier-' + node.tier + ' ' + state}
        onClick={() => onClick(node)}
        onMouseEnter={(e) => onHover(node, capstone, e)}
        onMouseLeave={() => onHover(null)}>
        <span className="rune-hex-glyph">{RUNE_GLYPH[node.tier] || '◆'}</span>
      </div>
      <div className="rune-hex-name">{node.name}</div>
      {isAdp && state === 'selected' && (
        <div className="rune-adp" onClick={(e) => e.stopPropagation()}>
          {['ad', 'ap'].map(k => (
            <button key={k} className={(choice || 'ad') === k ? 'on' : ''}
              onClick={() => onChoice(node.id, k)}>{k.toUpperCase()}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* Connecteurs SVG verticaux d'une famille (mineure->avancée->fondamentale par voie).
   Coordonnées déterministes : 3 colonnes (x=50/150/250), 3 rangées (y=50/150/250).
   Une liaison est illuminée quand le palier SUPÉRIEUR (prérequis) est sélectionné. */
function RuneLinks({ family, isSelected }) {
  const colX = [50, 150, 250], rowY = [50, 150, 250];
  const lines = [];
  family.paths.forEach((p, c) => {
    for (let r = 0; r < p.nodes.length - 1; r++) {
      const lit = isSelected(p.nodes[r].id);
      lines.push(
        <line key={p.key + '-' + r} x1={colX[c]} y1={rowY[r]} x2={colX[c]} y2={rowY[r + 1]}
          className={'rune-link' + (lit ? ' lit' : '')} />
      );
    }
  });
  return (
    <svg className="rune-links" viewBox="0 0 300 300" preserveAspectRatio="none" aria-hidden="true">
      {lines}
    </svg>
  );
}

/* Popover de détail (survol d'un nœud). hover = { node, capstone, fam, x, y } | null. */
function RuneTooltip({ hover }) {
  if (!hover) return null;
  const { node, capstone, x, y } = hover;
  return (
    <div className="rune-tooltip" style={{ '--fam': hover.fam,
      left: Math.min(x + 14, window.innerWidth - 272),
      top: Math.min(y + 12, window.innerHeight - 170) }}>
      <div className="rt-tier">{RUNE_TIER_LABEL[node.tier] || node.tier}</div>
      <div className="rt-name">{node.name}</div>
      <div className="rt-desc">{node.desc}</div>
      {node.note ? <div className="rt-note">⚠ {node.note}</div> : null}
      {capstone ? <div className="rt-cap"><span>Bonus thématique</span>{capstone}</div> : null}
    </div>
  );
}

function RuneFamilyPanel({ family, nodeState, choices, selectedSet, onClick, onChoice, onHover }) {
  return (
    <div className="rune-family" style={{ '--fam': family.color }}>
      <h3 style={{ color: family.color }}>{family.name}</h3>
      <div className="rune-tree">
        <RuneLinks family={family} isSelected={(id) => !!selectedSet[id]} />
        <div className="rune-node-grid">
          {family.paths.map(p => p.nodes.map(n => (
            <RuneNode key={n.id} node={n} state={nodeState(n.id)} choice={choices[n.id]}
              capstone={n.tier === 'fondamentale' ? p.capstone : null}
              onClick={onClick} onChoice={onChoice}
              onHover={(node, capstone, e) => onHover(node, capstone, family.color, e)} />
          )))}
        </div>
      </div>
      <div className="rune-theme-cond">Condition de thématique : {family.theme}</div>
    </div>
  );
}

function RuneReminders({ selectedIds }) {
  // Nœuds dont un effet n'est pas calculé : runes 'reminder' OU bonus calculé + sous-effet (`note`).
  const items = selectedIds.map(id => RUNE_INDEX[id]).filter(n => n && (n.kind === 'reminder' || n.note));
  if (!items.length) return null;
  return (
    <div className="rune-reminders">
      <div className="overline" style={{ marginBottom:8 }}>Rappels — effets à appliquer manuellement</div>
      <ul>{items.map(n => <li key={n.id}><b>{n.name}</b> — {n.kind === 'reminder' ? n.desc : n.note}</li>)}</ul>
    </div>
  );
}

function RuneBody({ char, staff }) {
  const { state, setField, setRuneSelected, setRuneChoice, resetRunes } = useCharState(char.id);
  const toast = useToast();
  const [hover, setHover] = useState(null);
  const onHover = (node, capstone, fam, e) => {
    if (!node) { setHover(null); return; }
    setHover({ node, capstone, fam, x: e.clientX, y: e.clientY });
  };
  if (!state) return <div style={{ padding:40 }} className="dim">Chargement…</div>;
  const runes = state.runes || {};
  const selectedSet = runes.selected || {};
  const choices = runes.choices || {};
  const selectedIds = Object.keys(selectedSet).filter(id => selectedSet[id]);
  const bonus = state.runeBonus || 0;          // points additionnels accordés par le MJ (test / niveau)
  const effLevel = (state.level != null ? state.level : char.level) || 1;
  const budget = runeBudget(effLevel) + bonus;
  const spent = runeSpent(selectedIds, RUNE_INDEX);

  const nodeState = (id) => {
    if (selectedSet[id]) return 'selected';
    return canSelectRune(id, selectedIds, RUNE_INDEX, budget).ok ? 'available' : 'locked';
  };
  const onClick = (node) => {
    const id = node.id;
    if (selectedSet[id]) {
      const r = canDeselectRune(id, selectedIds, RUNE_INDEX);
      if (!r.ok) { toast(r.reason, 'gold'); return; }
      setRuneSelected(id, false);
      if (choices[id]) setRuneChoice(id, null);
    } else {
      const r = canSelectRune(id, selectedIds, RUNE_INDEX, budget);
      if (!r.ok) { toast(r.reason, 'gold'); return; }
      setRuneSelected(id, true);
    }
  };

  return (
    <div className="rune-page">
      <div className="rune-head">
        <div>
          <h2 style={{ fontSize:24 }}>Arbre de runes — {char.name}</h2>
          <span className="faint" style={{ fontSize:12 }}>Forgez votre légende</span>
        </div>
        <div className="row gap-3" style={{ alignItems:'center' }}>
          {staff && (
            <span className="row gap-1" style={{ alignItems:'center' }} title="Points bonus (MJ) — test / montée de niveau">
              <button className="btn btn-sm btn-ghost" disabled={bonus <= 0}
                onClick={() => setField('runeBonus', Math.max(0, bonus - 1))}>−</button>
              <span className="faint mono" style={{ fontSize:11 }}>MJ +{bonus}</span>
              <button className="btn btn-sm btn-ghost"
                onClick={() => setField('runeBonus', bonus + 1)}>+</button>
            </span>
          )}
          <span className="rune-points">Points : {spent}/{budget}</span>
          <button className="btn btn-sm btn-ghost" disabled={!selectedIds.length}
            onClick={() => { if (selectedIds.length) resetRunes(); }}>Réinitialiser</button>
        </div>
      </div>
      <div className="rune-grid">
        {RUNES.map(f => (
          <RuneFamilyPanel key={f.key} family={f} nodeState={nodeState}
            choices={choices} selectedSet={selectedSet} onClick={onClick}
            onChoice={setRuneChoice} onHover={onHover} />
        ))}
      </div>
      <RuneReminders selectedIds={selectedIds} />
      <RuneTooltip hover={hover} />
    </div>
  );
}

function RuneTreePage({ lockedCharId }) {
  const [charId, setCharId] = useState(() => {
    if (lockedCharId) return lockedCharId;
    const id = localStorage.getItem('runeterra_identity');
    return (id && id !== 'mj' && CHARACTERS.some(c => c.id === id)) ? id : 'rathael';
  });
  const char = CHARACTERS.find(c => c.id === charId) || CHARACTERS[0];
  return (
    <div className="col" style={{ height:'100%', minHeight:0 }}>
      {!lockedCharId && (
        <div className="row" style={{ justifyContent:'flex-end', gap:8, alignItems:'center',
          padding:'8px 16px', borderBottom:'1px solid var(--line)', flex:'0 0 auto' }}>
          <span className="overline">Perso</span>
          <select value={charId} onChange={e => setCharId(e.target.value)}
            style={{ background:'var(--bg-inset)', color:'var(--ink)', border:'1px solid var(--line-strong)', borderRadius:6, padding:'7px 10px', fontSize:13 }}>
            {CHARACTERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      <div style={{ flex:'1 1 auto', minHeight:0, overflow:'auto' }}>
        <RuneBody key={char.id} char={char} staff={!lockedCharId} />
      </div>
    </div>
  );
}

Object.assign(window, { RuneTreePage });
