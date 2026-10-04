# Chiffrage de l'arbre de runes — diagnostic (2026-09-15)

*Ouvert à la demande du MJ : « le système de runes n'est pas équilibré, peut-on le chiffrer ? ».
Ce document **mesure**, il ne tranche rien. Aucune ligne de `RUNES` (data.jsx) n'a été modifiée.
Il réutilise le barème de `docs/bareme-stats.md` et la méthode de
`docs/superpowers/specs/2026-09-09-bareme-valeur-stats-design.md`.*

---

## 1. Ce qu'on mesure et avec quoi

**L'unité** : **1 point d'AD tenu pendant tout le combat**. C'est la même unité que le barème des
stats, prolongée aux effets qui ne sont pas des stats :

| effet | conversion |
|---|---|
| +1 AD / +1 AP | 1 unité |
| +1 PV | 0,33 (barème, `1 AD = 3 PV`) |
| +1 Armure / Rés. Mag | 0,75 (n2) · 1,68 (n10) · 2,74 (n18) — barème |
| +1 % Crit | 0,80 · 1,96 · 3,39 — barème |
| +1 % Omnivamp | 0,40 · 0,89 · 1,40 — barème |
| **+X % de dégâts** | `X % × AD` (le bonus s'applique à chaque coup du combat) |
| **1 tour d'attaque gagné ou perdu** | `AD / 5` |
| **1 compétence lancée en plus** | `1,2 × AD / 5` (ratio comp/AA du diagnostic du 2026-09-05) |
| **1 tour ennemi nié (CC)** | dégâts d'un coup encaissé = `PV / 5`, puis ×0,33 |
| **+1 au jet d'attaque** | +8 % de dégâts ; **+2 JA** = +16 % (calcul ci-dessous) |
| **+10 de léthalité** | +9,9 % (n2) · +8,7 % (n10) · +7,6 % (n18) de dégâts |

**Les quatre hypothèses de combat** — ce sont elles qu'il faut contester en premier si un chiffre
choque :

1. **Un combat dure 5 tours** (cohérent avec le TTK du calibrage : 2,8 à 5,5 attaques).
2. Le porteur **subit un coup par tour** et mourrait en 5 tours s'il était focalisé (`PV/5` par tour).
3. Le porteur lance **2 compétences** dans le combat, qui pèsent **la moitié de ses dégâts**.
4. **Personnage de référence : le bruiser** du barème — 165 AD / 501 PV au niveau 2, 401 AD /
   1238 PV au niveau 10, 694 AD / 2253 PV au niveau 18. ⚠️ Conséquence : les runes de **crit** sont
   sous-évaluées ici (le bruiser a 5 % de crit de base) et les runes de **léthalité** le sont
   légèrement aussi contre un gros monstre armuré.

**Le jet d'attaque (JA)**, chiffré pour la première fois. Règle de table : d20, 1-5 = raté,
6-10 = demi-dégâts, 11-20 = plein, soit une espérance de **0,625**. Avec un bonus :

| bonus | espérance | gain de dégâts |
|---|---|---|
| +0 | 0,625 | — |
| **+1** | 0,675 | **+8,0 %** |
| **+2** | 0,725 | **+16,0 %** |
| +3 | 0,775 | +24,0 % |

---

## 2. Le repère : que devrait valoir 1 point de rune ?

Un niveau donne **1 point de rune** (`runeBudget(level) = level`) **et** 1 ou 2 points de
caractéristique. Le point de carac est donc l'étalon naturel. Valeur marginale mesurée sur le
bruiser, barème appliqué :

| | Force | Habileté | Mental | Magie |
|---|---|---|---|---|
| **niveau 2** | 40 | 17 | 27 | 36 |
| **niveau 10** | 52 | 23 | 33 | 41 |
| **niveau 18** | 82 | 30 | 41 | 45 |

> **Cible retenue pour la suite : un point de rune devrait valoir ≈ 30 unités au niveau 2,
> ≈ 40 au niveau 10, ≈ 50 au niveau 18.** C'est la médiane des quatre caracs.

Deux constats immédiats :

- **`+30 AD ou AP` (Conquérant/Agression, mineure) vaut exactement 30.** C'est la seule rune de
  l'arbre posée pile sur l'étalon du niveau 2 — elle sert d'ancre à tout ce qui suit.
- **La cible monte de 30 à 50 sur la campagne** (le personnage grossit), alors que **19 des 45
  runes sont des valeurs plates qui ne bougent jamais**. C'est le défaut n° 1 (§5).

---

## 3. Ce qui se joue à la table AUJOURD'HUI : les 15 mineures

Tout le monde est **niveau 2**, budget **2 points** : seules les mineures sont accessibles
(une avancée coûte 2 points **et** exige sa mineure, soit 3 points). **Le reste de l'arbre est
décoratif pour l'instant.** Classement au niveau 2 :

| rang | mineure | famille / voie | valeur | vs cible 30 |
|---|---|---|---|---|
| 1 | **−1 CDR (sauf ultime)** | Sorcellerie / Maîtrise | **40** | +32 % |
| 1 | **+40 AP** | Sorcellerie / Harmonie | **40** | +32 % |
| 3 | +100 HP | Volonté / Sacrifice | 33 | +10 % |
| 4 | +15 AD ou AP et 10 léthalité | Domination / Sadisme | 31 | +4 % |
| 5 | **+30 AD ou AP** | Conquérant / Agression | **30** | **étalon** |
| 6 | +50 HP et 50 Mana | Inspiration / Partage | 23 | −24 % |
| 7 | +50 HP et 10 % Omni | Conquérant / Sustain | 21 | −32 % |
| 8 | −1 tour aux CC reçus | Conquérant / Ténacité | 17 | −45 % |
| 8 | +1 tour de CC infligé | Volonté / CC | 17 | −45 % |
| 10 | +10 AR et 10 RM | Volonté / Durabilité | 15 | −50 % |
| 11 | +1 MS et +1 JA | Domination / Mobilité | 13 | −56 % |
| 12 | +100 Mana | Sorcellerie / Manifestation | 13 | −58 % |
| 13 | +1 tour de buff/debuff | Inspiration / Amélioration | 8 | −72 % |
| 13 | **+10 % Crit** | Domination / Burst | **8** | **−73 %** |
| 15 | 1 inspiration par séance | Inspiration / Présage | — | non chiffrable |

**Écart entre la meilleure et la pire mineure chiffrable : ×5.** Un joueur qui grave `−1 CDR` +
`+40 AP` prend **80 unités** ; un joueur qui grave `+10 % Crit` + `+1 tour de buff` en prend **16**.
Les deux ont dépensé le même budget et suivi la même logique thématique.

⚠️ **Trois nuances qui comptent plus que le classement :**

- **`+40 AP` n'est pas fort, il est mal placé.** Il vaut 40 pour un lanceur et **0** pour Rathäel,
  Urskaar ou Smith — c'est la seule mineure de l'arbre qui ne propose pas le choix « AD ou AP »
  alors que toutes ses voisines le font (`+30 AD ou AP`, `+15 AD ou AP`).
- **`−1 CDR` dépend du kit.** 40 unités, c'est « une compétence de plus par combat » ; ça suppose
  d'avoir une compétence à CD 3-5 qu'on relance, et le mana pour. Sur un perso qui tape à
  l'attaque de base, c'est proche de 0.
- **`+10 % Crit` est dernier par construction** : sur le bruiser de référence, 10 % de crit ne
  valent que 8. Sur un assassin niveau 18 (55 % de crit, 230 de dégâts crit) la même rune vaut
  4 à 5 fois plus. C'est la rune la plus dépendante du porteur de tout l'arbre.

---

## 4. Le tableau complet — valeur par point dépensé

`T` = palier (M mineure 1 pt, A avancée 2 pts, F fondamentale 2 pts). Les colonnes donnent la
**valeur par point** : comparer à la cible **30 / 40 / 50**.

| Voie | Rune | T | pts | n2 | n10 | n18 | hypothèse retenue |
|---|---|---|---|---|---|---|---|
| Conq. / Agression | +30 AD ou AP | M | 1 | 30 | 30 | 30 | plat |
| Conq. / Agression | Flux : +2 JA si le coup précédent touche | A | 2 | 10 | 24 | 42 | uptime 75 % (P(toucher) = 15/20) |
| Conq. / Agression | **Frénésie : +45 AD et 10 léthalité/tour (max 4)** | F | 2 | **86** | **112** | **137** | 2,8 charges moyennes sur 5 tours |
| Conq. / Sustain | +50 HP et 10 % Omni | M | 1 | 21 | 25 | 31 | plat |
| Conq. / Sustain | Réfuter la mort : −50 % d'une attaque (CD 5) | A | 2 | 8 | 20 | 37 | 1 usage/combat |
| Conq. / Sustain | Soif de sang : +90 AD si soin au tour précédent | F | 2 | 41 | 41 | 41 | **uptime 90 %** : l'Omni de la mineure soigne à chaque coup |
| Conq. / Ténacité | −1 tour aux CC reçus | M | 1 | 17 | 40 | 69 | 1 CC subi 1 combat sur 2 |
| Conq. / Ténacité | Adrénaline : +60 AD si CC subi | A | 2 | 9 | 9 | 9 | uptime 30 % |
| Conq. / Ténacité | Détermination : enragé 2 tours (CD 5) | F | 2 | — | — | — | ⚠️ « enragé » n'existe pas dans `BUFFS` |
| Domi. / Burst | +10 % Crit | M | 1 | 8 | 20 | 34 | porteur bruiser (voir §3) |
| Domi. / Burst | **Opportunité : +45 AD, +1 JA, +10 % Crit par tour sans attaquer** | A | 2 | 10 | **−1** | **−16** | 1 tour sauté ; ⚠️ **non borné** |
| Domi. / Burst | Explosivité : ×2 les dégâts d'une compétence (CD 5) | F | 2 | 20 | 48 | 83 | 1 usage/combat |
| Domi. / Mobilité | +1 MS et +1 JA | M | 1 | 13 | 32 | 56 | MS non modélisé |
| Domi. / Mobilité | +2 MS et 50 % esquive 2 tours (CD 5) | A | 2 | 17 | 41 | 74 | 2 tours à moitié des dégâts subis |
| Domi. / Mobilité | +30 AD et +5 % Crit par MS bonus | F | 2 | 31 | 36 | 42 | +1 MS de la mineure, +2 pendant l'esquive |
| Domi. / Sadisme | +15 AD ou AP et 10 léthalité | M | 1 | 31 | 50 | 68 | plat + léthalité (qui, elle, scale) |
| Domi. / Sadisme | Écorchage : +30 léthalité sur la cible | A | 2 | 9 | 50 | 93 | ⚠️ **×5 si toute l'équipe en profite** |
| Domi. / Sadisme | Torture : +50 % dégâts si cible ≤50 % PV, +10 % Omni | F | 2 | 23 | 55 | 94 | la moitié des coups tombent sous 50 % |
| Sorc. / Manifestation | +100 Mana | M | 1 | 13 | 13 | 13 | ⚠️ mana **hors barème** (convention, §6) |
| Sorc. / Manifestation | CC de 1 tour sur compétence (+50 mana) | A | 2 | 27 | 75 | **142** | 2 usages/combat, ⚠️ **aucun CD annoncé** |
| Sorc. / Manifestation | Golem (1 fois) | F | 2 | — | — | — | aucune stat chiffrée |
| Sorc. / Harmonie | +40 AP | M | 1 | 40 | 40 | 40 | ⚠️ **AP seul** : 0 pour un build Force |
| Sorc. / Harmonie | Compétence infuse : change l'élément (CD 5) | A | 2 | — | — | — | éléments non modélisés |
| Sorc. / Harmonie | Spécialité élémentaire +1 rang | F | 2 | — | — | — | éléments non modélisés |
| Sorc. / Maîtrise | **−1 CDR (sauf ultime)** | M | 1 | **40** | **96** | **167** | +1 compétence lancée par combat |
| Sorc. / Maîtrise | Aery : +10 % dégâts de compétence | A | 2 | 4 | 10 | 17 | les comps = 50 % des dégâts |
| Sorc. / Maîtrise | Approche versatile : coût −50 % si élément différent | F | 2 | — | — | — | éléments non modélisés |
| Vol. / Durabilité | +10 AR et 10 RM | M | 1 | 15 | 34 | 55 | plat, mais l'armure est un multiplicateur |
| Vol. / Durabilité | Peau épineuse : +30 AR/RM, renvoie 10 % des dégâts subis | A | 2 | 28 | 63 | 105 | renvoi sur les dégâts d'un combat |
| Vol. / Durabilité | **Immortalité : bouclier 50 % PV max, 2 tours (CD 5)** | F | 2 | 41 | **102** | **186** | 1 usage/combat = +50 % d'EHP |
| Vol. / CC | +1 tour de CC infligé | M | 1 | 17 | 41 | 74 | 1 CC infligé 1 combat sur 2 |
| Vol. / CC | Immobilise une cible 1 tour (CD 5) | A | 2 | 17 | 41 | 74 | 1 tour ennemi nié |
| Vol. / CC | Les CC réduisent AR/RM de la cible de 25 % | F | 2 | 2 | 6 | 10 | ~+6 % de dégâts, la moitié du temps |
| Vol. / Sacrifice | +100 HP | M | 1 | 33 | 33 | 33 | plat |
| Vol. / Sacrifice | **Compétence à risque : −10 % PV max/comp, dégâts +20 %** | A | 2 | **−8** | **−21** | **−40** | 2 comps lancées ; ⚠️ **valeur négative** |
| Vol. / Sacrifice | Masochisme : +10 AR/RM et +15 AD par usage | F | 2 | 18 | 29 | 42 | 1,2 charge moyenne |
| Insp. / Amélioration | +1 tour de buff/debuff | M | 1 | 8 | 20 | 35 | 1 buff ±50 % par combat, prolongé 1 fois sur 2 |
| Insp. / Amélioration | Buff aléatoire en début de combat | A | 2 | 8 | 20 | 35 | aléatoire : 50 % de pertinence |
| Insp. / Amélioration | Buffs/maléfices +25 % | F | 2 | 4 | 10 | 17 | +25 % sur un buff de 2 tours |
| Insp. / Partage | +50 HP et 50 Mana | M | 1 | 23 | 23 | 23 | plat |
| Insp. / Partage | Altruisme excessif : transfert 10 % PV/mana | A | 2 | — | — | — | ⚠️ **cellule tronquée** ; transfert à somme nulle |
| Insp. / Partage | Échange : réassigner un buff/debuff (CD 3) | F | 2 | 17 | 40 | 69 | 2 usages |
| Insp. / Présage | 1 inspiration par séance | M | 1 | — | — | — | narratif |
| Insp. / Présage | Brèche stratégique (CD 5) | A | 2 | — | — | — | tactique, non chiffrable |
| Insp. / Présage | Retour temporel : relancer un jet (CD 3) | F | 2 | 21 | 50 | 87 | 2 relances d'échec par combat |

### Voies complètes (5 points, mineure → fondamentale), valeur par point

| | n2 | n10 | n18 |
|---|---|---|---|
| **Volonté / Durabilité** | 31 | **73** | **127** |
| **Conquérant / Agression** | **44** | 60 | 77 |
| Domination / Sadisme | 19 | 52 | 88 |
| Domination / Mobilité | 21 | 37 | 58 |
| Sorcellerie / Manifestation | 13 | 33 | 59 |
| Volonté / CC | 11 | 27 | 49 |
| Conquérant / Sustain | 24 | 29 | 37 |
| Sorcellerie / Maîtrise | 10 | 23 | 40 |
| Domination / Burst | 14 | 23 | 34 |
| Inspiration / Partage | 11 | 21 | 32 |
| Inspiration / Présage | 8 | 20 | 35 |
| Inspiration / Amélioration | 7 | 16 | 28 |
| Conquérant / Ténacité | 7 | 12 | 17 |
| **Volonté / Sacrifice** | 10 | 10 | **7** |
| **Sorcellerie / Harmonie** | 8 | 8 | **8** |

**Écart entre la meilleure et la pire voie : ×6 au niveau 2, ×18 au niveau 18.**

---

## 5. Les six défauts structurels

### 5.1 — Les valeurs plates ne suivent pas le personnage ⚠️ **le défaut principal**

**7 runes valent exactement la même chose au niveau 2 et au niveau 18** — `+30 AD ou AP`,
`Soif de sang` (+90 AD), `Adrénaline` (+60 AD), `+40 AP`, `+100 HP`, `+50 HP et 50 Mana`,
`+100 Mana` — et **4 de plus ne montent que de ×1,4 à ×1,6** (`Frénésie`, `+50 HP et 10 % Omni`,
`+30 AD par MS`, `Opportunité`). Pendant ce temps le bruiser passe de 165 à **694 AD** (×4,2) et la
cible d'un point de rune de 30 à 50.

Ce n'est pas « toutes les runes plates » : un `+10 AR/RM` plat monte quand même de 15 à 55, parce
que l'armure est un **multiplicateur** de PV — c'est la conclusion du barème. **Le gel touche
précisément les bonus plats d'AD, d'AP, de PV et de Mana**, c'est-à-dire l'essentiel du socle de
l'arbre.

C'est le même phénomène que le barème documente pour l'équipement (« seuls les PV ont une valeur
stable »), et que la spec §7.1 règle avec des **paliers d'armes** ×1 / ×2 / ×4,7. **L'arbre de runes
n'a aucun équivalent** : il n'y a pas de palier, la rune gravée au niveau 2 est celle du niveau 18.

Conséquence chiffrée : `+30 AD ou AP` vaut **100 % de l'étalon au niveau 2** et **60 % au niveau 18**.
`Soif de sang` (+90 AD, fondamentale à 2 points) passe de 136 % à 82 %. Pendant ce temps les runes
exprimées **en pourcentage, en tours ou en léthalité** montent mécaniquement : `Frénésie` ×1,6,
`Immortalité` ×4,5, `CC de 1 tour` ×5,3.

⚠️ **Toute correction qui rehausse les valeurs plates sans les faire scaler ne fait que déplacer le
problème d'un niveau à l'autre.**

### 5.2 — Deux fondamentales cassent l'échelle

- **Frénésie** (Conquérant/Agression) : `+45 AD ou AP et 10 léthalité par tour, max 4`. Au 4e tour
  c'est **+180 AD et +40 de léthalité**, soit plus que l'intégralité de l'AD d'un bruiser niveau 2.
  Moyennée sur 5 tours : **86 à 137 unités par point**, 3 à 4 fois l'étalon. C'est la rune la plus
  forte de l'arbre à bas niveau.
- **Immortalité éphémère** (Volonté/Durabilité) : `bouclier = 50 % des PV max, CD 5`. Sur un combat
  de 5 tours c'est **+50 % d'EHP une fois par combat**, soit **102 à 186 par point**. Et elle est
  au bout de la voie qui contient déjà `Peau épineuse` (+30 AR/RM) : **la voie Durabilité est la
  meilleure de l'arbre à tous les niveaux à partir du 10**.

### 5.3 — Une rune à valeur négative

**Compétence à risque** (Volonté/Sacrifice, avancée, 2 points) : `coûte 10 % des PV max par
compétence, dégâts +20 %`. Deux compétences dans un combat = **20 % des PV max dépensés** pour
**+20 % sur la moitié des dégâts**, soit +10 % au total. Au niveau 10 : on paie 248 PV (82 unités)
pour gagner 40 unités. **Bilan −21 par point, et ça empire avec le niveau.**

Même en lisant « +20 % de dégâts » comme s'appliquant à **toute** la production (pas seulement aux
compétences), le bilan reste nul. Et la voie Sacrifice est la seule de l'arbre dont la valeur
**baisse** avec le niveau (10 → 7 par point) : sa fondamentale, `Masochisme`, ne compense pas
l'avancée qu'elle exige.

⚠️ C'est un défaut **de conception, pas d'équilibrage** : la rune demande de payer une ressource
qui vaut 0,33 pour acheter des dégâts qui valent 1, à un taux de change perdant.

### 5.4 — Une rune non bornée

**Opportunité** (Domination/Burst) : `+45 AD ou AP, +1 JA et +10 % Crit **par tour sans attaquer
(infini)**`. Aucun plafond, aucune condition de remise à zéro écrite.

En combat c'est une mauvaise affaire (un tour vaut `AD/5`, soit 80 unités au niveau 10, pour 45 AD
gagnés : **valeur négative à partir du niveau 10**). Mais **« par tour sans attaquer » ne dit pas
« en combat »** : rien n'empêche un joueur de réclamer des charges accumulées hors combat, ou
gagnées pendant qu'il courait. Il faut soit **borner** (max 3-4, comme Frénésie), soit écrire
**« par tour de combat passé sans attaquer, remis à zéro à la fin du combat »**.

### 5.5 — Les conditions dopent ce qui est déjà bon

Trois voies s'auto-alimentent, ce que le chiffrage ne rend visible qu'en enchaînant les nœuds :

- **Conquérant/Sustain** : la mineure donne **10 % d'Omnivamp**, donc le porteur se soigne à chaque
  coup, donc la condition de `Soif de sang` (« si soin au tour précédent ») est remplie **quasiment
  tous les tours**. Ce qui se lit comme une condition tactique est en réalité un bonus permanent.
- **Domination/Mobilité** : la fondamentale donne `+30 AD et +5 % Crit **par MS bonus**`, et
  l'avancée de la même voie donne `+2 MS`. La voie se paie elle-même.
- **Domination/Sadisme** : `Écorchage` (+30 léthalité **sur la cible**) profite à **toute l'équipe**
  qui tape cette cible. Valeur individuelle 50/pt au niveau 10 ; valeur pour le groupe, jusqu'à ×5.
  C'est la rune la plus sous-estimée de l'arbre si on la lit ligne par ligne.

À l'opposé, **Ténacité** (`Adrénaline : +60 AD si CC subi`) et **Burst** dépendent de conditions que
le porteur **ne contrôle pas** (être CC, avoir tué). Elles sont dernières à tous les niveaux.

### 5.6 — L'arbre pèse plus lourd que la fiche de personnage

En dépensant le budget de façon optimale (programmation dynamique sur les 15 voies, ordre strict
respecté) :

| niveau | budget | meilleur build | pire build | écart | valeur du personnage | **part des runes** |
|---|---|---|---|---|---|---|
| 2 | 2 pts | 80 | 16 | ×4,9 | 387 | **21 %** |
| 5 | 5 pts | 243 | 32 | ×7,5 | — | — |
| 10 | 10 pts | 673 | 79 | ×8,5 | 991 | **68 %** |
| 18 | 18 pts | 1835 | 278 | ×6,6 | 1837 | **100 %** |

**Au niveau 18, un arbre de runes optimisé vaut autant que tout le reste du personnage réuni**
(caracs, PV, armure). Et deux joueurs de même niveau peuvent différer d'un facteur 6 à 8 sur ce
seul poste. C'est la conséquence cumulée de 5.1 (le socle plat décroche) et 5.2 (les sommets
scalent sans plafond).

---

## 6. Ce qui n'est pas chiffrable en l'état — 8 nœuds

| nœud | pourquoi |
|---|---|
| Détermination (enragé 2 tours) | **« enragé » n'existe dans aucune source** : ni `BUFFS` (16 entrées), ni les règles. Effet inconnu. |
| Golem | aucune stat donnée (« HP/résistance/attaque selon l'élément ») |
| Compétence infuse · Spécialité élémentaire · Approche versatile | **le système d'éléments n'existe pas dans l'app** — 3 des 9 nœuds de Sorcellerie, soit une voie entière (Harmonie) réduite à sa mineure |
| Altruisme excessif | **cellule tronquée dans l'Excel** (déjà signalée dans CLAUDE.md) ; un transfert de PV entre alliés est à somme nulle sauf arbitrage |
| 1 inspiration par séance · Brèche stratégique | narratif / tactique, hors combat |

À quoi s'ajoute une valeur chiffrée **partiellement** : partout où apparaît la **vitesse de
déplacement** (`+1 MS` de la mineure Mobilité, `+2 MS` de son avancée, le capstone `+2 MS par kill`),
seul le reste du nœud est compté — **le MS n'est modélisé nulle part**, ni dans l'app ni dans le
barème. La voie Mobilité est donc sous-évaluée d'un montant inconnu.

**Trois conventions ont dû être posées pour aller au bout** — à valider ou à rejeter :

1. **Le mana**, sorti du barème par décision MJ du 2026-09-09 (« situationnel »), est ici tarifé à
   **0,125 AD par point** (taux de LoL : 1 PV = 2,67 mana). Sans convention, `+100 Mana` vaut 0 et la
   voie Manifestation n'est pas comparable. ⚠️ **À ce taux, `+100 Mana` est l'avant-dernière mineure
   de l'arbre.**
2. **La léthalité**, jamais tarifée (le barème le note explicitement), est chiffrée contre un
   ennemi ayant l'armure moyenne d'un PJ du même niveau (11 / 25 / 41). Contre un boss à 200
   d'armure elle vaut **le double**.
3. **Un CC d'un tour** vaut « un tour ennemi nié », estimé par les dégâts que ce tour aurait
   infligés au porteur. C'est l'estimation la plus fragile du document.

### Les capstones ne sont pas dans le chiffrage

Les 15 **bonus de thématique** (`capstone`, affichés sur la fondamentale de chaque voie) sont
**exclus** de tous les chiffres ci-dessus, parce que leur règle de déclenchement n'est pas tranchée
(CLAUDE.md : « **à confirmer MJ** : capstone vs thématique −2 CD »). Ils ne sont pas anecdotiques :

- `+25 % PV max` (Volonté/Durabilité) ≈ **102 unités** au niveau 10 — plus qu'une voie entière de
  5 points pour la moitié de l'arbre ;
- `40 % Omni` (Conquérant/Sustain) ≈ **36 unités** au niveau 10 ;
- `−2 CDR sauf ultime` (Conquérant/Agression) ≈ **2 compétences de plus par combat**, ~190 unités ;
- `+10 AR/RM et +50 PV **par cible affectée**` (Volonté/CC) : **non borné**, comme Opportunité ;
- `Bonus de stats liés à l'élément` (Sorcellerie/Harmonie) : **aucune valeur écrite nulle part**.

⚠️ **Tant que la règle des capstones n'est pas fixée, aucun rééquilibrage de l'arbre ne tient** :
ils ajoutent entre 0 et 190 unités à une voie, soit plus que la voie elle-même.

---

## 7. Leviers possibles — à trancher par le MJ

Aucun n'est appliqué. Ils sont classés du plus ciblé au plus structurel.

**A — Les trois corrections évidentes** (aucune décision de game design, ce sont des défauts) :
1. `Opportunité` : borner les charges (max 3) et écrire « par tour **de combat**, remis à zéro en
   fin de combat ».
2. `Compétence à risque` : le coût en PV doit être inférieur au gain. Soit +50 % de dégâts pour
   10 % des PV, soit 5 % des PV pour +20 %.
3. `+40 AP` → **`+40 AD ou AP`**, pour aligner Harmonie sur ses deux voisines qui offrent déjà le
   choix (`adp` + `ADP_KEYS` existent déjà dans le moteur, c'est une ligne de `data.jsx`).

**B — Rattraper le socle plat (défaut 5.1).** Deux formes, exclusives :
- **par niveau** : la rune donne `+15 AD + 1,5/niveau` — suit le personnage, mais alourdit
  `sumRuneMods` (aujourd'hui une simple addition de constantes) ;
- **en pourcentage** : `+8 % d'AD` au lieu de `+30 AD` — scale tout seul, se lit bien, mais
  récompense le build déjà spécialisé.

⚠️ **C'est exactement la question laissée ouverte pour les compétences** (« scaling numérique par
niveau **ou** upgrades au choix du joueur » — backlog). Trancher une fois pour les deux chantiers.

**C — Plafonner les sommets (défaut 5.2).** `Frénésie` max 4 → max 2, ou +25 par charge.
`Immortalité` : bouclier 25 % des PV max au lieu de 50 %. Les deux restent les meilleures de leur
voie, sans être 3× l'étalon.

**D — Écrire les 10 nœuds manquants.** Sans le système d'éléments, la voie Harmonie n'existe qu'à
un tiers ; sans définition d'« enragé », Ténacité n'a pas de fondamentale. C'est le seul levier qui
ne demande pas d'arbitrage numérique, seulement du contenu (`info-mj/Système de Runes.md` — ⚠️
**manquant sur la machine du MJ**, à rapatrier avant d'ouvrir ce chantier).

**E — Revoir le coût des paliers.** `RUNE_COST = { mineure:1, avancée:2, fondamentale:2 }` : une
fondamentale coûte autant qu'une avancée alors qu'elle vaut 2 à 5 fois plus, et qu'elle est déjà
protégée par ses prérequis. Passer la fondamentale à **3 points** (voie complète = 6 points au lieu
de 5) resserre mécaniquement l'écart entre voies, sans toucher à une seule valeur de `data.jsx`.
C'est **le changement le moins cher du document** : une constante dans `game-logic.js`, et la
légende de la page Runes la lit déjà (jamais de coût en dur).

---

## 8. Réserves — ce que ce document NE dit pas

1. **Il mesure la puissance, pas le plaisir de jeu.** Une rune à 8 unités qui crée une scène
   mémorable une fois par séance (`1 inspiration`, `Brèche stratégique`) n'est pas un défaut.
2. **Le porteur de référence est un bruiser.** Les runes de crit sont sous-évaluées de 2 à 5×
   pour un assassin ; les runes de PV surévaluées pour un tank.
3. **Les hypothèses de combat (5 tours, 2 compétences, 1 coup subi par tour) n'ont jamais été
   mesurées à une vraie table.** Elles viennent du calibrage de septembre, qui raisonne en duel.
   Un combat de 8 tours ferait monter toutes les runes à charges (`Frénésie`, `Masochisme`) et
   baisser toutes les runes à CD (`Immortalité`, `Explosivité`).
4. **Les capstones sont hors chiffrage** (§6) et peuvent tout renverser.
5. **Aucune interaction avec l'équipement** n'est prise en compte : une rune `+10 % Crit` vaut
   davantage sur un personnage déjà équipé en crit.

---

*Scripts de calcul : non conservés (jetables, scratchpad). Tout est reproductible depuis
`computeStats` + le barème de `docs/bareme-stats.md` avec les conventions du §1.*
