# Design — Inventaire : grille commune, transferts perso ↔ commun, types d'items, pièces vivantes

Date : 2026-06-17
Statut : validé (brainstorming), prêt pour plan d'implémentation.

## Contexte

L'inventaire perso (par fiche) et le coffre commun existent déjà en temps réel
(`useCharState` / `useSharedInventory`, items `{id,cat,name,sub,qty,ic,img,mods}`).
La page Équipement affiche une grille d'icônes dark-fantasy (cases 7 colonnes, badge
quantité, onglets de filtre, ligne de monnaie). La page Inventaire commun, elle,
affiche encore une simple **liste** (`InventoryPanel`). Les pièces (`char.coins`)
sont **statiques** (codées dans `data.jsx`, non persistées). Le type d'emplacement
d'un item est **deviné** (`equipTypeForItem`) faute de champ explicite, donc seules
armes & accessoires sont équipables. La Kéminite est mal classée en *Consommable*.

Ce chantier rend l'inventaire cohérent et manipulable : même grille partout côté
gestion, transferts d'items et de pièces entre perso et coffre commun, et un type
d'item explicite choisi à la création. Le branchement de `item.mods` sur les stats
effectives est **hors périmètre** (chantier suivant), mais le champ `type` ajouté ici
le prépare.

## Décisions (issues du brainstorming)

1. **Coffre commun = grille style Équipement** (pas la liste actuelle).
2. **Transfert de pile (qty>1)** = sélecteur de montant (1→max) ; qty=1 = direct.
3. **Type d'item = Catégorie + Emplacement** : `cat` (Équipement/Consommables/Butin,
   pilote couleur + filtre + comportement) **et** `type` (emplacement, seulement si
   Équipement).
4. **Surfaces de gestion** = page **Équipement** (inventaire perso riche) + page
   **Inventaire commun**. La **fiche joueur garde sa liste actuelle inchangée**.
5. **Pièces vivantes + coffre commun** : pièces persistées par perso + réserve commune,
   transfert avec sélecteur de montant, MJ peut ajuster.

## A. Modèle de données

### Item — nouveau champ `type`
`makeItem` ajoute `type: p.type || ''`. Valeurs = clés d'emplacement alignées sur les
types acceptés par `EQUIP_SLOTS` :
`helmet, shoulders, chest, gloves, weapon, offhand, shield, amulet, ring, belt, pants,
accessory, boots`. Vide (`''`) pour Consommables/Butin et pour tout item non-équipable.

`equipTypeForItem(it)` lit `it.type` en **priorité** ; l'inférence existante
(dague→accessory, `/Armes/`→weapon, Équipement→accessory) reste en **repli** pour les
items déjà en base sans `type`.

### Pièces persistées par perso
Nouveau sous-nœud d'état :
```
/campaign/runeterra/characters/{charId}/state/coins = { plat, or, arg, cuiv }
```
Amorçage via `buildDefaultState` depuis `char.coins`, avec **marqueur de migration**
`coinsInit: true` (même logique que `invInit` : amorce une seule fois, ne réécrase pas
si le joueur a déjà des pièces). La page Équipement et la fiche lisent désormais
`state.coins` (repli `char.coins` tant que l'état n'est pas chargé).

### Réserve de pièces commune
```
/campaign/runeterra/sharedCoins = { plat, or, arg, cuiv }
```
Nouveau hook `useSharedCoins()` (lecture temps réel + setter), aligné sur
`useSharedInventory`.

### Correction de données
`data.jsx` : Kéminite passe de `cat:'Consommables'` à `cat:'Butin'` (et `type:''`).

### Règles RTDB (`database.rules.json`)
Ajouter `sharedCoins` au même régime que `sharedInventory` : **lecture + écriture pour
tout participant inscrit** (`root.child('users').child(auth.uid).child('role').exists()`).
`state/coins` est déjà couvert par la règle d'écriture `characters/$charId`
(joueur assigné, mj, admin). **À republier au déploiement** (comme pour `sharedInventory`).

## B. Composants & UI

### `InventoryGrid` (extrait, réutilisable) — `components.jsx`
On extrait la grille de la page Équipement vers un composant partagé :
- cases d'icônes (7 colonnes), image `item.img` (repli `ic`/◆), **badge quantité**
  (`item.qty`, affiché dès `qty>1`) en bas à droite ;
- onglets de filtre (Tout / Équip. / Conso. / Butin) ;
- ligne de monnaie en bas ;
- prop `onItemClick(item, anchorEvent)` pour remonter le clic au parent (menu d'actions),
  `onCoinClick(coinKey, anchorEvent)`, `onAdd()` (bouton « + Ajouter »).

La page Équipement utilise `InventoryGrid` lié à `useCharState` (et conserve son
drag&drop vers les slots, qui reste indépendant du menu). La page Inventaire commun
l'utilise liée à `useSharedInventory` + `useSharedCoins`.

### Menu d'actions au clic (popover) — nouveau `ItemActionMenu`
Clic sur un item → popover ancré, options contextuelles :
- **Équiper / Déséquiper** — si `cat==='Équipement'` (page Équipement uniquement) ;
- **Utiliser** — si `cat==='Consommables'` et effet parsé (`parseConsumableEffect`) ;
- **Envoyer au commun** (depuis perso) / **Prendre** (depuis commun) ;
- **Éditer** ;
- **Supprimer**.

Remplace l'actuel clic-consommable-seulement de la page Équipement (comportement
unifié, plus de cohérence). Le double-clic (équip/déséquip rapide) et le drag&drop sont
conservés.

### Éditeur d'item (réutilise l'existant) — `components.jsx`
Le formulaire d'édition (déjà : nom, description, qty, **upload image**) gagne :
- **Catégorie** (Équipement / Consommables / Butin) ;
- **Emplacement** (`type`) — affiché **uniquement si Catégorie = Équipement**, liste
  des emplacements ci-dessus.

Bouton **« + Ajouter »** sur chaque grille → crée un item via `makeItem` puis ouvre
l'éditeur.

### Sélecteur de montant (popover) — nouveau `AmountStepper`
Pour transfert de pile (qty>1) et pour les pièces : petit popover 1→max avec
+/- et un champ, bouton de validation. Si qty=1, le transfert d'item s'effectue
directement sans ce sélecteur.

## C. Transferts (logique)

### Items perso ↔ commun
- **Envoyer au commun** : retire `n` du stack perso (supprime l'item si qty atteint 0),
  ajoute `n` côté commun.
- **Prendre** : inverse.
- **Fusion auto** : si un item « équivalent » existe déjà côté destination, on
  **incrémente sa qty** au lieu de créer un doublon. Équivalence = même `name` + `type` +
  `cat` (clé de regroupement) ; sinon nouvel item (`makeItem`, nouvel id).
- **Destination commun → perso** : si l'utilisateur est **joueur**, destination = sa
  propre fiche (auto, 1 clic, garanti par les règles RTDB). Si **MJ/admin**, petit
  choix du perso destinataire.

### Pièces perso ↔ commun
- Clic sur une pièce → menu `Déposer` / `Retirer` + `AmountStepper`.
- Déposer : `state.coins[k] -= n` (≥0), `sharedCoins[k] += n`. Retirer = inverse.
- MJ/admin : peuvent aussi ajuster directement les montants (édition libre).

## Découpage en unités

- `makeItem` / `buildDefaultState` (game-logic.js) — champ `type`, amorçage `coins`.
- `useSharedCoins` + amorçage `coins` perso (data-state.jsx).
- `InventoryGrid`, `ItemActionMenu`, `AmountStepper`, éditeur d'item étendu (components.jsx).
- Câblage page Équipement (utilise InventoryGrid + menu + transferts + pièces vivantes).
- Câblage page Inventaire commun (InventoryGrid + commun + sharedCoins).
- Données : fix Kéminite (data.jsx).
- Règles : `sharedCoins` (database.rules.json).

## Tests

- **game-logic** (node --test) : `makeItem` porte `type` ; `buildDefaultState` amorce
  `coins` ; helper pur de transfert (calcul du nouveau stack source/destination + fusion)
  testé en isolation s'il est extrait en logique pure.
- **Logique de fusion** : transfert partiel/total, fusion sur item équivalent, suppression
  à qty 0.
- **Syntaxe** : `npx esbuild` sur chaque `.jsx` modifié.
- **Manuel** : transferts items + pièces en temps réel (2 onglets), création d'item avec
  Catégorie+Emplacement, badge quantité, Kéminite = Butin.

## Hors périmètre (chantier suivant)

- Brancher `item.mods` sur `computeEffective` (bonus de stats des équipements). Le champ
  `type` ajouté ici rend les armures équipables et prépare ce branchement.
