/* ============================================================
   PAGE — JOURNAL DE COMBAT
   Tableau chronologique + filtres + stats résumé.
   ============================================================ */
function JournalPage() {
  const [fArme, setFArme] = useState('Toutes');
  const [fType, setFType] = useState('Tous');
  const [critOnly, setCritOnly] = useState(false);

  const armes = ['Toutes', ...Array.from(new Set(JOURNAL.map(j => j.arme)))];
  const types = ['Tous', 'Physique', 'Magique'];
  const rows = JOURNAL.filter(j =>
    (fArme === 'Toutes' || j.arme === fArme) &&
    (fType === 'Tous' || j.type === fType) &&
    (!critOnly || j.crit)
  );
  const total = rows.reduce((s, r) => s + r.dmg, 0);
  const hits = rows.length;
  const moy = hits ? Math.round(total / hits) : 0;
  const critPct = hits ? Math.round((rows.filter(r => r.crit).length / hits) * 100) : 0;

  const Stat = ({ label, value, accent }) => (
    <div className="panel" style={{ padding:'16px 20px', flex:1 }}>
      <div className="overline">{label}</div>
      <div className="mono" style={{ fontSize:30, fontWeight:700, color: accent || 'var(--gold-pale)', marginTop:4 }}>{value}</div>
    </div>
  );

  return (
    <div style={{ padding:'24px', height:'100%', overflow:'auto' }}>
      <div className="row" style={{ justifyContent:'space-between', marginBottom:18, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontSize:24 }}>Journal de combat</h2>
          <span className="faint" style={{ fontSize:12 }}>Historique chronologique des frappes de la session</span>
        </div>
      </div>

      {/* stats résumé */}
      <div className="row gap-4 wrap" style={{ marginBottom:18 }}>
        <Stat label="Dégâts totaux" value={total} accent="var(--gold-bright)" />
        <Stat label="Moyenne / frappe" value={moy} />
        <Stat label="% Critiques" value={critPct + '%'} accent="var(--hp)" />
        <Stat label="Frappes" value={hits} />
      </div>

      {/* filtres */}
      <div className="panel" style={{ marginBottom:14 }}>
        <div className="row gap-4 wrap" style={{ padding:'14px 18px', alignItems:'center' }}>
          <span className="overline">Filtres</span>
          <div className="row gap-2">
            <span className="faint" style={{ fontSize:11 }}>Arme</span>
            <select value={fArme} onChange={e => setFArme(e.target.value)} style={selStyle}>{armes.map(a => <option key={a}>{a}</option>)}</select>
          </div>
          <div className="row gap-2">
            <span className="faint" style={{ fontSize:11 }}>Type</span>
            <select value={fType} onChange={e => setFType(e.target.value)} style={selStyle}>{types.map(t => <option key={t}>{t}</option>)}</select>
          </div>
          <button onClick={() => setCritOnly(v => !v)} className={'btn btn-sm' + (critOnly ? ' btn-gold' : ' btn-ghost')}>
            {critOnly ? '✓ ' : ''}Critiques seulement
          </button>
          <span className="grow"></span>
          <span className="faint mono" style={{ fontSize:11 }}>{rows.length} entrée{rows.length>1?'s':''}</span>
        </div>
      </div>

      {/* tableau */}
      <div className="panel" style={{ overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'var(--bg-inset)' }}>
              {['Heure','Arme','Type','Critique','Dégâts'].map((h, i) => (
                <th key={h} style={{ textAlign: i===4?'right':'left', padding:'11px 18px', fontFamily:'var(--font-mono)', fontSize:11, letterSpacing:'.1em', textTransform:'uppercase', color:'var(--ink-faint)', borderBottom:'1px solid var(--line)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom:'1px solid var(--line)', background: r.crit ? 'rgba(200,155,60,.05)' : 'transparent' }}>
                <td style={{ padding:'10px 18px', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--ink-faint)' }}>{r.t}</td>
                <td style={{ padding:'10px 18px', fontSize:13, color:'var(--ink)' }}>{r.arme}</td>
                <td style={{ padding:'10px 18px' }}>
                  <span style={{ fontSize:11, padding:'3px 9px', borderRadius:99, color: r.type==='Magique'?'var(--silver)':'var(--gold-bright)',
                    background: r.type==='Magique'?'rgba(139,224,255,.08)':'rgba(200,155,60,.08)', border:'1px solid ' + (r.type==='Magique'?'var(--silver-deep)':'var(--line-gold)') }}>{r.type}</span>
                </td>
                <td style={{ padding:'10px 18px' }}>
                  {r.crit ? <span className="gold mono" style={{ fontSize:12, fontWeight:700 }}>★ OUI</span> : <span className="faint mono" style={{ fontSize:12 }}>—</span>}
                </td>
                <td style={{ padding:'10px 18px', textAlign:'right', fontFamily:'var(--font-mono)', fontSize:15, fontWeight:700,
                  color: r.dmg === 0 ? 'var(--ink-faint)' : r.crit ? 'var(--gold-bright)' : 'var(--gold-pale)' }}>{r.dmg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
const selStyle = { background:'var(--bg-inset)', color:'var(--ink)', border:'1px solid var(--line-strong)', borderRadius:6, padding:'6px 10px', fontSize:13 };
window.JournalPage = JournalPage;
