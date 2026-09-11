# Valeur intrinsèque des statistiques — méthode, décisions, patchs (2026-09-09)

*Ouvert à la demande du MJ pendant la reprise du chantier « catalogue d'objets » : avant de saisir
d'autres objets, savoir **ce qu'un point d'AD vaut en PV ou en armure**. Ce document porte la
**méthode et les décisions** ; le barème lui-même, destiné à être consulté, vit dans
`docs/bareme-stats.md`.*

---

## 1. Le problème

Le système portait déjà **trois barèmes implicites, qui se contredisaient**, sans que personne
n'ait jamais eu à les confronter :

| | 1 Armure = ? PV |
|---|---|
| **Moteur de caracs** (répartitions dirigées) | 10 |
| **Spec §7.2** (les 18 armures, à prix égal par classe) | 6,0 – 7,1 |
| **Réalité de combat** (EHP marginal) | 1,2 – 9,4 |

Le premier se dérive des choix binaires du moteur : Force `+10 AD ou +2 Armure` → 1 Armure = 5 AD ;
Habileté `+5 AD ou +10 Mana` et Mental `+15 PV ou +15 Mana` → 1 AD = 2 PV. Le deuxième se dérive de
ce que la spec fait coûter le même prix. Le troisième se mesure.

⚠️ **Il n'existe pas de taux universel**, et c'est la première conclusion à ne pas rouvrir : PV et
résistances se **multiplient** (`EHP = PV/(1 − AR/(AR+120))`), donc la valeur d'un point d'armure
vaut `PV/(AR+120)` — elle dépend du porteur et du niveau, d'un facteur 8 sur la campagne. Un tarif
d'objet doit donc **choisir un profil de référence** et assumer d'être faux ailleurs.

---

## 2. Décisions du MJ

**A — Le mana sort du barème.** « PV > Mana, les points de mana étant liés à la capacité de lancer
plus de sorts. C'est situationnel alors que les PV donnent toujours une contribution. »

⚠️ **Conséquence directe : cela invalide la dérivation `1 AD = 2 PV`**, qui passait par le mana
(`1 AD = 2 Mana` puis `1 Mana = 1 PV`). La page Progression n'affirme donc pas une *équivalence de
valeur* mais une *équivalence de choix* : le mana y est offert plus généreusement (10 contre 5,
15 contre 15) précisément parce qu'il vaut moins. LoL dit la même chose (1 PV = 2,67 Mana).
Les répartitions du moteur ne changent pas ; elles ne servent simplement pas de pivot.

**B — Raccord offense ↔ défense : `1 AD = 3 PV`.** Mesuré, pas déclaré. L'équivalence en duel
s'écrit `1/AD_total = X/PV_total` (la mitigation se simplifie des deux côtés), donc
**X = PV du personnage ÷ son AD**. Valeurs : ADC 1,55-1,79 ; Assassin 1,72-2,10 ; Bruiser
3,04-3,25 ; Tank 4,91-6,36. Médiane du roster : **3,13**.

⚠️ Cette méthode dit à chacun « achète ce que tu n'as pas » — un tank valorise 1 AD à 5,7 PV parce
qu'il n'a pas d'AD. Bon conseil d'achat, inutilisable comme tarif : d'où le profil de référence.

**C — Personnage de référence : le bruiser.** Retenu parce que son ratio PV/AD vaut **exactement**
le raccord choisi (3,09 au niveau 10), et parce qu'il est le profil central du roster.

**D — Mix de dégâts subis : 50 % physique / 50 % magique.** L'armure ne protège que d'une partie
des dégâts, contrairement aux PV. En 100 % physique, l'armure vaudrait le double.

**E — Patch de durabilité : `BASE_AR_RM = 5`** pour tous dès le niveau 1.

**F — Omnivamp sur toutes les sources, cumulée** avec vol de vie et sapience.

**G — Armures légères : résistances de 7 à 10** (et transposition sur les 6 profils légers).

---

## 3. Le patch +5 AR/RM — une décision de lecture, pas d'arithmétique

Mesuré : **+3,3 à +4,0 % d'EHP**, uniforme sur toute la campagne. En TTK, 2,8 → 2,9 attaques.

| levier | ADC n2 | ADC n10 | ADC n18 |
|---|---|---|---|
| **+5 AR/RM plat** | +4,0 % | +3,6 % | +3,3 % |
| K : 120 → 100 | +0,8 % | +2,5 % | +3,9 % |
| socle +2/niveau | +1,6 % | +7,3 % | +12,0 % |
| `FORCE_BASE_AR` 1 → 2 | +2,6 % | +4,9 % | +7,0 % |

⚠️ **Deux pièges à connaître avant de retoucher cette constante.**

1. **La mitigation ne peut structurellement rien faire à bas niveau.** Avec K = 120 et des PJ à 6-9
   d'armure, il faudrait les monter à **60 d'armure ET 60 de RM** pour gagner 15 % d'EHP au niveau 2.
   Ce n'est pas le levier de l'encaissement précoce — les **PV** le sont (une Veste matelassée à
   +50 PV donne **+16 % d'EHP** à un ADC niveau 2, soit 4× ce patch).
2. **Augmenter le socle DIMINUE la valeur de l'armure d'équipement** (`PV/(AR+120)` décroît en AR) :
   de 2,42 à 2,33 PV par point au niveau 2. Contre-productif si l'objectif est de valoriser les
   armures du catalogue.

**La raison réelle du patch, retenue par le MJ, est de lecture** : « 2 de RM se lit comme être une
passoire à la magie ; même si 7 de RM reste une passoire, cela apaise un peu les consciences. »
C'est un motif valable et il est consigné comme tel — pour qu'on ne monte pas la constante plus tard
en croyant corriger un problème mécanique.

**Aucune migration** : `armure` et `resmag` sont calculées en live par `computeStats`, jamais
stockées en absolu comme les PV — donc **pas de « ⟲ Combat »** à passer, contrairement au
changement du 2026-09-04.

---

## 4. Omnivamp universelle et cumulative

Ancienne règle : attaque de base → vol de vie (physique) ou sapience (magique) ; compétence → omni.
Les trois étaient **mutuellement exclusives**.

Nouvelle règle (`lifestealHeal`) :

```
attaque de base physique : vol + omni   |  magique : sapience + omni  |  brut : omni
compétence (tout type)   : omni
```

⚠️ **Le cumul est délibéré.** Sans lui, l'omnivamp serait **inutile** à quiconque possède déjà du
vol de vie, alors qu'elle est censée en être la version universelle. Vol de vie et sapience restent
réservées à l'attaque de base et départagées par le type — elles ne sont pas touchées.

**Tarif.** Le rapport omni/vol vaut `1 + D_comp/D_aa`, c'est-à-dire exactement le **ratio de
rotation optimale** du diagnostic du 2026-09-05 : Urskaar 1,50 / Elias 1,47 / Rathael 1,21 /
Smith 1,04 / Jett 1,00 → moyenne **×1,24**.

⚠️ **Cette valeur est datée et montera à ×1,50** quand les compétences seront rééquilibrées (c'est
le budget cible posé pour les DPS). L'omnivamp est donc la seule stat du barème dont la valeur
dépend d'un autre chantier. À re-tarifer alors.

---

## 5. Armures légères — le patch corrige un défaut de tarification

Table transposée (les intermédiaires et lourdes ne bougent pas) :

| Profil | avant | après |
|---|---|---|
| PV pur | 50 PV | 50 PV *(inchangé)* |
| Armure pure | 7 Arm | **10 Arm** |
| RM pure | 7 RM | **10 RM** |
| Arm + RM | 3 + 3 | **4 + 4** |
| PV + Arm | 20 PV + 3 Arm | **21 PV + 4 Arm** |
| PV + RM | 20 PV + 3 RM | **21 PV + 4 RM** |

**Ce que ça corrige** — le rapport valeur/prix des profils résistance :

| Classe | Armure | Prix | AD par ar |
|---|---|---|---|
| Légère **avant** | 7 | 13 ar | **0,34** ⚠️ |
| Légère **après** | 10 | 13 ar | **0,49** ✅ |
| Intermédiaire | 15 | 20 ar | 0,48 |
| Lourde | 25 | 32 ar | 0,50 |

L'armure légère de résistance était **le seul objet mal tarifé du catalogue** — 30 % sous ses deux
sœurs à profil identique. Le patch la remet dans l'alignement à 2 % près.

**Effets mesurés :**
- Le **point de bascule** (profil résistance = profil PV) passe du niveau **18 au niveau 12**. Un
  build léger a désormais une moitié de campagne où le choix est ouvert.
- Le **21 + 4** est calibré juste : à 42 % et 40 % des profils purs, la combinaison vaut 82 % au
  point de bascule, soit un malus de polyvalence de 18 % — la valeur canonique.

⚠️ **Effet de bord assumé** : l'efficacité au poids passe à **2,50** Arm/poids pour la légère,
contre 1,50 (interm.) et 1,25 (lourde) — elle était déjà la meilleure (1,75), elle creuse du simple
au double. La lourde garde son argument propre (25 points d'armure, qu'aucune légère n'approche),
mais pour un personnage serré en capacité de charge, la légère devient nettement dominante.

---

## 6. La question qui reste ouverte, et pourquoi on ne la ferme pas

**Le profil PV domine le profil résistance sur la première moitié de la campagne** (facteur 3,7 au
niveau 2, égalité au niveau 12, inversion ensuite). Deux réponses possibles :

- **On assume** — retenu. À bas niveau on s'équipe en PV, en fin de campagne en résistance. C'est
  une progression lisible qui donne du sens au passage aux paliers supérieurs.
- **On corrige** — écarté. Remonter les résistances à bas niveau les rendrait surpuissantes au
  niveau 18, où elles se multiplient à des PV bien plus hauts.

⚠️ **Ne pas rouvrir ce point en croyant à une erreur de valeurs.** La table du §7.2 est juste au
barème du milieu de campagne ; l'écart aux extrémités est structurel, pas une faute de saisie.

**Piste non chiffrée, si le sujet revient** : faire porter aux armures de résistance quelque chose
que les PV ne donnent pas — la **rés. critique**, ou les **passifs anti-crit** que le §7.2 annonce
et remet à plus tard. C'est la stat qui manque à un porteur léger face à un assassin, et elle ne se
dilue pas dans les PV. Tient dans le champ `mods` existant, aucun changement de moteur.

---

## 7. Ce qui a changé dans le code

| Fichier | Changement |
|---|---|
| `game-logic.js` | `BASE_AR_RM = 5`, ajouté à `armure` et `resmag` dans `computeStats` |
| `game-logic.js` | `lifestealHeal` : omnivamp sur toutes les sources, cumulée avec vol/sapience |
| `data.jsx` | les 6 armures légères d'`ITEM_CATALOG` (valeurs + `sub`) |
| `armures-catalog.json` | régénéré **depuis `data.jsx`** (script au §8), ids inchangés |
| `test/game-logic.test.js` | 3 attentes d'armure recalées (+5), test de `lifestealHeal` réécrit |
| `index.html` | jeton de cache `20260907-1` → `20260909-1` |

**266 tests verts** (game-logic 255 + auth 11). **Aucune règle RTDB**, **aucune migration**.

---

## 8. Le catalogue est en base

✅ **Écriture Firebase passée et vérifiée le 2026-09-09** — les 18 armures sont dans
`campaign/runeterra/catalog` (6 par classe), relues et comparées champ à champ au patch local :
identiques. Cela clot l'étape en attente depuis le 2026-09-07, où `data.jsx` avait été édité sans
que rien n'existe en jeu.

Commande utilisée (depuis Git Bash — c'est aussi le shell du `!` de Claude Code) :

```bash
MSYS_NO_PATHCONV=1 firebase database:update "/campaign/runeterra/catalog" armures-catalog.json --instance runeterra-jdr-default-rtdb --force
```

⚠️ **Trois piquets pour la prochaine fois** :
- `MSYS_NO_PATHCONV=1` est **obligatoire**, y compris via le `!` de Claude Code : sans lui, MSYS
  convertit `/campaign/...` en chemin Windows et la CLI répond `Error: Path must begin with /`.
- `--force` est **nécessaire en non-interactif** : le prompt de confirmation n'a pas de stdin et
  retombe sur « non » (`Error: Command aborted`). Acceptable ici parce que `update` est additif,
  les ids sont fixes, et l'opération est idempotente et réversible.
- Firebase **réordonne les clés alphabétiquement**. Comparer une relecture au fichier local avec un
  `JSON.stringify` direct produit de fausses divergences (`{hp,armure}` contre `{armure,hp}`) :
  trier les clés en profondeur avant de comparer.

`armures-catalog.json` a été supprimé (régénérable depuis `data.jsx`).

**Reste, en jeu** : prévenir la table. Trois changements simultanés (+5 AR/RM, omnivamp cumulative,
armures légères) s'ajoutent aux **quatre répartitions** qui attendent d'être annoncées depuis le
2026-09-06. Une armure légère profil PV (+50 PV) donne **+16 % d'EHP** à un PJ niveau 2 : le
catalogue change l'équilibre dès qu'un joueur achète.

**Lot suivant** : les **armes**. Le §7.1 les chiffre déjà, le barème confirme que +15 AD ≡ une
armure légère profil PV, et aucune des 9 entrées d'`ITEM_CATALOG` n'a de `mods`.
