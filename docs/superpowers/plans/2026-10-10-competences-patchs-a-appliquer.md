# Rééquilibrage des compétences — patchs à appliquer (état figé au 2026-10-10)

**Ce document est la référence unique pour coder.** Il rassemble les décisions du MJ prises du
2026-10-06 au 2026-10-10, dans leur **valeur finale**. Rien de ce qui suit n'est encore dans le code.

- Le raisonnement, les options écartées et les chiffres intermédiaires sont dans
  `docs/superpowers/specs/2026-10-05-competences-etat-des-lieux.md`. ⚠️ Cette spec est un **journal
  chronologique** : ses §2 à §7 contiennent des valeurs **remplacées** depuis (budget par archétype,
  ratios d'avant conversion, simulation à une action par tour). **En cas d'écart, ce plan-ci fait foi.**
- Simulation : `node docs/superpowers/specs/2026-10-06-sim-combat-5v5.js`.
- Kits d'origine du MJ : `info-mj/Compétences-Races PJ (mis à jour).md` (hors dépôt, converti le
  2026-10-10 depuis `~/OneDrive/Documents/Claude`).

Tout le monde est **niveau 2** : seuls les passifs, les C1 et les C2 sont en jeu aujourd'hui.

---

## 1. Règles générales décidées

| # | Règle | Code ou table ? |
|---|---|---|
| G1 | **L'attaque de base inflige 60 % de l'AD/AP** (au lieu de 100 %). | Code (lot A) |
| G2 | **Économie d'actions** : à chaque tour, un perso peut lancer son attaque de base gratuite, sa C1, **sa C2 OU sa C3** (jamais les deux), et sa C4. | Table (le site ne l'impose pas) |
| G3 | **Round de surprise** : seules l'attaque de base et la C1 sont permises. | Table |
| G4 | **Toutes les C4 sont utilisables une fois par JOUR**, dès le niveau 4, version ultime ou non. | Code (lot E) |
| G5 | **Coût en mana** : `coût = coût du niveau 2 × (1 + 8 % × (niveau − 2))`, arrondi. Les **C4 gardent un coût fixe**. Pas de coût en % du mana max. | Code (lot B) |
| G6 | **Les dégâts de compétence sont écrits en % d'AD/AP, sans bonus fixe** (sauf exceptions listées). Les valeurs du §2 ont **déjà** reçu la conversion ×0,6 décidée le 2026-10-10 ; quatre exceptions voulues par le MJ : Attaque sournoise, Frappe Irritée, Flétrissement (non converties) et Éclat de l'âme (×0,9). | — |
| G7 | **Tranche d'Urskaar** : elle se compte sur le déplacement **annoncé** (« a l'intention de parcourir X cases »), partout : 1 tranche à 5 cases, +1 par 3 cases. | Table + libellés |
| G8 | **Progression par améliorations** (rangs 1 à 5, 1 point par niveau à partir du 4, C4 → ultime au niveau 6). Règles complètes au §3.2 de la spec. **Le contenu des rangs 2 à 5 n'est pas conçu.** | Plus tard (lot G) |

---

## 2. Valeurs finales des kits (rang 1)

Coûts en mana donnés **au niveau 2**. Les formules sont celles à coder telles quelles.

### 2.1 Rathäel
| | Avant | Après |
|---|---|---|
| Passif, Âme fendue | Aura de 10 % des PV manquants / soin | **Aura : 8 % des PV max de CHAQUE cible, dégâts magiques, rayon 1, ennemis ET alliés.** Régénération de 10 % PV max par tour inchangée. +10 % AR/RM par charge inchangé. |
| C1 Frappe Irritée | `25 + (30 % +5 %/4 niv) AD + (40 % +5 %/2 niv)(AR+RM)`, ×(1 + 0,20 × charges) ; 20 mana | **`50 % AD × (1 + 0,01 × %PV manquants + 0,20 × charges)`**. Plus de terme AR+RM, plus de bonus fixe, plus de scaling par niveau. Peut criter. **10 mana.** |
| C2 Mur de Givre | 50 mana | Inchangé. **26 mana.** |
| C3 Éclat de l'âme | `50 + 60 % AP + (50 % +10 %/2 niv)(AR+RM)`, +50 % par charge ; 60 mana | **`54 % AP + (45 % + 9 % par 2 niveaux) × (AR+RM)`**, +50 % par charge. Plus de bonus fixe. **30 mana.** |
| C4 / ultime | 1×/combat, 100 mana | Inchangés, **1×/jour**, 100 mana fixe. |

### 2.2 Smith
| | Avant | Après |
|---|---|---|
| Passif Flétrissement | `50 + 0,5 AP` | **Inchangé : `50 + 50 % AP`**, magique, 1×/combat. **Non converti** (exception MJ). |
| C1 Attaque sournoise | Dégâts d'arme, ×1,5 camouflé ; 30 mana | **Multiple de l'attaque de base (0,6 × dégâts d'arme)** : ×1 normale · ×1,5 camouflé · ×2 cible marquée · **×4,5 marquée ET camouflée**. +30 % de chance de crit sous camouflage. **Non convertie** (exception MJ). **13 mana.** |
| C2 Fondu au noir | 40 mana | Inchangé. **21 mana.** |
| C3 Chaînes estropiantes | `50 + 100 % AD`, saignement 5 % + 5 %/100 AD ; 60 mana | Cible choisie : **`72 % AD`** + **saignement de `20 % AD` par tour, dégâts BRUTS** (non converti). Toutes les cibles du cône portent la **chaîne** (exécutées à 10 % de PV). **26 mana.** |
| C4 Voile dimensionnel | 1×/combat, 80 mana | **1×/jour**, 80 mana fixe. 1 tour dans le Voile (3 en ultime). Si la cible y meurt : **+10 % crit et +25 % dégâts crit** (+40 % / +100 % en ultime) **pour tout le combat**, soin de 10 % PV/mana (50 % en ultime). |

Règles de table de Smith (rappels ou aides à l'écran, pas de calcul) :
- **Attaquer fait perdre le camouflage.** Sur un **échec** de l'Attaque sournoise (d20 de 1 à 5) : test
  d'Habileté **DD 13**, `d20 + ⌊Habileté / 4⌋` ; réussi, il garde son camouflage.
- **Marque** : reprise possible au plus tôt 2 tours après la pose, reposable au tour suivant ; si Smith
  tue une cible marquée, la marque passe sur **deux** cibles ; si la cible tombe autrement, elle se
  propage à la plus proche. L'Attaque sournoise ne consomme pas la marque.
- **Saignement et chaîne** : à chaque tour du porteur, après les dégâts de saignement, **2 chances sur 5**
  de s'en défaire (un seul test pour les deux sur la cible choisie). Rien ne part tout seul. Un allié
  peut retirer l'effet par une action mineure.

### 2.3 Urskaar
| | Avant | Après |
|---|---|---|
| Passif Voie de l'ours | +2 initiative ; après 5 cases, attaque de base +150 %, +25 %/3 cases | **+1 initiative, comptée automatiquement.** Attaque de base : **+50 % de l'attaque de base** à 5 cases annoncées, **+25 % par tranche de 3 cases**. +1 PM par tranche (max 3) inchangé. |
| C1 gauche | Attaque de base classique, pas d'attaque d'opportunité ; 30 mana | **`72 % AD + 18 % AD par tranche`** ; pas d'attaque d'opportunité **s'il annonce 5 cases ou plus**. Peut criter. **15 mana.** |
| C1 droite | Attaque de base à 150 % minimum, 50 % d'étourdir | **`54 % AD + 6 % AD par tranche`** ; étourdit à **50 % + 10 % par tranche**. Peut criter. |
| C2 Écrasement | `150 % AD + 25 %/tranche` ; 50 mana | **`90 % AD + 15 % AD par tranche`**, portée 3 + 1 par tranche. **27 mana.** |
| C3 Ralliement | Bouclier 30 % PV + 10 %/50 AP ; 100 mana | Bouclier **30 % PV max + 20 % par 50 AP** (calcul continu, non converti). **50 mana.** |
| C4 On ne m'arrêtera pas | Piétinement `100 % AD + 25 %/tranche` ; 1×/combat | Piétinement **`42 % AD + 12 % AD par tranche`** par unité traversée, une fois par tour. Transformation inchangée (+30 % PV max, AD, Armure, 5 tours). **Alliés adjacents qui ratent leur sauvegarde : le QUART de ce qu'un ennemi subirait** (`10,5 % AD + 3 % AD par tranche` ; c'était 25 % AD + 25 %). **1×/jour**, 100 mana fixe. |

### 2.4 Elias (id `lunick`)
| | Avant | Après |
|---|---|---|
| Passif Instinct du Chasseur | `10 + 5 × (niv − 1)` AD par charge ; max `5 + ⌊(niv − 1)/3⌋` | **6 % de son AD de BASE par charge** ; max **`5 + ⌊(niveau − 1) / 4⌋`** (5 / 6 / 7 / 8 / 9 aux niveaux 1 / 5 / 9 / 13 / 17). Non amélioré par les rangs. |
| C1 Tir Ciblé | Dégâts d'arme ; 10 mana | **`66 % AD`**, **sans crit**. 1er coup sur une cible : +25 % et +2 au jet. Soin de 5 % des dégâts. **10 mana.** |
| C2 Dash Tactique | `50 + 100 % AD` ; 30 mana | **`66 % AD`** s'il finit au corps à corps, et −1 tour de délai. **28 mana.** |
| C3 Frappe Duale | `100 + 150 % AD` ; 30 mana | À distance : **`96 % AD`**, repousse de 4 cases. En mêlée : **`84 % AD`**, marque (+25 % de dégâts subis) **jusqu'à la fin du prochain créneau d'Elias**. **28 mana.** |
| C4 Salve du Corsaire | `50 + 200 % AD` par cible, soin 5 % du total ; 1×/combat | **`78 % AD` par cible**, sans crit ; **soin de 8 % de ses PV max par cible touchée**. **1×/jour**, 60 mana fixe. |

Gain des charges du passif (le joueur monte son compteur) :
1. Chaque **nouvelle cible blessée** : +1 charge (inchangé, vaut aussi pour la Salve).
2. Quand il a touché **toutes les cibles présentes**, le joueur **coche une case dans son passif**
   (aide-mémoire, aucun effet sur le calcul ; remise à zéro par « ⟲ Combat »).
3. Case cochée : +1 charge **à la fin de son tour** s'il a touché **deux cibles différentes** dans le
   tour ; ou, s'il n'y a qu'**une cible**, s'il a concentré sur elle **au moins deux compétences**
   (l'attaque de base gratuite ne compte pas).

### 2.5 Jett
| | Avant | Après |
|---|---|---|
| Passif Nano-hextech | — | Inchangé. |
| C1 Remodulation | Aléatoire ; Poison `25 + 0,5 AP`, Répulsion/Attraction `25 + 0,5 AD` ; 50 mana | Toujours **aléatoire**. Dégâts : **`15 + 30 %`** (AP pour le poison, AD pour répulsion/attraction). **Nouveaux tirages de soutien** (non convertis) : soin **`20 + 40 % AP`** · bouclier **`25 + 50 % AP`** · mana **`15 % du mana max de la cible + 1 % par 40 AP`**. **Tirage : chance ÉGALE pour chaque effet**, soit 10 % chacun pour les 10 effets (Champ électrique, Poison, Duplication, Flash, Repoussement, Attraction, Fumigène, Soin, Bouclier, Mana) — réglage provisoire du MJ. **32 mana.** |
| C2 Alignement de séquence | Étourdit 2 tours, `50 + 50 % AD`, soin `50 + 100 % AP` ; 40 mana | **Étourdit 1 tour** ; **`36 % AD`** ; soin **`40 + 80 % AP`**. **26 mana.** |
| C3 Surcharge destructrice | N'existe pas | **Nouvelle.** Délai 3. Coût **`13 + 4 par cellule (CN)`** au niveau 2. Consomme les CN. Ennemis adjacents à une CN : **`60 + 6 × niveau + 60 % AD`** et **Hémorragie 2 tours**. Alliés adjacents : mana rendu **`20 % de leur mana max + 25 % AP`**. Une cible ne compte qu'une fois. |
| C4 Nano-hex | N'existe pas | **Nouvelle**, détail au §2.6. |

### 2.6 Nano-hex (C4 de Jett)
- **100 mana fixe, 1×/jour.** Consomme toutes les CN du terrain. Dure le combat (ou 10 minutes réelles).
- Joue **au créneau de Jett**. Portée 2, 5 cases de déplacement. Pas de mana.
- **Stats de base** (avec `Mental` et `Magie` = plafond par carac de `LEVELS` au niveau de Jett) :
  `PV = 40,5 × Mental` · `AD = AP = 13,5 × Magie` · `Armure = RM = 2 × Magie` · crit 5 % · dégâts crit 150 %.
- **Par CN, au choix de Jett** : +10 % PV de base · +15 % AD de base · +15 % AP de base · +20 points de crit ·
  +20 points de dégâts crit · +12 Armure · +12 RM.
- **Attaque** : `12 + 72 % de son AD`, mono-cible, chaque tour, peut criter.
- **Rayon** : `12 + 72 % de son AP` **par cible**, à distance, petite zone en croix, **1 tour sur 2**, ne crite pas.
- **Ultime (niveau 6)** : exosquelette d'un allié (encaisse tous les dégâts à sa place, le surplus passe au
  porteur) ; il continue d'attaquer, portée 1, plus de déplacement. Une fois l'ultime utilisée, Jett génère
  **+1 CN par attaque de base en mode cellules**, même si le Nano-hex est détruit.

---

## 3. Grille de mana

`coût(niveau) = arrondi(coût niveau 2 × (1 + 0,08 × (niveau − 2)))`.

| Perso | Compétence | Aujourd'hui | Niv. 2 | Niv. 10 | Niv. 18 |
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
| Jett | Surcharge destructrice | — | 13 + 4 par CN | 21 + 7 | 30 + 9 |

**C4 à coût fixe** : Salve du Corsaire 60 · Voile dimensionnel 80 · On ne m'arrêtera pas 100 ·
Ailes de Givre / Souverain Glacial 100 · Nano-hex 100.

Cibles du MJ atteintes (tours « C1 + C2 ou C3 » payables, niveau 2 → 18) : carry 3,0 → 5,3 ; bruiser
4,2 → 7,7 ; tank 5,6 → 10,1 ; spécialiste du mana 7,0 → 12,9.

---

## 4. Les lots, dans l'ordre

Chaque lot est livrable seul. **Avant de toucher un fichier, lire `docs/archi/combat.md`** (actions en
attente, `buildCastPlan`, modes d'attaque de base).

### Lot A — Attaque de base à 60 % ⚠️ effet en jeu immédiat pour tous
- `basicAttackProfile` (`game-logic.js:778`) : `power = stat × ratio` → ajouter le facteur 0,6.
  Appelée par `pages-competences.jsx` et `pages-sheet.jsx` ; 17 tests.
- **Le facteur 0,6 se MULTIPLIE avec tout le reste** (décision du 2026-10-10) : c'est une échelle globale de
  l'attaque de base, par exemple une constante `BASIC_ATTACK_RATIO = 0.6` appliquée à `power`. Arme normale
  60 % ; **dual wield de mini-armes 60 % au total (36 % + 24 %)**, donc toujours « exactement une arme
  normale » ; mini-arme seule 36 % ; sans maîtrise ×0,75 par-dessus. Tous les écarts chiffrés de
  `docs/armes-maitrises.md` restent vrais, et le dual wield des carrys n'est pas pénalisé.
- L'Attaque sournoise de Smith passe par `skillBaseDamage`, pas par le profil d'arme : elle ne subit pas le
  ratio des mini-armes, comme aujourd'hui.
- Vérifier les propriétés d'armes qui dérivent de l'attaque de base (`buildWeaponAttack`).
- **Ne pas** toucher à `skillBaseDamage` ici : les compétences ne passent pas par `basicAttackProfile`.

### Lot B — Coût en mana par niveau ⚠️ effet en jeu immédiat
- Nouveau helper pur `skillManaCost(sk, level)` ; `sk.mana` de `SKILLS` (`data.jsx`) devient le **coût
  du niveau 2** ; un drapeau (ex. `manaFixed: true`) pour les C4.
- `buildCastPlan` (`game-logic.js:1974`) lit le coût en un seul endroit (`cost.mana`, ligne ~2012) ;
  il lui faut le niveau. Affichage du coût dans `pages-competences.jsx`.
- Coût par cible `manaPer` : la Surcharge de Jett (`4 par CN`) suit la même pente.

### Lot C — Kits rang 1, un perso à la fois ⚠️ effet en jeu immédiat (C1, C2, passifs)
Fonctions de `game-logic.js` à réécrire, avec leur note dans `SKILLS` (`data.jsx`) et leurs tests :

| Perso | Fonctions | Points d'attention |
|---|---|---|
| Rathäel | `dmgRathaelC1` (7 tests), `dmgRathaelC3` (4 tests) | La C1 a besoin des **PV actuels et max** dans le contexte de cast (à vérifier). Elle ne dépend plus du niveau. |
| Smith | `dmgSmithPassif`, `dmgSmithC1`, `dmgSmithC3`, `smithBleedPct` | C1 : nouvelle case **« cible marquée »** à côté de « camouflé » (`vars` de `pages-competences.jsx:357`). Le saignement devient un nombre (20 % AD), plus un pourcentage. |
| Urskaar | `dmgUrskaarC1` (3 tests), `dmgUrskaarC2`, `dmgUrskaarC4`, `urskaarC3Shield`, `bearBonusPct` (3 tests) | Le champ « Cases » devient « cases annoncées ». La droite affiche sa chance d'étourdir. `bearTranches` ne change pas. |
| Elias | `dmgEliasC1`, `C2`, `C3`, `C4` (5 tests) | C3 : deux valeurs (distance / mêlée). C4 : le soin devient `8 % PV max × cibles touchées`, plus `skillHeal(total, 5 %)`. |
| Jett | `dmgJettPoison`, `dmgJettForce`, `dmgJettC2`, `healJettC2` | C1 : trois nouveaux effets de soutien (soin, bouclier, mana) → instances `heal` / `status` de l'action en attente. |

### Lot D — Passifs
- **Elias** : `eliasPassiveAD` devient un % de l'AD de base (`sumPassiveMods`, `game-logic.js:2209`, reçoit
  déjà `base`, comme pour Rathäel) ; `eliasMaxStacks` passe à `/ 4` ; 2 tests. Case à cocher dans le passif
  (compteur ou drapeau dans `state.counters`, remis à zéro par « ⟲ Combat »).
- **Urskaar, initiative** : le score vaut `d6 + bonus` (`initiativeTotal`, `game-logic.js:1667`) et `bonus`
  n'est écrit que par le MJ (le joueur n'écrit que `d6`). Ajouter un **bonus personnel porté par le kit**
  (ex. `passive.initBonus: 1` dans `SKILLS`) **additionné au calcul**, sans écriture en base ni changement
  de règle RTDB. Lire `docs/journal/2026-09-02.md` avant.
- **Rathäel** : l'aura d'Âme fendue reste gérée à la table ; mettre à jour la note du passif.

### Lot E — C4 une fois par jour (aucun effet en jeu avant le niveau 4)
- `kind: 'combat'` → nouveau `kind` (ex. `'day'`) pour les cinq C4 et l'ultime de Rathäel.
- La sentinelle `CD_LOCKED` (`pages-competences.jsx:90`) est levée par « Nouveau combat » : il faut un
  verrou **que « ⟲ Combat » ne lève pas**, et un bouton MJ « Nouveau jour ».
- ⚠️ Ne pas confondre avec `WEAPON_CD_LOCKED` (propriétés d'armes, qui restent 1×/combat).

### Lot F — C3 et C4 de Jett (aucun effet en jeu avant les niveaux 3 et 4)
- C3 Surcharge destructrice : dégâts + Hémorragie (débuff déjà dans `BUFFS`) + don de mana, coût par CN.
- C4 Nano-hex : un compagnon. S'appuyer sur les **PNJ alliés** de l'initiative (2026-09-02). À concevoir
  avant de coder (fiche du compagnon, choix des CN, exosquelette).

### Lot G — Progression par rangs (à ne PAS coder maintenant)
Règles décidées (§3.2 de la spec) : `skillRanks {skillId: rang}`, points déduits du niveau, C4 apprise par
choix, ultime au niveau 6, remise à zéro par le MJ, règle RTDB pour que le joueur écrive ses rangs.
**Bloqué** : le contenu des rangs 2 à 5 et les versions ultimes d'Elias et d'Urskaar ne sont pas conçus.

### À chaque livraison de code
- `node --test test/game-logic.test.js` et `node --test test/auth.test.js` (313 tests verts au départ).
- Bumper le jeton de cache d'`index.html` (actuel : `20261005-2`).
- Une entrée `docs/journal/<date>.md` + une ligne dans l'index de `CLAUDE.md`.

---

## 5. À annoncer à la table (dès les lots A à D)
- L'attaque de base tombe à 60 % de l'AD/AP pour tout le monde.
- Les coûts en mana changent (presque tous baissent au niveau 2) et monteront avec le niveau.
- **Elias** : une charge passe de 15 à 11 AD au niveau 2 (+56 au lieu de +75 à pleines charges) ; Frappe
  Duale et Dash perdent leur bonus fixe.
- **Urskaar** : +1 en initiative au lieu de +2 ; nouvelle gauche / droite ; bonus de charge réduit.
- **Rathäel** : Frappe Irritée dépend de ses PV manquants, plus de ses résistances ; Éclat de l'âme sans
  son bonus fixe.
- **Smith** : Attaque sournoise ×4,5 sur cible marquée sous camouflage ; nouvelles règles de marque.
- **Jett** : Alignement de séquence n'étourdit plus qu'un tour ; la C1 gagne des effets de soutien.
- Règles de table : C2 **ou** C3 par tour ; round de surprise limité à l'attaque de base et à la C1.

---

## 6. Questions encore ouvertes

**Q1 à Q4 : tranchées par le MJ le 2026-10-10** et reportées dans les sections ci-dessus (Flétrissement non
converti ; alliés piétinés au quart des dégâts ; tirage équiprobable de la C1 de Jett ; attaque de base
multiplicative avec les mini-armes). **Aucune question ne bloque les lots A à F.**

**Conception restante (hors lots A à F) :**
- Ce que rapporte un rang d'amélioration (questions du §4.6 de la spec), puis le contenu des rangs 2 à 5.
- Versions ultimes des C4 d'Elias et d'Urskaar.
- Dimensionner les monstres pour les durées visées (standard 6-7 rounds, élite 9-10, boss 13-15).

**Constat connu, non corrigé** : même après conversion, le groupe qui joue en premier garde un avantage
net (§8.14 de la spec). La règle de surprise G3 l'atténue sans le supprimer.
