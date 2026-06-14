# Chroniques de Runeterra — Outil de campagne temps réel (v1)

Date : 2026-06-14
Statut : design validé, prêt pour plan d'implémentation

## Contexte

Maquette React existante (zéro-build : React + Babel via CDN, fichiers `.jsx`)
reproduisant fidèlement le système de jeu d'un fichier Excel
(`Système de jeu JDR Runeterra.xlsx`). On la transforme en **outil réel,
partagé en temps réel** entre les joueurs et le MJ, pour une utilisation en
campagne, hébergé sur GitHub Pages.

L'Excel est la source de vérité. Le moteur de stats, la table de niveaux, les
16 buffs/débuffs, les armes, les modes de combat et les runes sont déjà fidèles.

## Objectif v1

Outil utilisable en campagne, état partagé en temps réel (quand un joueur change
ses PV, le MJ et les autres le voient). Front statique sur GitHub Pages + données
temps réel sur Firebase Realtime Database.

## Périmètre

### Inclus (v1)
1. **Fatigue / Eau éditables** (+/−, reset), par joueur, échelle 0–5.
2. **État sauvegardé et partagé temps réel** (Firebase) : PV, mana, bouclier,
   fatigue, eau, buffs actifs, modificateurs.
3. **Modificateurs de stats manuels** (col. C de l'Excel) → valeurs max correctes
   par joueur, pré-remplis avec les vraies valeurs de l'Excel.
4. **Buffs/débuffs appliqués au calcul** (pas juste un toggle visuel).
5. **Vue MJ temps réel** : tableau de bord live des 5 persos.
6. **Export / Import JSON** de l'état complet.
7. **Identité légère** (choix du perso / MJ à la 1ʳᵉ visite, sans mot de passe).
8. Conservation du sélecteur de 3 directions visuelles (choix mémorisé).

### Reporté (v2)
- Maîtrise d'armes (niveaux par catégorie → dégâts ×1.5 / ×1.75).
- Compétences (Glaciation, Âme fendue, Static, Comp.1-4 + cooldowns/compteurs).
- Journal de combat partagé (écriture live des attaques).

## Architecture

### Séparation règles ↔ état
- **Règles** (immuables, dans le code) : formules, attributs, définitions de base
  des persos, liste des buffs, armes, modes, runes → restent dans `data.jsx`.
- **État mutable** (par perso, dans Firebase) : se synchronise en temps réel.

### Modèle de données Firebase (Realtime Database)
```
/campaign/runeterra/
  characters/
    {charId}/
      state/
        hpCur        : number   // PV courants (valeur absolue, pas un ratio)
        manaCur      : number
        shield       : number
        fatigue      : number    // 0–5
        eau          : number    // 0–5
        buffs/       : { [buffId]: true }     // buffs/débuffs actifs
        modifiers/   : { hp, mana, ad, ap, armure, resmag, crit, dcrit, sapience }
```
Une seule campagne (`runeterra`). **Amorçage** au premier lancement : si
`/campaign/runeterra` n'existe pas, on écrit les valeurs par défaut des 5 persos
(dérivées des définitions de `data.jsx`), pour que la vue MJ ne soit jamais vide.

Note : on migre du modèle « ratio » actuel (`hpCur` = 0..1 multiplié par le max)
vers des **valeurs absolues** stockées en base. La conversion se fait à l'amorçage
(`hpCur_absolu = round(ratio × max)`).

### Identité & accès
- 1ʳᵉ visite : écran « Qui es-tu ? » → choix d'un perso ou MJ. Stocké en
  localStorage (`runeterra_identity`).
- MJ → vue globale ; joueur → arrive sur sa fiche.
- Édition techniquement ouverte (confiance entre amis). L'UI centre l'utilisateur
  sur son perso mais ne verrouille pas.
- La config web Firebase est publique par nature ; la sécurité repose sur
  l'obscurité du lien + des règles RTDB limitées au chemin `/campaign/runeterra`.

## Calculs

### Modificateurs
`statMax = baseCalculée + modificateur` pour chaque stat (HP, Mana, AD, AP, Armure,
Rés. Mag, %Crit, %D.Crit, Sapience). Modificateur par défaut depuis l'Excel.

Valeurs par défaut (extraites de la colonne C de chaque grille Excel) :
- Rathäel (JB) : AD +10
- Urskaar (Baptiste) : HP +50
- Smith (Erwan) : AD +20, %Crit +10
- Lunick (Fab) : AD +20
- Jett (Steph) : aucun modificateur

### Buffs → stats effectives
`statEffective = round( statMax × (1 + Σ pourcentages des buffs actifs) )`
- **Cumul additif** (Bravoure +50% et Affaibli −50% s'annulent → ×1).
- S'applique à : AD, AP, Armure, Rés. Mag.
- Cas spéciaux :
  - **Aiguisage** : %Crit × 2 (et non +50%).
  - **Miraculé / Hémorragie** : ±50% sur les **soins et boucliers reçus**
    (modifie les montants du panneau Soins, pas une stat affichée).
  - **Flétrissement** : marqueur visuel uniquement, aucun calcul.
- HP/Mana max ne sont pas modifiés par les buffs (cohérent avec la liste Excel).

Table buff→stat (multiplicateurs additifs) :
| buff | effet calculé |
|---|---|
| peaufer | armure +0.5 |
| brise | armure −0.5 |
| esprit | resmag +0.5 |
| chocmag | resmag −0.5 |
| inflex | armure +0.5, resmag +0.5 |
| aneanti | armure −0.5, resmag −0.5 |
| bravoure | ad +0.5 |
| affaibli | ad −0.5 |
| foi | ap +0.5 |
| erosion | ap −0.5 |
| heroisme | ad +0.5, ap +0.5 |
| epuise | ad −0.5, ap −0.5 |
| aiguisage | crit ×2 (cas spécial) |
| miracule | soins/bouclier +0.5 (cas spécial, hors stats) |
| hemorragie | soins/bouclier −0.5 (cas spécial, hors stats) |
| fletri | marqueur, aucun calcul |

## Composants & fichiers

### Nouveaux
- `firebase-config.jsx` : init Firebase (config utilisateur), expose `db` et
  helpers `subscribePath(path, cb)`, `updatePath(path, patch)`, `getSnapshot()`.
- `data-state.jsx` :
  - `useCharState(charId)` → `[state, setField]` ; abonnement temps réel ;
    valeurs par défaut depuis `CHARACTERS` si base vide ; amorçage initial.
  - `useIdentity()` → `[identity, setIdentity]`.
  - `useAllCharStates()` → snapshot live de tous les persos (vue MJ).

### Modifiés
- `data.jsx` : ajout `modifiers` par défaut par perso ; fonctions **pures**
  `computeEffective(baseStats, modifiers, activeBuffs)`, `applyHealMods(amount,
  activeBuffs)`, table `BUFF_STAT_MAP`. Export sur `window`.
- `pages-sheet.jsx` :
  - « Ressources de survie » → Fatigue/Eau éditables (NumberStepper, écriture live).
  - `SecondaryStats`/`ResourceStack` utilisent les stats effectives.
  - `HealPanel` branché Firebase + application Miraculé/Hémorragie.
  - Buffs : toggle écrit l'état actif dans Firebase ; recalcul effectif.
  - Panneau/section d'édition des modificateurs.
- `pages-mj.jsx` : tableau de bord live via `useAllCharStates()`.
- `components.jsx` : `NumberStepper` (−/valeur/+/reset), modale d'identité,
  panneau Export/Import JSON.
- `index.html` : scripts SDK Firebase, portail d'identité, init config.

## Flux temps réel
- L'app s'abonne à `/campaign/runeterra/characters` (contexte partagé).
- Chaque édition appelle `update()` sur le chemin précis → tous les clients
  reçoivent la mise à jour via le listener (UI optimiste via l'écho du listener).
- Hors-ligne : cache intégré du SDK Firebase. localStorage seulement pour
  l'identité et le choix de style visuel.

## Tests
- Fonctions pures (`computeEffective`, `applyHealMods`, modificateurs, clamp 0–5,
  conversion ratio→absolu) couvertes par tests unitaires (harnais Node léger).
- Firebase temps réel + UI : vérification manuelle (deux onglets, observer la
  synchro).

## Décisions figées
1. Cumul des buffs = **additif**.
2. **Une seule campagne** partagée, édition ouverte (confiance entre amis).
3. Maîtrise d'armes & compétences = **v2**.
4. État stocké en **valeurs absolues** dans Firebase (migration depuis ratios).

## Déploiement (hors implémentation code, étapes utilisateur)
1. Créer un projet Firebase + activer Realtime Database (mode test/règles
   limitées au chemin campagne).
2. Coller la config web dans `firebase-config.jsx`.
3. `git init`, push sur GitHub, activer GitHub Pages sur la branche.
