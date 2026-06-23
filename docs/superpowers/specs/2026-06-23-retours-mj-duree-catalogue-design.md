# Spec — Retours MJ : durée Mur de Givre + catalogue d'objets éditable

Date : 2026-06-23
Statut : validé (brainstorming), à planifier

Deux features indépendantes issues d'un retour du MJ. Un seul spec, deux plans /
implémentations distincts possibles.

---

## Feature A — Mur de Givre (Rathael C2) : durée 1/2 tours avec auto-expiration

### Contexte
`Mur de Givre` (`data.jsx`, id `mur_de_givre`) pose aujourd'hui un buff plat
+Armure/+RM (`selfBuffFlat` → `rathaelC2Buff(level)` = 15 +5/2 niv, soit 20 au
niv 2) qui dure **jusqu'au ⟲ Combat** (pas de minuteur). La règle réelle (PE =
« Pendant l'Effet ») : à l'activation, on **choisit 1 ou 2 tours**, durée pendant
laquelle TOUS les effets tiennent (inamovible, +AR/RM, provocation d'un ennemi
adjacent, immobilisation des ennemis adjacents en état Âme fendue).

### Décision
Donner une **date d'expiration** (n° de tour) aux buffs de soi, sur le modèle des
cooldowns qui stockent déjà un `readyAt`. Mécanisme générique mais **câblé
uniquement sur Mur de Givre** (YAGNI).

### Modèle de données
`state/skillBuffs/{skillId}` passe de `{ [stat]: n }` (plat) à :

```
state/skillBuffs/{skillId} = { mods: { [stat]: n }, until: <n° de tour> | null }
```

- `until = null` → comportement actuel (dure jusqu'au ⟲ Combat).
- **Compat** : un buff lu sous l'ancienne forme plate (pas de clé `mods`) est
  traité comme `{ mods: <plat>, until: null }`. Pas de migration de données.

### Logique pure (`game-logic.js`)
- `sumSkillBuffs(skillBuffs, currentTurn)` : nouvelle signature. Pour chaque buff,
  normalise la forme (`mods`/plat), puis **ignore** tout buff dont
  `until != null && currentTurn > until`. Somme les `mods` restants.
  - Conséquence : un buff expiré cesse d'agir partout (fiche / Combat / MJ) **et
    disparaît du panneau orange « Effets de combat actifs »**, sans aucune écriture.
- Tests `game-logic.test.js` : forme plate (compat), `until` futur (actif),
  `until` passé (ignoré), `until=null` (permanent).

### Sémantique de durée
Cast au tour `T`, choix `D ∈ {1, 2}` → `until = T + (D − 1)`.
Actif tant que `currentTurn <= until`.
- `D=1` → actif ce tour, expire au tour suivant.
- `D=2` → actif ce tour + le suivant.

Note : le compteur de tour est **global/partagé** (`combat/turn`), pas par joueur.
Sémantique à confirmer à l'usage ; le MJ ajuste à la table au besoin.

### UI du cast (`pages-competences.jsx`)
- Une compétence déclare `duration: { min: 1, max: 2 }` dans `SKILLS` ; seul
  `mur_de_givre` l'a pour l'instant.
- La carte affiche un petit sélecteur **1 / 2 tours** (état local de carte, comme
  les variables d'attaque existantes 1er coup / furtif / cases / cibles).
- `cast()` calcule `until = turn + (durée − 1)` et écrit le buff sous la nouvelle
  forme `{ mods, until }` via `setSkillBuff`.
- Le `pushLog` du cast mentionne la durée (ex. « +20 AR/RM pendant 2 tours »).

### Intégration
- Tous les appelants de `sumSkillBuffs` passent le **tour courant** (`useSharedTurn`
  est déjà lu dans Combat ; fiche/MJ doivent le lire aussi pour filtrer).
- `setSkillBuff(skillId, mods, until)` : 3e param optionnel ; écrit la forme
  `{ mods, until }`.
- Optionnel (housekeeping, non requis) : `useSharedTurn.nextTurn` purge les buffs
  expirés. Le filtrage au read suffit fonctionnellement.
- `resetCombat` continue d'effacer tous les `skillBuffs` (inchangé).

### Texte
Réécrire la description de `mur_de_givre` pour expliciter **PE = pendant 1 ou 2
tours au choix** : inamovible, +Armure/+RM, provocation d'un ennemi adjacent, et
(en état Âme fendue) immobilisation des ennemis adjacents — tout dure la durée
choisie.

### Règles RTDB
Aucune nouvelle règle (`skillBuffs` déjà couvert par `characters/$charId`).

---

## Feature B — Catalogue d'objets de base éditable (Firebase, depuis le picker)

### Contexte
`ITEM_CATALOG` (`data.jsx`) est codé en dur. Le bouton « + Ajouter » (staff) lit ce
catalogue via `ItemCatalogPicker` mais ne permet pas de le **modifier**. Le MJ ne
peut donc pas retirer les objets de placeholder ni ajouter les siens à la liste de
base ; les objets créés via l'éditeur vivent dans un inventaire (perso/commun), pas
dans le catalogue.

### Décision
Persister le catalogue en **Firebase partagé**, l'éditer **depuis le picker** (staff).

### Modèle de données
```
campaign/runeterra/catalog/{itemId} = { id, cat, name, sub, ic, img, type, mods }
```
Mêmes champs qu'un item. Lecture = tout inscrit, **écriture = staff**.
Marqueur d'amorçage : `campaign/runeterra/catalogInit = true`.

### Amorçage unique
Au 1er chargement, si `catalog` est vide **ET** `catalogInit` absent :
1. Semer chaque entrée codée en dur de `ITEM_CATALOG` (`data.jsx`) avec un `id`
   généré (`newItemId`).
2. Poser `catalogInit = true`.

Ensuite **Firebase fait foi** : si le MJ supprime tout, ça **ne re-sème pas**. La
liste en dur reste dans le code uniquement comme graine + repli pendant le
chargement. Amorçage réservé au staff (écriture).

### Lecture (`data-state.jsx`)
- Nouveau hook `useItemCatalog()` : abonnement temps réel à `catalog`, renvoie un
  tableau trié (par catégorie puis nom). Repli sur `ITEM_CATALOG` en dur tant que
  non chargé / non semé.
- Orchestrateur d'amorçage (`seedCatalogIfEmpty`, staff) déclenché au montage du
  picker côté staff.

### Édition dans le picker (`components.jsx` — `ItemCatalogPicker`)
- Le picker lit `useItemCatalog()` au lieu de `window.ITEM_CATALOG`.
- En mode **staff** : chaque vignette d'objet a **✎ Éditer** / **🗑 Supprimer**, et
  un bouton **« + Nouvel objet de base »**.
- L'édition réutilise l'éditeur `InvItemRow` (en modal, `startEdit`) : catégorie,
  emplacement `type` (si Équipement), bonus `mods`, **upload d'image** (déjà géré
  via `downscaleImageToDataURL`). Sauvegarde → écrit `catalog/{id}`.
- Suppression → retire `catalog/{id}`.
- Les joueurs (non-staff) n'ont pas accès au picker pour l'ajout (gate `isStaff`
  existant) ; donc l'édition reste de facto staff.

### Suppression sûre
Retirer un objet du catalogue **n'affecte pas** les inventaires perso/commun déjà
remplis (ce sont des copies au moment de l'ajout). Ça enlève seulement l'objet de
la liste de base.

### Règles RTDB (`database.rules.json`)
Ajouter un bloc `catalog` sous `campaign/runeterra` :
- lecture = tout participant inscrit,
- écriture = staff (mj/admin), au niveau `$itemId`,
- `catalogInit` = lecture inscrits, écriture staff.

**À republier une fois en console Firebase** après déploiement (sinon l'écriture du
catalogue est bloquée et l'amorçage échoue).

---

## Déploiement
- Bumper le jeton `?v=` (cache-busting) dans `index.html` au push.
- Feature B : republier `database.rules.json` en console (bloc `catalog`).
- Feature A : rien de spécial côté Firebase.

## Tests
- `game-logic.test.js` : `sumSkillBuffs(buffs, currentTurn)` (compat plate, until
  futur/passé/null).
- `node --test` + `npx esbuild` sur les `.jsx` touchés.
