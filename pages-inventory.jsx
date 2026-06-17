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

function CommonInventoryPage() {
  const { items, setItem, removeItem } = useSharedInventory();
  const { coins: sharedCoins } = useSharedCoins();
  const { role, charId } = useAuthIdentity();
  const all = useAllCharStates();
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [stepper, setStepper] = useState(null);    // { kind, item|coinKey, dest, x, y, max }
  const [editing, setEditing] = useState(null);
  const [destPick, setDestPick] = useState(null);   // { x, y, onDest } pour le MJ

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

  const openCoinMenu = (key, e) => {
    const max = (sharedCoins && sharedCoins[key]) || 0;
    if (max <= 0) return;
    resolveDest((dest) => setStepper({ kind:'coin', coinKey:key, dest, x:e.clientX, y:e.clientY, max }), e, {});
  };
  const addItem = () => { const it = makeItem({ cat:'Butin', name:'Nouvel objet' }); setItem(it.id, it); setSelectedId(it.id); setEditing(it); };
  const staff = isStaff(role);

  return (
    <div className="col" style={{ height:'100%', minHeight:0, padding:16 }}>
      <h2 style={{ marginBottom:4 }}>Inventaire commun</h2>
      <p className="dim" style={{ fontSize:13, marginBottom:12 }}>Coffre partagé de l'équipe. Cliquez un objet pour afficher son détail et agir dessus.</p>
      <div style={{ flex:'1 1 auto', minHeight:0, display:'flex', gap:16 }}>
        <div style={{ flex:'0 0 440px', maxWidth:'48%', minHeight:0 }}>
          {items === null
            ? <div className="dim">Chargement…</div>
            : <InventoryGrid items={items} coins={sharedCoins} filter={filter} setFilter={setFilter}
                onItemClick={(item) => setSelectedId(item.id)} onCoinClick={openCoinMenu} onAdd={staff ? addItem : undefined}
                title="INVENTAIRE COMMUN" capacity={240} />}
        </div>
        <div style={{ flex:'1 1 auto', minHeight:0 }}>
          <ItemDetail item={sel} canEdit={staff} onTake={takeSelected}
            onEdit={() => setEditing(sel)}
            onRemove={() => { removeItem(sel.id); setSelectedId(null); }} />
        </div>
      </div>

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
    </div>
  );
}

Object.assign(window, { CommonInventoryPage });
