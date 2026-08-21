/* ============================================================
   PAGE — INVENTAIRE COMMUN (coffre partagé, accès total)
   Grille à gauche + panneau de détail à droite (master-détail).
   ============================================================ */

/* Panneau de détail dark-fantasy d'un objet sélectionné (image, infos, stats, actions).
   canEdit = staff uniquement (Éditer/Supprimer cachés aux joueurs ; ils gardent Prendre). */
function ItemDetail({ item, onTake, onEdit, onRemove, canEdit }) {
  const panelBg = 'linear-gradient(155deg,#1c1713 0%,#130f0c 55%,#0d0a08 100%)';
  const frame = {
    position:'relative', height:'100%', minHeight:0, display:'flex', flexDirection:'column',
    border:'1px solid rgba(160,128,72,0.3)', borderRadius:4, background:panelBg,
    boxShadow:'inset 0 0 55px rgba(0,0,0,0.5)', padding:20,
    fontFamily:"'EB Garamond',serif", color:'#d8c8a8',
  };
  if (!item) {
    return (
      <div style={{ ...frame, alignItems:'center', justifyContent:'center', textAlign:'center' }}>
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:13, letterSpacing:1.5, color:'rgba(190,170,135,0.45)' }}>
          Sélectionnez un objet<br/>pour voir son détail
        </div>
      </div>
    );
  }
  const cs = invCatStyle(item);
  const typeLabel = item.type ? ((window.EQUIP_TYPES || []).find(t => t.value === item.type) || {}).label : null;
  const modEntries = item.mods ? Object.entries(item.mods).filter(([, v]) => v) : [];
  const statLabel = (k) => (window.STAT_LABEL && window.STAT_LABEL[k]) || k;

  return (
    <div style={frame}>
      {/* Image */}
      <div style={{ alignSelf:'center', width:140, height:140, flex:'0 0 auto', borderRadius:6,
        border:'1px solid ' + cs.border, boxShadow:'inset 0 0 24px ' + cs.glow,
        background:'rgba(12,8,7,0.6)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16,
        ...(item.img ? { backgroundImage:`url(${item.img})`, backgroundSize:'contain', backgroundRepeat:'no-repeat',
          backgroundPosition:'center' } : {}) }}>
        {!item.img && <span style={{ fontSize:54, filter:'drop-shadow(0 2px 6px rgba(0,0,0,0.8))' }}>{item.ic || '◆'}</span>}
      </div>

      {/* Nom + classification */}
      <div style={{ textAlign:'center', marginBottom:12, flex:'0 0 auto' }}>
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:19, fontWeight:600, color:'#eccf8f', letterSpacing:0.5 }}>{item.name}</div>
        <div style={{ fontSize:13, color:'rgba(190,170,135,0.7)', marginTop:3 }}>
          {item.cat}{typeLabel ? ' · ' + typeLabel : ''}
        </div>
      </div>

      {/* Corps défilable : description + stats + quantité */}
      <div style={{ flex:'1 1 auto', minHeight:0, overflowY:'auto', borderTop:'1px solid rgba(160,128,72,0.18)', paddingTop:12 }}>
        {item.sub && (
          <div style={{ fontSize:14, lineHeight:1.55, fontStyle:'italic', color:'#c9b990', marginBottom:14 }}>
            « {item.sub} »
          </div>
        )}
        {modEntries.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 14px', marginBottom:14 }}>
            {modEntries.map(([k, v]) => (
              <span key={k} style={{ fontSize:14, color:'#7fd17f' }}>
                {statLabel(k)} {v > 0 ? '+' : ''}{v}
              </span>
            ))}
          </div>
        )}
        <div style={{ fontSize:13, color:'rgba(190,170,135,0.8)' }}>
          Quantité : <b style={{ color:'#f0e6d2' }}>{invFmt(item.qty || 0)}</b>
        </div>
        {invWeightLabel(item) && (
          <div style={{ fontSize:13, color:'rgba(190,170,135,0.8)', marginTop:4 }}>
            ⚖ Poids : <b style={{ color:'#f0e6d2' }}>{invWeightLabel(item)}</b>
          </div>
        )}
        {Number(item.carry) > 0 && (
          <div style={{ fontSize:13, color:'rgba(190,170,135,0.8)', marginTop:4 }}>
            🎒 Capacité portée : <b style={{ color:'#7fd17f' }}>+{invFmt(item.carry)}</b>
            <span className="dim" style={{ fontSize:12 }}> (pour qui l'équipe)</span>
          </div>
        )}
        {Number(item.carryGroup) > 0 && (
          <div style={{ fontSize:13, color:'rgba(190,170,135,0.8)', marginTop:4 }}>
            🐫 Capacité du groupe : <b style={{ color:'#7fd17f' }}>+{invFmt(item.carryGroup)}</b>
            <span className="dim" style={{ fontSize:12 }}> (dans le coffre ou équipé)</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="row gap-2" style={{ flex:'0 0 auto', marginTop:14, paddingTop:14,
        borderTop:'1px solid rgba(160,128,72,0.18)', justifyContent:'flex-end' }}>
        <button className="btn btn-sm btn-gold" onClick={onTake}>Prendre</button>
        {canEdit && <button className="btn btn-sm btn-ghost" onClick={onEdit}>Éditer</button>}
        {canEdit && <button className="btn btn-sm btn-ghost" style={{ color:'var(--debuff-bright,#e0463f)' }} onClick={onRemove}>Supprimer</button>}
      </div>
    </div>
  );
}

/* Attelage du groupe : les 5 emplacements de transport actifs (2 montures + 3 sacs).
   Un objet du coffre n'apporte sa capacité de groupe (`carryGroup`) qu'ATTELÉ ici — sans
   ça, dix sacs rangés en vrac gonfleraient la capacité commune de +200.
   Dépôt par glisser-déposer depuis la grille, ou par clic sur l'objet (« Atteler »).
   Ouvert à tous les inscrits : ranger la monture n'est pas un acte de MJ. */
function TransportRack({ transport, items, onSet, onSlotClick }) {
  const [over, setOver] = useState(null);
  const slotBase = {
    position:'relative', height:64, borderRadius:4, display:'flex', alignItems:'center',
    justifyContent:'center', flexDirection:'column', gap:2, cursor:'pointer',
    background:'rgba(12,8,7,0.55)', border:'1px solid rgba(160,128,72,0.28)',
    boxShadow:'inset 0 0 18px rgba(0,0,0,0.55)', transition:'border-color .15s,box-shadow .15s',
  };
  /* Le navigateur interdit de LIRE dataTransfer pendant le survol (sécurité) : impossible de
     savoir au `dragover` si l'objet est acceptable. On se contente donc de signaler la cible,
     et `transportAccepts` tranche au dépôt — un objet refusé retombe simplement dans le coffre. */
  const drop = (slot, e) => {
    e.preventDefault(); setOver(null);
    const id = e.dataTransfer.getData('text');   // même clé que le reste des grilles
    const it = id && items ? items[id] : null;
    if (!it) return;
    if (!transportAccepts(slot, it)) return;   // silencieux : le liseré rouge a déjà prévenu
    onSet(slot.key, id);
  };
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }}>
      {TRANSPORT_SLOTS.map(slot => {
        const it = transport && transport[slot.key] ? (items || {})[transport[slot.key]] : null;
        const hot = over && over.key === slot.key;
        const ok = hot && over.ok;
        return (
          <div key={slot.key} title={it ? `${it.name} — capacité de groupe +${invFmt(it.carryGroup)}` : `${slot.label} — vide`}
            onDragOver={(e) => { e.preventDefault(); setOver({ key:slot.key, ok:true }); }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => drop(slot, e)}
            onClick={() => onSlotClick(slot, it)}
            style={{ ...slotBase,
              ...(hot ? { borderColor: ok ? 'rgba(200,163,90,0.85)' : 'var(--hp)',
                          boxShadow:'inset 0 0 18px rgba(0,0,0,0.55),0 0 12px rgba(200,163,90,0.35)' } : {}),
              ...(it ? { borderColor:'rgba(200,163,90,0.55)' } : {}) }}>
            {it ? (
              <React.Fragment>
                <div style={{ width:30, height:30, ...(it.img
                  ? { backgroundImage:`url(${it.img})`, backgroundSize:'contain', backgroundRepeat:'no-repeat', backgroundPosition:'center' }
                  : {}), display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>
                  {!it.img && (it.ic || '◆')}
                </div>
                <div style={{ fontSize:10, color:'#7fd17f', fontFamily:"'EB Garamond',serif" }}>+{invFmt(it.carryGroup)}</div>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <div style={{ fontSize:19, opacity:0.32 }}>{slot.accepts.includes('mount') ? '🐫' : '🎒'}</div>
                <div style={{ fontFamily:"'Cinzel',serif", fontSize:8.5, letterSpacing:0.5,
                  color:'rgba(190,170,135,0.42)', textTransform:'uppercase' }}>{slot.label}</div>
              </React.Fragment>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* Jauge de charge du coffre commun (§3-5 du doc « Inventaire commun »).
   Capacité = SOMME des capacités de base des 5 personnages + attelage ; confort = MOYENNE
   de leurs seuils individuels. Affichage seul : les malus sont arbitrés à la table. */
function CommonWeightBar({ carried, capacity, comfort, comfortPct, state, detail }) {
  const info = (window.WEIGHT_STATE || {})[state] || { label:'Léger', col:'#9fd07a' };
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', fontSize:11, marginBottom:4 }}>
        <span title={detail} style={{ fontFamily:"'Cinzel',serif", letterSpacing:1, color:'#c2a05a', cursor:'help' }}>
          CHARGE DU COFFRE
        </span>
        <span>
          <span style={{ color:info.col, fontWeight:700, marginRight:6 }}>{info.label}</span>
          <span style={{ color:'#9a8b76' }}>{invWeightFmt(carried)} / {capacity}</span>
        </span>
      </div>
      <div style={{ position:'relative', height:7, borderRadius:4, background:'var(--bg-inset)',
        overflow:'hidden', border:'1px solid rgba(160,128,72,0.18)' }}>
        <div style={{ height:'100%', width:`${Math.min(100, (capacity > 0 ? carried / capacity : 0) * 100)}%`,
          background:info.col, transition:'width .2s' }} />
        {capacity > 0 && (
          <div title={`Seuil de confort : ${comfort}`} style={{ position:'absolute', top:0, bottom:0,
            left:`${Math.min(100, comfortPct * 100)}%`, width:2, background:'#f0e6cf', opacity:0.85 }} />
        )}
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', fontSize:10, color:'#8a7c68', marginTop:2 }}>
        confort ≤ {comfort}
      </div>
    </div>
  );
}

function CommonInventoryPage() {
  const { items, setItem, removeItem } = useSharedInventory();
  const { coins: sharedCoins } = useSharedCoins();
  const { role, charId } = useAuthIdentity();
  const all = useAllCharStates();
  const { transport, setSlot } = useSharedTransport();
  const profiles = useGroupCarry();   // AFFICHAGE SEUL — voir le commentaire du hook
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [stepper, setStepper] = useState(null);    // { kind, item|coinKey, dest, x, y, max }
  const [editing, setEditing] = useState(null);
  const [destPick, setDestPick] = useState(null);   // { x, y, onDest } pour le MJ
  const [catalog, setCatalog] = useState(false);    // ouverture du catalogue d'ajout
  const [coinMenu, setCoinMenu] = useState(null);   // { name, x, y, actions } — clic sur une pièce (staff)
  const [purse, setPurse] = useState(false);        // éditeur de bourse du coffre (MJ)
  const [attach, setAttach] = useState(null);       // slot d'attelage en attente d'un objet
  const toast = useToast();

  const charInv = (id) => (all && all[id] && all[id].state && all[id].state.inventory) || {};
  const charCoins = (id) => (all && all[id] && all[id].state && all[id].state.coins) || { plat:0, or:0, arg:0, cuiv:0 };

  const takeItem = (item, n, destCharId) => {
    moveItem(SHARED_INV, `${charPath(destCharId)}/inventory`, items || {}, charInv(destCharId), item.id, n);
  };
  const takeCoins = (key, n, destCharId) => {
    moveCoins(SHARED_COINS, `${charPath(destCharId)}/coins`, sharedCoins || {}, charCoins(destCharId), key, n);
  };

  // Destinataire : joueur = sa fiche ; MJ/admin = sélection (destPick → liste de persos).
  const resolveDest = (onDest, e, payload) => {
    if (!isStaff(role)) { if (charId) onDest(charId); return; }
    setDestPick({ ...payload, x:e.clientX, y:e.clientY, onDest });
  };

  // Objet sélectionné, résolu live depuis items (suit les MAJ temps réel ; disparaît si pris/supprimé).
  const sel = (selectedId && items) ? items[selectedId] : null;

  const takeSelected = (e) => resolveDest((dest) => {
    if ((sel.qty || 1) > 1) setStepper({ kind:'item', item:sel, dest, x:e.clientX, y:e.clientY, max:sel.qty });
    else takeItem(sel, 1, dest);
  }, e, {});

  // Retrait du coffre vers une fiche (flux commun joueur/MJ).
  const takeCoinFlow = (key, x, y) => {
    const max = (sharedCoins && sharedCoins[key]) || 0;
    if (max <= 0) return;
    resolveDest((dest) => setStepper({ kind:'coin', coinKey:key, dest, x, y, max }),
      { clientX:x, clientY:y }, {});
  };
  // Joueur : clic = prendre. Staff : menu (prendre / éditer librement la bourse du coffre).
  const openCoinMenu = (key, e) => {
    const x = e.clientX, y = e.clientY;
    if (!staff) return takeCoinFlow(key, x, y);
    const max = (sharedCoins && sharedCoins[key]) || 0;
    const coin = INV_COINS.find(c => c.key === key);
    const actions = [];
    if (max > 0) actions.push({ label:'Prendre…', onClick:() => takeCoinFlow(key, x, y) });
    actions.push({ label:'Modifier la bourse (MJ)', onClick:() => setPurse(true) });
    setCoinMenu({ name:`${coin ? coin.label : key} — ${invFmt(max)}`, x, y, actions });
  };
  const addItem = () => { const it = makeItem({ cat:'Butin', name:'Nouvel objet' }); setItem(it.id, it); setSelectedId(it.id); setEditing(it); };
  const staff = isStaff(role);

  /* --- Charge du coffre (§3-5 du doc « Inventaire commun ») ---
     Poids : appelé SANS equipment — le coffre n'a pas de porteur, donc aucune réduction
     Mental sur l'armure ; une armure rangée compte pour son poids de base (§7 du doc). */
  const bonusGroup = sumTransportCarry(transport, items);
  const groupCap = groupCarryCapacity(profiles, bonusGroup);
  const groupPct = groupComfortPct(profiles);
  const chestWeight = carriedWeight(items || {}, 0, {}, sharedCoins);
  const chestStatus = weightStatusPct(chestWeight, groupCap, groupPct);
  const capDetail = `Somme des capacités des ${profiles.length} personnages : `
    + `${invWeightFmt(groupCarryBase(profiles))} — dont ${Math.round(GROUP_CARRY_RATIO * 100)} % `
    + `consacrés au portage collectif (le reste est déjà pris par les sacs personnels), `
    + `soit ${invFmt(groupCap - bonusGroup)}. Attelage du groupe : +${invFmt(bonusGroup)} (bonus plein). `
    + `Confort commun ${(groupPct * 100).toFixed(1).replace('.', ',')} % = moyenne des seuils individuels.`;

  // Atteler / dételer : clic sur un slot (dépôt alternatif au glisser-déposer).
  const onSlotClick = (slot, cur) => {
    if (cur) { setSlot(slot.key, null); return; }   // slot occupé → dételer
    setAttach(slot);
  };
  const attachables = attach
    ? Object.values(items || {}).filter(it => transportAccepts(attach, it))
    : [];
  // Rangement manuel du coffre (staff) : drag & drop sur une case → réindexe l'ordre.
  const reorderShared = (draggedId, targetId) => {
    const patch = planReorder(items || {}, draggedId, targetId);
    Object.entries(patch).forEach(([id, order]) => { const it = items[id]; if (it) setItem(id, { ...it, order }); });
  };

  return (
    <div className="col" style={{ height:'100%', minHeight:0, padding:16 }}>
      <h2 style={{ marginBottom:4 }}>Inventaire commun</h2>
      <p className="dim" style={{ fontSize:13, marginBottom:12 }}>Coffre partagé de l'équipe. Cliquez un objet pour afficher son détail et agir dessus.</p>
      <CommonWeightBar carried={chestWeight} capacity={groupCap} comfort={chestStatus.comfort}
        comfortPct={chestStatus.comfortPct} state={chestStatus.state} detail={capDetail} />
      <div style={{ marginBottom:12 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:5 }}>
          <span style={{ fontFamily:"'Cinzel',serif", fontSize:11, letterSpacing:1, color:'#c2a05a' }}>
            ATTELAGE DU GROUPE
          </span>
          <span className="dim" style={{ fontSize:11 }}>
            {bonusGroup > 0
              ? <span style={{ color:'#7fd17f' }}>+{invFmt(bonusGroup)} de capacité</span>
              : 'Glissez ici une monture ou un sac pour augmenter la capacité du coffre'}
          </span>
        </div>
        <TransportRack transport={transport} items={items} onSet={setSlot} onSlotClick={onSlotClick} />
      </div>
      <div style={{ flex:'1 1 auto', minHeight:0, display:'flex', gap:16 }}>
        <div style={{ flex:'0 0 440px', maxWidth:'48%', minHeight:0 }}>
          {items === null
            ? <div className="dim">Chargement…</div>
            : <InventoryGrid items={items} coins={sharedCoins} filter={filter} setFilter={setFilter}
                onItemClick={(item) => setSelectedId(item.id)} onCoinClick={openCoinMenu} onAdd={staff ? () => setCatalog(true) : undefined}
                onReorderItem={staff ? reorderShared : undefined}
                title="INVENTAIRE COMMUN" capacity={240} />}
        </div>
        <div style={{ flex:'1 1 auto', minHeight:0 }}>
          <ItemDetail item={sel} canEdit={staff} onTake={takeSelected}
            onEdit={() => setEditing(sel)}
            onRemove={() => { removeItem(sel.id); setSelectedId(null); }} />
        </div>
      </div>

      {attach && (
        <div className="modal-scrim" onClick={() => setAttach(null)} style={{ display:'flex', alignItems:'center', justifyContent:'center', zIndex:210 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width:'min(380px,92vw)', background:'var(--bg-deep)',
            border:'1px solid var(--line-gold)', borderRadius:12, padding:16 }}>
            <h3 style={{ marginBottom:6 }}>Atteler — {attach.label}</h3>
            <p className="dim" style={{ fontSize:12, marginBottom:12 }}>
              Seuls les objets du coffre qui apportent une <b>capacité de groupe</b> peuvent être attelés.
            </p>
            {attachables.length === 0 ? (
              <p className="dim" style={{ fontSize:13 }}>
                Aucun objet éligible dans le coffre. Donnez à un objet une « Capacité groupe (+coffre) »
                dans son éditeur{attach.accepts.includes('mount') ? ', et le type « Monture »' : ', et le type « Sac / Contenant »'} pour le rendre attelable ici.
              </p>
            ) : (
              <div className="col gap-2">
                {attachables.map(it => (
                  <button key={it.id} className="btn btn-sm btn-ghost" style={{ justifyContent:'space-between' }}
                    onClick={() => { setSlot(attach.key, it.id); setAttach(null); }}>
                    <span>{it.ic || '◆'} {it.name}</span>
                    <span style={{ color:'#7fd17f' }}>+{invFmt(it.carryGroup)}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="row" style={{ justifyContent:'flex-end', marginTop:14 }}>
              <button className="btn btn-sm btn-ghost" onClick={() => setAttach(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
      {coinMenu && (
        <ItemActionMenu item={{ name:coinMenu.name }} x={coinMenu.x} y={coinMenu.y}
          actions={coinMenu.actions} onClose={() => setCoinMenu(null)} />
      )}
      {purse && (
        <CoinEditor title="Bourse du coffre commun" coins={sharedCoins || {}} onClose={() => setPurse(false)}
          onApply={(patch) => { setSharedCoins(patch); toast('Bourse du <b>coffre commun</b> mise à jour', 'gold'); }} />
      )}
      {destPick && (
        <ItemActionMenu item={{ name:'Donner à…' }} x={destPick.x} y={destPick.y}
          actions={CHARACTERS.map(c => ({ label:c.name, onClick:() => destPick.onDest(c.id) }))}
          onClose={() => setDestPick(null)} />
      )}
      {stepper && stepper.kind === 'item' && (
        <AmountStepper max={stepper.max} x={stepper.x} y={stepper.y}
          label={`Prendre combien de « ${stepper.item.name} » ?`} confirmLabel="Prendre"
          onConfirm={(n) => takeItem(stepper.item, n, stepper.dest)} onClose={() => setStepper(null)} />
      )}
      {stepper && stepper.kind === 'coin' && (
        <AmountStepper max={stepper.max} x={stepper.x} y={stepper.y}
          label="Retirer combien du commun ?" confirmLabel="Retirer"
          onConfirm={(n) => takeCoins(stepper.coinKey, n, stepper.dest)} onClose={() => setStepper(null)} />
      )}
      {editing && (
        <div className="modal-scrim" onClick={() => setEditing(null)} style={{ display:'flex', alignItems:'center', justifyContent:'center', zIndex:210 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width:'min(420px,92vw)', background:'var(--bg-deep)', border:'1px solid var(--line-gold)', borderRadius:12, padding:16 }}>
            <InvItemRow item={editing} editable={true} startEdit={true}
              onSave={(it) => { setItem(it.id, it); setEditing(null); }}
              onRemove={(id) => { removeItem(id); setEditing(null); setSelectedId(null); }} />
          </div>
        </div>
      )}
      {catalog && (
        <ItemCatalogPicker staff={staff}
          onPick={(entry, n) => {
            const { patch } = planItemAdd(items || {}, entry, n);
            Object.entries(patch).forEach(([id, it]) => setItem(id, it));
            setCatalog(false);
          }}
          onCustom={() => { setCatalog(false); addItem(); }}
          onClose={() => setCatalog(false)} />
      )}
    </div>
  );
}

Object.assign(window, { CommonInventoryPage });
