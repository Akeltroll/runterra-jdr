# Arbre de runes visuel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer la page Runes en arbre visuel (nœuds hexagonaux + liaisons SVG illuminées + tooltip au survol) sans toucher à la logique ni aux données.

**Architecture:** Réécriture de la **couche de présentation** dans `pages-runes.jsx` (`RuneNode`, `RuneFamilyPanel` réécrits ; `RuneLinks`, `RuneTooltip` ajoutés) + nouveau CSS dans `runeterra.css`. `RuneBody` garde sa logique (états/budget/handlers) et ne change que ce qu'il rend + un état local `hover` pour le tooltip. La grille de nœuds est une CSS grid 3 colonnes (voies) × 3 rangées (paliers) à pas fixe, ce qui permet un overlay SVG à coordonnées déterministes (viewBox `0 0 300 300`, colonnes x=50/150/250, rangées y=50/150/250) sans mesurer le DOM.

**Tech Stack:** React 18 + Babel standalone (zéro-build, `.jsx` via `<script type="text/babel">`), CSS pur (`clip-path`, `color-mix`, `filter: drop-shadow`), SVG inline.

## Global Constraints

- **Zéro-build** : pas de bundler. Chaque `.jsx` définit ses composants puis `Object.assign(window, {...})`. Référence nue entre scripts (résolue via `window`).
- **Aucune nouvelle règle RTDB, aucun changement de schéma, aucune modification de `game-logic.js`** (logique runes inchangée).
- **Cache-busting** : bumper le jeton `?v=` dans `index.html` (search-replace de la valeur courante) à chaque push de code.
- `color-mix(in srgb, var(--fam) X%, ...)` est déjà utilisé dans `runeterra.css` (ligne 438) → autorisé.
- Couleur de famille passée via la variable CSS `--fam` (déjà posée par `style={{ '--fam': family.color }}`).
- Orientation des paliers : **mineure en haut (rangée 0) → avancée (rangée 1) → fondamentale en bas (rangée 2)**. L'ordre de `path.nodes` est déjà mineure, avancée, fondamentale.
- Vérif : `node --test test/game-logic.test.js test/auth.test.js` (doivent rester verts), `npx esbuild pages-runes.jsx --loader:.jsx=jsx >/dev/null` (syntaxe).

---

### Task 1: CSS de l'arbre visuel

**Files:**
- Modify: `runeterra.css` (ajouts après le bloc rune existant, vers la ligne 451)

**Interfaces:**
- Produces (classes CSS consommées par les composants des tâches 2-3) : `.rune-tree`, `.rune-links`, `.rune-link`, `.rune-link.lit`, `.rune-node-grid`, `.rune-cell`, `.rune-hex` (+ `.tier-mineure|.tier-avancee|.tier-fondamentale`, `.locked|.available|.selected`), `.rune-hex-glyph`, `.rune-hex-name`, `.rune-tooltip` (+ `.rt-tier|.rt-name|.rt-desc|.rt-note|.rt-cap`).
- Réutilise les classes existantes inchangées : `.rune-adp`, `.rune-points`, `.rune-theme-cond`, `.rune-reminders`, `.rune-grid`, `.rune-family`.

- [ ] **Step 1: Ajouter les styles de l'arbre dans `runeterra.css`**

Ajouter ce bloc juste après la ligne `.rune-reminders li { ... }` (fin du bloc rune actuel) :

```css
/* --- Arbre de runes visuel (hexagones + liaisons SVG + tooltip) --- */
.rune-tree { position:relative; margin-top:6px; }
.rune-links { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:0; }
.rune-link { stroke:rgba(160,128,72,0.22); stroke-width:2; transition:stroke .3s ease, stroke-width .3s ease; }
.rune-link.lit { stroke:var(--fam); stroke-width:4; filter:drop-shadow(0 0 4px var(--fam)); }
.rune-node-grid { position:relative; z-index:1; display:grid;
  grid-template-columns:repeat(3,1fr); grid-template-rows:repeat(3,1fr);
  grid-auto-flow:column; }
.rune-cell { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; padding:8px 2px; }
.rune-hex { position:relative; display:grid; place-items:center; cursor:pointer; background:rgba(160,128,72,0.32);
  clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%); transition:filter .25s ease, background .25s ease; }
.rune-hex::before { content:''; position:absolute; inset:2px; background:#15110c;
  clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%); transition:background .25s ease; }
.rune-hex.tier-mineure { width:46px; height:46px; }
.rune-hex.tier-avancee { width:58px; height:58px; }
.rune-hex.tier-fondamentale { width:74px; height:74px; }
.rune-hex-glyph { position:relative; z-index:1; font-size:15px; color:rgba(200,170,110,0.45); pointer-events:none; }
.rune-hex.locked { opacity:.4; }
.rune-hex.available { background:var(--fam); animation:runePulse 2.2s ease-in-out infinite; }
.rune-hex.selected { background:var(--fam); filter:drop-shadow(0 0 8px var(--fam)); }
.rune-hex.selected::before { background:color-mix(in srgb, var(--fam) 34%, #15110c); }
.rune-hex.selected .rune-hex-glyph { color:#fff; }
@keyframes runePulse { 0%,100%{ filter:drop-shadow(0 0 1px var(--fam)); } 50%{ filter:drop-shadow(0 0 7px var(--fam)); } }
.rune-hex-name { font-size:11px; text-align:center; color:var(--ink-soft,#c9b896); max-width:96px; line-height:1.15; }
.rune-hex.tier-fondamentale + .rune-hex-name { color:var(--gold-pale); font-weight:600; }
/* Tooltip de détail au survol */
.rune-tooltip { position:fixed; z-index:300; width:260px; pointer-events:none;
  background:var(--bg-panel-2,#181410); border:1px solid var(--line-gold,rgba(160,128,72,0.5));
  border-radius:8px; padding:10px 12px; box-shadow:0 8px 30px rgba(0,0,0,0.6); color:var(--ink,#e9dcc4); }
.rune-tooltip .rt-tier { font-size:9px; text-transform:uppercase; letter-spacing:.06em; color:var(--ink-faint); }
.rune-tooltip .rt-name { font-size:14px; font-weight:700; color:var(--gold-pale); margin:1px 0 4px; }
.rune-tooltip .rt-desc { font-size:12px; color:var(--ink-soft); line-height:1.35; }
.rune-tooltip .rt-note { font-size:11px; color:var(--silver,#bcae8f); margin-top:5px; line-height:1.3; }
.rune-tooltip .rt-cap { margin-top:7px; padding-top:6px; border-top:1px dashed var(--fam); font-size:11px; color:var(--gold-pale); line-height:1.3; }
.rune-tooltip .rt-cap span { display:block; font-size:8px; text-transform:uppercase; letter-spacing:.05em; color:var(--fam); margin-bottom:1px; }
```

- [ ] **Step 2: Vérifier que le CSS ne casse rien (l'app charge encore)**

Run: `cd "D:/Perso/JDR/RPG Dashboard Mockups" && node --test test/game-logic.test.js test/auth.test.js 2>&1 | grep -iE 'tests [0-9]|fail [0-9]'`
Expected: `tests 135` (ou ≥), `fail 0` (le CSS n'affecte pas les tests, c'est un contrôle de non-régression).

- [ ] **Step 3: Commit**

```bash
cd "D:/Perso/JDR/RPG Dashboard Mockups"
git add runeterra.css
git commit -m "style(runes): CSS de l'arbre visuel (hexagones, liaisons SVG, tooltip)"
```

---

### Task 2: Composants de présentation (RuneTooltip, RuneLinks, RuneNode)

**Files:**
- Modify: `pages-runes.jsx` (remplacer `RuneNode`, ajouter `RuneLinks` et `RuneTooltip`)

**Interfaces:**
- Consumes : classes CSS de la Task 1 ; `RUNE_INDEX` (existant) ; données `RUNES` (familles → `paths` → `nodes{ id, tier, name, desc, mods?, note? }`, `path.capstone`).
- Produces :
  - `RuneNode({ node, state, choice, capstone, onClick, onChoice, onHover })` — hexagone + nom + glyphe ; `onHover(node, capstone, e)` sur entrée, `onHover(null)` sur sortie ; toggle AD/AP si `node.mods.adp != null` et `state==='selected'`.
  - `RuneLinks({ family, isSelected })` — `<svg>` des connecteurs verticaux ; `isSelected(id) -> bool`.
  - `RuneTooltip({ hover })` — `hover` = `{ node, capstone, x, y }` ou `null`.

- [ ] **Step 1: Remplacer le composant `RuneNode` et ajouter `RuneLinks` + `RuneTooltip`**

Dans `pages-runes.jsx`, remplacer **tout** le composant `RuneNode` (lignes 9-33 actuelles) par :

```jsx
/* Glyphe décoratif par palier. */
const RUNE_GLYPH = { mineure:'◆', avancee:'◇', fondamentale:'⬢' };
const RUNE_TIER_LABEL = { mineure:'Mineure', avancee:'Avancée', fondamentale:'Fondamentale' };

function RuneNode({ node, state, choice, capstone, onClick, onChoice, onHover }) {
  const isAdp = node.mods && node.mods.adp != null;
  return (
    <div className="rune-cell">
      <div className={'rune-hex tier-' + node.tier + ' ' + state}
        onClick={() => onClick(node)}
        onMouseEnter={(e) => onHover(node, capstone, e)}
        onMouseLeave={() => onHover(null)}>
        <span className="rune-hex-glyph">{RUNE_GLYPH[node.tier] || '◆'}</span>
      </div>
      <div className="rune-hex-name">{node.name}</div>
      {isAdp && state === 'selected' && (
        <div className="rune-adp" onClick={(e) => e.stopPropagation()}>
          {['ad', 'ap'].map(k => (
            <button key={k} className={(choice || 'ad') === k ? 'on' : ''}
              onClick={() => onChoice(node.id, k)}>{k.toUpperCase()}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* Connecteurs SVG verticaux d'une famille (mineure->avancée->fondamentale par voie).
   Coordonnées déterministes : 3 colonnes (x=50/150/250), 3 rangées (y=50/150/250).
   Une liaison est illuminée quand le palier SUPÉRIEUR (prérequis) est sélectionné. */
function RuneLinks({ family, isSelected }) {
  const colX = [50, 150, 250], rowY = [50, 150, 250];
  const lines = [];
  family.paths.forEach((p, c) => {
    for (let r = 0; r < p.nodes.length - 1; r++) {
      const lit = isSelected(p.nodes[r].id);
      lines.push(
        <line key={p.key + '-' + r} x1={colX[c]} y1={rowY[r]} x2={colX[c]} y2={rowY[r + 1]}
          className={'rune-link' + (lit ? ' lit' : '')} />
      );
    }
  });
  return (
    <svg className="rune-links" viewBox="0 0 300 300" preserveAspectRatio="none" aria-hidden="true">
      {lines}
    </svg>
  );
}

/* Popover de détail (survol d'un nœud). hover = { node, capstone, x, y } | null. */
function RuneTooltip({ hover }) {
  if (!hover) return null;
  const { node, capstone, x, y } = hover;
  return (
    <div className="rune-tooltip" style={{ '--fam': hover.fam,
      left: Math.min(x + 14, window.innerWidth - 272),
      top: Math.min(y + 12, window.innerHeight - 170) }}>
      <div className="rt-tier">{RUNE_TIER_LABEL[node.tier] || node.tier}</div>
      <div className="rt-name">{node.name}</div>
      <div className="rt-desc">{node.desc}</div>
      {node.note ? <div className="rt-note">⚠ {node.note}</div> : null}
      {capstone ? <div className="rt-cap"><span>Bonus thématique</span>{capstone}</div> : null}
    </div>
  );
}
```

(La couleur `--fam` du tooltip est passée par `RuneBody` via `hover.fam` ; voir Task 3.)

- [ ] **Step 2: Vérifier la syntaxe**

Run: `cd "D:/Perso/JDR/RPG Dashboard Mockups" && npx esbuild pages-runes.jsx --loader:.jsx=jsx >/dev/null && echo OK`
Expected: `OK` (pas d'erreur de parse). Note : `RuneFamilyPanel` référence encore l'ancienne API à ce stade — c'est corrigé en Task 3 ; la syntaxe seule doit passer.

- [ ] **Step 3: Commit**

```bash
cd "D:/Perso/JDR/RPG Dashboard Mockups"
git add pages-runes.jsx
git commit -m "feat(runes): composants hexagone/liaisons/tooltip (présentation)"
```

---

### Task 3: RuneFamilyPanel + câblage RuneBody (hover, selectedSet, tooltip)

**Files:**
- Modify: `pages-runes.jsx` (réécrire `RuneFamilyPanel`, adapter `RuneBody`)

**Interfaces:**
- Consumes : `RuneNode`/`RuneLinks`/`RuneTooltip` (Task 2) ; logique existante de `RuneBody` (`nodeState`, `onClick`, `setRuneChoice`, `selectedSet`, `choices`).
- Produces :
  - `RuneFamilyPanel({ family, nodeState, choices, selectedSet, onClick, onChoice, onHover })` — en-tête famille + `.rune-tree` (RuneLinks + grille de RuneNode) + bandeau thématique.
  - `RuneBody` rend en plus `<RuneTooltip hover={hover} />` et gère `hover` (état local).

- [ ] **Step 1: Réécrire `RuneFamilyPanel`**

Remplacer **tout** le composant `RuneFamilyPanel` actuel par :

```jsx
function RuneFamilyPanel({ family, nodeState, choices, selectedSet, onClick, onChoice, onHover }) {
  return (
    <div className="rune-family" style={{ '--fam': family.color }}>
      <h3 style={{ color: family.color }}>{family.name}</h3>
      <div className="rune-tree">
        <RuneLinks family={family} isSelected={(id) => !!selectedSet[id]} />
        <div className="rune-node-grid">
          {family.paths.map(p => p.nodes.map(n => (
            <RuneNode key={n.id} node={n} state={nodeState(n.id)} choice={choices[n.id]}
              capstone={n.tier === 'fondamentale' ? p.capstone : null}
              onClick={onClick} onChoice={onChoice}
              onHover={(node, capstone, e) => onHover(node, capstone, family.color, e)} />
          )))}
        </div>
      </div>
      <div className="rune-theme-cond">Condition de thématique : {family.theme}</div>
    </div>
  );
}
```

- [ ] **Step 2: Adapter `RuneBody` (état hover + props + rendu du tooltip)**

Dans `RuneBody`, juste après `const toast = useToast();`, ajouter l'état hover :

```jsx
  const [hover, setHover] = useState(null);
  const onHover = (node, capstone, fam, e) => {
    if (!node) { setHover(null); return; }
    setHover({ node, capstone, fam, x: e.clientX, y: e.clientY });
  };
```

Dans le `return` de `RuneBody`, remplacer le bloc `.rune-grid` actuel :

```jsx
      <div className="rune-grid">
        {RUNES.map(f => (
          <RuneFamilyPanel key={f.key} family={f} nodeState={nodeState}
            choices={choices} onClick={onClick} onChoice={setRuneChoice} />
        ))}
      </div>
      <RuneReminders selectedIds={selectedIds} />
```

par :

```jsx
      <div className="rune-grid">
        {RUNES.map(f => (
          <RuneFamilyPanel key={f.key} family={f} nodeState={nodeState}
            choices={choices} selectedSet={selectedSet} onClick={onClick}
            onChoice={setRuneChoice} onHover={onHover} />
        ))}
      </div>
      <RuneReminders selectedIds={selectedIds} />
      <RuneTooltip hover={hover} />
```

Et dans `RuneTooltip` (Task 2), la couleur vient de `hover.fam` — vérifier que `style={{ '--fam': hover.fam, ... }}` lit bien ce champ (déjà écrit ainsi).

- [ ] **Step 3: Vérifier la syntaxe + tests verts**

Run: `cd "D:/Perso/JDR/RPG Dashboard Mockups" && npx esbuild pages-runes.jsx --loader:.jsx=jsx >/dev/null && echo SYNTAX_OK && node --test test/game-logic.test.js test/auth.test.js 2>&1 | grep -iE 'tests [0-9]|fail [0-9]'`
Expected: `SYNTAX_OK`, puis `tests 135` (ou ≥) et `fail 0`.

- [ ] **Step 4: Commit**

```bash
cd "D:/Perso/JDR/RPG Dashboard Mockups"
git add pages-runes.jsx
git commit -m "feat(runes): RuneFamilyPanel en arbre + câblage tooltip/liaisons"
```

---

### Task 4: Cache-bump, vérification visuelle, push

**Files:**
- Modify: `index.html` (jeton `?v=`)
- Modify: `CLAUDE.md` (note de la page Runes — refonte visuelle)

**Interfaces:**
- Consumes : tout ce qui précède.

- [ ] **Step 1: Bumper le jeton de cache**

Repérer la valeur courante puis l'incrémenter (ex. `20260629-6` → `20260630-1`) :

```bash
cd "D:/Perso/JDR/RPG Dashboard Mockups"
grep -o '2026[0-9]*-[0-9]*' index.html | sort -u
# puis (adapter les valeurs à ce qui précède) :
sed -i 's/20260629-6/20260630-1/g' index.html
grep -c '20260630-1' index.html   # doit afficher 21
```

- [ ] **Step 2: Mettre à jour la note `pages-runes.jsx` dans `CLAUDE.md`**

Dans la description de `pages-runes.jsx`, ajouter en tête une phrase indiquant la refonte visuelle :

```
- `pages-runes.jsx` — onglet **Runes** (`RuneTreePage`) : **arbre visuel** (nœuds hexagonaux à
  taille croissante par palier, liaisons SVG verticales qui s'illuminent quand la voie progresse,
  tooltip de détail au survol — `RuneNode`/`RuneLinks`/`RuneTooltip`/`RuneFamilyPanel`). Refonte
  **purement graphique** : logique/données inchangées. Arbre des 5 familles (data `RUNES`), ...
```
(garder la suite du paragraphe existant inchangée).

- [ ] **Step 3: Vérification finale (tests + syntaxe)**

Run: `cd "D:/Perso/JDR/RPG Dashboard Mockups" && npx esbuild pages-runes.jsx --loader:.jsx=jsx >/dev/null && echo OK && node --test test/game-logic.test.js test/auth.test.js 2>&1 | grep -iE 'tests [0-9]|fail [0-9]'`
Expected: `OK`, `tests 135`+, `fail 0`.

- [ ] **Step 4: Commit + push de la branche**

```bash
cd "D:/Perso/JDR/RPG Dashboard Mockups"
git add index.html CLAUDE.md
git commit -m "chore(runes): cache-bump + doc (arbre visuel)"
git push -u origin feat/arbre-runes-visuel
```

- [ ] **Step 5: Vérification visuelle (manuelle, par l'utilisateur)**

Servir l'app (`python -m http.server 5050 --bind 127.0.0.1`) ou via GitHub Pages après merge, Ctrl+Shift+R, onglet **Runes** :
- nœuds hexagonaux, taille croissante mineure→fondamentale ;
- états : verrouillé (atténué) / disponible (contour famille + pulsation) / sélectionné (rempli + halo) ;
- liaisons SVG qui s'illuminent quand on prend le palier supérieur d'une voie ;
- tooltip au survol (palier, nom, desc, note, capstone pour la fondamentale) ;
- toggle AD/AP sur un nœud `adp` sélectionné ;
- condition de thématique en bas, Rappels en bas de page ;
- en-tête (Points X/budget, Réinitialiser, stepper MJ, sélecteur de perso) intact ;
- responsive (≤1100px : familles en 1 colonne).

## Notes d'exécution

- **Pas de logique pure nouvelle** → aucun nouveau test unitaire ; la garantie de non-régression
  est : tests existants verts + syntaxe esbuild + vérif visuelle.
- Les anciennes classes CSS devenues inutilisées (`.rune-paths`, `.rune-path`, `.pname`,
  `.rune-node*`, `.ntier/.nname/.ndesc`, `.rune-capstone-sub`) peuvent rester (inoffensives) ;
  nettoyage optionnel non requis.
```