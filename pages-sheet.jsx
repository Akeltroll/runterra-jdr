/* ============================================================
   PAGE — FICHE JOUEUR (3 colonnes) + 3 directions visuelles
   variant 'a' Tablettes · 'b' Hextech · 'c' Codex radial
   ============================================================ */

/* ---- Affichage des ressources selon la direction ---- */
function ResourceStack({ char, eff, variant, hp, mana, shield }) {
  if (variant === 'c') {
    // gauges circulaires
    const Gauge = ({ cur, max, color, label, glyph }) => {
      const pct = max ? Math.min(1, cur / max) : 0;
      const R = 34, C = 2 * Math.PI * R;
      return (
        <div className="col" style={{ alignItems:'center', flex:1 }}>
          <div style={{ position:'relative', width:84, height:84 }}>
            <svg width="84" height="84" style={{ transform:'rotate(-90deg)' }}>
              <circle cx="42" cy="42" r={R} fill="none" stroke="var(--bg-inset)" strokeWidth="8" />
              <circle cx="42" cy="42" r={R} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition:'stroke-dashoffset .5s' }} />
            </svg>
            <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center' }}>
              <span className="mono" style={{ fontSize:16, fontWeight:700, color:'var(--gold-pale)' }}>{cur}</span>
            </div>
          </div>
          <span className="overline" style={{ marginTop:6 }}>{label}</span>
          <span className="mono faint" style={{ fontSize:10 }}>/ {max}</span>
        </div>
      );
    };
    return (
      <div className="row gap-2" style={{ justifyContent:'space-around' }}>
        <Gauge cur={hp} max={eff.hp} color="var(--hp)" label="Vie" />
        <Gauge cur={mana} max={eff.mana} color="var(--mana-bright)" label="Mana" />
        <Gauge cur={shield} max={char.shieldMax} color="var(--shield)" label="Bouclier" />
      </div>
    );
  }
  const big = variant === 'b';
  return (
    <div className="col gap-3">
      <div>
        <div className="row" style={{ justifyContent:'space-between', marginBottom:5 }}><span className="overline">Points de vie</span></div>
        <ResourceBar kind="hp" cur={hp} max={eff.hp} big={big} segments={variant==='b'?10:0} />
      </div>
      <div>
        <div className="row" style={{ justifyContent:'space-between', marginBottom:5 }}><span className="overline">Mana</span></div>
        <ResourceBar kind="mana" cur={mana} max={eff.mana} big={big} segments={variant==='b'?10:0} />
      </div>
      <div>
        <div className="row" style={{ justifyContent:'space-between', marginBottom:5 }}><span className="overline">Bouclier</span></div>
        <ResourceBar kind="shield" cur={shield} max={char.shieldMax} big={big} segments={variant==='b'?10:0} />
      </div>
    </div>
  );
}

/* ---- Grille de stats secondaires selon la direction ---- */
function SecondaryStats({ stats, variant }) {
  const items = [
    ['ad', stats.ad, false], ['ap', stats.ap, true], ['armure', stats.armure, false],
    ['resmag', stats.resmag, true], ['crit', stats.crit + '%', false], ['dcrit', stats.dcrit + '%', false],
    ['sapience', stats.sapience, false], ['omni', '0%', true], ['vol', '0%', false],
  ];
  if (variant === 'b') {
    // tuiles angulaires hextech
    return (
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
        {items.map(([k, v, magic]) => (
          <div key={k} style={{ position:'relative', padding:'12px 8px', textAlign:'center',
            background:'linear-gradient(180deg, var(--bg-panel-2), var(--bg-inset))',
            border:'1px solid ' + (magic ? 'var(--silver-deep)' : 'var(--line-gold)'),
            clipPath:'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
            <div className="mono" style={{ fontSize:18, fontWeight:700, color: magic ? 'var(--silver)' : 'var(--gold-pale)' }}>{v}</div>
            <div className="overline" style={{ fontSize:9, marginTop:3 }}>{STAT_LABEL[k]}</div>
          </div>
        ))}
      </div>
    );
  }
  if (variant === 'c') {
    // registre / codex à deux colonnes
    return (
      <div className="col" style={{ gap:0 }}>
        {items.map(([k, v, magic], i) => (
          <div key={k} className="row" style={{ justifyContent:'space-between', padding:'9px 4px',
            borderBottom: i < items.length-1 ? '1px solid var(--line)' : 'none' }}>
            <span className="row gap-2"><span className="mono faint" style={{ fontSize:10, width:22 }}>{STAT_GLYPH[k]}</span><span className="dim" style={{ fontSize:12 }}>{STAT_LABEL[k]}</span></span>
            <span className="mono" style={{ fontSize:15, fontWeight:600, color: magic ? 'var(--silver)' : 'var(--gold-pale)' }}>{v}</span>
          </div>
        ))}
      </div>
    );
  }
  // variant a — chips
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
      {items.map(([k, v, magic]) => <StatChip key={k} k={k} value={v} magic={magic} />)}
    </div>
  );
}

/* ---- Colonne 3 : buffs + inventaire ---- */
function BuffInvColumn({ char, activeBuffs, setBuff, setMod, modifiers }) {
  const toast = useToast();
  const active = new Set(activeBuffs);
  const toggle = (b) => {
    const on = !active.has(b.id);
    setBuff(b.id, on);
    if (on) toast(`<b>${char.name}</b> — ${b.name} ${b.type === 'buff' ? 'activé' : 'subi'}`, b.type);
  };
  const cats = ['Équipement', 'Consommables', 'Butin'];
  const MOD_STATS = [['hp','HP'],['mana','Mana'],['ad','AD'],['ap','AP'],['armure','Armure'],['resmag','Rés.Mag'],['crit','%Crit'],['dcrit','%D.Crit'],['sapience','Sapience']];
  return (
    <div className="col gap-5">
      <div className="panel">
        <div className="panel-head"><h3>Buffs & Débuffs</h3><span className="mono faint" style={{ fontSize:11 }}>{active.size} actifs</span></div>
        <div style={{ padding:'14px 16px' }}>
          <div className="overline" style={{ marginBottom:8 }}>Bonus</div>
          <div className="row gap-2 wrap" style={{ marginBottom:14 }}>
            {BUFFS.filter(b => b.type === 'buff').map(b => <BuffBadge key={b.id} buff={b} on={active.has(b.id)} onToggle={() => toggle(b)} />)}
          </div>
          <div className="overline" style={{ marginBottom:8 }}>Malus</div>
          <div className="row gap-2 wrap">
            {BUFFS.filter(b => b.type === 'debuff').map(b => <BuffBadge key={b.id} buff={b} on={active.has(b.id)} onToggle={() => toggle(b)} />)}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Modificateurs</h3><span className="overline">ajustements MJ</span></div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, padding:'14px 16px' }}>
          {MOD_STATS.map(([k, lbl]) => (
            <label key={k} className="col" style={{ gap:3 }}>
              <span className="overline" style={{ fontSize:9 }}>{lbl}</span>
              <input type="number" value={(modifiers && modifiers[k]) || 0}
                onChange={(e) => setMod(k, parseInt(e.target.value) || 0)}
                style={{ background:'var(--bg-inset)', color:'var(--gold-pale)', border:'1px solid var(--line-strong)', borderRadius:6, padding:'5px 8px', fontFamily:'var(--font-mono)', fontSize:12, textAlign:'right', width:'100%' }} />
            </label>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Inventaire</h3><span className="mono faint" style={{ fontSize:11 }}>{char.inv.length} objets</span></div>
        <div className="col gap-4" style={{ padding:'14px 16px' }}>
          {cats.map(cat => {
            const items = char.inv.filter(i => i.cat === cat);
            if (!items.length) return null;
            return (
              <div key={cat}>
                <div className="overline" style={{ marginBottom:7 }}>{cat}</div>
                <div className="col gap-2">{items.map((it, i) => <InvItem key={i} item={it} />)}</div>
              </div>
            );
          })}
          <div>
            <div className="overline" style={{ marginBottom:7 }}>Bourse</div>
            <Coins coins={char.coins} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Colonne 2 : combat & armes ---- */
function CombatColumn({ char, onAttack, hp, setHp, mana, setMana, shield, setShield, fatigue, eau, setField, activeBuffs }) {
  const [lethality, setLethality] = useState(char.lethality);
  const [mode, setMode] = useState(char.mode);
  const weapon = WEAPONS.find(w => w.id === char.weaponId);
  const power = weapon.stat === 'ap' ? char.stats.ap : char.stats.ad;
  const m = ATTACK_MODES.find(x => x.id === mode);
  const estimate = Math.round(power * m.mult);
  return (
    <div className="col gap-5">
      <div className="panel">
        <div className="panel-head"><h3>Arme équipée</h3>
          <span className={'buff ' + (weapon.cat === 'Magique' ? 'is-buff' : 'is-debuff')} style={{ cursor:'default' }}>
            <span className="dot">{weapon.cat === 'Magique' ? '✦' : '⚔'}</span>{weapon.cat}
          </span>
        </div>
        <div style={{ padding:'16px' }}>
          <div className="row gap-3" style={{ marginBottom:14 }}>
            <div style={{ width:52, height:52, flex:'none', borderRadius:10, display:'grid', placeItems:'center', fontSize:26,
              background:'linear-gradient(135deg, var(--bg-panel-2), var(--bg-inset))', border:'1px solid var(--line-gold)' }}>
              {weapon.ic}
            </div>
            <div>
              <div style={{ fontFamily:'var(--font-display)', fontSize:18, color:'var(--gold-pale)' }}>{weapon.name}</div>
              <div className="faint" style={{ fontSize:12 }}>{weapon.cat} · {weapon.type} · base {weapon.stat.toUpperCase()}</div>
            </div>
          </div>
          {/* mode */}
          <div className="overline" style={{ marginBottom:7 }}>Mode de combat</div>
          <div className="row gap-2" style={{ marginBottom:14 }}>
            {ATTACK_MODES.map(x => (
              <button key={x.id} onClick={() => setMode(x.id)} className={'btn btn-sm' + (x.id === mode ? ' btn-gold' : ' btn-ghost')} style={{ flex:1, justifyContent:'center' }}>{x.label}</button>
            ))}
          </div>
          {/* léthalité */}
          <div className="row" style={{ justifyContent:'space-between', marginBottom:7 }}>
            <span className="overline">Léthalité</span>
            <span className="faint" style={{ fontSize:11 }}>{['Aucune','Physique','Magique','Phys. & Mag.'][lethality]}</span>
          </div>
          <div className="row gap-2" style={{ marginBottom:16 }}>
            {[0,1,2,3].map(l => (
              <button key={l} onClick={() => setLethality(l)} className={'btn btn-sm' + (l === lethality ? ' btn-gold' : ' btn-ghost')} style={{ flex:1, justifyContent:'center' }}>{l}</button>
            ))}
          </div>
          {/* dégâts estimés */}
          <div className="row" style={{ justifyContent:'space-between', padding:'12px 14px', background:'var(--bg-inset)', borderRadius:8, border:'1px solid var(--line)', marginBottom:14 }}>
            <span className="dim" style={{ fontSize:12 }}>Dégâts estimés</span>
            <span className="mono" style={{ fontSize:22, fontWeight:700, color:'var(--gold-bright)' }}>{estimate}</span>
          </div>
          <button className="btn btn-gold btn-lg" style={{ width:'100%', justifyContent:'center' }} onClick={onAttack}>⚔ Lancer une attaque</button>
        </div>
      </div>

      <HealPanel char={char} hp={hp} setHp={setHp} mana={mana} setMana={setMana} shield={shield} setShield={setShield} activeBuffs={activeBuffs} />

      <div className="panel">
        <div className="panel-head"><h3>Ressources de survie</h3><span className="overline">temps réel</span></div>
        <div className="row gap-3" style={{ padding:'16px' }}>
          <NumberStepper label="Fatigue" value={fatigue} color="var(--debuff)" onChange={(v) => setField('fatigue', v)} />
          <NumberStepper label="Eau" value={eau} color="var(--mana-bright)" onChange={(v) => setField('eau', v)} />
        </div>
      </div>
    </div>
  );
}

/* ---- Panneau Soins & ressources (modifie l'état en temps réel) ---- */
function HealPanel({ char, hp, setHp, mana, setMana, shield, setShield, activeBuffs }) {
  const toast = useToast();
  const maxHp = char.stats.hp, maxMana = char.stats.mana, maxShield = char.shieldMax;
  const [amt, setAmt] = useState(50);
  const clampV = (v, m) => Math.max(0, Math.min(m, Math.round(v)));
  const potHp = Math.round(15 + maxHp * 0.15);
  const potMana = Math.round(10 + maxMana * 0.10);
  const usePotionHp   = () => { const g = applyHealMods(potHp, activeBuffs); setHp(h => clampV(h + g, maxHp)); toast(`<b>${char.name}</b> utilise une Potion de soin · +${g} PV`, 'buff'); };
  const usePotionMana = () => { setMana(v => clampV(v + potMana, maxMana)); toast(`<b>${char.name}</b> utilise une Potion de mana · +${potMana}`, 'gold'); };
  const healHp    = () => { const g = applyHealMods(amt, activeBuffs); setHp(h => clampV(h + g, maxHp)); toast(`<b>${char.name}</b> reçoit ${g} soins`, 'buff'); };
  const dmgHp     = () => { setHp(h => clampV(h - amt, maxHp));     toast(`<b>${char.name}</b> subit ${amt} dégâts`, 'debuff'); };
  const addShield = () => { const g = applyHealMods(amt, activeBuffs); setShield(s => clampV(s + g, maxShield)); toast(`<b>${char.name}</b> gagne ${g} bouclier`, 'gold'); };
  const recupMana = () => { setMana(v => clampV(v + amt, maxMana)); toast(`<b>${char.name}</b> récupère ${amt} mana`, 'gold'); };
  return (
    <div className="panel">
      <div className="panel-head"><h3>Soins &amp; ressources</h3><span className="overline">temps réel</span></div>
      <div className="col gap-4" style={{ padding:'16px' }}>
        <div>
          <div className="overline" style={{ marginBottom:7 }}>Consommables</div>
          <div className="row gap-2 wrap">
            <button className="btn btn-sm btn-hp" onClick={usePotionHp}>🧪 Potion soin · +{potHp}</button>
            <button className="btn btn-sm btn-mana" onClick={usePotionMana}>🔵 Potion mana · +{potMana}</button>
          </div>
        </div>
        <div>
          <div className="row" style={{ justifyContent:'space-between', marginBottom:7 }}>
            <span className="overline">Montant (soin reçu, bouclier…)</span>
            <input type="number" value={amt} min="0" onChange={e => setAmt(Math.max(0, parseInt(e.target.value) || 0))}
              style={{ width:80, background:'var(--bg-inset)', color:'var(--gold-pale)', border:'1px solid var(--line-strong)', borderRadius:6, padding:'5px 8px', fontFamily:'var(--font-mono)', fontSize:13, textAlign:'right' }} />
          </div>
          <div className="row gap-2 wrap">
            <button className="btn btn-sm btn-hp" onClick={healHp}>♥ Soigner</button>
            <button className="btn btn-sm btn-shield" onClick={addShield}>🛡 Bouclier</button>
            <button className="btn btn-sm btn-mana" onClick={recupMana}>🔷 Mana</button>
            <button className="btn btn-sm btn-ghost" onClick={dmgHp}>− Dégâts</button>
          </div>
        </div>
        <div className="row gap-2 wrap">
          <button className="btn btn-sm btn-ghost" onClick={() => { setHp(maxHp); toast(`<b>${char.name}</b> — PV au maximum`, 'buff'); }}>↺ PV max</button>
          <button className="btn btn-sm btn-ghost" onClick={() => { setMana(maxMana); toast(`<b>${char.name}</b> — Mana au maximum`, 'gold'); }}>↺ Mana max</button>
          <button className="btn btn-sm btn-ghost" onClick={() => setShield(0)}>↺ Bouclier 0</button>
        </div>
      </div>
    </div>
  );
}

/* ---- Corps de la fiche (3 colonnes) ---- */
function SheetBody({ char, variant }) {
  const [modal, setModal] = useState(false);
  const { state, setField, setBuff, setMod } = useCharState(char.id);
  if (!state) return <div style={{ padding:40 }} className="dim">Chargement…</div>;
  const hp = state.hpCur, mana = state.manaCur, shield = state.shield;
  const setHp     = (v) => setField('hpCur',   typeof v === 'function' ? v(hp) : v);
  const setMana   = (v) => setField('manaCur', typeof v === 'function' ? v(mana) : v);
  const setShield = (v) => setField('shield',  typeof v === 'function' ? v(shield) : v);
  const activeBuffs = Object.keys(state.buffs || {});
  const eff = computeEffective(char.stats, state.modifiers, activeBuffs);
  return (
    <div style={{ padding:'20px 24px' }}>
      <div style={{ display:'grid', gridTemplateColumns:'minmax(300px,1fr) minmax(300px,1fr) minmax(320px,1.05fr)', gap:20, alignItems:'start' }} className="sheet-grid">
        {/* COLONNE 1 — STATS */}
        <div className="col gap-5">
          <div className="panel">
            <div className="panel-head"><h3>Vitalité</h3>
              <span className="overline">{variant === 'a' ? 'Tablettes' : variant === 'b' ? 'Hextech' : 'Codex'}</span>
            </div>
            <div style={{ padding:'16px' }}><ResourceStack char={char} eff={eff} variant={variant} hp={hp} mana={mana} shield={shield} /></div>
          </div>
          <div className="panel">
            <div className="panel-head"><h3>Statistiques</h3></div>
            <div style={{ padding:'16px' }}><SecondaryStats stats={eff} variant={variant} /></div>
          </div>
        </div>
        {/* COLONNE 2 — COMBAT */}
        <CombatColumn char={char} onAttack={() => setModal(true)}
          hp={hp} setHp={setHp} mana={mana} setMana={setMana} shield={shield} setShield={setShield}
          fatigue={state.fatigue} eau={state.eau} setField={setField} activeBuffs={activeBuffs} />
        {/* COLONNE 3 — BUFFS + MODIFICATEURS + INVENTAIRE */}
        <BuffInvColumn char={char} activeBuffs={activeBuffs} setBuff={setBuff} setMod={setMod} modifiers={state.modifiers} />
      </div>
      {modal && <AttackModal char={char} onClose={() => setModal(false)} />}
    </div>
  );
}

/* ---- Page complète avec sélecteur de perso + bascule de direction ---- */
function SheetPage({ lockedCharId }) {
  const [charId, setCharId] = useState(() => {
    if (lockedCharId) return lockedCharId;
    const id = localStorage.getItem('runeterra_identity');
    return (id && id !== 'mj' && CHARACTERS.some(c => c.id === id)) ? id : 'rathael';
  });
  const [variant, setVariant] = useState('a');
  const char = CHARACTERS.find(c => c.id === charId);
  const variants = [['a','Tablettes'], ['b','Hextech'], ['c','Codex radial']];
  return (
    <div className="col" style={{ height:'100%', minHeight:0 }}>
      {/* bandeau perso */}
      <div className="row" style={{ justifyContent:'space-between', padding:'14px 24px', borderBottom:'1px solid var(--line)', flexWrap:'wrap', gap:12 }}>
        <div className="row gap-3">
          <Avatar char={char} size={46} radius={9} />
          <div>
            <div className="row gap-2" style={{ alignItems:'baseline' }}>
              <h2 style={{ fontSize:22 }}>{char.name}</h2>
              <span className="faint" style={{ fontSize:12, fontStyle:'italic' }}>« {char.title} »</span>
            </div>
            <span className="dim" style={{ fontSize:12 }}>{char.cls} · Niveau {char.level} · Joueur {char.player}{char.rune ? ' · Rune ' + char.rune : ''}</span>
          </div>
        </div>
        <div className="row gap-4 wrap">
          {!lockedCharId && (
            <div className="row gap-2">
              <span className="overline">Perso</span>
              <select value={charId} onChange={e => setCharId(e.target.value)}
                style={{ background:'var(--bg-inset)', color:'var(--ink)', border:'1px solid var(--line-strong)', borderRadius:6, padding:'7px 10px', fontSize:13 }}>
                {CHARACTERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div className="row gap-1" style={{ padding:3, background:'var(--bg-inset)', borderRadius:8, border:'1px solid var(--line)' }}>
            {variants.map(([v, lbl]) => (
              <button key={v} onClick={() => setVariant(v)} className={'btn btn-sm' + (v === variant ? ' btn-gold' : ' btn-ghost')} style={{ border: v===variant?undefined:'1px solid transparent' }}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ flex:1, overflow:'auto' }}>
        <div className="row gap-2" style={{ padding:'10px 24px 0' }}>
          <span className="anno">Direction visuelle : {variants.find(v=>v[0]===variant)[1]} — basculez pour comparer</span>
        </div>
        <SheetBody char={char} variant={variant} />
      </div>
    </div>
  );
}

Object.assign(window, { SheetBody, SheetPage });
