# Bestiaire — atelier de création d'ennemis et de PNJ (design)

Date : 2026-10-11. Statut : **design validé ; lots 1 à 3 codés le 2026-10-11** (journal du jour),
lots 4 et 5 à faire.
Décisions prises en discussion avec le MJ les 2026-10-10 et 2026-10-11.

Cet onglet est aussi la réponse au point resté ouvert du plan des compétences :
« dimensionner les monstres pour les durées visées » (`2026-10-10-competences-patchs-a-appliquer.md` §6).

## 1. Ce que c'est

Un onglet **« Bestiaire »**, réservé au rôle `mj`, qui sert à :

1. **créer et conserver** des modèles d'ennemis et de PNJ (aujourd'hui un monstre n'existe que posé
   en combat et disparaît à la suppression) ;
2. **calculer les stats attendues** d'un monstre depuis son niveau, son rang et son archétype, puis
   les laisser ajuster à la main ;
3. **donner des plages de dégâts** pour son attaque de base et ses compétences (monocible ou zone),
   à titre indicatif ;
4. **composer des rencontres**, en estimer la difficulté et l'XP ;
5. **poser** un monstre ou une rencontre dans la vue MJ.

Hors périmètre de la v1 : compétences de monstre jouables depuis la vue MJ, mana des monstres,
effets hors dégâts (étourdissement, saignement, soin, bouclier) — un champ « Notes » par attaque les
accueille en texte libre.

## 2. Accès : MJ seul, admin exclu

Décision MJ : même l'`admin` n'a pas l'onglet.

- **Page** : `id:'bestiaire'` ajouté à `PAGE_ACCESS.mj` **uniquement** (`auth.js`). C'est la première
  page que `mj` a et qu'`admin` n'a pas : le test « admin ⊇ mj », s'il existe, est à adapter.
- **Données** : ⚠️ **le nœud ne peut PAS vivre sous `campaign/runeterra`.** Ce nœud porte un
  `.read`/`.write` « mj ou admin » à sa racine, et dans la RTDB un droit accordé par un parent ne se
  retire pas chez un enfant. Le bestiaire vit donc à la racine : **`/bestiary`**, règle
  `role === 'mj'` en lecture et en écriture.
- **Limites assumées** :
  - l'admin attribue les rôles : il peut se donner le rôle `mj`. Barrière de courtoisie, pas de
    sécurité ;
  - un monstre **posé en combat** est visible de l'admin (la vue MJ lui est ouverte) ;
  - `/bestiary` est **hors de la sauvegarde** exportée par la page Admin (elle exporte
    `campaign/runeterra`). Prévoir un export/import JSON propre à l'onglet (lot 2).

## 3. Le référentiel joueur

Tout se mesure par rapport à un **PJ de référence** au niveau du monstre.

- **Définition** : moyenne des 5 profils de PJ de la campagne (leurs proportions Force / Habileté /
  Mental / Magie, étirées au budget de points du niveau, plafond respecté), passée dans le moteur
  réel `computeStats`. **Nu** : ni équipement, ni runes, ni buffs (décision MJ).
- Les 5 profils sont recopiés comme constantes dans `game-logic.js` (logique pure, testée) ; ils ne
  lisent pas `data.jsx`.
- **Au-delà du niveau 18** (« endgame ») : le budget de points est prolongé à la pente moyenne de
  `LEVELS` ; `escalationFactor` gère déjà la zone PNJ au-delà de 20 points.
- **Option « ma table actuelle »** : remplace le référentiel théorique par la moyenne des stats
  effectives réelles des PJ présents (`useAllCharStates`, hook de staff — sans risque ici, la page
  est réservée au MJ). Le théorique reste le défaut.

Valeurs calculées avec le moteur du 2026-10-10 :

| Niveau | PV | AD ou AP | Armure | Rés. mag. | Crit | Dég. crit | Attaque de base moyenne (60 %, crit inclus) |
|---|---|---|---|---|---|---|---|
| 2  | 400  | 113 | 10 | 8  | 14 % | 164 % | 74  |
| 6  | 647  | 187 | 16 | 13 | 18 % | 171 % | 127 |
| 10 | 951  | 266 | 23 | 18 | 23 % | 178 % | 188 |
| 14 | 1276 | 390 | 30 | 23 | 28 % | 187 % | 292 |
| 18 | 1601 | 474 | 37 | 28 | 34 % | 196 % | 377 |

**Dégâts par round de référence** : un PJ joue chaque tour attaque de base + C1 + C2 ou C3 + C4.
Le référentiel de dégâts est donc `atk × REF_ROUND_RATIO`, où `REF_ROUND_RATIO` est la somme
moyenne d'un tour de PJ en multiples de sa stat d'attaque (attaque de base 0,6 + compétences au
rang 1 pondérées par leurs délais). ⚠️ **Constante à calibrer au lot 1** sur les kits réels ;
ordre de grandeur attendu : 1,5 à 2.

## 4. Rangs

La **puissance** d'un monstre = ses **PV effectifs** × ses **dégâts par round**, rapportés au
référentiel. Les PV effectifs comptent l'armure et la RM (moyenne des PV effectifs physiques et
magiques) : un monstre plus armuré « paie » ses résistances en PV bruts.

Doubler PV **et** dégâts ferait bien plus que doubler la puissance. La conversion retenue fait
qu'un monstre de puissance *n* vaut *n* standards tués l'un après l'autre : il a leurs PV cumulés
et leurs dégâts moyens pendant qu'ils tombent.

- *n* ≥ 1 : PV × *n*, dégâts × (*n* + 1) / 2
- *n* < 1 : PV × *n*, dégâts × 2*n* / (1 + *n*)

| Rang | Puissance | PV | Dégâts par round |
|---|---|---|---|
| Microbe  | 10 %  | ×0,1 | ×0,18 |
| Sbire    | 50 %  | ×0,5 | ×0,67 |
| Standard | 100 % | ×1   | ×1    |
| Élite    | 200 % | ×2   | ×1,5  |
| Boss     | 500 % | ×5   | ×3    |

Les dégâts par round sont un **total**, réparti entre l'attaque de base et les compétences (§7) :
un boss ne frappe pas trois fois plus fort à chaque coup.

**Curseur « endurance ↔ violence »** (par monstre, de −200 à +300, défaut neutre) : à puissance
constante, échange des dégâts contre des PV (+100 = PV ×2 et dégâts ÷2). C'est le levier de durée
des combats, mesuré au §10.

⚠️ Correction d'une affirmation faite en discussion : avec la même économie d'actions qu'un PJ, un
boss au curseur neutre frappe bien **trois fois plus fort par coup** en monocible (183 par attaque
de base au niveau 2, pour un PJ de référence à 400 PV). Ce sont les zones et le curseur qui
l'adoucissent.

## 5. Archétypes

Un archétype **déplace** le budget ; il fixe aussi le type de dégâts par défaut, le crit et la
répartition des résistances. Les multiplicateurs de PV s'entendent en PV **effectifs**.

| Archétype | PV eff. | Dégâts | Résistances | Particularité |
|---|---|---|---|---|
| Bruiser           | ×1    | ×1    | référence | profil neutre, physique |
| Tank physique     | ×1,4  | ×0,7  | armure forte, RM de référence | |
| Tank magique      | ×1,4  | ×0,7  | RM forte, armure de référence | |
| Colosse           | ×1,4  | ×0,7  | référence, tout en PV bruts | sensible aux dégâts en % des PV |
| Assassin          | ×0,7  | ×1,4  | faibles | crit haut ; dégâts concentrés sur un gros coup à délai |
| Tireur (carry AD) | ×0,8  | ×1,25 | faibles | dégâts réguliers, crit |
| Mage (burst)      | ×0,8  | ×1,25 | RM > armure | AP, monocible |
| Mage de zone      | ×0,8  | ×1,25 | RM > armure | AP, budget placé surtout en zones |
| Soutien fragile   | ×0,7  | ×0,6  | faibles | le reste du budget est en effets (Notes) |
| Soutien résistant | ×1,2  | ×0,5  | référence | idem |

Les soutiens sont volontairement sous le produit 1 : leur valeur est dans des effets que la v1 ne
chiffre pas. Les valeurs exactes de résistance et de crit par archétype sont fixées au lot 1.

## 6. Fiche d'un monstre

Les valeurs générées sont des **suggestions** ; les champs de la fiche restent la **source de
vérité**, comme pour le générateur actuel (`npcStatsFromAttrs`). Le MJ corrige ce qu'il veut.

- Identité : nom, image (facultative, pour le MJ), camp (ennemi / allié — même outil pour les PNJ),
  notes.
- Paramètres : niveau, rang, archétype, curseur endurance ↔ violence.
- Stats : PV, **AD et AP séparés**, armure, RM, crit, dég. crit, rés. crit, léthalités.
  Chaque champ montre l'écart à la suggestion et un bouton pour y revenir.
- **Puissance réelle** affichée en continu : après ajustements manuels, « ce monstre vaut 240 %,
  soit un élite fort ».
- XP donnée (suggérée, modifiable — §9).
- **Variantes** : « Dupliquer » repart d'une fiche pour en faire une autre version.

**Poser en combat** (× N) : écrit N copies dans `combat/enemies` à la forme existante. Le champ
`atk` unique de la vue MJ reçoit le plus élevé de AD / AP (comportement actuel du générateur) : la
vue MJ n'est pas modifiée. Les copies sont indépendantes du modèle.

## 7. Attaques et compétences : plages de dégâts

Indicatif, pour le MJ seul, **sans lien avec la vue MJ**.

Le monstre suit l'économie d'actions des PJ (décision MJ) : attaque de base + C1 + C2 ou C3 + C4
par tour. Une fiche neuve reçoit un gabarit selon l'archétype, entièrement modifiable.

Par attaque : nom, type (physique / magique / brut), nombre de cibles (1 à 5), **délai (1 à 10,
informatif, 2 ou 3 par défaut pour une compétence)**, dégâts, **notes** libres.

Pour chaque attaque l'onglet affiche :
- les dégâts moyens, une fourchette basse-haute, et la valeur en critique ;
- pour une zone, les dégâts **par cible** et le total ;
- **deux lectures** : le chiffre à annoncer (avant mitigation) et ce qu'encaisse réellement le PJ
  de référence. Une bascule **physique / magique / brut** change la mitigation appliquée ; en brut
  les deux chiffres sont égaux, au MJ de baisser.

**Jauge de budget** : somme des dégâts moyens par round de toutes les attaques (chacune divisée par
son délai), comparée au budget du rang. Le MJ fait varier une attaque et voit en direct « 87 % du
budget utilisé » ; un bouton répartit le reste.

**Règle de zone** (proposition, réglable) — des dégâts étalés valent moins que des dégâts
concentrés, le total d'une zone dépasse donc celui d'une monocible :

| Cibles | Dégâts par cible | Total |
|---|---|---|
| 1 | 100 % | 100 % |
| 2 | 65 %  | 130 % |
| 3 | 50 %  | 150 % |
| 4 | 40 %  | 160 % |
| 5 | 35 %  | 175 % |

Une zone « coûte » au budget ce que coûterait sa monocible équivalente.

## 8. Rencontres

Une rencontre = une liste de monstres du bestiaire avec leurs effectifs, un niveau de groupe et un
nombre de PJ (défaut 5).

- **Budget** = somme des puissances. Un monstre d'un autre niveau que le groupe compte pour sa
  puissance **rapportée au référentiel du niveau du groupe**.
- **Difficulté** = budget par PJ :

| Difficulté | Budget pour 5 PJ | Par PJ |
|---|---|---|
| Faible  | 100 %    | 20 %  |
| Moyenne | 250 %    | 50 %  |
| Dure (miroir) | 500 % | 100 % |
| Extrême | 1000 % et plus | 200 % et plus |

- ⚠️ L'addition des budgets est une approximation : elle est exacte tant que le groupe tue les
  monstres un par un, optimiste dès que les zones entrent en jeu, et une rencontre à 1000 % est
  **plus** de deux fois plus dure qu'une à 500 %.
- **Poser la rencontre** : pose tous ses monstres en combat d'un clic.

## 9. XP

Règle MJ : pour gagner un niveau, il faut 1 rencontre extrême, ou 2 dures, ou 4 moyennes, ou 8
faibles. `xpToNext(niveau) = 180 + 100 × niveau`.

- **XP d'un monstre** (cagnotte totale, à partager entre les PJ) :
  `xpToNext(niveau du monstre) × puissance × 0,5`. Un standard niveau 2 vaut 190 XP ; à 5 PJ, 38
  chacun ; cinq standards donnent 190 à chacun, soit un demi-niveau.
- **XP d'une rencontre**, par PJ : fraction de niveau lue sur la courbe du MJ selon le budget par
  PJ — 20 % → 1/8, 50 % → 1/4, 100 % → 1/2, 200 % → 1, interpolée entre les points et prolongée
  au-delà.
- Les deux coïncident à partir de « moyenne ». En dessous, la courbe du MJ donne un peu plus que la
  somme des monstres (une rencontre faible vaut 1/8 de niveau et non 1/10) : l'écart est affiché
  comme bonus de rencontre.
- Le nombre de PJ est pris en compte : à 4 joueurs, une rencontre extrême pèse 800 %.

## 10. Calibrage et durées visées ⚠️

Durées visées par le MJ : standard 6-7 rounds, élite 9-10, boss 13-15.

**Mesuré le 2026-10-11** avec `2026-10-11-sim-bestiaire.js` (les 5 PJ nus contre des bruisers,
moteur réel). ⚠️ Modèle grossier : ni soins, ni boucliers, ni contrôles, ni potions, ni C4 — les
vrais combats sont plus longs et plus favorables aux PJ. Résultats identiques aux niveaux 2, 10, 18.

| Rencontre (curseur neutre) | Durée | État du groupe à la fin |
|---|---|---|
| Faible, 100 %  | 1 round  | intact |
| Moyenne, 250 % | 2 rounds | 90 à 94 % des PV |
| Dure, 500 % (5 standards, 1 boss, 1 élite + 6 sbires, 2 élites + 1 standard) | 4 à 5 rounds | 45 à 60 % des PV ; 2 à 4 PJ à terre si les monstres concentrent leurs coups |
| Extrême, 1000 % (1 boss + 5 standards) | 3 à 5 rounds | **défaite** |

Ce que ça établit :
1. **La conversion des rangs tient** : toutes les compositions à 500 % coûtent à peu près la même
   chose au groupe. Le budget s'additionne bien.
2. **Exception** : beaucoup de petits monstres qui concentrent leurs coups coûtent plus cher que
   leur budget (10 sbires au niveau 18 : 1 PJ debout).
3. **Les durées visées ne tiennent PAS au curseur neutre** : 4 à 5 rounds au lieu de 6-7 / 9-10 /
   13-15. Le jeu est plus rapide que les cibles.
4. **Le curseur endurance ↔ violence règle la durée sans changer l'usure** (rencontre dure, groupe
   entre 40 et 60 % à la fin dans tous les cas) :

| Curseur | PV | Dégâts | Durée d'une rencontre dure |
|---|---|---|---|
| 0     | ×1   | ×1    | 4 rounds |
| +58   | ×1,5 | ÷1,5  | 5 rounds |
| +100  | ×2   | ÷2    | 7 rounds |
| +158  | ×3   | ÷3    | 10 rounds |
| +200  | ×4   | ÷4    | 13 à 14 rounds |
| +258  | ×6   | ÷6    | 19 à 20 rounds |

Les durées du MJ correspondent donc à **standard +100, élite +158, boss +200**.
⚠️ **Contrepartie** : un boss à +200 a PV ×20 mais des dégâts par round à ×0,75 d'un PJ — il dure,
mais chaque coup est faible. Long **et** violent = un budget plus élevé, pas un réglage.

**Décision MJ (2026-10-11) : réglage « intermédiaire »** — standard +58 (PV ×1,5), élite +100
(×2), boss +158 (×3), soit environ 5, 7 et 10 rounds dans ce modèle ; microbe et sbire neutres.
Les soins et contrôles des joueurs, absents du modèle, doivent rapprocher les vrais combats des cibles. `REF_ROUND_RATIO` est posé à 1,8 (moyenne des 5 kits au rang 1, à recaler au lot G des
compétences).

## 11. Modèle de données

```
/bestiary/                      ← lecture + écriture : role === 'mj' SEULEMENT
    monsters/{id}/
        id, name, img, note, side ('enemy'|'ally')
        level, rank, archetype, tilt          ← paramètres de génération (tilt = endurance ↔ violence)
        hpMax, ad, ap, armure, resmag, crit, dcrit, rescrit, lethaAD, lethaAP   ← valeurs finales
        xp
        attacks/{id}: { id, order, name, kind ('basic'|'skill'), type, targets, cd, dmg, note }
        updatedAt
    encounters/{id}/
        id, name, note, partyLevel, partySize
        entries/{monsterId}: effectif
```

Copie posée dans `combat/enemies` : forme existante, plus `npcLevel`, `rank`, `bestiaryId`
(informatifs).

## 12. Fichiers touchés

- `game-logic.js` : référentiel, rangs, archétypes, génération de stats, puissance réelle, budget
  de dégâts, zone, difficulté, XP — tout en fonctions pures, testées.
- `auth.js` : page `bestiaire` pour `mj` seul.
- `database.rules.json` : nœud `/bestiary` (à déployer et relire, `docs/archi/firebase.md`).
- `data-state.jsx` : hooks `useBestiary` / `useEncounters`, pose en combat.
- `pages-bestiaire.jsx` (nouveau) + `index.html` (script, `PAGES`, jeton de cache) + `runeterra.css`.

## 13. Lots proposés

1. **Logique pure et calibrage** : fonctions de §3 à §9, tests, simulateur de durées, valeurs
   figées avec le MJ.
2. **Bestiaire** : règles RTDB, page, liste, fiche, stats ajustables, variantes, pose en combat,
   export/import JSON.
3. **Attaques et compétences** : plages, bascule de type, jauge de budget, notes.
4. **Rencontres** : composition, difficulté, XP, pose en un clic.
5. **Option « ma table actuelle »**.
