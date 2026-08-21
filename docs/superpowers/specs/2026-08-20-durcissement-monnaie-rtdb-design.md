# Monnaie — durcissement des règles RTDB + traçabilité

> **Statut au 2026-08-21 : PUBLIÉ ET VALIDÉ.** Règles publiées, code déployé (`89fbdfa` puis
> `9d59236`), campagne de tests du §9 déroulée — résultats en **§9.7**. Il reste 3 tests
> secondaires (7, 8, 13) et **deux bugs ANTÉRIEURS ont été trouvés au passage**, tous deux
> corrigés : voir §10.
> Document de reprise écrit le 2026-08-20 en fin de session. Le §4 (journal) est livré — voir §4.4
> pour ce qui a réellement été fait et en quoi ça diffère de ce qui était envisagé ici. Le §3
> (durcissement de `characters/$charId/state/coins`) est **intact et toujours d'actualité**.
>
> ⚠️ **Une publication de règles en console est désormais DUE** de toute façon (nouveau nœud
> `economyLog`, §4.4). L'argument qui justifiait de repousser A — « ça coûte une manip manuelle » —
> est donc tombé : faire A dans la même publication.
>
> **À lire avant de coder.** Ce document contient le contexte, deux chantiers indépendants,
> le patch de règles prêt à coller, et surtout **trois pièges** qui coûteraient une soirée
> à redécouvrir (§6).

---

## 1. D'où ça vient

Session du 2026-08-20. Le MJ demandait de pouvoir modifier librement l'argent des joueurs et
du coffre commun. En auditant les chemins d'écriture des pièces avant d'implémenter, **trois
constats** sont sortis. Les deux premiers ont été livrés le jour même (commit `c99879b`), le
troisième — celui-ci — a été laissé de côté faute de temps et parce qu'il touche à la console
Firebase :

1. ✅ **Livré** — impossible de *retirer* des pièces (`grantCoins` est additif et ignore les
   négatifs, `moveCoins` n'est qu'un transfert borné). → `writeCoins`/`setCharCoins`/
   `setSharedCoins` + composant `CoinEditor`.
2. ✅ **Livré** — libellés de monnaies désalignés du guide d'économie. → Cuivre/Argent/Or/Platine
   + change de monnaie MJ (`planCoinConvert`).
3. 🔶 **Ce document** — les règles RTDB laissent un joueur écrire n'importe quoi sur sa propre
   bourse (⬜ §3, toujours à faire), et **aucun mouvement de pièces n'était journalisé nulle part**
   (✅ §4, livré le 2026-08-21).

Le point 3 se décompose en deux chantiers **indépendants** : §3 (règles) et §4 (journal). Ils
peuvent être faits dans n'importe quel ordre, mais voir §5 pour la recommandation.

---

## 2. Le problème, précisément

### 2.1 Les règles ne valident rien sous un personnage

`database.rules.json`, nœud `campaign/runeterra/characters` (lignes 66-71) :

```json
"characters": {
  "$charId": {
    ".read":  "auth != null && root.child('users').child(auth.uid).child('charId').val() === $charId",
    ".write": "auth != null && (… role === 'mj' || role === 'admin' || users/$uid/charId === $charId)"
  }
}
```

Il y a un `.write`, mais **aucun `.validate` dans tout le sous-arbre**. Conséquence : un joueur
propriétaire de sa fiche peut y écrire n'importe quelle valeur, de n'importe quel type —
`coins: { or: 999999 }`, une valeur négative, une chaîne, une clé inventée.

Le `Math.max(0, value | 0)` de l'app (`data-state.jsx:290`, `writeCoins`) **n'est pas une
protection** : c'est du JavaScript dans le navigateur du joueur. Une console devtools ou un
appel REST avec son propre jeton d'auth le contourne en dix secondes. Les règles sont la seule
barrière réelle.

À comparer avec `sharedCoins` (lignes 25-31), qui **est** validé :

```json
"sharedCoins": {
  ".read":  "auth != null && root.child('users').child(auth.uid).child('role').exists()",
  ".write": "auth != null && root.child('users').child(auth.uid).child('role').exists()",
  "$coin":  { ".validate": "newData.isNumber() && newData.val() >= 0" }
}
```

L'asymétrie n'est pas voulue : elle vient de l'ordre historique d'écriture des règles.

### 2.2 Aucune trace des mouvements d'argent

Vérifié en listant tous les appels : `pushLog` n'est **jamais** appelé sur un chemin de pièces.
Le journal partagé (`combat/log`) ne reçoit que du combat et des changements de niveau.

Concrètement : **un joueur peut vider le coffre commun sans laisser la moindre trace**, et le
MJ ne dispose d'aucun historique pour reconstituer ce qui s'est passé. C'est, dans une campagne
entre gens qui se connaissent, le risque réellement gênant — bien plus que la triche délibérée.

---

## 3. Chantier A — durcir les règles

### 3.1 Niveau 1 — valider le type et le signe (recommandé)

Aligne `characters/$charId/state/coins` sur ce que `sharedCoins` fait déjà. **Aucun changement
d'application**, uniquement le fichier de règles. Patch à appliquer dans `database.rules.json`,
en remplacement du bloc `characters` cité en §2.1 :

```json
"characters": {
  "$charId": {
    ".read":  "auth != null && root.child('users').child(auth.uid).child('charId').val() === $charId",
    ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'mj' || root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('charId').val() === $charId)",
    "state": {
      "coins": {
        "$coin": {
          ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() % 1 === 0"
        }
      }
    }
  }
}
```

⚠️ **Recopier le `.write` à l'identique** (il est tronqué ici pour la lisibilité — prendre la
version exacte du fichier). Une règle `.write` réécrite de mémoire est le meilleur moyen de
verrouiller tout le monde.

Ce que ça bloque : valeurs négatives, décimales, chaînes, booléens. Ce que ça **ne bloque pas** :
un joueur qui s'écrit `or: 999999`, qui est un entier positif parfaitement valide. Voir §3.2.

### 3.2 Niveau 2 — empêcher réellement de se servir (déconseillé en l'état)

Pour interdire l'auto-enrichissement il faudrait réserver l'écriture de `coins` au staff. **Ça
casse un usage légitime** : `moveCoins` (`data-state.jsx:315`) écrit sur la fiche du joueur
quand il prend au coffre commun ou y dépose — c'est le fonctionnement normal, voulu.

Et on ne peut pas s'en sortir par une règle plus fine : un transfert fait **deux écritures sur
des sous-arbres distincts** (`sharedCoins` et `characters/$charId/coins`), non atomiques. Les
règles RTDB n'évaluent qu'une écriture à la fois et ne peuvent donc pas vérifier que le
transfert conserve la somme. Une économie infalsifiable demanderait de router les transferts
par des **Cloud Functions** — un changement d'architecture disproportionné ici (le projet est
volontairement zéro-build, zéro backend).

**Recommandation : rester au niveau 1 et investir dans le chantier B.** Rendre visible coûte
presque rien et couvre le vrai risque ; bloquer coûte cher et casse des usages réels.

### 3.2bis État au 2026-08-21 — le `.validate` est POSÉ dans le fichier

Le patch du §3.1 a été appliqué à `database.rules.json` (bloc `characters`, niveau 1). Le `.write`
**n'a pas été retapé** : il a été conservé octet pour octet (vérifié par `diff` contre `HEAD`),
conformément à l'avertissement du §3.1. Le fichier n'est **pas** publié pour autant — voir §9.

Deux protections ont été ajoutées côté code parce que le `.validate` crée deux façons nouvelles
d'échouer, toutes deux sur des écritures qui portent **tout un sous-arbre d'un coup** :

- **Amorçage** — `buildDefaultState` (`game-logic.js`) normalise désormais les 4 dénominations via
  **`coinInt(v)`** (entier >= 0, même contrat que la règle). Sans ça, un perso mal saisi dans
  `data.jsx` ferait échouer le `seedIfEmpty` **entier**, pas seulement sa bourse.
- **Import de sauvegarde** — c'est le piège du §6. `ExportImportPanel` (`components.jsx`) :
  1. **`sanitizeCampaignCoins(data)`** (game-logic, pur, testé) aligne les pièces de la sauvegarde
     sur le contrat de la règle **avant** d'écrire, et rend le nombre de valeurs corrigées (annoncé
     dans le toast) ;
  2. le `setPath` est passé en **try/catch avec toast d'erreur**. Il n'y en avait aucun : un rejet
     (JSON invalide ou `PERMISSION_DENIED`) échouait **en silence**, sans toast ni message — le MJ
     croyait son import passé. C'est précisément le mode de panne que le durcissement rendait
     probable.

### 3.3 Procédure de publication (le point qui n'est pas automatique)

⚠️ **Ce paragraphe a été corrigé le 2026-08-21.** Il disait, à juste titre le 2026-08-20, que le dépôt
n'avait ni `firebase.json`, ni `.firebaserc`, ni CI, et que **rien ne déployait ce fichier** —
`database.rules.json` n'était qu'une copie de référence versionnée. **`firebase.json` et `.firebaserc`
ont depuis été créés** : il existe maintenant un chemin de déploiement en ligne de commande.
(Vérifié à cette occasion : ces deux fichiers n'avaient **jamais** existé dans l'historique, sur aucune
des trois branches — `git log --all --diff-filter=A` ne rend rien. Le seul fichier « firebase » du dépôt
était `firebase-config.js`, qui est l'init du SDK **côté navigateur** et ne déploie rien : confusion
facile, sens opposés.)

GitHub Pages, lui, ne sert toujours que des fichiers statiques et ne parle jamais à Firebase.

**Voie recommandée — la CLI** (une seule commande, depuis la racine du dépôt) :

```bash
npm i -g firebase-tools          # une fois
firebase login                   # une fois, compte propriétaire du projet
firebase deploy --only database
```

`firebase.json` ne déclare **que** `database` — volontairement **pas** `hosting`, puisque le site vit
sur GitHub Pages. Un `firebase deploy` nu ne peut donc pas publier par mégarde une seconde copie du
site : il ne touche que les règles. L'instance est nommée explicitement
(`runeterra-jdr-default-rtdb`) parce que la base est en **europe-west1** et qu'on ne veut pas dépendre
de la résolution d'un défaut.

**Voie manuelle — la console** (toujours valable, et le seul recours si la CLI n'est pas installée) :
console Firebase → Realtime Database → onglet **Règles** → coller → **Publier**.

⚠️ **La CLI ne montre aucun diff avant d'écrire.** L'étape « comparer ce qui est en ligne avec le
fichier du dépôt » (§9.1) compte donc **plus**, pas moins, qu'avec le copier-coller en console.

Trois propriétés à connaître :

- **Tout-ou-rien** : la publication remplace le document entier. Avant de coller, **comparer ce
  qui est en ligne avec le fichier du dépôt** — s'ils ont divergé (une règle publiée à la main
  et jamais reportée dans le dépôt), la publication l'écraserait silencieusement.
- **Effet immédiat**, pour tous les clients connectés. Pas de cache, pas de jeton `?v=` qui
  amortit — contrairement au code. Une règle fautive verrouille tout le monde dans la seconde.
- **Rollback** : la console garde un historique des règles publiées, on peut y revenir. Malgré
  tout, garder l'ancien JSON dans le presse-papier avant de publier.

Test après publication, dans cet ordre :
1. Un compte **joueur** ouvre sa fiche, prend des pièces au coffre commun → doit fonctionner.
2. Le même dépose des pièces au commun → doit fonctionner.
3. Le **MJ** édite une bourse via `CoinEditor`, y compris un « Tout à 0 » → doit fonctionner.
4. Devtools sur un compte joueur : `set({or:-5})` sur sa propre bourse → doit être **refusé**
   (`PERMISSION_DENIED`). C'est le test qui prouve que le durcissement sert à quelque chose.

---

## 4. Chantier B — journaliser les mouvements de pièces

### 4.1 Les points d'accroche (tous dans `data-state.jsx`)

Après la session du 2026-08-20, **quatre** fonctions écrivent des pièces. Toutes sont des
orchestrateurs déjà isolés — c'est le bon endroit pour brancher le journal, une seule fois
chacun, plutôt que dans les pages appelantes :

| Fonction | Ligne | Rôle | À journaliser |
|---|---|---|---|
| `grantCoins(charId, patch)` | 222 | don additif (clôture de séance) | oui — récompense |
| `writeCoins(path, patch)` | 290 | écriture absolue (édition MJ) | oui — mais voir §4.3 |
| `setCharCoins` / `setSharedCoins` | 299-300 | façades de `writeCoins` | via `writeCoins` |
| `moveCoins(from, to, …)` | 315 | transfert perso ↔ commun | **oui — le plus important** |

`moveCoins` est le cas critique : c'est le seul que **les joueurs** déclenchent, et c'est celui
du coffre commun.

Deux setters `setCoin` (lignes 32 et 280) existent encore et ne sont **branchés à aucune UI**
(code mort depuis l'origine). Soit les supprimer à cette occasion, soit les faire passer par
`writeCoins` — ne pas les laisser comme une voie d'écriture non journalisée.

### 4.2 Le mécanisme existant

`pushLog(text, kind)` — `data-state.jsx:172`. Écrit dans `combat/log`, garde ~30 entrées,
`kind ∈ 'gold' | 'buff' | 'debuff'`. Les règles autorisent déjà **tout inscrit** à y écrire
(`.validate` sur `text` string), donc **réutiliser `combat/log` ne demande aucune nouvelle
règle RTDB, donc aucune republication en console**. C'est l'argument fort pour ce choix.

### 4.3 Trois décisions à prendre avec le MJ avant de coder

1. **Même journal que le combat, ou journal d'économie séparé ?** `combat/log` est vidé par le
   bouton « ⟲ Combat » (`resetCombat`) et plafonné à ~30 entrées — un historique d'argent y
   serait effacé à chaque fin de combat, ce qui ruine l'intérêt. Un nœud `campaign/runeterra/
   economyLog` séparé serait plus juste, **mais c'est un nouveau nœud, donc une nouvelle règle,
   donc une republication en console** (§3.3). Arbitrage à faire : simplicité contre durabilité.
2. **Quoi écrire pour une édition MJ ?** `writeCoins` reçoit des valeurs absolues ; le delta
   n'est intéressant que comparé à l'état d'avant, qu'il ne lit pas (c'est un `updatePath`
   direct, sans `getSnapshot`). Soit on journalise la valeur finale (« bourse de X fixée à … »),
   soit on passe `writeCoins` en async avec un `getSnapshot` préalable pour calculer le delta,
   à l'image de `grantCoins`. La seconde est plus utile et plus coûteuse.
3. **Le change de monnaie doit-il apparaître ?** Il se fait sur le brouillon de `CoinEditor` et
   ne produit qu'une écriture finale via `setCharCoins` — il serait donc journalisé comme une
   simple édition, en perdant l'information « c'était une conversion ». Acceptable ou non.

### 4.4 Ce qui a été livré le 2026-08-21

**Les 3 arbitrages du §4.3, tranchés par le MJ :**

1. **Nœud `economyLog` séparé** (`campaign/runeterra/economyLog`), pas `combat/log`. Le MJ a jugé
   qu'un historique d'argent effacé à chaque « ⟲ Combat » n'avait aucun intérêt. Nouvelle règle RTDB
   assumée. **De plus, section réservée au MJ**, accessible par un bouton dans l'onglet Journal.
2. **Delta, pas valeur finale.** `writeCoins` est passée **async** avec un `getSnapshot` préalable —
   c'était bien la branche « plus utile et plus coûteuse » évoquée ici.
3. **Le change n'est pas distingué** d'une édition ordinaire. Il ressort naturellement comme un delta
   compensé (« −100 cuivre, +1 argent »), ce qui se lit très bien : pas de traitement spécial.

**Une bonne surprise sur l'accès MJ-seul.** `campaign/runeterra` porte déjà un `.read` **staff-only** à
sa racine, et ce sont les sous-nœuds qui l'élargissent aux joueurs (`sharedCoins`, `combat`, …). Un
`economyLog` sans `.read` propre hérite donc du staff-only : le « réservé au MJ » est un contrôle
**serveur**, pas un masquage d'UI, et il n'a rien coûté. Le `.read` staff a quand même été écrit
**explicitement** dans le fichier pour que l'intention reste lisible (il ne change rien — une règle
enfant ne peut qu'élargir, jamais restreindre).

**Le sens unique lecture/écriture et sa conséquence.** Les joueurs ont l'**écriture** sur `economyLog`
sans la lecture — `moveCoins` est une action de joueur et doit pouvoir tracer. Mais du coup **un joueur
ne peut pas élaguer** le journal (il faudrait le lire). L'élagage à 30 entrées se fait donc **à la
lecture, côté staff** (`useEconomyLog` + `staleLogIds`) : le journal se borne quand le MJ l'ouvre. Le
journal de combat, lui, ne s'élague toujours pas en base (il est purgé par « ⟲ Combat », donc inutile).

**Dette du §4.1 ramassée :** les deux `setCoin` morts ont été **supprimés**. Il ne reste plus aucune
voie d'écriture de pièces non journalisée.

**Règle ajoutée à `database.rules.json`** (à publier, cf. §3.3) :

```json
"economyLog": {
  ".read": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'mj' || root.child('users').child(auth.uid).child('role').val() === 'admin')",
  "$logId": {
    ".write": "auth != null && root.child('users').child(auth.uid).child('role').exists()",
    ".validate": "newData.child('text').isString()"
  }
}
```

Test après publication, en plus de la séquence du §3.3 : un compte **joueur** prend des pièces au
coffre → l'entrée doit apparaître **dans le journal du MJ**, et le joueur ne doit pas pouvoir lire
`economyLog` (`PERMISSION_DENIED` en devtools).

---

## 5. Ordre recommandé

**B puis A.** Le journal (B) traite le risque réel — un mouvement d'argent invisible — alors
que le durcissement (A) ne bloque que les valeurs aberrantes, cas rare et sans gravité.

Et surtout, **B dans sa version simple ne demande aucune intervention en console** (§4.2),
donc peut être livré comme n'importe quelle autre fonctionnalité, sans dépendre de la
disponibilité de qui a les accès Firebase. A, lui, est bloqué sur cette étape manuelle.

Si les deux sont faits dans la même session : coder B, puis appliquer A au fichier de règles,
puis **une seule** publication en console.

---

## 6. Pièges connus

- ⚠️ **Un `.validate` s'applique à TOUTES les écritures qui traversent le nœud, y compris celles
  de l'admin.** Or `ExportImportPanel` (`components.jsx:312`) fait un `setPath(CAMPAIGN, …)` :
  il réécrit **tout** le sous-arbre de campagne d'un coup. Une vieille sauvegarde JSON contenant
  une valeur de pièce non entière, négative ou absente **ferait échouer l'import entier** après
  le durcissement. À tester explicitement avec une sauvegarde exportée *avant* le changement.
- ⚠️ **Les clés Firebase des monnaies sont `cuiv`/`arg`/`or`/`plat`** et signifient
  cuivre/argent/or/platine. Ne pas se fier aux anciens libellés (Fer/Bronze/Or/Mythril), qui
  avaient dérivé et ont été corrigés le 2026-08-20. **Aucun renommage de clé n'a eu lieu** — ne
  pas en introduire.
- ⚠️ **Ne jamais éditer un fichier accentué via PowerShell 5.1** (`Get-Content -Raw` +
  `Out-File`) : il relit l'UTF-8 en ANSI et réécrit un BOM + des accents cassés. Utiliser l'outil
  Edit ou `perl -i -pe`. (Rappel de `CLAUDE.md`, valable pour `database.rules.json` comme pour
  le reste.)
- Un `.validate` ne s'applique **pas aux suppressions** (`newData` est null) : effacer une
  dénomination restera possible. C'est le comportement voulu.
- Si le chantier touche du code : **bumper le jeton de cache** dans `index.html` (`window.APPV`
  + les `?v=`), sinon les joueurs gardent l'ancien code. Dernier jeton posé : `20260821-1`.

---

## 7. Vérification

- `node --test test/game-logic.test.js test/auth.test.js` → **158 tests** au 2026-08-21
  (game-logic 147 + auth 11). Les 6 tests de `planCoinConvert` puis les 8 du journal d'économie
  (`coinsAmountText`/`coinsDeltaText`/`coinsDeltaValue`/`staleLogIds`) sont en fin de fichier.
- `npx esbuild fichier.jsx > /dev/null` pour chaque `.jsx` touché (⚠️ **pas** de `--loader=jsx`).
- Un changement de règles ne se teste pas par les tests unitaires : utiliser le simulateur de la
  console Firebase, puis la séquence manuelle de §3.3.

---

## 8. Références

- `database.rules.json` — lignes 25-31 (`sharedCoins`, le modèle à suivre) et 66-71
  (`characters`, la cible du durcissement).
- `data-state.jsx` — `pushLog:172`, `grantCoins:222`, `writeCoins:290`,
  `setCharCoins:299`, `setSharedCoins:300`, `moveCoins:315`.
- `components.jsx` — `CoinEditor` (éditeur de bourse MJ), `INV_COINS` (source unique des 4
  monnaies), `ExportImportPanel:312` (le piège du §6).
- `game-logic.js` — `COIN_VALUE` + `planCoinConvert` (taux officiels, conversion pure testée).
- `info-mj/Économie - guide des joueurs.md` — source de vérité des règles d'économie (privé,
  gitignored).
- `CLAUDE.md` — section « État actuel (2026-08-20) » pour le détail de ce qui a été livré.

---

## 9. Séquence de publication et de tests (à faire — 2026-08-21)

Une **seule** publication couvre A (`.validate` sur `state/coins`) et B (nœud `economyLog`).

### 9.1 Avant de publier

1. **Exporter une sauvegarde** depuis l'app (bouton « ⬇ Exporter »), avec les règles **actuelles**.
   C'est le jeu de test du §9.4 *et* le filet en cas de dégât.
2. **Ouvrir la console** → Realtime Database → onglet **Règles**, et **comparer ce qui est en ligne
   avec `database.rules.json`**. S'ils ont divergé (une règle publiée à la main jamais reportée dans
   le dépôt), la publication l'écraserait silencieusement — reporter d'abord la divergence.
3. **Copier l'ancien JSON** dans un fichier local avant de coller le nouveau (la console garde un
   historique, mais autant ne pas en dépendre).

### 9.2 Publier

Depuis la racine du dépôt : `firebase deploy --only database` (voir §3.3 pour l'installation, et la
voie console en secours).

Effet **immédiat**, pour tous les clients connectés : pas de cache, pas de jeton `?v=` qui amortit.
Une règle fautive verrouille tout le monde dans la seconde. La CLI n'affiche **pas** de diff avant
d'écrire — d'où l'étape de comparaison du §9.1.

### 9.3 Tests de non-régression (chantier A) — rien ne doit casser

| # | Compte | Action | Attendu |
|---|---|---|---|
| 1 | joueur | Prendre des pièces au coffre commun | ✅ passe (c'est `moveCoins`, usage légitime) |
| 2 | joueur | Déposer des pièces au commun | ✅ passe |
| 3 | MJ | Éditer une bourse via `CoinEditor`, dont « Tout à 0 » | ✅ passe |
| 4 | MJ | Change de monnaie dans `CoinEditor` puis Appliquer | ✅ passe |
| 5 | MJ | Clôturer une séance avec récompense en pièces (`grantCoins`) | ✅ passe |

### 9.4 Tests du durcissement (chantier A) — ça doit maintenant échouer

6. Devtools, compte **joueur**, sur sa propre bourse : `set({ or: -5 })` → **`PERMISSION_DENIED`**.
   Même chose avec `2.5` (décimale) et `"5"` (chaîne). **C'est le test qui prouve que A sert à
   quelque chose** — s'il passe, la règle n'est pas active.
7. ⚠️ **Le piège du §6** : réimporter la sauvegarde du §9.1 (« ⬆ Importer »). Attendu : import
   réussi, avec un toast mentionnant d'éventuelles valeurs assainies. Si un toast **rouge** apparaît,
   lire le message : le durcissement rejette autre chose que des pièces, et il faut le comprendre
   avant d'aller plus loin.
8. Vérifier qu'un `seedIfEmpty` passe encore : effacer l'état d'un perso de test en console, recharger
   sa fiche → ré-amorçage sans erreur.

### 9.5 Tests du journal d'économie (chantier B)

9. Compte **MJ** → onglet Journal → bouton **💰 Monnaie** : la section s'affiche.
10. Compte **joueur** : prendre des pièces au coffre → l'entrée apparaît **chez le MJ**
    (« 12 argent : coffre commun → Rathäel »), en temps réel.
11. **MJ** : éditer une bourse → entrée en **delta** (« +2 or, −15 cuivre »), verte si enrichissement,
    rouge si retrait, or si compensé (un change).
12. **MJ** : lancer un combat et cliquer **« ⟲ Combat »** → le journal de combat est vidé,
    **le journal de monnaie ne l'est PAS**. C'est le test qui valide la décision du nœud séparé.
13. Devtools, compte **joueur** : lire `campaign/runeterra/economyLog` → **`PERMISSION_DENIED`**
    (le joueur écrit sans lire). Écrire une entrée doit, elle, passer.
14. Dépasser 30 entrées, puis ouvrir le journal en MJ → l'élagage ramène à 30 (il se fait **à la
    lecture côté staff**, pas à l'écriture : un joueur ne peut pas élaguer puisqu'il ne peut pas lire).

### 9.6 Si quelque chose casse

Republier l'ancien JSON (§9.1 point 3, ou l'historique de la console). L'effet est immédiat lui
aussi. Le code de B reste fonctionnel sans la règle `economyLog` — seules les **écritures** du
journal d'économie seront refusées (silencieusement, elles ne bloquent aucun mouvement d'argent :
`pushEconomyLog` est appelé après les écritures de pièces, jamais avant).

---

## 9.7 Résultats de la campagne (2026-08-21)

Règles publiées en console (economyLog + `.validate` coins), puis une seconde fois après le
correctif de purge (§10.2). Code déployé en deux temps.

| # | Test | Résultat |
|---|---|---|
| 1 | joueur prend au coffre | ✅ **après correction** — a révélé le bug §10.1 |
| 2 | joueur dépose au commun | ✅ |
| 3 | MJ édite une bourse (dont « Tout à 0 ») | ✅ |
| 4 | change de monnaie | ✅ |
| 5 | récompense de clôture de séance | ✅ |
| 6 | écritures invalides refusées (devtools) | ✅ `PERMISSION_DENIED` sur `-5`, `2.5`, `"5"` |
| 7 | réimport d'une sauvegarde | 🔶 **a révélé le bug §10.3** — à rejouer après republication |
| 8 | ré-amorçage d'un perso | ⬜ à faire |
| 9-10 | entrée de journal visible chez le MJ | ✅ |
| 11 | édition MJ journalisée en delta | ✅ |
| 12 | « ⟲ Combat » ne vide PAS le journal de monnaie | ✅ **après correction** — a révélé le bug §10.2 |
| 13 | lecture d'`economyLog` refusée au joueur | ⬜ à faire |
| 14 | élagage au-delà de 30 entrées | ✅ |

⚠️ **Leçon de méthode, la plus importante de cette campagne.** Deux retours ont été « ça marche,
l'interface ne me laisse pas faire » — pour le test 6 (les champs refusent les décimales) et le
test 13 (l'onglet Journal est caché aux joueurs). **Ce n'est pas ce que ces tests vérifient.**
Un joueur en devtools parle directement à la base avec son propre jeton, sans passer par l'UI.
Les deux tests contournent donc l'interface exprès : ce sont les seuls qui prouvent que les
règles mordent. Une restriction d'affichage n'est jamais une serrure — c'est toute la raison
d'être du chantier A.

⚠️ **Piège de copier-coller rencontré** : un snippet devtools écrit avec des accents graves
(gabarit de chaîne) perd ses backticks à la copie depuis un terminal, et `${x}` devient du code
nu → `Unexpected token '{'`. **Écrire les snippets destinés à l'utilisateur en concaténation
de chaînes**, jamais en template literal.

---

## 10. Bugs ANTÉRIEURS révélés par la campagne

Aucun des deux n'était causé par ce chantier. Tous deux corrigés et déployés.

### 10.1 Bourse du joueur ÉCRASÉE au lieu d'être créditée (`89fbdfa`)

Elias a 6 argent, en prend 4 au coffre, se retrouve avec **4**.

`CommonInventoryPage` calculait la bourse de destination via `useAllCharStates()`, qui s'abonne à
`campaign/runeterra/characters` — **nœud refusé à un joueur** (il ne lit que SA fiche).
L'abonnement rejeté laissait `all` à `null`, `charCoins()` retombait sur son repli `{0,0,0,0}`,
et `moveCoins` écrivait `0 + 4`. **Invisible en MJ**, qui lit tout : il fallait un compte de rôle
`joueur` pour le voir.

Correctif : `moveCoins`/`moveItem` ne font plus confiance à l'état passé par l'appelant et
relisent les deux côtés via `getSnapshot` (qui **rejette** si l'accès est refusé — transfert
abandonné plutôt que valeur fausse écrite). Calcul extrait en `planCoinMove`, testé.

👉 **`useAllCharStates()` est un hook DE STAFF** : `null` pour un joueur. `pages-inventory` était
le seul endroit où ce `null` alimentait un **calcul d'écriture**.

### 10.2 Un MJ ne pouvait pas vider un journal (`9d59236`)

Purger = écrire `null` **SUR LE NŒUD**. `combat/log` n'avait de `.write` que sur `$logId` : rien
au niveau du nœud, et le seul ancêtre qui en donne un est `campaign/runeterra`, réservé à
`admin`. « ⟲ Combat » et « Vider » échouaient donc pour le rôle `mj`, **en silence** (aucun
`catch`). Présent depuis la livraison du journal de combat en juin ; `economyLog` avait le même
défaut de naissance.

Correctif : `.write` staff **au niveau du nœud** sur `combat/log` et `economyLog` (les joueurs
gardent `$logId` pour écrire une entrée), plus 4 `catch` + toasts « droits insuffisants ».

👉 **Un `.write` sur un enfant joker (`$id`) n'autorise PAS à écrire sur le nœud parent.** Écrire
une entrée et purger la collection sont deux permissions distinctes. Un
`updatePath(NŒUD, {id: null})` passe par la règle `$id` — c'est pourquoi l'élagage automatique
fonctionnait déjà — alors qu'un `setPath(NŒUD, null)` non.

### 10.3 Un MJ ne pouvait pas importer une sauvegarde (2026-08-21)

Troisième variante de la **même famille de cause** que §10.2, un cran plus haut. L'export
fonctionne (c'est une lecture, `campaign/runeterra/.read` est ouvert au staff) ; l'import fait
`setPath(CAMPAIGN, …)` — une écriture **sur le nœud racine de la campagne**, dont le `.write`
était réservé à **`admin`**. Un compte `mj` prenait `PERMISSION_DENIED`.

L'interface proposait donc au MJ un bouton qu'il ne pouvait pas utiliser — et sans le `catch`
ajouté en §10.2, l'échec aurait été **silencieux**, le MJ croyant sa sauvegarde restaurée.

**Décision du MJ (2026-08-21) : ouvrir l'import au rôle `mj`.** `campaign/runeterra/.write`
passe à `mj || admin`. Raison retenue : une sauvegarde qu'on ne peut pas restaurer n'en est pas
une, et le MJ est l'opérateur réel de l'outil.

Deux points vérifiés avant d'appliquer :

- **Le gain de pouvoir est marginal.** Un MJ pouvait déjà écrire dans *tous* les nœuds situés en
  dessous (`characters`, `sharedInventory`, `sharedCoins`, `catalog`, `combat/*`, `economyLog`).
  Le `.write` parent n'ajoute que l'écriture d'un sous-arbre entier en un appel — donc l'import,
  mais aussi l'effacement de toute la campagne d'un coup. Contrepartie assumée.
- **Les `.validate` continuent de s'appliquer** (une règle parente n'annule pas la validation des
  descendants) : le durcissement des bourses tient, y compris pour un import fait par le MJ.
  C'est précisément ce que `sanitizeCampaignCoins` protège.
- **`/users` n'est pas touché** (branche séparée à la racine) : un MJ ne peut toujours pas se
  promouvoir `admin` ni modifier les attributions.

👉 **Motif récurrent de cette campagne, à garder en tête** : trois bugs sur quatre viennent de la
même confusion — *écrire un enfant* et *écrire le nœud qui le contient* sont deux permissions
distinctes dans les règles RTDB. Chaque fois qu'un code fait `setPath(NŒUD, …)` ou
`setPath(NŒUD, null)`, se demander qui a le `.write` **sur ce nœud**, pas sur ses enfants.
