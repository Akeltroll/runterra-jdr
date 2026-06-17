/* ============================================================
   PAGE — INVENTAIRE COMMUN (coffre partagé, accès total)
   ============================================================ */
function CommonInventoryPage() {
  const { items, setItem, removeItem } = useSharedInventory();
  const { coins: sharedCoins } = useSharedCoins();
  const { role, charId } = useAuthIdentity();
  const all = useAllCharStates();
  const [filter, setFilter] = useState('all');
  const [menu, setMenu] = useState(null);
  const [stepper, setStepper] = useState(null);   // { kind, item|coinKey, dest, x, y, max }
  const [editing, setEditing] = useState(null);
  const [destPick, setDestPick] = useState(null);  // { item|coinKey, kind, x, y } pour le MJ

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

  const openItemMenu = (item, e) => {
    e.stopPropagation();
    const actions = [
      { label:'Prendre', onClick:() => resolveDest((dest) => {
          if ((item.qty || 1) > 1) setStepper({ kind:'item', item, dest, x:e.clientX, y:e.clientY, max:item.qty });
          else takeItem(item, 1, dest);
        }, e, {}) },
      { label:'Éditer', onClick:() => setEditing(item) },
      { label:'Supprimer', danger:true, onClick:() => removeItem(item.id) },
    ];
    setMenu({ item, x:e.clientX, y:e.clientY, actions });
  };
  const openCoinMenu = (key, e) => {
    const max = (sharedCoins && sharedCoins[key]) || 0;
    if (max <= 0) return;
    resolveDest((dest) => setStepper({ kind:'coin', coinKey:key, dest, x:e.clientX, y:e.clientY, max }), e, {});
  };
  const addItem = () => { const it = makeItem({ cat:'Butin', name:'Nouvel objet' }); setItem(it.id, it); setEditing(it); };

  return (
    <div className="col" style={{ height:'100%', minHeight:0, padding:16 }}>
      <h2 style={{ marginBottom:4 }}>Inventaire commun</h2>
      <p className="dim" style={{ fontSize:13, marginBottom:12 }}>Coffre partagé de l'équipe. Cliquez un objet pour le prendre, l'éditer ou le supprimer.</p>
      <div style={{ flex:'1 1 auto', minHeight:0, maxWidth:760 }}>
        {items === null
          ? <div className="dim">Chargement…</div>
          : <InventoryGrid items={items} coins={sharedCoins} filter={filter} setFilter={setFilter}
              onItemClick={openItemMenu} onCoinClick={openCoinMenu} onAdd={addItem} title="INVENTAIRE COMMUN" capacity={240} />}
      </div>

      {menu && <ItemActionMenu item={menu.item} x={menu.x} y={menu.y} actions={menu.actions} onClose={() => setMenu(null)} />}
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
              onRemove={(id) => { removeItem(id); setEditing(null); }} />
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { CommonInventoryPage });
