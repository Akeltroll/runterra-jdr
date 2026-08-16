/* ============================================================
   PAGE — ARBRE DE RUNES (constellation radiale)
   5 familles rayonnant d'un cœur central, sélection stricte
   (points = niveau), persistée temps réel (state/runes). Bonus
   plats -> stats ; conditionnel -> rappels. Contenu figé : RUNES.
   Refonte PUREMENT graphique : logique/données inchangées.
   ============================================================ */
const RUNE_INDEX = buildRuneIndex(RUNES);
const RUNE_LAYOUT = runeRadialLayout(RUNES);
const RUNE_TIER_LABEL = { mineure:'Mineure', avancee:'Avancée', fondamentale:'Fondamentale' };
/* id du nœud fondamental -> capstone (bonus thématique) de sa voie. */
const RUNE_CAPSTONE = {};
RUNES.forEach(f => f.paths.forEach(p => { const last = p.nodes[p.nodes.length - 1]; if (last) RUNE_CAPSTONE[last.id] = p.capstone; }));

/* Points SVG d'un nœud selon son palier (losange / carré (rect) / hexagone). */
function runeHexPoints(x, y, R) {
  const pts = [];
  for (let k = 0; k < 6; k++) { const a = (Math.PI / 3) * k; pts.push((x + R * Math.cos(a)).toFixed(1) + ',' + (y + R * Math.sin(a)).toFixed(1)); }
  return pts.join(' ');
}

/* Un nœud, dessiné en SVG. Forme selon le palier ; si node.img est défini (à terme),
   une image est posée à la place de la forme (hook prêt pour tes assets). */
function RuneNodeShape({ nd, state, color, capstone, onClick, onHover }) {
  const node = RUNE_INDEX[nd.id];
  const handlers = {
    className: 'rune-glyph ' + state,
    onClick: () => onClick(node),
    onMouseEnter: (e) => onHover({ kind:'node', node, capstone, fam: color }, e),
    onMouseLeave: () => onHover(null),
  };
  if (node.img) {
    const s = nd.tier === 'fondamentale' ? 78 : nd.tier === 'avancee' ? 62 : 54;
    return <image href={node.img} x={nd.x - s / 2} y={nd.y - s / 2} width={s} height={s} {...handlers} />;
  }
  if (nd.tier === 'mineure') {                       // losange
    const h = 25;
    return <polygon points={`${nd.x},${nd.y - h} ${nd.x + h},${nd.y} ${nd.x},${nd.y + h} ${nd.x - h},${nd.y}`} {...handlers} />;
  }
  if (nd.tier === 'avancee') {                        // carré
    const s = 24;
    return <rect x={nd.x - s} y={nd.y - s} width={s * 2} height={s * 2} rx="6" {...handlers} />;
  }
  return <polygon points={runeHexPoints(nd.x, nd.y, 38)} {...handlers} />;   // hexagone
}

/* Cœur d'une famille (emblème central). Survol -> tooltip de famille (condition de thématique). */
function RuneCore({ fam, onHover }) {
  return (
    <g className="rune-core"
      onMouseEnter={(e) => onHover({ kind:'family', name: fam.name, theme: fam.theme, fam: fam.color }, e)}
      onMouseLeave={() => onHover(null)}>
      <circle cx={fam.core.x} cy={fam.core.y} r="30" className="rune-core-disc" />
      <text x={fam.core.x} y={fam.core.y} className="rune-core-txt" textAnchor="middle" dominantBaseline="central">{fam.name[0]}</text>
    </g>
  );
}

/* Constellation : un grand SVG (anneau + faisceaux + cœurs + nœuds) + un calque HTML pour les
   toggles AD/AP des nœuds adp sélectionnés (positionnés en % pour suivre la mise à l'échelle). */
function RuneConstellation({ layout, nodeState, choices, onClick, onChoice, onHover }) {
  const S = layout.size;
  return (
    <div className="rune-constellation">
      <svg viewBox={`0 0 ${S} ${S}`} className="rune-sky" preserveAspectRatio="xMidYMid meet">
        <circle cx={layout.center} cy={layout.center} r={layout.ring} className="rune-ring" />
        {layout.families.map(fam => (
          <g key={'beam-' + fam.key} style={{ '--fam': fam.color }}>
            {fam.segments.map((s, i) => (
              <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                className={'rune-beam' + (nodeState(s.outerId) === 'selected' ? ' lit' : '')} />
            ))}
          </g>
        ))}
        {layout.families.map(fam => (
          <g key={'fam-' + fam.key} style={{ '--fam': fam.color }}>
            <RuneCore fam={fam} onHover={onHover} />
            {fam.nodes.map(nd => (
              <RuneNodeShape key={nd.id} nd={nd} state={nodeState(nd.id)} color={fam.color}
                capstone={RUNE_CAPSTONE[nd.id] || null} onClick={onClick} onHover={onHover} />
            ))}
          </g>
        ))}
      </svg>
      <div className="rune-adp-layer">
        {layout.families.map(fam => fam.nodes.map(nd => {
          const node = RUNE_INDEX[nd.id];
          if (!(node.mods && node.mods.adp != null) || nodeState(nd.id) !== 'selected') return null;
          return (
            <div key={nd.id} className="rune-adp" style={{ '--fam': fam.color, left: (nd.x / S * 100) + '%', top: ((nd.y + 40) / S * 100) + '%' }}
              onClick={(e) => e.stopPropagation()}>
              {['ad', 'ap'].map(k => (
                <button key={k} className={(choices[nd.id] || 'ad') === k ? 'on' : ''}
                  onClick={() => onChoice(nd.id, k)}>{k.toUpperCase()}</button>
              ))}
            </div>
          );
        }))}
      </div>
    </div>
  );
}

/* Popover de détail (survol d'un nœud ou d'un cœur de famille). */
function RuneTooltip({ hover }) {
  if (!hover) return null;
  const style = { '--fam': hover.fam,
    left: Math.min(hover.x + 14, window.innerWidth - 272),
    top: Math.min(hover.y + 12, window.innerHeight - 180) };
  if (hover.kind === 'family') {
    return (
      <div className="rune-tooltip" style={style}>
        <div className="rt-name">{hover.name}</div>
        <div className="rt-desc">Condition de thématique : {hover.theme}</div>
      </div>
    );
  }
  const node = hover.node;
  return (
    <div className="rune-tooltip" style={style}>
      <div className="rt-tier">{RUNE_TIER_LABEL[node.tier] || node.tier}</div>
      <div className="rt-name">{node.name}</div>
      <div className="rt-desc">{node.desc}</div>
      {node.note ? <div className="rt-note">⚠ {node.note}</div> : null}
      {hover.capstone ? <div className="rt-cap"><span>Bonus thématique</span>{hover.capstone}</div> : null}
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
  const onHover = (payload, e) => {
    if (!payload) { setHover(null); return; }
    setHover({ ...payload, x: e.clientX, y: e.clientY });
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
          <span className="faint" style={{ fontSize:12 }}>Survolez une rune pour voir son effet</span>
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
      <RuneConstellation layout={RUNE_LAYOUT} nodeState={nodeState} choices={choices}
        onClick={onClick} onChoice={setRuneChoice} onHover={onHover} />
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
