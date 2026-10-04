# Barème de valeur des statistiques — équivalent AD

*Document de référence. Il répond à une seule question : **combien vaut un point de telle
stat, exprimé en points d'AD ?** — pour écrire des objets qui se valent.
Établi le 2026-09-09. La méthode, les démonstrations et les réserves sont dans
`docs/superpowers/specs/2026-09-09-bareme-valeur-stats-design.md`.*

---

> ⚠️ **Mis à jour le 2026-09-12 : la constante de mitigation est passée de 120 à 100**
> (`MITIGATION_K`, `game-logic.js`) — la formule de League of Legends. Chaque point d'armure et de
> résistance magique vaut donc **~16 % de plus** qu'avant, et c'est la seule ligne du barème qui
> bouge. Motif, mesures et effets de bord : [journal du 2026-09-12](journal/2026-09-12.md).

> ⚠️ **Corrigé le 2026-10-03 : vol de vie, sapience et omnivamp valaient ~3,8× TROP PEU.**
> Les anciennes valeurs (vol 0,32 / 0,72 / 1,13 ; omni 0,40 / 0,89 / 1,40) revenaient à une décote
> implicite « seul un quart du soin est utile », qui n'était documentée nulle part et **qui ne tient
> pas** : à 10 % d'omnivamp un bruiser se soigne de 47 PV sur un combat où il en encaisse 500 (et de
> 157 sur 2253 au niveau 18) — **l'omnivamp ne déborde jamais ici**, il n'y a pas de soin gaspillé à
> décoter. Le ratio omni = 1,24 × vol de vie, lui, est conservé (décision MJ du 2026-09-09).
> Dérivation et mesures : [journal du 2026-10-03](journal/2026-10-03.md), §4.

## Le barème

| Stat | base (n2) | supérieur (n10) | légendaire (n18) |
|---|---|---|---|
| **1 AD** / **1 AP** | 1,00 | 1,00 | 1,00 |
| **1 PV** | 0,33 | 0,33 | 0,33 |
| **1 Armure** / **1 Rés. Mag** | 0,75 | **1,68** | 2,74 |
| **1 % Crit** | 0,80 | **1,96** | 3,39 |
| **1 % Dégâts Crit** ⚠️ | 0,08 | **0,20** | 0,34 |
| **1 % Vol de vie** / **Sapience** ⚠️ | **1,27** | **2,73** | **4,18** |
| **1 % Omnivamp** ⚠️ | **1,57** | **3,39** | **5,19** |
| **1 % Rés. Crit** | 0,20 | **0,48** | 0,88 |
| **1 Mana** ⚠️ *(décroît)* | **0,29** | **0,16** | **0,11** |
| **1 % de dégâts** 🆕 | **1,65** | **4,01** | **6,94** |
| **1 % Soins/Bouclier** 🆕 | **1,24** | **3,01** | **5,21** |

> 🆕 **Ajouté le 2026-10-05.** `1 % de dégâts` n'est pas une mesure nouvelle : toute la chaîne de
> résolution est **linéaire en AD**, donc un bonus de +1 % vaut `AD/100` (bruiser de référence :
> 165 / 401 / 694). La dérivation **retombe à 2 % près sur les lignes Crit et Dégâts Crit** du
> tableau, établies séparément en 2026-09-09 — c'est ce qui la valide.
> `1 % Soins/Bouclier = 0,75 × 1 % de dégâts` (**décision MJ**) : une hausse de dégâts sert
> toujours, un bonus de soins suppose d'avoir un soin à donner et un creux de PV à remplir.
> ⚠️ La stat `soins` couvre les soins/boucliers **produits ET reçus, potions comprises** — un
> périmètre large qui rend la décote de 0,75 généreuse. **Si elle paraît forte à l'usage, c'est
> le 0,75 qu'il faut rouvrir.** Elle ne touche ni le vol de vie / omnivamp, ni les hausses de
> PV max. Dérivation et chaîne d'application : [journal du 2026-10-05](journal/2026-10-05.md).

Réciproque, au palier supérieur :

> `1 AD = 3 PV = 0,6 Armure = 0,5 %Crit = 5,1 %DégCrit = 0,37 %VolDeVie = 0,29 %Omnivamp = 2,1 %RésCrit`

**Mode d'emploi.** Une colonne par palier d'équipement : `base` ≈ niveau 2-5, `supérieur` ≈ niveau
10, `légendaire` ≈ niveau 18. Additionner la valeur de chaque `mods` d'un objet donne son budget
total en AD, comparable à celui d'un autre objet du même palier.

---

## Les trois choses à savoir avant de s'en servir

**1. Seuls les PV ont une valeur stable.** Toutes les autres lignes triplent ou quadruplent du
niveau 2 au 18, parce que ce sont des **multiplicateurs** : la valeur d'un point d'armure est
`PV/(AR+100)`, celle d'un point de crit est proportionnelle à l'AD — donc elles croissent avec le
porteur. Les PV, eux, croissent au même rythme que l'AD (le ratio PV/AD du bruiser vaut 3,04 / 3,13
/ 3,09 / 3,25 aux niveaux 2/5/10/18), d'où le raccord fixe à 3.

C'est la raison d'être des paliers d'équipement. La spec §7.1 le fait déjà correctement : les armes
vont +15 / +30 / +70, soit ×1 / ×2 / ×4,7, quand l'AD du bruiser fait ×1 / ×2,4 / ×4,2.

**2. Le % Dégâts Crit n'est pas tarifable au barème général.** Il vaut 0,93 AD sur un ADC et 0,115
sur un tank — un écart de ×8, contre ×2,2 à ×2,7 pour toutes les autres stats. Il ne sert à rien
sans chance de crit. Ne le poser que sur un objet explicitement destiné à un porteur à crit, ou
toujours l'accompagner de %Crit dans le même objet.

**⚠️ 0. Le mana est la seule ligne qui DÉCROÎT — ce n'est pas une coquille.** Ajouté le 2026-10-03,
il était jusque-là **hors barème** (décision MJ du 2026-09-09 : « situationnel »). Il n'est pas
dérivé du combat mais d'une **équivalence posée par le MJ**, exprimée en PV :

> **1 PV = 1 Mana au niveau 1 · 1 PV = 2 Mana au niveau 9 · 1 PV = 3 Mana au niveau 18**
> (interpolation linéaire entre les trois ancres).
>
> En AD, puisque `1 PV = 0,33 AD` : **1 Mana = 0,33** au niveau 1, **0,29** au niveau 2,
> **0,22** au niveau 5, **0,165** au niveau 9, **0,16** au niveau 10, **0,11** au niveau 18.

C'est cohérent avec l'intuition : un point de mana compte quand la réserve fait 100, beaucoup moins
quand elle fait 1300. **Le mana a des rendements décroissants, contrairement à toutes les autres
stats du barème** — il perd exactement les deux tiers de sa valeur sur la campagne.

⚠️ Ne pas le « corriger » en le rendant croissant par symétrie avec les autres lignes. ⚠️ Et ne pas
le lisser en un taux plat : à 0,125 une rune mana-lourde tombe 35 % sous sa cible au niveau 2, à
0,25 elle la dépasse de 50 % au niveau 18. Mesures : `docs/journal/2026-10-03.md` §7.

⚠️ **Historique à ne pas confondre** : une première version de cette ligne (0,27 / 0,16 / 0,14) avait
été **dérivée** d'un autre arbitrage MJ — « le mana de Manifestation justifie de réduire son AP au
quart de celui d'Harmonie ». Elle est **remplacée** par l'équivalence en PV ci-dessus, qui est plus
générale (elle ne dépend pas de deux runes particulières). Les deux courbes sont proches jusqu'au
niveau 10 et divergent ensuite (0,14 contre 0,11 au niveau 18).

**3. Deux valeurs sont provisoires.**
- **Omnivamp** = 1,24 × le vol de vie, ce ratio étant celui de la rotation optimale mesurée en
  2026-09-05 (Urskaar 1,50 / Elias 1,47 / Rathael 1,21 / Smith 1,04 / Jett 1,00). Il montera
  **mécaniquement vers 1,50** quand les compétences seront rééquilibrées, puisque c'est le budget
  cible posé pour les DPS. **À re-tarifer à ce moment-là** (1,90 / 4,10 / 6,28).
  ⚠️ Seul le **ratio** est provisoire : le prix absolu, lui, a été recalculé le 2026-10-03 (bloc
  d'avertissement en tête) et ne repose plus sur une décote non documentée.
- **Rés. Crit** = moyenne du roster. Elle vaut 0,29 contre un bruiser et 1,0 contre un assassin.
  ⚠️ **Décision MJ du 2026-10-04 : cette moyenne SOUS-PAIE la rés. critique en jeu** — une
  caractéristique sur quatre (l'Habileté) donne du crit, et les équipements aussi, donc le porteur
  d'en face crite plus souvent que le roster moyen. La rune Volonté/CC est écrite **sous la cible**
  à ce prix-là **exprès** ; elle tombe pile dessus au prix « contre un assassin ». Deux limites
  à connaître avant de s'en servir pour un objet : la rés. crit est **plafonnée à 100 %**
  (`critMultAfterResist`) et le Mental en donne déjà **3 %/point**, donc le barème, linéaire,
  **surévalue toute grosse quantité**. Sous-payée en moyenne, surpayée en gros volume.
  Mesures : `docs/journal/2026-10-04.md` §1 et §3.

---

## Hypothèses

| | |
|---|---|
| **Personnage de référence** | **Bruiser** (Force/Mental), le profil dont le ratio PV/AD vaut exactement le raccord retenu. n10 : 1238 PV, 401 AD, 23 AR/RM |
| **Raccord offense ↔ défense** | **1 AD = 3 PV** — mesuré, médiane du roster. ⚠️ **Pas** dérivé du mana : le mana est situationnel et ne sert pas de pivot (décision MJ) |
| **Dégâts subis** | mix **50 % physique / 50 % magique**. En 100 % physique, l'armure vaut le double (2,73 AD au palier supérieur au lieu de 1,44) |
| **Armure / Rés. Mag** | traitées comme **identiques** — le moteur est symétrique, l'asymétrie d'un porteur donné est un artefact de son build |
| **Chaîne de résolution** | `affiché × crit × 0,625 (d20) × (1 − AR/(AR+100))` — ⚠️ K passé de 120 à 100 le 2026-09-12 |
| **Patch +5 AR/RM** | inclus (`BASE_AR_RM`, `computeStats`) |

---

## Vérification croisée — le contenu déjà écrit

Valeur totale en AD des objets de `ITEM_CATALOG` / spec §7 :

| Objet | base (n2) | supérieur (n10) | légendaire (n18) |
|---|---|---|---|
| Arme de base (+15 AD) | 15,0 | 15,0 | 15,0 |
| Armure légère, PV pur (50 PV) | **16,7** | 16,7 | 16,7 |
| Armure légère, Armure pure (10 Arm) | 6,4 | 14,4 | **23,9** |
| Armure légère, Arm+RM (4+4) | 5,1 | 11,5 | 19,1 |
| Armure légère, PV+Arm (21 PV + 4 Arm) | 9,5 | 12,8 | 16,6 |
| Armure interm., PV pur (100 PV) | 33,3 | 33,3 | 33,3 |
| Armure interm., Armure pure (15 Arm) | 9,6 | 21,6 | 35,9 |
| Armure lourde, PV pur (150 PV) | 50,0 | 50,0 | 50,0 |
| Armure lourde, Armure pure (25 Arm) | 15,9 | 36,1 | 59,8 |

Trois lectures :

- **L'arme de base et l'armure légère PV se valent** (15,0 contre 16,7), pour 8-26 ar et 13 ar.
  Spec §7.1 et §7.2 cohérentes entre elles et avec le guide d'économie.
- **Le profil résistance rattrape le profil PV au niveau 12** (il le rattrapait au niveau 18 avant
  le patch des armures légères du 2026-09-09). Ce décalage est **assumé** : à bas niveau on
  s'équipe en PV, en fin de campagne en résistance. Voir §5 de la spec.
- **Le profil combiné vaut 82 % d'un profil pur** au point de bascule (42 % de PV + 40 % de
  résistance), soit un malus de polyvalence de 18 % — la valeur canonique.

Rapport valeur/prix des profils résistance, après le patch — les trois classes sont alignées :

| Classe | Armure | Prix | AD par ar |
|---|---|---|---|
| Légère | 10 | 13 ar | 0,49 |
| Intermédiaire | 15 | 20 ar | 0,48 |
| Lourde | 25 | 32 ar | 0,50 |

---

## Comparaison à League of Legends

Le barème LoL (`or par unité`, dérivé du composant le moins cher ne donnant que cette stat) a servi
de **contrôle**, pas de source. Normalisé en points d'AD :

| Stat | LoL | ici | verdict |
|---|---|---|---|
| Armure = ? PV | **7,5** | 5,0 (mix 50/50) / 10,1 (phys. pur) | **concorde** |
| 1 AD = ? PV | 13,1 | **3** | **inapplicable** |
| AD vs AP | 1,75 | **1,00** | AD = AP chez nous |
| 1 PV = ? Mana | 2,67 | **1 (n1) → 2 (n9) → 3 (n18)** | **concorde vers le niveau 12** (voir ⚠️ 0) |

**Le bloc défensif de LoL est DIRECTEMENT transposable depuis le 2026-09-12** : nous utilisons
désormais sa constante (`AR/(AR+100)`), donc la correction de −14 % qui figurait ici — et qui
compensait notre ancien 120 — n'a plus lieu d'être. Les 7,5 PV de LoL tombent entre nos deux bornes
(5,0 en mix 50/50, 10,1 contre du physique pur), ce qui situe son mix implicite autour de 75 % de
dégâts physiques — plausible pour un système où l'on achète ses résistances en fonction de
l'adversaire. Et ils restent cohérents avec le §7.2 de la spec MJ (6,0 à 7,1 selon la classe),
écrit sans aucune référence à LoL.

**Le raccord offense ↔ défense ne l'est pas**, d'un facteur 6. Deux raisons structurelles : LoL a
la **vitesse d'attaque**, qui démultiplie chaque point d'AD (d'où 35 or) — nous avons une attaque
par tour ; et le TTK de LoL est de 10-15 coups quand le nôtre est de 2,8, or plus on meurt vite,
moins les PV valent.

⚠️ **Ce document affirmait ici que notre vol de vie était « structurellement faible », parce que
c'est une stat de *sustain* dont la valeur croît avec la durée du combat. C'était faux** et c'est
la source de l'erreur corrigée le 2026-10-03 : le raisonnement est juste pour une stat qui a besoin
de *temps*, mais le vol de vie et l'omnivamp rendent leur soin **au coup**, proportionnellement aux
dégâts — donc leur valeur croît avec l'**AD**, pas avec la durée. Un combat court ne les pénalise
pas, il réduit seulement le nombre de coups, exactement comme pour l'AD lui-même.

Source : <https://wiki.leagueoflegends.com/en-us/Gold_efficiency>

---

## Ce qui reste à tarifer

- **Armes** — aucune entrée d'`ITEM_CATALOG` n'a de `mods`, alors que le §7.1 chiffre les 3 paliers
  (+15 / +30 / +70 AD ou AP, +10/+10 hybride). Prochain lot.
- **Palier supérieur des armures** — non chiffré dans la spec (les prix existent : 125/185/300 ar).
  Par symétrie avec les armes (×2), on aurait 20/30/50 en Armure pure pour les 3 classes.
  **Extrapolation, pas la spec** — à faire trancher par le MJ.
- **Potions** — le catalogue est 2 à 3× sous le guide d'économie §7.1, et c'est le catalogue qui
  s'applique en jeu (`parseConsumableEffect` lit le `sub`).
- **Léthalité physique / magique** — jamais tarifées. Elles ne sont pas linéaires (elles rongent
  `AR/(AR+100)` par le bas), leur valeur dépend donc de l'armure de la cible, pas du porteur.
