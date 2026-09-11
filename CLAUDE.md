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
  rés. crit à 20 Mental au lieu de 60 %). Par point :
  Force **15 AD + 1 Armure garantis, puis 15 points AU CHOIX (+10 AD ou +2 Armure, cf. `forceSplit`)**
  /20 PV/5 Mana ;
  Habileté bonus de départ/**au choix par point : +5 AD, +5 AP ou +10 Mana**/**2,5 %Crit**/**4 %D.Crit** ;
  Mental **45 PV + 15 Mana garantis, puis 15 points AU CHOIX (+15 PV ou +15 Mana, cf. `mentalSplit`)**/**3 %Rés.Crit** ;
  Magie **15 AP + 1 Rés.Mag garantis, puis 15 points AU CHOIX (+10 AP ou +2 Rés.Mag, cf. `magieSplit`)**
  /10 PV/30 Mana. Socle : `50+30·niv` PV, `50+15·niv` Mana, `+1` AR et RM/niveau.
  ⚠️ **QUATRE répartitions dirigées, une par carac** (Force et Magie ajoutées le 2026-09-06, en MIROIR
  l'une de l'autre) : `habSplit` / `mentalSplit` / **`forceSplit(F, split)`** → `{ad, armure}` /
  **`magieSplit(C, split)`** → `{ap, resmag}` (+ `defaultForceSplit`/`defaultMagieSplit`,
  `FORCE_DESTS`/`MAGIE_DESTS`, `FORCE_DIRECTED`/`MAGIE_DIRECTED`). Toutes suivent le MÊME contrat :
  escalade distribuée au prorata (répartir ne coûte rien), sur-allocation coupée au budget,
  sous-allocation reversée sur le défaut, absent = jamais confirmé.
  ⚠️ **Les deux destinations de Force/Magie n'ont PAS le même taux (10 contre 2)** — 1 point d'armure
  vaut bien plus qu'1 d'AD (réduction en `AR/(AR+120)`). Ce n'est pas un arbitrage à somme nulle,
  contrairement au Mental (15/15). C'est voulu.
  ⚠️ **Contrairement au Mental (décision D), AUCUNE répartition ne reproduit l'ancien coefficient** :
  avant, un point de Force donnait 25 AD **ET** 2 Armure. Le défaut tout-dégâts garde les **25 AD**
  (donc la matrice de TTK du 2026-09-05, bâtie sur l'AD, reste valide et il n'y a **aucune migration**)
  mais fait tomber l'armure **de 2 à 1 par point** : sur les 5 PJ au niveau 2, Urskaar et Elias passent
  de 15 à 9 d'armure, Rathael de 11 à 6, Jett de 13 à 7 (AR et RM). **La défense se paie désormais** —
  un profil qui veut plus que son armure d'avant place ses points en défense : tout en défense, Urskaar
  monte à **22** d'armure pour 104 AD au lieu de 170. À surveiller en jeu : c'est le 3e tour de vis sur
  l'armure après celui du 2026-09-04, et les armures d'équipement n'existent toujours pas.
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
  `DamageInstanceRow` (joueur→ennemi, lit `enemy.rescrit`) et `EnemyAttackModal` (PNJ→PJ via
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
  `GROUP_CARRY_RATIO` (0,30 — écart assumé : `docs/journal/2026-08-21.md`),
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
  **ACTIONS EN ATTENTE** (spec `docs/superpowers/specs/2026-09-06-actions-en-attente-design.md`) :
  `EFFECT_LABEL`, `hasSelfEffect(sk)`, **`skillTargeting(sk, eff, ctx)`** (ce qu'une comp peut cibler,
  effet par effet — **dérivée des champs existants de `SKILLS`**, surchargeable par `sk.targeting` ;
  ⚠️ elle ÉVALUE `sk.dmg` au lieu de tester `!!sk.dmg`, sinon les cinq comps à `dmg: () => null`
  héritent d'une ligne « Dégâts » vide), **`castSelectionValid(targeting, selection)`**,
  **`buildSelfEffect(sk, eff, ctx, opts)`** (buff/bouclier/compteurs/transfo snapshotés),
  **`buildCastPlan(sk, eff, ctx, selection, opts)`** (→ `{cost, instances[]}`, un `rollCrit` par
  instance, `rng` injectable), **`actionRefundPlan(action, mode)`** (`'cancel'`/`'instance'`/`'fail'`)
  + `refundManaValue(cur, amount, max)` (plafonne au max snapshoté au cast, ne baisse jamais le
  mana courant).
  **Modes d'attaque de base** : `BASIC_MODES` (6 gestes à ratio FIXE sur la puissance d'attaque —
  Attaque 100 % / Coup retenu 50 % / Coup de poing 25 % / Botter le cul 15 % / Bousculade 10 % /
  Gifle 5 %) + `basicMode(id)` (id inconnu → attaque pleine) + `basicModeDamage(power, id)`.
  ⚠️ Rien à voir avec l'ancien `ATTACK_MODES` (posture, retirée — voir Décisions) : ce sont des
  gestes choisis coup par coup. `crit:false` sur tous sauf `normal` = **le mode ne roule pas le dé**.
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
  `ITEM_CATALOG` (catalogue d'items pré-enregistrés pour l'ajout staff : `{cat,name,sub,ic,img,type}`
  + `armorClass`/`weight`/`mods` sur les **18 armures de base** ajoutées le 2026-09-07).
  ⚠️ **`ITEM_CATALOG` n'est qu'un FILET D'AMORÇAGE, pas la source de vérité du catalogue en jeu** :
  `useItemCatalog` fait `catalogArray(map, !!inited, ITEM_CATALOG)` — dès que `campaign/runeterra/catalogInit`
  est vrai (c'est le cas depuis longtemps), le tableau de `data.jsx` **n'est plus jamais lu**. Ajouter un objet
  au jeu = écrire dans **Firebase** (page Admin, ou `firebase database:update`), pas éditer `data.jsx`.
  Éditer les deux reste souhaitable pour qu'un ré-amorçage futur parte juste.
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
  `useMJEnemies` (ennemis Firebase), **`usePendingActions`** (file d'ACTIONS ; `addAction(action,
  instances)` écrit l'action et ses instances EN UNE opération + `removeAction` +
  **`resolveInstance(action, instId, applied)`** — retire une instance, incrémente `appliedCount`,
  et la DERNIÈRE instance emporte le nœud entier), **`applyStatusToCharacter(charId, skillId,
  payload)`** (SEUL endroit où un effet de compétence entre en base depuis le 2026-09-06 : buff,
  bouclier, compteurs, transfo, soin PV — une instance `narrative` n'écrit rien), **`healEnemy`**,
  **`refundCast(plan)`** (rend mana + cooldown d'une action annulée : `getSnapshot` puis écriture
  `manaCur` + `cooldowns/$skillId` ; `plan.restoreCd` distingue une annulation d'un simple `manaPer`),
  orchestrateur `applyHitToEnemy`
  (`mitigateDamage`→`applyDamageToPools`→PV ennemi) + son miroir **`applyHitToCharacter(charId, {armure,
  resmag, hpCur, shield}, dmg, type, letha, turn, counters)`** (même chaîne sur un **PJ** : bouclier puis
  PV, écrit `hpCur`/`shield`, renvoie `{applied, hpCur, shield, ko, glaciation}`).
  ⚠️ **Le passif Glaciation de Rathael est DANS cet orchestrateur**, pas chez ses appelants : c'est le
  seul endroit où « un PJ subit des dégâts » est vrai, et ses deux appelants (`EnemyAttackModal` pour
  un coup de PNJ, `PendingActionsPanel` pour un coup d'un autre PJ) doivent le déclencher à l'identique.
  ⚠️ L'appelant fournit le `eff` (via `mjLive`) : seul le MJ voit la fiche complète d'un PJ — c'est
  la raison pour laquelle la résolution joueur→joueur ne peut se faire que chez lui, et pourquoi elle
  n'a demandé **aucune règle RTDB**. **Journal** : `pushLog(text,kind)`/`useCombatLog()`
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
  ils **ignorent** l'état passé en paramètre (cf. bug de bourse écrasée, `docs/journal/2026-08-21.md`). Constantes `CAMPAIGN = 'campaign/runeterra'`, `SHARED_INV`, `SHARED_COINS`, `COMBAT_TURN`,
  `ENEMIES`, `PENDING_HITS`, `COMBAT_LOG`.
- `components.jsx` — UI partagée : `Avatar`, `ResourceBar`, **`XpBar`** (barre d'XP lecture seule :
  `xp/xpToNext(level)` + label niveau), `BuffBadge`, **`ConsumablesRow`** (rangée de potions
  utilisables, **partagée fiche + onglet Combat** : filtre `cat:'Consommables'` qty>0 à effet parsable,
  applique le gain [`applyHealMods` pour les PV] et décrémente la pile ; `setHp`/`setMana` acceptent
  une valeur **ou un updater**, c'est ce qui la rend branchable des deux côtés sans variante), toasts
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
  honnêtes). **Consommables = vraies potions de l'inventaire** (`HealPanel` → **`ConsumablesRow`**, composant
  **partagé avec l'onglet Combat** (components.jsx) : items `cat:'Consommables'` qty>0
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
  du joueur ciblé en Firebase, KO à 0). **Section « Actions en attente »** (`PendingActionsPanel`,
  file `combat/pendingActions`, refonte du 2026-09-06) : un joueur dépose **UNE action** composée de
  **N instances** (`damage` / `heal` / `status`), chacune sur une cible. Rendu : **une carte encadrée
  par action** (`PendingActionCard` — bordure gauche à la couleur du lanceur, en-tête
  « lanceur · compétence », badge « N instances », coût, round) + une ligne par instance avec sa
  pastille de couleur (`INSTANCE_TONE` : rouge dégâts / vert soin / orange statut) et son compteur
  `2/3` — c'est l'aide visuelle qui permet de repérer les instances d'une même compétence.
  Trois lignes distinctes : `DamageInstanceRow` (crit, type, léthalité, rés. critique de la cible),
  `HealInstanceRow` (un montant, rien d'autre : ni armure ni crit), `StatusInstanceRow` (label
  lisible ; « Valider » pour une instance narrative, qui n'écrit rien). Pied de carte :
  **↺ Annuler la compétence** (rembourse) / **⊘ Échec** (retire tout sans rembourser) ; **✕** par instance.
  **La cible peut être un PNJ OU un PJ** : `PendingActionsPanel.resolveTarget` la résout en un objet
  uniforme `{kind:'enemy'|'pj', name, rescrit, …}` — un PNJ vient de `combat/enemies`, un PJ de
  `CHARACTERS` + `mjLive(c, stOf(id), turn)`, et c'est de là que sort sa rés. critique.
  Appliquer → `applyHitToEnemy` / `applyHitToCharacter` / `healCharacter` / `healEnemy` /
  `applyStatusToCharacter` selon le `kind`.
  ⚠️ **Garde `target.loaded`** : sans état Firebase, `mjLive` retombe sur les PV **de référence**
  (`c.hpCur` est un RATIO, pas une valeur absolue) — appliquer à cet instant écraserait les vrais PV
  du joueur. *Appliquer* reste désactivé tant que la fiche n'est pas arrivée.
  **Le crit/surcrit est roulé par l'app au cast** (`rollCrit`) : la carte MJ affiche **base vs crit**
  (+ badge 🎲 CRIT ×mult, profil `critInfo`), pré-remplit le champ avec le nombre roulé ; le MJ ajuste à son
  d20 de toucher Roll20, règle le type **+ la léthalité** (réduit AR/RM), puis **Appliquer**
  (`applyHitToEnemy(enemy,dmg,type,letha)`) ou **✕**. Cartes : barre de bouclier
  **toujours affichée** (0/0 si vide) ; **pulsation du cadre** selon les PV (classe `mj-card-warn`
  orange < 50%, `mj-card-danger` rouge < 25% — keyframes CSS dans `runeterra.css`).
  **Compteur de tour PARTAGÉ** dans l'en-tête (`useSharedTurn`, Firebase `combat/turn` :
  Fin de tour / précédent / **⟲ Combat** = reset tour + toutes charges/cooldowns + skillBuffs + journal)
  — pilote les CD des compétences. Sous chaque carte joueur : ligne **charges + cooldowns actifs**
  (lecture MJ). **`CombatLog`** (journal de combat partagé) affiché sous le plateau, « Vider » staff ;
  `pushLog` alimenté à la résolution joueur→ennemi (`PendingActionsPanel`), ennemi→joueur (`EnemyAttackModal`),
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
  (mana − coût, pose le cooldown). Bandeau **`MyResources`** en tête (**collant au scroll**, `position:sticky`
  dans le conteneur de scroll de `CompetencesPage`) : jauges **PV / Mana / Bouclier** du lanceur + badge KO
  + `ConsumablesRow` (**potions buvables sans quitter l'onglet**). Maxima lus dans **`eff`**, la même chaîne
  que la fiche (items + runes + passif + `skillBuffs`) — jamais `base`, sinon un buff de PV afficherait une
  barre fausse. Carte **Attaque de base** (arme équipée → `eff.ad`/`eff.ap`, bouton
  « Attaquer » → attaque en attente MJ, **sans mana ni cooldown**) avec **rangée de modes**
  (`BASIC_MODES`, game-logic : gifle 5 %, botter le cul 15 %… — état **local non persisté**, c'est un
  choix par COUP ; le ratio s'applique à `eff.ad` **ou** `eff.ap`, une gifle de mage vaut 5 % d'AP).
  ⚠️ Un mode réduit **ne roule pas** `rollCrit` — on ne neutralise pas le résultat après coup — et
  l'attaque part avec `crit: 0` : la carte du MJ doit dire la vérité de CE coup, pas la fiche de
  l'attaquant. Pas de plancher à 1 dégât : le MJ ajuste le champ à la résolution.
  Puis carte **Passif** (stepper de compteur + effet de stat en vert) + cartes **Actives** (mana, **badge CD statique** dans le coin
  [`1×/tour` / `CD N tours` / `1×/combat` / `Sans CD`, visible sans lancer la comp] + badge d'état
  prêt/tour, dégâts live, « Lancer »).
  **CIBLAGE PAR EFFET** (refonte du 2026-09-06) : chaque carte porte un bloc « Cibles », **une ligne
  par effet** (`TargetRow` — chips de cibles + « + ajouter » filtré par camp), alimenté par
  `skillTargeting`. Une comp mixte (Jett C2 : blesse les ennemis ET soigne les alliés) se cible
  effet par effet dans le MÊME cast. L'attaque de base utilise le **même** bloc, borné à `max: 1`.
  ⚠️ Le sélecteur global « Cible » du bandeau a **disparu** : il ne pouvait pas exprimer « ces deux
  gnolls prennent les dégâts, Urskaar prend le soin ». Le bandeau ne montre plus que l'état du plateau.
  ⚠️ **`nbTargets` a disparu de `SKILL_VARS`** : le nombre de cibles EST la longueur de la sélection.
  `cast(sk, ctx, selection)` **respecte les variables d'attaque** (1er coup/camouflé/cases) et ne fait
  plus que trois choses : vérifier (`skillUnlocked` + `castSelectionValid`), payer (mana + cooldown),
  déposer l'action (`buildCastPlan` → `addAction`). Il renvoie `true` si l'action est partie, ce qui
  vide la sélection de la carte. Données
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
  (`glaciationDecay(counters, endingTurn)`, dans `useSharedTurn.nextTurn`). Le stepper reste un override manuel.
  ⚠️ **`selfBuff` / `selfBuffFlat` / `shield` / `counterBump` / `counterSet` / `transform` ne sont PLUS
  appliqués au cast** (refonte du 2026-09-06) : `buildSelfEffect` les **snapshote** dans une instance
  `status`, et c'est `applyStatusToCharacter` — côté MJ — qui les écrit. Un buff n'apparaît donc sur la
  fiche du joueur **qu'après** la validation du MJ. **Durée de buff** : une comp avec `duration:{min,max}`
  (ex. Mur de Givre 1/2 tours) affiche un sélecteur sur sa carte ; `buildSelfEffect` snapshote
  `until = turn + (durée−1)` → auto-expiration (filtrée par `sumSkillBuffs(buffs, turn)`, sans purge).
  L'`eff` de la page Combat inclut les `skillBuffs` (aligné fiche/équip). Visible des 3 rôles, sélecteur
  de perso pour le staff. Logique pure + testée dans `game-logic.js`. **Plateau partagé** : bandeau
  ennemis en lecture seule (`useMJEnemies`) ; chaque instance de dégâts **roule son propre crit/surcrit**
  (`rollCrit`) et **snapshote les deux léthalités** (`eff.letha`/`eff.lethaMag`) dans l'action en attente
  (`usePendingActions.addAction`) que le MJ résout. **Effets de combat actifs** : panneau
  **en orange** (`--skillbuff`) alimenté par `state/skillBuffs` → boost temps réel via `sumSkillBuffs`→
  `computeEffective`. **Chaque cast journalise UNE entrée** (`pushLog` + `instanceSummary` :
  « 120 dégâts → Gnoll A, Gnoll B · 95 soin → Urskaar — en attente MJ »), et chaque résolution du MJ
  en journalise une autre. **Journal de combat** (`CombatLog`, lecture seule)
  affiché en bas. **Déblocage par niveau** : active n° *i* → niveau *i* requis (`skillUnlocked`), carte
  verrouillée grisée + 🔒 ; **stepper « Niveau » staff** dans l'en-tête (`setField('level')`, niveau
  effectif = `state.level ?? char.level`, pilote aussi passif + budget runes).
- `pages-journal.jsx` — onglet **Journal** (`JournalPage`, staff) : **deux sections** basculées par un bouton
  (`JOURNAL_SECTIONS`, état local) — **⚔ Combat** (`combat/log` via `useCombatLog` ; filtres tous/actions/buffs/KO)
  et **💰 Monnaie** (`economyLog` via `useEconomyLog` ; filtres tous/transferts/gains/retraits). Chaque section a
  son propre « Vider » (celui de la monnaie **demande confirmation** : c'est la seule trace des transferts depuis
  le coffre commun). Horodatage, lecture seule, alimenté par `pushLog` / `pushEconomyLog`.
- `pages-progression.jsx` — onglet **Progression** (`ProgressionPage`) : XP + **respec** (répartition des 4
  caracs) + **les 4 répartitions dirigées** (une `SplitRow` sous chaque carac : Force AD/Armure,
  Habileté AD/AP/Mana, Mental PV/Mana, Magie AP/Rés.Mag) + table des paliers 1→18. Visible des **joueurs** (`prog` ajouté à `PAGE_ACCESS.joueur`, en barre
  principale via `groupByRole:{joueur:'main'}` ; `lockedCharId` = perso du joueur ; staff = sélecteur libre +
  case « Verrouillé »). Steppers par caracs (brouillon local → « Confirmer »), budget = `LEVELS.total +
  CREATION_BONUS`, cap = `LEVELS.limit`, plancher 0 ; **aperçu live** des stats résultantes (`computeStats`).
  **Verrou** : un joueur respec **une fois** → `setAttrs(draft,true)` (écrit `attrs`+`attrsLocked`) ; le staff
  édite librement + (dé)verrouille (`setAttrsLocked`). Logique pure `attrSum`/`respecValid` (game-logic, testées).
  ⚠️ **Deux mécanismes DISTINCTS, souvent confondus** : `attrsLocked` (case « Verrouillé ») gèle toute la page ;
  le **plancher** `floorAttrs = (staff || attrsOpen) ? {} : savedAttrs` interdit de *descendre* une carac déjà
  confirmée. **Décocher « Verrouillé » ne rend PAS la respec** — c'est le bouton **« ↺ Rouvrir la respec »**
  (staff, en-tête du panneau Caractéristiques → `setAttrsOpen` → `state.attrsOpen`) qui lève le plancher, sur le
  modèle exact de `habSplitOpen`/`mentalSplitOpen`. ⚠️ Rouvrir la respec lève **aussi** les planchers des deux
  répartitions : baisser une carac rogne la répartition dérivée via `clampSplitDraft`, qui coupe dans un ordre
  fixe — un plancher maintenu figerait le joueur sur une coupe qu'il n'a pas choisie et ne pourrait plus corriger.
  ⚠️ **TROIS gardes distinctes bloquent « Confirmer » (`disabled={!valid || !dirty}`), et la 2e est celle qui
  se voit le moins** : (1) `attrsValid` — somme ≠ budget ou carac > cap, **visible** dans le compteur d'en-tête ;
  (2) `splitLeft`/`mentLeft` — points en **réserve de répartition** non placés, **invisibles dans l'en-tête**,
  qui affiche « 0 restant » en vert car il ne compte que les caracs ; (3) `dirty` — rien n'a changé.
  Monter l'Habileté ou le Mental ouvre TOUJOURS une réserve (2), d'où le bug du 2026-09-06.
  D'où trois affordances, à ne pas retirer : **`confirmHint` AFFICHÉ** à côté du bouton (pas seulement en
  `title` — une infobulle n'existe pas au doigt sur tablette), **cadre de la répartition en OR** tant que
  `left > 0`, et bouton **« Tout placer »** (`fillSplit`/`fillMent` → `habSplit`/`mentalSplit`, qui versent le
  reliquat sur la destination par défaut ; amorce déplaçable ensuite).
  Deux autres boutons complètent le cycle de respec : **« Tout à 0 »** (`clearDraft`, en-tête, visible si
  `staff || attrsOpen`) — **seul point d'entrée d'une redistribution à budget plein**, puisque `canInc` exige
  `remaining > 0` et qu'à 10/10 tous les « + » sont morts ; et **« Garder la répartition »** (`keepAttrs`,
  visible si `attrsOpen && valid && !dirty`) — sans lui, un joueur qui ne veut RIEN changer après une
  réouverture n'a aucune écriture possible (garde `dirty`) et la fenêtre `attrsOpen` reste ouverte jusqu'à ce
  que le MJ la referme à la main. ⚠️ Bouton séparé plutôt qu'un assouplissement en `dirty || attrsOpen` : un
  clic malencontreux refermerait la respec à la seconde où le MJ vient de l'ouvrir.
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
  ⚠️ **Le `!` de Claude Code lance en Git Bash, pas en PowerShell** (vérifié le 2026-09-09) :
  le préfixe `MSYS_NO_PATHCONV=1` y est donc **obligatoire** aussi.
  ⚠️ **`database:update` / `database:set` exigent `--force` en non-interactif** : leur prompt de
  confirmation n'a pas de stdin et retombe sur « non » (`Error: Command aborted`).
  ⚠️ **Firebase réordonne les clés alphabétiquement** : comparer une relecture au fichier local
  avec un `JSON.stringify` direct produit de **fausses divergences** (`{hp,armure}` contre
  `{armure,hp}`). Trier les clés en profondeur avant de comparer.
  ⚠️ Le code de sortie a déjà été **255** malgré une sortie correcte (ne pas conclure à un échec) ;
  en CLI 15.28.1 il vaut **0**. Se fier à la sortie, pas au code. C'est ce qui permet de vérifier **avant** (dérive
  console ?) et **après** (le déploiement fait-il ce qu'on croit ?) chaque publication.
  Attention en PowerShell : `Out-File -Encoding utf8` ajoute un **BOM** qui fait diverger le `diff`
  sur la 1re ligne — le retirer avant de comparer (`sed 's/^\xef\xbb\xbf//'`).
- `database.rules.json` — règles RTDB strictes basées sur `/users/{uid}` (rôles).
  ✅ **En ligne == dépôt, vérifié par relecture le 2026-09-06** (`firebase database:get`,
  diff vide après normalisation) : aucune publication en attente, aucune dérive console.
  Les mentions « RÈGLES RTDB À REPUBLIER » des entrées d'état antérieures sont **historiques**
  — elles ont toutes été publiées depuis.
  Contenu : joueur = sa fiche seule, staff = tout ; **`campaign/runeterra` a un `.write` `mj`+`admin`**
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
  partagés) ; **`combat/pendingActions` = lecture inscrits, écriture STAFF ou PROPRIÉTAIRE**
  (`attackerId === son charId`, lu dans `newData` à la création et dans `data` à la suppression) —
  un joueur dépose son action, le MJ la résout. ⚠️ Le `.write` est sur **`$actionId`**, ce qui couvre
  la suppression du nœud entier ET celle d'une instance : le geste du MJ porte exactement sur le
  nœud qui donne le droit. ⚠️ Durcissement par rapport à l'ancien `pendingHits`, où **n'importe quel
  inscrit pouvait supprimer l'attaque de n'importe qui** ; `combat/log` = lecture+**écriture tout inscrit**
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
    forceSplit:  { ad, armure }   ← répartition de la part DIRIGÉE de la Force (2026-09-06) : chaque point donne 15 AD + 1 Armure garantis, PLUS 15 points au choix (+10 AD ou +2 Armure) ; écrit par setAttrs EN MÊME TEMPS que attrs
                     ABSENT = jamais confirmé → défaut TOUT EN AD (= 25 AD/pt, l'ancien coefficient offensif) : l'AD des persos existants ne bouge pas, aucune migration — seule l'armure tombe de 2 à 1 par point
    magieSplit:  { ap, resmag }   ← MIROIR exact de forceSplit sur la Magie (+10 AP ou +2 Rés.Mag) ; défaut TOUT EN AP
    forceSplitOpen / magieSplitOpen: true   ← mêmes drapeaux MJ que habSplitOpen/mentalSplitOpen, SÉPARÉS (setForceSplitOpen / setMagieSplitOpen) : rendre une répartition ne doit jamais rendre les trois autres
    habAd:       4   ← LEGACY (forme AD-seul, a vécu une journée) : encore relue par charBaseStats, purgée au prochain « Confirmer »
    attrsLocked: true   ← verrou après respec joueur unique ; le staff peut éditer/déverrouiller (setAttrsLocked)
    attrsOpen:   true   ← drapeau MJ : suspend le PLANCHER de respec du joueur (ses caracs déjà confirmées) et, avec lui, ceux
                     des QUATRE répartitions ; posé/retiré par setAttrsOpen (bouton « ↺ Rouvrir la respec », staff), effacé
                     automatiquement à la confirmation suivante. ⚠️ NE PAS confondre avec attrsLocked, qui est l'inverse et
                     plus dur : attrsLocked gèle TOUTE la page, attrsOpen ne lève que le plancher — décocher « Verrouillé »
                     ne rend donc PAS la respec
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
/campaign/runeterra/combat/pendingActions/{actionId}/   ← ACTIONS proposées par les joueurs (remplace pendingHits depuis 2026-09-06)
    attackerId, attackerName, skillId, skillName, source:'skill'|'basic', round, ts
    cost: { mana, manaPer, manaMax, cdPrev }   ← le coût appartient à l'ACTION, pas à l'instance : N cibles = un seul mana et un seul cooldown
                                                  cdPrev = cooldown d'AVANT le cast (absent = la comp était prête, Firebase efface les null)
                                                  manaPer = mana facturé PAR CIBLE (0 partout aujourd'hui ; c'est la seule raison de rembourser une instance isolée)
    appliedCount: 0   ← SEUL champ muté après création ; dès qu'il dépasse 0 plus RIEN n'est jamais remboursé (la comp a eu lieu)
    instances: { {instId}: { id, seq, kind:'damage'|'heal'|'status', targetId, label, … } }
        targetId = un PNJ (`combat/enemies`) OU un PJ (`charId`) ; pour un `status` c'est le lanceur lui-même
        kind 'damage' : computedDmg, critDmg, didCrit, critMult, type, letha, lethaMag, crit, dcrit, vol, sapience, omni, hpMax, modeId
        kind 'heal'   : amount
        kind 'status' : mods, until, shield, counters, transformUntil, hpGain, hpMax — ou narrative:true (effet en table, « Valider » n'écrit rien)
                                              modeId = mode d'attaque de base (`BASIC_MODES`) quand `skillId === 'basic'` ; absent = attaque pleine
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
- **Système de mode de combat (offensif/équilibré/défensif) RETIRÉ** — et définitivement abandonné
  (`f509f42`) : c'était une **posture** choisie pour le tour, multipliant toute l'attaque et annulant
  le crit.
  ⚠️ **À ne pas confondre avec les `BASIC_MODES` ajoutés le 2026-09-06** (gifle, botter le cul…),
  qui sont des **gestes nommés choisis coup par coup** sur la carte d'attaque de base. Le défaut
  reste `normal` = **dégâts pleins** ; un mode réduit ne roule pas le dé de crit (ruling MJ).
- **Le joueur PROPOSE, le MJ RÉSOUT** (refonte du 2026-09-06) : un cast dépose UNE action de
  N instances (`damage`/`heal`/`status`) dans `combat/pendingActions` et **n'écrit aucun effet**.
  Le joueur n'écrit jamais un EFFET de compétence — ni les PV d'autrui, ni un buff, pas même
  sur lui. Les deux seules écritures qui lui restent sont son **coût** au cast (mana +
  cooldown, sinon la comp serait relançable pendant que le MJ arbitre) et ses **potions**.
  Un PJ peut viser un PJ ; un effet peut soigner ; une comp peut cibler N combattants et mélanger
  dégâts et soins dans le même cast (Jett C2). Le coût appartient à l'ACTION, pas à l'instance.
  ⚠️ Cette décision **remplace** l'ancienne « soins ciblés et AOE hors périmètre » : `sk.heal`
  (Jett C2), affiché mais appliqué nulle part depuis toujours, fonctionne désormais.
  ⚠️ **Reste hors périmètre** : les zones d'effet géométriques (rayon, cône, cases) — le MJ
  désigne les cibles touchées, l'app ne modélise pas de plateau ; et les débuffs sur cible
  (stun, saignement, marque), que le modèle accueille mais qu'aucun kit ne chiffre.
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
node --test test/game-logic.test.js          # logique pure (255 tests au 2026-09-06)
node --test test/auth.test.js                 # helpers d'auth (11 tests)
python -m http.server 5050 --bind 127.0.0.1  # servir le site (autre terminal)
SMOKE_USER=smoke SMOKE_PASS=... node test/smoke.mjs   # smoke (règles publiées + compte attribué)
```
Vérif syntaxe d'un .jsx : `npx esbuild fichier.jsx >/dev/null` (⚠️ **pas** de `--loader=jsx` :
ce flag ne vaut que pour stdin, esbuild déduit le loader de l'extension).
SRI des scripts CDN : `curl -s <url> | openssl dgst -sha384 -binary | openssl base64 -A`.

**Banc d'essai d'une PAGE, sans Firebase ni authentification** (technique qui a trouvé le bug de respec
du 2026-09-06, là où la lecture du code avait conclu à tort à un simple défaut d'ergonomie) : écrire une
page jetable à la racine (servie par le `http.server` ci-dessus) qui charge React/Babel, `game-logic.js`,
`data.jsx`, puis **le vrai `data-state.jsx` et la vraie page** par-dessus un **faux `window.RTDB` en
mémoire** — l'API tient en 6 lignes (`subscribePath`/`updatePath`/`setPath`/`getSnapshot`) et doit
reproduire les deux sémantiques de Firebase qui comptent : **écho asynchrone** (`setTimeout`) et
**`null` = suppression**. Piloter avec `npm i playwright-core` + `chromium.launch({channel:'chrome'})`
(utilise le Chrome installé, **aucun navigateur à télécharger**). ⚠️ **Bouchonner `useCharState` ne sert
à rien** — un premier banc qui le faisait ne reproduisait rien ; c'est en branchant la vraie couche
d'état que le blocage est apparu. Penser à supprimer la page, `node_modules` et le `package.json` généré
(`git checkout -- package.json package-lock.json`) après coup.

⚠️ **Ne jamais éditer un fichier accentué via PowerShell 5.1** (`Get-Content -Raw` + `Out-File`) :
il relit l'UTF-8 en ANSI et réécrit un BOM + des accents cassés (`é`→`Ã©`). Utiliser l'outil Edit,
ou `perl -i -pe` pour un search-replace global (ex. le bump du token de cache).

⚠️ **Script Python lancé par heredoc depuis Git Bash — deux pièges qui ont VIDÉ un fichier**
(2026-09-05, `pages-progression.jsx` récupéré par `git checkout`) :
1. **Un `\\` du heredoc arrive à Python comme `\`.** Un `"\\uD83D\\uDD13"` censé
   produire l'échappement JS littéral devient donc `"\uD83D\uDD13"`, soit deux vrais
   **surrogates seuls** → `UnicodeEncodeError: surrogates not allowed` à l'écriture (et un `\u`
   isolé casse carrément le parsing du script). Ne pas écrire d'échappement `\u` dans le script :
   insérer le **vrai caractère** (`chr(0x1F513)`, via un jeton de remplacement pour ne pas le taper
   dans la source). Les `.jsx` du dépôt contiennent déjà des emoji littéraux et `index.html` déclare
   `charset=utf-8` — un caractère brut y est parfaitement valide.
2. **`io.open(p,'w')` TRONQUE le fichier avant d'encoder** : si l'encodage échoue pendant le
   `write()`, il ne reste **rien**. Toujours encoder d'abord (`data = s.encode('utf-8')`) puis ouvrir
   en `'wb'` — l'exception tombe alors **avant** que le fichier ne soit touché.
   ⚠️ **La forme chaînée `io.open(p,'wb').write(s.encode('utf-8'))` DÉFAIT cette garde** (vécu
   le 2026-09-06, `CLAUDE.md` vidé puis récupéré par `git checkout`) : Python évalue l'appelé
   `io.open(p,'wb')` **avant** l'argument, donc le fichier est tronqué **puis** l'encodage lève.
   Les octets doivent être liés à une variable sur une **ligne séparée** avant tout `open`.
Accessoire : `print()` d'un texte accentué échoue aussi (stdout en cp1252) — logger en ASCII.

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

## État actuel (résumé au 2026-09-11)
Le détail de chaque livraison vit dans **`docs/journal/AAAA-MM-JJ.md`** (une entrée par jour, texte
d'origine, déplacé d'ici le 2026-09-11 pour la limite de taille du CLAUDE.md). ⚠️ **Avant de toucher un
sujet, lire son entrée** : c'est là que sont les ⚠️, les « ne pas faire » et le pourquoi des décisions.
**Nouvelle livraison = nouveau fichier `docs/journal/<date>.md`** + une ligne dans l'index ci-dessous,
jamais une nouvelle section ici.

**Dernier état** : cache `20260909-1`, **266 tests verts** (game-logic 255 + auth 11). Règles RTDB
en ligne == dépôt (relecture du 2026-09-06). Les 18 armures de base sont **en base** (Firebase).

**👉 Reste à faire EN JEU (annonces à la table, toutes en attente)** :
- **quatre répartitions dirigées** (Force AD/Armure, Habileté AD/AP/Mana, Mental PV/Mana, Magie
  AP/Rés.Mag) — et l'armure/RM de chacun a **baissé sans qu'il ait rien fait** (défaut tout-dégâts) → 2026-09-06 ;
- **18 armures au catalogue** (une légère double presque l'armure d'un PJ niveau 2) → 2026-09-07 ;
- **3 patchs** : +5 AR/RM de socle, omnivamp cumulative, armures légères 7 → 10 → 2026-09-09.

**À éprouver à une vraie table** : initiative/créneaux (2026-09-02) ; rythme des actions en attente —
un buff n'apparaît qu'après le clic du MJ (2026-09-06) ; encaissement des profils offensifs à bas
niveau (2026-09-06).

**Suivant** : les **armes** (§7.1 : +15/+30/+70 AD ou AP ; aucune entrée d'`ITEM_CATALOG` n'a de
`mods`) → 2026-09-09 ; puis le **rééquilibrage des compétences** (voir backlog).
**Laissé ouvert exprès, ne pas rouvrir comme un bug** : le profil PV domine le profil résistance en
début de campagne (2026-09-09).

| Entrée | Sujets |
|---|---|
| [2026-09-09](docs/journal/2026-09-09.md) | Barème de valeur des stats (équivalent AD) ; patchs `BASE_AR_RM`, omnivamp cumulative, armures légères |
| [2026-09-07](docs/journal/2026-09-07.md) | Les 18 armures de base au catalogue ; divergences catalogue ↔ guide d'économie (potions, armes) |
| [2026-09-06](docs/journal/2026-09-06.md) | Spécialisation Force/Magie ; bug « Confirmer » inerte en respec ; **refonte actions en attente** ; modes d'attaque de base + ciblage PJ ; ressources + potions dans l'onglet Combat ; buffs absents du Combat |
| [2026-09-05](docs/journal/2026-09-05.md) | « ↺ Rouvrir la respec » (`attrsOpen`) ; **calibrage des attaques de base** (LEVELS, escalade, crit, répartition du Mental) |
| [2026-09-04](docs/journal/2026-09-04.md) | Répartition des caracs rechiffrée ; résistance critique ; Habileté au choix AD/AP/Mana |
| [2026-09-03](docs/journal/2026-09-03.md) | Arrivée tardive `joinRound` automatique |
| [2026-09-02](docs/journal/2026-09-02.md) | **Gestion des tours** : initiative, créneaux dérivés, KO différé, PNJ alliés, ouverture de `hpCur` |
| [2026-08-21](docs/journal/2026-08-21.md) | Poids (monnaie, canal groupe, coffre + attelage) ; bug purge de journal (MJ) ; bug bourse écrasée ; journal d'économie ; durcissement des bourses |
| [2026-08-20](docs/journal/2026-08-20.md) | Édition libre des bourses (`CoinEditor`) ; monnaies cuivre/argent/or/platine + change |
| [2026-08-17](docs/journal/2026-08-17.md) | Lisibilité et code couleur des stats ; léthalité magique ; bascule principales/secondaires |
| [2026-08-16](docs/journal/2026-08-16.md) | Nettoyage des branches ; refonte graphique de l'arbre de runes ; Sadisme ; infobulles ; poids affiché |
| [2026-06-29](docs/journal/2026-06-29.md) | Refonte fiche joueur ; ultime de Rathael automatisé |
| [2026-06-24](docs/journal/2026-06-24.md) | Retrait d'XP ; fusion des slots d'armure ; système de poids ; badge CD ; admin inventaire/catalogue |
| [2026-06-20](docs/journal/2026-06-20.md) | Compétences + plateau partagé + buffs/journal ; correctifs de playtest ; ennemis v1 |
| [2026-06-18](docs/journal/2026-06-18.md) | Arbre de runes ; récaps de séance ; catalogue + pile 99 ; inventaire/transferts ; paperdoll |

## Chantiers en cours / backlog

### 🔜 PROCHAIN CHANTIER — Rééquilibrage des compétences (diagnostic FAIT, décisions à prendre)
Ouvert le 2026-09-05, à reprendre dans une nouvelle conversation. **Tout le diagnostic est déjà
chiffré au §10 de `docs/superpowers/specs/2026-09-05-calibrage-attaques-base-design.md`** — le
relire AVANT de recommencer une analyse.

**Le socle est prêt** : les attaques de base sont saines et servent d'**unité de mesure**
(invariante au niveau), et le crit ne fausse plus les comparaisons entre personnages.

⚠️ **La PLOMBERIE a changé depuis ce diagnostic** (refonte « actions en attente » du 2026-09-06,
à lire avant de toucher un kit) : une compétence peut désormais **cibler N combattants**, **soigner**
et **mélanger dégâts et soins** dans le même cast, et ses effets sur soi sont **snapshotés** par
`buildSelfEffect` puis appliqués par le MJ. Trois conséquences pour le rééquilibrage :
- **`sk.heal` fonctionne enfin** — le diagnostic du 2026-09-05 chiffrait Jett sans son soin (C2),
  qui était affiché mais appliqué nulle part. Son ratio comp/AA est donc **sous-évalué** au §10.
- **Le multi-cible est réel** : la rotation optimale d'une comp de zone (Salve, Éclat de l'âme,
  Chaînes, Écrasement) doit se rechiffrer **par nombre de cibles**, pas par coup.
- **`manaPer`** (mana facturé à la cible) existe déjà dans le modèle et vaut 0 partout — c'est le
  levier tout traçé pour l'arbitrage MJ « le mana doit être un minimum limitant » sur les comps
  de zone, sans toucher au coût des comps mono-cible.

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
  **A — Refonte fiche joueur = FAIT** (voir `docs/journal/2026-06-29.md`).
  **B — Arbre de runes en vrai arbre visuel = FAIT, refondu et VALIDÉ par le MJ** (2026-08-16) :
  constellation radiale, puis **refonte graphique hi-fi** (handoff MJ) — voir `docs/journal/2026-08-16.md`. Reste :
  **C — Hub d'accueil vivant** (remplacer la page Accueil mockup `pages-lobby.jsx` — boutons « Rejoindre/Créer
  session » + code `VX-7K2` factices, invisible des joueurs — par un vrai tableau de bord : roster du groupe
  PV/mana live, séance en cours, dernier récap, état du combat) ; **D — Passe
  d'animations** transversale (transitions d'onglets, level-up, etc.). Ordre suggéré : C puis D en continu.
- **Nouveau système d'attaque de base** (brainstorm en pause à la demande du MJ) : catégories d'armes
  (`info-mj/Nouveau système de gestion des attaques de base (2).md`) + **maîtrise par perso×arme** (−25 % +
  perte des propriétés si non maîtrisée), idée de **maîtrise qui progresse à l'usage**. À reprendre.
- **Inventaire + Équipement : clos côté code** (perso + commun, transferts, catalogue, plafond 99,
  monnaie vivante, paperdoll, `item.mods` branchés). Reste de la **saisie de contenu** — chantier
  ouvert le 2026-09-07, document de reprise `docs/superpowers/specs/2026-09-07-catalogue-objets-design.md` :
  **armures de base FAITES** (18, dans `data.jsx`) mais ⏳ **l'écriture Firebase reste à passer** ;
  puis **armes** (aucune n'a de `mods`, alors que le §7.1 les chiffre : +15 AD / +15 AP / +10-10 hybride),
  **potions** (le catalogue est 2 à 3× sous le guide d'économie, et c'est le catalogue qui s'applique
  en jeu), et **palier supérieur des armures** (non chiffré dans la spec, à faire trancher par le MJ).
- **Compétences** : **implémentées et déployées**, mais ⚠️ **DÉSÉQUILIBRÉES — voir « 🔜 PROCHAIN
  CHANTIER » en tête de ce backlog** (diagnostic chiffré du 2026-09-05). Ce qui suit décrit
  l'existant, pas un état satisfaisant. (Elias/Smith/Urskaar/Jett + **Rathael complet C1→C4 + ultime**).
  Le passif Rathael (+5%/charge Armure+RM de base) calcule un mod plat depuis les stats de
  base (`sumPassiveMods(...,base)`). Charges Glaciation **automatisées** : +1/coup subi (tout stackable en 1 tour,
  max 5 ; +2/coup pendant Souverain Glacial via `souverainUntil`) ; −3/tour sans dégât (`glaciationDecay`). **À FAIRE
  plus tard** : (1) **comps Jett C3/C4** (kits pas encore reçus) à ajouter dans `SKILLS` + `game-logic.js` ;
  (2) automatiser l'état Âme fendue de Rathael à 5 charges (aujourd'hui narratif/manuel) ; (3) Phase 2 :
  auto-application des dégâts aux ennemis (aujourd'hui le MJ saisit le nombre dans « Subir »).
- **Arbre de runes** : **FAIT et déployé** (voir `docs/journal/`). Les 5 familles sont chiffrées
  (`RUNES`, data.jsx) et interactives. Reste seulement la validation MJ (capstone vs thématique,
  2 cellules tronquées).
- **Nouveau système d'attaques de base** (`info-mj/`) : catégories d'armes + propriétés +
  maîtrise (−25 % si non maîtrisée). **Remplace** l'ancienne idée ×1.5/×1.75.
- **Journal de combat partagé** : **FAIT** (`combat/log`, `CombatLog` ; voir `docs/journal/`).
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
  `docs/superpowers/specs/2026-09-05-calibrage-attaques-base-design.md` +
  `docs/journal/2026-09-05.md`.** Les cibles de PV du §9 de cette spec ne sont plus valides,
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
  caps `LEVELS.limit`, verrou unique joueur + (dé)verrouillage staff + réouverture du plancher
  (`setAttrsOpen`) ; `setAttrs`/`setAttrsLocked`,
  `attrSum`/`respecValid` testés). **Reste** (sous-projets séparés) : (1) **équipement en stats finales**
  (armes 3 paliers + 18 armures §7) ; (2) **zone PNJ/divine** (escalade quadratique >20 §8 ;
  `escalationFactor` gère déjà >20). **Crit/léthalité ennemi→joueur = FAIT (2026-06-22)** : `makeEnemy`
  +`crit`/`dcrit`/`letha`, édition inline `EnemyCard`, `EnemyAttackModal` roule le crit (`rollCrit`) + applique
  la léthalité (`mitigateDamage`). Aussi livré ce jour : **vol de vie/sapience/omnivamp** (soin de l'attaquant à
  la résolution MJ, séparation par source : attaque de base→vol/sapience, comp→omnivamp ; `lifestealHeal` testé,
  orchestrateur `healCharacter`). Aucune règle RTDB.

## Infos MJ (`info-mj/` — source de vérité des règles détaillées)
⚠️ **Le dossier est gitignoré (dépôt public) : RIEN ne le synchronise entre les postes du MJ et de
l'admin.** Au 2026-09-07, la machine du MJ n'avait que 3 des 8 fichiers listés ici. Deux ont été
retrouvés depuis et replacés : `SPECIFICATION - Système refondu.md` (2026-09-07) et
`Nouveau système de gestion des attaques de base (2).md` (2026-09-09).
**Restent manquants côté MJ** : `Compétences-Races PJ`, `Système de Runes.md`, `Codes App Script.md`,
`tableau_XP.png`. Les rapatrier AVANT tout chantier qui en dépend (le rééquilibrage des compétences
a besoin du premier).
⚠️ **Où chercher un fichier manquant** : `~/Downloads` et `~/OneDrive/Documents/Claude` — les deux
retrouvés y étaient. Et **chercher en `.docx`, pas en `.md`** : cette liste les nomme en `.md`, mais
le MJ les produit sous Word. Convertisseur docx→md (paragraphes, titres, listes, tableaux) écrit le
2026-09-09, à refaire au besoin : `zipfile` + `word/document.xml` en ElementTree, ~80 lignes de
Python. Prendre la version la plus RÉCENTE par date de modification, pas par numéro de suffixe.
⚠️ **`~/Downloads/Cat_gories_d_Armes_Runeterra.csv` est OBSOLÈTE** (avril 2025) : il décrit les armes
par **modes offensif/équilibré/défensif**, c'est-à-dire le système de posture **retiré et
définitivement abandonné** (`f509f42`). Ne pas s'en servir — le document `.docx` ci-dessus le remplace.
- `info-mj/SPECIFICATION - Système refondu.md` — système hypermétrique. **§7.1 armes** (+15/+30/+70 AD ou AP
  par palier) et **§7.2 armures** (3 classes × 6 profils = 18 armures de base, valeurs + noms + malus de
  classe) : c'est la source des stats d'équipement, introuvable ailleurs. ⚠️ Ses §3/§4/§6 et ses cibles de
  PV du §9 sont **PÉRIMÉS** (refontes des 2026-09-04 et 2026-09-05) ; seul le §7 fait encore foi.
- `info-mj/Compétences-Races PJ (mis à jour).md` — kits complets (passif + comps) + races/
  traits par niveau. ⚠️ La section « Lunick » = ancien perso mort (ignorer) ; voir « Elias ».
- `info-mj/Système de Runes.md` — règles de l'arbre de runes (points = niveau, Mineure→
  Avancée→Fondamentale, thématiques de famille = −2 CD).
- `info-mj/Nouveau système de gestion des attaques de base (2).md` — **41 catégories d'armes**
  (type/tenue/portée/propriétés) + **~35 propriétés** décrites + règle de maîtrise (sans maîtrise :
  **−25 % dégâts ET perte de toutes les propriétés**). ⚠️ Il ne donne **AUCUNE valeur de stat** : les
  bonus d'arme viennent du **§7.1 de `SPECIFICATION`**, les prix du **§9.1 du guide d'économie**. Les
  trois sources sont disjointes et leurs nomenclatures **ne coïncident pas** (41 catégories / 10 armes
  tarifées / 9 entrées `ITEM_CATALOG` / 10 dans `WEAPONS`).
  ⚠️ **`type` y désigne la stat de CALCUL (AD/AP/hybride), pas le type de dégâts** — une arme
  « physique » peut infliger des dégâts magiques. `tenue` = 1H/2H/poly (poly = **+2 aux jets
  d'attaque** à deux mains). `WEAPONS` (data.jsx) en est une amorce partielle : il porte déjà
  `cat`/`type`/`stat`, mais **mélange tenue et portée** dans son champ `type` (`'Portée'` y côtoie
  `'1H'`/`'2H'`/`'Poly'`).
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
