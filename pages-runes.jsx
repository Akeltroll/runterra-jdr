/* ============================================================
   PAGE — ARBRE DE RUNES
   5 familles, sélection stricte (points = niveau), persistée
   temps réel (state/runes). Bonus plats -> stats ; conditionnel
   -> rappels. Contenu figé : RUNES (data.jsx).
   ============================================================ */
const RUNE_INDEX = buildRuneIndex(RUNES);

function RuneNode({ node, state, choice, onClick, onChoice }) {
  const isAdp = node.mods && node.mods.adp != null;
  return (
    <div className={'rune-node ' + state} title={node.desc}
      onClick={() => onClick(node)}>
      <div className="ntier">{node.tier}</div>
      <div className="nname">{node.name}</div>
      <div className="ndesc">{node.desc}</div>
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

function RuneFamilyPanel({ family, nodeState, choices, onClick, onChoice }) {
  return (
    <div className="rune-family" style={{ '--fam': family.color }}>
      <h3 style={{ color: family.color }}>{family.name}</h3>
      <div className="theme">Thématique : {family.theme}</div>
      <div className="rune-paths">
        {family.paths.map(p => (
          <div className="rune-path" key={p.key}>
            <div className="pname">{p.name}</div>
            {p.nodes.map(n => (
              <RuneNode key={n.id} node={n} state={nodeState(n.id)}
                choice={choices[n.id]} onClick={onClick} onChoice={onChoice} />
            ))}
          </div>
        ))}
      </div>
      <div className="rune-capstone">{family.capstone}</div>
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

function RuneBody({ char }) {
  const { state, setRuneSelected, setRuneChoice, resetRunes } = useCharState(char.id);
  const toast = useToast();
  if (!state) return <div style={{ padding:40 }} className="dim">Chargement…</div>;
  const runes = state.runes || {};
  const selectedSet = runes.selected || {};
  const choices = runes.choices || {};
  const selectedIds = Object.keys(selectedSet).filter(id => selectedSet[id]);
  const budget = runeBudget(char.level);
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
          <span className="rune-points">Points : {spent}/{budget}</span>
          <button className="btn btn-sm btn-ghost" disabled={!selectedIds.length}
            onClick={() => { if (selectedIds.length) resetRunes(); }}>Réinitialiser</button>
        </div>
      </div>
      <div className="rune-grid">
        {RUNES.map(f => (
          <RuneFamilyPanel key={f.key} family={f} nodeState={nodeState}
            choices={choices} onClick={onClick} onChoice={setRuneChoice} />
        ))}
      </div>
      <RuneReminders selectedIds={selectedIds} />
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
        <RuneBody key={char.id} char={char} />
      </div>
    </div>
  );
}

Object.assign(window, { RuneTreePage });
