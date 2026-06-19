# Compétences & maîtrise d'armes — analyse Excel + design

> **Statut : VALIDÉ — implémentation lancée (2026-06-19) pour Urskaar / Smith / Jett /
> Elias.** Le MJ (Woolost) a répondu (voir « Réponses du MJ »). **Rathael reste EN PAUSE** :
> le MJ trouve qu'il cumule trop de compteurs (charges Glaciation + tours) et n'a pas tranché
> base vs effective sur le passif → il doit un **fix de design**. On câble Rathael « à venir »
> dans l'UI mais on n'implémente pas ses comps. Source des formules = les scripts `.gs` de
> `info-mj/Codes App Script.md` (le **script prime** sur le texte des kits).

## Analyse de l'Excel / du moteur App Script

- **Moteur de stats** (`Statistiques`) = déjà fidèlement codé dans `computeStats`/`computeEffective`
  (`game-logic.js`). Vérifié, rien à faire.
- **Moteur de combat** (`Codes App Script.md`) confirme ce qui est déjà codé :
  réduction physique/magique = `armure_eff / (armure_eff + 120)`, `dégâtsFinal = ceil(dégâts × (1−réduction))` ;
  léthalité = pénétration d'armure (réduit l'armure prise en compte, min 0) ; bouclier
  absorbe d'abord puis HP, KO à 0. → c'est `mitigateDamage` + `applyDamageToPools`. ✅
- **Buffs/débuffs** (`appliquerEffets`, cases H2:H16) = déjà reproduits dans `BUFF_STAT_MAP`.
- **Attaque de base** (catalogue d'armes + maîtrise −25%) = chantier séparé (« Nouveau
  système d'attaques de base »), pas ce périmètre.
- **Compétences** = bespoke par perso. Les **formules de dégâts** sont dans les scripts
  `.gs` par perso (`Codes App Script.md`). ⚠️ Le **script fait foi**, pas le texte du kit
  (`Compétences-Races PJ`) : divergences possibles (ex. Jett Poison = `25 + 0.5·AP` dans le
  script vs « 100% AP » dans le texte).

## Direction de design validée par l'utilisateur (2026-06-19)

- **Rôle de l'outil : hybride** — calcule les dégâts au clic + suit l'état (charges,
  cooldowns, états type Âme fendue), affiche les effets narratifs en rappel.
- **Placement** : onglet **« Compétences » dédié** (cast joueur, sélecteur de perso pour le
  staff) **+ vue MJ** affichant charges & cooldowns de chacun (ce qui est utilisé / en attente).
- **Bouton « Lancer »** : déduit le mana (alerte si insuffisant) → pose le cooldown →
  **affiche le nombre de dégâts calculé** (le MJ le saisit dans « Subir » de l'ennemi).
  PAS d'auto-application aux ennemis (= Phase 2 éventuelle).
- **Cooldowns = compteur de tour PARTAGÉ** : la « Fin de tour » du MJ fait redescendre les
  CD de tout le monde. Le compteur actuel (`useMJTurn`, localStorage) migre en Firebase.

## Modèle de données proposé

- **Règles (immuables)** dans `data.jsx` : `SKILLS = { charId: { passive:{name, counter:{key,label,max}, note, mods?}, actives:[{id, name, mana, cd, dmgFn, note, onCast}] } }`.
- **Formules de dégâts** (`dmgFn`) dans `game-logic.js` (module pur, **testées** `node --test`),
  transcrites depuis les scripts `.gs`. Référencées depuis `SKILLS`.
- **État live** (Firebase, sous `/characters/{id}/state`) :
  - `counters` : `{ glaciation, chasseur, tranches, cn, marques }` — steppers manuels
    (les déclencheurs sont narratifs, non auto-détectables).
  - `cooldowns` : `{ skillId: readyAtTurn }` — **n° de tour où la comp redevient prête**
    (`readyAt = tourCourant + cd`), prêt si `tourCourant ≥ readyAt`. Du coup « Fin de tour »
    n'écrit qu'une valeur (`turn++`) et tout redevient prêt seul (zéro écriture en masse).
    `1×/tour` → cd 1 ; `CD N` → cd N ; `1×/combat` → bloqué jusqu'à « Nouveau combat ».
- **Tour partagé** : `/campaign/runeterra/combat/turn` (nombre). MJ : Fin de tour / précédent /
  **Nouveau combat** (turn→1, vide cooldowns + remet compteurs à 0).
- **Passifs branchés sur les stats** (5e param de `computeEffective`, comme `itemMods`) :
  `sumPassiveMods(charId, counters, level)` → `{flat:{}, pct:{}}`.
  - **Rathael** : +5% AR/RM **par charge** de Glaciation (bucket %).
  - **Elias** (niv 2) : **+15 AD par charge** de chasseur (bucket plat).
  - Autres passifs (Jett CN, Smith marques, Urskaar tranches) = compteur + rappel (pas de
    bonus net auto) ; les **tranches d'Urskaar alimentent ses formules de comps** (`×(1+0,25·tranches)`).

## UI

- **Onglet Compétences** (joueur + staff) : carte **Passif** (description + stepper de
  compteur + effet de stat en vert) ; cartes **Actives** (nom, coût mana, badge CD
  « prêt »/« tour N », dégâts calculés en live, bouton **Lancer**). Comps sans dégât (Mur de
  Givre, Fondu au noir…) = juste le rappel.
- **Vue MJ** : sous chaque carte joueur, ligne compacte charges + cooldowns actifs ; boutons
  Fin de tour / Nouveau combat (sur le tour partagé).

## Règles RTDB

Nouveau nœud `/campaign/runeterra/combat/turn` : lecture tout participant inscrit, écriture
staff. ⚠️ **Republier `database.rules.json`** (comme pour `sharedCoins`).

## Périmètre & contenu (niv 2)

**Implémenté maintenant :** Urskaar (C1→C4), Smith (C1→C4), Jett (passif + C1/C2), Elias
(C1→C4). **Rathael = EN PAUSE** (passif + comps non implémentés ; carte « à venir » dans
l'UI) tant que le MJ n'a pas livré son fix de design (trop de compteurs ; passif base/effective).
Comps manquantes (Jett C3/C4) = ajout ultérieur, le modèle les encaisse. Ignorer la section
« Lunick » du `.md` (perso mort).

## Kits — détail des passifs (compteurs)

- **Rathael — Chair gelée** : charges Glaciation 0-5 (+5% AR/RM/charge ; Âme fendue à 5 :
  régén 10% PV/tour + aura). Gain sur dégâts subis (max +2/tour), −2 si aucun dégât.
- **Elias — Instinct du Chasseur** : charges 0-5 (niv 2 : +15 AD/charge), 1 par nouvelle
  cible blessée, reset entre combats.
- **Urskaar — Voie de l'ours** : tranches (max 3), +150% prochaine AA après 5 cases de
  déplacement ; alimentent les formules de comps (+25%/tranche).
- **Jett — Nano-hextech** : CN (cellules sur le terrain). AA produit `1 + (AD≥50)+(≥125)+
  (≥225)+(≥375)` CN, ×2 si crit (cf. `calculerEnginsHextech`). Récup CN = +10 mana/CN.
- **Smith — Flétrissement de la rose** : marques sur ennemis (propagation, +dégâts aux marqués).

## Réponses du MJ (Woolost, 2026-06-19)

1. **Nouveau combat** : ✅ reset de **toutes les charges à zéro**.
2. **Le script prime** sur le texte des kits : ✅ confirmé (Jett suit `25+0.5·AP` / `25+0.5·AD`).
3. **Rathael — trop de compteurs** : le MJ trouve qu'il cumule charges Glaciation + tours et
   veut peut-être simplifier → **fix de design à venir**, Rathael reste en pause.
4. **Passif Rathael +5%/charge** : pas tranché ; « pour le moment seulement sur les **stats de
   base** (avant items) », mais le MJ **doit un fix**. (Moot tant que Rathael est en pause.)
5. **Comp 1 Frappe Irritée** : scaling `×(1 + 0,2·charges)` confirmé (Rathael, donc plus tard).
6. **Comp 2 Mur de Givre** : remarque pertinente mais = question d'équilibrage, à régler après
   (Rathael, donc plus tard).

## Pour reprendre (une fois le MJ a répondu)

1. Transcrire les `dmgFn` depuis les scripts `.gs` de `Codes App Script.md` → `game-logic.js`
   (pures, testées), + `sumPassiveMods` + helper de readiness de cooldown.
2. `SKILLS` dans `data.jsx` (les 5 kits dispo).
3. État live (counters/cooldowns) + tour partagé (`combat/turn`) + règle RTDB.
4. Onglet Compétences + intégration vue MJ.
5. Brancher les passifs calculables sur `computeEffective` (5e param).
