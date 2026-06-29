/* ============================================================
   COMPOSANTS PARTAGÉS — Chroniques de Runeterra
   (hooks React exposés globalement via window dans le shell HTML)
   ============================================================ */

/* --- Avatar (portrait du personnage, repli sur initiale) --- */
function Avatar({ char, size = 42, radius = 9 }) {
  const border = '1.5px solid ' + (char.color || 'var(--gold-deep)').replace('var(--', 'var(--');
  const common = { width: size, height: size, flex: 'none', borderRadius: radius, border, overflow: 'hidden' };
  if (char.img) {
    return <div style={{ ...common, backgroundImage: `url("${char.img}")`, backgroundSize: 'cover', backgroundPosition: 'center 22%', boxShadow: `0 0 0 1px var(--bg-deep), 0 0 14px ${char.color}33` }} />;
  }
  return (
    <div style={{ ...common, display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontSize: size * 0.45,
      color: 'var(--gold-pale)', background: `linear-gradient(135deg, ${char.color}22, var(--bg-inset))` }}>{char.initial}</div>
  );
}

/* --- Glyphe de stat (abréviation mono, dev-friendly) --- */
const STAT_GLYPH = {
  ad:'AD', ap:'AP', armure:'AR', resmag:'RM', crit:'%C', dcrit:'%D',
  sapience:'SP', vol:'VV', omni:'OV', hp:'HP', mana:'MN', shield:'BO', letha:'LT',
};

/* --- Barre de ressource (HP / Mana / Bouclier) avec flash de perte --- */
function ResourceBar({ kind='hp', cur, max, big=false, segments=0, hideText=false }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
  const prev = useRef(cur);
  const [flash, setFlash] = useState(null);
  useEffect(() => {
    if (cur < prev.current) { setFlash('dmg'); const t = setTimeout(() => setFlash(null), 550); prev.current = cur; return () => clearTimeout(t); }
    if (cur > prev.current) { setFlash('heal'); const t = setTimeout(() => setFlash(null), 550); prev.current = cur; return () => clearTimeout(t); }
    prev.current = cur;
  }, [cur]);
  const fillCls = kind === 'mana' ? 'fill-mana' : kind === 'shield' ? 'fill-shield' : 'fill-hp';
  return (
    <div className={'bar' + (big ? ' bar-lg' : '') + (flash === 'dmg' ? ' flash' : '') + (flash === 'heal' ? ' flash-heal' : '')}>
      <div className={'fill ' + fillCls} style={{ width: pct + '%' }}></div>
      {segments > 0 && Array.from({ length: segments - 1 }).map((_, i) => (
        <div key={i} className="seg" style={{ left: ((i + 1) / segments) * 100 + '%' }}></div>
      ))}
      {!hideText && <div className="txt">{Math.round(cur)} / {max}</div>}
    </div>
  );
}

/* --- Barre d'XP (lecture seule) : progression DANS le niveau courant. --- */
function XpBar({ level, xp }) {
  const lvl = Math.max(1, level | 0);
  const need = xpToNext(lvl);
  const cur = Math.max(0, xp | 0);
  const maxed = !isFinite(need);
  const pct = maxed ? 100 : (need > 0 ? Math.max(0, Math.min(100, (cur / need) * 100)) : 0);
  return (
    <div className="col gap-1">
      <div className="row" style={{ justifyContent:'space-between', alignItems:'baseline' }}>
        <span className="overline">Niveau {lvl}</span>
        <span className="mono faint" style={{ fontSize:11 }}>{maxed ? 'MAX' : `${cur} / ${need} XP`}</span>
      </div>
      <div className="bar">
        <div className="fill" style={{ width: pct + '%', background:'var(--gold-bright)' }}></div>
      </div>
    </div>
  );
}

/* --- Stat chip --- */
function StatChip({ k, value, suffix='', magic=false }) {
  return (
    <div className={'stat-chip' + (magic ? ' is-magic' : '')}>
      <div className="ic mono">{STAT_GLYPH[k] || '?'}</div>
      <div className="lbl">{STAT_LABEL[k] || k}</div>
      <div className="val">{value}{suffix}</div>
    </div>
  );
}
const STAT_LABEL = {
  ad:'Dégâts (AD)', ap:'Puissance (AP)', hp:'PV max', mana:'Mana max', armure:'Armure', resmag:'Rés. Magique',
  crit:'% Critique', dcrit:'% Dégâts Crit', sapience:'Sapience', vol:'% Vol de vie', omni:'% Omnivamp',
  letha:'Léthalité',
};

/* --- Buff / Débuff badge (toggle + tooltip) --- */
function BuffBadge({ buff, on, onToggle, compact=false }) {
  if (compact) {
    return (
      <div className="tip">
        <div className={'buff-ic is-' + buff.type} style={{ opacity: on ? 1 : .3, filter: on ? 'none' : 'grayscale(.7)' }}>
          {buff.type === 'buff' ? '▲' : '▼'}
        </div>
        <div className="tip-body"><b className="gold">{buff.name}</b><br/>{buff.effet}</div>
      </div>
    );
  }
  return (
    <div className="tip">
      <button className={'buff is-' + buff.type + (on ? '' : ' off')} onClick={onToggle}>
        <span className="dot">{buff.type === 'buff' ? '+' : '−'}</span>
        {buff.name}
      </button>
      <div className="tip-body"><b className="gold">{buff.name}</b><br/>{buff.effet}</div>
    </div>
  );
}

/* --- Carte inventaire --- */
function InvItem({ item }) {
  const catCls = item.cat === 'Équipement' ? 'cat-equip' : item.cat === 'Consommables' ? 'cat-conso' : 'cat-loot';
  return (
    <div className="inv-item">
      <div className={'ic ' + catCls}>{item.ic}</div>
      <div className="nm">{item.name}<small>{item.sub}</small></div>
      <div className="qty">{item.qty}</div>
    </div>
  );
}

/* --- Monnaie --- */
function Coins({ coins, size='md' }) {
  const list = [
    ['cuiv','coin-cuiv', coins.cuiv], ['arg','coin-arg', coins.arg],
    ['or','coin-or', coins.or], ['plat','coin-plat', coins.plat],
  ];
  return (
    <div className="coins wrap">
      {list.map(([k, cls, v]) => (
        <div key={k} className={'coin ' + cls}><span className="disc"></span>{v}</div>
      ))}
    </div>
  );
}

/* --- Rendu sûr d'un message de toast : seul <b>…</b> devient gras, tout le
   reste est rendu en texte (neutralise toute autre balise HTML → pas d'XSS). --- */
function renderToastMsg(msg) {
  if (typeof msg !== 'string') return msg;
  const parts = [];
  const re = /<b>(.*?)<\/b>/g;
  let last = 0, m, i = 0;
  while ((m = re.exec(msg)) !== null) {
    if (m.index > last) parts.push(msg.slice(last, m.index));
    parts.push(<b key={i++}>{m[1]}</b>);
    last = m.index + m[0].length;
  }
  if (last < msg.length) parts.push(msg.slice(last));
  return parts;
}

/* --- Système de Toast (contexte global) --- */
const ToastCtx = React.createContext(() => {});
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, kind='gold') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className={'toast t-' + t.kind}>
            <div className="ic">{t.kind === 'buff' ? '▲' : t.kind === 'debuff' ? '▼' : '✦'}</div>
            <div className="msg">{renderToastMsg(t.msg)}</div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
const useToast = () => React.useContext(ToastCtx);

/* --- Journal de combat (partagé, lecture seule) --- */
function CombatLog({ canClear }) {
  const { entries, clearLog } = useCombatLog();
  const COL = { gold: 'var(--gold-pale)', buff: 'var(--buff-bright)', debuff: 'var(--debuff-bright)' };
  return (
    <div className="panel" style={{ padding:'12px 14px' }}>
      <div className="row" style={{ justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div className="overline">Journal de combat</div>
        {canClear && entries.length > 0 && <button className="btn btn-sm btn-ghost" onClick={clearLog}>Vider</button>}
      </div>
      {entries.length === 0
        ? <div style={{ fontSize:12, color:'var(--ink-faint)' }}>Aucun événement.</div>
        : <div className="col gap-1" style={{ maxHeight:220, overflow:'auto' }}>
            {entries.map(e => (
              <div key={e.id} style={{ fontSize:12.5, lineHeight:1.5, color: COL[e.kind] || 'var(--ink)' }}>
                {renderToastMsg(e.text)}
              </div>
            ))}
          </div>}
    </div>
  );
}

/* --- Annotation dev (pin numéroté + tooltip) --- */
function AnnoPin({ n, note, style }) {
  return (
    <div className="tip" style={{ position:'absolute', ...style }}>
      <div className="anno-pin">{n}</div>
      <div className="tip-body" style={{ borderColor:'rgba(127,200,255,.5)' }}>{note}</div>
    </div>
  );
}

/* --- Écran de connexion (bloque tout tant qu'on n'est pas authentifié) --- */
function LoginScreen({ onSubmit }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await onSubmit(u, p);
    } catch (e2) {
      setErr('Identifiant ou mot de passe incorrect.');
      setBusy(false);
    }
  };
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(8,8,14,.92)', display:'grid', placeItems:'center', zIndex:1000 }}>
      <form className="panel" onSubmit={submit} style={{ padding:'28px 32px', maxWidth:380, width:'90%' }}>
        <div className="row gap-2" style={{ alignItems:'center', justifyContent:'center', marginBottom:6 }}>
          <div className="crest" style={{ width:30, height:30, position:'relative' }}><i></i><b>R</b></div>
          <h2 style={{ margin:0 }}>Chroniques de Runeterra</h2>
        </div>
        <p className="dim" style={{ fontSize:13, textAlign:'center', marginBottom:18 }}>Connecte-toi pour accéder à ta fiche.</p>
        <input className="fld" placeholder="Nom d'utilisateur" value={u} autoFocus autoComplete="username"
          onChange={(e) => setU(e.target.value)}
          style={{ display:'block', width:'100%', marginBottom:10, padding:'9px 11px', background:'var(--bg-inset)', color:'var(--ink)', border:'1px solid var(--line-strong)', borderRadius:6, fontSize:14, boxSizing:'border-box' }} />
        <input className="fld" type="password" placeholder="Mot de passe" value={p} autoComplete="current-password"
          onChange={(e) => setP(e.target.value)}
          style={{ display:'block', width:'100%', marginBottom:12, padding:'9px 11px', background:'var(--bg-inset)', color:'var(--ink)', border:'1px solid var(--line-strong)', borderRadius:6, fontSize:14, boxSizing:'border-box' }} />
        {err && <div style={{ color:'var(--hp)', fontSize:12, marginBottom:10, textAlign:'center' }}>{err}</div>}
        <button className="btn btn-gold" type="submit" disabled={busy || !u || !p} style={{ width:'100%' }}>
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}

/* --- Compte connecté mais sans perso attribué --- */
function PendingScreen({ username, onSignOut }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(8,8,14,.92)', display:'grid', placeItems:'center', zIndex:1000 }}>
      <div className="panel" style={{ padding:'28px 32px', maxWidth:440, textAlign:'center' }}>
        <h2 style={{ marginBottom:6 }}>Compte en attente</h2>
        <p className="dim" style={{ fontSize:13, marginBottom:18 }}>
          Bonjour <b>{username}</b> — ton personnage n'a pas encore été attribué par le MJ.
          Reviens un peu plus tard.
        </p>
        <button className="btn btn-ghost" onClick={onSignOut}>Se déconnecter</button>
      </div>
    </div>
  );
}

/* --- Bouton de déconnexion (topbar) --- */
function SignOutButton({ username, role, onSignOut }) {
  return (
    <div className="row gap-2" style={{ alignItems:'center' }}>
      <span className="session">{username} · {role}</span>
      <button className="btn btn-sm btn-ghost" onClick={onSignOut}>Déconnexion</button>
    </div>
  );
}

/* --- Compteur à pas (jauges Fatigue / Eau, 0..5) --- */
function NumberStepper({ label, value, color, min = 0, max = 5, onChange }) {
  const v = value == null ? 0 : value;
  return (
    <div className="panel" style={{ padding:'12px 14px', flex:1, background:'var(--bg-inset)' }}>
      <div className="overline" style={{ marginBottom:8 }}>{label}</div>
      <div className="row gap-1" style={{ marginBottom:8 }}>
        {Array.from({ length: max }).map((_, i) => (
          <div key={i} style={{ flex:1, height:10, borderRadius:3, background: i < v ? color : 'var(--bg-panel-2)', border:'1px solid var(--line)' }}></div>
        ))}
      </div>
      <div className="row gap-2" style={{ justifyContent:'space-between', alignItems:'center' }}>
        <button className="btn btn-sm btn-ghost" onClick={() => onChange(clampGauge(v - 1))} disabled={v <= min}>−</button>
        <span className="mono" style={{ fontSize:14, color:'var(--gold-pale)' }}>{v} / {max}</span>
        <button className="btn btn-sm btn-ghost" onClick={() => onChange(clampGauge(v + 1))} disabled={v >= max}>+</button>
        <button className="btn btn-sm btn-ghost" onClick={() => onChange(0)} title="Remettre à zéro">↺</button>
      </div>
    </div>
  );
}

/* --- Export / Import JSON de la sauvegarde complète --- */
function ExportImportPanel() {
  const toast = useToast();
  const doExport = async () => {
    const data = await window.RTDB.getSnapshot(CAMPAIGN);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `runeterra-sauvegarde-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    toast('Sauvegarde exportée', 'gold');
  };
  const doImport = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (!confirm('Remplacer tout l’état actuel par cette sauvegarde ?')) return;
      await window.RTDB.setPath(CAMPAIGN, JSON.parse(reader.result));
      toast('Sauvegarde importée', 'buff');
    };
    reader.readAsText(file);
  };
  return (
    <div className="row gap-2 wrap">
      <button className="btn btn-sm btn-ghost" onClick={doExport}>⬇ Exporter</button>
      <label className="btn btn-sm btn-ghost" style={{ cursor:'pointer' }}>
        ⬆ Importer<input type="file" accept="application/json" onChange={doImport} style={{ display:'none' }} />
      </label>
    </div>
  );
}

/* --- Redimensionne une image (fichier) en data URL compacte (max `maxPx`,
   webp si dispo sinon png — l'alpha est conservé). Permet au MJ de téléverser
   une image sans accès au code : stockée telle quelle dans `item.img` (RTDB). --- */
function downscaleImageToDataURL(file, maxPx = 128) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('lecture échouée'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('image illisible'));
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        let out = canvas.toDataURL('image/webp', 0.85);
        if (out.indexOf('data:image/webp') !== 0) out = canvas.toDataURL('image/png');
        resolve(out);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* --- Inventaire : styles/format partagés (grille Équipement ET coffre commun) --- */
const INV_CAT_STYLE = {
  'Équipement':   { border:'rgba(200,155,60,0.55)',  glow:'rgba(200,155,60,0.30)'  },
  'Consommables': { border:'rgba(43,111,176,0.55)',  glow:'rgba(43,111,176,0.30)'  },
  'Butin':        { border:'rgba(139,224,255,0.42)', glow:'rgba(139,224,255,0.16)' },
};
const INV_CAT_FALLBACK = { border:'rgba(160,128,72,0.45)', glow:'rgba(160,128,72,0.22)' };
const invCatStyle = (it) => (it && INV_CAT_STYLE[it.cat]) || INV_CAT_FALLBACK;
const INV_FILTERS = [
  { key:'all', label:'Tout' }, { key:'Équipement', label:'Équip.' },
  { key:'Consommables', label:'Conso.' }, { key:'Butin', label:'Butin' },
];
const INV_COINS = [
  { key:'cuiv', label:'Fer',     img:'ATH/Items/piece-fer.webp',     col:'#b0b0b0' },
  { key:'arg',  label:'Bronze',  img:'ATH/Items/piece-bronze.webp',  col:'#cd9a6a' },
  { key:'or',   label:'Or',      img:'ATH/Items/piece-or.webp',      col:'#eccf8f' },
  { key:'plat', label:'Mythril', img:'ATH/Items/piece-mythril.webp', col:'#b8d4e8' },
];
const invFmt = (n) => Number(n || 0).toLocaleString('fr-FR');
const invThumbStyle = (item, inset) => ({
  position:'absolute', inset, cursor:'grab', display:'flex', alignItems:'center', justifyContent:'center',
  ...(item.img ? { backgroundImage:`url(${item.img})`, backgroundSize:'contain', backgroundRepeat:'no-repeat',
    backgroundPosition:'center', filter:'drop-shadow(0 2px 6px rgba(0,0,0,0.8))' } : {}),
  fontSize:18,
});

/* Grille d'inventaire dark-fantasy réutilisable (page Équipement + coffre commun).
   N'gère PAS les actions : remonte les clics au parent via onItemClick/onCoinClick. */
function InventoryGrid({ items, coins, filter, setFilter, onItemClick, onCoinClick, onAdd, onDropItem, onReorderItem, capacity = 120, title = 'INVENTAIRE', minCells = 49, grow = false }) {
  const ordVal = (it) => typeof it.order === 'number' ? it.order : Number.MAX_SAFE_INTEGER;
  const list = items
    ? Object.values(items).filter(it => it.qty == null || it.qty > 0).sort((a, b) => ordVal(a) - ordVal(b))
    : [];
  const filtered = list.filter(it => filter === 'all' || it.cat === filter);
  const N = Math.max(minCells, Math.ceil(filtered.length / 7) * 7);
  const cells = Array.from({ length:N }, (_, i) => filtered[i] || null);
  const panelBg = 'linear-gradient(155deg,#1c1713 0%,#130f0c 55%,#0d0a08 100%)';
  const cornerStyle = (h, v) => ({ position:'absolute', [h]:6, [v]:6, width:14, height:14,
    [`border${h[0].toUpperCase()}${h.slice(1)}`]:'2px solid rgba(185,150,80,0.55)',
    [`border${v[0].toUpperCase()}${v.slice(1)}`]:'2px solid rgba(185,150,80,0.55)' });
  return (
    <div style={{ position:'relative', display:'flex', flexDirection:'column',
      ...(grow ? {} : { height:'100%', minHeight:0 }),
      border:'1px solid rgba(160,128,72,0.3)', borderRadius:4, background:panelBg,
      boxShadow:'inset 0 0 55px rgba(0,0,0,0.5)', padding:'12px 12px 0',
      fontFamily:"'EB Garamond',serif", color:'#d8c8a8' }}>
      <div style={cornerStyle('left','top')} /><div style={cornerStyle('right','top')} />
      <div style={cornerStyle('left','bottom')} /><div style={cornerStyle('right','bottom')} />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', position:'relative', marginBottom:10, flex:'0 0 auto' }}>
        <span style={{ fontFamily:"'Cinzel',serif", fontSize:14, fontWeight:600, letterSpacing:3, color:'#c2a05a' }}>{title}</span>
        {onAdd && <button onClick={onAdd} title="Ajouter un objet"
          style={{ position:'absolute', right:0, top:-2, background:'transparent', color:'#c2a05a',
            border:'1px solid rgba(160,128,72,0.4)', borderRadius:4, padding:'2px 8px', cursor:'pointer',
            fontFamily:"'Cinzel',serif", fontSize:11 }}>+ Ajouter</button>}
      </div>
      <div style={{ display:'flex', gap:4, marginBottom:10, flex:'0 0 auto' }}>
        {INV_FILTERS.map(ft => {
          const on = filter === ft.key;
          return <div key={ft.key} onClick={() => setFilter(ft.key)}
            style={{ flex:1, textAlign:'center', fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:0.4,
              padding:'7px 2px', cursor:'pointer', textTransform:'uppercase', borderRadius:3,
              border:'1px solid ' + (on ? 'rgba(160,128,72,0.5)' : 'rgba(160,128,72,0.16)'),
              color:on ? '#eccf8f' : 'rgba(190,170,135,0.5)',
              background:on ? 'linear-gradient(180deg,#2a1f16,#1a130e)' : 'transparent' }}>{ft.label}</div>;
        })}
      </div>
      <div onDragOver={onDropItem ? (e) => e.preventDefault() : undefined}
        onDrop={onDropItem ? (e) => { e.preventDefault(); const id = e.dataTransfer.getData('text'); if (id) onDropItem(id); } : undefined}
        style={ grow ? { overflow:'visible' } : { flex:'1 1 auto', overflowY:'auto', overflowX:'hidden', minHeight:0 } }>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:5, paddingBottom:8 }}>
          {cells.map((item, i) => {
            const cs = invCatStyle(item);
            // Réorganisation : déposer un item sur une case (un item = insérer avant lui ;
            // une case vide = envoyer en fin). stopPropagation pour ne pas déclencher onDropItem.
            const reorderProps = onReorderItem ? {
              onDragOver: (e) => { e.preventDefault(); e.stopPropagation(); },
              onDrop: (e) => {
                e.preventDefault(); e.stopPropagation();
                const id = e.dataTransfer.getData('text');
                if (id) onReorderItem(id, item ? item.id : null);
              },
            } : {};
            return (
              <div key={i} {...reorderProps} style={{ position:'relative', aspectRatio:'1', borderRadius:3,
                background:item ? 'rgba(12,8,7,0.7)' : 'radial-gradient(circle at 50% 30%,#1b1510,#0e0a08)',
                border:'1px solid ' + (item ? cs.border : 'rgba(160,128,72,0.16)'),
                boxShadow:item ? 'inset 0 0 14px ' + cs.glow : 'none',
                display:'flex', alignItems:'center', justifyContent:'center', overflow:'visible' }}>
                {item && (
                  <div draggable="true"
                    onDragStart={(e) => e.dataTransfer.setData('text', item.id)}
                    onClick={(e) => onItemClick && onItemClick(item, e)}
                    style={{ ...invThumbStyle(item, '3px'), cursor:'grab' }}>
                    {!item.img && (item.ic || '◆')}
                  </div>
                )}
                {item && item.qty > 1 && (
                  <span style={{ position:'absolute', right:3, bottom:1, fontFamily:"'EB Garamond',serif",
                    fontSize:13, fontWeight:700, color:'#eccf8f', textShadow:'0 1px 3px #000,0 0 5px #000',
                    pointerEvents:'none', zIndex:1 }}>{invFmt(item.qty)}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 4px 6px',
        borderTop:'1px solid rgba(160,128,72,0.16)', flex:'0 0 auto' }}>
        {INV_COINS.map(c => (
          <div key={c.key} onClick={onCoinClick ? (e) => onCoinClick(c.key, e) : undefined}
            style={{ display:'flex', alignItems:'center', gap:4, cursor:onCoinClick ? 'pointer' : 'default' }}>
            <div style={{ width:30, height:30, flex:'0 0 30px', background:`url(${c.img}) center/contain no-repeat` }} />
            <span style={{ fontFamily:"'EB Garamond',serif", fontSize:13, color:c.col, minWidth:32 }}>
              {invFmt((coins && coins[c.key]) || 0)}
            </span>
          </div>
        ))}
        <div style={{ flex:1 }} />
        <span style={{ fontFamily:"'Cinzel',serif", fontSize:11, color:'#c2a05a', letterSpacing:0.5 }}>
          {list.length} / {capacity}
        </span>
      </div>
    </div>
  );
}

/* Popover ancré pour choisir un montant (transfert de pile, pièces). */
function AmountStepper({ max, x, y, label, confirmLabel = 'Valider', onConfirm, onClose }) {
  const [n, setN] = useState(1);
  const clamp = (v) => Math.max(1, Math.min(max, v | 0 || 1));
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:200 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position:'fixed', left:Math.min(x, window.innerWidth-220), top:Math.min(y, window.innerHeight-130),
        background:'var(--bg-panel-2,#181410)', border:'1px solid var(--line-gold,rgba(160,128,72,0.5))', borderRadius:8,
        padding:12, width:200, boxShadow:'0 8px 30px rgba(0,0,0,0.6)', color:'var(--ink,#e9dcc4)' }}>
        {label && <div style={{ fontSize:12, marginBottom:8 }}>{label}</div>}
        <div className="row gap-2" style={{ alignItems:'center', justifyContent:'center' }}>
          <button className="btn btn-sm btn-ghost" onClick={() => setN(v => clamp(v - 1))}>−</button>
          <input type="number" min="1" max={max} value={n} onChange={(e) => setN(clamp(e.target.value))}
            style={{ width:60, textAlign:'center', background:'var(--bg-inset,#0d0a08)', color:'inherit',
              border:'1px solid var(--line,rgba(160,128,72,0.3))', borderRadius:6, padding:'5px' }} />
          <button className="btn btn-sm btn-ghost" onClick={() => setN(v => clamp(v + 1))}>+</button>
        </div>
        <div className="row gap-2" style={{ marginTop:10, justifyContent:'space-between' }}>
          <button className="btn btn-sm btn-ghost" onClick={() => setN(max)}>Max ({max})</button>
          <button className="btn btn-sm btn-gold" onClick={() => { onConfirm(clamp(n)); onClose(); }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/* Popover d'actions ancré (clic sur un item de la grille). */
function ItemActionMenu({ item, x, y, actions, onClose }) {
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:200 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position:'fixed', left:Math.min(x, window.innerWidth-200), top:Math.min(y, window.innerHeight-40-actions.length*34),
        background:'var(--bg-panel-2,#181410)', border:'1px solid var(--line-gold,rgba(160,128,72,0.5))', borderRadius:8,
        minWidth:170, padding:6, boxShadow:'0 8px 30px rgba(0,0,0,0.6)', color:'var(--ink,#e9dcc4)' }}>
        <div style={{ fontSize:12, fontWeight:600, padding:'4px 8px 6px', color:'var(--gold-pale,#eccf8f)',
          borderBottom:'1px solid var(--line,rgba(160,128,72,0.2))', marginBottom:4 }}>{item.name}</div>
        {actions.map((a, i) => (
          <button key={i} onClick={() => { a.onClick(); onClose(); }}
            style={{ display:'block', width:'100%', textAlign:'left', background:'transparent', border:'none',
              color:a.danger ? 'var(--debuff-bright,#e0463f)' : 'inherit', padding:'7px 8px', borderRadius:5,
              cursor:'pointer', fontSize:13 }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover,rgba(255,255,255,0.05))'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>{a.label}</button>
        ))}
      </div>
    </div>
  );
}

/* --- Ligne d'item : affichage + édition inline (inventaire perso & commun) --- */
/* Stats que l'on peut accorder en bonus à un item d'équipement (item.mods).
   `pct` = affiché/saisi en points de % (crit, vol, omni…). */
const MOD_STATS = [
  { k:'ad',       label:'AD' },
  { k:'ap',       label:'AP' },
  { k:'hp',       label:'PV' },
  { k:'mana',     label:'Mana' },
  { k:'armure',   label:'Armure' },
  { k:'resmag',   label:'Rés. Mag' },
  { k:'crit',     label:'% Crit',   pct:true },
  { k:'dcrit',    label:'% D.Crit', pct:true },
  { k:'sapience', label:'Sapience' },
  { k:'vol',      label:'Vol vie %', pct:true },
  { k:'omni',     label:'Omnivamp %', pct:true },
  { k:'letha',    label:'Léthalité' },
];

function InvItemRow({ item, editable, onSave, onRemove, startEdit }) {
  const [edit, setEdit] = useState(!!startEdit);
  const [d, setD] = useState(item);
  const [busy, setBusy] = useState(false);
  useEffect(() => setD(item), [item]);
  const fld = { background:'var(--bg-inset)', color:'var(--ink)', border:'1px solid var(--line-strong)', borderRadius:6, padding:'5px 8px', fontSize:12, width:'100%', boxSizing:'border-box' };
  const setMod = (k, raw) => {
    const v = parseFloat(raw);
    const mods = { ...(d.mods || {}) };
    if (!v) delete mods[k]; else mods[k] = v;
    setD({ ...d, mods });
  };
  const onPickImage = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';                          // permet de re-choisir le même fichier
    if (!file || !file.type.startsWith('image/')) return;
    setBusy(true);
    try { const url = await downscaleImageToDataURL(file, 128); setD(prev => ({ ...prev, img: url })); }
    catch (err) { console.error('Image illisible :', err); }
    finally { setBusy(false); }
  };
  if (edit) {
    return (
      <div className="col gap-2" style={{ padding:'8px', border:'1px solid var(--line-gold)', borderRadius:8 }}>
        <input style={fld} value={d.name} placeholder="Nom" onChange={e => setD({ ...d, name: e.target.value })} />
        <input style={fld} value={d.sub} placeholder="Description" onChange={e => setD({ ...d, sub: e.target.value })} />
        <div className="row gap-2">
          <select style={{ ...fld, width:'auto' }} value={d.cat}
            onChange={e => setD({ ...d, cat: e.target.value, type: e.target.value === 'Équipement' ? d.type : '' })}>
            {['Équipement','Consommables','Butin'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input style={{ ...fld, width:64 }} type="number" min="1" value={d.qty}
            onChange={e => setD({ ...d, qty: parseInt(e.target.value) || 1 })} />
        </div>
        {d.cat === 'Équipement' && (
          <select style={fld} value={d.type || ''} onChange={e => setD({ ...d, type: e.target.value })}>
            <option value="">— Emplacement —</option>
            {EQUIP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        )}
        {d.cat === 'Équipement' && (
          <div className="col gap-1">
            <span className="overline">Bonus de stats (une fois équipé)</span>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6 }}>
              {MOD_STATS.map(s => (
                <label key={s.k} className="row gap-2" style={{ alignItems:'center', fontSize:11, color:'var(--ink-soft)' }}>
                  <span style={{ flex:1, minWidth:0 }}>{s.label}</span>
                  <input style={{ ...fld, width:62, padding:'3px 6px' }} type="number" step={s.pct ? '0.5' : '1'}
                    value={(d.mods && d.mods[s.k] != null) ? d.mods[s.k] : ''}
                    placeholder="0" onChange={e => setMod(s.k, e.target.value)} />
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="row gap-2" style={{ alignItems:'center' }}>
          <label className="row gap-1" style={{ alignItems:'center', fontSize:11, color:'var(--ink-soft)' }}>
            Poids
            <input style={{ ...fld, width:70 }} type="number" min="0" step="0.5"
              value={d.weight != null ? d.weight : ''} placeholder="0"
              onChange={e => setD({ ...d, weight: Math.max(0, parseFloat(e.target.value) || 0) })} />
          </label>
          {d.cat === 'Équipement' && (
            <label className="row gap-1" style={{ alignItems:'center', fontSize:11, color:'var(--ink-soft)' }}>
              Capacité (+charge)
              <input style={{ ...fld, width:70 }} type="number" min="0" step="1"
                value={d.carry != null ? d.carry : ''} placeholder="0"
                onChange={e => setD({ ...d, carry: Math.max(0, parseFloat(e.target.value) || 0) })} />
            </label>
          )}
        </div>
        {/* Image : téléversement + aperçu (pas besoin de connaître l'arborescence) */}
        <div className="row gap-2" style={{ alignItems:'center' }}>
          <span style={{ width:40, height:40, flex:'none', borderRadius:6, display:'grid', placeItems:'center', fontSize:18, background:'var(--bg-panel-2)', border:'1px solid var(--line)', overflow:'hidden' }}>
            {d.img ? <img src={d.img} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : (d.ic || '◆')}
          </span>
          <label className="btn btn-sm btn-ghost" style={{ cursor:'pointer' }}>
            {busy ? 'Chargement…' : '🖼 Choisir une image'}
            <input type="file" accept="image/*" onChange={onPickImage} style={{ display:'none' }} />
          </label>
          {d.img ? <button className="btn btn-sm btn-ghost" title="Retirer l'image" onClick={() => setD({ ...d, img: '' })}>✕</button> : null}
        </div>
        {d.img && d.img.startsWith('data:')
          ? <div className="faint" style={{ fontSize:11 }}>Image téléversée ✓ — « ✕ » pour revenir à un chemin.</div>
          : <input style={fld} value={d.img || ''} placeholder="ou chemin/URL (ex. ATH/Items/xxx.webp)" onChange={e => setD({ ...d, img: e.target.value })} />}
        <div className="row gap-2" style={{ justifyContent:'flex-end' }}>
          <button className="btn btn-sm btn-ghost" onClick={() => { setD(item); setEdit(false); }}>Annuler</button>
          <button className="btn btn-sm btn-gold" onClick={() => { const isEq = d.cat === 'Équipement'; onSave({ ...d, type: isEq ? (d.type || '') : '', mods: isEq ? (d.mods || {}) : {}, weight: Math.max(0, Number(d.weight) || 0), carry: isEq ? (Math.max(0, Number(d.carry) || 0)) : 0 }); setEdit(false); }}>Enregistrer</button>
        </div>
      </div>
    );
  }
  return (
    <div className="row gap-2" style={{ alignItems:'center', padding:'6px 8px', background:'var(--bg-inset)', borderRadius:8, border:'1px solid var(--line)' }}>
      <span style={{ width:26, height:26, flex:'none', borderRadius:6, display:'grid', placeItems:'center', fontSize:15, background:'var(--bg-panel-2)', overflow:'hidden' }}>
        {item.img ? <img src={item.img} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : (item.ic || '◆')}
      </span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, color:'var(--ink)' }}>{item.name}{item.qty > 1 ? <span className="faint mono" style={{ fontSize:11 }}> ×{item.qty}</span> : null}</div>
        {item.sub ? <div className="faint" style={{ fontSize:11 }}>{item.sub}</div> : null}
      </div>
      {editable && (
        <span className="row gap-1">
          <button className="btn btn-sm btn-ghost" title="Éditer" onClick={() => setEdit(true)}>✎</button>
          <button className="btn btn-sm btn-ghost" title="Supprimer" onClick={() => onRemove(item.id)}>✕</button>
        </span>
      )}
    </div>
  );
}

/* --- Panneau d'inventaire réutilisable (perso = fiche ; commun = page dédiée) --- */
function InventoryPanel({ items, editable, onSave, onRemove, onAdd }) {
  const cats = ['Équipement', 'Consommables', 'Butin'];
  const list = items ? Object.values(items) : [];
  const add = (cat) => { const it = makeItem({ cat, name: 'Nouvel objet' }); onSave(it); };
  return (
    <div className="col gap-4">
      {cats.map(cat => {
        const inCat = list.filter(i => i.cat === cat);
        return (
          <div key={cat}>
            <div className="row" style={{ justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
              <span className="overline">{cat}</span>
              {editable && <button className="btn btn-sm btn-ghost" onClick={() => (onAdd ? onAdd(cat) : add(cat))}>+ Ajouter</button>}
            </div>
            {inCat.length === 0
              ? <div className="faint" style={{ fontSize:11 }}>—</div>
              : <div className="col gap-2">{inCat.map(it => <InvItemRow key={it.id} item={it} editable={editable} onSave={onSave} onRemove={onRemove} />)}</div>}
          </div>
        );
      })}
    </div>
  );
}

/* --- Catalogue d'items : modal de sélection rapide (staff) ---
   Clic sur une entrée -> AmountStepper -> onPick(entry, qty).
   Le scrim est sous le zIndex de l'AmountStepper (200) pour qu'il s'affiche par-dessus. */
function ItemCatalogPicker({ initialFilter, onPick, onCustom, onClose, staff }) {
  const [filter, setFilter] = useState(initialFilter || 'all');
  const [picked, setPicked] = useState(null);    // { entry, x, y }
  const [editing, setEditing] = useState(null);  // item édité (modal réutilisant InvItemRow)
  const { catalog, seeded, setCatalogItem, removeCatalogItem } = useItemCatalog(!!staff);
  const manage = !!staff && seeded;              // édition dispo une fois le catalogue amorcé
  const miniBtn = { background:'var(--bg-deep)', border:'1px solid var(--line)', borderRadius:5, padding:'0 5px', fontSize:11, lineHeight:1.6, cursor:'pointer', color:'var(--ink)' };
  const list = catalog.filter(e => filter === 'all' || e.cat === filter);
  return (
    <div className="modal-scrim" onClick={onClose}
      style={{ display:'flex', alignItems:'center', justifyContent:'center', zIndex:190 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width:'min(560px,94vw)', maxHeight:'88vh',
        display:'flex', flexDirection:'column', background:'var(--bg-deep)',
        border:'1px solid var(--line-gold)', borderRadius:12, padding:16 }}>
        <div className="row" style={{ justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <h3 style={{ margin:0 }}>Catalogue d'objets</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div style={{ display:'flex', gap:4, marginBottom:12 }}>
          {INV_FILTERS.map(ft => (
            <button key={ft.key} className={'btn btn-sm ' + (filter === ft.key ? 'btn-gold' : 'btn-ghost')}
              style={{ flex:1 }} onClick={() => setFilter(ft.key)}>{ft.label}</button>
          ))}
        </div>
        <div style={{ flex:'1 1 auto', overflowY:'auto', minHeight:0, display:'grid',
          gridTemplateColumns:'repeat(auto-fill,minmax(92px,1fr))', gap:8 }}>
          {list.map((entry, i) => (
            <div key={entry.id || i} onClick={(e) => setPicked({ entry, x:e.clientX, y:e.clientY })}
              title={entry.sub || entry.name}
              style={{ position:'relative', cursor:'pointer', borderRadius:8, border:'1px solid var(--line)', padding:8,
                display:'flex', flexDirection:'column', alignItems:'center', gap:6, textAlign:'center',
                background:'var(--bg-inset)' }}>
              {manage && entry.id && (
                <div className="row gap-1" style={{ position:'absolute', top:2, right:2 }}>
                  <button title="Éditer" style={miniBtn} onClick={(ev) => { ev.stopPropagation(); setEditing(entry); }}>✎</button>
                  <button title="Supprimer du catalogue" style={{ ...miniBtn, color:'var(--debuff-bright,#e0463f)' }}
                    onClick={(ev) => { ev.stopPropagation(); if (window.confirm(`Supprimer « ${entry.name} » du catalogue de base ?`)) removeCatalogItem(entry.id); }}>🗑</button>
                </div>
              )}
              <span style={{ width:44, height:44, display:'grid', placeItems:'center', fontSize:24, overflow:'hidden' }}>
                {entry.img
                  ? <img src={entry.img} alt="" style={{ width:'100%', height:'100%', objectFit:'contain' }} />
                  : (entry.ic || '◆')}
              </span>
              <span style={{ fontSize:11, lineHeight:1.2, color:'var(--ink)' }}>{entry.name}</span>
            </div>
          ))}
        </div>
        <div className="row" style={{ justifyContent:'space-between', alignItems:'center',
          marginTop:12, paddingTop:12, borderTop:'1px solid var(--line)', gap:8, flexWrap:'wrap' }}>
          <span className="row gap-2">
            <button className="btn btn-sm btn-ghost" onClick={onCustom}>+ Objet personnalisé</button>
            {manage && (
              <button className="btn btn-sm btn-ghost" title="Ajouter un objet à la liste de base"
                onClick={() => setEditing(makeItem({ cat: filter === 'all' ? 'Butin' : filter, name: 'Nouvel objet' }))}>
                + Nouvel objet de base
              </button>
            )}
          </span>
          <span className="faint" style={{ fontSize:11 }}>{list.length} objets</span>
        </div>
      </div>
      {picked && (
        <AmountStepper max={999} x={picked.x} y={picked.y}
          label={`Ajouter combien de « ${picked.entry.name} » ?`} confirmLabel="Ajouter"
          onConfirm={(n) => { onPick(picked.entry, n); setPicked(null); }}
          onClose={() => setPicked(null)} />
      )}
      {editing && (
        <div className="modal-scrim" onClick={() => setEditing(null)}
          style={{ display:'flex', alignItems:'center', justifyContent:'center', zIndex:205 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width:'min(420px,92vw)', background:'var(--bg-deep)', border:'1px solid var(--line-gold)', borderRadius:12, padding:16 }}>
            <InvItemRow item={editing} editable={true} startEdit={true}
              onSave={(it) => { setCatalogItem(it.id, it); setEditing(null); }}
              onRemove={(id) => { removeCatalogItem(id); setEditing(null); }} />
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  Avatar, ResourceBar, StatChip, BuffBadge, InvItem, InvItemRow, InventoryPanel, Coins,
  ToastProvider, useToast, AnnoPin, STAT_GLYPH, STAT_LABEL,
  LoginScreen, PendingScreen, SignOutButton, NumberStepper, ExportImportPanel,
  InventoryGrid, INV_CAT_STYLE, INV_CAT_FALLBACK, invCatStyle, INV_FILTERS, INV_COINS, invFmt, invThumbStyle,
  AmountStepper, ItemActionMenu, ItemCatalogPicker, CombatLog, XpBar,
});
