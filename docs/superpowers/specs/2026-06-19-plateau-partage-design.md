# Plateau partagé — ennemis partagés + ciblage joueur + résolution MJ (design)

> **Statut : design en cours (2026-06-19).** Fait suite à l'implémentation des compétences
> (branche `feat/competences`, non encore mergée). Cette feature s'empile dessus (même branche).
> Évolution validée par l'utilisateur : le « cast » passe de *calculateur* à *boucle de combat*
> (le joueur cible un ennemi, le MJ valide/applique). **Les buffs sur soi (SP3) sont hors de cette
> spec** (cycle séparé). Décisions utilisateur : dé = **jugement MJ** (pas de formule), ciblage =
> **côté joueur** (donc ennemis partagés).

## Problème

Aujourd'hui les ennemis vivent **uniquement côté MJ** (`localStorage` `runeterra_mj_enemies`,
invisibles des joueurs). Au cast d'une compétence à dégâts, l'app affiche un nombre que le MJ
**retape** dans « Subir » de l'ennemi. L'utilisateur veut : que le joueur **cible l'ennemi** au
lancement, et que le MJ **ajuste le nombre selon son d20 Roll20** puis applique — sans formule
dé→dégâts (le MJ juge).

## Décisions de design

- **Pas de formule dé→dégâts.** L'app pré-calcule, le MJ corrige le nombre à la main (champ éditable).
- **Ciblage côté joueur** → les ennemis deviennent **partagés (Firebase)**, lecture pour tout inscrit,
  écriture (création/édition/PV) réservée au **staff**.
- **MJ dans la boucle** : le cast d'une comp à dégâts crée une **attaque en attente** (proposition) ;
  le MJ la voit, ajuste, applique (ou rejette). Le joueur ne modifie jamais les PV d'un ennemi
  directement.
- **Réutilisation** : `mitigateDamage` + `applyDamageToPools` (déjà purs/testés) servent à appliquer
  les dégâts à l'ennemi (armure/resmag de l'ennemi). Aucune nouvelle logique pure majeure.
- Les **attaques ennemi→joueur** (`EnemyAttackModal`) ont déjà un champ dégâts éditable = même
  principe « jugement MJ » : **rien à changer** côté dé.

## Modèle de données (Firebase)

```
/campaign/runeterra/combat/enemies/{enemyId} = {
    id, name, hpCur, hpMax, manaCur, manaMax, atk,
    armure: 0, resmag: 0,   ← pour mitigateDamage (défaut 0 = pas de réduction)
    note: ''
}
/campaign/runeterra/combat/pendingHits/{hitId} = {
    id, attackerId, attackerName, skillId, skillName,
    type: 'physique'|'magique'|'brut',   ← déduit de l'arme/compétence (défaut 'physique')
    computedDmg,                          ← dégâts pré-calculés (le MJ peut écraser)
    targetId,                             ← enemyId ciblé
    ts                                    ← horodatage (tri)
}
```

`type` : déduit du type d'arme équipée pour les comps « dégâts d'arme » (Physique→physique,
Magique→magique), sinon défaut `'physique'` (le MJ peut changer à la résolution).

## Règles RTDB (à ajouter sous `campaign/runeterra/combat`)

- `enemies` : `.read` = tout inscrit (`role` existe) ; `.write` = staff (mj/admin).
- `pendingHits` : `.read` = tout inscrit ; `$hitId` `.write` = tout inscrit (création par le joueur ;
  suppression par le staff à la résolution). `.validate` : `computedDmg` number ≥ 0.
  ⚠️ **Republier `database.rules.json`** (même passe que `combat/turn`).

## Hooks (`data-state.jsx`)

- `ENEMIES = combat/enemies`, `PENDING_HITS = combat/pendingHits`.
- `useMJEnemies()` — **migré de localStorage → Firebase** (souscription objet→tableau). API
  inchangée : `{ enemies, addEnemy(name), updateEnemy(id,patch), removeEnemy(id) }` (writers =
  `updatePath`/`setPath`, réservés staff par les règles). `makeEnemy`/`newEnemyId` déplacés ici.
  Ajoute `armure:0, resmag:0, note:''` au défaut.
- `usePendingHits()` — `{ hits, addHit(hit), removeHit(id) }` (souscription + writers).
  `addHit` génère l'id et l'horodatage. `applyHitToEnemy(hit, enemy, finalDmg, type)` (orchestrateur :
  `mitigateDamage`→`applyDamageToPools` sur l'ennemi, écrit `hpCur` ; puis `removeHit`).

## UI

### Onglet Compétences (joueur + staff)
- **Bandeau ennemis** (lecture seule) en haut : liste compacte `nom — PV cur/max` (souscription
  partagée). S'il n'y a pas d'ennemi : masqué.
- Carte d'une **comp à dégâts** : ajout d'un **sélecteur d'ennemi cible** + le bouton **Lancer**
  (en plus de mana−coût/cooldown) crée une **attaque en attente** (`addHit` avec `computedDmg`,
  `type`, `targetId`). Toast « attaque envoyée au MJ ». Les comps utilitaires (sans dégât) ne
  ciblent pas.

### Vue MJ
- **Section « Attaques en attente »** (au-dessus des ennemis) : chaque entrée =
  `Attaquant — Compétence → Cible` + champ **dégâts éditable** (pré-rempli `computedDmg`, le MJ
  ajuste au d20) + sélecteur **type** (phys/mag/brut) + boutons **Appliquer** (`applyHitToEnemy`)
  et **Rejeter** (`removeHit`). File vide → section masquée.
- **Cartes ennemis** : désormais lues depuis Firebase (`useMJEnemies` migré). Édition inline et
  `EnemyAttackModal` inchangés (déjà sur l'API du hook). Ajout des champs **armure/resmag** dans
  l'édition inline (pour la réduction des dégâts entrants).

## Migration

Les ennemis `localStorage` existants ne sont **pas migrés** (entités de combat éphémères). Au
premier chargement post-déploiement, la liste d'ennemis Firebase est vide ; le MJ les (re)crée.

## Hors périmètre (volontaire)

- **Buffs sur soi (SP3)** : stats temporaires de combat appliquées au lanceur, effacées par
  « Nouveau combat ». Spec séparée (le +30% PV max d'Urskaar C4 demande d'autoriser un % sur PV max
  pour les skill-buffs — entorse à traiter là-bas).
- Auto-roll du d20 dans l'app (on s'appuie sur Roll20 + jugement MJ).

## Découpage d'implémentation (aperçu)

1. `useMJEnemies` → Firebase + `combat/enemies` + règle RTDB (la vue MJ marche comme avant, mais
   partagée/persistée).
2. `usePendingHits` + orchestrateur `applyHitToEnemy` + règle `pendingHits`.
3. Compétences : bandeau ennemis lecture seule + sélecteur cible + `addHit` au cast.
4. Vue MJ : section « Attaques en attente » (éditable, appliquer/rejeter) + champs armure/resmag.
5. Doc + republication RTDB.
