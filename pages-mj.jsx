/* ============================================================
   PAGE — VUE MJ (TABLEAU DE BORD)   [page clé]
   Sidebar joueurs + grille de fiches compactes, temps réel.
   ============================================================ */

/* --- Ennemis : `useMJEnemies` migré en Firebase partagé (voir data-state.jsx). --- */
// Style de champ (le projet n'a pas de classe CSS d'input ; cf. InvItemRow).
const ENEMY_FLD = { background:'var(--bg-inset)', color:'var(--ink)', border:'1px solid var(--line-strong)', borderRadius:6, padding:'5px 8px', fontSize:12, width:'100%', boxSizing:'border-box' };

/* Compteur de tour : migré en `useSharedTurn` (Firebase, partagé) — voir data-state.jsx. */

/* Fusionne la définition du perso (règles) avec son état live (Firebase). */
function mjLive(c, st, turn) {
  const buffs = st ? Object.keys(st.buffs || {}) : (c.buffs || []);
  const itemMods = st ? sumItemMods(st.equipment, st.inventory) : {};
  const runesSt  = (st && st.runes) || {};
  const runeMods = st ? sumRuneMods(Object.keys(runesSt.selected || {}).filter(id => runesSt.selected[id]),
    runesSt.choices || {}, buildRuneIndex(RUNES)) : {};
  const effLevel = (st && st.level != null ? st.level : c.level) || 1;
  const base = charBaseStats(c, st);
  const passiveMods = st ? sumPassiveMods(c.id, st.counters || {}, effLevel, base) : {};
  const skillBuffMods = st ? sumSkillBuffs(st.skillBuffs || {}, turn) : {};
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
  const L = mjLive(c, st, turn);
  const toast = useToast();
  const [xpIn, setXpIn] = useState('');
  const [purse, setPurse] = useState(false);   // éditeur de bourse (MJ)
  const effLevel = (st && st.level != null ? st.level : c.level) || 1;
  const coins = (st && st.coins) || c.coins || { plat:0, or:0, arg:0, cuiv:0 };
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
  // Poids : l'armure équipée est allégée par le Mental (même règle que carriedWeight).
  const invEquip = (st && st.equipment) || {};
  const invMental = (st && st.attrs && st.attrs.mental != null) ? st.attrs.mental : ((c.attrs && c.attrs.mental) || 0);
  const invEffW = (it) => (invEquip.armure && invEquip.armure === it.id)
    ? armorEffectiveWeight(it.weight, invMental) : null;
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
          <button className="btn btn-sm btn-ghost" title="Retirer de l'XP" onClick={async () => {
            const n = Math.max(0, parseInt(xpIn, 10) || 0); if (!n) return;
            const res = await removeXp(c.id, n);
            if (res.levelsLost > 0) toast(`<b>${c.name}</b> redescend niveau <b>${res.level}</b>.`, 'debuff');
            setXpIn('');
          }}>− XP</button>
        </div>
      </div>
      {/* bourse — lecture live + édition libre MJ (valeurs absolues, ajout comme retrait) */}
      <div className="row gap-2" style={{ padding:'0 16px 12px', alignItems:'center', flexWrap:'wrap' }}>
        {INV_COINS.map(cn => (
          <div key={cn.key} className="row" style={{ alignItems:'center', gap:3 }} title={cn.label}>
            <CoinIcon coin={cn} size={20} />
            <span className="mono" style={{ fontSize:12, color:cn.col }}>{invFmt(coins[cn.key])}</span>
          </div>
        ))}
        <div style={{ flex:1 }} />
        <button className="btn btn-sm btn-ghost" title="Modifier la bourse" onClick={() => setPurse(true)}>💰 Bourse</button>
      </div>
      {purse && (
        <CoinEditor title={`Bourse — ${c.name}`} coins={coins} onClose={() => setPurse(false)}
          onApply={(patch) => {
            setCharCoins(c.id, patch);
            toast(`Bourse de <b>${c.name}</b> mise à jour`, 'gold');
          }} />
      )}
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
              <div className="tip-body"><b className="gold">{it.name}</b> ×{it.qty}<br/>{it.sub}
                {invWeightLabel(it, invEffW(it)) ? <React.Fragment><br/>⚖ {invWeightLabel(it, invEffW(it))}</React.Fragment> : null}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   INITIATIVE — panneau de la colonne MJ (lot 4)
   Règles : docs/superpowers/specs/2026-09-02-initiative-creneaux-design.md
   ============================================================ */

/* Pastille de camp : PJ (or) / allié (vert) / ennemi (rouge). */
const INI_SIDE_COLOR = { pj: 'var(--gold)', ally: 'var(--buff)', enemy: 'var(--debuff)' };

/* Score en clair : « 4+1 » / « 4−1 » / « 4 » (spec §2.1 — deux champs, total dérivé). */
function iniScoreLabel(entry) {
  if (!entry || entry.d6 == null) return '—';
  const b = entry.bonus | 0;
  return String(entry.d6) + (b > 0 ? '+' + b : b < 0 ? '−' + Math.abs(b) : '');
}

/* Une ligne de combattant dans un créneau.
   - le NOM bascule la déclaration de fin de tour (le MJ coche pour tout le monde) ;
   - le SCORE ouvre le placement direct dans un autre créneau.
   Un non-participant (KO avant l'ouverture du créneau, spec §2.3) est atténué et son
   nom n'est PAS cliquable : il est sauté automatiquement, lui mettre « fin de tour »
   n'aurait aucun sens. */
function IniRow({ id, meta, entry, isDone, participant, onToggle, onDragStart, onEditScore }) {
  const m = meta[id] || { name: id, side: 'enemy' };
  const nameTitle = !participant
    ? 'Hors combat pour ce créneau (à terre avant son ouverture) — passé automatiquement'
    : isDone ? 'A terminé son tour — cliquer pour annuler' : 'Marquer comme ayant fini';
  return (
    <div draggable onDragStart={onDragStart}
      style={{ display:'flex', alignItems:'center', gap:6, width:'100%',
        padding:'4px 6px', borderRadius:6, cursor:'grab', opacity: participant ? 1 : 0.45 }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
      <span style={{ width:6, height:6, borderRadius:'50%', flexShrink:0,
        background: INI_SIDE_COLOR[m.side] || 'var(--debuff)' }} />
      <button onClick={participant ? onToggle : undefined} title={nameTitle}
        style={{ flex:1, minWidth:0, textAlign:'left', background:'transparent', border:'none', padding:0,
          cursor: participant ? 'pointer' : 'default', fontSize:12.5,
          color: isDone ? 'var(--ink-faint)' : 'var(--ink)',
          textDecoration: isDone ? 'line-through' : 'none',
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
        {m.name}
      </button>
      <button className="mono" onClick={onEditScore} title="Dé + bonus — cliquer pour changer de créneau"
        style={{ fontSize:10.5, flexShrink:0, background:'var(--bg-inset)', border:'1px solid var(--line)',
          borderRadius:4, padding:'1px 5px', color:'var(--gold-pale)', cursor:'pointer' }}>
        {iniScoreLabel(entry)}
      </button>
      <span className="mono" style={{ fontSize:11, flexShrink:0, width:10, textAlign:'center',
        color: isDone ? 'var(--buff-bright)' : 'var(--ink-faint)' }}>
        {!participant ? '·' : isDone ? '✓' : '…'}
      </span>
    </div>
  );
}

/* Éditeur de score. DEUX entrées pour la même grandeur, parce qu'elles répondent à deux
   intentions différentes du MJ (spec §2.1) :
   - « Bonus » = le champ RÉEL du modèle — préparation au combat (−2…+2), potion, buff
     de clerc. C'est ce que le MJ pose avant ou pendant le combat.
   - « Créneau » = confort : on vise un emplacement, l'app en déduit le bonus.
   Les deux écrivent `bonus` et jamais `d6` : le dé appartient au joueur. */
function IniScoreEditor({ entry, onSetBonus, onCancel, joinRound, round, onSetJoinRound }) {
  const d6 = entry && entry.d6 != null ? entry.d6 : null;
  const bonus0 = (entry && entry.bonus | 0) || 0;
  const join0 = joinRound == null ? '' : String(Math.max(1, joinRound | 0));
  const [b, setB] = useState(String(bonus0));
  const [slot, setSlot] = useState(String(d6 != null ? d6 + bonus0 : ''));
  const [j, setJ] = useState(join0);
  const bn = parseInt(b, 10);
  const sn = parseInt(slot, 10);
  const jn = parseInt(j, 10);
  const commitBonus = () => { onSetBonus(Number.isFinite(bn) ? bn : 0); };
  const commitSlot  = () => { if (d6 != null && Number.isFinite(sn)) onSetBonus(sn - d6); else onCancel(); };
  // Champ vide (ou <= round courant) = present des le debut : on efface la cle plutot
  // que d'ecrire un round depasse, pour que le noeud reste propre.
  const commitJoin  = () => { onSetJoinRound(Number.isFinite(jn) && jn > 1 ? jn : null); };
  const fld = { ...ENEMY_FLD, width:46, padding:'2px 5px', fontSize:11 };
  return (
    <div className="col" style={{ gap:3, padding:'2px 6px 7px 18px' }}>
      <div className="row gap-1" style={{ alignItems:'center' }}>
        <span className="overline" style={{ fontSize:9, width:44 }} title="Préparation au combat, potion, buff…">Bonus</span>
        <input value={b} autoFocus onChange={e => setB(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commitBonus(); if (e.key === 'Escape') onCancel(); }}
          style={fld} />
        <button className="btn btn-sm btn-ghost" onClick={commitBonus} style={{ padding:'1px 5px', fontSize:11, color:'var(--buff-bright)' }}>✓</button>
        <span className="mono faint" style={{ fontSize:9.5 }}>
          {d6 != null ? `→ créneau ${d6 + (Number.isFinite(bn) ? bn : 0)}` : 'dé non lancé'}
        </span>
      </div>
      {d6 != null && (
        <div className="row gap-1" style={{ alignItems:'center' }}>
          <span className="overline" style={{ fontSize:9, width:44 }} title="Placer directement dans ce créneau">Créneau</span>
          <input value={slot} onChange={e => setSlot(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitSlot(); if (e.key === 'Escape') onCancel(); }}
            style={fld} />
          <button className="btn btn-sm btn-ghost" onClick={commitSlot} style={{ padding:'1px 5px', fontSize:11, color:'var(--buff-bright)' }}>✓</button>
          <span className="mono faint" style={{ fontSize:9.5 }}>
            dé {d6} → bonus {Number.isFinite(sn) ? (sn - d6 >= 0 ? '+' : '−') + Math.abs(sn - d6) : bonus0}
          </span>
        </div>
      )}
      {/* Arrivee tardive (spec §2.4) : un renfort lance son de tout de suite mais n'entre
          qu'au ROUND ENTIER suivant, pour ne pas surgir en amont de joueurs ayant deja agi.
          Le bouton ⏳ pose le cas courant d'un clic ; le champ sert aux cas prevus a l'avance. */}
      <div className="row gap-1" style={{ alignItems:'center' }}>
        <span className="overline" style={{ fontSize:9, width:44 }}
          title="Round a partir duquel ce combattant entre en jeu (renfort arrive en cours de combat)">Entrée</span>
        <input value={j} onChange={e => setJ(e.target.value)} placeholder="1"
          onKeyDown={e => { if (e.key === 'Enter') commitJoin(); if (e.key === 'Escape') onCancel(); }}
          style={fld} />
        <button className="btn btn-sm btn-ghost" onClick={commitJoin} style={{ padding:'1px 5px', fontSize:11, color:'var(--buff-bright)' }}>✓</button>
        <button className="btn btn-sm btn-ghost" title={'Renfort : entre au round ' + (round + 1)}
          onClick={() => { setJ(String(round + 1)); onSetJoinRound(round + 1); }}
          style={{ padding:'1px 5px', fontSize:11 }}>⏳</button>
        <span className="mono faint" style={{ fontSize:9.5 }}>
          {Number.isFinite(jn) && jn > round ? `round ${jn}` : 'en jeu'}
        </span>
      </div>
    </div>
  );
}

function InitiativePanel({ ini, meta, ids, turn }) {
  const toast = useToast();
  const { state, scores, done, joinRound, roll, setDone, setBonus, validate, refuse,
    setJoinRound, forceSlot } = ini;
  const [drag, setDrag] = useState(null);
  const [placing, setPlacing] = useState(null);   // id dont on édite le créneau

  /* Retardataire : son score peut être validé, il n'entre qu'à un round ultérieur
     (spec §2.4). `initiativeSlots` l'exclut donc des créneaux — sans cette liste il
     serait invisible à l'écran, et le MJ n'aurait plus aucun moyen de le corriger. */
  const lateRound = (id) => {
    const r = combatantJoinRound({ joinRound: joinRound[id] });
    return r > turn ? r : null;
  };
  // Combattants hors créneaux : score non validé (spec §2.1.bis) ou entrée différée.
  const waiting = ids.filter(id => initiativeStatus(scores[id]) !== 'ok' || lateRound(id));

  /* Déposer un combattant sur un créneau = l'y déplacer. Comme le total est dérivé
     (d6 + bonus) et que le dé appartient au joueur, on ajuste le BONUS — ce qui se
     lit très bien : le MJ corrige la circonstance, pas le jet. */
  const dropOn = (init) => {
    if (!drag) return;
    const e = scores[drag] || {};
    if (e.d6 == null) { toast('Ce combattant n’a pas encore lancé son dé', 'gold'); setDrag(null); return; }
    setBonus(drag, init - e.d6);
    setDrag(null);
  };

  return (
    <div className="col" style={{ minHeight:0, flex:1, borderTop:'1px solid var(--line)' }}>
      <div className="row" style={{ justifyContent:'space-between', alignItems:'center', padding:'10px 12px 6px' }}>
        <span className="overline">Ordre des tours</span>
        <span className="mono faint" style={{ fontSize:10.5 }}>Round {turn}</span>
      </div>

      <div className="col gap-1" style={{ padding:'0 8px 8px', overflowY:'auto', flex:1, minHeight:0 }}>
        {/* --- Jets en attente de validation --- */}
        {waiting.length > 0 && (
          <div style={{ marginBottom:6 }}>
            <div className="overline" style={{ fontSize:9.5, padding:'0 4px 4px', color:'var(--ink-faint)' }}>
              En attente ({waiting.length})
            </div>
            {waiting.map(id => {
              const m = meta[id] || { name:id, side:'enemy' };
              const e = scores[id] || {};
              const st = initiativeStatus(e);
              const late = lateRound(id);
              return (
                <React.Fragment key={id}>
                  <div className="row" style={{ alignItems:'center', gap:6, padding:'3px 4px' }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', flexShrink:0,
                    background: INI_SIDE_COLOR[m.side] || 'var(--debuff)' }} />
                  <span style={{ flex:1, minWidth:0, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</span>
                  {late && (
                    <button className="mono" onClick={() => setPlacing(placing === id ? null : id)}
                      title={'Renfort : entre en jeu au round ' + late + ' — cliquer pour changer'}
                      style={{ fontSize:9.5, flexShrink:0, background:'var(--bg-inset)', border:'1px solid var(--line)',
                        borderRadius:4, padding:'1px 4px', color:'var(--ink-faint)', cursor:'pointer' }}>
                      ⏳R{late}
                    </button>
                  )}
                  {st === 'pending' ? (
                    <span className="row gap-1" style={{ flexShrink:0, alignItems:'center' }}>
                      <span className="mono" style={{ fontSize:11.5, color:'var(--gold-pale)' }}>🎲{e.d6}</span>
                      <button className="btn btn-sm btn-ghost" title="Valider ce jet" style={{ padding:'1px 5px', fontSize:11, color:'var(--buff-bright)' }}
                        onClick={() => validate(id).then(join => {
                          // Le decalage au round suivant est automatique (spec §2.4) : on le DIT,
                          // sinon le MJ croit son renfort en jeu et le cherche dans les creneaux.
                          if (join != null) toast(`<b>${m.name}</b> entre en jeu au round ${join}`, 'gold');
                        })}>✓</button>
                      <button className="btn btn-sm btn-ghost" title="Refuser — le joueur relance" style={{ padding:'1px 5px', fontSize:11, color:'var(--debuff-bright)' }}
                        onClick={() => refuse(id)}>✗</button>
                    </span>
                  ) : (
                    <span className="row gap-1" style={{ flexShrink:0, alignItems:'center' }}>
                      <button className="mono" onClick={() => setPlacing(placing === id ? null : id)}
                        title={st === 'ok' ? 'Score validé — cliquer pour ajuster' : "Bonus d'initiative (préparation, potion, buff) — se pose avant le jet"}
                        style={{ fontSize:10, background:'var(--bg-inset)', border:'1px solid var(--line)',
                          borderRadius:4, padding:'1px 4px', color:'var(--gold-pale)', cursor:'pointer' }}>
                        {st === 'ok'
                          ? iniScoreLabel(e)
                          : (e.bonus | 0) > 0 ? '+' + (e.bonus | 0) : (e.bonus | 0) < 0 ? '−' + Math.abs(e.bonus | 0) : '±0'}
                      </button>
                      {st !== 'ok' && (
                        <button className="btn btn-sm btn-ghost" style={{ padding:'1px 6px', fontSize:10.5 }}
                          title={st === 'reroll' ? 'Relance demandée — lancer à sa place' : 'Lancer le dé'}
                          onClick={() => roll(id)}>
                          {st === 'reroll' ? '↻' : '🎲'}
                        </button>
                      )}
                    </span>
                  )}
                  </div>
                  {placing === id && (
                    <IniScoreEditor entry={e} round={turn} joinRound={joinRound[id]}
                      onSetBonus={(n) => { setBonus(id, n); setPlacing(null); }}
                      onSetJoinRound={(r) => setJoinRound(id, r)}
                      onCancel={() => setPlacing(null)} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* --- Les créneaux --- */}
        {state.slots.length === 0
          ? <div className="faint" style={{ fontSize:11.5, padding:'4px 6px' }}>
              Aucun combattant n’a d’initiative validée.
            </div>
          : state.slots.map(slot => {
              const isActive = state.activeInit === slot.init;
              return (
                <div key={slot.init}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); dropOn(slot.init); }}
                  style={{ borderRadius:7, marginBottom:3, padding:'4px 3px',
                    border:'1px solid ' + (isActive ? 'var(--line-gold)' : 'transparent'),
                    background: isActive ? 'var(--bg-panel-2)' : 'transparent' }}>
                  <div className="row" style={{ justifyContent:'space-between', alignItems:'center', padding:'0 5px 3px' }}>
                    <span className="mono" style={{ fontSize:11, color: isActive ? 'var(--gold-pale)' : 'var(--ink-faint)' }}>
                      {isActive ? '▶ ' : ''}Créneau {slot.init}
                    </span>
                    {slot.complete && <span className="mono" style={{ fontSize:10, color:'var(--buff-bright)' }}>terminé</span>}
                  </div>
                  {slot.members.map(id => (
                    <React.Fragment key={id}>
                      <IniRow id={id} meta={meta} entry={scores[id]}
                        isDone={done[id] === true}
                        participant={slot.participants.indexOf(id) !== -1}
                        onToggle={() => setDone(id, done[id] !== true)}
                        onDragStart={() => setDrag(id)}
                        onEditScore={() => setPlacing(placing === id ? null : id)} />
                      {placing === id && (
                        <IniScoreEditor entry={scores[id]} round={turn} joinRound={joinRound[id]}
                          onSetBonus={(n) => { setBonus(id, n); setPlacing(null); }}
                          onSetJoinRound={(r) => setJoinRound(id, r)}
                          onCancel={() => setPlacing(null)} />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              );
            })}
      </div>

      {/* --- Filet du MJ : un absent ne doit pas geler la table --- */}
      {state.active && state.active.pending.length > 0 && (
        <div style={{ padding:'6px 10px 10px' }}>
          <button className="btn btn-ghost btn-sm" style={{ width:'100%', justifyContent:'center', fontSize:11 }}
            title="Marque comme terminés tous ceux qui restent en attente sur le créneau actif"
            onClick={forceSlot}>
            ⏭ Forcer la fin du créneau ({state.active.pending.length})
          </button>
        </div>
      )}
    </div>
  );
}


/* Assistant « caracs -> stats » (lot 6). Les champs plats restent la SOURCE DE VERITE :
   ce panneau ne fait que les pre-remplir depuis les 4 caracteristiques, via le meme
   moteur que les PJ (`computeStats`). Le MJ genere, puis corrige a la main s'il veut un
   monstre qui n'obeit a aucune arithmetique. Les caracs sont conservees sur l'ennemi
   pour pouvoir regenerer apres un ajustement de niveau. */
function NpcStatGenerator({ enemy, onUpdate }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const a0 = enemy.attrs || { force:0, hab:0, mental:0, magie:0 };
  const [a, setA] = useState({ force:a0.force|0, hab:a0.hab|0, mental:a0.mental|0, magie:a0.magie|0 });
  const [lvl, setLvl] = useState(String(enemy.npcLevel || 1));
  const level = Math.max(1, parseInt(lvl, 10) || 1);
  const preview = npcStatsFromAttrs(a, level);
  const num = (v) => Math.max(0, parseInt(v, 10) || 0);
  const fld = { ...ENEMY_FLD, width:48, padding:'3px 5px', fontSize:11 };

  if (!open) {
    return (
      <button className="btn btn-sm btn-ghost" onClick={() => setOpen(true)}
        style={{ alignSelf:'flex-start', fontSize:11 }}
        title="Pré-remplir les stats depuis Force / Habileté / Mental / Magie">
        ⚙ Générer depuis les caractéristiques
      </button>
    );
  }
  return (
    <div className="col gap-2" style={{ padding:10, borderRadius:8, background:'var(--bg-inset)', border:'1px solid var(--line)' }}>
      <div className="row" style={{ justifyContent:'space-between', alignItems:'center' }}>
        <span className="overline">Générer depuis les caractéristiques</span>
        <button className="btn btn-sm btn-ghost" onClick={() => setOpen(false)} style={{ padding:'1px 6px', fontSize:11 }}>✗</button>
      </div>
      <div className="row wrap gap-2">
        {[['force','Force'],['hab','Habileté'],['mental','Mental'],['magie','Magie']].map(([k, lbl]) => (
          <label key={k} className="col" style={{ gap:3 }}>
            <span className="overline" style={{ fontSize:9 }}>{lbl}</span>
            <input style={fld} value={a[k]} onChange={e => setA(s => ({ ...s, [k]: num(e.target.value) }))} />
          </label>
        ))}
        <label className="col" style={{ gap:3 }}>
          <span className="overline" style={{ fontSize:9 }}>Niveau</span>
          <input style={fld} value={lvl} onChange={e => setLvl(e.target.value)} />
        </label>
      </div>
      <div className="mono faint" style={{ fontSize:10.5, lineHeight:1.5 }}>
        PV {preview.hpMax} · Mana {preview.manaMax} · Atq {preview.atk} · Arm {preview.armure} ·
        RM {preview.resmag} · Crit {preview.crit}% · DCrit {preview.dcrit}% · RCrit {preview.rescrit}%
      </div>
      <button className="btn btn-sm btn-gold" style={{ alignSelf:'flex-start' }}
        onClick={() => {
          onUpdate(enemy.id, Object.assign({}, preview, { attrs: a, npcLevel: level }));
          toast(`<b>${enemy.name}</b> — stats générées (niveau ${level})`, 'buff');
          setOpen(false);
        }}>
        Appliquer aux champs
      </button>
      <span className="faint" style={{ fontSize:10 }}>
        Écrase PV, mana, attaque, armure, rés. mag., crit, dég. crit et rés. crit. L'attaque prend la
        plus élevée de AD/AP. Au-delà de 20 points, l'escalade passe en zone PNJ.
      </span>
    </div>
  );
}

function EnemyCard({ enemy, onUpdate, onRemove, onAttack, stampKo }) {
  const [edit, setEdit] = useState(false);
  const [subir, setSubir] = useState('');
  const danger = enemy.hpMax > 0 && (enemy.hpCur / enemy.hpMax) * 100 < 40;
  const ally = isAlly(enemy);
  const num = (v) => Math.max(0, parseInt(v, 10) || 0);
  const applySubir = () => {
    const n = num(subir);
    if (n <= 0) return;
    const nhp = Math.max(0, enemy.hpCur - n);
    onUpdate(enemy.id, { hpCur: nhp });
    if (stampKo) stampKo(enemy.id, enemy.hpCur, nhp);   // KO differe (spec §4.2)
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
        <div className="row gap-2" style={{ alignItems:'center', flexWrap:'wrap' }}>
          <span className="overline" title="Camp du combattant">Camp</span>
          {[['enemy','Ennemi'],['ally','Allié']].map(([s, lbl]) => (
            <button key={s} className={'btn btn-sm ' + (combatantSide(enemy) === s ? 'btn-gold' : 'btn-ghost')}
              onClick={() => onUpdate(enemy.id, { side: s })} style={{ padding:'3px 9px', fontSize:11 }}>{lbl}</button>
          ))}
        </div>
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
          {field('% Rés. Crit', 'rescrit')}
          {field('Léth. phys.', 'lethaAD')}
          {field('Léth. mag.', 'lethaAP')}
        </div>
        <NpcStatGenerator enemy={enemy} onUpdate={onUpdate} />
        <div className="row gap-2" style={{ justifyContent:'flex-end' }}>
          <button className="btn btn-sm btn-ghost" onClick={() => onRemove(enemy.id)} style={{ marginRight:'auto', color:'var(--debuff-bright)' }}>Supprimer</button>
          <button className="btn btn-sm btn-gold" onClick={() => setEdit(false)}>OK</button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel" style={{ display:'flex', flexDirection:'column',
      borderColor: danger ? 'rgba(200,48,42,.45)' : 'var(--line)',
      // Liseré de camp APRÈS borderColor : il doit gagner sur le bord gauche.
      borderLeft: '3px solid ' + (ally ? 'var(--buff)' : 'var(--debuff)') }}>
      <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontFamily:'var(--font-display)', fontSize:15, color:'var(--gold-pale)', flex:1, minWidth:0 }}>{enemy.name}</span>
        {ally && <span className="badge" style={{ background:'rgba(30,122,79,.16)', color:'var(--buff-bright)', border:'1px solid rgba(52,199,127,.35)' }}>Allié</span>}
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

function EnemyAttackModal({ enemy, enemies, stOf, turn, onClose, stampKo }) {
  const toast = useToast();
  const baseAtk = Math.max(0, enemy.atk || 0);
  // Crit roulé par l'app à l'ouverture (mirroir du flux joueur). Le MJ ajuste le montant si besoin.
  const [cr, setCr] = useState(() => rollCrit(enemy.crit || 0, enemy.dcrit || 200));
  const [type, setType] = useState('physique');
  const [lethaAD, setLethaAD] = useState(String(enemy.lethaAD != null ? enemy.lethaAD : (enemy.letha || 0)));
  const [lethaAP, setLethaAP] = useState(String(enemy.lethaAP || 0));
  const [targetId, setTargetId] = useState(CHARACTERS[0] ? CHARACTERS[0].id : '');
  // Résistance critique de la CIBLE (PJ via ses stats effectives, PNJ via son champ).
  // La cible est modifiable dans ce modal : la suggestion doit suivre le changement.
  const tgtRescrit = (() => {
    const npc = (enemies || []).find(x => x.id === targetId);
    if (npc) return npc.rescrit || 0;
    const c = CHARACTERS.find(x => x.id === targetId);
    if (!c) return 0;
    const L = mjLive(c, stOf(c.id), turn);
    return (L.eff && L.eff.rescrit) || 0;
  })();
  const redMult = critMultAfterResist(cr.multiplier, tgtRescrit);
  const critAtk = Math.round(baseAtk * redMult);
  const suggested = cr.didCrit ? critAtk : baseAtk;
  const [amount, setAmount] = useState(String(suggested));
  // Le champ suit la suggestion tant que le MJ n'y a pas touché ; dès qu'il saisit son
  // d20 ajusté, on ne l'écrase plus (changer de cible ne doit pas effacer sa saisie).
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (!touched) setAmount(String(suggested)); }, [suggested, touched]);
  const info = critInfo(enemy.crit || 0);
  const reroll = () => { setCr(rollCrit(enemy.crit || 0, enemy.dcrit || 200)); setTouched(false); };

  const submit = () => {
    const raw = Math.max(0, parseInt(amount, 10) || 0);
    // Léthalité selon le type : AD (armure) si physique, AP (rés. mag) si magique, rien en brut.
    const lethaNum = Math.max(0, type === 'physique' ? (parseInt(lethaAD, 10) || 0) : type === 'magique' ? (parseInt(lethaAP, 10) || 0) : 0);
    if (raw <= 0) { onClose(); return; }
    // La cible peut etre un PNJ (ennemi, allie, ou l'attaquant lui-meme) : les degats
    // s'appliquent alors sur combat/enemies et non sur une fiche de PJ.
    const npc = (enemies || []).find(x => x.id === targetId);
    if (npc) {
      const r = applyHitToEnemy(npc, raw, type, lethaNum);
      if (stampKo) stampKo(npc.id, npc.hpCur, r.hpCur);
      const critTagN = cr.didCrit ? (' 🎲 CRIT' + (tgtRescrit > 0 ? ` −${tgtRescrit}% R.Crit` : '')) : '';
      const lethaTagN = lethaNum > 0 ? `, léth. ${type === 'magique' ? 'mag.' : 'phys.'} ${lethaNum}` : '';
      const selfTag = npc.id === enemy.id ? ' (sur lui-même)' : '';
      toast(`<b>${enemy.name}</b> inflige <b>${r.applied}</b> (${type}${critTagN}) à <b>${npc.name}</b>${selfTag}${r.hpCur === 0 ? ' — KO !' : ''}`,
        r.hpCur === 0 ? 'debuff' : 'gold');
      pushLog(`<b>${enemy.name}</b> inflige <b>${r.applied}</b> (${type}${critTagN}${lethaTagN}) à <b>${npc.name}</b>${selfTag}${r.hpCur === 0 ? ' — KO !' : ''}`,
        r.hpCur === 0 ? 'debuff' : 'gold');
      onClose();
      return;
    }
    const c = CHARACTERS.find(x => x.id === targetId);
    if (!c) { onClose(); return; }
    const st = stOf(c.id);
    const L = mjLive(c, st, turn);
    // Mitigation + pools + écriture + passif Glaciation : tout est dans l'orchestrateur
    // partagé avec la résolution des attaques joueur→joueur (data-state.jsx).
    const r = applyHitToCharacter(c.id, { armure: L.eff.armure, resmag: L.eff.resmag, hpCur: L.hp, shield: L.shield },
      raw, type, lethaNum, turn, st && st.counters);
    if (stampKo) stampKo(c.id, L.hp, r.hpCur);   // KO differe (spec §4.2)
    if (r.glaciation != null) pushLog(`<b>${c.name}</b> gagne une charge de Glaciation (${r.glaciation}/5)`, 'buff');
    const critTag = cr.didCrit ? (' 🎲 CRIT' + (tgtRescrit > 0 ? ` −${tgtRescrit}% R.Crit` : '')) : '';
    const lethaTag = lethaNum > 0 ? `, léth. ${type === 'magique' ? 'mag.' : 'phys.'} ${lethaNum}` : '';
    toast(`<b>${enemy.name}</b> inflige <b>${r.applied}</b> (${type}${critTag}) à <b>${c.name}</b>${r.ko ? ' — KO !' : ''}`,
      r.ko ? 'debuff' : 'gold');
    pushLog(`<b>${enemy.name}</b> inflige <b>${r.applied}</b> (${type}${critTag}${lethaTag}) à <b>${c.name}</b>${r.ko ? ' — KO !' : ''}`, r.ko ? 'debuff' : 'gold');
    onClose();
  };

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="panel" onClick={e => e.stopPropagation()} style={{ width:'min(420px,100%)', padding:18, display:'flex', flexDirection:'column', gap:14 }}>
        <h3 style={{ fontSize:17 }}>Attaque — {enemy.name}</h3>
        <div className="row gap-2 wrap" style={{ alignItems:'center', fontSize:11, color:'var(--ink-faint)' }}>
          <span>Base : <b>{baseAtk}</b></span>
          {cr.didCrit
            ? <span className="mono" style={{ color:'var(--skillbuff)' }}>
                🎲 CRIT ×{cr.multiplier.toFixed(2)}
                {tgtRescrit > 0 && <span className="faint"> − R.Crit {tgtRescrit}% → ×{redMult.toFixed(2)}</span>} → <b>{critAtk}</b>
              </span>
            : <span className="mono faint">pas de crit</span>}
          <span className="faint">%Crit {enemy.crit || 0}{info.guaranteedTiers ? ` · ${info.guaranteedTiers} palier(s) garanti(s)` : ''}{info.extraChancePct ? ` · +${info.extraChancePct}%` : ''}</span>
          <button className="btn btn-sm btn-ghost" onClick={reroll} title="Relancer le jet de crit" style={{ padding:'2px 8px', fontSize:11 }}>🎲 relancer</button>
        </div>
        <div className="row gap-2" style={{ alignItems:'flex-end' }}>
          <label className="col" style={{ gap:4, flex:1 }}>
            <span className="overline">Dégâts</span>
            <input style={ENEMY_FLD} value={amount} onChange={e => { setTouched(true); setAmount(e.target.value); }} autoFocus />
          </label>
          <label className="col" style={{ gap:4, width:84 }} title="Léthalité physique — réduit l'armure de la cible (dégât physique)">
            <span className="overline" style={{ color: type === 'physique' ? 'var(--stat-phys)' : undefined }}>Léth. phys.</span>
            <input style={ENEMY_FLD} value={lethaAD} onChange={e => setLethaAD(e.target.value)} />
          </label>
          <label className="col" style={{ gap:4, width:84 }} title="Léthalité magique — réduit la résistance magique de la cible (dégât magique)">
            <span className="overline" style={{ color: type === 'magique' ? 'var(--stat-mag)' : undefined }}>Léth. mag.</span>
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
            <optgroup label="Joueurs">
              {CHARACTERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </optgroup>
            {(() => {
              // Un PNJ peut viser n'importe qui : l'autre camp, son propre camp, ou
              // lui-meme (degats de zone, sacrifice, controle mental...).
              const parts = splitCombatants(enemies || []);
              const grp = (label, list) => list.length === 0 ? null : (
                <optgroup label={label} key={label}>
                  {list.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.name}{e.id === enemy.id ? ' (lui-même)' : ''}{e.hpCur <= 0 ? ' — à terre' : ''}
                    </option>
                  ))}
                </optgroup>
              );
              return [grp('Ennemis', parts.enemies), grp('Alliés', parts.allies)];
            })()}
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

/* ============================================================
   ACTIONS EN ATTENTE — vue MJ (refonte du 2026-09-06)
   Une action = UNE carte encadrée, jamais des lignes éparses : c'est l'aide visuelle
   qui permet de repérer les instances d'une même compétence.
   Spec : docs/superpowers/specs/2026-09-06-actions-en-attente-design.md
   ============================================================ */

/* Repérage d'une instance : pastille + encre par nature d'effet. Miroir d'EFFECT_TONE
   (pages-competences) — le joueur et le MJ voient les mêmes couleurs. */
const INSTANCE_TONE = {
  damage: { ic: '🔴', ink: 'var(--hp)', label: 'Dégâts' },
  heal:   { ic: '🟢', ink: 'var(--buff)', label: 'Soin' },
  status: { ic: '🟠', ink: 'var(--skillbuff)', label: 'Effet' },
};

/* Une instance de DÉGÂTS : crit roulé par l'app, dégâts pré-remplis éditables (le MJ
   ajuste à son d20 de toucher) + type + léthalité. */
function DamageInstanceRow({ inst, target, onApply, onReject, head }) {
  // Résistance critique de la CIBLE, appliquée ici et pas au cast : le crit est roulé
  // côté joueur, mais seul le MJ voit la fiche de la cible visée.
  const rescrit = (target && target.rescrit) || 0;
  // Une cible PJ dont la fiche n'est pas encore arrivée de Firebase n'est pas résolvable :
  // ses pools seraient devinés (cf. `loaded` dans resolveTarget).
  const ready = !!target && (target.kind !== 'pj' || target.loaded);
  const critMult = inst.critMult || 1;
  const redMult = critMultAfterResist(critMult, rescrit);
  const critShown = inst.didCrit ? Math.round((inst.computedDmg || 0) * redMult) : null;
  const rolled = inst.didCrit ? critShown : inst.computedDmg;
  const [dmg, setDmg] = useState(String(rolled || 0));
  const [type, setType] = useState(inst.type || 'physique');
  // Deux léthalités snapshotées au cast ; le champ visible suit le type choisi par le MJ
  // (physique → réduit l'armure, magique → réduit la rés. magique, brut → sans objet).
  const [lethaP, setLethaP] = useState(String(inst.letha || 0));
  const [lethaM, setLethaM] = useState(String(inst.lethaMag || 0));
  const isBrut = type === 'brut';
  const isMag = type === 'magique';
  const lethaVal = isMag ? lethaM : lethaP;
  const setLethaVal = isMag ? setLethaM : setLethaP;
  const lethaNum = isBrut ? 0 : Math.max(0, parseInt(lethaVal, 10) || 0);
  const info = critInfo(inst.crit || 0);
  return (
    <div className="col" style={{ gap: 6, padding: '8px 0', borderTop: '1px solid var(--line)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <span style={{ fontSize: 13 }}>
          {head} <b style={{ color: 'var(--hp)' }}>Dégâts</b> →{' '}
          <b style={{ color: target && target.kind === 'pj' ? 'var(--gold-pale)' : undefined }}>
            {target ? target.name : '— cible disparue —'}
          </b>
          {target && target.kind === 'pj' && <span className="faint" style={{ fontSize: 11 }}> (joueur)</span>}
        </span>
        {inst.didCrit
          ? <span className="mono" style={{ fontSize: 11, color: 'var(--skillbuff)' }}>
              🎲 CRIT ×{critMult.toFixed(2)}
              {rescrit > 0 && <span className="faint"> − R.Crit {rescrit}% → ×{redMult.toFixed(2)}</span>}
            </span>
          : <span className="mono faint" style={{ fontSize: 11 }}>normal</span>}
      </div>
      <div className="row gap-2 wrap" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
        <span>Base : <b>{inst.computedDmg}</b></span>
        {critShown != null && <span>Crit : <b>{critShown}</b>{rescrit > 0 && <span className="faint"> (brut {inst.critDmg})</span>}</span>}
        <span>%Crit {inst.crit || 0}{info.guaranteedTiers ? ` · ${info.guaranteedTiers} palier(s) garanti(s)` : ''}{info.extraChancePct ? ` · +${info.extraChancePct}%` : ''}</span>
      </div>
      <div className="row gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <input style={{ ...ENEMY_FLD, width: 80 }} value={dmg} onChange={e => setDmg(e.target.value)} title="Dégâts (ajuste au d20 de toucher)" />
        <label className="row gap-1" style={{ alignItems: 'center', fontSize: 11, opacity: isBrut ? .4 : 1 }}
          title={isBrut ? 'Dégâts bruts : aucune mitigation, la léthalité ne sert pas'
            : (isMag ? 'Léthalité magique (réduit la rés. magique de la cible)'
                     : "Léthalité physique (réduit l'armure de la cible)")}>
          <span style={{ color: `var(--stat-${isMag ? 'mag' : 'phys'})`, fontWeight: 600 }}>
            {isMag ? 'Léth. mag.' : 'Léth. phys.'}
          </span>
          <input style={{ ...ENEMY_FLD, width: 56 }} value={isBrut ? '0' : lethaVal} disabled={isBrut}
            onChange={e => setLethaVal(e.target.value)} />
        </label>
        <div className="row gap-1">
          {['physique', 'magique', 'brut'].map(t => (
            <button key={t} className={'btn btn-sm ' + (type === t ? 'btn-gold' : 'btn-ghost')} onClick={() => setType(t)} style={{ textTransform: 'capitalize' }}>{t}</button>
          ))}
        </div>
        <button className="btn btn-sm btn-gold" disabled={!ready}
          title={target && !ready ? 'Fiche du joueur pas encore chargée' : ''}
          onClick={() => onApply(inst, target, Math.max(0, parseInt(dmg, 10) || 0), type, lethaNum)}
          style={{ marginLeft: 'auto' }}>Appliquer</button>
        <button className="btn btn-sm btn-ghost" onClick={() => onReject(inst)} title="Retirer cette instance">✕</button>
      </div>
    </div>
  );
}

/* Une instance de SOIN : un simple remplissage de pool, plafonné au max de la cible.
   Ni armure, ni critique, ni léthalité — d'où une ligne bien plus courte que les dégâts. */
function HealInstanceRow({ inst, target, onApply, onReject, head }) {
  const [amount, setAmount] = useState(String(inst.amount || 0));
  const ready = !!target && (target.kind !== 'pj' || target.loaded);
  return (
    <div className="row gap-2" style={{ alignItems: 'center', flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--line)' }}>
      <span style={{ fontSize: 13, flex: '1 1 180px' }}>
        {head} <b style={{ color: 'var(--buff)' }}>Soin</b> →{' '}
        <b style={{ color: target && target.kind === 'pj' ? 'var(--gold-pale)' : undefined }}>
          {target ? target.name : '— cible disparue —'}
        </b>
      </span>
      <input style={{ ...ENEMY_FLD, width: 80 }} value={amount} onChange={e => setAmount(e.target.value)} title="Soin (ajustable)" />
      <button className="btn btn-sm btn-gold" disabled={!ready}
        title={target && !ready ? 'Fiche du joueur pas encore chargée' : ''}
        onClick={() => onApply(inst, target, Math.max(0, parseInt(amount, 10) || 0))}
        style={{ marginLeft: 'auto' }}>Appliquer</button>
      <button className="btn btn-sm btn-ghost" onClick={() => onReject(inst)} title="Retirer cette instance">✕</button>
    </div>
  );
}

/* Une instance de STATUT : buff, bouclier, compteurs, transformation — ou un effet
   purement narratif, auquel cas « Appliquer » vaut accusé de réception et n'écrit rien. */
function StatusInstanceRow({ inst, target, onApply, onReject, head }) {
  const ready = !!target && (target.kind !== 'pj' || target.loaded);
  return (
    <div className="row gap-2" style={{ alignItems: 'flex-start', flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--line)' }}>
      <div className="col" style={{ gap: 2, flex: '1 1 220px', minWidth: 0 }}>
        <span style={{ fontSize: 13 }}>
          {head} <b style={{ color: 'var(--skillbuff)' }}>{inst.narrative ? 'En table' : 'Effet'}</b> →{' '}
          <b>{target ? target.name : '— cible disparue —'}</b>
        </span>
        <span className="faint" style={{ fontSize: 11.5, lineHeight: 1.4 }}>{inst.label}</span>
      </div>
      <button className="btn btn-sm btn-gold" disabled={!ready}
        title={inst.narrative ? 'Aucune écriture : accusé de réception'
          : (target && !ready ? 'Fiche du joueur pas encore chargée' : '')}
        onClick={() => onApply(inst, target)} style={{ marginLeft: 'auto' }}>
        {inst.narrative ? 'Valider' : 'Appliquer'}
      </button>
      <button className="btn btn-sm btn-ghost" onClick={() => onReject(inst)} title="Retirer cette instance">✕</button>
    </div>
  );
}

/* La carte d'une ACTION : en-tête (lanceur, compétence, coût, nombre d'instances),
   une ligne par instance, et le pied de décision. */
function PendingActionCard({ action, resolveTarget, color, onApply, onRejectInstance, onCancel, onFail }) {
  const insts = Object.values(action.instances || {}).sort((a, b) => (a.seq || 0) - (b.seq || 0));
  const n = insts.length;
  const refund = actionRefundPlan(action, 'cancel');
  const cost = action.cost || {};
  return (
    <div className="panel" style={{ borderLeft: `3px solid ${color || 'var(--gold)'}`, padding: '10px 14px' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
        <span style={{ fontSize: 13.5 }}>
          <b className="gold">{action.attackerName}</b> · <b>{action.skillName}</b>
        </span>
        <span className="row gap-2" style={{ alignItems: 'center' }}>
          {cost.mana > 0 && <span className="mono faint" style={{ fontSize: 11 }}>{cost.mana} mana</span>}
          {action.round ? <span className="mono faint" style={{ fontSize: 11 }}>R{action.round}</span> : null}
          <span className="badge" style={{ background: 'var(--bg-inset)', color: 'var(--gold-pale)' }}>
            {n} instance{n > 1 ? 's' : ''}
          </span>
        </span>
      </div>
      {insts.map((inst, i) => {
        const tone = INSTANCE_TONE[inst.kind] || INSTANCE_TONE.status;
        const head = <span className="mono" style={{ fontSize: 11, color: tone.ink }}>{tone.ic} {inst.seq || i + 1}/{n}</span>;
        const target = resolveTarget(inst.targetId);
        const common = { key: inst.id, inst, target, head, onReject: onRejectInstance };
        if (inst.kind === 'damage') return <DamageInstanceRow {...common} onApply={onApply} />;
        if (inst.kind === 'heal') return <HealInstanceRow {...common} onApply={onApply} />;
        return <StatusInstanceRow {...common} onApply={onApply} />;
      })}
      <div className="row gap-2 wrap" style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
        <button className="btn btn-sm btn-ghost" onClick={() => onCancel(action)}
          title={refund
            ? "Annule la compétence : mana et cooldown rendus au lanceur, toutes les instances retirées."
            : "Retire les instances restantes. Une instance a déjà été appliquée : la compétence a eu lieu, rien n'est remboursé."}>
          {refund ? '↺ Annuler la compétence' : '↺ Retirer le reste'}
        </button>
        <button className="btn btn-sm btn-ghost" onClick={() => onFail(action)}
          title="La compétence a bien été lancée mais ne produit rien (parade, contre, dissipation) : tout est retiré, RIEN n'est remboursé.">
          ⊘ Échec
        </button>
      </div>
    </div>
  );
}

function PendingActionsPanel({ enemies, stampKo, stOf, turn }) {
  const toast = useToast();
  const { actions, removeAction, resolveInstance } = usePendingActions();
  /* Une action vidée de ses instances ne doit pas rester en file. Le cas normal est
     couvert par `resolveInstance` (la dernière instance emporte le nœud), mais deux
     clics rapides peuvent le faire sur un instantané périmé et laisser une carte vide.
     ⚠️ Le filet est AVANT le `return null` : les hooks ne peuvent pas vivre après. */
  const live = actions.filter(a => Object.keys(a.instances || {}).length > 0);
  useEffect(() => {
    actions.forEach(a => { if (!Object.keys(a.instances || {}).length) removeAction(a.id); });
  }, [actions.length, live.length]);
  if (!live.length) return null;
  /* Une instance vise soit un PNJ (`combat/enemies`), soit un PJ. On rend un objet
     UNIFORME pour que les lignes n'aient pas à connaître les deux mondes.
     ⚠️ Un PJ coûte un `mjLive` (ses stats effectives, invisibles des autres joueurs) :
     c'est pour ça que la résolution ne peut se faire QUE chez le MJ. */
  const resolveTarget = (id) => {
    const e = enemies.find(x => x.id === id);
    if (e) return { kind: 'enemy', id, name: e.name, rescrit: e.rescrit || 0, enemy: e };
    const c = CHARACTERS.find(x => x.id === id);
    if (!c) return null;
    const st = stOf ? stOf(c.id) : null;
    const L = mjLive(c, st, turn);
    // ⚠️ `loaded` garde une ÉCRITURE, pas un affichage : sans état Firebase, `mjLive`
    // retombe sur les PV DE RÉFÉRENCE (c.hpCur est un RATIO, pas une valeur absolue).
    // Appliquer un coup à cet instant écraserait les vrais PV du joueur.
    return { kind: 'pj', id, name: c.name, rescrit: (L.eff && L.eff.rescrit) || 0, char: c, st, live: L, loaded: !!st };
  };

  const applyDamage = async (action, inst, target, finalDmg, type, letha) => {
    let r, hpBefore;
    if (target.kind === 'enemy') {
      hpBefore = target.enemy.hpCur;
      r = applyHitToEnemy(target.enemy, finalDmg, type, letha || 0);
    } else {
      const L = target.live;
      hpBefore = L.hp;
      r = applyHitToCharacter(target.id, { armure: L.eff.armure, resmag: L.eff.resmag, hpCur: L.hp, shield: L.shield },
        finalDmg, type, letha || 0, turn, (target.st || {}).counters);
      if (r.glaciation != null) pushLog(`<b>${target.name}</b> gagne une charge de Glaciation (${r.glaciation}/5)`, 'buff');
    }
    // KO differe (spec initiative §4.2) : on horodate la transition vivant -> a terre.
    if (stampKo) stampKo(target.id, hpBefore, r.hpCur);
    const lethaTag = letha > 0 ? `, léth. ${type === 'magique' ? 'mag.' : 'phys.'} ${letha}` : '';
    const txt = `<b>${action.attackerName}</b> inflige <b>${r.applied}</b> (${type}${lethaTag}) à <b>${target.name}</b>${r.hpCur === 0 ? ' — KO !' : ''}`;
    toast(txt, r.hpCur === 0 ? 'debuff' : 'gold');
    pushLog(txt, r.hpCur === 0 ? 'debuff' : 'gold');
    // Vol de vie / Sapience / Omnivamp : soin de l'attaquant sur les dégâts infligés.
    const heal = lifestealHeal(r.applied, type, { omni: inst.omni || 0, vol: inst.vol || 0, sapience: inst.sapience || 0 }, action.skillId === 'basic');
    if (heal > 0) {
      const hr = await healCharacter(action.attackerId, heal, inst.hpMax || 0);
      if (hr.healed > 0) {
        toast(`<b>${action.attackerName}</b> se soigne de <b>${hr.healed}</b> PV (vol de vie)`, 'buff');
        pushLog(`<b>${action.attackerName}</b> récupère <b>${hr.healed}</b> PV (vol de vie)`, 'buff');
      }
    }
  };

  const applyHeal = async (action, inst, target, amount) => {
    let healed = 0;
    if (target.kind === 'enemy') healed = healEnemy(target.enemy, amount).healed;
    else healed = (await healCharacter(target.id, amount, (target.live.eff || {}).hp || 0)).healed;
    const txt = healed > 0
      ? `<b>${action.attackerName}</b> soigne <b>${target.name}</b> de <b>${healed}</b> PV`
      : `<b>${target.name}</b> est déjà au maximum — aucun soin appliqué`;
    toast(txt, 'buff');
    pushLog(txt, 'buff');
  };

  const applyStatus = async (action, inst, target) => {
    // Une instance narrative n'écrit rien : « Valider » vaut accusé de réception.
    if (!inst.narrative) await applyStatusToCharacter(target.id, action.skillId, inst);
    const txt = inst.narrative
      ? `<b>${action.attackerName}</b> — <b>${action.skillName}</b> : ${inst.label}`
      : `<b>${target.name}</b> gagne <b>${action.skillName}</b> — ${inst.label}`;
    toast(txt, 'buff');
    pushLog(txt, 'buff');
  };

  const onApply = (action) => async (inst, target, a, b, c) => {
    if (!target) { toast('Cible introuvable — instance retirée', 'debuff'); resolveInstance(action, inst.id, false); return; }
    try {
      if (inst.kind === 'damage') await applyDamage(action, inst, target, a, b, c);
      else if (inst.kind === 'heal') await applyHeal(action, inst, target, a);
      else await applyStatus(action, inst, target);
      resolveInstance(action, inst.id, true);
    } catch (e) {
      toast('Application refusée : droits insuffisants', 'debuff');
    }
  };

  /* Rejet d'UNE instance. Ne rembourse rien tant qu'il en reste d'autres — sauf
     `manaPer` ; rejeter la dernière équivaut à annuler la compétence (§6 de la spec). */
  const onRejectInstance = (action) => async (inst) => {
    const plan = actionRefundPlan(action, 'instance');
    resolveInstance(action, inst.id, false);
    await announceRefund(plan, action, toast);
  };
  const onCancel = async (action) => {
    const plan = actionRefundPlan(action, 'cancel');
    removeAction(action.id);
    await announceRefund(plan, action, toast, 'annulée par le MJ');
  };
  /* ⊘ Échec : la compétence a bien été lancée mais ne produit rien (parade, contre,
     dissipation). Tout est retiré, RIEN n'est rendu — et le journal dit « échoue »
     plutôt que « inflige 0 », ce qui est la vérité de la scène. */
  const onFail = (action) => {
    removeAction(action.id);
    const txt = `<b>${action.attackerName}</b> — <b>${action.skillName}</b> échoue (le coût reste dépensé)`;
    toast(txt, 'debuff');
    pushLog(txt, 'debuff');
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Actions en attente <span className="mono faint" style={{ fontSize: 12 }}>· {live.length}</span></h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
        {live.map(a => (
          <PendingActionCard key={a.id} action={a} resolveTarget={resolveTarget}
            color={(CHARACTERS.find(c => c.id === a.attackerId) || {}).color}
            onApply={onApply(a)} onRejectInstance={onRejectInstance(a)} onCancel={onCancel} onFail={onFail} />
        ))}
      </div>
    </div>
  );
}

/* Exécute le remboursement et l'annonce. `plan` à null = rien à rendre (instance parmi
   d'autres, coût déjà consommé par une application, attaque de base).
   ⚠️ try/catch : un rejet d'écriture silencieux ferait croire au remboursement (leçon
   des journaux, 2026-08-21). */
async function announceRefund(plan, action, toast, verb) {
  if (!plan) return;
  try {
    const r = await refundCast(plan);
    const parts = [];
    if (r.mana > 0) parts.push(`${r.mana} mana`);
    if (r.cd) parts.push('cooldown');
    const txt = `<b>${action.attackerName}</b> — <b>${action.skillName}</b> ${verb || 'rejetée'} : ${parts.join(' et ') || 'rien'} rendu(s)`;
    toast(txt, 'buff');
    pushLog(txt, 'buff');
  } catch (e) {
    toast(`Remboursement impossible (${action.attackerName} — ${action.skillName}) : droits insuffisants`, 'debuff');
  }
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
  const toast = useToast();
  const all = useAllCharStates();
  const [selected, setSelected] = useState('rathael');
  const [full, setFull] = useState(null);
  const { enemies, addEnemy, updateEnemy, removeEnemy } = useMJEnemies();
  const { turn, nextTurn, prevTurn, resetCombat } = useSharedTurn();
  const [attacker, setAttacker] = useState(null); // ennemi en cours d'attaque (Task 4)
  const stOf = (id) => (all && all[id] && all[id].state) || null;
  // Combattants NORMALISES pour le moteur d'initiative : PJ (etat Firebase) + PNJ des
  // deux camps. Le moteur ignore tout du camp ; il ne veut qu'un id et des PV.
  // A ce stade (lot 3) le hook ne sert qu'a horodater les KO et a purger les
  // declarations ; la liste des creneaux a l'ecran arrive au lot 4.
  const combatants = CHARACTERS.map(c => ({ id: c.id, hp: (stOf(c.id) || {}).hpCur }))
    .concat(enemies.map(e => ({ id: e.id, hp: e.hpCur })));
  const ini = useInitiative(combatants, turn);
  const { stampKo } = ini;
  // Metadonnees d'affichage (nom + camp) : le moteur ne connait que des ids et des PV.
  const iniMeta = {};
  CHARACTERS.forEach(c => { iniMeta[c.id] = { name: c.name, side: 'pj' }; });
  enemies.forEach(e => { iniMeta[e.id] = { name: e.name, side: combatantSide(e) }; });
  const iniIds = combatants.map(c => c.id);
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
        <div className="col gap-1" style={{ padding:10, overflowY:'auto', flexShrink:0 }}>
          {CHARACTERS.map(c => (
            <MJSidebarRow key={c.id} c={c} st={stOf(c.id)} active={selected === c.id} onClick={() => setSelected(c.id)} />
          ))}
        </div>
        <InitiativePanel ini={ini} meta={iniMeta} ids={iniIds} turn={turn} />
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
              <button className="btn btn-sm btn-gold" onClick={() => nextTurn().then(r => { if (r && !r.doneCleared) toast('Tour avancé, mais les fins de tour n’ont pas pu être purgées : droits insuffisants', 'debuff'); })} style={{ whiteSpace:'nowrap' }}>Fin de tour ▸</button>
              <button className="btn btn-sm btn-ghost" onClick={() => { if (confirm('Nouveau combat : remettre le tour à 1 et vider toutes les charges + cooldowns ?')) resetCombat().then((r) => {
                if (r && !r.logCleared) toast('Combat réinitialisé, mais le journal n’a pas pu être vidé : droits insuffisants', 'debuff');
                if (r && !r.initCleared) toast('Combat réinitialisé, mais l’initiative n’a pas pu être vidée : droits insuffisants', 'debuff');
                if (r && !r.queueCleared) toast('Combat réinitialisé, mais les actions en attente n’ont pas pu être vidées : droits insuffisants', 'debuff');
              }); }} title="Nouveau combat (reset charges + cooldowns)" style={{ padding:'4px 8px', whiteSpace:'nowrap' }}>⟲ Combat</button>
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
            <PendingActionsPanel enemies={enemies} stampKo={stampKo} stOf={stOf} turn={turn} />
          </div>
          <div style={{ marginTop:28 }}>
            {(() => {
              // Ennemis d'abord, alliés ensuite — l'ordre de COMBAT viendra de l'initiative,
              // celui-ci n'est qu'un rangement d'affichage.
              const { enemies: foes, allies } = splitCombatants(enemies);
              const ordered = foes.concat(allies);
              return (
                <React.Fragment>
                  <div className="row" style={{ justifyContent:'space-between', alignItems:'center', marginBottom:12, flexWrap:'wrap', gap:10 }}>
                    <h3 style={{ fontSize:16 }}>Combattants <span className="mono faint" style={{ fontSize:12 }}>
                      · {foes.length} ennemi{foes.length > 1 ? 's' : ''}{allies.length > 0 ? ` · ${allies.length} allié${allies.length > 1 ? 's' : ''}` : ''}
                    </span></h3>
                    <span className="row gap-2">
                      <button className="btn btn-sm btn-gold" onClick={() => addEnemy()}>+ Ennemi</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => addEnemy(null, 'ally')}>+ PNJ allié</button>
                    </span>
                  </div>
                  {ordered.length === 0
                    ? <div className="faint" style={{ fontSize:12 }}>Aucun combattant. Ajoutez un ennemi ou un PNJ allié pour suivre ses HP en combat.</div>
                    : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:16, alignItems:'start' }}>
                        {ordered.map(e => (
                          <EnemyCard key={e.id} enemy={e} onUpdate={updateEnemy} onRemove={removeEnemy} onAttack={setAttacker} stampKo={stampKo} />
                        ))}
                      </div>}
                </React.Fragment>
              );
            })()}
          </div>
          <div style={{ marginTop:28 }}>
            <CombatLog canClear={true} />
          </div>
        </div>
      </main>

      {!active && !decided && <SessionStartModal onStart={() => { start(); setDecided(true); }} onVisit={() => setDecided(true)} />}
      {rewards && <SessionRewardsModal onLoot={() => go('inv')} onCancel={() => setRewards(false)} onDone={() => { setRewards(false); close(); }} />}
      {full && <FullScreenSheet char={full} onClose={() => setFull(null)} />}
      {attacker && <EnemyAttackModal enemy={attacker} enemies={enemies} stOf={stOf} turn={turn} onClose={() => setAttacker(null)} stampKo={stampKo} />}
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
