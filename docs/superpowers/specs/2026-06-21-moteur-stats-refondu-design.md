# Moteur de stats refondu (fondation) — design

> **Statut : design validé par l'utilisateur (2026-06-21).** Premier sous-projet de la
> **refonte « système hypermétrique »** (`info-mj/SPECIFICATION - Système refondu.md`).
> Source de vérité des règles : ce fichier MJ + ce design pour les choix d'implémentation.

## Problème / objectif

La refonte du MJ remplace le cœur de calcul des statistiques. Les 4 caractéristiques
(`F`=Force, `H`=Habileté, `M`=Mental, `C`=Magie/Cosmique) **existent déjà** dans le modèle ;
ce qui change, ce sont **les formules dérivées**, désormais dépendantes du **niveau** (socle),
avec une **escalade anti-aplatissement**, des **bonus de départ**, le retrait de la Sapience du
socle, et un cap caractéristique porté à 20.

Ce sous-projet livre **uniquement la fondation** : le moteur de calcul recâblé + le modèle de
données pour faire vivre les caractéristiques en Firebase (en vue d'un respec joueur ultérieur).
Il ne livre **pas** l'UI de respec, l'équipement en stats finales, le surcrit, ni la zone PNJ
(sous-projets suivants).

## Décisions (validées)

- **Migration des 5 persos** : on **garde leurs `F/H/M/C` actuels** (12 pts = 11 du niveau 2 + 1
  point bonus de création, règle maison conservée ; tous ≤ 6 donc cap niveau 2 respecté). On
  recalcule seulement les stats dérivées sous le nouveau système. Aucune perte d'identité.
- **Respec joueur unique** : on pose **le modèle de données maintenant** (caracs persistées +
  verrou), **l'UI viendra au sous-projet suivant**.
- **Calcul live** : `computeStats` devient une fonction pure prenant le **niveau** en entrée,
  appelée à la volée (comme `computeEffective`) — fin du `char.stats` figé.
- **Sapience** : retirée du socle (`computeStats`), mais la clé reste supportée par
  `computeEffective`/`item.mods` (un futur item/compétence pourra en accorder).

## Architecture

Aujourd'hui : `computeStats(F,H,M,C)` est calculé une fois au chargement (`mkChar`) et stocké dans
`char.stats`, qui sert de `base` à `computeEffective(base, modifiers, buffs, itemMods)`.

Refonte : les stats de base dépendent du niveau → le calcul devient **live**.

- `computeStats(F, H, M, C, level)` — pure, dans `game-logic.js`. Retourne les 8 stats (sans
  Sapience). Le `char.stats` figé est supprimé.
- Caracs effectives lues : `state.attrs ?? char.attrs`. Niveau effectif : `state.level ?? char.level`
  (déjà en place pour comps/runes).
- Sites d'appel à recâbler (base live → `computeEffective`) : fiche (`pages-sheet.jsx`), vue MJ
  (`mjLive` dans `pages-mj.jsx`), Équipement (`pages-equip.jsx`).
- **Recalcul automatique** quand le MJ change le niveau (stepper existant) ou quand les caracs
  changent (futur respec).

Alternative rejetée : recalculer puis **stocker** la base en Firebase (dénormalisation, risques de
désynchronisation). On garde le calcul dérivé pur et live.

## Formules `computeStats(F, H, M, C, level)`

### Escalade (stats de magnitude uniquement)

`esc(p)` = **facteur cumulé** = somme des multiplicateurs par point, par tranches de 4 :

| Tranche (points) | Mult./point |
|---|---|
| 1 → 4 | 1.00 |
| 5 → 8 | 1.18 |
| 9 → 12 | 1.39 |
| 13 → 16 | 1.64 |
| 17 → 20 | 1.94 |

Valeurs cibles du facteur cumulé (réf. §4.3, contrôle des tests) : `esc(4)=4.00`, `esc(8)=8.72`,
`esc(12)≈14.29`, `esc(13)≈15.93`, `esc(16)≈20.86`, `esc(20)≈28.62`. `esc(0)=0`.
Au-delà de 20 (hook PNJ, **non câblé ici**) : mult. du point (20+k) = `1.94 + 0.5×k`.

### Stats de magnitude (escaladées)

```
PV       = 50 + 30*level + 20*esc(F) + 20*esc(C) + 42*esc(M) + bonusHab_PV
Mana     = 50         + 17*esc(F) + 17*esc(C) + 38*esc(M)
AD       =               20*esc(F) +  8*esc(H) +  3*esc(M) + fondu
AP       =               20*esc(C) +  8*esc(H) +  3*esc(M) + fondu
Armure   = 1*level    +  4*esc(F)              + bonusHab_res
ResMag   = 1*level    +  4*esc(C)              + bonusHab_res
```

### Stats de crit (linéaires, sans escalade)

```
crit (%) = 5   + 10*H + 2*M
dcrit(%) = 150 +  2*F + 2*C + 6*H
```

### Bonus de départ

- **Universel** : +50 PV, +50 Mana (déjà inclus ci-dessus).
- **Habileté** (`nH = min(H, 5)`) : `bonusHab_PV = 20*nH`, `bonusHab_res = 1*nH` (appliqué à
  Armure et à RM). Max +100 PV, +5 Armure, +5 RM.
- **Fondu faible Force+Magie** : `fondu = max(0, 20 - 4*(F + C))`, ajouté à **AD et AP**. (F+C=0 →
  +20/+20 ; s'annule à F+C ≥ 5.)

### Arrondi

Stats de magnitude arrondies à l'entier (`Math.round`) en sortie. Crit/dcrit entiers.

### Contrôle (profils types §9, hors équipement)

| Archétype (répartition niveau 18) | PV attendu |
|---|---|
| Tank (Mental 20 / Force 13) | 2111 |
| Carry (Force 20 / Magie 13) | 1481 |
| Mage (Magie 20 / Mental 13) | 1832 |
| Assassin (Habileté 20 / Force 13) | 1009 |
| Bruiser (Force 20 / Habileté 13) | 1262 |

Vérifié : `PV(Tank) = 50 + 540 + 20*esc(13) + 42*esc(20) = 2111` ✓ ; `PV(Carry) = 50 + 540 +
20*esc(20) + 20*esc(13) = 1481` ✓. Les tests reproduisent les 5 profils (PV + dégât moyen d'attaque
de base) à **±1 %** (tolérance d'arrondi sur les facteurs à 2 décimales) ; tout écart > 1 % est
remonté pour arbitrage MJ.

## Modèle de données (caracs persistées)

```
/campaign/runeterra/characters/{charId}/state/
    attrs:       { force, hab, mental, magie }   ← override de caracs ; ABSENT par défaut (repli char.attrs)
    attrsLocked: true                            ← posé après le respec unique ; le staff peut éditer/déverrouiller
```

- **Zéro nouvelle règle RTDB** : déjà couvert par `characters/$charId` (joueur = sa fiche, staff = tout).
- Helper de lecture : caracs effectives = `state.attrs ?? char.attrs`. Aucun écrit dans ce
  sous-projet (le respec écrira `attrs`/`attrsLocked` au sous-projet suivant).

## Intégration

- `computeEffective` **inchangé** : modificateurs + items + runes + passifs + buffs + skillBuffs
  s'empilent comme aujourd'hui, par-dessus la nouvelle base.
- `LEVELS` (data.jsx) : mettre les caps (`limit`) aux valeurs de la refonte §3 (lvl 1→5, 2→6, …,
  16→20, 17→20, 18→20). Les `gain`/`total` collent déjà.
- `ATTRIBUTES` (data.jsx, page Progression) : libellés des sous-stats mis à jour aux nouveaux
  ratios (ex. Force : +20 AD / +20 PV / +4 Armure / +2 D.Crit par point).
- Fiche : Sapience masquée si valeur effective = 0.

## Découpage / hors périmètre

Ce sous-projet = **moteur + modèle de données + recâblage des 3 sites + tests**. Sous-projets
suivants (specs séparées) :

1. **Respec joueur** (UI) : panneau de répartition des points (budget = `total` du niveau +
   bonus création ; caps par niveau §3), confirmation → écrit `attrs` + pose `attrsLocked`.
2. **Équipement en stats finales** : armes (3 paliers) + 18 armures de base, valeurs §7.
3. **Surcrit par paliers** (combat) : %Crit > 100 % (§6.3).
4. **Zone PNJ/divine** : escalade quadratique > 20 (§8), pour les ennemis.

## Risques

- **Rééquilibrage de fond** : tous les persos changent de stats d'un coup. Vérification visuelle
  fiche/MJ/Équipement requise après implémentation, + validation MJ sur le ressenti.
- **Écarts d'arrondi** vs §9 : tolérance ±1 % ; les facteurs d'escalade à 2 décimales peuvent
  créer de petits écarts, documentés et remontés si > 1 %.
- **Dépendance live** : si un site oubliait d'appeler `computeStats(...,level)`, il afficherait une
  base niveau-1. Tests + revue des 3 sites d'appel.
