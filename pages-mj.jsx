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
  const passiveMods = st ? sumPassiveMods(c.id, st.counters || {}, effLevel) : {};
  const skillBuffMods = st ? sumSkillBuffs(st.skillBuffs || {}) : {};
  const eff = computeEffective(c.stats, st ? st.modifiers : c.modifiers, buffs, mergeMods(mergeMods(mergeMods(itemMods, runeMods), passiveMods), skillBuffMods));
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

function MJCompactCard({ c, st, turn, onFull }) {
  const L = mjLive(c, st);
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
        <ResourceBar kind="shield" cur={L.shield} max={c.shieldMax || 0} />
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
    onUpdate(enemy.id, { hpCur: Math.max(0, enemy.hpCur - n) });
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

function EnemyAttackModal({ enemy, stOf, onClose }) {
  const toast = useToast();
  const [amount, setAmount] = useState(String(enemy.atk || 0));
  const [type, setType] = useState('physique');
  const [targetId, setTargetId] = useState(CHARACTERS[0] ? CHARACTERS[0].id : '');

  const submit = () => {
    const raw = Math.max(0, parseInt(amount, 10) || 0);
    const c = CHARACTERS.find(x => x.id === targetId);
    if (!c || raw <= 0) { onClose(); return; }
    const L = mjLive(c, stOf(c.id));
    const degats = mitigateDamage(raw, type, { armure: L.eff.armure, resmag: L.eff.resmag });
    const res = applyDamageToPools({ hpCur: L.hp, shield: L.shield }, degats);
    window.RTDB.updatePath(charPath(c.id), { hpCur: res.hpCur, shield: res.shield });
    toast(`<b>${enemy.name}</b> inflige <b>${degats}</b> (${type}) à <b>${c.name}</b>${res.ko ? ' — KO !' : ''}`,
      res.ko ? 'debuff' : 'gold');
    pushLog(`<b>${enemy.name}</b> inflige <b>${degats}</b> (${type}) à <b>${c.name}</b>${res.ko ? ' — KO !' : ''}`, res.ko ? 'debuff' : 'gold');
    onClose();
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="panel" onClick={e => e.stopPropagation()} style={{ width:'min(420px,100%)', padding:18, display:'flex', flexDirection:'column', gap:14 }}>
        <h3 style={{ fontSize:17 }}>Attaque — {enemy.name}</h3>
        <label className="col" style={{ gap:4 }}>
          <span className="overline">Dégâts</span>
          <input style={ENEMY_FLD} value={amount} onChange={e => setAmount(e.target.value)} autoFocus />
        </label>
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

/* Une attaque en attente : dégâts pré-remplis éditables (le MJ ajuste à son d20) + type + appliquer/rejeter. */
function PendingHitRow({ hit, enemies, onApply, onReject }) {
  const enemy = enemies.find(e => e.id === hit.targetId);
  const [dmg, setDmg] = useState(String(hit.computedDmg || 0));
  const [type, setType] = useState(hit.type || 'physique');
  return (
    <div className="panel" style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:8 }}>
      <div className="row" style={{ justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:6 }}>
        <span style={{ fontSize:13 }}><b className="gold">{hit.attackerName}</b> · {hit.skillName} → <b>{enemy ? enemy.name : '— cible disparue —'}</b></span>
        <span className="mono faint" style={{ fontSize:11 }}>calculé : {hit.computedDmg}</span>
      </div>
      <div className="row gap-2" style={{ alignItems:'center', flexWrap:'wrap' }}>
        <input style={{ ...ENEMY_FLD, width:80 }} value={dmg} onChange={e => setDmg(e.target.value)} title="Dégâts (ajuste au d20)" />
        <div className="row gap-1">
          {['physique','magique','brut'].map(t => (
            <button key={t} className={'btn btn-sm ' + (type===t ? 'btn-gold' : 'btn-ghost')} onClick={() => setType(t)} style={{ textTransform:'capitalize' }}>{t}</button>
          ))}
        </div>
        <button className="btn btn-sm btn-gold" disabled={!enemy} onClick={() => onApply(hit, enemy, Math.max(0, parseInt(dmg,10)||0), type)} style={{ marginLeft:'auto' }}>Appliquer</button>
        <button className="btn btn-sm btn-ghost" onClick={() => onReject(hit.id)}>Rejeter</button>
      </div>
    </div>
  );
}
function PendingHitsPanel({ enemies }) {
  const { hits, removeHit } = usePendingHits();
  if (!hits.length) return null;
  const apply = (hit, enemy, finalDmg, type) => {
    const r = applyHitToEnemy(enemy, finalDmg, type);
    toast(`<b>${hit.attackerName}</b> inflige <b>${r.applied}</b> (${type}) à <b>${enemy.name}</b>${r.hpCur === 0 ? ' — KO !' : ''}`, r.hpCur === 0 ? 'debuff' : 'gold');
    pushLog(`<b>${hit.attackerName}</b> inflige <b>${r.applied}</b> (${type}) à <b>${enemy.name}</b>${r.hpCur === 0 ? ' — KO !' : ''}`, r.hpCur === 0 ? 'debuff' : 'gold');
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

function MJPage({ go }) {
  const all = useAllCharStates();
  const [selected, setSelected] = useState('rathael');
  const [full, setFull] = useState(null);
  const { enemies, addEnemy, updateEnemy, removeEnemy } = useMJEnemies();
  const { turn, nextTurn, prevTurn, resetCombat } = useSharedTurn();
  const [attacker, setAttacker] = useState(null); // ennemi en cours d'attaque (Task 4)
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

      {full && <FullScreenSheet char={full} onClose={() => setFull(null)} />}
      {attacker && <EnemyAttackModal enemy={attacker} stOf={stOf} onClose={() => setAttacker(null)} />}
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
