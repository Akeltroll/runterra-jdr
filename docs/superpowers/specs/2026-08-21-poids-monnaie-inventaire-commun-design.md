# Poids de la monnaie + capacité de l'inventaire commun

> **Statut : SPEC, non implémentée.** Écrite le 2026-08-21 à partir de
> `info-mj/Systeme de poids - Inventaire commun (formules).md` (document de règles du MJ) et du
> §3 de `info-mj/Économie - guide des joueurs.md` (poids des pièces).
> Ce document **contextualise** ces règles au dépôt : ce qui existe déjà, ce qui manque, et où
> ça s'accroche. Le découpage en étapes est dans le plan jumeau
> `docs/superpowers/plans/2026-08-21-poids-monnaie-inventaire-commun.md`.
>
> ⚠️ **Une republication des règles RTDB est nécessaire** (§6). C'est le seul point qui ne peut
> pas être fait en code seul.
>
> **Deux décisions ont été révisées par le MJ après essai en jeu**, et ce sont les plus
> structurantes du chantier : le canal `g` ne se déclenche plus par présence dans le coffre mais
> par **emplacement d'attelage** (§5.1), et la capacité commune est ramenée à une **fraction** de
> la somme des capacités (§5.2, écart assumé au doc du MJ).

---

## 1. D'où ça vient

Deux demandes du MJ, liées par la même mécanique :

1. **Les pièces doivent peser.** Le guide des joueurs l'annonce déjà aux joueurs (§3, « Le poids
   de votre bourse ») et s'en sert comme argument de jeu (« convertissez », « le butin pèse »).
   Aujourd'hui **aucune pièce ne pèse quoi que ce soit dans l'app** : `carriedWeight` ne regarde
   que `items`, jamais `coins`. Un joueur peut porter 40 000 cuivres sans jamais quitter l'état
   *Léger*. La règle est écrite côté fiction, pas côté outil.
2. **Le coffre commun doit avoir une limite.** C'est la question posée directement par le poids
   de la monnaie : si le butin pèse, où le pose-t-on ? Le doc du MJ répond par un modèle complet
   (capacité extensive = somme, confort intensif = moyenne).

Les deux se rejoignent sur un même écran : la page **Inventaire commun**, aujourd'hui la seule
grille d'inventaire de l'app **sans aucune jauge de charge**.

---

## 2. Ce qui existe déjà (et qu'il ne faut pas réécrire)

Le système **individuel** décrit en rappel au §2 du doc du MJ est **déjà implémenté à
l'identique** dans `game-logic.js`. Le doc ne le sait pas (il annonce « ne traite pas de
l'implémentation ») — d'où ce tableau de correspondance, à lire avant de coder :

| Doc MJ | Code existant (`game-logic.js`) | État |
|---|---|---|
| `Capacité = 30 + Force×5 + Mental×Niveau÷10` | `carryCapacity(force, mental, level, equipment, itemsById)` (+ `CARRY_BASE=30`, `CARRY_PER_FORCE=5`) | ✅ identique |
| `Confort = min(90 % ; 60 % + Habileté×2 %)` | `comfortPct(hab)` | ✅ identique |
| États Léger / Encombré / Surchargé | `weightStatus(carried, cap, hab)` → `state: 'leger' / 'encombre' / 'surcharge'` | ✅ identique |
| Réduction Mental du poids d'armure (§7) | `armorWeightReduction` / `armorEffectiveWeight`, appliquée par `carriedWeight` au seul slot `armure` | ✅ identique |
| Bonus de transport **personnel** `p` (§6) | champ `item.carry`, sommé sur les objets **équipés** par `carryCapacity` | ✅ existe |
| Poids d'un objet | champ `item.weight` | ✅ existe |

⚠️ **`CLAUDE.md` est périmé sur ce point** : il annonce `CARRY_BASE(10) + force×CARRY_PER_FORCE(5)`
et ne mentionne ni le Mental ni le niveau. Le code dit `30 + Force×5 + Mental×Niveau÷10`. C'est le
**code** qui est juste (aligné sur le doc MJ) ; la note de CLAUDE.md date d'avant l'intégration du
travail de Woolost (2026-08-16). À corriger au passage.

**Sites d'affichage actuels de la charge :** `pages-equip.jsx` (jauge complète avec repère de
confort), `pages-admin.jsx` (compteur `⚖ porté/cap` dans `CharInventoryAdminPanel`), `pages-mj.jsx`
(poids effectif dans l'infobulle du mini-sac). La **fiche joueur n'a pas de jauge** malgré ce
qu'annonce CLAUDE.md.

---

## 3. Ce qui manque — trois briques

### A. Le poids des pièces
Aucune notion de poids de monnaie dans le code. Barème du guide (§3 + aide-mémoire) :

| Monnaie | Pièces pour 1 unité de poids | Poids unitaire |
|---|---|---|
| Or | 67 *(la plus lourde)* | 1/67 ≈ 0,0149 |
| Argent | 100 | 1/100 = 0,01 |
| Cuivre | 200 | 1/200 = 0,005 |
| Platine | 200 *(la plus légère)* | 1/200 = 0,005 |

> **Contre-intuition à ne pas « corriger »** : le barème n'est **pas** monotone avec la valeur.
> Le platine (la plus précieuse) est la **plus légère**, l'or la **plus lourde**. C'est délibéré
> et expliqué dans le guide (l'or est frappé large pour se soupeser, le platine tient sur un
> ongle). Un futur lecteur du code y verra une faute de frappe : le commenter.

### B. Le canal « groupe » des objets de transport (§6 du doc MJ)
Un objet porte **deux bonus indépendants** : `p` (capacité individuelle du porteur) et `g`
(capacité commune). Le code n'a que `p` (`item.carry`). **Il manque le champ `g`.**

### C. La capacité / le confort / l'état du coffre commun (§3-5 du doc MJ)
N'existe pas du tout. Formules :

```
Capacité commune      = ⌊ Σ_i (30 + Force_i×5 + Mental_i×Niveau_i÷10) + Σ g ⌋
Confort commun (%)    = (1/n) × Σ_i min(90 % ; 60 % + Habileté_i×2 %)
Seuil de confort      = ⌊ Confort commun (%) × Capacité commune ⌋
État                  = Léger (W ≤ seuil) · Encombré (seuil < W ≤ capacité) · Surchargé (W > capacité)
```

⚠️ **On ne peut pas réutiliser `carryCapacity()` telle quelle** pour le terme `Σ_i`, pour deux
raisons :

1. elle **arrondit à l'inférieur individuellement**, alors que le doc arrondit **une seule fois à
   la fin** (`⌊ Σ … ⌋`). Sur le groupe actuel l'écart est de 1 unité (73 contre 74 après le ratio
   du §5.2 ; 246 contre 247 sur la somme brute) — petit, mais silencieux et durable ;
2. elle **ajoute le bonus `carry` personnel des objets équipés**, ce que le §3 du doc exclut
   explicitement du calcul commun (« les bonus de transport personnels ne comptent pas ici »).

→ il faut extraire un `carryBaseRaw(force, mental, level)` **non arrondi et sans bonus**, que
`carryCapacity` réutilise et sur lequel le calcul commun s'appuie.

---

## 4. Le groupe actuel, chiffré

Les 5 personnages de `data.jsx`, tous niveau 2, sans aucun objet de transport de groupe :

| Perso | Force | Mental | Hab. | Capacité de base `30+5F+M×Niv÷10` | Confort |
|---|---|---|---|---|---|
| Rathäel | 4 | 4 | 3 | 30 + 20 + 0,8 = **50,8** | 66 % |
| Urskaar | 6 | 5 | 1 | 30 + 30 + 1,0 = **61,0** | 62 % |
| Smith | 3 | 1 | 6 | 30 + 15 + 0,2 = **45,2** | 72 % |
| Elias Crowe | 5 | 3 | 4 | 30 + 25 + 0,6 = **55,6** | 68 % |
| Jett | 1 | 1 | 6 | 30 + 5 + 0,2 = **35,2** | 72 % |

- **Somme brute** (le « Σ_i » du doc) = **247,8**
- **Capacité commune** = ⌊247,8 × 0,30⌋ = **74**  ← voir le ratio du §5.2
- **Confort commun** = (66+62+72+68+72)/5 = **68 %**
- **Seuil de confort** = ⌊0,68 × 74⌋ = **50**

Ces nombres sont le test de recette le plus utile : ils doivent apparaître tels quels sur la
page Inventaire commun tant qu'aucun objet n'est attelé.

**Ordre de grandeur du poids-monnaie** : ~10 000 cuivres suffisent à eux seuls à faire basculer le
coffre en *Encombré* (c'était ~33 000 avant le ratio). Le poids de la monnaie mord donc à partir
d'un vrai magot, sans être une punition de tous les jours — conforme à l'intention du guide
(« un trésor de 500 pièces d'argent pèse 5 unités… la même valeur en cuivre pèserait 25 unités »).

---

## 5. Décisions du MJ (2026-08-21)

| Question | Décision |
|---|---|
| Jauge commune visible des joueurs ? | **Oui** — ouvrir en lecture les nœuds nécessaires aux inscrits (§6), plutôt que réserver au staff ou dénormaliser. |
| Quand le bonus `g` compte-t-il ? | **RÉVISÉ après test → §5.1** (emplacements d'attelage). |
| Ampleur de la capacité commune | **RÉVISÉE après test → §5.2** (ratio de portage collectif, écart assumé au doc). |
| Arrondi du poids fractionnaire des pièces | **Exact en interne**, arrondi **à l'affichage seulement** (1 décimale). Pas de plancher/plafond par bourse. |

### 5.1 — Révision du canal `g` : emplacements d'attelage (2026-08-21, après essai)

La décision initiale (« le `g` compte que l'objet soit dans le coffre **ou** équipé ») a été **revue
par le MJ** au premier essai. Sa règle définitive :

> Un objet n'apporte sa capacité de groupe que **placé dans un emplacement de transport actif**
> (monture, sacs spécifiques).

**Pourquoi c'est meilleur**, et pas seulement différent :
- ça **borne** l'effet. Avec la règle « présence dans le coffre », dix sacs rangés en vrac auraient
  donné +200 de capacité — un exploit trivial, et un coffre qui s'auto-agrandit en s'auto-remplissant ;
- ça **supprime le besoin d'ouvrir les inventaires personnels**. Les emplacements vivent sur le coffre
  commun, donc dans un nœud déjà partagé. Le patch de règles se réduit à `attrs` + `level`, et
  le piège du §7.1 **disparaît** : les inventaires persos restent privés.

**Forme retenue** : 5 emplacements (**2 montures + 3 sacs**), dans un nouveau nœud partagé
`campaign/runeterra/sharedTransport = { [slotKey]: itemId }`, R/W pour tout inscrit — ranger la
monture du groupe n'est pas un acte de MJ.

**Conséquence sur le lot 2 déjà livré** : `sumGroupCarry` (qui sommait le coffre entier + les objets
équipés) a été **supprimé**, pas laissé à côté — deux règles concurrentes dans `game-logic.js`
auraient trompé le prochain lecteur. Remplacé par `sumTransportCarry(transport, items)`.

---

### 5.2 — Le ratio de portage collectif (2026-08-21, après essai) — ÉCART ASSUMÉ AU DOC MJ

Le §3 du doc pose **« Capacité commune = Σ des capacités individuelles »**, soit **247** pour le
groupe actuel. À l'essai, le MJ a identifié que c'était trop, et il a raison — voici pourquoi
chiffré :

Dans l'app, le coffre commun est un stockage **séparé** des inventaires personnels. À pleine somme,
le groupe dispose donc de **247 (sacs persos) + 247 (coffre) ≈ 494 unités**, soit le double de sa
capacité réelle de portage. Et le seuil d'encombrement du coffre tombait à **167** — alors qu'une
armure lourde pèse 20 : il aurait fallu y entasser huit armures pour seulement quitter l'état
*Léger*. En pratique, la jauge n'aurait jamais bougé.

**Décision : le coffre ne vaut qu'une FRACTION de la capacité collective** — ce que le groupe peut
porter *en plus* de ce qu'il a déjà sur le dos. `GROUP_CARRY_RATIO = 0.30`.

| | Avant | Après |
|---|---|---|
| Capacité du coffre | 247 | **74** |
| Seuil de confort | 167 | **50** |
| Cuivres pour encombrer | ~33 000 | **~10 000** |

Le résultat retombe dans les ordres de grandeur du **guide d'économie**, ce qui est un bon signe
d'équilibrage : « dépouiller quatre brigands en armure légère représente 22 unités de charge, pour
une charge maximale de 30 à 80 au niveau 1 ».

**Deux garde-fous de conception :**
- `groupCarryBase(profiles)` expose la somme **brute**, restée exactement conforme au doc et testée
  contre son exemple du §9 (352). C'est le **ratio** qui s'écarte du document, pas le calcul — de
  quoi rester vérifiable ligne à ligne contre la source de vérité du MJ.
- **Le ratio ne s'applique pas au bonus d'attelage.** Une monture est intégralement dédiée au
  portage collectif : il n'y a rien à en défalquer. C'est aussi ce qui donne son intérêt au
  système — un chameau à +50 pèse plus lourd dans le calcul que les 5 personnages réunis (+74).

`GROUP_CARRY_RATIO` est **le curseur d'équilibrage** de tout ce système : une constante d'une ligne
en tête du bloc poids de `game-logic.js`, à bouger librement après quelques séances.

## 6. Règles RTDB — le patch

Aujourd'hui `characters/$charId` a un `.read` **restreint** : « staff, ou le joueur dont c'est le
personnage ». Un joueur ne peut donc rien lire des quatre autres fiches. Le patch **n'y touche
pas** et se contente d'**ouvrir quatre sous-nœuds** en lecture aux inscrits :

**Périmètre réduit par la révision du §5.1** : `equipment` et `inventory` ne sont plus nécessaires,
puisque le canal `g` vit désormais sur le coffre commun. Deux `.read` suffisent, plus le nouveau
nœud d'attelage.

```json
"sharedTransport": {
  ".read":  "auth != null && root.child('users').child(auth.uid).child('role').exists()",
  ".write": "auth != null && root.child('users').child(auth.uid).child('role').exists()",
  "$slot": { ".validate": "!newData.exists() || newData.isString()" }
},

"characters": {
  "$charId": {
    ".read":  "…INCHANGÉ…",
    ".write": "…INCHANGÉ…",
    "state": {
      "attrs": { ".read": "auth != null && root.child('users').child(auth.uid).child('role').exists()" },
      "level": { ".read": "auth != null && root.child('users').child(auth.uid).child('role').exists()" },
      "coins": { "$coin": { ".validate": "…INCHANGÉ…" } }
    }
  }
}
```

Ce qui **reste fermé** aux autres joueurs : `hpCur`/`manaCur`/`shield`, `xp`, `modifiers`, `coins`,
**`inventory`**, **`equipment`**, `buffs`, `runes`/`runeBonus`, `counters`, `cooldowns`, `skillBuffs`.
Aucune **écriture** n'est élargie sur les fiches : un joueur ne peut toujours écrire que sur la sienne.

**Avant publication, le comportement est dégradé mais pas faux** : un joueur ne pouvant pas lire
`attrs`/`level` des autres, `useGroupCarry` replie sur `data.jsx` — ce qui donne aujourd'hui la
**bonne** valeur, puisqu'aucun perso n'a encore de `state.attrs` en base. La jauge reste donc juste
**jusqu'à la première respec**. L'attelage, lui, est déjà refusé en écriture aux joueurs (le MJ, étant
staff, peut atteler). Des `permission_denied` apparaissent en console.

⚠️ **Ne pas retaper les `.read`/`.write` existants de mémoire.** Éditer chirurgicalement et
vérifier par `diff` contre `HEAD` avant publication — une règle réécrite de tête a déjà failli
verrouiller tout le monde (leçon du chantier monnaie, §3 de la spec du 2026-08-20).

Publication : `firebase deploy --only database` depuis la racine (la CLI est configurée depuis le
2026-08-21), ou console en secours. **La CLI n'affiche aucun diff** : comparer avant.

---

## 7. Pièges

### 7.1 — ~~L'inventaire perso devient lisible par les autres~~ — ÉVITÉ
Ce piège était la contrepartie du choix initial (« le `g` compte aussi quand l'objet est équipé ») :
pour lire le `g` d'un objet équipé, il aurait fallu lire l'inventaire de son porteur.

**La révision du §5.1 l'annule** : les emplacements d'attelage vivent sur le coffre commun, déjà
partagé. Les inventaires personnels **restent privés**. Un bon rappel que la contrainte technique
et la règle de jeu se répondent — le MJ a resserré la règle pour de bonnes raisons de jeu, et
l'exposition tombait d'elle-même.

### 7.2 — `useAllCharStates()` ne marchera PAS, même après le patch
Ce hook s'abonne au nœud **parent** `campaign/runeterra/characters`, qui reste staff-only. Or en
RTDB, **ouvrir un enfant n'ouvre pas le parent** — c'est la version lecture de la leçon déjà
apprise à l'écriture (« un `.write` sur `$id` n'autorise pas le nœud parent », bug du journal,
2026-08-21). Un abonnement au parent sera rejeté et retombera sur `null`, silencieusement.

→ D'où `useGroupCarry`, qui s'abonne aux chemins **feuilles**, perso par perso
(`characters/{id}/state/attrs` et `/level`), soit 2 × 5 = 10 abonnements. RTDB encaisse sans
difficulté.

⚠️ Et surtout : **ne jamais faire dépendre une écriture de ce hook**. C'est très exactement ce qui
a écrasé la bourse d'Elias le 2026-08-21 (`useAllCharStates` à `null` → repli `{0,0,0,0}` →
écriture d'une valeur fausse). Ici le hook n'alimente **que de l'affichage** : une jauge fausse est
une gêne, pas une corruption. Cette contrainte doit rester vraie.

### 7.3 — `attrs` et `level` sont absents par défaut
`state.attrs` n'existe que si le perso a fait une respec, `state.level` que si le MJ a bougé le
stepper. Le repli est `char.attrs` / `char.level` de `data.jsx` — **exactement comme le fait déjà
`charBaseStats`**. Un abonnement qui rend `null` n'est donc pas une erreur : c'est le cas nominal
aujourd'hui pour les 5 persos. Le calcul commun doit traiter `null` comme « prends la valeur de
`data.jsx` », jamais comme 0.

### 7.4 — Ne pas compter deux fois le `g`
Depuis la révision du §5.1 le risque est réduit, mais pas nul : rien n'empêche le **même objet**
d'occuper deux emplacements d'attelage. `sumTransportCarry` dédoublonne donc par `itemId`, et
compte le bonus **par pile** et non par unité (trois sacs empilés = un bonus, pas trois) —
cohérent avec ce que `carryCapacity` fait déjà du canal personnel.

### 7.5 — Le poids de l'armure ne s'allège pas dans le coffre (§7 du doc MJ)
`carriedWeight` applique `armorEffectiveWeight` au seul objet du slot `armure` du porteur. Le
coffre commun n'a **pas de porteur** : il faut l'appeler sans `equipment`, ce qui donne déjà le
poids de base. Comportement correct par construction — mais à ne pas « améliorer » par erreur en
lui passant le Mental d'un joueur.

---

## 8. Ce qui est ajouté au modèle de données

| Chemin / champ | Nature | Détail |
|---|---|---|
| `item.carryGroup` | **nouveau** champ d'item (nombre ≥ 0) | Canal `g` du §6. Absent = 0. Disponible sur **toutes** les catégories (une monture ou un sac large peut être rangé en `Butin`), contrairement à `item.carry` qui reste réservé à `cat === 'Équipement'` puisqu'il faut l'équiper pour en profiter. |

**Aucun nouveau nœud Firebase, aucune migration.** Le champ vit dans les items existants
(`inventory`, `sharedInventory`, `catalog`), et un item sans `carryGroup` vaut 0.

---

## 9. Surfaces d'affichage visées

| Écran | Ajout |
|---|---|
| **Inventaire commun** (`pages-inventory.jsx`) | La jauge de charge du coffre : `W / capacité commune`, repère de confort, état coloré Léger/Encombré/Surchargé. Infobulle détaillant Σ capacités + Σ `g`. C'est la livraison principale. |
| **Pied de `InventoryGrid`** (`components.jsx`) | Poids de la bourse affichée, à côté des 4 pièces. Bénéficie d'un coup aux 3 grilles (fiche, coffre commun, Équipement). |
| **Jauge Équipement** (`pages-equip.jsx`) | Le poids de `state.coins` entre dans la charge portée. |
| **Compteur Admin** (`pages-admin.jsx`) | Idem, pour rester cohérent avec la jauge que voit le joueur. |
| **Éditeur d'item** (`InvItemRow`) | Champ « Capacité groupe (+coffre) » à côté de « Capacité (+charge) ». |
| **Infobulles d'objet** (`ItemTooltip`) | Mention du bonus `g` quand il est non nul. |

---

## 10. Recette

Vérifications de bout en bout, une fois déployé :

1. Coffre vide, rien d'attelé → la page affiche **74** de capacité et **50** de seuil (§4).
   Si c'est 73, l'arrondi ne se fait pas une seule fois à la fin (⌊247,8 × 0,30⌋ = ⌊74,34⌋ = 74).
2. L'exemple du §9 du doc MJ (4 joueurs) → somme brute **352** et confort **74,5 %** inchangés
   (`groupCarryBase`), capacité **175** après ratio et attelage. À couvrir en test unitaire.
3. 67 pièces d'or dans une bourse → **1** unité de poids. 500 argents → **5**. 199 cuivres →
   **~1**, pas 0 (c'est le contrôle du choix « exact en interne »).
4. **Avec un compte de rôle `joueur`** (pas seulement en MJ) : la jauge du coffre commun affiche
   les mêmes nombres que chez le MJ. C'est le seul test qui valide le patch de règles — le bug de
   la bourse écrasée était invisible en MJ.
5. Un sac large (`g = 20`) simplement **rangé dans le coffre** → capacité toujours **74** (c'est le
   cœur de la révision du §5.1). **Attelé** dans un des 3 emplacements « sac » → **94** (le bonus
   passe entier, sans ratio). Dételé → retour à **74**. Dix sacs rangés en vrac sans être attelés →
   toujours **74**.
6. Un objet sans `carryGroup` est **refusé** à l'attelage, même avec le bon type. Un objet typé
   « monture » est refusé dans un emplacement « sac ». Un objet **non typé** avec `carryGroup > 0`
   passe partout (un sac rangé en Butin ne peut pas être typé — le champ « Emplacement » n'apparaît
   que pour `cat === 'Équipement'`).
7. Un joueur tente de lire `hpCur` ou `inventory` d'un autre perso (console Firebase / DevTools) →
   toujours **refusé**. Le patch n'ouvre que `attrs` et `level`.
