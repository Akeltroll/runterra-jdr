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
/* `keys` = destinations à rogner en priorité (ordre inverse de la priorité de service). */
function clampSplitDraft(d, budget, keys) {
  keys = keys || ['mana', 'ap', 'ad'];
  const out = {};
  for (const k of keys) out[k] = Math.max(0, d[k] | 0);
  let over = keys.reduce((s, k) => s + out[k], 0) - Math.max(0, budget | 0);
  for (const k of keys) {
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
/* Mental : 45 PV + 15 Mana garantis par point, puis 15 points dirigés (PV **ou** Mana).
   Seule la part DIRIGÉE se répartit — le socle est acquis quoi qu'il arrive. */
const MENTAL_DEST_META = [
  { k:'hp',   label:'PV',   rate:15, col:'var(--hp)'   },
  { k:'mana', label:'Mana', rate:15, col:'var(--mana)' },
];
/* Force et Magie (2026-09-06) : socle garanti 15 AD + 1 Armure (resp. 15 AP + 1 Rés.Mag),
   puis chaque point dirige +10 AD **ou** +2 Armure (resp. +10 AP ou +2 Rés.Mag).
   ⚠️ Les deux destinations n'ont PAS le même taux : 1 point d'armure vaut bien plus
   qu'1 point d'AD (réduction en AR/(AR+120)). Ce n'est donc pas un arbitrage à somme
   nulle, contrairement au Mental (15/15) — c'est voulu. */
const FORCE_DEST_META = [
  { k:'ad',     label:'AD',     rate:10, col:'var(--stat-phys)' },
  { k:'armure', label:'Armure', rate:2,  col:'var(--stat-phys)' },
];
const MAGIE_DEST_META = [
  { k:'ap',     label:'AP',      rate:10, col:'var(--stat-mag)' },
  { k:'resmag', label:'Rés.Mag', rate:2,  col:'var(--stat-mag)' },
];
/* Bloc de répartition partagé (Habileté : AD/AP/Mana — Mental : PV/Mana). Les deux
   suivent le même contrat : escalade garantie à chaque point, réserve « à placer » qui
   doit être vide pour confirmer, plancher opposé seulement une fois la répartition
   confirmée, et réouverture par le MJ. */
function SplitRow({ label, meta, emptyLabel, defaultHint, val, total, split, left, floors,
                    canEdit, onChange, confirmed, open, onReopen, onFill }) {
  // Escalade moyenne d'un point à ce niveau de carac (cf. habSplit/mentalSplit).
  // ⚠️ Le facteur GLOBAL doit être inclus, sinon l'aperçu sous-estime le gain réel :
  // `computeStats` multiplie hUnit/mUnit par globalEscalation(total des 4 caracs).
  const unit = val > 0 ? escalationFactor(val) * globalEscalation(total) / val : 0;
  const move = (k, d) => onChange(Object.assign({}, split, { [k]: split[k] + d }));
  return (
    /* ⚠️ Cadre en OR dès qu'il reste des points à placer : c'est la SEULE cause de blocage
       du bouton « Confirmer » qui ne se voit pas dans le compteur d'en-tête — celui-ci
       affiche « 0 restant » en vert alors que la réserve, elle, est pleine. Sans cette
       alerte, le bouton gris est incompréhensible (cf. bug de respec du 2026-09-06). */
    <div className="col gap-2" style={{ marginTop:10, padding:'10px 12px', borderRadius:8,
      background:'var(--bg-inset)',
      border: left > 0 ? '1px solid var(--gold-bright)' : '1px dashed var(--line-strong)' }}>
      <div className="row" style={{ justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
        <span className="overline" style={{ fontSize:9.5 }}>{label}</span>
        <span className="row gap-2" style={{ alignItems:'center' }}>
          {canEdit && onFill && left > 0 && (
            <button className="btn btn-sm btn-ghost" onClick={onFill}
              title="Placer les points restants sur la destination par défaut (tu peux les déplacer ensuite)"
              style={{ padding:'2px 8px', fontSize:10.5, color:'var(--gold-bright)' }}>Tout placer</button>
          )}
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
        <span className="faint" style={{ fontSize:11 }}>{emptyLabel}</span>
      ) : (
        <div className="col gap-1">
          {meta.map(d => {
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
            ? defaultHint
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
  const { state, setAttrs, setAttrsLocked, setAttrsOpen, setHabSplitOpen, setMentalSplitOpen,
          setForceSplitOpen, setMagieSplitOpen } = useCharState(charId);

  const effLevel = (state && state.level != null ? state.level : char.level) || 1;
  const lvlRow = LEVELS.find(l => l.lvl === effLevel) || LEVELS[LEVELS.length - 1];
  const budget = lvlRow.total + CREATION_BONUS;       // points répartissables (niveau + bonus de création)
  const cap = lvlRow.limit;                            // plafond par caractéristique
  const savedAttrs = (state && state.attrs) || char.attrs;
  const locked = !!(state && state.attrsLocked);
  const canEdit = staff || !locked;
  // Drapeau MJ : suspend le plancher de respec du joueur (ses caracs déjà confirmées).
  // ⚠ Distinct de `locked`, et même inverse : `locked` gèle TOUTE la page (le joueur ne
  // peut même plus placer ses nouveaux points), `attrsOpen` ne fait que lever le plancher.
  // Décocher « Verrouillé » ne rend donc PAS la respec — c'est ce drapeau-ci qui la rend.
  const attrsOpen = !!(state && state.attrsOpen);

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

  // Répartition du Mental : 45 PV + 15 Mana garantis par point, plus 15 points dirigés
  // (PV **ou** Mana). Même contrat que l'Habileté ; défaut = tout en PV.
  const rawMent = (state && state.mentalSplit) || null;
  const hasMent = !!rawMent;
  const mentOpen = !!(state && state.mentalSplitOpen);
  const savedMent = mentalSplit(savedAttrs.mental, rawMent);

  // Répartitions Force (AD/Armure) et Magie (AP/Rés.Mag) — même contrat que les deux
  // précédentes. Défaut (absent) = tout en dégâts.
  const rawForce = (state && state.forceSplit) || null;
  const hasForce = !!rawForce;
  const forceOpen = !!(state && state.forceSplitOpen);
  const savedForce = forceSplit(savedAttrs.force, rawForce);
  const rawMagie = (state && state.magieSplit) || null;
  const hasMagie = !!rawMagie;
  const magieOpen = !!(state && state.magieSplitOpen);
  const savedMagie = magieSplit(savedAttrs.magie, rawMagie);

  // Brouillon local : on édite sans écrire, puis « Confirmer ». Resync sur changement
  // de perso ou de valeurs sauvegardées (après confirmation ou édition externe).
  const [draft, setDraft] = useState(savedAttrs);
  useEffect(() => { setDraft(savedAttrs); },
    [charId, savedAttrs.force, savedAttrs.hab, savedAttrs.mental, savedAttrs.magie]);
  const [draftSplit, setDraftSplit] = useState(savedSplit);
  useEffect(() => { setDraftSplit(savedSplit); },
    [charId, savedSplit.ad, savedSplit.ap, savedSplit.mana]);
  const [draftMent, setDraftMent] = useState(savedMent);
  useEffect(() => { setDraftMent(savedMent); },
    [charId, savedMent.hp, savedMent.mana]);
  const [draftForce, setDraftForce] = useState(savedForce);
  useEffect(() => { setDraftForce(savedForce); },
    [charId, savedForce.ad, savedForce.armure]);
  const [draftMagie, setDraftMagie] = useState(savedMagie);
  useEffect(() => { setDraftMagie(savedMagie); },
    [charId, savedMagie.ap, savedMagie.resmag]);

  const view = canEdit ? draft : savedAttrs;          // valeurs affichées (brouillon si éditable)
  // Plancher par caracs : un joueur ne peut JAMAIS descendre sous ses valeurs déjà confirmées
  // (montée au level-up uniquement). Le staff garde la main totale (plancher 0), et le MJ
  // peut rendre ponctuellement la main au joueur (bouton « ↺ Rouvrir la respec »).
  const floorAttrs = (staff || attrsOpen) ? {} : savedAttrs;
  const sum = attrSum(view);
  const remaining = budget - sum;
  const attrsValid = respecValid(view, budget, cap, floorAttrs);
  // Planchers de la répartition. Même philosophie que le plancher des caracs : un joueur
  // ne peut pas RE-router des points déjà confirmés, il ne place que les nouveaux ; le
  // staff garde la main totale. Sans répartition confirmée, aucun plancher — sinon un
  // défaut deviné deviendrait un choix imposé.
  // ⚠ Rouvrir la respec lève AUSSI les planchers des deux répartitions : baisser une
  // carac rogne mécaniquement la répartition dérivée (`clampSplitDraft` coupe dans un
  // ordre fixe), et un plancher maintenu figerait le joueur sur une coupe qu'il n'a pas
  // choisie et ne pourrait plus corriger. Les deux boutons dédiés restent là pour le cas
  // étroit : rendre une répartition sans rendre la respec.
  const splitFloors = (staff || !hasSplit || splitOpen || attrsOpen) ? null : savedSplit;
  const mentFloors = (staff || !hasMent || mentOpen || attrsOpen) ? null : savedMent;
  const forceFloors = (staff || !hasForce || forceOpen || attrsOpen) ? null : savedForce;
  const magieFloors = (staff || !hasMagie || magieOpen || attrsOpen) ? null : savedMagie;
  // Bornée sur l'Habileté du BROUILLON : baisser l'Habileté rogne la répartition,
  // la monter laisse les nouveaux points « à placer ».
  const split = clampSplitDraft(draftSplit, view.hab);
  const splitLeft = view.hab - (split.ad + split.ap + split.mana);
  const ment = clampSplitDraft(draftMent, view.mental, ['mana', 'hp']);
  const mentLeft = view.mental - (ment.hp + ment.mana);
  const forc = clampSplitDraft(draftForce, view.force, ['armure', 'ad']);
  const forcLeft = view.force - (forc.ad + forc.armure);
  const magi = clampSplitDraft(draftMagie, view.magie, ['resmag', 'ap']);
  const magiLeft = view.magie - (magi.ap + magi.resmag);
  // Confirmer exige que les DEUX réserves soient vides, exactement comme les points
  // de caractéristiques : un point non placé ne rapporterait rien.
  const valid = attrsValid && splitLeft === 0 && mentLeft === 0
    && forcLeft === 0 && magiLeft === 0;
  const dirty = view.force !== savedAttrs.force || view.hab !== savedAttrs.hab
    || view.mental !== savedAttrs.mental || view.magie !== savedAttrs.magie
    || split.ad !== savedSplit.ad || split.ap !== savedSplit.ap || split.mana !== savedSplit.mana
    || ment.hp !== savedMent.hp || ment.mana !== savedMent.mana
    || forc.ad !== savedForce.ad || forc.armure !== savedForce.armure
    || magi.ap !== savedMagie.ap || magi.resmag !== savedMagie.resmag
    || !hasSplit || !hasMent || !hasForce || !hasMagie;
  const preview = computeStats(view.force, view.hab, view.mental, view.magie, effLevel,
    split, ment, forc, magi);
  /* Pourquoi « Confirmer » est gris. ⚠️ Le cas `valid && !dirty` DOIT être couvert : c'est
     celui qu'on atteint juste après une confirmation (et donc après une réouverture de
     respec, qui ne rend rien « à confirmer »), et sans message le bouton gris sans
     infobulle se lit comme une page verrouillée. Les réserves d'Habileté et de Mental
     sont distinguées : un seul message « Habileté » mentait quand il manquait du Mental. */
  const confirmHint = !attrsValid ? `Répartis exactement ${budget} points (limite ${cap} par carac)`
    : splitLeft > 0 ? `Place tes ${splitLeft} point(s) d'Habileté`
    : mentLeft > 0 ? `Place tes ${mentLeft} point(s) de Mental`
    : forcLeft > 0 ? `Place tes ${forcLeft} point(s) de Force`
    : magiLeft > 0 ? `Place tes ${magiLeft} point(s) de Magie`
    : !dirty ? (attrsOpen ? 'Rien n’a changé — « Garder la répartition » referme la fenêtre'
                          : 'Aucun changement à confirmer — déplace un point d’abord')
    : '';

  const selStyle = { background:'var(--bg-inset)', color:'var(--ink)', border:'1px solid var(--line-strong)', borderRadius:6, padding:'6px 9px', fontSize:13 };

  const bump = (key, delta) => {
    if (!canEdit) return;
    setDraft(d => {
      const next = Math.max(floorAttrs[key] | 0, Math.min(cap, (d[key] | 0) + delta));
      if (delta > 0 && (budget - attrSum(d)) <= 0) return d; // plus de points dispo
      return Object.assign({}, d, { [key]: next });
    });
  };

  // Rouvre la RESPEC des caracs du joueur (staff). Utile quand un joueur s'est trompé,
  // ou quand une baisse de budget le laisse en solde négatif : il ne peut alors ni
  // descendre (plancher) ni confirmer (somme invalide), donc plus rien ne bouge.
  const reopenAttrs = () => {
    setAttrsOpen(!attrsOpen);
    toast(attrsOpen
      ? `<b>${char.name}</b> — respec refermée`
      : `<b>${char.name}</b> — respec rouverte au joueur`, attrsOpen ? 'gold' : 'buff');
  };
  /* Vide le brouillon (caracs à 0, réserves pleines). ⚠️ C'est le SEUL point d'entrée
     d'une redistribution à budget plein : `canInc` exige `remaining > 0`, donc à 10/10
     tous les « + » sont morts et le seul geste possible est un « − ». Sans ce bouton, la
     page se lit comme verrouillée alors qu'elle ne l'est pas.
     ⚠️ Affiché UNIQUEMENT quand le plancher est levé (staff, ou respec rouverte) : chez
     un joueur au plancher, remettre à 0 serait un contournement du verrou, et les
     répartitions vidées se heurteraient à leurs propres planchers (« − » désactivé sous
     le plancher) — un état dont le joueur ne pourrait plus sortir.
     Les deux répartitions sont vidées avec les caracs : `clampSplitDraft` les ramènerait
     à 0 de toute façon, mais les garder en brouillon replacerait les points tout seuls
     dès la remontée de la carac — l'inverse de « tout à 0 ». */
  const clearDraft = () => {
    setDraft({ force:0, hab:0, mental:0, magie:0 });
    setDraftSplit({ ad:0, ap:0, mana:0 });
    setDraftMent({ hp:0, mana:0 });
    setDraftForce({ ad:0, armure:0 });
    setDraftMagie({ ap:0, resmag:0 });
  };
  /* « Tout placer » : verse la réserve sur la destination par défaut. On réutilise
     `habSplit`/`mentalSplit` (game-logic), dont c'est exactement la sémantique — le
     reliquat part sur la carac de dégâts dominante / sur les PV. Le joueur peut ensuite
     déplacer ces points ligne par ligne : c'est une amorce, pas un choix imposé.
     ⚠️ Sans ce raccourci, une réserve ouverte est un blocage MUET : le compteur d'en-tête
     dit « 0 restant » et « Confirmer » reste gris sans raison visible. */
  const fillSplit = () => setDraftSplit(habSplit(view.force, view.hab, view.magie, split));
  const fillMent  = () => setDraftMent(mentalSplit(view.mental, ment));
  const fillForce = () => setDraftForce(forceSplit(view.force, forc));
  const fillMagie = () => setDraftMagie(magieSplit(view.magie, magi));
  // Rouvre la répartition d'Habileté du joueur (staff). Utile quand un joueur s'est
  // trompé, ou quand une refonte de règles rend son placement caduc.
  const reopenSplit = () => {
    setHabSplitOpen(!splitOpen);
    toast(splitOpen
      ? `<b>${char.name}</b> — répartition d'Habileté refermée`
      : `<b>${char.name}</b> — répartition d'Habileté rouverte au joueur`, splitOpen ? 'gold' : 'buff');
  };
  const reopenMent = () => {
    setMentalSplitOpen(!mentOpen);
    toast(mentOpen
      ? `<b>${char.name}</b> — répartition du Mental refermée`
      : `<b>${char.name}</b> — répartition du Mental rouverte au joueur`, mentOpen ? 'gold' : 'buff');
  };
  const reopenForce = () => {
    setForceSplitOpen(!forceOpen);
    toast(forceOpen
      ? `<b>${char.name}</b> — répartition de la Force refermée`
      : `<b>${char.name}</b> — répartition de la Force rouverte au joueur`, forceOpen ? 'gold' : 'buff');
  };
  const reopenMagie = () => {
    setMagieSplitOpen(!magieOpen);
    toast(magieOpen
      ? `<b>${char.name}</b> — répartition de la Magie refermée`
      : `<b>${char.name}</b> — répartition de la Magie rouverte au joueur`, magieOpen ? 'gold' : 'buff');
  };

  // Écriture partagée par « Confirmer » et « Garder la répartition » : mêmes valeurs,
  // même patch. joueur => pas de verrou dur (le plancher protège) ; staff => garde
  // l'état du verrou.
  const writeAttrs = () => {
    setAttrs(draft, staff ? locked : false, split, ment, forc, magi);
    toast(`<b>${char.name}</b> — caractéristiques enregistrées`, 'buff');
  };
  const confirm = () => {
    if (!valid) return;
    if (!staff && !window.confirm('Confirmer cette répartition ? Les points placés deviennent définitifs : tu pourras en rajouter aux prochains niveaux, mais plus en retirer.')) return;
    writeAttrs();
  };
  /* « Garder la répartition » — la respec a été rouverte mais on ne veut rien changer.
     ⚠️ Sans ce bouton il n'y a AUCUNE écriture possible : « Confirmer » est gardé par
     `dirty`, qui exige un changement, donc la fenêtre `attrsOpen` reste ouverte jusqu'à
     ce que le MJ la referme lui-même. L'écriture est identique à une confirmation
     (mêmes valeurs), et c'est `setAttrs` qui remet `attrsOpen` à null : c'est elle qui
     referme la fenêtre. Bouton SÉPARÉ plutôt qu'un assouplissement de `dirty` : sinon
     un clic malencontreux refermerait la respec à la seconde où le MJ vient de l'ouvrir. */
  const keepAttrs = () => {
    if (!valid) return;
    if (!staff && !window.confirm('Garder ta répartition actuelle, sans rien changer ? Tes points redeviendront définitifs.')) return;
    writeAttrs();
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
              <span className="row gap-2" style={{ alignItems:'center' }}>
                {staff && attrSum(savedAttrs) > 0 && (
                  <button className="btn btn-sm btn-ghost" onClick={reopenAttrs}
                    title={attrsOpen ? 'Refermer : le joueur ne pourra plus descendre sous ses valeurs confirmées'
                                     : 'Rendre au joueur une redistribution libre de ses caractéristiques déjà confirmées'}
                    style={{ padding:'2px 8px', fontSize:10.5, color: attrsOpen ? 'var(--buff)' : undefined }}>
                    {attrsOpen ? '🔓 Rouverte' : '↺ Rouvrir la respec'}
                  </button>
                )}
                {canEdit && (staff || attrsOpen) && sum > 0 && (
                  <button className="btn btn-sm btn-ghost" onClick={clearDraft}
                    title="Vider le brouillon : toutes les caractéristiques à 0, tous les points à replacer (rien n'est écrit tant que tu n'as pas confirmé)"
                    style={{ padding:'2px 8px', fontSize:10.5 }}>Tout à 0</button>
                )}
                <span className="mono faint" style={{ fontSize:11 }}>
                  {sum} / {budget} pts
                  <span style={{ color: remaining === 0 ? 'var(--buff)' : (remaining < 0 ? 'var(--debuff-bright)' : 'var(--gold-bright)'), fontWeight:700 }}> · {remaining} restant{Math.abs(remaining) > 1 ? 's' : ''}</span>
                  {` · limite ${cap}`}
                </span>
              </span>
            </div>

            {!canEdit && (
              <div className="faint" style={{ fontSize:12.5, padding:'10px 18px 0', lineHeight:1.5 }}>
                🔒 Verrouillé par le MJ — demande-lui pour modifier.
              </div>
            )}
            {canEdit && !staff && attrSum(savedAttrs) > 0 && (
              <div className="faint" style={{ fontSize:12, padding:'10px 18px 0', lineHeight:1.5 }}>
                {attrsOpen
                  ? "🔓 Le MJ a rouvert ta respec : tu peux redistribuer tous tes points (répartitions comprises) jusqu'à ta prochaine confirmation."
                  : 'Tu peux ajouter des points, mais pas descendre sous tes valeurs déjà confirmées.'}
              </div>
            )}
            {/* Miroir MJ du bandeau joueur : « ↺ Rouvrir la respec » ne change RIEN à
                l'écran du staff (son plancher est déjà à 0), donc sans ce rappel le
                bouton semble sans effet et on ne sait plus si la fenêtre est ouverte. */}
            {canEdit && staff && attrsOpen && (
              <div style={{ fontSize:12, padding:'10px 18px 0', lineHeight:1.5, color:'var(--buff)' }}>
                🔓 Respec rouverte pour le joueur — il peut redistribuer tous ses points (répartitions comprises)
                jusqu'à sa prochaine confirmation, qui refermera la fenêtre.
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
                      <SplitRow label="Répartition de l'Habileté" meta={HAB_DEST_META}
                        emptyLabel="Aucun point d'Habileté à répartir."
                        defaultHint={"Répartition pas encore confirmée — le défaut suit ta carac de dégâts dominante. Tant que tu n'as pas confirmé, tu peux tout redistribuer librement."}
                        val={val} total={sum} split={split} left={splitLeft} floors={splitFloors}
                        canEdit={canEdit} onChange={setDraftSplit} confirmed={hasSplit}
                        open={splitOpen} onReopen={staff ? reopenSplit : null} onFill={fillSplit} />
                    )}
                    {attr.key === 'force' && (
                      <SplitRow label="Répartition de la Force (part dirigée)" meta={FORCE_DEST_META}
                        emptyLabel="Aucun point de Force à répartir."
                        defaultHint={"Répartition pas encore confirmée — par défaut, tout part en AD (soit 25 AD + 1 armure par point, comme avant sur les dégâts). Tant que tu n'as pas confirmé, tu peux tout redistribuer librement."}
                        val={val} total={sum} split={forc} left={forcLeft} floors={forceFloors}
                        canEdit={canEdit} onChange={setDraftForce} confirmed={hasForce}
                        open={forceOpen} onReopen={staff ? reopenForce : null} onFill={fillForce} />
                    )}
                    {attr.key === 'magie' && (
                      <SplitRow label="Répartition de la Magie (part dirigée)" meta={MAGIE_DEST_META}
                        emptyLabel="Aucun point de Magie à répartir."
                        defaultHint={"Répartition pas encore confirmée — par défaut, tout part en AP (soit 25 AP + 1 rés. magique par point, comme avant sur les dégâts). Tant que tu n'as pas confirmé, tu peux tout redistribuer librement."}
                        val={val} total={sum} split={magi} left={magiLeft} floors={magieFloors}
                        canEdit={canEdit} onChange={setDraftMagie} confirmed={hasMagie}
                        open={magieOpen} onReopen={staff ? reopenMagie : null} onFill={fillMagie} />
                    )}
                    {attr.key === 'mental' && (
                      <SplitRow label="Répartition du Mental (part dirigée)" meta={MENTAL_DEST_META}
                        emptyLabel="Aucun point de Mental à répartir."
                        defaultHint={"Répartition pas encore confirmée — par défaut, tout part en PV (soit 60 PV + 15 Mana par point, comme avant). Tant que tu n'as pas confirmé, tu peux tout redistribuer librement."}
                        val={val} total={sum} split={ment} left={mentLeft} floors={mentFloors}
                        canEdit={canEdit} onChange={setDraftMent} confirmed={hasMent}
                        open={mentOpen} onReopen={staff ? reopenMent : null} onFill={fillMent} />
                    )}
                  </div>
                );
              })}
            </div>

            {canEdit && (
              <div className="row" style={{ justifyContent:'flex-end', gap:10, padding:'0 18px 16px', alignItems:'center' }}>
                <button className="btn btn-sm btn-ghost" onClick={() => { setDraft(savedAttrs); setDraftSplit(savedSplit); setDraftMent(savedMent); }} disabled={!dirty}>Réinitialiser</button>
                {/* ⚠️ Le motif du blocage est AFFICHÉ, pas seulement en `title` : une
                    infobulle n'existe pas au doigt (tablette) et le compteur d'en-tête
                    dit « 0 restant » même quand une réserve de répartition bloque tout. */}
                {(!valid || !dirty) && confirmHint && (
                  <span className="mono" style={{ fontSize:11.5, fontWeight:700, textAlign:'right',
                    color: valid ? 'var(--ink-faint)' : 'var(--gold-bright)' }}>{confirmHint}</span>
                )}
                {canEdit && attrsOpen && valid && !dirty && (
                  <button className="btn btn-sm btn-ghost" onClick={keepAttrs}
                    title="Enregistrer la répartition actuelle telle quelle et refermer la fenêtre de respec"
                    style={{ color:'var(--buff)' }}>Garder la répartition</button>
                )}
                <button className="btn btn-gold" onClick={confirm} disabled={!valid || !dirty}
                  title={confirmHint}>Confirmer</button>
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
