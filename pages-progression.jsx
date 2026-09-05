/* ============================================================
   PAGE — PROGRESSION / NIVEAU
   Table niveaux 1→18 + répartition des caractéristiques (respec) + sous-stats.
   Joueur : respec UNIQUE (puis verrouillé) sur son perso. Staff : édition libre
   de n'importe quel perso + (dé)verrouillage. lockedCharId fourni => vue joueur.
   ============================================================ */
/* Répartition de l'Habileté : chaque point donne +5 AD, +5 AP OU +10 Mana.
   L'escalade étant garantie à chaque point (facteur du total distribué au prorata),
   répartir ne coûte rien — le tableau affiche le gain réel de chaque destination pour
   que le joueur arbitre sur le fond, pas sur une pénalité cachée. */
/* Brouillon de répartition : à la différence de `habSplit` (game-logic), il NE
   réaffecte PAS le reliquat sur la destination par défaut — sinon un point retiré d'une
   ligne y reviendrait aussitôt et le « + » des autres lignes resterait inerte. Ici un
   point retiré retourne dans la réserve « à placer », et le bouton Confirmer attend que
   la réserve soit vide (même contrat que les points de caractéristiques). */
function clampSplitDraft(d, H) {
  const out = { ad: Math.max(0, d.ad | 0), ap: Math.max(0, d.ap | 0), mana: Math.max(0, d.mana | 0) };
  let over = (out.ad + out.ap + out.mana) - Math.max(0, H | 0);
  for (const k of ['mana', 'ap', 'ad']) {
    if (over <= 0) break;
    const cut = Math.min(out[k], over);
    out[k] -= cut; over -= cut;
  }
  return out;
}

const HAB_DEST_META = [
  { k:'ad',   label:'AD',   rate:5,  col:'var(--stat-phys)' },
  { k:'ap',   label:'AP',   rate:5,  col:'var(--stat-mag)'  },
  { k:'mana', label:'Mana', rate:10, col:'var(--mana)'      },
];
function HabSplitRow({ val, total, split, left, floors, canEdit, onChange, confirmed, open, onReopen }) {
  // Escalade moyenne d'un point à ce niveau d'Habileté (cf. habSplit dans game-logic).
  // ⚠️ Le facteur GLOBAL doit être inclus, sinon l'aperçu sous-estime le gain réel :
  // `computeStats` multiplie hUnit par globalEscalation(total des 4 caracs).
  const unit = val > 0 ? escalationFactor(val) * globalEscalation(total) / val : 0;
  const move = (k, d) => onChange(Object.assign({}, split, { [k]: split[k] + d }));
  return (
    <div className="col gap-2" style={{ marginTop:10, padding:'10px 12px', borderRadius:8,
      background:'var(--bg-inset)', border:'1px dashed var(--line-strong)' }}>
      <div className="row" style={{ justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
        <span className="overline" style={{ fontSize:9.5 }}>Répartition de l'Habileté</span>
        <span className="row gap-2" style={{ alignItems:'center' }}>
          {onReopen && val > 0 && (
            <button className="btn btn-sm btn-ghost" onClick={onReopen}
              title={open ? 'Refermer : le joueur ne pourra plus déplacer ses points déjà placés'
                          : 'Rendre au joueur une redistribution libre de ses points déjà placés'}
              style={{ padding:'2px 8px', fontSize:10.5, color: open ? 'var(--buff)' : undefined }}>
              {open ? '🔓 Rouverte' : '↺ Rouvrir au joueur'}
            </button>
          )}
          <span className="mono" style={{ fontSize:11, fontWeight:700,
            color: left === 0 ? 'var(--ink-dim)' : 'var(--gold-bright)' }}>
            {left > 0 ? left + ' pt' + (left > 1 ? 's' : '') + ' à placer' : 'tout placé'}
          </span>
        </span>
      </div>
      {val === 0 ? (
        <span className="faint" style={{ fontSize:11 }}>Aucun point d'Habileté à répartir.</span>
      ) : (
        <div className="col gap-1">
          {HAB_DEST_META.map(d => {
            const n = split[d.k];
            const floor = floors ? (floors[d.k] | 0) : 0;
            return (
              <div key={d.k} className="row" style={{ justifyContent:'space-between', alignItems:'center', gap:8 }}>
                <span className="mono" style={{ fontSize:11.5, color:d.col, fontWeight:700, minWidth:44 }}>{d.label}</span>
                <span className="mono faint" style={{ fontSize:10.5, flex:1 }}>+{d.rate} / pt</span>
                <span className="mono" style={{ fontSize:11.5, color:'var(--buff)', minWidth:52, textAlign:'right' }}>
                  {n > 0 ? '+' + Math.round(d.rate * unit * n) : '—'}
                </span>
                {canEdit ? (
                  <span className="row gap-1" style={{ alignItems:'center' }}>
                    <button className="btn btn-sm btn-ghost" onClick={() => move(d.k, -1)}
                      disabled={n <= floor} style={{ padding:'1px 8px' }}>−</button>
                    <span className="mono" style={{ fontSize:13, fontWeight:700, color:'var(--gold-pale)', minWidth:20, textAlign:'center' }}>{n}</span>
                    <button className="btn btn-sm btn-ghost" onClick={() => move(d.k, +1)}
                      disabled={left <= 0} style={{ padding:'1px 8px' }}>+</button>
                  </span>
                ) : (
                  <span className="mono" style={{ fontSize:13, fontWeight:700, color:'var(--gold-pale)', minWidth:20, textAlign:'center' }}>{n}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {val > 0 && (
        <span className="faint" style={{ fontSize:11, lineHeight:1.45 }}>
          {!confirmed
            ? "Répartition pas encore confirmée \u2014 le défaut suit ta carac de dégâts dominante. Tant que tu n'as pas confirmé, tu peux tout redistribuer librement."
            : open
              ? "\uD83D\uDD13 Le MJ a rouvert ta répartition : tu peux déplacer tous tes points jusqu'à ta prochaine confirmation."
              : "Un point rapporte autant où qu'il aille : répartis selon ton style, sans pénalité."}
        </span>
      )}
    </div>
  );
}

function ProgressionPage({ lockedCharId }) {
  const toast = useToast();
  const staff = !lockedCharId;
  const [charId, setCharId] = useState(lockedCharId || 'rathael');
  const char = CHARACTERS.find(c => c.id === charId);
  const { state, setAttrs, setAttrsLocked, setHabSplitOpen } = useCharState(charId);

  const effLevel = (state && state.level != null ? state.level : char.level) || 1;
  const lvlRow = LEVELS.find(l => l.lvl === effLevel) || LEVELS[LEVELS.length - 1];
  const budget = lvlRow.total + CREATION_BONUS;       // points répartissables (niveau + bonus de création)
  const cap = lvlRow.limit;                            // plafond par caractéristique
  const savedAttrs = (state && state.attrs) || char.attrs;
  const locked = !!(state && state.attrsLocked);
  const canEdit = staff || !locked;

  // Répartition AD/AP de l'Habileté (5 AD OU 5 AP par point). `state.habAd` n'existe
  // que si le joueur l'a CONFIRMÉE : tant qu'elle est absente, `habSplit` applique son
  // défaut par carac dominante et aucun plancher n'est opposé au joueur (on ne peut pas
  // lui interdire de défaire un choix qu'il n'a jamais fait).
  // Compat : `state.habAd` (forme AD-seul d'un jour) est encore relue.
  const rawSplit = (state && state.habSplit)
    || (state && state.habAd != null ? { ad: state.habAd } : null);
  const hasSplit = !!rawSplit;
  // Drapeau MJ : suspend le plancher du joueur pour lui rendre une redistribution
  // libre, sans effacer sa répartition actuelle. Refermé à sa prochaine confirmation.
  const splitOpen = !!(state && state.habSplitOpen);
  const savedSplit = habSplit(savedAttrs.force, savedAttrs.hab, savedAttrs.magie, rawSplit);

  // Brouillon local : on édite sans écrire, puis « Confirmer ». Resync sur changement
  // de perso ou de valeurs sauvegardées (après confirmation ou édition externe).
  const [draft, setDraft] = useState(savedAttrs);
  useEffect(() => { setDraft(savedAttrs); },
    [charId, savedAttrs.force, savedAttrs.hab, savedAttrs.mental, savedAttrs.magie]);
  const [draftSplit, setDraftSplit] = useState(savedSplit);
  useEffect(() => { setDraftSplit(savedSplit); },
    [charId, savedSplit.ad, savedSplit.ap, savedSplit.mana]);

  const view = canEdit ? draft : savedAttrs;          // valeurs affichées (brouillon si éditable)
  // Plancher par caracs : un joueur ne peut JAMAIS descendre sous ses valeurs déjà confirmées
  // (montée au level-up uniquement). Le staff garde la main totale (plancher 0).
  const floorAttrs = staff ? {} : savedAttrs;
  const sum = attrSum(view);
  const remaining = budget - sum;
  const attrsValid = respecValid(view, budget, cap, floorAttrs);
  // Planchers de la répartition. Même philosophie que le plancher des caracs : un joueur
  // ne peut pas RE-router des points déjà confirmés, il ne place que les nouveaux ; le
  // staff garde la main totale. Sans répartition confirmée, aucun plancher — sinon un
  // défaut deviné deviendrait un choix imposé.
  const splitFloors = (staff || !hasSplit || splitOpen) ? null : savedSplit;
  // Bornée sur l'Habileté du BROUILLON : baisser l'Habileté rogne la répartition,
  // la monter laisse les nouveaux points « à placer ».
  const split = clampSplitDraft(draftSplit, view.hab);
  const splitLeft = view.hab - (split.ad + split.ap + split.mana);
  // Confirmer exige que la réserve d'Habileté soit vide, exactement comme les points
  // de caractéristiques : un point non placé ne rapporterait rien.
  const valid = attrsValid && splitLeft === 0;
  const dirty = view.force !== savedAttrs.force || view.hab !== savedAttrs.hab
    || view.mental !== savedAttrs.mental || view.magie !== savedAttrs.magie
    || split.ad !== savedSplit.ad || split.ap !== savedSplit.ap || split.mana !== savedSplit.mana
    || !hasSplit;
  const preview = computeStats(view.force, view.hab, view.mental, view.magie, effLevel, split);

  const selStyle = { background:'var(--bg-inset)', color:'var(--ink)', border:'1px solid var(--line-strong)', borderRadius:6, padding:'6px 9px', fontSize:13 };

  const bump = (key, delta) => {
    if (!canEdit) return;
    setDraft(d => {
      const next = Math.max(floorAttrs[key] | 0, Math.min(cap, (d[key] | 0) + delta));
      if (delta > 0 && (budget - attrSum(d)) <= 0) return d; // plus de points dispo
      return Object.assign({}, d, { [key]: next });
    });
  };

  // Rouvre la répartition d'Habileté du joueur (staff). Utile quand un joueur s'est
  // trompé, ou quand une refonte de règles rend son placement caduc.
  const reopenSplit = () => {
    setHabSplitOpen(!splitOpen);
    toast(splitOpen
      ? `<b>${char.name}</b> — répartition d'Habileté refermée`
      : `<b>${char.name}</b> — répartition d'Habileté rouverte au joueur`, splitOpen ? 'gold' : 'buff');
  };

  const confirm = () => {
    if (!valid) return;
    if (!staff && !window.confirm('Confirmer cette répartition ? Les points placés deviennent définitifs : tu pourras en rajouter aux prochains niveaux, mais plus en retirer.')) return;
    setAttrs(draft, staff ? locked : false, split);    // joueur => pas de verrou dur (le plancher protège) ; staff => garde l'état du verrou
    toast(`<b>${char.name}</b> — caractéristiques enregistrées`, 'buff');
  };

  return (
    <div style={{ padding:'24px', height:'100%', overflow:'auto' }}>
      <div className="row" style={{ justifyContent:'space-between', marginBottom:18, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontSize:24 }}>Progression</h2>
          <span className="faint" style={{ fontSize:12 }}>Caractéristiques, points et seuils par niveau</span>
        </div>
        {staff && (
          <div className="row gap-2" style={{ alignItems:'center' }}>
            <label className="row gap-1" style={{ alignItems:'center', fontSize:12.5 }}>
              <input type="checkbox" checked={locked} onChange={e => setAttrsLocked(e.target.checked)} /> Verrouillé
            </label>
            <span className="overline">Perso</span>
            <select value={charId} onChange={e => setCharId(e.target.value)} style={selStyle}>
              {CHARACTERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="panel" style={{ padding:'10px 16px', marginBottom:18 }}>
        <XpBar level={effLevel} xp={(state && state.xp) || 0} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:20, alignItems:'start' }} className="prog-grid">
        {/* caractéristiques (respec) */}
        <div className="col gap-5">
          <div className="panel">
            <div className="panel-head"><h3>Caractéristiques</h3>
              <span className="mono faint" style={{ fontSize:11 }}>
                {sum} / {budget} pts
                <span style={{ color: remaining === 0 ? 'var(--buff)' : (remaining < 0 ? 'var(--debuff-bright)' : 'var(--gold-bright)'), fontWeight:700 }}> · {remaining} restant{Math.abs(remaining) > 1 ? 's' : ''}</span>
                {` · limite ${cap}`}
              </span>
            </div>

            {!canEdit && (
              <div className="faint" style={{ fontSize:12.5, padding:'10px 18px 0', lineHeight:1.5 }}>
                🔒 Verrouillé par le MJ — demande-lui pour modifier.
              </div>
            )}
            {canEdit && !staff && attrSum(savedAttrs) > 0 && (
              <div className="faint" style={{ fontSize:12, padding:'10px 18px 0', lineHeight:1.5 }}>
                Tu peux ajouter des points, mais pas descendre sous tes valeurs déjà confirmées.
              </div>
            )}

            <div className="col gap-4" style={{ padding:'18px' }}>
              {ATTRIBUTES.map(attr => {
                const val = view[attr.key] | 0;
                const pct = Math.min(100, (val / cap) * 100);
                const canInc = canEdit && val < cap && remaining > 0;
                const canDec = canEdit && val > (floorAttrs[attr.key] | 0);
                return (
                  <div key={attr.key}>
                    <div className="row" style={{ justifyContent:'space-between', marginBottom:6, alignItems:'center' }}>
                      <span className="row gap-2" style={{ alignItems:'center' }}>
                        <span style={{ width:10, height:10, borderRadius:2, background: attr.color }}></span>
                        <span style={{ fontFamily:'var(--font-display)', fontSize:15, color:'var(--gold-pale)' }}>{attr.name}</span>
                      </span>
                      {canEdit ? (
                        <span className="row gap-2" style={{ alignItems:'center' }}>
                          <button className="btn btn-sm btn-ghost" onClick={() => bump(attr.key, -1)} disabled={!canDec} style={{ padding:'2px 9px' }}>−</button>
                          <span className="mono" style={{ fontSize:16, fontWeight:700, color:'var(--gold-pale)', minWidth:26, textAlign:'center' }}>{val}</span>
                          <button className="btn btn-sm btn-ghost" onClick={() => bump(attr.key, +1)} disabled={!canInc} style={{ padding:'2px 9px' }}>+</button>
                        </span>
                      ) : (
                        <span className="mono" style={{ fontSize:16, fontWeight:700, color:'var(--gold-pale)' }}>{val}</span>
                      )}
                    </div>
                    <div style={{ height:10, borderRadius:99, background:'var(--bg-inset)', overflow:'hidden', border:'1px solid var(--line)' }}>
                      <div style={{ height:'100%', width:pct+'%', background: attr.color, borderRadius:99 }}></div>
                    </div>
                    <div className="row gap-2 wrap" style={{ marginTop:8 }}>
                      {attr.sub.map((s, i) => (
                        <span key={i} className="mono" style={{ fontSize:10, color:'var(--ink-dim)', padding:'3px 8px', background:'var(--bg-inset)', borderRadius:99, border:'1px solid var(--line)' }}>{s}</span>
                      ))}
                    </div>
                    {attr.key === 'hab' && (
                      <HabSplitRow val={val} total={sum} split={split} left={splitLeft} floors={splitFloors}
                        canEdit={canEdit} onChange={setDraftSplit} confirmed={hasSplit}
                        open={splitOpen} onReopen={staff ? reopenSplit : null} />
                    )}
                  </div>
                );
              })}
            </div>

            {canEdit && (
              <div className="row" style={{ justifyContent:'flex-end', gap:10, padding:'0 18px 16px', alignItems:'center' }}>
                <button className="btn btn-sm btn-ghost" onClick={() => { setDraft(savedAttrs); setDraftSplit(savedSplit); }} disabled={!dirty}>Réinitialiser</button>
                <button className="btn btn-gold" onClick={confirm} disabled={!valid || !dirty}
                  title={!valid ? (attrsValid ? `Place tes ${splitLeft} point(s) d'Habileté`
                    : `Répartis exactement ${budget} points`) : ''}>Confirmer</button>
              </div>
            )}
          </div>

          {/* stats résultantes (aperçu live du brouillon) */}
          <div className="panel">
            <div className="panel-head"><h3>Stats résultantes</h3><span className="overline">{canEdit && dirty ? 'aperçu' : 'calculées'}</span></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, padding:'16px' }}>
              {[['hp',preview.hp],['mana',preview.mana],['ad',preview.ad],['ap',preview.ap],['armure',preview.armure],['resmag',preview.resmag],['crit',preview.crit+'%'],['dcrit',preview.dcrit+'%'],['rescrit',preview.rescrit+'%']].map(([k,v]) => (
                <div key={k} className="col" style={{ alignItems:'center', padding:'12px 6px', background:'var(--bg-inset)', borderRadius:8, border:'1px solid var(--line)' }}>
                  <span className="mono" style={{ fontSize:19, fontWeight:700, color:(k==='ap'||k==='resmag')?'var(--silver)':'var(--gold-pale)' }}>{v}</span>
                  <span className="overline" style={{ fontSize:9, marginTop:3 }}>{STAT_GLYPH[k]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* table de niveaux */}
        <div className="panel" style={{ overflow:'hidden' }}>
          <div className="panel-head"><h3>Paliers 1 → 18</h3></div>
          <div style={{ maxHeight:560, overflow:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'var(--bg-inset)', position:'sticky', top:0 }}>
                  {['Niv.','Gain','Total','Limite'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'.1em', textTransform:'uppercase', color:'var(--ink-faint)', borderBottom:'1px solid var(--line)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LEVELS.map(l => {
                  const here = l.lvl === effLevel;
                  return (
                    <tr key={l.lvl} style={{ borderBottom:'1px solid var(--line)', background: here ? 'rgba(200,155,60,.08)' : 'transparent' }}>
                      <td style={{ padding:'9px 14px', fontFamily:'var(--font-mono)', fontSize:13, fontWeight: here?700:400, color: here?'var(--gold-bright)':'var(--ink)' }}>{l.lvl}{here && ' ◄'}</td>
                      <td style={{ padding:'9px 14px', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--buff-bright)' }}>{l.gain}</td>
                      <td style={{ padding:'9px 14px', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--ink-dim)' }}>{l.total}</td>
                      <td style={{ padding:'9px 14px', fontFamily:'var(--font-mono)', fontSize:12, color:'var(--gold-pale)' }}>{l.limit}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
window.ProgressionPage = ProgressionPage;
