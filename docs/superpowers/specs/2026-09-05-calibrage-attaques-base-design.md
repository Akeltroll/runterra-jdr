# Calibrage des attaques de base — 3 décisions figées (2026-09-05)

Décidé avec le MJ (Woolost) en session. **Ce document fait foi** pour la répartition
des points, l'escalade et le crit. Il remplace sur ces trois points les chiffres de
`2026-06-21-moteur-stats-refondu-design.md` et de l'« État actuel (2026-09-04) » du CLAUDE.md.

## 1. Pourquoi

Trois défauts mesurés sur le système du 2026-09-04 :

1. **Aucune différenciation à bas niveau.** Au niveau 2, budget 12 points et cap 6 →
   la seule répartition « spécialisée » est 6/6. Un ADC (Force/Habileté) et un assassin
   (Habileté/Force) étaient **le même personnage**, de même qu'un tank physique
   (Mental/Force) et un bruiser (Force/Mental). 3 archétypes sur 5 indiscernables.
2. **Le crit était un multiplicateur de puissance déguisé en aléa.** `crit = 5 + 10·H`
   et `dcrit = 150 + 6·H` se multipliaient entre eux : à 20 d'Habileté le multiplicateur
   moyen valait **×3.23**, contre ×1.02 pour un personnage sans Habileté. Conséquence
   mesurée : au niveau 18, Urskaar avait le meilleur AD brut du jeu (585 contre 357 à
   Smith) et faisait **le moins de dégâts réels** (453 contre 621).
3. **La spécialisation était surpayée.** L'escalade super-linéaire donnait +15 % à un
   build 2 caracs contre un build 3 caracs — le système poussait mécaniquement à
   l'extrême, et le calibrage se cassait dès qu'un joueur optimisait.

Symptôme final : au niveau 18, un ADC tuait un assassin en **1.1 attaque de base**.

## 2. Décision A — Courbe de points

**Règle : budget ≈ 1,65 × cap.** Elle garantit qu'on ne peut jamais monter deux
caractéristiques au plafond, à aucun niveau.

| niv | budget | cap | spé. max | | niv | budget | cap | spé. max |
|-----|--------|-----|----------|-|-----|--------|-----|----------|
| 1  | 8  | 5  | 5/3  | | 10 | 21 | 13 | 13/8  |
| 2  | 10 | 6  | 6/4  | | 11 | 23 | 14 | 14/9  |
| 3  | 11 | 7  | 7/4  | | 12 | 25 | 15 | 15/10 |
| 4  | 12 | 7  | 7/5  | | 13 | 26 | 16 | 16/10 |
| 5  | 13 | 8  | 8/5  | | 14 | 28 | 17 | 17/11 |
| 6  | 15 | 9  | 9/6  | | 15 | 30 | 18 | 18/12 |
| 7  | 16 | 10 | 10/6 | | 16 | 32 | 19 | 19/13 |
| 8  | 18 | 11 | 11/7 | | 17 | 33 | 20 | 20/13 |
| 9  | 19 | 12 | 12/7 | | 18 | 34 | 20 | **20/14** |

Bornes voulues par le MJ : **10 points au niveau 2** (donc 6/4) et **20/14 au niveau 18**
(inchangé par rapport à aujourd'hui).

⚠️ **Le `budget` de ce tableau est le budget TOTAL**, `CREATION_BONUS` inclus. Dans
`LEVELS` (data.jsx), `total` doit donc valoir `budget − CREATION_BONUS`.

⚠️ **Le cap monte plus lentement qu'avant** (13 au niveau 10 contre 14). C'est lui qui
porte la contrainte : baisser le budget sans baisser le cap ne suffirait pas.

## 3. Décision B — Escalade locale réduite + escalade globale

Demande du MJ : réduire la prime à la spécialisation, mais **sans aplatir** — chaque
point placé doit légèrement relever le rendement de tous les points déjà placés.

```
escalade locale    : eLoc(p)  = p × (1 + 0,010 × (p − 1))     // +1 %/pt, contre ~+2,3 % avant
escalade globale   : gGlob(T) = 1 + 0,0049 × T                 // T = total de points placés
valeur d'une carac : eLoc(points) × gGlob(total)
```

| build (niv 18) | actuel | proposé |
|---|---|---|
| 20/14 (2 caracs) | 46.2 | **46.2** (inchangé) |
| 17/17 | 45.6 (−1 %) | 46.0 (−0,5 %) |
| 12/11/11 (3 caracs) | 40.1 (**−15 %**) | 43.8 (**−6 %**) |

La prime à la spécialisation passe de 15 % à 6 % : elle reste payante (volonté du MJ)
mais un build à trois caractéristiques redevient jouable. **Le total au niveau 18 en
20/14 est identique à l'ancien** — donc aucun recalibrage des dégâts n'est nécessaire.

⚠️ **Propriété à connaître : un joueur place toujours tous ses points**, donc `T` vaut
toujours le budget de son niveau. `gGlob` est mathématiquement équivalente à un
multiplicateur de niveau. Ce n'est pas un défaut (l'effet recherché est atteint), mais
un joueur ne verra jamais « mon point de Force a boosté ma Magie » : il verra ses stats
monter un peu à chaque niveau. Ne pas promettre autre chose à la table.

⚠️ **La zone PNJ (> 20 points) n'est pas retouchée.** `escalationFactor` garde sa
branche quadratique au-delà de 20 (§8 de la spec hypermétrique).

## 4. Décision C — Crit

```
crit  = 5 + 2,5 × H       (au lieu de 5 + 10 × H)
dcrit = 150 + 4 × H       (au lieu de 150 + 6 × H)
```

| Habileté | 0 | 2 | 4 | 6 | 8 | 10 | 14 | 20 |
|---|---|---|---|---|---|---|---|---|
| %crit | 5 | 10 | 15 | 20 | 25 | 30 | 40 | **55** |
| dégâts crit | 150 | 158 | 166 | 174 | 182 | 190 | 206 | **230** |
| ×moyen | 1.02 | 1.06 | 1.10 | 1.15 | 1.21 | 1.27 | 1.42 | **1.71** |

⚠️ **Seules ces deux formules changent.** `rollCrit`, les paliers de surcrit,
`critMultAfterResist` et la résistance critique du Mental sont **inchangés**.

⚠️ **Distinguer deux nombres** : le **coup critique** vaut ×2,30 au maximum (ce que le
joueur voit à la table) ; le **×moyen** vaut 1,71 (ce que le crit vaut en dégâts par
tour). Le MJ visait ×2 de moyenne — voir §6 pourquoi c'était incompatible avec le reste.

⚠️ **Le surcrit devient inatteignable par les caracs seules** : 55 % au plafond, très
loin des 100 % qui déclenchent les paliers garantis. La mécanique de surcrit (§6.3) ne
s'active plus que par l'équipement et les runes cumulés. C'est assumé — elle devient un
objectif de build tardif au lieu d'un acquis automatique.

⚠️ `2,5 × H` produit des demi-pourcentages pour H impair (37,5 % à 13 d'Habileté). La
mécanique les accepte. Si le MJ préfère des nombres ronds à la table, `5 + 5·⌊H/2⌋`
donne la même courbe par paliers de deux points.

## 4 bis. Décision D — Répartition du Mental (PV / Mana)

Ajoutée après validation visuelle des décisions A-C. Chaque point de Mental donne :

```
socle garanti  : 45 PV + 15 Mana
part dirigée   : 15 points au choix du joueur → +15 PV  OU  +15 Mana
```

Soit **60 PV + 15 Mana** en tout-PV, **45 PV + 30 Mana** en tout-Mana, et toutes les
combinaisons intermédiaires (la répartition se fait point de Mental par point de Mental,
comme `habSplit`). Persisté dans `state.mentalSplit = {hp, mana}`.

⚠️ **Le total par point passe de 80 (60 PV + 20 Mana) à 75.** La flexibilité se paie de
5 points de Mana. C'est voulu — ne pas « rattraper » le socle.

⚠️ **`mentalSplit` absent = défaut TOUT EN PV**, et c'est ce qui rend le changement
indolore : 45 + 15 = 60, l'ancien coefficient de PV. **Les PV de tous les personnages
existants ne bougent pas d'un point, et la matrice du §5 reste valide sans migration.**
Seul le Mana baisse de 25 % (Tank physique niveau 18 : 1105 → 829). Sans conséquence
pratique — on a mesuré qu'il reste 90-100 % du mana en fin de combat (§10) — et ça va
dans le sens du chantier suivant, où le mana doit redevenir limitant.
⚠️ Ne pas changer ce défaut sans re-vérifier la matrice.

⚠️ **Même ruling que l'Habileté** : l'escalade est distribuée au prorata du total
(`mUnit = escalationFactor(M)·g / M`), donc un point vaut autant où qu'il aille et
**répartir ne coûte rien**. Ne pas escalader chaque part séparément.

La part dirigée ne touche **ni la résistance critique** (3 %/pt, sur les points bruts)
**ni quoi que ce soit d'autre** : Mental reste la carac défensive.

## 5. Résultat vérifié

Archétypes de référence : ADC (Force/Habileté), Assassin (Habileté/Force), Tank physique
(Mental/Force), Tank magique (Mental/Magie), Bruiser (Force/Mental). Répartition = cap
sur la dominante, reste sur la secondaire. AA = 100 % de la plus haute de AD/AP.

**Chaîne de résolution** (à connaître pour tout calibrage futur) :

```
affiché × crit × 0,625 (d20) × (1 − AR/(AR+120)) = PV réellement perdus
```

Le facteur d20 vaut **0,625** : 1-5 échec (0), 6-10 demi (×0,5), 11-20 plein (×1).

### Nombre d'attaques de base pour tuer — niveau 18

| attaquant \ cible | ADC | Assassin | Tank ph | Tank mg | Bruiser |
|---|---|---|---|---|---|
| ADC | 2.8 | 2.2 | 5.5 | 4.0 | 5.2 |
| Assassin | 3.1 | 2.3 | 6.0 | 4.4 | 5.7 |
| Tank phys | 6.7 | 5.1 | 13.0 | 9.5 | 12.3 |
| Tank magi | 4.8 | 4.0 | 10.2 | 12.0 | 8.8 |
| Bruiser | 4.4 | 3.4 | 8.6 | 6.3 | 8.2 |

### Stabilité sur toute la courbe

| niv | ADC→ADC | ADC→Asn | Asn→ADC | Bru→ADC | ADC→Tank |
|---|---|---|---|---|---|
| 1  | 2.7 | 2.3 | 3.4 | 3.2 | 4.9 |
| 5  | 3.0 | 2.4 | 3.9 | 3.7 | 5.4 |
| 10 | 3.0 | 2.3 | 3.7 | 3.9 | 5.5 |
| 14 | 2.9 | 2.2 | 3.3 | 4.1 | 5.5 |
| 18 | 2.8 | 2.2 | 3.1 | 4.4 | 5.5 |

**Aucune dérive** : le TTK reste dans une bande de ±0,3 attaque sur 18 niveaux, contre
1.9 → 1.1 dans le système précédent. C'est le critère qui permet de déclarer les
attaques de base saines.

### Écart assassin / bruiser (question explicite du MJ)

| niveau | AA brute | AA effective | écart |
|---|---|---|---|
| 2  | 145 vs 165 (bruiser +14 %) | 104 vs 106 | **−2 %** |
| 10 | 316 vs 401 (bruiser +27 %) | 273 vs 257 | **+6 %** |
| 18 | 600 vs 694 (bruiser +16 %) | 643 vs 445 | **+45 %** |

Le bruiser garde toujours plus d'AD brut ; l'assassin le dépasse par le crit, et l'écart
se creuse avec le niveau. Progression validée par le MJ : le bruiser est le meilleur
cogneur au départ, l'assassin le dépasse en fin de campagne.

## 6. Ce qui a été écarté, et pourquoi

**Le ×2 de multiplicateur moyen demandé par le MJ est incompatible** avec ses deux autres
cibles (assassin ET bruiser tuant un DPS en ~4 AA). Démonstration : le bruiser n'a
**aucune** Habileté, donc rien de ce qui augmente le crit ne l'aide ; pour qu'il suive un
assassin à ×2, il lui faudrait deux fois plus d'AD brut, alors qu'il n'en a que 16 % de
plus. Les trois échappatoires ont été testées et aucune ne suffit :

| tentative | ×Asn | ADC→DPS | Asn→DPS | Bru→DPS |
|---|---|---|---|---|
| retirer tout l'AD de l'Habileté | 2.11 | 2.1 | 3.3 | 4.4 |
| crit de base 25 % pour tous | 2.11 | 1.8 | 2.5 | 4.0 |
| PV +50 % | 2.11 | 2.7 | 3.6 | 6.4 |
| crit de base 25 % + PV +50 % | 2.11 | 2.6 | 3.6 | 5.9 |

Arbitrage du MJ : garder un ×moyen de 1,71 (coup critique à ×2,30) et **accepter que
l'assassin tue plus vite que le bruiser**. Ne pas rouvrir ce point sans refaire la
démonstration — le blocage est arithmétique, pas un choix de valeurs.

## 7. Réserves — ce que ce document NE valide pas

1. **Les AA sont saines EN ISOLATION.** Ni l'équipement (backlog « équipement en stats
   finales », §7 de la spec hypermétrique) ni les runes ne sont dans le calcul. Une rune
   Sadisme donne déjà +15 AD/AP, et les armures d'`ITEM_CATALOG` n'existent pas encore.
   Le calibrage devra être re-vérifié quand ces deux sources entreront en jeu.
2. **Les duels de tanks restent très longs** (13 attaques au niveau 18). Structurel :
   deux personnages qui mettent 40 % de leurs points dans une carac purement défensive
   n'ont pas de quoi se tuer. Problème seulement si deux tanks restent seuls en fin de
   combat.
3. **Asymétrie physique/magique.** Le tank magique est plus vulnérable aux attaques
   physiques (AR 18) et réciproquement. Normal, mais un groupe mono-type le sentira.
4. **Rien n'est validé côté COMPÉTENCES** — c'est le chantier suivant (§10).

## 8. Implémentation

| Fichier | Changement |
|---|---|
| `data.jsx` | `LEVELS` : nouveaux `total` (= budget − `CREATION_BONUS`) et `limit` (§2) |
| `game-logic.js` | `escalationFactor` → escalade locale `p × (1 + 0,010(p−1))`, borne PNJ conservée |
| `game-logic.js` | `computeStats` : appliquer `gGlob(F+H+M+C)` aux 3 facteurs escaladés et à `hUnit` |
| `game-logic.js` | `computeStats` : `crit: 5 + 2.5*H`, `dcrit: 150 + 4*H` |
| `game-logic.js` | `mentalSplit` / `defaultMentalSplit` / `MENTAL_DESTS` + 7e param `ment` de `computeStats` ; `charBaseStats` et `npcStatsFromAttrs` le propagent |
| `data-state.jsx` | `setAttrs(attrs, locked, split, mentSplit)` écrit `mentalSplit` dans la MÊME opération que `attrs` ; nouveau `setMentalSplitOpen` |
| `pages-progression.jsx` | `HabSplitRow` généralisé en `SplitRow` (paramétré par `meta`/`label`/textes) et utilisé deux fois ; `clampSplitDraft` prend ses clés en argument |
| `pages-progression.jsx` | ligne 34 : `escalationFactor(val)/val` doit inclure le facteur global (aperçu du gain marginal) |
| `test/game-logic.test.js` | table de référence `escalationFactor` (§4.3) + verrous PV des 5 profils + `dcrit` : **à réécrire** |
| `index.html` | bump du jeton `?v=` (cache-busting) |

**Aucune règle RTDB à republier** : ni `state/modifiers`, ni `combat/enemies`, ni
`pendingHits` ne valident les clés de stats. **Aucune migration de données** : `attrs` et
`habSplit` gardent leur forme.

⚠️ `npcStatsFromAttrs` suit automatiquement (il appelle `computeStats`) — les PNJ déjà
créés gardent leurs valeurs plates, qui restent la source de vérité. Rien à corriger.

## 9. Conséquence à la table — respec obligatoire

Les 5 PJ ont **12 points placés** au niveau 2 ; le nouveau budget est **10**.
`respecValid` refusera leurs répartitions actuelles tant qu'ils n'auront pas retiré
2 points.

⚠️ **C'est au MJ de faire la descente, pas aux joueurs — et ce n'est pas un oubli d'UI.**
Dans `ProgressionPage`, `floorAttrs = staff ? {} : savedAttrs` : le plancher d'un joueur
EST sa répartition déjà confirmée, il ne peut donc **jamais** descendre une caractéristique
(le level-up ne fait que monter). Un joueur ouvrant sa page verra « 12 / 10 » avec un solde
négatif, ne pourra ni descendre (plancher) ni confirmer (hors budget) : il est bloqué tant
que le MJ n'est pas passé. Le staff, lui, a un plancher 0 et corrige librement depuis le
sélecteur de perso de l'onglet Progression.
⚠️ Ni `setAttrsLocked` ni « ↺ Rouvrir au joueur » ne débloquent ce cas : le premier gouverne
`canEdit` (le verrou de respec unique), le second `habSplitOpen` (la répartition d'Habileté).
**Le plancher des caractéristiques est inconditionnel pour un joueur.**
👉 Donc : passer les 5 fiches en MJ **avant** d'annoncer le changement aux joueurs.

Répartitions actuelles, et une proposition de descente à 10 points préservant chaque
build (à valider avec chaque joueur, ce n'est pas au MJ de trancher seul) :

| perso | actuel (12) | proposé (10) | PV | AD | AP | %crit | AA effective |
|---|---|---|---|---|---|---|---|
| Rathael | 4/3/4/1 | 4/2/3/1 | 445 | 119 | 26 | 10 % | 79 |
| Urskaar | 6/1/5/0 | 5/1/4/0 | 503 | 142 | 0 | 7,5 % | 92 |
| Smith | 3/6/1/2 | 2/5/1/2 | 312 | 84 | 57 | 17,5 % | 59 |
| Elias | 5/4/3/0 | 4/3/3/0 | 449 | 128 | 4 | 12,5 % | 86 |
| Jett | 1/6/1/4 | 1/5/1/3 | 301 | 30 | 112 | 17,5 % | 79 |

⚠️ **PV et Mana courants sont stockés en absolu** : un **« ⟲ Combat »** est nécessaire
après déploiement pour recaler tout le monde sur les nouveaux caps.

## 10. Chantier suivant — les compétences

Ces trois décisions donnent le socle qui manquait pour réparer les kits : le crit ne
fausse plus les comparaisons, et l'attaque de base devient l'**unité de mesure**
(invariante au niveau).

Budget cible par archétype, en multiples d'AA :

| Archétype | tour « off » | pic | moyenne / 4 tours |
|---|---|---|---|
| AD carry (Elias) | 1.4 | 1.8 | ~1.5 |
| Assassin (Smith) | 0.7 | **4.0** (1 tour /4) | ~1.5 |
| Bruiser (Urskaar) | 1.3 | 2.2 | ~1.5 |
| Tank (Rathael) | 0.8 | 1.6 | ~1.0 |
| Utilitaire (Jett) | 1.0 | 2.5 | ~1.2 |

La moyenne converge ; c'est la **forme** qui distingue les archétypes.

État mesuré des kits avant réparation (rotation optimale sur 4 tours, CD et mana inclus,
niveau 18) :

| perso | rotation optimale | DPT moyen | mana restant |
|---|---|---|---|
| Urskaar | C1 ×4 | ×1.50 | 666/786 |
| Elias | C4 > C3 > C2 > AA | ×1.47 | 490/610 |
| Rathael | C3 > C1 > C1 > C3 | ×1.21 | 573/733 |
| Smith | C3 > AA > AA > AA | **×1.04** | 561/621 |
| Jett | AA ×4 | **×1.00** | 782/782 |

Trois PJ sur cinq n'ont aucune raison de lancer une compétence, et il leur reste 90-100 %
de leur mana. Défauts identifiés à traiter :

- **Jett** : ses 2 comps scalent sur l'AD alors qu'il est un build AP. Même en replaçant
  toute son Habileté en AD, elles restent à 0,37× son attaque de base. Ses C3/C4 n'existent pas.
- **Rathael** : sa C1 (20 mana, sans CD) fait **0,57× son attaque de base gratuite**. Elle
  scale à 40 % sur (Armure + RM), divisé par deux le 2026-09-04. Idem son passif :
  +7 points au total à 5 charges au niveau 2. Le code fait +10 %/charge, le CLAUDE.md
  annonce +5 % — **divergence à trancher**.
- **Smith** : passif `50 + 0,5 AP` orphelin (×1,72 sur la campagne). Aucun burst : même en
  jouant Fondu au noir → 3 tours de sournoise furtive, il plafonne à ×1,12.
- **Elias** : passif surpuissant — `10 + 5(niv−1)` AD par charge × `5 + ⌊(niv−1)/3⌋`
  charges = **+950 AD au niveau 18** sur un AD de base de 504.
- **Constantes plates** (`50 +`, `100 +`, `25 +`) : dominantes à bas niveau, noyées à haut
  niveau. C'est la cause n°1 du décrochage des compétences, avant l'absence de scaling par
  niveau. Preuve : Urskaar n'a **aucun** scaling de niveau et son ratio comp/AA est
  constant à 1,50 du niveau 2 au 18, parce que ses formules sont des multiples purs d'AD.
- **Mana non limitant** : à revoir une fois les compétences remontées.

Question ouverte du MJ, non tranchée : **scaling numérique par niveau OU upgrades de
compétences au choix du joueur** (le MJ veut l'un ou l'autre, pas les deux).

## Annexe — PV d'ennemis recommandés

Déduits du DPT effectif d'un groupe de 5 (config **antérieure** à cette spec ; à
recalculer après implémentation).

| niv | mob (1 action) | standard (4 act.) | élite (10 act.) | boss (22 act.) |
|---|---|---|---|---|
| 2  | 100 | 410  | 1030 | 2270 |
| 6  | 170 | 680  | 1710 | 3750 |
| 10 | 250 | 1010 | 2520 | 5540 |
| 14 | 320 | 1290 | 3230 | 7100 |
| 18 | 440 | 1770 | 4420 | 9730 |
