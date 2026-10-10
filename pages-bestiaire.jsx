/* ============================================================
   PAGE BESTIAIRE — atelier de création d'ennemis et de PNJ (MJ seul)
   Spec : docs/superpowers/specs/2026-10-11-bestiaire-design.md
   Les calculs sont dans game-logic.js (npc*). Les champs de la fiche sont la SOURCE DE
   VÉRITÉ : le moteur suggère, le MJ corrige. Données dans `/bestiary` (rôle mj seul).
   ============================================================ */
const BST_FLD = { background:'var(--bg-inset)', color:'var(--ink)', border:'1px solid var(--line-strong)', borderRadius:6, padding:'6px 9px', fontSize:13, width:'100%', boxSizing:'border-box' };
const BST_STATS = [
  ['hpMax',   'PV',           'var(--hp)'],
  ['ad',      'AD',           'var(--stat-phys)'],
  ['ap',      'AP',           'var(--stat-mag)'],
  ['armure',  'Armure',       'var(--stat-phys)'],
  ['resmag',  'Rés. magique', 'var(--stat-mag)'],
  ['crit',    '% Crit',       'var(--stat-neut)'],
  ['dcrit',   '% Dég. crit',  'var(--stat-neut)'],
  ['rescrit', '% Rés. crit',  'var(--stat-neut)'],
  ['lethaAD', 'Léth. phys.',  'var(--stat-phys)'],
  ['lethaAP', 'Léth. mag.',   'var(--stat-mag)'],
];
const bstNum = (n) => Math.round(Number(n) || 0).toLocaleString('fr-FR');
const bstMult = (x) => '×' + (Math.round(x * 100) / 100).toLocaleString('fr-FR');
const bstPct = (n) => Math.round(n * 100) + ' %';

/* Champ lié à une valeur temps réel : garde sa saisie locale tant qu'il a le focus (un écho
   Firebase ne doit pas déplacer le curseur), se resynchronise dès qu'il le perd — c'est ce qui
   permet à un champ de SUIVRE la suggestion quand le niveau ou le rang change. */
function BstField({ value, onCommit, numeric, min = 0, max = 9999999, multiline, style, ...rest }) {
  const [txt, setTxt] = useState(String(value == null ? '' : value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setTxt(String(value == null ? '' : value)); }, [value]);
  const change = (e) => {
    const v = e.target.value;
    setTxt(v);
    if (!numeric) { onCommit(v); return; }
    if (v.trim() === '' || isNaN(parseInt(v, 10))) return;       // saisie en cours : on n'écrit pas
    onCommit(Math.max(min, Math.min(max, parseInt(v, 10))));
  };
  const props = { value: txt, onChange: change, style: { ...BST_FLD, ...style },
    onFocus: () => { focused.current = true; },
    onBlur: () => { focused.current = false; setTxt(String(value == null ? '' : value)); }, ...rest };
  return multiline ? <textarea {...props} /> : <input {...props} />;
}

function BstMonsterRow({ m, active, onClick }) {
  const p = npcParams(m), rank = npcRank(p.rank);
  return (
    <button onClick={onClick} className="row gap-2"
      style={{ textAlign:'left', width:'100%', padding:'7px 9px', borderRadius:6, cursor:'pointer',
        background: active ? 'var(--bg-hover)' : 'transparent', color:'var(--ink)',
        border:'1px solid ' + (active ? 'var(--line-gold)' : 'transparent') }}>
      <span style={{ width:30, height:30, flexShrink:0, borderRadius:5, border:'1px solid var(--line)',
        background: m.img ? `center/cover no-repeat url(${m.img})` : 'var(--bg-inset)',
        display:'grid', placeItems:'center', fontSize:13, color:'var(--ink-faint)' }}>{m.img ? '' : (m.side === 'ally' ? '☘' : '☠')}</span>
      <span className="col" style={{ minWidth:0, flex:1 }}>
        <span style={{ fontSize:13, color: active ? 'var(--gold-pale)' : 'var(--ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name || '(sans nom)'}</span>
        <span className="faint" style={{ fontSize:10.5 }}>Niv. {p.level} · {rank.label} · {npcArchetype(p.archetype).label}</span>
      </span>
    </button>
  );
}

/* Export / import JSON du bestiaire : `/bestiary` est HORS de la sauvegarde de la page Admin. */
function BstExportImport() {
  const toast = useToast();
  const doExport = async () => {
    const data = await window.RTDB.getSnapshot(BESTIARY);
    const blob = new Blob([JSON.stringify(data || {}, null, 2)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `runeterra-bestiaire-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    toast('Bestiaire exporté', 'gold');
  };
  const doImport = (e) => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data !== 'object' || Array.isArray(data) || (data.monsters && typeof data.monsters !== 'object'))
          throw new Error("ce fichier n'est pas un export du bestiaire");
        if (!confirm('Remplacer TOUT le bestiaire par ce fichier ?')) return;
        await window.RTDB.setPath(BESTIARY, data);
        toast('Bestiaire importé', 'buff');
      } catch (err) {
        console.error('Import du bestiaire échoué :', err);
        toast('Import échoué : ' + (err && err.message ? err.message : 'erreur inconnue'), 'debuff');
      }
    };
    reader.readAsText(file);
  };
  return (
    <div className="row gap-2">
      <button className="btn btn-sm btn-ghost" style={{ flex:1 }} onClick={doExport}>⬇ Exporter</button>
      <label className="btn btn-sm btn-ghost" style={{ flex:1, cursor:'pointer', textAlign:'center' }}>
        ⬆ Importer<input type="file" accept="application/json" onChange={doImport} style={{ display:'none' }} />
      </label>
    </div>
  );
}

/* Curseur endurance ↔ violence. Le brouillon local suit le glissé ; on n'écrit en base
   qu'au relâchement (un `range` émet un changement par pixel). */
function BstTilt({ tilt, rankId, onCommit }) {
  const [draft, setDraft] = useState(tilt);
  useEffect(() => { setDraft(tilt); }, [tilt]);
  const k = npcTiltFactor(draft), def = npcDefaultTilt(rankId);
  const commit = () => { if (draft !== tilt) onCommit(draft); };
  return (
    <div className="col gap-1">
      <div className="row" style={{ justifyContent:'space-between' }}>
        <span className="overline">Endurance ↔ violence</span>
        <span className="mono" style={{ fontSize:11.5, color:'var(--gold-pale)' }}>
          PV {bstMult(k)} · dégâts {bstMult(1 / k)}
          {tilt !== def && <button className="btn btn-sm btn-ghost" onClick={() => onCommit(def)}
            title={`Revenir au réglage du rang (${def > 0 ? '+' : ''}${def})`} style={{ marginLeft:8, padding:'1px 7px', fontSize:10.5 }}>↺ rang</button>}
        </span>
      </div>
      <input type="range" min="-200" max="300" step="1" value={draft}
        onChange={e => setDraft(parseInt(e.target.value, 10) || 0)}
        onMouseUp={commit} onTouchEnd={commit} onKeyUp={commit} onBlur={commit}
        style={{ width:'100%', accentColor:'var(--gold)' }} />
      <div className="row faint" style={{ justifyContent:'space-between', fontSize:10 }}>
        <span>bref et violent</span><span>{draft > 0 ? '+' : ''}{draft}</span><span>long et usant</span>
      </div>
    </div>
  );
}

/* Attaques et compétences : plages de dégâts INDICATIVES pour le MJ, sans lien avec la vue MJ
   (seul le coup normal de l'attaque de base part dans `atk` à la pose).
   ⚠️ Tant que la fiche n'a pas de nœud `attacks`, on affiche le gabarit de l'archétype chiffré
   sur le budget courant (`npcMonsterAttacks`) : la première retouche écrit la liste ENTIÈRE. */
const BST_TYPES = [['physique', 'Physique', 'var(--stat-phys)'], ['magique', 'Magique', 'var(--stat-mag)'], ['brut', 'Brut', 'var(--ink-dim)']];
function BstAttackCard({ a, m, def, view, share, onEdit, onRemove }) {
  const v = npcAttackView(a, m, def, view === 'own' ? undefined : view);
  const zone = v.targets > 1;
  const sel = { ...BST_FLD, width:'auto', padding:'5px 6px', fontSize:12 };
  const tcol = (BST_TYPES.find(t => t[0] === v.type) || BST_TYPES[2])[2];
  return (
    <div className="col gap-2" style={{ padding:'11px 12px', borderRadius:8, background:'var(--bg-inset)', border:'1px solid var(--line)' }}>
      <div className="row gap-2">
        <BstField value={a.name || ''} onCommit={(x) => onEdit({ name: x })} placeholder="Nom de l'attaque"
          style={{ flex:1, fontSize:13.5, color:'var(--gold-pale)' }} />
        <select value={a.kind === 'basic' ? 'basic' : 'skill'} onChange={e => onEdit({ kind: e.target.value })} style={sel}>
          <option value="basic">Attaque de base</option><option value="skill">Compétence</option>
        </select>
        <button className="btn btn-sm btn-ghost" onClick={onRemove} title="Retirer cette attaque" style={{ padding:'4px 9px', color:'var(--debuff-bright)' }}>✗</button>
      </div>
      <div className="row gap-3 wrap" style={{ alignItems:'flex-end' }}>
        <label className="col gap-1" style={{ width:96 }}>
          <span className="overline">Dégâts{zone ? ' / cible' : ''}</span>
          <BstField numeric value={a.dmg || 0} onCommit={(x) => onEdit({ dmg: x })} />
        </label>
        <div className="col gap-1">
          <span className="overline">Type</span>
          <div className="row gap-1">
            {BST_TYPES.map(([t, lbl, c]) => (
              <button key={t} className={'btn btn-sm ' + ((a.type || 'physique') === t ? 'btn-gold' : 'btn-ghost')}
                onClick={() => onEdit({ type: t })} style={{ padding:'5px 9px', color: (a.type || 'physique') === t ? c : undefined }}>{lbl}</button>
            ))}
          </div>
        </div>
        <label className="col gap-1">
          <span className="overline">Cibles</span>
          <select value={v.targets} onChange={e => onEdit({ targets: parseInt(e.target.value, 10) })} style={sel}>
            {NPC_AOE_SHARE.map((s, i) => <option key={i} value={i + 1}>{i === 0 ? '1 (monocible)' : `${i + 1} (zone)`}</option>)}
          </select>
        </label>
        <label className="col gap-1">
          <span className="overline">Délai</span>
          <select value={Math.max(1, Math.min(10, a.cd | 0))} onChange={e => onEdit({ cd: parseInt(e.target.value, 10) })} style={sel} disabled={!!a.once}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n === 1 ? 'chaque tour' : `${n} tours`}</option>)}
          </select>
        </label>
        <label className="row gap-1" style={{ fontSize:12, cursor:'pointer', paddingBottom:7 }}>
          <input type="checkbox" checked={a.crit !== false} onChange={e => onEdit({ crit: e.target.checked ? null : false })} /> peut criter
        </label>
        <label className="row gap-1" style={{ fontSize:12, cursor:'pointer', paddingBottom:7 }} title="Une fois par combat : hors du budget par round">
          <input type="checkbox" checked={!!a.once} onChange={e => onEdit({ once: e.target.checked ? true : null })} /> 1×/combat
        </label>
      </div>
      <div className="mono" style={{ fontSize:11.5, lineHeight:1.75, color:'var(--ink-dim)' }}>
        <span style={{ color: tcol }}>{v.type}</span> · à annoncer <b style={{ color:'var(--ink)', fontSize:13 }}>{bstNum(v.normal)}</b> ({bstNum(v.low)} à {bstNum(v.high)})
        {v.crit != null && <span> · critique <b style={{ color:'var(--ink)' }}>{bstNum(v.crit)}</b></span>}
        {' '}· moyenne {bstNum(v.avg)}{zone && <span> par cible, <b style={{ color:'var(--ink)' }}>{bstNum(v.total)}</b> sur {v.targets} cibles</span>}
        <br />
        encaissé par le PJ de référence : <b style={{ color:'var(--ink)' }}>{bstNum(v.taken.normal)}</b>
        {v.taken.crit != null && <span> · critique {bstNum(v.taken.crit)}</span>}
        {def.hp > 0 && <span> · soit {Math.round(v.taken.normal / def.hp * 100)} % de ses PV</span>}
        <span className="faint"> · {a.once ? 'hors budget (1×/combat)' : `${Math.round(share)} % du budget par round`}</span>
      </div>
      <BstField value={a.note || ''} onCommit={(x) => onEdit({ note: x })} multiline rows={1}
        placeholder="Notes : effet, portée, condition, idée de mise en scène…" style={{ resize:'vertical', fontFamily:'inherit', fontSize:12, lineHeight:1.5 }} />
    </div>
  );
}

function BstAttacks({ m, patch }) {
  const [view, setView] = useState('own');
  const p = npcParams(m), ref = refPlayer(p.level);
  const budget = npcRoundDmgFromStats(m);
  const atts = npcMonsterAttacks(m);
  const virtual = !m.attacks;
  const use = npcBudgetUsage(atts, m, budget);
  const write = (list) => { const map = {}; list.forEach((a, i) => { map[a.id] = Object.assign({}, a, { order: i }); }); patch({ attacks: list.length ? map : null }); };
  const edit = (id, change) => write(atts.map(a => {
    if (a.id !== id) return a;
    const n = Object.assign({}, a, change);
    Object.keys(n).forEach(k => { if (n[k] == null) delete n[k]; });   // crit / once : absent = défaut
    return n;
  }));
  const off = Math.abs(use.pct - 100) > 3;
  const barCol = use.pct > 110 ? 'var(--debuff-bright)' : use.pct < 90 ? 'var(--ink-dim)' : 'var(--gold)';
  return (
    <div className="panel col gap-3" style={{ padding:'14px 16px' }}>
      <div className="row gap-2 wrap" style={{ justifyContent:'space-between' }}>
        <span className="overline">Attaques et compétences</span>
        <span className="row gap-1" title="Type de dégâts utilisé pour le calcul de l'encaissé">
          <span className="faint" style={{ fontSize:11, marginRight:4 }}>Afficher en</span>
          {[['own', 'type de l\'attaque']].concat(BST_TYPES.map(t => [t[0], t[1].toLowerCase()])).map(([k, lbl]) => (
            <button key={k} className={'btn btn-sm ' + (view === k ? 'btn-gold' : 'btn-ghost')} onClick={() => setView(k)}
              style={{ padding:'3px 9px', fontSize:11 }}>{lbl}</button>
          ))}
        </span>
      </div>

      {/* Jauge de budget */}
      <div className="col gap-1">
        <div className="row" style={{ justifyContent:'space-between', fontSize:12 }}>
          <span>Budget de dégâts par round : <b className="mono" style={{ color: barCol }}>{bstNum(use.used)}</b>
            <span className="mono faint"> / {bstNum(budget)}</span> <b style={{ color: barCol }}>({Math.round(use.pct)} %)</b></span>
          <span className="row gap-1">
            {off && use.used > 0 && <button className="btn btn-sm btn-ghost" style={{ padding:'2px 9px', fontSize:11 }}
              title="Recale toutes les attaques sur le budget, en gardant leurs proportions"
              onClick={() => write(npcFitAttacks(atts, m, budget))}>⇆ Ajuster au budget</button>}
            {!virtual && <button className="btn btn-sm btn-ghost" style={{ padding:'2px 9px', fontSize:11 }}
              title="Efface tes attaques et revient au gabarit de l'archétype, qui suit le niveau et le rang"
              onClick={() => { if (confirm('Revenir au gabarit de l\'archétype ? Tes attaques, leurs noms et leurs notes seront effacés.')) patch({ attacks: null }); }}>↺ Gabarit</button>}
          </span>
        </div>
        <div style={{ height:7, borderRadius:4, background:'var(--bg-inset)', border:'1px solid var(--line)', overflow:'hidden' }}>
          <div style={{ width: Math.min(100, use.pct) + '%', height:'100%', background: barCol, transition:'width .15s' }} />
        </div>
        <span className="faint" style={{ fontSize:11 }}>
          {virtual
            ? 'Gabarit de l\'archétype : il suit le niveau, le rang et le curseur. Dès que tu retouches une attaque, la liste devient la tienne et ne bouge plus seule.'
            : 'Liste retouchée : elle ne suit plus les paramètres. La jauge dit l\'écart, « Ajuster au budget » la recale.'}
          {' '}Le budget vient de la stat d'attaque et du crit de la fiche. Le monstre joue comme un PJ : attaque de base + C1 + C2 ou C3 par tour.
        </span>
      </div>

      {atts.map(a => (
        <BstAttackCard key={a.id} a={a} m={m} def={ref} view={view}
          share={budget > 0 ? npcAttackCost(a, m) / budget * 100 : 0}
          onEdit={(change) => edit(a.id, change)} onRemove={() => write(atts.filter(x => x.id !== a.id))} />
      ))}
      <button className="btn btn-sm btn-ghost" style={{ alignSelf:'flex-start' }}
        onClick={() => write(atts.concat([npcNewAttack(atts, m, budget, npcArchetype(p.archetype).main)]))}>+ Ajouter une attaque</button>
    </div>
  );
}

function BstEditor({ m, patch, onDuplicate, onRemove, go }) {
  const toast = useToast();
  const [count, setCount] = useState(1);
  const p = npcParams(m), sug = npcSuggestSheet(m), ref = refPlayer(p.level);
  const rank = npcRank(p.rank);
  const reparam = (change) => patch(npcReparam(m, change));
  const power = npcPowerOf(m, p.level);
  const near = npcRankForPower(power);
  const ehp = npcEhp(m), round = npcRoundDmgFromStats(m);
  const edited = [...NPC_STAT_KEYS, 'xp'].filter(k => m[k] != null && Number(m[k]) !== sug[k]);

  const pickImage = async (e) => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    try { patch({ img: await downscaleImageToDataURL(file, 256) }); }
    catch (err) { toast('Image illisible', 'debuff'); }
  };
  const place = async () => {
    try {
      const n = await placeMonster(m, count);
      toast(`<b>${m.name}</b> posé en combat${n > 1 ? ` (×${n})` : ''}`, 'buff');
    } catch (err) { toast('Pose en combat échouée : ' + (err && err.message ? err.message : 'erreur'), 'debuff'); }
  };

  return (
    <div className="col gap-4" style={{ padding:'18px 24px 32px', maxWidth:980 }}>
      {/* Identité */}
      <div className="row gap-3" style={{ alignItems:'flex-start' }}>
        <label title="Choisir une image" style={{ width:76, height:76, flexShrink:0, borderRadius:8, cursor:'pointer',
          border:'1px solid var(--line-gold)', background: m.img ? `center/cover no-repeat url(${m.img})` : 'var(--bg-inset)',
          display:'grid', placeItems:'center', color:'var(--ink-faint)', fontSize:11 }}>
          {m.img ? '' : '+ image'}
          <input type="file" accept="image/*" onChange={pickImage} style={{ display:'none' }} />
        </label>
        <div className="col gap-2" style={{ flex:1, minWidth:0 }}>
          <BstField value={m.name} onCommit={(v) => patch({ name: v })} placeholder="Nom"
            style={{ fontFamily:'var(--font-display)', fontSize:19, color:'var(--gold-pale)', padding:'7px 11px' }} />
          <div className="row gap-2 wrap">
            {[['enemy','Ennemi'],['ally','PNJ allié']].map(([s, lbl]) => (
              <button key={s} className={'btn btn-sm ' + ((m.side === 'ally' ? 'ally' : 'enemy') === s ? 'btn-gold' : 'btn-ghost')}
                onClick={() => patch({ side: s })}>{lbl}</button>
            ))}
            {m.img && <button className="btn btn-sm btn-ghost" onClick={() => patch({ img: '' })}>Retirer l'image</button>}
            <span style={{ flex:1 }} />
            <button className="btn btn-sm btn-ghost" onClick={onDuplicate} title="Repartir de cette fiche pour en faire une autre version">⧉ Dupliquer</button>
            <button className="btn btn-sm btn-ghost" onClick={onRemove} style={{ color:'var(--debuff-bright)' }}>Supprimer</button>
          </div>
        </div>
      </div>

      {/* Paramètres de génération */}
      <div className="panel col gap-3" style={{ padding:'14px 16px' }}>
        <div className="row gap-4 wrap" style={{ alignItems:'flex-end' }}>
          <label className="col gap-1" style={{ width:84 }}>
            <span className="overline">Niveau</span>
            <BstField numeric min={1} max={NPC_LEVEL_MAX} value={p.level} onCommit={(v) => reparam({ level: v })} />
          </label>
          <div className="col gap-1">
            <span className="overline">Rang</span>
            <div className="row gap-1 wrap">
              {NPC_RANKS.map(r => (
                <button key={r.id} className={'btn btn-sm ' + (p.rank === r.id ? 'btn-gold' : 'btn-ghost')}
                  title={`${bstPct(r.power)} d'un PJ de même niveau`} onClick={() => reparam({ rank: r.id })}>{r.label}</button>
              ))}
            </div>
          </div>
          <label className="col gap-1" style={{ minWidth:190, flex:1 }}>
            <span className="overline">Archétype</span>
            <select value={p.archetype} onChange={e => reparam({ archetype: e.target.value })} style={BST_FLD}>
              {NPC_ARCHETYPES.map(a => <option key={a.id} value={a.id}>{a.label} — PV {bstMult(a.hp)}, dégâts {bstMult(a.dmg)}</option>)}
            </select>
          </label>
        </div>
        <BstTilt tilt={p.tilt} rankId={p.rank} onCommit={(t) => reparam({ tilt: t })} />
      </div>

      {/* Verdict */}
      <div className="panel col gap-2" style={{ padding:'14px 16px', borderColor:'var(--line-gold)' }}>
        <div className="row gap-3 wrap" style={{ alignItems:'baseline' }}>
          <span className="overline">Puissance réelle</span>
          <span style={{ fontFamily:'var(--font-display)', fontSize:24, color:'var(--gold-bright)' }}>{bstPct(power)}</span>
          <span className="dim" style={{ fontSize:13 }}>
            d'un PJ de niveau {p.level} — {near.id === rank.id ? `un ${rank.label.toLowerCase()}` : `plus proche d'un ${near.label.toLowerCase()} que d'un ${rank.label.toLowerCase()}`}
          </span>
        </div>
        <div className="mono faint" style={{ fontSize:11.5, lineHeight:1.7 }}>
          PV effectifs <b style={{ color:'var(--ink)' }}>{bstNum(ehp)}</b> ({bstMult(ehp / ref.ehp)} du référentiel) ·
          dégâts par round <b style={{ color:'var(--ink)' }}>{bstNum(round)}</b> ({bstMult(round / ref.roundDmg)})<br />
          Référentiel niveau {p.level} : {bstNum(ref.hp)} PV · {bstNum(ref.atk)} AD/AP · {bstNum(ref.armure)} armure · {bstNum(ref.resmag)} RM ·
          crit {bstNum(ref.crit)} % · {bstNum(ref.roundDmg)} dégâts par round
        </div>
      </div>

      {/* Stats */}
      <div className="panel col gap-3" style={{ padding:'14px 16px' }}>
        <div className="row" style={{ justifyContent:'space-between' }}>
          <span className="overline">Statistiques</span>
          {edited.length > 0 && (
            <button className="btn btn-sm btn-ghost" style={{ padding:'2px 9px', fontSize:11 }}
              onClick={() => patch(sug)} title="Remet tous les champs sur leur valeur suggérée">↺ Tout remettre aux valeurs suggérées ({edited.length})</button>
          )}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:12 }}>
          {BST_STATS.map(([k, lbl, color]) => {
            const diff = Number(m[k]) !== sug[k];
            return (
              <label key={k} className="col gap-1">
                <span className="overline" style={{ color }}>{lbl}</span>
                <BstField numeric value={m[k] == null ? sug[k] : m[k]} onCommit={(v) => patch({ [k]: v })}
                  style={diff ? { border:'1px solid var(--gold-deep)' } : null} />
                <span className="row faint" style={{ fontSize:10.5, justifyContent:'space-between', minHeight:18 }}>
                  <span>suggéré {bstNum(sug[k])}</span>
                  {diff && <button className="btn btn-sm btn-ghost" onClick={(e) => { e.preventDefault(); patch({ [k]: sug[k] }); }}
                    title="Revenir à la valeur suggérée" style={{ padding:'0 6px', fontSize:10.5 }}>↺</button>}
                </span>
              </label>
            );
          })}
          <label className="col gap-1">
            <span className="overline">XP donnée (à partager)</span>
            <BstField numeric value={m.xp == null ? sug.xp : m.xp} onCommit={(v) => patch({ xp: v })}
              style={Number(m.xp) !== sug.xp ? { border:'1px solid var(--gold-deep)' } : null} />
            <span className="row faint" style={{ fontSize:10.5, justifyContent:'space-between', minHeight:18 }}>
              <span>suggéré {bstNum(sug.xp)}</span>
              {Number(m.xp) !== sug.xp && <button className="btn btn-sm btn-ghost" onClick={(e) => { e.preventDefault(); patch({ xp: sug.xp }); }}
                style={{ padding:'0 6px', fontSize:10.5 }}>↺</button>}
            </span>
          </label>
        </div>
        <span className="faint" style={{ fontSize:11 }}>
          Les valeurs suivent le niveau, le rang, l'archétype et le curseur tant que tu n'y touches pas.
          Un champ retouché (bord doré) garde ta valeur.
        </span>
      </div>

      <BstAttacks m={m} patch={patch} />

      {/* Notes */}
      <label className="col gap-1">
        <span className="overline">Notes</span>
        <BstField multiline value={m.note || ''} onCommit={(v) => patch({ note: v })} rows={4}
          placeholder="Comportement, effets, idées de mise en scène…" style={{ resize:'vertical', fontFamily:'inherit', lineHeight:1.5 }} />
      </label>

      {/* Pose en combat */}
      <div className="panel row gap-3 wrap" style={{ padding:'12px 16px' }}>
        <span className="overline">Poser en combat</span>
        <span className="row gap-1">
          <button className="btn btn-sm btn-ghost" onClick={() => setCount(c => Math.max(1, c - 1))} disabled={count <= 1}>−</button>
          <span className="mono" style={{ minWidth:34, textAlign:'center', color:'var(--gold-pale)' }}>×{count}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setCount(c => Math.min(20, c + 1))} disabled={count >= 20}>+</button>
        </span>
        <button className="btn btn-sm btn-gold" onClick={place}>⚔ Poser dans la vue MJ</button>
        {go && <button className="btn btn-sm btn-ghost" onClick={() => go('mj')}>Ouvrir la vue MJ →</button>}
        <span className="faint" style={{ fontSize:11, flexBasis:'100%' }}>
          Chaque copie est indépendante de cette fiche. Attaque posée dans la vue MJ : {bstNum(npcToEnemy(m, 0, 1).atk)} (le coup normal de l'attaque de base).
        </span>
      </div>
    </div>
  );
}

function BestiairePage({ go }) {
  const toast = useToast();
  const { monsters, denied, addMonster, patchMonster, removeMonster } = useBestiary();
  const [sel, setSel] = useState(() => localStorage.getItem('runeterra_bestiaire_sel') || null);
  const [q, setQ] = useState('');
  const select = (id) => { setSel(id); if (id) localStorage.setItem('runeterra_bestiaire_sel', id); };

  if (denied) {
    return (
      <div style={{ padding:32, maxWidth:620, margin:'40px auto' }}>
        <div className="panel" style={{ padding:24 }}>
          <h2 style={{ marginBottom:10 }}>Bestiaire inaccessible</h2>
          <p className="dim" style={{ fontSize:13, lineHeight:1.6 }}>
            La base a refusé la lecture. Le bestiaire est réservé au rôle MJ, et la règle
            <span className="mono"> /bestiary</span> doit être publiée (<span className="mono">firebase deploy --only database</span>).
          </p>
        </div>
      </div>
    );
  }
  if (monsters == null) return <div className="dim" style={{ padding:32 }}>Chargement du bestiaire…</div>;

  const rankOrder = {}; NPC_RANKS.forEach((r, i) => { rankOrder[r.id] = i; });
  const list = Object.values(monsters).filter(m => m && m.id);
  const needle = q.trim().toLowerCase();
  const shown = list
    .filter(m => !needle || (m.name || '').toLowerCase().includes(needle))
    .sort((a, b) => (rankOrder[npcParams(b).rank] - rankOrder[npcParams(a).rank])
      || (npcParams(b).level - npcParams(a).level) || String(a.name).localeCompare(String(b.name), 'fr'));
  const cur = (sel && monsters[sel]) || null;

  const create = async () => {
    const last = list.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
    const m = await addMonster(npcNewMonster({ level: last ? npcParams(last).level : 2, rank: 'standard', archetype: 'bruiser' }));
    select(m.id);
  };
  const duplicate = async () => {
    const copy = Object.assign({}, cur, { name: (cur.name || 'Monstre') + ' (variante)' });
    delete copy.id; delete copy.updatedAt;
    const m = await addMonster(copy);
    select(m.id);
    toast(`Variante de <b>${cur.name}</b> créée`, 'gold');
  };
  const remove = () => {
    if (!confirm(`Supprimer « ${cur.name} » du bestiaire ?\n\nLes copies déjà posées en combat ne sont pas touchées.`)) return;
    removeMonster(cur.id);
    select(null);
  };

  return (
    <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', height:'100%', minHeight:0 }}>
      <aside style={{ borderRight:'1px solid var(--line)', background:'var(--bg-panel)', display:'flex', flexDirection:'column', minHeight:0 }}>
        <div style={{ padding:'16px 16px 12px' }}>
          <div className="overline">Maître du jeu</div>
          <div className="row" style={{ justifyContent:'space-between', marginTop:4 }}>
            <h3 style={{ fontSize:17 }}>Bestiaire</h3>
            <span className="mono faint" style={{ fontSize:11 }}>{list.length} fiche{list.length > 1 ? 's' : ''}</span>
          </div>
          <div className="col gap-2" style={{ marginTop:10 }}>
            <button className="btn btn-sm btn-gold" onClick={create}>+ Nouvelle fiche</button>
            {list.length > 5 && <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher…" style={BST_FLD} />}
          </div>
        </div>
        <hr className="gold-rule" />
        <div className="col gap-1" style={{ padding:10, overflowY:'auto', flex:1, minHeight:0 }}>
          {shown.length === 0 && <div className="faint" style={{ fontSize:12, padding:6 }}>{list.length ? 'Aucune fiche ne correspond.' : 'Aucune fiche pour l\'instant.'}</div>}
          {shown.map(m => <BstMonsterRow key={m.id} m={m} active={cur && cur.id === m.id} onClick={() => select(m.id)} />)}
        </div>
        <div style={{ padding:10, borderTop:'1px solid var(--line)' }}><BstExportImport /></div>
      </aside>
      <main style={{ minHeight:0, overflow:'auto' }}>
        {cur
          ? <BstEditor key={cur.id} m={cur} patch={(pt) => patchMonster(cur.id, pt)} onDuplicate={duplicate} onRemove={remove} go={go} />
          : <div className="dim" style={{ padding:32, maxWidth:560, lineHeight:1.6 }}>
              {list.length ? 'Choisis une fiche à gauche, ou crée-en une nouvelle.' :
                'Le bestiaire est vide. Crée une première fiche : choisis un niveau, un rang et un archétype, les statistiques attendues se calculent seules, puis ajuste-les.'}
            </div>}
      </main>
    </div>
  );
}

Object.assign(window, { BestiairePage });
