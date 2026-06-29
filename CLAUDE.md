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
  **`defaultRoute → 'lobby'` pour tous les rôles** : tout le monde atterrit sur le Hub d'accueil
  (`id:'lobby'` → `<HubPage/>`), joueurs inclus (`lobby` ajouté à `PAGE_ACCESS.joueur`).
- `game-logic.js` — **logique pure** (UMD : testable en Node + `window`). `clamp`,
  `clampGauge`, `DEFAULT_MODIFIERS`, `BUFF_STAT_MAP`, `computeEffective`,
  `applyHealMods`, `buildDefaultState`. **Moteur de stats refondu** (système hypermétrique) :
  `computeStats(F,H,M,C,level)` (8 stats dérivées : magnitude escaladée via `escalationFactor(p)`
  [tranches de 4, table §4.3, zone PNJ quadratique >20] + socle de niveau + bonus de départ Habileté/fondu ;
  **sans Sapience**, retirée du socle) + `charBaseStats(char,state)` (base **live** : caracs effectives
  `state.attrs ?? char.attrs`, niveau `state.level ?? char.level`). Validé contre les profils §9.
  **XP** : `xpToNext(level)` (courbe officielle du MJ
  `180 + 100*level` = `info-mj/tableau_XP.png` ; **cap niveau 18** → `Infinity` au cap, `MAX_LEVEL=18`)
  + `applyXp(level, xp, gain)` (montée auto avec report du surplus en cascade, figée au cap)
  + `applyXpLoss(level, xp, loss)` (miroir : descente en cascade, plancher niveau 1 / xp 0 — corrige une
  saisie d'XP erronée). **Poids porté** : `carriedWeight(items)` (Σ `weight×qty`), `carryCapacity(force,
  equipment, itemsById)` (= `CARRY_BASE`(10) + `force×CARRY_PER_FORCE`(5) + Σ `item.carry` des items équipés —
  **la ceinture = un item avec `carry`**), `weightStatus(carried, cap)` (`{pct, over}`, affichage seul, le
  MJ arbitre la surcharge). Items : champs `weight` (poids unitaire) + `carry` (bonus de capacité).
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
  **`parseConsumableEffect(item)`** (lit « Rend X + Y% HP/Mana » ou repli par nom → `{kind,flat,pct}|null` ;
  partagé fiche + Équipement). **`statBreakdown(base, modifiers, buffs, stuffMods)`** → `{[stat]:{effective,
  base, buff, mod, stuff}}` (décompose chaque stat effective par source via recomposition de `computeEffective` ;
  `base+buff+mod+stuff = effectif` ; alimente l'affichage breakdown de la fiche).
  **`carouselTransforms(count, activeIndex)`** → tableau `{offset, translateX, translateY, scale, opacity, zIndex}`
  (slider horizontal plat du hub : carte active centrée/agrandie, voisines décalées/atténuées, wrap circulaire).
- `data.jsx` — règles immuables : `CHARACTERS` (avec `inv`
  par défaut + images `ATH/`), `BUFFS`, `WEAPONS`, `LEVELS` (caps §3, cap PJ 20), `ATTRIBUTES`, `RUNE`, `JOURNAL`,
  `ITEM_CATALOG` (catalogue d'items pré-enregistrés pour l'ajout staff : `{cat,name,sub,ic,img,type}`).
  `mkChar` attache `attrs` + `modifiers` (ne bake **plus** `stats` : calcul live via `charBaseStats`,
  voir `game-logic.js`). (`ATTACK_MODES` **retiré** — voir Décisions.) Aussi : `char.bio` (description courte
  par perso, affichée au hub) ; **`PORTRAITS`** (`{charId: 'ATH/Perso/X.webp'}`, partagé hub + Équipement) ;
  **`MEMORIAL`** (`[{name,player,img,fell,epitaph,tale}]`, persos morts du hub — Lunick).
- `data-state.jsx` — hooks temps réel : `useCharState` (+ setters inventaire
  `setInvItem`/`removeInvItem` + équipement `setEquipment` + monnaie `setCoin`), `useAllCharStates`,
  `useSharedInventory` (inventaire commun), `useSharedCoins` (monnaie commune), `useAuthIdentity`
  (identité + `/users/{uid}`, auto-inscription), `useAllUsers`, `setUserAssignment`,
  `seedIfEmpty(role)` (réservé staff). Compétences : `setCounter`/`setCooldown`/**`setSkillBuff`** (sur
  `useCharState` ; `setSkillBuff(skillId, mods, until)` = buff sur soi, snapshot de mods plats +
  durée optionnelle (`until` = n° de tour de fin ; null = permanent jusqu'au ⟲ Combat).
  **XP** : orchestrateur `addXp(charId, gain)` (async, écriture staff : `getSnapshot`→`applyXp`→écrit
  `{level, xp}`, `pushLog` au level-up, retourne `{level, xp, levelsGained}` pour le toast appelant) +
  miroir `removeXp(charId, loss)` (async, écriture staff : `getSnapshot`→`applyXpLoss`→écrit `{level, xp}`,
  retourne `{levelsLost}` — corrige une saisie d'XP erronée ; bouton « −XP » côté MJ) ;
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
  Grille dark-fantasy partagée `InventoryGrid` (Équipement + coffre commun **+ fiche joueur** ; badge quantité
  en **OR** ; props `minCells` [plancher de cases, défaut 49 ; 14 sur la fiche] + `grow` [s'étend avec le
  contenu au lieu de scroller, pour la fiche]). **Rangement manuel** : les items sont triés par `item.order`
  (les items sans `order` restent à la suite) ; prop `onReorderItem(draggedId, targetId)` = drag & drop d'un
  item sur une case (item = insérer avant lui ; case vide = envoyer en fin) → `planReorder` (game-logic, pur,
  testé) réindexe 0..n-1 et persiste l'`order` (fiche : tous ; coffre commun : staff ; Équipement : non câblé
  pour ne pas casser le drag-vers-slot). Popovers `ItemActionMenu` / `AmountStepper` ;
  **`ItemCatalogPicker`** (modal de sélection rapide
  depuis `ITEM_CATALOG` → `AmountStepper` → `onPick(entry,qty)` ; bouton « Objet personnalisé » = filet) ;
  constantes `INV_*`/`inv*` (styles/format/filtres/pièces).
- `pages-sheet.jsx` — fiche joueur **refondue (layout B, 3 colonnes thématiques, largeurs égales** via
  `repeat(3,minmax(300px,1fr))`** ; un seul style — le sélecteur 3-styles `variant` a été RETIRÉ).
  Col 1 = **Vitalité** (`ResourceStack`) + **Survie** (`SurvivePanel` Fatigue/Eau) + **Consommables**
  (`HealPanel`) ; col 2 = **Statistiques** (`SecondaryStats`) + **Arme équipée** (`WeaponPanel`, info seule) +
  **Effets actifs** (`BuffsPanel`) ; col 3 = **Inventaire** (`FicheInventoryColumn` → `InventoryGrid`
  adaptatif, `minCells=14`/`grow`, clic → menu Utiliser/Éditer/Supprimer + `ItemCatalogPicker`) + (staff)
  **Modificateurs** (`ModifiersPanel`). **Stats en breakdown** : `SecondaryStats` affiche la valeur effective +
  le **bonus total en couleur** (`+N` vert/rouge) + le détail des sources (`base · +X buff · +Y mod · +Z stuff`),
  alimenté par `statBreakdown` (game-logic, pur, testé ; `base+buff+mod+stuff = effectif`, deltas marginaux
  honnêtes). **Consommables = vraies potions de l'inventaire** (`HealPanel` : items `cat:'Consommables'` qty>0
  + effet parsable via `parseConsumableEffect` ; clic consomme une unité [valeur réelle = `flat + pct% du max
  effectif`], décrémente/supprime à 0 ; **plus de potion → bouton masqué** ; fini les boutons potion infinis en dur).
  **Outils d'ajustement libres réservés au MJ** (`isStaff` : Soigner/Dégâts/Mana/Bouclier d'un montant + ↺ max ;
  les joueurs ne peuvent plus tricher). Jauge **bouclier à max dynamique** (`max(shieldMax, bouclier)`).
  Inventaire perso temps réel (migration unique `invInit`). **Arme affichée = celle équipée**
  (slot `armePrincipale` de `state.equipment`, reliée à `WEAPONS` par nom ; repli `char.weaponId`) ; le panneau
  « Arme équipée » est en info seule (l'action d'attaque est dans l'onglet Combat). Bourse **live** (dans le pied
  de `InventoryGrid`). **HealPanel plafonne sur les stats EFFECTIVES** (`eff.hp`/`eff.mana`).
- `pages-mj.jsx` — tableau de bord MJ temps réel (`mjLive(c, st)` fusionne règles+état).
  Le mini-sac des cartes lit l'inventaire **live** (`st.inventory`, items qty>0, images
  `item.img`), fallback `c.inv`. Édition d'un joueur = bouton **⛶ plein écran** → `SheetBody`
  (inventaire éditable, upload d'image inclus). Grille **responsive** (plus de scroll
  horizontal). **Section Ennemis** (désormais **partagés en Firebase** `combat/enemies`, lecture
  inscrits/écriture staff) : `useMJEnemies` (migré localStorage→Firebase, API inchangée),
  `EnemyCard` (HP/mana/**armure/resmag/crit/dcrit/léthalité** édition inline, « Subir » = dégâts joueurs→ennemi ; **contrôle 👁 Joueurs**
  Caché/Barre/Exact + presets % en mode Barre → écrit `reveal`/`revealPct`),
  `EnemyAttackModal` (ennemi→joueur : **`rollCrit`** au lancement [base vs crit + badge 🎲, bouton « relancer »],
  champ **léthalité** éditable → `mitigateDamage`(+léthalité)+`applyDamageToPools`, écrit `hpCur`/`shield`
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
- `pages-admin.jsx` — page Admin (staff) : attribution rôle + perso par compte (`AdminUserRow`),
  **gestion de l'inventaire par perso** (`CharInventoryAdminPanel` : sélecteur de perso →
  `useCharState` → `InventoryPanel` éditable + `ItemCatalogPicker`/`planItemAdd`, ajout/édition/
  suppression directe en BDD + jauge de poids) et **CRUD du catalogue partagé** (`CatalogAdminPanel`,
  `useItemCatalog`).
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
  **Jauge de poids** (poids porté / capacité `carriedWeight`/`carryCapacity`, rouge si surcharge).
  `EQUIP_SLOTS` = **12 slots** : les 4 pièces d'armure (épaule/cuirasse/gants/pantalon) ont été
  **fusionnées en un slot unique « Armure »** (`accepts` shoulders/chest/gloves/pants ; migration unique
  `armureInit` qui transfère l'ancien équipement vers le slot fusionné) ; un slot **« Ceinture »** porte
  la ceinture (item `carry` → capacité de charge). `equipTypeForItem` lit `item.type` en priorité (sinon infère :
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
  compteur + effet de stat en vert) + cartes **Actives** (mana, **badge CD statique** dans le coin
  [`1×/tour` / `CD N tours` / `1×/combat` / `Sans CD`, visible sans lancer la comp] + badge d'état
  prêt/tour, dégâts live, « Lancer »).
  `cast(sk, ctx, dmg, nbHits)` **respecte les variables d'attaque** (1er coup/camouflé/cases/cibles) ; une comp
  à **N cibles génère N attaques en attente** (un coup = une carte, chacune son `rollCrit`). **Garde « pas de
  cible »** : toute action à dégâts sans cible → toast + abandon (avant mana/cooldown). Données
  `SKILLS` (data.jsx) → `dmg*` pures de `game-logic.js` (transcrites des scripts `.gs`, **le script prime**).
  Compteurs/cooldowns en `state/counters`+`state/cooldowns` (cooldown = **`readyAt`** = n° de tour de dispo) ;
  variables d'attaque (1er coup / furtif / cases / cibles) en état local de carte. **Persos câblés** :
  Elias/Smith/Urskaar/Jett + **Rathael (C1 Frappe Irritée → C4 + ultime Souverain Glacial)** ; reste à faire :
  **Jett C3/C4** (kits pas encore reçus). Passif calculable (Elias +AD/charge plat ; **Rathael +5%/charge Armure+RM de base** via compteur
  Glaciation — `sumPassiveMods(charId,counters,level,base)`, 4e param `base`) branché via
  `sumPassiveMods`→`computeEffective`. **Glaciation auto-incrémenté** quand Rathael subit une attaque ennemie
  (`glaciationOnHit(counters,turn)`, +1/coup, max 5, tout stackable en 1 tour ; **+2/coup pendant Souverain Glacial**
  tant que `turn ≤ counters.souverainUntil` [fenêtre posée au cast via `sk.transform.turns`] ; appelé dans
  `EnemyAttackModal.submit` ; marque `glaciationHitTurn`). **Perte auto −3** en fin de tour s'il n'a pas été touché
  (`glaciationDecay(counters, endingTurn)`, dans `useSharedTurn.nextTurn`). Le stepper reste un override manuel. `cast` gère **`selfBuffFlat`** (buff
  plat, ex. Mur de Givre +20 AR/RM au niv 2) et **`counterBump`** (incrément conditionnel de compteur au cast) ;
  l'`eff` de la page Combat inclut les `skillBuffs` (aligné fiche/équip). **Durée de buff** : une comp avec
  `duration:{min,max}` (ex. Mur de Givre 1/2 tours) affiche un sélecteur sur sa carte ; `cast` snapshote
  `until = turn + (durée−1)` dans le buff → auto-expiration (filtrée par `sumSkillBuffs(buffs, turn)`, sans purge).
  Visible des 3 rôles, sélecteur
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
- `pages-progression.jsx` — onglet **Progression** (`ProgressionPage`) : XP + **respec** (répartition des 4
  caracs) + table des paliers 1→18. Visible des **joueurs** (`prog` ajouté à `PAGE_ACCESS.joueur`, en barre
  principale via `groupByRole:{joueur:'main'}` ; `lockedCharId` = perso du joueur ; staff = sélecteur libre +
  case « Verrouillé »). Steppers par caracs (brouillon local → « Confirmer »), budget = `LEVELS.total +
  CREATION_BONUS`, cap = `LEVELS.limit`, plancher 0 ; **aperçu live** des stats résultantes (`computeStats`).
  **Verrou** : un joueur respec **une fois** → `setAttrs(draft,true)` (écrit `attrs`+`attrsLocked`) ; le staff
  édite librement + (dé)verrouille (`setAttrsLocked`). Logique pure `attrSum`/`respecValid` (game-logic, testées).
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
    inventory: { [itemId]: { id, cat, name, sub, qty, ic, img, type, mods, weight, carry, order } }   ← perso, éditable (order = rangement manuel, cf. planReorder)
    invInit:   true   ← marqueur de migration (amorçage unique de l'inventaire)
    equipment: { [slotKey]: itemId }   ← paperdoll (page Équipement), temps réel ; slotKey ∈ EQUIP_SLOTS (12 slots, armure fusionnée + ceinture)
    armureInit: true   ← marqueur de migration (fusion des 4 slots d'armure → slot « armure » unique)
    coins:     { plat, or, arg, cuiv }   ← monnaie perso (entiers ≥ 0), via setCoin / moveCoins
    coinsInit: true   ← marqueur de migration (amorçage unique des pièces)
    runes:     { selected:{[nodeId]:true}, choices:{[nodeId]:'ad'|'ap'} }   ← arbre de runes (page Runes)
    runeBonus: 0   ← points de rune bonus accordés par le MJ (test / montée de niveau) ; budget = level + runeBonus
    level:     2   ← niveau effectif (entier ≥ 1, stepper staff onglet Compétences) ; défaut = char.level ; pilote déblocage des comps + passif + budget runes + STATS (socle moteur refondu)
    attrs:       { force, hab, mental, magie }   ← caracs (respec, onglet Progression) ; ABSENT par défaut → repli char.attrs ; lu par charBaseStats ; écrit par setAttrs
    attrsLocked: true   ← verrou après respec joueur unique ; le staff peut éditer/déverrouiller (setAttrsLocked)
    counters:  { [key]: n }   ← compteurs de compétences (chasseur/marques/tranches/cn…), steppers manuels
    cooldowns: { [skillId]: readyAtTurn }   ← cooldown = n° de tour de disponibilité (999999 = 1×/combat)
    skillBuffs: { [skillId]: { mods:{ [stat]: n }, until:<n° de tour>|null } }   ← buffs sur soi (mods PLATS snapshotés au cast, ex. Urskaar C4 +30% PV/AD/Armure de base) ; until = tour de fin (auto-expiration via sumSkillBuffs(buffs,turn), ex. Mur de Givre 1/2 tours), null = permanent ; ancienne forme plate { [stat]:n } encore lue (compat) ; effacés par « ⟲ Combat »
/campaign/runeterra/sharedInventory/{itemId}/   ← inventaire COMMUN partagé (R/W tout participant)
    { id, cat, name, sub, qty, ic, img, type, mods, weight, carry }
/campaign/runeterra/sharedCoins/   ← monnaie COMMUNE (coffre) : { plat, or, arg, cuiv } (R/W tout participant)
/campaign/runeterra/combat/turn   ← compteur de tour PARTAGÉ (nombre ≥ 1) ; lecture inscrits, écriture staff
/campaign/runeterra/combat/enemies/{id}   ← ennemis PARTAGÉS { name, hpCur, hpMax, manaCur, manaMax, atk, armure, resmag, note, crit, dcrit, lethaAD, lethaAP, reveal, revealPct } ; lecture inscrits, écriture staff
                                              crit (%) + dcrit (% dég. crit, défaut 200) + lethaAD/lethaAP (léthalité physique/magique) = crit/léthalité ennemi→joueur (rollCrit au lancement ; léthalité AD→armure si physique, AP→rés. mag si magique, via mitigateDamage)
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

**Cache-busting (IMPORTANT à chaque déploiement de code) :** les scripts/CSS locaux d'`index.html`
portent un jeton `?v=…` (et `window.APPV`). **Bumper ce jeton à chaque push de code** (search-replace
de l'ancienne valeur, ex. `20260622-1` → `20260622-2`), sinon le navigateur/CDN sert l'ancienne version
(zéro-build, pas de hash automatique). Sans ça, les joueurs voient l'ancien code malgré le déploiement.

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
- **Sélecteur de 3 styles visuels RETIRÉ** (refonte fiche 2026-06-29) : un seul style abouti, fin de
  l'expérimentation Tablettes/Hextech/Codex. (Le sélecteur de **perso** reste, staff only.)
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

## État actuel (2026-06-29)
- **Refonte fiche joueur — mergée sur `main`** (merge `4ba147d`, cache `20260628-1`). 127 tests verts.
  **Aucune nouvelle règle RTDB, aucun changement de schéma.** Spec/plan :
  `docs/superpowers/{specs,plans}/2026-06-28-refonte-fiche-joueur*`. Contenu :
  1. **Layout B** (3 colonnes thématiques de largeurs égales) ; retrait du sélecteur 3-styles `variant`
     (un seul style) et du code mort des variantes b/c.
  2. **Breakdown des stats** : `SecondaryStats` affiche valeur effective + bonus `+N` en couleur + détail
     `base · +buff · +mod · +stuff` (`statBreakdown` pur testé ; `base+buff+mod+stuff = effectif`).
  3. **Consommables réels** : `HealPanel` lit les potions de l'inventaire (valeur réelle, gating qty, plus de
     potion = bouton masqué) ; `parseConsumableEffect` déplacé en logique partagée. Fini les potions infinies en dur.
  4. **Anti-triche** : outils d'ajustement libres (soin/dégâts/mana/bouclier d'un montant + ↺ max) **réservés au MJ**.
  5. **Inventaire en `InventoryGrid` adaptatif** (`minCells`/`grow`) — même visuel que commun/Équipement.
  - ⏳ **Non encore poussé sur `origin/main`** au moment de cette note (merge local ; à `git push` pour déployer).
- **Automatisation ultime Rathael (Souverain Glacial)** — mergée (`5efe226`) : `transform:{turns:4}` pose
  `souverainUntil` au cast → `glaciationOnHit` donne **+2 charges/coup** pendant l'ultime (+1 sinon, max 5).
  Charges Glaciation entièrement automatisées (+1/coup illimité par tour, −3/tour sans dégât).

## État actuel (2026-06-24)
- **Lot demandes MJ post-crash — mergé sur `main` et déployé** (`bd925bf`, cache `20260624-2`). 120 tests
  verts. Aucune nouvelle règle RTDB. Contenu :
  1. **Retrait d'XP** : `applyXpLoss` (game-logic, miroir d'`applyXp`, cascade + plancher) + orchestrateur
     `removeXp(charId, loss)` (data-state) + bouton « −XP » côté MJ — corrige une saisie erronée.
  2. **Fusion des slots d'armure** : épaule/cuirasse/gants/pantalon → **un slot « Armure » unique**
     (`EQUIP_SLOTS` passe à 12 slots, `accepts` multi-types, migration unique `armureInit`).
  3. **Système de poids** : items `weight`/`carry` ; `carriedWeight`/`carryCapacity`/`weightStatus`
     (game-logic, testés) ; capacité = `CARRY_BASE + force×CARRY_PER_FORCE + Σ item.carry équipés` —
     **la ceinture = un item `carry`** (+ slot « Ceinture ») ; jauge de poids sur fiche + Équipement.
  4. **Badge CD statique** sur chaque carte de compétence Combat (`1×/tour` / `CD N tours` / `1×/combat` /
     `Sans CD`) — lisible sans lancer la comp.
  5. **Gestion d'inventaire par perso en Admin** (`CharInventoryAdminPanel`) : sélecteur de perso →
     ajout (catalogue/perso) / édition / suppression directe en BDD + jauge de poids.
  6. **CRUD du catalogue partagé** en Admin (`CatalogAdminPanel`, déjà livré dans le lot).

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
- **Lot améliorations graphiques** (brainstormé 2026-06-28, chantiers indépendants — chacun sa spec/plan) :
  **A — Refonte fiche joueur = FAIT** (voir État actuel 2026-06-29). Restent :
  **C — Hub d'accueil vivant** (remplacer la page Accueil mockup `pages-lobby.jsx` — boutons « Rejoindre/Créer
  session » + code `VX-7K2` factices, invisible des joueurs — par un vrai tableau de bord : roster du groupe
  PV/mana live, séance en cours, dernier récap, état du combat) ; **B — Arbre de runes en vrai arbre visuel**
  (nœuds + liaisons SVG façon LoL ; le contenu/logique existe déjà, c'est du graphique) ; **D — Passe
  d'animations** transversale (transitions d'onglets, level-up, etc.). Ordre suggéré : A→C→B, D en continu.
- **Nouveau système d'attaque de base** (brainstorm en pause à la demande du MJ) : catégories d'armes
  (`info-mj/Nouveau système de gestion des attaques de base (2).md`) + **maîtrise par perso×arme** (−25 % +
  perte des propriétés si non maîtrisée), idée de **maîtrise qui progresse à l'usage**. À reprendre.
- **Inventaire + Équipement : clos côté code** (perso + commun, transferts, catalogue, plafond 99,
  monnaie vivante, paperdoll, `item.mods` branchés). Reste uniquement de la **saisie de contenu** :
  créer les **armures réelles** avec leur `type` + leurs `mods` (jusqu'ici seuls armes & accessoires
  ont un `type` câblé) — pas de dev, juste remplir `ITEM_CATALOG` / l'éditeur.
- **Compétences** : **implémentées et déployées** (Elias/Smith/Urskaar/Jett + **Rathael complet C1→C4 + ultime**).
  Le passif Rathael (+5%/charge Armure+RM de base) calcule un mod plat depuis les stats de
  base (`sumPassiveMods(...,base)`). Charges Glaciation **automatisées** : +1/coup subi (tout stackable en 1 tour,
  max 5 ; +2/coup pendant Souverain Glacial via `souverainUntil`) ; −3/tour sans dégât (`glaciationDecay`). **À FAIRE
  plus tard** : (1) **comps Jett C3/C4** (kits pas encore reçus) à ajouter dans `SKILLS` + `game-logic.js` ;
  (2) automatiser l'état Âme fendue de Rathael à 5 charges (aujourd'hui narratif/manuel) ; (3) Phase 2 :
  auto-application des dégâts aux ennemis (aujourd'hui le MJ saisit le nombre dans « Subir »).
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
  **Respec joueur = FAIT et déployé** (onglet Progression, voir plus haut : budget `LEVELS.total+CREATION_BONUS`,
  caps `LEVELS.limit`, verrou unique joueur + (dé)verrouillage staff ; `setAttrs`/`setAttrsLocked`,
  `attrSum`/`respecValid` testés). **Reste** (sous-projets séparés) : (1) **équipement en stats finales**
  (armes 3 paliers + 18 armures §7) ; (2) **zone PNJ/divine** (escalade quadratique >20 §8 ;
  `escalationFactor` gère déjà >20). **Crit/léthalité ennemi→joueur = FAIT (2026-06-22)** : `makeEnemy`
  +`crit`/`dcrit`/`letha`, édition inline `EnemyCard`, `EnemyAttackModal` roule le crit (`rollCrit`) + applique
  la léthalité (`mitigateDamage`). Aussi livré ce jour : **vol de vie/sapience/omnivamp** (soin de l'attaquant à
  la résolution MJ, séparation par source : attaque de base→vol/sapience, comp→omnivamp ; `lifestealHeal` testé,
  orchestrateur `healCharacter`). Aucune règle RTDB.

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
