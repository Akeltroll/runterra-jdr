/* ============================================================
   PAGE — RÉCAP DE SÉANCE
   Sélecteur de séance + résumé texte + BD feuilletable.
   ============================================================ */

/* Hook : true si la media query matche (recalculé au resize). */
function useMediaQuery(query) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const fn = () => setMatch(m.matches);
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, [query]);
  return match;
}

/* Lecture plein écran d'une planche : zoom (molette / boutons / double-clic) +
   déplacement (drag quand zoomé), navigation et fermeture clavier. */
const LB_ZOOM_MIN = 1, LB_ZOOM_MAX = 6, LB_ZOOM_STEP = 0.5;
const clampZoom = (z) => Math.min(LB_ZOOM_MAX, Math.max(LB_ZOOM_MIN, z));

function RecapLightbox({ pages, index, onClose }) {
  const [i, setI] = useState(index);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => setI(index), [index]);
  // reset zoom/position à chaque changement de planche
  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, [i]);
  // recentre quand on redescend à 100 %
  useEffect(() => { if (zoom <= 1) setPan({ x: 0, y: 0 }); }, [zoom]);

  const prevPage = () => setI(v => Math.max(0, v - 1));
  const nextPage = () => setI(v => Math.min(pages.length - 1, v + 1));

  // clavier
  useEffect(() => {
    const fn = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') nextPage();
      else if (e.key === 'ArrowLeft')  prevPage();
      else if (e.key === '+' || e.key === '=') setZoom(z => clampZoom(z + LB_ZOOM_STEP));
      else if (e.key === '-') setZoom(z => clampZoom(z - LB_ZOOM_STEP));
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [pages.length, onClose]);

  // molette = zoom sur la BD (listener non-passif pour bloquer le zoom/scroll navigateur)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fn = (e) => { e.preventDefault(); setZoom(z => clampZoom(z - e.deltaY * 0.0018)); };
    el.addEventListener('wheel', fn, { passive: false });
    return () => el.removeEventListener('wheel', fn);
  }, []);

  const onDown = (e) => { if (zoom <= 1) return; e.preventDefault(); drag.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }; };
  const onMove = (e) => { if (!drag.current) return; setPan({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }); };
  const onUp = () => { drag.current = null; };

  return (
    <div className="recap-lb" ref={wrapRef}
      onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
      onClick={(e) => { if (e.target === e.currentTarget && zoom <= 1) onClose(); }}>
      <button className="lb-close" onClick={onClose}>✕</button>
      <button className="lb-btn lb-prev" disabled={i === 0}
        onClick={(e) => { e.stopPropagation(); prevPage(); }}>◀</button>
      <img src={pages[i]} alt={'Page ' + (i + 1)} draggable={false}
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                 cursor: zoom > 1 ? (drag.current ? 'grabbing' : 'grab') : 'zoom-in',
                 transition: drag.current ? 'none' : 'transform .12s ease-out' }}
        onMouseDown={onDown}
        onDoubleClick={(e) => { e.stopPropagation(); setZoom(z => (z > 1 ? 1 : 2.5)); }}
        onClick={(e) => e.stopPropagation()} />
      <button className="lb-btn lb-next" disabled={i >= pages.length - 1}
        onClick={(e) => { e.stopPropagation(); nextPage(); }}>▶</button>
      <div className="lb-zoom">
        <button onClick={(e) => { e.stopPropagation(); setZoom(z => clampZoom(z - LB_ZOOM_STEP)); }}>−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={(e) => { e.stopPropagation(); setZoom(z => clampZoom(z + LB_ZOOM_STEP)); }}>+</button>
      </div>
      <div className="lb-count">{i + 1} / {pages.length}</div>
    </div>
  );
}

/* Livre feuilletable. Une "vue" = ce qui est montré d'un coup :
   - large écran : une double-page [gauche, droite] (via paginate)
   - mobile      : une seule page [page]
   Le flip fait tourner une feuille (CSS 3D) entre deux vues consécutives.
   L'animation a 2 phases : 'start' (position initiale, sans transition) puis
   'run' (position finale, avec transition) — basculées via requestAnimationFrame
   pour que la transition CSS se déclenche dans les deux sens. */
function RecapBook({ pages, onZoom }) {
  const narrow = useMediaQuery('(max-width: 820px)');
  const views = narrow ? (pages || []).map(p => [p]) : paginate(pages);
  const [vi, setVi] = useState(0);
  const [anim, setAnim] = useState(null);   // { dir:'next'|'prev', phase:'start'|'run' }
  useEffect(() => { setVi(0); setAnim(null); }, [narrow, pages]);

  const total = views.length;
  const go = (dir) => {
    if (anim) return;
    const nv = vi + (dir === 'next' ? 1 : -1);
    if (nv < 0 || nv >= total) return;
    setAnim({ dir, phase: 'start' });
  };

  // start -> run (2 rAF pour garantir le reflow avant transition)
  useEffect(() => {
    if (anim && anim.phase === 'start') {
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setAnim(a => (a ? { ...a, phase: 'run' } : a))));
      return () => cancelAnimationFrame(id);
    }
  }, [anim]);

  // fin d'animation : commit de la nouvelle vue
  useEffect(() => {
    if (anim && anim.phase === 'run') {
      const t = setTimeout(() => {
        setVi(v => v + (anim.dir === 'next' ? 1 : -1));
        setAnim(null);
      }, 640);
      return () => clearTimeout(t);
    }
  }, [anim]);

  // navigation clavier
  useEffect(() => {
    const fn = (e) => {
      if (e.key === 'ArrowRight') go('next');
      else if (e.key === 'ArrowLeft') go('prev');
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  });

  if (!total) return <div className="faint">Aucune page.</div>;

  const cur  = views[vi]     || [];
  const next = views[vi + 1] || [];
  const prev = views[vi - 1] || [];
  const isNext = anim && anim.dir === 'next';
  const isPrev = anim && anim.dir === 'prev';
  const hideErr = (e) => { e.currentTarget.style.visibility = 'hidden'; };
  const zoom = (src) => { if (onZoom && src) onZoom(pages.indexOf(src)); };

  // Pages statiques (sous la feuille) + faces de la feuille, selon mode & direction.
  let leftSrc, rightSrc, leafFront, leafBack;
  if (narrow) {
    rightSrc = undefined;
    if (isNext)      { leftSrc = next[0];  leafFront = cur[0];  leafBack = next[0]; }
    else if (isPrev) { leftSrc = prev[0];  leafFront = prev[0]; leafBack = cur[0]; }
    else             { leftSrc = cur[0]; }
  } else {
    if (isNext)      { leftSrc = cur[0];  rightSrc = next[1]; leafFront = cur[1];  leafBack = next[0]; }
    else if (isPrev) { leftSrc = prev[0]; rightSrc = prev[1]; leafFront = prev[1]; leafBack = cur[0]; }
    else             { leftSrc = cur[0];  rightSrc = cur[1]; }
  }

  // Transform/transition de la feuille (inline = pas de conflit de classes).
  let transform = 'rotateY(0deg)', transition = 'none';
  if (isNext) {
    transform  = anim.phase === 'run' ? 'rotateY(-180deg)' : 'rotateY(0deg)';
    transition = anim.phase === 'run' ? 'transform 0.62s ease-in-out' : 'none';
  } else if (isPrev) {
    transform  = anim.phase === 'run' ? 'rotateY(0deg)' : 'rotateY(-180deg)';
    transition = anim.phase === 'run' ? 'transform 0.62s ease-in-out' : 'none';
  }

  // Fonction (pas un composant) -> pas de remontage des <img> au changement de phase.
  const renderHalf = (side, src, key) => src
    ? <div key={key} className={'recap-half ' + side}>
        <img src={src} alt="" onClick={() => zoom(src)} onError={hideErr} />
      </div>
    : <div key={key} className={'recap-half ' + side + ' empty'} />;

  return (
    <div className={'recap-book' + (narrow ? ' is-narrow' : '')}>
      <div className="recap-stage">
        {!narrow && renderHalf('left', leftSrc, 'L')}
        {narrow ? renderHalf('left', leftSrc, 'L') : renderHalf('right', rightSrc, 'R')}
        {anim && (
          <div className="recap-leaf" style={{ transform, transition }}>
            <div className="face front">{leafFront ? <img src={leafFront} alt="" onError={hideErr} /> : null}</div>
            <div className="face back">{leafBack ? <img src={leafBack} alt="" onError={hideErr} /> : null}</div>
          </div>
        )}
      </div>
      <div className="recap-nav">
        <button className="btn btn-sm btn-ghost" disabled={vi === 0} onClick={() => go('prev')}>◀</button>
        <span className="count">{narrow ? `page ${vi + 1} / ${total}` : `vue ${vi + 1} / ${total}`}</span>
        <button className="btn btn-sm btn-ghost" disabled={vi >= total - 1} onClick={() => go('next')}>▶</button>
      </div>
    </div>
  );
}

function RecapPage() {
  const recaps = window.RECAPS || [];
  const [sel, setSel] = useState(0);
  const [zoom, setZoom] = useState(null);   // index de page en plein écran, ou null
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

      {/* BD — livre feuilletable */}
      <RecapBook pages={s.pages || []} onZoom={(idx) => setZoom(idx)} />
      {zoom != null && (
        <RecapLightbox pages={s.pages || []} index={zoom} onClose={() => setZoom(null)} />
      )}
    </div>
  );
}

Object.assign(window, { useMediaQuery, RecapBook, RecapLightbox, RecapPage });
