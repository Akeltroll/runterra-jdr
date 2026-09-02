# Initiative, créneaux de tour et PNJ alliés

Design du chantier « gestion des tours ». Rédigé le 2026-09-02 d'après les règles
données par le MJ en session. **Les règles de jeu de la §2 ne sont écrites nulle part
ailleurs** — ni dans `info-mj/`, ni dans l'Excel. Ce document en est la source.

Statut : **les 6 lots sont livrés**, règles RTDB **publiées et vérifiées le 2026-09-02**.
Reste la recette en conditions réelles (§11) et les points ouverts de la §10.

---

## 1. D'où ça vient

Le site n'a jamais servi en campagne. Il possède aujourd'hui un **compteur de tour
partagé** (`combat/turn`, entier ≥ 1, écriture staff) qui pilote les cooldowns, la durée
des buffs de compétence et le passif de Rathäel — mais **aucune notion d'ordre de tour** :
rien ne dit qui joue, ni dans quel ordre. Le MJ arbitre de tête.

Demande du MJ :

1. un système d'initiative et un ordre de tour ;
2. dans la **colonne gauche de la vue MJ**, sous la table, la liste verticale des
   combattants dans l'ordre — déroulante, réordonnable, avec indication de qui joue ;
3. la même information côté **joueur**, en bas de l'onglet Combat, qui a de la place ;
4. les **PNJ alliés**, qui n'existent pas du tout aujourd'hui ;
5. la question ouverte des **stats des PNJ**, saisies à plat sans passer par les caracs.

Le point 4 est le pivot : (1)(2)(3) consomment tous « la liste des participants au
combat ». Il devait donc être tranché et livré en premier.

### Un luxe à ne pas gâcher

L'app n'a **jamais servi en campagne**. Aucune donnée de production à migrer, aucune
compat à tenir. Tous les chantiers précédents ont traîné un marqueur de migration
(`invInit`, `armureInit`, `coinsInit`) ; celui-ci n'en a besoin d'aucun. Le modèle peut
être propre du premier coup.

---

## 2. Les règles du MJ (source de vérité)

### 2.1 — Le score d'initiative

**1d6 + modificateurs.** Les modificateurs viennent :

- de la **préparation au combat** : de −2 à +2 selon que le personnage est surpris,
  ultra-vigilant, en escarmouche… ;
- de **bonus personnels non liés aux caractéristiques** : effet de potion, buff d'un
  clerc, etc.

Ils restent toujours faibles : **il est invraisemblable de dépasser +4 ou −4**. La plage
réelle est donc environ **−3 à +10**.

> Conséquence de conception : le score **ne se calcule pas** depuis Force / Habileté /
> Mental / Magie. Aucune formule à écrire dans `game-logic.js`. C'est un jet, plus un
> bonus saisi.

**Deux champs séparés, pas un total** (décision MJ) : `d6` (le jet) et `bonus`
(préparation + bonus personnels). Le total est dérivé. Ça permet d'afficher
« 5 = 4 +1 vigilant » et de justifier un ordre contesté en table.

### 2.1.bis — Le joueur lance, le MJ valide

> Le 1d6 d'un PJ doit être lancé activement par le joueur, qui renseigne le score au MJ,
> lequel le valide dans la vue MJ. Si le MJ refuse, le PJ pourra relancer son initiative.
> Cela donne au joueur un mini sentiment de contrôle : c'est lui qui lance.

⚠️ **La randomisation est faite par l'app, jamais saisie à la main.** Le joueur clique
« Lancer », il ne tape pas un chiffre. Cycle de vie d'un score :

```
idle ──(le joueur clique « Lancer »)──▶ pending ──(le MJ valide)──▶ ok  ─▶ entre en jeu
                    ▲                                  │
                    └────────(le MJ refuse)──────── reroll
```

Seul un score **`ok`** entre dans les créneaux. Un score `pending` n'existe pas encore
pour le calcul de l'ordre.

Répartition des écritures, et elle est fine :

| Champ | Écrit par | Pourquoi |
|---|---|---|
| `d6` | le **joueur** (son perso) / le MJ (les PNJ) | c'est son jet |
| `bonus` | le **MJ** seul | la préparation au combat et les buffs relèvent de sa connaissance |
| `ok` / `reroll` | le **MJ** seul | c'est la validation |

> Sur la triche : le tirage est côté client, donc un joueur déterminé pourrait écrire un
> `d6` arbitraire via la console. C'est la même posture que pour les bourses — un
> `.validate` bloque l'absurde (hors 1–6), et **le vrai garde-fou est la validation du
> MJ**, qui voit chaque score avant qu'il entre en jeu. Ne pas chercher plus loin.

### 2.2 — Les créneaux (le point structurant)

Sur un 1d6 avec une poignée de combattants, **les ex æquo sont la norme, pas
l'exception**. Le MJ en fait une mécanique :

> Beaucoup de personnages alliés et ennemis auront le même créneau de tour. Exemple :
> 2 PJ et un ennemi ont fait 5, ils joueront donc toujours au même moment. L'ordre du
> tour considère donc ces 3 personnages en jeu et ne passera aux suivants qu'une fois
> que tous indiquent leur fin de tour.

Donc :

- un **créneau** = tous les combattants partageant la même valeur d'initiative ;
- les créneaux se succèdent par score **décroissant** ;
- **à l'intérieur d'un créneau, il n'y a aucun ordre** : tout le monde y agit
  simultanément. Il n'y a donc **rien à départager**, et pas de champ de tiebreak ;
- on ne passe au créneau suivant que lorsque **tous** ses membres ont déclaré « j'ai
  fini » — **les ennemis compris** (le MJ clique pour eux).

```
Créneau 6 : Urskaar, Gobelin A          ← actif tant que les 2 n'ont pas fini
Créneau 5 : Rathäel, Jett, Gobelin B
Créneau 3 : Smith, Chef gobelin
                                         ← bouclage = round suivant (turn + 1)
```

**La position d'un combattant n'est pas un rang, c'est un score.** L'ordre se déduit,
il ne se stocke pas.

### 2.3 — Le KO est différé à la fin du créneau

Règle donnée par le MJ, et elle est contre-intuitive :

> Si un personnage en tour est censé tomber KO du fait des évènements du créneau, ses
> actions se jouent malgré tout (allié comme ennemi). Tuer un monstre dans son créneau
> lui laisse l'opportunité de faire encore quelque chose, dont des dégâts. Son état KO
> survient donc à la fin du tour de tous les personnages en cours. En revanche, un
> personnage tombé KO **avant** son créneau ne le jouera pas.

Deux cas à distinguer, donc :

| Situation | Effet |
|---|---|
| À 0 PV **quand son créneau s'ouvre** | sauté, ne participe pas, n'a pas à déclarer |
| Tombe à 0 PV **pendant son propre créneau** | agit quand même, **doit** déclarer sa fin |

C'est la règle qui met le plus de pression sur le modèle (voir §4).

### 2.4 — L'arrivée tardive : au round entier suivant

> Pour tout combattant intégrant le combat tardivement : il effectue son jet
> d'initiative avec ses bonus ou malus comme un autre l'aurait fait. Puis il rejoindra le
> **tour entier suivant**. Tout cela pour éviter le cas où un combattant arriverait à un
> créneau plus antérieur que des joueurs actifs pendant le tour.

Autrement dit : un renfort qui débarque au milieu du round 3 avec un 6 ne doit pas
surgir en amont de joueurs qui ont déjà agi ce round-là. Il lance quand même son dé
tout de suite (le MJ le valide), mais il n'entre dans les créneaux qu'**au round 4**.

Porté par un champ `joinRound` sur le combattant. **Absent ⇒ 1** (présent dès le début) :
encore une fois, aucune migration.

### 2.5 — Qui déclare la fin de tour

- Un **joueur** clique « j'ai fini » pour **son** personnage.
- Le **MJ** clique pour les ennemis et les PNJ alliés.
- L'état n'avance que quand **tous les participants du créneau actif** ont déclaré.


### 2.6 — Un PNJ peut viser n'importe qui (constaté au test du lot 4)

Trou fonctionnel révélé par les tests du MJ : `EnemyAttackModal` ne listait que les
5 PJ, **et son code écrivait les dégâts en supposant que la cible était une fiche de
personnage**. Un PNJ ne pouvait donc pas en toucher un autre, quel que soit le camp.

Règle retenue : **aucune restriction de cible**. Un ennemi peut frapper un autre
ennemi, un PNJ allié, un PJ, ou **lui-même** ; un allié de même. Dégâts de zone,
sacrifice, contrôle mental, tir fratricide — tout cela existe en jeu.

La résolution se dédouble selon la cible : PJ → sa fiche avec ses stats effectives ;
PNJ → `applyHitToEnemy`, qui applique l'armure et la résistance magique du PNJ. Le
journal, les toasts et l'horodatage du KO fonctionnent dans les deux branches. Un
combattant à terre reste ciblable (signalé « — à terre ») : on peut vouloir l'achever.

---

## 3. Ce qui existe déjà (et qu'il ne faut pas réécrire)

| Existant | Où | À retenir |
|---|---|---|
| `combat/turn` | `data-state.jsx:63` | compteur de **round**. Écriture staff. **Son sens ne doit pas changer** |
| `cooldownReady` / `nextReadyAt` | `game-logic.js:811` | cooldowns exprimés en n° de round |
| `sumSkillBuffs(buffs, turn)` | `game-logic.js:1102` | expiration des buffs, en rounds |
| `glaciationDecay(counters, endingTurn)` | `game-logic.js:947` | −3 charges en fin de **round** |
| `souverainUntil` | compteur Rathäel | fenêtre d'ultime, en rounds |
| `CD_LOCKED` = 999999 | `pages-competences.jsx:32` | sentinelle « 1×/combat » |
| `combat/enemies` | `data-state.jsx:118` | lecture tout inscrit, **écriture staff** |
| `enemyPublicView(enemy)` | `game-logic.js:779` | ce que voient les joueurs |
| `mitigateDamage` / `applyDamageToPools` | `game-logic.js` | moteur de dégâts, agnostique du camp |

### ⚠️ Ne PAS toucher au sens de `combat/turn`

**Cinq mécanismes** en dépendent (les 5 premières lignes du tableau). Si « Fin de tour »
se met à signifier « combattant suivant », tous les cooldowns et buffs en cours se
décalent — et **silencieusement**, aucun test ne le verrait.

Décision : **`combat/turn` reste le compteur de round.** L'initiative vit dans un nœud
séparé, et le round ne s'incrémente qu'au **bouclage** du dernier créneau. Bonus : ça
tombe juste sémantiquement pour Rathäel — « il n'a pas subi de dégâts ce tour » veut bien
dire « ce round ».

### ⚠️ `planReorder` ne s'applique PAS ici

Il a été envisagé (il fait le rangement manuel de l'inventaire, il est pur et testé),
puis **écarté** : il trie une liste plate par `order: 0,1,2,3…`. Or avec les créneaux la
position est un **score**, pas un rang. Réordonner, c'est réattribuer un `init` — pas
permuter des index. Ne pas le rebrancher ici par réflexe de réutilisation.

---

## 4. Le modèle : dérivé, pas stocké

### 4.1 — Le principe

**Ne stocke ni les créneaux, ni le créneau actif.** Les deux se déduisent :

- **créneaux** = valeurs distinctes d'`init`, triées décroissant ;
- **créneau actif** = le premier dont les participants ne sont pas tous `done`.

La seule chose persistée, c'est le drapeau `done` de chacun. Conséquences :

- quand le dernier membre d'un créneau déclare, le créneau suivant devient actif **pour
  tout le monde, sans une seule écriture supplémentaire** ;
- pas d'`activeId` à synchroniser, donc **pas de course** entre deux joueurs qui cliquent
  simultanément, et pas d'état désaligné si quelqu'un recharge sa page ;
- l'annulation est gratuite : le MJ décoche un `done`, le créneau redevient actif.

`done` s'accumule sur **tout le round** (chaque combattant n'appartient qu'à un seul
créneau, son drapeau n'est donc jamais ambigu) et n'est purgé qu'**une fois par round**,
par le MJ. Il n'y a **aucune écriture de transition de créneau**.

### 4.2 — Résoudre le KO différé (§2.3) sans casser la dérivation

Le problème : « qui participe au créneau » dépend des PV **au moment où le créneau s'est
ouvert**, pas des PV actuels. En dérivation naïve sur les PV courants, un ennemi tué
pendant son propre créneau en sortirait aussitôt — le créneau se clôturerait tout seul et
le mort n'aurait pas agi. Ça viole la règle du MJ.

**Solution retenue — horodater le KO.** Au moment où les PV d'un combattant tombent à 0,
on écrit le round et le créneau où ça s'est produit :

```
ko: { [combatantId]: { round: <n° de round>, init: <score du créneau en cours> } }
```

L'éligibilité devient alors purement calculable :

```
participe(c, round, initDuCréneau) =
      PV(c) > 0
   || (ko[c].round === round && ko[c].init === initDuCréneau)
```

Vérification sur les cas réels :

| Cas | `ko` | Créneau évalué | Participe ? | Conforme §2.3 |
|---|---|---|---|---|
| Gobelin (init 3) tué au créneau 6 | `{r:1, init:6}` | 3 | non | ✅ mort avant son tour |
| Gobelin (init 3) tué au créneau 3 | `{r:1, init:3}` | 3 | **oui** | ✅ agit quand même |
| Gobelin tué round 1, on est round 2 | `{r:1, init:6}` | n'importe | non | ✅ reste mort |
| Personne n'est mort | absent | — | oui si PV > 0 | ✅ |

**Qui écrit ce marqueur ?** Les PV ne tombent à 0 que par des écritures **staff** :
`applyHitToEnemy` (résolution d'une attaque joueur), `EnemyAttackModal` (ennemi → joueur)
et le bouton « Subir » de `EnemyCard`. Le marqueur se pose au même endroit, dans la même
transaction logique. **Aucune permission nouvelle.**

> Repli si l'implémentation se révèle pénible : figer la liste des participants à
> l'ouverture du créneau (`participants: {…}` écrit à la transition). C'est plus simple à
> raisonner mais ça réintroduit une écriture de transition — donc la question « qui a le
> droit de l'écrire », donc la course. À n'envisager qu'en dernier recours.

### 4.3 — Le filet de sécurité

Un joueur parti aux toilettes ne doit pas geler la table. Le MJ dispose d'un bouton
**« forcer la fin du créneau »** qui pose les `done` manquants. À noter que le risque de
blocage est structurellement faible : le MJ doit de toute façon déclarer pour chaque
ennemi et chaque allié du créneau, **c'est donc lui qui ferme en pratique**.

---

## 5. Modèle de données

```
/campaign/runeterra/combat/turn                    ← INCHANGÉ : compteur de ROUND
/campaign/runeterra/combat/initiative/
    scores: { [combatantId]: {
        d6:     1..6,        ← le jet ; JOUEUR (son perso) ou MJ (les PNJ). Tiré par l'app.
        bonus:  <entier>,    ← préparation + bonus personnels ; MJ seul. Peut être négatif.
        ok:     true,        ← validation du MJ ; sans elle le score n'entre pas en jeu
        reroll: true,        ← le MJ a refusé, le joueur doit relancer
    } }
    done:   { [combatantId]: true }                ← « j'ai fini » ; joueur = SON perso, staff = tous
    ko:     { [combatantId]: { round, init } }     ← horodatage du KO (§4.2) ; écriture STAFF
    joinRound: { [combatantId]: <n° de round> }    ← arrivée tardive (§2.4) ; MJ. Absent = 1.
```

Le **total** (`d6 + bonus`) n'est jamais stocké : il se dérive (`initiativeTotal`). Deux
sources de vérité pour un même nombre, c'est une divergence garantie à terme.

`combatantId` = soit un `charId` de PJ (`rathael`, `urskaar`, `smith`, `lunick`, `jett`),
soit un id d'ennemi/allié (`enemy_xxx`). Les deux espaces de noms ne se recoupent pas.

Sur les combattants non-joueurs (`combat/enemies/{id}`), **livré au lot 1** :

```
side: 'enemy' | 'ally'    ← absent = 'enemy' (aucune migration), cf. combatantSide()
```

**Purges :** `done` est vidé à chaque fin de round (MJ). `scores`, `done` et `ko` sont
tous vidés par **« ⟲ Combat »** (`resetCombat`).

---

## 6. Règles RTDB — le patch

**Deux** additions, et seulement là où un JOUEUR doit écrire. Tout le reste est
**hérité** : la lecture vient du `.read` du nœud `combat` (tout inscrit), l'écriture
staff vient du `.write` mj+admin de `campaign/runeterra`.

Soit `MJ` la condition staff usuelle :
`root.child('users').child(auth.uid).child('role').val() === 'mj' || … === 'admin'`
et `SIEN` : `root.child('users').child(auth.uid).child('charId').val() === $combatantId`.

```json
"initiative": {
  "done": {
    "$combatantId": {
      ".write": "auth != null && (MJ || SIEN)",
      ".validate": "!newData.exists() || newData.isBoolean()"
    }
  },
  "scores": {
    "$combatantId": {
      "d6": {
        ".write": "auth != null && (MJ || SIEN)",
        ".validate": "newData.isNumber() && newData.val() >= 1 && newData.val() <= 6 && newData.val() % 1 === 0"
      }
    }
  }
}
```

⚠️ **La permission joueur est posée sur la FEUILLE `d6`, pas sur `scores/$combatantId`.**
C'est le point délicat de ce patch. Si on ouvrait le nœud du score entier, un joueur
pourrait écrire son propre `bonus: 99` et son propre `ok: true` — il s'auto-validerait et
contournerait le MJ, ce qui vide la §2.1.bis de son sens. En descendant d'un cran,
`bonus`, `ok` et `reroll` n'ont **aucune** règle propre : ils retombent sur l'ancêtre
`campaign/runeterra`, donc staff seul. Le cycle de validation est ainsi garanti par le
**serveur**, pas par le masquage d'UI.

Le `.validate` sur `d6` borne le jet à un entier 1–6 : un `9` tapé en console est rejeté.
Il ne prétend pas empêcher un joueur de « choisir » son 6 — c'est la validation du MJ qui
joue ce rôle (§2.1.bis).

Un joueur ne peut cocher que **son** personnage. Ennemis et PNJ alliés n'ont de `charId`
chez personne : seul le MJ les valide, ce qui correspond exactement au « ennemi compris »
de la §2.5.

### 6.1 — Troisième addition : la lecture des PV (décision MJ, 2026-09-02)

```json
"hpCur": { ".read": "auth != null && root.child('users').child(auth.uid).child('role').exists()" }
```

Posée sous `characters/$charId/state`, à côté d'`attrs` et `level` qui suivaient déjà ce
motif depuis la capacité du coffre commun.

**Pourquoi elle est nécessaire** — et ce n'est pas du confort. Déterminer les
participants d'un créneau demande les PV de **tous** ses membres (§4.2). Sans cette
lecture, l'écran d'un joueur reçoit des PV vides pour les autres PJ, les lit comme 0,
et les exclut du créneau : **il croirait le créneau terminé alors que ses camarades
n'ont pas joué**, pendant que l'écran du MJ afficherait le bon. Deux vérités
contradictoires à la même table — le défaut le plus pénible qui soit à déboguer.

Ce qui reste cloisonné : bourse, inventaire, runes, modificateurs, XP, équipement.
Seuls les PV courants s'ouvrent, et **aucune écriture n'est élargie**.

> Effet de bord souhaitable : le Hub peut enfin afficher de vraies barres de PV sur les
> cartes des autres PJ, aujourd'hui grisées faute de droit de lecture. À noter que le
> **maximum** exact dépend encore des modificateurs et de l'équipement, non lisibles :
> une barre calculée sur `charBaseStats` seul serait légèrement optimiste. À traiter le
> jour où on branchera le Hub, pas ici.

### ⚠️ Le piège du nœud vs ses enfants — ici, il ne mord PAS

Purger `done` d'un coup, c'est écrire `null` **sur le nœud** `done`. C'est le motif exact
qui a produit **trois bugs silencieux** dans ce projet (journaux `combat/log` et
`economyLog`, cf. CLAUDE.md « État actuel 2026-08-21 »). Ici c'est bon, parce que
`campaign/runeterra` accorde déjà l'écriture au staff sur tout le sous-arbre — et la
purge est une action **staff**. Un joueur, lui, ne peut écrire que sa propre feuille.

**À vérifier en ligne après publication** (`firebase database:get "/.settings/rules"
--instance runeterra-jdr-default-rtdb`), pas à supposer.

### ⚠️ Publier AVANT de déployer le code

Le lot 3 est le premier à dépendre de cette règle. Si le code part sur `main` avant, les
joueurs prennent un `PERMISSION_DENIED` — et l'historique du projet montre que ça échoue
**en silence** quand personne n'a mis de `catch`. Prévoir un `catch` + toast sur le
bouton « j'ai fini » dès sa première version.

---

## 7. Découpage en lots

| Lot | Contenu | Règles RTDB | Statut |
|---|---|---|---|
| **1** | Drapeau `side` — les PNJ alliés existent | aucune | ✅ **livré** |
| **2** | Moteur pur : créneaux, participation, complétude + tests | aucune | ✅ **livré** |
| **3** | Nœud `combat/initiative`, hook, bouclage → `turn + 1` | **§6** (non publiées) | ✅ **livré** |
| **4** | UI MJ — liste des créneaux sous la table, drag, créneau actif | aucune | ✅ **livré** |
| **5** | UI joueur — bas de l'onglet Combat + bouton « J'ai fini » | aucune | ✅ **livré** |
| **6** | Assistant caracs → stats PNJ (indépendant) | aucune | ✅ **livré** |

Le lot 2 est **entièrement testable en `node --test`**, sans Firebase ni UI. C'est là que
se joue la justesse du système de créneaux : y être méticuleux évite de déboguer une
règle de jeu à travers trois couches d'interface.

### Lot 1 — ce qui a été livré (2026-09-02)

- `game-logic.js` : `combatantSide(c)`, `isAlly(c)`, `splitCombatants(list)` (purs, testés).
  `side` absent, inconnu ou entrée nulle ⇒ `'enemy'` — jamais d'allié par accident.
- `data-state.jsx` : `makeEnemy(name, side)`, `addEnemy(name, side)`. Un allié naît en
  `reveal: 'exact'` (masquer les PV d'un allié à ses compagnons n'a pas de sens). Le défaut
  est posé **à la création** : `enemyPublicView` n'est pas touchée, zéro test réécrit.
- `pages-mj.jsx` : section « Combattants · N ennemis · N alliés », boutons `+ Ennemi` /
  `+ PNJ allié`, liseré de camp par carte, badge « Allié », bascule **Camp** à l'édition.
- `pages-competences.jsx` : bandeau séparé Ennemis / Alliés, `CombatantChip` partagé,
  alliés dans un `<optgroup>` distinct du sélecteur de cible (ciblables — soin, tir
  fratricide — mais pas par glissement de souris).

Tout le moteur de combat s'applique aux alliés **sans une ligne de changement**.

---

## 8. Le moteur pur (lot 2) — ✅ livré le 2026-09-02

Tout est dans `game-logic.js`, sans dépendance React / DOM / Firebase.

```
INIT_DIE = 6
rollInitiative(rng)              → 1..6 ; `rng` injectable (idiome de rollCrit)
initiativeTotal(entry)           → d6 + bonus, ou null si pas encore lancé
initiativeStatus(entry)          → 'idle' | 'pending' | 'reroll' | 'ok'
initiativeReady(entry)           → raccourci : statut 'ok'
combatantJoinRound(c)            → joinRound, absent = 1 (§2.4)
initiativeSlots(combatants, scores, round)
                                 → [{ init, members }] trié décroissant ; n'inclut que
                                   les scores validés ET les combattants déjà entrés
slotParticipants(members, byId, ko, round, init)
                                 → [id] devant agir ; applique le KO différé (§4.2)
initiativeState(combatants, scores, done, ko, round)
                                 → { slots, active, activeInit, complete }
                                   c'est l'appel unique que consomme l'UI
```

`combatants` est une liste **normalisée** `[{ id, hp, joinRound }]` : c'est l'appelant qui
uniformise les PJ (venus de `characters`) et les PNJ (venus de `combat/enemies`). Le
moteur ignore tout du camp et de Firebase.

Chaque créneau rendu par `initiativeState` porte `{ init, members, participants, pending,
complete }` — `members` = tout le monde, `participants` = ceux qui doivent agir après
application de la règle du KO, `pending` = ceux qui n'ont pas encore déclaré.

### Tests écrits (15, tous verts)

1. `rollInitiative` borné 1–6, `rng` injectable, **`rng() === 1` ne donne jamais 7**,
   `NaN` retombe sur la borne basse, et 200 tirages réels restent dans la plage ;
2. `initiativeTotal` : bonus négatif, total négatif possible, bonus absent = 0, `d6`
   hors plage borné (un `9` écrit en console ne devient pas un score de 9) ;
3. `initiativeStatus` : les 4 états du cycle de la §2.1.bis ;
4. créneaux triés décroissant, ex æquo regroupés, ordre d'origine préservé dans un
   créneau, créneau à un seul membre ;
5. **un score non validé par le MJ n'entre pas en jeu** (`pending` et `reroll` exclus) ;
6. **le retardataire ne rejoint qu'au round suivant** (§2.4), même avec un meilleur score ;
7. KO **avant** son créneau → sauté ;
8. KO **pendant son propre créneau** (§2.3) → participe quand même ;
9. KO d'un round antérieur → reste hors jeu ;
10. créneau partiellement déclaré → toujours actif ;
11. créneau entièrement déclaré → le suivant s'active, **sans aucune écriture** ;
12. tous les créneaux déclarés → `complete` vrai, `active` null ;
13. **créneau entièrement KO avant ouverture** → sauté d'office, pas de blocage de table ;
14. `done` parasite (combattant absent de la liste) → ignoré ;
15. plateau vide / scores absents / arguments nuls → pas de plantage, et
    `complete: false` (rien à jouer ≠ round terminé : le bouton « Fin de round » reste
    éteint sur un plateau qui n'a pas commencé).

## 9. Surfaces d'affichage visées

**Vue MJ — colonne gauche** (`pages-mj.jsx`, `MJSidebarRow` / aside 264px). Sous la liste
de la table : les créneaux en vertical, déroulants si longs, créneau actif surligné.
Chaque ligne = nom + camp + état déclaré/en attente. Drag pour réattribuer un `init`.

**Vue joueur — onglet Combat** (`pages-competences.jsx`). En bas, sous les cartes de
compétences, au-dessus de `CombatLog` : l'ordre des créneaux, qui joue, qui a fini, et le
bouton **« J'ai fini »** actif seulement quand c'est le créneau du joueur.

**Le geste de drag :** sous ce modèle, déplacer un combattant = lui **réattribuer un
score**. Le geste naturel est de le déposer sur un autre créneau, dont il prend l'`init`.
Déposer *entre* deux créneaux pour en créer un nouveau est possible mais nettement plus
tordu au doigt — à ne faire que si le MJ le réclame.

---

## 10. Questions tranchées par le MJ (2026-09-02)

Les quatre questions ouvertes de la première rédaction ont été tranchées le jour même.
Elles sont reportées dans les sections concernées ; résumé et conséquences :

1. **Combattant sans score / arrivée tardive** → §2.4. Il lance son dé normalement, mais
   n'entre qu'au **round entier suivant**, pour ne jamais surgir en amont de joueurs ayant
   déjà agi. Porté par `joinRound` (absent = 1).
2. *(fusionnée avec la 1)*
3. **Qui lance le 1d6 d'un PJ** → §2.1.bis. **Le joueur**, avec randomisation par l'app,
   puis **validation du MJ** (qui peut refuser et demander une relance).
   ⚠️ Conséquence directe sur la §6 : la règle RTDB s'ouvre à `scores/$combatantId/**d6**`
   — sur la feuille, surtout pas sur le nœud du score, sinon le joueur s'auto-validerait.
4. **Un champ ou deux** → **deux** : `d6` et `bonus`. Le total est dérivé, jamais stocké.

### Ce qui reste réellement ouvert

- **Le geste de drag dans la liste MJ** (§9) : déposer un combattant sur un autre créneau
  pour lui en prendre le score est le geste naturel ; créer un créneau *entre* deux
  existants est possible mais tordu au doigt. À décider au lot 4, en voyant l'écran.
- **Le `bonus` est-il persistant d'un combat à l'autre ?** Un malus de surprise vaut pour
  ce combat-là ; « ⟲ Combat » doit vraisemblablement le remettre à 0 en même temps que
  les scores. À confirmer à l'usage.
- **Lot 6** — l'assistant caracs → stats PNJ, indépendant du reste.

---
## 11. Recette

- [ ] `node --test test/game-logic.test.js` et `test/auth.test.js` verts
- [ ] les `.jsx` modifiés compilent (`npx esbuild fichier.jsx >/dev/null`)
- [ ] jeton de cache bumpé dans `index.html`
- [ ] **règles publiées AVANT le déploiement du lot 3**, et relues en ligne
- [ ] un joueur peut cocher son perso, **pas** celui d'un autre (`PERMISSION_DENIED` attendu)
- [ ] un joueur ne peut pas purger `done` ; le MJ le peut
- [ ] un ennemi tué pendant son créneau agit quand même (§2.3)
- [ ] un ennemi tué avant son créneau est sauté et ne bloque pas
- [ ] « ⟲ Combat » vide `scores`, `done` et `ko`
- [ ] les cooldowns et durées de buffs **n'ont pas bougé d'un round** (non-régression)

---

## 12. Reprise de session (état au 2026-09-02, fin de journée)

**Les 6 lots sont écrits, testés et commités sur `Woolost`. Les règles RTDB sont
publiées et vérifiées en ligne.** Ce qui manque n'est pas du code : c'est de l'usage.

### Ce qui a été validé, et comment

Les lots 1, 4 et 5 ont été testés **par le MJ dans le navigateur**, sur une seule
session à la fois. Les lots 2 et 3 sont couverts par 19 tests unitaires. Aucun test
n'a encore été fait **à deux sessions simultanées**, ni à une vraie table.

### La toute première chose à faire à la reprise

**La recette à deux fenêtres** (§11) : compte MJ d'un côté, compte joueur en fenêtre
privée de l'autre. C'est le seul moyen de valider les deux propriétés qui portent
tout le système et qu'aucun test unitaire ne peut atteindre :

1. **La dérivation.** Quand le dernier membre d'un créneau clique « J'ai fini », le
   créneau suivant doit s'activer **simultanément sur les deux écrans**, sans que
   personne ne touche à rien. S'il y a un décalage, le modèle dérivé de la §4 est en
   cause et il faut le regarder avant toute autre chose.
2. **L'ouverture de `hpCur`.** Les deux écrans doivent afficher **le même créneau
   actif**. S'ils divergent, c'est que la lecture des PV ne remonte pas côté joueur
   (regarder la console pour un `permission_denied`) — cf. §6.1.

Ensuite seulement : le cycle de validation (le joueur lance → le MJ refuse → le
joueur relance → le MJ valide), et un créneau à deux PJ qui ne doit avancer que
lorsque **les deux** ont déclaré.

### Points ouverts, par ordre de gêne probable

1. **Le `bonus` survit-il à « ⟲ Combat » ?** Aujourd'hui **oui** (le nœud entier est
   purgé, donc non — à vérifier : `resetCombat` efface `INITIATIVE` en entier, donc
   les bonus partent avec). Un malus de surprise ne vaut que pour un combat, donc
   c'est probablement le bon comportement — mais un bonus durable (potion longue) le
   subit aussi. À trancher après une séance réelle.
2. **Le geste de drag entre créneaux** (§9) : déposer sur un créneau existant marche ;
   créer un créneau *entre* deux existants n'est pas possible au doigt. Le champ
   « Créneau » de `IniScoreEditor` couvre le cas, mais moins vite.
3. **La place dans la colonne MJ** : avec 5 PJ + beaucoup de PNJ, les 264 px peuvent
   être serrés sur un écran peu haut. La liste de la table est en `flexShrink:0` ; si
   ça coince, la replier pendant un combat.
4. **L'arrivée tardive (`joinRound`) n'a aucune UI.** Le hook expose `setJoinRound`,
   mais rien ne l'appelle : un renfort entre donc au round courant, pas au suivant.
   La règle §2.4 est implémentée et testée dans le moteur, **elle n'est simplement pas
   pilotable depuis l'écran**. C'est le seul écart connu entre la spec et l'app.

### Ce qu'il ne faut surtout pas « améliorer » sans relire la spec

- Le sens de `combat/turn` (§3) — cinq mécanismes en dépendent, la casse serait muette.
- Le créneau actif dérivé et non stocké (§4.1) — persister un `activeId` réintroduirait
  la course entre deux clics simultanés que ce design élimine.
- L'ouverture de la **feuille** `scores/$id/d6` et non du nœud (§6) — sur le nœud, un
  joueur s'auto-validerait.
- `npcStatsFromAttrs` comme assistant et non comme calcul live (§7, lot 6).
