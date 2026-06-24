/* ============================================================
   PAGE ADMIN — attribution rôle + perso aux comptes
   Lecture/écriture de /users réservées à l'admin (règles RTDB).
   Les mots de passe se gèrent dans la console Firebase, pas ici.
   ============================================================ */
function AdminUserRow({ uid, rec }) {
  const toast = useToast();
  const [role, setRole] = useState(rec.role || 'joueur');
  const [charId, setCharId] = useState(rec.charId || '');
  const dirty = role !== (rec.role || 'joueur') || charId !== (rec.charId || '');
  const save = async () => {
    try {
      await setUserAssignment(uid, role, charId);
      toast(`Compte « ${rec.username} » mis à jour`, 'buff');
    } catch (e) {
      toast('Échec de la mise à jour (droits admin ?)', 'debuff');
    }
  };
  const selStyle = { background:'var(--bg-inset)', color:'var(--ink)', border:'1px solid var(--line-strong)', borderRadius:6, padding:'6px 9px', fontSize:13 };
  return (
    <div className="row gap-3 wrap" style={{ alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--line)' }}>
      <span className="mono" style={{ minWidth:140, color:'var(--gold-pale)' }}>{rec.username || '(sans nom)'}</span>
      <select value={role} onChange={(e) => setRole(e.target.value)} style={selStyle}>
        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <select value={charId} onChange={(e) => setCharId(e.target.value)} style={selStyle}>
        <option value="">— aucun perso —</option>
        {CHARACTERS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <button className="btn btn-sm btn-gold" onClick={save} disabled={!dirty}>Enregistrer</button>
    </div>
  );
}

/* Gestion du catalogue d'objets partagé (campaign/runeterra/catalog) : liste CRUD
   complète (ajouter / éditer / supprimer) réutilisant InventoryPanel. Réservé au
   staff par les règles RTDB ; ici rendu dans la page Admin. */
function CatalogAdminPanel() {
  const { catalog, seeded, setCatalogItem, removeCatalogItem } = useItemCatalog(true);
  const itemsMap = {};
  (catalog || []).forEach((it) => { if (it && it.id) itemsMap[it.id] = it; });
  return (
    <div style={{ padding:'0 24px 24px' }}>
      <h2 style={{ marginBottom:4 }}>Catalogue d'objets</h2>
      <p className="dim" style={{ fontSize:13, marginBottom:16 }}>
        Liste de base partagée servant à l'ajout rapide d'objets (fiches, équipement,
        coffre commun). Ajoute, édite ou supprime ici les objets enregistrés en base.
      </p>
      <div className="panel" style={{ padding:'14px 16px' }}>
        {!seeded
          ? <div className="dim" style={{ padding:'12px 0' }}>Amorçage du catalogue…</div>
          : <InventoryPanel items={itemsMap} editable={true}
              onSave={(it) => setCatalogItem(it.id, it)}
              onRemove={(id) => removeCatalogItem(id)} />}
      </div>
    </div>
  );
}

/* Gestion de l'inventaire PAR PERSONNAGE (campaign/runeterra/characters/{id}/state/inventory) :
   le staff choisit un perso et ajoute / édite / supprime ses objets directement en base.
   Réutilise InventoryPanel + le picker catalogue (même flux que la fiche). */
function CharInventoryAdminPanel() {
  const [charId, setCharId] = useState(CHARACTERS[0] ? CHARACTERS[0].id : '');
  const { state, setInvItem, removeInvItem } = useCharState(charId);
  const [catCat, setCatCat] = useState(null);   // catégorie pré-filtrée ; null = picker fermé
  const inventory = state.inventory;
  const equipment = state.equipment || {};
  const char = CHARACTERS.find((c) => c.id === charId) || {};
  const force = (state.attrs && state.attrs.force) != null ? state.attrs.force : (char.attrs && char.attrs.force) || 0;
  const invWeight = carriedWeight(inventory || {});
  const invCap = carryCapacity(force, equipment, inventory || {});
  const invOver = weightStatus(invWeight, invCap).over;
  const selStyle = { background:'var(--bg-inset)', color:'var(--ink)', border:'1px solid var(--line-strong)', borderRadius:6, padding:'6px 9px', fontSize:13 };
  return (
    <div style={{ padding:'0 24px 24px' }}>
      <h2 style={{ marginBottom:4 }}>Inventaire des personnages</h2>
      <p className="dim" style={{ fontSize:13, marginBottom:16 }}>
        Gère directement en base l'inventaire d'un personnage : ajoute (depuis le catalogue
        ou objet personnalisé), édite ou supprime ses objets. Modifications en temps réel.
      </p>
      <div className="panel" style={{ padding:'14px 16px' }}>
        <div className="row gap-3" style={{ alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <select value={charId} onChange={(e) => setCharId(e.target.value)} style={selStyle}>
            {CHARACTERS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span className="row gap-2" style={{ alignItems:'center' }}>
            <span className="mono" style={{ fontSize:11, color: invOver ? 'var(--hp)' : 'var(--faint)' }} title="Poids porté / capacité">⚖ {invWeight}/{invCap}</span>
            <span className="mono faint" style={{ fontSize:11 }}>{inventory ? Object.keys(inventory).length : 0} objets</span>
          </span>
        </div>
        <InventoryPanel items={inventory} editable={true} onSave={(it) => setInvItem(it.id, it)}
          onRemove={removeInvItem} onAdd={(cat) => setCatCat(cat)} />
      </div>
      {catCat && (
        <ItemCatalogPicker initialFilter={catCat} staff={true}
          onPick={(entry, n) => {
            const { patch } = planItemAdd(inventory, entry, n);
            Object.entries(patch).forEach(([id, it]) => setInvItem(id, it));
            setCatCat(null);
          }}
          onCustom={() => { const it = makeItem({ cat: catCat, name:'Nouvel objet' }); setInvItem(it.id, it); setCatCat(null); }}
          onClose={() => setCatCat(null)} />
      )}
    </div>
  );
}

function AdminPage() {
  const users = useAllUsers();
  return (
    <div className="col" style={{ height:'100%', minHeight:0, overflow:'auto' }}>
      <div style={{ padding:'18px 24px' }}>
        <h2 style={{ marginBottom:4 }}>Administration des comptes</h2>
        <p className="dim" style={{ fontSize:13, marginBottom:16 }}>
          Attribue à chaque compte son rôle et son personnage. Les comptes apparaissent
          ici après leur première connexion. Création/réinitialisation des mots de passe :
          console Firebase.
        </p>
        <div className="panel" style={{ padding:'8px 16px' }}>
          {users == null && <div className="dim" style={{ padding:'12px 0' }}>Chargement…</div>}
          {users != null && Object.keys(users).length === 0 && (
            <div className="dim" style={{ padding:'12px 0' }}>Aucun compte pour l'instant.</div>
          )}
          {users != null && Object.keys(users).map((uid) => (
            <AdminUserRow key={uid} uid={uid} rec={users[uid]} />
          ))}
        </div>
      </div>
      <CharInventoryAdminPanel />
      <CatalogAdminPanel />
    </div>
  );
}

Object.assign(window, { AdminPage, AdminUserRow, CatalogAdminPanel, CharInventoryAdminPanel });
