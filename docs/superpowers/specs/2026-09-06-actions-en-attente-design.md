# Actions en attente — refonte du contrat « un joueur lance quelque chose »

Design, 2026-09-06. Fait suite au correctif de remboursement du même jour, qui a révélé
que le problème n'était pas le remboursement mais le **modèle**.

---

## 1. Le problème

Le contrat actuel de la file `combat/pendingHits` dit :

> un joueur propose **UN coup de dégâts** sur **UNE cible**.

Tout ce qui n'entre pas dans cette phrase contourne le MJ :

| Cas | Aujourd'hui |
|---|---|
| Soin (Jett C2 « Alignement de séquence ») | `sk.heal` est **affiché sur la carte et appliqué nulle part** |
| Statut sur soi (Smith C2 « Fondu au noir », Rathael C2 « Mur de Givre ») | appliqué **immédiatement au cast**, le MJ n'est jamais consulté |
| Bouclier (Urskaar C3 « Ralliement ») | idem, appliqué au cast |
| Compteurs (`counterBump`, `counterSet`), transformation (`transform`) | idem |
| Compétence à N cibles (Elias C4 « Salve du Corsaire ») | N coups sur la **MÊME** cible, choisie une fois |
| Compétence mixte (Jett C2 : blesse les ennemis **et** soigne les alliés) | impossible à exprimer |

Conséquences directes :

- le MJ ne peut **rejeter** qu'un coup de dégâts. Un camouflage abusif, un soin hors
  portée, un bouclier posé au mauvais moment : il n'a aucune prise ;
- le remboursement livré ce matin ne couvre donc que les compétences à dégâts ;
- une compétence de statut (Smith C2, 40 mana, CD 3) est **irrémédiable** : le mana
  est parti, le cooldown est posé, l'effet est en base, et rien dans l'UI ne revient
  en arrière.

## 2. Le nouveau contrat

> un joueur propose **UNE ACTION**, composée de **N INSTANCES**, chacune portant
> **UN effet** (dégâts, soin ou statut) sur **UNE cible**.

Trois conséquences structurantes.

**(a) La file devient le point d'application UNIQUE.** Aujourd'hui `cast()` applique
lui-même les buffs, boucliers, compteurs et soins PV, et n'envoie au MJ que les dégâts.
Désormais `cast()` ne fait plus **que trois choses** : vérifier la légalité, débiter le
mana + poser le cooldown, écrire l'action. **Tout effet est appliqué par le MJ**, à la
résolution.

> ⚠️ C'est l'inversion centrale de cette refonte. Un effet qui n'a jamais été appliqué
> n'a pas besoin d'être « annulé » — rejeter devient trivial et **exact**. La variante
> « appliquer au cast puis défaire au rejet » a été écartée : défaire un soin est faux
> dès que la cible a été touchée entre-temps, et défaire un `counterSet: {glaciation: 0}`
> demanderait de snapshoter la valeur d'avant pour chaque compteur. Voir §12, décision 1.

**(b) Le ciblage se choisit AVANT le lancement, effet par effet.** Le sélecteur global
« Cible » de l'onglet Combat ne peut pas exprimer « ces deux gnolls prennent les dégâts,
Urskaar prend le soin ». Il descend sur la carte de compétence, sous forme d'une liste de
cibles **par effet**.

**(c) Le coût appartient à l'ACTION, pas à l'instance.** Une compétence à 3 cibles coûte
un mana et un cooldown. C'est le pivot des règles de remboursement du §6.

## 3. Modèle de données

Nouveau nœud, en remplacement de `combat/pendingHits` :

```
/campaign/runeterra/combat/pendingActions/{actionId}/
    attackerId, attackerName        ← le lanceur (toujours un PJ)
    skillId, skillName              ← 'basic' + libellé du mode pour une attaque de base
    source: 'skill' | 'basic'
    ts, round                       ← round = combat/turn au moment du cast
    cost: { mana, cdPrev, manaPer } ← de quoi rembourser (cf. §6)
    appliedCount: 0                 ← nb d'instances DÉJÀ appliquées par le MJ
    instances: {
      {instId}: {
        seq,                        ← 1..N, pour l'affichage « 2/3 »
        kind: 'damage'|'heal'|'status',
        targetId, targetKind: 'enemy'|'pj',
        label,                      ← texte lisible, seule chose affichée pour un statut narratif
        …payload selon `kind`
      }
    }
```

Payloads par `kind` :

- **`damage`** — champs actuels de `pendingHits`, inchangés : `computedDmg, critDmg,
  didCrit, critMult, type, letha, lethaMag, crit, dcrit, vol, sapience, omni, hpMax,
  modeId`. Un `rollCrit` **par instance** (une salve sur 3 cibles = 3 jets, comme
  aujourd'hui).
- **`heal`** — `amount`. Le soin ignore armure et critique ; le MJ ajuste le nombre
  comme il ajuste des dégâts.
- **`status`** — `mods` (mods plats snapshotés, forme actuelle de `skillBuffs`),
  `until` (n° de tour de fin, `null` = permanent), `shield`, `counters`
  (`{[key]: valeur absolue}` après application de `counterBump`/`counterSet`),
  `transformUntil`, `hpGain` (le soin PV d'un `selfBuff.hp`). Tous optionnels : une
  instance de statut purement narrative (Ailes de Givre) n'a qu'un `label`, et
  « Appliquer » vaut alors accusé de réception.

**`appliedCount` est le seul état muté après création**, et il est la clé du §6 : il
remplace le bricolage `castUsed` posé sur les coups frères ce matin, qui n'existait que
faute d'un nœud parent où compter.

> ⚠️ `resetCombat` (« ⟲ Combat ») **ne purge pas `pendingHits` aujourd'hui** — une
> attaque orpheline survit à un nouveau combat. À corriger sur le nouveau nœud : ajouter
> `setPath(PENDING_ACTIONS, null)` avec le même `try/catch` que le journal et l'initiative.

## 4. Logique pure (game-logic.js)

Cinq fonctions, toutes testables sans Firebase.

| Fonction | Rôle |
|---|---|
| `skillTargeting(sk)` | → `{ damage:{camp,min,max}, heal:{…}, status:{self:true} }`. **Dérivée des champs existants de `SKILLS`** quand la compétence ne déclare rien : `sk.dmg` → 1 cible tous camps ; `sk.heal` → alliés ; `sk.shield`/`selfBuff`/`selfBuffFlat`/`counterBump`/`counterSet`/`transform` → soi. Un champ `targeting` **optionnel** dans `data.jsx` surcharge au cas par cas (ex. salve : `damage.max` illimité). |
| `buildCastPlan(sk, eff, ctx, selection, opts)` | → `{ cost, instances[] }`. Le cœur : transforme une compétence + des cibles choisies en la liste d'instances à écrire. Pure, donc la matrice « quelle compétence produit quoi » est verrouillée par des tests. |
| `castSelectionValid(sk, selection)` | → `{ ok, reason }`. Alimente l'état désactivé du bouton « Lancer ». |
| `actionRefundPlan(action, mode)` | → `null` ou `{ mana, cdPrev, skillId }`. `mode` ∈ `'cancel'` (annulation de la compétence) / `'instance'` (rejet d'une instance) / `'drain'` (dernière instance rejetée). Applique le §6. |
| `refundManaValue(cur, amount, max)` | **déjà livré ce matin**, conservé tel quel. |

`castRefundPlan` (livré ce matin) disparaît, absorbée par `actionRefundPlan`.

## 5. Cycle de vie

```
JOUEUR                              MJ
  choisit ses cibles par effet
  « Lancer »
    ├─ vérifie niveau / mana / sélection
    ├─ débite le mana, pose le cooldown        ← le coût part TOUJOURS au cast :
    └─ écrit 1 action + N instances               sinon la comp est spammable
                                        voit UNE carte groupée (§8)
                                        par instance : ajuste puis Appliquer, ou ✕
                                        ou sur l'action : ⚡ Tout appliquer
                                                          ↺ Annuler (rembourse)
                                                          ⊘ Échec (ne rembourse pas)
```

Le coût est débité **au cast** et non à la résolution : sinon un joueur lance sa comp
trois fois pendant que le MJ arbitre.

## 6. Règles de remboursement — réponse au point 1 du MJ

| Geste | Instances retirées | Mana | Cooldown |
|---|---|---|---|
| **↺ Annuler la compétence** | toutes | **remboursé en entier** | **rendu** (`cdPrev`) |
| **✕ Rejeter une instance**, d'autres restent | 1 | rien, **sauf `manaPer`** | inchangé |
| **✕ Rejeter la dernière instance**, `appliedCount === 0` | la dernière | **remboursé en entier** | **rendu** |
| **✕ Rejeter la dernière instance**, `appliedCount > 0` | la dernière | rien | inchangé |
| **⊘ Échec** | toutes | rien | inchangé |

La 3ᵉ ligne est la règle demandée : *« on garde cette logique jusqu'à ce qu'il n'y ait
plus d'instances, auquel cas on revient au cas où le MJ a annulé la compétence entière »*.
La 4ᵉ est son garde-fou : si le MJ a **appliqué** ne serait-ce qu'une instance, la
compétence a eu lieu — rejeter les restes ne la rend pas gratuite. Sans elle, une salve
sur 3 gnolls dont 2 meurent serait remboursée.

**`manaPer`** (mana consommé **par cible**) est prévu dans le modèle et vaut 0 pour
toutes les compétences actuelles. C'est le « sauf si la compétence donne une raison
explicite » du MJ : le jour où un kit facture à la cible, une instance rejetée rendra sa
part, et le champ est déjà là.

## 7. UI joueur — ciblage par effet

Le sélecteur global « Cible » de l'onglet Combat **disparaît des compétences** (il
reste pour l'attaque de base, où il n'y a qu'une cible). Chaque carte de compétence
gagne un bloc « Cibles » :

```
┌ ⚔ Alignement de séquence            40 mana · CD 3 tours · Prêt ┐
│                                                                  │
│  🔴 Dégâts   [Gnoll A ✕] [Gnoll B ✕]              [+ ajouter ▾]  │
│              120 par cible · total 240                           │
│  🟢 Soin     [Urskaar ✕]                          [+ ajouter ▾]  │
│              95 par cible                                        │
│                                                                  │
│  Stun 2 tours + dégâts aux ennemis. Soigne les alliés.           │
│                                          [ Lancer ]              │
└──────────────────────────────────────────────────────────────────┘
```

- une ligne par effet **ciblable**, avec la couleur de son `kind` ;
- le `[+ ajouter ▾]` ouvre la liste des combattants **filtrée par le camp de l'effet**
  (Ennemis / Alliés PNJ / Joueurs), avec les mêmes réserves d'affichage qu'aujourd'hui
  (PV chiffrés pour les PNJ selon `enemyPublicView`, jamais pour les PJ) ;
- les effets **sur soi** ne sont pas listés : ils sont implicites et rappelés par un
  simple « + effet sur toi » ;
- « Lancer » est désactivé tant que `castSelectionValid` n'est pas satisfaite, avec la
  raison en infobulle.

**Simplification obtenue** : la variable `nbTargets` (`SKILL_VARS.salve_corsaire`)
devient inutile — le nombre de cibles **est** la longueur de la sélection. Une ligne de
moins à saisir pour le joueur, et plus de désaccord possible entre « 3 » saisi et une
seule cible réellement choisie.

## 8. UI MJ — l'aide visuelle demandée

Une action = **une carte encadrée**, jamais des lignes éparses. C'est la réponse au
« il faut une aide visuelle pour aider le MJ à repérer les instances d'une même
compétence ».

```
┌────────────────────────────────────────────────────────────── 40 mana · CD 3 ┐
│ Jett · Alignement de séquence                            3 instances · R4    │
├──────────────────────────────────────────────────────────────────────────────┤
│ 🔴 1/3  Dégâts → Gnoll A     [120] (phys)(mag)(brut)  léth [0]   Appliquer ✕ │
│ 🔴 2/3  Dégâts → Gnoll B     [120] …                             Appliquer ✕ │
│ 🟢 3/3  Soin   → Urskaar     [ 95]                               Appliquer ✕ │
├──────────────────────────────────────────────────────────────────────────────┤
│ [⚡ Tout appliquer]              [↺ Annuler la compétence]   [⊘ Échec]        │
└──────────────────────────────────────────────────────────────────────────────┘
```

Trois niveaux de repérage, cumulés :

1. **le cadre** — une action, une carte, quoi qu'elle contienne ;
2. **la bordure gauche** à la couleur du lanceur (déjà disponible : `color` par perso) ;
3. **la pastille de `kind`** par ligne — 🔴 dégâts (`--hp`), 🟢 soin (`--buff`),
   🟠 statut (`--skillbuff`) — plus le compteur `2/3`.

Les cartes gardent tout ce qui existe déjà : garde `target.loaded` pour un PJ,
résistance critique appliquée à la résolution, badge `🎲 CRIT ×n`, champ de léthalité
suivant le type. Une instance appliquée disparaît de la carte, qui disparaît à son tour
quand elle est vide.

## 9. Le rejet spécifique — réponse au point 2 du MJ

**Question posée** : pouvoir rejeter un statut *sans* rembourser le mana risque-t-il
d'encombrer, visuellement ou structurellement ?

**Réponse : non, à une condition — que le geste vive au niveau de l'ACTION, jamais de
l'instance.**

- **Structurellement, c'est gratuit.** Aucun champ, aucune règle, aucune écriture
  supplémentaires : `⊘ Échec` = « supprimer l'action sans appeler `refundCast` ». Une
  branche dans une fonction qui existe déjà. Zéro complexité ajoutée au modèle.
- **Visuellement, c'est un troisième bouton dans un pied de carte qui en a déjà deux.**
  Le MJ lit cette zone une fois par action ; il n'y a pas de multiplication par le
  nombre d'instances.
- **Le mettre par instance serait, lui, encombrant et redondant** : rejeter une instance
  ne rembourse déjà rien (§6). Un « rejeter sans rembourser » par ligne dirait la même
  chose que le `✕` d'à côté.

**Recommandation : ajouter `⊘ Échec`**, et pas seulement pour les statuts. Il couvre
proprement un cas que tu comptais traiter en tapant 0 : une attaque parée, contrée,
dissipée. Mettre 0 en dégâts et cliquer *Appliquer* fonctionne, mais écrit au journal
« inflige 0 » ; `⊘ Échec` écrit « Fondu au noir échoue », ce qui est la vérité de la
scène et se relit mieux. Coût : ~10 lignes, dont 6 de libellé.

Le repli que tu proposais (le MJ retire le mana à la main sur la fiche) reste vrai, mais
il demande de connaître le coût de la compétence et d'aller sur un autre onglet.

## 10. Règles RTDB

Un nouveau bloc, donc **une publication** (`firebase deploy --only database`). Le nœud
`combat/pendingHits` est retiré du fichier en même temps.

```json
"pendingActions": {
  "$actionId": {
    ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'mj' || root.child('users').child(auth.uid).child('role').val() === 'admin' || (newData.exists() ? newData.child('attackerId').val() : data.child('attackerId').val()) === root.child('users').child(auth.uid).child('charId').val())",
    ".validate": "newData.hasChildren(['attackerId', 'skillId'])",
    "instances": {
      "$instId": { ".validate": "newData.hasChildren(['kind', 'targetId'])" }
    }
  }
}
```

Deux points d'attention, tirés des bugs de 2026-08-21 :

- ⚠️ **Le `.write` est sur `$actionId`, ce qui couvre bien la suppression du nœud
  entier** (`set(null)` sur `$actionId`) **et** celle d'une instance (écriture sous
  `$actionId`). Le piège « `.write` sur l'enfant joker n'autorise pas le parent » est
  évité parce que le geste du MJ — supprimer l'action — porte exactement sur le nœud
  qui donne le droit.
- ⚠️ **Durcissement au passage** : `pendingHits` laisse aujourd'hui **n'importe quel
  inscrit supprimer l'attaque de n'importe qui**. La clause ci-dessus restreint
  l'écriture au MJ ou au propriétaire de l'action (`attackerId === son charId`),
  en lisant `newData` à la création et `data` à la suppression. Le MJ garde tout.

## 11. Migration & déploiement

- **Aucune migration de données.** `pendingActions` est un nœud neuf, et
  `pendingHits` est **transitoire** : il ne contient que des attaques non encore
  résolues. Déployer entre deux séances suffit ; en cours de séance, résoudre la file
  avant de rafraîchir.
- Purger `combat/pendingHits` en console après déploiement (facultatif, cosmétique).
- Bump du jeton de cache d'`index.html` comme d'habitude.
- Publier les règles **avant** de pousser le code : sinon le premier cast écrit dans un
  nœud sans règle et prend `PERMISSION_DENIED`.

## 12. Décisions du MJ (2026-09-06)

1. **Les effets s'appliquent À LA RÉSOLUTION.** `cast()` n'écrit plus aucun effet :
   le joueur propose, le MJ valide, l'effet s'écrit. Rejeter = supprimer un nœud, il n'y
   a jamais rien à défaire. Contrepartie assumée : un camouflage ou un bouclier
   n'apparaît sur la fiche du joueur qu'après le clic du MJ.
2. **`⊘ Échec` est ajouté**, au niveau de l'action uniquement (§9).
3. **L'attaque de base passe par le MÊME bloc « Cibles »** que les compétences — une
   seule UI de ciblage à apprendre et à maintenir. Elle reste à **une cible**
   (`max: 1`) tant que les règles ne prévoient pas de balayage ; c'est **une seule
   constante à changer** le jour où un tel geste existe.

## 12 bis. Cas des compétences sans effet chiffré

Quatre compétences ne produisent **aucun** effet calculable : Smith C2 « Fondu au noir »
et C4 « Voile dimensionnel », Rathael C4 « Ailes de Givre » et son ultime pour la partie
aura. Sans traitement particulier, leur cast écrirait une action **vide** et le MJ ne
verrait rien — pire qu'aujourd'hui.

> ⚠️ Règle : **une action qui ne produit aucune instance en reçoit une, de `kind:
> 'status'`, sur le lanceur, marquée `narrative: true`**, dont le `label` reprend la
> note de la compétence. Le MJ la voit, l'accepte (accusé de réception, aucune écriture
> sur la fiche) ou la rejette avec remboursement. C'est ce qui met enfin « Fondu au
> noir » — 40 mana, CD 3 — sous son contrôle.

## 13. Hors périmètre

- **Zones d'effet géométriques** (rayon, cône, cases). Le MJ continue de désigner les
  cibles touchées ; l'app ne modélise pas de plateau.
- **Les actions des PNJ** (`EnemyAttackModal`) restent en dehors de la file : le MJ est
  déjà des deux côtés du clic, une file ne lui apporterait rien.
- **Le rééquilibrage des compétences** (chantier ouvert du 2026-09-05) est indépendant :
  cette refonte ne touche à aucune formule de dégâts.
- **Les débuffs sur cible** (stun, saignement, marque, ralentissement) restent narratifs.
  Le modèle les accueille — une instance `status` sur une cible ennemie — mais aucun
  n'est chiffré dans `SKILLS` aujourd'hui, donc rien à câbler.

## 14. Ce qui a été livré (2026-09-06)

Les trois lots ont été faits d'un bloc : **B est un basculement, pas une transition** —
les deux modèles ne peuvent pas coexister sans doubler la file.

| Lot | Contenu | État |
|---|---|---|
| **A** | `EFFECT_LABEL`, `hasSelfEffect`, `skillTargeting`, `castSelectionValid`, `buildSelfEffect`, `buildCastPlan`, `actionRefundPlan` (game-logic, purs, **26 tests**) ; `usePendingActions`, `healEnemy`, `applyStatusToCharacter`, `refundCast` (data-state) ; règle RTDB `pendingActions` | ✅ |
| **B** | `cast()` n'écrit plus aucun effet ; `TargetRow` + bloc « Cibles » par effet sur chaque carte (compétences **et** attaque de base) ; `PendingActionCard` + `DamageInstanceRow` / `HealInstanceRow` / `StatusInstanceRow` côté MJ. `pendingHits` retiré du code et des règles | ✅ |
| **C** | `⊘ Échec`, `manaPer`, purge de la file dans `resetCombat`, journal par cast et par résolution | ✅ |

**Recette ✅ FAITE le 2026-09-06** (deux sessions simultanées, MJ + joueur en navigation
privée, comme pour l'initiative le 2026-09-03) — les 7 cas validés par le MJ :

1. Salve du Corsaire sur 3 gnolls → **une** carte, 3 instances, 60 mana débité une fois.
2. En appliquer 2, rejeter la 3ᵉ → **aucun** remboursement.
3. Rejeter les 3 une par une → remboursement **complet** au 3ᵉ ✕.
4. « ↺ Annuler la compétence » sur une carte intacte → mana + cooldown rendus.
5. Fondu au noir → une instance **narrative**, « Valider » n'écrit rien, « ⊘ Échec »
   retire tout sans rien rendre.
6. Alignement de séquence : 2 gnolls en dégâts + 1 allié en soin, dans **le même cast**.
7. Mur de Givre : le buff n'apparaît sur la fiche du joueur **qu'après** le clic du MJ.

### Déploiement — fait le 2026-09-06

Règles publiées (`firebase deploy --only database`) puis code mergé sur `main` et poussé
(`7a9d4f4`). Relecture en ligne avant **et** après : aucune dérive console préalable, et le
diff post-publication se limite à `pendingActions` remplaçant `pendingHits`.

⚠️ **Leçon à garder** : remplacer un nœud par un autre ouvre une **fenêtre de casse dans
les DEUX ordres** — règles d'abord, l'ancien code écrit sur un nœud sans règle ; code
d'abord, le nouveau code écrit sur un nœud pas encore déclaré. Et dans les deux cas le
mana est **déjà débité côté client** quand l'écriture est refusée : le joueur paie pour
rien. Ici la fenêtre a été assumée (déploiement hors séance, ~2 min). Le jour où il faut
zéro coupure : publier des règles portant **les deux nœuds**, pousser le code, puis
republier sans l'ancien — deux publications au lieu d'une.

⚠️ **Reste à éprouver à une vraie table.** Le point à surveiller est le **rythme** : les
joueurs attendent désormais le clic du MJ pour voir leur buff s'appliquer. Si ça alourdit,
la §12 documente l'alternative écartée (appliquer au cast puis défaire) et pourquoi.
