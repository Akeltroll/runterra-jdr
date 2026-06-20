# Compétences — correctifs de playtest — design

> **Statut : design validé par l'utilisateur (2026-06-20).** Empilé sur les compétences +
> plateau partagé + buffs sur soi (déjà mergés sur `main`). Quatre correctifs issus d'une
> session de test réelle, regroupés car ils touchent la même couche compétences/stats.
> Branche `feat/competences-playtest`.

## Contexte

Retours de playtest sur l'onglet Compétences et la fiche :
1. L'ultime d'Urskaar (C4) **agrandit la barre de PV mais ne la remplit pas** (les PV
   actuels restent au niveau de base) — incohérent et trompeur. Idem bouclier (C3).
2. Les compétences **ne sont pas verrouillées par niveau** : on peut lancer C4 alors
   qu'on est niveau 2. Attendu : C*i* nécessite le niveau *i* (C3→niv 3, C4→niv 4).
3. Pas de moyen pour le MJ de **faire monter les niveaux** en jeu.
4. L'**omnivamp / vol de vie** des runes de Rathael s'affiche **0 %** sur la fiche, alors
   que la valeur est correcte ailleurs (page Équipement affiche bien 10 %).

## Décisions figées (utilisateur)

- **Fin de buff PV** (« ⟲ Combat ») = **plafonner au max normal** : on ne perd que le
  surplus au-dessus du max de base (130/130 → 100/100 ; 60/130 → 60/100, rien perdu).
- **Reset combat = retour total à la normale** : toutes les stats bonus de compétence sont
  supprimées (`skillBuffs` effacés — déjà le cas), PV plafonnés au max de base, **bouclier
  temporaire vidé** (ramené au cap de base).
- **Contrôle du niveau** = **stepper « Niveau » réservé au staff**, persisté en Firebase,
  débloque les compétences en temps réel (comme le stepper de points de rune).
- **Bug omni/vol** = uniquement la **fiche joueur** (la page Équipement est correcte).

---

## Partie 1 — Les buffs de ressource remplissent la jauge (tous persos)

### Problème
- **PV** : la jauge de la fiche lit `max = eff.hp` (grandit avec le buff) mais `cur = hpCur`
  ne bouge pas → barre agrandie mais « vide ».
- **Bouclier** : la jauge lit `max = char.shieldMax`, **figé** (0 pour Urskaar) → le bouclier
  accordé par C3 ne s'affiche pas comme une jauge pleine.

### Comportement cible
- **PV** : au cast d'une compétence avec `selfBuff.hp` (montant plat snapshoté), on **soigne**
  aussi les PV actuels du même montant, **borné au nouveau max** (qui inclut le buff).
  - `hpCur ← min(hpCur + flatHp, eff.hp + flatHp)`.
  - Ex. Urskaar 100/100 → cast C4 → **130/130** ; à 60/100 → **90/130**.
  - Les autres stats du `selfBuff` (ad, armure) n'ont pas de « courant » → rien à remplir.
- **Bouclier** : la jauge de bouclier de la fiche passe à un **max dynamique** :
  `max = Math.max(char.shieldMax || 0, shield)`. Le bouclier accordé s'affiche plein et se
  vide à mesure qu'il encaisse. (Pas de changement de données : c'est de l'affichage.)

### Reset (« ⟲ Combat »)
`resetCombat` (data-state) ramène chaque perso au plafond de base :
- **PV** : `hpCur ← min(hpCur, baseMaxHp)` où `baseMaxHp` = `computeEffective` **sans
  `skillBuffs`** (mais avec modificateurs + items + runes + passifs ; les buffs `BUFFS`
  n'affectent pas les PV max). Calcul via snapshot de l'état du perso.
- **Bouclier** : `shield ← min(shield, char.shieldMax || 0)` (vide le bouclier temporaire).
- `skillBuffs`, `counters`, `cooldowns` effacés (déjà le cas) ; tour remis à 1 (déjà le cas).

`resetCombat` devient **asynchrone** (lit un snapshot par perso pour calculer le max de base).
La logique pure de plafonnement (`min(cur, max)`) est triviale ; le calcul du max réutilise
les helpers existants (`computeEffective`, `sumItemMods`, `sumRuneMods`, `sumPassiveMods`,
`mergeMods`, `buildRuneIndex`), tous déjà exposés sur `window`.

---

## Partie 2 — Déblocage des compétences par niveau (tous persos)

### Modèle
- **Niveau effectif** = `state.level ?? char.level ?? 1`.
- Chaque perso a Passif + actives ordonnées C1…C4. **Active à l'index *i* (0-based) →
  niveau requis *i + 1*** (C1≥1, C2≥2, C3≥3, C4≥4). Le **passif** est toujours disponible.
- Helper pur **`skillUnlocked(index, level)` → `level >= index + 1`** (testé, `game-logic.js`).

### UI (onglet Compétences)
- Carte active verrouillée = **grisée** (opacité réduite), badge **🔒 Niveau N**, bouton de
  cast **désactivé** (clic sans effet). Le reste de la carte (mana, description) reste lisible.
- `cast()` refuse une compétence verrouillée (garde-fou en plus du bouton désactivé).

### Cohérence du niveau effectif
Le niveau effectif (`state.level ?? char.level`) remplace `char.level` partout où il est lu,
pour que la montée de niveau soit cohérente :
- **Compétences** : gating + passif (Elias scale avec le niveau, `eliasPassiveAD`,
  `eliasMaxStacks`).
- **Fiche / MJ / Équipement** : `sumPassiveMods(char.id, counters, level)`.
- **Runes** : budget `runeBudget(level, runeBonus)`.

### Conséquence immédiate
Tous les persos étant niveau 2, **C3 et C4 sont verrouillés** tant que le MJ ne monte pas
le niveau (Partie 3).

---

## Partie 3 — Stepper de niveau (staff)

- Dans l'**en-tête de l'onglet Compétences** (à côté du compteur de tour / sélecteur de perso
  existant), **visible staff uniquement** : `−  Niveau N  +`.
- Persisté via `setField('level', n)` sur `useCharState` → `characters/$charId/state/level`
  (entier ≥ 1). Modifier le niveau **débloque/verrouille** les compétences en temps réel.
- **Aucune nouvelle règle RTDB** : `characters/$charId` est déjà couvert (écriture staff /
  propriétaire).

---

## Partie 4 — Fix affichage omnivamp / vol de vie (fiche)

### Problème
`SecondaryStats` (`pages-sheet.jsx`) reçoit pourtant `stats={eff}` (stats effectives), mais
**code `'0%'` en dur** pour `omni` et `vol` :
```js
['sapience', stats.sapience, false], ['omni', '0%', true], ['vol', '0%', false],
```
`computeEffective` produit déjà `eff.omni` / `eff.vol` (union des clés des mods, runes
incluses). La page Équipement les affiche correctement (10 %), seule la **fiche** est en dur.

### Correctif
Lire les valeurs effectives, format pourcentage :
```js
['sapience', stats.sapience, false],
['omni', (stats.omni || 0) + '%', true],
['vol',  (stats.vol  || 0) + '%', false],
```
Aucun autre site à modifier (Équipement correct, MJ ne liste pas omni/vol séparément).

---

## Tests (logique pure, `game-logic.js`)

- **`skillUnlocked(index, level)`** : `(0,1)=true`, `(2,2)=false`, `(2,3)=true`, `(3,4)=true`,
  `(3,3)=false`.
- **Plafonnement PV/bouclier** au reset : `min(cur, max)` (couvert par le helper existant
  `clamp`/inline ; assertion sur les cas 130→100, 60→60).

## Hors périmètre

- Niveau live répercuté sur d'autres systèmes que passif/runes (rien d'autre n'en dépend).
- Re-validation des runes sur-dépensées si le MJ **baisse** un niveau (la page Runes affiche
  déjà le budget ; pas de blocage rétroactif demandé).
- Comps manquantes (Rathael C4, Jett C3/C4) et refonte Rathael (toujours en backlog).
