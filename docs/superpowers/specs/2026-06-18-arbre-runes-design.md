# Design — Arbre de runes interactif

Date : 2026-06-18
Statut : validé (brainstorming), prêt pour le plan d'implémentation.

## But

Page « Runes » interactive (façon arbre LoL/MMO « Forgez votre légende ») permettant à
chaque joueur de dépenser ses **points de rune** dans les 5 familles, avec sélection
persistée en temps réel et bonus plats reflétés sur les stats effectives. Le MJ peut
configurer l'arbre de n'importe quel perso.

## Décisions cadrantes (brainstorming)

- **Effets : hybride.** Les bonus **plats permanents** (HP, Mana, AP, AR/RM, Crit, « AD ou AP »)
  sont calculés et injectés dans `computeEffective` (comme `item.mods`). Le **conditionnel /
  actif / complexe** (Frénésie par tour, Réfuter la mort, Aery, capstones « par kill »,
  thématique −2 CD…) est affiché en **rappels**, jamais appliqué automatiquement.
- **Contenu figé dans le code** (`RUNES` dans `data.jsx`, issu de l'Excel — pas d'éditeur in-app).
- **Application stricte des points** : budget = niveau du perso ; ordre Mineure→Avancée→Fondamentale
  (coûts 1/2/2, 5 pts/catégorie) ; pas de dépassement ; respec libre (hors combat) ; compteur visible.
  Pas d'override MJ (le MJ suit les mêmes règles quand il configure un perso).
- **Source de vérité du contenu** : `info-mj/Système de Runes.md` (méta-règles + chiffrage des
  5 familles transcrit le 2026-06-18, règle DA→« X AD ou AP » à la moyenne déjà appliquée).
- **Pas de temps réel de combat** : l'app ne suit pas les états tour par tour.

## Faits techniques (existant)

- `RUNE` actuel (`data.jsx`) = un seul objet Domination, **affiché en statique dans la page
  Design System** (`pages-ds.jsx`), valeurs légèrement divergentes de l'Excel → **remplacé**
  par `RUNES` (5 familles) réaligné sur l'Excel. Le bloc DS sera adapté ou retiré.
- Pattern zéro-build : chaque fichier `Object.assign(window, {...})` ; ordre dans `index.html`.
- `computeEffective(base, modifiers, activeBuffs, itemMods)` : les mods sont foldés à l'étage
  des modificateurs (amplifiés par les buffs). Appelé en 3 endroits : `pages-sheet.jsx`,
  `pages-mj.jsx` (`mjLive`), `pages-equip.jsx`.
- Règles RTDB : `characters/$charId` = joueur (sa fiche) / staff (tout). **Aucune nouvelle règle.**
- Routing : `PAGES` (index.html) + `PAGE_ACCESS` par rôle (`auth.js`).

## Architecture

### Données — `data.jsx` : constante `RUNES`

```js
const RUNES = [
  {
    key:'conquerant', name:'Conquérant', color:'var(--gold)',
    theme:'Être en combat depuis ≥ 2 tours',
    capstone:'…',                         // bannière famille (texte)
    paths:[
      { key:'agression', name:'Agression', nodes:[
        { id:'conq_agr_1', tier:'mineure',      name:'+30 AD ou AP', desc:'Bonus passif permanent (orig. 20|40 DA)', mods:{ adp:30 } },
        { id:'conq_agr_2', tier:'avancee',      name:'Flux',     desc:'+2 JA si l'attaque précédente touche', kind:'reminder' },
        { id:'conq_agr_3', tier:'fondamentale', name:'Frénésie', desc:'+45 AD ou AP et 10 létalité/tour en combat (max 4)', kind:'reminder' },
      ]},
      // … Sustain, Tenacité
    ],
  },
  // … domination, sorcellerie, volonte, inspiration
];
```

- `mods` : objet de bonus plats calculables. Clés = stats de `computeEffective`
  (`hp, mana, ap, ad, armure, resmag, crit, dcrit, sapience, omni, vol`) **plus** la clé
  spéciale **`adp`** = « AD ou AP » (résolue en `ad` ou `ap` selon le choix joueur).
- `kind:'reminder'` (ou absence de `mods`) = effet non calculé → affiché en rappel.
- Contenu = transcription `info-mj/Système de Runes.md`. Les 2 cellules tronquées (Inspiration
  « Altruisme excessif » + 1er capstone) sont saisies en texte reconstitué avec un suffixe
  discret « (à confirmer) ».

### Logique pure — `game-logic.js` (testée `node --test`)

Coûts par tier : `RUNE_COST = { mineure:1, avancee:2, fondamentale:2 }`.

- `runeBudget(level)` → `level` (points disponibles).
- `runeSpent(selectedIds, runesIndex)` → somme des coûts des nœuds sélectionnés.
- `runeNodeIndex(RUNES)` → map `{id: {tier, pathKey, prevId, familyKey}}` (helper d'indexation,
  pour retrouver le prérequis d'un nœud — le nœud de tier inférieur dans la même voie).
- `canSelectRune(nodeId, selectedIds, runesIndex, budget)` → `{ok:boolean, reason?:string}`.
  Refuse si : budget restant insuffisant ; prérequis (nœud précédent de la voie) non sélectionné.
- `canDeselectRune(nodeId, selectedIds, runesIndex)` → `{ok, reason?}`. Refuse si un nœud
  supérieur de la même voie est encore sélectionné (prérequis utilisé).
- `sumRuneMods(selectedIds, choices, runesIndex)` → `{stat: total}`. Ne somme que les nœuds
  ayant `mods`. La clé `adp` est résolue : `choices[nodeId] === 'ap' ? ap : ad` (défaut `ad`).
- `mergeMods(a, b)` → `{stat: a+b}` (addition de deux objets de mods).

Exports ajoutés au `return` du module + dispo sur `window`.

### Persistance — Firebase `state/runes`

```
/campaign/runeterra/characters/{charId}/state/runes
    selected: { [nodeId]: true }
    choices:  { [nodeId]: 'ad' | 'ap' }   ← uniquement pour les runes « AD ou AP »
```

- Setter `setRunes(patch)` ajouté à `useCharState` (merge dans `state/runes`).
- Respec = écrire un nouveau `selected`/`choices`. Aucune nouvelle règle RTDB.

## Composants — `pages-runes.jsx`

- **`RuneTreePage`** : gère le perso courant (joueur = le sien ; staff = sélecteur de perso,
  pattern `lockedCharId`), lit `useCharState`, calcule budget/dépensés, rend l'en-tête
  (compteur « Points : X/Y », bouton « Réinitialiser »), la grille des familles et le panneau
  de rappels. Dépend de : `RUNES`, logique pure, `useCharState`.
- **`RuneFamilyPanel`** (`{family, selected, choices, onToggle, onChoice, canSelect}`) : un
  panneau coloré, 3 voies côte à côte, nœuds reliés verticalement, bannière capstone.
- **`RuneNode`** (`{node, state, color, onClick, choice, onChoice}`) : un nœud avec son état
  (`locked` / `available` / `selected`), tooltip au survol (nom, tier, effet, coût), et le
  toggle AD/AP si `mods.adp` et sélectionné.
- **`RuneReminders`** (`{selected}`) : liste les nœuds sélectionnés `kind:'reminder'` avec leur
  effet (aide-mémoire de combat).

Responsive : grille 3+2 familles sur large écran (cf. mockup `idée/b167909c…png`), empilées en
1 colonne sur écran étroit. Styles dans `runeterra.css` (couleurs par famille, états de nœud,
traits de liaison, halos). Reproduction fidèle de la **structure et de l'ambiance**, pas des
courbes lumineuses exactes.

## Intégration aux stats

`sumRuneMods(...)` est fusionné (`mergeMods`) avec `sumItemMods(...)` et passé au 4e paramètre
de `computeEffective` aux 3 sites :
- `pages-sheet.jsx` : `const runeMods = sumRuneMods(...); computeEffective(base, mod, buffs, mergeMods(itemMods, runeMods))`.
- `pages-mj.jsx` (`mjLive`) : idem à partir de `st.runes`.
- `pages-equip.jsx` : idem (la coloration verte « boost » reste pilotée par la somme des deux).

Les bonus plats de runes s'allument donc comme ceux des items. Les effets `reminder` ne touchent
jamais les stats.

## Routing & accès

- `PAGES` (index.html) : `{ id:'runes', label:'Runes', render:(auth)=> <RuneTreePage lockedCharId={auth.role==='joueur'?auth.charId:null} /> }`.
- `auth.js` `PAGE_ACCESS` : ajouter `'runes'` aux 3 rôles. Mettre à jour `test/auth.test.js`.
- Charger `pages-runes.jsx` dans `index.html` (après les autres `pages-*.jsx`).

## Cas limites

- Niveau bas / 0 point → tout verrouillé, compteur `0/N`.
- Dépassement budget ou ordre non respecté → clic refusé, tooltip explique.
- Désélection d'un prérequis encore utilisé → **bloquée** + message clair.
- `state/runes` absent → arbre vide, 0 sélection, aucun effet.
- Contenu tronqué (Excel) → texte reconstitué + marqueur « (à confirmer) ».

## Tests

`node --test test/game-logic.test.js` : `runeBudget`, `runeSpent`, `canSelectRune` (budget + ordre),
`canDeselectRune` (prérequis), `sumRuneMods` (plats only + résolution `adp` via `choices`),
`mergeMods`. `test/auth.test.js` : `recap`… → ajouter `runes` aux 3 rôles. UI = vérif visuelle.

## Phasage de l'implémentation

1. Données `RUNES` (5 familles) + logique pure testée + persistance (`setRunes`).
2. Page arbre + sélection + compteur de points + respec + sélecteur de perso (staff).
3. Intégration stats (`sumRuneMods`/`mergeMods` aux 3 sites) + panneau de rappels.

## Hors scope (YAGNI)

- Éditeur de contenu de runes in-app.
- Calcul automatique des effets conditionnels/actifs et de la thématique −2 CD.
- Override de points par le MJ.
- Suivi d'état de combat tour par tour.

## À confirmer avec le MJ (non bloquant)

- Capstone (bande basse de l'Excel, 3 effets/famille) vs « thématique −2 CD » des méta-règles :
  même chose ou bonus distincts ? La structure `RUNES` stocke `theme` + `capstone` séparément,
  ajustable sans refonte.
- Texte exact des 2 cellules tronquées (Inspiration).
