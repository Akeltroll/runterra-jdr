/* ============================================================
   PAGE — VUE MJ (TABLEAU DE BORD)   [page clé]
   Sidebar joueurs + grille de fiches compactes, temps réel.
   ============================================================ */

/* --- Ennemis (local au MJ, localStorage — zéro Firebase) --- */
// Style de champ (le projet n'a pas de classe CSS d'input ; cf. InvItemRow).
const ENEMY_FLD = { background:'var(--bg-inset)', color:'var(--ink)', border:'1px solid var(--line-strong)', borderRadius:6, padding:'5px 8px', fontSize:12, width:'100%', boxSizing:'border-box' };
const ENEMIES_KEY = 'runeterra_mj_enemies';
let _enemySeq = 0;
function newEnemyId() { return 'enemy_' + Date.now().toString(36) + '_' + (_enemySeq++); }
function makeEnemy(name) {
  return { id: newEnemyId(), name: name || 'Ennemi', hpCur: 100, hpMax: 100, manaCur: 0, manaMax: 0, atk: 10 };
}
function loadEnemies() {
  try { const a = JSON.parse(localStorage.getItem(ENEMIES_KEY) || '[]'); return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}
function useMJEnemies() {
  const [enemies, setEnemies] = useState(loadEnemies);
  const persist = (next) => { setEnemies(next); try { localStorage.setItem(ENEMIES_KEY, JSON.stringify(next)); } catch (e) {} };
  const addEnemy = (name) => persist([...enemies, makeEnemy(name)]);
  const updateEnemy = (id, patch) => persist(enemies.map(e => e.id === id ? { ...e, ...patch } : e));
  const removeEnemy = (id) => persist(enemies.filter(e => e.id !== id));
  return { enemies, addEnemy, updateEnemy, removeEnemy };
}

/* Fusionne la définition du perso (règles) avec son état live (Firebase). */
function mjLive(c, st) {
  const buffs = st ? Object.keys(st.buffs || {}) : (c.buffs || []);
  const itemMods = st ? sumItemMods(st.equipment, st.inventory) : {};
  const runesSt  = (st && st.runes) || {};
  const runeMods = st ? sumRuneMods(Object.keys(runesSt.selected || {}).filter(id => runesSt.selected[id]),
    runesSt.choices || {}, buildRuneIndex(RUNES)) : {};
  const eff = computeEffective(c.stats, st ? st.modifiers : c.modifiers, buffs, mergeMods(itemMods, runeMods));
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
    <div className="panel" style={{ display:'flex', flexDirection:'column',
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

function MJPage({ go }) {
  const all = useAllCharStates();
  const [selected, setSelected] = useState('rathael');
  const [full, setFull] = useState(null);
  const { enemies, addEnemy, updateEnemy, removeEnemy } = useMJEnemies();
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
          <div className="row gap-2">
            <ExportImportPanel />
          </div>
        </div>
        <div style={{ flex:1, overflow:'auto', padding:24 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:16, alignItems:'start', paddingBottom:8 }}>
            {CHARACTERS.map(c => <MJCompactCard key={c.id} c={c} st={stOf(c.id)} onFull={() => setFull(c)} />)}
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
