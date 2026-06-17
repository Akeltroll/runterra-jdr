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

/* Monnaie : clés de char.coins -> image + couleur de valeur (valeur croissante). */
const EQUIP_COINS = [
  { key:'cuiv', label:'Fer',     img:'ATH/Items/piece-fer.webp',     col:'#b0b0b0' },
  { key:'arg',  label:'Bronze',  img:'ATH/Items/piece-bronze.webp',  col:'#cd9a6a' },
  { key:'or',   label:'Or',      img:'ATH/Items/piece-or.webp',      col:'#eccf8f' },
  { key:'plat', label:'Mythril', img:'ATH/Items/piece-mythril.webp', col:'#b8d4e8' },
];

/* Style de case par catégorie (pas de système de rareté dans les données). */
const EQUIP_CAT_STYLE = {
  'Équipement':   { border:'rgba(200,155,60,0.55)',  glow:'rgba(200,155,60,0.30)'  },
  'Consommables': { border:'rgba(43,111,176,0.55)',  glow:'rgba(43,111,176,0.30)'  },
  'Butin':        { border:'rgba(139,224,255,0.42)', glow:'rgba(139,224,255,0.16)' },
};
const EQUIP_CAT_FALLBACK = { border:'rgba(160,128,72,0.45)', glow:'rgba(160,128,72,0.22)' };
const equipCatStyle = (it) => (it && EQUIP_CAT_STYLE[it.cat]) || EQUIP_CAT_FALLBACK;

/* Type d'item -> slot compatible. `item.type` explicite prioritaire (futur back).
   À défaut on infère : arme (image dans /Armes/) -> weapon ; autre équipement
   -> accessory ; consommables/butin -> non équipables. */
function equipTypeForItem(it) {
  if (!it) return null;
  if (it.type) return it.type;
  if (it.img && it.img.indexOf('/Armes/') !== -1) return 'weapon';
  if (it.cat === 'Équipement') return 'accessory';
  return null;
}

const equipFmt = (n) => Number(n || 0).toLocaleString('fr-FR');

/* Filtres d'inventaire alignés sur les catégories réelles du projet. */
const EQUIP_FILTERS = [
  { key:'all',          label:'Tout' },
  { key:'Équipement',   label:'Équip.' },
  { key:'Consommables', label:'Conso.' },
  { key:'Butin',        label:'Butin' },
];

/* ---- Corps de la page pour un perso donné ---- */
function EquipBody({ char }) {
  const { state, setEquipment } = useCharState(char.id);
  const [filter, setFilter] = useState('all');
  const [draggingId, setDraggingId] = useState(null);
  const [hoverSlot, setHoverSlot] = useState(null);
  const [hoverValid, setHoverValid] = useState(false);
  const [tip, setTip] = useState(null);            // { item, x, y }

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

  /* --- Stats effectives réelles + bonus d'items équipés (item.mods) --- */
  const activeBuffs = Object.keys(state.buffs || {});
  const eff = computeEffective(char.stats, state.modifiers, activeBuffs);
  const bonuses = {};
  equippedItems.forEach(it => {
    const m = it.mods || {};
    for (const k of Object.keys(m)) { const v = Number(m[k]) || 0; if (v) bonuses[k] = (bonuses[k] || 0) + v; }
  });
  const sval = (k, base, pct) => {
    const tot = (base || 0) + (bonuses[k] || 0);
    return pct ? tot.toFixed(1) + '%' : equipFmt(tot);
  };
  const scol = (k) => (bonuses[k] ? '#9fd07a' : '#e9dcc4');

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
    { k:'Bouclier',   v:equipFmt(char.shieldMax), col:'#e9dcc4' },
    { k:'Vol de vie', v:sval('vol', 0, true),     col:scol('vol')  },
    { k:'Omnivamp',   v:sval('omni', 0, true),    col:scol('omni') },
  ];

  /* --- Inventaire filtré (non équipé) --- */
  const inInventory = allItems.filter(it => !equippedIds.has(it.id));
  const filtered = inInventory.filter(it => filter === 'all' || it.cat === filter);
  const N = Math.max(49, Math.ceil(filtered.length / 7) * 7);
  const cells = Array.from({ length:N }, (_, i) => filtered[i] || null);

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
          boxShadow:'inset 0 0 55px rgba(0,0,0,0.5)', padding:'12px 14px', minHeight:0, zIndex:2,
          overflowY:'auto', overflowX:'hidden' }}>
          <Corners />
          <div style={{ textAlign:'center', fontFamily:"'Cinzel',serif", fontSize:14, fontWeight:600,
            letterSpacing:3, color:'#c2a05a', marginBottom:12, flex:'0 0 auto' }}>ÉQUIPEMENT</div>

          {/* grille des slots */}
          <div style={{ display:'flex', justifyContent:'center', flex:'0 0 auto' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,46px)', gridTemplateRows:'repeat(6,46px)',
              gap:6, gridTemplateAreas:EQUIP_GRID_AREAS }}>
              {Object.keys(EQUIP_SLOTS).map(key => {
                const def = EQUIP_SLOTS[key];
                const item = itemsById[equipment[key]] || null;
                const cs = equipCatStyle(item);
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

          {/* stats réelles */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginTop:14,
            paddingTop:12, borderTop:'1px solid rgba(160,128,72,0.15)', flex:'1 1 0', overflow:'hidden' }}>
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

        {/* ---- DROITE : INVENTAIRE ---- */}
        <div style={{ flex:'0 0 390px', position:'relative', display:'flex', flexDirection:'column',
          border:'1px solid rgba(160,128,72,0.3)', borderRadius:4, background:panelBg,
          boxShadow:'inset 0 0 55px rgba(0,0,0,0.5)', padding:'12px 12px 0', minHeight:0, zIndex:2 }}>
          <Corners />
          <div style={{ textAlign:'center', fontFamily:"'Cinzel',serif", fontSize:14, fontWeight:600,
            letterSpacing:3, color:'#c2a05a', marginBottom:10, flex:'0 0 auto' }}>INVENTAIRE</div>

          {/* filtres */}
          <div style={{ display:'flex', gap:4, marginBottom:10, flex:'0 0 auto' }}>
            {EQUIP_FILTERS.map(ft => {
              const on = filter === ft.key;
              return (
                <div key={ft.key} onClick={() => setFilter(ft.key)}
                  style={{ flex:1, textAlign:'center', fontFamily:'Cinzel,serif', fontSize:10, letterSpacing:0.4,
                    padding:'7px 2px', cursor:'pointer', textTransform:'uppercase', borderRadius:3,
                    border:'1px solid ' + (on ? 'rgba(160,128,72,0.5)' : 'rgba(160,128,72,0.16)'),
                    color:on ? '#eccf8f' : 'rgba(190,170,135,0.5)',
                    background:on ? 'linear-gradient(180deg,#2a1f16,#1a130e)' : 'transparent' }}>{ft.label}</div>
              );
            })}
          </div>

          {/* grille (déposer ici = déséquiper) */}
          <div onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text') || draggingId; if (id && slotOfItem(id)) unequip(id); setHoverSlot(null); setDraggingId(null); }}
            style={{ flex:'1 1 auto', overflowY:'auto', overflowX:'hidden', minHeight:0 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:5, paddingBottom:8 }}>
              {cells.map((item, i) => {
                const cs = equipCatStyle(item);
                return (
                  <div key={i} style={{ position:'relative', aspectRatio:'1', borderRadius:3,
                    background:item ? 'rgba(12,8,7,0.7)' : 'radial-gradient(circle at 50% 30%,#1b1510,#0e0a08)',
                    border:'1px solid ' + (item ? cs.border : 'rgba(160,128,72,0.16)'),
                    boxShadow:item ? 'inset 0 0 14px ' + cs.glow : 'none',
                    display:'flex', alignItems:'center', justifyContent:'center', overflow:'visible' }}>
                    {item && (
                      <div draggable="true"
                        onDragStart={(e) => { e.dataTransfer.setData('text', item.id); setDraggingId(item.id); }}
                        onDoubleClick={() => autoEquip(item.id)}
                        onMouseEnter={(e) => showTip(e, item)} onMouseMove={moveTip} onMouseLeave={hideTip}
                        style={itemThumbStyle(item, '3px')}>
                        {!item.img && (item.ic || '◆')}
                      </div>
                    )}
                    {item && item.qty > 1 && (
                      <span style={{ position:'absolute', right:3, bottom:1, fontFamily:"'EB Garamond',serif",
                        fontSize:13, fontWeight:600, color:'#f0e6d2', textShadow:'0 1px 3px #000,0 0 5px #000',
                        pointerEvents:'none', zIndex:1 }}>{equipFmt(item.qty)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* monnaie */}
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 4px 6px',
            borderTop:'1px solid rgba(160,128,72,0.16)', flex:'0 0 auto' }}>
            {EQUIP_COINS.map(c => (
              <div key={c.key} style={{ display:'flex', alignItems:'center', gap:4 }}>
                <div style={{ width:30, height:30, flex:'0 0 30px',
                  background:`url(${c.img}) center/contain no-repeat` }} />
                <span style={{ fontFamily:"'EB Garamond',serif", fontSize:13, color:c.col, minWidth:32 }}>
                  {equipFmt((char.coins && char.coins[c.key]) || 0)}
                </span>
              </div>
            ))}
            <div style={{ flex:1 }} />
            <span style={{ fontFamily:"'Cinzel',serif", fontSize:11, color:'#c2a05a', letterSpacing:0.5 }}>
              {inInventory.length} / 120
            </span>
          </div>
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
            <span style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'EB Garamond',serif", fontSize:11, color:'#f0e6d2', textShadow:'0 1px 2px #000' }}>{equipFmt(Math.round(hp))} / {equipFmt(hpMax)}</span>
          </div>
          <div style={{ position:'relative', height:18, border:'1px solid rgba(160,128,72,0.28)', borderRadius:3, background:'#0b1118', overflow:'hidden' }}>
            <div style={{ height:'100%', width:manaPct + '%', background:'linear-gradient(90deg,#1a3a6b,#3672c4)', transition:'width .3s' }} />
            <span style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'EB Garamond',serif", fontSize:11, color:'#f0e6d2', textShadow:'0 1px 2px #000' }}>{equipFmt(Math.round(mana))} / {equipFmt(manaMax)}</span>
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
        const cs = equipCatStyle(it);
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
