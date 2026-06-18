# Arbre de runes interactif — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Note environnement :** subagents sans tests/git ici → exécution **inline** ([[subagent-sandbox-no-bash]]).

**Goal:** Ajouter une page « Runes » interactive (arbre LoL/MMO, 5 familles) où chaque joueur dépense ses points de rune (= niveau) selon des règles strictes, avec sélection persistée en temps réel et bonus plats reflétés sur les stats.

**Architecture:** Contenu figé (`RUNES` dans `data.jsx`, issu de l'Excel). Logique pure testée dans `game-logic.js` (budget, validation d'ordre, somme des mods). Persistance Firebase `state/runes`. Page `pages-runes.jsx` (RuneTreePage → RuneFamilyPanel → RuneNode + RuneReminders). Les bonus plats sont fusionnés avec `item.mods` et passés à `computeEffective` aux 3 sites de calcul.

**Tech Stack:** React 18 + Babel standalone (CDN, zéro build), Firebase RTDB compat, `node --test`.

## Global Constraints

- **Zéro build / zéro dépendance nouvelle / zéro nouvelle règle RTDB** (`state/runes` est couvert par `characters/$charId`).
- **Pattern d'export** : chaque fichier `Object.assign(window, {...})` ; ordre géré dans `index.html`.
- **Effets : hybride** — bonus plats permanents calculés (clé `mods`), conditionnel/actif en `kind:'reminder'`.
- **Application stricte** : budget = niveau ; ordre Mineure→Avancée→Fondamentale (coûts 1/2/2) ; pas de dépassement ; respec libre ; même règles pour le MJ.
- **Clé spéciale `adp`** = « AD ou AP », résolue en `ad`/`ap` selon `choices[nodeId]` (défaut `ad`).
- **Source de contenu** : `info-mj/Système de Runes.md` (chiffrage transcrit, DA déjà converti).
- **Tests** : `node --test test/game-logic.test.js test/auth.test.js` doit rester vert. Vérif `.jsx` : `npx esbuild f.jsx >/dev/null`. Serveur : `python -m http.server 5050 --bind 127.0.0.1`.

---

## File Structure

- `game-logic.js` — **modifier** : `RUNE_COST`, `buildRuneIndex`, `runeBudget`, `runeSpent`, `canSelectRune`, `canDeselectRune`, `sumRuneMods`, `mergeMods` + exports.
- `test/game-logic.test.js` — **modifier** : tests de la logique runes.
- `data.jsx` — **modifier** : remplacer `RUNE` (Domination mockup) par `RUNES` (5 familles) ; mettre à jour l'export.
- `pages-ds.jsx` — **modifier** : retirer le bloc « Rune Domination » (référençait `RUNE`, supprimé).
- `data-state.jsx` — **modifier** : setters `setRuneSelected`/`setRuneChoice`/`resetRunes` dans `useCharState`.
- `pages-runes.jsx` — **créer** : `RuneNode`, `RuneFamilyPanel`, `RuneReminders`, `RuneBody`, `RuneTreePage`.
- `runeterra.css` — **modifier** : styles de l'arbre.
- `index.html` — **modifier** : `<script>` `pages-runes.jsx` + entrée `PAGES`.
- `auth.js` — **modifier** : `'runes'` dans `PAGE_ACCESS` des 3 rôles.
- `test/auth.test.js` — **modifier** : `runes` visible des 3 rôles + liste joueur.
- `CLAUDE.md` — **modifier** : doc.

---

## Task 1 : Logique pure des runes (`game-logic.js`)

**Files:**
- Modify: `game-logic.js` (ajout fonctions + exports)
- Test: `test/game-logic.test.js`

**Interfaces:**
- Produces :
  - `RUNE_COST = { mineure:1, avancee:2, fondamentale:2 }`
  - `buildRuneIndex(families) -> { [id]: {...node, cost, familyKey, pathKey, prevId, nextId} }`
  - `runeBudget(level) -> number`
  - `runeSpent(selectedIds: string[], index) -> number`
  - `canSelectRune(nodeId, selectedIds, index, budget) -> {ok:boolean, reason?:string}`
  - `canDeselectRune(nodeId, selectedIds, index) -> {ok:boolean, reason?:string}`
  - `sumRuneMods(selectedIds, choices, index) -> {stat:number}` (résout `adp`→`ad`/`ap`)
  - `mergeMods(a, b) -> {stat:number}`

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter à la fin de `test/game-logic.test.js` :

```js
/* --- Runes : logique pure --- */
const RFAM = [{
  key:'f', name:'F', color:'#fff', theme:'t', capstone:'c', paths:[
    { key:'p', name:'P', nodes:[
      { id:'a', tier:'mineure',      name:'A', desc:'+50 HP', mods:{ hp:50 } },
      { id:'b', tier:'avancee',      name:'B', desc:'reminder', kind:'reminder' },
      { id:'c', tier:'fondamentale', name:'C', desc:'+30 AD/AP', mods:{ adp:30 } },
    ]},
  ],
}];
const RIDX = L.buildRuneIndex(RFAM);

test('buildRuneIndex calcule coût, prev et next', () => {
  assert.equal(RIDX.a.cost, 1);
  assert.equal(RIDX.b.cost, 2);
  assert.equal(RIDX.a.prevId, null);
  assert.equal(RIDX.a.nextId, 'b');
  assert.equal(RIDX.c.prevId, 'b');
  assert.equal(RIDX.c.nextId, null);
  assert.equal(RIDX.a.familyKey, 'f');
});

test('runeBudget = niveau', () => {
  assert.equal(L.runeBudget(2), 2);
  assert.equal(L.runeBudget(undefined), 0);
});

test('runeSpent additionne les coûts', () => {
  assert.equal(L.runeSpent(['a','c'], RIDX), 3);
  assert.equal(L.runeSpent([], RIDX), 0);
});

test('canSelectRune respecte prérequis et budget', () => {
  assert.equal(L.canSelectRune('a', [], RIDX, 2).ok, true);
  assert.equal(L.canSelectRune('b', [], RIDX, 5).ok, false);          // prérequis a manquant
  assert.equal(L.canSelectRune('c', ['a','b'], RIDX, 4).ok, false);   // 3+2 > 4
  assert.equal(L.canSelectRune('c', ['a','b'], RIDX, 5).ok, true);
  assert.equal(L.canSelectRune('a', ['a'], RIDX, 5).ok, false);       // déjà pris
});

test('canDeselectRune protège un prérequis utilisé', () => {
  assert.equal(L.canDeselectRune('a', ['a','b'], RIDX).ok, false);    // b dépend de a
  assert.equal(L.canDeselectRune('b', ['a','b'], RIDX).ok, true);
  assert.equal(L.canDeselectRune('a', ['a'], RIDX).ok, true);
});

test('sumRuneMods ne somme que les plats et résout adp', () => {
  assert.deepEqual(L.sumRuneMods(['a','c'], { c:'ap' }, RIDX), { hp:50, ap:30 });
  assert.deepEqual(L.sumRuneMods(['a','c'], {}, RIDX), { hp:50, ad:30 });   // défaut ad
  assert.deepEqual(L.sumRuneMods(['b'], {}, RIDX), {});                      // reminder ignoré
});

test('mergeMods additionne deux objets de mods', () => {
  assert.deepEqual(L.mergeMods({ hp:50, ad:10 }, { ad:20, ap:5 }), { hp:50, ad:30, ap:5 });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `node --test test/game-logic.test.js`
Expected: FAIL — `L.buildRuneIndex is not a function`.

- [ ] **Step 3 : Implémenter**

Dans `game-logic.js`, juste avant `function paginate(`, ajouter :

```js
  /* --- Runes : coûts par palier + index + validation + somme des bonus plats --- */
  var RUNE_COST = { mineure:1, avancee:2, fondamentale:2 };

  function buildRuneIndex(families) {
    families = families || [];
    var idx = {};
    for (var f = 0; f < families.length; f++) {
      var fam = families[f]; var paths = fam.paths || [];
      for (var p = 0; p < paths.length; p++) {
        var nodes = paths[p].nodes || [];
        for (var n = 0; n < nodes.length; n++) {
          var node = nodes[n];
          idx[node.id] = Object.assign({}, node, {
            cost: RUNE_COST[node.tier] || 0,
            familyKey: fam.key, pathKey: paths[p].key,
            prevId: n > 0 ? nodes[n - 1].id : null,
            nextId: n < nodes.length - 1 ? nodes[n + 1].id : null,
          });
        }
      }
    }
    return idx;
  }

  function runeBudget(level) { return level || 0; }

  function runeSpent(selectedIds, index) {
    selectedIds = selectedIds || []; index = index || {};
    var s = 0;
    for (var i = 0; i < selectedIds.length; i++) {
      var e = index[selectedIds[i]];
      if (e) s += e.cost || 0;
    }
    return s;
  }

  function canSelectRune(nodeId, selectedIds, index, budget) {
    index = index || {}; selectedIds = selectedIds || [];
    var node = index[nodeId];
    if (!node) return { ok:false, reason:'Rune inconnue' };
    if (selectedIds.indexOf(nodeId) !== -1) return { ok:false, reason:'Déjà sélectionnée' };
    if (node.prevId && selectedIds.indexOf(node.prevId) === -1)
      return { ok:false, reason:'Prérequis manquant' };
    if (runeSpent(selectedIds, index) + (node.cost || 0) > (budget || 0))
      return { ok:false, reason:'Points insuffisants' };
    return { ok:true };
  }

  function canDeselectRune(nodeId, selectedIds, index) {
    index = index || {}; selectedIds = selectedIds || [];
    var node = index[nodeId];
    if (!node) return { ok:false, reason:'Rune inconnue' };
    if (node.nextId && selectedIds.indexOf(node.nextId) !== -1)
      return { ok:false, reason:"Prérequis d'une rune supérieure" };
    return { ok:true };
  }

  function sumRuneMods(selectedIds, choices, index) {
    selectedIds = selectedIds || []; choices = choices || {}; index = index || {};
    var out = {};
    for (var i = 0; i < selectedIds.length; i++) {
      var e = index[selectedIds[i]];
      if (!e || !e.mods) continue;
      for (var k in e.mods) {
        var v = Number(e.mods[k]) || 0; if (!v) continue;
        var stat = k;
        if (k === 'adp') stat = (choices[e.id] === 'ap') ? 'ap' : 'ad';
        out[stat] = (out[stat] || 0) + v;
      }
    }
    return out;
  }

  function mergeMods(a, b) {
    var out = {}; var k;
    a = a || {}; b = b || {};
    for (k in a) out[k] = (out[k] || 0) + (Number(a[k]) || 0);
    for (k in b) out[k] = (out[k] || 0) + (Number(b[k]) || 0);
    return out;
  }
```

Puis ajouter au `return { … }` du module (après `paginate,`) :

```js
    RUNE_COST, buildRuneIndex, runeBudget, runeSpent,
    canSelectRune, canDeselectRune, sumRuneMods, mergeMods,
```

- [ ] **Step 4 : Lancer, vérifier le succès**

Run: `node --test test/game-logic.test.js`
Expected: PASS — tous verts.

- [ ] **Step 5 : Commit**

```bash
git add game-logic.js test/game-logic.test.js
git commit -m "feat(runes): logique pure (budget, validation d'ordre, sumRuneMods, mergeMods)"
```

---

## Task 2 : Données `RUNES` (5 familles) + nettoyage `RUNE`

**Files:**
- Modify: `data.jsx` (remplacer `RUNE` par `RUNES`, mettre à jour l'export)
- Modify: `pages-ds.jsx` (retirer le bloc « Rune Domination »)

**Interfaces:**
- Produces : `window.RUNES` (array de familles `{key,name,color,theme,capstone,paths:[{key,name,nodes:[{id,tier,name,desc,mods?,kind?}]}]}`).

- [ ] **Step 1 : Remplacer `RUNE` par `RUNES` dans `data.jsx`**

Remplacer tout le bloc `/* --- Rune Domination : 3 voies --- */ const RUNE = { … };` (≈ lignes 222-248) par :

```js
/* --- Runes : 5 familles (chiffrage Excel, DA->AD ou AP à la moyenne). --- */
const RUNES = [
  { key:'conquerant', name:'Conquérant', color:'#c89b3c', theme:'Être en combat depuis ≥ 2 tours',
    capstone:'Agression → −2 CDR (sauf ultime) · Sustain → 40 % Omni · Tenacité → insensible aux CC',
    paths:[
      { key:'agr', name:'Agression', nodes:[
        { id:'conq_agr_1', tier:'mineure', name:'+30 AD ou AP', desc:'Bonus passif permanent (orig. 20|40 DA)', mods:{ adp:30 } },
        { id:'conq_agr_2', tier:'avancee', name:'Flux', desc:"+2 JA si l'attaque précédente touche", kind:'reminder' },
        { id:'conq_agr_3', tier:'fondamentale', name:'Frénésie', desc:'+45 AD ou AP et 10 létalité par tour en combat (max 4)', kind:'reminder' },
      ]},
      { key:'sus', name:'Sustain', nodes:[
        { id:'conq_sus_1', tier:'mineure', name:'+50 HP et 10 % Omni', desc:'Bonus passif permanent', mods:{ hp:50, omni:10 } },
        { id:'conq_sus_2', tier:'avancee', name:'Réfuter la mort', desc:"Réduit les dégâts d'une attaque de moitié (CD 5)", kind:'reminder' },
        { id:'conq_sus_3', tier:'fondamentale', name:'Soif de sang', desc:'+90 AD ou AP si soin au tour précédent', kind:'reminder' },
      ]},
      { key:'ten', name:'Tenacité', nodes:[
        { id:'conq_ten_1', tier:'mineure', name:'−1 tour aux CC reçus', desc:'Bonus passif permanent', kind:'reminder' },
        { id:'conq_ten_2', tier:'avancee', name:'Adrénaline', desc:'+60 AD ou AP si CC subi depuis au plus un tour', kind:'reminder' },
        { id:'conq_ten_3', tier:'fondamentale', name:'Détermination', desc:'Devient enragé pour 2 tours (CD 5)', kind:'reminder' },
      ]},
    ]},
  { key:'domination', name:'Domination', color:'#e0463f', theme:'Avoir éliminé une cible durant la rencontre',
    capstone:'Burst → +50 Dcrit et 10 % Crit par kill (max 3) · Mobilité → +2 MS par kill (max 3) · Sadisme → effet +50 % par kill (max 3)',
    paths:[
      { key:'bur', name:'Burst', nodes:[
        { id:'domi_bur_1', tier:'mineure', name:'+10 % Crit', desc:'Bonus passif permanent', mods:{ crit:10 } },
        { id:'domi_bur_2', tier:'avancee', name:'Opportunité', desc:'+45 AD ou AP, +1 JA et +10 % Crit par tour sans attaquer (infini)', kind:'reminder' },
        { id:'domi_bur_3', tier:'fondamentale', name:'Explosivité', desc:"Double les dégâts d'une compétence (CD 5)", kind:'reminder' },
      ]},
      { key:'mob', name:'Mobilité', nodes:[
        { id:'domi_mob_1', tier:'mineure', name:'+1 MS et +1 JA', desc:'Bonus passif permanent', kind:'reminder' },
        { id:'domi_mob_2', tier:'avancee', name:'Altération gravitationnelle', desc:'+2 MS et 50 % esquive pour 2 tours (CD 5)', kind:'reminder' },
        { id:'domi_mob_3', tier:'fondamentale', name:'Déplacement éclair', desc:'+30 AD ou AP et +5 % Crit par MS bonus', kind:'reminder' },
      ]},
      { key:'sad', name:'Sadisme', nodes:[
        { id:'domi_sad_1', tier:'mineure', name:'+15 AD ou AP et 10 létalité', desc:'AD ou AP calculé ; létalité en rappel', mods:{ adp:15 } },
        { id:'domi_sad_2', tier:'avancee', name:'Écorchage', desc:"+30 létalité sur la cible (toute l'équipe si cible à 100 % HP)", kind:'reminder' },
        { id:'domi_sad_3', tier:'fondamentale', name:'Torture enivrante', desc:'Dégâts +50 % si cible ≤ 50 % HP, et 10 % Omni', kind:'reminder' },
      ]},
    ]},
  { key:'sorcellerie', name:'Sorcellerie', color:'#9d6bff', theme:'Avoir ≥ 50 % de son mana max',
    capstone:"Manifestation → contrôle du golem · Harmonie → bonus de stats liés à l'élément · Maîtrise → −1 CDR",
    paths:[
      { key:'man', name:'Manifestation', nodes:[
        { id:'sorc_man_1', tier:'mineure', name:'+100 Mana', desc:'Bonus passif permanent', mods:{ mana:100 } },
        { id:'sorc_man_2', tier:'avancee', name:'Densité arcanique/cosmique', desc:'Applique un CC de 1 tour selon la compétence (+50 mana)', kind:'reminder' },
        { id:'sorc_man_3', tier:'fondamentale', name:'Golem', desc:"Invoque un golem (HP/résistance/attaque selon l'élément, 1 fois)", kind:'reminder' },
      ]},
      { key:'har', name:'Harmonie élémentaire', nodes:[
        { id:'sorc_har_1', tier:'mineure', name:'+40 AP', desc:'Bonus passif permanent', mods:{ ap:40 } },
        { id:'sorc_har_2', tier:'avancee', name:'Compétence infuse', desc:"Change l'élément principal d'une compétence (CD 5)", kind:'reminder' },
        { id:'sorc_har_3', tier:'fondamentale', name:'Spécialité élémentaire accrue', desc:"Maîtrise de l'élément principal augmentée d'un rang", kind:'reminder' },
      ]},
      { key:'mai', name:'Maîtrise magique', nodes:[
        { id:'sorc_mai_1', tier:'mineure', name:'−1 CDR (sauf ultime)', desc:'Bonus passif permanent', kind:'reminder' },
        { id:'sorc_mai_2', tier:'avancee', name:'Aery', desc:'Compétence offensive → +10 % dégâts ; défensive → alliés affectés +10 % PV max en bouclier', kind:'reminder' },
        { id:'sorc_mai_3', tier:'fondamentale', name:'Approche versatile', desc:"Coût réduit de moitié si le sort précédent était d'un élément différent", kind:'reminder' },
      ]},
    ]},
  { key:'volonte', name:'Volonté', color:'#7bd07a', theme:'Avoir ≤ 50 % de ses PV max',
    capstone:'Durabilité → +25 % PV max · CC → +10 AR/RM et +50 HP par cible affectée · Sacrifice → coût en HP réduit de moitié',
    paths:[
      { key:'dur', name:'Durabilité', nodes:[
        { id:'vol_dur_1', tier:'mineure', name:'+10 AR et 10 RM', desc:'Bonus passif permanent', mods:{ armure:10, resmag:10 } },
        { id:'vol_dur_2', tier:'avancee', name:'Peau épineuse', desc:'+30 AR et 30 RM, renvoie 10 % des dégâts subis (renvoi en rappel)', mods:{ armure:30, resmag:30 } },
        { id:'vol_dur_3', tier:'fondamentale', name:'Immortalité éphémère', desc:'Bouclier = 50 % des HP max pour 2 tours (CD 5)', kind:'reminder' },
      ]},
      { key:'cc', name:'CC', nodes:[
        { id:'vol_cc_1', tier:'mineure', name:'+1 tour de CC', desc:'Bonus passif permanent', kind:'reminder' },
        { id:'vol_cc_2', tier:'avancee', name:'Plaquage / Pression', desc:'Immobilise une cible pour 1 tour (CD 5)', kind:'reminder' },
        { id:'vol_cc_3', tier:'fondamentale', name:'Neutralisation affaiblissante', desc:"Les CC que vous infligez réduisent l'AR et la RM de la cible de 25 %", kind:'reminder' },
      ]},
      { key:'sac', name:'Sacrifice', nodes:[
        { id:'vol_sac_1', tier:'mineure', name:'+100 HP', desc:'Bonus passif permanent', mods:{ hp:100 } },
        { id:'vol_sac_2', tier:'avancee', name:'Compétence à risque', desc:'Coûte 10 % des PV max par compétence, dégâts +20 %', kind:'reminder' },
        { id:'vol_sac_3', tier:'fondamentale', name:'Masochisme', desc:'+10 AR, +10 RM et +15 AD ou AP par usage de « Compétence à risque »', kind:'reminder' },
      ]},
    ]},
  { key:'inspiration', name:'Inspiration', color:'#8be0ff', theme:'Avoir soigné ou prévenu des dégâts sur un allié au tour précédent',
    capstone:"Amélioration → buffs/debuffs appliquent de nouveaux effets améliorés (à confirmer) · Partage → un CC peut être réassigné · Présage → jet de dé sur n'importe quelle action",
    paths:[
      { key:'ame', name:'Amélioration / Maléfice', nodes:[
        { id:'insp_ame_1', tier:'mineure', name:'+1 tour de buff/debuff', desc:'Bonus passif permanent', kind:'reminder' },
        { id:'insp_ame_2', tier:'avancee', name:'Aléatoire maîtrisé', desc:'Au début du combat, vous accorde un buff aléatoire', kind:'reminder' },
        { id:'insp_ame_3', tier:'fondamentale', name:'Influence augmentée', desc:'Buffs/maléfices augmentés de 25 %', kind:'reminder' },
      ]},
      { key:'par', name:'Partage', nodes:[
        { id:'insp_par_1', tier:'mineure', name:'+50 HP et 50 Mana', desc:'Bonus passif permanent', mods:{ hp:50, mana:50 } },
        { id:'insp_par_2', tier:'avancee', name:'Altruisme excessif', desc:'Une compétence ciblée peut transférer au choix 10 % de vos HP ou mana max (cible à confirmer)', kind:'reminder' },
        { id:'insp_par_3', tier:'fondamentale', name:'Échange', desc:'Un buff ou debuff peut être réassigné à une nouvelle cible (CD 3)', kind:'reminder' },
      ]},
      { key:'pre', name:'Présage', nodes:[
        { id:'insp_pre_1', tier:'mineure', name:'1 inspiration par séance', desc:'Bonus passif permanent', kind:'reminder' },
        { id:'insp_pre_2', tier:'avancee', name:'Brèche stratégique', desc:'La stratégie ennemie du tour suivant est divulguée (CD 5)', kind:'reminder' },
        { id:'insp_pre_3', tier:'fondamentale', name:'Retour temporel', desc:'Accordez un nouveau jet de dé à une de vos actions (CD 3)', kind:'reminder' },
      ]},
    ]},
];
```

- [ ] **Step 2 : Mettre à jour l'export de `data.jsx`**

Remplacer dans le `Object.assign(window, { … })` final `RUNE,` par `RUNES,` :

```js
  LEVELS, ATTRIBUTES, JOURNAL, RUNES, ITEM_CATALOG,
```

- [ ] **Step 3 : Retirer le bloc « Rune Domination » de `pages-ds.jsx`**

Supprimer entièrement le `<DSBlock title="Rune Domination" …> … </DSBlock>` (le bloc `RUNE.paths.map(...)`, ≈ lignes 113-132) — il référence `RUNE` qui n'existe plus.

- [ ] **Step 4 : Vérifier la syntaxe**

Run: `npx esbuild data.jsx >/dev/null && npx esbuild pages-ds.jsx >/dev/null && echo OK`
Expected: `OK`.

Run: `grep -rn "RUNE\b" *.jsx | grep -v RUNES` (doit ne rien renvoyer côté usage actif)
Expected: aucune référence à `RUNE` seul restante.

- [ ] **Step 5 : Commit**

```bash
git add data.jsx pages-ds.jsx
git commit -m "feat(runes): données RUNES (5 familles) + retrait du mock RUNE"
```

---

## Task 3 : Persistance `state/runes` (`data-state.jsx`)

**Files:**
- Modify: `data-state.jsx` (`useCharState`)

**Interfaces:**
- Consumes : `window.RTDB.updatePath`, `window.RTDB.setPath`.
- Produces : `useCharState(charId)` renvoie en plus `setRuneSelected(nodeId, on)`, `setRuneChoice(nodeId, choice)`, `resetRunes()`. `state.runes = { selected:{[id]:true}, choices:{[id]:'ad'|'ap'} }`.

- [ ] **Step 1 : Ajouter les setters**

Dans `data-state.jsx`, après la ligne `setCoin` de `useCharState` (≈ ligne 32-33), ajouter :

```js
  const setRuneSelected = useCallback((nodeId, on) =>
    window.RTDB.updatePath(`${charPath(charId)}/runes/selected`, { [nodeId]: on ? true : null }), [charId]);
  const setRuneChoice = useCallback((nodeId, choice) =>
    window.RTDB.updatePath(`${charPath(charId)}/runes/choices`, { [nodeId]: choice || null }), [charId]);
  const resetRunes = useCallback(() =>
    window.RTDB.setPath(`${charPath(charId)}/runes`, null), [charId]);
```

- [ ] **Step 2 : Exposer dans le `return`**

Remplacer la ligne `return { state, setField, setBuff, setMod, setInvItem, removeInvItem, setEquipment, setCoin };` par :

```js
  return { state, setField, setBuff, setMod, setInvItem, removeInvItem, setEquipment, setCoin,
    setRuneSelected, setRuneChoice, resetRunes };
```

- [ ] **Step 3 : Vérifier la syntaxe**

Run: `npx esbuild data-state.jsx >/dev/null && echo OK`
Expected: `OK`.

- [ ] **Step 4 : Commit**

```bash
git add data-state.jsx
git commit -m "feat(runes): persistance state/runes (setRuneSelected/Choice/resetRunes)"
```

---

## Task 4 : Page « Runes » (`pages-runes.jsx`) + CSS + routing

**Files:**
- Create: `pages-runes.jsx`
- Modify: `runeterra.css` (styles arbre)
- Modify: `index.html` (script + `PAGES`)
- Modify: `auth.js` (`PAGE_ACCESS`)
- Modify: `test/auth.test.js`

**Interfaces:**
- Consumes : `RUNES`, `buildRuneIndex`, `runeBudget`, `runeSpent`, `canSelectRune`, `canDeselectRune` (window) ; `useCharState`, `useToast`, `CHARACTERS`, `useState`.
- Produces : `window.RuneTreePage` (`<RuneTreePage lockedCharId={...} />`).

- [ ] **Step 1 : Styles de l'arbre dans `runeterra.css`**

Ajouter à la fin :

```css
/* ====== Arbre de runes ====== */
.rune-page { padding:20px 24px; }
.rune-head { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:18px; }
.rune-points { font-family:var(--font-mono); font-size:14px; color:var(--gold-pale); }
.rune-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
@media (max-width:1100px){ .rune-grid{ grid-template-columns:1fr; } }
.rune-family { border:1px solid var(--line); border-radius:10px; padding:14px; background:var(--bg-panel); }
.rune-family h3 { margin:0 0 4px; font-size:16px; }
.rune-family .theme { font-size:11px; color:var(--ink-faint); margin-bottom:12px; }
.rune-paths { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; align-items:start; }
.rune-path { display:flex; flex-direction:column; align-items:stretch; }
.rune-path .pname { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--ink-faint); margin-bottom:10px; text-align:center; min-height:28px; }
.rune-node { position:relative; border:1px solid var(--line-strong); border-radius:8px; padding:8px 6px; text-align:center; cursor:pointer; background:var(--bg-inset); transition:box-shadow .15s, background .15s, opacity .15s; }
.rune-node + .rune-node { margin-top:20px; }
.rune-node + .rune-node::before { content:''; position:absolute; top:-20px; left:50%; width:2px; height:20px; background:var(--line-strong); transform:translateX(-50%); }
.rune-node.locked { opacity:.4; cursor:not-allowed; }
.rune-node.available { box-shadow:0 0 0 1px var(--fam), 0 0 12px -3px var(--fam); }
.rune-node.selected { background:color-mix(in srgb, var(--fam) 22%, var(--bg-inset)); border-color:var(--fam); box-shadow:0 0 14px -2px var(--fam); }
.rune-node .ntier { font-size:9px; text-transform:uppercase; color:var(--ink-faint); letter-spacing:.05em; }
.rune-node .nname { font-size:12px; color:var(--ink); font-weight:600; line-height:1.2; }
.rune-node .ndesc { font-size:10px; color:var(--ink-faint); line-height:1.3; margin-top:3px; }
.rune-adp { display:inline-flex; gap:3px; margin-top:6px; }
.rune-adp button { font-size:10px; padding:1px 7px; border-radius:4px; border:1px solid var(--line-strong); background:var(--bg-panel-2); color:var(--ink-faint); cursor:pointer; }
.rune-adp button.on { background:var(--fam); color:#1a1410; border-color:var(--fam); font-weight:700; }
.rune-capstone { margin-top:12px; padding-top:10px; border-top:1px solid var(--fam); font-size:11px; color:var(--gold-pale); text-align:center; line-height:1.4; }
.rune-reminders { margin-top:22px; border-top:1px solid var(--line); padding-top:14px; }
.rune-reminders ul { margin:0; padding-left:18px; }
.rune-reminders li { font-size:12px; color:var(--ink); margin-bottom:5px; line-height:1.4; }
```

- [ ] **Step 2 : Créer `pages-runes.jsx`**

```jsx
/* ============================================================
   PAGE — ARBRE DE RUNES
   5 familles, sélection stricte (points = niveau), persistée
   temps réel (state/runes). Bonus plats -> stats ; conditionnel
   -> rappels. Contenu figé : RUNES (data.jsx).
   ============================================================ */
const RUNE_INDEX = buildRuneIndex(RUNES);

function RuneNode({ node, state, choice, onClick, onChoice }) {
  const isAdp = node.mods && node.mods.adp != null;
  return (
    <div className={'rune-node ' + state} title={node.desc}
      onClick={() => onClick(node)}>
      <div className="ntier">{node.tier}</div>
      <div className="nname">{node.name}</div>
      <div className="ndesc">{node.desc}</div>
      {isAdp && state === 'selected' && (
        <div className="rune-adp" onClick={(e) => e.stopPropagation()}>
          {['ad', 'ap'].map(k => (
            <button key={k} className={(choice || 'ad') === k ? 'on' : ''}
              onClick={() => onChoice(node.id, k)}>{k.toUpperCase()}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function RuneFamilyPanel({ family, nodeState, choices, onClick, onChoice }) {
  return (
    <div className="rune-family" style={{ '--fam': family.color }}>
      <h3 style={{ color: family.color }}>{family.name}</h3>
      <div className="theme">Thématique : {family.theme}</div>
      <div className="rune-paths">
        {family.paths.map(p => (
          <div className="rune-path" key={p.key}>
            <div className="pname">{p.name}</div>
            {p.nodes.map(n => (
              <RuneNode key={n.id} node={n} state={nodeState(n.id)}
                choice={choices[n.id]} onClick={onClick} onChoice={onChoice} />
            ))}
          </div>
        ))}
      </div>
      <div className="rune-capstone">{family.capstone}</div>
    </div>
  );
}

function RuneReminders({ selectedIds }) {
  const items = selectedIds.map(id => RUNE_INDEX[id]).filter(n => n && n.kind === 'reminder');
  if (!items.length) return null;
  return (
    <div className="rune-reminders">
      <div className="overline" style={{ marginBottom:8 }}>Rappels — effets à appliquer manuellement</div>
      <ul>{items.map(n => <li key={n.id}><b>{n.name}</b> — {n.desc}</li>)}</ul>
    </div>
  );
}

function RuneBody({ char }) {
  const { state, setRuneSelected, setRuneChoice, resetRunes } = useCharState(char.id);
  const toast = useToast();
  if (!state) return <div style={{ padding:40 }} className="dim">Chargement…</div>;
  const runes = state.runes || {};
  const selectedSet = runes.selected || {};
  const choices = runes.choices || {};
  const selectedIds = Object.keys(selectedSet).filter(id => selectedSet[id]);
  const budget = runeBudget(char.level);
  const spent = runeSpent(selectedIds, RUNE_INDEX);

  const nodeState = (id) => {
    if (selectedSet[id]) return 'selected';
    return canSelectRune(id, selectedIds, RUNE_INDEX, budget).ok ? 'available' : 'locked';
  };
  const onClick = (node) => {
    const id = node.id;
    if (selectedSet[id]) {
      const r = canDeselectRune(id, selectedIds, RUNE_INDEX);
      if (!r.ok) { toast(r.reason, 'gold'); return; }
      setRuneSelected(id, false);
      if (choices[id]) setRuneChoice(id, null);
    } else {
      const r = canSelectRune(id, selectedIds, RUNE_INDEX, budget);
      if (!r.ok) { toast(r.reason, 'gold'); return; }
      setRuneSelected(id, true);
    }
  };

  return (
    <div className="rune-page">
      <div className="rune-head">
        <div>
          <h2 style={{ fontSize:24 }}>Arbre de runes — {char.name}</h2>
          <span className="faint" style={{ fontSize:12 }}>Forgez votre légende</span>
        </div>
        <div className="row gap-3" style={{ alignItems:'center' }}>
          <span className="rune-points">Points : {spent}/{budget}</span>
          <button className="btn btn-sm btn-ghost" disabled={!selectedIds.length}
            onClick={() => { if (selectedIds.length) resetRunes(); }}>Réinitialiser</button>
        </div>
      </div>
      <div className="rune-grid">
        {RUNES.map(f => (
          <RuneFamilyPanel key={f.key} family={f} nodeState={nodeState}
            choices={choices} onClick={onClick} onChoice={setRuneChoice} />
        ))}
      </div>
      <RuneReminders selectedIds={selectedIds} />
    </div>
  );
}

function RuneTreePage({ lockedCharId }) {
  const [charId, setCharId] = useState(() => {
    if (lockedCharId) return lockedCharId;
    const id = localStorage.getItem('runeterra_identity');
    return (id && id !== 'mj' && CHARACTERS.some(c => c.id === id)) ? id : 'rathael';
  });
  const char = CHARACTERS.find(c => c.id === charId) || CHARACTERS[0];
  return (
    <div className="col" style={{ height:'100%', minHeight:0 }}>
      {!lockedCharId && (
        <div className="row" style={{ justifyContent:'flex-end', gap:8, alignItems:'center',
          padding:'8px 16px', borderBottom:'1px solid var(--line)', flex:'0 0 auto' }}>
          <span className="overline">Perso</span>
          <select value={charId} onChange={e => setCharId(e.target.value)}
            style={{ background:'var(--bg-inset)', color:'var(--ink)', border:'1px solid var(--line-strong)', borderRadius:6, padding:'7px 10px', fontSize:13 }}>
            {CHARACTERS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      <div style={{ flex:'1 1 auto', minHeight:0, overflow:'auto' }}>
        <RuneBody key={char.id} char={char} />
      </div>
    </div>
  );
}

Object.assign(window, { RuneTreePage });
```

- [ ] **Step 3 : Charger le script + enregistrer la page (`index.html`)**

Après `<script type="text/babel" src="pages-recap.jsx"></script>`, ajouter :

```html
<script type="text/babel" src="pages-runes.jsx"></script>
```

Dans `const PAGES = [ … ]`, ajouter avant `{ id:'admin', … }` :

```js
  { id:'runes',   label:'Runes',        render:(auth) => <RuneTreePage lockedCharId={auth.role === 'joueur' ? auth.charId : null} /> },
```

- [ ] **Step 4 : Accès 3 rôles (`auth.js`)**

Remplacer le bloc `PAGE_ACCESS` par :

```js
  const PAGE_ACCESS = {
    joueur: ['sheet', 'equip', 'inv', 'recap', 'runes'],
    mj:     ['lobby', 'mj', 'sheet', 'equip', 'journal', 'prog', 'ds', 'inv', 'recap', 'runes'],
    admin:  ['lobby', 'mj', 'sheet', 'equip', 'journal', 'prog', 'ds', 'inv', 'recap', 'runes', 'admin'],
  };
```

- [ ] **Step 5 : Mettre à jour `test/auth.test.js`**

Remplacer l'assertion `pagesForRole('joueur')` par la liste à jour et ajouter un test `runes` :

```js
  assert.deepEqual(A.pagesForRole('joueur'), ['sheet', 'equip', 'inv', 'recap', 'runes']);
```

Ajouter après le test « recap » :

```js
test("la page runes est visible par tous les roles", () => {
  assert.equal(A.canSeePage('runes', 'joueur'), true);
  assert.equal(A.canSeePage('runes', 'mj'), true);
  assert.equal(A.canSeePage('runes', 'admin'), true);
});
```

- [ ] **Step 6 : Vérifier syntaxe + tests + visuel**

Run: `npx esbuild pages-runes.jsx >/dev/null && echo OK`
Expected: `OK`.

Run: `node --test test/auth.test.js`
Expected: PASS.

Servir le site, onglet **Runes** : 5 familles affichées ; cliquer une Mineure (disponible) → sélectionnée, compteur passe à `1/2` ; l'Avancée de la même voie devient disponible ; tenter une 3e dépense au-delà du budget → refus + toast ; toggle AD/AP sur une rune « AD ou AP » sélectionnée ; « Réinitialiser » vide la sélection ; (MJ) le sélecteur de perso change de fiche.
Expected: comportement conforme, pas d'erreur console.

- [ ] **Step 7 : Commit**

```bash
git add pages-runes.jsx runeterra.css index.html auth.js test/auth.test.js
git commit -m "feat(runes): page Arbre de runes (sélection stricte, points, respec, rappels)"
```

---

## Task 5 : Intégration aux stats (`sumRuneMods` + `mergeMods`)

**Files:**
- Modify: `pages-sheet.jsx`, `pages-mj.jsx`, `pages-equip.jsx`

**Interfaces:**
- Consumes : `sumRuneMods`, `mergeMods`, `sumItemMods`, `computeEffective` (window).

- [ ] **Step 1 : Fiche joueur (`pages-sheet.jsx`)**

Remplacer :

```jsx
  const itemMods = sumItemMods(state.equipment, state.inventory);
  const eff = computeEffective(char.stats, state.modifiers, activeBuffs, itemMods);
```

par :

```jsx
  const itemMods = sumItemMods(state.equipment, state.inventory);
  const runesSt  = state.runes || {};
  const runeMods = sumRuneMods(Object.keys(runesSt.selected || {}).filter(id => runesSt.selected[id]),
    runesSt.choices || {}, buildRuneIndex(RUNES));
  const eff = computeEffective(char.stats, state.modifiers, activeBuffs, mergeMods(itemMods, runeMods));
```

- [ ] **Step 2 : Dashboard MJ (`pages-mj.jsx`, `mjLive`)**

Remplacer :

```jsx
  const itemMods = st ? sumItemMods(st.equipment, st.inventory) : {};
  const eff = computeEffective(c.stats, st ? st.modifiers : c.modifiers, buffs, itemMods);
```

par :

```jsx
  const itemMods = st ? sumItemMods(st.equipment, st.inventory) : {};
  const runesSt  = (st && st.runes) || {};
  const runeMods = st ? sumRuneMods(Object.keys(runesSt.selected || {}).filter(id => runesSt.selected[id]),
    runesSt.choices || {}, buildRuneIndex(RUNES)) : {};
  const eff = computeEffective(c.stats, st ? st.modifiers : c.modifiers, buffs, mergeMods(itemMods, runeMods));
```

- [ ] **Step 3 : Équipement (`pages-equip.jsx`)**

Remplacer :

```jsx
  const bonuses = sumItemMods(equipment, itemsById);   // sert à colorer en vert les stats boostées
  const eff = computeEffective(char.stats, state.modifiers, activeBuffs, bonuses);
```

par :

```jsx
  const runesSt  = state.runes || {};
  const runeMods = sumRuneMods(Object.keys(runesSt.selected || {}).filter(id => runesSt.selected[id]),
    runesSt.choices || {}, buildRuneIndex(RUNES));
  const bonuses = mergeMods(sumItemMods(equipment, itemsById), runeMods);  // items + runes -> vert
  const eff = computeEffective(char.stats, state.modifiers, activeBuffs, bonuses);
```

- [ ] **Step 4 : Vérifier syntaxe + tests + visuel**

Run: `for f in pages-sheet.jsx pages-mj.jsx pages-equip.jsx; do npx esbuild "$f" >/dev/null && echo "OK $f"; done`
Expected: trois `OK`.

Run: `node --test test/game-logic.test.js test/auth.test.js`
Expected: PASS.

Servir le site : sélectionner « Conquérant → Sustain → +50 HP et 10 % Omni » sur un perso → sa fiche et le dashboard MJ montrent **+50 PV max** (et la page Équipement l'allume en vert). Désélectionner → revient à la normale.
Expected: bonus plats reflétés partout, conditionnel jamais appliqué.

- [ ] **Step 5 : Commit**

```bash
git add pages-sheet.jsx pages-mj.jsx pages-equip.jsx
git commit -m "feat(runes): bonus plats des runes injectés dans computeEffective (fiche/MJ/équip)"
```

---

## Task 6 : Documentation (`CLAUDE.md`)

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1 : Carte des fichiers**

Après l'entrée `pages-recap.jsx`, ajouter :

```
- `pages-runes.jsx` — onglet **Runes** (`RuneTreePage`) : arbre des 5 familles (data `RUNES`),
  sélection stricte (points = niveau, ordre Mineure→Avancée→Fondamentale), persistée `state/runes`
  (`setRuneSelected`/`setRuneChoice`/`resetRunes`). Bonus plats via `sumRuneMods`+`mergeMods` →
  `computeEffective` (fiche/MJ/équip) ; conditionnel/actif en panneau « Rappels ». Toggle AD/AP
  (clé `adp`). Visible des 3 rôles, sélecteur de perso pour le staff. Logique pure dans `game-logic.js`.
```

- [ ] **Step 2 : Modèle de données + décisions + état**

Sous le bloc Firebase `state/`, ajouter une ligne :

```
    runes:     { selected:{[nodeId]:true}, choices:{[nodeId]:'ad'|'ap'} }   ← arbre de runes (page Runes)
```

Dans « Décisions figées », ajouter :

```
- **Arbre de runes** : contenu figé (`RUNES`, data.jsx, issu de l'Excel — DA convertie en « AD ou AP »
  à la moyenne). Effets **hybrides** : bonus plats calculés (computeEffective), conditionnel/actif en
  rappels. Points = niveau, ordre strict, respec libre. Source de règles : `info-mj/Système de Runes.md`.
```

Dans « État actuel », ajouter en tête :

```
- **Arbre de runes (page Runes)** : fait. `RUNES` (5 familles) + logique pure testée + persistance
  `state/runes` + page interactive + intégration stats. Aucune règle RTDB. À confirmer MJ : capstone vs
  thématique, 2 cellules tronquées (Inspiration).
```

- [ ] **Step 3 : Commit**

```bash
git add CLAUDE.md
git commit -m "docs: page Arbre de runes (mémoire projet)"
```

---

## Self-Review (effectuée)

- **Couverture du spec** : données `RUNES` (T2) ; logique pure budget/ordre/mods (T1) ; persistance (T3) ;
  page + sélection stricte + points + respec + sélecteur perso + rappels + toggle AD/AP (T4) ; intégration
  stats aux 3 sites (T5) ; routing/accès 3 rôles (T4) ; doc (T6). Cas limites (0 point, dépassement, ordre,
  désélection prérequis, `runes` absent) couverts par la logique T1 + l'UI T4. ✔
- **Placeholders** : aucun ; tout le code et les données sont fournis.
- **Cohérence des types** : `buildRuneIndex` (T1) consommé par `sumRuneMods`/`canSelectRune` (T1) et par
  l'UI (T4) et l'intégration stats (T5) ; `mergeMods(itemMods, runeMods)` (T5) ; `state.runes.selected/choices`
  (T3) lus en T4/T5 ; clé `adp` résolue via `choices` partout. Setters `setRuneSelected/Choice`/`resetRunes`
  (T3) utilisés en T4. ✔
- **Note** : `buildRuneIndex(RUNES)` est recalculé à chaque rendu en T5 (3 sites) — acceptable (18 nœuds),
  optimisable plus tard via un index partagé exporté si besoin.
