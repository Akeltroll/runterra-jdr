/* ============================================================
   PAGE — FICHE JOUEUR (layout B : 3 colonnes thématiques)
   ============================================================ */

/* ---- Jauges PV / Mana / Bouclier ---- */
function ResourceStack({ char, eff, hp, mana, shield }) {
  return (
    <div className="col gap-3">
      <div>
        <div className="row" style={{ justifyContent:'space-between', marginBottom:5 }}><span className="overline">Points de vie</span></div>
        <ResourceBar kind="hp" cur={hp} max={eff.hp} />
      </div>
      <div>
        <div className="row" style={{ justifyContent:'space-between', marginBottom:5 }}><span className="overline">Mana</span></div>
        <ResourceBar kind="mana" cur={mana} max={eff.mana} />
      </div>
      <div>
        <div className="row" style={{ justifyContent:'space-between', marginBottom:5 }}><span className="overline">Bouclier</span></div>
        <ResourceBar kind="shield" cur={shield} max={Math.max(char.shieldMax || 0, shield)} />
      </div>
    </div>
  );
}

/* ---- Grille de stats secondaires avec décomposition base / +mod / +stuff ---- */
function SecondaryStats({ breakdown }) {
  const b = breakdown || {};
  const items = [
    ['ad', false], ['ap', true], ['armure', false], ['resmag', true],
    ['crit', false], ['dcrit', false],
    ...((b.letha && b.letha.effective > 0) ? [['letha', false]] : []),
    ...((b.sapience && b.sapience.effective > 0) ? [['sapience', false]] : []),
    ['omni', true], ['vol', false],
  ];
  const pct = (k) => k === 'crit' || k === 'dcrit' || k === 'omni' || k === 'vol';
  const detail = (d) => {
    const parts = [];
    if (d.buff)  parts.push(`${d.buff  > 0 ? '+' : ''}${d.buff} buff`);
    if (d.mod)   parts.push(`${d.mod   > 0 ? '+' : ''}${d.mod} mod`);
    if (d.stuff) parts.push(`${d.stuff > 0 ? '+' : ''}${d.stuff} stuff`);
    return parts.join(' · ');
  };
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
      {items.map(([k, magic]) => {
        const d = b[k] || { effective:0, base:0, buff:0, mod:0, stuff:0 };
        const bonus = d.effective - d.base;
        const bonusCol = bonus > 0 ? 'var(--buff)' : 'var(--hp)';
        return (
          <div key={k} style={{ padding:'9px 11px', borderRadius:8, minHeight:54, boxSizing:'border-box',
            display:'flex', flexDirection:'column', justifyContent:'center',
            background:'linear-gradient(180deg, var(--bg-panel-2), var(--bg-inset))',
            border:'1px solid ' + (magic ? 'var(--silver-deep)' : 'var(--line-gold)') }}>
            <div className="row" style={{ justifyContent:'space-between', alignItems:'baseline' }}>
              <span className="overline" style={{ fontSize:9 }}>{STAT_LABEL[k]}</span>
              <span style={{ display:'flex', alignItems:'baseline', gap:5 }}>
                <span className="mono" style={{ fontSize:17, fontWeight:700, color: magic ? 'var(--silver)' : 'var(--gold-pale)' }}>{d.effective}{pct(k) ? '%' : ''}</span>
                {bonus !== 0 && <span className="mono" style={{ fontSize:11, fontWeight:700, color: bonusCol }}>{bonus > 0 ? '+' : ''}{bonus}</span>}
              </span>
            </div>
            <div className="faint" style={{ fontSize:10, fontFamily:'var(--font-mono)', marginTop:2 }}>
              base {d.base}{detail(d) ? ' · ' + detail(d) : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---- Panneau arme équipée (info, lecture seule) ---- */
function WeaponPanel({ weapon, eff }) {
  const estimate = weapon.stat === 'ap' ? eff.ap : eff.ad;
  return (
    <div className="panel">
      <div className="panel-head"><h3>Arme équipée</h3>
        <span className={'buff ' + (weapon.cat === 'Magique' ? 'is-buff' : 'is-debuff')} style={{ cursor:'default' }}>
          <span className="dot">{weapon.cat === 'Magique' ? '✦' : '⚔'}</span>{weapon.cat}
        </span>
      </div>
      <div style={{ padding:'16px' }}>
        <div className="row gap-3" style={{ marginBottom:14 }}>
          <div style={{ width:52, height:52, flex:'none', borderRadius:10, display:'grid', placeItems:'center', fontSize:26,
            background:'linear-gradient(135deg, var(--bg-panel-2), var(--bg-inset))', border:'1px solid var(--line-gold)' }}>{weapon.ic}</div>
          <div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:18, color:'var(--gold-pale)' }}>{weapon.name}</div>
            <div className="faint" style={{ fontSize:12 }}>{weapon.cat} · {weapon.type} · base {weapon.stat.toUpperCase()}</div>
          </div>
        </div>
        <div className="row" style={{ justifyContent:'space-between', padding:'12px 14px', background:'var(--bg-inset)', borderRadius:8, border:'1px solid var(--line)' }}>
          <span className="dim" style={{ fontSize:12 }}>Dégâts estimés</span>
          <span className="mono" style={{ fontSize:22, fontWeight:700, color:'var(--gold-bright)' }}>{estimate}</span>
        </div>
      </div>
    </div>
  );
}

/* ---- Panneau buffs/débuffs ---- */
function BuffsPanel({ char, activeBuffs, setBuff }) {
  const toast = useToast();
  const active = new Set(activeBuffs);
  const toggle = (b) => {
    const on = !active.has(b.id);
    setBuff(b.id, on);
    if (on) toast(`<b>${char.name}</b> — ${b.name} ${b.type === 'buff' ? 'activé' : 'subi'}`, b.type);
  };
  return (
    <div className="panel">
      <div className="panel-head"><h3>Effets actifs</h3><span className="mono faint" style={{ fontSize:11 }}>{active.size} actifs</span></div>
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
  );
}

/* ---- Panneau ressources de survie (Fatigue / Eau) ---- */
function SurvivePanel({ fatigue, eau, setField }) {
  return (
    <div className="panel">
      <div className="panel-head"><h3>Ressources de survie</h3><span className="overline">temps réel</span></div>
      <div className="row gap-3" style={{ padding:'16px' }}>
        <NumberStepper label="Fatigue" value={fatigue} color="var(--debuff)" onChange={(v) => setField('fatigue', v)} />
        <NumberStepper label="Eau" value={eau} color="var(--mana-bright)" onChange={(v) => setField('eau', v)} />
      </div>
    </div>
  );
}

/* ---- Panneau modificateurs (MJ) ---- */
function ModifiersPanel({ modifiers, setMod }) {
  const MOD_STATS = [['hp','HP'],['mana','Mana'],['ad','AD'],['ap','AP'],['armure','Armure'],['resmag','Rés.Mag'],['crit','%Crit'],['dcrit','%D.Crit'],['letha','Léthalité'],['sapience','Sapience'],['vol','Vol vie%'],['omni','Omnivamp%']];
  return (
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
  );
}

/* ---- Colonne 3 : inventaire (grille adaptative) + modificateurs MJ ---- */
function FicheInventoryColumn({ char, state, eff, canEdit, force, setInvItem, removeInvItem, setMod }) {
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const [menu, setMenu] = useState(null);       // { item, x, y, actions }
  const [editing, setEditing] = useState(null);  // item édité (modal)
  const [catCat, setCatCat] = useState(null);     // picker catalogue
  const inv = state.inventory || {};

  const consume = (it) => {
    const fx = parseConsumableEffect(it); if (!fx) { setMenu(null); return; }
    if (fx.kind === 'hp') {
      const gain = applyHealMods(fx.flat + Math.round((eff.hp || 0) * fx.pct / 100), Object.keys(state.buffs || {}));
      window.RTDB.updatePath(charPath(char.id), { hpCur: Math.min(eff.hp || 0, (state.hpCur || 0) + gain) });
      toast(`<b>${char.name}</b> utilise ${it.name} · +${gain} PV`, 'buff');
    } else {
      const gain = fx.flat + Math.round((eff.mana || 0) * fx.pct / 100);
      window.RTDB.updatePath(charPath(char.id), { manaCur: Math.min(eff.mana || 0, (state.manaCur || 0) + gain) });
      toast(`<b>${char.name}</b> utilise ${it.name} · +${gain} mana`, 'gold');
    }
    const q = (it.qty || 1) - 1;
    if (q <= 0) removeInvItem(it.id); else setInvItem(it.id, { ...it, qty: q });
    setMenu(null);
  };
  const openMenu = (item, e) => {
    e.stopPropagation();
    const actions = [];
    if (item.cat === 'Consommables' && parseConsumableEffect(item)) actions.push({ label:'Utiliser', onClick:() => consume(item) });
    if (canEdit) {
      actions.push({ label:'Éditer', onClick:() => { setEditing(item); setMenu(null); } });
      actions.push({ label:'Supprimer', danger:true, onClick:() => { removeInvItem(item.id); setMenu(null); } });
    }
    if (!actions.length) return;
    setMenu({ item, x: e.clientX, y: e.clientY, actions });
  };

  return (
    <div className="col gap-5">
      <div className="panel" style={{ padding:0, overflow:'hidden' }}>
        <InventoryGrid items={inv} coins={state.coins || char.coins} filter={filter} setFilter={setFilter}
          minCells={21} grow={true} onItemClick={openMenu} onAdd={canEdit ? (cat) => setCatCat(cat) : undefined} />
      </div>
      {canEdit && <ModifiersPanel modifiers={state.modifiers} setMod={setMod} />}
      {menu && <ItemActionMenu {...menu} onClose={() => setMenu(null)} />}
      {editing && (
        <div onClick={() => setEditing(null)} style={{ position:'fixed', inset:0, background:'rgba(8,8,14,.8)', display:'grid', placeItems:'center', zIndex:1000 }}>
          <div className="panel" onClick={e => e.stopPropagation()} style={{ maxWidth:420, width:'90%', padding:16 }}>
            <InvItemRow item={editing} editable startEdit
              onSave={(it) => { setInvItem(it.id, it); setEditing(null); }}
              onRemove={() => { removeInvItem(editing.id); setEditing(null); }} />
          </div>
        </div>
      )}
      {catCat && (
        <ItemCatalogPicker initialFilter={catCat} staff={canEdit}
          onPick={(entry, n) => { const { patch } = planItemAdd(inv, entry, n); Object.entries(patch).forEach(([id, it]) => setInvItem(id, it)); setCatCat(null); }}
          onCustom={() => { const it = makeItem({ cat: catCat, name:'Nouvel objet' }); setInvItem(it.id, it); setCatCat(null); }}
          onClose={() => setCatCat(null)} />
      )}
    </div>
  );
}

/* ---- Panneau Consommables & ressources (temps réel) ---- */
function HealPanel({ char, eff, hp, setHp, mana, setMana, shield, setShield, activeBuffs, inventory, setInvItem, removeInvItem, staff }) {
  const toast = useToast();
  const maxHp = eff.hp, maxMana = eff.mana, maxShield = char.shieldMax;
  const [amt, setAmt] = useState(50);
  const clampV = (v, m) => Math.max(0, Math.min(m, Math.round(v)));

  // Consommables = items de l'inventaire (cat Consommables, qty>0, effet parsable).
  const consumables = Object.values(inventory || {})
    .filter(it => it.cat === 'Consommables' && (it.qty || 0) > 0 && parseConsumableEffect(it));
  const consume = (it) => {
    const fx = parseConsumableEffect(it); if (!fx) return;
    if (fx.kind === 'hp') {
      const gain = applyHealMods(fx.flat + Math.round(maxHp * fx.pct / 100), activeBuffs);
      setHp(h => clampV(h + gain, maxHp));
      toast(`<b>${char.name}</b> utilise ${it.name} · +${gain} PV`, 'buff');
    } else {
      const gain = fx.flat + Math.round(maxMana * fx.pct / 100);
      setMana(v => clampV(v + gain, maxMana));
      toast(`<b>${char.name}</b> utilise ${it.name} · +${gain} mana`, 'gold');
    }
    const q = (it.qty || 1) - 1;
    if (q <= 0) removeInvItem(it.id); else setInvItem(it.id, { ...it, qty: q });
  };
  const consumValue = (it) => { const fx = parseConsumableEffect(it); if (!fx) return 0; return fx.flat + Math.round((fx.kind === 'hp' ? maxHp : maxMana) * fx.pct / 100); };

  const healHp    = () => { const g = applyHealMods(amt, activeBuffs); setHp(h => clampV(h + g, maxHp)); toast(`<b>${char.name}</b> reçoit ${g} soins`, 'buff'); };
  const dmgHp     = () => { setHp(h => clampV(h - amt, maxHp));     toast(`<b>${char.name}</b> subit ${amt} dégâts`, 'debuff'); };
  const addShield = () => { const g = applyHealMods(amt, activeBuffs); setShield(s => clampV(s + g, maxShield)); toast(`<b>${char.name}</b> gagne ${g} bouclier`, 'gold'); };
  const recupMana = () => { setMana(v => clampV(v + amt, maxMana)); toast(`<b>${char.name}</b> récupère ${amt} mana`, 'gold'); };

  return (
    <div className="panel">
      <div className="panel-head"><h3>Consommables</h3><span className="overline">temps réel</span></div>
      <div className="col gap-4" style={{ padding:'16px' }}>
        <div>
          {consumables.length === 0
            ? <div className="faint" style={{ fontSize:12 }}>Aucun consommable dans l'inventaire.</div>
            : <div className="row gap-2 wrap">
                {consumables.map(it => {
                  const fx = parseConsumableEffect(it);
                  return (
                    <button key={it.id} className={'btn btn-sm ' + (fx.kind === 'hp' ? 'btn-hp' : 'btn-mana')} onClick={() => consume(it)}>
                      {fx.kind === 'hp' ? '🧪' : '🔵'} {it.name} · +{consumValue(it)} <span className="faint">×{it.qty}</span>
                    </button>
                  );
                })}
              </div>}
        </div>

        {staff && (
          <>
            <div>
              <div className="row" style={{ justifyContent:'space-between', marginBottom:7 }}>
                <span className="overline">Ajustement MJ (montant)</span>
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
          </>
        )}
      </div>
    </div>
  );
}

/* ---- Corps de la fiche (3 colonnes) ---- */
function SheetBody({ char }) {
  const { role } = useAuthIdentity();
  const canEdit = isStaff(role);   // joueur = inventaire en lecture seule ; MJ/admin = édition
  const { state, setField, setBuff, setMod, setInvItem, removeInvItem } = useCharState(char.id);
  const { turn } = useSharedTurn();
  useEffect(() => {
    // migration unique (marqueur invInit) : amorce l'inventaire si absent, une seule
    // fois — évite de re-remplir les objets par défaut si le joueur vide son inventaire.
    if (state && state.invInit === undefined) {
      const inv = (state.inventory && Object.keys(state.inventory).length)
        ? state.inventory
        : buildDefaultState(char).inventory;
      window.RTDB.updatePath(charPath(char.id), { inventory: inv, invInit: true });
    }
  }, [state, char.id]);
  if (!state) return <div style={{ padding:40 }} className="dim">Chargement…</div>;
  const hp = state.hpCur, mana = state.manaCur, shield = state.shield;
  const setHp     = (v) => setField('hpCur',   typeof v === 'function' ? v(hp) : v);
  const setMana   = (v) => setField('manaCur', typeof v === 'function' ? v(mana) : v);
  const setShield = (v) => setField('shield',  typeof v === 'function' ? v(shield) : v);
  const activeBuffs = Object.keys(state.buffs || {});
  const itemMods = sumItemMods(state.equipment, state.inventory);
  const runesSt  = state.runes || {};
  const runeMods = sumRuneMods(Object.keys(runesSt.selected || {}).filter(id => runesSt.selected[id]),
    runesSt.choices || {}, buildRuneIndex(RUNES));
  const effLevel = (state.level != null ? state.level : char.level) || 1;
  const sheetBase = charBaseStats(char, state);
  const passiveMods = sumPassiveMods(char.id, state.counters || {}, effLevel, sheetBase);
  const skillBuffMods = sumSkillBuffs(state.skillBuffs || {}, turn);
  const eff = computeEffective(sheetBase, state.modifiers, activeBuffs, mergeMods(mergeMods(mergeMods(itemMods, runeMods), passiveMods), skillBuffMods));
  // Arme affichée = celle équipée dans le slot « Arme principale » (live), reliée à WEAPONS
  // par son nom ; sinon item brut synthétisé ; sinon repli sur l'arme par défaut du perso.
  const equippedId = state.equipment && state.equipment.armePrincipale;
  const equippedItem = (equippedId && state.inventory) ? state.inventory[equippedId] : null;
  const equippedWeapon = (equippedItem && WEAPONS.find(w => w.name === equippedItem.name))
    || (equippedItem ? { name: equippedItem.name, ic: equippedItem.ic || '⚔', cat:'Physique', type:'—', stat:'ad' } : null)
    || WEAPONS.find(w => w.id === char.weaponId);
  const breakdown = statBreakdown(sheetBase, state.modifiers, activeBuffs,
    mergeMods(mergeMods(mergeMods(itemMods, runeMods), passiveMods), skillBuffMods));
  const force = (state.attrs && state.attrs.force != null) ? state.attrs.force : (char.attrs ? char.attrs.force : 0);
  return (
    <div style={{ padding:'20px 24px' }}>
      <div className="panel" style={{ padding:'10px 16px', marginBottom:16 }}>
        <XpBar level={effLevel} xp={state.xp || 0} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'minmax(300px,1fr) minmax(300px,1fr) minmax(320px,1.05fr)', gap:20, alignItems:'start' }} className="sheet-grid">
        {/* COLONNE 1 — VITALITÉ & RESSOURCES */}
        <div className="col gap-5">
          <div className="panel">
            <div className="panel-head"><h3>Vitalité</h3></div>
            <div style={{ padding:'16px' }}><ResourceStack char={char} eff={eff} hp={hp} mana={mana} shield={shield} /></div>
          </div>
          <SurvivePanel fatigue={state.fatigue} eau={state.eau} setField={setField} />
          <HealPanel char={char} eff={eff} hp={hp} setHp={setHp} mana={mana} setMana={setMana} shield={shield} setShield={setShield}
            activeBuffs={activeBuffs} inventory={state.inventory} setInvItem={setInvItem} removeInvItem={removeInvItem} staff={canEdit} />
        </div>
        {/* COLONNE 2 — COMBAT & STATS */}
        <div className="col gap-5">
          <div className="panel">
            <div className="panel-head"><h3>Statistiques</h3></div>
            <div style={{ padding:'16px' }}><SecondaryStats breakdown={breakdown} /></div>
          </div>
          <WeaponPanel weapon={equippedWeapon} eff={eff} />
          <BuffsPanel char={char} activeBuffs={activeBuffs} setBuff={setBuff} />
        </div>
        {/* COLONNE 3 — INVENTAIRE (+ modificateurs MJ) */}
        <FicheInventoryColumn char={char} state={state} eff={eff} canEdit={canEdit} force={force}
          setInvItem={setInvItem} removeInvItem={removeInvItem} setMod={setMod} />
      </div>
    </div>
  );
}

/* ---- Page complète avec sélecteur de perso (staff) ---- */
function SheetPage({ lockedCharId }) {
  const [charId, setCharId] = useState(() => {
    if (lockedCharId) return lockedCharId;
    const id = localStorage.getItem('runeterra_identity');
    return (id && id !== 'mj' && CHARACTERS.some(c => c.id === id)) ? id : 'rathael';
  });
  const char = CHARACTERS.find(c => c.id === charId);
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
        </div>
      </div>
      <div style={{ flex:1, overflow:'auto' }}>
        <SheetBody char={char} />
      </div>
    </div>
  );
}

Object.assign(window, { SheetBody, SheetPage });
