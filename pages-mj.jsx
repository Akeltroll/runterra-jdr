/* ============================================================
   PAGE — VUE MJ (TABLEAU DE BORD)   [page clé]
   Sidebar joueurs + grille de fiches compactes, temps réel.
   ============================================================ */

/* Fusionne la définition du perso (règles) avec son état live (Firebase). */
function mjLive(c, st) {
  const buffs = st ? Object.keys(st.buffs || {}) : (c.buffs || []);
  const itemMods = st ? sumItemMods(st.equipment, st.inventory) : {};
  const eff = computeEffective(c.stats, st ? st.modifiers : c.modifiers, buffs, itemMods);
  const hp = st ? st.hpCur : Math.round(c.hpCur * c.stats.hp);
  const mana = st ? st.manaCur : Math.round(c.manaCur * c.stats.mana);
  const shield = st ? st.shield : c.shieldCur;
  const maxHp = eff.hp, maxMana = eff.mana;
  return {
    buffs, eff, hp, mana, shield, maxHp, maxMana,
    hpPct: maxHp > 0 ? (hp / maxHp) * 100 : 0,
    fatigue: st ? st.fatigue : c.fatigue,
    eau: st ? st.eau : c.eau,
  };
}

function MJSidebarRow({ c, st, active, onClick }) {
  const L = mjLive(c, st);
  const danger = L.hpPct < 40;
  return (
    <button onClick={onClick}
      style={{ display:'flex', gap:12, alignItems:'center', width:'100%', textAlign:'left',
        padding:'10px 12px', borderRadius:8, border:'1px solid ' + (active ? 'var(--line-gold)' : 'transparent'),
        background: active ? 'var(--bg-panel-2)' : 'transparent' }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
      <Avatar char={c} size={38} radius={8} />
      <div style={{ flex:1, minWidth:0 }}>
        <div className="row" style={{ justifyContent:'space-between' }}>
          <span style={{ fontWeight:600, fontSize:13, color:'var(--ink)' }}>{c.name}</span>
          <span className="mono" style={{ fontSize:11, color: danger ? 'var(--debuff-bright)' : 'var(--ink-faint)' }}>Nv.{c.level}</span>
        </div>
        <div style={{ marginTop:5, height:6, borderRadius:99, background:'var(--bg-inset)', overflow:'hidden' }}>
          <div style={{ height:'100%', width:L.hpPct+'%', borderRadius:99,
            background: 'linear-gradient(90deg,#E0463F,var(--hp))' }}></div>
        </div>
        <div className="row gap-2" style={{ marginTop:4 }}>
          <span className="mono" style={{ fontSize:10, color:'var(--ink-faint)' }}>{L.hp}/{L.maxHp} HP</span>
          {L.buffs.slice(0,3).map(id => {
            const b = BUFFS.find(x => x.id === id);
            if (!b) return null;
            return <span key={id} style={{ width:7, height:7, borderRadius:'50%', background: b.type==='buff'?'var(--buff-bright)':'var(--debuff-bright)' }}></span>;
          })}
        </div>
      </div>
    </button>
  );
}

function MJCompactCard({ c, st, onFull }) {
  const L = mjLive(c, st);
  const danger = L.hpPct < 40;
  const stats = [['ad', L.eff.ad], ['ap', L.eff.ap], ['armure', L.eff.armure], ['resmag', L.eff.resmag]];
  // Inventaire live (objet Firebase → tableau, items à qty>0) ; fallback sur l'inv. par défaut tant qu'aucun état.
  const inv = (st && st.inventory)
    ? Object.values(st.inventory).filter(it => (it.qty || 0) > 0)
    : (c.inv || []);
  return (
    <div className="panel" style={{ width:300, flex:'none', display:'flex', flexDirection:'column',
      borderColor: danger ? 'rgba(200,48,42,.45)' : 'var(--line)' }}>
      {/* en-tête */}
      <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--line)', display:'flex', gap:11, alignItems:'center' }}>
        <Avatar char={c} size={42} radius={8} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:16, color:'var(--gold-pale)' }}>{c.name}</div>
          <div className="faint" style={{ fontSize:11 }}>{c.cls} · Nv.{c.level}</div>
        </div>
        <button className="btn btn-sm btn-ghost tip" onClick={onFull} title="Plein écran" style={{ padding:'6px 8px' }}>⛶</button>
      </div>
      {/* barres */}
      <div className="col gap-2" style={{ padding:'14px 16px' }}>
        <ResourceBar kind="hp" cur={L.hp} max={L.maxHp} />
        <ResourceBar kind="mana" cur={L.mana} max={L.maxMana} />
        {L.shield > 0 && <ResourceBar kind="shield" cur={L.shield} max={c.shieldMax} />}
      </div>
      {/* survie */}
      <div className="row gap-2" style={{ padding:'0 16px 12px' }}>
        <span className="mono faint" style={{ fontSize:11 }}>🜂 Fatigue {L.fatigue}/5</span>
        <span className="mono faint" style={{ fontSize:11 }}>💧 Eau {L.eau}/5</span>
      </div>
      {/* stats clés */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, padding:'0 16px 14px' }}>
        {stats.map(([k, v]) => (
          <div key={k} className="row gap-2" style={{ justifyContent:'space-between', padding:'7px 10px', background:'var(--bg-inset)', borderRadius:6, border:'1px solid var(--line)' }}>
            <span className="mono faint" style={{ fontSize:10 }}>{STAT_GLYPH[k]}</span>
            <span className="mono" style={{ fontSize:14, fontWeight:600, color: (k==='ap'||k==='resmag') ? 'var(--silver)' : 'var(--gold-pale)' }}>{v}</span>
          </div>
        ))}
      </div>
      {/* buffs */}
      <div style={{ padding:'0 16px 12px', borderBottom:'1px solid var(--line)' }}>
        <div className="overline" style={{ marginBottom:6 }}>États actifs</div>
        <div className="row gap-2 wrap">
          {L.buffs.length ? L.buffs.map(id => {
            const b = BUFFS.find(x => x.id === id);
            return b ? <BuffBadge key={id} buff={b} on={true} compact /> : null;
          }) : <span className="faint" style={{ fontSize:11 }}>Aucun</span>}
        </div>
      </div>
      {/* inventaire miniature — live (st.inventory) avec images, fallback sur l'inv. par défaut */}
      <div style={{ padding:'12px 16px' }}>
        <div className="overline" style={{ marginBottom:6 }}>Sac · {inv.length} objets</div>
        <div className="row gap-2 wrap">
          {inv.slice(0,5).map((it, i) => (
            <div key={it.id || i} className="tip">
              <div style={{ width:30, height:30, borderRadius:6, display:'grid', placeItems:'center', fontSize:14,
                background:'var(--bg-inset)', border:'1px solid var(--line)', overflow:'hidden' }}>
                {it.img ? <img src={it.img} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : (it.ic || '◆')}
              </div>
              <div className="tip-body"><b className="gold">{it.name}</b> ×{it.qty}<br/>{it.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MJPage({ go }) {
  const all = useAllCharStates();
  const [selected, setSelected] = useState('rathael');
  const [full, setFull] = useState(null);
  const stOf = (id) => (all && all[id] && all[id].state) || null;
  return (
    <div style={{ display:'grid', gridTemplateColumns:'264px 1fr', height:'100%', minHeight:0 }}>
      {/* SIDEBAR */}
      <aside style={{ borderRight:'1px solid var(--line)', background:'var(--bg-panel)', display:'flex', flexDirection:'column', minHeight:0 }}>
        <div style={{ padding:'16px 16px 12px' }}>
          <div className="overline">Maître du jeu</div>
          <div className="row" style={{ justifyContent:'space-between', marginTop:4 }}>
            <h3 style={{ fontSize:17 }}>La Table</h3>
            <span className="mono faint" style={{ fontSize:11 }}>{CHARACTERS.length} joueurs</span>
          </div>
        </div>
        <hr className="gold-rule" />
        <div className="col gap-1" style={{ padding:10, overflowY:'auto', flex:1 }}>
          {CHARACTERS.map(c => (
            <MJSidebarRow key={c.id} c={c} st={stOf(c.id)} active={selected === c.id} onClick={() => setSelected(c.id)} />
          ))}
        </div>
        <div style={{ padding:12, borderTop:'1px solid var(--line)' }}>
          <button className="btn btn-ghost btn-sm" style={{ width:'100%', justifyContent:'center' }} onClick={() => go('journal')}>Journal de la session →</button>
        </div>
      </aside>

      {/* ZONE PRINCIPALE */}
      <main style={{ display:'flex', flexDirection:'column', minHeight:0, minWidth:0 }}>
        <div className="row" style={{ justifyContent:'space-between', padding:'16px 24px', borderBottom:'1px solid var(--line)' }}>
          <div>
            <h2 style={{ fontSize:21 }}>Tableau de bord</h2>
            <span className="faint" style={{ fontSize:12 }}>Vue d'ensemble temps réel — faites défiler horizontalement</span>
          </div>
          <div className="row gap-2">
            <ExportImportPanel />
          </div>
        </div>
        <div style={{ flex:1, overflow:'auto', padding:24 }}>
          <div className="row gap-4" style={{ alignItems:'stretch', minWidth:'min-content', paddingBottom:8 }}>
            {CHARACTERS.map(c => <MJCompactCard key={c.id} c={c} st={stOf(c.id)} onFull={() => setFull(c)} />)}
          </div>
        </div>
      </main>

      {full && <FullScreenSheet char={full} onClose={() => setFull(null)} />}
    </div>
  );
}

/* Aperçu plein écran depuis la vue MJ → réutilise la fiche joueur */
function FullScreenSheet({ char, onClose }) {
  return (
    <div className="modal-scrim" style={{ alignItems:'stretch', padding:24 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width:'min(1180px,100%)', margin:'auto', maxHeight:'100%', overflow:'auto',
        background:'var(--bg-deep)', border:'1px solid var(--line-gold)', borderRadius:12, boxShadow:'var(--shadow-modal)' }}>
        <div className="row" style={{ justifyContent:'space-between', padding:'14px 20px', borderBottom:'1px solid var(--line)', position:'sticky', top:0, background:'var(--bg-deep)', zIndex:5 }}>
          <h3>Fiche complète — {char.name}</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>Fermer ✕</button>
        </div>
        <SheetBody char={char} variant="a" />
      </div>
    </div>
  );
}

Object.assign(window, { MJPage });
