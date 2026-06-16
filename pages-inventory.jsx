/* ============================================================
   PAGE — INVENTAIRE COMMUN (coffre partagé, accès total)
   ============================================================ */
function CommonInventoryPage() {
  const { items, setItem, removeItem } = useSharedInventory();
  return (
    <div className="col" style={{ height:'100%', minHeight:0, overflow:'auto' }}>
      <div style={{ padding:'18px 24px', maxWidth:760 }}>
        <h2 style={{ marginBottom:4 }}>Inventaire commun</h2>
        <p className="dim" style={{ fontSize:13, marginBottom:16 }}>
          Coffre partagé de l'équipe. Tout le monde peut consulter, déposer et prendre des objets.
        </p>
        <div className="panel" style={{ padding:'14px 16px' }}>
          {items === null
            ? <div className="dim" style={{ padding:'8px 0' }}>Chargement…</div>
            : <InventoryPanel items={items} editable={true} onSave={(it) => setItem(it.id, it)} onRemove={removeItem} />}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CommonInventoryPage });
