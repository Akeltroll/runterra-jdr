# Armes et maîtrises — design d'implémentation

*Ouvert le 2026-09-14. Transforme le chiffrage de `docs/armes-maitrises.md` (2026-09-12) en
fonctionnalité du site : catégories d'armes, maîtrises par personnage, attaque de base pilotée par
l'arme équipée, propriétés. Les décisions du MJ du 2026-09-14 (§2) **priment** sur les documents
antérieurs quand ils divergent.*

Sources, par ordre de priorité :
1. **Ce document, §2** — décisions MJ du 2026-09-14.
2. `docs/armes-maitrises.md` — valeurs **révisées** des propriétés (deux passes du 2026-09-12).
3. `info-mj/Nouveau système de gestion des attaques de base (2).md` — les 41 catégories et le texte
   d'origine des propriétés (⚠️ plusieurs propriétés y sont dans leur version **d'avant** révision).
4. `info-mj/SPECIFICATION - Système refondu.md` §7.1 — paliers de stats.
   ⚠️ Son §6.1 dit « moyenne AD/AP » pour une arme hybride : **remplacé** par le choix du joueur (§2).
5. `info-mj/Économie - guide des joueurs.md` §9 (prix) et la formation « maîtrise » à 120 ar.

---

## 1. État de départ (relu en base le 2026-09-14)

**Catalogue** (`campaign/runeterra/catalog`) — 42 entrées d'arme créées par le MJ à la page Admin :
- valeurs **+10 AD / +10 AP / +5-5 hybride**, contre +15 / +15 / +10-10 au §7.1 ;
- **Fusil de précision en double** (`it_mrpt9usb_1o` poids 2, `it_ms2ivfvr_a` poids 5) ;
- **sans `mods`** : Bâton de combat (`it_mrpiic7y_d`), Hache double (`it_mrpixw40_r`) — le `sub` dit +10 AD ;
- **Parchemin de combat** (`it_mrpo6bb2_17`) sans `type` ;
- **5 explosifs** rangés en `weapon` (Explosifs à poudre / arcaniques / mixtes, Hexplosifs) ;
- **manquent** : Rapière, Dague (hors *Dague simple*) ; **Relique** scindée en lunaire + solaire ;
- **aucune arme ne porte sa catégorie** : le code la retrouve par **nom** dans `WEAPONS` (data.jsx,
  10 entrées périmées) — `weaponTypeOf` (`pages-competences.jsx:84`), `eqWeaponName` (`:603`),
  `pages-sheet.jsx:352`, avec repli sur `char.weaponId`.

**Armes équipées** :

| PJ | Arme principale | Arme secondaire | Accessoire |
|---|---|---|---|
| Rathaël | Claymore (+10 AD) | — | — |
| Urskaar | Gantelet renforcé (+10 AD) | — | — |
| Smith | Dague (Loyauté) (+10 AD) | Dague (Loyauté) (+10 AD) | — |
| Elias | Arbalète légère (+10 AD) | Hachette (+10 AD) | Dague simple (+10 AD) |
| Jett | Arc hextech (aucun mod) | — | Dague simple (+10 AD) |

Smith possède aussi une *Épée longue (non identifiée)* non équipée.

**Code** : l'attaque de base prend `eff.ad` (ou `eff.ap` si l'arme est « Magique ») à 100 %, sans
notion de maîtrise, de tenue ni de propriété. `sumItemMods` additionne les `mods` de **tous** les
emplacements, accessoires compris.

---

## 2. Décisions du MJ (2026-09-14)

| # | Sujet | Décision |
|---|---|---|
| 1 | Bonus de stat | **+15** AD ou AP (arme de base), **+10/+10** hybride. Paliers §7.1 conservés (+30 / +70 ; +20-20 / +45-45). **Pas de crit plat** dans les `mods` pour l'instant : le crit d'arme ne vient que des propriétés (Fourberie, Plénitude, Concentration). |
| 1b | Mana de Canalisation | Le bâton magique donne **+50 Mana + 10 Mana par niveau**, **seulement s'il est maîtrisé** : c'est un bonus de la **propriété** Canalisation, pas une stat de l'objet. |
| 2 | Arme hybride | **Le joueur choisit** AD ou AP dans l'onglet Combat, dès qu'une arme hybride est en arme principale **ou** secondaire. |
| 3 | Type de dégâts | Suit le type de l'arme (physique → dégâts physiques, magique → magiques) ; pour une hybride, **le mode choisi**. Dague = attaque physique, bâton magique = attaque magique. |
| 4 | Mini-arme non maîtrisée | **Garde sa propriété.** Avec l'absence de malus de −25 % (validée le 2026-09-12), une mini-arme **ignore totalement la maîtrise**. |
| 5a | Poly + mini-arme | La mini-arme en secondaire apporte **son bonus de stat et sa propriété**, mais **pas d'attaque de base** : l'attaque vient de l'arme principale. |
| 5a' | Cumul des propriétés | **Jamais deux propriétés dans le même tour.** Avec deux armes utilisables, le joueur **choisit** à chaque tour laquelle il lance (propriété de l'arme principale si elle est maîtrisée, ou celle de la mini-arme). |
| 5a'' | Deux armes non mini | **Interdit** pour l'instant. Un effet de milieu ou de fin de partie pourrait l'ouvrir plus tard. |
| 5b | Échange de mains | Passer une mini-arme de secondaire à principale est quasi instantané : **permissif**, sans contrainte. |
| 5c | Accessoires | Une arme rangée en accessoire **ne donne ni stats ni propriété**. Elle indique une arme à portée de main, qui peut entrer **librement** dans l'emplacement principal ou secondaire. **Seules les mini-armes** peuvent aller en accessoire. |
| 6 | Explosifs | **Consommables**, pas des armes. |
| 7 | Arc hextech (Jett) | Pour l'instant, un **pseudo arc court** qui peut aussi tirer des **cellules nano-hextech**. Mode **arc court** : dégâts **physiques** (AD), propriété **Concentration**. Mode **cellules** : **aucun dégât** (c'est son passif). Stats **+10/+10** malgré tout. Jett privilégiera le mode cellules. |
| 8 | Maîtrises de départ | Chaque PJ **maîtrise toutes les armes qu'il possède** actuellement. |
| 8b | Orbe | **Pas une mini-arme** (le document des catégories fait foi ; le guide d'économie §9.1 « Dague, orbe (mini-arme) » est à corriger côté MJ, `info-mj/` n'est pas versionné). |
| 9 | Modes × propriétés | Les propriétés ne jouent **qu'en attaque pleine** (`BASIC_MODES` `normal`). Une gifle ne déclenche rien. |
| 10a | Purge | **CD 2 tours à compter du retrait** d'un bouclier/buff (déjà dans `armes-maitrises.md`). |
| 10b | Désarmement | Désarmement **garanti**, 20 % de récupérer l'arme. La cible peut ramasser son arme au tour suivant **en perdant une action**, sauf si quelqu'un d'autre l'a ramassée entre-temps. **CD 2 tours**, comme dans le document MJ : la révision du 2026-09-12 ne l'a pas retiré. |
| 10c | Technologie hextech | **Pas implémentée.** Ce seront des passifs d'arme sur mesure, créés par les joueurs. |
| 11 | Attribution des maîtrises | **Staff uniquement.** |

---

## 3. Modèle

### 3.1 Référentiel pur — `game-logic.js`

**`WEAPON_CATEGORIES`** — une entrée par catégorie du document MJ (41 − 4 explosifs = 37, plus
l'arc hextech) :

```js
{ id:'dague', name:'Dague', hands:'1H'|'2H'|'poly', range:'1', mini:true,
  modes:[ { id:'ad', stat:'ad', dmgType:'physique' } ],   // hybride : 2 modes (ad/physique, ap/magique)
  props:['fourberie'] }                                    // ids de WEAPON_PROPERTIES, hors 'mini'
```

- `mini` est un **drapeau de catégorie**, pas une propriété : il pilote le ratio de 60 %, l'exemption
  de maîtrise, l'accès aux accessoires et le dual wield.
- **Hybride = deux modes** (`ad`/physique, `ap`/magique). **Arc hextech** = catégorie
  `arc_hextech`, `hands:'2H'`, `range:'6'`, `props:['concentration']`, modes `fleche`
  (AD, physique, Concentration) et `cellules` (`damage:false` : l'attaque dépose une instance
  narrative « cellules nano-hextech », aucun dégât), mode par défaut `cellules`. Stats +10/+10.
  Ça règle l'incohérence du backlog (« la carte affiche `eff.ap` et le bouton Attaquer fonctionne »).
- Attaque lente, Maniement risqué et Usage limité restent dans `props` : ce sont des **rappels**, pas
  des mécaniques.

**`WEAPON_PROPERTIES`** — `{ id, name, text, lot: 2|3, cd?, params, passiveMods?(level) }`.
`passiveMods` porte les bonus de stat **conditionnés à la maîtrise** : Canalisation
`{ mana: 50 + 10 × niveau }`, Plénitude `{ crit: 5, dcrit: 10 }`. Un bonus passif s'applique dès que
l'arme est tenue et que sa propriété est **utilisable** (maîtrisée, ou mini-arme). Il ne dépend pas
du choix de la propriété du tour : sinon le mana max du porteur changerait d'un tour à l'autre.
Le `text` reprend la version
**révisée** de `armes-maitrises.md`, jamais la version d'origine du document MJ.

**`WEAPON_TIER_MODS`** — `{ base:{phys:{ad:15}, mag:{ap:15}, hyb:{ad:10,ap:10}}, sup:…, leg:… }`,
pour que la page Admin propose les bonnes valeurs au lieu de les faire retaper.

⚠️ `WEAPONS` (data.jsx) et `char.weaponId`/`weaponIds` sont **retirés** à la fin de la livraison 1.

### 3.2 Item

Un champ nouveau, **même chemin qu'`armorClass`** :
- `weaponCat` : id de `WEAPON_CATEGORIES` (`''` si non-arme).

Pas de champ « bonus par niveau » sur l'objet : le seul cas (mana du bâton magique) dépend de la
maîtrise, il vit donc dans `WEAPON_PROPERTIES.passiveMods` (décision 1b).

Sites à toucher :
- `makeItem` (`game-logic.js:114`) ;
- la clé de fusion (`:121`) : `weaponCat` en fait partie ;
- `planItemTransfer` (`:137`), `fillStacks` (`:168`), `catalogArray` (`:536`) ;
- l'éditeur d'item (`components.jsx:904-976`) : sélecteur de catégorie quand `type` vaut `weapon`,
  bouton « appliquer le palier » ;
- `ItemTooltip` (`:499`) : tenue, portée, propriétés, mini-arme.

Le `type` d'une arme reste `'weapon'`. **La *Dague simple* repasse de `accessory` à `weapon`** : c'est
désormais sa catégorie `mini` qui l'autorise en accessoire (§3.4).

### 3.3 État du personnage

```
state/masteries    { [weaponCat]: true }         ← STAFF seulement (voir 3.5)
state/weaponChoice { mode: '<modeId>', prop: '<propId>' }
                   ← joueur ; mode = choix hybride / arc hextech (absent → mode par défaut) ;
                     prop = propriété lancée ce tour quand DEUX armes sont tenues (mini + mini, ou
                     Poly/1H + mini) ; mémorisée comme choix par défaut, modifiable à chaque tour
                     (absent → celle de l'arme d'attaque)
state/weaponCombat { duelTarget, concTarget, parryTarget }
                   ← joueur ; cibles désignées ; EFFACÉ par « ⟲ Combat » (resetCombat)
```

Les cooldowns de propriété réutilisent `state/cooldowns` sous des clés préfixées `w_` (`w_balayage`,
`w_purge`…). `resetCombat` les efface déjà ; 1×/combat = sentinelle `CD_LOCKED`.

`pendingActions/{id}` (source `basic`) gagne `weaponCat`, `weaponName`, `mastered`, `propId` : la
carte du MJ doit dire avec quelle arme et quelle propriété le coup est parti.

### 3.4 Règles d'emplacement — `pages-equip.jsx` (logique pure dans `game-logic.js`)

| Situation | Autorisé ? | Attaque de base | Stats | Propriétés |
|---|---|---|---|---|
| 2H en principale | oui, **secondaire vide obligatoire** | 100 % | arme | arme |
| Poly seule | oui | 100 %, **tenue à deux mains** (rappel +2 au jet) | arme | arme |
| 1H seule (non mini) | oui | 100 % | arme | arme |
| Mini seule | oui | **60 %** | arme | arme |
| Mini + mini | oui | **60 % + 40 % = 100 %** | les deux | **une seule à la fois**, au choix (`weaponChoice.prop`) |
| Poly ou 1H + mini | oui | 100 % **de l'arme non mini**, tenue à une main | les deux | **une seule par tour**, au choix : celle de l'arme principale (si maîtrisée) ou celle de la mini-arme |
| Non mini + non mini | **refusé** (5a'') | | | |
| Mini-arme en accessoire | oui | — | **aucune** | **aucune** |
| Autre arme en accessoire | **refusé** | | | |

- L'arme d'attaque est **l'arme non mini** si l'une des deux l'est, quel que soit son emplacement
  (5b rend l'ordre des mains sans importance).
- **Échange rapide** : un bouton sur la carte « Attaque de base » intervertit principale et
  secondaire, ou fait passer une mini-arme d'un accessoire vers une main libre. Aucune contrainte de
  tour (5b, 5c).
- `sumItemMods(equipment, items)` **ignore les armes rangées en accessoire**.
- Nouvelle `sumWeaponPropMods(equipment, items, masteries, level)` : les `passiveMods` des propriétés
  utilisables des armes tenues en main. Ses **5 sites d'appel** sont ceux de `sumItemMods` :
  `data-state.jsx:141`, `pages-competences.jsx:524`, `pages-equip.jsx:161`, `pages-mj.jsx:15`,
  `pages-sheet.jsx:339`. Tous doivent la brancher, avec les maîtrises et le niveau effectif.
  ⚠️ En oublier un recrée le bug « buffs absents du Combat » du 2026-09-06 : une page afficherait
  un mana différent des autres. Côté MJ, `mjLive` doit donc lire `state/masteries`.

### 3.5 Règles RTDB

Le joueur a `.write` sur `characters/$charId` entier, et un `.write` hérité **ne peut pas être
retiré** plus bas. Le verrou passe donc par `.validate` :

```json
"masteries": { "$cat": { ".validate":
  "newData.isBoolean() && (data.val() === newData.val() || root.child('users').child(auth.uid).child('role').val() === 'mj' || root.child('users').child(auth.uid).child('role').val() === 'admin')" } }
```

- `.validate` n'est **pas évalué à la suppression** : un joueur peut effacer une de ses maîtrises. Ça
  ne nuit qu'à lui, c'est accepté.
- ⚠️ Vérifier qu'**aucune écriture côté joueur** ne réécrit `state` en entier (amorçage,
  import de sauvegarde) : ce serait refusé dès qu'il existe des maîtrises.
- Publier, puis **relire les règles en ligne** (`docs/archi/firebase.md`).

---

## 4. Moteur de l'attaque de base (pur, testé)

```js
weaponLoadout(equipment, inventory)
  → { attacker, off, hands:1|2, pair:'mini+mini'|'main+mini'|null, accessories[], issues[] }

basicAttackProfile(loadout, masteries, eff, choice)
  → { weaponCat, name, stat:'ad'|'ap', dmgType, power, ratio, mastered, malusPct,
      props:[{id, source}], reminders[] }
```

- `ratio` = 0,6 (mini seule) ou 1,0. **×0,75 si l'arme d'attaque n'est pas maîtrisée**, sauf
  mini-arme (4).
- `props` = les propriétés **utilisables** : celles de l'arme d'attaque si elle est maîtrisée, plus
  celles de la mini-arme tenue dans l'autre main (toujours utilisables). **Une seule est lancée par
  tour** : `choice.prop`, sinon la première de l'arme d'attaque.
- `stat`/`dmgType` : mode de l'arme ; hybride ou arc hextech → `choice.mode`, sinon le mode par défaut.
  Mode `damage:false` (cellules de Jett) → aucune instance de dégâts, une instance narrative.
- Composition **multiplicative** (`armes-maitrises.md`) : mode × ratio × maîtrise × propriété.
- `basicModeDamage` s'applique **par-dessus** ; hors mode `normal`, `props` est vidé (9).

Tests à écrire, au minimum : chaque ligne du tableau §3.4 ; la mini-arme non maîtrisée qui garde tout ;
le −25 % hors mini-arme ; un choix hybride qui bascule stat **et** type ; une arme en accessoire sans
stats ; le mana de Canalisation au niveau 2 (+70) et au niveau 18 (+230), **et à zéro sans
maîtrise** ; deux armes non mini refusées ; Poly + mini qui offre les deux propriétés au choix ; le mode
cellules sans dégâts ; le vidage des propriétés en mode réduit.

---

## 5. Propriétés

### Lot 2 — automatisées (instances, dés et cooldowns roulés au cast, résolus par le MJ)

| Propriété | Arme(s) | Mise en œuvre |
|---|---|---|
| **Duel** | Rapière, Baguette | ×1,25 si la cible = `weaponCombat.duelTarget`. Attaquer une autre cible déplace la marque ; une cible KO la perd. |
| **Attaque double** | Épée courte, Sarbacane | 2 instances à 65 %, cibles libres (`max:2`), sans CD. |
| **Balayage** | Claymore | jusqu'à 3 instances à 80 % ; `w_balayage` = pas deux tours d'affilée. |
| **Combo** | Gantelet renforcé | 25 % de relance, cumulable, roulé au cast → N instances. |
| **Quitte ou double** | Nunchaku, Sceptre | case à cocher ; 50 % → 130 % ; sinon 100 % + instance `damage` **sur soi** (8 % PV max, brut). |
| **Canalisation** | Bâton magique | case à cocher ; coût `5 % mana max` porté par l'**action** (remboursable) ; instance brute supplémentaire = 2 × ce mana. |
| **Focalisation** | Masse d'armes | bouton ; instance `status` +15 % du mana max ; `w_focalisation` CD 2. ⚠️ `applyStatusToCharacter` n'a qu'un `hpGain` : ajouter `manaGain`. |
| **Fourberie** | Dague | case « dans le dos » : +10 % crit et +20 % dégâts crit pour ce jet ; rappel +2 au jet. |
| **Plénitude** | Orbe | passif +5 % crit, +10 % dégâts crit (tant que la propriété est active) ; un crit ajoute une instance `manaGain` de 5 % du mana max. |
| **Concentration** | Arc court, Arc long, Fusil de précision, Arc hextech | désignation de `concTarget` → crit doublé (règle Aiguisage) contre cette cible ; changer de cible = 1 tour de rechargement. |
| **Connexion astrale** | Relique | d6 roulé au cast : 1 instance sur soi · 2 narratif « presciente au prochain tour » · 3 normal · 4 ×1,5 · 5 crit forcé · 6 deux instances. |
| **Purge** | Tronçonneuse hextech | case « la cible a un bouclier/buff » → instance narrative de retrait + `w_purge` CD 2 (10a) ; sinon, Purge prête → 110 %. |
| **Décimation** | Hache double | 1×/combat (`CD_LOCKED`) ; N instances à 50 % + une instance `heal` sur soi pré-remplie à la somme, que le MJ ajuste après mitigation. |

### Lot 3 — assistées (dé roulé par l'app, effet narratif) ou simples rappels

Débuffs sur cible, **hors périmètre mécanique** depuis le 2026-09-06 : l'app roule la chance et crée
une instance `status` **narrative** sur la cible ; le MJ applique l'effet à la main.

| Propriété | Mise en œuvre |
|---|---|
| **Assommage** | 10 % → « Étourdi (prochaine action) ». |
| **Brisage** | 50 % → « Brisé, −50 % armure, 2 tours » ; CD 3 (harmonisation du 2026-09-12). |
| **Frappe entravante** | 50 % → Ralentissement ou Affaiblissement (−50 % AD), 2 tours ; CD 3. |
| **Estropiaison** | 50 % → Saignement, 8 % PV max physiques/tour, 5 ticks max, 25 % d'arrêt par tick. |
| **Désarmement** | remplace les dégâts ; désarmement garanti + dé à 20 % de récupération ; rappel de la règle 10b ; `w_desarmement` CD 2. |
| **Parade/Riposte** | désignation d'**un** candidat par tour (`parryTarget`) ; bouton « activée » qui pose `w_parade` CD 3. |

**Rappels texte seulement** : Danse martiale, Iaido, Recul, Repositionnement, Projection défensive,
Attaque lente, Maniement risqué, Usage limité, Enchantement, Déchiffrage, Adaptation (le choix de type
est déjà couvert par le mode hybride), Invocation, tenue Poly (+2 au jet).
**Technologie hextech** : rien (10c). Prévoir seulement l'affichage d'un futur `item.passive` texte.

---

## 6. Contenu

### 6.1 Catalogue en base

⚠️ **Relire la base et comparer sur les NOMS avant toute écriture** (le catalogue contient du
contenu du MJ ; vécu le 2026-09-13). Patch JSON **rejouable** via `firebase database:update`.

- **Toutes les armes** : `weaponCat`, `mods` au palier de base (§2.1), `sub` normalisé
  `Tenue · portée · Propriété(s) · prix`.
- **Bâton magique** : `mods {ap:15}` seulement ; le mana (+50 + 10/niv.) vient de la propriété Canalisation, donc de la maîtrise (1b).
- **Hybrides** (Pistolet hextech, Tronçonneuse hextech, Disque énergétique, Lance-grenades hextech) :
  `{ad:10, ap:10}`.
- **Fusil de précision** : garder `it_ms2ivfvr_a` (**poids 5**), supprimer `it_mrpt9usb_1o` (poids 2).
- Bâton de combat, Hache double : écrire les `mods` manquants.
- Parchemin de combat : `type:'weapon'`, `weaponCat:'parchemins'`.
- Relique lunaire / solaire : deux entrées, même `weaponCat:'relique'`.
- **Ajouter** Rapière, Dague ; **ajouter** Arc hextech (il n'existe qu'en inventaire).
- **Explosifs** (5) : `cat:'Consommables'`, `type:''`, `mods` retirés.
- Aligner `ITEM_CATALOG` (data.jsx) sur la base.

### 6.2 Recalage des inventaires

Les copies distribuées ne suivent pas le catalogue : il faut les corriger **sur place, même id**, pour
que `equipment` reste valide.

| PJ | Objets | Changement |
|---|---|---|
| Rathaël | Claymore | `weaponCat:'claymore'`, +15 AD |
| Urskaar | Gantelet renforcé | `gantelet`, +15 AD |
| Smith | Dague (Loyauté) ×2 équipées | `dague`, +15 AD chacune → dual wield 60 % + 40 % |
| Smith | Épée longue (non identifiée) | `epee_longue` (bonus : attend l'identification) |
| Elias | Arbalète légère (principale), Hachette (secondaire) | `arbalete_legere` +15 AD, `hachette` +15 AD → cas Poly + mini |
| Elias | Dague simple (accessoire) | `dague`, `type:'weapon'` → **ne donne plus rien** en accessoire (5c) |
| Jett | Arc hextech | `arc_hextech`, `{ad:10, ap:10}` |
| Jett | Dague simple (accessoire) | idem Elias |

### 6.3 Maîtrises de départ (8)

| PJ | `masteries` |
|---|---|
| Rathaël | claymore |
| Urskaar | gantelet |
| Smith | dague, epee_longue |
| Elias | arbalete_legere, hachette, dague |
| Jett | arc_hextech, dague |

Les mini-armes sont inscrites **quand même** : ça ne coûte rien et ça reste juste si la règle 4 change.

### 6.4 À annoncer à la table

- **+5 de stat par arme** (+10 → +15) ; les hybrides passent de +5/+5 à **+10/+10**.
- **Elias et Jett perdent 10 AD** : la dague en accessoire ne compte plus.
- Elias attaque à l'arbalète tenue **à une main** (pas de +2 au jet), avec la Hachette en soutien.
- Jett : mode **cellules** par défaut, l'attaque ne fait plus de dégâts (conforme à son passif) ; le mode arc court reste disponible.
- Smith passe en dual wield à 60 % + 40 % : dégâts inchangés, **une seule** Fourberie active.
- La non-maîtrise (−25 %, perte des propriétés) existe désormais pour toute nouvelle arme ;
  formation à 120 ar (guide d'économie).

---

## 7. Plan de livraison

**Livraison 1 — l'arme pilote l'attaque de base (sans propriété)** — ✅ **codée le 2026-09-15** (`docs/journal/2026-09-15.md`)
1. `WEAPON_CATEGORIES`, `WEAPON_PROPERTIES`, `WEAPON_TIER_MODS` + tests.
2. `weaponCat` sur l'item (sites du §3.2) + tests de fusion et de transfert.
3. `weaponLoadout`, `basicAttackProfile`, `sumItemMods` (accessoires exclus), `sumWeaponPropMods` branchée aux 5 sites + tests (§4).
4. Règles d'emplacement, échange rapide, mini-armes en accessoire (`pages-equip.jsx`).
5. `state/masteries` : règle `.validate` publiée et relue ; cases staff (onglet Progression ou fiche) ;
   lecture seule pour le joueur.
6. Carte « Attaque de base » : nom de l'arme, maîtrise/malus, sélecteur de mode hybride
   (`weaponChoice.mode`), type de dégâts transmis, ratio mini / dual ; carte MJ enrichie.
7. Contenu : catalogue (§6.1), inventaires (§6.2), maîtrises (§6.3).
8. Retrait de `WEAPONS`, `weaponTypeOf` par nom, `char.weaponId` / `weaponIds`.
9. Banc d'essai de la page Combat (vraie couche d'état sur faux RTDB), smoke, `esbuild`, jeton de cache.
10. Docs : `docs/archi/combat.md`, `modele-donnees.md`, `inventaire-poids-monnaie.md`, journal, CLAUDE.md.

**Livraison 2 — propriétés automatisées** (lot 2, §5) : `weaponChoice.prop`, `weaponCombat`,
cooldowns `w_*`, `manaGain` dans `applyStatusToCharacter`, `resetCombat` étendu. Tests par propriété
avec `rng` injecté.

**Livraison 3 — propriétés assistées et rappels** (lot 3, §5).

---

## 8. Hors périmètre

- Technologie hextech (passifs d'arme sur mesure, 10c).
- Maîtrise qui progresse à l'usage.
- Déplacement, attaques d'opportunité, géométrie (Danse martiale, Iaido, Recul…) : rappels seulement.
- Débuffs mécaniques sur cible (armure réellement réduite, étourdissement bloquant) : narratifs.
- Système marchand et champ `price`.
- Explosifs comme mécanique de combat : consommables gérés en table.

---

## 9. Questions tranchées (2e passe du MJ, 2026-09-14)

Toutes les questions de la première version sont résolues ; les réponses sont intégrées au §2.

| Question | Réponse | Où |
|---|---|---|
| Crit plat sur certaines armes ? | **Non** pour l'instant | 1 |
| Poly/1H + mini : cumul des propriétés ? | **Jamais dans le même tour** ; choix entre les deux | 5a' |
| Deux armes non mini ? | **Interdit** (ouverture possible en fin de partie) | 5a'' |
| Arc hextech, mode cellules | **Aucun dégât** ; mode arc court physique ; **+10/+10** | 7 |
| CD du Désarmement | **2 tours**, le document MJ fait foi | 10b |
| Poids du fusil de précision | **5** | 6.1 |
| Mana du bâton sans maîtrise ? | **Non** : bonus de la propriété | 1b |
| Orbe mini-arme ? | **Non** | 8b |

✅ **Bonus permanents (confirmé par le MJ le 2026-09-15)** : le bonus passif d'une propriété (mana de
Canalisation, crit de Plénitude) est donné **en permanence dès que l'arme est maîtrisée**, quelle que
soit la propriété lancée ce tour. C'est une **statistique d'arme que seule la maîtrise débloque**. La
règle « une seule propriété par tour » ne vise que les effets **lancés**.
