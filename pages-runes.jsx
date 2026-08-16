/* ============================================================
   PAGE — ARBRE DE RUNES (constellation radiale)
   5 familles rayonnant d'un cœur central, sélection stricte
   (points = niveau), persistée temps réel (state/runes). Bonus
   plats -> stats ; conditionnel -> rappels. Contenu figé : RUNES.
   Refonte PUREMENT graphique (handoff hi-fi 2026-08-16) :
   logique, données et persistance INCHANGÉES.
   ============================================================ */
const RUNE_INDEX = buildRuneIndex(RUNES);
/* Géométrie du handoff : viewBox 1200, cœurs à 165, paliers 300/415/520, voies à ±26°,
   1re famille à −90°. `runeRadialLayout` est déjà paramétrable : aucun changement de logique. */
const RUNE_LAYOUT = runeRadialLayout(RUNES, {
  size: 1200, ring: 165, radii: [300, 415, 520], pathSpreadDeg: 26, startDeg: -90,
});
const RUNE_C = RUNE_LAYOUT.center;                    // 600
const RUNE_TIER_LABEL = { mineure:'Mineure', avancee:'Avancée', fondamentale:'Fondamentale' };
const RUNE_TIER_ORDER = ['mineure', 'avancee', 'fondamentale'];
/* id du nœud fondamental -> capstone (bonus thématique) de sa voie ; id -> nom de voie. */
const RUNE_CAPSTONE = {};
const RUNE_PATH_NAME = {};
RUNES.forEach(f => f.paths.forEach(p => {
  const last = p.nodes[p.nodes.length - 1];
  if (last) RUNE_CAPSTONE[last.id] = p.capstone;
  p.nodes.forEach(n => { RUNE_PATH_NAME[n.id] = p.name; });
}));
/* Angle de chaque famille (identique au calcul de runeRadialLayout) : −90° + i×(360/n). */
const RUNE_FAM_ANGLE = RUNES.map((_, i) => -90 + (360 / RUNES.length) * i);

const runePol = (r, deg) => {
  const a = deg * Math.PI / 180;
  return { x: RUNE_C + r * Math.cos(a), y: RUNE_C + r * Math.sin(a) };
};
const runeHexToRgb = (h) => {
  const v = String(h || '').replace('#', '');
  return [parseInt(v.slice(0,2),16) || 0, parseInt(v.slice(2,4),16) || 0, parseInt(v.slice(4,6),16) || 0];
};
const runeRgba = (h, a) => { const c = runeHexToRgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
/* Points SVG d'un nœud selon son palier (losange / carré (rect) / hexagone). */
function runeHexPoints(x, y, R) {
  const pts = [];
  for (let k = 0; k < 6; k++) { const a = (Math.PI / 3) * k; pts.push((x + R * Math.cos(a)).toFixed(1) + ',' + (y + R * Math.sin(a)).toFixed(1)); }
  return pts.join(' ');
}
const runeDiamondPoints = (x, y, R) =>
  [[x, y - R], [x + R, y], [x, y + R], [x - R, y]].map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');

/* Décor figé, calculé une seule fois au chargement (déterministe). */
/* Poussière d'étoiles : PRNG à graine fixe pour rester stable d'un rendu à l'autre. */
const RUNE_DUST = (() => {
  let seed = 20260816;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [];
  for (let i = 0; i < 150; i++) {
    const a = rnd() * 360, r = 130 + Math.pow(rnd(), 0.55) * 470;
    const p = runePol(r, a), o = 0.05 + rnd() * 0.32;
    out.push({ key:'d' + i, cx:p.x.toFixed(1), cy:p.y.toFixed(1), r:(0.8 + rnd() * 1.9).toFixed(1),
      fill:'rgba(' + (rnd() > 0.72 ? '200,170,255,' : '236,226,205,') + o.toFixed(2) + ')' });
  }
  return out;
})();
/* Graduations de l'anneau gravé : 72 traits tous les 5°, une majeure sur 6. */
const RUNE_TICKS = (() => {
  const out = [];
  for (let i = 0; i < 72; i++) {
    const a = i * 5, major = i % 6 === 0;
    const p0 = runePol(574, a), p1 = runePol(574 + (major ? 20 : 9), a);
    out.push({ key:'t' + i, x1:p0.x.toFixed(1), y1:p0.y.toFixed(1), x2:p1.x.toFixed(1), y2:p1.y.toFixed(1),
      stroke: major ? 'rgba(200,155,60,0.3)' : 'rgba(200,155,60,0.13)', sw: major ? 1.6 : 1 });
  }
  return out;
})();
/* Lignes de ley : entre deux familles (angle + 36°). */
const RUNE_LEYS = RUNE_FAM_ANGLE.map((ang, i) => {
  const p0 = runePol(120, ang + 36), p1 = runePol(596, ang + 36);
  return { key:'l' + i, x1:p0.x.toFixed(1), y1:p0.y.toFixed(1), x2:p1.x.toFixed(1), y2:p1.y.toFixed(1) };
});
/* Secteur teinté + ancre du libellé, par famille. */
const RUNE_SECTORS = RUNE_FAM_ANGLE.map((ang) => {
  const p0 = runePol(578, ang - 36), p1 = runePol(578, ang + 36);
  return {
    d: `M${RUNE_C} ${RUNE_C} L${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A578 578 0 0 1 ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Z`,
    label: runePol(572, ang),
  };
});

/* Définitions SVG partagées (dégradés de gemme par famille, filtres de halo). */
function RuneDefs() {
  return (
    <defs>
      <filter id="rGlow" x="-120%" y="-120%" width="340%" height="340%">
        <feGaussianBlur stdDeviation="7" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="rGlowSoft" x="-90%" y="-90%" width="280%" height="280%">
        <feGaussianBlur stdDeviation="3" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id="rSecSoft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="46" /></filter>
      <filter id="rBigBlur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="42" /></filter>
      <radialGradient id="runeHubGrad" cx={RUNE_C} cy={RUNE_C} r="150" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#1B1610" /><stop offset="1" stopColor="#09090E" />
      </radialGradient>
      <radialGradient id="dimGem" cx="0.34" cy="0.28" r="0.85">
        <stop offset="0" stopColor="#1D1B2C" /><stop offset="1" stopColor="#0A0912" />
      </radialGradient>
      {RUNE_LAYOUT.families.map(fam => (
        <React.Fragment key={fam.key}>
          <radialGradient id={'sec-' + fam.key} cx={RUNE_C} cy={RUNE_C} r="470" gradientUnits="userSpaceOnUse">
            <stop offset="0.3" stopColor={fam.color} stopOpacity="0" />
            <stop offset="0.62" stopColor={fam.color} stopOpacity="0.06" />
            <stop offset="1" stopColor={fam.color} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={'gem-' + fam.key} cx="0.34" cy="0.26" r="0.9">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
            <stop offset="0.28" stopColor={fam.color} stopOpacity="0.9" />
            <stop offset="1" stopColor={fam.color} stopOpacity="0.22" />
          </radialGradient>
        </React.Fragment>
      ))}
    </defs>
  );
}

/* Un nœud : platine + gemme (forme du palier) + contour intérieur + reflet + marque de gravure.
   Si node.img est défini, l'image remplace la gemme (le reste du sertissage est conservé). */
function RuneNodeShape({ nd, state, capstone, onClick, onHover }) {
  const node = RUNE_INDEX[nd.id];
  const base = nd.tier === 'fondamentale' ? 37 : 25;
  const handlers = {
    onClick: () => onClick(node),
    onMouseEnter: (e) => onHover({ kind:'node', node, capstone }, e),
    onMouseLeave: () => onHover(null),
  };
  const gemFill = state === 'selected' ? `url(#gem-${nd.famKey})` : 'url(#dimGem)';
  const gemFilter = state === 'selected' ? 'url(#rGlow)' : state === 'available' ? 'url(#rGlowSoft)' : 'none';
  const cls = 'rune-gem ' + state;
  let gem;
  if (node.img) {
    const s = nd.tier === 'fondamentale' ? 78 : nd.tier === 'avancee' ? 62 : 54;
    gem = <image href={node.img} x={nd.x - s / 2} y={nd.y - s / 2} width={s} height={s} className={cls} {...handlers} />;
  } else if (nd.tier === 'avancee') {
    gem = <rect x={nd.x - 25} y={nd.y - 25} width="50" height="50" rx="7" fill={gemFill} filter={gemFilter} className={cls} {...handlers} />;
  } else {
    const pts = nd.tier === 'mineure' ? runeDiamondPoints(nd.x, nd.y, 25) : runeHexPoints(nd.x, nd.y, 37);
    gem = <polygon points={pts} fill={gemFill} filter={gemFilter} className={cls} {...handlers} />;
  }
  const k = base * 0.58;
  const inner = nd.tier === 'avancee'
    ? <rect x={nd.x - k} y={nd.y - k} width={k * 2} height={k * 2} rx="4" className={'rune-inner ' + state} />
    : <polygon points={nd.tier === 'mineure' ? runeDiamondPoints(nd.x, nd.y, k) : runeHexPoints(nd.x, nd.y, k)}
        className={'rune-inner ' + state} />;
  const sx = nd.x - base * 0.26, sy = nd.y - base * 0.34;
  return (
    <React.Fragment>
      <circle cx={nd.x} cy={nd.y} r={base + 13} className={'rune-plate ' + state} />
      <circle cx={nd.x} cy={nd.y} r={base + 13} className={'rune-socket ' + state} />
      {gem}
      {inner}
      <ellipse cx={sx} cy={sy} rx={(base * 0.34).toFixed(1)} ry={(base * 0.15).toFixed(1)}
        transform={`rotate(-38 ${sx.toFixed(1)} ${sy.toFixed(1)})`} className={'rune-spec ' + state} />
      {state === 'selected' && <circle cx={nd.x} cy={nd.y} r={nd.tier === 'fondamentale' ? 7 : 4.5} className="rune-mark" />}
      {state === 'available' && <circle cx={nd.x} cy={nd.y} r="2.6" fill={runeRgba(nd.color, 0.85)} className="rune-pip" />}
    </React.Fragment>
  );
}

/* Cœur d'une famille. Survol -> tooltip de famille (condition de thématique). */
function RuneCore({ fam, onHover }) {
  return (
    <g className="rune-core"
      onMouseEnter={(e) => onHover({ kind:'family', name: fam.name, theme: fam.theme }, e)}
      onMouseLeave={() => onHover(null)}>
      <circle cx={fam.core.x} cy={fam.core.y} r="40" className="rune-core-outer" />
      <circle cx={fam.core.x} cy={fam.core.y} r="31" className="rune-core-inner" filter="url(#rGlowSoft)" />
    </g>
  );
}

/* Aura extérieure adaptative : sa couleur et son intensité suivent les familles investies.
   Logique pure de présentation -> styles calculés (dégradés impossibles à écrire en CSS statique). */
function runeAuraStyles(famPoints) {
  const weights = RUNE_LAYOUT.families
    .map((fam, i) => ({ color: fam.color, deg: ((RUNE_FAM_ANGLE[i] + 90) % 360 + 360) % 360, pts: famPoints[fam.key] || 0 }))
    .sort((a, b) => a.deg - b.deg);
  const total = weights.reduce((s, w) => s + w.pts, 0);
  const stops = weights.map(w => {
    const share = total ? w.pts / total : 0;
    // Part relative + investissement absolu : c'est le terme absolu qui fait « péter » la lumière.
    const abs = Math.min(w.pts, 11) / 11;
    return { c: runeRgba(w.color, Math.min(0.72, 0.055 + share * 0.16 + abs * 0.46)), deg: w.deg };
  });
  // Teinte moyenne pondérée : éclaire TOUT l'anneau, pas seulement le secteur dominant.
  const mix = [0, 0, 0];
  if (total) weights.forEach(w => { const c = runeHexToRgb(w.color), k = w.pts / total; c.forEach((v, i) => { mix[i] += v * k; }); });
  else [200, 155, 60].forEach((v, i) => { mix[i] = v; });
  const mixCol = 'rgba(' + mix.map(v => Math.round(v)).join(',') + ',';
  const conic = 'conic-gradient(from 0deg, '
    + stops.map(s => s.c + ' ' + s.deg.toFixed(0) + 'deg').join(', ')
    + ', ' + stops[0].c + ' ' + (stops[0].deg + 360).toFixed(0) + 'deg)';
  return {
    ring: {
      background: `radial-gradient(circle at 50% 50%, transparent 38%, ${mixCol}${(0.05 + Math.min(total, 20) * 0.011).toFixed(3)}) 54%, ${mixCol}0.02) 70%, transparent 84%)`,
    },
    conic: {
      background: conic,
      filter: `blur(84px) saturate(${(1.15 + Math.min(total, 20) * 0.045).toFixed(2)}) brightness(${(1 + Math.min(total, 20) * 0.03).toFixed(2)})`,
      opacity: Math.min(1, 0.4 + total * 0.055),
    },
  };
}

/* Constellation : décor + faisceaux + cœurs + nœuds (SVG) puis un calque HTML pour les
   textes et les toggles AD/AP (les <text> SVG ne se mettent pas en page dans ce contexte). */
function RuneConstellation({ nodeState, choices, famPoints, spent, budget, onClick, onChoice, onHover }) {
  const S = RUNE_LAYOUT.size;
  const aura = runeAuraStyles(famPoints);
  const lit = [];
  RUNE_LAYOUT.families.forEach(fam => fam.segments.forEach((s, i) => {
    if (nodeState(s.outerId) === 'selected') lit.push({ key: fam.key + i, s, color: fam.color });
  }));
  return (
    <div className="rune-scene">
      <div className="rune-aura ring" style={aura.ring} />
      <div className="rune-aura conic" style={aura.conic} />
      <div className="rune-aura shimmer" />
      <svg viewBox={`0 0 ${S} ${S}`} className="rune-sky" preserveAspectRatio="xMidYMid meet">
        <RuneDefs />
        {/* secteurs teintés + halos diffus des familles investies */}
        <g filter="url(#rSecSoft)">
          {RUNE_LAYOUT.families.map((fam, i) => <path key={fam.key} d={RUNE_SECTORS[i].d} fill={`url(#sec-${fam.key})`} />)}
        </g>
        <g filter="url(#rBigBlur)">
          {RUNE_LAYOUT.families.map(fam => {
            const pts = famPoints[fam.key] || 0;
            return <circle key={fam.key} cx={fam.core.x} cy={fam.core.y} r="90"
              fill={runeRgba(fam.color, Math.min(0.6, 0.11 + Math.min(pts, 11) / 11 * 0.5))} />;
          })}
        </g>
        {/* poussière d'étoiles, lignes de ley, anneau gravé */}
        <g style={{ pointerEvents:'none' }}>
          {RUNE_DUST.map(d => <circle key={d.key} cx={d.cx} cy={d.cy} r={d.r} fill={d.fill} />)}
          {RUNE_LEYS.map(l => <line key={l.key} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} className="rune-ley" />)}
          <circle cx={RUNE_C} cy={RUNE_C} r="574" className="rune-etch" />
          <circle cx={RUNE_C} cy={RUNE_C} r="596" className="rune-etch faint" />
          {RUNE_TICKS.map(t => <line key={t.key} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.stroke} strokeWidth={t.sw} />)}
          <circle cx={RUNE_C} cy={RUNE_C} r="520" className="rune-depth-3" />
          <circle cx={RUNE_C} cy={RUNE_C} r="415" className="rune-depth-2" />
          <circle cx={RUNE_C} cy={RUNE_C} r="300" className="rune-depth-1" />
          <circle cx={RUNE_C} cy={RUNE_C} r={RUNE_LAYOUT.ring} className="rune-ring" />
        </g>
        {/* faisceaux : trait de base, puis surcouche allumée + flux */}
        {RUNE_LAYOUT.families.map(fam => (
          <g key={'beam-' + fam.key} style={{ '--fam': fam.color }}>
            {fam.segments.map((s, i) => (
              <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                className={'rune-beam' + (nodeState(s.outerId) === 'selected' ? ' lit' : '')} />
            ))}
          </g>
        ))}
        <g>
          {lit.map(b => <line key={'g' + b.key} x1={b.s.x1} y1={b.s.y1} x2={b.s.x2} y2={b.s.y2}
            style={{ '--fam': b.color }} className="rune-beam-glow" filter="url(#rGlow)" />)}
          {lit.map(b => <line key={'f' + b.key} x1={b.s.x1} y1={b.s.y1} x2={b.s.x2} y2={b.s.y2} className="rune-beam-flow" />)}
        </g>
        {/* hub central */}
        <circle cx={RUNE_C} cy={RUNE_C} r="112" className="rune-hub-disc" />
        <circle cx={RUNE_C} cy={RUNE_C} r="96" className="rune-hub-dash" />
        {/* cœurs de famille puis nœuds */}
        {RUNE_LAYOUT.families.map(fam => (
          <g key={'core-' + fam.key} style={{ '--fam': fam.color }}>
            <RuneCore fam={fam} onHover={onHover} />
          </g>
        ))}
        {RUNE_LAYOUT.families.map(fam => (
          <g key={'nodes-' + fam.key} style={{ '--fam': fam.color }}>
            {fam.nodes.map(nd => (
              <RuneNodeShape key={nd.id} nd={{ ...nd, famKey: fam.key, color: fam.color }} state={nodeState(nd.id)}
                capstone={RUNE_CAPSTONE[nd.id] || null} onClick={onClick} onHover={onHover} />
            ))}
          </g>
        ))}
      </svg>
      {/* calque HTML : compteur central, lettres de cœur, noms de famille, toggles AD/AP */}
      <div className="rune-labels">
        <div className="rune-hud">
          <span className="rh-lbl">POINTS</span>
          <span className="rh-spent">{spent}</span>
          <span className="rh-budget">/ {budget}</span>
        </div>
        {RUNE_LAYOUT.families.map((fam, i) => {
          const lab = RUNE_SECTORS[i].label;
          const invested = (famPoints[fam.key] || 0) > 0;
          return (
            <React.Fragment key={fam.key}>
              <span className="rune-core-txt" style={{ '--fam': fam.color,
                left:(fam.core.x / S * 100) + '%', top:(fam.core.y / S * 100) + '%' }}>{fam.name[0]}</span>
              <span className={'rune-fam-label' + (invested ? ' invested' : '')} style={{ '--fam': fam.color,
                left:(lab.x / S * 100) + '%', top:(lab.y / S * 100) + '%' }}>{fam.name.toUpperCase()}</span>
            </React.Fragment>
          );
        })}
        {RUNE_LAYOUT.families.map(fam => fam.nodes.map(nd => {
          const node = RUNE_INDEX[nd.id];
          if (!(node.mods && node.mods.adp != null) || nodeState(nd.id) !== 'selected') return null;
          return (
            <div key={nd.id} className="rune-adp" style={{ '--fam': fam.color,
              left:(nd.x / S * 100) + '%', top:((nd.y + 42) / S * 100) + '%' }}
              onClick={(e) => e.stopPropagation()}>
              {['ad', 'ap'].map(k => (
                <button key={k} className={(choices[nd.id] || 'ad') === k ? 'on' : ''}
                  onClick={() => onChoice(nd.id, k)}>{k.toUpperCase()}</button>
              ))}
            </div>
          );
        }))}
      </div>
    </div>
  );
}

/* Popover de détail (survol d'un nœud ou d'un cœur de famille). */
function RuneTooltip({ hover }) {
  if (!hover) return null;
  const style = { '--fam': hover.fam,
    left: Math.min(hover.x + 16, window.innerWidth - 292),
    top: Math.min(hover.y + 14, window.innerHeight - 200) };
  if (hover.kind === 'family') {
    return (
      <div className="rune-tooltip" style={style}>
        <div className="rt-tier">Famille</div>
        <div className="rt-name">{hover.name}</div>
        <div className="rt-desc">Condition de thématique : {hover.theme}</div>
      </div>
    );
  }
  const node = hover.node;
  const cost = RUNE_COST[node.tier] || 0;
  return (
    <div className="rune-tooltip" style={style}>
      <div className="rt-tier">{RUNE_PATH_NAME[node.id]} · {RUNE_TIER_LABEL[node.tier] || node.tier}</div>
      <div className="rt-name">{node.name}</div>
      <div className="rt-desc">{node.desc}</div>
      {node.note ? <div className="rt-note">⚠ {node.note}</div> : null}
      {hover.capstone ? <div className="rt-cap"><span>Bonus thématique</span>{hover.capstone}</div> : null}
      <div className="rt-cost">Coût {cost} pt{cost > 1 ? 's' : ''}</div>
    </div>
  );
}

/* Légende des paliers — les coûts sont lus dans RUNE_COST (jamais réécrits en dur). */
function RuneLegend() {
  const shape = {
    mineure:      <svg width="18" height="18" viewBox="0 0 18 18"><polygon points="9,2 16,9 9,16 2,9" /></svg>,
    avancee:      <svg width="18" height="18" viewBox="0 0 18 18"><rect x="3" y="3" width="12" height="12" rx="2.5" /></svg>,
    fondamentale: <svg width="20" height="18" viewBox="0 0 20 18"><polygon points="10,2 17,6 17,12 10,16 3,12 3,6" /></svg>,
  };
  return (
    <div className="rune-legend">
      {RUNE_TIER_ORDER.map(t => {
        const c = RUNE_COST[t] || 0;
        return <span key={t}>{shape[t]}{RUNE_TIER_LABEL[t]} · {c} pt{c > 1 ? 's' : ''}</span>;
      })}
    </div>
  );
}

function RuneReminders({ selectedIds }) {
  // Nœuds dont un effet n'est pas calculé : runes 'reminder' OU bonus calculé + sous-effet (`note`).
  const items = selectedIds.map(id => RUNE_INDEX[id]).filter(n => n && (n.kind === 'reminder' || n.note));
  if (!items.length) return null;
  const famColor = {};
  RUNE_LAYOUT.families.forEach(f => { famColor[f.key] = f.color; });
  return (
    <div className="rune-reminders">
      <div className="rr-head">Rappels — effets à appliquer manuellement</div>
      <div className="rr-list">
        {items.map(n => (
          <div key={n.id} className="rr-item" style={{ '--fam': famColor[n.familyKey] || 'var(--gold)' }}>
            <span className="rr-dot" />
            <span><b>{n.name}</b> — {n.kind === 'reminder' ? n.desc : n.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RuneBody({ char, staff }) {
  const { state, setField, setRuneSelected, setRuneChoice, resetRunes } = useCharState(char.id);
  const toast = useToast();
  const [hover, setHover] = useState(null);
  const onHover = (payload, e) => {
    if (!payload) { setHover(null); return; }
    setHover({ ...payload, x: e.clientX, y: e.clientY });
  };
  if (!state) return <div style={{ padding:40 }} className="dim">Chargement…</div>;
  const runes = state.runes || {};
  const selectedSet = runes.selected || {};
  const choices = runes.choices || {};
  const selectedIds = Object.keys(selectedSet).filter(id => selectedSet[id]);
  const bonus = state.runeBonus || 0;          // points additionnels accordés par le MJ (test / niveau)
  const effLevel = (state.level != null ? state.level : char.level) || 1;
  const budget = runeBudget(effLevel) + bonus;
  const spent = runeSpent(selectedIds, RUNE_INDEX);
  // Points investis par famille : pilotent les puces, les halos et l'aura extérieure.
  const famPoints = {};
  selectedIds.forEach(id => {
    const n = RUNE_INDEX[id];
    if (n) famPoints[n.familyKey] = (famPoints[n.familyKey] || 0) + (RUNE_COST[n.tier] || 0);
  });

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
  // Couleur du tooltip : celle de la famille survolée (nœud ou cœur).
  const hoverFam = hover
    ? (hover.kind === 'node'
        ? (RUNE_LAYOUT.families.find(f => f.key === RUNE_INDEX[hover.node.id].familyKey) || {}).color
        : (RUNE_LAYOUT.families.find(f => f.name === hover.name) || {}).color)
    : null;

  return (
    <div className="rune-page">
      <div className="rune-head">
        <div className="col" style={{ gap:4 }}>
          <div className="rh-over">{char.name}</div>
          <h2>Arbre de runes</h2>
          <div className="rh-sub">Survolez une rune pour son effet — cliquez pour la graver.</div>
        </div>
        <div className="row gap-3" style={{ alignItems:'center' }}>
          {staff && (
            <span className="rune-stepper" title="Points bonus (MJ) — test / montée de niveau">
              <button disabled={bonus <= 0} onClick={() => setField('runeBonus', Math.max(0, bonus - 1))}>−</button>
              <span className="rs-val">MJ +{bonus}</span>
              <button onClick={() => setField('runeBonus', bonus + 1)}>+</button>
            </span>
          )}
          <button className="btn btn-sm btn-ghost" disabled={!selectedIds.length}
            onClick={() => { if (selectedIds.length) resetRunes(); }}>Réinitialiser</button>
        </div>
      </div>
      <div className="rune-chips">
        {RUNE_LAYOUT.families.map(fam => {
          const pts = famPoints[fam.key] || 0;
          return (
            <div key={fam.key} className={'rune-chip' + (pts ? ' invested' : '')} style={{ '--fam': fam.color }}>
              <span className="rc-dot">{fam.name[0]}</span>
              <span className="rc-name">{fam.name}</span>
              <span className="rc-pts">{pts}</span>
            </div>
          );
        })}
      </div>
      <RuneConstellation nodeState={nodeState} choices={choices} famPoints={famPoints}
        spent={spent} budget={budget} onClick={onClick} onChoice={setRuneChoice} onHover={onHover} />
      <RuneLegend />
      <RuneReminders selectedIds={selectedIds} />
      <RuneTooltip hover={hover ? { ...hover, fam: hoverFam || 'var(--gold)' } : null} />
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
        <RuneBody key={char.id} char={char} staff={!lockedCharId} />
      </div>
    </div>
  );
}

Object.assign(window, { RuneTreePage });
