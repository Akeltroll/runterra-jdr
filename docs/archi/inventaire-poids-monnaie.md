# Inventaire, poids, monnaie et catalogue

Détail de la « Carte des fichiers », déplacé depuis `CLAUDE.md` le 2026-09-11 (limite de taille),
texte inchangé. Les renvois « voir Décisions » / « Infos MJ » visent les sections de `CLAUDE.md` ;
« État actuel AAAA-MM-JJ » vise `docs/journal/AAAA-MM-JJ.md`.

## `game-logic.js` — poids porté, coffre commun, attelage, monnaie

  saisie d'XP erronée). **Poids porté** : `carriedWeight(items, mental, equipment, coins)` (Σ `weight×qty`,
  armure du slot `armure` allégée par le Mental, **+ le poids de la bourse** si `coins` est fourni — 4e param
  optionnel, les appels sans lui sont inchangés), `carryCapacity(force, mental, level, equipment, itemsById)`
  (= `CARRY_BASE`(**30**) + `force×CARRY_PER_FORCE`(5) + **`mental×niveau÷10`** + Σ `item.carry` des items
  équipés, arrondi inférieur — **la ceinture = un item avec `carry`**), `comfortPct(hab)` (seuil de confort
  = 60 % + Hab×2 %, plafond 90 %), `weightStatus(carried, cap, hab)` (`{pct, over, comfort, comfortPct,
  state}` où `state` ∈ `leger`/`encombre`/`surcharge` ; affichage seul, le MJ arbitre la surcharge),
  `ARMOR_CLASSES`/`armorWeightReduction`/`armorEffectiveWeight`. Items : champs `weight` (poids unitaire)
  + `carry` (bonus de capacité **personnelle**, canal `p` — objet équipé, réservé à `cat==='Équipement'`)
  + **`carryGroup`** (bonus de capacité du **groupe**, canal `g` — **toutes catégories**) + `armorClass`.
  **Capacité COMMUNE du coffre** : `carryBaseRaw(force, mental, level)` (terme brut non arrondi, sans
  bonus — partagé avec `carryCapacity`), `groupCarryBase(profiles)` (Σ brute, **conforme au doc MJ**),
  `GROUP_CARRY_RATIO` (0,30 — écart assumé : `docs/journal/2026-08-21.md`),
  `groupCarryCapacity(profiles, bonusGroup)` (⌊Σ×ratio + attelage⌋, arrondi **une seule fois à la fin** :
  ⌊74,34⌋ = 74 et non 73), `groupComfortPct(profiles)` (moyenne des conforts individuels),
  `weightStatusPct(carried, cap, pct)` (seuil donné en fraction). **Attelage** : `TRANSPORT_SLOTS`
  (2 montures + 3 sacs), `transportAccepts(slot, item)` (exige `carryGroup > 0` ; respecte le `type`
  `mount`/`pack` **sauf pour un objet non typé, qui passe partout** — le champ « Emplacement » n'existe
  que pour `cat==='Équipement'`, un sac en Butin ne PEUT pas être typé), `sumTransportCarry(transport,
  items)` (Σ des objets attelés, dédoublonné, par pile).
  **Poids de la monnaie** (guide d'économie §3, livré le 2026-08-21) : `COIN_PER_WEIGHT`
  (pièces pour 1 unité de poids — cuiv 200 / arg 100 / **or 67** / plat 200) + `coinsWeight(coins)`.
  ⚠️ Barème **non monotone avec la valeur, et c'est voulu** : l'**or est la plus LOURDE**, le **platine la
  plus LÉGÈRE** — ne pas « corriger » l'ordre. Valeur **exacte, jamais arrondie** en interne (décision MJ :
  199 cuivres pèsent 0,995 et non 0) ; l'arrondi à 1 décimale est purement d'affichage (`invWeightFmt`,
  components.jsx). Branché sur les 2 jauges de charge (Équipement, Admin) + le pied de `InventoryGrid`
  (« ⚖ N » à côté des pièces → visible sur fiche, coffre commun et Équipement).
  **Monnaie** : `COIN_VALUE` (valeurs en cuivre : cuiv 1 / arg 100 / or 10 000 / plat 100 000 — soit
  100 cuivre = 1 argent, 100 argent = 1 or, 10 or = 1 platine, cf. `info-mj/Économie - guide des joueurs.md`)
  + **journal d'économie** (textes purs, testés) : `COIN_NAME`, `coinsAmountText(coins)` (« 2 or, 15 cuivre »),
  `coinsDeltaText(before, after)` (« +2 or, −15 cuivre » ; `after` peut être un patch PARTIEL, clé absente =
  inchangée), `coinsDeltaValue(before, after)` (valeur nette en cuivre → couleur de l'entrée ; **0 = change de
  monnaie compensé**) + `LOG_MAX`(30)/`staleLogIds(map, max)` (ids des entrées à élaguer, les plus anciennes).
  **Contrat de la règle RTDB `state/coins/$coin`** (entier >= 0) porté côté code par `coinInt(v)` (utilisé
  par `buildDefaultState`) et `sanitizeCampaignCoins(data)` (assainit une sauvegarde importée, MUTE `data`,
  rend le nombre de corrections) — les deux écritures qui portent **tout un sous-arbre d'un coup**
  + `planCoinConvert(coins, from, to, n)` (pur, testé : conversion **dans les deux sens** ; vers le bas =
  exact, vers le haut = seuls les multiples entiers passent et **le reste est laissé dans la bourse**,
  jamais arrondi ni perdu ; `n` borné au solde ; renvoie `null` si rien n'est convertible).

## `game-logic.js` — items, piles, consommables, breakdown, carrousel

- `game-logic.js` — aussi : `makeItem`/`newItemId` (modèle d'item, avec `type`) ; `EQUIP_TYPES`
  (liste des emplacements) ; `planItemTransfer(srcItems,dstItems,itemId,n)` (logique pure de
  transfert/fusion → `{srcPatch,dstPatch}`, crédite la destination via `fillStacks`) ;
  `STACK_MAX` (=99) + `fillStacks(items,entry,qty)` (remplit les piles existantes de même genre
  jusqu'à 99 puis crée de nouvelles piles pour le surplus → patch `{itemId:item}`) +
  `planItemAdd(items,entry,qty)` (`{patch}`, ajout depuis le catalogue) ;
  `buildDefaultState` amorce `inventory` depuis `char.inv` et `coins` depuis `char.coins`.
  **`parseConsumableEffect(item)`** (lit « Rend X + Y% HP/Mana » ou repli par nom → `{kind,flat,pct}|null` ;
  partagé fiche + Équipement). **`statBreakdown(base, modifiers, buffs, stuffMods)`** → `{[stat]:{effective,
  base, buff, mod, stuff}}` (décompose chaque stat effective par source via recomposition de `computeEffective` ;
  `base+buff+mod+stuff = effectif` ; alimente l'affichage breakdown de la fiche).
  **`carouselTransforms(count, activeIndex)`** → tableau `{offset, translateX, translateY, scale, opacity, zIndex}`
  (slider horizontal plat du hub : carte active centrée/agrandie, voisines décalées/atténuées, wrap circulaire).

## `data.jsx` — règles immuables et `ITEM_CATALOG`

- `data.jsx` — règles immuables : `CHARACTERS` (avec `inv`
  par défaut + images `ATH/`), `BUFFS`, `LEVELS` (caps §3, cap PJ 20), `ATTRIBUTES`, `RUNE`, `JOURNAL`,
  `ITEM_CATALOG` (catalogue d'items pré-enregistrés pour l'ajout staff : `{cat,name,sub,ic,img,type}`
  + `armorClass`/`weight`/`mods` sur les **18 armures de base** ajoutées le 2026-09-07, et `weaponCat` sur
  les armes depuis le 2026-09-15). ⚠️ **`WEAPONS` a été RETIRÉ le 2026-09-15** (avec `char.weaponId`/`weaponIds`) :
  la catégorie d'une arme est son champ `item.weaponCat`, référentiel `WEAPON_CATEGORIES` dans `game-logic.js`
  (voir `docs/archi/combat.md`). Ne pas réintroduire de rapprochement par NOM.
  ⚠️ **`ITEM_CATALOG` n'est qu'un FILET D'AMORÇAGE, pas la source de vérité du catalogue en jeu** :
  `useItemCatalog` fait `catalogArray(map, !!inited, ITEM_CATALOG)` — dès que `campaign/runeterra/catalogInit`
  est vrai (c'est le cas depuis longtemps), le tableau de `data.jsx` **n'est plus jamais lu**. Ajouter un objet
  au jeu = écrire dans **Firebase** (page Admin, ou `firebase database:update`), pas éditer `data.jsx`.
  Éditer les deux reste souhaitable pour qu'un ré-amorçage futur parte juste.
  `mkChar` attache `attrs` + `modifiers` (ne bake **plus** `stats` : calcul live via `charBaseStats`,
  voir `game-logic.js`). (`ATTACK_MODES` **retiré** — voir Décisions.) Aussi : `char.bio` (description courte
  par perso, affichée au hub) ; **`PORTRAITS`** (`{charId: 'ATH/Perso/X.webp'}`, partagé hub + Équipement) ;
  **`MEMORIAL`** (`[{name,player,img,fell,epitaph,tale}]`, persos morts du hub — Lunick).

## `data-state.jsx` — hooks d'état, XP, bourses

- `data-state.jsx` — hooks temps réel : `useCharState` (+ setters inventaire
  `setInvItem`/`removeInvItem` + équipement `setEquipment` + monnaie `setCoin`), `useAllCharStates`,
  `useSharedInventory` (inventaire commun), `useSharedCoins` (monnaie commune), `useAuthIdentity`
  (identité + `/users/{uid}`, auto-inscription), `useAllUsers`, `setUserAssignment`,
  `seedIfEmpty(role)` (réservé staff). Compétences : `setCounter`/`setCooldown`/**`setSkillBuff`** (sur
  `useCharState` ; `setSkillBuff(skillId, mods, until)` = buff sur soi, snapshot de mods plats +
  durée optionnelle (`until` = n° de tour de fin ; null = permanent jusqu'au ⟲ Combat).
  **XP** : orchestrateur `addXp(charId, gain)` (async, écriture staff : `getSnapshot`→`applyXp`→écrit
  `{level, xp}`, `pushLog` au level-up, retourne `{level, xp, levelsGained}` pour le toast appelant) +
  miroir `removeXp(charId, loss)` (async, écriture staff : `getSnapshot`→`applyXpLoss`→écrit `{level, xp}`,
  retourne `{levelsLost}` — corrige une saisie d'XP erronée ; bouton « −XP » côté MJ) ;
  `grantCoins(charId, patch)` (don additif d'argent : `getSnapshot`→ajoute `{plat,or,arg,cuiv}`→écrit ; récompense de séance) ;
  **`setCharCoins(charId, patch)` / `setSharedCoins(patch)`** (écriture LIBRE d'une bourse : valeurs **absolues**
  clampées ≥ 0, merge par dénomination via `writeCoins` — c'est la seule voie qui permet de **retirer** des pièces ;
  alimente l'éditeur MJ `CoinEditor`). `COIN_KEYS` = les 4 dénominations (source unique).

## `data-state.jsx` — journal d'économie et orchestrateurs de transfert

  (`combat/log`, ~30 derniers). **Journal d'économie SÉPARÉ** (`ECONOMY_LOG` = `campaign/runeterra/economyLog`) :
  `pushEconomyLog(text,kind)` + `useEconomyLog()` (lecture **staff only**, **jamais purgé par « ⟲ Combat »**,
  élagage à `LOG_MAX` via `staleLogIds` fait **à la lecture côté staff** — les joueurs n'ont que le droit
  d'écrire) + `purseName(path)` (nom lisible d'une bourse depuis son chemin RTDB).
  **Les 3 orchestrateurs de pièces journalisent** : `moveCoins` (transfert, `gold` — le seul déclenché par
  les **joueurs**, donc le plus important), `grantCoins` (récompense, `buff`), `writeCoins` (**devenu async** :
  `getSnapshot` préalable pour calculer le delta d'une édition MJ ; couleur selon `coinsDeltaValue`).
  ⚠️ Les deux `setCoin` morts (jamais branchés à une UI) ont été **supprimés** — plus aucune voie d'écriture
  de pièces non journalisée. Orchestrateurs de transfert RTDB `moveItem` (via `planItemTransfer`) /
  `moveCoins` (via `planCoinMove`) — **tous deux `async` et relisant les DEUX côtés via `getSnapshot`** :
  ils **ignorent** l'état passé en paramètre (cf. bug de bourse écrasée, `docs/journal/2026-08-21.md`). Constantes `CAMPAIGN = 'campaign/runeterra'`, `SHARED_INV`, `SHARED_COINS`, `COMBAT_TURN`,
  `ENEMIES`, `PENDING_HITS`, `COMBAT_LOG`.

## `components.jsx` — UI partagée (inventaire, bourses, infobulles)

- `components.jsx` — UI partagée : `Avatar`, `ResourceBar`, **`XpBar`** (barre d'XP lecture seule :
  `xp/xpToNext(level)` + label niveau), `BuffBadge`, **`ConsumablesRow`** (rangée de potions
  utilisables, **partagée fiche + onglet Combat** : filtre `cat:'Consommables'` qty>0 à effet parsable,
  applique le gain [`applyHealMods` pour les PV] et décrémente la pile ; `setHp`/`setMana` acceptent
  une valeur **ou un updater**, c'est ce qui la rend branchable des deux côtés sans variante), toasts
  (`renderToastMsg` = rendu sûr, seul `<b>` autorisé), **`CombatLog`** (journal de combat
  partagé lecture seule, lit `useCombatLog` ; prop `canClear` = bouton « Vider » staff), `LoginScreen`,
  `PendingScreen`, `SignOutButton`, `NumberStepper`, `ExportImportPanel` (import **assaini**
  via `sanitizeCampaignCoins` + **try/catch avec toast d'erreur** — sans lui un rejet de règle
  échouait en silence),
  `InvItemRow` + `InventoryPanel` (inventaire éditable réutilisable). L'éditeur
  `InvItemRow` permet de **téléverser une image** (`downscaleImageToDataURL`, max 128px,
  webp/png) stockée en **data URL** dans `item.img` — pas besoin d'un chemin `ATH/` ni
  d'accès au code (le champ chemin reste dispo en fallback). `InvItemRow` gère aussi
  **Catégorie + Emplacement** (`type`, affiché si `cat==='Équipement'`) et le prop `startEdit`
  (ouverture directe en mode édition, pour les modals). `InventoryPanel` a un prop optionnel
  `onAdd(cat)` : si fourni, « + Ajouter » délègue au parent (ouvre le picker) ; sinon ajout vierge.
  Grille dark-fantasy partagée `InventoryGrid` (Équipement + coffre commun **+ fiche joueur** ; badge quantité
  en **OR** ; props `minCells` [plancher de cases, défaut 49 ; 14 sur la fiche] + `grow` [s'étend avec le
  contenu au lieu de scroller, pour la fiche]). **Rangement manuel** : les items sont triés par `item.order`
  (les items sans `order` restent à la suite) ; prop `onReorderItem(draggedId, targetId)` = drag & drop d'un
  item sur une case (item = insérer avant lui ; case vide = envoyer en fin) → `planReorder` (game-logic, pur,
  testé) réindexe 0..n-1 et persiste l'`order` (fiche : tous ; coffre commun : staff ; Équipement : staff/joueur).
  Le drag des items de la grille porte un marqueur `x-inv-reorder` ; les cases ne réclament le drop **que** s'il
  est présent — un item glissé depuis un slot d'équipement (non marqué) remonte au conteneur `onDropItem`
  (déséquiper), donc réorganisation et drag-vers-slot coexistent.
  **`ItemTooltip`** = infobulle d'objet partagée (nom, description, classe d'armure, bonus de stats, poids) ;
  `InventoryGrid` gère son propre survol et l'affiche → **fiche joueur, coffre commun et grille Équipement
  l'ont automatiquement**. Elle sert aussi aux **slots du paperdoll** (`pages-equip.jsx`), seul endroit qui lui
  passe `effWeight` : les 3 grilles excluent déjà les objets équipés, donc le poids de base y est toujours bon.
  **`invWeightLabel(item, effUnit)`** = libellé de poids (unitaire, ou `unitaire × qty = total` pour une pile ;
  `null` si l'objet ne pèse rien ; `(base N)` en vert si allégé par le Mental).
  Popovers `ItemActionMenu` / `AmountStepper` ; **`CoinEditor`** (modal d'édition de bourse réservé au MJ :
  les 4 dénominations en **valeur absolue** pré-remplie + delta coloré par ligne + « Tout à 0 » ; `onApply` ne
  reçoit que les dénominations modifiées → `setCharCoins`/`setSharedCoins` ; contient aussi le **change de
  monnaie** — `planCoinConvert` appliqué au **brouillon**, donc prévisualisé dans les champs, annulable, et
  écrit en une seule fois au « Appliquer ») ; `INV_COINS` = **source unique** des 4 monnaies (libellé, image,
  couleur), `invCoin(key)` + **`CoinIcon`** (pastille partagée grille/éditeur/cartes MJ) ;
  **`ItemCatalogPicker`** (modal de sélection rapide
  depuis `ITEM_CATALOG` → `AmountStepper` → `onPick(entry,qty)` ; bouton « Objet personnalisé » = filet) ;
  constantes `INV_*`/`inv*` (styles/format/filtres/pièces).

## `pages-sheet.jsx` — fiche joueur

- `pages-sheet.jsx` — fiche joueur **refondue (layout B, 3 colonnes thématiques, largeurs égales** via
  `repeat(3,minmax(300px,1fr))`** ; un seul style — le sélecteur 3-styles `variant` a été RETIRÉ).
  Col 1 = **Vitalité** (`ResourceStack`) + **Survie** (`SurvivePanel` Fatigue/Eau) + **Consommables**
  (`HealPanel`) ; col 2 = **Statistiques** (`SecondaryStats`) + **Arme équipée** (`WeaponPanel`, info seule) +
  **Effets actifs** (`BuffsPanel`) ; col 3 = **Inventaire** (`FicheInventoryColumn` → `InventoryGrid`
  adaptatif, `minCells=14`/`grow`, clic → menu Utiliser/Éditer/Supprimer + `ItemCatalogPicker`) + (staff)
  **Modificateurs** (`ModifiersPanel`). **Stats en breakdown** : `SecondaryStats` affiche la valeur effective +
  le **bonus total en couleur** (`+N` vert/rouge) + le détail des sources (`base · +X buff · +Y mod · +Z stuff`),
  alimenté par `statBreakdown` (game-logic, pur, testé ; `base+buff+mod+stuff = effectif`, deltas marginaux
  honnêtes). **Consommables = vraies potions de l'inventaire** (`HealPanel` → **`ConsumablesRow`**, composant
  **partagé avec l'onglet Combat** (components.jsx) : items `cat:'Consommables'` qty>0
  + effet parsable via `parseConsumableEffect` ; clic consomme une unité [valeur réelle = `flat + pct% du max
  effectif`], décrémente/supprime à 0 ; **plus de potion → bouton masqué** ; fini les boutons potion infinis en dur).
  **Outils d'ajustement libres réservés au MJ** (`isStaff` : Soigner/Dégâts/Mana/Bouclier d'un montant + ↺ max ;
  les joueurs ne peuvent plus tricher). Jauge **bouclier à max dynamique** (`max(shieldMax, bouclier)`).
  Inventaire perso temps réel (migration unique `invInit`). **Panneau « Arme équipée »** (2026-09-15) = le
  PROFIL d'attaque de base (`basicAttackProfile` sur `weaponLoadout`, même calcul que l'onglet Combat) : arme en
  main, catégorie, maîtrise, dégâts estimés, propriétés, et le bloc **Maîtrises d'armes** (`MasteryEditor`,
  éditable par le staff seulement → `setMastery`). Bourse **live** (dans le pied
  de `InventoryGrid`). **HealPanel plafonne sur les stats EFFECTIVES** (`eff.hp`/`eff.mana`).

## `pages-admin.jsx` — page Admin

- `pages-admin.jsx` — page Admin (staff) : attribution rôle + perso par compte (`AdminUserRow`),
  **gestion de l'inventaire par perso** (`CharInventoryAdminPanel` : sélecteur de perso →
  `useCharState` → `InventoryPanel` éditable + `ItemCatalogPicker`/`planItemAdd`, ajout/édition/
  suppression directe en BDD + jauge de poids) et **CRUD du catalogue partagé** (`CatalogAdminPanel`,
  `useItemCatalog`).

## `pages-inventory.jsx` — coffre commun

- `pages-inventory.jsx` — page **Inventaire commun** (`CommonInventoryPage`, coffre partagé) :
  rendu en **grille partagée** (`InventoryGrid`). Clic item → `ItemActionMenu` (Prendre / Éditer /
  Supprimer) ; clic pièce → retrait. **Transferts commun → perso** via `moveItem`/`moveCoins` :
  joueur = sa propre fiche, **MJ/admin = choix du destinataire** (picker sur `CHARACTERS`).
  Pile qty>1 → `AmountStepper` (montant), qty=1 → direct.
  **Jauge de charge du coffre** (`CommonWeightBar`) : capacité = Σ des capacités des 5 persos
  (`useGroupCarry`→`groupCarryCapacity`) + attelage, confort = moyenne (`groupComfortPct`), poids =
  `carriedWeight(items, 0, {}, sharedCoins)` — **appelé sans `equipment`** : le coffre n'a pas de porteur,
  donc pas de réduction Mental sur l'armure (§7 du doc). **`TransportRack`** = les 5 emplacements
  d'attelage (glisser-déposer depuis la grille, ou clic → liste des objets éligibles ; clic sur un slot
  occupé = dételer), persistés dans `sharedTransport`.

## `pages-equip.jsx` — page Équipement

- `pages-equip.jsx` — page **Équipement** (`EquipPage`/`EquipBody`) : paperdoll dark-fantasy
  recréé du design Claude. 3 colonnes (slots+stats / portrait `ATH/Perso/` imposant / inventaire
  live via `InventoryGrid`), drag & drop inventaire ↔ slots + double-clic, tooltip, HUD bas
  (niveau/PV/mana/nom), **monnaie vivante** (`state.coins`, repli `char.coins` ; migration `coinsInit`).
  **Équipement persisté temps réel** (`state/equipment` = `{slotKey: itemId}`, via `setEquipment`).
  Bonus d'items via `item.mods` **branchés sur `computeEffective`** (`sumItemMods` somme les
  items équipés → 4e param, même étage que les modificateurs ; cases « Bonus de stats » dans
  l'éditeur d'item) ; stat boostée affichée en vert.
  **Jauge de poids** (poids porté / capacité `carriedWeight`/`carryCapacity`, rouge si surcharge).
  `EQUIP_SLOTS` = **12 slots** : les 4 pièces d'armure (épaule/cuirasse/gants/pantalon) ont été
  **fusionnées en un slot unique « Armure »** (`accepts` shoulders/chest/gloves/pants ; migration unique
  `armureInit` qui transfère l'ancien équipement vers le slot fusionné) ; un slot **« Ceinture »** porte
  la ceinture (item `carry` → capacité de charge). `equipTypeForItem` lit `item.type` en priorité (sinon infère :
  **dague→accessory** (choix MJ), autre arme→weapon, autre Équipement→accessory). Clic item →
  `ItemActionMenu` : Équiper / Utiliser (consommable) / **Envoyer au commun** (`moveItem` → `sharedInventory`,
  pile qty>1 = `AmountStepper`) / Éditer (`InvItemRow` en modal) / Supprimer ; clic pièce → dépôt au
  commun (`moveCoins`). **Consommables** : « Utiliser » (`parseConsumableEffect` lit « Rend X + Y% HP/Mana »
  dans le `sub`) → décrémente la qty, **supprime l'item à 0**, applique l'effet temps réel (PV via
  `applyHealMods`, mana brut). Items à qty 0 masqués.
