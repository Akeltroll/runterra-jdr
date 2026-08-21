# Plan — Poids de la monnaie + capacité de l'inventaire commun

Spec : `docs/superpowers/specs/2026-08-21-poids-monnaie-inventaire-commun-design.md` (à lire d'abord :
les §7 « Pièges » évitent trois soirées perdues).

**Découpage en 3 lots indépendants.** Le lot 1 se déploie seul et sans règle RTDB ; les lots 2 et 3
partagent une seule republication de règles. Ordre recommandé : 1 → 2 → 3.

| Lot | Contenu | Règle RTDB ? | Livrable visible | État |
|---|---|---|---|---|
| **1** | Poids de la monnaie | non | Les bourses pèsent partout où une charge est déjà affichée | ✅ livré, cache `20260821-3` |
| **2** | Canal `g` (`item.carryGroup`) | non | Un objet peut porter un bonus de capacité de groupe | ✅ livré, cache `20260821-4` |
| **3** | Capacité / confort / état du coffre commun **+ attelage** | **oui** | La jauge de charge de l'Inventaire commun | ✅ code livré, cache `20260821-5` — ⚠️ **règles non publiées** |

> **Lot 3 livré le 2026-08-21. 182 tests verts.** Écart majeur au plan : le MJ a **révisé la règle du
> canal `g`** au premier essai (§5.1 de la spec) — un objet ne compte que **placé dans un emplacement
> d'attelage** (2 montures + 3 sacs, nœud `sharedTransport`), plus par simple présence dans le coffre.
> Conséquences : `sumGroupCarry` (lot 2) **supprimé** au profit de `sumTransportCarry` ; le patch de
> règles se **réduit** à `attrs` + `level` (les inventaires persos restent privés — le piège du §7.1
> de la spec disparaît) ; ajout du nœud `sharedTransport`.
>
> **Second retour de test, même jour** : la capacité commune (247) était trop haute — le coffre étant
> un stockage *séparé* des sacs persos, le groupe disposait de ~494 unités et le seuil d'encombrement
> (167) n'aurait jamais été atteint. Ajout de **`GROUP_CARRY_RATIO = 0.30`** (§5.2 de la spec) :
> capacité **74**, seuil **50**. Le ratio **ne s'applique pas à l'attelage** (bonus plein), et
> `groupCarryBase` expose la somme brute restée conforme au doc. Cache `20260821-6`.
>
> ✅ **Règles publiées le 2026-08-22** (`firebase deploy --only database`, après `npm i -g
> firebase-tools` + `firebase login`). Vérifiées **avant** (aucune dérive console : l'en-ligne était
> identique au dernier commit) et **après** (le diff ne montre que les 3 ajouts attendus), grâce à
> `firebase database:get "/.settings/rules" --instance runeterra-jdr-default-rtdb` — commande qui
> sort les règles puis **quitte en code 255**, erreur cosmétique à ignorer.

> **Lots 1 et 2 livrés le 2026-08-21, en attente de validation visuelle du MJ.** 177 tests verts
> (game-logic 166 + auth 11). Écarts au plan initial, tous des ajouts :
> - **lot 1** — `coins` était déclaré ~60 lignes *après* la jauge dans `pages-equip.jsx` ; l'utiliser
>   tel quel levait un `ReferenceError` en zone morte temporelle (page blanche, pas un chiffre faux).
>   Déclaration remontée au-dessus de la jauge, avec commentaire sur la dépendance d'ordre.
> - **lot 2** — `sumGroupCarry` **dédoublonne par `itemId`** : deux slots pointant le même objet ne
>   comptent qu'une fois. Non prévu, deux lignes, ferme une classe de bug silencieux.
> - **lot 2** — le bonus est compté **par pile** et non par unité (deux ceintures empilées ne doublent
>   pas la capacité), aligné sur ce que `carryCapacity` fait déjà pour le canal personnel.
>
> **Aucun contenu de jeu n'a été ajouté** : ni « sac large » ni monture dans `ITEM_CATALOG` — les prix
> et les objets relèvent du MJ. Pour tester, créer un objet personnalisé et lui donner un `carryGroup`.

---

## Lot 1 — Le poids de la monnaie

### 1.1 `game-logic.js` — logique pure

```js
/* Poids des pièces (guide d'économie §3) : nombre de pièces pour UNE unité de poids.
   ⚠️ Le barème n'est PAS monotone avec la valeur : l'or (la plus précieuse après le
   platine) est la PLUS LOURDE, le platine la PLUS LÉGÈRE. C'est voulu, pas une coquille. */
var COIN_PER_WEIGHT = { cuiv: 200, arg: 100, or: 67, plat: 200 };

function coinsWeight(coins) { ... }   // Σ (qty / COIN_PER_WEIGHT[k]), valeur EXACTE (fractionnaire)
```

- `coinsWeight` ignore les clés inconnues, traite `null`/absent comme 0, ne borne pas.
- **Aucun arrondi** : la décision du MJ est « exact en interne, arrondi à l'affichage ».

### 1.2 `carriedWeight` — 4e paramètre optionnel

`carriedWeight(items, mental, equipment, coins)` : ajoute `coinsWeight(coins)` au total.

**Pourquoi un paramètre plutôt qu'une addition sur chaque site d'appel** : il n'y a que 2 sites qui
calculent une charge (`pages-equip`, `pages-admin`), mais tout site futur en oublierait un. Le
paramètre étant optionnel, **les 5 tests existants de `carriedWeight` passent sans modification**.

### 1.3 `components.jsx` — formatage

- `invWeightFmt(n)` : entier tel quel, sinon **1 décimale** (`toLocaleString('fr-FR', {maximumFractionDigits:1})`).
  Utilisé partout où un poids peut être fractionnaire.
- Pied de `InventoryGrid` : après les 4 pièces, `⚖ {invWeightFmt(coinsWeight(coins))}` quand le
  total est > 0. Gain gratuit sur les 3 grilles (fiche, coffre, Équipement).

### 1.4 Branchements

| Fichier | Changement |
|---|---|
| `pages-equip.jsx` | `carriedWeight(itemsById, carryMental, equipment, state.coins)` ; la jauge affiche `invWeightFmt` (elle peut désormais tomber sur un décimal). |
| `pages-admin.jsx` | idem sur `invWeight` (`state.coins`), même formatage. |

### 1.5 Tests (`test/game-logic.test.js`)

1. `coinsWeight({})` = 0 ; `coinsWeight(null)` = 0.
2. `coinsWeight({ or:67 })` = 1 ; `{ arg:500 }` = 5 ; `{ cuiv:200 }` = 1 ; `{ plat:200 }` = 1.
3. `coinsWeight({ cuiv:199 })` ≈ 0,995 — **pas 0** (contrôle de la décision « exact »).
4. Mélange des 4 dénominations.
5. `carriedWeight(items, m, eq, coins)` = poids des objets + poids des pièces ; sans 4e param,
   résultat **inchangé** (non-régression explicite).

**Déployable tel quel.** Bumper `APPV` + `?v=` dans `index.html`.

---

## Lot 2 — Le canal « groupe » (`item.carryGroup`)

### 2.1 Modèle d'item

`makeItem` / `buildCatalogSeed` / `planItemAdd` / `planItemTransfer` : propager
`carryGroup: Number(x) || 0` **partout où `carry` est déjà propagé** (`game-logic.js` : 3 sites de
copie de champs autour des lignes 112, 136, 167).

⚠️ Repérer les sites par `grep -n "carry" game-logic.js` plutôt que par numéro de ligne — un oubli
fait perdre le bonus au premier transfert vers le coffre, symptôme déroutant.

### 2.2 Éditeur d'item (`InvItemRow`, `components.jsx`)

- Nouveau champ **« Capacité groupe (+coffre) »** à côté de « Capacité (+charge) ».
- ⚠️ **Différence de gating volontaire** : `carry` est remis à 0 quand `cat !== 'Équipement'` (au
  `onSave`). `carryGroup` **ne l'est pas** — un sac large ou une monture peut être rangé en `Butin`
  sans être équipable. Ne pas le glisser dans le bloc `isEq ? … : 0`.
- `ItemTooltip` + panneau de détail du coffre commun : afficher le bonus quand `carryGroup > 0`.

### 2.3 `game-logic.js` — somme du canal groupe

```js
/* Σ des bonus de capacité de GROUPE (§6 du doc MJ, canal `g`).
   Deux sources disjointes, décision MJ du 2026-08-21 : les objets du coffre commun,
   et les objets ÉQUIPÉS par un joueur. Un objet du coffre n'est équipé par personne :
   pas de double comptage tant qu'on ne somme que `equipment`, jamais l'inventaire entier. */
function sumGroupCarry(sharedItems, carriers) { ... }
```

`carriers` = tableau `[{ equipment, inventory }]`, un par perso. Tolère `null` partout (un perso
sans état renvoie 0).

### 2.4 Tests

6. `sumGroupCarry({}, [])` = 0.
7. Coffre seul ; porteurs seuls ; les deux additionnés.
8. Un objet équipé **et** présent dans l'inventaire de son porteur n'est compté **qu'une fois**.
9. `equipment` référençant un `itemId` absent de l'inventaire → ignoré, pas de crash.

**Déployable tel quel** (le champ existe et se saisit ; il ne sert encore à rien).

---

## Lot 3 — La capacité du coffre commun

### 3.1 `game-logic.js` — logique pure

```js
function carryBaseRaw(force, mental, level)      // 30 + F×5 + M×Niv/10, NON arrondi, SANS bonus
function groupCarryCapacity(profiles, bonusG)    // ⌊ Σ carryBaseRaw + bonusG ⌋
function groupComfortPct(profiles)               // moyenne des comfortPct ; 0 profil → 0.60
function weightStatusPct(carried, cap, pct)      // même retour que weightStatus, seuil donné en %
```

- `carryCapacity` est **refactorée pour appeler `carryBaseRaw`** — même résultat, un seul endroit
  où vit la formule (§3 de la spec explique pourquoi on ne peut pas réutiliser `carryCapacity`
  directement : arrondi individuel + bonus personnel).
- `weightStatus(carried, cap, hab)` devient un mince appel à `weightStatusPct(carried, cap,
  comfortPct(hab))` → **les 4 tests existants de `weightStatus` passent sans modification**.
- `profiles` = `[{ force, mental, hab, level }]`. Aucune lecture de Firebase ici.

### 3.2 `database.rules.json` — le patch

Les 4 `.read` du §6 de la spec, sur `characters/$charId/state/{attrs,level,equipment,inventory}`.

**Procédure obligatoire** :
1. éditer **chirurgicalement** (ne retaper aucun `.read`/`.write` existant) ;
2. `git diff database.rules.json` → vérifier que **seules des lignes s'ajoutent** ;
3. `firebase deploy --only database` ;
4. relire les règles en ligne (la CLI n'affiche aucun diff).

### 3.3 `data-state.jsx` — nouveau hook `useGroupCarry()`

S'abonne, **pour chacun des 5 `CHARACTERS`**, à 4 chemins feuilles :
`characters/{id}/state/attrs`, `/level`, `/equipment`, `/inventory` (20 abonnements).

⚠️ **Ne PAS utiliser `useAllCharStates()`** : il s'abonne au parent `characters`, resté staff-only,
et retombe silencieusement sur `null` pour un joueur (§7.2 de la spec).

Retourne `{ profiles, carriers, capacity, comfortPct, comfort }` en repliant sur `char.attrs` /
`char.level` de `data.jsx` quand un nœud est absent (§7.3 — c'est le cas **nominal** aujourd'hui,
aucun perso n'a de `state.attrs`).

**Contrainte à tenir dans la durée** : ce hook n'alimente **que de l'affichage**. Aucune écriture
ne doit en dépendre — c'est la règle qui a manqué à `moveCoins` et a écrasé la bourse d'Elias.
La commenter dans le code, pas seulement ici.

### 3.4 `pages-inventory.jsx` — la jauge

Sous le titre « Inventaire commun », une jauge dans le style de celle de `pages-equip.jsx` :

```
CHARGE DU COFFRE          Léger   142,3 / 247
[============|--------------------]        confort ≤ 167
```

- `W` = `carriedWeight(items, 0, {}, sharedCoins)` — **sans `equipment`** : le coffre n'a pas de
  porteur, donc pas de réduction Mental sur l'armure (§7.5 de la spec).
- Couleurs et libellés : réutiliser la table `WEIGHT_STATE` de `pages-equip.jsx` — **l'extraire
  dans `components.jsx`** plutôt que la dupliquer une troisième fois.
- Infobulle du titre : `Σ capacités des 5 personnages + bonus de transport de groupe`, avec le
  détail des deux termes — c'est ce qui rend le nombre explicable à la table.

### 3.5 Tests

10. `carryBaseRaw` : 3 profils, valeurs **non arrondies** (50,8 / 61 / 35,2).
11. **Exemple du §9 du doc MJ** (4 joueurs, `g` = 70) → capacité **422**, confort **74,5 %**,
    seuil **314**. Le test qui garantit la conformité au document.
12. **Groupe réel** (les 5 de `data.jsx`, niveau 2, `g` = 0) → **247 / 68 % / 167**, et pas 246
    (contrôle de l'arrondi unique en fin de somme).
13. `groupComfortPct` : plafond 90 % par joueur (un Hab. 20 ne tire pas la moyenne au-delà) ;
    liste vide → 0,60.
14. `weightStatusPct` : les 3 états aux bornes exactes (`W = seuil` → Léger, `W = capacité` →
    Encombré, `W = capacité + 1` → Surchargé).

### 3.6 Vérifications finales

- `node --test test/game-logic.test.js && node --test test/auth.test.js`
- `npx esbuild <chaque .jsx touché> >/dev/null`
- **Recette du §10 de la spec**, dont le point 4 : **se connecter avec un compte `joueur`**, pas
  seulement en MJ. C'est le seul test qui valide le patch de règles.
- Bumper `APPV` + `?v=` dans `index.html`.

---

## Hors périmètre (à ne pas faire au passage)

- **Pénalités d'encombrement.** Le §5 du doc MJ est explicite : les états sont **informatifs**,
  les malus sont arbitrés à la table. Aucun effet mécanique à câbler.
- **Blocage des transferts** vers un coffre surchargé. Rien dans le doc ne l'impose, et ça
  transformerait un indicateur en verrou — décision de jeu, à demander au MJ si l'envie vient.
- **Jauge de charge sur la fiche joueur.** CLAUDE.md l'annonce, elle n'existe pas ; c'est un écart
  de documentation, pas un manque identifié par le MJ.
- **Prix des objets.** Le guide d'économie en contient une grille complète, non branchée dans
  `ITEM_CATALOG`. Autre chantier (voir backlog « équipement en stats finales »).

## Mises à jour de `CLAUDE.md` à faire en fin de chantier

1. Corriger la formule de `carryCapacity` (périmée : annonce `CARRY_BASE(10)`, sans Mental ni
   niveau — voir §2 de la spec).
2. Retirer la mention d'une jauge de poids « sur fiche + Équipement » : la fiche n'en a pas.
3. Documenter `item.carryGroup`, `coinsWeight`, `useGroupCarry` et le patch de règles RTDB.
