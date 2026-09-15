# Modèle de données Firebase (détaillé)

Version complète et commentée, déplacée depuis `CLAUDE.md` le 2026-09-11 (limite de taille), texte
inchangé. `CLAUDE.md` n'en garde que la forme des nœuds ; **ce fichier fait foi** pour le sens de
chaque champ (défauts quand absent, drapeaux MJ, contrat des actions en attente).

```
/campaign/runeterra/characters/{charId}/state/
    hpCur, manaCur, shield (valeurs ABSOLUES), fatigue (0-5), eau (0-5)
    xp:        0   ← progression DANS le niveau courant (entier ≥ 0, < xpToNext(level)) ; via addXp ; montée auto → level
    buffs:     { [buffId]: true }
    modifiers: { hp, mana, ad, ap, armure, resmag, crit, dcrit, rescrit, letha, lethaMag, sapience, vol, omni }
               ↑ liste unique `MOD_STATS` (components.jsx), partagée éditeur d'item + panneau Modificateurs MJ
               letha = léthalité PHYSIQUE (réduit l'armure) ; lethaMag = léthalité MAGIQUE (réduit la rés. mag.)
               sapience/vol/omni sont des POURCENTAGES (cf. lifestealHeal), pas des valeurs plates
    inventory: { [itemId]: { id, cat, name, sub, qty, ic, img, type, mods, weight, carry, carryGroup, armorClass, weaponCat, order } }
               ↑ weaponCat = id de WEAPON_CATEGORIES (game-logic) ; '' / absent = pas une arme OU arme neutre   ← perso, éditable (order = rangement manuel, cf. planReorder)
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
    masteries:   { [weaponCat]: true }   ← maîtrises d'armes (2026-09-15) ; écriture STAFF (`.validate`), via setMastery ;
                     ABSENT = aucune maîtrise → −25 % et aucune propriété sur toute arme non mini catégorisée
    weaponChoice: { mode, propSource }   ← mode d'arme choisi par le joueur (hybride 'ad'|'ap', arc hextech 'cellules'|'ad') ;
                     ABSENT = mode par défaut de la catégorie (1er de `modes`)
                     propSource ∈ 'attacker'|'support' = l'arme dont les propriétés jouent ce tour (deux armes en main) ;
                     ABSENT = l'arme d'attaque si elle a une propriété, sinon la mini-arme (weaponActiveSource)
    weaponCombat: { duelTarget, concTarget, parry:{ target, round }, combo:{ round, chain } }   ← cibles désignées par Duel /
                     Concentration (livraison 2), candidat de Parade du tour (livraison 3), relance de Combo en attente
                     (chain = n° de la relance à jouer ; consommée par le coup suivant ; ignorée hors de son tour) ;
                     écrit par le JOUEUR au cast (état de l'arme, pas un effet) ; effacé par « ⟲ Combat » ;
                     ⚠️ n'est PAS remboursé si le MJ annule l'attaque (assumé : la désignation a eu lieu)
    counters:  { [key]: n }   ← compteurs de compétences (chasseur/marques/tranches/cn…), steppers manuels
    cooldowns: { [skillId]: readyAtTurn }   ← cooldown = n° de tour de disponibilité (999999 = 1×/combat)
                     + clés `w_<propriété>` pour les propriétés d'arme (w_balayage, w_purge, w_decimation,
                     w_concentration, w_focalisation) — même contrat, même purge par « ⟲ Combat »
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
    weaponCat, weaponName, mastered   ← attaque de base seulement (2026-09-15) : l'arme du coup et son malus éventuel
    cost: { mana, manaPer, manaMax, cdPrev, cdKey }   ← le coût appartient à l'ACTION, pas à l'instance : N cibles = un seul mana et un seul cooldown
                                                  cdKey = clé du cooldown à rendre quand elle n'est pas `skillId` (propriété d'arme : `w_balayage`…)
                                                  cdPrev = cooldown d'AVANT le cast (absent = la comp était prête, Firebase efface les null)
                                                  manaPer = mana facturé PAR CIBLE (0 partout aujourd'hui ; c'est la seule raison de rembourser une instance isolée)
    appliedCount: 0   ← SEUL champ muté après création ; dès qu'il dépasse 0 plus RIEN n'est jamais remboursé (la comp a eu lieu)
    instances: { {instId}: { id, seq, kind:'damage'|'heal'|'status', targetId, label, … } }
        targetId = un PNJ (`combat/enemies`) OU un PJ (`charId`) ; pour un `status` c'est le lanceur lui-même
        kind 'damage' : computedDmg, critDmg, didCrit, critMult, type, letha, lethaMag, crit, dcrit, vol, sapience, omni, hpMax, modeId
        kind 'heal'   : amount
        kind 'status' : mods, until, shield, counters, transformUntil, hpGain, hpMax, manaGain, manaMax — ou narrative:true (effet en table, « Valider » n'écrit rien)
        cdKey, cdPrev (instance status d'un débuff d'arme, livraison 3) : rechargement rendu si le MJ retire CETTE ligne
        label (toute instance, optionnel) : ce que l'instance représente (« Balayage 80 % », « d6 = 4 : améliorée 150 % »), affiché sur la carte du MJ
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
