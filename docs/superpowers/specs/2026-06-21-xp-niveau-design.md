# Fondation XP & niveau (sous-projet A) — design

> **Statut : design validé par l'utilisateur (2026-06-21).** Premier des deux sous-projets
> du chantier « Cycle de séance + XP + distribution de récompenses ». **A = fondation XP/niveau**
> (ce document). **B = cycle de séance + récompenses** (modal début/clôture, distribution groupée
> XP+loot) fera l'objet d'une spec séparée et s'appuiera sur A. On livre A d'abord.

## Problème / objectif

Le **niveau existe déjà** (`state/level`, stepper staff sur l'onglet Compétences) et pilote le
déblocage des compétences, le budget de runes et le passif. Mais il se change uniquement à la main,
sans notion de progression. On veut une **couche d'XP par-dessus** : chaque perso accumule de l'XP,
et au franchissement d'un seuil son `state/level` monte automatiquement (ce qui débloque comps/runes).

`LEVELS` (data.jsx) est une table de **points d'attributs** par palier (gain/total/limite) — elle ne
contient **aucun seuil d'XP**. L'XP est donc une couche neuve, pas une refonte de l'existant.

## Décisions (validées au brainstorm)

- **Seuils via formule générique** `xpToNext(level)`, point unique à changer plus tard. Valeur de
  départ : `100 * level`.
- **Montée automatique** dès que l'XP atteint le seuil, avec **report du surplus** sur le niveau
  suivant (montée multi-niveaux possible si gros gain).
- **`xp` = progression intra-niveau** (0 ≤ xp < seuil), **pas** un total cumulé à vie. `state/level`
  reste l'autorité du niveau — pas de double source de vérité.
- **Affichage de la barre** : fiche perso (joueur), onglet Progression (staff), cartes de la vue MJ.
  Lecture seule partout.
- **Don d'XP** : contrôle **« +XP » ad-hoc côté MJ** dès A (pour que A soit utilisable seul, avant B).
  La séance (B) réutilisera le même `addXp` en distribution groupée.
- **Allocation des points d'attributs** : reste manuelle, **hors périmètre**.

## Architecture

### Modèle de données (Firebase)

```
/campaign/runeterra/characters/{id}/state/
    xp: 0   ← progression dans le niveau courant (entier ≥ 0, < xpToNext(level))
    level: 2   ← inchangé : autorité du niveau (déjà en place)
```

**Aucune nouvelle règle RTDB** : `xp` vit dans `state`, déjà couvert par `characters/$charId`
(joueur = sa fiche en R/W, staff = tout). Le don d'XP est une écriture staff sur `state/level`+`xp`.

### Logique pure (`game-logic.js`, UMD, testée)

- `xpToNext(level)` → seuil d'XP pour passer du niveau `level` au suivant. Formule générique unique :
  `100 * level`. (Le seul endroit à modifier pour ajuster la courbe.)
- `applyXp(level, xp, gain)` → ajoute `gain` à `xp`, puis **boucle** tant que `xp >= xpToNext(level)` :
  `xp -= xpToNext(level) ; level++`. Retourne `{ level, xp, levelsGained }`.
  - Garde-fous : `gain` négatif ou nul → pas de boucle (retourne l'état borné à `xp >= 0`) ; `level`
    minimum 1.
  - Pas de plafond de niveau dur dans la fonction (la table `LEVELS` va jusqu'à 18, mais la formule
    reste définie au-delà ; on ne bloque pas).

### Setter (`data-state.jsx`)

- `addXp(charId, gain)` : **orchestrateur module** (pas un setter `useCharState`, car la vue MJ donne
  de l'XP à **d'autres** persos que le perso courant). Pattern identique à `moveItem`/`applyHitToEnemy` :
  `getSnapshot(characters/{charId}/state)` → lit `level`/`xp` → `applyXp` → `updatePath` du patch
  `{level, xp}`. Si `levelsGained > 0` : **`pushLog`** (`<b>Nom</b> passe niveau <b>N</b> !`, kind
  `buff`) **+ toast**. Réutilise le `pushLog`/`combat/log` déjà en place → la montée apparaît au journal.
- Exporté sur `window` (pattern zéro-build), consommé par la vue MJ (et plus tard par la séance B).

### UI

- **`XpBar`** (`components.jsx`), composant lecture seule : barre remplie à `xp / xpToNext(level)` +
  label « niv. *N* · *xp*/*seuil* ». Style cohérent avec les `ResourceBar`/barres existantes.
- **Fiche** (`pages-sheet.jsx`) : `XpBar` près du bloc niveau/portrait.
- **Progression** (`pages-progression.jsx`) : `XpBar` en tête (le perso sélectionné).
- **Vue MJ** (`pages-mj.jsx`) : `XpBar` sur chaque carte joueur + un contrôle **« +XP »** (petit input
  numérique + bouton) qui appelle `addXp(charId, n)`.

## Flux

1. Le MJ saisit un gain dans « +XP » d'une carte → `addXp(charId, n)`.
2. `addXp` lit `{level, xp}`, calcule `applyXp(level, xp, n)`, écrit le résultat.
3. Si `levelsGained > 0` : toast + `pushLog`. Le niveau monté **débloque automatiquement** les
   compétences/runes correspondantes (logique déjà en place qui lit `state/level`).
4. Toutes les vues abonnées (`useCharState`/`useAllCharStates`) reflètent la nouvelle barre en temps réel.

## Cas limites

- **Gain qui fait sauter plusieurs niveaux** : géré par la boucle `applyXp` (report en cascade).
- **xp absent** (anciens persos) : traité comme `0` (défaut à la lecture, pas de migration nécessaire).
- **Niveau changé à la main** (stepper Compétences) : ne touche pas `xp` ; pas de recalcul rétroactif
  (acceptable pour un outil maison). `xp` peut temporairement dépasser le nouveau seuil jusqu'au
  prochain `addXp`, qui réabsorbe le surplus.
- **Gain ≤ 0** : ignoré (pas de niveau perdu via cette voie ; le stepper reste la voie de correction).

## Tests (`game-logic.test.js`)

- `xpToNext` : croît avec le niveau (valeurs attendues de la formule de départ).
- `applyXp` : gain sans montée ; gain exactement au seuil → +1 niveau, xp=0 ; gain au-delà → report ;
  gros gain → multi-niveaux + report ; gain 0/négatif → no-op.

## Hors périmètre (→ sous-projet B)

- Modal « Début séance / Visite » à l'ouverture de la vue MJ, état de séance partagé, bouton « Clôturer ».
- Panneau de clôture distribuant XP **en lot** + items/argent (réutilise `addXp`, `moveItem`, `moveCoins`).
- Allocation automatique des points d'attributs au level-up.
