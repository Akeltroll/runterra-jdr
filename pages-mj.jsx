/* ============================================================
   PAGE — VUE MJ (TABLEAU DE BORD)   [page clé]
   Sidebar joueurs + grille de fiches compactes, temps réel.
   ============================================================ */

/* --- Ennemis : `useMJEnemies` migré en Firebase partagé (voir data-state.jsx). --- */
// Style de champ (le projet n'a pas de classe CSS d'input ; cf. InvItemRow).
const ENEMY_FLD = { background:'var(--bg-inset)', color:'var(--ink)', border:'1px solid var(--line-strong)', borderRadius:6, padding:'5px 8px', fontSize:12, width:'100%', boxSizing:'border-box' };

/* Compteur de tour : migré en `useSharedTurn` (Firebase, partagé) — voir data-state.jsx. */

/* Fusionne la définition du perso (règles) avec son état live (Firebase). */
function mjLive(c, st) {
  const buffs = st ? Object.keys(st.buffs || {}) : (c.buffs || []);
  const itemMods = st ? sumItemMods(st.equipment, st.inventory) : {};
  const runesSt  = (st && st.runes) || {};
  const runeMods = st ? sumRuneMods(Object.keys(runesSt.selected || {}).filter(id => runesSt.selected[id]),
    runesSt.choices || {}, buildRuneIndex(RUNES)) : {};
  const effLevel = (st && st.level != null ? st.level : c.level) || 1;
  const base = charBaseStats(c, st);
  const passiveMods = st ? sumPassiveMods(c.id, st.counters || {}, effLevel, base) : {};
  const skillBuffMods = st ? sumSkillBuffs(st.skillBuffs || {}) : {};
  const eff = computeEffective(base, st ? st.modifiers : c.modifiers, buffs, mergeMods(mergeMods(mergeMods(itemMods, runeMods), passiveMods), skillBuffMods));
  const hp = st ? st.hpCur : Math.round(c.hpCur * base.hp);
  const mana = st ? st.manaCur : Math.round(c.manaCur * base.mana);
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

function MJCompactCard({ c, st, turn, onFull }) {
  const L = mjLive(c, st);
  const toast = useToast();
  const [xpIn, setXpIn] = useState('');
  const effLevel = (st && st.level != null ? st.level : c.level) || 1;
  // < 25% PV → pulsation rouge ; < 50% → orange ; sinon bordure normale.
  const hpCls = L.hpPct < 25 ? 'mj-card-danger' : L.hpPct < 50 ? 'mj-card-warn' : '';
  const stats = [['ad', L.eff.ad], ['ap', L.eff.ap], ['armure', L.eff.armure], ['resmag', L.eff.resmag]];
  // Compétences : charges (compteur du passif) + cooldowns actifs (lecture pour le MJ).
  const kit = SKILLS[c.id];
  const counters = (st && st.counters) || {};
  const cooldowns = (st && st.cooldowns) || {};
  const ctr = kit && kit.passive && kit.passive.counter;
  const onCd = (kit && !kit.pending ? kit.actives : []).filter(sk => !cooldownReady(cooldowns[sk.id], turn));
  // Inventaire live (objet Firebase → tableau, items à qty>0) ; fallback sur l'inv. par défaut tant qu'aucun état.
  const inv = (st && st.inventory)
    ? Object.values(st.inventory).filter(it => (it.qty || 0) > 0)
    : (c.inv || []);
  return (
    <div className={'panel' + (hpCls ? ' ' + hpCls : '')} style={{ display:'flex', flexDirection:'column',
      borderColor: hpCls ? undefined : 'var(--line)' }}>
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
        <ResourceBar kind="shield" cur={L.shield} max={Math.max(c.shieldMax || 0, L.shield)} />
      </div>
      {/* survie */}
      <div className="row gap-2" style={{ padding:'0 16px 12px' }}>
        <span className="mono faint" style={{ fontSize:11 }}>🜂 Fatigue {L.fatigue}/5</span>
        <span className="mono faint" style={{ fontSize:11 }}>💧 Eau {L.eau}/5</span>
      </div>
      {/* XP / niveau (lecture + don MJ ad-hoc) */}
      <div className="col gap-2" style={{ padding:'0 16px 12px' }}>
        <XpBar level={effLevel} xp={(st && st.xp) || 0} />
        <div className="row gap-2" style={{ alignItems:'center' }}>
          <input type="number" min="0" value={xpIn} onChange={e => setXpIn(e.target.value)} placeholder="+XP"
            style={{ width:72, background:'var(--bg-inset)', color:'var(--ink)', border:'1px solid var(--line-strong)', borderRadius:6, padding:'5px 8px', fontSize:13 }} />
          <button className="btn btn-sm btn-ghost" title="Donner de l'XP" onClick={async () => {
            const n = Math.max(0, parseInt(xpIn, 10) || 0); if (!n) return;
            const res = await addXp(c.id, n);
            if (res.levelsGained > 0) toast(`<b>${c.name}</b> passe niveau <b>${res.level}</b> !`, 'buff');
            setXpIn('');
          }}>+ XP</button>
        </div>
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
      {/* compétences : charges + cooldowns (lecture MJ) */}
      {kit && !kit.pending && (ctr || onCd.length > 0) && (
        <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--line)' }}>
          <div className="overline" style={{ marginBottom:6 }}>Compétences</div>
          <div className="row gap-2 wrap" style={{ alignItems:'center' }}>
            {ctr && <span className="mono" style={{ fontSize:11, color:'var(--gold-pale)' }}>{ctr.label} : {counters[ctr.key] || 0}</span>}
            {onCd.map(sk => (
              <span key={sk.id} className="mono faint" style={{ fontSize:11 }}>
                {sk.name} : {cooldowns[sk.id] === 999999 ? '1×/combat ✓' : 'tour ' + cooldowns[sk.id]}
              </span>
            ))}
          </div>
        </div>
      )}
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

function EnemyCard({ enemy, onUpdate, onRemove, onAttack }) {
  const [edit, setEdit] = useState(false);
  const [subir, setSubir] = useState('');
  const danger = enemy.hpMax > 0 && (enemy.hpCur / enemy.hpMax) * 100 < 40;
  const num = (v) => Math.max(0, parseInt(v, 10) || 0);
  const applySubir = () => {
    const n = num(subir);
    if (n <= 0) return;
    const nhp = Math.max(0, enemy.hpCur - n);
    onUpdate(enemy.id, { hpCur: nhp });
    pushLog(`<b>${enemy.name}</b> subit <b>${n}</b> dégâts${nhp === 0 ? ' — KO !' : ''}`, nhp === 0 ? 'debuff' : 'gold');
    setSubir('');
  };

  if (edit) {
    const field = (label, key, full) => (
      <label className="col" style={{ gap:4, flex: full ? '1 1 100%' : '1 1 45%' }}>
        <span className="overline">{label}</span>
        <input style={ENEMY_FLD} defaultValue={enemy[key]}
          onChange={e => onUpdate(enemy.id, { [key]: key === 'name' ? e.target.value : num(e.target.value) })} />
      </label>
    );
    return (
      <div className="panel" style={{ display:'flex', flexDirection:'column', gap:10, padding:14 }}>
        <div className="row wrap gap-2">
          {field('Nom', 'name', true)}
          {field('HP actuels', 'hpCur')}
          {field('HP max', 'hpMax')}
          {field('Mana actuel', 'manaCur')}
          {field('Mana max', 'manaMax')}
          {field("Dégât d'attaque", 'atk')}
          {field('Armure', 'armure')}
          {field('Rés. magique', 'resmag')}
          {field('% Crit', 'crit')}
          {field('% Dég. Crit', 'dcrit')}
          {field('Léth. AD', 'lethaAD')}
          {field('Léth. AP', 'lethaAP')}
        </div>
        <div className="row gap-2" style={{ justifyContent:'flex-end' }}>
          <button className="btn btn-sm btn-ghost" onClick={() => onRemove(enemy.id)} style={{ marginRight:'auto', color:'var(--debuff-bright)' }}>Supprimer</button>
          <button className="btn btn-sm btn-gold" onClick={() => setEdit(false)}>OK</button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel" style={{ display:'flex', flexDirection:'column',
      borderColor: danger ? 'rgba(200,48,42,.45)' : 'var(--line)' }}>
      <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontFamily:'var(--font-display)', fontSize:15, color:'var(--gold-pale)', flex:1, minWidth:0 }}>{enemy.name}</span>
        <button className="btn btn-sm btn-ghost" onClick={() => setEdit(true)} title="Éditer" style={{ padding:'4px 8px' }}>✎</button>
      </div>
      <div className="col gap-2" style={{ padding:'12px 14px' }}>
        <ResourceBar kind="hp" cur={enemy.hpCur} max={enemy.hpMax} />
        {enemy.manaMax > 0 && <ResourceBar kind="mana" cur={enemy.manaCur} max={enemy.manaMax} />}
      </div>
      <div className="col gap-2" style={{ padding:'0 14px 10px' }}>
        <div className="row gap-2" style={{ alignItems:'center', flexWrap:'wrap' }}>
          <span className="overline" title="Ce que voient les joueurs">👁 Joueurs</span>
          {[['hidden','Caché'],['bar','Barre'],['exact','Exact']].map(([m, lbl]) => (
            <button key={m} className={'btn btn-sm ' + ((enemy.reveal || 'hidden') === m ? 'btn-gold' : 'btn-ghost')}
              onClick={() => onUpdate(enemy.id, { reveal: m })} style={{ padding:'3px 9px', fontSize:11 }}>{lbl}</button>
          ))}
        </div>
        {enemy.reveal === 'bar' && (
          <div className="row gap-2" style={{ alignItems:'center', flexWrap:'wrap' }}>
            {[100, 75, 50, 25, 10].map(p => (
              <button key={p} className={'btn btn-sm ' + ((enemy.revealPct != null ? enemy.revealPct : 100) === p ? 'btn-gold' : 'btn-ghost')}
                onClick={() => onUpdate(enemy.id, { revealPct: p })} style={{ padding:'3px 7px', fontSize:11 }}>{p}%</button>
            ))}
            <input type="number" min="0" max="100"
              value={enemy.revealPct != null ? enemy.revealPct : 100}
              onChange={e => onUpdate(enemy.id, { revealPct: Math.max(0, Math.min(100, num(e.target.value))) })}
              style={{ ...ENEMY_FLD, width:58 }} />
          </div>
        )}
      </div>
      <div className="row gap-2" style={{ padding:'0 14px 14px', alignItems:'center' }}>
        <button className="btn btn-sm btn-gold" onClick={() => onAttack(enemy)} style={{ whiteSpace:'nowrap' }}>⚔ Attaque</button>
        <input placeholder="Subir…" value={subir}
          onChange={e => setSubir(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') applySubir(); }}
          style={{ ...ENEMY_FLD, width:70 }} />
        <button className="btn btn-sm btn-ghost" onClick={applySubir} title="Appliquer les dégâts subis">🛡</button>
      </div>
    </div>
  );
}

function EnemyAttackModal({ enemy, stOf, turn, onClose }) {
  const toast = useToast();
  const baseAtk = Math.max(0, enemy.atk || 0);
  // Crit roulé par l'app à l'ouverture (mirroir du flux joueur). Le MJ ajuste le montant si besoin.
  const [cr, setCr] = useState(() => rollCrit(enemy.crit || 0, enemy.dcrit || 200));
  const critAtk = Math.round(baseAtk * cr.multiplier);
  const [amount, setAmount] = useState(String(cr.didCrit ? critAtk : baseAtk));
  const [type, setType] = useState('physique');
  const [lethaAD, setLethaAD] = useState(String(enemy.lethaAD != null ? enemy.lethaAD : (enemy.letha || 0)));
  const [lethaAP, setLethaAP] = useState(String(enemy.lethaAP || 0));
  const [targetId, setTargetId] = useState(CHARACTERS[0] ? CHARACTERS[0].id : '');
  const info = critInfo(enemy.crit || 0);
  const reroll = () => { const n = rollCrit(enemy.crit || 0, enemy.dcrit || 200); setCr(n); setAmount(String(n.didCrit ? Math.round(baseAtk * n.multiplier) : baseAtk)); };

  const submit = () => {
    const raw = Math.max(0, parseInt(amount, 10) || 0);
    // Léthalité selon le type : AD (armure) si physique, AP (rés. mag) si magique, rien en brut.
    const lethaNum = Math.max(0, type === 'physique' ? (parseInt(lethaAD, 10) || 0) : type === 'magique' ? (parseInt(lethaAP, 10) || 0) : 0);
    const c = CHARACTERS.find(x => x.id === targetId);
    if (!c || raw <= 0) { onClose(); return; }
    const st = stOf(c.id);
    const L = mjLive(c, st);
    const degats = mitigateDamage(raw, type, { armure: L.eff.armure, resmag: L.eff.resmag }, lethaNum);
    const res = applyDamageToPools({ hpCur: L.hp, shield: L.shield }, degats);
    window.RTDB.updatePath(charPath(c.id), { hpCur: res.hpCur, shield: res.shield });
    // Passif Rathael — Chair gelée : +1 charge de Glaciation quand il subit des dégâts (max 2/tour, max 5).
    if (c.id === 'rathael' && degats > 0) {
      const gp = glaciationOnHit(st && st.counters, turn);
      if (gp) {
        window.RTDB.updatePath(`${charPath(c.id)}/counters`, gp);
        if (gp.glaciation != null) pushLog(`<b>${c.name}</b> gagne une charge de Glaciation (${gp.glaciation}/5)`, 'buff');
      }
    }
    const critTag = cr.didCrit ? ' 🎲 CRIT' : '';
    const lethaTag = lethaNum > 0 ? `, léth. ${lethaNum}` : '';
    toast(`<b>${enemy.name}</b> inflige <b>${degats}</b> (${type}${critTag}) à <b>${c.name}</b>${res.ko ? ' — KO !' : ''}`,
      res.ko ? 'debuff' : 'gold');
    pushLog(`<b>${enemy.name}</b> inflige <b>${degats}</b> (${type}${critTag}${lethaTag}) à <b>${c.name}</b>${res.ko ? ' — KO !' : ''}`, res.ko ? 'debuff' : 'gold');
    onClose();
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="panel" onClick={e => e.stopPropagation()} style={{ width:'min(420px,100%)', padding:18, display:'flex', flexDirection:'column', gap:14 }}>
        <h3 style={{ fontSize:17 }}>Attaque — {enemy.name}</h3>
        <div className="row gap-2 wrap" style={{ alignItems:'center', fontSize:11, color:'var(--ink-faint)' }}>
          <span>Base : <b>{baseAtk}</b></span>
          {cr.didCrit
            ? <span className="mono" style={{ color:'var(--skillbuff)' }}>🎲 CRIT ×{cr.multiplier.toFixed(2)} → <b>{critAtk}</b></span>
            : <span className="mono faint">pas de crit</span>}
          <span className="faint">%Crit {enemy.crit || 0}{info.guaranteedTiers ? ` · ${info.guaranteedTiers} palier(s) garanti(s)` : ''}{info.extraChancePct ? ` · +${info.extraChancePct}%` : ''}</span>
          <button className="btn btn-sm btn-ghost" onClick={reroll} title="Relancer le jet de crit" style={{ padding:'2px 8px', fontSize:11 }}>🎲 relancer</button>
        </div>
        <div className="row gap-2" style={{ alignItems:'flex-end' }}>
          <label className="col" style={{ gap:4, flex:1 }}>
            <span className="overline">Dégâts</span>
            <input style={ENEMY_FLD} value={amount} onChange={e => setAmount(e.target.value)} autoFocus />
          </label>
          <label className="col" style={{ gap:4, width:84 }} title="Léthalité AD — réduit l'armure (dégât physique)">
            <span className="overline" style={{ color: type === 'physique' ? 'var(--gold-bright)' : undefined }}>Léth. AD</span>
            <input style={ENEMY_FLD} value={lethaAD} onChange={e => setLethaAD(e.target.value)} />
          </label>
          <label className="col" style={{ gap:4, width:84 }} title="Léthalité AP — réduit la résistance magique (dégât magique)">
            <span className="overline" style={{ color: type === 'magique' ? 'var(--gold-bright)' : undefined }}>Léth. AP</span>
            <input style={ENEMY_FLD} value={lethaAP} onChange={e => setLethaAP(e.target.value)} />
          </label>
        </div>
        <div className="col" style={{ gap:4 }}>
          <span className="overline">Type</span>
          <div className="row gap-2">
            {['physique', 'magique', 'brut'].map(t => (
              <button key={t} className={'btn btn-sm ' + (type === t ? 'btn-gold' : 'btn-ghost')}
                onClick={() => setType(t)} style={{ flex:1, textTransform:'capitalize' }}>{t}</button>
            ))}
          </div>
        </div>
        <label className="col" style={{ gap:4 }}>
          <span className="overline">Cible</span>
          <select style={ENEMY_FLD} value={targetId} onChange={e => setTargetId(e.target.value)}>
            {CHARACTERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <div className="row gap-2" style={{ justifyContent:'flex-end' }}>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-sm btn-gold" onClick={submit}>Infliger</button>
        </div>
      </div>
    </div>
  );
}

/* Une attaque en attente : crit roulé par l'app, dégâts pré-remplis éditables (le MJ ajuste à son d20
   de toucher) + type + léthalité + appliquer/rejeter. */
function PendingHitRow({ hit, enemies, onApply, onReject }) {
  const enemy = enemies.find(e => e.id === hit.targetId);
  const rolled = hit.didCrit ? (hit.critDmg != null ? hit.critDmg : hit.computedDmg) : hit.computedDmg;
  const [dmg, setDmg] = useState(String(rolled || 0));
  const [type, setType] = useState(hit.type || 'physique');
  const [letha, setLetha] = useState(String(hit.letha || 0));
  const info = critInfo(hit.crit || 0);
  return (
    <div className="panel" style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:8 }}>
      <div className="row" style={{ justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:6 }}>
        <span style={{ fontSize:13 }}><b className="gold">{hit.attackerName}</b> · {hit.skillName} → <b>{enemy ? enemy.name : '— cible disparue —'}</b></span>
        {hit.didCrit
          ? <span className="mono" style={{ fontSize:11, color:'var(--skillbuff)' }}>🎲 CRIT ×{(hit.critMult || 1).toFixed(2)}</span>
          : <span className="mono faint" style={{ fontSize:11 }}>normal</span>}
      </div>
      <div className="row gap-2 wrap" style={{ fontSize:11, color:'var(--ink-faint)' }}>
        <span>Base : <b>{hit.computedDmg}</b></span>
        {hit.critDmg != null && <span>Crit : <b>{hit.critDmg}</b></span>}
        <span>%Crit {hit.crit || 0}{info.guaranteedTiers ? ` · ${info.guaranteedTiers} palier(s) garanti(s)` : ''}{info.extraChancePct ? ` · +${info.extraChancePct}%` : ''}</span>
      </div>
      <div className="row gap-2" style={{ alignItems:'center', flexWrap:'wrap' }}>
        <input style={{ ...ENEMY_FLD, width:80 }} value={dmg} onChange={e => setDmg(e.target.value)} title="Dégâts (ajuste au d20 de toucher)" />
        <label className="row gap-1" style={{ alignItems:'center', fontSize:11 }} title="Léthalité (réduit AR/RM)">
          <span className="faint">Léth.</span>
          <input style={{ ...ENEMY_FLD, width:56 }} value={letha} onChange={e => setLetha(e.target.value)} />
        </label>
        <div className="row gap-1">
          {['physique','magique','brut'].map(t => (
            <button key={t} className={'btn btn-sm ' + (type===t ? 'btn-gold' : 'btn-ghost')} onClick={() => setType(t)} style={{ textTransform:'capitalize' }}>{t}</button>
          ))}
        </div>
        <button className="btn btn-sm btn-gold" disabled={!enemy} onClick={() => onApply(hit, enemy, Math.max(0, parseInt(dmg,10)||0), type, Math.max(0, parseInt(letha,10)||0))} style={{ marginLeft:'auto' }}>Appliquer</button>
        <button className="btn btn-sm btn-ghost" onClick={() => onReject(hit.id)}>Rejeter</button>
      </div>
    </div>
  );
}
function PendingHitsPanel({ enemies }) {
  const toast = useToast();
  const { hits, removeHit } = usePendingHits();
  if (!hits.length) return null;
  const apply = async (hit, enemy, finalDmg, type, letha) => {
    const r = applyHitToEnemy(enemy, finalDmg, type, letha || 0);
    toast(`<b>${hit.attackerName}</b> inflige <b>${r.applied}</b> (${type}) à <b>${enemy.name}</b>${r.hpCur === 0 ? ' — KO !' : ''}`, r.hpCur === 0 ? 'debuff' : 'gold');
    pushLog(`<b>${hit.attackerName}</b> inflige <b>${r.applied}</b> (${type}) à <b>${enemy.name}</b>${r.hpCur === 0 ? ' — KO !' : ''}`, r.hpCur === 0 ? 'debuff' : 'gold');
    // Vol de vie / Sapience / Omnivamp : soin de l'attaquant sur les dégâts infligés.
    // Séparation par source : attaque de base → vol/sapience ; compétence → omnivamp.
    const heal = lifestealHeal(r.applied, type, { omni: hit.omni || 0, vol: hit.vol || 0, sapience: hit.sapience || 0 }, hit.skillId === 'basic');
    if (heal > 0) {
      const hr = await healCharacter(hit.attackerId, heal, hit.hpMax || 0);
      if (hr.healed > 0) {
        toast(`<b>${hit.attackerName}</b> se soigne de <b>${hr.healed}</b> PV (vol de vie)`, 'buff');
        pushLog(`<b>${hit.attackerName}</b> récupère <b>${hr.healed}</b> PV (vol de vie)`, 'buff');
      }
    }
    removeHit(hit.id);
  };
  return (
    <div style={{ marginBottom:24 }}>
      <h3 style={{ fontSize:16, marginBottom:12 }}>Attaques en attente <span className="mono faint" style={{ fontSize:12 }}>· {hits.length}</span></h3>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:12 }}>
        {hits.map(h => <PendingHitRow key={h.id} hit={h} enemies={enemies} onApply={apply} onReject={removeHit} />)}
      </div>
    </div>
  );
}

/* État de séance MJ-local (localStorage). v2 possible : partagé en Firebase. */
const SESSION_KEY = 'runeterra_session';
function useSession() {
  const [active, setActive] = useState(() => { try { return localStorage.getItem(SESSION_KEY) === '1'; } catch (e) { return false; } });
  const start = useCallback(() => { try { localStorage.setItem(SESSION_KEY, '1'); } catch (e) {} setActive(true); }, []);
  const close = useCallback(() => { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} setActive(false); }, []);
  return { active, start, close };
}
function SessionStartModal({ onStart, onVisit }) {
  return (
    <div className="modal-scrim" style={{ alignItems:'center' }}>
      <div style={{ width:'min(420px,100%)', background:'var(--bg-deep)', border:'1px solid var(--line-gold)', borderRadius:12, boxShadow:'var(--shadow-modal)', padding:'24px' }}>
        <h3 style={{ fontSize:20, marginBottom:6 }}>Ouverture de la table</h3>
        <p className="faint" style={{ fontSize:13, marginBottom:18 }}>Démarrer une séance (pour distribuer XP &amp; récompenses à la clôture) ou simplement visiter le site ?</p>
        <div className="col gap-2">
          <button className="btn btn-gold" style={{ justifyContent:'center' }} onClick={onStart}>🎲 Début de séance</button>
          <button className="btn btn-ghost" style={{ justifyContent:'center' }} onClick={onVisit}>Visite du site</button>
        </div>
      </div>
    </div>
  );
}
function SessionRewardsModal({ onDone, onCancel, onLoot }) {
  const toast = useToast();
  const [rows, setRows] = useState(() => {
    const o = {}; CHARACTERS.forEach(c => { o[c.id] = { xp:'', plat:'', or:'', arg:'', cuiv:'' }; }); return o;
  });
  const setVal = (id, k, v) => setRows(r => ({ ...r, [id]: { ...r[id], [k]: v } }));
  const num = (v) => Math.max(0, parseInt(v, 10) || 0);
  const fld = { width:54, background:'var(--bg-inset)', color:'var(--ink)', border:'1px solid var(--line-strong)', borderRadius:6, padding:'5px 6px', fontSize:12 };
  const apply = async () => {
    let totXp = 0, levelUps = 0;
    for (const c of CHARACTERS) {
      const r = rows[c.id]; const xp = num(r.xp);
      const coins = { plat:num(r.plat), or:num(r.or), arg:num(r.arg), cuiv:num(r.cuiv) };
      if (xp > 0) { const res = await addXp(c.id, xp); totXp += xp; levelUps += (res.levelsGained || 0); }
      if (coins.plat || coins.or || coins.arg || coins.cuiv) await grantCoins(c.id, coins);
    }
    toast(`Séance clôturée — <b>${totXp}</b> XP distribué${levelUps ? `, <b>${levelUps}</b> montée(s) de niveau` : ''}`, 'buff');
    onDone();
  };
  return (
    <div className="modal-scrim" style={{ alignItems:'stretch', padding:24 }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ width:'min(720px,100%)', margin:'auto', maxHeight:'100%', overflow:'auto', background:'var(--bg-deep)', border:'1px solid var(--line-gold)', borderRadius:12, boxShadow:'var(--shadow-modal)' }}>
        <div className="row" style={{ justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--line)' }}>
          <h3 style={{ fontSize:18 }}>Clôture de séance — récompenses</h3>
          <button className="btn btn-sm btn-ghost" onClick={onCancel}>✕</button>
        </div>
        <div style={{ padding:'12px 20px' }}>
          <div className="row" style={{ fontSize:10, color:'var(--ink-faint)', textTransform:'uppercase', letterSpacing:'.08em', paddingBottom:8 }}>
            <span style={{ flex:1 }}>Joueur</span>
            <span style={{ width:60, textAlign:'center' }}>XP</span>
            <span style={{ width:236, textAlign:'center' }}>Plat / Or / Arg / Cuiv</span>
          </div>
          {CHARACTERS.map(c => (
            <div key={c.id} className="row" style={{ alignItems:'center', gap:8, padding:'7px 0', borderTop:'1px solid var(--line)' }}>
              <span className="row gap-2" style={{ flex:1, alignItems:'center' }}>
                <Avatar char={c} size={28} radius={6} />
                <span style={{ fontSize:13, color:'var(--gold-pale)' }}>{c.name}</span>
              </span>
              <input type="number" min="0" value={rows[c.id].xp} onChange={e => setVal(c.id, 'xp', e.target.value)} placeholder="0" style={{ ...fld, width:56 }} />
              <span className="row gap-1">
                <input type="number" min="0" value={rows[c.id].plat} onChange={e => setVal(c.id, 'plat', e.target.value)} placeholder="0" style={fld} />
                <input type="number" min="0" value={rows[c.id].or} onChange={e => setVal(c.id, 'or', e.target.value)} placeholder="0" style={fld} />
                <input type="number" min="0" value={rows[c.id].arg} onChange={e => setVal(c.id, 'arg', e.target.value)} placeholder="0" style={fld} />
                <input type="number" min="0" value={rows[c.id].cuiv} onChange={e => setVal(c.id, 'cuiv', e.target.value)} placeholder="0" style={fld} />
              </span>
            </div>
          ))}
        </div>
        <div className="row" style={{ justifyContent:'space-between', alignItems:'center', padding:'14px 20px', borderTop:'1px solid var(--line)' }}>
          <button className="btn btn-ghost btn-sm" onClick={onLoot} title="Distribuer des objets via le coffre commun">Inventaire commun → (loot)</button>
          <span className="row gap-2">
            <button className="btn btn-ghost" onClick={onCancel}>Annuler</button>
            <button className="btn btn-gold" onClick={apply}>Distribuer &amp; clôturer</button>
          </span>
        </div>
      </div>
    </div>
  );
}

function MJPage({ go }) {
  const all = useAllCharStates();
  const [selected, setSelected] = useState('rathael');
  const [full, setFull] = useState(null);
  const { enemies, addEnemy, updateEnemy, removeEnemy } = useMJEnemies();
  const { turn, nextTurn, prevTurn, resetCombat } = useSharedTurn();
  const [attacker, setAttacker] = useState(null); // ennemi en cours d'attaque (Task 4)
  const stOf = (id) => (all && all[id] && all[id].state) || null;
  const { active, start, close } = useSession();
  const [decided, setDecided] = useState(false);
  const [rewards, setRewards] = useState(false);
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
            <span className="faint" style={{ fontSize:12 }}>Vue d'ensemble temps réel</span>
          </div>
          <div className="row gap-3" style={{ alignItems:'center', flexWrap:'wrap' }}>
            <div className="row gap-2" style={{ alignItems:'center', padding:'6px 10px', background:'var(--bg-inset)', border:'1px solid var(--line)', borderRadius:8 }}>
              <span className="mono" style={{ fontSize:13, color:'var(--gold-pale)', whiteSpace:'nowrap' }}>⏱ Tour {turn}</span>
              <button className="btn btn-sm btn-ghost" onClick={prevTurn} title="Tour précédent" style={{ padding:'4px 8px' }}>◂</button>
              <button className="btn btn-sm btn-gold" onClick={nextTurn} style={{ whiteSpace:'nowrap' }}>Fin de tour ▸</button>
              <button className="btn btn-sm btn-ghost" onClick={() => { if (confirm('Nouveau combat : remettre le tour à 1 et vider toutes les charges + cooldowns ?')) resetCombat(); }} title="Nouveau combat (reset charges + cooldowns)" style={{ padding:'4px 8px', whiteSpace:'nowrap' }}>⟲ Combat</button>
            </div>
            <ExportImportPanel />
          </div>
        </div>
        {active && (
          <div className="row" style={{ justifyContent:'space-between', alignItems:'center', padding:'10px 24px', background:'var(--bg-inset)', borderBottom:'1px solid var(--line-gold)' }}>
            <span className="mono" style={{ fontSize:13, color:'var(--gold-pale)' }}>🎲 Séance en cours</span>
            <button className="btn btn-sm btn-gold" onClick={() => setRewards(true)}>Clôturer la séance</button>
          </div>
        )}
        <div style={{ flex:1, overflow:'auto', padding:24 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:16, alignItems:'start', paddingBottom:8 }}>
            {CHARACTERS.map(c => <MJCompactCard key={c.id} c={c} st={stOf(c.id)} turn={turn} onFull={() => setFull(c)} />)}
          </div>
          <div style={{ marginTop:28 }}>
            <PendingHitsPanel enemies={enemies} />
          </div>
          <div style={{ marginTop:28 }}>
            <div className="row" style={{ justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <h3 style={{ fontSize:16 }}>Ennemis <span className="mono faint" style={{ fontSize:12 }}>· {enemies.length}</span></h3>
              <button className="btn btn-sm btn-gold" onClick={() => addEnemy()}>+ Ajouter un ennemi</button>
            </div>
            {enemies.length === 0
              ? <div className="faint" style={{ fontSize:12 }}>Aucun ennemi. Ajoutez-en un pour suivre ses HP en combat.</div>
              : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:16, alignItems:'start' }}>
                  {enemies.map(e => (
                    <EnemyCard key={e.id} enemy={e} onUpdate={updateEnemy} onRemove={removeEnemy} onAttack={setAttacker} />
                  ))}
                </div>}
          </div>
          <div style={{ marginTop:28 }}>
            <CombatLog canClear={true} />
          </div>
        </div>
      </main>

      {!active && !decided && <SessionStartModal onStart={() => { start(); setDecided(true); }} onVisit={() => setDecided(true)} />}
      {rewards && <SessionRewardsModal onLoot={() => go('inv')} onCancel={() => setRewards(false)} onDone={() => { setRewards(false); close(); }} />}
      {full && <FullScreenSheet char={full} onClose={() => setFull(null)} />}
      {attacker && <EnemyAttackModal enemy={attacker} stOf={stOf} turn={turn} onClose={() => setAttacker(null)} />}
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
