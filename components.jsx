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
  sapience:'SP', vol:'VV', omni:'OV', hp:'HP', mana:'MN', shield:'BO',
};

/* --- Barre de ressource (HP / Mana / Bouclier) avec flash de perte --- */
function ResourceBar({ kind='hp', cur, max, big=false, segments=0 }) {
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
      <div className="txt">{Math.round(cur)} / {max}</div>
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
  ad:'Dégâts (AD)', ap:'Puissance (AP)', armure:'Armure', resmag:'Rés. Magique',
  crit:'% Critique', dcrit:'% Dégâts Crit', sapience:'Sapience', vol:'% Vol de vie', omni:'% Omnivamp',
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
    ['plat','coin-plat', coins.plat], ['or','coin-or', coins.or],
    ['arg','coin-arg', coins.arg], ['cuiv','coin-cuiv', coins.cuiv],
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

/* --- Annotation dev (pin numéroté + tooltip) --- */
function AnnoPin({ n, note, style }) {
  return (
    <div className="tip" style={{ position:'absolute', ...style }}>
      <div className="anno-pin">{n}</div>
      <div className="tip-body" style={{ borderColor:'rgba(127,200,255,.5)' }}>{note}</div>
    </div>
  );
}

/* --- Modal d'attaque (sélecteur arme + mode + résultat dégâts) --- */
function AttackModal({ char, onClose }) {
  const toast = useToast();
  const owned = (char.weaponIds && char.weaponIds.length) ? WEAPONS.filter(w => char.weaponIds.includes(w.id)) : WEAPONS;
  const [weaponId, setWeaponId] = useState(char.weaponId);
  const [lethality, setLethality] = useState(char.lethality);
  const [result, setResult] = useState(null);
  const weapon = WEAPONS.find(w => w.id === weaponId);

  const launch = () => {
    const isCrit = Math.random() * 100 < char.stats.crit;
    const r = computeAttack({ weapon, stats: char.stats, lethality, isCrit });
    setResult(r);
    toast(`<b>${char.name}</b> inflige <b>${r.dmg}</b> dégâts ${weapon.cat.toLowerCase()}s${isCrit ? ' — CRITIQUE !' : ''}`, isCrit ? 'buff' : 'gold');
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="panel-head">
          <h3>Lancer une attaque — {char.name}</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>Fermer ✕</button>
        </div>
        <div style={{ padding:'var(--sp-5)' }}>
          {/* arme */}
          <div className="overline" style={{ marginBottom:8 }}>Arme équipée</div>
          <div className="row gap-2 wrap" style={{ marginBottom:18 }}>
            {owned.map(w => (
              <button key={w.id} onClick={() => setWeaponId(w.id)}
                className={'btn btn-sm' + (w.id === weaponId ? ' btn-gold' : ' btn-ghost')}>
                {w.name} <span className="faint mono" style={{ fontSize:10 }}>{w.type}</span>
              </button>
            ))}
          </div>
          {/* léthalité */}
          <div className="overline" style={{ marginBottom:8 }}>Léthalité</div>
          <div className="row gap-2" style={{ marginBottom:20 }}>
            {[0,1,2,3].map(l => (
              <button key={l} onClick={() => setLethality(l)}
                className={'btn btn-sm' + (l === lethality ? ' btn-gold' : ' btn-ghost')} style={{ width:46, justifyContent:'center' }}>{l}</button>
            ))}
            <span className="faint" style={{ fontSize:11, alignSelf:'center' }}>
              {['Aucune','Physique','Magique','Phys. & Mag.'][lethality]} · pén. {lethality*10}
            </span>
          </div>
          {/* résultat */}
          {result && (
            <div className="panel" style={{ background:'var(--bg-inset)', padding:'var(--sp-5)', textAlign:'center', borderColor: result.crit ? 'var(--gold)' : 'var(--line)' }}>
              <div className="overline">Dégâts infligés</div>
              <div className="mono" style={{ fontSize:54, fontWeight:700, color: result.crit ? 'var(--gold-bright)' : 'var(--gold-pale)', lineHeight:1.1, margin:'4px 0' }}>
                {result.dmg}
              </div>
              {result.crit && <div className="gold" style={{ fontFamily:'var(--font-display)', letterSpacing:'.1em' }}>COUP CRITIQUE</div>}
              <hr className="gold-rule" style={{ margin:'14px 0' }} />
              <div className="row gap-4" style={{ justifyContent:'center', flexWrap:'wrap', fontSize:12 }} >
                <span className="dim">Base <b className="mono gold">{result.base}</b></span>
                <span className="dim">{weapon.stat === 'ap' ? 'AP' : 'AD'} <b className="mono gold">{result.power}</b></span>
                <span className="dim">Pén. <b className="mono gold">{result.pen}</b></span>
              </div>
            </div>
          )}
          <button className="btn btn-gold btn-lg" style={{ width:'100%', justifyContent:'center', marginTop:16 }} onClick={launch}>
            ⚔ Lancer l'attaque
          </button>
        </div>
      </div>
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

Object.assign(window, {
  Avatar, ResourceBar, StatChip, BuffBadge, InvItem, Coins,
  ToastProvider, useToast, AnnoPin, AttackModal, STAT_GLYPH, STAT_LABEL,
  LoginScreen, PendingScreen, SignOutButton, NumberStepper, ExportImportPanel,
});
