/* ============================================================
   PAGE — PROGRESSION / NIVEAU
   Table niveaux 1→18 + répartition des caractéristiques (respec) + sous-stats.
   Joueur : respec UNIQUE (puis verrouillé) sur son perso. Staff : édition libre
   de n'importe quel perso + (dé)verrouillage. lockedCharId fourni => vue joueur.
   ============================================================ */
function ProgressionPage({ lockedCharId }) {
  const toast = useToast();
  const staff = !lockedCharId;
  const [charId, setCharId] = useState(lockedCharId || 'rathael');
  const char = CHARACTERS.find(c => c.id === charId);
  const { state, setAttrs, setAttrsLocked } = useCharState(charId);

  const effLevel = (state && state.level != null ? state.level : char.level) || 1;
  const lvlRow = LEVELS.find(l => l.lvl === effLevel) || LEVELS[LEVELS.length - 1];
  const budget = lvlRow.total + CREATION_BONUS;       // points répartissables (niveau + bonus de création)
  const cap = lvlRow.limit;                            // plafond par caractéristique
  const savedAttrs = (state && state.attrs) || char.attrs;
  const locked = !!(state && state.attrsLocked);
  const canEdit = staff || !locked;

  // Brouillon local : on édite sans écrire, puis « Confirmer ». Resync sur changement
  // de perso ou de valeurs sauvegardées (après confirmation ou édition externe).
  const [draft, setDraft] = useState(savedAttrs);
  useEffect(() => { setDraft(savedAttrs); },
    [charId, savedAttrs.force, savedAttrs.hab, savedAttrs.mental, savedAttrs.magie]);

  const view = canEdit ? draft : savedAttrs;          // valeurs affichées (brouillon si éditable)
  const sum = attrSum(view);
  const remaining = budget - sum;
  const valid = respecValid(view, budget, cap);
  const dirty = view.force !== savedAttrs.force || view.hab !== savedAttrs.hab
    || view.mental !== savedAttrs.mental || view.magie !== savedAttrs.magie;
  const preview = computeStats(view.force, view.hab, view.mental, view.magie, effLevel);

  const selStyle = { background:'var(--bg-inset)', color:'var(--ink)', border:'1px solid var(--line-strong)', borderRadius:6, padding:'6px 9px', fontSize:13 };

  const bump = (key, delta) => {
    if (!canEdit) return;
    setDraft(d => {
      const next = Math.max(0, Math.min(cap, (d[key] | 0) + delta));
      if (delta > 0 && (budget - attrSum(d)) <= 0) return d; // plus de points dispo
      return Object.assign({}, d, { [key]: next });
    });
  };

  const confirm = () => {
    if (!valid) return;
    if (!staff && !window.confirm('Confirmer cette répartition ? La respec est définitive (le MJ pourra la rouvrir).')) return;
    setAttrs(draft, staff ? locked : true);            // joueur => verrouille ; staff => garde l'état du verrou
    toast(`<b>${char.name}</b> — caractéristiques enregistrées`, 'buff');
  };

  return (
    <div style={{ padding:'24px', height:'100%', overflow:'auto' }}>
      <div className="row" style={{ justifyContent:'space-between', marginBottom:18, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontSize:24 }}>Progression</h2>
          <span className="faint" style={{ fontSize:12 }}>Caractéristiques, points et seuils par niveau</span>
        </div>
        {staff && (
          <div className="row gap-2" style={{ alignItems:'center' }}>
            <label className="row gap-1" style={{ alignItems:'center', fontSize:12.5 }}>
              <input type="checkbox" checked={locked} onChange={e => setAttrsLocked(e.target.checked)} /> Verrouillé
            </label>
            <span className="overline">Perso</span>
            <select value={charId} onChange={e => setCharId(e.target.value)} style={selStyle}>
              {CHARACTERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="panel" style={{ padding:'10px 16px', marginBottom:18 }}>
        <XpBar level={effLevel} xp={(state && state.xp) || 0} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:20, alignItems:'start' }} className="prog-grid">
        {/* caractéristiques (respec) */}
        <div className="col gap-5">
          <div className="panel">
            <div className="panel-head"><h3>Caractéristiques</h3>
              <span className="mono faint" style={{ fontSize:11 }}>
                {sum} / {budget} pts
                <span style={{ color: remaining === 0 ? 'var(--buff)' : (remaining < 0 ? 'var(--debuff-bright)' : 'var(--gold-bright)'), fontWeight:700 }}> · {remaining} restant{Math.abs(remaining) > 1 ? 's' : ''}</span>
                {` · limite ${cap}`}
              </span>
            </div>

            {!canEdit && (
              <div className="faint" style={{ fontSize:12.5, padding:'10px 18px 0', lineHeight:1.5 }}>
                🔒 Respec déjà effectuée — demande au MJ pour la rouvrir.
              </div>
            )}

            <div className="col gap-4" style={{ padding:'18px' }}>
              {ATTRIBUTES.map(attr => {
                const val = view[attr.key] | 0;
                const pct = Math.min(100, (val / cap) * 100);
                const canInc = canEdit && val < cap && remaining > 0;
                const canDec = canEdit && val > 0;
                return (
                  <div key={attr.key}>
                    <div className="row" style={{ justifyContent:'space-between', marginBottom:6, alignItems:'center' }}>
                      <span className="row gap-2" style={{ alignItems:'center' }}>
                        <span style={{ width:10, height:10, borderRadius:2, background: attr.color }}></span>
                        <span style={{ fontFamily:'var(--font-display)', fontSize:15, color:'var(--gold-pale)' }}>{attr.name}</span>
                      </span>
                      {canEdit ? (
                        <span className="row gap-2" style={{ alignItems:'center' }}>
                          <button className="btn btn-sm btn-ghost" onClick={() => bump(attr.key, -1)} disabled={!canDec} style={{ padding:'2px 9px' }}>−</button>
                          <span className="mono" style={{ fontSize:16, fontWeight:700, color:'var(--gold-pale)', minWidth:26, textAlign:'center' }}>{val}</span>
                          <button className="btn btn-sm btn-ghost" onClick={() => bump(attr.key, +1)} disabled={!canInc} style={{ padding:'2px 9px' }}>+</button>
                        </span>
                      ) : (
                        <span className="mono" style={{ fontSize:16, fontWeight:700, color:'var(--gold-pale)' }}>{val}</span>
                      )}
                    </div>
                    <div style={{ height:10, borderRadius:99, background:'var(--bg-inset)', overflow:'hidden', border:'1px solid var(--line)' }}>
                      <div style={{ height:'100%', width:pct+'%', background: attr.color, borderRadius:99 }}></div>
                    </div>
                    <div className="row gap-2 wrap" style={{ marginTop:8 }}>
                      {attr.sub.map((s, i) => (
                        <span key={i} className="mono" style={{ fontSize:10, color:'var(--ink-dim)', padding:'3px 8px', background:'var(--bg-inset)', borderRadius:99, border:'1px solid var(--line)' }}>{s}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {canEdit && (
              <div className="row" style={{ justifyContent:'flex-end', gap:10, padding:'0 18px 16px', alignItems:'center' }}>
                <button className="btn btn-sm btn-ghost" onClick={() => setDraft(savedAttrs)} disabled={!dirty}>Réinitialiser</button>
                <button className="btn btn-gold" onClick={confirm} disabled={!valid || !dirty}
                  title={!valid ? `Répartis exactement ${budget} points` : ''}>Confirmer</button>
              </div>
            )}
          </div>

          {/* stats résultantes (aperçu live du brouillon) */}
          <div className="panel">
            <div className="panel-head"><h3>Stats résultantes</h3><span className="overline">{canEdit && dirty ? 'aperçu' : 'calculées'}</span></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, padding:'16px' }}>
              {[['hp',preview.hp],['mana',preview.mana],['ad',preview.ad],['ap',preview.ap],['armure',preview.armure],['resmag',preview.resmag],['crit',preview.crit+'%'],['dcrit',preview.dcrit+'%']].map(([k,v]) => (
                <div key={k} className="col" style={{ alignItems:'center', padding:'12px 6px', background:'var(--bg-inset)', borderRadius:8, border:'1px solid var(--line)' }}>
                  <span className="mono" style={{ fontSize:19, fontWeight:700, color:(k==='ap'||k==='resmag')?'var(--silver)':'var(--gold-pale)' }}>{v}</span>
                  <span className="overline" style={{ fontSize:9, marginTop:3 }}>{STAT_GLYPH[k]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* table de niveaux */}
        <div className="panel" style={{ overflow:'hidden' }}>
          <div className="panel-head"><h3>Paliers 1 → 18</h3></div>
          <div style={{ maxHeight:560, overflow:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'var(--bg-inset)', position:'sticky', top:0 }}>
                  {['Niv.','Gain','Total','Limite'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'.1em', textTransform:'uppercase', color:'var(--ink-faint)', borderBottom:'1px solid var(--line)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LEVELS.map(l => {
                  const here = l.lvl === effLevel;
                  return (
                    <tr key={l.lvl} style={{ borderBottom:'1px solid var(--line)', background: here ? 'rgba(200,155,60,.08)' : 'transparent' }}>
                      <td style={{ padding:'9px 14px', fontFamily:'var(--font-mono)', fontSize:13, fontWeight: here?700:400, color: here?'var(--gold-bright)':'var(--ink)' }}>{l.lvl}{here && ' ◄'}</td>
                      <td style={{ padding:'9px 14px', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--buff-bright)' }}>{l.gain}</td>
                      <td style={{ padding:'9px 14px', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--ink-dim)' }}>{l.total}</td>
                      <td style={{ padding:'9px 14px', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--gold-pale)' }}>{l.limit}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
window.ProgressionPage = ProgressionPage;
