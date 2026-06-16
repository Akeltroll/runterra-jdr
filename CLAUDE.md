# CLAUDE.md — Chroniques de Runeterra (outil de campagne JDR)

Mémoire de projet pour les prochaines sessions. Lis-moi en premier.

## Ce que c'est
Outil web pour gérer une campagne de JDR maison (univers Runeterra/LoL), utilisé
en vrai par le MJ (Akeltroll / nobletjeanbaptiste@gmail.com) et 5 joueurs.
Fiches de perso + combat + ressources, **partagées en temps réel**.
Source de vérité des règles : `Système de jeu JDR Runeterra.xlsx`.

## Stack & contraintes
- **Zéro build** : React 18 + Babel standalone via CDN, fichiers `.jsx` chargés
  par `<script type="text/babel">`. Pas de bundler, pas de Node requis pour
  *utiliser* le site (Node sert uniquement aux tests).
- **Temps réel** : Firebase Realtime Database (projet `runeterra-jdr`,
  région europe-west1). SDK **compat** via CDN (objet global `firebase`).
- **Auth** : comptes **identifiant + mot de passe** (Firebase Email/Password). Le
  pseudo est mappé en e-mail factice `pseudo@runeterra.local` (`usernameToEmail`
  dans `auth.js`). 3 rôles dans `/users/{uid}` : `joueur` (sa fiche seule), `mj`
  (toutes les fiches, lecture/écriture), `admin` (+ page Admin d'attribution).
  Mots de passe créés/réinitialisés dans la **console Firebase**.
- **Hébergement** : GitHub Pages, dépôt **public** `github.com/Akeltroll/runterra-jdr`
  (note : « runterra » sans le 2e e, volontairement laissé tel quel).
- Plateforme de dev : Windows, PowerShell + Git Bash.

## Pattern important (zéro-build)
Chaque fichier `.jsx`/`.js` définit ses fonctions/constantes localement PUIS fait
`Object.assign(window, { ... })`. Les autres scripts y accèdent par référence nue
(résolue via `window`). L'ordre de chargement dans `index.html` compte.
Ordre : firebase SDK → `firebase-config.js` → `game-logic.js` → `data.jsx` →
`data-state.jsx` → `components.jsx` → `pages-*.jsx` → shell inline.

## Carte des fichiers
- `index.html` — point d'entrée (scripts + shell `App` : identité, gating auth, routing).
- `game-logic.js` — **logique pure** (UMD : testable en Node + `window`). `clamp`,
  `clampGauge`, `DEFAULT_MODIFIERS`, `BUFF_STAT_MAP`, `computeEffective`,
  `applyHealMods`, `buildDefaultState`.
- `auth.js` — logique d'auth pure (UMD) : `usernameToEmail`, `ROLES`, `isStaff`,
  `isAdmin`, `isPending`, `pagesForRole`, `canSeePage`, `defaultRoute`.
- `firebase-config.js` — init Firebase + auth Email/Password + helpers `window.RTDB`
  (`ready`, `currentUser`, `onAuth`, `signIn`, `signOut`, `subscribePath`,
  `updatePath`, `setPath`, `getSnapshot`).
- `data.jsx` — règles immuables : formules `computeStats`, `CHARACTERS`, `BUFFS`,
  `WEAPONS`, `ATTACK_MODES`, `LEVELS`, `RUNE`, `JOURNAL`. `mkChar` y attache les
  `modifiers` par défaut.
- `data-state.jsx` — hooks temps réel : `useCharState`, `useAllCharStates`,
  `useAuthIdentity` (identité via Firebase + `/users/{uid}`, auto-inscription),
  `useAllUsers`, `setUserAssignment`, `seedIfEmpty(role)` (réservé staff).
  Constante `CAMPAIGN = 'campaign/runeterra'`.
- `components.jsx` — UI partagée : `Avatar`, `ResourceBar`, `BuffBadge`, toasts
  (`renderToastMsg` = rendu sûr, seul `<b>` autorisé), `LoginScreen`,
  `PendingScreen`, `SignOutButton`, `NumberStepper`, `ExportImportPanel`, `AttackModal`.
- `pages-sheet.jsx` — fiche joueur (3 colonnes, 3 variantes visuelles a/b/c).
  Fatigue/Eau éditables, modificateurs, stats effectives, HealPanel.
- `pages-mj.jsx` — tableau de bord MJ temps réel (`mjLive(c, st)` fusionne règles+état).
- `pages-admin.jsx` — page Admin : attribution rôle + perso par compte (`AdminPage`).
- `pages-lobby/journal/progression/ds.jsx` — pages secondaires (mockup, données surtout statiques).
- `runeterra.css` — styles (variables CSS `--gold`, `--hp`, etc.).
- `database.rules.json` — règles RTDB strictes basées sur `/users/{uid}` (rôles) :
  joueur = sa fiche seule, staff = tout.
- `test/auth.test.js` — tests unitaires des helpers d'auth (`node --test`).
- `test/game-logic.test.js` — tests unitaires (`node --test`).
- `test/smoke.mjs` — test de démarrage Playwright (charge l'app réelle, teste le
  temps réel Firebase). **Se connecte via un compte de test** (`SMOKE_USER`/`SMOKE_PASS`,
  défaut `smoke`) ; nécessite règles publiées + compte attribué à un perso.
- `docs/superpowers/specs/` et `docs/superpowers/plans/` — design et plan d'implémentation.

## Modèle de données Firebase
```
/campaign/runeterra/characters/{charId}/state/
    hpCur, manaCur, shield (valeurs ABSOLUES), fatigue (0-5), eau (0-5)
    buffs:     { [buffId]: true }
    modifiers: { hp, mana, ad, ap, armure, resmag, crit, dcrit, sapience }
```
`charId` ∈ {rathael, urskaar, smith, lunick, jett}. Amorçage auto si vide
(`seedIfEmpty`, conversion ratios → absolu via `buildDefaultState`).
```
/users/{uid}/   ← rôles & attribution (écrit par l'admin ; auto-inscription « en attente » à la 1re connexion)
    username, role (joueur|mj|admin), charId (si joueur)
```

**Check-list de déploiement (bascule anonyme → comptes) :**
1. Pousser le code sur `main` (GitHub Pages).
2. Console → Authentication : créer les comptes joueurs (`pseudo@runeterra.local` + mdp).
3. Console → Realtime Database / Données : vérifier `/users/{adminUID}` = `{username, role:"admin"}`.
4. Console → Realtime Database / Règles : publier `database.rules.json` (strictes).
5. Console → Authentication : **désactiver** le provider « Anonyme ».
6. Chaque joueur se connecte une fois → attribuer son perso via la page Admin.

## Décisions figées
- Cumul des buffs = **additif**. HP/Mana max non affectés par les buffs.
  Cas spéciaux : Aiguisage = %Crit×2 ; Miraculé/Hémorragie = ±50% soins/bouclier
  reçus ; Flétrissement = marqueur visuel.
- Modificateurs par défaut (col. C Excel) : Rathäel ad+10 ; Urskaar hp+50 ;
  Smith ad+20, crit+10 ; Lunick ad+20 ; Jett aucun.
- Une seule campagne partagée, mais **vraie séparation par joueur** depuis la v2 :
  cloisonnement appliqué côté serveur par les règles RTDB (joueur = sa fiche seule).
- Sélecteur de 3 styles visuels conservé (masqué pour un joueur, verrouillé sur son perso).

## Comment tester (dev)
```bash
node --test test/game-logic.test.js          # logique pure (8 tests)
node --test test/auth.test.js                 # helpers d'auth (5 tests)
python -m http.server 5050 --bind 127.0.0.1  # servir le site (autre terminal)
SMOKE_USER=smoke SMOKE_PASS=... node test/smoke.mjs   # smoke (règles publiées + compte attribué)
```
Vérif syntaxe d'un .jsx : `npx esbuild fichier.jsx >/dev/null`.
SRI des scripts CDN : `curl -s <url> | openssl dgst -sha384 -binary | openssl base64 -A`.

## État actuel (2026-06-15)
- v1 **terminée, commitée et poussée** sur `main`. Smoke test ✅.
- **v2 (auth comptes + rôles) implémentée** sur la branche `feat/auth-comptes-roles`
  (10 tâches : `auth.js`, email/password, `useAuthIdentity`, écrans login/attente,
  page Admin, verrou perso joueur, shell gaté, règles strictes, smoke, doc).
- **Restant (côté utilisateur)** :
  1. Activer GitHub Pages (Settings → Pages → branche `main` / root).
     URL cible : `https://akeltroll.github.io/runterra-jdr/`
  2. Déployer la v2 via la **check-list de déploiement** ci-dessus (créer comptes,
     publier les règles strictes, désactiver l'anonyme, attribuer les persos).
     ⚠️ Tant que la v2 n'est pas déployée, garder l'anonyme activé + règles ouvertes.

## Backlog v2 (présent dans l'Excel, pas encore intégré)
- **Maîtrise d'armes** : niveau par catégorie → dégâts ×1.5 / ×1.75 (col. K/L/M des grilles).
- **Compétences** : Glaciation, Âme fendue, Static, Comp.1-4 avec dégâts/soin +
  cooldowns/compteurs (cols J/K des grilles, variable selon le perso).
- **Journal de combat partagé** : écrire les attaques live dans Firebase.
- Possible : règles RTDB scopées par perso (custom claims) si besoin de vraie séparation.

## Notes
- L'Excel : 14 feuilles (Statistiques, Runes vide, Journal, Grille Personnage modèle,
  + Stats/Grille par joueur Erwan/Bap/JB/Steph/Fab). Correspondance perso↔joueur :
  Rathäel=JB, Urskaar=Baptiste, Smith=Erwan, Lunick=Fab, Jett=Steph.
- `node_modules/` est gitignore (Playwright, dev uniquement).
```
