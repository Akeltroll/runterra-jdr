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
  Barre de nav avec champ `group` sur `PAGES` : `main` (barre), `more` (menu déroulant
  « ⋯ Plus » : Journal + Progression, staff), `footer` (lien discret bas de page :
  Design System, staff). Récap placé en avant-dernier (Admin reste dernier).
  L'onglet `id:'competences'` a pour **libellé « Combat »** (id inchangé pour le routage).
- `game-logic.js` — **logique pure** (UMD : testable en Node + `window`). `clamp`,
  `clampGauge`, `DEFAULT_MODIFIERS`, `BUFF_STAT_MAP`, `computeEffective`,
  `applyHealMods`, `buildDefaultState`. **Moteur de stats refondu** (système hypermétrique) :
  `computeStats(F,H,M,C,level)` (8 stats dérivées : magnitude escaladée via `escalationFactor(p)`
  [tranches de 4, table §4.3, zone PNJ quadratique >20] + socle de niveau + bonus de départ Habileté/fondu ;
  **sans Sapience**, retirée du socle) + `charBaseStats(char,state)` (base **live** : caracs effectives
  `state.attrs ?? char.attrs`, niveau `state.level ?? char.level`). Validé contre les profils §9.
  **XP** : `xpToNext(level)` (courbe officielle du MJ
  `180 + 100*level` = `info-mj/tableau_XP.png` ; **cap niveau 18** → `Infinity` au cap, `MAX_LEVEL=18`)
  + `applyXp(level, xp, gain)` (montée auto avec report du surplus en cascade, figée au cap).
  Combat (vue MJ) : `mitigateDamage`
  (armure/resmag, AR-120, **léthalité** réduit AR/RM sans passer sous 0, brut sans réduction) +
  `applyDamageToPools` (bouclier puis HP, KO) — reproduit le moteur Excel. **Visibilité PV ennemis** :
  `enemyPublicView(enemy)` (pure, testée) = ce que voient les joueurs selon `enemy.reveal` ('hidden'=nom seul /
  'bar'=barre figée à `revealPct`, ne suit pas les vrais dégâts / 'exact'=barre live + PV chiffrés) ; KO toujours signalé.
  **Crit/surcrit (§6.3)** :
  `critInfo(critPct)` (paliers garantis + chance fractionnaire, affichage) + `rollCrit(critPct,dcrit,rng)`
  (≥100 % = crit garanti, +50 % Dég. Crit par palier ; `rng` injectable).
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
- `data.jsx` — règles immuables : `CHARACTERS` (avec `inv`
  par défaut + images `ATH/`), `BUFFS`, `WEAPONS`, `LEVELS` (caps §3, cap PJ 20), `ATTRIBUTES`, `RUNE`, `JOURNAL`,
  `ITEM_CATALOG` (catalogue d'items pré-enregistrés pour l'ajout staff : `{cat,name,sub,ic,img,type}`).
  `mkChar` attache `attrs` + `modifiers` (ne bake **plus** `stats` : calcul live via `charBaseStats`,
  voir `game-logic.js`). (`ATTACK_MODES` **retiré** — voir Décisions.)
- `data-state.jsx` — hooks temps réel : `useCharState` (+ setters inventaire
  `setInvItem`/`removeInvItem` + équipement `setEquipment` + monnaie `setCoin`), `useAllCharStates`,
  `useSharedInventory` (inventaire commun), `useSharedCoins` (monnaie commune), `useAuthIdentity`
  (identité + `/users/{uid}`, auto-inscription), `useAllUsers`, `setUserAssignment`,
  `seedIfEmpty(role)` (réservé staff). Compétences : `setCounter`/`setCooldown`/**`setSkillBuff`** (sur
  `useCharState` ; `setSkillBuff(skillId, mods)` = buff sur soi, snapshot de mods plats).
  **XP** : orchestrateur `addXp(charId, gain)` (async, écriture staff : `getSnapshot`→`applyXp`→écrit
  `{level, xp}`, `pushLog` au level-up, retourne `{level, xp, levelsGained}` pour le toast appelant) ;
  `grantCoins(charId, patch)` (don additif d'argent : `getSnapshot`→ajoute `{plat,or,arg,cuiv}`→écrit ; récompense de séance).
  `useSharedTurn` (tour partagé ; `resetCombat` **async** : efface counters/cooldowns/`skillBuffs`/`combat/log`
  ET **ramène PV/bouclier aux caps de base** via `computeEffective` sans skillBuffs). **Plateau partagé** :
  `useMJEnemies` (ennemis Firebase), `usePendingHits` (file d'attaques), orchestrateur `applyHitToEnemy`
  (`mitigateDamage`→`applyDamageToPools`→PV ennemi) ; **journal** `pushLog(text,kind)`/`useCombatLog()`
  (`combat/log`, ~30 derniers). Orchestrateurs de transfert RTDB `moveItem` (via `planItemTransfer`) /
  `moveCoins`. Constantes `CAMPAIGN = 'campaign/runeterra'`, `SHARED_INV`, `SHARED_COINS`, `COMBAT_TURN`,
  `ENEMIES`, `PENDING_HITS`, `COMBAT_LOG`.
- `components.jsx` — UI partagée : `Avatar`, `ResourceBar`, **`XpBar`** (barre d'XP lecture seule :
  `xp/xpToNext(level)` + label niveau), `BuffBadge`, toasts
  (`renderToastMsg` = rendu sûr, seul `<b>` autorisé), **`CombatLog`** (journal de combat
  partagé lecture seule, lit `useCombatLog` ; prop `canClear` = bouton « Vider » staff), `LoginScreen`,
  `PendingScreen`, `SignOutButton`, `NumberStepper`, `ExportImportPanel`,
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
  Jauge **bouclier à max dynamique** (`max(shieldMax, bouclier)`) pour afficher le bouclier de comp.
  **Omnivamp/vol de vie lus depuis `eff`** (`SecondaryStats`, plus de `0%` en dur).
  Fatigue/Eau éditables, modificateurs, stats effectives, HealPanel, **inventaire perso
  temps réel** (migration unique via marqueur `invInit`). **Arme affichée = celle équipée**
  (slot `armePrincipale` de `state.equipment`, reliée à `WEAPONS` par nom ; repli `char.weaponId`).
  **L'action d'attaque a été retirée de la fiche** (déplacée dans l'onglet Combat) : le panneau « Arme
  équipée » reste en info (arme + dégâts estimés), sans bouton ni modale.
  Bourse **live** (`state.coins`, ordre cuivre→argent→or→platine). **HealPanel plafonne sur les
  stats EFFECTIVES** (`eff.hp`/`eff.mana`, incluent runes/items/mods) — pas les stats de base.
- `pages-mj.jsx` — tableau de bord MJ temps réel (`mjLive(c, st)` fusionne règles+état).
  Le mini-sac des cartes lit l'inventaire **live** (`st.inventory`, items qty>0, images
  `item.img`), fallback `c.inv`. Édition d'un joueur = bouton **⛶ plein écran** → `SheetBody`
  (inventaire éditable, upload d'image inclus). Grille **responsive** (plus de scroll
  horizontal). **Section Ennemis** (désormais **partagés en Firebase** `combat/enemies`, lecture
  inscrits/écriture staff) : `useMJEnemies` (migré localStorage→Firebase, API inchangée),
  `EnemyCard` (HP/mana/**armure/resmag** édition inline, « Subir » = dégâts joueurs→ennemi ; **contrôle 👁 Joueurs**
  Caché/Barre/Exact + presets % en mode Barre → écrit `reveal`/`revealPct`),
  `EnemyAttackModal` (ennemi→joueur : `mitigateDamage`+`applyDamageToPools`, écrit `hpCur`/`shield`
  du joueur ciblé en Firebase, KO à 0). **Section « Attaques en attente »** (`PendingHitsPanel`,
  file `combat/pendingHits`) : un joueur cast une comp à dégâts → propose une attaque sur un ennemi
  ciblé. **Le crit/surcrit est roulé par l'app au cast** (`rollCrit`) : la carte MJ affiche **base vs crit**
  (+ badge 🎲 CRIT ×mult, profil `critInfo`), pré-remplit le champ avec le nombre roulé ; le MJ ajuste à son
  d20 de toucher Roll20, règle le type **+ la léthalité** (réduit AR/RM), puis **Appliquer**
  (`applyHitToEnemy(enemy,dmg,type,letha)`) ou **Rejeter**. Cartes : barre de bouclier
  **toujours affichée** (0/0 si vide) ; **pulsation du cadre** selon les PV (classe `mj-card-warn`
  orange < 50%, `mj-card-danger` rouge < 25% — keyframes CSS dans `runeterra.css`).
  **Compteur de tour PARTAGÉ** dans l'en-tête (`useSharedTurn`, Firebase `combat/turn` :
  Fin de tour / précédent / **⟲ Combat** = reset tour + toutes charges/cooldowns + skillBuffs + journal)
  — pilote les CD des compétences. Sous chaque carte joueur : ligne **charges + cooldowns actifs**
  (lecture MJ). **`CombatLog`** (journal de combat partagé) affiché sous le plateau, « Vider » staff ;
  `pushLog` alimenté à la résolution joueur→ennemi (`PendingHitsPanel`), ennemi→joueur (`EnemyAttackModal`),
  au bouton **« Subir »** (`EnemyCard.applySubir`, dégâts manuels MJ) et au **cast de compétence** (côté joueur, voir `pages-competences.jsx`).
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
  sélection stricte (budget = `level + runeBonus`, ordre Mineure→Avancée→Fondamentale), persistée
  `state/runes` (`setRuneSelected`/`setRuneChoice`/`resetRunes`). Bonus plats via `sumRuneMods`+`mergeMods`
  → `computeEffective` (fiche/MJ/équip) ; conditionnel/actif **et sous-effets non calculés** (champ
  `note` : létalité Sadisme, renvoi Peau épineuse) en panneau « Rappels ». Toggle AD/AP (clé `adp`).
  **Thématique** : la *condition* est en bas du cadre famille ; le *bonus* (capstone **par voie**) est
  affiché dans la rune **fondamentale** (rectangle en 2 sous-sections). **Stepper points bonus MJ**
  (staff only, `setField('runeBonus')`) pour tester/gérer la montée de niveau. Visible des 3 rôles,
  sélecteur de perso pour le staff. Logique pure dans `game-logic.js`.
- `pages-competences.jsx` — onglet **Combat** (`CompetencesPage`, libellé de menu « Combat ») : cast au clic
  (mana − coût, pose le cooldown). Carte **Attaque de base** (arme équipée → `eff.ad`/`eff.ap`, bouton
  « Attaquer » → attaque en attente MJ, **sans mana ni cooldown**) + carte **Passif** (stepper de
  compteur + effet de stat en vert) + cartes **Actives** (mana, badge CD, dégâts live, « Lancer »).
  `cast(sk, ctx, dmg, nbHits)` **respecte les variables d'attaque** (1er coup/camouflé/cases/cibles) ; une comp
  à **N cibles génère N attaques en attente** (un coup = une carte, chacune son `rollCrit`). **Garde « pas de
  cible »** : toute action à dégâts sans cible → toast + abandon (avant mana/cooldown). Données
  `SKILLS` (data.jsx) → `dmg*` pures de `game-logic.js` (transcrites des scripts `.gs`, **le script prime**).
  Compteurs/cooldowns en `state/counters`+`state/cooldowns` (cooldown = **`readyAt`** = n° de tour de dispo) ;
  variables d'attaque (1er coup / furtif / cases / cibles) en état local de carte. **Persos câblés** :
  Elias/Smith/Urskaar/Jett + **Rathael (C1 Frappe Irritée + C2 Mur de Givre)** ; reste à faire : Rathael C3/C4,
  Jett C3/C4. Passif calculable (Elias +AD/charge plat ; **Rathael +5%/charge Armure+RM de base** via compteur
  Glaciation — `sumPassiveMods(charId,counters,level,base)`, 4e param `base`) branché via
  `sumPassiveMods`→`computeEffective`. **Glaciation auto-incrémenté** quand Rathael subit une attaque ennemie
  (`glaciationOnHit(counters,turn)`, max 2/tour + max 5, appelé dans `EnemyAttackModal.submit` ; clés internes
  `glaciationTurn`/`glaciationTurnAt`) ; le stepper reste un override manuel. `cast` gère **`selfBuffFlat`** (buff
  plat, ex. Mur de Givre +30 AR/RM) et **`counterBump`** (incrément conditionnel de compteur au cast) ; l'`eff` de
  la page Combat inclut les `skillBuffs` (aligné fiche/équip). Visible des 3 rôles, sélecteur
  de perso pour le staff. Logique pure + testée dans `game-logic.js`. **Plateau partagé** : bandeau
  ennemis en lecture seule (`useMJEnemies`) + sélecteur de **cible** ; le cast d'une comp à dégâts
  avec cible **roule le crit/surcrit** (`rollCrit`) et **snapshot la léthalité** (`eff.letha`) dans
  l'attaque en attente (`usePendingHits.addHit`) que le MJ résout. **Buffs sur soi** :
  une comp avec `selfBuff` (% de la stat de base) écrit `state/skillBuffs` (mods plats) → panneau
  **« Effets de combat actifs » en orange** (`--skillbuff`) + boost en temps réel via `sumSkillBuffs`→
  `computeEffective` ; un `selfBuff.hp` **soigne aussi** les PV au cast (la jauge se remplit) ; une comp
  avec `shield` ajoute le bouclier au pool au cast. **Chaque cast journalise** (`pushLog` : buff/soin/bouclier
  agrégés, ou attaque visée « en attente MJ », ou lancer simple). **Journal de combat** (`CombatLog`, lecture seule)
  affiché en bas. **Déblocage par niveau** : active n° *i* → niveau *i* requis (`skillUnlocked`), carte
  verrouillée grisée + 🔒 ; **stepper « Niveau » staff** dans l'en-tête (`setField('level')`, niveau
  effectif = `state.level ?? char.level`, pilote aussi passif + budget runes).
- `pages-journal.jsx` — onglet **Journal** (`JournalPage`, staff) : **flux d'événements live** du `combat/log`
  partagé (`useCombatLog`), filtres par `kind` (tous/actions/buffs/KO) + horodatage + « Vider » (purge partagée).
  Remplace l'ancien mockup statique. Lecture seule, alimenté par `pushLog`.
- `pages-lobby/progression/ds.jsx` — pages secondaires (mockup, données surtout statiques).
- `runeterra.css` — styles (variables CSS `--gold`, `--hp`, etc.).
- `database.rules.json` — règles RTDB strictes basées sur `/users/{uid}` (rôles) :
  joueur = sa fiche seule, staff = tout ; `sharedInventory` = R/W pour tout participant
  inscrit, écriture au niveau `$itemId` ; `sharedCoins` = R/W tout participant inscrit,
  `.validate` par dénomination (nombre ≥ 0) ; `combat/turn` = lecture tout inscrit, **écriture staff**
  (nombre ≥ 1) — tour partagé ; `combat/enemies` = lecture inscrits, **écriture staff** (ennemis
  partagés) ; `combat/pendingHits` = lecture inscrits, **écriture tout inscrit** (un joueur propose
  une attaque ; le staff applique/supprime) ; `combat/log` = lecture+**écriture tout inscrit**
  (`.validate` `text` string) — journal de combat partagé.
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

## Modèle de données Firebase
```
/campaign/runeterra/characters/{charId}/state/
    hpCur, manaCur, shield (valeurs ABSOLUES), fatigue (0-5), eau (0-5)
    xp:        0   ← progression DANS le niveau courant (entier ≥ 0, < xpToNext(level)) ; via addXp ; montée auto → level
    buffs:     { [buffId]: true }
    modifiers: { hp, mana, ad, ap, armure, resmag, crit, dcrit, sapience }
    inventory: { [itemId]: { id, cat, name, sub, qty, ic, img, type, mods } }   ← perso, éditable
    invInit:   true   ← marqueur de migration (amorçage unique de l'inventaire)
    equipment: { [slotKey]: itemId }   ← paperdoll (page Équipement), temps réel ; slotKey ∈ EQUIP_SLOTS
    coins:     { plat, or, arg, cuiv }   ← monnaie perso (entiers ≥ 0), via setCoin / moveCoins
    coinsInit: true   ← marqueur de migration (amorçage unique des pièces)
    runes:     { selected:{[nodeId]:true}, choices:{[nodeId]:'ad'|'ap'} }   ← arbre de runes (page Runes)
    runeBonus: 0   ← points de rune bonus accordés par le MJ (test / montée de niveau) ; budget = level + runeBonus
    level:     2   ← niveau effectif (entier ≥ 1, stepper staff onglet Compétences) ; défaut = char.level ; pilote déblocage des comps + passif + budget runes + STATS (socle moteur refondu)
    attrs:       { force, hab, mental, magie }   ← override de caracs (respec) ; ABSENT par défaut → repli char.attrs ; lu par charBaseStats
    attrsLocked: true   ← verrou après respec joueur unique (UI à venir) ; le staff peut éditer/déverrouiller
    counters:  { [key]: n }   ← compteurs de compétences (chasseur/marques/tranches/cn…), steppers manuels
    cooldowns: { [skillId]: readyAtTurn }   ← cooldown = n° de tour de disponibilité (999999 = 1×/combat)
    skillBuffs: { [skillId]: { [stat]: n } }   ← buffs sur soi (mods PLATS snapshotés au cast, ex. Urskaar C4 +30% PV/AD/Armure de base) ; effacés par « ⟲ Combat »
/campaign/runeterra/sharedInventory/{itemId}/   ← inventaire COMMUN partagé (R/W tout participant)
    { id, cat, name, sub, qty, ic, img, type, mods }
/campaign/runeterra/sharedCoins/   ← monnaie COMMUNE (coffre) : { plat, or, arg, cuiv } (R/W tout participant)
/campaign/runeterra/combat/turn   ← compteur de tour PARTAGÉ (nombre ≥ 1) ; lecture inscrits, écriture staff
/campaign/runeterra/combat/enemies/{id}   ← ennemis PARTAGÉS { name, hpCur, hpMax, manaCur, manaMax, atk, armure, resmag, note, reveal, revealPct } ; lecture inscrits, écriture staff
                                              reveal ∈ 'hidden'(défaut)|'bar'|'exact' = ce que voient les JOUEURS ; revealPct (0-100) = % de barre figé en mode 'bar' ; absent → 'hidden'
/campaign/runeterra/combat/pendingHits/{id}   ← attaques proposées { attackerId, attackerName, skillId, skillName, type, computedDmg, critDmg, didCrit, critMult, letha, crit, dcrit, targetId, ts } ; crit roulé au cast ; le MJ ajuste+applique
/campaign/runeterra/combat/log/{id}   ← journal de combat PARTAGÉ { id, ts, text, kind:'gold'|'buff'|'debuff' } ; lecture+écriture tout inscrit ; ~30 derniers ; vidé par « ⟲ Combat »
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
  page Progression affiche le bonus en gold. **Niveau effectif live** = `state.level` (stepper staff
  onglet Compétences), défaut `char.level` ; pilote déblocage des comps + passif + budget runes.
- **Déblocage des compétences par niveau** : active n° *i* (0-based) → **niveau *i*+1 requis**
  (`skillUnlocked`), passif toujours dispo. Tous niveau 2 → C3/C4 verrouillés tant que le MJ ne monte
  pas le niveau.
- **Buffs de ressource remplissent la jauge** : `selfBuff.hp` **soigne** au cast (PV max + actuels),
  bouclier de comp affiché via jauge à max dynamique. **« ⟲ Combat » = retour total aux caps de base**
  (PV plafonnés au max normal, bouclier vidé, skillBuffs effacés).
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

## État actuel (2026-06-20)
- **Correctifs de playtest compétences** — branche `feat/competences-playtest`, **prête, à
  merger/déployer (zéro nouvelle règle RTDB).** 4 retours de test corrigés : (1) **buffs de ressource
  remplissent la jauge** — `selfBuff.hp` soigne au cast (Urskaar C4 → 130/130), bouclier de comp affiché
  (jauge à max dynamique fiche+MJ) ; (2) **déblocage par niveau** — `skillUnlocked` (active n° i → niveau
  i+1), cartes verrouillées grisées + 🔒, + **stepper « Niveau » staff** (`state/level`, niveau effectif
  branché sur passif + budget runes) → C3/C4 verrouillés à niveau 2 ; (3) **« ⟲ Combat »** ramène
  PV/bouclier aux caps de base (`resetCombat` async, `computeEffective` sans skillBuffs) ; (4) **fix
  omnivamp/vol de vie** sur la fiche (`SecondaryStats` lit `eff`, plus de `0%` en dur). 71 tests verts
  (esbuild + headless OK). Spec/plan : `docs/superpowers/{specs,plans}/2026-06-20-competences-playtest-fixes*`.
- **Compétences (actif/passif) + Plateau partagé + Buffs/Journal** — **mergé sur `main` et déployé**
  (règles `combat/log` republiées). (1) Onglet Compétences (`pages-competences.jsx`) : cast = mana − coût + cooldown +
  merger/déployer.** (1) Onglet Compétences (`pages-competences.jsx`) : cast = mana − coût + cooldown +
  dégâts calculés. Persos câblés : **Elias, Smith, Urskaar, Jett, Rathael (C1+C2)** (formules des scripts `.gs`, le
  script prime). Tour **partagé** (`useSharedTurn`, `combat/turn`)
  pilote les cooldowns (`readyAt`) ; « ⟲ Combat » reset tout. Passif Elias (+AD/charge) → `computeEffective`.
  (2) **Plateau partagé** : ennemis migrés en Firebase (`combat/enemies`, lecture inscrits/écriture staff,
  +armure/resmag) ; au cast d'une comp à dégâts le joueur **cible un ennemi** → attaque proposée
  (`combat/pendingHits`) → la vue MJ l'**ajuste (d20) et applique** (`applyHitToEnemy`).
  (3) **Buffs sur soi + journal de combat** (SP3, empilé) : `combat/log` (journal partagé `pushLog`/
  `useCombatLog`, composant `CombatLog` sous le plateau MJ + bas de Compétences, vidé par « ⟲ Combat ») ;
  `state/skillBuffs` (mods plats snapshotés au cast) sommés (`sumSkillBuffs`) dans `computeEffective`
  → boost live, **couleur orange `--skillbuff`** (panneau Compétences + stats Équipement) ; Urskaar C3
  ajoute son bouclier au pool au cast. Règles `combat/turn`+`enemies`+`pendingHits`+`log` **publiées**.
  (Note : le « PV max sans soin » initial a été **remplacé** par le soin au cast — voir « Correctifs de
  playtest » ci-dessus.) Specs/plans :
  `docs/superpowers/{specs,plans}/2026-06-{16,19,20}-*` (compétences + plateau-partage + buffs/journal).
- **Vue MJ — ennemis (v1)** : **mergé sur `main` et déployé.** Grille responsive (fin du scroll
  horizontal) + suivi d'ennemis locaux (`localStorage`, zéro Firebase). Logique de combat pure
  testée (`mitigateDamage`, `applyDamageToPools`, moteur Excel). Attaque ennemi→joueur écrit les
  HP/bouclier du joueur ciblé en Firebase (type physique/magique/brut, bouclier d'abord, KO à 0) ;
  « Subir » baisse les HP de l'ennemi. 59 tests verts. **Zéro règle RTDB.** v2 éventuelle : plateau
  partagé (joueurs voient les ennemis et cliquent). (Spec/plan : `docs/superpowers/{specs,plans}/2026-06-19-vue-mj-ennemis*`.)
- **Nav allégée** : Récap en avant-dernier ; Journal+Progression dans un menu « ⋯ Plus » ;
  Design System en footer (staff). Mergé/déployé.
- **Correctifs fiche (mergés/déployés)** : arme affichée = arme équipée (slot `armePrincipale`) ;
  bourse live + ordre cuivre→platine ; **HealPanel plafonne sur les stats effectives** (corrige le
  soin bridé à la valeur de base malgré les bonus runes/items). Bouclier max par défaut : 0 pour
  Urskaar/Smith/Elias, 200 pour Rathäel/Jett. Pulsation du cadre des cartes MJ (orange < 50%, rouge < 25%).

## État précédent (2026-06-18)
- **Arbre de runes (page Runes)** : **mergé sur `main` et déployé.** `RUNES` (5 familles, data.jsx) +
  logique pure testée (`game-logic.js` : `buildRuneIndex`, `runeBudget`, `runeSpent`, `canSelectRune`,
  `canDeselectRune`, `sumRuneMods`, `mergeMods`) + persistance `state/runes` (+`runeBonus`) + page
  interactive (`pages-runes.jsx`, sélection stricte / respec / toggle AD/AP / rappels incl. sous-effets,
  thématique par voie dans la fondamentale + condition en bas, stepper points bonus MJ, sélecteur perso
  staff) + intégration stats aux 3 sites. 50 tests verts. **Aucune règle RTDB.**
  (Spec/plan : `docs/superpowers/{specs,plans}/2026-06-18-arbre-runes*`.)
  **À confirmer MJ** : capstone par voie vs thématique −2 CD unique ; 2 cellules Excel tronquées
  (Inspiration « Altruisme excessif » + 1er capstone Amélioration).
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
- **Compétences** : **implémentées et déployées** (Elias/Smith/Urskaar/Jett + **Rathael C1+C2**). Le passif
  Rathael (+5%/charge Armure+RM de base, compteur Glaciation manuel) calcule un mod plat depuis les stats de
  base (`sumPassiveMods(...,base)`). **À FAIRE plus tard** : (1) comps manquantes (**Rathael C3/C4**, Jett C3/C4)
  à ajouter dans `SKILLS` + `game-logic.js` ; (2) automatiser le cap 2 charges/tour + décroissance −2/tour et
  l'état Âme fendue de Rathael (aujourd'hui narratif/manuel) ; (3) Phase 2 : auto-application des dégâts aux
  ennemis (aujourd'hui le MJ saisit le nombre dans « Subir »).
- **Arbre de runes** : **FAIT et déployé** (voir « État actuel »). Les 5 familles sont chiffrées
  (`RUNES`, data.jsx) et interactives. Reste seulement la validation MJ (capstone vs thématique,
  2 cellules tronquées).
- **Nouveau système d'attaques de base** (`info-mj/`) : catégories d'armes + propriétés +
  maîtrise (−25 % si non maîtrisée). **Remplace** l'ancienne idée ×1.5/×1.75.
- **Journal de combat partagé** : **FAIT** (`combat/log`, `CombatLog` ; voir « État actuel »).
- **Cycle de séance + XP + distribution de récompenses (vue MJ)** — découpé en **A** (XP & niveau) +
  **B** (séance + récompenses). **A = FAIT et déployé (2026-06-21)** : `state/xp` (progression intra-niveau),
  `xpToNext`/`applyXp` (game-logic, testés), orchestrateur `addXp` (montée auto + report + `pushLog`),
  composant `XpBar` (fiche + Progression + cartes MJ), contrôle « +XP » ad-hoc côté MJ. Aucune règle RTDB.
  Spec/plan : `docs/superpowers/{specs,plans}/2026-06-21-xp-niveau*`. **B = FAIT et déployé (2026-06-21)** :
  `useSession` (état de séance MJ-local `localStorage`), `SessionStartModal` (« Début de séance / Visite »
  à l'ouverture de la vue MJ), bandeau « Séance en cours » + bouton « Clôturer », `SessionRewardsModal`
  (tableau XP + pièces par joueur → `addXp` en lot + `grantCoins` ; bouton « loot » → onglet Inventaire
  commun). `grantCoins(charId, patch)` = don additif d'argent (data-state). Aucune règle RTDB.
  Spec/plan : `docs/superpowers/{specs,plans}/2026-06-21-seance-recompenses*`.
  **Courbe XP officielle appliquée** (`info-mj/tableau_XP.png`) : `xpToNext = 180+100*level`, cap niveau 18.
- **Refonte « système hypermétrique »** — `info-mj/SPECIFICATION - Système refondu.md` (livré MJ 2026-06-21).
  Modèle de stats = **4 caractéristiques** (Force/Habileté/Mental/Magie) → 8 stats dérivées (matrice de poids,
  escalade anti-aplatissement, socle de niveau, bonus de départ, surcrit, équipement en stats finales, zone PNJ).
  Découpé en sous-projets. **Fondation = FAITE (2026-06-21, branche `feat/moteur-stats-refondu`)** : `computeStats(F,H,M,C,level)`
  + `escalationFactor` + `charBaseStats` (game-logic, testés §9), bascule de l'app en calcul **live** (fin du
  `char.stats` figé ; 9 fichiers migrés), modèle de données `state/attrs`+`attrsLocked` (lecture seule ici),
  caps `LEVELS` §3, libellés `ATTRIBUTES`, Sapience retirée du socle. Aucune règle RTDB. Spec/plan :
  `docs/superpowers/{specs,plans}/2026-06-21-moteur-stats-refondu*`.
  **Combat (§6) = FAIT (2026-06-22, branche `feat/combat-refondu`)** : `critInfo`+`rollCrit` (surcrit par paliers,
  testés), crit roulé au cast, **léthalité** branchée (`mitigateDamage`←`applyHitToEnemy`, snapshot au cast, éditable MJ),
  attaque de base unifiée. Aucune règle RTDB. Spec/plan : `docs/superpowers/{specs,plans}/2026-06-22-combat-refondu*`.
  **Reste** (sous-projets séparés) : (1) **respec joueur** (UI : répartition des points, caps par niveau →
  écrit `attrs`+`attrsLocked`) ; (2) **équipement en stats finales** (armes 3 paliers + 18 armures §7) ;
  (3) **zone PNJ/divine** (escalade quadratique >20 §8 ; `escalationFactor` gère déjà >20) ;
  (4) crit/léthalité **ennemi→joueur** (les ennemis n'ont pas encore de stat crit/letha).

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
- Gitignore : `node_modules/`, `idée/`, `*.glb`/`*.obj`/`*.fbx` (assets lourds, hors dépôt),
  `info-mj/` (règles privées du MJ — dépôt public).
```
