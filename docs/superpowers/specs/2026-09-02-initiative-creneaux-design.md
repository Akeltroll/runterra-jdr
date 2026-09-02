# Initiative, créneaux de tour et PNJ alliés

Design du chantier « gestion des tours ». Rédigé le 2026-09-02 d'après les règles
données par le MJ en session. **Les règles de jeu de la §2 ne sont écrites nulle part
ailleurs** — ni dans `info-mj/`, ni dans l'Excel. Ce document en est la source.

Statut : **lot 1 livré**, lots 2 à 6 à faire.

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
> Mental / Magie. Aucune formule à écrire dans `game-logic.js`. C'est une valeur saisie.

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

### 2.4 — Qui déclare la fin de tour

- Un **joueur** clique « j'ai fini » pour **son** personnage.
- Le **MJ** clique pour les ennemis et les PNJ alliés.
- L'état n'avance que quand **tous les participants du créneau actif** ont déclaré.

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
    scores: { [combatantId]: <nombre> }            ← 1d6 + mods ; écriture STAFF
    done:   { [combatantId]: true }                ← « j'ai fini » ; joueur = SON perso, staff = tous
    ko:     { [combatantId]: { round, init } }     ← horodatage du KO (§4.2) ; écriture STAFF
```

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

Une seule addition. Tout le reste est **hérité** : la lecture vient du `.read` du nœud
`combat` (tout inscrit), l'écriture staff vient du `.write` mj+admin de
`campaign/runeterra`.

```json
"initiative": {
  "done": {
    "$combatantId": {
      ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'mj' || root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('charId').val() === $combatantId)",
      ".validate": "!newData.exists() || newData.isBoolean()"
    }
  }
}
```

Un joueur ne peut cocher que **son** personnage. Ennemis et PNJ alliés n'ont de `charId`
chez personne : seul le MJ les valide, ce qui correspond exactement au « ennemi compris »
de la §2.4.

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
| **2** | Moteur pur : créneaux, participation, complétude + tests | aucune | à faire |
| **3** | Nœud `combat/initiative`, hook, bouclage → `turn + 1` | **§6** | à faire |
| **4** | UI MJ — liste des créneaux sous la table, drag, créneau actif | aucune | à faire |
| **5** | UI joueur — bas de l'onglet Combat + bouton « J'ai fini » | aucune | à faire |
| **6** | Assistant caracs → stats PNJ (indépendant) | aucune | à faire |

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

## 8. Fonctions pures à écrire (lot 2)

```
initiativeSlots(combatants, scores)
    → [{ init, members: [id] }] trié par init décroissant
      (combattant sans score : voir §10 — question ouverte)

slotParticipants(slot, combatants, ko, round)
    → [id] des membres qui doivent agir (applique §4.2)

activeSlot(slots, done, combatants, ko, round)
    → le créneau actif, ou null si le round est terminé

roundComplete(slots, done, combatants, ko, round)
    → bool ; pilote l'allumage du bouton « Fin de round »
```

### Tests à écrire

1. créneaux triés décroissant, ex æquo regroupés ;
2. un créneau à un seul membre se comporte comme les autres ;
3. **KO avant son créneau** → non-participant, ne bloque pas ;
4. **KO pendant son propre créneau** (§2.3) → participant, doit déclarer ;
5. KO d'un round antérieur → non-participant ;
6. créneau partiellement déclaré → toujours actif ;
7. créneau entièrement déclaré → le suivant devient actif, **sans écriture** ;
8. tous les créneaux déclarés → `roundComplete` vrai, `activeSlot` null ;
9. `done` d'un combattant absent de la liste → ignoré, ne casse rien ;
10. liste vide / scores absents → pas de plantage ;
11. **tous les participants d'un créneau KO avant ouverture** → créneau entièrement sauté,
    on passe au suivant sans blocage (le cas de deadlock à ne pas rater).

---

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

## 10. Questions ouvertes

1. **Un combattant sans score d'initiative** — arrive-t-il en fin de liste, dans un
   créneau « non initié », ou est-il exclu du combat tant que le MJ n'a pas saisi son
   1d6 ? (Cas réel : un renfort qui débarque au round 3.)
2. **Un combattant qui rejoint en cours de round** — joue-t-il dès ce round si son créneau
   n'est pas encore passé, ou seulement au suivant ?
3. **Qui saisit le 1d6 d'un PJ ?** La §2.1 suppose que le MJ collecte les jets. Si les
   joueurs doivent saisir le leur, il faut **élargir la règle RTDB** de la §6 à
   `scores/$combatantId` selon le même motif que `done`.
4. **Les modificateurs de préparation (−2…+2)** — sont-ils saisis comme un champ séparé
   (`d6` + `mod`, avec l'app qui somme) ou le MJ saisit-il directement le total ? Le champ
   séparé permettrait d'afficher « 5 = 4 +1 vigilant » en infobulle.

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
