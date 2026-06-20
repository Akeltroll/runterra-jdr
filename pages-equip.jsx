/* ============================================================
   PAGE — ÉQUIPEMENT (paperdoll + inventaire + stats)
   Recréation du design Claude « Système d'équipement inventaire »
   branchée sur les VRAIES données du projet :
   - portrait réel (ATH/Perso/) au centre, imposant
   - inventaire live de la fiche (useCharState) à droite
   - stats effectives réelles (computeEffective) sous le paperdoll
   - monnaie (char.coins) avec les images de pièces ATH/Items
   Drag & drop inventaire ↔ slots = état LOCAL (front seul ; la
   persistance Firebase de l'équipement est un chantier back ultérieur).
   Les bonus d'items (item.mods) sont déjà lus → s'allument en vert dès
   qu'ils seront renseignés (hook futur, cf. CLAUDE.md).
   ============================================================ */

/* Les 15 slots d'équipement + zones de grille (identiques au mockup).
   `wnone` (dans grid-template-areas) reste une case vide de remplissage. */
const EQUIP_SLOTS = {
  casque:         { label:'Casque',          accepts:['helmet'],                    area:'casque'   },
  epaules:        { label:'Épaules',         accepts:['shoulders'],                 area:'epaules'  },
  cuirasse:       { label:'Cuirasse',        accepts:['chest'],                     area:'cuirasse' },
  gants:          { label:'Gants',           accepts:['gloves'],                    area:'gants'    },
  armePrincipale: { label:'Arme principale', accepts:['weapon'],                    area:'armeP'    },
  armeSecondaire: { label:'Arme secondaire', accepts:['offhand','shield','weapon'], area:'armeS'    },
  amulette:       { label:'Amulette',        accepts:['amulet'],                    area:'amulette' },
  anneau1:        { label:'Anneau 1',        accepts:['ring'],                      area:'anneau1'  },
  anneau2:        { label:'Anneau 2',        accepts:['ring'],                      area:'anneau2'  },
  ceinture:       { label:'Ceinture',        accepts:['belt'],                      area:'ceinture' },
  pantalon:       { label:'Pantalon',        accepts:['pants'],                     area:'pantalon' },
  accessoire1:    { label:'Accessoire 1',    accepts:['accessory'],                 area:'acc1'     },
  accessoire2:    { label:'Accessoire 2',    accepts:['accessory'],                 area:'acc2'     },
  accessoire3:    { label:'Accessoire 3',    accepts:['accessory'],                 area:'acc3'     },
  bottes:         { label:'Bottes',          accepts:['boots'],                     area:'bottes'   },
};
const EQUIP_GRID_AREAS =
  "'casque armeP armeP amulette' 'epaules armeP armeP anneau1' 'cuirasse armeP armeP anneau2' 'gants armeS armeS ceinture' 'acc1 armeS armeS pantalon' 'acc2 acc3 wnone bottes'";

/* Portrait réel par perso (id interne -> fichier ATH/Perso). */
const EQUIP_PORTRAITS = {
  rathael:'ATH/Perso/Rathael.webp', urskaar:'ATH/Perso/Urskaar.webp',
  smith:'ATH/Perso/Smith.webp',     lunick:'ATH/Perso/Elias.webp',
  jett:'ATH/Perso/Jett.webp',
};

/* (EQUIP_COINS, EQUIP_CAT_STYLE, EQUIP_CAT_FALLBACK, equipCatStyle supprimés — fournis par components.jsx sous INV_COINS / invCatStyle) */

/* Type d'item -> slot compatible. `item.type` explicite prioritaire (futur back).
   À défaut on infère : dague -> accessory (choix MJ) ; autre arme (/Armes/) -> weapon ;
   autre équipement -> accessory ; consommables/butin -> non équipables. */
function equipTypeForItem(it) {
  if (!it) return null;
  if (it.type) return it.type;
  const dague = /dague/i.test(it.img || '') || /dague/i.test(it.name || '');
  if (dague) return 'accessory';
  if (it.img && it.img.indexOf('/Armes/') !== -1) return 'weapon';
  if (it.cat === 'Équipement') return 'accessory';
  return null;
}

/* Effet d'un consommable, parsé depuis sa description (source de vérité MJ :
   « Rend 15 + 15% HP », « Rend 10 + 10% Mana » = plat + % du max). Renvoie null
   pour un consommable sans effet chiffré (juste consommé). */
function parseConsumableEffect(it) {
  if (!it || it.cat !== 'Consommables') return null;
  const txt = (it.sub || '') + ' ' + (it.name || '');
  const m = txt.match(/Rend\s+(\d+)\s*\+\s*(\d+)\s*%\s*(HP|PV|Mana)/i);
  if (m) return { kind: /mana/i.test(m[3]) ? 'mana' : 'hp', flat: parseInt(m[1], 10), pct: parseInt(m[2], 10) };
  // Repli par nom pour les potions standard sans description chiffrée.
  if (/potion\s+soin/i.test(it.name || '')) return { kind:'hp',   flat:15, pct:15 };
  if (/potion\s+mana/i.test(it.name || '')) return { kind:'mana', flat:10, pct:10 };
  return null;
}

/* (equipFmt, EQUIP_FILTERS supprimés — fournis par components.jsx sous invFmt / INV_FILTERS) */

/* ---- Corps de la page pour un perso donné ---- */
function EquipBody({ char }) {
  const { state, setEquipment, setField, setInvItem, removeInvItem } = useCharState(char.id);
  const { role } = useAuthIdentity();
  const staff = isStaff(role);   // joueur : équiper/utiliser/transférer seulement ; édition réservée au MJ/admin
  const { items: sharedItems } = useSharedInventory();
  const { coins: sharedCoins } = useSharedCoins();
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const [draggingId, setDraggingId] = useState(null);
  const [hoverSlot, setHoverSlot] = useState(null);
  const [hoverValid, setHoverValid] = useState(false);
  const [tip, setTip] = useState(null);            // { item, x, y } — survol (info)
  const [menu, setMenu] = useState(null);          // { item, x, y, actions } — menu d'actions
  const [stepper, setStepper] = useState(null);    // { kind:'item'|'coin', ... } — saisie quantité
  const [editing, setEditing] = useState(null);    // item en cours d'édition (modal)
  const [catalog, setCatalog] = useState(false);   // ouverture du catalogue d'ajout

  // Migration unique de l'inventaire (marqueur invInit), idempotente — identique
  // à la fiche, au cas où le joueur ouvre Équipement avant sa fiche.
  useEffect(() => {
    if (state && state.invInit === undefined) {
      const inv = (state.inventory && Object.keys(state.inventory).length)
        ? state.inventory
        : buildDefaultState(char).inventory;
      window.RTDB.updatePath(charPath(char.id), { inventory: inv, invInit: true });
    }
  }, [state, char.id]);

  // Migration unique des pièces (marqueur coinsInit).
  useEffect(() => {
    if (state && state.coinsInit === undefined) {
      const coins = (state.coins && Object.keys(state.coins).length)
        ? state.coins : buildDefaultState(char).coins;
      window.RTDB.updatePath(charPath(char.id), { coins, coinsInit: true });
    }
  }, [state, char.id]);

  if (!state) return <div style={{ padding:40 }} className="dim">Chargement…</div>;

  const itemsById = state.inventory || {};
  const allItems = Object.values(itemsById);
  // Équipement persisté : { [slotKey]: itemId }. On ignore les refs vers un item
  // disparu de l'inventaire (slot affiché vide jusqu'à ré-équipement).
  const equipment = state.equipment || {};
  const slotOfItem = (id) => { for (const k of Object.keys(equipment)) if (equipment[k] === id) return k; return null; };
  const equippedIds = new Set(Object.values(equipment).filter(id => id && itemsById[id]));
  const equippedItems = Object.values(equipment).map(id => itemsById[id]).filter(Boolean);

  /* --- Équiper / déséquiper (temps réel Firebase) --- */
  const tryEquip = (id, key) => {
    const item = itemsById[id];
    if (!item || !EQUIP_SLOTS[key].accepts.includes(equipTypeForItem(item))) return;
    const patch = { [key]: id };                        // l'item déjà dans `key` repart à l'inventaire
    const prev = slotOfItem(id);
    if (prev && prev !== key) patch[prev] = null;        // libère l'ancien slot de l'item
    setEquipment(patch);
  };
  const unequip = (id) => { const k = slotOfItem(id); if (k) setEquipment({ [k]: null }); };
  const autoEquip = (id) => {
    const item = itemsById[id]; if (!item) return;
    const t = equipTypeForItem(item); if (!t) return;
    const keys = Object.keys(EQUIP_SLOTS);
    const empty = keys.find(k => EQUIP_SLOTS[k].accepts.includes(t) && !equipment[k]);
    const any   = keys.find(k => EQUIP_SLOTS[k].accepts.includes(t));
    const target = empty || any;
    if (target) tryEquip(id, target);
  };

  /* --- Tooltip --- */
  const showTip = (e, item) => setTip({ item, x:e.clientX, y:e.clientY });
  const moveTip = (e) => setTip(t => t ? { ...t, x:e.clientX, y:e.clientY } : t);
  const hideTip = () => setTip(null);

  /* --- Stats effectives réelles : item.mods équipés folés dans computeEffective
     (même étage que les modificateurs → amplifiés par les buffs, comme partout). --- */
  const activeBuffs = Object.keys(state.buffs || {});
  const runesSt  = state.runes || {};
  const runeMods = sumRuneMods(Object.keys(runesSt.selected || {}).filter(id => runesSt.selected[id]),
    runesSt.choices || {}, buildRuneIndex(RUNES));
  const passiveMods = sumPassiveMods(char.id, state.counters || {}, char.level || 1);
  const bonuses = mergeMods(mergeMods(sumItemMods(equipment, itemsById), runeMods), passiveMods);  // items + runes + passif -> vert
  const skillBuffMods = sumSkillBuffs(state.skillBuffs || {});  // buffs de compétence -> orange
  const eff = computeEffective(char.stats, state.modifiers, activeBuffs, mergeMods(bonuses, skillBuffMods));
  const sval = (k, base, pct) => (pct ? (base || 0).toFixed(1) + '%' : invFmt(base || 0));
  const scol = (k) => (skillBuffMods[k] ? 'var(--skillbuff)' : (bonuses[k] ? '#9fd07a' : '#e9dcc4'));

  const attributs = [
    { k:'Force',          v:char.attrs.force,  col:'#e9dcc4' },
    { k:'Habileté',       v:char.attrs.hab,    col:'#e9dcc4' },
    { k:'Mental',         v:char.attrs.mental, col:'#e9dcc4' },
    { k:'Magie/Cosmique', v:char.attrs.magie,  col:'#e9dcc4' },
  ];
  const combat = [
    { k:'Dégâts (AD)',  v:sval('ad', eff.ad),           col:scol('ad')   },
    { k:'Puissance',    v:sval('ap', eff.ap),           col:scol('ap')   },
    { k:'Armure',       v:sval('armure', eff.armure),   col:scol('armure') },
    { k:'Rés. Magique', v:sval('resmag', eff.resmag),   col:scol('resmag') },
    { k:'% Crit',       v:sval('crit', eff.crit, true), col:scol('crit') },
    { k:'% D. Crit',    v:sval('dcrit', eff.dcrit, true), col:scol('dcrit') },
    { k:'Sapience',     v:sval('sapience', eff.sapience), col:scol('sapience') },
  ];
  const survie = [
    { k:'PV max',     v:sval('hp', eff.hp),       col:scol('hp')   },
    { k:'Mana max',   v:sval('mana', eff.mana),   col:scol('mana') },
    { k:'Bouclier',   v:invFmt(char.shieldMax), col:'#e9dcc4' },
    { k:'Vol de vie', v:sval('vol', eff.vol, true),  col:scol('vol')  },
    { k:'Omnivamp',   v:sval('omni', eff.omni, true), col:scol('omni') },
  ];

  /* --- Consommables : utilisation au clic (appelée par openItemMenu) --- */
  const consumeItem = (item) => {
    const cur = itemsById[item.id]; if (!cur || (cur.qty || 0) < 1) { setMenu(null); return; }
    // Effet (potions) appliqué en live sur l'état temps réel.
    const fx = parseConsumableEffect(cur);
    if (fx && fx.kind === 'hp') {
      const gain = applyHealMods(fx.flat + Math.round(eff.hp * fx.pct / 100), activeBuffs);
      const nv = Math.min(eff.hp, (state.hpCur || 0) + gain);
      setField('hpCur', nv);
      toast(`<b>${char.name}</b> utilise ${cur.name} · +${gain} PV`, 'buff');
    } else if (fx && fx.kind === 'mana') {
      const gain = fx.flat + Math.round(eff.mana * fx.pct / 100);
      const nv = Math.min(eff.mana, (state.manaCur || 0) + gain);
      setField('manaCur', nv);
      toast(`<b>${char.name}</b> utilise ${cur.name} · +${gain} mana`, 'gold');
    } else {
      toast(`<b>${char.name}</b> utilise ${cur.name}`, 'gold');
    }
    // Décrément quantité ; suppression de l'inventaire quand on atteint 0.
    const q = (cur.qty || 1) - 1;
    if (q <= 0) removeInvItem(cur.id); else setInvItem(cur.id, { ...cur, qty: q });
    setMenu(null);
  };

  /* --- Monnaie live + actions items/pièces --- */
  const coins = state.coins || char.coins || { plat:0, or:0, arg:0, cuiv:0 };

  const sendToCommon = (item, n) => {
    moveItem(`${charPath(char.id)}/inventory`, SHARED_INV, itemsById, sharedItems || {}, item.id, n);
  };
  const openItemMenu = (item, e) => {
    e.stopPropagation(); setTip(null);
    const actions = [];
    if (equipTypeForItem(item)) actions.push({ label:'Équiper', onClick:() => autoEquip(item.id) });
    if (item.cat === 'Consommables' && parseConsumableEffect(item)) actions.push({ label:'Utiliser', onClick:() => consumeItem(item) });
    actions.push({ label:'Envoyer au commun', onClick:() => {
      if ((item.qty || 1) > 1) setStepper({ kind:'item', dir:'toCommon', item, x:e.clientX, y:e.clientY });
      else sendToCommon(item, 1);
    }});
    if (staff) {
      actions.push({ label:'Éditer', onClick:() => setEditing(item) });
      actions.push({ label:'Supprimer', danger:true, onClick:() => removeInvItem(item.id) });
    }
    setMenu({ item, x:e.clientX, y:e.clientY, actions });
  };
  const openCoinMenu = (key, e) => {
    const max = coins[key] || 0;
    if (max <= 0) return;
    setStepper({ kind:'coin', dir:'toCommon', coinKey:key, max, x:e.clientX, y:e.clientY });
  };
  const addItem = () => { const it = makeItem({ cat:'Butin', name:'Nouvel objet' }); setInvItem(it.id, it); setEditing(it); };

  /* --- Inventaire (non équipé) ; InventoryGrid filtre qty>0 en interne --- */
  const inventoryForGrid = {};
  for (const it of allItems) if (!equippedIds.has(it.id)) inventoryForGrid[it.id] = it;

  const hp = state.hpCur || 0, hpMax = eff.hp || 1;
  const mana = state.manaCur || 0, manaMax = eff.mana || 1;
  const hpPct = Math.max(0, Math.min(100, Math.round(hp / hpMax * 100)));
  const manaPct = Math.max(0, Math.min(100, Math.round(mana / manaMax * 100)));

  /* --- Style d'une vignette d'item (background-image, comme le mockup) --- */
  const itemThumbStyle = (item, inset) => ({
    position:'absolute', inset, cursor:'grab', display:'flex', alignItems:'center', justifyContent:'center',
    ...(item.img ? {
      backgroundImage:`url(${item.img})`, backgroundSize:'contain', backgroundRepeat:'no-repeat',
      backgroundPosition:'center', filter:'drop-shadow(0 2px 6px rgba(0,0,0,0.8))',
    } : {}),
    fontSize:18,
  });

  const cornerStyle = (h, v) => ({
    position:'absolute', [h]:6, [v]:6, width:14, height:14,
    [`border${h[0].toUpperCase()}${h.slice(1)}`]:'2px solid rgba(185,150,80,0.55)',
    [`border${v[0].toUpperCase()}${v.slice(1)}`]:'2px solid rgba(185,150,80,0.55)',
  });
  const Corners = () => (
    <React.Fragment>
      <div style={cornerStyle('left','top')} /><div style={cornerStyle('right','top')} />
      <div style={cornerStyle('left','bottom')} /><div style={cornerStyle('right','bottom')} />
    </React.Fragment>
  );

  const panelBg = 'linear-gradient(155deg,#1c1713 0%,#130f0c 55%,#0d0a08 100%)';

  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column',
      fontFamily:"'EB Garamond',serif", color:'#d8c8a8', background:'#000', overflow:'hidden' }}>

      {/* ===== ZONE PRINCIPALE (3 colonnes) ===== */}
      <div style={{ flex:'1 1 auto', display:'flex', minHeight:0, padding:12, gap:12, position:'relative' }}>

        {/* ---- GAUCHE : ÉQUIPEMENT + STATS ---- */}
        <div style={{ flex:'0 0 300px', position:'relative', display:'flex', flexDirection:'column',
          border:'1px solid rgba(160,128,72,0.3)', borderRadius:4, background:panelBg,
          boxShadow:'inset 0 0 55px rgba(0,0,0,0.5)', padding:'12px 14px', minHeight:0, zIndex:2 }}>
          <Corners />
          <div style={{ textAlign:'center', fontFamily:"'Cinzel',serif", fontSize:14, fontWeight:600,
            letterSpacing:3, color:'#c2a05a', marginBottom:12, flex:'0 0 auto' }}>ÉQUIPEMENT</div>

          {/* zone défilable : seul le contenu scrolle (les crochets d'angle restent collés au cadre) */}
          <div style={{ flex:'1 1 auto', minHeight:0, overflowY:'auto', overflowX:'hidden' }}>
          {/* grille des slots */}
          <div style={{ display:'flex', justifyContent:'center', flex:'0 0 auto' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,46px)', gridTemplateRows:'repeat(6,46px)',
              gap:6, gridTemplateAreas:EQUIP_GRID_AREAS }}>
              {Object.keys(EQUIP_SLOTS).map(key => {
                const def = EQUIP_SLOTS[key];
                const item = itemsById[equipment[key]] || null;
                const cs = invCatStyle(item);
                const hov = hoverSlot === key;
                return (
                  <div key={key}
                    onDragOver={(e) => { e.preventDefault(); const d = itemsById[draggingId]; const v = !!(d && def.accepts.includes(equipTypeForItem(d))); if (hoverSlot !== key || hoverValid !== v) { setHoverSlot(key); setHoverValid(v); } }}
                    onDragLeave={() => { if (hoverSlot === key) setHoverSlot(null); }}
                    onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text') || draggingId; if (id) tryEquip(id, key); setHoverSlot(null); setDraggingId(null); }}
                    style={{ position:'relative', gridArea:def.area, borderRadius:3,
                      border:'1px solid ' + (item ? cs.border : 'rgba(160,128,72,0.22)'),
                      boxShadow:item ? 'inset 0 0 16px ' + cs.glow : 'none',
                      background:item ? 'rgba(12,8,7,0.72)' : 'radial-gradient(circle at 50% 32%,#231a15,#100b09)',
                      display:'flex', alignItems:'center', justifyContent:'center', overflow:'visible',
                      cursor:item ? 'grab' : 'default' }}>
                    {!item && (
                      <div style={{ fontFamily:"'Cinzel',serif", fontSize:7, letterSpacing:0.4,
                        color:'rgba(195,168,120,0.32)', textTransform:'uppercase', textAlign:'center',
                        padding:2, pointerEvents:'none', lineHeight:1.2 }}>{def.label}</div>
                    )}
                    {item && (
                      <div draggable="true"
                        onDragStart={(e) => { e.dataTransfer.setData('text', item.id); setDraggingId(item.id); }}
                        onDoubleClick={() => unequip(item.id)}
                        onMouseEnter={(e) => showTip(e, item)} onMouseMove={moveTip} onMouseLeave={hideTip}
                        style={itemThumbStyle(item, '4px')}>
                        {!item.img && (item.ic || '◆')}
                      </div>
                    )}
                    {hov && (
                      <div style={{ position:'absolute', inset:-2, borderRadius:4, pointerEvents:'none',
                        background:(hoverValid ? '#b8924f' : '#a51f24') + '22',
                        boxShadow:'inset 0 0 0 2px ' + (hoverValid ? '#b8924f' : '#a51f24') + ', 0 0 20px ' + (hoverValid ? '#b8924f' : '#a51f24') + '88' }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* stats réelles — hauteur naturelle ; c'est le wrapper défilant qui scrolle
             si l'écran est court, sinon le bas des stats se faisait couper (flex:1 1 0 + overflow:hidden). */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginTop:14,
            paddingTop:12, borderTop:'1px solid rgba(160,128,72,0.15)', flex:'0 0 auto' }}>
            {[['ATTRIBUTS', attributs], ['COMBAT', combat], ['SURVIE', survie]].map(([title, rows]) => (
              <div key={title}>
                <div style={{ fontFamily:"'Cinzel',serif", fontSize:10, letterSpacing:1.5, color:'#c2a05a',
                  textAlign:'center', paddingBottom:5, marginBottom:5, borderBottom:'1px solid rgba(160,128,72,0.13)' }}>{title}</div>
                {rows.map(st => (
                  <div key={st.k} style={{ display:'flex', justifyContent:'space-between', fontSize:11.5, padding:'2px 0' }}>
                    <span style={{ color:'#9a8b76' }}>{st.k}</span><span style={{ color:st.col }}>{st.v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          </div>
        </div>

        {/* ---- CENTRE : PERSONNAGE ---- */}
        <div style={{ flex:'1 1 auto', position:'relative', display:'flex', alignItems:'flex-end',
          justifyContent:'center', minWidth:0, overflow:'hidden', zIndex:3 }}>
          <div style={{ position:'absolute', inset:'-20%', pointerEvents:'none', animation:'auraPulse 5s ease-in-out infinite',
            background:'radial-gradient(ellipse 55% 60% at 50% 45%,rgba(130,30,30,0.22),transparent 62%)' }} />
          <div style={{ position:'absolute', bottom:0, left:0, right:0, height:180, pointerEvents:'none', animation:'groundGlow 4s ease-in-out infinite',
            background:'radial-gradient(ellipse 70% 100% at 50% 100%,rgba(150,45,25,0.28),transparent 70%)' }} />
          <img src={EQUIP_PORTRAITS[char.id]} alt={char.name} draggable="false"
            style={{ position:'relative', zIndex:2, height:'100%', maxWidth:'100%', objectFit:'contain',
              objectPosition:'bottom center',
              filter:'drop-shadow(0 32px 60px rgba(0,0,0,1)) drop-shadow(0 0 80px rgba(180,40,40,0.32)) drop-shadow(-50px 0 70px rgba(90,15,15,0.2)) drop-shadow(50px 0 70px rgba(90,15,15,0.2))' }} />
          <div style={{ position:'absolute', bottom:10, left:'50%', transform:'translateX(-50%)', textAlign:'center', zIndex:3, whiteSpace:'nowrap' }}>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:20, fontWeight:600, letterSpacing:5, color:'#e9dcc4', textShadow:'0 2px 12px rgba(0,0,0,0.9)' }}>{char.name}</div>
            <div style={{ fontFamily:"'EB Garamond',serif", fontSize:13, fontStyle:'italic', color:'#9a8b76', marginTop:2 }}>« {char.title} »</div>
          </div>
        </div>

        {/* ---- DROITE : INVENTAIRE (grille partagée) ---- */}
        <div style={{ flex:'0 0 390px', minHeight:0, zIndex:2 }}>
          <InventoryGrid items={inventoryForGrid} coins={coins} filter={filter} setFilter={setFilter}
            onItemClick={openItemMenu} onCoinClick={openCoinMenu} onAdd={staff ? () => setCatalog(true) : undefined}
            onDropItem={(id) => { if (slotOfItem(id)) unequip(id); }} capacity={120} />
        </div>
      </div>

      {/* ===== HUD BAS ===== */}
      <div style={{ height:62, flex:'0 0 62px', display:'flex', alignItems:'center', gap:16, padding:'0 20px',
        borderTop:'1px solid rgba(160,128,72,0.2)', background:'linear-gradient(180deg,#0b0807,#14100c)',
        position:'relative', zIndex:10 }}>
        <div style={{ position:'relative', width:46, height:46, flex:'0 0 46px', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ position:'absolute', inset:0, transform:'rotate(45deg)', border:'2px solid #a51f24',
            background:'linear-gradient(135deg,#241712,#120c09)', boxShadow:'0 0 16px rgba(0,0,0,0.7)' }} />
          <span style={{ position:'relative', fontFamily:"'Cinzel',serif", fontSize:20, fontWeight:700, color:'#f0e6d2', zIndex:1 }}>{char.level}</span>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6, width:260 }}>
          <div style={{ position:'relative', height:18, border:'1px solid rgba(160,128,72,0.28)', borderRadius:3, background:'#160a09', overflow:'hidden' }}>
            <div style={{ height:'100%', width:hpPct + '%', background:'linear-gradient(90deg,#6b1216,#b3242a)', transition:'width .3s' }} />
            <span style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'EB Garamond',serif", fontSize:11, color:'#f0e6d2', textShadow:'0 1px 2px #000' }}>{invFmt(Math.round(hp))} / {invFmt(hpMax)}</span>
          </div>
          <div style={{ position:'relative', height:18, border:'1px solid rgba(160,128,72,0.28)', borderRadius:3, background:'#0b1118', overflow:'hidden' }}>
            <div style={{ height:'100%', width:manaPct + '%', background:'linear-gradient(90deg,#1a3a6b,#3672c4)', transition:'width .3s' }} />
            <span style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'EB Garamond',serif", fontSize:11, color:'#f0e6d2', textShadow:'0 1px 2px #000' }}>{invFmt(Math.round(mana))} / {invFmt(manaMax)}</span>
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:2, marginLeft:8 }}>
          <span style={{ fontFamily:"'Cinzel',serif", fontSize:15, letterSpacing:3, color:'#e9dcc4' }}>{char.name}</span>
          <span style={{ fontFamily:"'Cinzel',serif", fontSize:10, letterSpacing:2, color:'#c2a05a' }}>NIVEAU {char.level}</span>
        </div>
      </div>

      {/* ===== TOOLTIP ===== */}
      {tip && (() => {
        const it = tip.item;
        const cs = invCatStyle(it);
        const modRows = Object.keys(it.mods || {}).map(k => ({ k:(STAT_LABEL[k] || k), v:(it.mods[k] > 0 ? '+' : '') + it.mods[k] }));
        return (
          <div style={{ position:'fixed', left:Math.min(tip.x + 16, window.innerWidth - 255) + 'px',
            top:Math.min(tip.y + 16, window.innerHeight - 190) + 'px', zIndex:9999, width:242, padding:'13px 15px',
            pointerEvents:'none', background:'linear-gradient(180deg,rgba(22,16,13,0.97),rgba(12,9,7,0.98))',
            border:'1px solid ' + cs.border, borderRadius:4, boxShadow:'0 10px 32px rgba(0,0,0,0.85),0 0 18px ' + cs.glow,
            fontFamily:"'EB Garamond',serif" }}>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:14, fontWeight:600, color:'#e9dcc4' }}>{it.name}</div>
            <div style={{ fontSize:12.5, color:'#9a8b76', fontStyle:'italic', marginTop:2 }}>{it.sub || (it.cat + (it.qty > 1 ? ' · ×' + it.qty : ''))}</div>
            {modRows.length > 0 && (
              <React.Fragment>
                <div style={{ height:1, background:'rgba(160,128,72,0.22)', margin:'8px 0' }} />
                {modRows.map(st => (
                  <div key={st.k} style={{ display:'flex', justifyContent:'space-between', fontSize:12.5, padding:'2px 0' }}>
                    <span style={{ color:'#9a8b76' }}>{st.k}</span><span style={{ color:'#9fd07a' }}>{st.v}</span>
                  </div>
                ))}
              </React.Fragment>
            )}
          </div>
        );
      })()}

      {/* ===== POPOVERS : menu d'actions / stepper de quantité / éditeur d'item ===== */}
      {menu && <ItemActionMenu item={menu.item} x={menu.x} y={menu.y} actions={menu.actions} onClose={() => setMenu(null)} />}
      {stepper && stepper.kind === 'item' && (
        <AmountStepper max={stepper.item.qty} x={stepper.x} y={stepper.y}
          label={`Envoyer combien de « ${stepper.item.name} » au commun ?`} confirmLabel="Envoyer"
          onConfirm={(n) => sendToCommon(stepper.item, n)} onClose={() => setStepper(null)} />
      )}
      {stepper && stepper.kind === 'coin' && (
        <AmountStepper max={stepper.max} x={stepper.x} y={stepper.y}
          label="Déposer combien au commun ?" confirmLabel="Déposer"
          onConfirm={(n) => moveCoins(`${charPath(char.id)}/coins`, SHARED_COINS, coins, sharedCoins || {}, stepper.coinKey, n)}
          onClose={() => setStepper(null)} />
      )}
      {editing && (
        <div className="modal-scrim" onClick={() => setEditing(null)} style={{ display:'flex', alignItems:'center', justifyContent:'center', zIndex:210 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width:'min(420px,92vw)', background:'var(--bg-deep)', border:'1px solid var(--line-gold)', borderRadius:12, padding:16 }}>
            <InvItemRow item={editing} editable={true} startEdit={true}
              onSave={(it) => { setInvItem(it.id, it); setEditing(null); }}
              onRemove={(id) => { removeInvItem(id); setEditing(null); }} />
          </div>
        </div>
      )}
      {catalog && (
        <ItemCatalogPicker
          onPick={(entry, n) => {
            const { patch } = planItemAdd(inventoryForGrid, entry, n);
            Object.entries(patch).forEach(([id, it]) => setInvItem(id, it));
            setCatalog(false);
            toast(`<b>${char.name}</b> — ${entry.name} ×${n} ajouté`, 'gold');
          }}
          onCustom={() => { setCatalog(false); addItem(); }}
          onClose={() => setCatalog(false)} />
      )}
    </div>
  );
}

/* ---- Page complète : sélecteur de perso (staff) ou verrouillé (joueur) ---- */
function EquipPage({ lockedCharId }) {
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
      <div style={{ flex:'1 1 auto', minHeight:0 }}>
        <EquipBody key={char.id} char={char} />
      </div>
    </div>
  );
}

Object.assign(window, { EquipPage, EquipBody });
