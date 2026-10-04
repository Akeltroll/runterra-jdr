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
  `state/runes` (`setRuneSelected`/`setRuneChoice`/`resetRunes`).
  **Bonus par niveau (2026-10-03)** : un nœud porte `mods` (socle), `perLevel` (incrément par
  niveau) **et** `levelSteps` (progression par paliers, `[{from, mods}]`, dernier palier dont
  `from` ≤ niveau — ⚠️ il **remplace** le précédent, il ne s'empile pas), les trois cumulés par
  **`runeNodeMods(node, level)`**. ⚠️ **`sumRuneMods` prend un 4e paramètre
  `level`, à passer par les 5 appelants** (`pages-sheet`, `pages-mj`, `pages-equip`,
  `pages-competences` via `runeModsOf(state, level)`, `data-state`/`resetCombat`) — **même piège que
  `sumItemMods`** : en oublier un fait diverger les stats d'une seule page, sans rien signaler.
  Absent → niveau 1, **jamais 0**. ⚠️ **Depuis le 2026-10-05, le `name` d'une rune ne porte AUCUN chiffre** : il dit quelles stats,
  si elles sont fixes ou croissantes, et s'il y a un choix de domaine. Les chiffres vivent dans deux
  lignes **calculées** du tooltip — `.rt-level` (`runeLevelLine` : valeurs exactes au niveau du
  porteur, choix résolu) et `.rt-scale` (`runeScaleLine` : niveau 1 → niveau 18, ou « +N (fixe) »).
  Le `desc` ne porte que l'attitude générale, **sans chiffres**. ⚠️ `runeLevelLine` est rendue pour
  TOUTE rune chiffrée, **plate comprise** — ne pas rétablir l'ancien filtre `perLevel`/`levelSteps`,
  une rune plate n'afficherait plus rien.
  **Abréviations** : `RUNE_STAT_ABBR` (AD/AP, AR, RM, RCrit, DCrit, SB) — ⚠️ **propre à cette page**,
  `MOD_STATS` reste intact (fiche, objets, Admin). Le cadre `RuneAbbrLegend` sous la constellation
  les explique (⚠️ AD et AP en sont exclus, décision MJ) : **toute clé ajoutée à l'un doit l'être à
  l'autre**. **Titre = POIDS** (2026-10-05) : `title:[{t,w}]`, `w` ∈ `fort`/`moyen`/`faible`, rendu par la FORME de la
  pastille (`.rt-w-*`) : pleine / contourée / pointillée. ⚠️ Pas un dégradé typographique — la
  version graisse+taille a été jugée trop indistincte. ⚠️ `.rt-name` doit rester `display:flex`
  avec un `gap`, sinon les libellés se collent (« LéthalitéAD/AP »). Le comportement (fixe/croissant) n'est plus nommé — il se
  lit dans la ligne « Du niveau 1 au 18 ». ⚠️ `title` est la **source unique** : `runeDisplayName`
  le préfère, `name` n'en est que l'aplatissement (Rappels, nœuds sans stats). ⚠️ Une rune à
  domaines a tout à `moyen` (règle MJ) — d'où le marqueur `.rt-pick` « N au choix », sans lequel
  rien ne la distinguerait. La légende `RuneAbbrLegend` explique aussi les trois poids.
  ⚠️ `runeHasAdpChoice` lit `mods` ET `perLevel`. Motif et cibles : `docs/journal/2026-10-03.md`.
  **Domaines au choix (`pick`, 2026-10-04)** : `pick:{ count, options:[{key,label,short,mods,perLevel}] }`
  laisse le joueur retenir `count` options parmi `options` (Volonté : CC 1 parmi 2 résistances,
  Durabilité 2 parmi 3). Résolu **dans `runeNodeMods(node, level, choice)`** (3e paramètre) parce
  que les options rendent des stats RÉELLES, pas des clés `ADP_KEYS`.
  ⚠️ **Même champ que l'AD/AP** (`runes/choices/{nodeId}`), sérialisé « clé,clé » → **jamais `adp`
  et `pick` sur le même nœud**. ⚠️ **Choix absent = les `count` premières options**, jamais rien
  (idiome `adp` → `'ad'`). `runePickToggle` : un domaine déjà retenu ne se retire pas, un nouveau
  fait sortir **le plus ancien**. Helpers : `runePickOptions`/`runeHasPick`/`runePickCount`/
  `runePickKeys`/`runePickedOptions`/`runePickToggle`. Le sélecteur `.rune-adp` sert les deux cas,
  et `runeLevelLine` **nomme les domaines retenus** (le `name` ne dit que « 2 domaines au choix »).
  Détail : `docs/journal/2026-10-04.md` §2.
  **Groupes (2026-10-05)** : une option peut porter `group` — on ne retient jamais deux options du
  même groupe. C'est ce qui tient « 2 DOMAINES parmi 3 » quand un domaine a un sous-choix
  (Présage : offensif AD/AP, défensif AR/RM, soins — 5 options, 3 groupes).
  ⚠️ Dans `runePickToggle`, cliquer une option du **même** groupe remplace **sa sœur** (changer
  d'avis sur AD/AP ne doit pas coûter l'autre domaine) ; d'un **autre** groupe, c'est le choix le
  **plus ancien** qui sort.
  **Pente ACCÉLÉRÉE (`accel`, 2026-10-05)** : gain du niveau L = `perLevel + accel×(L−1)`, donc le
  total ajoute `accel·L(L−1)/2`. ⚠️ **Réservée aux stats dont le PRIX DÉCROÎT** (le mana est la
  seule du barème) — ailleurs elle compose dans le mauvais sens. ⚠️ Au niveau 1 elle n'ajoute rien.
  Bonus plats via `sumRuneMods`+`mergeMods`
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
