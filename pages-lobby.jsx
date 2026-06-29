/* ============================================================
   PAGE — HUB D'ACCUEIL (carrousel 3D persos + accès + mémorial)
   ============================================================ */

/* Carrousel coverflow 3D des personnages. Barres sans chiffres ; remplissage selon accès. */
function CharCarousel({ chars, statesById, accessibleIds, staff }) {
  const [active, setActive] = useState(0);
  const tf = carouselTransforms(chars.length, active);
  const acc = new Set(accessibleIds || []);
  const rotate = (dir) => setActive(a => (a + dir + chars.length) % chars.length);
  const activeChar = chars[active];
  return (
    <div>
      <div className="carousel-stage">
        {chars.map((c, i) => {
          const t = tf[i];
          const st = statesById[c.id];
          const ok = acc.has(c.id) && st;
          const max = ok ? charBaseStats(c, st) : null;
          return (
            <div key={c.id} className={'carousel-card' + (i === active ? ' is-active' : '')}
              onClick={() => i !== active && t.opacity > 0 && setActive(i)}
              style={{ transform:`translate(-50%,-50%) rotateY(${t.rotateY}deg) translateZ(${t.translateZ}px) scale(${t.scale})`,
                opacity:t.opacity, zIndex:t.zIndex, pointerEvents: t.opacity > 0 ? 'auto' : 'none' }}>
              <div className="carousel-portrait" style={{ backgroundImage:`url(${PORTRAITS[c.id]})` }} />
              <div style={{ padding:'10px 12px', flex:1 }}>
                <div style={{ fontFamily:'var(--font-display)', fontSize:17, color:'var(--gold-pale)' }}>{c.name}</div>
                <div className="faint" style={{ fontSize:11, marginBottom:8 }}>{c.cls} · Niv {(st && st.level) || c.level}</div>
                <div className="col gap-1">
                  <ResourceBar kind="hp"     cur={ok ? (st.hpCur || 0) : 0}  max={ok ? max.hp : 0}            hideText />
                  <ResourceBar kind="mana"   cur={ok ? (st.manaCur || 0) : 0} max={ok ? max.mana : 0}          hideText />
                  <ResourceBar kind="shield" cur={ok ? (st.shield || 0) : 0}  max={ok ? (c.shieldMax || 0) : 0} hideText />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="carousel-nav">
        <button onClick={() => rotate(-1)} aria-label="Précédent">◄</button>
        <button onClick={() => rotate(1)} aria-label="Suivant">►</button>
      </div>
      <div className="carousel-bio">
        <span className="faint" style={{ fontStyle:'italic' }}>« {activeChar.title} »</span>
        {activeChar.bio ? <div style={{ marginTop:4 }}>{activeChar.bio}</div> : null}
      </div>
    </div>
  );
}

/* Mémorial des personnages morts (tombstones). */
function MemorialSection() {
  if (!MEMORIAL || !MEMORIAL.length) return null;
  return (
    <div style={{ marginTop:40, textAlign:'center' }}>
      <div className="overline" style={{ marginBottom:14, color:'var(--gold-deep)' }}>🪦 Aux disparus</div>
      <div className="row gap-4" style={{ justifyContent:'center', flexWrap:'wrap' }}>
        {MEMORIAL.map((m, i) => (
          <div key={i} className="tomb">
            <img src={m.img} alt={m.name} />
            <div style={{ fontFamily:'var(--font-display)', fontSize:16, color:'var(--gold-pale)', marginTop:8 }}>{m.name}</div>
            <div className="faint" style={{ fontSize:11 }}>Joueur {m.player} · {m.fell}</div>
            <div className="epitaph">{m.epitaph}</div>
            {m.tale ? <details style={{ marginTop:8, textAlign:'left' }}>
              <summary style={{ cursor:'pointer', fontSize:11, color:'var(--gold-deep)' }}>Le récit</summary>
              <div className="faint" style={{ fontSize:11, marginTop:6 }}>{m.tale}</div>
            </details> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/* Hub d'accueil — atterrissage pour tous. */
function HubPage({ go }) {
  const auth = useAuthIdentity();
  const staff = isStaff(auth.role);
  const myId = auth.charId;
  const all = useAllCharStates();           // staff : peuplé ; joueur : null (lecture refusée, non fatale)
  const own = useCharState(myId || CHARACTERS[0].id);
  const { turn } = useSharedTurn();
  const { enemies } = useMJEnemies();

  const statesById = {};
  let accessibleIds = [];
  if (staff && all) {
    CHARACTERS.forEach(c => { if (all[c.id] && all[c.id].state) statesById[c.id] = all[c.id].state; });
    accessibleIds = Object.keys(statesById);
  } else if (myId && own.state) {
    statesById[myId] = own.state;
    accessibleIds = [myId];
  }
  const combatActif = (enemies && enemies.length > 0) || turn > 1;
  const lastRecap = (typeof RECAPS !== 'undefined' && RECAPS.length) ? RECAPS[0] : null;

  return (
    <div className="hex-bg" style={{ minHeight:'100%', position:'relative', overflow:'auto' }}>
      <div style={{ position:'absolute', top:'-25%', left:'50%', transform:'translateX(-50%)', width:900, height:900,
        background:'radial-gradient(circle, rgba(200,155,60,.10), transparent 65%)', pointerEvents:'none' }} />
      <div style={{ position:'relative', padding:'40px 24px', maxWidth:1000, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <h1 style={{ fontSize:44, letterSpacing:'.04em', textShadow:'0 0 40px var(--gold-glow)' }}>Chroniques de Runeterra</h1>
          <div className="dim" style={{ fontSize:14, marginTop:4 }}>Bonjour <b>{auth.username}</b></div>
        </div>

        <CharCarousel chars={CHARACTERS} statesById={statesById} accessibleIds={accessibleIds} staff={staff} />

        <div className="row gap-4" style={{ justifyContent:'center', flexWrap:'wrap', marginTop:28 }}>
          <button className="btn btn-gold btn-lg" onClick={() => go(staff ? 'mj' : 'sheet')}>▶ Reprendre</button>
          {combatActif && <button className="btn btn-lg" onClick={() => go('competences')}>⚔ Combat en cours — Tour {turn}</button>}
          {lastRecap && <button className="btn btn-lg" onClick={() => go('recap')}>📖 Dernier récap — {lastRecap.titre || lastRecap.date}</button>}
        </div>

        <MemorialSection />
      </div>
    </div>
  );
}
window.HubPage = HubPage;
