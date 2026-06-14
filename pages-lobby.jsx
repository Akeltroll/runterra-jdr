/* ============================================================
   PAGE — LOBBY / ACCUEIL
   ============================================================ */
function LobbyPage({ go }) {
  return (
    <div className="hex-bg" style={{ minHeight:'100%', display:'grid', placeItems:'center', position:'relative', overflow:'hidden' }}>
      {/* halo doré */}
      <div style={{ position:'absolute', top:'-30%', left:'50%', transform:'translateX(-50%)', width:900, height:900,
        background:'radial-gradient(circle, rgba(200,155,60,.10), transparent 65%)', pointerEvents:'none' }}></div>
      {/* vignette bas */}
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, transparent 55%, rgba(5,5,10,.85))', pointerEvents:'none' }}></div>

      <div style={{ position:'relative', textAlign:'center', padding:'48px 24px', maxWidth:680 }}>
        {/* emblème : losange orné (formes simples) */}
        <div style={{ position:'relative', width:96, height:96, margin:'0 auto 28px' }}>
          <div style={{ position:'absolute', inset:0, transform:'rotate(45deg)', borderRadius:10,
            border:'2px solid var(--gold)', background:'linear-gradient(135deg, rgba(200,155,60,.18), transparent)',
            boxShadow:'0 0 30px var(--gold-glow)' }}></div>
          <div style={{ position:'absolute', inset:22, transform:'rotate(45deg)', borderRadius:6, border:'1px solid var(--gold-deep)' }}></div>
          <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', fontFamily:'var(--font-display)', fontSize:38, color:'var(--gold-bright)' }}>R</div>
        </div>

        <div className="overline" style={{ marginBottom:14, color:'var(--gold-deep)' }}>Jeu de Rôle · Univers fracturé</div>
        <h1 style={{ fontSize:56, letterSpacing:'.04em', lineHeight:1.05, textShadow:'0 0 40px var(--gold-glow)' }}>
          Chroniques<br/>de Runeterra
        </h1>
        <hr className="gold-rule" style={{ width:240, margin:'24px auto 28px' }} />
        <p className="dim" style={{ maxWidth:440, margin:'0 auto 40px', fontSize:15 }}>
          Forgez votre légende. Gérez vos fiches de personnage en temps réel pendant vos sessions de jeu.
        </p>

        <div className="row gap-4" style={{ justifyContent:'center', flexWrap:'wrap' }}>
          <button className="btn btn-gold btn-lg" style={{ minWidth:220, justifyContent:'center' }} onClick={() => go('sheet')}>
            ⚔ Rejoindre une session
          </button>
          <button className="btn btn-lg" style={{ minWidth:220, justifyContent:'center' }} onClick={() => go('mj')}>
            ✦ Créer une session
          </button>
        </div>

        <div className="row gap-2" style={{ justifyContent:'center', marginTop:32 }}>
          <span className="overline">Code de session</span>
          <span className="mono" style={{ letterSpacing:'.3em', color:'var(--gold-pale)', fontSize:18, padding:'4px 14px', border:'1px solid var(--line-gold)', borderRadius:6, background:'var(--bg-inset)' }}>VX-7K2</span>
        </div>
      </div>
    </div>
  );
}
window.LobbyPage = LobbyPage;
