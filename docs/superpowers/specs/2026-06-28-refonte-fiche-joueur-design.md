# Refonte de la fiche joueur — design

> Branche : `feat/refonte-fiche`. Chantier A du lot d'améliorations (fiche → hub → runes → animations).
> Objectif : rendre la fiche (`pages-sheet.jsx`) plus lisible et intuitive, corriger l'incohérence
> des consommables, et fermer une faille de triche, sans changer le moteur de règles.

## Contexte / problèmes actuels

La fiche (`SheetBody`) est ressentie comme « en bordel » :

1. **Organisation dispersée** : stats à gauche, XP en haut, soins au centre (HealPanel), buffs +
   modificateurs + inventaire empilés à droite — pas de logique de lecture évidente, et la vitalité
   (PV/mana/bouclier, l'info la plus consultée) est coincée en haut d'une colonne.
2. **Vestige mockup** : un sélecteur de 3 styles visuels (« Tablettes / Hextech / Codex radial »,
   prop `variant`) + l'annotation « Direction visuelle : basculez pour comparer ». Visible des joueurs,
   maintient 3 variantes de rendu en parallèle.
3. **Deux systèmes de consommables incohérents** :
   - Page Équipement (`pages-equip.jsx`) : le vrai système. « Utiliser » lit la potion de l'inventaire,
     décrémente la quantité, supprime à 0 (`parseConsumableEffect` + `consumeItem`).
   - Fiche (`HealPanel`) : boutons « 🧪 Potion soin / 🔵 Potion mana » **codés en dur, infinis, qui ne
     consomment rien** (`potHp = 15 + 15% PV`, `potMana = 10 + 10% mana`). Cliquables même sans potion.
4. **Faille de triche** : la section « Montant » du HealPanel (Soigner / Bouclier / Mana / − Dégâts d'un
   montant arbitraire + ↺ PV/Mana max) est exposée aux joueurs → ils s'ajustent librement les ressources.
5. **Valeurs périmées** : le « 50 » de la potion de mana venait de l'ancien moteur. Avec le moteur
   refondu, Rathäel a 287 mana max → potion mana = `round(10 + 28,7)` = **39** ; potion soin = `round(15 +
   15% × 438)` = **81**. (Confirmé via `computeStats(4,3,4,1,2)`.)

## Décisions validées (brainstorming)

- **Style unique** : on abandonne l'expérimentation 3-styles, on commit à une seule direction propre.
  Retrait du toggle `variant` et de l'annotation.
- **Layout B — 3 colonnes thématiques** (réorganisation, on garde 3 colonnes mais regroupées).
- **Consommables unifiés** sur le vrai système (inventaire-bound), avec gating quantité.
- **Outils libres réservés au MJ** (`isStaff`), invisibles pour les joueurs.
- **Fatigue / Eau** : inchangés, gardés pour tous.
- **Inventaire** : réutiliser `InventoryGrid` (même visuel que commun/Équipement), adaptatif.

## Architecture cible

### En-tête (`SheetPage`)
- Conserve : portrait, nom, titre, classe/niveau/joueur, sélecteur de perso (staff only via `lockedCharId`).
- **Retire** : les 3 boutons de style (`variants`) et l'annotation « Direction visuelle ».
- La barre XP (`XpBar`) reste en haut, pleine largeur (intégrée à l'en-tête).

### Corps (`SheetBody`) — layout B, 3 colonnes thématiques

| Colonne 1 — Vitalité & ressources | Colonne 2 — Combat & stats | Colonne 3 — Inventaire |
|---|---|---|
| PV / Mana / Bouclier (jauges, `ResourceStack`) | Statistiques (breakdown, voir ↓) | `InventoryGrid` adaptative + bourse |
| Survie : Fatigue / Eau (`NumberStepper`, inchangé) | Arme équipée (info, lecture seule) | *(staff)* Modificateurs |
| Consommables réels (voir ↓) | Effets / Buffs actifs (`BuffBadge`) | |

Le `variant` est supprimé de tous les sous-composants (`ResourceStack`, `SecondaryStats`,
`CombatColumn`, `BuffInvColumn`) ; on **fige le rendu sur la direction `'a'`** (celle par défaut
aujourd'hui) comme base, puis on nettoie le code mort des branches `'b'` et `'c'`. Les ajustements de
style propres à la refonte se font à partir de cette base.

### ① Stats — breakdown par source (`SecondaryStats`)

Aujourd'hui `SecondaryStats` affiche seulement `eff` (le total). On enrichit pour montrer, par stat, la
**valeur effective** + le détail des sources : `base`, `+mod` (modificateurs), `+stuff/runes` (items +
runes + passif).

Les buffs **multiplient** (`computeEffective` les applique au-dessus du socle), donc une addition pure
serait fausse. Méthode retenue : **deltas honnêtes par source**, calculés en recomposant `eff` avec/sans
chaque source :
- `base` = `charBaseStats(char, state)`.
- `delta_mod` = `eff(avec modifiers) − eff(sans modifiers)`.
- `delta_stuff` = `eff(avec itemMods+runeMods+passif) − eff(sans)`.
- Affichage : `AD 116 · base 96 · +10 mod · +10 stuff` (les deltas à 0 sont masqués).

On factorise un helper pur (testable) `statBreakdown(char, state, turn)` dans `game-logic.js` qui renvoie,
par stat, `{ effective, base, mod, stuff }`. La fiche et (plus tard) la vue MJ peuvent le réutiliser.

### ② Consommables réels (`HealPanel` refondu)

- Source = `state.inventory`, filtrée sur `cat === 'Consommables'` **avec `qty > 0`** et un effet
  parsable (`parseConsumableEffect`). `parseConsumableEffect` est **exposé en logique partagée** (déplacé
  de `pages-equip.jsx` vers `game-logic.js`, ou exporté) pour être réutilisé par la fiche.
- Un bouton par potion possédée, affichant la **valeur réelle** (ex. « 🧪 Potion soin · +81 »). Le clic
  consomme une unité (même orchestration que `consumeItem` de l'Équipement : applique l'effet via
  `applyHealMods` pour les PV / brut pour le mana, décrémente la qty, supprime l'item à 0).
- **Plus de potion → le bouton disparaît** (liste vide → message discret « aucun consommable »).
- Les formules codées en dur (`usePotionHp`/`usePotionMana`) sont **supprimées**.

### ③ Outils libres → MJ only

La section « Montant » (input + Soigner / Bouclier / Mana / − Dégâts) et la ligne ↺ PV/Mana max/Bouclier 0
sont **rendues uniquement si `isStaff(role)`**. Invisibles pour les joueurs. Fatigue/Eau restent pour tous.

### ④ Inventaire (`InventoryGrid` sur la fiche)

Remplace le rendu actuel (`InventoryPanel`/`InvItemRow` en liste) par `InventoryGrid` — même visuel
dark-fantasy que l'Inventaire commun / l'Équipement.
- Branché sur `state.inventory` + `state.coins`, filtre local, clic item → `ItemActionMenu`
  (joueur : Utiliser le consommable / transférer ; staff : éditer / supprimer / etc.).
- **Adaptatif** : `InventoryGrid` calcule déjà `N = max(49, ceil(len/7)*7)`. On ajoute une prop
  **`minCells`** (défaut 49 pour commun/Équipement, plus petit — ~14/21 — pour la fiche) afin d'avoir
  « quelques cases vides » sur la fiche. La grille **grandit avec le contenu** au lieu de scroller :
  on ajoute une prop **`grow`** (ou on neutralise `height:100%`/scroll interne en contexte fiche) pour
  laisser la page défiler.

### ⑤ Animations légères (saupoudrage)

Sur cette fiche uniquement (la passe complète reste le chantier D séparé) :
- Remplissage animé des jauges PV/mana (transition de largeur CSS).
- Flash bref sur dégât/soin reçu (classe CSS + keyframe, à la manière des `mj-card-warn`).
Pas de refonte du système de toasts ici.

## Modèle de données

**Aucun changement de schéma Firebase. Aucune nouvelle règle RTDB.** On lit/écrit les mêmes chemins
(`hpCur`, `manaCur`, `shield`, `fatigue`, `eau`, `inventory`, `coins`, `modifiers`). La consommation de
potion réutilise `setInvItem`/`removeInvItem` déjà en place.

## Découpage en unités

- `game-logic.js` : `statBreakdown(char, state, turn)` (pur, testé) + `parseConsumableEffect` exposé.
- `components.jsx` : `InventoryGrid` props `minCells` + `grow` ; `SecondaryStats` rendu breakdown.
- `pages-sheet.jsx` : `SheetBody`/`SheetPage` (layout B, retrait `variant`), `HealPanel` (consommables
  réels + gate staff), `BuffInvColumn` → `InventoryGrid`.
- `runeterra.css` : keyframes d'animation jauges/flash.

## Tests

- `statBreakdown` : base seule ; base + mod ; base + stuff ; combinaison ; deltas à 0 masqués
  (cohérence avec `computeEffective`).
- `parseConsumableEffect` : déjà couvert indirectement — ajouter un test direct si déplacé.
- Vérif syntaxe `npx esbuild` sur les `.jsx` modifiés ; `node --test` (suite existante verte).
- Vérif visuelle en prod (Ctrl+Shift+R) après déploiement.

## Hors périmètre (YAGNI)

- Pas de refonte du hub d'accueil (chantier C), de l'arbre de runes (B), ni passe d'animations globale (D).
- Pas de changement du moteur de stats ni des règles de combat.
- Pas de nouveau système d'attaque de base (chantier séparé, en attente).

## Risques

- Retrait du `variant` : bien purger le code mort des 3 variantes sans casser le rendu retenu.
- `InventoryGrid` en mode `grow` : vérifier qu'il s'intègre dans une colonne de grille sans casser le
  drag & drop ni la bourse en pied.
- Deltas de stats : s'assurer que la recomposition `eff` avec/sans source reste cohérente avec l'ordre
  d'application de `computeEffective` (mods et itemMods au même étage, amplifiés par les buffs).
