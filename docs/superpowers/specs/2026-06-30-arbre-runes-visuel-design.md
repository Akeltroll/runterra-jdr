# Spec — Arbre de runes visuel (chantier B)

Date : 2026-06-30
Branche : `feat/arbre-runes-visuel`

## Contexte

La page Runes (`pages-runes.jsx`) rend aujourd'hui les 5 familles en **grille de cartes
texte** (`RuneFamilyPanel` → `RuneNode`). Le contenu (`RUNES`, data.jsx) et toute la logique
de sélection (budget, ordre des paliers, états, persistance `state/runes`, bonus de stats via
`sumRuneMods`→`computeEffective`) existent déjà et sont **testés** (`game-logic.js`).

Ce chantier est **purement graphique** : transformer l'affichage en **vrai arbre visuel**
(nœuds hexagonaux + liaisons SVG, façon LoL) **sans toucher à la logique ni aux données**.

## Objectif

Remplacer la présentation des familles/voies/nœuds par un rendu en arbre, tout en
conservant à l'identique :
- la sélection au clic et ses règles (`canSelectRune`/`canDeselectRune`/`runeBudget`/`runeSpent`) ;
- les états de nœud (`selected` / `available` / `locked`) calculés par `nodeState` ;
- la persistance (`setRuneSelected`/`setRuneChoice`/`resetRunes`/`setField('runeBonus')`) ;
- le toggle AD/AP, le capstone (bonus thématique), la condition de thématique, les Rappels ;
- l'en-tête (Points X/budget, Réinitialiser, stepper MJ +bonus, sélecteur de perso).

**Non-objectifs :** aucune nouvelle règle RTDB, aucun changement de schéma de données,
aucune modification de `game-logic.js` (logique runes), aucune grosse passe d'animation
(c'est le chantier D séparé).

## Structure des données (rappel, inchangée)

```
RUNES = [ { key, name, color, theme, paths: [
            { key, name, capstone, nodes: [
              { id, tier:'mineure'|'avancee'|'fondamentale', name, desc, mods?, kind?, note? }
            ] }  // 3 nœuds / voie
          ] } ]   // 3 voies / famille, 5 familles
```

## Design

### 1. Disposition générale (les 5 familles visibles à la fois)

- Les 5 panneaux de famille restent affichés simultanément (la sélection se fait par budget
  **partagé** entre familles → la vue d'ensemble aide à répartir les points). Grille responsive
  identique à l'actuelle (`.rune-grid`).
- Chaque famille = un panneau avec :
  - en-tête : nom de la famille dans **sa couleur** ;
  - corps : grille **3 colonnes (voies) × 3 rangées (paliers)** ;
  - bas : bandeau **condition de thématique** (`family.theme`).
- Orientation verticale des paliers : **mineure en haut → avancée (milieu) → fondamentale en
  bas**. Le gros nœud capstone (fondamentale) ferme la voie comme aboutissement.

### 2. Nœuds (hexagones)

- Forme **hexagonale** via CSS `clip-path: polygon(...)`.
- **Taille croissante par palier** pour matérialiser la progression :
  mineure (petit) → avancée (moyen) → fondamentale (grand).
- **Nom court** affiché sous le nœud (toujours visible). Pas d'icône (les runes n'ont pas d'art).
- À l'intérieur du nœud : un **glyphe de palier** discret (ex. ◆ mineure / ◇ avancée / ⬢
  fondamentale) ou l'initiale — purement décoratif.
- **États** (rendus par la classe CSS, pilotés par `nodeState(id)` inchangé) :
  - `locked` : atténué (gris, faible opacité), non cliquable visuellement (le clic reste géré
    par la logique qui renverra un toast si interdit) ;
  - `available` : contour en **couleur de famille** (`--fam`) + légère pulsation ;
  - `selected` : remplissage couleur de famille + **halo lumineux** (glow).

### 3. Liaisons (SVG)

- **Un overlay SVG par panneau de famille**, positionné en absolu derrière/sous les nœuds.
- Trace les **connecteurs verticaux** reliant, dans chaque voie (colonne), mineure→avancée et
  avancée→fondamentale. (Pas de liaison inter-voies : les voies sont indépendantes.)
- État visuel d'une liaison :
  - **éteinte** (trait fin, gris atténué) tant que le nœud **du bas** (palier inférieur) n'est
    pas sélectionné ;
  - **illuminée** (trait épais, couleur de famille + glow SVG via `filter`/`drop-shadow`) quand
    le palier inférieur est pris (la chaîne progresse).
- Implémentation : positions calculées à partir d'une grille fixe (colonnes/rangées connues),
  donc les coordonnées SVG sont déterministes (pas besoin de mesurer le DOM). Repli simple
  acceptable : connecteurs en `<line>`/`<path>` droits.

### 4. Tooltip au survol

- Remplace le `title` natif par un **popover stylé** affiché au survol (et/ou focus) d'un nœud.
- Contenu : palier + nom + **description complète** (`node.desc`) + sous-effet manuel (`node.note`
  si présent) + résumé des bonus (`node.mods`) + pour une fondamentale, le **capstone**
  (`path.capstone`, « Bonus thématique »).
- Positionnement near-cursor, borné à la fenêtre (même esprit que `AmountStepper`/`ItemActionMenu`).
- **Toggle AD/AP** : pour un nœud `mods.adp` **sélectionné**, les boutons AD/AP restent
  accessibles (dans le nœud ou dans le tooltip), câblés sur `setRuneChoice` (inchangé).

### 5. Conservé à l'identique

- En-tête complet (titre + sous-titre, Points `spent`/`budget`, bouton Réinitialiser, stepper
  MJ « +bonus » via `setField('runeBonus')`, sélecteur de perso staff).
- Panneau **Rappels** (`RuneReminders`) en bas (effets non calculés / sous-effets), éventuelle
  retouche cosmétique seulement.
- Toute la logique de `RuneBody` (calcul des états, handlers de clic, budget) **inchangée**.

### 6. Thématisation / CSS

- Tous les styles dans `runeterra.css`. Couleur de famille passée en variable CSS `--fam`
  (déjà le cas via `style={{ '--fam': family.color }}`).
- Animations **légères** uniquement : glow des nœuds sélectionnés, pulsation des disponibles,
  transitions d'état (couleur/opacité). Pas d'animation lourde (chantier D).

## Découpage en composants (dans `pages-runes.jsx`)

- `RuneBody` : **inchangé** côté logique ; ne change que ce qu'il rend (appelle les nouveaux
  composants de présentation).
- `RuneFamilyPanel` : réécrit pour rendre l'en-tête famille + la grille 3×3 + l'overlay SVG des
  liaisons + le bandeau thématique.
- `RuneNode` : réécrit en hexagone (forme/taille/état) + nom + glyphe ; déclenche le tooltip.
- `RuneLinks` (nouveau, présentation pure) : le `<svg>` des connecteurs d'une famille, calcule
  l'état (éteint/illuminé) de chaque liaison à partir de `selectedSet`.
- `RuneTooltip` (nouveau, présentation pure) : popover de détail d'un nœud survolé.
- `RuneReminders` : inchangé (retouche CSS éventuelle).

## Vérification

- Pas de logique pure nouvelle → **les tests rune existants restent verts** (`node --test`).
- `npx esbuild pages-runes.jsx --loader:.jsx=jsx` (syntaxe).
- Vérif visuelle en prod sur la branche (Ctrl+Shift+R, cache bumpé) : états des nœuds,
  illumination des liaisons, tooltip, toggle AD/AP, capstone, condition de thématique,
  réinitialisation, stepper MJ, sélecteur de perso, responsive.
- Bump du jeton de cache `?v=` à chaque push.

## Risques / points d'attention

- **Lisibilité** : les descriptions passent au survol → s'assurer que le tooltip est rapide,
  bien positionné et accessible (au clic aussi, utile sur tablette/tactile éventuel).
- **Densité** : 5 familles × 9 nœuds à l'écran ; veiller à ce que les hexagones + noms restent
  lisibles en responsive (réduction de taille / passage en colonnes sur petits écrans).
- **Coordonnées SVG** : garder une grille à pas fixe pour éviter de mesurer le DOM (zéro-build,
  pas de hook de mesure compliqué).
```