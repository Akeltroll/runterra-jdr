# Shell, auth, runes, récaps, hub, tests et dossiers

Détail de la « Carte des fichiers », déplacé depuis `CLAUDE.md` le 2026-09-11 (limite de taille),
texte inchangé. Les renvois « voir Décisions » / « Infos MJ » visent les sections de `CLAUDE.md` ;
« État actuel AAAA-MM-JJ » vise `docs/journal/AAAA-MM-JJ.md`.

## `index.html` — shell et navigation

- `index.html` — point d'entrée (scripts + shell `App` : identité, gating auth, routing).
  Barre de nav avec champ `group` sur `PAGES` : `main` (barre), `more` (menu déroulant
  « ⋯ Plus » : Journal + Progression, staff), `footer` (lien discret bas de page :
  Design System, staff). Récap placé en avant-dernier (Admin reste dernier).
  L'onglet `id:'competences'` a pour **libellé « Combat »** (id inchangé pour le routage).
  **`defaultRoute → 'lobby'` pour tous les rôles** : tout le monde atterrit sur le Hub d'accueil
  (`id:'lobby'` → `<HubPage/>`), joueurs inclus (`lobby` ajouté à `PAGE_ACCESS.joueur`).

## `auth.js` / `firebase-config.js`

- `auth.js` — logique d'auth pure (UMD) : `usernameToEmail`, `ROLES`, `isStaff`,
  `isAdmin`, `isPending`, `pagesForRole`, `canSeePage`, `defaultRoute`.
- `firebase-config.js` — init Firebase + auth Email/Password + helpers `window.RTDB`
  (`ready`, `currentUser`, `onAuth`, `signIn`, `signOut`, `subscribePath`,
  `updatePath`, `setPath`, `getSnapshot`).

## `recaps.js` / `pages-recap.jsx` / `pages-runes.jsx`

- `recaps.js` — données des **récaps de séance** : `RECAPS = [{id,date,titre,resume,pages:[...]}]`
  (la plus récente en premier ; images dans `recaps/seance-XX/`, commitées/statiques).
- `pages-recap.jsx` — onglet **Récap** (`RecapPage`) : sélecteur de séance + résumé texte +
  BD feuilletable. `useMediaQuery` (double page ≥820px, page simple en dessous), `RecapBook`
  (livre, flip CSS 3D fait-main piloté en style inline 2 phases start→run via rAF, page A4
  portrait via `--pw`, `paginate`), `RecapLightbox` (lecture plein écran zoomable). Visible des
  3 rôles, **lecture seule, zéro Firebase, zéro règle RTDB**. Ajouter une séance = déposer les
  `.webp` dans `recaps/seance-XX/` + une entrée `RECAPS`.
- `pages-runes.jsx` — onglet **Runes** (`RuneTreePage`) : **constellation radiale sertie**
  (refonte graphique hi-fi 2026-08-16 d'après un handoff du MJ, spec archivée
  `docs/superpowers/specs/2026-08-16-arbre-runes-refonte-graphique-design.md` ; 1re version
  `…/2026-06-30-arbre-runes-visuel*`). Les 5 familles rayonnent d'un cœur central, chaque voie =
  chaîne de 3 nœuds centre→bord (losange / carré / hexagone selon le palier ; **hook `node.img`**
  pour des assets futurs). Composants : `RuneConstellation` / `RuneNodeShape` / `RuneCore` /
  `RuneTooltip` / `RuneLegend` / `RuneReminders` / `RuneDefs`.
  ⚠️ **Géométrie : ne PAS modifier `game-logic.js`** — `runeRadialLayout` est **déjà paramétrable**,
  le rendu actuel vient de `{size:1200, ring:165, radii:[300,415,520], pathSpreadDeg:26, startDeg:-90}`
  → familles à −90/−18/54/126/198°.
  Rendu : **aura extérieure adaptative** (3 calques masqués en anneau — dégradé conique ancré sur
  l'angle de chaque famille, alpha = part relative + investissement absolu ; teinte moyenne pondérée),
  nœuds en 5 couches (platine, gemme dégradée, contour intérieur, reflet, marque de gravure), faisceaux
  allumés + flux animé, décor (anneau gravé 72 graduations, lignes de ley, hub, poussière d'étoiles
  **déterministe** PRNG graine 20260816), puces de familles, HUD central points/budget, légende.
  Les **libellés sont un calque HTML au-dessus du SVG** (les `<text>` SVG ne se mettent pas en page ici).
  Styles dans `runeterra.css` (classes `.rune-*` + `--fam`) ; seuls les dégradés calculés sont inline.
  Sélection stricte (budget = `level + runeBonus`, ordre Mineure→Avancée→Fondamentale), persistée
  `state/runes` (`setRuneSelected`/`setRuneChoice`/`resetRunes`). Bonus plats via `sumRuneMods`+`mergeMods`
  → `computeEffective` (fiche/MJ/équip) ; seul l'**effet réactif** (renvoi de Peau épineuse) reste en
  panneau « Rappels ». Toggle AD/AP (clé `adp`) ; **`runeDisplayName`** résout « AD ou AP » sur le choix
  réel une fois la rune gravée. **La légende et le tooltip lisent `RUNE_COST`** (jamais de coût en dur).
  Condition de thématique = tooltip au survol du **cœur** de famille ; capstone (bonus thématique par
  voie) = tooltip de la rune **fondamentale**. **Stepper points bonus MJ**
  (staff only, `setField('runeBonus')`) pour tester/gérer la montée de niveau. Visible des 3 rôles,
  sélecteur de perso pour le staff. Logique pure dans `game-logic.js`.

## `pages-lobby.jsx` / `pages-ds.jsx` / `runeterra.css`

- `pages-lobby.jsx` — **Hub d'accueil** (`HubPage`, onglet « Accueil », **page d'atterrissage de tous les
  rôles** via `defaultRoute → 'lobby'`). Pièce maîtresse : **`CharCarousel`** = carrousel horizontal plat
  (slider) des 5 persos, positionné par `carouselTransforms(count, activeIndex)` (game-logic, pur : carte active
  centrée/agrandie/au-dessus, voisines de face atténuées, navigation ◄/► + clic). Cartes = portrait `PORTRAITS`,
  nom/classe/niveau + **barres PV/mana/bouclier `ResourceBar hideText`** (sans chiffres). **Données temps réel** :
  staff = `useAllCharStates()` (les 5) ; joueur = `useCharState(monId)` (sa carte ; les autres grisées, contrainte
  RTDB « sa fiche seule »). Max via `charBaseStats`. **Bio** (`char.bio`) sous la carte de face. Accès rapides :
  ▶ Reprendre (→ fiche/MJ), ⚔ Combat en cours (si `useSharedTurn`/`useMJEnemies` actifs), 📖 Dernier récap.
  **`MemorialSection`** = mémorial des persos morts (`MEMORIAL`, data.jsx ; Lunick en tête, récit dépliable).
  Conteneur `height:100% + overflow:auto` (scroll interne). Zéro Firebase en écriture, zéro nouvelle règle RTDB.
- `pages-ds.jsx` — page secondaire (mockup, données surtout statiques).
- `runeterra.css` — styles (variables CSS `--gold`, `--hp`, etc.).

## Tests et dossiers

- `test/auth.test.js` — tests unitaires des helpers d'auth (`node --test`).
- `test/game-logic.test.js` — tests unitaires (`node --test`).
- `test/smoke.mjs` — test de démarrage Playwright (charge l'app réelle, teste le
  temps réel Firebase). **Se connecte via un compte de test** (`SMOKE_USER`/`SMOKE_PASS`,
  défaut `smoke`) ; nécessite règles publiées + compte attribué à un perso.
- `docs/superpowers/specs/` et `docs/superpowers/plans/` — design et plan d'implémentation.
- `ATH/` — images : `Armes/` + `Items/` (icônes d'items `.webp`) + `Perso/*.webp` (portraits).
- `info-mj/` — **source de vérité du MJ** (règles détaillées) ; voir « Infos MJ » plus bas.
  **Gitignored** (privé : le dépôt est public) — ne jamais committer ; édité/lu en local uniquement.
- `idée/` — assets de travail lourds (modèle 3D abandonné) ; **gitignore** (avec `*.glb/obj/fbx`).
