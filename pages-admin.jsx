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
    </div>
  );
}

Object.assign(window, { AdminPage, AdminUserRow });
