# Inventaire perso + commun — design

> **Statut : validé, prêt pour plan d'implémentation (2026-06-16).**
> Première brique de la feature « ATH/équipement façon MMO ». Les slots
> d'équipement (paperdoll) et le rendu du perso (**image `.webp`, pas de 3D**)
> viendront **après**, sur cette base.

## Objectif

Remplacer l'inventaire statique actuel (`char.inv` en dur dans `data.jsx`, non
éditable) par un vrai système d'objets **temps réel** : un inventaire **personnel**
par perso + un inventaire **commun partagé** accessible à tous. Préparer (sans
l'implémenter) le branchement futur des **bonus de stats** d'objets.

## Périmètre

- ✅ Modèle d'item, inventaire perso (éditable, temps réel), inventaire commun
  (accès total), images d'items, migration de l'existant.
- ❌ Hors périmètre (plus tard) : slots d'équipement/paperdoll, bonus de stats
  réels (le champ `mods` est prévu mais vide), rendu du perso en image `.webp`
  (la 3D est abandonnée — modèle trop lourd pour le web).

## Modèle d'item

```
{
  id,                                   // identifiant unique
  name,                                 // nom affiché
  type: 'arme'|'armure'|'consommable'|'butin',
  img: 'items/xxx.png',                 // image (dossier items/ du dépôt) — optionnelle
  desc,                                 // description (texte libre ; futures stats y figureront)
  qty,                                  // quantité
  mods: { ad, ap, armure, ... }         // OPTIONNEL, vide pour l'instant → hook futur des bonus
}
```

## Stockage (Firebase RTDB)

- **Perso** : `/campaign/runeterra/characters/{charId}/state/inventory` (tableau d'items).
  - Éditable par le joueur sur sa propre fiche, par le staff sur toutes.
  - **Aucune modif de règles** : déjà couvert par le scope `$charId` existant.
- **Commun** : `/campaign/runeterra/sharedInventory` (tableau d'items).
  - **Accès total** : lecture + écriture pour tout compte connecté.
  - ⚠️ **Nécessite une modif `database.rules.json`** : ajouter sous
    `campaign/runeterra` un nœud `sharedInventory` avec
    `.read`/`.write` = `auth != null` (les règles enfant accordent l'accès même si
    le parent `campaign` est réservé au staff). **À republier dans la console.**

## Images

Dossier `items/` à la racine du dépôt (chemins statiques, comme `players/`).
L'utilisateur y dépose les images au fil de la campagne. Item sans image → icône
de repli (par type).

## UI

- **Inventaire perso** : la colonne « Inventaire » de la fiche (`pages-sheet.jsx`,
  ~ligne 144) devient **éditable + temps réel** : ajouter / éditer / supprimer un
  item, changer la quantité, par catégorie. Les `Coins` restent.
- **Inventaire commun** : **nouvelle page** « Inventaire commun », accessible à
  **tous les rôles**. Liste partagée + actions déposer/prendre/éditer.
  - Nav : ajouter l'id de page (ex. `inv`) à **tous** les rôles dans
    `pagesForRole` (`auth.js`) — y compris `joueur` (qui n'a aujourd'hui que `sheet`).

## Migration

Les items existants de chaque perso (dans `data.jsx`) servent de **valeurs par
défaut** : si `state/inventory` est absent pour un perso, l'initialiser depuis ces
défauts (étendre `buildDefaultState` / le seed). L'inventaire commun démarre vide.

## Hook futur des bonus

Quand un item aura des stats, on remplit `mods`. La somme des `mods` des items
(équipés, une fois les slots faits) s'ajoutera dans `computeEffective`
(le moteur gère déjà modificateurs + buffs). Rien à recâbler maintenant.

## Fichiers concernés (prévision)

- `data.jsx` : modèle d'item + items par défaut au nouveau format.
- `game-logic.js` : `buildDefaultState` inclut l'inventaire par défaut.
- `data-state.jsx` : hooks temps réel inventaire perso + commun (lecture/écriture).
- `database.rules.json` : nœud `sharedInventory` (accès total connecté).
- `components.jsx` : composant d'édition d'item réutilisable (perso + commun).
- `pages-sheet.jsx` : colonne inventaire éditable.
- `pages-inventory.jsx` (CREATE) : page inventaire commun.
- `auth.js` : page `inv` ajoutée à tous les rôles.
- `index.html` : chargement de la nouvelle page + route.

## Tests / vérif

- `node --test` (auth + game-logic) ne régresse pas ; tests sur `buildDefaultState`.
- Contrôles de syntaxe esbuild sur les `.jsx`.
- Vérif manuelle : éditer un item perso (reflété temps réel), déposer/prendre dans
  le commun depuis deux comptes.
- ⚠️ Déploiement : republier `database.rules.json` (sinon l'inventaire commun est
  inaccessible aux joueurs).
