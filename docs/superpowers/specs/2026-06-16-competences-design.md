# Compétences & maîtrise d'armes — analyse Excel + design (EN STAND-BY)

> **Statut : en pause (2026-06-16).** En attente que le MJ (JB) fournisse les
> kits complets (passif + actif) des 5 persos. C'est le plus gros chantier du
> backlog. Reprendre par le pilote **Rathäel** une fois les kits réunis.

## Analyse de l'Excel (`Système de jeu JDR Runeterra.xlsx`)

- **Moteur de stats** (`Statistiques`) = déjà fidèlement codé dans `computeStats`
  (`game-logic.js`). Vérifié, rien à faire.
- **Maîtrise d'armes** = seul système uniforme/propre. Dans chaque `Grille X` :
  arme principale, catégorie (Physique/Magique), type (2H/1H/Poly/Portée),
  niveau de maîtrise (1 ou 2), dégât de base. Formules vues chez Baptiste :
  `N = dégât×1.5`, `O = dégât×1.75` → **niveau de maîtrise = ×1.5 / ×1.75**.
- **Compétences** = bespoke par perso, PAS de formule uniforme dans l'Excel.
  Mélange de dégâts chiffrés (Elias : 4 comps), compteurs (Glaciation, stacks),
  toggles (Âme fendue), descriptions floues (Static), et **notes de MJ** (biomes…).
  → Les vraies règles sont **dans la tête du MJ**, pas dans le fichier.

## Décisions de design validées

- **Rôle de l'outil : hybride** — calcule les dégâts au clic + suit l'état
  (charges, cooldowns, état Âme fendue), affiche les effets narratifs en rappel.
- **Qui met à jour** : chaque **joueur gère ses propres compteurs** sur sa fiche
  (les règles RTDB l'autorisent déjà : un joueur écrit sa fiche). Le **MJ voit**
  (et peut ajuster) les stacks de tous sur la Vue MJ.
- **Phase 2** (plus tard) : outil de **distribution de dégâts par le MJ** dans la
  Vue MJ (taper les dégâts → HP + charges de passif auto). Concevoir le modèle de
  données pour que ça s'y branche, mais hors périmètre du pilote.

## Modèle de données proposé

- **Règles (immuables)** dans `data.jsx` : `skills: [{ id, name, kind:'passif'|'active',
  cost, cooldown, damage:(stats,state)=>n, effects:'texte' }]`.
- **Formules de dégâts** dans `game-logic.js` (module pur, **testées** via `node --test`).
- **État live** (Firebase, sous `/characters/{id}/state`) : `charges` (0-5),
  `cooldowns:{...}`. Âme fendue = dérivée (`charges===5`), non stockée.
- **Stats effectives** : le passif « +5%/charge Armure & Rés.Mag » doit s'intégrer
  à `computeEffective` (seule modif du moteur existant).
- **Tours** : bouton « Fin de tour » (décrémente cooldowns ; +10% PV max si Âme fendue).
  Charges = stepper manuel +/- avec rappels (« max +2/tour », « -2 si aucun dégât »).

## Kit pilote — Rathäel (fourni par le MJ)

- **Passif (Chair gelée / Âme fendue)** : gagne 1 charge de Glaciation quand il subit
  des dégâts (max +2/tour, cumul 5). +5% Armure & Rés.Mag **par charge**. -2 charges
  si aucun dégât subi dans le tour (pas reset total). À 5 charges → **Âme fendue** :
  régén 10% PV max/tour + aura 10% PV manquants (rayon 1 case, alliés compris) ;
  Rathäel est sourd. (positionnement/surdité = narratif, non calculé.)
- **Comp 1 – Frappe Irritée** (10 mana) :
  `(25 + 75%·AD + 50%·(Armure_eff + RésMag_eff)) × (1 + 20%·charges)` (×2 à 5 charges).
  Utilise l'armure **effective** (synergie voulue). En Âme fendue : cible ralentie 1 tour.
- **Comp 2 – Mur de Givre** (50 mana, CD 3) : **0 dégât**, +30 Armure / +30 Rés.Mag,
  inamovible, peut provoquer 1 ennemi adjacent ; si ≥1 charge → +1 charge. En Âme
  fendue : immobilise les adjacents. (effets de contrôle = narratif.)
- **Comp 3 – Éclat de l'Âme** (40 mana, CD 3) : **dégâts PROVISOIRES À FIXER** —
  baser sur Comp 1 « un peu plus fort », proportionnel aux charges dépensées
  (proposition : `base_Comp1 × (0.5 × charges)`), puis charges→0. En Âme fendue :
  expulse l'état (charges→0), onde de choc massive, lève la surdité.
  `/* à valider avec le MJ */`

## Pour reprendre

1. Récupérer les kits (passif + actif) de **Urskaar, Smith, Jett, Elias** (Rathäel ✅).
   - indices Excel : Urskaar « Mouvement Bonus » ; Smith « Flétrissement (marques) » +
     passive « reset pour relancer » ; Jett « Repoussement (Force 62) » ;
     Elias « Stack passif » + Comp.1-4 (237/175/287/150, +11 et +30 sur 1 et 4).
2. Vérifier que le modèle générique encaisse toute la variété, figer la spec.
3. Construire + tester le pilote Rathäel, puis remplir les 4 autres (saisie de données).
