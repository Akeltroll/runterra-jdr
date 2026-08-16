> **ARCHIVE — handoff de design fourni par le MJ (2026-08-16), intégré dans `pages-runes.jsx`
> + `runeterra.css` (commit `37f7938`).** Document conservé tel quel comme référence visuelle.
>
> ⚠️ **Ce handoff contient des données de DÉMO à ne pas reprendre** (le prototype n'avait pas accès
> à `RUNES`). Ce qui a été corrigé vers le réel à l'intégration :
> - **Familles** : Corps / Destruction / Sorcellerie / Vitalité / Intellect (+ leurs couleurs) →
>   **Conquérant / Domination / Sorcellerie / Volonté / Inspiration**, avec les `fam.color` de `RUNES`.
> - **Coût des paliers** : le doc dit « fondamentale 3 » ; la règle réelle est **2**
>   (`RUNE_COST = {mineure:1, avancee:2, fondamentale:2}`). La légende et le tooltip lisent
>   désormais `RUNE_COST`, donc plus aucun coût n'est écrit en dur.
> - **Géométrie** : obtenue en passant des options à `runeRadialLayout` — **`game-logic.js` n'a pas
>   été modifié**, contrairement à ce que le doc laisse supposer.
> - Les libellés de nœuds (`showLabels`) sont **désactivés**, comme dans le prototype par défaut :
>   l'info passe par le tooltip.

# Handoff : Arbre de runes — refonte graphique (constellation radiale)

## Overview
Refonte **purement graphique** de la page « Arbre de runes » des *Chroniques de Runeterra*
(roue radiale à 5 familles, sélection en chaîne payée en points).
La structure de données, les règles de sélection et le contenu (`RUNES`) sont **inchangés** :
seule la couche de rendu évolue (fond, relief des nœuds, aura extérieure adaptative, libellés).

## About the Design Files
Les fichiers de `reference/` sont des **références de design en HTML**, pas du code de production
à copier tel quel :

- `reference/Arbre de runes.dc.html` — le prototype complet (markup + logique de rendu).
  Il embarque un jeu de données de démo (noms de runes = **placeholders**) parce que `RUNES`
  n'était pas fourni. **Ne pas reprendre ces données.**
- `reference/original-pages-runes.jsx` — la page React existante à faire évoluer.
- `reference/original-runeterra.css` — le design system existant (tokens + classes `.rune-*`).

La tâche : **reproduire le rendu du prototype dans l'app React existante**, en gardant
`RUNES`, `buildRuneIndex`, `runeRadialLayout`, `runeBudget`, `runeSpent`, `canSelectRune`,
`canDeselectRune`, `useCharState` et la persistance `state.runes` telles quelles.
Le styling doit rester dans `runeterra.css` (classes `.rune-*`), pas en styles inline :
le prototype est inline uniquement à cause de son environnement d'auteur.

## Fidelity
**Hi-fi.** Couleurs, géométrie, opacités, durées d'animation sont définitives et données ci-dessous.
À reproduire au pixel près, en réutilisant les tokens existants de `runeterra.css`.

## Screen : Arbre de runes (`RuneTreePage` → `RuneBody`)

### Layout général (de haut en bas)
1. **En-tête** — colonne gauche : surtitre mono `CHRONIQUES DE RUNETERRA` (10px, `letter-spacing:.22em`,
   `--ink-faint`) / titre `Cinzel 700 27px`, `letter-spacing:.03em`, `--gold-pale` / sous-titre 12px `--ink-faint`.
   Colonne droite : stepper MJ (pilule `border:1px solid --line`, fond `--bg-inset`, deux boutons ronds 22px)
   + bouton `Réinitialiser` (`.btn .btn-sm .btn-ghost`).
2. **Rangée de puces de familles** — 5 pilules centrées, `gap:8px` : disque 22px (lettre `Cinzel 700 12px`
   en couleur de famille, fond `color/12%`, bordure `color/45%`), nom 11.5px, total de points en mono 11px.
   Famille investie : bordure `color/55%`, fond `color/10%`, texte `--ink` — sinon bordure `color/20%`,
   fond `--bg-inset`, texte `--ink-faint`. `transition:all .2s ease`.
3. **Scène de constellation** — carré, `width:100%`, `max-width:min(940px, max(620px, 88vh))`,
   `aspect-ratio:1`, `container-type:inline-size`, `position:relative`.
   Empilement (du fond vers l'avant) : `ringGlow` → `aura` → `shimmer` → `<svg viewBox="0 0 1200 1200">` → calque HTML (textes, AD/AP).
4. **Légende des paliers** — 3 items mono 10.5px `letter-spacing:.14em` uppercase `--ink-faint`,
   chacun précédé d'un mini-SVG (losange / carré arrondi / hexagone), contour `--gold-deep` 1.6px.
5. **Rappels** (`RuneReminders`, inchangé fonctionnellement) — filet `--line`, surtitre mono, liste avec
   puce ronde 6px en couleur de famille, texte 12.5px `--ink-dim`, nom en `--gold-pale` 600.
6. **Tooltip** — `position:fixed`, 272px, `background:linear-gradient(180deg,#15131B,#0B0A10)`,
   `border:1px solid <famille>/50%`, `radius 9px`, `padding:12px 14px`,
   `box-shadow:0 18px 50px rgba(0,0,0,.75)`. Contenu : ligne mono `Voie · Palier` (9px, `.16em`),
   nom `Cinzel 700 15px --gold-pale`, description 12.5px `--ink-dim`, bloc « Bonus thématique »
   (filet pointillé `famille/45%`), coût `Coût N pts` en mono 10.5px. Position `x+16 / y+14`, clampée au viewport.

### Géométrie de la roue (viewBox 1200×1200, centre 600,600)
| Élément | Valeur |
|---|---|
| Angles des familles | Corps −90°, Destruction −18°, Sorcellerie 54°, Vitalité 126°, Intellect 198° |
| Rayon des cœurs | 165 |
| Décalage des 3 voies | −26°, 0°, +26° autour de l'angle de famille |
| Rayons des 3 paliers | 300 (mineure), 415 (avancée), 520 (fondamentale) |
| Secteur teinté | camembert 72° (±36°), rayon 578 |
| Libellé de famille | rayon 572, centré |
| Anneau gravé | cercles r=574 (`--gold` 11%) et r=596 (5%) + 72 graduations tous les 5° (longueur 9, une majeure sur 6 : longueur 20, `--gold` 30%, 1.6px) |
| Lignes de ley | 5 segments à `angle famille +36°`, de r=120 à r=596, `--gold` 9%, 1px |
| Anneaux de profondeur | r=300 / 415 / 520 (`--gold` 5 / 5.5 / 7%) + r=165 pointillé `2 10` (`--gold` 22%) |
| Hub central | disque r=112 `radial-gradient(#1B1610 → #09090E)`, contour `--gold` 35% 1.5px + cercle r=96 pointillé `1 7` (16%) |

### Nœuds (par palier)
- **Mineure** — losange, demi-diagonale 25. **Avancée** — carré 50×50, `rx=7`. **Fondamentale** — hexagone R=37.
- Chaque nœud est composé de 5 couches concentriques :
  1. **Platine** : cercle `r = base + 13`, fond `rgba(4,4,8,.55)` (sélectionné : `famille/7%`),
     contour pointillé `1 6` (`famille` 8 % verrouillé / 17 % disponible / 32 % sélectionné, trait plein si sélectionné).
  2. **Gemme** : la forme du palier.
     - verrouillé → `fill:url(#dimGem)` (`radial 34%/28%`, `#1D1B2C → #0A0912`), contour `famille/26%` 1.2px, `opacity .7`
     - disponible → même fond, contour `famille/72%` 1.8px, filtre `rGlowSoft` (blur 3)
     - sélectionné → `fill:url(#gem-<famille>)` (`radial 34%/26%` : `#FFF 55%` → `famille 90%` à 28 % → `famille 22%`), contour `famille` 2.6px, filtre `rGlow` (blur 7, doublé)
  3. **Contour intérieur** : même forme à 58 % d'échelle, `stroke famille` 18 % (55 % si sélectionné), 1px.
  4. **Reflet spéculaire** : ellipse blanche `rx = base*.34`, `ry = base*.15`, centrée en
     `(x − base*.26, y − base*.34)`, `rotate(−38°)`, opacité 6 % / 14 % / 42 % selon l'état.
  5. **Marque** : sélectionné → disque `#FFF3DC` r=4.5 (7 pour une fondamentale) ;
     disponible → pastille `famille/85%` r=2.6 en animation `runeBreath 2.4s ease-in-out infinite` (opacité .45↔1).
- **Cœurs de famille** : cercle r=40 fond `#0B0A10` contour `famille/28%` 1px + cercle r=31 fond `#100D14`
  contour `famille` 2.5px filtre `rGlowSoft`. Lettre en `Cinzel 700`, `clamp(20px, 2.4cqw, 30px)`.

### Faisceaux
- Trait de base cœur → nœud 1 → 2 → 3 : `famille/13%` 1.4px ; **allumé** (nœud cible sélectionné) : `famille/55%` 2px.
- Surcouche allumée : même segment en `famille` 4.5px, `stroke-linecap:round`, filtre `rGlow`.
- Flux : même segment en `#FFF6E2` 1.6px, `stroke-dasharray:5 35`,
  `animation: runeFlow 1.6s linear infinite` (`@keyframes runeFlow { to { stroke-dashoffset:-40 } }`).

### Aura extérieure adaptative (le point clé de la refonte)
Trois `<div>` frères, `position:absolute; inset:-18%; border-radius:50%; pointer-events:none`,
tous masqués par le **même masque annulaire** (l'effet ne vit qu'en dehors de la roue) :

```css
mask-image: radial-gradient(circle at 50% 50%,
  rgba(0,0,0,0) 30%, rgba(0,0,0,.35) 40%, rgba(0,0,0,.9) 50%,
  rgba(0,0,0,.55) 66%, rgba(0,0,0,0) 84%);
```

1. **`ringGlow`** — éclaire *tout* l'anneau avec la **teinte moyenne pondérée** des familles investies
   (fallback `--gold` si 0 point) :
   `radial-gradient(circle at 50% 50%, transparent 38%, mix/(0.05 + min(total,20)*0.011) 54%, mix/0.02 70%, transparent 84%)`,
   `filter: blur(30px)`, `animation: auraBreath 11s ease-in-out infinite`, `transition: background .6s ease`.
2. **`aura`** — dégradé **conique ancré sur les angles des familles** : chaque stop est placé à
   `angle_famille + 90°` (repère CSS), la boucle est refermée en répétant le premier stop à `+360°`.
   Alpha de chaque stop = **part relative + investissement absolu** :
   `alpha = min(0.72, 0.055 + share*0.16 + min(pts, 11)/11 * 0.46)`
   où `share = pts_famille / total`. C'est ce terme absolu qui fait « péter » la lumière quand on
   accumule des runes d'une même couleur.
   `filter: blur(84px) saturate(1.15 + min(total,20)*0.045) brightness(1 + min(total,20)*0.03)` ;
   `opacity: min(1, 0.4 + total*0.055)` ; `animation: auraBreath 7s ease-in-out infinite` ;
   `transition: opacity .6s ease`.
3. **`shimmer`** — voile fixe de stries `rgba(255,246,226,.05)` / `rgba(198,168,255,.05)`,
   `filter: blur(46px)`, `animation: auraSpin 64s linear infinite`.

À l'intérieur de la roue, chaque famille a aussi un **halo diffus** : cercle r=90 sur son cœur,
`fill = famille / min(.6, .11 + min(pts,11)/11 * .5)`, groupe filtré par `blur(42px)`.

```css
@keyframes auraSpin   { to { transform: rotate(360deg); } }
@keyframes auraBreath { 0%,100% { opacity:.72; transform:scale(1); } 50% { opacity:1; transform:scale(1.035); } }
@keyframes runeBreath { 0%,100% { opacity:.45; } 50% { opacity:1; } }
```

### Fond de page
```css
background-color: #07070C;
background-image:
  radial-gradient(90% 70% at 50% 46%, rgba(56,36,84,.30) 0%, rgba(20,14,30,.12) 42%, rgba(7,7,12,0) 72%),
  radial-gradient(120% 90% at 50% -12%, rgba(200,155,60,.07) 0%, rgba(12,11,17,0) 55%),
  url("<trame hexagonale du design system, stroke-opacity .05>"),
  linear-gradient(180deg,#0B0A11,#07070C);
```
Plus une **poussière d'étoiles** de 150 disques dans le SVG, générée par un PRNG à graine fixe
(`seed = 20260816`, LCG `seed*1103515245+12345 & 0x7fffffff`) pour rester stable entre les rendus :
angle aléatoire, rayon `130 + pow(rnd, 0.55) * 470`, r `0.8–2.7`,
couleur `rgba(236,226,205,α)` ou `rgba(200,170,255,α)` (28 % des cas), `α = 0.05–0.37`.

## Interactions & Behavior
Identiques à l'existant — **ne rien changer à la logique** :
- Clic sur un nœud → `canSelectRune` / `canDeselectRune`, échec → `toast(reason,'gold')`.
- Chaîne stricte par voie : un nœud n'est disponible que si le précédent de sa voie est gravé
  et que le coût tient dans le budget restant (`mineure 1`, `avancée 2`, `fondamentale 3`).
- États visuels : `locked` / `available` / `selected` (mêmes noms de classes qu'aujourd'hui).
- Survol nœud/cœur → tooltip (`onMouseEnter` avec `clientX/clientY`, `onMouseLeave` → null).
- Nœuds `mods.adp` gravés → pastilles `AD`/`AP` positionnées en `%` (`left: x/1200*100`, `top: (y+42)/1200*100`),
  `transform:translate(-50%,0)`, actif = fond couleur de famille, texte `#12100A`.
- Stepper MJ → `setField('runeBonus', …)`, budget = `runeBudget(level) + bonus`.
- `Réinitialiser` → `resetRunes()`.

## ⚠ Piège rencontré : les `<text>` SVG
Dans l'environnement du prototype, les `<text>` SVG ne se mettaient pas en page (bbox 0×0).
Les libellés sont donc rendus par un **calque HTML absolu au-dessus du SVG**, positionné en `%`
(`left: x/1200*100 + '%'`), avec des tailles en `clamp()` pour rester lisibles :
- lettre de cœur `clamp(20px, 2.4cqw, 30px)` — nom de famille `clamp(11px, 1.25cqw, 16px)`, `letter-spacing:.24em`,
  couleur `famille/72%` (95 % si investie) — `POINTS` `clamp(10px,1.15cqw,13px)` — total `Cinzel 700 clamp(34px,4cqw,52px)` —
  `/ budget` `clamp(12px,1.4cqw,17px)` en `--gold` — nom de rune `clamp(11px,1.3cqw,15px)`.
En React classique, des `<text>` SVG fonctionnent normalement : garde-les si tu préfères, mais
**vérifie un `getBBox()` non nul** et conserve les tailles ci-dessus (en `px` responsives).

## State Management
Aucun nouvel état persistant. Le prototype ajoute seulement de l'état de rendu local :
`hover` (nœud/famille + position curseur). Tout le reste (`runes.selected`, `runes.choices`,
`runeBonus`, `level`) reste dans `useCharState`, persisté en temps réel comme aujourd'hui.

## Design Tokens
Tokens existants réutilisés : `--bg-abyss #07070C`, `--bg-deep #0A0A0F`, `--bg-panel #12121C`,
`--bg-panel-2 #171723`, `--bg-inset #0D0D15`, `--gold #C89B3C`, `--gold-bright #E4C56B`,
`--gold-pale #F0E6D3`, `--gold-deep #8A6A22`, `--ink #EDE7D8`, `--ink-dim #A89F8C`,
`--ink-faint #6E685A`, `--line #26262F`, `--line-strong #353542`,
polices `Cinzel` / `Hanken Grotesk` / `Spline Sans Mono`.

Couleurs de familles (à mapper sur les `fam.color` réels de `RUNES`) :
`Corps #E4C56B`, `Destruction #E85A52`, `Sorcellerie #A97BEE`, `Vitalité #3FD08A`, `Intellect #5FB0EE`.

Nouvelles valeurs introduites : `#1D1B2C → #0A0912` (gemme éteinte), `#1B1610 → #09090E` (hub),
`#FFF3DC` (marque de gravure), `#FFF6E2` (flux), `rgba(56,36,84,.30)` (halo arcanique du fond),
blurs `3 / 7 / 30 / 42 / 46 / 84 px`, durées `1.6s / 2.4s / 7s / 11s / 64s`.

## Assets
Aucun binaire. Le hook `node.img` du composant existant est conservé : si `RUNES` fournit une image,
elle remplace la forme géométrique (78 / 62 / 54 px selon le palier) — dans ce cas, garder la platine,
le halo et la marque de gravure autour de l'image.

## Files
- `reference/Arbre de runes.dc.html` — prototype hi-fi de référence (données de démo).
- `reference/original-pages-runes.jsx` — page React à faire évoluer.
- `reference/original-runeterra.css` — design system cible pour les nouvelles classes `.rune-*`.
