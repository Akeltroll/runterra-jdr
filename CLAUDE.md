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
- **Auth** : connexion **anonyme** (sans mot de passe). Obligatoire : si le
  provider « Anonyme » n'est pas activé dans la console Firebase, l'app reste
  bloquée sur « Connexion… ».
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
- `firebase-config.js` — init Firebase + auth anonyme + helpers `window.RTDB`
  (`ready`, `subscribePath`, `updatePath`, `setPath`, `getSnapshot`).
- `data.jsx` — règles immuables : formules `computeStats`, `CHARACTERS`, `BUFFS`,
  `WEAPONS`, `ATTACK_MODES`, `LEVELS`, `RUNE`, `JOURNAL`. `mkChar` y attache les
  `modifiers` par défaut.
- `data-state.jsx` — hooks temps réel : `useCharState`, `useAllCharStates`,
  `useIdentity`, `seedIfEmpty`. Constante `CAMPAIGN = 'campaign/runeterra'`.
- `components.jsx` — UI partagée : `Avatar`, `ResourceBar`, `BuffBadge`, toasts
  (`renderToastMsg` = rendu sûr, seul `<b>` autorisé), `IdentityModal`,
  `NumberStepper`, `ExportImportPanel`, `AttackModal`.
- `pages-sheet.jsx` — fiche joueur (3 colonnes, 3 variantes visuelles a/b/c).
  Fatigue/Eau éditables, modificateurs, stats effectives, HealPanel.
- `pages-mj.jsx` — tableau de bord MJ temps réel (`mjLive(c, st)` fusionne règles+état).
- `pages-lobby/journal/progression/ds.jsx` — pages secondaires (mockup, données surtout statiques).
- `runeterra.css` — styles (variables CSS `--gold`, `--hp`, etc.).
- `database.rules.json` — règles RTDB (`auth != null` en lecture/écriture).
- `test/game-logic.test.js` — tests unitaires (`node --test`).
- `test/smoke.mjs` — test de démarrage Playwright (charge l'app réelle, teste le
  temps réel Firebase). **Nécessite l'auth anonyme activée.**
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

## Décisions figées
- Cumul des buffs = **additif**. HP/Mana max non affectés par les buffs.
  Cas spéciaux : Aiguisage = %Crit×2 ; Miraculé/Hémorragie = ±50% soins/bouclier
  reçus ; Flétrissement = marqueur visuel.
- Modificateurs par défaut (col. C Excel) : Rathäel ad+10 ; Urskaar hp+50 ;
  Smith ad+20, crit+10 ; Lunick ad+20 ; Jett aucun.
- Une seule campagne partagée. Édition ouverte entre amis (auth anonyme = garde-fou
  léger, pas une vraie séparation par joueur).
- Sélecteur de 3 styles visuels conservé.

## Comment tester (dev)
```bash
node --test test/game-logic.test.js          # logique pure (8 tests)
python -m http.server 5050 --bind 127.0.0.1  # servir le site (autre terminal)
node test/smoke.mjs                           # smoke test (Playwright + Firebase réel)
```
Vérif syntaxe d'un .jsx : `npx esbuild fichier.jsx >/dev/null`.
SRI des scripts CDN : `curl -s <url> | openssl dgst -sha384 -binary | openssl base64 -A`.

## État actuel (2026-06-14)
- v1 **terminée, commitée et poussée** sur `main`. Smoke test ✅.
- Auth anonyme activée par l'utilisateur ✅.
- **Restant (côté utilisateur)** :
  1. Publier `database.rules.json` dans la console Firebase (Realtime Database → Règles).
  2. Activer GitHub Pages (Settings → Pages → branche `main` / root).
     URL cible : `https://akeltroll.github.io/runterra-jdr/`

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
