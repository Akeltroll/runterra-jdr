# Retrait d'XP · Fusion slot Armure · Système de poids · CD visible — Design

**Date :** 2026-06-24
**Statut :** validé (brainstorming), à découper en plan d'implémentation.

Quatre chantiers indépendants regroupés dans un seul spec (petites features, mêmes
fichiers touchés). Chacun peut devenir une tâche séparée dans le plan.

**Contraintes globales :** zéro-build (chaque `.jsx`/`.js` définit localement puis
`Object.assign(window, {...})`), logique pure testée en Node (`game-logic.js`, UMD),
Firebase RTDB compat. **Aucune nouvelle règle RTDB** (tout vit dans
`characters/$charId/state` + des champs d'items déjà autorisés par `.validate`).
Déploiement = bump du jeton `?v=` dans `index.html`.

---

## 1. Retrait d'XP

**Problème :** `addXp` ne fait qu'ajouter. En cas de fausse manip (XP donnée par erreur),
pas de retour arrière.

**Décision (validée) :** le retrait **redescend de niveau** si on passe sous 0 dans le
niveau courant — miroir exact de la montée. Plancher **niveau 1 / XP 0**.

### Logique pure — `game-logic.js`
```
applyXpLoss(level, xp, loss) -> { level, xp, levelsLost }
```
- `loss` borné `>= 0`. Part de `xp` courant, retire `loss`.
- Tant que `xp < 0` **et** `level > 1` : `level -= 1` ; `xp += xpToNext(level)` (on remonte
  l'XP du niveau désormais courant) ; `levelsLost += 1`.
- Plancher : si `level === 1` et `xp < 0` → `xp = 0`.
- Cohérence avec `applyXp` : `applyXp(level, xp, g)` puis `applyXpLoss(res.level, res.xp, g)`
  doit redonner `{level, xp}` d'origine (testé pour des cas sans cap).

### Orchestrateur — `data-state.jsx`
```
async removeXp(charId, loss) -> { level, xp, levelsLost }
```
- Symétrique d'`addXp` : `getSnapshot(charPath)` → `applyXpLoss(curLevel, curXp, loss)` →
  `updatePath({ level, xp })`.
- `pushLog` si `levelsLost > 0` (`<b>Nom</b> redescend niveau <b>N</b>`, kind `debuff`).
- Retourne le résultat pour un toast appelant.

### UI — `pages-mj.jsx` (~ligne 113-122)
À côté du contrôle « + XP » existant (même champ `xpIn`), ajouter un bouton **« − XP »** qui
appelle `removeXp(c.id, n)` avec la même valeur saisie ; toast si perte de niveau, reset du
champ. Pas d'autre point d'entrée (le contrôle MJ ad-hoc suffit).

---

## 2. Fusion des slots d'armure

**Problème :** 4 slots distincts (Épaules / Cuirasse / Gants / Pantalon) alourdissent le
paperdoll alors que l'armure se gère en une pièce.

**Décision (validée) :** un seul slot **`armure`** qui **accepte les 4 types** d'items
(`shoulders`, `chest`, `gloves`, `pants`) — **types d'items inchangés**, zéro re-typage. Le
slot ne contient **qu'un item à la fois**.

### `pages-equip.jsx`
- `EQUIP_SLOTS` : retirer `epaules`, `cuirasse`, `gants`, `pantalon` ; ajouter
  `armure: { label:'Armure', accepts:['shoulders','chest','gloves','pants'], area:'armure' }`.
- `EQUIP_GRID_AREAS` : recomposer la grille pour placer le slot `armure` unique (il occupe
  l'espace libéré par les 4 anciens ; garder une mise en page équilibrée gauche/droite).

### Migration unique — `EquipBody`
Sans nettoyage, les anciennes clés d'équipement (`epaules`…) resteraient dans
`state/equipment` et **`sumItemMods` (qui itère toutes les clés) compterait des bonus
fantômes**. Migration au montage, idempotente via un marqueur :
- Si `state.equipment` contient au moins une des 4 anciennes clés **et** que le marqueur
  `armureInit` est absent :
  - `armure` ← le **premier** ancien slot rempli (ordre épaules→cuirasse→gants→pantalon),
    s'il y en a un et que `armure` est vide.
  - `null` sur les 4 anciennes clés (les items restent dans l'inventaire, simplement
    déséquipés).
  - poser `armureInit = true` (state du perso).
- Écriture via `setEquipment` (+ un `updatePath` pour le marqueur), réservée au staff comme
  le reste de l'édition d'équipement.

**Note :** un seul item d'armure peut être équipé après fusion — c'est voulu (l'armure = une
pièce). Les pièces excédentaires restent dans l'inventaire, ré-équipables (elles remplacent
celle en place).

---

## 3. Système de poids porté

**Problème :** aucune gestion de l'encombrement. Le MJ veut un poids par item et une
capacité de charge augmentée par la ceinture.

**Décisions (validées) :**
- Capacité = **Force + ceinture** : base dérivée de la Force + bonus des items équipés.
- Surcharge = **affichage seul** : jauge + alerte rouge, **aucun blocage ni malus auto** ;
  le MJ arbitre les conséquences.

### Modèle de données — nouveaux champs d'item
- `weight` : poids **unitaire** (nombre ≥ 0, défaut **0**). Sur **tous** les items
  (équipement, consommables, butin).
- `carry` : bonus de **capacité de charge** (nombre ≥ 0, défaut **0**). Pertinent surtout
  pour la ceinture (mais autorisé sur tout Équipement).

Défauts à 0 → rien ne casse tant que le MJ n'a pas renseigné les poids. Champs ajoutés à
`makeItem` (défauts) et persistés tels quels dans `inventory`/`catalog`/`sharedInventory`
(déjà couverts par les règles existantes, `.validate` inchangé).

### Logique pure — `game-logic.js`
```
carriedWeight(items) -> number
  Σ (item.weight||0) × (item.qty||0) sur la map d'inventaire perso (items à qty 0 = 0).

carryCapacity(force, equipment, itemsById) -> number
  CARRY_BASE + force × CARRY_PER_FORCE + Σ (carry des items ÉQUIPÉS).
  Constantes exportées et tunables — proposition initiale : CARRY_BASE = 10, CARRY_PER_FORCE = 5.

weightStatus(carried, cap) -> { pct, over }
  pct = cap > 0 ? carried / cap : 0 ; over = carried > cap. (pct non borné pour la barre.)
```
Force lue depuis les caracs **live** (`state.attrs ?? char.attrs`, via `charBaseStats` ou
accès direct `attrs.force`). `equipment` + `itemsById` = ceux déjà en main dans `EquipBody`.

### UI
- **Page Équipement** (`pages-equip.jsx`) : jauge **« Poids porté X / max »** près des stats /
  de la monnaie, remplissage proportionnel, **rouge si `over`** (réutiliser le style de
  `ResourceBar` ou une barre simple). Affiche les chiffres.
- **Inventaire perso de la fiche** (`pages-sheet.jsx`) : petit total « Poids : X / max »
  (lecture), même calcul.
- **Éditeur d'item** (`InvItemRow`, `components.jsx`) : champ **Poids** (tous items) ; champ
  **Capacité (+charge)** affiché pour `cat === 'Équipement'` (à côté de la section type/mods).

---

## 4. CD visible sur les cartes de Combat

**Problème :** la durée de cooldown d'une compétence ne se découvre qu'après l'avoir lancée
(le badge n'affiche que l'état « Prêt » / « prêt tour X »).

**Décision :** badge **CD intrinsèque persistant** dans le coin droit de chaque carte de
compétence, toujours visible, distinct du badge d'état dynamique.

### `pages-competences.jsx` — `ActiveCard`
- Dériver un libellé depuis les données `SKILLS` (`sk.kind` / `sk.cd`) :
  - `kind === 'turn'` → `1×/tour`
  - `kind === 'combat'` → `1×/combat`
  - `kind === 'cd'` → `CD {sk.cd} tour(s)` (si `cd === 0` → `Sans CD`)
- Afficher ce badge dans `panel-head` à côté du badge mana, **avant** le badge d'état
  (`cdLabel`). Style discret (fond `--bg-inset`, texte `--gold-pale`), présent même quand la
  carte est prête. Le badge d'état dynamique existant reste inchangé.
- Cartes verrouillées (niveau) : non concernées (déjà un autre affichage).

---

## Tests (TDD, `test/game-logic.test.js`)
- `applyXpLoss` : retrait simple dans le niveau ; cascade sur 1 niveau ; cascade multi-niveaux ;
  plancher niveau 1 / XP 0 ; round-trip avec `applyXp`.
- `carriedWeight` : somme `weight×qty`, items à qty 0 ignorés, map vide → 0.
- `carryCapacity` : base + Force×facteur + somme des `carry` équipés ; sans équipement ;
  item équipé sans `carry`.
- `weightStatus` : sous/au-dessus de la capacité, capacité 0.

## Déploiement
- Bump `?v=` dans `index.html` (+ `window.APPV`).
- **Aucune règle RTDB à republier** (champs d'items déjà autorisés, état dans
  `characters/$charId`).
- Merge/push selon préférence (petits fixes groupés → branche `feat/*` puis `main`).

## Self-review
- **Placeholders :** aucun.
- **Cohérence :** `applyXpLoss`/`removeXp` symétriques d'`applyXp`/`addXp` ✓ ; migration
  armure nettoie les clés obsolètes pour éviter le double-comptage `sumItemMods` ✓ ; poids
  défaut 0 = non-régression ✓ ; CD badge lit `sk.kind`/`sk.cd` déjà présents dans `SKILLS` ✓.
- **Scope :** 4 features petites et indépendantes — un seul plan, 4 tâches.
- **Ambiguïté :** capacité = `CARRY_BASE + force×CARRY_PER_FORCE + Σcarry équipés` (constantes
  10 / 5, tunables) ; surcharge = affichage seul (pas de malus) ; slot armure = 1 item,
  accepte 4 types sans re-typage.
