/* ============================================================
   PAGE — RÉCAP DE SÉANCE
   Sélecteur de séance + résumé texte + BD (livre, Task 3).
   ============================================================ */
function RecapPage() {
  const recaps = window.RECAPS || [];
  const [sel, setSel] = useState(0);
  if (!recaps.length) {
    return <div style={{ padding:40 }} className="dim">Aucun récap pour l'instant.</div>;
  }
  const i = Math.min(sel, recaps.length - 1);
  const s = recaps[i];
  return (
    <div style={{ padding:'24px', height:'100%', overflow:'auto' }}>
      <div className="row" style={{ justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:18 }}>
        <div>
          <h2 style={{ fontSize:24 }}>Récap de séance</h2>
          <span className="faint" style={{ fontSize:12 }}>{s.date}</span>
        </div>
      </div>

      {/* sélecteur de séance (la plus récente = numéro le plus haut) */}
      <div className="row gap-2 wrap" style={{ marginBottom:18 }}>
        {recaps.map((r, idx) => (
          <button key={r.id} onClick={() => setSel(idx)}
            className={'btn btn-sm' + (idx === i ? ' btn-gold' : ' btn-ghost')}>
            Séance {recaps.length - idx} · {r.titre}
          </button>
        ))}
      </div>

      {/* résumé TL;DR (masqué si absent) */}
      {s.resume ? (
        <div className="panel" style={{ marginBottom:18, padding:'16px 20px' }}>
          <div className="overline" style={{ marginBottom:6 }}>Résumé</div>
          <p style={{ margin:0, fontSize:14, color:'var(--ink)', lineHeight:1.6 }}>{s.resume}</p>
        </div>
      ) : null}

      {/* BD — version minimale : planches empilées (remplacée par <RecapBook> en Task 3) */}
      <div className="col gap-4" style={{ alignItems:'center' }}>
        {(s.pages || []).map((src, idx) => (
          <img key={idx} src={src} alt={'Page ' + (idx + 1)}
            style={{ maxWidth:'min(92vw,440px)', width:'100%', border:'1px solid var(--line-gold)', borderRadius:6 }} />
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { RecapPage });
