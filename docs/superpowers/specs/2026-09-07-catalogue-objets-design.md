# Catalogue d'objets — armures de base, et remise à niveau du contenu — Reprise

*Ouvert le 2026-09-07. Ce document est le **point de reprise** du chantier « remplir le catalogue
d'objets ». Il contient l'état livré, l'étape qui reste à exécuter, et les trois divergences de
contenu relevées au passage. Il ne redéfinit aucune mécanique : le modèle d'item est figé depuis
le 2026-08-21, ce chantier ne fait que le **remplir**.*

---

## 1. Ce qui a déclenché le chantier

Le catalogue partagé ne contenait **aucune armure** — 9 entrées `Équipement`, toutes des armes,
sans `weight`, sans `mods`, sans `armorClass`. Or l'alerte du 2026-09-04, aggravée le 2026-09-06
par la spécialisation Force/Magie, dit que **les PJ encaissent à nu** : leur armure de socle est
tombée à 6-9 au niveau 2, et le pari du calibrage était explicitement que « les armures
d'équipement prennent le relais ». Elles n'existaient pas.

---

## 2. La source de vérité retrouvée

`info-mj/SPECIFICATION - Système refondu.md` **§7.2** — le fichier était absent de la machine du
MJ (il traînait dans `Downloads`), il est désormais dans `info-mj/`.

⚠️ **6 des 8 fichiers `info-mj/` que CLAUDE.md référence n'étaient pas sur cette machine.** Le
dossier est gitignoré (dépôt public) : rien ne le synchronise entre les postes du MJ et de
l'admin. Restent manquants ici : `Compétences-Races PJ (mis à jour).md`, `Système de Runes.md`,
`Nouveau système de gestion des attaques de base (2).md`, `Codes App Script.md`, `tableau_XP.png`.
**Les rapatrier avant tout chantier qui en dépend** — le rééquilibrage des compétences a besoin du
premier, le chantier « attaques de base » du troisième.

### Ce que le §7.2 donne

3 classes × 6 profils = **18 armures de base**. 3 spécialisations pures (PV / Armure / RM) et
3 combinaisons (Arm+RM / PV+Arm / PV+RM).

| Profil | Légère | Intermédiaire | Lourde |
|---|---|---|---|
| PV pur | Veste matelassée · 50 PV | Plastron de cuir bouilli · 100 PV | Cuirasse de colosse · 150 PV |
| Armure pure | Armure d'étoffe · 7 Arm | Cotte de mailles · 15 Arm | Harnois de plates · 25 Arm |
| RM pure | Cape du néant · 7 RM | Manteau de négatron · 15 RM | Drapé d'antimagie · 25 RM |
| Arm + RM | Cape doublée · 3/3 | Harnois composite · 6/6 | Garde-corps runique · 10/10 |
| PV + Arm | Gambison clouté · 20 PV + 3 Arm | Brigandine renforcée · 40 + 6 | Mailles du gardien · 60 + 10 |
| PV + RM | Tenue de l'initié · 20 PV + 3 RM | Robe runique · 40 + 6 | Cuirasse du templier · 60 + 10 |

Malus de classe (§7.2) : Intermédiaire **−1 déplacement** ; Lourde **−1 déplacement, −1 initiative,
malus aux tests d'Habileté** (jets d'action d20, **pas** la statistique de crit).

Croisements avec les autres sources :
- **Poids** = `ARMOR_CLASSES` (game-logic.js) : 4 / 10 / 20. Les 3 classes de la spec correspondent
  exactement aux 3 classes du code — aucune conversion.
- **Prix** = guide d'économie §9.1, palier de base : 13 / 20 / 32 ar (identique quel que soit le profil,
  le guide ne tarife que par classe).

---

## 3. Les deux arbitrages du MJ (2026-09-07)

**Prix → dans la description (`sub`), pas de champ dédié.** Le modèle d'item n'a **aucun champ de
prix** et n'en gagne pas ici. Format retenu :
`Lourde · 32 ar · +25 Armure · −1 dépl., −1 init., malus Hab.`
Conséquence assumée : le prix est du **texte**, non calculable — pas de revente automatique, pas de
marchand. Si un système marchand arrive un jour, c'est là qu'il faudra un vrai champ `price`
(13e champ : `makeItem` + éditeur + les **4 sites de copie** `planItemTransfer` / `fillStacks` /
`buildCatalogSeed`).

**Malus de classe → en clair dans la description, arbitrés à la table.** Rien n'est automatisé.
⚠️ Le `−1 initiative` **aurait pu** l'être (`initiative/scores/$id/bonus` existe) : c'est
délibérément écarté. Ce `bonus` est aujourd'hui 100 % manuel côté MJ, et le dériver de l'armure
équipée mêlerait une source automatique à une source manuelle dans le même champ, sans que rien ne
dise laquelle a écrit quoi.

---

## 4. Livré

- **`data.jsx`** : 18 entrées ajoutées à `ITEM_CATALOG` (`type:'armor'`, `armorClass`, `weight`,
  `mods`, prix + malus dans `sub`). Syntaxe OK (`npx esbuild`), **255 tests verts**, diff limité
  aux 20 lignes insérées.
- **`index.html`** : jeton de cache `20260906-8` → **`20260907-1`**.
- **`armures-catalog.json`** (racine, **non commité**) : le patch prêt pour Firebase.

⚠️ **Aucune règle RTDB touchée**, aucune migration, aucune logique pure modifiée. Le catalogue
(`campaign/runeterra/catalog`) est déjà en lecture pour tout inscrit / écriture staff.

---

## 5. ⏳ CE QUI RESTE À FAIRE — l'écriture Firebase

**C'est l'étape qui compte, et elle n'est pas faite.**

```bash
MSYS_NO_PATHCONV=1 firebase database:update "/campaign/runeterra/catalog" armures-catalog.json --instance runeterra-jdr-default-rtdb
```

⚠️ **Éditer `data.jsx` ne suffit PAS, et c'est le piège central de ce chantier.**
`useItemCatalog` (data-state.jsx:619) fait `catalogArray(map, !!inited, ITEM_CATALOG)` : **dès que
`campaign/runeterra/catalogInit` est vrai, `ITEM_CATALOG` n'est plus jamais lu**. Le catalogue de la
campagne est amorcé depuis longtemps (le MJ y ajoute des objets par la page Admin), donc le tableau
de `data.jsx` n'est plus qu'un **filet pour un ré-amorçage futur**. Les 18 armures n'apparaîtront
dans le picker qu'une fois la commande ci-dessus passée.

Propriétés de l'opération :
- `database:update` est **additif** : les objets existants ne sont pas touchés.
- Les ids sont **lisibles** (`it_arm_lourde_pvarm`, `it_arm_legere_arm`…) et non générés par
  `newItemId` — c'est volontaire : réversible et rejouable à l'identique. Aucun risque de collision,
  les ids du catalogue ne se propagent pas aux inventaires (`fillStacks` régénère un id à l'ajout).
- Rejouer la commande est **idempotent** (mêmes ids, mêmes valeurs).
- Pour annuler : `firebase database:remove` sur chacun des 18 ids, ou les supprimer depuis la page
  Admin → Catalogue d'objets.
- `armures-catalog.json` est **untracked** : à supprimer une fois la commande passée. Il est
  régénérable depuis les entrées de `data.jsx` si besoin.

**Ensuite, en jeu** : prévenir la table. Une armure d'étoffe légère (+7 Arm) **double presque**
l'armure d'un PJ niveau 2 (6-9 depuis le 2026-09-06). C'est le relais annoncé, mais il change
l'équilibre immédiatement. À annoncer en même temps que les **quatre répartitions**
(Force/Habileté/Mental/Magie), qui restent elles aussi à annoncer depuis le 2026-09-06.

---

## 6. Divergences de contenu relevées au passage (non traitées)

Le catalogue et le guide d'économie sont **deux référentiels indépendants** qui ne se sont jamais
rencontrés. Trois écarts, par ordre d'impact :

### 6.1 Potions — les paliers 2 à 4 sont 2 à 3 fois trop faibles ⚠️

| Palier | Guide §7.1 | `ITEM_CATALOG` | Nom catalogue |
|---|---|---|---|
| Mineure | 15 + 15 % | 15 + 15 % ✓ | mineur |
| Intermédiaire | **75 + 30 %** | 30 + 20 % | intermédiaire |
| Supérieure | **200 + 50 %** | 50 + 25 % | **avancé** |
| Légendaire | **la totalité** | 100 + 30 % | **ultime** |

C'est **l'écart qui a un effet réel en jeu** : `parseConsumableEffect` lit le `sub`, donc ce sont les
valeurs faibles qui s'appliquent quand un joueur boit. Les noms divergent aussi (avancé/ultime contre
supérieure/légendaire), et les prix du guide (80 c / 4 ar / 18 ar / 1 or 20) n'apparaissent nulle part.

⚠️ **La potion légendaire « rend la totalité » n'est pas exprimable** dans le gabarit
`« Rend X + Y% HP »` — il faudrait `Rend 0 + 100% HP`, qui marche par calcul mais se lit mal, ou une
extension du parseur. À trancher avec le MJ.

### 6.2 Armes — deux listes qui ne se recoupent qu'à 3 entrées

Le guide tarife **10 armes** (dague/orbe, lance, épée courte, hache d'armes, épée longue, arc long,
bâton magique, claymore, arbalète, pistolet hextech) ; le catalogue en a **9**, dont 3 seulement
partagent un nom (épée courte, claymore, arbalète ≈ arbalète légère). Et **aucune arme du catalogue
n'a de `mods`**, alors que le §7.1 chiffre le palier de base : **+15 AD** (physique), **+15 AP**
(magique), **+10/+10** (hybride).

C'est le prochain lot naturel : il est plus simple que les armures (une seule valeur par arme au
palier de base) et il manque autant.

### 6.3 Palier « supérieur » des armures — non chiffré dans la spec

Le §7.2 dit seulement que les armures supérieures « fourniront des valeurs plus élevées », sans
table — alors que les **armes** le sont (+15 → +30 → +70). Les prix, eux, existent (125 / 185 / 300 ar).
Par symétrie avec les armes, où le supérieur vaut **2× la base**, on aurait 14 / 30 / 50 en Armure
pure. ⚠️ **C'est une extrapolation, pas la spec** — à faire valider par le MJ avant de saisir quoi
que ce soit.

---

## 7. Ce qui n'est PAS dans le périmètre

- **Assets graphiques** : aucune image d'armure n'existe (`ATH/Items/`, `ATH/Armes/`). Les 18 entrées
  partent avec `img:''` et s'affichent via leur emoji `ic`. L'éditeur d'item permet de téléverser une
  image plus tard sans toucher au code.
- **Passifs d'armure** (anti-crit, etc.) : « définis plus tard » (§7.2 de la spec).
- **Sertissage** : le guide §10 le chiffre entièrement (150 % du prix, 1/2/3 emplacements, 3 qualités
  de pierre) mais rien dans le modèle d'item ne porte d'emplacement de gemme. Chantier à part entière.
- **Système marchand** (achat/revente aux taux du guide §11.1) : demanderait le champ `price` écarté
  au §3.
