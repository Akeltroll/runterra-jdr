# Buffs sur soi (skill-buffs) + Journal de combat — design

> **Statut : design validé par l'utilisateur (2026-06-20).** Empilé sur `feat/competences`
> (compétences + plateau partagé). Deux ajouts petits et indépendants de la couche combat,
> soulevés ensemble. **SP3** (buffs sur soi) clôt le backlog « effets sur le lanceur » ; le
> **journal de combat** persiste/partage le fil des événements.

## A. Journal de combat (fil des dégâts)

### Problème
Les événements de combat (attaque appliquée à un ennemi, attaque ennemie sur un joueur, KO)
ne sont visibles que comme **toasts éphémères**, et seulement par celui qui agit. Les joueurs
ne voient pas le déroulé.

### Design
- Nœud `combat/log/{id}` = `{ id, ts, text, kind }`. `text` = message déjà produit pour le
  toast (rendu sûr, seul `<b>` autorisé, comme les toasts) ; `kind` ∈ `'gold'|'buff'|'debuff'`
  (couleur). Helper `pushLog(text, kind)` (data-state.jsx) : génère `id`+`ts`, écrit.
- **Branchements** : `PendingHitsPanel.apply` (résolution joueur→ennemi) et `EnemyAttackModal.submit`
  (ennemi→joueur) appellent `pushLog` en plus du toast.
- **Affichage** `CombatLog` : liste des ~30 derniers (tri `ts` décroissant) en lecture seule.
  Placé **sous le plateau** dans la vue MJ **et** en bas de l'onglet Compétences (les joueurs
  voient le fil). Bouton **« Vider »** (staff) = `clearLog`.
- **« ⟲ Combat » (`resetCombat`) vide aussi le journal.**
- Règle RTDB `combat/log` : lecture inscrits, écriture inscrits (les événements viennent des
  deux camps). `.validate` : `text` est une chaîne.

## B. Buffs sur soi (SP3)

### Problème
Les compétences qui buffent le lanceur (Urskaar C4 +30% PV/AD/Armure ; Urskaar C3 bouclier)
n'appliquent rien : l'effet n'était qu'un rappel narratif. L'utilisateur veut qu'ils
s'appliquent réellement, en **stats temporaires de combat**, effacées par « ⟲ Combat ».

### Design — état & calcul
- `state/skillBuffs/{skillId}` = mods **plats** calculés **au lancement** (snapshot), ex.
  Urskaar C4 → `{ hp, ad, armure }` chacun = `round(0,30 × stat de BASE)`. Setter
  `setSkillBuff(skillId, mods)` (data-state.jsx).
- Logique pure `sumSkillBuffs(skillBuffs)` → somme des mods plats (game-logic.js, **testée**).
- Branché dans `computeEffective` via le 4e param existant (merge avec items/runes/passif) aux
  3 sites (fiche/MJ/équip) — **mais gardé aussi à part** (`skillBuffMods`) pour la couleur.
- **Aucune entorse à `computeEffective`** : un bonus **plat** sur PV s'applique déjà (seuls les
  **%** étaient exclus des PV max). Donc le « +30% PV max » passe en plat.
- **`resetCombat` efface `skillBuffs`** (+ journal) → retour aux stats de base.

### Design — règles de jeu
- **+30% PV max = réservoir plus grand, SANS soin** (décision utilisateur : un heal « casserait
  la compétence »). On augmente le **max** ; les PV actuels ne montent pas → aucun débordement
  quand le buff retombe au reset (PV actuels ≤ ancien max ≤ nouveau max).
- **Bouclier** (Urskaar C3 Ralliement) : ajouté directement au **pool** (`shield += urskaarC3Shield`)
  au cast (one-shot), pas un skill-buff persistant.
- Skills concernés : **Urskaar C4 `demi_ours`** (`selfBuff: { hpPct:0.30, adPct:0.30, armurePct:0.30 }`),
  **Urskaar C3 `ralliement`** (bouclier, déjà `shield:` dans SKILLS). Le crit conditionnel de
  Smith C4 reste narratif (trop situationnel).

### Design — couleur distincte (orange)
- Nouvelle var CSS `--skillbuff: #E8923C` (orange).
- Une stat **boostée par un skill-buff** s'affiche en **orange** (priorité sur le vert
  items/runes), pour distinguer l'effet **temporaire** de compétence des bonus permanents.
  Le rendu lit les **clés de `skillBuffMods`** : `skillBuffMods[stat] ? orange : (bonus item/rune ? vert : normal)`.
- Appliqué sur la **fiche** (principal) + un **badge « Buff actif »** orange sur la carte de la
  comp (onglet Compétences). MJ/équip affichent la valeur correcte (extension orange = bonus si
  trivial, sinon vert combiné).

### UI Compétences
- Les comps à buff (plus « utilitaire ») : au cast, appliquent le skill-buff (et/ou le bouclier),
  toast « buff actif », badge orange « actif » tant que `skillBuffs[skillId]` existe. (Le reset
  combat les enlève ; pas de retrait manuel en MVP.)

## Hors périmètre
- Expiration au tour-par-tour (on s'en tient au reset de combat).
- Retrait manuel d'un skill-buff avant la fin du combat.
- Crit conditionnel Smith C4 (narratif).

## Découpage (aperçu)
1. `combat/log` : `pushLog`/`useCombatLog`/`clearLog` + règle RTDB + `resetCombat` vide le log.
2. `CombatLog` (composant) + branchements (`PendingHitsPanel`, `EnemyAttackModal`) + affichage MJ + Compétences.
3. `sumSkillBuffs` (pur, testé) + `setSkillBuff` + `resetCombat` efface `skillBuffs` + var CSS `--skillbuff`.
4. SKILLS `selfBuff` (Urskaar C4) ; cast applique skill-buff + bouclier (C3) ; merge dans les 3 `computeEffective`.
5. Couleur orange (fiche + badge Compétences).
6. Doc + tests + republication RTDB.
