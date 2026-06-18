# Spec — Catalogue d'items pour l'ajout MJ

**Date** : 2026-06-18
**Statut** : validé (brainstorming)
**Contexte** : Chroniques de Runeterra (outil de campagne JDR, zéro-build React/CDN + Firebase RTDB).

## Problème

Aujourd'hui, quand le staff (MJ/admin) clique « + Ajouter » dans un inventaire,
il obtient un item **vierge** à remplir entièrement à la main (nom, effet, image,
catégorie…). Fastidieux et source d'incohérences (noms/effets/images variables).

Le MJ veut **faire défiler un catalogue d'items pré-enregistrés** (potions, butin,
armes…) et en ajouter un en quelques clics, avec une quantité.

## Objectif

Un **catalogue curé** d'items + un **picker réutilisable** branché sur tous les
boutons « + Ajouter » du staff, avec choix de quantité, fusion intelligente, et
un plafond de pile à 99 (débordement automatique sur une nouvelle case).

Non-objectifs (YAGNI) : édition du catalogue depuis l'app, catalogue dérivé
automatiquement de l'existant, gestion des pièces de bourse via le catalogue
(la bourse reste un système séparé).

## Décisions de design

### 1. Le catalogue (donnée curée)

Constante `ITEM_CATALOG` dans `data.jsx` (à côté de `CHARACTERS`). Chaque entrée :

```js
{ cat, name, sub, ic, img, type }   // pas d'id ni de qty (générés à l'ajout)
```

Contenu (construit depuis les images existantes de `ATH/Items/` et `ATH/Armes/`) :

- **Consommables**
  - Potions de soin ×4 raretés — paliers proposés (ajustables ultérieurement) :
    `Rend 15 + 15% HP` / `30 + 20%` / `50 + 25%` / `100 + 30%`
    (images `potion-soin-{mineur,intermediaire,avance,ultime}.webp`)
  - Potions de mana ×4 raretés :
    `Rend 10 + 10% Mana` / `25 + 15%` / `40 + 20%` / `75 + 25%`
    (images `potion-mana-*`)
  - Potion néfaste inconnue (`potion-nefaste-inconnu.webp`, sub narratif)
  - **Kéminite** (`keminite.webp`, sub « Sert à appeler Taliyah »)
  - **Cristal explosif** + **Cristal très explosif** (`cristal-explosif.webp`,
    `cristal-tres-explosif.webp`, sub narratif)
- **Butin**
  - Relique lunaire, relique solaire, pierre de transmutation, loot-mob, carte,
    boussole, parchemin, gourde, boîte à outils, livre (Histoire de Runeterra),
    tricorne. (sub narratif court)
- **Équipement**
  - Les 9 armes de `ATH/Armes/` avec leur `type` :
    dague → `accessory` (décision MJ figée), autres armes → `weapon`.

**Exclu** : `piece-bronze/fer/or/mythril.webp` — ce sont les visuels des pièces de
la **bourse** (`coins`), pas des items d'inventaire.

Les consommables sans effet « Rend X » (kéminite, cristaux, potion néfaste) n'ont
pas de bouton « Utiliser » auto (comportement existant : `parseConsumableEffect`
renvoie `null` → action masquée). C'est attendu : la catégorie sert au tri/visuel.

### 2. Le picker (UI réutilisable) — `ItemCatalogPicker`

Nouveau composant dans `components.jsx`, modal dark-fantasy cohérent avec
`InventoryGrid` :

- Onglets de filtre : **Tous / Équipement / Consommables / Butin**
  (réutilise les mêmes clés que `INV_FILTERS`).
- Grille d'items du catalogue : icône/image + nom + effet (`sub`).
- Clic sur une entrée → `AmountStepper` existant (popover ancré) → bouton
  **Ajouter** → `onPick(entry, qty)`. À l'ajout il n'y a pas de quantité source
  bornante (contrairement à un transfert) : on passe `max = 999` au stepper
  (le débordement en piles de 99 est géré par `fillStacks`).
- Bouton **« Objet personnalisé »** en bas → filet de sécurité : conserve le
  comportement actuel (créer un item vierge + ouvrir l'éditeur `InvItemRow`).
- Prop `initialFilter` (optionnel) pour pré-filtrer sur une catégorie (utilisé par
  la fiche, dont le « + Ajouter » est par catégorie).

Interface :
```
ItemCatalogPicker({ initialFilter, onPick(entry, qty), onCustom(), onClose })
```

### 3. Logique d'ajout + plafond de pile (pure, testée)

Constante `STACK_MAX = 99` (dans `game-logic.js`).

Helper pur **partagé** `fillStacks(items, entry, qty)` :
- cherche les piles existantes de **même `name` + `cat` + `type`** ayant
  `qty < STACK_MAX`, les remplit jusqu'à 99 ;
- crée de nouvelles piles (`makeItem(entry)`) pour le surplus, chacune ≤ 99 ;
- renvoie un patch `{ [itemId]: item }` (piles modifiées + nouvelles).

`planItemAdd(items, entry, qty)` = `{ patch: fillStacks(items, entry, qty) }`.

`planItemTransfer(srcItems, dstItems, itemId, n)` est **refactorisé** pour créditer
la destination via la même logique de remplissage/débordement (au lieu de fusionner
dans une seule pile sans limite). Le débit de la source est inchangé. Les tests
existants sont mis à jour ; on ajoute des cas de débordement.

**Invariant** : seuls les **nouveaux** ajouts/transferts respectent le plafond ;
une pile déjà > 99 en base n'est pas re-découpée.

### 4. Badge de quantité (OR)

`InventoryGrid` affiche déjà un badge `item.qty` en bas à droite des cases
(`components.jsx` ~l.460). Seul changement : la **couleur passe en doré**
(thème, ex. `#eccf8f` / `#c2a05a`) au lieu du crème actuel. Comme la grille rend
une case par `itemId`, le débordement en piles de 99 s'affiche **automatiquement**
en cases multiples — aucun autre changement de rendu.

La fiche joueur utilise une **liste** (`InvItemRow`, badge « ×N » inline), pas la
grille : inchangée.

### 5. Branchements (staff uniquement)

Tous gardés derrière `isStaff(role)` (déjà en place après le verrouillage joueur).

- **Page Équipement** (`pages-equip.jsx`) : le « + » de la grille (`onAdd`) ouvre
  le picker → ajout via `planItemAdd` puis `setInvItem` (perso).
- **Fiche joueur** (`pages-sheet.jsx` / `InventoryPanel`) : « + Ajouter » par
  catégorie ouvre le picker (pré-filtré sur la catégorie) → `setInvItem` (perso).
  `InventoryPanel` reçoit un prop optionnel `onAdd(cat)` ; s'il est fourni, il
  délègue au parent (picker) ; sinon il garde son ajout vierge interne.
- **Inventaire commun** (`pages-inventory.jsx`) : « + Ajouter » ouvre le picker →
  ajout dans `sharedInventory` (`SHARED_INV`) via `planItemAdd` + écriture RTDB.

Le picker écrit toujours **plusieurs clés** possibles (débordement) : chaque page
applique le `patch` en bouclant sur ses entrées (`setInvItem`/`setPath` par itemId).

### 6. Ce qui ne change pas

Règles RTDB (aucune nouvelle), bourse (`coins`/`sharedCoins`), transferts
perso↔commun (sauf le crédit qui respecte désormais le plafond), « Utiliser »
des consommables, verrouillage joueur (lecture seule).

## Architecture / fichiers touchés

- `game-logic.js` — `STACK_MAX`, `fillStacks` (pur), `planItemAdd` (pur),
  refactor `planItemTransfer` (crédit via `fillStacks`). Export `window` + UMD.
- `data.jsx` — `ITEM_CATALOG` ; correction `cat` de la kéminite (→ Consommables)
  dans les inventaires par défaut (Rathäel, Urskaar).
- `components.jsx` — `ItemCatalogPicker` ; badge quantité en OR dans
  `InventoryGrid` ; prop `onAdd(cat)` sur `InventoryPanel`.
- `pages-equip.jsx` — état picker + branchement du « + » de la grille.
- `pages-sheet.jsx` — état picker + branchement des « + Ajouter » par catégorie.
- `pages-inventory.jsx` — état picker + branchement du « + Ajouter » commun.
- `test/game-logic.test.js` — tests `fillStacks` / `planItemAdd` (fusion, création,
  débordement 99) + mise à jour des tests `planItemTransfer`.
- `CLAUDE.md` — maj carte des fichiers + décisions (catalogue, STACK_MAX, kéminite
  → Consommables).

## Tests

- `fillStacks` : ajout dans inventaire vide (1 pile) ; fusion dans pile partielle ;
  débordement (95 + 10 → 99 + 6) ; ajout de 100 dans vide → 99 + 1 ;
  discrimination par `name`/`cat`/`type` (pas de fusion entre items différents).
- `planItemAdd` : enveloppe `fillStacks`, renvoie `{ patch }`.
- `planItemTransfer` : cas existants verts ; nouveau cas où le crédit dépasse 99
  → débordement côté destination ; débit source inchangé.
- Syntaxe : `npx esbuild <fichier>.jsx >/dev/null` sur les 4 .jsx modifiés.
- Manuel : ajouter une potion via le picker sur chacune des 3 pages (perso ×2 +
  commun), vérifier quantité, fusion, débordement, badge OR, temps réel.

## Risques / points d'attention

- Refactor de `planItemTransfer` : code testé déjà mergé/déployé — bien faire
  passer les tests existants avant d'ajouter le débordement.
- Le `patch` multi-clés doit être appliqué clé par clé sur chaque page (pas de
  `set` global qui écraserait l'inventaire).
- Paliers de potions = proposition ; faciles à ajuster dans `ITEM_CATALOG` ensuite.
