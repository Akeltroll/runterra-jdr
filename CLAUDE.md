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
| `docs/archi/combat.md` | Actions en attente (`buildCastPlan`, remboursement), modes d'attaque de base, mitigation, orchestrateurs de coups, vue MJ, onglet Combat, passif Glaciation, onglet Journal |
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
- `data.jsx` — règles immuables : `CHARACTERS`, `BUFFS`, `WEAPONS`, `LEVELS`, `CREATION_BONUS`, `ATTRIBUTES`,
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
  `bareme-stats.md`, `superpowers/{specs,plans}/` (designs et plans).
- `ATH/` — images (`Armes/`, `Items/`, `Perso/*.webp`).
- `info-mj/` — **source de vérité du MJ**, **gitignoré** (dépôt public) : ne jamais committer. Voir « Infos MJ ».
- `idée/` — assets lourds de travail, gitignoré.

## Modèle de données Firebase
```
/campaign/runeterra/characters/{charId}/state/
    hpCur, manaCur, shield (valeurs ABSOLUES), fatigue (0-5), eau (0-5)
    xp:        0   ← progression DANS le niveau courant (entier ≥ 0, < xpToNext(level)) ; via addXp ; montée auto → level
    buffs:     { [buffId]: true }
    modifiers: { hp, mana, ad, ap, armure, resmag, crit, dcrit, rescrit, letha, lethaMag, sapience, vol, omni }
               ↑ liste unique `MOD_STATS` (components.jsx), partagée éditeur d'item + panneau Modificateurs MJ
               letha = léthalité PHYSIQUE (réduit l'armure) ; lethaMag = léthalité MAGIQUE (réduit la rés. mag.)
               sapience/vol/omni sont des POURCENTAGES (cf. lifestealHeal), pas des valeurs plates
    inventory: { [itemId]: { id, cat, name, sub, qty, ic, img, type, mods, weight, carry, carryGroup, order } }   ← perso, éditable (order = rangement manuel, cf. planReorder)
    invInit:   true   ← marqueur de migration (amorçage unique de l'inventaire)
    equipment: { [slotKey]: itemId }   ← paperdoll (page Équipement), temps réel ; slotKey ∈ EQUIP_SLOTS (12 slots, armure fusionnée + ceinture)
    armureInit: true   ← marqueur de migration (fusion des 4 slots d'armure → slot « armure » unique)
    coins:     { plat, or, arg, cuiv }   ← monnaie perso (entiers ≥ 0), via setCoin / moveCoins
    coinsInit: true   ← marqueur de migration (amorçage unique des pièces)
    runes:     { selected:{[nodeId]:true}, choices:{[nodeId]:'ad'|'ap'} }   ← arbre de runes (page Runes)
    runeBonus: 0   ← points de rune bonus accordés par le MJ (test / montée de niveau) ; budget = level + runeBonus
    level:     2   ← niveau effectif (entier ≥ 1, stepper staff onglet Compétences) ; défaut = char.level ; pilote déblocage des comps + passif + budget runes + STATS (socle moteur refondu)
    attrs:       { force, hab, mental, magie }   ← caracs (respec, onglet Progression) ; ABSENT par défaut → repli char.attrs ; lu par charBaseStats ; écrit par setAttrs
    habSplit:    { ad, ap, mana }   ← répartition des points d'Habileté (+5 AD / +5 AP / +10 Mana par point) ; onglet Progression, écrit par setAttrs EN MÊME TEMPS que attrs (cohérence somme <= hab)
                     ABSENT = jamais confirmé → défaut par carac dominante (habSplit, game-logic)
    habSplitOpen: true   ← drapeau MJ : suspend le plancher du joueur pour lui rendre UNE redistribution libre de ses points d'Habileté déjà placés ; posé/retiré par setHabSplitOpen (bouton « ↺ Rouvrir au joueur », staff), effacé automatiquement à la confirmation suivante
    mentalSplit: { hp, mana }   ← répartition de la part DIRIGÉE du Mental (2026-09-05) : chaque point donne 45 PV + 15 Mana garantis, PLUS 15 points au choix (+15 PV ou +15 Mana) ; onglet Progression, écrit par setAttrs EN MÊME TEMPS que attrs
                     ABSENT = jamais confirmé → défaut TOUT EN PV (= 60 PV/pt, l'ancien coefficient) : les PV des persos existants ne bougent pas, aucune migration
    mentalSplitOpen: true   ← même mécanisme que habSplitOpen, drapeau SÉPARÉ (setMentalSplitOpen) : le MJ doit pouvoir rendre une répartition sans rendre l'autre
    forceSplit:  { ad, armure }   ← répartition de la part DIRIGÉE de la Force (2026-09-06) : chaque point donne 15 AD + 1 Armure garantis, PLUS 15 points au choix (+10 AD ou +2 Armure) ; écrit par setAttrs EN MÊME TEMPS que attrs
                     ABSENT = jamais confirmé → défaut TOUT EN AD (= 25 AD/pt, l'ancien coefficient offensif) : l'AD des persos existants ne bouge pas, aucune migration — seule l'armure tombe de 2 à 1 par point
    magieSplit:  { ap, resmag }   ← MIROIR exact de forceSplit sur la Magie (+10 AP ou +2 Rés.Mag) ; défaut TOUT EN AP
    forceSplitOpen / magieSplitOpen: true   ← mêmes drapeaux MJ que habSplitOpen/mentalSplitOpen, SÉPARÉS (setForceSplitOpen / setMagieSplitOpen) : rendre une répartition ne doit jamais rendre les trois autres
    habAd:       4   ← LEGACY (forme AD-seul, a vécu une journée) : encore relue par charBaseStats, purgée au prochain « Confirmer »
    attrsLocked: true   ← verrou après respec joueur unique ; le staff peut éditer/déverrouiller (setAttrsLocked)
    attrsOpen:   true   ← drapeau MJ : suspend le PLANCHER de respec du joueur (ses caracs déjà confirmées) et, avec lui, ceux
                     des QUATRE répartitions ; posé/retiré par setAttrsOpen (bouton « ↺ Rouvrir la respec », staff), effacé
                     automatiquement à la confirmation suivante. ⚠️ NE PAS confondre avec attrsLocked, qui est l'inverse et
                     plus dur : attrsLocked gèle TOUTE la page, attrsOpen ne lève que le plancher — décocher « Verrouillé »
                     ne rend donc PAS la respec
    counters:  { [key]: n }   ← compteurs de compétences (chasseur/marques/tranches/cn…), steppers manuels
    cooldowns: { [skillId]: readyAtTurn }   ← cooldown = n° de tour de disponibilité (999999 = 1×/combat)
    skillBuffs: { [skillId]: { mods:{ [stat]: n }, until:<n° de tour>|null } }   ← buffs sur soi (mods PLATS snapshotés au cast, ex. Urskaar C4 +30% PV/AD/Armure de base) ; until = tour de fin (auto-expiration via sumSkillBuffs(buffs,turn), ex. Mur de Givre 1/2 tours), null = permanent ; ancienne forme plate { [stat]:n } encore lue (compat) ; effacés par « ⟲ Combat »
/campaign/runeterra/sharedInventory/{itemId}/   ← inventaire COMMUN partagé (R/W tout participant)
    { id, cat, name, sub, qty, ic, img, type, mods, weight, carry, carryGroup }
/campaign/runeterra/sharedTransport/   ← ATTELAGE du groupe : { [slotKey]: itemId } (R/W tout participant)
                                          slotKey ∈ TRANSPORT_SLOTS (monture1, monture2, sac1, sac2, sac3)
                                          un objet du coffre n'apporte son `carryGroup` à la capacité commune
                                          QUE placé ici — la simple présence dans le coffre ne suffit pas
/campaign/runeterra/sharedCoins/   ← monnaie COMMUNE (coffre) : { plat, or, arg, cuiv } (R/W tout participant)
/campaign/runeterra/combat/turn   ← compteur de tour PARTAGÉ (nombre ≥ 1) ; lecture inscrits, écriture staff
/campaign/runeterra/combat/enemies/{id}   ← ennemis PARTAGÉS { name, hpCur, hpMax, manaCur, manaMax, atk, armure, resmag, note, crit, dcrit, rescrit, lethaAD, lethaAP, reveal, revealPct } ; lecture inscrits, écriture staff
                                              crit (%) + dcrit (% dég. crit, défaut 200) + lethaAD/lethaAP (léthalité physique/magique) = crit/léthalité ennemi→joueur (rollCrit au lancement ; léthalité AD→armure si physique, AP→rés. mag si magique, via mitigateDamage)
                                              reveal ∈ 'hidden'(défaut)|'bar'|'exact' = ce que voient les JOUEURS ; revealPct (0-100) = % de barre figé en mode 'bar' ; absent → 'hidden'
/campaign/runeterra/combat/pendingActions/{actionId}/   ← ACTIONS proposées par les joueurs (remplace pendingHits depuis 2026-09-06)
    attackerId, attackerName, skillId, skillName, source:'skill'|'basic', round, ts
    cost: { mana, manaPer, manaMax, cdPrev }   ← le coût appartient à l'ACTION, pas à l'instance : N cibles = un seul mana et un seul cooldown
                                                  cdPrev = cooldown d'AVANT le cast (absent = la comp était prête, Firebase efface les null)
                                                  manaPer = mana facturé PAR CIBLE (0 partout aujourd'hui ; c'est la seule raison de rembourser une instance isolée)
    appliedCount: 0   ← SEUL champ muté après création ; dès qu'il dépasse 0 plus RIEN n'est jamais remboursé (la comp a eu lieu)
    instances: { {instId}: { id, seq, kind:'damage'|'heal'|'status', targetId, label, … } }
        targetId = un PNJ (`combat/enemies`) OU un PJ (`charId`) ; pour un `status` c'est le lanceur lui-même
        kind 'damage' : computedDmg, critDmg, didCrit, critMult, type, letha, lethaMag, crit, dcrit, vol, sapience, omni, hpMax, modeId
        kind 'heal'   : amount
        kind 'status' : mods, until, shield, counters, transformUntil, hpGain, hpMax — ou narrative:true (effet en table, « Valider » n'écrit rien)
                                              modeId = mode d'attaque de base (`BASIC_MODES`) quand `skillId === 'basic'` ; absent = attaque pleine
                                              letha/lethaMag = les DEUX léthalités snapshotées au cast ; le champ MJ affiché suit le type choisi (physique→letha, magique→lethaMag, brut→0)
/campaign/runeterra/economyLog/{id}   ← journal d'ÉCONOMIE { id, ts, text, kind:'gold'(transfert)|'buff'(gain)|'debuff'(retrait) }
                                              lecture STAFF (MJ/admin), écriture tout inscrit (un joueur qui prend au coffre doit pouvoir tracer)
                                              JAMAIS purgé par « ⟲ Combat » ; plafonné à LOG_MAX(30), élagué à la lecture par le staff
/campaign/runeterra/combat/log/{id}   ← journal de combat PARTAGÉ { id, ts, text, kind:'gold'|'buff'|'debuff' } ; lecture+écriture tout inscrit ; ~30 derniers ; vidé par « ⟲ Combat »
```
`type` = emplacement d'équipement (`EQUIP_TYPES` : helmet/chest/ring/weapon/accessory/…) ;
vide = non équipable. Renseigné dans l'éditeur d'item quand `cat === 'Équipement'`.
`charId` ∈ {rathael, urskaar, smith, **lunick** (affiché « Elias Crowe »), jett}.
Amorçage auto si vide (`seedIfEmpty`, conversion ratios → absolu via `buildDefaultState`).
`mods` = bonus de stats d'item (vide pour l'instant ; **hook futur** vers `computeEffective`).
```
/users/{uid}/   ← rôles & attribution (écrit par l'admin ; auto-inscription « en attente » à la 1re connexion)
    username, role (joueur|mj|admin), charId (si joueur)
```

**Cache-busting (IMPORTANT à chaque déploiement de code) :** les scripts/CSS locaux d'`index.html`
portent un jeton `?v=…` (et `window.APPV`). **Bumper ce jeton à chaque push de code** (search-replace
de l'ancienne valeur, ex. `20260622-1` → `20260622-2`), sinon le navigateur/CDN sert l'ancienne version
(zéro-build, pas de hash automatique). Sans ça, les joueurs voient l'ancien code malgré le déploiement.

**Check-list de déploiement (bascule anonyme → comptes) :**
1. Pousser le code sur `main` (GitHub Pages).
2. Console → Authentication : créer les comptes joueurs (`pseudo@runeterra.local` + mdp).
3. Console → Realtime Database / Données : vérifier `/users/{adminUID}` = `{username, role:"admin"}`.
4. Publier les règles : `firebase deploy --only database` (ou console → Realtime Database / Règles).
5. Console → Authentication : **désactiver** le provider « Anonyme ».
6. Chaque joueur se connecte une fois → attribuer son perso via la page Admin.

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
- **Niveau 2** pour tous (les 12 pts de stats = 11 du niveau + 1 point bonus de création) ;
  page Progression affiche le bonus en gold. **Niveau effectif live** = `state.level` (stepper staff
  onglet Compétences), défaut `char.level` ; pilote déblocage des comps + passif + budget runes.
- **Déblocage des compétences par niveau** : active n° *i* (0-based) → **niveau *i*+1 requis**
  (`skillUnlocked`), passif toujours dispo. Tous niveau 2 → C3/C4 verrouillés tant que le MJ ne monte
  pas le niveau.
- **Buffs de ressource remplissent la jauge** : `selfBuff.hp` **soigne** au cast (PV max + actuels),
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
  images dans `ATH/`. Bonus `mods` non encore branchés. **`type`** = emplacement explicite (saisi à
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
node --test test/game-logic.test.js          # logique pure (255 tests au 2026-09-06)
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

**Dernier état** : cache `20260909-1`, **266 tests verts** (game-logic 255 + auth 11). Règles RTDB
en ligne == dépôt (relecture du 2026-09-06). Les 18 armures de base sont **en base** (Firebase).

**👉 Reste à faire EN JEU (annonces à la table, toutes en attente)** :
- **quatre répartitions dirigées** (Force AD/Armure, Habileté AD/AP/Mana, Mental PV/Mana, Magie
  AP/Rés.Mag) — et l'armure/RM de chacun a **baissé sans qu'il ait rien fait** (défaut tout-dégâts) → 2026-09-06 ;
- **18 armures au catalogue** (une légère double presque l'armure d'un PJ niveau 2) → 2026-09-07 ;
- **3 patchs** : +5 AR/RM de socle, omnivamp cumulative, armures légères 7 → 10 → 2026-09-09.

**À éprouver à une vraie table** : initiative/créneaux (2026-09-02) ; rythme des actions en attente —
un buff n'apparaît qu'après le clic du MJ (2026-09-06) ; encaissement des profils offensifs à bas
niveau (2026-09-06).

**Suivant** : les **armes** (§7.1 : +15/+30/+70 AD ou AP ; aucune entrée d'`ITEM_CATALOG` n'a de
`mods`) → 2026-09-09 ; puis le **rééquilibrage des compétences** (voir backlog).
**Laissé ouvert exprès, ne pas rouvrir comme un bug** : le profil PV domine le profil résistance en
début de campagne (2026-09-09).

| Entrée | Sujets |
|---|---|
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

### 🔜 PROCHAIN CHANTIER — Rééquilibrage des compétences (diagnostic FAIT, décisions à prendre)
Ouvert le 2026-09-05, à reprendre dans une nouvelle conversation. **Tout le diagnostic est déjà
chiffré au §10 de `docs/superpowers/specs/2026-09-05-calibrage-attaques-base-design.md`** — le
relire AVANT de recommencer une analyse.

**Le socle est prêt** : les attaques de base sont saines et servent d'**unité de mesure**
(invariante au niveau), et le crit ne fausse plus les comparaisons entre personnages.

⚠️ **La PLOMBERIE a changé depuis ce diagnostic** (refonte « actions en attente » du 2026-09-06,
à lire avant de toucher un kit) : une compétence peut désormais **cibler N combattants**, **soigner**
et **mélanger dégâts et soins** dans le même cast, et ses effets sur soi sont **snapshotés** par
`buildSelfEffect` puis appliqués par le MJ. Trois conséquences pour le rééquilibrage :
- **`sk.heal` fonctionne enfin** — le diagnostic du 2026-09-05 chiffrait Jett sans son soin (C2),
  qui était affiché mais appliqué nulle part. Son ratio comp/AA est donc **sous-évalué** au §10.
- **Le multi-cible est réel** : la rotation optimale d'une comp de zone (Salve, Éclat de l'âme,
  Chaînes, Écrasement) doit se rechiffrer **par nombre de cibles**, pas par coup.
- **`manaPer`** (mana facturé à la cible) existe déjà dans le modèle et vaut 0 partout — c'est le
  levier tout traçé pour l'arbitrage MJ « le mana doit être un minimum limitant » sur les comps
  de zone, sans toucher au coût des comps mono-cible.

**Le constat mesuré** (rotation optimale sur 4 tours, cooldowns et mana inclus, niveau 18) :
**3 PJ sur 5 n'ont aucune raison de lancer une compétence**, et il leur reste **90-100 % de leur
mana** en fin de combat. Urskaar ×1.50, Elias ×1.47, Rathael ×1.21, **Smith ×1.04, Jett ×1.00**
(1.00 = ne fait pas mieux que taper gratuitement).

**Budget cible par archétype, en multiples d'AA** (la moyenne converge, c'est la FORME qui
distingue) : AD carry 1.4 soutenu / pic 1.8 ; **assassin 0.7 soutenu / pic 4.0 un tour sur quatre** ;
bruiser 1.3 / 2.2 ; tank 0.8 / 1.6 ; utilitaire 1.0 / 2.5. Moyenne ~1,5 pour les DPS.

**Défauts précis à traiter** :
- **Jett** : ses 2 comps scalent sur l'**AD** alors qu'il est un build AP. Même en replaçant toute
  son Habileté en AD, elles restent à **0,37× son attaque de base**. Ses C3/C4 n'existent pas
  (kits jamais reçus du MJ).
- **Rathael** : sa C1 (20 mana, **sans CD**) fait **0,57× son attaque de base gratuite**. Elle scale
  à 40 % sur (Armure + RM), divisé par deux le 2026-09-04. Idem son passif : **+7 points au total à
  5 charges** au niveau 2. ⚠️ **Divergence à trancher** : le code fait **+10 %/charge**
  (`sumPassiveMods`), le CLAUDE.md et `data.jsx` annoncent **+5 %**.
- **Smith** : passif `50 + 0,5 AP` orphelin (×1,72 sur toute la campagne). **Aucun burst** : même en
  jouant l'enchaînement idéal (Fondu au noir → 3 tours de sournoise furtive), il plafonne à ×1,12 —
  pour un archétype d'assassin.
- **Elias** : passif **surpuissant** — `10 + 5(niv−1)` AD par charge × `5 + ⌊(niv−1)/3⌋` charges =
  **+950 AD au niveau 18** sur un AD de base de 504.
- ⚠️ **Les constantes plates (`50 +`, `100 +`, `25 +`) sont la cause n°1 du décrochage**, AVANT
  l'absence de scaling par niveau. Dominantes à bas niveau, noyées à haut niveau. **Preuve** :
  Urskaar n'a **aucun** scaling de niveau et son ratio comp/AA est **constant à 1,50 du niveau 2
  au 18**, parce que ses formules sont des multiples purs d'AD. Ne pas partir sur « ajouter du
  scaling de niveau partout » sans avoir traité les constantes.
- **Mana non limitant** : les coûts sont dérisoires face aux pools (Jett a 782 de mana pour des
  sorts à 40-50). À remonter une fois les compétences réparées — arbitrage MJ : « le mana doit être
  un minimum limitant sinon il perd de son intérêt ».
- **Jett, incohérence à trancher** : son passif dit que son attaque de base ne fait plus de dégâts
  (elle crée des cellules), mais la carte « Attaque de base » lui affiche `eff.ap` et le bouton
  « Attaquer » fonctionne.

**❓ LA question non tranchée par le MJ** : **scaling numérique par niveau OU upgrades de
compétences au choix du joueur à chaque montée** — le MJ veut **l'un ou l'autre, pas les deux**
(« scale les nombres + upgrade de compétences risquent de rendre les personnages difficiles à
équilibrer »). Recommandation déjà formulée : **les upgrades**, parce que le scaling numérique
existe déjà gratuitement via les stats (cf. Urskaar) et qu'une montée de niveau n'offre aujourd'hui
**aucun moment de choix** au joueur. Sous-question ouverte : format des upgrades (2-3 options
prédéfinies par compétence, ou pool de points libre ?).

- **Monnaie : durcissement des règles RTDB + journal** — ✅ **FAIT, publié et validé le 2026-08-21**
  (résultats de la campagne de tests + 2 bugs antérieurs trouvés au passage : **§9.7 et §10** du
  document de reprise). Restent 3 tests secondaires : 7 (réimport de sauvegarde), 8 (ré-amorçage),
  13 (lecture d'`economyLog` refusée au joueur). Document :
  **document de reprise complet** : `docs/superpowers/specs/2026-08-20-durcissement-monnaie-rtdb-design.md`
  (contexte, patch de règles prêt à coller, points d'accroche du journal, 3 pièges dont l'import de
  sauvegarde cassé par un `.validate`). A reste bloqué sur une **publication manuelle en console Firebase**
  (le dépôt n'a ni CI ni `firebase.json` : `database.rules.json` est une copie de référence, rien ne
  la déploie) — mais `economyLog` en impose déjà une, donc autant faire les deux d'un coup.
- **Lot améliorations graphiques** (brainstormé 2026-06-28, chantiers indépendants — chacun sa spec/plan) :
  **A — Refonte fiche joueur = FAIT** (voir `docs/journal/2026-06-29.md`).
  **B — Arbre de runes en vrai arbre visuel = FAIT, refondu et VALIDÉ par le MJ** (2026-08-16) :
  constellation radiale, puis **refonte graphique hi-fi** (handoff MJ) — voir `docs/journal/2026-08-16.md`. Reste :
  **C — Hub d'accueil vivant** (remplacer la page Accueil mockup `pages-lobby.jsx` — boutons « Rejoindre/Créer
  session » + code `VX-7K2` factices, invisible des joueurs — par un vrai tableau de bord : roster du groupe
  PV/mana live, séance en cours, dernier récap, état du combat) ; **D — Passe
  d'animations** transversale (transitions d'onglets, level-up, etc.). Ordre suggéré : C puis D en continu.
- **Nouveau système d'attaque de base** (brainstorm en pause à la demande du MJ) : catégories d'armes
  (`info-mj/Nouveau système de gestion des attaques de base (2).md`) + **maîtrise par perso×arme** (−25 % +
  perte des propriétés si non maîtrisée), idée de **maîtrise qui progresse à l'usage**. À reprendre.
- **Inventaire + Équipement : clos côté code** (perso + commun, transferts, catalogue, plafond 99,
  monnaie vivante, paperdoll, `item.mods` branchés). Reste de la **saisie de contenu** — chantier
  ouvert le 2026-09-07, document de reprise `docs/superpowers/specs/2026-09-07-catalogue-objets-design.md` :
  **armures de base FAITES** (18, dans `data.jsx`) mais ⏳ **l'écriture Firebase reste à passer** ;
  puis **armes** (aucune n'a de `mods`, alors que le §7.1 les chiffre : +15 AD / +15 AP / +10-10 hybride),
  **potions** (le catalogue est 2 à 3× sous le guide d'économie, et c'est le catalogue qui s'applique
  en jeu), et **palier supérieur des armures** (non chiffré dans la spec, à faire trancher par le MJ).
- **Compétences** : **implémentées et déployées**, mais ⚠️ **DÉSÉQUILIBRÉES — voir « 🔜 PROCHAIN
  CHANTIER » en tête de ce backlog** (diagnostic chiffré du 2026-09-05). Ce qui suit décrit
  l'existant, pas un état satisfaisant. (Elias/Smith/Urskaar/Jett + **Rathael complet C1→C4 + ultime**).
  Le passif Rathael (+5%/charge Armure+RM de base) calcule un mod plat depuis les stats de
  base (`sumPassiveMods(...,base)`). Charges Glaciation **automatisées** : +1/coup subi (tout stackable en 1 tour,
  max 5 ; +2/coup pendant Souverain Glacial via `souverainUntil`) ; −3/tour sans dégât (`glaciationDecay`). **À FAIRE
  plus tard** : (1) **comps Jett C3/C4** (kits pas encore reçus) à ajouter dans `SKILLS` + `game-logic.js` ;
  (2) automatiser l'état Âme fendue de Rathael à 5 charges (aujourd'hui narratif/manuel) ; (3) Phase 2 :
  auto-application des dégâts aux ennemis (aujourd'hui le MJ saisit le nombre dans « Subir »).
- **Arbre de runes** : **FAIT et déployé** (voir `docs/journal/`). Les 5 familles sont chiffrées
  (`RUNES`, data.jsx) et interactives. Reste seulement la validation MJ (capstone vs thématique,
  2 cellules tronquées).
- **Nouveau système d'attaques de base** (`info-mj/`) : catégories d'armes + propriétés +
  maîtrise (−25 % si non maîtrisée). **Remplace** l'ancienne idée ×1.5/×1.75.
- **Journal de combat partagé** : **FAIT** (`combat/log`, `CombatLog` ; voir `docs/journal/`).
- **Cycle de séance + XP + distribution de récompenses (vue MJ)** — découpé en **A** (XP & niveau) +
  **B** (séance + récompenses). **A = FAIT et déployé (2026-06-21)** : `state/xp` (progression intra-niveau),
  `xpToNext`/`applyXp` (game-logic, testés), orchestrateur `addXp` (montée auto + report + `pushLog`),
  composant `XpBar` (fiche + Progression + cartes MJ), contrôle « +XP » ad-hoc côté MJ. Aucune règle RTDB.
  Spec/plan : `docs/superpowers/{specs,plans}/2026-06-21-xp-niveau*`. **B = FAIT et déployé (2026-06-21)** :
  `useSession` (état de séance MJ-local `localStorage`), `SessionStartModal` (« Début de séance / Visite »
  à l'ouverture de la vue MJ), bandeau « Séance en cours » + bouton « Clôturer », `SessionRewardsModal`
  (tableau XP + pièces par joueur → `addXp` en lot + `grantCoins` ; bouton « loot » → onglet Inventaire
  commun). `grantCoins(charId, patch)` = don additif d'argent (data-state). Aucune règle RTDB.
  Spec/plan : `docs/superpowers/{specs,plans}/2026-06-21-seance-recompenses*`.
  **Courbe XP officielle appliquée** (`info-mj/tableau_XP.png`) : `xpToNext = 180+100*level`, cap niveau 18.
- **Refonte « système hypermétrique »** — `info-mj/SPECIFICATION - Système refondu.md` (livré MJ 2026-06-21).
  ⚠️ **SECTION HISTORIQUE** : les chiffres décrits ci-dessous sont ceux de la spec de juin. Deux
  refontes sont passées depuis — **2026-09-04** (9e stat `rescrit`, Habileté au choix AD/AP/Mana,
  armure divisée par deux…) puis **2026-09-05** (courbe de points, escalade locale/globale, crit
  divisé, répartition du Mental). **Ce qui fait foi aujourd'hui :
  `docs/superpowers/specs/2026-09-05-calibrage-attaques-base-design.md` +
  `docs/journal/2026-09-05.md`.** Les cibles de PV du §9 de cette spec ne sont plus valides,
  ni sa table d'escalade §4.3, ni ses coefficients de crit.
  Modèle de stats = **4 caractéristiques** (Force/Habileté/Mental/Magie) → 8 stats dérivées à l'époque
  (matrice de poids, escalade anti-aplatissement, socle de niveau, bonus de départ, surcrit,
  équipement en stats finales, zone PNJ).
  Découpé en sous-projets. **Fondation = FAITE (2026-06-21, branche `feat/moteur-stats-refondu`)** : `computeStats` (signature d'alors : `(F,H,M,C,level)`)
  + `escalationFactor` + `charBaseStats` (game-logic, testés §9), bascule de l'app en calcul **live** (fin du
  `char.stats` figé ; 9 fichiers migrés), modèle de données `state/attrs`+`attrsLocked` (lecture seule ici),
  caps `LEVELS` §3, libellés `ATTRIBUTES`, Sapience retirée du socle. Aucune règle RTDB. Spec/plan :
  `docs/superpowers/{specs,plans}/2026-06-21-moteur-stats-refondu*`.
  **Combat (§6) = FAIT (2026-06-22, branche `feat/combat-refondu`)** : `critInfo`+`rollCrit` (surcrit par paliers,
  testés), crit roulé au cast, **léthalité** branchée (`mitigateDamage`←`applyHitToEnemy`, snapshot au cast, éditable MJ),
  attaque de base unifiée. Aucune règle RTDB. Spec/plan : `docs/superpowers/{specs,plans}/2026-06-22-combat-refondu*`.
  **Respec joueur = FAIT et déployé** (onglet Progression, voir plus haut : budget `LEVELS.total+CREATION_BONUS`,
  caps `LEVELS.limit`, verrou unique joueur + (dé)verrouillage staff + réouverture du plancher
  (`setAttrsOpen`) ; `setAttrs`/`setAttrsLocked`,
  `attrSum`/`respecValid` testés). **Reste** (sous-projets séparés) : (1) **équipement en stats finales**
  (armes 3 paliers + 18 armures §7) ; (2) **zone PNJ/divine** (escalade quadratique >20 §8 ;
  `escalationFactor` gère déjà >20). **Crit/léthalité ennemi→joueur = FAIT (2026-06-22)** : `makeEnemy`
  +`crit`/`dcrit`/`letha`, édition inline `EnemyCard`, `EnemyAttackModal` roule le crit (`rollCrit`) + applique
  la léthalité (`mitigateDamage`). Aussi livré ce jour : **vol de vie/sapience/omnivamp** (soin de l'attaquant à
  la résolution MJ, séparation par source : attaque de base→vol/sapience, comp→omnivamp ; `lifestealHeal` testé,
  orchestrateur `healCharacter`). Aucune règle RTDB.

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
