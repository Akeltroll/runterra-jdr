# Barème de valeur des statistiques — équivalent AD

*Document de référence. Il répond à une seule question : **combien vaut un point de telle
stat, exprimé en points d'AD ?** — pour écrire des objets qui se valent.
Établi le 2026-09-09. La méthode, les démonstrations et les réserves sont dans
`docs/superpowers/specs/2026-09-09-bareme-valeur-stats-design.md`.*

---

## Le barème

| Stat | base (n2) | supérieur (n10) | légendaire (n18) |
|---|---|---|---|
| **1 AD** / **1 AP** | 1,00 | 1,00 | 1,00 |
| **1 PV** | 0,33 | 0,33 | 0,33 |
| **1 Armure** / **1 Rés. Mag** | 0,64 | **1,44** | 2,39 |
| **1 % Crit** | 0,80 | **1,96** | 3,39 |
| **1 % Dégâts Crit** ⚠️ | 0,08 | **0,20** | 0,34 |
| **1 % Vol de vie** / **Sapience** | 0,32 | **0,72** | 1,13 |
| **1 % Omnivamp** | 0,40 | **0,89** | 1,40 |
| **1 % Rés. Crit** | 0,20 | **0,48** | 0,88 |

Réciproque, au palier supérieur :

> `1 AD = 3 PV = 0,7 Armure = 0,5 %Crit = 5,1 %DégCrit = 1,4 %VolDeVie = 1,1 %Omnivamp = 2,1 %RésCrit`

**Mode d'emploi.** Une colonne par palier d'équipement : `base` ≈ niveau 2-5, `supérieur` ≈ niveau
10, `légendaire` ≈ niveau 18. Additionner la valeur de chaque `mods` d'un objet donne son budget
total en AD, comparable à celui d'un autre objet du même palier.

---

## Les trois choses à savoir avant de s'en servir

**1. Seuls les PV ont une valeur stable.** Toutes les autres lignes triplent ou quadruplent du
niveau 2 au 18, parce que ce sont des **multiplicateurs** : la valeur d'un point d'armure est
`PV/(AR+120)`, celle d'un point de crit est proportionnelle à l'AD — donc elles croissent avec le
porteur. Les PV, eux, croissent au même rythme que l'AD (le ratio PV/AD du bruiser vaut 3,04 / 3,13
/ 3,09 / 3,25 aux niveaux 2/5/10/18), d'où le raccord fixe à 3.

C'est la raison d'être des paliers d'équipement. La spec §7.1 le fait déjà correctement : les armes
vont +15 / +30 / +70, soit ×1 / ×2 / ×4,7, quand l'AD du bruiser fait ×1 / ×2,4 / ×4,2.

**2. Le % Dégâts Crit n'est pas tarifable au barème général.** Il vaut 0,93 AD sur un ADC et 0,115
sur un tank — un écart de ×8, contre ×2,2 à ×2,7 pour toutes les autres stats. Il ne sert à rien
sans chance de crit. Ne le poser que sur un objet explicitement destiné à un porteur à crit, ou
toujours l'accompagner de %Crit dans le même objet.

**3. Deux valeurs sont provisoires.**
- **Omnivamp** = 1,24 × le vol de vie, ce ratio étant celui de la rotation optimale mesurée en
  2026-09-05 (Urskaar 1,50 / Elias 1,47 / Rathael 1,21 / Smith 1,04 / Jett 1,00). Il montera
  **mécaniquement vers 1,50** quand les compétences seront rééquilibrées, puisque c'est le budget
  cible posé pour les DPS. **À re-tarifer à ce moment-là** (0,48 / 1,08 / 1,70).
- **Rés. Crit** = moyenne du roster. Elle vaut 0,29 contre un bruiser et 1,0 contre un assassin.

---

## Hypothèses

| | |
|---|---|
| **Personnage de référence** | **Bruiser** (Force/Mental), le profil dont le ratio PV/AD vaut exactement le raccord retenu. n10 : 1238 PV, 401 AD, 23 AR/RM |
| **Raccord offense ↔ défense** | **1 AD = 3 PV** — mesuré, médiane du roster. ⚠️ **Pas** dérivé du mana : le mana est situationnel et ne sert pas de pivot (décision MJ) |
| **Dégâts subis** | mix **50 % physique / 50 % magique**. En 100 % physique, l'armure vaut le double (2,73 AD au palier supérieur au lieu de 1,44) |
| **Armure / Rés. Mag** | traitées comme **identiques** — le moteur est symétrique, l'asymétrie d'un porteur donné est un artefact de son build |
| **Chaîne de résolution** | `affiché × crit × 0,625 (d20) × (1 − AR/(AR+120))` |
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
| Armure = ? PV | 7,5 → **6,4** après correction de constante | 4,3 (mix) / 8,7 (phys. pur) | **concorde** |
| 1 AD = ? PV | 13,1 | **3** | **inapplicable** |
| AD vs AP | 1,75 | **1,00** | AD = AP chez nous |
| 1 PV = ? Mana | 2,67 | hors barème | le mana est situationnel |

**Le bloc défensif de LoL est transposable.** À condition de corriger la constante : LoL utilise
`AR/(AR+100)`, nous `AR/(AR+120)`, et comme la valeur d'un point d'armure vaut `PV/(AR+K)`, le
rapport entre les deux systèmes est `(AR+100)/(AR+120)` — soit **−14 %** sur notre plage d'armure
réelle. Les 7,5 PV de LoL deviennent **6,4**, ce qui tombe exactement sur le §7.2 de la spec MJ
(6,0 à 7,1 selon la classe), écrit sans aucune référence à LoL.

**Le raccord offense ↔ défense ne l'est pas**, d'un facteur 6. Deux raisons structurelles : LoL a
la **vitesse d'attaque**, qui démultiplie chaque point d'AD (d'où 35 or) — nous avons une attaque
par tour ; et le TTK de LoL est de 10-15 coups quand le nôtre est de 2,8, or plus on meurt vite,
moins les PV valent. C'est aussi pourquoi notre **vol de vie est structurellement faible** :
c'est une stat de *sustain*, dont la valeur croît avec la durée du combat.

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
  `AR/(AR+120)` par le bas), leur valeur dépend donc de l'armure de la cible, pas du porteur.
