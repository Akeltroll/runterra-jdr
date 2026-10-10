# Compétences des PJ — état des lieux avant rééquilibrage

> ⚠️ **Ce document est un JOURNAL chronologique (2026-10-05 → 2026-10-10), pas une référence.**
> Les valeurs à coder, dans leur état final, sont dans
> **`docs/superpowers/plans/2026-10-10-competences-patchs-a-appliquer.md`** — c'est lui qui fait foi.
> Ce qui est **périmé** ici :
> - **§2** : le diagnostic « 3 PJ sur 5 n'ont aucune raison de lancer une compétence » et le budget par
>   archétype supposaient **une action par tour**. Or les compétences s'ajoutent à l'attaque de base (§8.11).
> - **§3.4 à §3.6, §4.4** : ratios d'avant la conversion ×0,6 (§8.13).
> - **§5 et §8.8** : simulations à une action par tour, sur une matrice périmée (§8.7, §8.11, §8.13).
> - **§7.2** : priorités closes, remplacées par les lots du plan.
>
> Restent valables : les règles de progression (§3.2), les paliers du §4.2 comme vocabulaire, les durées
> visées (§5.5), l'attaque de base à ×0,6 (§6.5) et tout le §8 (décisions finales, avec leur pourquoi).

Rédigé le 2026-10-05 pour ouvrir le chantier « rééquilibrage des compétences ».
Sources : `SKILLS` (`data.jsx`), formules de `game-logic.js`, `docs/backlog.md` et §10 de
`docs/superpowers/specs/2026-09-05-calibrage-attaques-base-design.md`.

**Déblocage** : la compétence active n° *i* (en partant de 0) demande le niveau *i*+1. Tout le
monde est niveau 2 : **seuls le passif, C1 et C2 sont jouables aujourd'hui**. C3, C4 et l'ultime de
Rathäel restent verrouillés tant que le MJ ne monte pas le niveau.

---

## 1. Les compétences actuelles

### Rathäel — *Le Serment Brisé*, chevalier déchu (JB)
**Thème : plus on le frappe, plus il gèle et s'endurcit.**

| | Compétence | Coût / CD | Effet |
|---|---|---|---|
| Passif | Chair gelée, âme fendue | — | +1 charge de Glaciation par attaque subie (max 5) ; −3 charges s'il passe un tour sans dégâts (automatisé). +10 % Armure et Rés. magique de base par charge. À 5 charges, **Âme fendue** : régén 10 % PV max/tour, aura de soin, il devient sourd (géré en table). |
| C1 | Frappe Irritée | 20 mana, sans CD | `25 + (30 % +5 %/4 niv) AD + (40 % +5 %/2 niv) (Armure+RM)`, ×(1 + 20 % par charge). En Âme fendue : cible ralentie. |
| C2 | Mur de Givre | 50 mana, CD 3 | Inamovible 1 à 2 tours, +`15 +5/2 niv` Armure et RM, provoque un ennemi adjacent, +1 charge. |
| C3 | Éclat de l'âme | 60 mana, CD 3 | Explosion de rayon 3 qui **consomme les charges**. Base `50 + 60 % AP + (50 % +10 %/2 niv)(AR+RM)`, puis +50 % par charge (×3,5 à 5 charges). En Âme fendue : étourdit. |
| C4 | Ailes de Givre | 100 mana, 1×/combat | Transformation 3 tours : lévitation et brume noire qui débuffe toutes les unités, alliés compris (−50 % Armure et −50 % AP, ou −50 % RM et −50 % AD). |
| Ultime | Souverain Glacial | 100 mana, 1×/combat | Version améliorée de C4 sur 4 tours : +20 % PV de base par charge, 2 charges par coup subi, dégâts bruts de zone qui le soignent. |

### Urskaar — *Le Poing de Fer*, pugiliste (Baptiste)
**Thème : l'ours qui charge, le déplacement nourrit les coups.**

| | Compétence | Coût / CD | Effet |
|---|---|---|---|
| Passif | Voie de l'ours | — | +2 initiative. Après 5 cases parcourues : prochaine attaque de base +150 %, puis +25 % toutes les 3 cases, et +1 PM (max 3). Ces « tranches » renforcent aussi C2 et C4. |
| C1 | Maîtrise du pugilat | 30 mana, CD 1 | **Gauche** : attaque de base sans attaque d'opportunité. **Droite** : attaque de base à 150 % minimum, 50 % de chances d'étourdir. |
| C2 | Écrasement | 50 mana, CD 3 | Bond de portée 3 + tranches, zone adjacente, `AD × (1,5 + 0,25 × tranches)`. |
| C3 | Ralliement | 100 mana, CD 5 | Bouclier de `(30 % +10 %/50 AP)` de ses PV, Peau de Fer pour lui, Bravoure pour les alliés 2 tours. +1 charisme permanent. |
| C4 | On ne m'arrêtera pas | 100 mana, 1×/combat | Transformation 5 tours : +30 % PV, AD et Armure. Chaque unité traversée subit `100 % AD (+25 %/tranche)`. |

### Smith — *La Lame Silencieuse*, duelliste (Erwan)
**Thème : l'assassin de l'ombre.**

| | Compétence | Coût / CD | Effet |
|---|---|---|---|
| Passif | Flétrissement de la rose | — | 1×/combat : `50 + 0,5 AP` de dégâts magiques et une marque (max 9). La marque se propage à la mort de la cible. |
| C1 | Attaque sournoise | 30 mana, CD 1 | Dégâts d'arme ; ×1,5 et +30 % de crit s'il est camouflé. |
| C2 | Fondu au noir | 40 mana, CD 3 | Camouflage 3 tours, +3 mobilité 2 tours. Remplaçable par un fumigène 5×5. |
| C3 | Chaînes estropiantes | 60 mana, CD 4 | Cône de 8 cases, `50 + 100 % AD` et saignement. Exécute sous 10 % PV. |
| C4 | Voile dimensionnel | 80 mana, 1×/combat | Enferme une cible dans une dimension (50 % d'immunité). Si elle y meurt : soin d'une part de ses PV/mana et bonus de crit. |

### Elias Crowe (id `lunick`) — *Capitaine corsaire*, navigateur arcanique (Fab)
**Thème : le chasseur qui marque ses proies.**

| | Compétence | Coût / CD | Effet |
|---|---|---|---|
| Passif | Instinct du Chasseur | — | +1 charge par nouvelle cible blessée ; chaque charge donne `10 + 5 × (niv−1)` AD. Max `5 + ⌊(niv−1)/3⌋` charges, remise à zéro entre les combats. |
| C1 | Tir Ciblé | 10 mana, CD 1 | Arme à distance. 1er coup : +25 % et +2 au jet. Soin de 5 % des dégâts, pas de crit. |
| C2 | Dash Tactique | 30 mana, CD 3 | Déplacement de rayon 6. S'il finit au corps à corps : `50 + 100 % AD` et −1 CD. |
| C3 | Frappe Duale | 30 mana, CD 3 | `100 + 150 % AD`. À distance : repousse de 4 cases. En mêlée : marque la cible (+25 % dégâts subis). |
| C4 | Salve du Corsaire | 60 mana, 1×/combat | `50 + 200 % AD` par cible, soin de 5 % du total, pas de crit. |

### Jett — *La Flèche Hextech*, artificier (Steph)
**Thème : l'atelier hextech sur le champ de bataille.**

| | Compétence | Coût / CD | Effet |
|---|---|---|---|
| Passif | Nano-hextech | — | En mode cellules, l'attaque de base ne fait aucun dégât et crée des cellules nano (1 + paliers d'AD, ×2 sur un crit). Récupérer une cellule rend 10 mana. Le mode arc court frappe normalement (depuis le 2026-09-15). |
| C1 | Remodulation expérimentale | 50 mana, CD 1 | Configuration tirée au hasard : Poison `25 + 0,5 AP`, Répulsion/Attraction `25 + 0,5 AD`, ou effet utilitaire (champ électrique, flash, duplication, fumigène). |
| C2 | Alignement de séquence | 40 mana, CD 3 | Étourdit 2 tours et inflige `50 + 50 % AD` aux ennemis ; soigne les alliés de `50 + 100 % AP` (soin fonctionnel depuis le 2026-09-06). |
| C3 / C4 | — | — | **Inexistantes** : kits jamais reçus. |

---

## 2. Ce qui a déjà été discuté pour la suite

### Constat mesuré
Rotation optimale sur 4 tours, niveau 18, en multiples de l'attaque de base (1,00 = ne fait pas
mieux que taper gratuitement) :

| Perso | Rotation optimale | Rendement moyen | Mana restant |
|---|---|---|---|
| Urskaar | C1 ×4 | ×1,50 | 666 / 786 |
| Elias | C4 > C3 > C2 > AA | ×1,47 | 490 / 610 |
| Rathäel | C3 > C1 > C1 > C3 | ×1,21 | 573 / 733 |
| Smith | C3 > AA > AA > AA | **×1,04** | 561 / 621 |
| Jett | AA ×4 | **×1,00** | 782 / 782 |

**3 PJ sur 5 n'ont aucune raison de lancer une compétence**, et il leur reste 90 à 100 % de leur
mana en fin de combat.

### Budget cible par archétype
La moyenne est proche pour tous, c'est la **forme** qui distingue les archétypes.

| Archétype | Tour normal | Pic | Moyenne / 4 tours |
|---|---|---|---|
| AD carry (Elias) | 1,4 | 1,8 | ~1,5 |
| Assassin (Smith) | 0,7 | **4,0** (1 tour sur 4) | ~1,5 |
| Bruiser (Urskaar) | 1,3 | 2,2 | ~1,5 |
| Tank (Rathäel) | 0,8 | 1,6 | ~1,0 |
| Utilitaire (Jett) | 1,0 | 2,5 | ~1,2 |

### Défauts identifiés, personnage par personnage
- **Jett** : ses compétences scalent sur l'**AD** alors que c'est un build AP. Même avec toute son
  Habileté en AD, elles plafonnent à 0,37× son attaque de base. C3 et C4 sont à créer.
- **Rathäel** : sa C1 ne fait que **0,57×** une attaque de base gratuite. Son passif est très faible
  à bas niveau (+7 points au total à 5 charges au niveau 2). L'incohérence +5 % / +10 % par charge
  est en partie résolue : le code **et** la note en jeu disent **+10 %**, seul le backlog dit encore
  +5 %. Reste à confirmer que +10 % est voulu.
- **Smith** : **aucun burst**, pour un assassin. L'enchaînement idéal (Fondu au noir puis 3 Attaques
  sournoises furtives) plafonne à ×1,12. Son passif `50 + 0,5 AP` ne colle à aucune de ses stats.
- **Elias** : passif **surpuissant**, jusqu'à **+950 AD au niveau 18** pour un AD de base de 504.
- **Urskaar** : seul kit sain. Ses formules sont des multiples purs de l'AD, donc son ratio reste
  stable à 1,50 du niveau 2 au niveau 18.

### Problèmes transversaux
- **Les bonus fixes (`50 +`, `100 +`, `25 +`) sont la cause n°1 du décrochage**, avant l'absence de
  scaling : ils dominent à bas niveau et ne pèsent plus rien à haut niveau. Les traiter **avant**
  d'ajouter du scaling.
- **Le mana ne limite rien** (Jett : 782 de mana pour des sorts à 40-50). Décision MJ : « le mana
  doit être un minimum limitant ». À remonter une fois les kits réparés. Levier prêt : `manaPer`
  (coût par cible, à 0 partout) pour taxer les compétences de zone sans toucher aux mono-cibles.
- **Les mécaniques ont changé depuis le diagnostic** (actions en attente, 2026-09-06) : une
  compétence peut viser plusieurs cibles et mêler dégâts et soins. Les compétences de zone
  (Écrasement, Chaînes, Éclat de l'âme, Salve) sont à rechiffrer **selon le nombre de cibles**. Le
  ratio de Jett est sous-évalué (son soin n'était pas compté). Depuis le 2026-10-05, la stat `soins`
  (% Soins/Bouclier) s'applique aussi aux soins de compétence.

### ✅ Question tranchée le 2026-10-06 : les améliorations d'abord (voir §3)
*Texte d'origine, conservé :* **Faire monter les chiffres avec le niveau, OU proposer des
améliorations de compétences au choix du joueur à chaque montée de niveau** — l'un ou l'autre, pas
les deux.
- **Recommandation formulée : les améliorations au choix.** Les stats font déjà monter les chiffres
  (cf. Urskaar), et une montée de niveau n'offre aujourd'hui aucun choix au joueur.
- **À mettre en balance :** pour les runes, le MJ a choisi le scaling par niveau le 2026-10-03, et le
  backlog note que les deux sujets « devraient recevoir la même réponse ».
- **Ouvert ensuite :** le format des améliorations (2-3 options prédéfinies par compétence, ou pool
  de points libre).

### Autres points en attente
- Automatiser l'état Âme fendue de Rathäel (aujourd'hui géré à la main).
- Appliquer automatiquement les dégâts aux ennemis (le MJ passe encore par « Subir »).

### ⚠️ Prérequis manquant
`info-mj/Compétences-Races PJ (mis à jour)` (kits complets + traits de race) n'est pas sur la machine
du MJ. Le chercher **en `.docx`** dans `~/Downloads` ou `~/OneDrive/Documents/Claude`, ou le
demander à JB, avant de réécrire les kits.

---

## 3. Décisions du MJ du 2026-10-06

### 3.1 Les améliorations de compétence passent avant le scaling
**Décision : on progresse par améliorations (« upgrades ») de compétence, pas par scaling
systématique.** Le scaling par niveau n'est pas interdit sur une compétence donnée, mais on pense
d'abord à l'amélioration et on la privilégie. (Le « l'un ou l'autre, pas les deux » d'origine est
donc assoupli : l'amélioration est la règle, le scaling une exception à justifier.)

### 3.2 Règles de progression

| Niveau du perso | Ce qui se passe |
|---|---|
| 1, 2, 3 | Apprentissage **imposé et dans l'ordre** de C1, C2, C3, toutes au **rang 1**. Aucune amélioration. |
| 4 → 18 | **1 point d'amélioration par niveau**, **attribué automatiquement**. Le joueur le dépense seul, **sans validation du MJ**. |
| 4 et plus | **Apprendre C4 coûte le point** du niveau où on la prend. Ce n'est **pas obligatoire** avant le niveau 6. |
| 6 | Une C4 déjà apprise devient **automatiquement l'ultime**, gratuitement : le point du niveau 6 reste à dépenser. **Une C4 apprise au niveau 6 ou après arrive directement en ultime** (et coûte toujours le point). |
| 11 et 16 | L'ultime peut être améliorée une fois à partir du 11, et une fois de plus à partir du 16. **Cette fois, ça coûte le point.** |

- **Rang maximum** : 5 pour C1 à C3. L'ultime a 3 rangs (4 en comptant C4 elle-même).
- **Plafond par niveau** : le rang d'une compétence ne peut pas dépasser **⌊niveau du perso / 2⌋**,
  arrondi à l'entier **inférieur** (LoL arrondit au supérieur). Exemple : au niveau 9, rang 4 au
  maximum (9/2 = 4,5 → 4). Le plafond vaut 2 aux niveaux 4-5, 3 aux 6-7, 4 aux 8-9 et 5 à partir du 10.
- **Le MJ peut remettre à zéro les points attribués** d'un perso (les points reviennent à répartir).
- **Les ultimes sont utilisables une fois par JOUR** (et non plus une fois par combat).

**Vérification du budget, tout tombe juste :** les niveaux 4 à 18 donnent **15 points**. Il faut
1 point pour apprendre C4, 2 pour les rangs de l'ultime aux niveaux 11 et 16, et 4 × 3 = 12 pour
monter C1 à C3 du rang 1 au rang 5. Total : **15**. Un perso qui dépense tout termine le niveau 18
avec un kit entièrement au maximum : l'ordre change d'un joueur à l'autre, le point d'arrivée non.
Le plafond par niveau empêche de monter une seule compétence au rang 5 avant le niveau 10, ce qui
oblige à étaler les points.

**Impact sur le code (à faire, rien n'est livré)** :
- `skillUnlocked(index, level)` (« active n° i → niveau i+1 ») suffit encore pour C1 à C3, mais pas
  pour C4. Celle-ci devient un **choix enregistré**, plus une simple condition de niveau.
- Nouveau champ d'état, par exemple `skillRanks {skillId: rang}` (absent = rang 1 si la compétence
  est débloquée). Les points disponibles se **déduisent** du niveau et des rangs, sans compteur à
  tenir. Le joueur écrit ses rangs, et le MJ a un bouton « Remettre les points à zéro » (efface
  `skillRanks`). Règle RTDB à prévoir : le joueur doit pouvoir écrire ce nœud sur sa fiche.
- L'ultime de Rathäel (Souverain Glacial, aujourd'hui 5e active séparée) suit déjà ce schéma : c'est
  la C4 Ailes de Givre « montée » au niveau 6. Parmi les autres persos, seul Jett a désormais une
  version ultime de sa C4 (§3.6).
- Le `kind: 'combat'` (1×/combat) des C4 devient « 1×/jour » pour les ultimes : il faudra un
  rechargement remis à zéro par le MJ, et pas par « ⟲ Combat ».
- Tout le monde est niveau 2 : **rien ne change en jeu tant que personne n'atteint le niveau 4.**

### 3.3 Principe pour le rang 1 des compétences
On reprend d'abord le **rang 1** de chaque compétence pour lui donner un thème net. **Un kit ne doit
pas couvrir tous les besoins du perso à lui seul** : il doit dépendre de l'équipe.

### 3.4 Rathäel
- **Thème : ses compétences de base tournent autour de l'Armure et de la RM**, et on garde ce thème
  au minimum : **Mur de Givre et Éclat de l'âme restent tels quels** (ils scalent sur AR+RM).
- **Frappe Irritée** : elle **ne scale plus sur ses résistances** (le terme `(40 % +5 %/2 niv)(Armure+RM)`
  de `dmgRathaelC1` est retiré). Elle monte **en continu** avec les PV manquants, et le bonus de
  Glaciation est **conservé**. Les deux pourcentages **s'additionnent** :
  `dégâts = base × (1 + 0,01 × %PV manquants + 0,20 × charges de Glaciation)`.
  - **`k = 0,01`** : +1 % de dégâts par point de % de PV manquant. Le MJ vise environ **×3** au
    maximum : 5 charges (+100 %) plus 100 % de PV manquants (+100 %).
  - ⚠️ Ce ×3 n'est atteint **qu'à 0 PV**, c'est-à-dire jamais, puisque Rathäel serait KO. En
    pratique, à 5 charges : **×2,5 à 50 % de PV, ×2,75 à 25 %, ×2,9 à 10 %**. Le crit se multiplie
    par-dessus.
  - Tension assumée par le MJ : la régénération d'Âme fendue fait baisser les dégâts.
  - Restent à poser : la **base** et le **ratio d'AD**, maintenant que le terme AR+RM est retiré.
- **Âme fendue** : Rathäel se soigne beaucoup, et son aura **inflige des dégâts** au lieu de soigner :
  **8 % des PV max de chaque cible dans un rayon de 1, en dégâts magiques, ennemis ET alliés
  compris.** C'est fort contre les gros monstres : les boss auront des effets prévus pour ça.

### 3.5 Smith
- **Flétrissement de la rose** reste **magique, avec ses dégâts actuels** (`50 + 0,5 AP`). Le défaut
  « ne colle à aucune de ses stats » (§2) est **clos** : **c'est la marque qui fait la force de Smith**.
- **Règles de la marque** (rappel + nouveautés) :
  - Flétrissement s'active **une fois** par combat.
  - **Smith peut reprendre sa marque** si elle est mal placée, mais **pas avant 2 tours** après
    l'avoir posée. S'il la reprend, il ne peut la **reposer qu'au tour suivant**.
  - Quand **Smith tue** une cible marquée, la marque passe sur **deux nouvelles cibles**.
  - Quand une cible marquée **tombe inconsciente ou meurt** d'une autre façon, elle **propage** sa
    marque à une cible proche.
  - Smith ne choisit la cible qu'en cas d'**ambiguïté**. Sinon, c'est **la plus proche** qui la prend.
- **Attaque sournoise** : un **multiplicateur de ses propres dégâts d'arme**, et non un pourcentage
  des PV de la cible, qui deviendrait énorme sur les boss :

  | Situation | Multiplicateur |
  |---|---|
  | Normale | ×1 |
  | Sous camouflage | ×1,5 (et +30 % de crit, comme aujourd'hui) |
  | Cible marquée | ×2 |
  | **Cible marquée ET sous camouflage** | **×3,5** (et +30 % de crit) |

  C'est **la plus grosse source de dégâts de Smith**, et elle colle au pic d'assassin du §2
  (4,0× une attaque de base). Elle **ne consomme pas** la marque. **Attaquer fait perdre le
  camouflage** : il n'y a donc qu'un pic par Fondu au noir (CD 3), soit environ un tour sur quatre.

### 3.6 Jett : un kit à double ratio
**Principe : l'AD sert aux dégâts de la plupart de ses compétences, l'AP sert au soutien de
l'équipe.**

**C1 — Remodulation expérimentale** : elle reste **aléatoire**, et Jett ne choisit pas la
configuration. On ajoute au tirage des **effets de soutien** sur l'AP : **bouclier**, **soin** et
**don de mana**.

**C3 — Surcharge destructrice** (CD 3)
- Coût : **20 mana + 5 mana par cellule nano (CN)**.
- **Consomme les CN.** Les ennemis **adjacents à au moins une CN** subissent des dégâts et
  **Hémorragie pendant 2 tours**. Ce débuff existe déjà dans `BUFFS` et agit sur les soins depuis le
  2026-10-05.
- Les **alliés adjacents** à au moins une CN **récupèrent du mana**.
- **Une cible n'est comptée qu'une fois**, quel que soit le nombre de CN autour d'elle (dégâts comme
  mana).
- **Dégâts** : **`100 + 10 × niveau + 100 % AD`**.
- **Mana rendu** : **`20 % du mana max de l'allié ciblé + 25 % AP`**.

**C4 — Nano-hex** (coût en mana fixe)
- Jett assemble un compagnon en **consommant toutes les CN** présentes sur le terrain.
- **Durée** : le combat, ou 10 minutes en temps réel. **Une fois par jour**, ultime ou non (la C4
  des niveaux 4-5 aussi).
- **Initiative** : il joue **au créneau de Jett**, toujours avec lui. Jett décide comment coordonner
  leurs actions et dans quel ordre.
- **Actions** : 1 attaque par tour (sur l'AD) et un rayon tous les 3 tours (sur l'AP). **Portée 2,
  5 cases de déplacement.**
- **Stats de base** : on prend **les points de caracs seuls** d'un perso du même niveau qui a
  **Mental ET Magie au plafond par carac** de `LEVELS` (7 et 7 au niveau 4). Ça dépasse le budget
  d'un PJ, et c'est voulu. On les compte au **tarif nominal** : **45 PV** par point de Mental,
  **15 AP** et **1 RM** par point de Magie. On ne compte **ni le socle** de PV et d'AR/RM d'un perso,
  **ni l'escalade**, **ni les bonus de spécialisation** (lecture « B » retenue le 2026-10-06).
  - **PV, AP** : **×0,90**.
  - **RM** : **pas de ×0,90, et valeur DOUBLÉE**, soit 2 par point de Magie (décision MJ du 2026-10-06).
  - **Crit et dégâts crit** : la valeur de base d'un perso, soit 5 % et 150 %.
  - **AD = AP** et **Armure = RM** : on recopie les valeurs magiques. Le mana est ignoré.
  - Formules : `PV = 40,5 × Mental`, `AP = AD = 13,5 × Magie`, `RM = Armure = 2 × Magie`.
- **Par CN, au choix de Jett** : +10 % des PV de base, +15 % de l'AD de base, +15 % de l'AP de base,
  **+20 points** de crit, **+20 points** de dégâts crit, +12 Armure ou +12 RM. 5 CN en crit donnent
  donc 100 % de crit : c'est voulu.
- **La base reste volontairement faible.** Les CN ne doivent pas permettre un compagnon à la fois
  puissant et résistant, mais **chaque CN doit compter nettement** dans la direction choisie.
- **Ultime (niveau 6)** : en plus de ses actions, le Nano-hex peut servir d'**exosquelette à un
  allié**. Il **encaisse tous les dégâts** à sa place, et le **surplus** passe au porteur quand ses
  PV tombent à 0. En exosquelette, il **continue d'attaquer** mais perd 1 de portée (2 → 1) et ses
  5 cases de déplacement.
- **Une fois l'ultime utilisée**, Jett génère **+1 CN à chaque attaque de base en mode cellules**,
  **même si le Nano-hex a été détruit**.

**Base du Nano-hex** (valeurs arrondies) :

| Niveau | Mental / Magie | PV | AD = AP | AR = RM | Crit / DCrit | 1 CN en PV | 1 CN en AD ou AP |
|---|---|---|---|---|---|---|---|
| 4 | 7 / 7 | 284 | 95 | 14 | 5 % / 150 % | +28 | +14 |
| 6 | 9 / 9 | 365 | 122 | 18 | 5 % / 150 % | +36 | +18 |
| 10 | 13 / 13 | 527 | 176 | 26 | 5 % / 150 % | +53 | +26 |
| 14 | 17 / 17 | 689 | 230 | 34 | 5 % / 150 % | +69 | +34 |
| 18 | 20 / 20 | 810 | 270 | 40 | 5 % / 150 % | +81 | +41 |

*Écartée : la lecture « A »*, qui prenait les stats complètes d'un perso, avec le socle de PV et
d'AR/RM, les PV donnés par la Magie et l'escalade. Elle donnait 455 PV au niveau 4.

### 3.7 ❓ Questions encore ouvertes
> ✅ **Toutes tranchées le 2026-10-10 : voir §8.**
- **Rathäel, Frappe Irritée** : la **base** et le **ratio d'AD**, maintenant que le terme AR+RM est
  retiré.
- **Jett, Nano-hex** : le **coût en mana fixe** de la C4, et les **ratios** de son attaque (AD) et
  de son rayon (AP).
- **Jett, C1** : les chiffres des nouveaux effets de soutien (bouclier, soin, mana).
- **Smith** : rien d'ouvert sur les rangs 1.

### 3.8 Prérequis toujours manquant
✅ **Retrouvé le 2026-10-10** dans `~/OneDrive/Documents/Claude` (en `.docx`) et converti dans `info-mj/`. *Texte d'origine :* `info-mj/Compétences-Races PJ (mis à jour)` n'est toujours pas sur la machine du MJ (voir §2). Les
décisions ci-dessus s'en passent, mais il faudra ce fichier pour réécrire les autres compétences.

---

## 4. Cadre théorique : fourchettes de dégâts par classe (proposition, 2026-10-06)

> Statut : **proposition à discuter**, rien n'est validé. Le but est de fixer un cadre **avant**
> de chiffrer les compétences une par une.

### 4.1 L'unité : l'attaque de base du perso lui-même
Toutes les valeurs se mesurent en **multiples de l'attaque de base (AA)** du perso qui lance la
compétence, **sur une seule cible**, **avant le crit et la mitigation**. C'est l'unité déjà validée
par la spec de calibrage (§5 et §10 de `2026-09-05-calibrage-attaques-base-design.md`) : le nombre
d'AA pour tuer reste stable du niveau 1 au 18. Une compétence exprimée en multiple d'AA garde donc
sa place dans le kit à tous les niveaux.

**Conséquence pratique : écrire les dégâts en `% AD` (ou `% AP`), sans bonus fixe.** Un `100 +`
pèse beaucoup au niveau 2 et plus rien au niveau 18 : c'est la cause n°1 du décrochage mesuré au
§2. Un bonus fixe reste possible, mais il faut alors vérifier le multiple d'AA **aux deux bouts**
(niveau 2 et niveau 18).

⚠️ Jett : en mode cellules, son AA ne fait aucun dégât. Son unité est **l'AA du mode arc court**.

### 4.2 Les cinq paliers

| Palier | Multiple d'AA | Ce que ça veut dire à la table |
|---|---|---|
| **Infime** | < 0,5 | Des dégâts d'appoint, accessoires à l'effet principal (ajouté à la demande du MJ, 2026-10-06). |
| **Faible** | 0,5 – 1,0 | Pas mieux qu'une AA gratuite. La compétence **vaut pour son effet** (contrôle, soin, buff, placement). |
| **Modéré** | 1,0 – 1,5 | Un peu mieux qu'une AA. C'est le « bon tour » ordinaire. |
| **Fort** | 1,5 – 2,5 | Le coup qu'on prépare, sur délai de récupération. |
| **Extrême** | 2,5 – 4,0 (et plus) | Le pic. Rare, conditionnel ou limité (1×/jour). |

**Deux décotes s'appliquent avant de choisir le palier :**
- **Zone** : une compétence qui touche plusieurs cibles descend d'**un palier** (une seule fois,
  pas un par cible). Ses dégâts par cible baissent, mais son total dépasse le palier d'origine dès
  2 ou 3 cibles. Le levier `manaPer` (coût par cible) peut taxer les grosses zones.
- **Contrôle dur** (étourdissement, immobilisation, provocation) : **un palier de moins**. Un
  étourdissement vaut à peu près une AA ennemie annulée.

### 4.3 Le rôle de chaque emplacement
- **C1** (pas ou peu de délai) : c'est le **tour ordinaire** du perso, celui qu'on lance souvent.
  Ses dégâts définissent le « tour normal » du budget §2. Si elle est nettement meilleure que l'AA
  sans rien coûter, on ne fait plus que ça (Urskaar : C1 ×4) : **c'est le mana qui doit l'empêcher**.
- **C2 / C3** (délai de 3 à 5 tours) : c'est le **pic régulier**, une fois tous les 3 ou 4 tours.
  Il définit le « pic » du budget §2.
- **Ultime** (1 fois par jour) : c'est le **moment fort du combat**. Elle peut dépasser le budget,
  puisqu'elle ne revient pas.

### 4.4 Proposition par classe (rang 1)

| Perso (classe) | C1 | C2 / C3 | Ultime | Forme recherchée |
|---|---|---|---|---|
| **Elias** (carry physique) | **Modéré** 1,2 – 1,4 | **Fort** 1,8 – 2,2 | **Fort**, en zone (2,0 par cible sur 3 à 5 cibles) | Régulier : le plus petit écart entre tour normal et pic. Ses dégâts viennent du **volume**, pas d'un pic. |
| **Smith** (assassin physique) | **Faible** sans condition (1,0)… **Extrême** marquée et camouflée (×3,5) | Utilitaire (Fondu au noir : 0) et **Modéré** en zone (Chaînes) | **Extrême**, mono-cible, avec exécution | Le **pic le plus haut** du groupe, des tours creux entre deux. Sa C1 conditionnelle **est** son pic (§3.5). |
| **Urskaar** (bruiser physique) | **Modéré +** 1,4 – 1,5 | **Fort** 2,0 – 2,2 (zone de saut) | **Fort sur la durée** (transformation 5 tours, buff plutôt que pic) | Le meilleur cogneur **régulier** en début de campagne. Kit sain, à garder. |
| **Rathäel** (tank physique) | **Faible → Fort selon l'état** : 0,6 au repos, environ 1,6 bas en PV avec 5 charges | **Faible** (Mur de Givre : 0) et **Modéré à Fort** en zone (Éclat de l'âme, qui consomme les charges) | **Modéré** en dégâts, **extrême en survie** | Ses dégâts sont une **récompense** de l'encaissement. Le reste de son budget va au contrôle et à la résistance. |
| **Jett** (support hybride) | **Faible** en dégâts (1 effet sur 2 sert au soutien) | **Modéré** en dégâts **+ valeur de soutien** (C2 : étourdissement + soin ; C3 : zone + mana) | Le **Nano-hex** : environ 1 AA de plus par tour pendant tout le combat, et une protection (exosquelette) | Le plus petit pic de dégâts du groupe. Sa valeur **se mesure en soins, boucliers et mana donnés**, pas en dégâts. |

**Ce que ce tableau donne déjà pour Frappe Irritée.** Le tank vise un pic de 1,6 (§2). À 5 charges
et 30 % de PV, le multiplicateur vaut `1 + 0,70 + 1,00 = 2,7`. La base doit donc valoir
**1,6 / 2,7 ≈ 0,6 AA**, soit **environ 60 % AD, sans bonus fixe**. Au repos, la compétence fait
0,6 AA (Faible : normal pour 20 mana sans délai). Elle devient forte quand Rathäel souffre.

**Ce que ce tableau dit de Smith.** Le ×3,5 de l'Attaque sournoise (avec le +30 % de crit) donne
environ **4,0 AA**. C'est **exactement** le pic d'assassin du budget §2, **dès le rang 1**.

### 4.5 Et les rangs 1 → 5 ?
Il faut décider ce que représente le budget du §2 :
- **Option 1 : le budget est la cible au rang 5.** Le rang 1 se place en bas de la fourchette, et
  chaque rang ajoute environ +10 % (rang 5 ≈ ×1,4 le rang 1). Les compétences gagnent du poids face
  à l'AA au fil de la campagne, ce qui récompense le choix de l'amélioration.
- **Option 2 : le budget est la cible au rang 1.** Les améliorations portent alors surtout sur
  **autre chose que les dégâts** : coût, délai, portée, durée, effet ajouté. Les chiffres restent
  stables et faciles à équilibrer.

*Recommandation* : **un mélange, propre à chaque classe.** Les persos dont la force est le
**volume de dégâts** (Elias, Urskaar) montent en dégâts par rang (option 1). Ceux dont la force est
un **pic ou un effet** (Smith, Rathäel, Jett) montent surtout en effet (option 2). Smith en est le
cas d'école : son pic est déjà à la cible au rang 1. S'il prenait +40 %, il tuerait un élite en
un coup.

### 4.6 ❓ Questions pour le MJ
1. Les **quatre paliers** (0,5 / 1,0 / 1,5 / 2,5 / 4,0 AA) vous conviennent-ils comme vocabulaire
   commun ?
2. Le **budget §2** correspond-il au rang 1 ou au rang 5 ? Ou au mélange par classe proposé
   au §4.5 ?
3. L'**ultime** a-t-elle droit à un plafond, ou seulement « au-dessus de tout le reste du kit » ?
4. Les **décotes** (zone : un palier de moins ; contrôle dur : un palier de moins) vous semblent-elles
   justes ?

---

## 5. Durée de combat attendue : simulation 5 contre 5 (2026-10-06)

> Question du MJ : deux groupes identiques (Elias, Smith, Urskaar, Rathäel, Jett) qui
> s'affrontent avec les valeurs théoriques du §4 (rang 1). Combien de rounds dure le combat ?

### 5.1 Le modèle
- **Base de dégâts** : la matrice « nombre d'AA pour tuer » du niveau 18 (§5 de la spec de calibrage
  du 2026-09-05). Elle inclut déjà le d20 (×0,625 en moyenne), le crit et la mitigation. Une action
  de multiplicateur `m` retire `m / N` des PV de la cible. Correspondances : Elias = ADC,
  Smith = assassin, Urskaar = bruiser, Rathäel = tank physique, Jett ≈ tank magique.
- **Kits au rang 1** (valeurs du §4.4), délais de récupération respectés :
  - **Elias** : C2 et C3 à 2,0, C1 à 1,3, ultime à 2,0 sur 3 cibles.
  - **Smith** : Fondu au noir, puis Attaque sournoise marquée et camouflée à 4,0. Hors camouflage,
    Attaque sournoise marquée à 2,0 ; Chaînes à 1,0 sur 2 cibles ; ultime à 3,0.
  - **Urskaar** : ultime au round 1 (×1,3 pendant 5 tours), C2 à 2,1 sur 2 cibles, C1 à 1,45.
  - **Rathäel** : Mur de Givre (provoque le plus gros cogneur pendant 2 tours) ; Frappe Irritée à
    `0,6 × (1 + %PV manquants + 0,2 × charges)` ; Éclat de l'âme ; Âme fendue (régénération de 10 %
    par tour, aura d'environ 5,5 % des PV après RM sur 2 ennemis et 1 allié) ; ultime sous 50 % de PV.
  - **Jett** : C2 (étourdit 2 tours, 1,0 de dégâts, 1,0 de soin), C3 à 1,0 sur 2 cibles, C1 à 0,8
    (une fois sur deux en soin), Nano-hex au round 2 (+1 AA par round).
- **Ciblage** : tout le groupe concentre ses coups sur l'ennemi le plus facile à tuer. Une cible
  provoquée frappe Rathäel.
- **Simplifications** : pas de placement (tout le monde peut toucher tout le monde), pas de mana,
  le Nano-hex n'est jamais ciblé, la cible de Smith est toujours marquée (hypothèse favorable).
  La matrice date d'avant `MITIGATION_K` 120 → 100 : les cibles armurées sont donc aujourd'hui un
  peu plus résistantes que dans ce calcul.

### 5.2 Résultats

| Scénario | Durée (rounds) | Premier mort | Issue |
|---|---|---|---|
| Référence : attaques de base seules, miroir | **23** | round 1 | Un tank survit à 8 % de PV |
| **1. Un groupe prend l'avantage** (round de surprise + il joue en premier) | **4** | round 1 | Aucune perte côté gagnant |
| 1 bis. Même avantage, attaques de base seules | 10 | round 1 | Le gagnant perd 2 persos |
| **2. Miroir** | **10** | round 1 | Un bruiser survit à 39 % de PV |
| **3a. Miroir, chaque compétence réussit 1 fois sur 2** (4 000 tirages) | **13 en médiane** (10 % des combats ≤ 7, 10 % ≥ 23) | round 1 | 51 / 49 |
| 3a bis. Avantage, réussite 1 fois sur 2 | 11 en médiane (6 à 23) | round 2 | **Le groupe avantagé gagne 73 % du temps** |
| **3b. Miroir, compétences à 50 % d'efficacité** | **15** | round 2 | Deux survivants |
| 3b bis. Avantage, efficacité 50 % | 8 | round 2 | Le gagnant perd 1 perso |

**Le déroulé typique d'un miroir** (scénario 2) suit trois phases :

| Rounds | Survivants de chaque côté | Phase |
|---|---|---|
| 1 | Smith tombe | **Ouverture** : 5 persos qui concentrent leurs coups tuent un perso fragile par round. |
| 2 – 3 | Elias tombe | |
| 4 – 6 | Jett tombe | |
| 7 – 10 | Rathäel tombe, puis Urskaar contre Urskaar | **Fin de combat** : les persos robustes s'usent lentement. |

### 5.3 Ce qu'on en retient
1. **L'ouverture est décidée par les attaques de base, pas par les compétences.** Un perso fragile
   meurt en 2 à 3 AA (calibrage du 2026-09-05). Cinq persos qui visent la même cible le tuent donc
   **en un round**, avec ou sans compétences.
2. **Les compétences raccourcissent surtout la fin de combat** : 23 → 10 rounds en miroir. Sans
   elles, deux tanks qui se tapent dessus mettent **13 AA** à se tuer (13 rounds).
3. **L'avantage fait boule de neige.** Prendre le premier round suffit à finir en 4 rounds sans
   perte. Même avec des compétences qui ratent une fois sur deux, le groupe avantagé gagne 3 fois
   sur 4.
4. **Smith ne place jamais son pic en miroir.** Son burst demande de préparer le terrain (Fondu au
   noir, puis l'Attaque sournoise au tour suivant), et il est le premier visé. Face à des monstres
   qui ne concentrent pas leurs coups, ça ira mieux. Mais un assassin qui doit **préparer** son coup
   est fragile par construction.
5. **« Réussir 1 fois sur 2 » et « 50 % d'efficacité » donnent la même moyenne, pas le même jeu.**
   L'efficacité réduite allonge régulièrement les combats (15 rounds). La réussite aléatoire les
   rend **imprévisibles** : de 7 à 23 rounds pour le même affrontement.

### 5.4 ❓ Questions pour le MJ
1. **Quelle durée visez-vous pour un combat ordinaire ?** 4 à 6 rounds ? La spec de calibrage
   dimensionne les PV des monstres en « actions du groupe » (standard 4, élite 10, boss 22) : ça
   donne un ordre d'idée.
2. **La mort en 1 round sous des coups concentrés** est-elle acceptable pour les persos fragiles ?
   C'est une propriété des attaques de base (§5 du calibrage), pas des compétences. On la corrige
   plutôt par des outils de protection (provocation, bouclier, exosquelette) que par les PV.

### 5.5 Réponses du MJ (2026-10-06)
- **Durées visées** : rencontre standard **6 à 7 rounds**, confrontation d'élite **9 à 10**, boss
  **13 à 15**.
- **Un perso tué en un round par 5 attaques de base est clairement un problème**, même dans un
  scénario aussi exigeant. Le même résultat obtenu avec les **compétences** serait acceptable.
  Piste du MJ : l'attaque de base est trop forte, soit par son ratio d'AD/AP, soit par la quantité
  d'AD/AP des persos.

---

## 6. L'attaque de base est trop forte quand on concentre les coups (2026-10-06)

### 6.1 Pourquoi : c'est la même arithmétique que le duel
Le calibrage du 2026-09-05 visait **environ 4 AA pour tuer un perso fragile en duel** (§6 de cette
spec). Un groupe de 5 qui concentre ses coups additionne cinq duels : il tue donc en
**environ 4 / 5 de round**. On ne peut pas rendre la concentration de coups survivable **sans
allonger les duels du même facteur**. Il faut choisir le facteur.

PV retirés par round quand les 5 persos d'un groupe frappent la même cible avec leurs attaques de
base seules (1,00 = la cible meurt dans le round) :

| AA × | sur Elias (ADC) | sur Smith (assassin) | sur Rathäel (tank) | Duel ADC → ADC | Duel bruiser → ADC | Duel tank → tank |
|---|---|---|---|---|---|---|
| **1,0 (actuel)** | **1,26** | **1,63** | 0,64 | 2,8 AA | 4,4 AA | 13 AA |
| 0,7 | 0,89 | 1,14 | 0,45 | 4,0 | 6,3 | 18,6 |
| **0,6** | **0,76** | **0,98** | 0,38 | 4,7 | 7,3 | 21,7 |
| 0,5 | 0,63 | 0,81 | 0,32 | 5,6 | 8,8 | 26 |

**À ×0,6, un perso fragile survit au premier round** quand il n'encaisse que des attaques de base.
Il meurt au deuxième. Smith reste à la limite (0,98 : la variance du d20 le tue parfois).

### 6.2 Où baisser : l'attaque de base seule, pas l'AD des persos
- **Baisser l'AD/AP des persos** (dans `computeStats`) ou **monter tous les PV** revient au même
  pour la concentration de coups. Mais **les compétences baissent avec** : les combats complets
  s'allongent d'autant, et les compétences restent aussi inutiles qu'aujourd'hui face à l'AA.
  Monter les PV impose en plus un « ⟲ Combat » pour tout le monde, puisque `hpCur` est absolu.
- **Baisser le ratio de l'attaque de base** (par exemple « l'attaque de base inflige 60 % de l'AD
  ou de l'AP ») **ne touche qu'elle**. Les compétences, écrites en `% AD` / `% AP`, deviennent
  **mécaniquement 1,67 fois plus intéressantes** que l'AA. C'est **exactement le défaut n°1 du §2**
  (« 3 PJ sur 5 n'ont aucune raison de lancer une compétence »), corrigé sans toucher aux kits.
  Et ça correspond à la phrase du MJ : les compétences peuvent tuer en un round, les AA seules non.

**Effet mesuré par la simulation du §5, avec AA × 0,6 et les compétences inchangées :**
- les combats **à l'AA seule** s'allongent beaucoup (23 → 36 rounds en miroir) ;
- les combats **avec compétences** bougent peu : ce sont les compétences qui portent la durée,
  ce qui est voulu ;
- sous des coups concentrés **compétences comprises**, un perso fragile meurt encore au round 1.
  C'est le cas jugé acceptable par le MJ.

### 6.3 Conséquences à prévoir si on retient cette piste
1. **Unité du §4** : les paliers sont écrits en multiples d'AA. Avec une AA à 60 %, il faut les
   relire en **« AA de référence » = 100 % de l'AD/AP** (l'ancienne AA). Les valeurs du tableau du
   §4.4 restent alors valables telles quelles.
2. **Compétences « dégâts d'arme »** (Attaque sournoise et Tir Ciblé passent par `skillBaseDamage` ;
   Maîtrise du pugilat se décrit en « AA améliorée », via `dmgUrskaarC1`) : dire si elles suivent l'AA (×0,6) ou l'AD plein. *Proposition* : l'AD plein,
   sinon le pic de Smith tombe à 2,4.
3. **Le mana devient le vrai frein.** Si une compétence vaut 2 AA, on la lance dès qu'on peut. La
   décision MJ « le mana doit être un minimum limitant » (§2) devient prioritaire.
4. **Les propriétés d'armes** (livraisons 1 à 3 du 2026-09-15) et le −25 % sans maîtrise
   s'appliquent à l'AA : leur valeur absolue baisse d'autant.
5. **Les durées visées par le MJ** (6-7 / 9-10 / 13-15) sont un réglage **côté monstres** (PV et
   dégâts, `npcStatsFromAttrs`). On les dimensionnera une fois l'AA et les rangs 1 fixés.
6. **Remise en cause assumée du calibrage du 2026-09-05** : la cible « ~4 AA en duel » passe à
   ~5-7. Le reste de la spec (courbe de points, escalade, crit) n'est pas touché.

### 6.4 ❓ Question pour le MJ
**Quel facteur pour l'attaque de base : 0,7, 0,6 ou 0,5 ?** *Recommandation : 0,6*, le plus petit
écart qui fait survivre un fragile au premier round d'AA concentrées. 0,5 donne de la marge mais
allonge les duels de tanks à 26 AA.

### 6.5 ✅ Décision du MJ (2026-10-06)
- **L'attaque de base passe à ×0,6** de l'AD/AP.
- **Les compétences basées sur l'attaque de base baissent aussi** (×0,6) : Attaque sournoise et Tir
  Ciblé (`skillBaseDamage`), Maîtrise du pugilat (« AA améliorée »).
- **On en profite pour retravailler leurs multiplicateurs et bonus.** Exemple : sans retouche, le
  ×3,5 de l'Attaque sournoise ne vaut plus que **2,1 AA de référence** (2,4 avec le crit), loin du
  pic d'assassin de 4,0. Il faudrait environ **×6** pour le retrouver.
- Les compétences écrites en `% AD` / `% AP` **ne bougent pas**.

---

## 7. Bilan de la session du 2026-10-06 et suite

### 7.1 Ce qui est décidé
1. **Progression par améliorations de compétence** (§3.1, §3.2) :
   - C1 à C3 imposées aux niveaux 1 à 3 ;
   - 1 point par niveau à partir du 4, donné automatiquement, sans validation du MJ, avec une
     remise à zéro possible par le MJ ;
   - C4 coûte un point, puis passe ultime au niveau 6 (ou arrive directement en ultime si elle est
     apprise au 6 ou après) ;
   - l'ultime monte aux niveaux 11 et 16 ;
   - rang maximum 5, plafonné à ⌊niveau / 2⌋ ;
   - ultimes **1 fois par jour**.
   Les 15 points tombent juste au niveau 18.
2. **Thèmes du rang 1** : un kit ne doit pas se suffire à lui-même (§3.3).
   - **Rathäel** (§3.4) : Frappe Irritée à `base × (1 + 0,01 × %PV manquants + 0,20 × charges)`,
     sans le terme AR+RM ; aura d'Âme fendue à 8 % des PV max, rayon 1, alliés compris ; Mur de
     Givre et Éclat de l'âme inchangés.
   - **Smith** (§3.5) : Flétrissement inchangé, nouvelles règles de reprise et de propagation de la
     marque ; Attaque sournoise ×2 sur cible marquée, ×3,5 marquée et camouflée (avant la baisse de
     l'AA) ; attaquer fait perdre le camouflage.
   - **Jett** (§3.6) : l'AD sert aux dégâts, l'AP au soutien ; C1 aléatoire avec des effets de
     soutien ; **C3 Surcharge destructrice** et **C4 Nano-hex** entièrement définies (base
     `40,5 × Mental` PV, `13,5 × Magie` AD = AP, `2 × Magie` AR = RM, apports par CN, exosquelette
     en ultime).
3. **Cadre des fourchettes** (§4) : unité = l'**AA de référence** (100 % de l'AD/AP) ; **5 paliers** :
   Infime < 0,5 · Faible 0,5–1 · Modéré 1–1,5 · Fort 1,5–2,5 · Extrême 2,5–4+ ; un tableau par
   classe pour C1, C2/C3 et l'ultime.
4. **Durées visées** (§5.5) : standard 6 à 7 rounds, élite 9 à 10, boss 13 à 15.
5. **Attaque de base à ×0,6**, compétences basées sur l'AA comprises (§6.5).

### 7.2 Priorités pour la prochaine session (dans l'ordre)
1. **Retravailler les compétences basées sur l'AA** après le ×0,6 : Attaque sournoise (viser à
   nouveau ~4,0 AA de référence sur cible marquée et camouflée), Tir Ciblé, Maîtrise du pugilat.
   C'est la suite directe de la décision et elle débloque tout le reste.
2. **Chiffrer les rangs 1 encore ouverts**, en `% AD` / `% AP` et sans bonus fixe, en suivant le
   tableau du §4.4 :
   - Frappe Irritée : **≈ 60 % AD** (déduit au §4.4, à confirmer) ;
   - coût en mana et ratios d'attaque et de rayon du Nano-hex ;
   - valeurs des effets de soutien de la C1 de Jett ;
   - puis les kits d'**Elias** et d'**Urskaar**, pas encore abordés (passif d'Elias toujours
     surpuissant, §2).
   - ⚠️ La C3 de Jett garde un bonus fixe (`100 + 10 × niveau`) : vérifier qu'il reste dans son palier
     au niveau 2 **et** au niveau 18.
3. **Trancher les questions du §4.6** : le budget par archétype vise-t-il le rang 1, le rang 5 ou un
   mélange par classe ? (C'est ce qui fixe ce que rapportent les améliorations.) Plafond de l'ultime ?
   Décotes de zone et de contrôle ?
4. **Concevoir le contenu des rangs 2 à 5** de chaque compétence, et la version ultime des C4
   d'Elias, Smith et Urskaar (Rathäel et Jett en ont déjà une).
5. **Relancer la simulation** avec l'AA à ×0,6 et les kits rechiffrés :
   `node docs/superpowers/specs/2026-10-06-sim-combat-5v5.js` (option `aa`, kits codés en dur au
   §5.1). Puis **dimensionner les monstres** (PV, dégâts) pour les durées visées.
6. **Le mana comme frein** : avec des compétences qui valent 2 AA, il devient le seul limiteur
   (décision MJ du §2). Le chiffrer une fois les kits stabilisés.
7. **Implémentation** (seulement après les points 1 à 4) :
   - coefficient 0,6 de l'attaque de base (`basicAttackProfile`) et des compétences basées sur l'AA ;
   - champ `skillRanks` et règle RTDB ;
   - écran de dépense des points et bouton de remise à zéro du MJ ;
   - C4 apprise ou non, ultimes 1×/jour ;
   - les nouveaux kits.
   ⚠️ L'AA à ×0,6 change les dégâts **en jeu** pour tout le monde : à annoncer à la table.
8. Toujours en attente : récupérer `info-mj/Compétences-Races PJ (mis à jour)` (en `.docx`) avant de
   réécrire les kits d'Elias et d'Urskaar.

---

## 8. Rangs 1 chiffrés : compétences basées sur l'AA, Nano-hex, C1 de Jett (2026-10-08 et 2026-10-10)

Propositions du 2026-10-08, tranchées par le MJ le 2026-10-10. Unité : l'AA de référence (100 % de
l'AD/AP) ; l'attaque de base vaut 0,6. Chiffres tirés du moteur réel (`computeStats`,
`mitigateDamage`, `critMultAfterResist`) sur les archétypes de calibrage, **sans équipement**.

### 8.1 ✅ Frappe Irritée (Rathäel) : 50 % AD, sans bonus fixe
`0,5 AD × (1 + 0,01 × %PV manquants + 0,20 × charges)`. Le §4.4 visait 60 % AD pour un pic Fort à
1,6 ; la consigne du MJ (« fiable mais faible, modérée quand il est mal en point ») ramène à 50 %.

| État | Multiplicateur | AA de réf. | Niv. 2 (AD 112) | Niv. 18 (AD 461) |
|---|---|---|---|---|
| Frais, 0 charge | ×1 | 0,50 | 56 | 230 |
| 1 charge, 90 % de PV | ×1,3 | 0,65 | 73 | 300 |
| 2 charges, 70 % de PV | ×1,7 | 0,85 | 95 | 392 |
| 5 charges, 30 % de PV | ×2,7 | 1,35 | 151 | 622 |
| 5 charges, 10 % de PV | ×2,9 | 1,45 | 162 | 668 |

Plafond théorique 1,5 (à 0 PV). À froid, elle fait moins qu'une attaque de base (0,5 contre 0,6).

### 8.2 ✅ Attaque sournoise (Smith) : **×4,5** marquée + camouflée
**Décision MJ du 2026-10-10 : ×4,5** (2,7 AA de réf. avant crit). Le tableau ci-dessous garde ×4 et ×5 pour mémoire.

Les autres cas ne bougent pas (multiplicateurs de l'attaque de base à 0,6) : normale ×1 = 0,6 ;
camouflé ×1,5 = 0,9 ; marquée ×2 = 1,2.

**Le MJ veut retirer environ les 3/4 des PV d'un tank, pas le tuer d'un coup** : ×5 est écarté.
Part des PV retirée sur une **réussite pleine** (d20 de 11 à 20), cible à PV pleins, sans crit / sur
un crit (chance de crit de Smith avec le +30 % : 50 % au niveau 2, 85 % au niveau 18) :

| Niveau | Cible | ×4 | ×4,5 | ×5 |
|---|---|---|---|---|
| 2 | Rathäel (tank) | 53 % / 85 % | 60 % / 96 % | 66 % / 106 % |
| 2 | Urskaar (bruiser) | 61 % / 101 % | 69 % / 113 % | 76 % / 126 % |
| 2 | Elias (ADC) | 98 % / 171 % | 110 % / 192 % | 122 % / 213 % |
| 2 | Jett (support) | 143 % / 248 % | 161 % / 279 % | 179 % / 311 % |
| 18 | Rathäel | 39 % / 59 % | 44 % / 67 % | 49 % / 74 % |
| 18 | Urskaar | 42 % / 74 % | 48 % / 84 % | 53 % / 93 % |
| 18 | Elias | 78 % / 180 % | 88 % / 202 % | 98 % / 225 % |
| 18 | Jett | 138 % / 317 % | 155 % / 356 % | 172 % / 396 % |

- Une demi-réussite (d20 de 6 à 10) divise tout par deux.
- **Le pic sur un tank s'érode avec le niveau** : ses PV et sa rés. crit (3 %/point de Mental, 60 %
  au niveau 18) montent plus vite que les dégâts de Smith.
- ⚠️ **Correction du 2026-10-08** : j'annonçais « 97 % des PV du tank » à ×5 au niveau 18. Ce chiffre
  venait de la matrice du calibrage du 2026-09-05, **périmée** (voir §8.7). Le moteur actuel donne
  49 % / 74 %.

**✅ Échec de l'Attaque sournoise** (d20 de 1 à 5) : test d'Habileté **DD 13**, `d20 + ⌊Habileté / 4⌋`
(DD 15 proposé d'abord, ramené à 13 par le MJ). Réussi, Smith **garde son camouflage**. Chances : 45 % à
6 d'Habileté (niveau 2), 55 % à 13, 65 % à 20.

#### ✅ Chaînes estropiantes et Voile dimensionnel (C3 et C4 de Smith) (MJ, 2026-10-10)
**Chaînes estropiantes** (60 mana, délai 4, cône de 8 cases) :
- **Cible choisie : 120 % AD** (ancien : `50 + 100 % AD`) **+ saignement**.
- **Saignement : dégâts BRUTS, en % de l'AD de Smith, à chaque tour de la cible.** Cible du MJ : la moitié des PV
  d'une cible fragile en 5 tours, au moins le double de temps pour un tank. **Retenu : 20 % AD par tour**
  (29 au niveau 2, 120 au niveau 18) :

  | Tours pour perdre la moitié de ses PV | Jett | Smith | Elias | Urskaar | Rathäel |
  |---|---|---|---|---|---|
  | Niveau 2 | 3,9 | 4,7 | 5,4 | 8,6 | 10,2 |
  | Niveau 18 | 3,5 | 4,3 | 5,1 | 9,4 | 10,9 |

  (18 % AD donnerait 5,0 tours en moyenne sur les fragiles.) L'ancien texte (« 5 % + 5 % par 100 AD »,
  `smithBleedPct`) est abandonné.
- **Toutes les cibles touchées par le cône portent l'effet « chaîne »** : elles sont **exécutées en arrivant à
  10 % de PV**. Elles ne saignent pas (seule la cible choisie saigne).
- **Retrait** : à chacun de ses tours, **après** avoir subi le saignement, le porteur a **2 chances sur 5** de
  retirer l'effet. Sur la cible choisie, **un seul test vaut pour le saignement ET la chaîne** : elle se défait
  des deux ou d'aucun. **Aucun des deux ne part tout seul.** Un
  allié peut retirer l'un ou l'autre par une **action mineure**.
- En moyenne, un saignement dure 2,5 tours (0,5 AA de réf. au total) : les Chaînes valent alors 1,7 sur la
  cible choisie.

**Voile dimensionnel** (80 mana, une fois par jour) : Smith et sa cible sont isolés ; Smith ne rate aucune
compétence et ne subit que 50 % des dégâts.
- **C4** : **1 tour** dans le Voile pour Smith et son adversaire ; pour la table, cela dure un créneau.
- **Ultime** : **3 tours** dans le Voile ; pour la table, un tour entier.
- **Bonus de crit** si la cible y meurt : **+10 % de chance de crit et +25 % de dégâts crit** (C4) ; **+40 % et
  +100 %** (ultime). Il dure **tout le combat**.
- Si la cible y meurt : soin de 10 % de ses PV et de son mana (50 % en ultime), inchangé.

### 8.3 ✅ Maîtrise du pugilat (Urskaar) — version du MJ, confirmée le 2026-10-10 avec le nouveau passif
| Variante | Formule | 0 tranche | 1 tranche (5 cases) | 2 (8) | 3 (11) |
|---|---|---|---|---|---|
| **Gauche** | **120 % AD + 30 % AD par tranche** ; pas d'attaque d'opportunité s'il compte parcourir 5 cases ou plus | 1,2 | 1,5 | 1,8 | 2,1 |
| **Droite** | **90 % AD + 10 % AD par tranche** ; étourdit à **50 % + 10 % par tranche** | 0,9 (50 %) | 1,0 (60 %) | 1,1 (70 %) | 1,2 (80 %) |

- **La C1 peut criter.**
- La gauche est le coup de dégâts, la droite le coup de contrôle.
- Rotation sur 4 tours (C2 une fois, gauche trois fois) : **1,28** sans déplacement, **1,56** avec une
  tranche par tour (budget bruiser ~1,5).
- Remplace `dmgUrskaarC1`, dont le `max(150 %, bonus de l'ours)` ne rendait rien pour les 5 premières
  cases.

#### ✅ Passif « Voie de l'ours », réécrit (MJ, 2026-10-10)
L'ancien passif (+150 % après 5 cases) donnait, avec l'attaque de base à 0,6, une attaque **gratuite**
à 1,5 / 1,65 / 1,8 : presque autant que la gauche à 30 mana.

- **Initiative : +1** (au lieu de +2). À **compter automatiquement** dans son jet d'initiative.
- **Attaque de base** : 0,6 AD. Quand Urskaar **a l'intention de parcourir 5 cases** : **+50 % de l'attaque
  de base**, puis **+25 % par tranche de 3 cases** en plus (les pourcentages portent sur l'attaque de base,
  pas sur l'AD).
- **+1 PM par tranche (max 3)** et **tranches sur C2 et C4** : inchangés.
- **Une seule définition de la tranche partout** (passif, C1, C2, C4) : elle se compte sur le déplacement
  **annoncé** (« a l'intention de parcourir X cases »), plus sur le déplacement déjà fait.

| Cases annoncées | Attaque de base (gratuite) | Gauche (30 mana) | Écart |
|---|---|---|---|
| Moins de 5 | 0,6 | 1,2 | +0,6 |
| 5 | 0,9 | 1,5 | +0,6 |
| 8 | 1,05 | 1,8 | +0,75 |
| 11 | 1,2 | 2,1 | +0,9 |

**Impact sur le code** : le score d'initiative vaut `d6 + bonus` (`initiativeTotal`), et `bonus` n'est
écrit que par le MJ, à la main (le joueur n'a le droit d'écrire que `d6`). Le +2 actuel n'est donc **pas
automatisé**. À faire : un bonus personnel porté par le kit (par exemple `passive.initBonus: 1` dans
`SKILLS`) et **ajouté au calcul**, sans écriture en base ni changement de règle RTDB. `bearBonusPct`
(150 + 25/tranche) devient 50 + 25/tranche.

#### ✅ C2, C3 et C4 d'Urskaar (MJ, 2026-10-10)
- **Écrasement (C2)** : **inchangé**, `150 % AD + 25 % par tranche` (1,5 / 1,75 / 2,0 / 2,25), portée 3 + 1 par
  tranche. Seule la définition de la tranche change (déplacement annoncé).
- **Ralliement (C3)** : bouclier de **30 % de ses PV max + 20 % par 50 AP** (c'était +10 % par 50 AP). La part
  d'AP est **gardée exprès**. Sans AP : 150 PV au niveau 2, 676 au niveau 18 ; chaque point d'AP ajoute 0,4 % de
  ses PV max (le code `urskaarC3Shield` est continu, pas par paliers de 50).
- **On ne m'arrêtera pas (C4)** : transformation inchangée (+30 % PV max, AD, Armure, 5 tours). **Piétinement
  baissé à `70 % AD + 20 % par tranche`** par unité traversée, une fois par tour (c'était 100 % + 25 %) : avec
  le +30 % d'AD, 0,9 par unité sans tranche, 1,4 avec deux.
- **Toutes les C4 sont utilisables une fois par JOUR, dès le niveau 4**, version ultime ou non (règle générale,
  qui précise le §3.2 : le `kind: 'combat'` disparaît pour toutes les C4).
- La version ultime (niveau 6) reste à concevoir.

### 8.4 ✅ Tir Ciblé (Elias) : **110 % AD, sans crit**
Le « pas de crit » est maintenu (des améliorations de rang pourront y revenir). Premier coup : +25 %
et +2 au jet ; soin de 5 % des dégâts. Avec le +2 au jet, elle vaut **×1,9** l'attaque
de base au niveau 2 et **×1,5** au niveau 18 (le crit de l'attaque de base monte, pas celui de la
compétence) ; ×2,4 et ×1,9 sur le premier coup. (130 % AD envisagé, écarté par le MJ le 2026-10-10.) ⚠️ Le passif (jusqu'à
+950 AD au niveau 18) reste à traiter.

### 8.5 ✅ Nano-hex (C4 de Jett)
- **Coût : 100 mana**, fixe.
- **Attaque** : `20 + 120 % AD`, mono-cible, portée 2, **chaque tour**, peut criter.
- **Rayon** : `20 + 120 % AP` **par cible**, à distance, petite zone en croix, **1 tour sur 2**
  (remplace le « tous les 3 tours » du §3.6), **ne crite pas**.
- Ni l'attaque ni le rayon ne coûtent de mana (le Nano-hex n'en a pas).
- Sur 2 tours : l'attaque vaut le double sur 1 cible, égalité sur 2 cibles, le rayon vaut ×1,5 sur 3.

| Niveau | Base AD = AP | Attaque, 0 CN | Attaque, 5 CN en AD | Rayon sur 3 cibles, moyenne par tour |
|---|---|---|---|---|
| 4 | 95 | 134 | 220 | 201 |
| 10 | 176 | 231 | 390 | 347 |
| 18 | 270 | 344 | 587 | 516 |

### 8.6 ✅ Remodulation (C1 de Jett) : effets de soutien
| Effet | Formule | Niv. 2 | Niv. 10 | Niv. 18 | Repère |
|---|---|---|---|---|---|
| Soin | `20 + 40 % AP` | 78 | 146 | 260 | Potion de soin mineur sur un PV moyen : 72 / 154 / 254 |
| Bouclier | `25 + 50 % AP` | 98 | 183 | 325 | 1 point de bouclier vaut 4/5 d'un PV : même valeur que le soin |
| Mana | `15 % du mana max de la cible + 1 % par 40 AP` | 30 | 88 | 199 | C3 sur un mana moyen : 68 / 156 / 282 |

Le mode mana reste sous la C3 pour toutes les cibles et à tous les niveaux (au pire : Rathäel au
niveau 18, 249 contre 316).

### 8.7 ⚠️ La matrice « AA pour tuer » de la simulation est périmée
Le script `2026-10-06-sim-combat-5v5.js` utilise la matrice du calibrage du 2026-09-05. Depuis :
`MITIGATION_K` 120 → 100, +5 d'AR/RM de socle. Recalculée avec le moteur actuel (niveau 18, attaque
de base à 100 %) :

| attaquant \ cible | ADC | Assassin | Tank ph | Tank mg | Bruiser |
|---|---|---|---|---|---|
| ADC | 2,6 | 2,1 | 6,4 | 5,2 | 5,6 |
| Assassin | 2,9 | 2,3 | **7,7** (était 6,0) | **6,2** (4,4) | 6,4 |
| Tank phys | 6,2 | 4,9 | 12,7 | 10,3 | 11,6 |
| Tank magi | 5,1 | 4,3 | 11,1 | 11,8 | 9,5 |
| Bruiser | 4,1 | 3,3 | 8,4 | 6,9 | 7,7 |

Les fragiles ne bougent pas, **les tanks tiennent environ 20 % de plus**. Reportée dans le script le 2026-10-10 (§8.8).

### 8.8 Simulation relancée (2026-10-10)
`node docs/superpowers/specs/2026-10-06-sim-combat-5v5.js` affiche désormais les deux jeux de réglages.
Kits « après » : Tir Ciblé 0,9 (110 % AD sans crit, +2 au jet, rapporté au crit moyen de l'ADC), Attaque
sournoise 3,3 au pic et 1,2 marquée seule, gauche d'Urskaar 1,35 (une tranche un tour sur deux), Frappe
Irritée 0,5, attaque du Nano-hex 0,8. **Les autres compétences gardent les valeurs du §4.4**, pas encore
rechiffrées.

| Scénario | Avant (matrice 09-05, AA 1,0, kits §4.4) | Après (matrice 10-10, AA 0,6, kits §8) |
|---|---|---|
| Attaques de base seules, miroir | 23 rounds, 1er mort round 1 | **35 rounds, 1er mort round 2** |
| Avantage, attaques de base seules | 10 rounds, 1er mort round 1 | 17 rounds, 1er mort round 2 |
| Miroir | 10 rounds, 1er mort round 1 | 10 rounds, 1er mort round 1 |
| Avantage (surprise + premier) | 4 rounds, aucune perte | 5 rounds, aucune perte |
| Miroir, efficacité 50 % | 15 rounds | 15 rounds |
| Avantage, efficacité 50 % | 8 rounds | 18 rounds |
| Miroir, réussite 1 fois sur 2 | médiane 12 (7 à 23) | médiane 15 (8 à 26) |
| Avantage, réussite 1 fois sur 2 | médiane 11 ; 73 % de victoires | médiane 13 ; 72 % de victoires |

- **L'objectif du §6 est atteint** : sous les attaques de base concentrées, plus personne ne meurt au
  round 1.
- **Avec les compétences, un fragile meurt encore au round 1** : le cas jugé acceptable (§5.5).
- **Le combat complet garde sa durée** (10 rounds en miroir) : ce sont bien les compétences qui la portent.
- Les combats où les compétences marchent mal s'allongent (15 à 18 rounds), puisque l'attaque de base ne
  rattrape plus.

### 8.9 ✅ Instinct du Chasseur (passif d'Elias), réécrit (MJ, 2026-10-10)
Ancien passif : `10 + 5 × (niveau − 1)` AD par charge, 5 charges + 1 tous les 3 niveaux, soit +40 % de son AD au
niveau 2 et **+121 % au niveau 18** (+950 AD).

- **6 % de son AD par charge.**
- **5 charges au maximum, +1 tous les 4 niveaux** (`5 + ⌊(niveau − 1) / 4⌋`).
- **Le passif ne sera pas amélioré par des rangs** (la piste d'un plafond de charges en amélioration est écartée).

| Niveaux | Charges max | Bonus max | AD gagnée (archétype ADC) | Ancien passif |
|---|---|---|---|---|
| 1 à 4 | 5 | +30 % | +56 au niveau 2 | +75 |
| 5 à 8 | 6 | +36 % | +106 au niveau 6 | +210 |
| 9 à 12 | 7 | +42 % | +189 au niveau 10 | +440 |
| 13 à 16 | 8 | +48 % | +302 au niveau 14 | +675 |
| 17 et 18 | 9 | +54 % | +424 au niveau 18 | +950 |

⚠️ **Baisse en jeu dès aujourd'hui** : au niveau 2, une charge passe de 15 à 11 AD (+75 → +56 à pleines
charges). À annoncer à la table.

**Gain des charges** (le joueur monte son compteur lui-même) :
1. **Chaque nouvelle cible blessée** donne 1 charge (inchangé).
2. Quand Elias a **touché toutes les cibles présentes**, le joueur **coche une case dans son passif**. La case
   est un aide-mémoire : elle ne change rien au calcul.
3. Une fois la case cochée, il gagne **1 charge à la fin de son tour** :
   - **plusieurs cibles présentes** : s'il a **touché deux cibles différentes** dans le tour (il répartit ses
     dégâts au lieu de s'acharner sur une seule) ;
   - **une seule cible** : s'il a concentré sur elle **au moins deux compétences** dans le tour (l'attaque
     de base gratuite ne compte pas).

**Impact sur le code** : `eliasPassiveAD` devient un pourcentage (`sumPassiveMods` reçoit déjà les stats de
base, comme pour Rathäel), `eliasMaxStacks` passe à `/ 4`, une case à cocher s'ajoute au passif (remise à
zéro par « ⟲ Combat »). Deux tests à mettre à jour.

### 8.10 ✅ Dash Tactique et Frappe Duale (Elias) (MJ, 2026-10-10)
Intention du MJ : ces deux compétences **complètent** les dégâts d'Elias en apportant un effet ; le poids va
au ratio d'AD, pas à une base fixe. À pleines charges, le passif les multiplie par 1,30 (niveau 2) à 1,54
(niveau 18).

| Compétence | Formule | Sans charge | Pleines charges, niv. 2 | Pleines charges, niv. 18 |
|---|---|---|---|---|
| **Dash Tactique** (30 mana, délai 3) | **110 % AD** s'il finit au corps à corps, et −1 tour de délai | 1,1 | 1,43 | 1,69 |
| **Frappe Duale** à distance (30 mana, délai 3) | **160 % AD**, repousse de 4 cases | 1,6 | 2,08 | 2,46 |
| **Frappe Duale** en mêlée | **140 % AD**, marque la cible (+25 % de dégâts subis, toutes sources) | 1,4 | 1,82 | 2,16 |

- **La marque dure jusqu'à la fin du prochain créneau d'Elias** : son équipe en profite une fois, et lui aussi.
- Anciennes formules : `50 + 100 % AD` et `100 + 150 % AD`. ⚠️ Baisse au niveau 2 (Frappe Duale 380 → 299 à
  distance, Dash 237 → 206), quasi neutre au niveau 18.

#### ✅ Salve du Corsaire (C4 d'Elias) (MJ, 2026-10-10)
Intention du MJ : toucher un maximum de monde et **renverser le combat**, en rendant de la vie à Elias et en
remplissant vite son passif.
- **60 mana**, arme à distance, **sans crit**.
- **130 % AD par cible** (ancien : `50 + 200 % AD`). Total : 3,9 sur 3 cibles, 6,5 sur 5.
- **Soin : 8 % de ses PV max par cible touchée** (ancien : 5 % des dégâts totaux). 32 % sur 4 cibles.
- **Charges du passif : règle normale** (§8.9), sans bonus propre à la Salve : chaque **nouvelle** cible
  blessée donne une charge. Une Salve d'ouverture remplit donc le passif, une Salve tardive non.

### 8.11 ⚠️ Économie d'actions : le cadre des §2, §4 et §5 supposait UNE action par tour (2026-10-10)
**Règle de la table, rappelée par le MJ** : à chaque tour, un personnage peut lancer son **attaque de base
gratuite**, sa **C1**, **au choix sa C2 ou sa C3** (jamais les deux le même tour) et sa **C4**.

Le diagnostic du §2 (« 3 PJ sur 5 n'ont aucune raison de lancer une compétence »), le budget par archétype
(« moyenne par tour ~1,5 ») et la simulation du §5 comparaient les compétences **à la place** de l'attaque de
base. Or elles **s'ajoutent**. Conséquences :
- **Les fourchettes du §4 restent valables par compétence**, mais le total d'un tour est une **somme**.
  Sans condition ni charge : Elias `0,6 + 1,28 + 1,6 = 3,5` ; Urskaar `0,6 + 1,2 + 1,5 = 3,3` (4,2 en charge) ;
  Smith `2,7 + 0,6 = 3,3` sur son tour de pic (3,9 avec le crit) ; Rathäel 1,1 à 2,0.
- **Smith n'a plus à préparer son coup** : Fondu au noir (C2) et Attaque sournoise (C1) partent dans le même
  tour. Le constat n°4 du §5.3 tombe.
- **Le mana est déjà un frein au niveau 2, et plus du tout au niveau 18** : les coûts sont fixes alors que le
  mana quadruple. Un tour complet (C1 + C2 ou C3) coûte 40 à Elias (113 de mana au niveau 2, 459 au 18), 70 à
  Smith (102 / 412), 80 à Urskaar (178 / 736), 70 à Rathäel (201 / 829), 90 à Jett (210 / 874).

**Simulation refaite avec cette règle** (`actMulti` dans le script ; mana toujours ignoré) :

| Scénario | 1 action par tour | Actions réelles | Actions réelles, AA à 1,0 |
|---|---|---|---|
| Attaques de base seules, miroir | 35 rounds, 1er mort round 2 | 35, round 2 | 23, round 1 |
| Miroir | 7 rounds | **5 rounds**, 1er mort round 1 | 5 |
| Avantage (surprise + premier) | 7 rounds, 1 perte | **2 rounds**, aucune perte | 2 |
| Miroir, efficacité 50 % | 25 rounds | 6 rounds | 5 |
| Miroir, réussite 1 fois sur 2 | médiane 16 (9 à 28) | médiane 6 (4 à 11) | médiane 5 |
| Avantage, réussite 1 fois sur 2 | 68 % de victoires | **98 % de victoires** | 99 % |

- Les résultats du §5.2 et du §8.8 (hors « attaques de base seules ») sont **remplacés** par cette colonne.
- **Un combat complet dure environ moitié moins** que ce que le §5 annonçait, et **jouer en premier décide
  presque tout** (98 %).
- **L'attaque de base à ×0,6 garde son effet là où il était visé** (attaques de base concentrées : premier mort
  au round 2), mais elle ne pèse presque plus sur un combat complet : elle n'est qu'un des trois ou quatre
  coups du tour.
- ❓ **À trancher par le MJ** : le total d'un tour (3 à 4 AA de réf.) est-il voulu, les monstres étant
  dimensionnés en conséquence, ou faut-il baisser les ratios / faire du mana le frein à tous les niveaux ?

**Réponses du MJ (2026-10-10)** :
- **Aucun ratio ne bouge avant la fin de la revue de toutes les compétences.**
- ✅ **Conversion uniforme à ×0,6 approuvée sur le principe**, à appliquer **en fin de revue** : tous les
  dégâts de compétence ×0,6 (bases fixes comprises) ; attaque de base, soins, boucliers et dons de mana non
  convertis ; puis retouche des compétences qui sortent de leur rôle (pic de Smith, compétences passées sous
  l'attaque de base). **Les chiffres du §8 sont donc écrits AVANT conversion.**
- **Pas de coût en % du mana max** (les spécialisations en mana deviendraient inutiles). Piste retenue : des
  coûts qui **montent légèrement avec le niveau**, pour que le mana reste limitant. À chiffrer.

**Ce que donnerait une conversion uniforme** (option `skillScale` du script : tous les dégâts de compétence
multipliés par k ; attaque de base, soins et effets inchangés) :

| k | Miroir | Avantage | Miroir, réussite 1 fois sur 2 | Avantage, réussite 1 fois sur 2 |
|---|---|---|---|---|
| 1 | 4 à 5 rounds | 2 rounds | médiane 7 | 98 % de victoires |
| 0,75 | 7 | 3 | médiane 8 | 98 % |
| 0,6 | 10 | 3 | médiane 10 | 98 % |
| 0,5 | 8 | 4 | médiane 11 | 98 % |
| 0,4 | 11 | 5 | médiane 13 | 98 % |

- **Elle suffit pour régler la DURÉE** : k ≈ 0,6 ramène le miroir vers 10 rounds.
- **Elle ne corrige ni l'avantage du premier à jouer** (98 % à tous les k) **ni la mort d'un fragile au round 1**
  sous les compétences concentrées : ce sont des effets de structure (focus + initiative), pas de ratio.
- **Elle n'est pas neutre partout** : les soins, boucliers et dons de mana ne doivent pas être convertis ; les
  bases fixes restantes (C3 de Jett, Nano-hex) doivent l'être aussi ; les cibles posées en valeur absolue
  bougent (le « 3/4 des PV d'un tank » de Smith tomberait à 45 % à k = 0,6) ; et plusieurs compétences
  passeraient sous l'attaque de base gratuite (Dash Tactique à 0,66 pour 30 mana).

### 8.12 ✅ Fin de la revue des rangs 1 : Rathäel et Jett (MJ, 2026-10-10)
- **Mur de Givre** (Rathäel, C2) : inchangé (+20 AR/RM au niveau 2, +60 au niveau 18, provocation).
- **Éclat de l'âme** (Rathäel, C3) : **le bonus fixe de 50 est retiré**, le reste ne bouge pas :
  `60 % AP + (50 % + 10 % par 2 niveaux) × (Armure + RM)`, +50 % par charge, zone de rayon 3. Avec le 50, elle
  valait 2,1 par cible au niveau 2 à 5 charges (3,2 avec une armure) et 1,4 au niveau 18 ; sans lui, 0,5 et 1,0
  sans équipement. Elle repose désormais entièrement sur ses résistances, donc sur son armure.
- **Ailes de Givre / Souverain Glacial** (Rathäel, C4 et ultime) : inchangés (aucun ratio de dégâts à régler).
- **Alignement de séquence** (Jett, C2, 40 mana, délai 3) : **étourdit 1 tour** (c'était 2) ; **60 % AD** aux
  ennemis (c'était `50 + 50 % AD`) ; soin des alliés **`40 + 80 % AP`**, soit **2 fois le soin de la C1**
  (156 / 293 / 520 aux niveaux 2 / 10 / 18 ; c'était `50 + 100 % AP`).

**Tous les rangs 1 sont passés en revue.** Restent hors rang 1 : les versions ultimes des C4 d'Elias, Smith
(déjà décrite), Urskaar, et le contenu des rangs 2 à 5.

### 8.13 ✅ Conversion ×0,6 des dégâts de compétence (validée par le MJ le 2026-10-10)
**Trois exceptions décidées par le MJ** : l'**Attaque sournoise est exemptée** (pic à ×4,5 conservé) ; la
**Frappe Irritée reste à 50 % AD** ; l'**Éclat de l'âme ne perd que 10 %**. Les colonnes « Après » ci-dessous
sont les **valeurs de référence pour l'implémentation**.

Non convertis : attaque de base (et le passif d'Urskaar, qui porte sur elle), soins, boucliers, dons de mana,
passif d'Elias (un % de son AD), saignement de Smith (calé sur une cible absolue par le MJ).

| Perso | Compétence | Avant | Après ×0,6 |
|---|---|---|---|
| Rathäel | Frappe Irritée | 50 % AD × (1 + PV manquants + charges) | **50 % AD, non convertie** : 0,5 au repos, 1,35 mal en point |
| Rathäel | Éclat de l'âme | 60 % AP + (50 % + 10 %/2 niv)(AR+RM) | **×0,9 seulement** : 54 % AP + (45 % + 9 %/2 niv)(AR+RM) |
| Smith | Flétrissement | 50 + 50 % AP | 30 + 30 % AP |
| Smith | Attaque sournoise | ×1 / ×1,5 / ×2 / ×4,5 de l'attaque de base | **exemptée** : inchangée |
| Smith | Chaînes | 120 % AD | 72 % AD |
| Urskaar | Gauche | 120 % AD + 30 % par tranche | 72 % AD + 18 % |
| Urskaar | Droite | 90 % AD + 10 % par tranche | 54 % AD + 6 % |
| Urskaar | Écrasement | 150 % AD + 25 % par tranche | 90 % AD + 15 % |
| Urskaar | Piétinement (C4) | 70 % AD + 20 % par tranche | 42 % AD + 12 % |
| Elias | Tir Ciblé | 110 % AD | 66 % AD |
| Elias | Dash Tactique | 110 % AD | 66 % AD |
| Elias | Frappe Duale | 160 % / 140 % AD | 96 % / 84 % AD |
| Elias | Salve du Corsaire | 130 % AD par cible | 78 % AD par cible |
| Jett | Remodulation (modes de dégâts) | 25 + 50 % AP ou AD | 15 + 30 % |
| Jett | Alignement de séquence | 60 % AD | 36 % AD |
| Jett | Surcharge destructrice | 100 + 10 × niveau + 100 % AD | 60 + 6 × niveau + 60 % AD |
| Jett | Nano-hex (attaque / rayon) | 20 + 120 % AD / AP | 12 + 72 % AD / AP |

❓ **Attaque sournoise : proposition de l'exempter.** Elle est écrite en multiples de l'attaque de base, qui a
déjà pris le ×0,6 (§6.5) : la convertir l'appliquerait deux fois. Exemptée, son pic reste à ×4,5 (2,7 AA de
réf., les 3/4 d'un tank au niveau 2, voulus par le MJ). Convertie, il tombe à ×2,7 (1,6 ; 47 % d'un tank).

**Total d'un tour après conversion** (sans charge ni condition) : Elias 2,3 (3,5 avant) ; Urskaar 2,2 (3,3) ;
Smith 3,3 sur son tour de pic s'il est exempté, 2,2 sinon ; Rathäel 0,9 à 1,4.

**Simulation, kits de la revue, actions réelles** :

| Scénario | Sans conversion | ×0,6, Smith exempté | ×0,6, Smith converti |
|---|---|---|---|
| Miroir | 4 rounds | **9 rounds** | 10 rounds |
| Avantage (surprise + premier) | 3 rounds, aucune perte | 3 rounds, aucune perte | 4 rounds, aucune perte |
| Miroir, réussite 1 fois sur 2 | médiane 7 (4 à 12) | médiane 11 (7 à 18) | médiane 11 (7 à 19) |
| Avantage, réussite 1 fois sur 2 | 98 % de victoires | 97 % | 98 % |
| Attaques de base seules, miroir | 35 rounds, 1er mort round 2 | idem | idem |

Exempter Smith ne change presque rien à la durée (9 contre 10 rounds).

### 8.14 Pourquoi le round de surprise écrase la durée (2026-10-10)
Les deux persos fragiles (Smith, Elias) sont aussi les **deux plus gros porteurs de dégâts**. Un round de
surprise complet les tue avant qu'ils jouent : le combat devient un 5 contre 3 où un seul camp a gardé ses
dégâts. En miroir, **les deux camps les perdent au round 1** et l'essentiel de la durée est un 3 contre 3 de
persos robustes. La surprise ne raccourcit donc pas le combat : elle **supprime sa phase longue**.

Simulation, conversion ×0,6, compétences réussies 1 fois sur 2 (options `teamFirst`, `surpriseAA` du script) :

| Scénario | Durée médiane | Victoires de A | Survivants de A |
|---|---|---|---|
| Miroir (tours entrelacés) | 11 rounds | 64 % | 2,4 |
| Tout le groupe A joue avant B, sans surprise | 9 | 88 % | 3,0 |
| Surprise, mais attaques de base seules pendant ce round | 10 | 86 % | 3,0 |
| Surprise complète | 7 | 97 % | 3,7 |

- Le facteur décisif est de pouvoir déverser **toutes ses compétences** sur les fragiles adverses avant leur
  premier tour.
- **Levier possible** : limiter le round de surprise aux attaques de base (c'est l'effet visé par l'AA à ×0,6).
  L'avantage reste net (86 %) sans être décisif.
- Le modèle exagère : focus parfait, tout le monde à portée de tout le monde, pas de mana, cible de Smith
  toujours marquée. Même en miroir « entrelacé », A joue avant B dans chaque paire, d'où 64 % et non 50 %.

**✅ Règle retenue par le MJ (2026-10-10) : pendant un round de surprise, seules l'attaque de base et la C1
sont permises.** Simulation (option `surpriseC1`) : le groupe surpris perd un fragile au lieu de deux, le
combat dure 6 rounds (3 avec la surprise complète, 8 à 9 en miroir) et le groupe avantagé gagne 94 % du temps
quand les compétences réussissent 1 fois sur 2 (97 % avant).

### 8.15 ✅ Coût en mana par niveau (MJ, 2026-10-10)
**Règles du MJ** : pas de coût en % du mana max (les spécialisations en mana deviendraient inutiles) ; le coût
monte avec le niveau. **Cibles finales**, en « tours complets » (C1 + C2 ou C3) payables avec une réserve
pleine (une première série de cibles, plus haute d'un à deux tours, a été abaissée par le MJ) :

| Profil | Niveau 2 | Niveau 18 |
|---|---|---|
| Carry physique (Elias, Smith) | 3 | 5 à 6 |
| Bruiser (Urskaar) | 4 à 5 | 7 à 8 |
| Tank (Rathäel) | 5 à 6 | 10 |
| Spécialiste du mana (AP ou support, runes et caracs en mana) | 7 | 12 à 13 |

**Formule : coût = coût du niveau 2 × (1 + 8 % × (niveau − 2))**, arrondi (×1,64 au niveau 10, ×2,28 au
niveau 18). Le mana des archétypes est multiplié par 4,1 sur la même période. **Une seule pente pour tous.**

| Perso | Compétence | Avant | Niv. 2 | Niv. 10 | Niv. 18 |
|---|---|---|---|---|---|
| Elias | Tir Ciblé | 10 | 10 | 16 | 23 |
| Elias | Dash Tactique / Frappe Duale | 30 | 28 | 46 | 64 |
| Smith | Attaque sournoise | 30 | 13 | 21 | 30 |
| Smith | Fondu au noir | 40 | 21 | 34 | 48 |
| Smith | Chaînes estropiantes | 60 | 26 | 43 | 59 |
| Urskaar | Maîtrise du pugilat | 30 | 15 | 25 | 34 |
| Urskaar | Écrasement | 50 | 27 | 44 | 62 |
| Urskaar | Ralliement | 100 | 50 | 82 | 114 |
| Rathäel | Frappe Irritée | 20 | 10 | 16 | 23 |
| Rathäel | Mur de Givre | 50 | 26 | 43 | 59 |
| Rathäel | Éclat de l'âme | 60 | 30 | 49 | 68 |
| Jett | Remodulation | 50 | 32 | 52 | 73 |
| Jett | Alignement de séquence | 40 | 26 | 43 | 59 |
| Jett | Surcharge destructrice | 20 + 5 par CN | 13 + 4 par CN | 21 + 7 | 30 + 9 |

- **Les C4 gardent un coût FIXE** (une fois par jour) : Salve 60, Voile 80, On ne m'arrêtera pas 100, Ailes de
  Givre 100, Nano-hex 100.

| Profil | Tours complets niv. 2 / 10 / 18 |
|---|---|
| Elias | 3,0 / 4,5 / 5,3 |
| Smith | 3,0 / 4,4 / 5,3 |
| Urskaar | 4,2 / 6,1 / 7,7 (moyenne conservée par rapport à la première grille, 4,7 / 6,2 / 7,4) |
| Rathäel | 5,6 / 8,3 / 10,1 |
| Spécialiste du mana (Mental en mana), kit de Jett | 7,0 / 10,1 / 12,9 |
| Jett, Habileté en mana | 4,8 / 6,8 / 8,7 |
| Jett en AP pur | 3,6 / 5,1 / 6,6 |

- Le « tour complet » est un majorant : les délais de 3 tours des C2/C3 empêchent d'en payer un à chaque tour.
- **Impact sur le code** : `sk.mana` devient une fonction du niveau (ou un helper `skillManaCost(sk, level)`) ;
  `buildCastPlan` lit le coût en un seul endroit (`cost.mana`).

### 8.16 Suite
1. Trancher le §4.6 (ce que rapporte un rang), puis les rangs 2 à 5 et les versions ultimes ; ensuite
   l'implémentation (§7.2 point 7), avec les valeurs du §8, reste des kits d'Elias et d'Urskaar, puis §4.6.
