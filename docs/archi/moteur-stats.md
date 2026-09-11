# Moteur de stats, caractéristiques et progression

Détail de la « Carte des fichiers », déplacé depuis `CLAUDE.md` le 2026-09-11 (limite de taille),
texte inchangé. Les renvois « voir Décisions » / « Infos MJ » visent les sections de `CLAUDE.md` ;
« État actuel AAAA-MM-JJ » vise `docs/journal/AAAA-MM-JJ.md`.

## `game-logic.js` — moteur de stats (`computeStats`, répartitions, calibrage, crit)

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

## `game-logic.js` — XP

  **XP** : `xpToNext(level)` (courbe officielle du MJ
  `180 + 100*level` = `info-mj/tableau_XP.png` ; **cap niveau 18** → `Infinity` au cap, `MAX_LEVEL=18`)
  + `applyXp(level, xp, gain)` (montée auto avec report du surplus en cascade, figée au cap)
  + `applyXpLoss(level, xp, loss)` (miroir : descente en cascade, plancher niveau 1 / xp 0 — corrige une
  saisie d'XP erronée). **Poids porté** : `carriedWeight(items, mental, equipment, coins)` (Σ `weight×qty`,

## `pages-progression.jsx` — onglet Progression (respec + répartitions)

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
