# Chantiers en cours / backlog

Déplacé depuis `CLAUDE.md` le 2026-09-11 (limite de taille). `CLAUDE.md` n'en garde qu'un résumé
dans sa section « Chantiers en cours / backlog » ; **ce fichier fait foi**.

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
  **armures de base FAITES** (18, dans `data.jsx` **et en base Firebase** depuis le 2026-09-09) ;
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
  **Respec joueur = FAIT et déployé** (onglet Progression, voir `docs/archi/moteur-stats.md` : budget `LEVELS.total+CREATION_BONUS`,
  caps `LEVELS.limit`, verrou unique joueur + (dé)verrouillage staff + réouverture du plancher
  (`setAttrsOpen`) ; `setAttrs`/`setAttrsLocked`,
  `attrSum`/`respecValid` testés). **Reste** (sous-projets séparés) : (1) **équipement en stats finales**
  (armes 3 paliers + 18 armures §7 — les 18 armures sont faites depuis le 2026-09-07) ; (2) **zone PNJ/divine** (escalade quadratique >20 §8 ;
  `escalationFactor` gère déjà >20). **Crit/léthalité ennemi→joueur = FAIT (2026-06-22)** : `makeEnemy`
  +`crit`/`dcrit`/`letha`, édition inline `EnemyCard`, `EnemyAttackModal` roule le crit (`rollCrit`) + applique
  la léthalité (`mitigateDamage`). Aussi livré ce jour : **vol de vie/sapience/omnivamp** (soin de l'attaquant à
  la résolution MJ, séparation par source : attaque de base→vol/sapience, comp→omnivamp ; `lifestealHeal` testé,
  orchestrateur `healCharacter`). Aucune règle RTDB.
