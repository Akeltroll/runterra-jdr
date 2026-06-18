# CLAUDE.md — Chroniques de Runeterra (outil de campagne JDR)

Mémoire de projet pour les prochaines sessions. Lis-moi en premier.

## Ce que c'est
Outil web pour gérer une campagne de JDR maison (univers Runeterra/LoL), utilisé
en vrai par le MJ (Akeltroll / nobletjeanbaptiste@gmail.com) et 5 joueurs.
Fiches de perso + combat + ressources, **partagées en temps réel**.
Source de vérité des règles : `Système de jeu JDR Runeterra.xlsx`.

## Stack & contraintes
- **Zéro build** : React 18 + Babel standalone via CDN, fichiers `.jsx` chargés
  par `<script type="text/babel">`. Pas de bundler, pas de Node requis pour
  *utiliser* le site (Node sert uniquement aux tests).
- **Temps réel** : Firebase Realtime Database (projet `runeterra-jdr`,
  région europe-west1). SDK **compat** via CDN (objet global `firebase`).
- **Auth** : comptes **identifiant + mot de passe** (Firebase Email/Password). Le
  pseudo est mappé en e-mail factice `pseudo@runeterra.local` (`usernameToEmail`
  dans `auth.js`). 3 rôles dans `/users/{uid}` : `joueur` (sa fiche seule), `mj`
  (toutes les fiches, lecture/écriture), `admin` (+ page Admin d'attribution).
  Mots de passe créés/réinitialisés dans la **console Firebase**.
- **Hébergement** : GitHub Pages, dépôt **public** `github.com/Akeltroll/runterra-jdr`
  (note : « runterra » sans le 2e e, volontairement laissé tel quel).
- Plateforme de dev : Windows, PowerShell + Git Bash.

## Pattern important (zéro-build)
Chaque fichier `.jsx`/`.js` définit ses fonctions/constantes localement PUIS fait
`Object.assign(window, { ... })`. Les autres scripts y accèdent par référence nue
(résolue via `window`). L'ordre de chargement dans `index.html` compte.
Ordre : firebase SDK → `firebase-config.js` → `game-logic.js` → `data.jsx` →
`data-state.jsx` → `components.jsx` → `pages-*.jsx` → shell inline.

## Carte des fichiers
- `index.html` — point d'entrée (scripts + shell `App` : identité, gating auth, routing).
- `game-logic.js` — **logique pure** (UMD : testable en Node + `window`). `clamp`,
  `clampGauge`, `DEFAULT_MODIFIERS`, `BUFF_STAT_MAP`, `computeEffective`,
  `applyHealMods`, `buildDefaultState`.
- `auth.js` — logique d'auth pure (UMD) : `usernameToEmail`, `ROLES`, `isStaff`,
  `isAdmin`, `isPending`, `pagesForRole`, `canSeePage`, `defaultRoute`.
- `firebase-config.js` — init Firebase + auth Email/Password + helpers `window.RTDB`
  (`ready`, `currentUser`, `onAuth`, `signIn`, `signOut`, `subscribePath`,
  `updatePath`, `setPath`, `getSnapshot`).
- `game-logic.js` — aussi : `makeItem`/`newItemId` (modèle d'item, avec `type`) ; `EQUIP_TYPES`
  (liste des emplacements) ; `planItemTransfer(srcItems,dstItems,itemId,n)` (logique pure de
  transfert/fusion → `{srcPatch,dstPatch}`, crédite la destination via `fillStacks`) ;
  `STACK_MAX` (=99) + `fillStacks(items,entry,qty)` (remplit les piles existantes de même genre
  jusqu'à 99 puis crée de nouvelles piles pour le surplus → patch `{itemId:item}`) +
  `planItemAdd(items,entry,qty)` (`{patch}`, ajout depuis le catalogue) ;
  `buildDefaultState` amorce `inventory` depuis `char.inv` et `coins` depuis `char.coins`.
- `data.jsx` — règles immuables : formules `computeStats`, `CHARACTERS` (avec `inv`
  par défaut + images `ATH/`), `BUFFS`, `WEAPONS`, `LEVELS`, `RUNE`, `JOURNAL`,
  `ITEM_CATALOG` (catalogue d'items pré-enregistrés pour l'ajout staff : `{cat,name,sub,ic,img,type}`).
  `mkChar` y attache les `modifiers` par défaut. (`ATTACK_MODES` **retiré** — voir Décisions.)
- `data-state.jsx` — hooks temps réel : `useCharState` (+ setters inventaire
  `setInvItem`/`removeInvItem` + équipement `setEquipment` + monnaie `setCoin`), `useAllCharStates`,
  `useSharedInventory` (inventaire commun), `useSharedCoins` (monnaie commune), `useAuthIdentity`
  (identité + `/users/{uid}`, auto-inscription), `useAllUsers`, `setUserAssignment`,
  `seedIfEmpty(role)` (réservé staff). Orchestrateurs de transfert RTDB `moveItem` (via
  `planItemTransfer`) / `moveCoins`. Constantes `CAMPAIGN = 'campaign/runeterra'`,
  `SHARED_INV`, `SHARED_COINS`.
- `components.jsx` — UI partagée : `Avatar`, `ResourceBar`, `BuffBadge`, toasts
  (`renderToastMsg` = rendu sûr, seul `<b>` autorisé), `LoginScreen`,
  `PendingScreen`, `SignOutButton`, `NumberStepper`, `ExportImportPanel`, `AttackModal`,
  `InvItemRow` + `InventoryPanel` (inventaire éditable réutilisable). L'éditeur
  `InvItemRow` permet de **téléverser une image** (`downscaleImageToDataURL`, max 128px,
  webp/png) stockée en **data URL** dans `item.img` — pas besoin d'un chemin `ATH/` ni
  d'accès au code (le champ chemin reste dispo en fallback). `InvItemRow` gère aussi
  **Catégorie + Emplacement** (`type`, affiché si `cat==='Équipement'`) et le prop `startEdit`
  (ouverture directe en mode édition, pour les modals). `InventoryPanel` a un prop optionnel
  `onAdd(cat)` : si fourni, « + Ajouter » délègue au parent (ouvre le picker) ; sinon ajout vierge.
  Grille dark-fantasy partagée `InventoryGrid` (Équipement + coffre commun ; badge quantité en **OR**) +
  popovers `ItemActionMenu` / `AmountStepper` ; **`ItemCatalogPicker`** (modal de sélection rapide
  depuis `ITEM_CATALOG` → `AmountStepper` → `onPick(entry,qty)` ; bouton « Objet personnalisé » = filet) ;
  constantes `INV_*`/`inv*` (styles/format/filtres/pièces).
- `pages-sheet.jsx` — fiche joueur (3 colonnes, 3 variantes visuelles a/b/c).
  Fatigue/Eau éditables, modificateurs, stats effectives, HealPanel, **inventaire perso
  temps réel** (migration unique via marqueur `invInit`).
- `pages-mj.jsx` — tableau de bord MJ temps réel (`mjLive(c, st)` fusionne règles+état).
  Le mini-sac des cartes lit l'inventaire **live** (`st.inventory`, items qty>0, images
  `item.img`), fallback `c.inv`. Édition d'un joueur = bouton **⛶ plein écran** → `SheetBody`
  (inventaire éditable, upload d'image inclus).
- `pages-admin.jsx` — page Admin : attribution rôle + perso par compte (`AdminPage`).
- `pages-inventory.jsx` — page **Inventaire commun** (`CommonInventoryPage`, coffre partagé) :
  rendu en **grille partagée** (`InventoryGrid`). Clic item → `ItemActionMenu` (Prendre / Éditer /
  Supprimer) ; clic pièce → retrait. **Transferts commun → perso** via `moveItem`/`moveCoins` :
  joueur = sa propre fiche, **MJ/admin = choix du destinataire** (picker sur `CHARACTERS`).
  Pile qty>1 → `AmountStepper` (montant), qty=1 → direct.
- `pages-equip.jsx` — page **Équipement** (`EquipPage`/`EquipBody`) : paperdoll dark-fantasy
  recréé du design Claude. 3 colonnes (slots+stats / portrait `ATH/Perso/` imposant / inventaire
  live via `InventoryGrid`), drag & drop inventaire ↔ slots + double-clic, tooltip, HUD bas
  (niveau/PV/mana/nom), **monnaie vivante** (`state.coins`, repli `char.coins` ; migration `coinsInit`).
  **Équipement persisté temps réel** (`state/equipment` = `{slotKey: itemId}`, via `setEquipment`).
  Bonus d'items via `item.mods` **branchés sur `computeEffective`** (`sumItemMods` somme les
  items équipés → 4e param, même étage que les modificateurs ; cases « Bonus de stats » dans
  l'éditeur d'item) ; stat boostée affichée en vert.
  `EQUIP_SLOTS` = les 15 slots, `equipTypeForItem` lit `item.type` en priorité (sinon infère :
  **dague→accessory** (choix MJ), autre arme→weapon, autre Équipement→accessory). Clic item →
  `ItemActionMenu` : Équiper / Utiliser (consommable) / **Envoyer au commun** (`moveItem` → `sharedInventory`,
  pile qty>1 = `AmountStepper`) / Éditer (`InvItemRow` en modal) / Supprimer ; clic pièce → dépôt au
  commun (`moveCoins`). **Consommables** : « Utiliser » (`parseConsumableEffect` lit « Rend X + Y% HP/Mana »
  dans le `sub`) → décrémente la qty, **supprime l'item à 0**, applique l'effet temps réel (PV via
  `applyHealMods`, mana brut). Items à qty 0 masqués.
- `recaps.js` — données des **récaps de séance** : `RECAPS = [{id,date,titre,resume,pages:[...]}]`
  (la plus récente en premier ; images dans `recaps/seance-XX/`, commitées/statiques).
- `pages-recap.jsx` — onglet **Récap** (`RecapPage`) : sélecteur de séance + résumé texte +
  BD feuilletable. `useMediaQuery` (double page ≥820px, page simple en dessous), `RecapBook`
  (livre, flip CSS 3D fait-main piloté en style inline 2 phases start→run via rAF, page A4
  portrait via `--pw`, `paginate`), `RecapLightbox` (lecture plein écran zoomable). Visible des
  3 rôles, **lecture seule, zéro Firebase, zéro règle RTDB**. Ajouter une séance = déposer les
  `.webp` dans `recaps/seance-XX/` + une entrée `RECAPS`.
- `pages-runes.jsx` — onglet **Runes** (`RuneTreePage`) : arbre des 5 familles (data `RUNES`),
  sélection stricte (points = niveau, ordre Mineure→Avancée→Fondamentale), persistée `state/runes`
  (`setRuneSelected`/`setRuneChoice`/`resetRunes`). Bonus plats via `sumRuneMods`+`mergeMods` →
  `computeEffective` (fiche/MJ/équip) ; conditionnel/actif en panneau « Rappels ». Toggle AD/AP
  (clé `adp`). Visible des 3 rôles, sélecteur de perso pour le staff. Logique pure dans `game-logic.js`.
- `pages-lobby/journal/progression/ds.jsx` — pages secondaires (mockup, données surtout statiques).
- `runeterra.css` — styles (variables CSS `--gold`, `--hp`, etc.).
- `database.rules.json` — règles RTDB strictes basées sur `/users/{uid}` (rôles) :
  joueur = sa fiche seule, staff = tout ; `sharedInventory` = R/W pour tout participant
  inscrit, écriture au niveau `$itemId` ; `sharedCoins` = R/W tout participant inscrit,
  `.validate` par dénomination (nombre ≥ 0).
- `test/auth.test.js` — tests unitaires des helpers d'auth (`node --test`).
- `test/game-logic.test.js` — tests unitaires (`node --test`).
- `test/smoke.mjs` — test de démarrage Playwright (charge l'app réelle, teste le
  temps réel Firebase). **Se connecte via un compte de test** (`SMOKE_USER`/`SMOKE_PASS`,
  défaut `smoke`) ; nécessite règles publiées + compte attribué à un perso.
- `docs/superpowers/specs/` et `docs/superpowers/plans/` — design et plan d'implémentation.
- `ATH/` — images : `Armes/` + `Items/` (icônes d'items `.webp`) + `Perso/*.webp` (portraits).
- `info-mj/` — **source de vérité du MJ** (règles détaillées) ; voir « Infos MJ » plus bas.
- `idée/` — assets de travail lourds (modèle 3D abandonné) ; **gitignore** (avec `*.glb/obj/fbx`).

## Modèle de données Firebase
```
/campaign/runeterra/characters/{charId}/state/
    hpCur, manaCur, shield (valeurs ABSOLUES), fatigue (0-5), eau (0-5)
    buffs:     { [buffId]: true }
    modifiers: { hp, mana, ad, ap, armure, resmag, crit, dcrit, sapience }
    inventory: { [itemId]: { id, cat, name, sub, qty, ic, img, type, mods } }   ← perso, éditable
    invInit:   true   ← marqueur de migration (amorçage unique de l'inventaire)
    equipment: { [slotKey]: itemId }   ← paperdoll (page Équipement), temps réel ; slotKey ∈ EQUIP_SLOTS
    coins:     { plat, or, arg, cuiv }   ← monnaie perso (entiers ≥ 0), via setCoin / moveCoins
    coinsInit: true   ← marqueur de migration (amorçage unique des pièces)
    runes:     { selected:{[nodeId]:true}, choices:{[nodeId]:'ad'|'ap'} }   ← arbre de runes (page Runes)
/campaign/runeterra/sharedInventory/{itemId}/   ← inventaire COMMUN partagé (R/W tout participant)
    { id, cat, name, sub, qty, ic, img, type, mods }
/campaign/runeterra/sharedCoins/   ← monnaie COMMUNE (coffre) : { plat, or, arg, cuiv } (R/W tout participant)
```
`type` = emplacement d'équipement (`EQUIP_TYPES` : helmet/chest/ring/weapon/accessory/…) ;
vide = non équipable. Renseigné dans l'éditeur d'item quand `cat === 'Équipement'`.
`charId` ∈ {rathael, urskaar, smith, **lunick** (affiché « Elias Crowe »), jett}.
Amorçage auto si vide (`seedIfEmpty`, conversion ratios → absolu via `buildDefaultState`).
`mods` = bonus de stats d'item (vide pour l'instant ; **hook futur** vers `computeEffective`).
```
/users/{uid}/   ← rôles & attribution (écrit par l'admin ; auto-inscription « en attente » à la 1re connexion)
    username, role (joueur|mj|admin), charId (si joueur)
```

**Check-list de déploiement (bascule anonyme → comptes) :**
1. Pousser le code sur `main` (GitHub Pages).
2. Console → Authentication : créer les comptes joueurs (`pseudo@runeterra.local` + mdp).
3. Console → Realtime Database / Données : vérifier `/users/{adminUID}` = `{username, role:"admin"}`.
4. Console → Realtime Database / Règles : publier `database.rules.json` (strictes).
5. Console → Authentication : **désactiver** le provider « Anonyme ».
6. Chaque joueur se connecte une fois → attribuer son perso via la page Admin.

## Décisions figées
- Cumul des buffs = **additif**. HP/Mana max non affectés par les buffs.
  Cas spéciaux : Aiguisage = %Crit×2 ; Miraculé/Hémorragie = ±50% soins/bouclier
  reçus ; Flétrissement = marqueur visuel.
- Modificateurs par défaut (col. C Excel) : Rathäel ad+10 ; Urskaar hp+50 ;
  Smith ad+20, crit+10 ; Elias (id `lunick`) ad+20 ; Jett aucun.
- Une seule campagne partagée, mais **vraie séparation par joueur** depuis la v2 :
  cloisonnement appliqué côté serveur par les règles RTDB (joueur = sa fiche seule).
- Sélecteur de 3 styles visuels conservé (masqué pour un joueur, verrouillé sur son perso).
- **Lunick (mort) → Elias Crowe** : id interne `lunick` conservé (clé Firebase/Admin),
  seul l'affichage change (nom/image/titre). Pas de migration.
- **Niveau 2** pour tous (les 12 pts de stats = 11 du niveau + 1 point bonus de création) ;
  page Progression affiche le bonus en gold.
- **Système de mode de combat (offensif/équilibré/défensif) RETIRÉ** : attaques = dégâts pleins.
- **Inventaire** : perso (par fiche) + commun (coffre partagé). Items `{id,cat,name,sub,qty,ic,img,type,mods}`,
  images dans `ATH/`. Bonus `mods` non encore branchés. **`type`** = emplacement explicite (saisi à
  l'édition si `cat==='Équipement'`), sinon `equipTypeForItem` infère. **Édition réservée au staff**
  (joueurs : lecture seule + équiper/utiliser/transférer ; gate `isStaff` sur fiche & Équipement).
- **Ajout d'items via catalogue** (`ITEM_CATALOG` + `ItemCatalogPicker`) : tous les « + Ajouter » staff
  (fiche, Équipement, commun) ouvrent le picker → quantité (`AmountStepper`) → ajout.
- **Plafond de pile = 99** (`STACK_MAX`) : une pile ne dépasse jamais 99, le surplus crée une nouvelle
  case (`fillStacks`). Appliqué à l'ajout catalogue **et** aux transferts. Piles déjà > 99 non re-découpées.
- **Monnaie vivante** : `state.coins` par fiche + `sharedCoins` commun ({plat,or,arg,cuiv}, entiers).
  Le MJ ajuste librement. **Transferts** perso ↔ commun pour items (`moveItem`/`planItemTransfer`,
  fusion auto sur name+type+cat) et pièces (`moveCoins`). Destinataire : joueur = sa fiche, MJ = choix.
- **Kéminite** = `Consommable` (catalogue + inventaires par défaut Rathäel/Urskaar ; défaut `type:''`).
- **Rendu perso = image `.webp`** (`ATH/Perso/`), **pas de 3D** (modèle Meshy trop lourd, abandonné).
- **Arbre de runes** : contenu figé (`RUNES`, data.jsx, issu de l'Excel — DA convertie en « AD ou AP »
  à la moyenne). Effets **hybrides** : bonus plats calculés (`sumRuneMods`→`computeEffective`),
  conditionnel/actif en rappels. Points = niveau, ordre strict, respec libre. Source de règles :
  `info-mj/Système de Runes.md`. **À confirmer MJ** : capstone vs thématique −2 CD ; 2 cellules
  tronquées (Inspiration « Altruisme excessif » + 1er capstone).

## Comment tester (dev)
```bash
node --test test/game-logic.test.js          # logique pure (20 tests)
node --test test/auth.test.js                 # helpers d'auth (6 tests)
python -m http.server 5050 --bind 127.0.0.1  # servir le site (autre terminal)
SMOKE_USER=smoke SMOKE_PASS=... node test/smoke.mjs   # smoke (règles publiées + compte attribué)
```
Vérif syntaxe d'un .jsx : `npx esbuild fichier.jsx >/dev/null`.
SRI des scripts CDN : `curl -s <url> | openssl dgst -sha384 -binary | openssl base64 -A`.

## État actuel (2026-06-18)
- **Arbre de runes (page Runes)** (branche `feat/arbre-runes`) : `RUNES` (5 familles, data.jsx) +
  logique pure testée (`game-logic.js` : `buildRuneIndex`, `runeBudget`, `runeSpent`, `canSelectRune`,
  `canDeselectRune`, `sumRuneMods`, `mergeMods`) + persistance `state/runes` + page interactive
  (`pages-runes.jsx`, sélection stricte / points / respec / toggle AD/AP / rappels, sélecteur perso staff)
  + intégration stats aux 3 sites. 50 tests verts, syntaxe OK. **Aucune règle RTDB.** Reste : vérif
  visuelle + merge/déploiement. (Spec/plan : `docs/superpowers/{specs,plans}/2026-06-18-arbre-runes*`.)
- **Onglet Récap (résumés de séance + BD flipbook)** (branche `feat/recap-seances`) : `recaps.js`
  (`RECAPS`), `pages-recap.jsx` (`RecapPage`/`RecapBook`/`RecapLightbox` + `useMediaQuery`),
  dossier `recaps/seance-XX/`, `paginate()` (logique pure testée). Livre double page + flip CSS 3D
  fait-main + responsive + lightbox plein écran. Visible des 3 rôles, lecture seule, **zéro Firebase /
  zéro règle RTDB**. 42 tests verts (game-logic 35 + auth 7), syntaxe OK. Reste :
  vérif visuelle du flip + merge/déploiement. (Spec/plan : `docs/superpowers/{specs,plans}/2026-06-18-recap-seances*`.)
- **`item.mods` → stats effectives** : fait/déployé (commit `ed0cd2d`) — `sumItemMods` + 4e param
  `computeEffective` + éditeur « Bonus de stats ».
- **Catalogue d'items + plafond de pile** (branche `feat/catalogue-items`) : `ITEM_CATALOG` (data.jsx),
  `ItemCatalogPicker` (modal), `STACK_MAX`/`fillStacks`/`planItemAdd` (logique pure testée),
  `planItemTransfer` refactoré pour respecter le plafond 99. Picker branché sur les 3 « + Ajouter »
  staff (fiche, Équipement, commun). Badge quantité en OR. Kéminite → Consommable. 34 tests verts
  (game-logic+auth), syntaxe OK. **Aucune règle RTDB à republier.** Reste : merge + déploiement.
- **Verrouillage joueur** : inventaire perso en lecture seule pour les joueurs (édition réservée
  staff sur fiche & Équipement) — mergé/déployé sur `main`.
- **Inventaire — transferts / types / pièces vivantes** : **mergé sur `main` et déployé** (subagent-driven).
  Champ `type` + `EQUIP_TYPES`, `planItemTransfer` (logique pure testée), `useSharedCoins`/`setCoin`,
  orchestrateurs `moveItem`/`moveCoins` (crédit-avant-débit), grille partagée `InventoryGrid` +
  `ItemActionMenu`/`AmountStepper`, pages Équipement & Inventaire commun câblées (transferts perso↔commun,
  pièces, choix destinataire MJ). Coffre commun en **master-détail** (grille gauche + panneau détail droite) ;
  **édition réservée au staff** (joueurs : Prendre seulement). Nav : Équipement avant Inventaire commun.
  26 tests verts (game-logic+auth), syntaxe OK. ⚠️ **RESTE À FAIRE EN CONSOLE FIREBASE : republier
  `database.rules.json`** (ajout `sharedCoins`) — sinon les pièces communes sont bloquées en écriture.

- v1 + **v2 (auth comptes + rôles) déployées** : GitHub Pages actif, comptes créés,
  règles strictes publiées, anonyme désactivé, persos attribués. ✅
- **Mergé sur `main`** depuis : retrait du mode de combat ; Lunick → **Elias Crowe** +
  passage **niveau 2** (+ bonus affiché en Progression).
- **Inventaire (perso + commun)** : implémenté en subagent-driven (branche `feat/inventaire`),
  17 tests verts. Items réels + images `ATH/` câblés depuis le nouvel Excel.
  ⚠️ **Au merge de `feat/inventaire`** : **republier `database.rules.json`** (sinon
  l'inventaire commun est inaccessible aux joueurs).
- **Page Équipement (paperdoll)** : front + persistance temps réel (`pages-equip.jsx`,
  `state/equipment`) sur la branche `feat/inventaire`, recréé fidèlement du design Claude,
  branché sur les vraies données (portrait, stats, inventaire live, monnaie). Aucune règle
  RTDB à changer (déjà couvert par `characters/$charId`). `item.mods` **branchés** (voir ci-dessous).
- **`item.mods` → stats effectives : FAIT et déployé** (commit `ed0cd2d`). `sumItemMods(equipment,
  itemsById)` (logique pure testée) + 4e param `itemMods` de `computeEffective` (même étage que les
  modificateurs, amplifié par les buffs, union des clés pour exposer vol/omni). Branché sur les 3
  calculs de stats (fiche, MJ `mjLive`, Équipement). Éditeur `InvItemRow` : section « Bonus de stats »
  (`MOD_STATS`, 11 stats) visible si `cat==='Équipement'`. 39 tests verts.

## Chantiers en cours / backlog
- **Inventaire + Équipement : clos côté code** (perso + commun, transferts, catalogue, plafond 99,
  monnaie vivante, paperdoll, `item.mods` branchés). Reste uniquement de la **saisie de contenu** :
  créer les **armures réelles** avec leur `type` + leurs `mods` (jusqu'ici seuls armes & accessoires
  ont un `type` câblé) — pas de dev, juste remplir `ITEM_CATALOG` / l'éditeur.
- **Compétences** (gros chantier, design validé, voir specs) : kits dans `info-mj/`.
  COMPLETS : Smith, Urskaar, Elias. **Manque : Rathael comp 4 ; Jett comp 3+4.**
  Approche hybride : outil calcule dégâts/charges/CD/états, narratif = rappel.
- **Arbre de runes** (style LoL, mockup `idée/`) : règles dans `info-mj/Système de Runes.md`.
  **Manque** : effets chiffrés des runes des 4 familles hors Domination (~45 runes au total).
- **Nouveau système d'attaques de base** (`info-mj/`) : catégories d'armes + propriétés +
  maîtrise (−25 % si non maîtrisée). **Remplace** l'ancienne idée ×1.5/×1.75.
- **Journal de combat partagé** : écrire les attaques live dans Firebase (pas encore fait).

## Infos MJ (`info-mj/` — source de vérité des règles détaillées)
- `info-mj/Compétences-Races PJ (mis à jour).md` — kits complets (passif + comps) + races/
  traits par niveau. ⚠️ La section « Lunick » = ancien perso mort (ignorer) ; voir « Elias ».
- `info-mj/Système de Runes.md` — règles de l'arbre de runes (points = niveau, Mineure→
  Avancée→Fondamentale, thématiques de famille = −2 CD).
- `info-mj/Nouveau système de gestion des attaques de base (2).md` — catégories d'armes
  (type/tenue/portée/propriétés) + descriptions des propriétés + règle de maîtrise.
- `info-mj/Codes App Script.md` — moteur de calcul du Google Sheet (référence ; pas le
  contenu compétences/runes).
- Specs/plans liés : `docs/superpowers/specs/2026-06-16-competences-design.md`,
  `…-inventaire-design.md`, `docs/superpowers/plans/2026-06-16-inventaire.md`.

## Notes
- L'Excel : feuilles Statistiques/Runes/Journal/Grille Personnage + Stats/Grille par joueur.
  Correspondance perso↔joueur : Rathäel=JB, Urskaar=Baptiste, Smith=Erwan,
  **Elias Crowe (id `lunick`)=Fab**, Jett=Steph.
- Gitignore : `node_modules/`, `idée/`, `*.glb`/`*.obj`/`*.fbx` (assets lourds, hors dépôt).
```
