# Firebase : CLI et règles RTDB

Détail de la « Carte des fichiers », déplacé depuis `CLAUDE.md` le 2026-09-11 (limite de taille),
texte inchangé. Les renvois « voir Décisions » / « Infos MJ » visent les sections de `CLAUDE.md` ;
« État actuel AAAA-MM-JJ » vise `docs/journal/AAAA-MM-JJ.md`.

## `firebase.json` + `.firebaserc` — CLI Firebase

- `firebase.json` + `.firebaserc` — **config de la CLI Firebase** (créés le 2026-08-21 ; ils n'avaient
  jamais existé, d'où l'ancienne obligation de publier les règles à la main en console).
  `firebase deploy --only database` depuis la racine publie `database.rules.json` sur l'instance
  `runeterra-jdr-default-rtdb` (europe-west1, nommée explicitement — pas de résolution d'un défaut).
  ⚠️ **`firebase.json` ne déclare QUE `database`, volontairement pas `hosting`** : le site est sur
  GitHub Pages, et sans bloc `hosting` un `firebase deploy` nu ne peut pas publier par mégarde une
  seconde copie du site. Ne pas confondre avec `firebase-config.js`, qui est l'init du SDK **côté
  navigateur** et ne déploie rien. Prérequis, une fois : `npm i -g firebase-tools` + `firebase login`.
  La CLI **n'affiche aucun diff** avant d'écrire : comparer les règles en ligne avec le fichier du
  dépôt reste nécessaire. La voie console (coller → Publier) reste valable en secours.
  ✅ **Comment LIRE les règles en ligne** (trouvé le 2026-08-22 — il n'y a pas de `database:rules:get`) :
  `MSYS_NO_PATHCONV=1 firebase database:get "/.settings/rules" --instance runeterra-jdr-default-rtdb`.
  ⚠️ **Le préfixe `MSYS_NO_PATHCONV=1` est OBLIGATOIRE depuis Git Bash** (vérifié le 2026-09-02) :
  sans lui, MSYS convertit `/.settings/rules` en chemin Windows et la CLI répond
  `Error: Path must begin with /` (exit 1). Ce n'est pas un problème de droits.
  ⚠️ **Le `!` de Claude Code lance en Git Bash, pas en PowerShell** (vérifié le 2026-09-09) :
  le préfixe `MSYS_NO_PATHCONV=1` y est donc **obligatoire** aussi.
  ⚠️ **`database:update` / `database:set` exigent `--force` en non-interactif** : leur prompt de
  confirmation n'a pas de stdin et retombe sur « non » (`Error: Command aborted`).
  ⚠️ **Firebase réordonne les clés alphabétiquement** : comparer une relecture au fichier local
  avec un `JSON.stringify` direct produit de **fausses divergences** (`{hp,armure}` contre
  `{armure,hp}`). Trier les clés en profondeur avant de comparer.
  ⚠️ Le code de sortie a déjà été **255** malgré une sortie correcte (ne pas conclure à un échec) ;
  en CLI 15.28.1 il vaut **0**. Se fier à la sortie, pas au code. C'est ce qui permet de vérifier **avant** (dérive
  console ?) et **après** (le déploiement fait-il ce qu'on croit ?) chaque publication.
  Attention en PowerShell : `Out-File -Encoding utf8` ajoute un **BOM** qui fait diverger le `diff`
  sur la 1re ligne — le retirer avant de comparer (`sed 's/^\xef\xbb\xbf//'`).

## `database.rules.json` — règles RTDB

- `database.rules.json` — règles RTDB strictes basées sur `/users/{uid}` (rôles).
  ✅ **En ligne == dépôt, vérifié par relecture le 2026-09-06** (`firebase database:get`,
  diff vide après normalisation) : aucune publication en attente, aucune dérive console.
  Les mentions « RÈGLES RTDB À REPUBLIER » des entrées d'état antérieures sont **historiques**
  — elles ont toutes été publiées depuis.
  Contenu : joueur = sa fiche seule, staff = tout ; **`campaign/runeterra` a un `.write` `mj`+`admin`**
  (ouvert au MJ le 2026-08-21 pour l'import de sauvegarde — `setPath(CAMPAIGN,…)` écrit sur le nœud
  racine ; les `.validate` des descendants continuent de s'appliquer, et `/users` n'est pas
  concerné : un MJ ne peut toujours pas se promouvoir admin) ; **`combat/log` et `economyLog` ont un `.write` STAFF au
  niveau du NŒUD** (purger = écrire sur le nœud ; le `.write` sur `$logId` ne suffit pas — cf. bug
  du 2026-08-21) ; **`characters/$charId/state/coins/$coin` = `.validate` entier >= 0** ;
  **`characters/$charId/state/masteries/$cat` = `.validate` STAFF** (2026-09-15) : `true` seulement, et une
  valeur nouvelle ou changée exige le rôle `mj`/`admin`. ⚠️ C'est un `.validate` et non un `.write` parce que
  le joueur a déjà `.write` sur toute sa fiche, et qu'un `.write` hérité ne se retire pas plus bas.
  Conséquence assumée : `.validate` ne tourne pas à la suppression, un joueur peut RETIRER une de ses
  maîtrises (il ne nuit qu'à lui). Le reste du sous-arbre perso n'est toujours validé nulle part ;
  **`characters/$charId/state/attrs` et `/level` ont un `.read` ouvert à TOUS les inscrits** (2026-08-21,
  capacité commune du coffre : elle a besoin des caracs des 5 persos ; le reste de la fiche — PV, bourse,
  modificateurs, XP, runes, inventaire — **reste cloisonné**, et aucune écriture n'est élargie) ;
  **`sharedTransport` = R/W tout participant inscrit** (attelage du groupe : ranger la monture n'est pas
  un acte de MJ ; `.validate` = chaîne ou suppression) ; `sharedInventory` = R/W pour tout participant
  inscrit, écriture au niveau `$itemId` ; `sharedCoins` = R/W tout participant inscrit,
  `.validate` par dénomination (nombre ≥ 0) ; `combat/turn` = lecture tout inscrit, **écriture staff**
  (nombre ≥ 1) — tour partagé ; `combat/enemies` = lecture inscrits, **écriture staff** (ennemis
  partagés) ; **`combat/pendingActions` = lecture inscrits, écriture STAFF ou PROPRIÉTAIRE**
  (`attackerId === son charId`, lu dans `newData` à la création et dans `data` à la suppression) —
  un joueur dépose son action, le MJ la résout. ⚠️ Le `.write` est sur **`$actionId`**, ce qui couvre
  la suppression du nœud entier ET celle d'une instance : le geste du MJ porte exactement sur le
  nœud qui donne le droit. ⚠️ Durcissement par rapport à l'ancien `pendingHits`, où **n'importe quel
  inscrit pouvait supprimer l'attaque de n'importe qui** ; `combat/log` = lecture+**écriture tout inscrit**
  (`.validate` `text` string) — journal de combat partagé ; **`economyLog` = lecture STAFF, écriture tout
  inscrit** (`.validate` `text` string) — journal d'économie réservé au MJ. NB : le `.read` staff y est écrit
  **explicitement** bien qu'il soit déjà hérité de `campaign/runeterra` — l'intention « MJ seul » doit rester
  lisible dans le fichier.

## Check-list de déploiement historique (bascule anonyme → comptes, faite en juin)

**Check-list de déploiement (bascule anonyme → comptes) :**
1. Pousser le code sur `main` (GitHub Pages).
2. Console → Authentication : créer les comptes joueurs (`pseudo@runeterra.local` + mdp).
3. Console → Realtime Database / Données : vérifier `/users/{adminUID}` = `{username, role:"admin"}`.
4. Publier les règles : `firebase deploy --only database` (ou console → Realtime Database / Règles).
5. Console → Authentication : **désactiver** le provider « Anonyme ».
6. Chaque joueur se connecte une fois → attribuer son perso via la page Admin.
