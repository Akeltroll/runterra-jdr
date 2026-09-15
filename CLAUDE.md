# CLAUDE.md — Chroniques de Runeterra (outil de campagne JDR)

Mémoire de projet pour les prochaines sessions. Lis-moi en premier.

## Ce que c'est
Outil web pour gérer une campagne de JDR maison (univers Runeterra/LoL), utilisé
en vrai par le MJ et 5 joueurs.

**Qui est qui (corrigé le 2026-08-21 — les notes antérieures attribuaient le rôle de MJ à
Akeltroll)** : le **MJ est Woolost**, compte applicatif de rôle `mj` ; **Akeltroll / JB est
l'`admin`** du projet, et joue Rathäel. Les deux contribuent au code.

⚠️ **Direction assumée par le MJ (2026-08-21) : le rôle `mj` se rapproche naturellement de
l'`admin`**, le MJ se considérant désormais autant développeur du projet que l'admin actuel.
**En cas de doute sur une permission staff, trancher en faveur du MJ plutôt que de réserver à
`admin`.** C'est ce qui a motivé l'ouverture de l'import de sauvegarde au rôle `mj`
(`582edae`, §10.3 du document de reprise monnaie). Corollaire : une fonctionnalité réservée à
`admin` qui bloque le MJ dans son usage quotidien est probablement un défaut, pas une décision.
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
Carte courte. **Le détail (fonctions, props, et surtout les ⚠️ « ne pas faire ») vit dans
`docs/archi/`** — ⚠️ **lire le document du sujet AVANT de modifier un fichier** qu'il couvre :

| Document | Couvre |
|---|---|
| `docs/archi/moteur-stats.md` | `computeStats`, les 4 répartitions (`habSplit`/`mentalSplit`/`forceSplit`/`magieSplit`), calibrage, crit/rés. crit, XP, onglet Progression (respec, planchers, 3 gardes de « Confirmer ») |
| `docs/archi/combat.md` | Actions en attente (`buildCastPlan`, remboursement), modes d'attaque de base, mitigation (`MITIGATION_K` = 100), orchestrateurs de coups, vue MJ, onglet Combat, passif Glaciation, onglet Journal |
| `docs/archi/inventaire-poids-monnaie.md` | Items/piles/catalogue, poids et capacités (perso, coffre, attelage), monnaie et journal d'économie, `components.jsx`, fiche, Admin, coffre commun, Équipement |
| `docs/archi/firebase.md` | CLI Firebase (déployer, relire les règles en ligne, pièges Git Bash) et contenu de `database.rules.json` |
| `docs/archi/divers.md` | Navigation d'`index.html`, auth, runes, récaps, hub, tests, dossiers |

- `index.html` — point d'entrée : scripts, shell `App` (identité, gating auth, routing), `PAGES` (groupes
  `main`/`more`/`footer`). L'onglet `id:'competences'` a pour libellé **« Combat »**. `defaultRoute → 'lobby'`
  pour tous. Porte le **jeton de cache `?v=…`** (voir plus bas).
- `game-logic.js` — **toute la logique pure** (UMD, testée en Node) : moteur de stats, XP, poids, monnaie,
  items/piles, combat (mitigation, crit, actions en attente), runes, initiative, carrousel du hub.
- `auth.js` — helpers d'auth purs (`usernameToEmail`, `ROLES`, `isStaff`, `pagesForRole`, `defaultRoute`…).
- `firebase-config.js` — init du SDK côté navigateur + `window.RTDB` (`subscribePath`, `updatePath`,
  `setPath`, `getSnapshot`…). Ne déploie rien.
- `data.jsx` — règles immuables : `CHARACTERS`, `BUFFS`, `LEVELS`, `CREATION_BONUS`, `ATTRIBUTES`,
  `JOURNAL`, `RUNES`, `SKILLS`, `ITEM_CATALOG`, `PORTRAITS`, `MEMORIAL`.
  ⚠️ **`ITEM_CATALOG` n'est qu'un filet d'amorçage** : depuis que `catalogInit` est vrai, le catalogue en
  jeu est lu dans **Firebase** (`campaign/runeterra/catalog`). Ajouter un objet = écrire en base (page Admin
  ou `firebase database:update`) ; éditer aussi `data.jsx` pour qu'un ré-amorçage parte juste.
- `data-state.jsx` — hooks temps réel et orchestrateurs d'écriture (`useCharState`, `useSharedTurn`,
  `usePendingActions`, `applyHitToEnemy`/`applyHitToCharacter`, `moveItem`/`moveCoins`, `addXp`, journaux…).
  ⚠️ **`useAllCharStates()` est un hook de STAFF** : pour un joueur il vaut toujours `null` (nœud
  `characters` non lisible). Ne jamais en faire dépendre une écriture dans une page visible des joueurs.
  ⚠️ `moveItem`/`moveCoins` **relisent les deux côtés via `getSnapshot`** et ignorent l'état passé.
- `components.jsx` — UI partagée : barres, toasts, `InventoryGrid`, `ItemTooltip`, `CoinEditor`,
  `ItemCatalogPicker`, `ConsumablesRow`, `CombatLog`, `MOD_STATS`/`STAT_FAMILY`…
- Pages : `pages-sheet.jsx` (fiche) · `pages-mj.jsx` (tableau de bord MJ, ennemis, actions en attente,
  initiative) · `pages-competences.jsx` (onglet Combat) · `pages-progression.jsx` (XP, respec, répartitions)
  · `pages-equip.jsx` (paperdoll) · `pages-inventory.jsx` (coffre commun, attelage) · `pages-admin.jsx`
  (rôles, inventaires, catalogue) · `pages-runes.jsx` (arbre de runes) · `pages-journal.jsx` (journaux
  combat + monnaie) · `pages-recap.jsx` + `recaps.js` (récaps de séance) · `pages-lobby.jsx` (hub
  d'accueil) · `pages-ds.jsx` (mockup).
- `runeterra.css` — styles (variables `--gold`, `--hp`, `--skillbuff`, `--stat-*`…).
- `firebase.json` + `.firebaserc` — CLI Firebase, **`database` seulement** (pas de `hosting`, exprès).
  `database.rules.json` — règles RTDB (en ligne == dépôt au 2026-09-06). Commandes et pièges :
  `docs/archi/firebase.md` (⚠️ `MSYS_NO_PATHCONV=1` obligatoire depuis Git Bash, `--force` en non-interactif).
- `test/` — `game-logic.test.js`, `auth.test.js` (`node --test`), `smoke.mjs` (Playwright, compte de test).
- `docs/` — `journal/` (historique des livraisons), `archi/` (détail technique), `backlog.md`,
  `bareme-stats.md` (valeur des stats en équivalent AD), `armes-maitrises.md` (les 41 armes :
  maîtrises et portée chiffrées), `superpowers/{specs,plans}/` (designs et plans).
- `ATH/` — images (`Armes/`, `Armures/`, `Butin/`, `Consommables/`, `Items/`, `Perso/*.webp`). `Items/` = images d'origine de JB, encore utilisées pour les pièces et les reliques.
  ⚠️ **Source des icônes du catalogue** : `~/OneDrive/Bureau/Samy/MJ/Images` (PNG 1254 px, rangés par
  catégorie) — **hors dépôt, rien ne le synchronise**, même statut qu'`info-mj/`. Conversion retenue :
  384 px webp q82 (~28 ko). ⚠️ L'upload de la page Admin, lui, écrase à **128 px** en base64 dans la
  RTDB (`downscaleImageToDataURL`) : c'est la cause des icônes floues. Préférer le fichier.
- `info-mj/` — **source de vérité du MJ**, **gitignoré** (dépôt public) : ne jamais committer. Voir « Infos MJ ».
- `idée/` — assets lourds de travail, gitignoré.

## Modèle de données Firebase
Forme des nœuds. ⚠️ **Le sens de chaque champ (défaut quand il est ABSENT, drapeaux MJ, contrat des
actions en attente) est dans `docs/archi/modele-donnees.md` — le lire avant d'écrire un nouveau champ.**
Les droits de lecture/écriture : `docs/archi/firebase.md`.
```
/campaign/runeterra/characters/{charId}/state/
    hpCur, manaCur, shield (ABSOLUS), fatigue, eau (0-5), xp (dans le niveau), level
    buffs {buffId:true} · modifiers {hp,mana,ad,ap,armure,resmag,crit,dcrit,rescrit,letha,lethaMag,sapience,vol,omni}
    inventory {itemId:{id,cat,name,sub,qty,ic,img,type,mods,weight,carry,carryGroup,armorClass,weaponCat,order}} · equipment {slotKey:itemId}
    coins {plat,or,arg,cuiv} · runes {selected,choices} · runeBonus
    attrs {force,hab,mental,magie} · habSplit {ad,ap,mana} · mentalSplit {hp,mana} · forceSplit {ad,armure} · magieSplit {ap,resmag}
    attrsLocked · attrsOpen · habSplitOpen · mentalSplitOpen · forceSplitOpen · magieSplitOpen   (drapeaux MJ)
    masteries {weaponCat:true} (STAFF) · weaponChoice {mode}
    counters {key:n} · cooldowns {skillId:readyAtTurn} · skillBuffs {skillId:{mods,until}}
    invInit · armureInit · coinsInit (marqueurs de migration) · habAd (legacy)
/campaign/runeterra/sharedInventory/{itemId} · sharedCoins {plat,or,arg,cuiv} · sharedTransport {slotKey:itemId}
/campaign/runeterra/catalog/{itemId} · catalogInit
/campaign/runeterra/combat/turn (= ROUND) · combat/enemies/{id} · combat/pendingActions/{actionId} · combat/log/{id}
/campaign/runeterra/combat/initiative/…   (voir docs/journal/2026-09-02.md)
/campaign/runeterra/economyLog/{id}
/users/{uid} {username, role:joueur|mj|admin, charId}
```
⚠️ **Absent ≠ zéro** : un champ de répartition ou d'`attrs` absent veut dire « jamais confirmé » et retombe
sur un défaut qui reproduit l'ancien coefficient (aucune migration). `hpCur`/`manaCur` sont **absolus** : un
changement de coefficient de PV/Mana demande un « ⟲ Combat » pour recaler tout le monde.
`charId` ∈ {rathael, urskaar, smith, **lunick** (affiché « Elias Crowe »), jett}.

**Cache-busting (IMPORTANT à chaque déploiement de code) :** les scripts/CSS locaux d'`index.html`
portent un jeton `?v=…` (et `window.APPV`). **Bumper ce jeton à chaque push de code** (search-replace
de l'ancienne valeur, ex. `20260622-1` → `20260622-2`), sinon le navigateur/CDN sert l'ancienne version
(zéro-build, pas de hash automatique). Sans ça, les joueurs voient l'ancien code malgré le déploiement.

## Décisions figées
- Cumul des buffs = **additif**. HP/Mana max non affectés par les buffs.
  Cas spéciaux : Aiguisage = %Crit×2 ; Miraculé/Hémorragie = ±50% soins/bouclier
  reçus ; Flétrissement = marqueur visuel.
- Modificateurs par défaut (col. C Excel) : Rathäel ad+10 ; Urskaar hp+50 ;
  Smith ad+20, crit+10 ; Elias (id `lunick`) ad+20 ; Jett aucun.
- Une seule campagne partagée, mais **vraie séparation par joueur** depuis la v2 :
  cloisonnement appliqué côté serveur par les règles RTDB (joueur = sa fiche seule).
- **Sélecteur de 3 styles visuels RETIRÉ** (refonte fiche 2026-06-29) : un seul style abouti, fin de
  l'expérimentation Tablettes/Hextech/Codex. (Le sélecteur de **perso** reste, staff only.)
- **Lunick (mort) → Elias Crowe** : id interne `lunick` conservé (clé Firebase/Admin),
  seul l'affichage change (nom/image/titre). Pas de migration.
- **Niveau 2** pour tous (10 pts de stats = 9 du niveau + 1 point bonus de création, depuis le
  recalibrage du 2026-09-05 ; c'était 12 avant) ;
  page Progression affiche le bonus en gold. **Niveau effectif live** = `state.level` (stepper staff
  onglet Compétences), défaut `char.level` ; pilote déblocage des comps + passif + budget runes.
- **Déblocage des compétences par niveau** : active n° *i* (0-based) → **niveau *i*+1 requis**
  (`skillUnlocked`), passif toujours dispo. Tous niveau 2 → C3/C4 verrouillés tant que le MJ ne monte
  pas le niveau.
- **Buffs de ressource remplissent la jauge** : `selfBuff.hp` **soigne** (PV max + actuels) — depuis le 2026-09-06
  à la **validation du MJ** (`applyStatusToCharacter`, `hpGain`), plus au cast —
  bouclier de comp affiché via jauge à max dynamique. **« ⟲ Combat » = retour total aux caps de base**
  (PV plafonnés au max normal, bouclier vidé, skillBuffs effacés).
- **Système de mode de combat (offensif/équilibré/défensif) RETIRÉ** — et définitivement abandonné
  (`f509f42`) : c'était une **posture** choisie pour le tour, multipliant toute l'attaque et annulant
  le crit.
  ⚠️ **À ne pas confondre avec les `BASIC_MODES` ajoutés le 2026-09-06** (gifle, botter le cul…),
  qui sont des **gestes nommés choisis coup par coup** sur la carte d'attaque de base. Le défaut
  reste `normal` = **dégâts pleins** ; un mode réduit ne roule pas le dé de crit (ruling MJ).
- **Le joueur PROPOSE, le MJ RÉSOUT** (refonte du 2026-09-06) : un cast dépose UNE action de
  N instances (`damage`/`heal`/`status`) dans `combat/pendingActions` et **n'écrit aucun effet**.
  Le joueur n'écrit jamais un EFFET de compétence — ni les PV d'autrui, ni un buff, pas même
  sur lui. Les deux seules écritures qui lui restent sont son **coût** au cast (mana +
  cooldown, sinon la comp serait relançable pendant que le MJ arbitre) et ses **potions**.
  Un PJ peut viser un PJ ; un effet peut soigner ; une comp peut cibler N combattants et mélanger
  dégâts et soins dans le même cast (Jett C2). Le coût appartient à l'ACTION, pas à l'instance.
  ⚠️ Cette décision **remplace** l'ancienne « soins ciblés et AOE hors périmètre » : `sk.heal`
  (Jett C2), affiché mais appliqué nulle part depuis toujours, fonctionne désormais.
  ⚠️ **Reste hors périmètre** : les zones d'effet géométriques (rayon, cône, cases) — le MJ
  désigne les cibles touchées, l'app ne modélise pas de plateau ; et les débuffs sur cible
  (stun, saignement, marque), que le modèle accueille mais qu'aucun kit ne chiffre.
- **Inventaire** : perso (par fiche) + commun (coffre partagé). Items `{id,cat,name,sub,qty,ic,img,type,mods}`,
  images dans `ATH/`. Bonus `mods` branchés sur `computeEffective` (objets équipés, `sumItemMods`). **`type`** = emplacement explicite (saisi à
  l'édition si `cat==='Équipement'`), sinon `equipTypeForItem` infère. **Édition réservée au staff**
  (joueurs : lecture seule + équiper/utiliser/transférer ; gate `isStaff` sur fiche & Équipement).
- **Ajout d'items via catalogue** (`ITEM_CATALOG` + `ItemCatalogPicker`) : tous les « + Ajouter » staff
  (fiche, Équipement, commun) ouvrent le picker → quantité (`AmountStepper`) → ajout.
- **Plafond de pile = 99** (`STACK_MAX`) : une pile ne dépasse jamais 99, le surplus crée une nouvelle
  case (`fillStacks`). Appliqué à l'ajout catalogue **et** aux transferts. Piles déjà > 99 non re-découpées.
- **Monnaie vivante** : `state.coins` par fiche + `sharedCoins` commun ({plat,or,arg,cuiv}, entiers).
  Le MJ ajuste librement. **Transferts** perso ↔ commun pour items (`moveItem`/`planItemTransfer`,
  fusion auto sur name+type+cat) et pièces (`moveCoins`). Destinataire : joueur = sa fiche, MJ = choix.
- **Kéminite** = `Consommable` (catalogue + inventaires par défaut Rathäel/Urskaar ; défaut `type:''`).
- **Rendu perso = image `.webp`** (`ATH/Perso/`), **pas de 3D** (modèle Meshy trop lourd, abandonné).
- **Arbre de runes** : contenu figé (`RUNES`, data.jsx, issu de l'Excel — DA convertie en « AD ou AP »
  à la moyenne). Effets **hybrides** : bonus plats calculés (`sumRuneMods`→`computeEffective`),
  conditionnel/actif en rappels. Points = niveau, ordre strict, respec libre. Source de règles :
  `info-mj/Système de Runes.md`. **À confirmer MJ** : capstone vs thématique −2 CD ; 2 cellules
  tronquées (Inspiration « Altruisme excessif » + 1er capstone).

## Comment tester (dev)
```bash
node --test test/game-logic.test.js          # logique pure (267 tests au 2026-09-15)
node --test test/auth.test.js                 # helpers d'auth (11 tests)
python -m http.server 5050 --bind 127.0.0.1  # servir le site (autre terminal)
SMOKE_USER=smoke SMOKE_PASS=... node test/smoke.mjs   # smoke (règles publiées + compte attribué)
```
Vérif syntaxe d'un .jsx : `npx esbuild fichier.jsx >/dev/null` (⚠️ **pas** de `--loader=jsx` :
ce flag ne vaut que pour stdin, esbuild déduit le loader de l'extension).
SRI des scripts CDN : `curl -s <url> | openssl dgst -sha384 -binary | openssl base64 -A`.

**Banc d'essai d'une PAGE, sans Firebase ni authentification** (technique qui a trouvé le bug de respec
du 2026-09-06, là où la lecture du code avait conclu à tort à un simple défaut d'ergonomie) : écrire une
page jetable à la racine (servie par le `http.server` ci-dessus) qui charge React/Babel, `game-logic.js`,
`data.jsx`, puis **le vrai `data-state.jsx` et la vraie page** par-dessus un **faux `window.RTDB` en
mémoire** — l'API tient en 6 lignes (`subscribePath`/`updatePath`/`setPath`/`getSnapshot`) et doit
reproduire les deux sémantiques de Firebase qui comptent : **écho asynchrone** (`setTimeout`) et
**`null` = suppression**. Piloter avec `npm i playwright-core` + `chromium.launch({channel:'chrome'})`
(utilise le Chrome installé, **aucun navigateur à télécharger**). ⚠️ **Bouchonner `useCharState` ne sert
à rien** — un premier banc qui le faisait ne reproduisait rien ; c'est en branchant la vraie couche
d'état que le blocage est apparu. Penser à supprimer la page, `node_modules` et le `package.json` généré
(`git checkout -- package.json package-lock.json`) après coup.

⚠️ **Ne jamais éditer un fichier accentué via PowerShell 5.1** (`Get-Content -Raw` + `Out-File`) :
il relit l'UTF-8 en ANSI et réécrit un BOM + des accents cassés (`é`→`Ã©`). Utiliser l'outil Edit,
ou `perl -i -pe` pour un search-replace global (ex. le bump du token de cache).

⚠️ **Script Python lancé par heredoc depuis Git Bash — deux pièges qui ont VIDÉ un fichier**
(2026-09-05, `pages-progression.jsx` récupéré par `git checkout`) :
1. **Un `\\` du heredoc arrive à Python comme `\`.** Un `"\\uD83D\\uDD13"` censé
   produire l'échappement JS littéral devient donc `"\uD83D\uDD13"`, soit deux vrais
   **surrogates seuls** → `UnicodeEncodeError: surrogates not allowed` à l'écriture (et un `\u`
   isolé casse carrément le parsing du script). Ne pas écrire d'échappement `\u` dans le script :
   insérer le **vrai caractère** (`chr(0x1F513)`, via un jeton de remplacement pour ne pas le taper
   dans la source). Les `.jsx` du dépôt contiennent déjà des emoji littéraux et `index.html` déclare
   `charset=utf-8` — un caractère brut y est parfaitement valide.
2. **`io.open(p,'w')` TRONQUE le fichier avant d'encoder** : si l'encodage échoue pendant le
   `write()`, il ne reste **rien**. Toujours encoder d'abord (`data = s.encode('utf-8')`) puis ouvrir
   en `'wb'` — l'exception tombe alors **avant** que le fichier ne soit touché.
   ⚠️ **La forme chaînée `io.open(p,'wb').write(s.encode('utf-8'))` DÉFAIT cette garde** (vécu
   le 2026-09-06, `CLAUDE.md` vidé puis récupéré par `git checkout`) : Python évalue l'appelé
   `io.open(p,'wb')` **avant** l'argument, donc le fichier est tronqué **puis** l'encodage lève.
   Les octets doivent être liés à une variable sur une **ligne séparée** avant tout `open`.
Accessoire : `print()` d'un texte accentué échoue aussi (stdout en cp1252) — logger en ASCII.

## Branches (convention depuis 2026-08-16)
Le dépôt est nettoyé : **3 branches seulement**, plus de branches `feat/*` ou `fix/*` résiduelles.
- **`main`** — branche de référence, toujours déployable (c'est elle que sert GitHub Pages).
- **`Woolost`** — branche de travail de Woolost (le **MJ**).
- **`JB`** — branche de travail d'Akeltroll / JB (l'`admin` du projet).

Chacun travaille sur sa branche puis fusionne dans `main`. Après un merge dans `main`, on **ne
supprime pas** `Woolost`/`JB` : on les resynchronise sur `main` (`git merge main`) pour repartir
d'une base propre. Les anciennes branches de fonctionnalité (auth-comptes-roles, inventaire,
arbre-runes-visuel, elias-crowe-niveau-2, retrait-mode-combat, admin-catalogue, catalogue-editable)
ont été **supprimées** une fois entièrement fusionnées — leur historique vit dans `main`.

## État actuel (résumé au 2026-09-11)
Le détail de chaque livraison vit dans **`docs/journal/AAAA-MM-JJ.md`** (une entrée par jour, texte
d'origine, déplacé d'ici le 2026-09-11 pour la limite de taille du CLAUDE.md). ⚠️ **Avant de toucher un
sujet, lire son entrée** : c'est là que sont les ⚠️, les « ne pas faire » et le pourquoi des décisions.
**Nouvelle livraison = nouveau fichier `docs/journal/<date>.md`** + une ligne dans l'index ci-dessous,
jamais une nouvelle section ici.

**Dernier état** : cache `20260915-1`, **278 tests verts** (game-logic 267 + auth 11). Règles RTDB
en ligne == dépôt au 2026-09-15 AVANT la règle `masteries` (voir le journal du jour pour sa publication).
**Armes et maîtrises, livraison 1** (2026-09-15) : l'arme en main pilote l'attaque de base
(`basicAttackProfile`), maîtrises par perso, catalogue d'armes recalé. ⚠️ **`WEAPONS` n'existe plus** :
la catégorie d'une arme est `item.weaponCat`. Les 18 armures de base sont **en base** (Firebase),
dédoublonnées et imagées ; Butin et Consommables aux icônes du MJ, catalogue ET inventaires (2026-09-13).
⚠️ **La mitigation est passée en `AR/(AR+100)`** (`MITIGATION_K`, 2026-09-12) — c'était 120.
⚠️ **Le catalogue en base contient du contenu créé par le MJ à la page Admin** : avant toute
écriture en masse dans `/campaign/runeterra/catalog`, **relire la base et diffuser sur les NOMS** —
les ids générés n'entrent jamais en collision, donc rien ne signale un doublon (vécu le 2026-09-13).

**👉 Reste à faire EN JEU (annonces à la table)** :
- ✅ **quatre répartitions dirigées** — **ANNONCÉ le 2026-09-12** (livré le 2026-09-06) ;
- **18 armures au catalogue** (une légère double presque l'armure d'un PJ niveau 2) → 2026-09-07 ;
- **3 patchs** : +5 AR/RM de socle, omnivamp cumulative, armures légères 7 → 10 → 2026-09-09 ;
- **constante de mitigation 120 → 100** : tout le monde encaisse un peu mieux, **les monstres armurés
  nettement mieux** (un boss à 200 d'armure gagne +12 %) → 2026-09-12.
- **armes et maîtrises (livraison 1)** : +5 par arme, dagues en accessoire sans stats, cellules de Jett
  sans dégâts, dual wield de Smith à 60 % + 40 % → 2026-09-15 (§4 du journal).
⚠️ Ces trois-là sont **en ligne depuis le 2026-09-12** (push de 11 commits, cache `20260912-1`) : les
joueurs les subissent déjà, annoncés ou non.

**À éprouver à une vraie table** : initiative/créneaux (2026-09-02) ; rythme des actions en attente —
un buff n'apparaît qu'après le clic du MJ (2026-09-06) ; encaissement des profils offensifs à bas
niveau (2026-09-06).

**Suivant** : **armes, livraisons 2 et 3** — automatiser les propriétés, qui portent l'essentiel de
l'équilibrage (les `mods` pèsent 9 points quand l'écart entre armes en fait 94, `docs/armes-maitrises.md`).
Plan et décisions : §5 et §7 de `docs/superpowers/specs/2026-09-14-armes-maitrises-design.md`.
✅ Engagement du bâton magique honoré : Canalisation maîtrisée = +50 Mana + 10/niveau.
Puis le **rééquilibrage des compétences** (voir backlog).
**Laissé ouvert exprès, ne pas rouvrir comme un bug** : le profil PV domine le profil résistance en
début de campagne (2026-09-09).

| Entrée | Sujets |
|---|---|
| [2026-09-15](docs/journal/2026-09-15.md) | **Armes et maîtrises, livraison 1** : catégories (`weaponCat`), maîtrises staff (`masteries` + règle `.validate`), profil d'attaque de base (mini-armes, dual wield, −25 %, mode hybride, cellules de Jett), armes en accessoire sans stats, règles d'emplacement ; catalogue +15/+10-10, explosifs en consommables, retrait de `WEAPONS` |
| [2026-09-13](docs/journal/2026-09-13.md) | Dédoublonnage des 18 armures du catalogue (les valeurs du 2026-09-09 l'emportent) ; images du MJ converties en fichiers `ATH/Armures/` ; recalage des copies déjà distribuées ; icônes Butin/Consommables du MJ jusque dans les inventaires, Butin de monstre → Cuir de brackern ; renommages « du capitaine », Coffret de terrain, encyclopédie, pierre à usage unique ; Dague simple (accessoire) pour Jett et Elias |
| [2026-09-12](docs/journal/2026-09-12.md) | **`MITIGATION_K` 120 → 100** ; chiffrage des maîtrises d'armes et de la portée (41 armes) ; nerfs Attaque double / Canalisation / Adaptation ; dual wield de mini-armes |
| [2026-09-09](docs/journal/2026-09-09.md) | Barème de valeur des stats (équivalent AD) ; patchs `BASE_AR_RM`, omnivamp cumulative, armures légères |
| [2026-09-07](docs/journal/2026-09-07.md) | Les 18 armures de base au catalogue ; divergences catalogue ↔ guide d'économie (potions, armes) |
| [2026-09-06](docs/journal/2026-09-06.md) | Spécialisation Force/Magie ; bug « Confirmer » inerte en respec ; **refonte actions en attente** ; modes d'attaque de base + ciblage PJ ; ressources + potions dans l'onglet Combat ; buffs absents du Combat |
| [2026-09-05](docs/journal/2026-09-05.md) | « ↺ Rouvrir la respec » (`attrsOpen`) ; **calibrage des attaques de base** (LEVELS, escalade, crit, répartition du Mental) |
| [2026-09-04](docs/journal/2026-09-04.md) | Répartition des caracs rechiffrée ; résistance critique ; Habileté au choix AD/AP/Mana |
| [2026-09-03](docs/journal/2026-09-03.md) | Arrivée tardive `joinRound` automatique |
| [2026-09-02](docs/journal/2026-09-02.md) | **Gestion des tours** : initiative, créneaux dérivés, KO différé, PNJ alliés, ouverture de `hpCur` |
| [2026-08-21](docs/journal/2026-08-21.md) | Poids (monnaie, canal groupe, coffre + attelage) ; bug purge de journal (MJ) ; bug bourse écrasée ; journal d'économie ; durcissement des bourses |
| [2026-08-20](docs/journal/2026-08-20.md) | Édition libre des bourses (`CoinEditor`) ; monnaies cuivre/argent/or/platine + change |
| [2026-08-17](docs/journal/2026-08-17.md) | Lisibilité et code couleur des stats ; léthalité magique ; bascule principales/secondaires |
| [2026-08-16](docs/journal/2026-08-16.md) | Nettoyage des branches ; refonte graphique de l'arbre de runes ; Sadisme ; infobulles ; poids affiché |
| [2026-06-29](docs/journal/2026-06-29.md) | Refonte fiche joueur ; ultime de Rathael automatisé |
| [2026-06-24](docs/journal/2026-06-24.md) | Retrait d'XP ; fusion des slots d'armure ; système de poids ; badge CD ; admin inventaire/catalogue |
| [2026-06-20](docs/journal/2026-06-20.md) | Compétences + plateau partagé + buffs/journal ; correctifs de playtest ; ennemis v1 |
| [2026-06-18](docs/journal/2026-06-18.md) | Arbre de runes ; récaps de séance ; catalogue + pile 99 ; inventaire/transferts ; paperdoll |

## Chantiers en cours / backlog
Le backlog complet (diagnostics chiffrés, défauts par perso, chantiers en pause) vit dans
**`docs/backlog.md`** — ⚠️ **le lire avant d'ouvrir un chantier**, il contient des analyses déjà faites
qu'il ne faut pas refaire.

- **🔜 Prochain gros chantier : rééquilibrage des compétences** (diagnostic fait, décisions à prendre).
  3 PJ sur 5 n'ont aucune raison de lancer une compétence (ratio comp/attaque de base : Smith ×1,04,
  Jett ×1,00). Diagnostic : §10 de `docs/superpowers/specs/2026-09-05-calibrage-attaques-base-design.md`.
  **❓ Question non tranchée par le MJ** : scaling numérique par niveau **ou** upgrades de compétences au
  choix du joueur — l'un ou l'autre, pas les deux.
- **Contenu du catalogue** : armes (aucune n'a de `mods`), potions (catalogue 2 à 3× sous le guide
  d'économie), palier supérieur des armures (à faire trancher par le MJ) —
  `docs/superpowers/specs/2026-09-07-catalogue-objets-design.md`.
- **En pause / plus tard** : nouveau système d'attaques de base (catégories d'armes + maîtrise) ;
  passe d'animations ; comps Jett C3/C4 (kits pas encore reçus) ; zone PNJ/divine ; validation MJ de
  l'arbre de runes.

## Infos MJ (`info-mj/` — source de vérité des règles détaillées)
⚠️ **Le dossier est gitignoré (dépôt public) : RIEN ne le synchronise entre les postes du MJ et de
l'admin.** Au 2026-09-07, la machine du MJ n'avait que 3 des 8 fichiers listés ici. Deux ont été
retrouvés depuis et replacés : `SPECIFICATION - Système refondu.md` (2026-09-07) et
`Nouveau système de gestion des attaques de base (2).md` (2026-09-09).
**Restent manquants côté MJ** : `Compétences-Races PJ`, `Système de Runes.md`, `Codes App Script.md`,
`tableau_XP.png`. Les rapatrier AVANT tout chantier qui en dépend (le rééquilibrage des compétences
a besoin du premier).
⚠️ **Où chercher un fichier manquant** : `~/Downloads` et `~/OneDrive/Documents/Claude` — les deux
retrouvés y étaient. Et **chercher en `.docx`, pas en `.md`** : cette liste les nomme en `.md`, mais
le MJ les produit sous Word. Convertisseur docx→md (paragraphes, titres, listes, tableaux) écrit le
2026-09-09, à refaire au besoin : `zipfile` + `word/document.xml` en ElementTree, ~80 lignes de
Python. Prendre la version la plus RÉCENTE par date de modification, pas par numéro de suffixe.
⚠️ **`~/Downloads/Cat_gories_d_Armes_Runeterra.csv` est OBSOLÈTE** (avril 2025) : il décrit les armes
par **modes offensif/équilibré/défensif**, c'est-à-dire le système de posture **retiré et
définitivement abandonné** (`f509f42`). Ne pas s'en servir — le document `.docx` ci-dessus le remplace.
- `info-mj/SPECIFICATION - Système refondu.md` — système hypermétrique. **§7.1 armes** (+15/+30/+70 AD ou AP
  par palier) et **§7.2 armures** (3 classes × 6 profils = 18 armures de base, valeurs + noms + malus de
  classe) : c'est la source des stats d'équipement, introuvable ailleurs. ⚠️ Ses §3/§4/§6 et ses cibles de
  PV du §9 sont **PÉRIMÉS** (refontes des 2026-09-04 et 2026-09-05) ; seul le §7 fait encore foi.
- `info-mj/Compétences-Races PJ (mis à jour).md` — kits complets (passif + comps) + races/
  traits par niveau. ⚠️ La section « Lunick » = ancien perso mort (ignorer) ; voir « Elias ».
- `info-mj/Système de Runes.md` — règles de l'arbre de runes (points = niveau, Mineure→
  Avancée→Fondamentale, thématiques de famille = −2 CD).
- `info-mj/Nouveau système de gestion des attaques de base (2).md` — **41 catégories d'armes**
  (type/tenue/portée/propriétés) + **~35 propriétés** décrites + règle de maîtrise (sans maîtrise :
  **−25 % dégâts ET perte de toutes les propriétés**). ⚠️ Il ne donne **AUCUNE valeur de stat** : les
  bonus d'arme viennent du **§7.1 de `SPECIFICATION`**, les prix du **§9.1 du guide d'économie**. Les
  trois sources sont disjointes et leurs nomenclatures **ne coïncident pas** (41 catégories / 10 armes
  tarifées / 9 entrées `ITEM_CATALOG` / 10 dans `WEAPONS`).
  ⚠️ **`type` y désigne la stat de CALCUL (AD/AP/hybride), pas le type de dégâts** — une arme
  « physique » peut infliger des dégâts magiques. `tenue` = 1H/2H/poly (poly = **+2 aux jets
  d'attaque** à deux mains). `WEAPONS` (data.jsx) en est une amorce partielle : il porte déjà
  `cat`/`type`/`stat`, mais **mélange tenue et portée** dans son champ `type` (`'Portée'` y côtoie
  `'1H'`/`'2H'`/`'Poly'`).
- `info-mj/Codes App Script.md` — moteur de calcul du Google Sheet (référence ; pas le
  contenu compétences/runes).
- `info-mj/Économie - guide des joueurs.md` — économie du monde côté joueurs : 4 monnaies
  (cuivre/argent/or/platine), poids de la bourse, prix courants, potions, soins, **6 échelons
  d'équipement** (§9, grille de prix armes/armures), sertissage, revente, voyage, régions.
- `info-mj/Économie - dotation de départ (options).md` — dotation de création des PJ, 3 options
  chiffrées. **Décision MJ : option 1 « Dépouillé », 25 ar** ; en attente = la contrainte de choix
  d'arme (§2.1, 3 armes sur 10 accessibles à 25 ar).
  ⚠️ Contenu de **règles**, pas de dev : rien n'est branché dans l'app (les prix ne sont pas dans
  `ITEM_CATALOG`). À rapprocher du backlog « équipement en stats finales » si on l'implémente.
- Specs/plans liés : `docs/superpowers/specs/2026-06-16-competences-design.md`,
  `…-inventaire-design.md`, `docs/superpowers/plans/2026-06-16-inventaire.md`.

## Notes
- L'Excel : feuilles Statistiques/Runes/Journal/Grille Personnage + Stats/Grille par joueur.
  Correspondance perso↔joueur : Rathäel=JB, Urskaar=Baptiste, Smith=Erwan,
  **Elias Crowe (id `lunick`)=Fab**, Jett=Steph.
- Gitignore : `node_modules/`, `idée/`, `*.glb`/`*.obj`/`*.fbx` (assets lourds, hors dépôt),
  `info-mj/` (règles privées du MJ — dépôt public).
```
