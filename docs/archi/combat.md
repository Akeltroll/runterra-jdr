# Combat : actions en attente, résolution MJ, compétences

Détail de la « Carte des fichiers », déplacé depuis `CLAUDE.md` le 2026-09-11 (limite de taille),
texte inchangé. Les renvois « voir Décisions » / « Infos MJ » visent les sections de `CLAUDE.md` ;
« État actuel AAAA-MM-JJ » vise `docs/journal/AAAA-MM-JJ.md`.

## `game-logic.js` — actions en attente, modes d'attaque, mitigation, crit

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
  **ARMES ET MAÎTRISES** (2026-09-15, spec `docs/superpowers/specs/2026-09-14-armes-maitrises-design.md`) :
  `WEAPON_CATEGORIES` (38 : les 37 du document MJ sans les explosifs, + `arc_hextech`), `WEAPON_PROPERTIES`
  (texte RÉVISÉ + `passiveMods(level)` pour Canalisation/Plénitude), `WEAPON_TIER_MODS` (§7.1),
  `weaponLoadout(equipment, items)` (arme d'attaque = l'arme NON mini des deux mains ; `pair`
  `mini+mini`/`main+mini` ; `twoHanded` ; `issues`), `basicAttackProfile(loadout, masteries, eff, choice)`
  (stat/type selon le MODE d'arme, ratio 0,6 mini seule / 1 mini+mini, ×0,75 sans maîtrise hors mini,
  propriétés utilisables et perdues), `sumWeaponPropMods` (branché DANS `sumItemMods`, qui prend désormais
  `masteries, level` et ignore les armes rangées en accessoire), `equipSlotCheck` (2H = autre main vide,
  deux armes non mini interdites, seules les mini-armes en accessoire).
  ⚠️ **Une arme sans `weaponCat` est NEUTRE** (une main, maîtrisée, sans propriété) : c'est le comportement
  d'avant la livraison, gardé exprès pour les objets uniques.
  ⚠️ **Livraison 1 seulement** : les propriétés sont AFFICHÉES (rappels), aucune n'est automatisée.
  Les lots 2 et 3 sont décrits au §5 de la spec.
  **Modes d'attaque de base** : `BASIC_MODES` (6 gestes à ratio FIXE sur la puissance d'attaque —
  Attaque 100 % / Coup retenu 50 % / Coup de poing 25 % / Botter le cul 15 % / Bousculade 10 % /
  Gifle 5 %) + `basicMode(id)` (id inconnu → attaque pleine) + `basicModeDamage(power, id)`.
  ⚠️ Rien à voir avec l'ancien `ATTACK_MODES` (posture, retirée — voir Décisions) : ce sont des
  gestes choisis coup par coup. `crit:false` sur tous sauf `normal` = **le mode ne roule pas le dé**.
  Combat (vue MJ) : `mitigateDamage`
  (armure/resmag, `AR/(AR+MITIGATION_K)` avec K=100 depuis le 2026-09-12, **léthalité** réduit AR/RM sans passer sous 0, brut sans réduction) +
  `applyDamageToPools` (bouclier puis HP, KO) — reproduit le moteur Excel. **Visibilité PV ennemis** :
  `enemyPublicView(enemy)` (pure, testée) = ce que voient les joueurs selon `enemy.reveal` ('hidden'=nom seul /
  'bar'=barre figée à `revealPct`, ne suit pas les vrais dégâts / 'exact'=barre live + PV chiffrés) ; KO toujours signalé.
  **Crit/surcrit (§6.3)** :
  `critInfo(critPct)` (paliers garantis + chance fractionnaire, affichage) + `rollCrit(critPct,dcrit,rng)`
  (≥100 % = crit garanti, +50 % Dég. Crit par palier ; `rng` injectable).

## `data-state.jsx` — tour partagé, plateau, file d'actions, orchestrateurs de coups, journal

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

## `pages-mj.jsx` — tableau de bord MJ

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

## `pages-competences.jsx` — onglet Combat

- `pages-competences.jsx` — onglet **Combat** (`CompetencesPage`, libellé de menu « Combat ») : cast au clic
  (mana − coût, pose le cooldown). Bandeau **`MyResources`** en tête (**collant au scroll**, `position:sticky`
  dans le conteneur de scroll de `CompetencesPage`) : jauges **PV / Mana / Bouclier** du lanceur + badge KO
  + `ConsumablesRow` (**potions buvables sans quitter l'onglet**). Maxima lus dans **`eff`**, la même chaîne
  que la fiche (items + runes + passif + `skillBuffs`) — jamais `base`, sinon un buff de PV afficherait une
  barre fausse. Carte **Attaque de base** (**profil d'arme** `basicAttackProfile` depuis le 2026-09-15 :
  ligne d'état `WeaponStatusLine`, sélecteur **Mode d'arme** pour une hybride ou l'arc hextech — PERSISTÉ en
  `state/weaponChoice.mode`, contrairement au geste —, boutons **Dégainer/Rengainer** d'une mini-arme entre
  accessoire et main libre, `WeaponPropsList` en attaque pleine seulement ; un mode sans dégâts (cellules de
  Jett) dépose une action NARRATIVE ; l'action porte `weaponCat`/`weaponName`/`mastered`, affichés sur la carte
  du MJ ; bouton « Attaquer » → attaque en attente MJ, **sans mana ni cooldown**) avec **rangée de modes**
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

## `pages-journal.jsx` — onglet Journal

- `pages-journal.jsx` — onglet **Journal** (`JournalPage`, staff) : **deux sections** basculées par un bouton
  (`JOURNAL_SECTIONS`, état local) — **⚔ Combat** (`combat/log` via `useCombatLog` ; filtres tous/actions/buffs/KO)
  et **💰 Monnaie** (`economyLog` via `useEconomyLog` ; filtres tous/transferts/gains/retraits). Chaque section a
  son propre « Vider » (celui de la monnaie **demande confirmation** : c'est la seule trace des transferts depuis
  le coffre commun). Horodatage, lecture seule, alimenté par `pushLog` / `pushEconomyLog`.
