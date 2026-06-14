/* ============================================================
   PAGE — DESIGN SYSTEM / HANDOFF DÉVELOPPEUR
   Palette, tokens typographiques, composants isolés.
   ============================================================ */
function Swatch({ name, varName, hex, text }) {
  return (
    <div className="col gap-2">
      <div style={{ height:64, borderRadius:8, background:`var(${varName})`, border:'1px solid var(--line)' }}></div>
      <div>
        <div style={{ fontSize:12, color:'var(--ink)', fontWeight:600 }}>{name}</div>
        <div className="mono faint" style={{ fontSize:10 }}>{varName}</div>
        <div className="mono" style={{ fontSize:10, color: text || 'var(--gold)' }}>{hex}</div>
      </div>
    </div>
  );
}
function DSBlock({ title, sub, children }) {
  return (
    <div className="panel" style={{ marginBottom:20 }}>
      <div className="panel-head"><h3>{title}</h3>{sub && <span className="overline">{sub}</span>}</div>
      <div style={{ padding:'20px' }}>{children}</div>
    </div>
  );
}

function DesignSystemPage() {
  const colors = [
    ['Fond profond','--bg-deep','#0A0A0F'], ['Panneau','--bg-panel','#12121C'], ['Surélevé','--bg-panel-2','#171723'], ['Enfoncé','--bg-inset','#0D0D15'],
    ['Or primaire','--gold','#C89B3C'], ['Or clair','--gold-bright','#E4C56B'], ['Or pâle','--gold-pale','#F0E6D3'], ['Or foncé','--gold-deep','#8A6A22'],
    ['Vie (HP)','--hp','#C8302A'], ['Mana','--mana','#2B6FB0'], ['Bouclier','--shield','#D8B24A'], ['Argent magique','--silver','#8BE0FF'],
    ['Buff','--buff','#1E7A4F'], ['Buff clair','--buff-bright','#34C77F'], ['Débuff','--debuff','#C8302A'], ['Débuff clair','--debuff-bright','#E85A52'],
  ];
  const sampleChar = CHARACTERS[0];
  return (
    <div style={{ padding:'24px', height:'100%', overflow:'auto', maxWidth:1100, margin:'0 auto' }}>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:24 }}>Système de design</h2>
        <span className="faint" style={{ fontSize:12 }}>Tokens & composants isolés — prêts pour le transfert HTML/CSS/JS vanilla</span>
      </div>

      <DSBlock title="Palette" sub="hex exacts">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:16 }}>
          {colors.map(([n, v, h]) => <Swatch key={v} name={n} varName={v} hex={h} />)}
        </div>
      </DSBlock>

      <DSBlock title="Typographie" sub="3 familles">
        <div className="col gap-4">
          <div className="row gap-4" style={{ alignItems:'baseline', borderBottom:'1px solid var(--line)', paddingBottom:14 }}>
            <span className="mono faint" style={{ fontSize:11, width:130 }}>Cinzel · display</span>
            <span style={{ fontFamily:'var(--font-display)', fontSize:34, color:'var(--gold-pale)' }}>Chroniques de Runeterra</span>
          </div>
          <div className="row gap-4" style={{ alignItems:'baseline', borderBottom:'1px solid var(--line)', paddingBottom:14 }}>
            <span className="mono faint" style={{ fontSize:11, width:130 }}>Hanken Grotesk · corps</span>
            <span style={{ fontSize:16 }}>Forgez votre légende — texte courant lisible.</span>
          </div>
          <div className="row gap-4" style={{ alignItems:'baseline' }}>
            <span className="mono faint" style={{ fontSize:11, width:130 }}>Spline Sans Mono · chiffres</span>
            <span className="mono" style={{ fontSize:20, color:'var(--gold)' }}>2645 / 350 · 1055 AD</span>
          </div>
          <div className="row gap-3 wrap" style={{ marginTop:6 }}>
            {[['Display','44px'],['H1','30px'],['H2','22px'],['H3','16px'],['Corps','14px'],['Small','13px'],['XS / Overline','11px']].map(([n, s]) => (
              <span key={n} className="mono" style={{ fontSize:11, color:'var(--ink-dim)', padding:'4px 10px', background:'var(--bg-inset)', borderRadius:6, border:'1px solid var(--line)' }}>{n} · {s}</span>
            ))}
          </div>
        </div>
      </DSBlock>

      <DSBlock title="Barres de ressource" sub="HP · Mana · Bouclier">
        <div className="col gap-3" style={{ maxWidth:420 }}>
          <ResourceBar kind="hp" cur={2434} max={2645} />
          <ResourceBar kind="mana" cur={141} max={350} />
          <ResourceBar kind="shield" cur={120} max={300} big segments={10} />
        </div>
        <div className="anno" style={{ marginTop:12 }}>flash blanc à la perte de PV · transition 0.5s</div>
      </DSBlock>

      <DSBlock title="Stat chips" sub="icône + label + valeur">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, maxWidth:600 }}>
          <StatChip k="ad" value={1055} /><StatChip k="ap" value={85} magic />
          <StatChip k="armure" value={160} /><StatChip k="resmag" value={41} magic />
          <StatChip k="crit" value="15%" /><StatChip k="dcrit" value="210%" />
        </div>
      </DSBlock>

      <DSBlock title="Buffs & débuffs" sub="toggle ON/OFF · tooltip au survol">
        <div className="row gap-2 wrap">
          {BUFFS.slice(0,5).map(b => <BuffBadge key={b.id} buff={b} on={true} onToggle={()=>{}} />)}
          {BUFFS.slice(8,12).map(b => <BuffBadge key={b.id} buff={b} on={true} onToggle={()=>{}} />)}
          <BuffBadge buff={BUFFS[0]} on={false} onToggle={()=>{}} />
        </div>
      </DSBlock>

      <DSBlock title="Inventaire & monnaie" sub="3 catégories · 4 métaux">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, maxWidth:640, marginBottom:14 }}>
          {sampleChar.inv.slice(0,4).map((it,i) => <InvItem key={i} item={it} />)}
        </div>
        <Coins coins={{ plat:1, or:12, arg:40, cuiv:80 }} />
      </DSBlock>

      <DSBlock title="Boutons" sub="variantes">
        <div className="row gap-3 wrap">
          <button className="btn btn-gold">Action principale</button>
          <button className="btn">Secondaire</button>
          <button className="btn btn-ghost">Fantôme</button>
          <button className="btn btn-hp">HP</button>
          <button className="btn btn-mana">Mana</button>
          <button className="btn btn-shield">Bouclier</button>
          <button className="btn btn-sm btn-gold">Petit</button>
        </div>
      </DSBlock>

      <DSBlock title="Rune Domination" sub="3 voies — référence">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }} className="rune-grid">
          {RUNE.paths.map(p => (
            <div key={p.name} className="panel" style={{ background:'var(--bg-inset)', padding:'14px' }}>
              <div className="row gap-2" style={{ marginBottom:10 }}>
                <span style={{ width:10, height:10, borderRadius:2, background:p.color }}></span>
                <span style={{ fontFamily:'var(--font-display)', fontSize:15, color:'var(--gold-pale)' }}>{p.name}</span>
              </div>
              <div className="col gap-2">
                {p.perks.map((pk, i) => (
                  <div key={i} style={{ paddingLeft:10, borderLeft:'2px solid '+p.color }}>
                    <div style={{ fontSize:12, color:'var(--ink)', fontWeight:600 }}>{pk.t}</div>
                    <div className="faint" style={{ fontSize:11, lineHeight:1.35 }}>{pk.d}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DSBlock>
    </div>
  );
}
window.DesignSystemPage = DesignSystemPage;
