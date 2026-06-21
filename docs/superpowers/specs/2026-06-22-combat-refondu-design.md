# Combat refondu (§6) — léthalité + surcrit — design

> **Statut : design validé par l'utilisateur (2026-06-22).** Sous-projet de la **refonte
> « système hypermétrique »** (`info-mj/SPECIFICATION - Système refondu.md`, §6). Suit la fondation
> moteur de stats (livrée) et l'ajout de la stat `letha` (livré). Source de règles : §6 du doc MJ.

## Problème / objectif

Deux mécaniques de combat du doc ne sont pas encore branchées :

1. **Léthalité** : la stat `letha` (déjà affichée/éditable sur la fiche) doit **réduire l'Armure / la
   Résistance Magique** de la cible avant mitigation (§6.2). Le moteur le supporte déjà
   (`mitigateDamage(raw, type, defense, lethalite)`) mais la résolution joueur→ennemi ne lui passe
   actuellement rien.
2. **Surcrit par paliers** (§6.3) : le **% Crit peut dépasser 100 %**. À 100 % le crit est garanti ;
   chaque tranche de 100 % au-delà ouvre un palier supplémentaire valant **+50 % de Dégâts Crit**.
   Aujourd'hui le crit est entièrement manuel (le MJ multiplie à la main).

## Décisions (validées)

- **L'app roule le crit elle-même** (RNG sur le % Crit, surcrit inclus), **au cast** (côté joueur) :
  le joueur voit immédiatement s'il crit. L'app calcule **les deux** nombres (base + crit).
- Le **d20 de toucher** (Roll20) reste **hors app** : c'est le jet du joueur qui module la qualité du
  coup ; le **MJ fixe le dégât final** appliqué (champ éditable, comme aujourd'hui).
- L'app **affiche** crit/pas-crit + les deux montants à la validation MJ ; le MJ garde le contrôle
  du nombre réellement appliqué.
- La **léthalité** de l'attaquant est snapshotée au cast et appliquée automatiquement dans la
  mitigation à la résolution.
- L'**attaque de base** (`AttackModal`) passe par la **même** logique de crit (pas de double moteur).

## Logique pure (`game-logic.js`)

### `critInfo(critPct) -> { guaranteedTiers, extraChancePct }`
Pour l'**affichage** du profil (panneau MJ / cast). Convention :
- `critPct < 100` : `guaranteedTiers = 0`, `extraChancePct = critPct` (proba d'un crit de base).
- `critPct >= 100` : `guaranteedTiers = floor((critPct - 100) / 100)`,
  `extraChancePct = (critPct - 100) % 100` (proba d'un palier supplémentaire).

### `rollCrit(critPct, dcritBase, rng = Math.random) -> { didCrit, tiers, multiplier }`
- `rng` injectable (tests déterministes), attendu dans `[0, 1)`.
- **`critPct < 100`** : `didCrit = rng < critPct/100`. Si crit : `tiers = 1`, `multiplier = dcritBase/100`.
  Sinon `tiers = 0`, `multiplier = 1`.
- **`critPct >= 100`** : crit garanti. `tiersSupp = floor((critPct-100)/100) + (rng < frac ? 1 : 0)`
  où `frac = ((critPct-100) % 100) / 100`. `multiplier = (dcritBase + 50 * tiersSupp) / 100`,
  `tiers = 1 + tiersSupp`, `didCrit = true`.
- Le **dégât critique** = `round(base * multiplier)`. `multiplier = 1` ⇒ pas de crit (base inchangée).

Contrôle (espérance §6.3, pour les tests de sanity) : pour `critPct >= 100`, le multiplicateur moyen
≈ `(dcritBase + (critPct - 100)/2) / 100`.

### `mitigateDamage` (existant, inchangé)
`mitigateDamage(raw, type, {armure, resmag}, lethalite)` — `eff = max(0, stat - lethalite)`,
réduction `eff/(eff+120)`, `brut` = aucune réduction. Déjà en place ; on lui passe enfin la léthalité.

## Flux de données

### Au cast (`pages-competences.jsx`)
Quand une compétence à dégâts cible un ennemi, en plus de `computedDmg` (base) actuel :
- rouler `rollCrit(eff.crit, eff.dcrit)` → `{ didCrit, multiplier }` ;
- `critDmg = round(computedDmg * multiplier)` ;
- enrichir `addHit({ … , computedDmg, critDmg, didCrit, critMult: multiplier, letha: eff.letha || 0,
  crit: eff.crit, dcrit: eff.dcrit })`.
- Toast/journal au cast : mentionner « CRITIQUE ! » si `didCrit`.

### Attaque en attente (`combat/pendingHits/{id}`)
Champs ajoutés : `critDmg` (nombre), `didCrit` (bool), `critMult` (nombre), `letha` (nombre ≥ 0),
`crit`/`dcrit` (info d'affichage). Rétrocompatible : les anciens hits sans ces champs retombent sur
`computedDmg` / léthalité 0. **Aucune nouvelle règle RTDB** : la `.validate` existante est
`newData.hasChildren(['attackerId','targetId','computedDmg'])` — elle **exige** ces clés mais
**n'interdit pas** d'en ajouter, donc les nouveaux champs passent sans republier.

### Carte MJ (`PendingHitRow`, `pages-mj.jsx`)
- Affiche **Base** vs **Crit (×mult)** avec le résultat roulé mis en avant (badge « 🎲 CRIT » /
  « normal ») et le profil `critInfo` en sous-texte.
- Champ dégâts **pré-rempli** avec le nombre roulé (`critDmg` si `didCrit`, sinon `computedDmg`),
  toujours éditable (le MJ ajuste à son d20 de toucher).
- Léthalité affichée + éditable (défaut = `hit.letha`).
- **Appliquer** → `applyHitToEnemy(enemy, finalDmg, type, letha)`.

### Résolution (`applyHitToEnemy`, `data-state.jsx`)
Signature étendue : `applyHitToEnemy(enemy, finalDmg, type, lethalite = 0)` →
`mitigateDamage(finalDmg, type, { armure, resmag }, lethalite)` → `applyDamageToPools`. Journal
inchangé.

### Attaque de base (`computeAttack` / `AttackModal`)
`computeAttack` route son crit par `rollCrit` (au lieu du `isCrit` ad-hoc) pour intégrer le surcrit.
`AttackModal` affiche le résultat (et le palier si surcrit).

## Hors périmètre

- Crit / léthalité **ennemi → joueur** (`EnemyAttackModal`) : les ennemis n'ont pas de stat
  `crit`/`dcrit`/`letha` ; à traiter dans un lot ultérieur (ou avec la zone PNJ §8).
- Léthalité « magique vs physique » distincte : ici une seule valeur `letha` réduit la résistance du
  type de l'attaque. Une léthalité typée pourra venir plus tard.

## Tests (`test/game-logic.test.js`)

- `rollCrit` `rng` injecté : `< 100 %` raté (`rng` haut) / touché (`rng` bas) ; `= 100 %` crit garanti
  base ; `= 250 %` → 1 tier garanti + fraction (rng bas/haut) ; multiplicateurs exacts.
- `critInfo` : `< 100`, `= 100`, `= 250`.
- `mitigateDamage` avec léthalité : réduit l'AR/RM ; ne passe pas sous 0 ; `brut` ignore.
- Sanity espérance §6.3 (tolérance).

## Risques

- **Rétrocompat des hits** : un hit créé avant le déploiement (sans `critDmg`/`letha`) doit rester
  applicable → lecture défensive (`hit.critDmg ?? hit.computedDmg`, `hit.letha || 0`).
- **Règles RTDB** : vérifié — `combat/pendingHits` a une `.validate` `hasChildren([…])` non
  restrictive ; les nouveaux champs passent. **Rien à republier.**
- **Équilibrage** : le surcrit amplifie fortement les hauts % Crit ; à valider en jeu par le MJ.
