/* ============================================================
   PAGE — JOURNAL DE COMBAT (temps réel)
   Flux des événements partagés (combat/log) : casts, dégâts, KO,
   buffs… Lecture live via useCombatLog, alimenté par pushLog.
   Visible staff (MJ/admin) ; « Vider » purge le journal partagé.
   ============================================================ */
function JournalPage() {
  const { entries, clearLog } = useCombatLog();
  const [filtre, setFiltre] = useState('tous');

  const COL = { gold: 'var(--gold-pale)', buff: 'var(--buff-bright)', debuff: 'var(--debuff-bright)' };
  const FILTRES = [
    { id: 'tous', label: 'Tous' },
    { id: 'gold', label: 'Actions / dégâts' },
    { id: 'buff', label: 'Buffs / soins' },
    { id: 'debuff', label: 'KO / pertes' },
  ];
  const rows = filtre === 'tous' ? entries : entries.filter(e => (e.kind || 'gold') === filtre);
  const fmtT = (ts) => { try { return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch (e) { return ''; } };

  return (
    <div style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ fontSize: 24 }}>Journal de combat</h2>
          <span className="faint" style={{ fontSize: 12 }}>Flux temps réel des événements de la session</span>
        </div>
        {entries.length > 0 && <button className="btn btn-sm btn-ghost" onClick={clearLog}>Vider le journal</button>}
      </div>

      {/* filtres */}
      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="row gap-4 wrap" style={{ padding: '14px 18px', alignItems: 'center' }}>
          <span className="overline">Filtres</span>
          <div className="row gap-2 wrap">
            {FILTRES.map(f => (
              <button key={f.id} onClick={() => setFiltre(f.id)}
                className={'btn btn-sm' + (filtre === f.id ? ' btn-gold' : ' btn-ghost')}>{f.label}</button>
            ))}
          </div>
          <span className="grow"></span>
          <span className="faint mono" style={{ fontSize: 11 }}>{rows.length} entrée{rows.length > 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* flux */}
      <div className="panel" style={{ padding: rows.length ? '8px 0' : '18px' }}>
        {rows.length === 0
          ? <div style={{ fontSize: 13, color: 'var(--ink-faint)' }}>Aucun événement pour le moment.</div>
          : rows.map(e => (
              <div key={e.id} className="row gap-3" style={{ padding: '9px 18px', borderBottom: '1px solid var(--line)', alignItems: 'baseline' }}>
                <span className="mono" style={{ fontSize: 11.5, color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>{fmtT(e.ts)}</span>
                <span style={{ fontSize: 13.5, lineHeight: 1.5, color: COL[e.kind] || 'var(--ink)' }}>{renderToastMsg(e.text)}</span>
              </div>
            ))}
      </div>
    </div>
  );
}
window.JournalPage = JournalPage;
