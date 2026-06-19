# Design — Refonte vue MJ + gestion des ennemis (v1)

Date : 2026-06-19
Statut : validé (brainstorming)

## Contexte

La vue MJ (`pages-mj.jsx`) affiche les fiches joueurs compactes dans une **rangée
horizontale** de cartes à largeur fixe (300px, `flex:'none'`), ce qui force un
**défilement horizontal** pénible pour voir toute la table (l'en-tête dit même
« faites défiler horizontalement »).

Par ailleurs, le MJ n'a aucun outil pour suivre les **ennemis** en combat : il
gère les PV des monstres à la main, hors de l'outil.

Ce design corrige le layout et ajoute une **gestion d'ennemis locale au MJ** avec
suivi des HP/mana et application des dégâts dans les deux sens.

## Objectifs

1. Supprimer le scroll horizontal : grille responsive qui passe à la ligne.
2. Permettre au MJ de créer/éditer/supprimer des ennemis (édition simplifiée :
   nom + HP + mana, pas de stats/inventaire).
3. Suivre les HP des ennemis en combat via deux actions :
   - **Attaque** : l'ennemi frappe un joueur → applique les dégâts au joueur
     (écriture Firebase, le joueur voit ses HP descendre en temps réel).
   - **Subir** : les joueurs frappent l'ennemi → baisse les HP de l'ennemi (local).

## Hors périmètre (v2 éventuelle)

- **Plateau partagé** où les joueurs voient les ennemis et cliquent eux-mêmes pour
  infliger des dégâts (nécessiterait des ennemis en Firebase + nouvelles règles RTDB).
- **Léthalité** de l'attaquant ennemi (par défaut 0 en v1 ; la formule la supporte
  déjà, on pourra l'exposer plus tard).
- Armure/résistance magique **de l'ennemi** (les dégâts subis par l'ennemi sont
  appliqués bruts en v1).

## Décisions

- **Stockage des ennemis : `localStorage`** du navigateur MJ (clé
  `runeterra_mj_enemies`). Survit au refresh sur le même poste. **Zéro Firebase,
  zéro règle RTDB** à republier. Cohérent avec le choix « local au MJ ».
- **Mitigation = moteur Excel** (`info-mj/Codes App Script.md`), source de vérité :
  l'armure réduit les dégâts **avant** le bouclier (l'armure réduit donc aussi ce
  que le bouclier encaisse).
- **Ennemis = HP + mana uniquement** (+ un dégât d'attaque par défaut pré-rempli).
  Pas de stats/inventaire.

## Architecture

### 1. Fix layout (zone principale de `MJPage`)

Remplacer le conteneur horizontal :

```
<div className="row gap-4" style={{ alignItems:'stretch', minWidth:'min-content' }}>
```

par une **grille responsive** :

```
display:'grid',
gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))',
gap:16, alignItems:'start'
```

`MJCompactCard` passe de `width:300, flex:'none'` à une largeur qui remplit sa
cellule (retirer `width`/`flex`, laisser la grille gérer). Supprimer la mention
« faites défiler horizontalement » dans l'en-tête.

### 2. Modèle de données ennemi (local)

```js
// makeEnemy(name) -> objet ennemi
{
  id,        // 'enemy_' + timestamp/rand
  name,      // string
  hpCur, hpMax,     // entiers >= 0
  manaCur, manaMax, // entiers >= 0 (0 = barre mana masquée)
  atk,       // dégât d'attaque par défaut (pré-remplit le modal Attaque), éditable
}
```

Persistance : un hook `useMJEnemies()` (dans `pages-mj.jsx` ou un petit module)
qui lit/écrit `localStorage['runeterra_mj_enemies']` (JSON) et expose
`{ enemies, addEnemy, updateEnemy, removeEnemy }`. State React miroir pour le
rendu. Pas de temps réel (local).

### 3. Logique pure de combat (game-logic.js, testable)

Reproduire fidèlement le moteur Excel sous forme de fonctions pures :

```js
// Mitigation par armure/résistance (LoL-style, AR-120).
// type ∈ {'physique','magique','brut'}. brut = pas de mitigation.
mitigateDamage(raw, type, { armure, resmag }, lethalite = 0) -> degatsFinal (entier, ceil)
  physique: red = max(0, armure - leth) / (max(0, armure - leth) + 120)
  magique:  red = max(0, resmag - leth) / (max(0, resmag - leth) + 120)
  brut:     red = 0
  return Math.ceil(raw * (1 - red))

// Applique des dégâts (déjà mitigés) à bouclier puis HP.
applyDamageToPools({ hpCur, shield }, degatsFinal)
  -> { hpCur, shield, ko }   // bouclier absorbe d'abord ; excédent aux HP ; KO si HP atteint 0
```

`applyDamageToPools` suit `appliquerDegatsAvecBouclierEtHP_` :
- si `shield > 0` : si `degats <= shield` → `shield -= degats`, HP inchangés ;
  sinon `degats -= shield`, `shield = 0`, on continue sur les HP.
- HP : si `degats >= hpCur` → `hpCur = 0` (KO) ; sinon `hpCur -= degats`.

Exposées via le pattern UMD existant (`Object.assign(window, ...)` + `module.exports`).

### 4. Section « Ennemis » (UI, sous la grille joueurs)

Dans la zone principale de `MJPage`, après la grille des cartes joueurs :

- Bandeau **« Ennemis »** + bouton **« + Ajouter un ennemi »** (crée un ennemi
  vierge, ouvre l'édition inline du nom + HP max + mana max).
- Grille d'**`EnemyCard`** (même grille responsive). Chaque carte :
  - nom (éditable), barre HP (`ResourceBar kind="hp"`), barre mana si `manaMax>0`,
  - bouton **⚔ Attaque** → ouvre `EnemyAttackModal`,
  - bouton **🛡 Subir** → ouvre `EnemyTakeDamage` (input simple montant → HP ennemi -= montant, borné à 0),
  - menu/edit : éditer (nom, hpMax, manaMax, atk), supprimer.
  - steppers rapides ± sur HP de l'ennemi (ajustement manuel).

### 5. `EnemyAttackModal` (ennemi → joueur)

Champs : **montant** (pré-rempli avec `enemy.atk`), **type** (physique/magique/brut),
**joueur ciblé** (liste `CHARACTERS`). À la validation :

1. Lire l'état live + stats effectives du joueur ciblé via `mjLive(c, st)` :
   `eff.armure`, `eff.resmag`, `shield`, `hpCur`.
2. `degatsFinal = mitigateDamage(montant, type, { armure: eff.armure, resmag: eff.resmag })`.
3. `{ hpCur, shield, ko } = applyDamageToPools({ hpCur, shield }, degatsFinal)`.
4. **Écrire dans Firebase** : `window.RTDB.updatePath(`${CAMPAIGN}/characters/${charId}/state`, { hpCur, shield })`.
5. Toast récap (« Rathäel subit 23 (physique) → 12 HP » / « KO »).

Le MJ a déjà les droits d'écriture sur toutes les fiches (staff) ; la vue MJ est
staff-only. Aucune nouvelle règle RTDB.

## Flux de données

- **Ennemis** : `localStorage` ↔ `useMJEnemies` ↔ `EnemyCard`/modals (local, pas de réseau).
- **Attaque ennemi → joueur** : modal → logique pure → `RTDB.updatePath` sur la
  fiche du joueur → le joueur (et la vue MJ) voient les HP via les abonnements existants.
- **Subir (joueur → ennemi)** : input → `updateEnemy` (local) → re-render.

## Gestion d'erreurs / cas limites

- HP/mana bornés à `[0, max]` ; saisies non numériques ignorées (fallback 0).
- Montant de dégâts négatif/0 : ignoré (no-op) ou borné à 0.
- Ennemi sans mana (`manaMax=0`) : barre mana masquée.
- Suppression d'ennemi : confirmation légère (ou suppression directe + annulable
  via toast — à trancher au plan ; défaut : suppression directe, c'est local).
- Joueur ciblé sans état Firebase encore initialisé : utiliser le fallback `mjLive`
  (déjà géré) ; l'écriture amorce l'état.

## Tests (logique pure, `node --test`)

- `mitigateDamage` : physique avec armure (ex. AR=120 → 50 % → ceil), magique,
  brut (= montant), léthalité réduisant l'armure sans passer sous 0, AR=0.
- `applyDamageToPools` : bouclier absorbe tout / partiellement / excédent vers HP,
  KO exact (degats == hp), KO avec excédent, sans bouclier.
- Pas de test UI (cohérent avec le reste du projet) ; vérif visuelle manuelle.

## Fichiers touchés

- `game-logic.js` — ajout `mitigateDamage`, `applyDamageToPools` (UMD + export).
- `test/game-logic.test.js` — nouveaux tests.
- `pages-mj.jsx` — fix grille, `useMJEnemies`, section Ennemis, `EnemyCard`,
  `EnemyAttackModal`, `EnemyTakeDamage`, helper d'écriture Firebase.
- `CLAUDE.md` — mise à jour carte des fichiers / état (à la fin).
- Aucune règle RTDB, aucun changement Firebase console.
