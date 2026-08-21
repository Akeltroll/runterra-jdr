/* ============================================================
   PAGE — JOURNAL (temps réel), deux sections indépendantes
   • Combat  : flux partagé combat/log (casts, dégâts, KO, buffs…),
               purgé par « ⟲ Combat ».
   • Monnaie : flux economyLog (transferts, récompenses, ajustements MJ),
               RÉSERVÉ AU MJ (lecture staff par les règles RTDB) et JAMAIS
               purgé par « ⟲ Combat » — plafonné à LOG_MAX entrées.
   Page staff (MJ/admin) ; chaque section a son propre « Vider ».
   ============================================================ */
const JOURNAL_SECTIONS = [
  { id: 'combat',  label: '⚔ Combat',  title: 'Journal de combat',
    sub: 'Flux temps réel des événements de la session',
    filtres: [
      { id: 'tous',   label: 'Tous' },
      { id: 'gold',   label: 'Actions / dégâts' },
      { id: 'buff',   label: 'Buffs / soins' },
      { id: 'debuff', label: 'KO / pertes' },
    ] },
  { id: 'monnaie', label: '💰 Monnaie', title: 'Journal des mouvements de pièces',
    sub: `Transferts, récompenses et ajustements — ${LOG_MAX} derniers, conservés d'un combat à l'autre`,
    filtres: [
      { id: 'tous',   label: 'Tous' },
      { id: 'gold',   label: 'Transferts' },
      { id: 'buff',   label: 'Gains' },
      { id: 'debuff', label: 'Retraits' },
    ] },
];

function JournalPage() {
  const combat = useCombatLog();
  const eco = useEconomyLog();
  const [section, setSection] = useState('combat');
  const [filtre, setFiltre] = useState('tous');

  const sec = JOURNAL_SECTIONS.find(s => s.id === section) || JOURNAL_SECTIONS[0];
  const src = section === 'monnaie' ? eco : combat;
  const COL = { gold: 'var(--gold-pale)', buff: 'var(--buff-bright)', debuff: 'var(--debuff-bright)' };
  const rows = filtre === 'tous' ? src.entries : src.entries.filter(e => (e.kind || 'gold') === filtre);
  const fmtT = (ts) => { try { return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch (e) { return ''; } };
  const pick = (id) => { setSection(id); setFiltre('tous'); };   // les filtres diffèrent d'une section à l'autre
  const clear = () => {
    if (section === 'monnaie' && !window.confirm(
      "Vider l'historique des mouvements de pièces ? Ce journal n'est jamais purgé automatiquement : c'est la seule trace des transferts depuis le coffre commun.")) return;
    src.clearLog();
  };

  return (
    <div style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ fontSize: 24 }}>{sec.title}</h2>
          <span className="faint" style={{ fontSize: 12 }}>{sec.sub}</span>
        </div>
        <div className="row gap-2" style={{ alignItems: 'center' }}>
          {JOURNAL_SECTIONS.map(s => (
            <button key={s.id} onClick={() => pick(s.id)}
              className={'btn btn-sm' + (section === s.id ? ' btn-gold' : ' btn-ghost')}>{s.label}</button>
          ))}
          {src.entries.length > 0 && <button className="btn btn-sm btn-ghost" onClick={clear}>Vider</button>}
        </div>
      </div>

      {/* filtres */}
      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="row gap-4 wrap" style={{ padding: '14px 18px', alignItems: 'center' }}>
          <span className="overline">Filtres</span>
          <div className="row gap-2 wrap">
            {sec.filtres.map(f => (
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
          ? <div style={{ fontSize: 13, color: 'var(--ink-faint)' }}>
              {section === 'monnaie' ? 'Aucun mouvement de pièces enregistré.' : 'Aucun événement pour le moment.'}
            </div>
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
