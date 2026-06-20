# Cycle de séance + distribution de récompenses (sous-projet B) — design

> **Statut : design décidé par l'agent (2026-06-21), en attente de retour utilisateur.** L'utilisateur a
> demandé d'implémenter directement et de faire un retour ensuite. Les décisions ci-dessous sont des choix
> par défaut raisonnables, à corriger au retour. Deuxième et dernier sous-projet du chantier « Cycle de
> séance + XP + récompenses ». S'appuie sur **A** (XP & niveau, livré) : réutilise `addXp`.

## Problème / objectif

Donner au MJ un **rituel de séance** : à l'ouverture de la vue MJ, choisir « Début de séance » ou
« Visite ». En séance, un bandeau le rappelle ; à la **clôture**, un panneau distribue **XP** (et argent)
aux joueurs en une fois. C'est le « wrapper » autour des compétences/combat déjà en place.

## Décisions (choix par défaut — à valider)

- **État de séance = MJ-local (`localStorage`)**, pas Firebase. Motif : **zéro friction** (aucune
  nouvelle règle RTDB à republier en console → testable immédiatement), et la séance est un outil MJ.
  Même approche que les ennemis v1 (localStorage avant migration). **v2 possible** : état partagé
  (`campaign/session`) pour un bandeau côté joueurs — déféré.
- **Modal à l'ouverture** de la vue MJ quand aucune séance active : « Début de séance » / « Visite
  (sans séance) ». « Visite » = ferme la modal (transitoire), pas de bandeau.
- **Bandeau « Séance en cours »** + bouton « Clôturer la séance » dans l'en-tête MJ quand active.
  Persisté en `localStorage` → survit à un rafraîchissement (pas de modal re-déclenchée en pleine séance).
- **Clôture → panneau de récompenses** (modal) : par joueur, un champ **XP** + des champs **monnaie**
  (plat/or/arg/cuiv). « Distribuer & clôturer » applique tout puis termine la séance.
  - **XP** : réutilise `addXp(charId, gain)` (sous-projet A) → montée auto + journal.
  - **Argent** : **don additif direct** via nouvel orchestrateur `grantCoins(charId, patch)` (le MJ
    récompense, ce n'est pas un transfert depuis le coffre commun).
  - **Objets/loot** : **réutilise l'existant** — bouton « Inventaire commun → » (`go('inv')`) où le
    transfert coffre→joueur avec choix du destinataire existe déjà. Pas de duplication d'UI.
- **Aucune nouvelle règle RTDB** : `xp` et `coins` sont déjà en écriture staff sous `characters/$charId`.

## Architecture

### État (localStorage, MJ-local)

- Clé `runeterra_session` = `'1'` si séance active, absente sinon. Hook `useSession()` →
  `{ active, start(), close() }` (lecture/écriture localStorage + état React).

### Orchestrateur (`data-state.jsx`)

- `grantCoins(charId, patch)` — **don additif** : `getSnapshot` des `coins` du joueur → ajoute
  `patch` (dénominations ≥ 0) → `updatePath(.../coins, …)`. Pattern identique à `addXp`. Exporté `window`.

### UI (`pages-mj.jsx`)

- `useSession()` (hook local, défini dans `pages-mj.jsx`).
- `SessionStartModal({ onStart, onVisit })` — modal 2 boutons, affichée au montage de `MJPage` si
  `!active` et pas encore décidé pour ce montage (état React transitoire `decided`).
- Bandeau dans l'en-tête `MJPage` : si `active`, « 🎲 Séance en cours » + bouton « Clôturer ».
- `SessionRewardsModal({ onDone, onCancel })` — tableau des 5 persos (avatar + nom), par ligne : input
  XP + 4 inputs monnaie. « Distribuer & clôturer » : pour chaque joueur, `await addXp(id, xp)` +
  `await grantCoins(id, coins)` (si > 0) ; toast récap ; `close()` ; `onDone()`. Bouton « Inventaire
  commun → » pour le loot d'objets. « Annuler » ferme sans rien appliquer (séance reste active).

## Flux

1. MJ ouvre la vue MJ, pas de séance → `SessionStartModal`. « Début » → `start()` (localStorage), bandeau.
2. Le MJ joue (combat/comps/journal inchangés).
3. « Clôturer » → `SessionRewardsModal`. Le MJ saisit XP + argent par joueur.
4. « Distribuer & clôturer » → `addXp`/`grantCoins` en boucle → `close()` → bandeau disparaît, toast récap.

## Cas limites

- **Rafraîchissement en séance** : `active` lu de localStorage → bandeau, pas de modal. OK.
- **Champs vides / 0** : ignorés (`addXp`/`grantCoins` no-op si ≤ 0).
- **« Visite »** : aucune séance, aucun bandeau ; la modal ne se réaffiche pas tant que le composant
  reste monté (re-montage = re-demande, conforme au concept « à l'ouverture »).
- **Distribution partielle** : « Annuler » dans le panneau de récompenses n'applique rien et garde la
  séance active (le MJ peut ré-ouvrir).

## Tests

- `grantCoins` est un orchestrateur Firebase (non pur) → vérif `esbuild` + manuel, comme `addXp`.
- Pas de nouvelle logique pure nécessaire. Suite `node --test` existante doit rester verte.

## Hors périmètre (v2 éventuelle)

- État de séance **partagé** (Firebase) + bandeau côté joueurs.
- Distribution d'objets **intégrée** au panneau (aujourd'hui : via l'onglet Inventaire commun).
- Historique des séances / récap auto / durée.
