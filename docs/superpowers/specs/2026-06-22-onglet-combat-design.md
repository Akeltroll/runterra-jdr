# Onglet « Combat » + attaque de base — design

> **Statut : design validé par l'utilisateur (2026-06-22).** Suite directe du sous-projet
> « Combat refondu » (léthalité + surcrit, livré sur `feat/combat-refondu`). Intègre l'attaque de
> base au flux d'attaques en attente, renomme l'onglet, et corrige le passage des variables d'attaque.

## Problème / objectif

En campagne, on attaque **soit** par compétence **soit** par attaque de base. L'attaque de base est
aujourd'hui un bouton **isolé sur la fiche** (`AttackModal`) qui ne fait qu'afficher un nombre dans un
toast : pas de cible, pas d'attaque en attente, pas de journal. On veut l'unifier avec le flux des
compétences (cibler un ennemi → attaque en attente → le MJ résout, crit roulé, journalisé), et
renommer l'onglet en conséquence.

En explorant, un **bug existant** est apparu : les variables d'attaque de la carte de compétence
(1er coup, camouflé, cases, **cibles**) sont prises en compte pour l'**affichage** (`ctx = baseCtx +
vars`) mais **pas** par `cast()` (qui recalcule les dégâts avec `baseCtx` seul). Elles sont donc
ignorées à l'envoi au MJ. Le besoin « multi-coups » en dépend (le nombre de cibles vit dans ces vars).

## Décisions (validées)

- **Renommage** : libellé de menu `Compétences` → **« Combat »** ; titre de page « Combat — {nom} ».
- **Attaque de base dans l'onglet Combat** : carte dédiée, **même flux** que les compétences
  (cible → attaque en attente → MJ). **Pas de mana, pas de cooldown** (dispo chaque tour, §6.1).
- **Fiche** : on retire l'**action** (bouton « ⚔ Lancer une attaque » + sélecteur de léthalité 0-3
  legacy + modale `AttackModal`) ; on **garde** le panneau « Arme équipée » en lecture seule
  (arme + dégâts estimés). `AttackModal` et `computeAttack` deviennent inutilisés → **supprimés**.
- **Fix variables d'attaque** : `cast` reçoit les vars de la carte → les dégâts envoyés au MJ
  reflètent enfin 1er coup / camouflé / cases.
- **Multi-coups** : une compétence à `nbTargets` > 1 génère **N attaques en attente**, chacune avec
  **son propre jet de crit** (`rollCrit`). Elles ciblent par défaut l'ennemi sélectionné ; le MJ
  ajuste/répartit. **Une carte = un coup** ; **Appliquer** ferme la carte (déjà via `removeHit`).
- **Garde « pas de cible »** : toute action à dégâts (compétence avec `dmg`, ou attaque de base)
  **sans cible sélectionnée** → toast d'avertissement (comme « pas assez de mana ») et le cast
  **n'a pas lieu** (aucune mana consommée, aucun cooldown posé).

## Architecture / changements

### `index.html`
- `PAGES` : l'entrée `{ id:'competences', label:'Compétences', … }` → `label:'Combat'` (id inchangé
  pour ne pas casser le routage/permissions).

### `pages-competences.jsx`
- **Titre** : « Compétences — {nom} » → « Combat — {nom} ».
- **`ActiveCard`** : `onCast` passe le contexte d'attaque calculé à la carte. Nouvelle signature
  d'appel : `onCast(ctx, dmg, nbHits)` où `ctx = {...baseCtx, ...vars}`, `dmg = sk.dmg(eff, ctx)`
  (déjà calculé pour l'affichage), `nbHits = (besoin nbTargets) ? max(1, vars.nbTargets) : 1`.
- **`cast(sk, ctx, dmg, nbHits)`** :
  - Garde : si `sk.dmg` (action à dégâts) **et** pas de `targetId` → toast « Choisis une cible »
    et `return` (avant mana/cooldown).
  - Mana/cooldown comme aujourd'hui (une seule fois, pas par coup).
  - Buffs/soin/bouclier : inchangés (utilisent `ctx`).
  - Dégâts : si `dmg != null && targetId`, **boucler `nbHits` fois** → pour chaque coup
    `rollCrit(eff.crit, eff.dcrit)` → `addHit({ …, computedDmg: dmg, critDmg, didCrit, critMult,
    letha: eff.letha||0, crit, dcrit, targetId })` + `pushLog`. Un toast récapitulatif
    (« envoyé au MJ — N coup(s) »).
- **Nouvelle carte « Attaque de base »** (`BasicAttackCard`), rendue après le bandeau cible, avant le
  Passif :
  - Lit l'arme équipée (`weaponTypeOf` + nom via `state.equipment.armePrincipale`/`WEAPONS`).
  - Dégâts = `wType === 'Magique' ? eff.ap : eff.ad` (dégâts pleins).
  - Bouton « Attaquer » : garde cible (toast si absente) → `rollCrit` → **une** attaque en attente
    (`addHit`, type selon l'arme, léthalité snapshot, champs crit) + `pushLog`. Pas de mana/cooldown.

### `pages-sheet.jsx`
- `CombatColumn` : retirer le sélecteur de léthalité (0-3), le bloc « Dégâts estimés » garde sa place,
  retirer le bouton « ⚔ Lancer une attaque ». Garder le panneau « Arme équipée » + dégâts estimés.
- Retirer l'état `modal`, le prop `onAttack`, l'usage `{modal && <AttackModal …>}` et le `lethality`
  local devenu inutile.

### `components.jsx`
- Supprimer le composant `AttackModal` et son export.

### `data.jsx`
- Supprimer `computeAttack` et son export (plus aucun consommateur).

## Hors périmètre

- Répartition fine multi-cibles (chaque coup sur un ennemi différent) : les N coups visent l'ennemi
  sélectionné ; le MJ répartit à la main. Une sélection multi-cibles dédiée pourra venir plus tard.
- Crit/léthalité ennemi→joueur : déjà hors périmètre (lot ultérieur).

## Tests

Pas de nouvelle logique pure (réutilise `rollCrit`/`addHit`/`mitigateDamage` déjà testés). Vérif :
- Syntaxe esbuild de tous les fichiers modifiés.
- Suite `node --test` inchangée verte (aucune régression).
- Vérification visuelle (manuelle) : attaque de base ciblée → carte MJ ; compétence multi-cibles →
  N cartes ; action sans cible → toast ; fiche sans bouton d'attaque mais arme affichée.

## Risques

- **`onCast`/`cast` signatures** : bien propager `ctx`/`dmg`/`nbHits` (la carte calcule déjà `dmg` avec
  `ctx` ; éviter le double calcul/divergence).
- **Skills sans dégâts** : la garde « pas de cible » ne doit s'appliquer qu'aux actions à dégâts
  (`sk.dmg != null`), pas aux utilitaires/buffs.
- **Suppression `AttackModal`/`computeAttack`** : vérifier l'absence de référence résiduelle
  (`grep`) avant commit.
- **Aucune règle RTDB** : flux `combat/pendingHits` inchangé côté schéma.
