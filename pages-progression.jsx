/* ============================================================
   PAGE — PROGRESSION / NIVEAU
   Table niveaux 1→18 + attributs principaux + sous-stats.
   ============================================================ */
function ProgressionPage() {
  const [charId, setCharId] = useState('rathael');
  const char = CHARACTERS.find(c => c.id === charId);
  const a = char.attrs;
  const totalUsed = a.force + a.hab + a.mental + a.magie;
  const lvlRow = LEVELS.find(l => l.lvl === char.level) || LEVELS[LEVELS.length - 1];

  return (
    <div style={{ padding:'24px', height:'100%', overflow:'auto' }}>
      <div className="row" style={{ justifyContent:'space-between', marginBottom:18, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontSize:24 }}>Progression</h2>
          <span className="faint" style={{ fontSize:12 }}>Attributs, points et seuils par niveau</span>
        </div>
        <div className="row gap-2">
          <span className="overline">Perso</span>
          <select value={charId} onChange={e => setCharId(e.target.value)} style={selStyle}>
            {CHARACTERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:20, alignItems:'start' }} className="prog-grid">
        {/* attributs principaux */}
        <div className="col gap-5">
          <div className="panel">
            <div className="panel-head"><h3>Attributs principaux</h3>
              <span className="mono faint" style={{ fontSize:11 }}>{totalUsed} / {lvlRow.total} pts · limite {lvlRow.limit}</span>
            </div>
            <div className="col gap-4" style={{ padding:'18px' }}>
              {ATTRIBUTES.map(attr => {
                const val = a[attr.key];
                const pct = Math.min(100, (val / 18) * 100);
                return (
                  <div key={attr.key}>
                    <div className="row" style={{ justifyContent:'space-between', marginBottom:6 }}>
                      <span className="row gap-2">
                        <span style={{ width:10, height:10, borderRadius:2, background: attr.color }}></span>
                        <span style={{ fontFamily:'var(--font-display)', fontSize:15, color:'var(--gold-pale)' }}>{attr.name}</span>
                      </span>
                      <span className="mono" style={{ fontSize:16, fontWeight:700, color:'var(--gold-pale)' }}>{val}</span>
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
          </div>

          {/* stats résultantes */}
          <div className="panel">
            <div className="panel-head"><h3>Stats résultantes</h3><span className="overline">calculées</span></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, padding:'16px' }}>
              {[['hp',char.stats.hp],['mana',char.stats.mana],['ad',char.stats.ad],['ap',char.stats.ap],['armure',char.stats.armure],['resmag',char.stats.resmag],['crit',char.stats.crit+'%'],['dcrit',char.stats.dcrit+'%'],['sapience',char.stats.sapience]].map(([k,v]) => (
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
                  const here = l.lvl === char.level;
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
