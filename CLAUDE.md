# CLAUDE.md — Chroniques de Runeterra (outil de campagne JDR)

Mémoire de projet pour les prochaines sessions. Lis-moi en premier.

## Ce que c'est
Outil web pour gérer une campagne de JDR maison (univers Runeterra/LoL), utilisé
en vrai par le MJ et 5 joueurs.

**Qui est qui (corrigé le 2026-08-21 — les notes antérieures attribuaient le rôle de MJ à
Akeltroll)** : le **MJ est Woolost**, compte applicatif de rôle `mj` ; **Akeltroll / JB est
l'`admin`** du projet, et joue Rathäel. Les deux contribuent au code.

⚠️ **Direction assumée par le MJ (2026-08-21) : le rôle `mj` se rapproche naturellement de
l'`admin`**, le MJ se considérant désormais autant développeur du projet que l'admin actuel.
**En cas de doute sur une permission staff, trancher en faveur du MJ plutôt que de réserver à
`admin`.** C'est ce qui a motivé l'ouverture de l'import de sauvegarde au rôle `mj`
(`582edae`, §10.3 du document de reprise monnaie). Corollaire : une fonctionnalité réservée à
`admin` qui bloque le MJ dans son usage quotidien est probablement un défaut, pas une décision.
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
  `computeStats(F,H,M,C,level,hab)` (**9 stats** dérivées, **répartition rechiffrée par le MJ le 2026-09-04** :
  magnitude escaladée via `escalationFactor(p)` [tranches de 4, table §4.3, zone PNJ quadratique >20]
  + socle de niveau + bonus de départ Habileté (`HAB_START_HP`, PV dégressifs 25/20/15/10/5, **plus
  d'AR/RM**) + fondu ; **sans Sapience**, retirée du socle)
  + `charBaseStats(char,state)` (base **live** : caracs effectives
  `state.attrs ?? char.attrs`, niveau `state.level ?? char.level`).
  ⚠️ **Asymétrie volontaire : la magnitude est escaladée, les POURCENTAGES sont LINÉAIRES**
  (`crit`, `dcrit`, `rescrit` se calculent sur les points BRUTS — les escalader donnerait 86 % de
  rés. crit à 20 Mental au lieu de 60 %). Par point : Force 20 PV/5 Mana/25 AD/**2 Armure** ;
  Habileté bonus de départ/**au choix par point : +5 AD, +5 AP ou +10 Mana**/**2,5 %Crit**/**4 %D.Crit** ;
  Mental **45 PV + 15 Mana garantis, puis 15 points AU CHOIX (+15 PV ou +15 Mana, cf. `mentalSplit`)**/**3 %Rés.Crit** ;
  Magie 10 PV/30 Mana/25 AP/**2 Rés.Mag**. Socle : `50+30·niv` PV, `50+15·niv` Mana, `+1` AR et RM/niveau.
  ⚠️ **CALIBRAGE DU 2026-09-05 (spec `docs/superpowers/specs/2026-09-05-calibrage-attaques-base-design.md`,
  qui FAIT FOI)** : (A) `LEVELS` recalibré, budget total ≈ **1,65 × cap** — on ne peut plus monter deux
  caracs au plafond (avant, 12 pts et cap 6 forçaient 6/6, si bien qu'un ADC et un assassin étaient le
  MÊME perso au niveau 2) ; (B) `escalationFactor` ramenée à **+1 %/pt**, compensée par
  **`globalEscalation(total)` à +0,49 %/pt** — la prime d'un build 2 caracs sur un build 3 caracs tombe
  de 15 % à 6 %, le total au niveau 18 en 20/14 restant identique (46.2) ; (C) crit **`5+2,5·H`** /
  dcrit **`150+4·H`** (au lieu de `5+10·H` / `150+6·H`) — les deux se multipliant, l'ancienne paire
  valait **×3,23** de dégâts moyens à 20 d'Habileté contre ×1,02 sans, ce qui donnait à Urskaar le
  meilleur AD du jeu au niveau 18 pour **les plus faibles dégâts réels**. Nouvelle borne ×1,71
  (coup critique ×2,30). Corollaire : **le surcrit (seuil 100 %) n'est plus atteignable par les caracs
  seules** — il passe par l'équipement et les runes.
  ⚠️ **`mentalSplit` absent = défaut TOUT EN PV**, et c'est ce qui rend la décision D indolore :
  45 + 15 = 60, l'ancien coefficient → **les PV des persos existants ne bougent pas d'un point** et la
  matrice de TTK de la spec reste valide sans migration. Seul le Mana baisse de 25 %. Le total par point
  passe de 80 à 75 : la flexibilité se paie de 5 Mana, c'est voulu. **Ne pas changer ce défaut sans
  re-vérifier la matrice.** Même ruling que l'Habileté : escalade distribuée au prorata → répartir ne
  coûte rien.
  ⚠️ **Chaîne de résolution d'une attaque, à connaître pour tout calibrage** :
  `affiché × crit × 0,625 (d20) × (1 − AR/(AR+120))`. Le **facteur d20 vaut 0,625** (1-5 échec,
  6-10 demi, 11-20 plein). Une attaque de base retire ~20-25 % des PV d'un pair ; le TTK tient dans
  ±0,3 attaque du niveau 1 au 18. **L'AA est l'unité de mesure du calibrage des compétences.**
  ⚠️ Les cibles de PV du **§9 de la spec hypermétrique ne sont plus valides** (le test les a
  remplacées par un verrou de non-régression du nouveau modèle, pas une preuve de conformité).
  **`critMultAfterResist(multiplier, rescritPct)`** (pure, testée) = application de la **résistance
  critique** : elle ne réduit PAS la chance de crit mais la part de dégâts **au-dessus de 100 %**
  (150 % contre 15 % de rés. → **142,5 %** ; contre 60 % → 120 %). ⚠️ C'est cette forme qui garantit
  qu'un crit ne peut jamais faire **moins** qu'un coup normal — ne pas la remplacer par une réduction
  du multiplicateur entier, il faudrait alors un plancher artificiel. Bornée à 100 %.
  ⚠️ **Appliquée à la RÉSOLUTION MJ, jamais au cast** : le crit est roulé côté joueur, mais la cible
  peut changer (`EnemyAttackModal`) et seul le MJ voit les stats du défenseur. Les deux sites sont
  `PendingHitRow` (joueur→ennemi, lit `enemy.rescrit`) et `EnemyAttackModal` (PNJ→PJ via
  `mjLive(...).eff.rescrit`, PNJ→PNJ via le champ de l'ennemi).
  **`habSplit(F,H,C,split)`** / **`defaultHabSplit(F,H,C)`** / `HAB_DESTS` (purs, testés) =
  **répartition de l'Habileté** : chaque point donne, au choix du joueur, **+5 AD**, **+5 AP** ou
  **+10 Mana** (onglet Progression, persisté dans `state.habSplit = {ad, ap, mana}` = nombre de
  points par destination).
  ⚠️ **L'ESCALADE EST GARANTIE À CHAQUE POINT** (ruling MJ, 2026-09-04) : le facteur est calculé sur
  le **TOTAL** d'Habileté puis distribué **au prorata** (`hUnit = escalationFactor(H)/H`), si bien
  qu'un point vaut autant où qu'il aille et que **répartir ne coûte rien**. C'est délibéré — le MJ
  veut encourager des répartitions personnelles. ⚠️ Ne PAS revenir à une escalade appliquée à chaque
  part séparément : une version intermédiaire le faisait et pénalisait l'hybridation de ~20 % à
  20 points, exactement l'inverse de l'intention.
  ⚠️ **`habSplit` absent ≠ tout à 0** : absent = jamais confirmé → défaut par **carac de dégâts
  dominante** (Force ≥ Magie → AD, sinon AP), ce qui donne une valeur juste aux 5 PJ **sans
  migration** (Jett part en AP, les 4 autres en AD). La page Progression n'oppose son plancher (pas
  de re-routage des points déjà placés) **qu'une fois la répartition confirmée** — sinon un défaut
  deviné deviendrait un choix imposé. Une répartition **sous-allouée** voit son reliquat partir sur
  la destination par défaut plutôt que d'être perdu (un point non placé qui ne rendrait rien serait
  un vol silencieux) ; **sur-allouée**, elle est servie dans l'ordre `ad → ap → mana` et coupée au
  budget. Compat : l'ancien champ `state.habAd` (AD seul, a vécu une journée) est encore relu par
  `charBaseStats` et purgé au prochain « Confirmer ».
  ⚠️ Le crit, les dégâts crit et le bonus de PV de départ restent calculés sur le **TOTAL**
  d'Habileté : seule la valeur « dirigeable » (attaque / mana) est répartie.
  ⚠️ **`clampSplitDraft` (pages-progression) n'est PAS `habSplit`** : le brouillon de l'UI ne
  réaffecte **pas** le reliquat, sinon un point retiré d'une ligne y reviendrait aussitôt et le
  « + » des autres lignes resterait inerte. Un point retiré retourne dans une réserve « à placer »,
  et « Confirmer » attend qu'elle soit vide — même contrat que les points de caractéristiques.
  **XP** : `xpToNext(level)` (courbe officielle du MJ
  `180 + 100*level` = `info-mj/tableau_XP.png` ; **cap niveau 18** → `Infinity` au cap, `MAX_LEVEL=18`)
  + `applyXp(level, xp, gain)` (montée auto avec report du surplus en cascade, figée au cap)
  + `applyXpLoss(level, xp, loss)` (miroir : descente en cascade, plancher niveau 1 / xp 0 — corrige une
  saisie d'XP erronée). **Poids porté** : `carriedWeight(items, mental, equipment, coins)` (Σ `weight×qty`,
  armure du slot `armure` allégée par le Mental, **+ le poids de la bourse** si `coins` est fourni — 4e param
  optionnel, les appels sans lui sont inchangés), `carryCapacity(force, mental, level, equipment, itemsById)`
  (= `CARRY_BASE`(**30**) + `force×CARRY_PER_FORCE`(5) + **`mental×niveau÷10`** + Σ `item.carry` des items
  équipés, arrondi inférieur — **la ceinture = un item avec `carry`**), `comfortPct(hab)` (seuil de confort
  = 60 % + Hab×2 %, plafond 90 %), `weightStatus(carried, cap, hab)` (`{pct, over, comfort, comfortPct,
  state}` où `state` ∈ `leger`/`encombre`/`surcharge` ; affichage seul, le MJ arbitre la surcharge),
  `ARMOR_CLASSES`/`armorWeightReduction`/`armorEffectiveWeight`. Items : champs `weight` (poids unitaire)
  + `carry` (bonus de capacité **personnelle**, canal `p` — objet équipé, réservé à `cat==='Équipement'`)
  + **`carryGroup`** (bonus de capacité du **groupe**, canal `g` — **toutes catégories**) + `armorClass`.
  **Capacité COMMUNE du coffre** : `carryBaseRaw(force, mental, level)` (terme brut non arrondi, sans
  bonus — partagé avec `carryCapacity`), `groupCarryBase(profiles)` (Σ brute, **conforme au doc MJ**),
  `GROUP_CARRY_RATIO` (0,30 — voir l'écart assumé ci-dessus),
  `groupCarryCapacity(profiles, bonusGroup)` (⌊Σ×ratio + attelage⌋, arrondi **une seule fois à la fin** :
  ⌊74,34⌋ = 74 et non 73), `groupComfortPct(profiles)` (moyenne des conforts individuels),
  `weightStatusPct(carried, cap, pct)` (seuil donné en fraction). **Attelage** : `TRANSPORT_SLOTS`
  (2 montures + 3 sacs), `transportAccepts(slot, item)` (exige `carryGroup > 0` ; respecte le `type`
  `mount`/`pack` **sauf pour un objet non typé, qui passe partout** — le champ « Emplacement » n'existe
  que pour `cat==='Équipement'`, un sac en Butin ne PEUT pas être typé), `sumTransportCarry(transport,
  items)` (Σ des objets attelés, dédoublonné, par pile).
  **Poids de la monnaie** (guide d'économie §3, livré le 2026-08-21) : `COIN_PER_WEIGHT`
  (pièces pour 1 unité de poids — cuiv 200 / arg 100 / **or 67** / plat 200) + `coinsWeight(coins)`.
  ⚠️ Barème **non monotone avec la valeur, et c'est voulu** : l'**or est la plus LOURDE**, le **platine la
  plus LÉGÈRE** — ne pas « corriger » l'ordre. Valeur **exacte, jamais arrondie** en interne (décision MJ :
  199 cuivres pèsent 0,995 et non 0) ; l'arrondi à 1 décimale est purement d'affichage (`invWeightFmt`,
  components.jsx). Branché sur les 2 jauges de charge (Équipement, Admin) + le pied de `InventoryGrid`
  (« ⚖ N » à côté des pièces → visible sur fiche, coffre commun et Équipement).
  **Monnaie** : `COIN_VALUE` (valeurs en cuivre : cuiv 1 / arg 100 / or 10 000 / plat 100 000 — soit
  100 cuivre = 1 argent, 100 argent = 1 or, 10 or = 1 platine, cf. `info-mj/Économie - guide des joueurs.md`)
  + **journal d'économie** (textes purs, testés) : `COIN_NAME`, `coinsAmountText(coins)` (« 2 or, 15 cuivre »),
  `coinsDeltaText(before, after)` (« +2 or, −15 cuivre » ; `after` peut être un patch PARTIEL, clé absente =
  inchangée), `coinsDeltaValue(before, after)` (valeur nette en cuivre → couleur de l'entrée ; **0 = change de
  monnaie compensé**) + `LOG_MAX`(30)/`staleLogIds(map, max)` (ids des entrées à élaguer, les plus anciennes).
  **Contrat de la règle RTDB `state/coins/$coin`** (entier >= 0) porté côté code par `coinInt(v)` (utilisé
  par `buildDefaultState`) et `sanitizeCampaignCoins(data)` (assainit une sauvegarde importée, MUTE `data`,
  rend le nombre de corrections) — les deux écritures qui portent **tout un sous-arbre d'un coup**
  + `planCoinConvert(coins, from, to, n)` (pur, testé : conversion **dans les deux sens** ; vers le bas =
  exact, vers le haut = seuls les multiples entiers passent et **le reste est laissé dans la bourse**,
  jamais arrondi ni perdu ; `n` borné au solde ; renvoie `null` si rien n'est convertible).
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
  `grantCoins(charId, patch)` (don additif d'argent : `getSnapshot`→ajoute `{plat,or,arg,cuiv}`→écrit ; récompense de séance) ;
  **`setCharCoins(charId, patch)` / `setSharedCoins(patch)`** (écriture LIBRE d'une bourse : valeurs **absolues**
  clampées ≥ 0, merge par dénomination via `writeCoins` — c'est la seule voie qui permet de **retirer** des pièces ;
  alimente l'éditeur MJ `CoinEditor`). `COIN_KEYS` = les 4 dénominations (source unique).
  `useSharedTurn` (tour partagé ; `resetCombat` **async** : efface counters/cooldowns/`skillBuffs`/`combat/log`
  ET **ramène PV/bouclier aux caps de base** via `computeEffective` sans skillBuffs). **Plateau partagé** :
  `useMJEnemies` (ennemis Firebase), `usePendingHits` (file d'attaques), orchestrateur `applyHitToEnemy`
  (`mitigateDamage`→`applyDamageToPools`→PV ennemi) ; **journal** `pushLog(text,kind)`/`useCombatLog()`
  (`combat/log`, ~30 derniers). **Journal d'économie SÉPARÉ** (`ECONOMY_LOG` = `campaign/runeterra/economyLog`) :
  `pushEconomyLog(text,kind)` + `useEconomyLog()` (lecture **staff only**, **jamais purgé par « ⟲ Combat »**,
  élagage à `LOG_MAX` via `staleLogIds` fait **à la lecture côté staff** — les joueurs n'ont que le droit
  d'écrire) + `purseName(path)` (nom lisible d'une bourse depuis son chemin RTDB).
  **Les 3 orchestrateurs de pièces journalisent** : `moveCoins` (transfert, `gold` — le seul déclenché par
  les **joueurs**, donc le plus important), `grantCoins` (récompense, `buff`), `writeCoins` (**devenu async** :
  `getSnapshot` préalable pour calculer le delta d'une édition MJ ; couleur selon `coinsDeltaValue`).
  ⚠️ Les deux `setCoin` morts (jamais branchés à une UI) ont été **supprimés** — plus aucune voie d'écriture
  de pièces non journalisée. Orchestrateurs de transfert RTDB `moveItem` (via `planItemTransfer`) /
  `moveCoins` (via `planCoinMove`) — **tous deux `async` et relisant les DEUX côtés via `getSnapshot`** :
  ils **ignorent** l'état passé en paramètre (cf. bug de bourse écrasée, État actuel 2026-08-21). Constantes `CAMPAIGN = 'campaign/runeterra'`, `SHARED_INV`, `SHARED_COINS`, `COMBAT_TURN`,
  `ENEMIES`, `PENDING_HITS`, `COMBAT_LOG`.
- `components.jsx` — UI partagée : `Avatar`, `ResourceBar`, **`XpBar`** (barre d'XP lecture seule :
  `xp/xpToNext(level)` + label niveau), `BuffBadge`, toasts
  (`renderToastMsg` = rendu sûr, seul `<b>` autorisé), **`CombatLog`** (journal de combat
  partagé lecture seule, lit `useCombatLog` ; prop `canClear` = bouton « Vider » staff), `LoginScreen`,
  `PendingScreen`, `SignOutButton`, `NumberStepper`, `ExportImportPanel` (import **assaini**
  via `sanitizeCampaignCoins` + **try/catch avec toast d'erreur** — sans lui un rejet de règle
  échouait en silence),
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
  testé) réindexe 0..n-1 et persiste l'`order` (fiche : tous ; coffre commun : staff ; Équipement : staff/joueur).
  Le drag des items de la grille porte un marqueur `x-inv-reorder` ; les cases ne réclament le drop **que** s'il
  est présent — un item glissé depuis un slot d'équipement (non marqué) remonte au conteneur `onDropItem`
  (déséquiper), donc réorganisation et drag-vers-slot coexistent.
  **`ItemTooltip`** = infobulle d'objet partagée (nom, description, classe d'armure, bonus de stats, poids) ;
  `InventoryGrid` gère son propre survol et l'affiche → **fiche joueur, coffre commun et grille Équipement
  l'ont automatiquement**. Elle sert aussi aux **slots du paperdoll** (`pages-equip.jsx`), seul endroit qui lui
  passe `effWeight` : les 3 grilles excluent déjà les objets équipés, donc le poids de base y est toujours bon.
  **`invWeightLabel(item, effUnit)`** = libellé de poids (unitaire, ou `unitaire × qty = total` pour une pile ;
  `null` si l'objet ne pèse rien ; `(base N)` en vert si allégé par le Mental).
  Popovers `ItemActionMenu` / `AmountStepper` ; **`CoinEditor`** (modal d'édition de bourse réservé au MJ :
  les 4 dénominations en **valeur absolue** pré-remplie + delta coloré par ligne + « Tout à 0 » ; `onApply` ne
  reçoit que les dénominations modifiées → `setCharCoins`/`setSharedCoins` ; contient aussi le **change de
  monnaie** — `planCoinConvert` appliqué au **brouillon**, donc prévisualisé dans les champs, annulable, et
  écrit en une seule fois au « Appliquer ») ; `INV_COINS` = **source unique** des 4 monnaies (libellé, image,
  couleur), `invCoin(key)` + **`CoinIcon`** (pastille partagée grille/éditeur/cartes MJ) ;
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
  **Jauge de charge du coffre** (`CommonWeightBar`) : capacité = Σ des capacités des 5 persos
  (`useGroupCarry`→`groupCarryCapacity`) + attelage, confort = moyenne (`groupComfortPct`), poids =
  `carriedWeight(items, 0, {}, sharedCoins)` — **appelé sans `equipment`** : le coffre n'a pas de porteur,
  donc pas de réduction Mental sur l'armure (§7 du doc). **`TransportRack`** = les 5 emplacements
  d'attelage (glisser-déposer depuis la grille, ou clic → liste des objets éligibles ; clic sur un slot
  occupé = dételer), persistés dans `sharedTransport`.
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
- `pages-journal.jsx` — onglet **Journal** (`JournalPage`, staff) : **deux sections** basculées par un bouton
  (`JOURNAL_SECTIONS`, état local) — **⚔ Combat** (`combat/log` via `useCombatLog` ; filtres tous/actions/buffs/KO)
  et **💰 Monnaie** (`economyLog` via `useEconomyLog` ; filtres tous/transferts/gains/retraits). Chaque section a
  son propre « Vider » (celui de la monnaie **demande confirmation** : c'est la seule trace des transferts depuis
  le coffre commun). Horodatage, lecture seule, alimenté par `pushLog` / `pushEconomyLog`.
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
- `firebase.json` + `.firebaserc` — **config de la CLI Firebase** (créés le 2026-08-21 ; ils n'avaient
  jamais existé, d'où l'ancienne obligation de publier les règles à la main en console).
  `firebase deploy --only database` depuis la racine publie `database.rules.json` sur l'instance
  `runeterra-jdr-default-rtdb` (europe-west1, nommée explicitement — pas de résolution d'un défaut).
  ⚠️ **`firebase.json` ne déclare QUE `database`, volontairement pas `hosting`** : le site est sur
  GitHub Pages, et sans bloc `hosting` un `firebase deploy` nu ne peut pas publier par mégarde une
  seconde copie du site. Ne pas confondre avec `firebase-config.js`, qui est l'init du SDK **côté
  navigateur** et ne déploie rien. Prérequis, une fois : `npm i -g firebase-tools` + `firebase login`.
  La CLI **n'affiche aucun diff** avant d'écrire : comparer les règles en ligne avec le fichier du
  dépôt reste nécessaire. La voie console (coller → Publier) reste valable en secours.
  ✅ **Comment LIRE les règles en ligne** (trouvé le 2026-08-22 — il n'y a pas de `database:rules:get`) :
  `MSYS_NO_PATHCONV=1 firebase database:get "/.settings/rules" --instance runeterra-jdr-default-rtdb`.
  ⚠️ **Le préfixe `MSYS_NO_PATHCONV=1` est OBLIGATOIRE depuis Git Bash** (vérifié le 2026-09-02) :
  sans lui, MSYS convertit `/.settings/rules` en chemin Windows et la CLI répond
  `Error: Path must begin with /` (exit 1). Ce n'est pas un problème de droits.
  ⚠️ Le code de sortie a déjà été **255** malgré une sortie correcte (ne pas conclure à un échec) ;
  en CLI 15.28.1 il vaut **0**. Se fier à la sortie, pas au code. C'est ce qui permet de vérifier **avant** (dérive
  console ?) et **après** (le déploiement fait-il ce qu'on croit ?) chaque publication.
  Attention en PowerShell : `Out-File -Encoding utf8` ajoute un **BOM** qui fait diverger le `diff`
  sur la 1re ligne — le retirer avant de comparer (`sed 's/^\xef\xbb\xbf//'`).
- `database.rules.json` — règles RTDB strictes basées sur `/users/{uid}` (rôles) :
  joueur = sa fiche seule, staff = tout ; **`campaign/runeterra` a un `.write` `mj`+`admin`**
  (ouvert au MJ le 2026-08-21 pour l'import de sauvegarde — `setPath(CAMPAIGN,…)` écrit sur le nœud
  racine ; les `.validate` des descendants continuent de s'appliquer, et `/users` n'est pas
  concerné : un MJ ne peut toujours pas se promouvoir admin) ; **`combat/log` et `economyLog` ont un `.write` STAFF au
  niveau du NŒUD** (purger = écrire sur le nœud ; le `.write` sur `$logId` ne suffit pas — cf. bug
  du 2026-08-21) ; **`characters/$charId/state/coins/$coin` = `.validate` entier >= 0** (le reste du sous-arbre perso n'est toujours validé nulle part) ;
  **`characters/$charId/state/attrs` et `/level` ont un `.read` ouvert à TOUS les inscrits** (2026-08-21,
  capacité commune du coffre : elle a besoin des caracs des 5 persos ; le reste de la fiche — PV, bourse,
  modificateurs, XP, runes, inventaire — **reste cloisonné**, et aucune écriture n'est élargie) ;
  **`sharedTransport` = R/W tout participant inscrit** (attelage du groupe : ranger la monture n'est pas
  un acte de MJ ; `.validate` = chaîne ou suppression) ; `sharedInventory` = R/W pour tout participant
  inscrit, écriture au niveau `$itemId` ; `sharedCoins` = R/W tout participant inscrit,
  `.validate` par dénomination (nombre ≥ 0) ; `combat/turn` = lecture tout inscrit, **écriture staff**
  (nombre ≥ 1) — tour partagé ; `combat/enemies` = lecture inscrits, **écriture staff** (ennemis
  partagés) ; `combat/pendingHits` = lecture inscrits, **écriture tout inscrit** (un joueur propose
  une attaque ; le staff applique/supprime) ; `combat/log` = lecture+**écriture tout inscrit**
  (`.validate` `text` string) — journal de combat partagé ; **`economyLog` = lecture STAFF, écriture tout
  inscrit** (`.validate` `text` string) — journal d'économie réservé au MJ. NB : le `.read` staff y est écrit
  **explicitement** bien qu'il soit déjà hérité de `campaign/runeterra` — l'intention « MJ seul » doit rester
  lisible dans le fichier.
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
    modifiers: { hp, mana, ad, ap, armure, resmag, crit, dcrit, rescrit, letha, lethaMag, sapience, vol, omni }
               ↑ liste unique `MOD_STATS` (components.jsx), partagée éditeur d'item + panneau Modificateurs MJ
               letha = léthalité PHYSIQUE (réduit l'armure) ; lethaMag = léthalité MAGIQUE (réduit la rés. mag.)
               sapience/vol/omni sont des POURCENTAGES (cf. lifestealHeal), pas des valeurs plates
    inventory: { [itemId]: { id, cat, name, sub, qty, ic, img, type, mods, weight, carry, carryGroup, order } }   ← perso, éditable (order = rangement manuel, cf. planReorder)
    invInit:   true   ← marqueur de migration (amorçage unique de l'inventaire)
    equipment: { [slotKey]: itemId }   ← paperdoll (page Équipement), temps réel ; slotKey ∈ EQUIP_SLOTS (12 slots, armure fusionnée + ceinture)
    armureInit: true   ← marqueur de migration (fusion des 4 slots d'armure → slot « armure » unique)
    coins:     { plat, or, arg, cuiv }   ← monnaie perso (entiers ≥ 0), via setCoin / moveCoins
    coinsInit: true   ← marqueur de migration (amorçage unique des pièces)
    runes:     { selected:{[nodeId]:true}, choices:{[nodeId]:'ad'|'ap'} }   ← arbre de runes (page Runes)
    runeBonus: 0   ← points de rune bonus accordés par le MJ (test / montée de niveau) ; budget = level + runeBonus
    level:     2   ← niveau effectif (entier ≥ 1, stepper staff onglet Compétences) ; défaut = char.level ; pilote déblocage des comps + passif + budget runes + STATS (socle moteur refondu)
    attrs:       { force, hab, mental, magie }   ← caracs (respec, onglet Progression) ; ABSENT par défaut → repli char.attrs ; lu par charBaseStats ; écrit par setAttrs
    habSplit:    { ad, ap, mana }   ← répartition des points d'Habileté (+5 AD / +5 AP / +10 Mana par point) ; onglet Progression, écrit par setAttrs EN MÊME TEMPS que attrs (cohérence somme <= hab)
                     ABSENT = jamais confirmé → défaut par carac dominante (habSplit, game-logic)
    habSplitOpen: true   ← drapeau MJ : suspend le plancher du joueur pour lui rendre UNE redistribution libre de ses points d'Habileté déjà placés ; posé/retiré par setHabSplitOpen (bouton « ↺ Rouvrir au joueur », staff), effacé automatiquement à la confirmation suivante
    mentalSplit: { hp, mana }   ← répartition de la part DIRIGÉE du Mental (2026-09-05) : chaque point donne 45 PV + 15 Mana garantis, PLUS 15 points au choix (+15 PV ou +15 Mana) ; onglet Progression, écrit par setAttrs EN MÊME TEMPS que attrs
                     ABSENT = jamais confirmé → défaut TOUT EN PV (= 60 PV/pt, l'ancien coefficient) : les PV des persos existants ne bougent pas, aucune migration
    mentalSplitOpen: true   ← même mécanisme que habSplitOpen, drapeau SÉPARÉ (setMentalSplitOpen) : le MJ doit pouvoir rendre une répartition sans rendre l'autre
    habAd:       4   ← LEGACY (forme AD-seul, a vécu une journée) : encore relue par charBaseStats, purgée au prochain « Confirmer »
    attrsLocked: true   ← verrou après respec joueur unique ; le staff peut éditer/déverrouiller (setAttrsLocked)
    counters:  { [key]: n }   ← compteurs de compétences (chasseur/marques/tranches/cn…), steppers manuels
    cooldowns: { [skillId]: readyAtTurn }   ← cooldown = n° de tour de disponibilité (999999 = 1×/combat)
    skillBuffs: { [skillId]: { mods:{ [stat]: n }, until:<n° de tour>|null } }   ← buffs sur soi (mods PLATS snapshotés au cast, ex. Urskaar C4 +30% PV/AD/Armure de base) ; until = tour de fin (auto-expiration via sumSkillBuffs(buffs,turn), ex. Mur de Givre 1/2 tours), null = permanent ; ancienne forme plate { [stat]:n } encore lue (compat) ; effacés par « ⟲ Combat »
/campaign/runeterra/sharedInventory/{itemId}/   ← inventaire COMMUN partagé (R/W tout participant)
    { id, cat, name, sub, qty, ic, img, type, mods, weight, carry, carryGroup }
/campaign/runeterra/sharedTransport/   ← ATTELAGE du groupe : { [slotKey]: itemId } (R/W tout participant)
                                          slotKey ∈ TRANSPORT_SLOTS (monture1, monture2, sac1, sac2, sac3)
                                          un objet du coffre n'apporte son `carryGroup` à la capacité commune
                                          QUE placé ici — la simple présence dans le coffre ne suffit pas
/campaign/runeterra/sharedCoins/   ← monnaie COMMUNE (coffre) : { plat, or, arg, cuiv } (R/W tout participant)
/campaign/runeterra/combat/turn   ← compteur de tour PARTAGÉ (nombre ≥ 1) ; lecture inscrits, écriture staff
/campaign/runeterra/combat/enemies/{id}   ← ennemis PARTAGÉS { name, hpCur, hpMax, manaCur, manaMax, atk, armure, resmag, note, crit, dcrit, rescrit, lethaAD, lethaAP, reveal, revealPct } ; lecture inscrits, écriture staff
                                              crit (%) + dcrit (% dég. crit, défaut 200) + lethaAD/lethaAP (léthalité physique/magique) = crit/léthalité ennemi→joueur (rollCrit au lancement ; léthalité AD→armure si physique, AP→rés. mag si magique, via mitigateDamage)
                                              reveal ∈ 'hidden'(défaut)|'bar'|'exact' = ce que voient les JOUEURS ; revealPct (0-100) = % de barre figé en mode 'bar' ; absent → 'hidden'
/campaign/runeterra/combat/pendingHits/{id}   ← attaques proposées { attackerId, attackerName, skillId, skillName, type, computedDmg, critDmg, didCrit, critMult, letha, lethaMag, crit, dcrit, vol, sapience, omni, hpMax, targetId, ts } ; crit roulé au cast ; le MJ ajuste+applique
                                              letha/lethaMag = les DEUX léthalités snapshotées au cast ; le champ MJ affiché suit le type choisi (physique→letha, magique→lethaMag, brut→0)
/campaign/runeterra/economyLog/{id}   ← journal d'ÉCONOMIE { id, ts, text, kind:'gold'(transfert)|'buff'(gain)|'debuff'(retrait) }
                                              lecture STAFF (MJ/admin), écriture tout inscrit (un joueur qui prend au coffre doit pouvoir tracer)
                                              JAMAIS purgé par « ⟲ Combat » ; plafonné à LOG_MAX(30), élagué à la lecture par le staff
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
4. Publier les règles : `firebase deploy --only database` (ou console → Realtime Database / Règles).
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
Vérif syntaxe d'un .jsx : `npx esbuild fichier.jsx >/dev/null` (⚠️ **pas** de `--loader=jsx` :
ce flag ne vaut que pour stdin, esbuild déduit le loader de l'extension).
SRI des scripts CDN : `curl -s <url> | openssl dgst -sha384 -binary | openssl base64 -A`.

⚠️ **Ne jamais éditer un fichier accentué via PowerShell 5.1** (`Get-Content -Raw` + `Out-File`) :
il relit l'UTF-8 en ANSI et réécrit un BOM + des accents cassés (`é`→`Ã©`). Utiliser l'outil Edit,
ou `perl -i -pe` pour un search-replace global (ex. le bump du token de cache).

## Branches (convention depuis 2026-08-16)
Le dépôt est nettoyé : **3 branches seulement**, plus de branches `feat/*` ou `fix/*` résiduelles.
- **`main`** — branche de référence, toujours déployable (c'est elle que sert GitHub Pages).
- **`Woolost`** — branche de travail de Woolost (le **MJ**).
- **`JB`** — branche de travail d'Akeltroll / JB (l'`admin` du projet).

Chacun travaille sur sa branche puis fusionne dans `main`. Après un merge dans `main`, on **ne
supprime pas** `Woolost`/`JB` : on les resynchronise sur `main` (`git merge main`) pour repartir
d'une base propre. Les anciennes branches de fonctionnalité (auth-comptes-roles, inventaire,
arbre-runes-visuel, elias-crowe-niveau-2, retrait-mode-combat, admin-catalogue, catalogue-editable)
ont été **supprimées** une fois entièrement fusionnées — leur historique vit dans `main`.

## État actuel (2026-09-05)
- **Calibrage des attaques de base — 4 décisions livrées et DÉPLOYÉES sur `main`**
  (`a7e6cba` spec, `eb0e77e` A/B/C, `71417c5` D). Cache `20260905-2`, **228 tests verts**
  (game-logic 217 + auth 11), **aucune règle RTDB à republier**, **aucune migration de données**.
  📄 **Spec et source de vérité du calibrage** :
  `docs/superpowers/specs/2026-09-05-calibrage-attaques-base-design.md`. Elle contient les
  matrices de vérification, la démonstration d'un blocage arithmétique (§6, à ne pas rouvrir sans
  la refaire) et le diagnostic complet des kits (§10).
  **Le diagnostic qui a tout déclenché** : au niveau 18, un ADC tuait un assassin en **1,1 attaque
  de base**, et 3 archétypes sur 5 étaient **indiscernables au niveau 2** (12 points, cap 6 →
  6/6 forcé : un ADC Force/Habileté et un assassin Habileté/Force étaient le MÊME personnage).
  **A — `LEVELS` recalibré** : budget total ≈ **1,65 × cap**, donc on ne peut plus jamais monter
  deux caracs au plafond. Niveau 2 = **10 points** (cap 6 → 6/4) ; niveau 18 = 34 (cap 20 → 20/14,
  inchangé). ⚠️ **C'est le `limit` qui porte la contrainte**, pas le budget : il monte plus
  lentement qu'avant (13 au niveau 10 contre 14). Baisser l'un sans l'autre ne suffirait pas.
  **B — escalade** : `escalationFactor` ramenée à **+1 %/pt** (`p × (1 + 0,010·(p−1))`), compensée
  par **`globalEscalation(total)` = `1 + 0,0049·total`** appliquée dans `computeStats` aux
  4 magnitudes escaladées et à `hUnit`/`mUnit`. La prime d'un build 2 caracs sur un build 3 caracs
  tombe de **15 % à 6 %**, le total au niveau 18 en 20/14 restant **identique** (46.2) — d'où
  l'absence de recalibrage des dégâts. ⚠️ Ne pas remonter l'une sans baisser l'autre.
  ⚠️ **`globalEscalation` est équivalente à un multiplicateur de niveau** : un joueur place
  toujours TOUS ses points, donc `total` vaut toujours le budget du niveau. Ne pas promettre aux
  joueurs qu'un point de Force « boostera leur Magie ».
  **C — crit** : `5 + 2,5·H` / `150 + 4·H`. ⚠️ Les deux se **multipliant**, l'ancienne paire
  (`5+10·H` / `150+6·H`) valait **×3,23** de dégâts moyens à 20 d'Habileté contre ×1,02 sans —
  un multiplicateur de puissance déguisé en aléa, qui donnait à Urskaar le meilleur AD du jeu au
  niveau 18 (585 contre 357 à Smith) **pour les plus faibles dégâts réels** (453 contre 621).
  Nouvelle borne **×1,71** (coup critique ×2,30). ⚠️ Corollaire assumé : **le surcrit (seuil 100 %)
  n'est plus atteignable par les caracs seules**, il passe par l'équipement et les runes.
  **D — répartition du Mental** : 45 PV + 15 Mana garantis par point, **plus 15 points dirigés**
  (+15 PV **ou** +15 Mana), persistés dans `state.mentalSplit`. Voir le modèle de données.
  ✅ **Résultat vérifié** : le TTK tient dans **±0,3 attaque du niveau 1 au 18** (ADC→ADC : 2.7 puis
  2.8), contre 1.9 → 1.1 avant. C'est le critère qui a permis de déclarer **les attaques de base
  saines** — et donc d'en faire l'**unité de mesure** du calibrage des compétences.
  ✅ **BASCULE À LA TABLE FAITE le 2026-09-05** : les 5 PJ ont été respec de 12 → 10 points par le
  MJ, « ⟲ Combat » passé (recalage des PV/Mana sur les nouveaux caps), et les joueurs sont prévenus
  qu'ils ont désormais **deux répartitions** (Habileté AD/AP/Mana et Mental PV/Mana). **Le chantier
  de calibrage est clos** — plus rien à faire dessus, ni en code ni en jeu.
  ⚠️ **Leçon à garder pour tout futur abaissement de budget** : dans `ProgressionPage`,
  `floorAttrs = staff ? {} : savedAttrs` — **le plancher d'un joueur EST sa propre répartition
  confirmée, il ne peut donc JAMAIS descendre une carac**. Si le budget baisse, un joueur voit
  « N / budget » en solde négatif et se retrouve bloqué (ni descendre, ni confirmer) ; ni
  `setAttrsLocked` ni « ↺ Rouvrir au joueur » ne débloquent ce cas (ils gouvernent le verrou de
  respec et la répartition d'Habileté). **Toute baisse de budget exige un passage du MJ sur les
  5 fiches, AVANT d'annoncer le changement aux joueurs.**
  ⚠️ **Ce qui n'est PAS validé** (§7 de la spec) : le calibrage vaut **en isolation**, sans
  l'équipement (backlog « équipement en stats finales ») ni les runes — or la rune Sadisme donne
  déjà +15 AD/AP. À re-vérifier quand ces sources entreront en jeu. Les duels de tanks restent
  très longs (13 attaques au niveau 18), c'est structurel.

## État actuel (2026-09-02)
- **Chantier « gestion des tours » — LES 6 LOTS SONT LIVRÉS** (initiative, créneaux, PNJ alliés,
  UI MJ + UI joueur, assistant de stats PNJ). Cache `20260902-6`, **206 tests verts**
  (game-logic 195 + auth 11), ✅ **RÈGLES RTDB PUBLIÉES ET VÉRIFIÉES le 2026-09-02** (relecture en ligne avant/après : aucune dérive console préalable, diff
  post-publication limité aux 2 additions attendues).
  📄 **Spec complète et source de vérité des règles de jeu** :
  `docs/superpowers/specs/2026-09-02-initiative-creneaux-design.md` — les règles du MJ (§2) ne sont
  écrites **nulle part ailleurs**, ni dans `info-mj/`, ni dans l'Excel.
  **Le modèle en une phrase** : score = **1d6 + bonus**, les **ex æquo forment un CRÉNEAU** et jouent
  simultanément ; on ne passe au créneau suivant que quand **tous** ses participants ont déclaré
  « j'ai fini » (ennemis compris, le MJ clique pour eux).
  ⚠️ **`combat/turn` n'a PAS changé de sens** : il reste le compteur de **ROUND**. Cinq mécanismes en
  dépendent (cooldowns `readyAt`, `sumSkillBuffs.until`, `glaciationDecay`, `souverainUntil`,
  `CD_LOCKED`) et un glissement de sens les décalerait **en silence**. L'initiative vit dans un nœud
  séparé ; le round ne s'incrémente qu'au **bouclage** du dernier créneau.
  ⚠️ **Le créneau actif est DÉRIVÉ, jamais stocké** (= le premier dont les participants n'ont pas tous
  déclaré). C'est ce qui fait que passer au créneau suivant **ne coûte AUCUNE écriture** — donc aucune
  course entre deux clics simultanés, aucun état désaligné après un rechargement. Les deux **seules**
  écritures de la mécanique sont la purge de `done` en fin de round et la purge totale au « ⟲ Combat ».
  Ne pas « optimiser » en persistant un `activeId`.
  ⚠️ **KO DIFFÉRÉ (règle MJ)** : un combattant tombé à 0 PV **pendant son propre créneau** joue quand
  même son action ; tombé **avant**, il est sauté. Résolu par un horodatage `ko:{round,init}` posé aux
  3 endroits où des PV tombent à 0 (`PendingHitsPanel`, `EnemyCard.applySubir`, `EnemyAttackModal`) —
  c'est ce qui permet de garder la dérivation intégrale. Une entrée périmée est inoffensive
  (`slotParticipants` teste les PV d'abord, un ressuscité rejoue).
  ⚠️ **ARRIVÉE TARDIVE** : `joinRound` — un renfort lance son dé tout de suite mais n'entre qu'au
  **round entier suivant**, pour ne pas surgir en amont de joueurs ayant déjà agi. Absent = 1.
  ⚠️ **SÉCURITÉ — la règle RTDB ouvre la FEUILLE `scores/$id/d6`, jamais le NŒUD `scores/$id`** :
  sur le nœud, un joueur pourrait écrire son propre `bonus` **et** son propre `ok`, donc s'auto-valider
  et court-circuiter la validation du MJ. `bonus`/`ok`/`reroll` n'ont aucune règle propre et retombent
  sur l'ancêtre staff. Le cycle de validation est garanti par le **serveur**, pas par l'UI.
  **Le joueur lance, le MJ valide** : la randomisation est faite par l'**app** (`rollInitiative`, rng
  injectable), jamais saisie à la main ; cycle `idle → pending → ok`, avec `reroll` si le MJ refuse.
  **Nouveau `.read` ouvert à tous les inscrits : `characters/$charId/state/hpCur`** (à côté d'`attrs` et
  `level`). Nécessaire : sans lui l'écran d'un joueur lit les PV des autres PJ comme 0, les exclut du
  créneau et **croit le créneau terminé** alors que le MJ voit l'inverse. Bourse, inventaire, runes,
  modificateurs, XP et équipement **restent cloisonnés** ; aucune écriture élargie.
  👉 Piste ouverte : le Hub peut maintenant afficher de vraies barres de PV sur les cartes des autres PJ
  (aujourd'hui grisées) — attention, le **max** exact dépend des modificateurs/équipement non lisibles.
  Livré : `combatantSide`/`isAlly`/`splitCombatants` + `INIT_DIE`/`rollInitiative`/`initiativeTotal`/
  `initiativeStatus`/`initiativeReady`/`combatantJoinRound`/`initiativeSlots`/`slotParticipants`/
  `initiativeState` (game-logic, purs, testés) ; `useInitiative` + `INITIATIVE` (data-state) ; PNJ alliés
  dans la vue MJ (section « Combattants », bouton `+ PNJ allié`, bascule Camp) et côté joueur (bandeau
  séparé + `<optgroup>` de ciblage) ; `InitiativePanel` (colonne MJ : créneaux, validation des jets,
  badge de score `4+1`, `IniScoreEditor` = bonus + placement, « forcer la fin du créneau ») ;
  `MyTurnBar` + `InitiativeBoard` (onglet Combat joueur) ; `useAllHp` ; `npcStatsFromAttrs`.
  ⚠️ **`useAllHp` s'abonne aux FEUILLES `state/hpCur`, jamais au nœud `characters`** (staff-only) —
  même piège que le bug de bourse écrasée d'août ; `useAllCharStates()` vaut `null` pour un joueur.
  ⚠️ **`npcStatsFromAttrs` est un ASSISTANT, pas un modèle dérivé** : il pré-remplit les champs plats
  de l'ennemi, qui restent la source de vérité. Ne PAS le transformer en calcul live — `applySubir` et
  `applyHitToEnemy` écrivent `hpCur` en direct et entreraient en conflit avec un max recalculé.
  ⚠️ **Le `bonus` d'initiative est le champ RÉEL** (préparation −2…+2, potion, buff) ; le « Créneau »
  de l'éditeur n'est qu'un confort qui le calcule. Les deux écrivent `bonus`, **jamais `d6`** : le dé
  appartient au joueur.
  🐞 **Corrigé au passage (bug ANTÉRIEUR au chantier)** : un PNJ ne pouvait toucher que les PJ —
  `EnemyAttackModal` ne listait que `CHARACTERS` **et** écrivait les dégâts en supposant une fiche de
  PJ. Un ennemi ne pouvait frapper ni un autre ennemi, ni un allié, ni lui-même. Voir §2.6 de la spec.
  ✅ **Recette à deux sessions simultanées FAITE le 2026-09-03** (MJ + joueur en navigation privée) :
  la **dérivation** du créneau actif se propage bien aux deux écrans sans écriture, et les deux écrans
  voient le **même** créneau actif (donc l'ouverture de `hpCur` du §6.1 fonctionne). Le modèle
  « dérivé, jamais stocké » tient en conditions réelles.
  👉 **RESTE À FAIRE** : l'éprouver **à une vraie table** (confort d'usage avec beaucoup de PNJ, KO
  différé subi pour de vrai, cooldowns sur plusieurs rounds enchaînés). Reste aussi le geste de drag
  *entre* deux créneaux existants (§10), pas faisable au doigt ; le champ « Créneau » de
  `IniScoreEditor` couvre le cas.

## État actuel (2026-09-04)
- **Répartition des caractéristiques rechiffrée + Rés. critique + Habileté au choix (AD/AP/Mana)** —
  cache `20260904-3`, **220 tests verts** (game-logic 209 + auth 11), **aucune règle RTDB à republier**
  (ni `state/modifiers`, ni `combat/enemies`, ni `pendingHits` ne valident les clés de stats),
  **aucune migration de données**.
  Décisions du MJ, par point de carac : **Force** 20 PV / 5 Mana / 25 AD / **2 Armure** ;
  **Habileté** : **au choix du joueur, par point : +5 AD, +5 AP ou +10 Mana** (au lieu de 8 AD
  ET 8 AP), **plus aucun bonus d'AR/RM de départ**, bonus de PV **dégressif 25/20/15/10/5**
  (75 max, `HAB_START_HP`), crit et dégâts crit inchangés ;
  **Mental** 60 PV / 20 Mana / **+3 % Rés. Crit**, et **plus de crit ni d'AD/AP** ;
  **Magie** 10 PV / 30 Mana / 25 AP / **2 Rés. Mag**. La Force et la Magie ne donnent **plus de
  dégâts crit** → `crit = 5 + 10·H`, `dcrit = 150 + 6·H`. Socle de Mana passé à `50 + 15·niveau`.
  **Résistance critique** (`rescrit`) : réduit la part de dégâts **au-dessus de 100 %**, pas la
  chance de crit (150 % contre 15 % → 142,5 %). Appliquée à la **résolution MJ** (`critMultAfterResist`).
  ⚠️ **L'ARMURE S'EFFONDRE À BAS NIVEAU, c'est assumé et il faut le surveiller en jeu** : la Force
  passe de 4 à 2 d'armure par point ET l'Habileté n'en donne plus du tout. Urskaar tombe de 28 à 15
  d'armure, soit — via `AR/(AR+120)` — de **19 % à 11 %** de réduction des dégâts physiques ; un Tank
  niveau 18 de 41 % à **29 %**. Le pari est que les **armures d'équipement** (backlog « équipement en
  stats finales », §7 de la spec hypermétrique) prennent le relais ; **tant qu'elles n'existent pas
  dans `ITEM_CATALOG`, les PJ encaissent quasiment à nu**.
  ⚠️ **Le passif de Rathael est à rebaser** : « +5 %/charge d'Armure+RM **de base** » sur une base
  divisée par ~2 ne vaut presque plus rien (5 charges ≈ +3 d'armure sur ses 10). Pas touché ici — c'est une
  décision de game design, pas un effet de bord à corriger en douce.
  ⚠️ **PV et Mana COURANTS sont stockés en absolu** : le Mana de Rathael passant de 287 à 210, un
  **« ⟲ Combat »** est nécessaire après déploiement pour recaler tout le monde sur les nouveaux caps.
  **Rouvrir la répartition d'un joueur** (`setHabSplitOpen`, data-state ; bouton
  « ↺ Rouvrir au joueur » dans l'en-tête de `HabSplitRow`, **staff only**) : pose
  `state.habSplitOpen`, ce qui **suspend le plancher** du joueur — il peut alors déplacer TOUS ses
  points d'Habileté, et le drapeau se referme tout seul à sa prochaine confirmation.
  ⚠️ **Rouvrir n'efface PAS `habSplit`** : remettre le champ à `null` aurait aussi « rouvert », mais
  le joueur serait reparti du **défaut par carac dominante** au lieu de sa propre répartition — on
  lui aurait fait perdre son placement au moment même où on lui rend la main.
  ⚠️ C'est un confort d'UI, pas une sécurité : les règles RTDB ne valident rien sous
  `characters/$charId/state`, donc un joueur peut déjà écrire `attrs` ou `habSplit` à la console.
  Le vrai garde-fou reste le MJ qui relit les fiches.
  **Répartition de l'Habileté (3 destinations)** : nouveau champ persisté
  `state.habSplit = {ad, ap, mana}`, contrôle `HabSplitRow` sous la ligne Habileté de l'onglet
  Progression (une ligne par destination avec −/+, réserve « N pts à placer », gain réel affiché
  par ligne). « Confirmer » exige la réserve vide, comme pour les points de caractéristiques.
  ⚠️ **L'escalade est garantie à chaque point** (facteur du total distribué au prorata) →
  **répartir ne coûte rien**, 10/10 rend autant que 20/0. Ruling explicite du MJ : encourager les
  répartitions personnelles. **Une version intermédiaire escaladait chaque part séparément** et
  pénalisait l'hybridation de ~20 % — ne pas y revenir par inadvertance.
  ⚠️ **Aucune migration** : `habSplit` absent retombe sur le défaut par carac dominante — Jett
  (F1/C4) part en tout-AP, les 4 autres en tout-AD, ce qui correspond à leur build actuel. L'ancien
  champ `habAd` reste relu et se purge au prochain « Confirmer ».
  ⚠️ **`setAttrs(attrs, locked, split)` écrit les deux dans la MÊME opération** : un `habSplit` seul
  après une baisse d'Habileté laisserait une somme hors bornes (la fonction `habSplit` la
  normaliserait à la lecture, mais la base mentirait).
  Livré : `computeStats(…, hab)` réécrite + `HAB_START_HP` + `habSplit`/`defaultHabSplit`/`HAB_DESTS`
  + `critMultAfterResist` (game-logic, purs, testés) ;
  `rescrit` dans `MOD_STATS`/`STAT_LABEL`/`STAT_LABEL_SHORT`/`STAT_GLYPH`/`STAT_FAMILY` (components) ;
  affichage fiche (**la 6e case « réservée » des stats secondaires est enfin occupée**), Équipement,
  Progression, assistant `npcStatsFromAttrs` et champ éditable de `EnemyCard` ;
  libellés `ATTRIBUTES` (data.jsx) remis à jour — ils annonçaient encore l'ancienne répartition ;
  réduction appliquée dans `PendingHitRow` et `EnemyAttackModal` (badge `CRIT ×2,00 − R.Crit 15 % →
  ×1,85`, pré-remplissage du champ dégâts, mention au journal de combat).
  ⚠️ **`EnemyAttackModal` : la suggestion de dégâts suit la cible tant que le MJ n'a pas saisi son
  d20** (drapeau `touched`) — la cible y est modifiable, et écraser une saisie manuelle au changement
  de cible aurait été pire que de laisser une valeur périmée.
  👉 **Non fait volontairement** : le joueur voit toujours son crit **brut** au cast (« en attente MJ »),
  la réduction n'apparaît qu'à la résolution. Il pourrait la calculer (il lit `combat/enemies`), mais
  le nombre qui compte est celui que le MJ applique — deux affichages divergents seraient pires.

## État actuel (2026-09-03)
- **Arrivée tardive (`joinRound`) AUTOMATIQUE + pilotable** — cache `20260902-8`, **209 tests verts**
  (game-logic 198 + auth 11), **aucune règle RTDB**, aucune migration.
  **La règle §2.4 est posée à la VALIDATION du score** par `initiativeJoinOnValidate(round, done,
  existingJoin)` (game-logic, pure, testée) : « combat déjà engagé » (= round > 1 **ou** quelqu'un a
  déjà déclaré sa fin de tour ce round) → entrée au **round suivant** ; round 1 sans déclaration =
  ajout de **setup**, entrée immédiate ; un `joinRound` posé **à la main n'est jamais écrasé**.
  ⚠️ **L'écriture est à la validation, PAS au jet** : un joueur n'a le droit d'écrire que la feuille
  `d6` de son score, `joinRound` retombe sur le `.write` staff — le calculer dans `roll` donnerait un
  `PERMISSION_DENIED` côté joueur.
  ⚠️ **Le décalage est TOASTÉ** (« X entre en jeu au round N ») : sinon le MJ croit son renfort en jeu
  et le cherche dans les créneaux. C'est aussi le garde-fou du seul cas où la règle surprend — démarrer
  un combat **sans « ⟲ Combat »** laisse `combat/turn` au round précédent et décale tout le monde
  (`resetCombat` remet bien le round à 1 ; le cas n'existe que si on l'oublie).
  Le MJ garde la main : le champ « Entrée » de `IniScoreEditor` corrige ou annule le décalage.
  C'était le **seul écart connu** entre la spec et l'app : `setJoinRound` existait dans le hook mais
  n'était appelé nulle part, donc un renfort entrait au round courant au lieu du round suivant (§2.4).
  Livré : ligne « Entrée » dans `IniScoreEditor` (champ de round + bouton **⏳** = `round + 1` d'un
  clic) ; badge **⏳R{n}** dans la liste « En attente » du MJ ; branche « Tu rejoins le combat au
  round N » dans `MyTurnBar` côté joueur.
  ⚠️ **Le trou d'affichage que la règle ouvrait est bouché** : un retardataire au score **validé**
  n'est ni dans `waiting` (statut `ok`) ni dans un créneau (`initiativeSlots` l'exclut) — il était donc
  **invisible**, et le MJ n'avait plus aucun moyen de le corriger. La liste « En attente » liste
  désormais aussi les retardataires. Toute future règle qui exclut un combattant des créneaux devra
  se poser la même question : *où le voit-on encore ?*
  ⚠️ **Un score déjà validé n'expose plus le bouton de relance** : `roll` n'écrit que `d6` et laisse
  `ok:true` en place — relancer aurait changé le score **sans repasser par la validation du MJ**.
  ✅ **Point ouvert n°1 de la §12 tranché par lecture du code** : les `bonus` d'initiative **ne
  survivent pas** à « ⟲ Combat » (`resetCombat` fait `setPath(INITIATIVE, null)`, le nœud entier part).
  C'est le bon comportement pour un malus de surprise ; seul un bonus *durable* doit être reposé.

## État actuel (2026-08-21)
- **Capacité du coffre commun + attelage du groupe (lot 3/3 du chantier « poids »)** — cache
  `20260821-6`, **183 tests verts** (game-logic 172 + auth 11), ✅ **RÈGLES RTDB PUBLIÉES ET VÉRIFIÉES
  le 2026-08-22** (`firebase deploy --only database` ; relecture en ligne avant/après : aucune dérive
  console préalable, et le diff post-déploiement ne montre que les 3 ajouts attendus).
  Le coffre commun était **la seule grille de l'app sans jauge de charge** : rien ne limitait ce qu'on
  y entassait. Il a maintenant une capacité, un seuil de confort et un état, calculés par le modèle
  du §3-5 de `info-mj/Systeme de poids - Inventaire commun (formules).md`.
  **Capacité = grandeur EXTENSIVE → SOMME** des capacités de base des 5 persos (× ratio) + attelage ;
  **confort = grandeur INTENSIVE → MOYENNE** de leurs seuils individuels. Groupe actuel (niveau 2,
  sans attelage) : **74 de capacité, 68 % de confort, seuil 50** — verrouillé par un test.
  ⚠️ **ÉCART ASSUMÉ AU DOC MJ — `GROUP_CARRY_RATIO` (0,30)**, arbitré par le MJ le 2026-08-21 après
  essai en jeu. Le §3 du doc pose « capacité commune = Σ des capacités individuelles », soit 247 ici.
  Mais dans l'app le coffre est un stockage **SÉPARÉ** des sacs persos : à pleine somme le groupe
  disposerait de 247 (sacs) + 247 (coffre) ≈ **494**, le double de sa capacité réelle, et le seuil
  d'encombrement du coffre (167) ne serait **jamais** atteint — une armure lourde pèse 20. Le coffre
  ne vaut donc qu'une **fraction** de la capacité collective. À 30 % il tombe à 74, cohérent avec les
  ordres de grandeur du guide d'économie (« quatre brigands dépouillés = 22 unités », charge perso de
  30 à 80 au niveau 1). **Le ratio est le curseur d'équilibrage du système : une seule ligne à changer**
  (`GROUP_CARRY_RATIO`, game-logic.js). `groupCarryBase` expose la somme **brute**, restée exactement
  conforme au doc (testée contre son exemple du §9 : 352) — c'est le ratio qui s'en écarte, pas elle.
  ⚠️ **Le ratio NE s'applique PAS au bonus d'attelage** : une monture est intégralement dédiée au
  portage collectif, rien à en défalquer. C'est ce qui donne son intérêt à l'attelage — un chameau à
  +50 pèse plus lourd dans le calcul que les 5 personnages réunis.
  Livré (game-logic, purs, testés) : `carryBaseRaw` (terme brut **non arrondi et sans bonus**),
  `groupCarryCapacity`, `groupComfortPct`, `weightStatusPct` (variante de `weightStatus` prenant le
  seuil **en fraction** — le confort commun est une moyenne et ne correspond à l'Habileté de personne ;
  `weightStatus(hab)` n'est plus qu'un appel à cette fonction). Plus `TRANSPORT_SLOTS` /
  `transportAccepts` / `sumTransportCarry`. Côté app : `useSharedTransport` + `useGroupCarry`
  (data-state), `TransportRack` + `CommonWeightBar` (pages-inventory), `WEIGHT_STATE` **extrait dans
  components.jsx** (il était local à pages-equip et allait être dupliqué une 3e fois).
  ⚠️ **`carryCapacity()` n'était PAS réutilisable pour la somme commune**, malgré la formule identique :
  elle arrondit **individuellement** (⌊247,8⌋ = 247 contre 246 en arrondissant chacun — écart durable et
  silencieux) et elle ajoute le bonus `carry` **personnel** que le §3 exclut du commun. D'où
  `carryBaseRaw`, désormais partagé par les deux.
  ⚠️ **`useGroupCarry` n'est PAS `useAllCharStates`** : ce dernier s'abonne au nœud **parent**
  `characters`, resté staff-only — ouvrir un enfant n'ouvre pas le parent (version **lecture** de la
  leçon des journaux). Le hook s'abonne aux chemins **feuilles** `state/attrs` et `state/level` des
  5 persos. Et il n'alimente **que de l'affichage** : aucune écriture ne doit en dépendre.
  ✅ **Règles en ligne** : les joueurs peuvent désormais lire `attrs`/`level` des 5 persos (jauge juste
  même après une respec) et atteler eux-mêmes. Plus de `permission_denied` en console.
- **Canal « groupe » des objets de transport (lot 2/3 du chantier « poids »)** — cache `20260821-4`,
  **177 tests verts** (game-logic 166 + auth 11), **aucune règle RTDB**, aucune migration.
  §6 du doc `info-mj/Systeme de poids - Inventaire commun (formules).md` : un objet de transport porte
  **deux bonus indépendants** — `carry` (canal `p`, capacité **personnelle** du porteur, déjà là) et le
  **nouveau `carryGroup`** (canal `g`, capacité du **coffre commun**). Un même objet peut alimenter l'un,
  l'autre ou les deux (chameau harnaché : `carry:10, carryGroup:50`).
  Livré : champ `carryGroup` propagé aux **4 sites** de copie de champs d'item (`makeItem`,
  `planItemTransfer`, `fillStacks`, `buildCatalogSeed`) + saisie dans `InvItemRow` + affichage
  (`ItemTooltip`, détail du coffre commun).
  ⚠️ **Gating volontairement différent de `carry`** : `carry` est remis à 0 hors `cat==='Équipement'`
  (il faut l'équiper pour en profiter), **`carryGroup` ne l'est pas** — un sac large ou une monture peut
  être rangé en `Butin` sans être équipable et compter quand même pour le groupe. Ne pas « harmoniser ».
  ⚠️ **Règle de déclenchement CORRIGÉE le jour même, au retour de test du MJ** : la première version
  (`sumGroupCarry`) sommait le `carryGroup` de **tout** le coffre + les objets équipés. Le MJ a tranché
  autrement — dix sacs rangés en vrac gonfleraient la capacité de +200. Un objet n'apporte sa capacité de
  groupe que **placé dans un emplacement d'attelage** (`TRANSPORT_SLOTS`, lot 3). `sumGroupCarry` a été
  **supprimé** (pas laissé à côté : deux règles concurrentes auraient trompé le prochain lecteur) et
  remplacé par `sumTransportCarry`. Bonus compté **par pile**, pas par unité.
- **Poids de la monnaie (lot 1/3 du chantier « poids »)** — cache `20260821-3`, **171 tests verts**
  (game-logic 160 + auth 11), **aucune règle RTDB**, aucune migration.
  Avant ce lot, les pièces ne pesaient **rien** : `carriedWeight` ne regardait que `items`, alors que le
  guide des joueurs annonce le poids des bourses depuis toujours et s'en sert comme argument de jeu
  (« convertissez »). Un joueur pouvait porter 40 000 cuivres sans quitter l'état *Léger*.
  Livré : `COIN_PER_WEIGHT` + `coinsWeight` (game-logic, purs, testés), 4e param `coins` de `carriedWeight`,
  `invWeightFmt` (components) et 3 points d'affichage (jauge Équipement, compteur Admin, pied de
  `InventoryGrid`). ⚠️ Une charge peut désormais être **fractionnaire** : formater avec `invWeightFmt`,
  jamais interpoler la valeur brute.
  📄 Spec + plan : `docs/superpowers/{specs,plans}/2026-08-21-poids-monnaie-inventaire-commun*`.
  **Restent les lots 2 et 3** (canal `g` `item.carryGroup` ; capacité/confort du coffre commun) — le lot 3
  demande **une republication de règles RTDB** (4 `.read` sur `characters/$charId/state/{attrs,level,
  equipment,inventory}`) et porte une conséquence à confirmer : l'inventaire perso de chacun devient
  lisible par les autres joueurs (§7.1 de la spec, repli documenté).
- **🐞 CORRIGÉ — un MJ ne pouvait PAS vider un journal** (bug **antérieur**, depuis la livraison du
  journal de combat en juin ; trouvé au test §9-12 du 2026-08-21). Cache `20260821-2`,
  ⚠️ **RÈGLES RTDB À REPUBLIER** (2 lignes).
  **Cause** — purger un journal, c'est écrire `null` **SUR LE NŒUD** (`setPath(COMBAT_LOG, null)`).
  Or `combat/log` n'avait de `.write` que sur **`$logId`** (les entrées individuelles) : rien au niveau
  du nœud. Le seul ancêtre qui en donne un est `campaign/runeterra`, réservé à **`admin`**. Donc
  « ⟲ Combat » et « Vider » **échouaient pour le rôle `mj`** — et **en silence**, aucun `catch`.
  Un `admin` ne voyait rien, d'où six mois d'invisibilité. `economyLog` avait le même défaut de naissance.
  **Correctif** — `.write` staff **au niveau du nœud** sur `combat/log` ET `economyLog` (les joueurs
  gardent leur `.write` sur `$logId` seul, pour écrire une entrée). Plus **4 `catch` + toasts** :
  `resetCombat` renvoie `{logCleared}` (→ toast dans `MJPage`, qui a dû recevoir son `useToast`),
  `CombatLog` et `JournalPage` toastent « droits insuffisants ».
  ⚠️ **Leçon à retenir : dans les règles RTDB, un `.write` sur un enfant joker (`$id`) n'autorise PAS
  à écrire sur le nœud parent.** Écrire une entrée et purger la collection sont deux permissions
  distinctes. Un `updatePath(NODE, {id: null})` passe par la règle `$id` (l'élagage du journal
  d'économie fonctionnait donc déjà pour un MJ) ; un `setPath(NODE, null)` non.
- **🐞 CORRIGÉ — bourse du joueur ÉCRASÉE au lieu d'être créditée** (bug **antérieur**, présent dans le
  code déployé, trouvé au test §9.3-1 du 2026-08-21 : Elias avait 6 argent, en prend 4 au coffre,
  se retrouve avec **4**). **166 tests verts.**
  **Cause** — `CommonInventoryPage` calculait la bourse de destination via **`useAllCharStates()`**, qui
  s'abonne à `campaign/runeterra/characters`. Or **les règles RTDB refusent ce nœud à un joueur** (il ne
  peut lire que SA fiche) : l'abonnement est rejeté, `all` reste `null`, `charCoins()` retombe sur son
  repli `{0,0,0,0}`, et `moveCoins` écrivait `0 + 4 = 4`. **Invisible en MJ**, qui lit tout — d'où un bug
  resté longtemps caché : il ne se manifeste qu'avec un compte de rôle `joueur`.
  **Correctif** — `moveCoins` et `moveItem` **ne font plus confiance à l'état passé par l'appelant**
  (params gardés pour la signature, mais ignorés) : ils **relisent les deux côtés en base** via
  `getSnapshot`, qui **rejette** si l'accès est refusé — le transfert est abandonné plutôt que d'écrire
  une valeur fausse. Calcul extrait en logique pure testée **`planCoinMove(from,to,key,n)`**.
  `moveItem` souffrait de la même cause en moins grave (pas de fusion avec la pile existante → doublon,
  sans destruction) et est corrigé pareil.
  ⚠️ **Leçon à retenir : `useAllCharStates()` est un hook DE STAFF.** Pour un joueur il vaut toujours
  `null`. `pages-lobby` le documentait déjà et gère le cas ; `pages-mj` est staff-only. `pages-inventory`
  était le seul endroit où ce `null` alimentait **un calcul d'écriture** — d'où la corruption. Avant de
  réutiliser ce hook dans une page visible des joueurs, se demander ce que vaut le repli.
- **Journal des mouvements de pièces (chantier B du durcissement monnaie)** — cache `20260821-1`,
  **162 tests verts**, ⚠️ **RÈGLES RTDB À REPUBLIER** (nœud `economyLog` + `.validate` sur les bourses).
  Avant ce lot, **aucun mouvement d'argent n'était tracé nulle part** : un joueur pouvait vider le coffre
  commun sans laisser d'historique. C'était le risque réel identifié par
  `docs/superpowers/specs/2026-08-20-durcissement-monnaie-rtdb-design.md`.
  **Les 3 arbitrages du §4.3 ont été tranchés par le MJ (2026-08-21)** :
  1. **Nœud `economyLog` séparé**, pas `combat/log` — un historique d'argent effacé à chaque « ⟲ Combat »
     n'a aucun intérêt. Coût assumé : une nouvelle règle, donc une publication en console.
  2. **Delta, pas valeur finale** — `writeCoins` passe **async** avec un `getSnapshot` préalable
     (« +2 or, −15 cuivre » plutôt que « bourse fixée à … »).
  3. **Le change de monnaie n'est pas distingué** d'une édition : il apparaît comme un delta compensé
     (`coinsDeltaValue === 0`, coloré en `gold`), ce qui se lit très bien tel quel.
  **Réservé au MJ pour de vrai** : `campaign/runeterra` porte déjà un `.read` **staff-only** à sa racine et
  ce sont les sous-nœuds qui l'élargissent aux joueurs — un `economyLog` sans `.read` propre hérite donc du
  staff-only. Le contrôle est **serveur**, pas un simple masquage d'UI. Les joueurs y ont l'**écriture**
  (sans lecture) : `moveCoins` est une action de joueur et doit pouvoir tracer.
  **Conséquence de ce sens unique** : l'élagage à 30 entrées se fait **à la lecture, côté staff**
  (`useEconomyLog`) — un joueur ne peut pas élaguer puisqu'il ne peut pas lire. Le journal se borne donc
  quand le MJ l'ouvre, ce qui suffit.
- **Durcissement des règles de bourse (chantier A)** — posé dans `database.rules.json` le 2026-08-21,
  **en attente de publication** (une seule publication couvre A + B).
  `characters/$charId/state/coins/$coin` reçoit un `.validate` **entier >= 0** (aligné sur ce que
  `sharedCoins` faisait déjà). Le `.write` n'a **pas** été retapé — conservé octet pour octet, vérifié
  par `diff` contre `HEAD` (une règle `.write` réécrite de mémoire verrouille tout le monde).
  Ce que ça bloque : négatifs, décimales, chaînes. Ce que ça **ne bloque pas** : un joueur qui s'écrit
  `or: 999999`, entier positif parfaitement valide — le blocage réel exigerait des Cloud Functions
  (§3.2 du doc), disproportionné ici. Le vrai garde-fou reste le journal (B).
  ⚠️ **Un `.validate` frappe les écritures qui portent tout un sous-arbre d'un coup**, d'où deux
  protections ajoutées côté code :
  - `buildDefaultState` normalise les 4 dénominations via **`coinInt(v)`** — sinon un perso mal saisi
    dans `data.jsx` ferait échouer le `seedIfEmpty` **entier**, pas seulement sa bourse ;
  - `ExportImportPanel` (le piège du §6) : **`sanitizeCampaignCoins(data)`** (pur, testé) aligne les
    pièces de la sauvegarde **avant** d'écrire (nombre de corrections annoncé au toast), et le `setPath`
    passe en **try/catch avec toast d'erreur**. Il n'y en avait aucun : un rejet (JSON invalide ou
    `PERMISSION_DENIED`) échouait **en silence**, le MJ croyait son import passé.
  👉 **Séquence de publication + 14 tests** (non-régression, durcissement, journal) : **§9 du document
  de reprise** `docs/superpowers/specs/2026-08-20-durcissement-monnaie-rtdb-design.md`. Les deux tests
  qui comptent : un joueur qui tente `set({or:-5})` sur sa bourse doit prendre `PERMISSION_DENIED`, et
  « ⟲ Combat » ne doit **pas** vider le journal de monnaie.

## État actuel (2026-08-20)
- **Édition libre des bourses par le MJ** — cache `20260817-7`, **144 tests verts**, **aucune règle RTDB à
  republier** (les chemins `coins` et `sharedCoins` étaient déjà ouverts au staff).
  Avant ce lot, les pièces ne pouvaient qu'être **transférées** (`moveCoins`) ou **données** (`grantCoins`,
  additif, ignore les négatifs) : aucun moyen d'en retirer à un joueur sans passer par le coffre, et
  `setCoin` (édition libre) existait dans `data-state.jsx` mais n'était **branché à aucune UI** (code mort).
  Livré : `writeCoins`/`setCharCoins`/`setSharedCoins` (valeurs absolues, clamp ≥ 0) + composant partagé
  **`CoinEditor`**, câblé sur **4 points d'entrée** :
  1. **Carte joueur de la vue MJ** (`MJCompactCard`) — nouvelle ligne « bourse » en lecture live + bouton
     « 💰 Bourse ». C'est le chemin le plus court : tout se fait depuis le tableau de bord.
  2. **Page Équipement** — clic sur une pièce : le joueur garde « envoyer au commun » en direct, le staff
     obtient un menu (« Envoyer au commun… » / « Modifier la bourse (MJ) »).
  3. **Inventaire commun** — même schéma (« Prendre… » / « Modifier la bourse (MJ) ») ; édite `sharedCoins`.
  4. **Fiche joueur** — clic sur la bourse du pied de `InventoryGrid`, **staff uniquement** (`canEdit`) ;
     inerte pour un joueur, comme avant.
  ⚠️ **Toujours aucune trace au journal** : aucun `pushLog` sur les mouvements/éditions de pièces (ni ici,
  ni sur `moveCoins`/`grantCoins`). Un joueur peut toujours se servir dans le coffre commun sans laisser
  d'historique — chantier suivant si le MJ le demande.
  ⚠️ **Rappel de sécurité inchangé** : `characters/$charId` n'a **aucune `.validate` sur `coins`**, donc un
  joueur peut écrire n'importe quoi sur SA bourse via la console (l'app clampe, les règles non).
- **Monnaies alignées sur le guide d'économie + change** — cache `20260817-8`, **150 tests verts**, aucune
  règle RTDB. Les **clés Firebase ne bougent pas** (`cuiv`/`arg`/`or`/`plat` — elles signifiaient déjà
  cuivre/argent/or/platine) : ce sont les **libellés** qui avaient dérivé (Fer/Bronze/Or/Mythril) et qui
  redeviennent **Cuivre / Argent / Or / Platine**. Zéro migration de données.
  - **Ordre** : `INV_COINS` était déjà de la plus faible à la plus forte valeur — conservé tel quel.
  - **Couleurs** : cuivre `#c98a5b`, **argent `#c9d2da` (argenté)**, or `#eccf8f`, **platine `#e6eef5`
    (blanc métallique clair)**.
  - **Nouvel asset `ATH/Items/piece-argent.webp`** : il n'existait aucune pièce d'argent. Dérivée de
    `piece-fer.webp` (étirement de niveaux + teinte froide) pour garder une **gravure distincte** des
    3 autres. `piece-fer.webp` n'est plus référencé (conservé comme source).
  - **Change de monnaie réservé au MJ** (décision du MJ, 2026-08-20) : il vit **dans `CoinEditor`**, donc
    partout où le MJ peut déjà éditer une bourse (4 points d'entrée) et nulle part ailleurs — les joueurs
    passent par le MJ. Montant vide = « tout ce qui est convertible ».

## État actuel (2026-08-17)
- **Lisibilité + code couleur + stats manquantes (fiche joueur)** — cache `20260817-5`, **144 tests verts**,
  **aucune règle RTDB à republier** (ni `state/modifiers` ni `pendingHits` ne valident les clés de stats).
  Livré en 4 étapes :
  1. **Lisibilité de la grille de stats** (`SecondaryStats`, pages-sheet) : libellés 9px mono capitales
     très espacées → **13px gras** ; `Dégâts (AD)`/`Puissance (AP)` → **`AD`/`AP`** via un nouveau
     **`STAT_LABEL_SHORT`** (components.jsx) — `STAT_LABEL` (long) reste pour les infobulles d'objet,
     `StatChip` et la page Équipement.
  2. **Code couleur chaud/froid** : tokens `--stat-{phys|mag|neut}[-ink|-line|-wash]` (runeterra.css) +
     table **`STAT_FAMILY`/`statFamily`** (components.jsx, partagée). Chaud = braise (#E27242) : AD, Armure,
     Léth. phys., Vol de vie ; froid = azur (#7FD4F5) : AP, Rés. Mag., Léth. mag., Sapience ; or = les deux
     camps (Crit, Dég. Crit, Omnivamp). ⚠️ **Règle à tenir** : la famille se porte sur le **liseré + libellé**,
     jamais sur la valeur chiffrée — celle-ci est déjà prise par le code « bonus/malus » (vert `--buff` /
     rouge `--hp`) et par `--skillbuff`. Trois codes couleur cohabitent, chacun son support.
  3. **Léthalité magique** (`lethaMag`) — la seule stat réellement manquante. `letha` reste = **physique**
     (aucune migration : items/modifs/runes déjà en base gardent leur sens). `mitigateDamage` **inchangé**
     (il reçoit un scalaire ; l'appelant choisit selon le type) → zéro test de mitigation réécrit.
     Les deux léthalités sont snapshotées au cast ; le champ MJ de `PendingHitRow` **suit le type choisi**
     (grisé en « brut »), symétrique de `EnemyAttackModal`. Vocabulaire unifié partout :
     « Léth. phys. » / « Léth. mag. » (les ennemis gardent leurs clés `lethaAD`/`lethaAP`, seuls les
     libellés changent).
     **Rune Sadisme** : `mods:{ adp:15, letha:10 }` → **`{ adp:15, lethaAdp:10 }`**. Nouveau mécanisme
     **`ADP_KEYS`** (game-logic) = clés « au choix AD/AP » résolues par `sumRuneMods` ; toutes les clés d'une
     même rune suivent le **même** choix → AD ⇒ +AD et léthalité physique, AP ⇒ +AP et léthalité magique.
     `runeHasAdpChoice` remplace les tests en dur `mods.adp != null` (toggle + `runeDisplayName`).
  4. **Bascule Principales ↔ Secondaires** sur la fiche (`STAT_VIEWS`, état local, **zéro persistance,
     zéro Firebase**) : principales = AD/AP/Armure/Rés. Mag./Crit/Dég. Crit ; secondaires = Léth. phys./
     Léth. mag./Vol de vie/Sapience/Omnivamp + 1 case réservée (les 2 vues font 6 cases → pas de saut de
     panneau). Fin du masquage `effective > 0` : une stat à 0 s'affiche désormais (elle existe, elle est nulle).
  ⚠️ **Bug corrigé au passage** : la **sapience est un POURCENTAGE** (`lifestealHeal` fait `applied*pct/100`)
  mais était saisie/affichée comme une valeur plate (pas de `pct:true`, pas de `%` sur fiche ni Équipement) —
  un MJ qui saisissait 30 croyait donner du plat et donnait 30 %. Corrigé sur les 3 sites.
  **Dette ramassée** : les deux listes `MOD_STATS` dupliquées (éditeur d'item + panneau Modificateurs MJ)
  sont **fusionnées en une seule** (components.jsx, exportée) — une nouvelle stat s'ajoute à un seul endroit.
  ✅ **Tranché par le MJ (2026-08-17)** : `computeStats` ne dérive **que les stats du socle** des caracs
  (8 à l'époque, **9 depuis l'ajout de `rescrit` le 2026-09-04**), et **c'est définitif** — la **léthalité** (`letha`/`lethaMag`) et les **soins liés aux dégâts** (`vol`, `sapience`,
  `omni`) **ne proviendront jamais** de Force/Habileté/Mental/Magie. Elles viennent exclusivement de
  l'**équipement**, des **runes** et des **modificateurs** ; elles valent donc 0 par défaut, et c'est normal.
  Ne pas les ajouter au socle de `computeStats` (rappel écrit aussi en commentaire au-dessus de la fonction).

## État actuel (2026-08-16)
- **Dépôt réaligné et nettoyé** (voir « Branches » ci-dessus) : `main` contient **toutes** les features,
  les 7 anciennes branches fusionnées ont été supprimées, `Woolost` et `JB` créées depuis `main`.
  Cache `20260816-1`. **141 tests verts** (game-logic 130 + auth 11), tous les `.jsx` compilent.
- **Arbre de runes — refonte graphique hi-fi FAITE et VALIDÉE** (`37f7938`, cache `20260816-3`) :
  intégration d'un **design handoff du MJ** (constellation radiale sertie). **Purement graphique** —
  `RUNES`, `buildRuneIndex`, `runeRadialLayout`, `runeBudget`/`runeSpent`, `canSelectRune`/`canDeselectRune`,
  `useCharState` et `state/runes` strictement **inchangés** (zéro test modifié, zéro règle RTDB).
  ⚠️ **Point clé à retenir** : `runeRadialLayout` étant **déjà paramétrable**, la géométrie du handoff
  s'obtient par options — `{size:1200, ring:165, radii:[300,415,520], pathSpreadDeg:26, startDeg:-90}`
  → familles à −90/−18/54/126/198° — **sans toucher `game-logic.js`**.
  Ajouts de rendu : aura extérieure adaptative (3 calques masqués en anneau ; dégradé conique ancré sur
  l'angle de chaque famille, alpha = part relative + investissement absolu), nœuds sertis en 5 couches,
  faisceaux allumés + flux animé, décor (anneau gravé, lignes de ley, hub, poussière d'étoiles
  déterministe PRNG graine 20260816), puces de familles, HUD central, légende des paliers.
  Libellés en **calque HTML au-dessus du SVG** (les `<text>` SVG ne se mettent pas en page ici).
  **Le handoff livrait des placeholders — corrigés vers le réel** : familles Conquérant/Domination/
  Sorcellerie/Volonté/Inspiration avec leurs `fam.color` de `RUNES` ; et surtout le coût des paliers
  (le prototype annonçait « Fondamentale 3 pts », la règle réelle est **2**) — légende et tooltip
  lisent désormais `RUNE_COST`, plus de divergence possible. CSS `.rune-*` réécrit dans `runeterra.css`
  (7 classes mortes de l'ancienne version en grille retirées).
- **Runes — létalité de Sadisme calculée + choix AD/AP résolu** (`ef154e1`, cache `20260816-4`) :
  ⚠️ **Cause instructive** — l'arbre de runes date du 18/06, la **létalité n'est devenue une stat du moteur
  que le 22/06** (refonte combat) : le `note:'+10 létalité'` de `domi_sad_1` était un **reliquat périmé**,
  la rune apparaissait à tort dans « effets à appliquer manuellement ». Corrigé :
  `mods:{ adp:15 }`+note → **`mods:{ adp:15, letha:10 }`**. Ça marche parce que `computeEffective` fait
  l'**union des clés** : un mod `letha` remonte jusqu'à `eff.letha`, déjà consommé au combat (snapshot
  dans les attaques en attente → `mitigateDamage`) et affiché sur la fiche (`STAT_LABEL.letha`).
  **Seule `vol_dur_2` (Peau épineuse) reste un rappel** : renvoi de dégâts = effet réactif, aucune stat
  ne peut le porter. Ajout de **`runeDisplayName`** (pages-runes) : « +15 AD ou AP » devient « +15 AD »
  une fois la rune gravée (tooltip + rappels) ; non gravée, aucun choix n'existe → libellé inchangé.
  👉 **Piste ouverte** : d'autres runes `kind:'reminder'` sont peut-être devenues calculables depuis
  les refontes de juin — pas encore auditées une par une.
- **Infobulles d'objet dans toutes les grilles d'inventaire** (`1332979`) : le tooltip n'existait que sur
  les **slots du paperdoll** ; `InventoryGrid` ne gérait aucun survol. Extraction en composant partagé
  **`ItemTooltip`** + survol géré par `InventoryGrid` → fiche joueur, coffre commun et grille Équipement
  en héritent. Pas de prop `effWeight` sur la grille : **les trois grilles excluent déjà les objets
  équipés**, donc le poids de base y est toujours le bon.
- **Poids des items affiché dans les descriptions** (`d054ed0` + `35776d7`) : helper partagé
  `invWeightLabel(item, effUnit)` (components.jsx) → poids unitaire, ou `unitaire × qty = total`
  pour une pile ; `null` si l'item ne pèse rien. Branché sur tooltip Équipement, détail du coffre
  commun, `InvItemRow` (fiche + Admin) et tooltip du mini-sac MJ.
  **Aligné sur le poids EFFECTIF** là où le porteur est connu (Équipement + MJ) : l'armure du slot
  `armure` est allégée par le Mental (`armorEffectiveWeight`, règle de `carriedWeight`) → affichage
  `12 (base 20)` en vert, cohérent avec la jauge de charge. Le coffre commun garde le poids brut
  (aucun porteur). ⚠️ **Limite connue** : `InvItemRow` (lignes de liste fiche/Admin) affiche le poids
  de **base** même pour l'armure équipée — le contexte porteur n'est pas passé jusqu'au composant.
  En Admin, la jauge peut donc afficher un total inférieur à la somme des poids listés.
- **Travail de Woolost intégré** (3 commits, système de poids §5) : formule de charge max
  (`30 + Force×5 + Mental×Niveau/10`), seuil de confort (`comfortPct` = 60 % + Hab×2 %, plafond 90 %,
  3 états léger/encombré/surchargé), classes d'armure (`ARMOR_CLASSES` légère 4 / intermédiaire 10 /
  lourde 20) + réduction du poids d'armure par le Mental (−5 %/pt ≤5 puis −1 %/pt, plafond −40 %),
  et **fusion des 4 types d'armure en un type `armor` unique** dans `EQUIP_TYPES`.

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
     **la ceinture = un item `carry`** (+ slot « Ceinture ») ; jauge de poids sur **Équipement + Admin**
     (⚠️ cette note annonçait « fiche + Équipement » : **la fiche joueur n'a jamais eu de jauge** — écart
     de documentation relevé le 2026-08-21, pas un manque signalé par le MJ).
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

### 🔜 PROCHAIN CHANTIER — Rééquilibrage des compétences (diagnostic FAIT, décisions à prendre)
Ouvert le 2026-09-05, à reprendre dans une nouvelle conversation. **Tout le diagnostic est déjà
chiffré au §10 de `docs/superpowers/specs/2026-09-05-calibrage-attaques-base-design.md`** — le
relire AVANT de recommencer une analyse.

**Le socle est prêt** : les attaques de base sont saines et servent d'**unité de mesure**
(invariante au niveau), et le crit ne fausse plus les comparaisons entre personnages.

**Le constat mesuré** (rotation optimale sur 4 tours, cooldowns et mana inclus, niveau 18) :
**3 PJ sur 5 n'ont aucune raison de lancer une compétence**, et il leur reste **90-100 % de leur
mana** en fin de combat. Urskaar ×1.50, Elias ×1.47, Rathael ×1.21, **Smith ×1.04, Jett ×1.00**
(1.00 = ne fait pas mieux que taper gratuitement).

**Budget cible par archétype, en multiples d'AA** (la moyenne converge, c'est la FORME qui
distingue) : AD carry 1.4 soutenu / pic 1.8 ; **assassin 0.7 soutenu / pic 4.0 un tour sur quatre** ;
bruiser 1.3 / 2.2 ; tank 0.8 / 1.6 ; utilitaire 1.0 / 2.5. Moyenne ~1,5 pour les DPS.

**Défauts précis à traiter** :
- **Jett** : ses 2 comps scalent sur l'**AD** alors qu'il est un build AP. Même en replaçant toute
  son Habileté en AD, elles restent à **0,37× son attaque de base**. Ses C3/C4 n'existent pas
  (kits jamais reçus du MJ).
- **Rathael** : sa C1 (20 mana, **sans CD**) fait **0,57× son attaque de base gratuite**. Elle scale
  à 40 % sur (Armure + RM), divisé par deux le 2026-09-04. Idem son passif : **+7 points au total à
  5 charges** au niveau 2. ⚠️ **Divergence à trancher** : le code fait **+10 %/charge**
  (`sumPassiveMods`), le CLAUDE.md et `data.jsx` annoncent **+5 %**.
- **Smith** : passif `50 + 0,5 AP` orphelin (×1,72 sur toute la campagne). **Aucun burst** : même en
  jouant l'enchaînement idéal (Fondu au noir → 3 tours de sournoise furtive), il plafonne à ×1,12 —
  pour un archétype d'assassin.
- **Elias** : passif **surpuissant** — `10 + 5(niv−1)` AD par charge × `5 + ⌊(niv−1)/3⌋` charges =
  **+950 AD au niveau 18** sur un AD de base de 504.
- ⚠️ **Les constantes plates (`50 +`, `100 +`, `25 +`) sont la cause n°1 du décrochage**, AVANT
  l'absence de scaling par niveau. Dominantes à bas niveau, noyées à haut niveau. **Preuve** :
  Urskaar n'a **aucun** scaling de niveau et son ratio comp/AA est **constant à 1,50 du niveau 2
  au 18**, parce que ses formules sont des multiples purs d'AD. Ne pas partir sur « ajouter du
  scaling de niveau partout » sans avoir traité les constantes.
- **Mana non limitant** : les coûts sont dérisoires face aux pools (Jett a 782 de mana pour des
  sorts à 40-50). À remonter une fois les compétences réparées — arbitrage MJ : « le mana doit être
  un minimum limitant sinon il perd de son intérêt ».
- **Jett, incohérence à trancher** : son passif dit que son attaque de base ne fait plus de dégâts
  (elle crée des cellules), mais la carte « Attaque de base » lui affiche `eff.ap` et le bouton
  « Attaquer » fonctionne.

**❓ LA question non tranchée par le MJ** : **scaling numérique par niveau OU upgrades de
compétences au choix du joueur à chaque montée** — le MJ veut **l'un ou l'autre, pas les deux**
(« scale les nombres + upgrade de compétences risquent de rendre les personnages difficiles à
équilibrer »). Recommandation déjà formulée : **les upgrades**, parce que le scaling numérique
existe déjà gratuitement via les stats (cf. Urskaar) et qu'une montée de niveau n'offre aujourd'hui
**aucun moment de choix** au joueur. Sous-question ouverte : format des upgrades (2-3 options
prédéfinies par compétence, ou pool de points libre ?).

- **Monnaie : durcissement des règles RTDB + journal** — ✅ **FAIT, publié et validé le 2026-08-21**
  (résultats de la campagne de tests + 2 bugs antérieurs trouvés au passage : **§9.7 et §10** du
  document de reprise). Restent 3 tests secondaires : 7 (réimport de sauvegarde), 8 (ré-amorçage),
  13 (lecture d'`economyLog` refusée au joueur). Document :
  **document de reprise complet** : `docs/superpowers/specs/2026-08-20-durcissement-monnaie-rtdb-design.md`
  (contexte, patch de règles prêt à coller, points d'accroche du journal, 3 pièges dont l'import de
  sauvegarde cassé par un `.validate`). A reste bloqué sur une **publication manuelle en console Firebase**
  (le dépôt n'a ni CI ni `firebase.json` : `database.rules.json` est une copie de référence, rien ne
  la déploie) — mais `economyLog` en impose déjà une, donc autant faire les deux d'un coup.
- **Lot améliorations graphiques** (brainstormé 2026-06-28, chantiers indépendants — chacun sa spec/plan) :
  **A — Refonte fiche joueur = FAIT** (voir État actuel 2026-06-29).
  **B — Arbre de runes en vrai arbre visuel = FAIT, refondu et VALIDÉ par le MJ** (2026-08-16) :
  constellation radiale, puis **refonte graphique hi-fi** (handoff MJ) — voir État actuel 2026-08-16. Reste :
  **C — Hub d'accueil vivant** (remplacer la page Accueil mockup `pages-lobby.jsx` — boutons « Rejoindre/Créer
  session » + code `VX-7K2` factices, invisible des joueurs — par un vrai tableau de bord : roster du groupe
  PV/mana live, séance en cours, dernier récap, état du combat) ; **D — Passe
  d'animations** transversale (transitions d'onglets, level-up, etc.). Ordre suggéré : C puis D en continu.
- **Nouveau système d'attaque de base** (brainstorm en pause à la demande du MJ) : catégories d'armes
  (`info-mj/Nouveau système de gestion des attaques de base (2).md`) + **maîtrise par perso×arme** (−25 % +
  perte des propriétés si non maîtrisée), idée de **maîtrise qui progresse à l'usage**. À reprendre.
- **Inventaire + Équipement : clos côté code** (perso + commun, transferts, catalogue, plafond 99,
  monnaie vivante, paperdoll, `item.mods` branchés). Reste uniquement de la **saisie de contenu** :
  créer les **armures réelles** avec leur `type` + leurs `mods` (jusqu'ici seuls armes & accessoires
  ont un `type` câblé) — pas de dev, juste remplir `ITEM_CATALOG` / l'éditeur.
- **Compétences** : **implémentées et déployées**, mais ⚠️ **DÉSÉQUILIBRÉES — voir « 🔜 PROCHAIN
  CHANTIER » en tête de ce backlog** (diagnostic chiffré du 2026-09-05). Ce qui suit décrit
  l'existant, pas un état satisfaisant. (Elias/Smith/Urskaar/Jett + **Rathael complet C1→C4 + ultime**).
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
  ⚠️ **SECTION HISTORIQUE** : les chiffres décrits ci-dessous sont ceux de la spec de juin. Deux
  refontes sont passées depuis — **2026-09-04** (9e stat `rescrit`, Habileté au choix AD/AP/Mana,
  armure divisée par deux…) puis **2026-09-05** (courbe de points, escalade locale/globale, crit
  divisé, répartition du Mental). **Ce qui fait foi aujourd'hui :
  `docs/superpowers/specs/2026-09-05-calibrage-attaques-base-design.md` + « État actuel
  (2026-09-05) » en tête de fichier.** Les cibles de PV du §9 de cette spec ne sont plus valides,
  ni sa table d'escalade §4.3, ni ses coefficients de crit.
  Modèle de stats = **4 caractéristiques** (Force/Habileté/Mental/Magie) → 8 stats dérivées à l'époque
  (matrice de poids, escalade anti-aplatissement, socle de niveau, bonus de départ, surcrit,
  équipement en stats finales, zone PNJ).
  Découpé en sous-projets. **Fondation = FAITE (2026-06-21, branche `feat/moteur-stats-refondu`)** : `computeStats` (signature d'alors : `(F,H,M,C,level)`)
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
- `info-mj/Économie - guide des joueurs.md` — économie du monde côté joueurs : 4 monnaies
  (cuivre/argent/or/platine), poids de la bourse, prix courants, potions, soins, **6 échelons
  d'équipement** (§9, grille de prix armes/armures), sertissage, revente, voyage, régions.
- `info-mj/Économie - dotation de départ (options).md` — dotation de création des PJ, 3 options
  chiffrées. **Décision MJ : option 1 « Dépouillé », 25 ar** ; en attente = la contrainte de choix
  d'arme (§2.1, 3 armes sur 10 accessibles à 25 ar).
  ⚠️ Contenu de **règles**, pas de dev : rien n'est branché dans l'app (les prix ne sont pas dans
  `ITEM_CATALOG`). À rapprocher du backlog « équipement en stats finales » si on l'implémente.
- Specs/plans liés : `docs/superpowers/specs/2026-06-16-competences-design.md`,
  `…-inventaire-design.md`, `docs/superpowers/plans/2026-06-16-inventaire.md`.

## Notes
- L'Excel : feuilles Statistiques/Runes/Journal/Grille Personnage + Stats/Grille par joueur.
  Correspondance perso↔joueur : Rathäel=JB, Urskaar=Baptiste, Smith=Erwan,
  **Elias Crowe (id `lunick`)=Fab**, Jett=Steph.
- Gitignore : `node_modules/`, `idée/`, `*.glb`/`*.obj`/`*.fbx` (assets lourds, hors dépôt),
  `info-mj/` (règles privées du MJ — dépôt public).
```
