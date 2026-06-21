# Onglet « Combat » + attaque de base — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour implémenter ce plan tâche par tâche. Steps en cases `- [ ]`.

**Goal:** Intégrer l'attaque de base au flux d'attaques en attente (cible → MJ, crit roulé, journalisé), renommer l'onglet en « Combat », corriger la prise en compte des variables d'attaque et générer une carte par coup.

**Architecture:** Tout se passe dans `pages-competences.jsx` (onglet renommé) : `ActiveCard` remonte son contexte d'attaque (`ctx`, `dmg`, `nbHits`) à `cast()`, qui garde « pas de cible », et boucle pour créer N attaques en attente (chacune son `rollCrit`). Une carte « Attaque de base » réutilise le même flux. La fiche perd l'action d'attaque (modale `AttackModal` + `computeAttack` supprimés).

**Tech Stack:** Zéro-build (React 18 + Babel standalone CDN), UMD + `Object.assign(window,…)`, tests `node --test`, vérif syntaxe `npx esbuild fichier >/dev/null`.

## Global Constraints

- **Zéro-build** : chaque fichier définit localement puis `Object.assign(window, {…})`. Ordre de chargement : `game-logic.js` → `data.jsx` → `data-state.jsx` → `components.jsx` → `pages-*.jsx`.
- **Aucune règle RTDB** : flux `combat/pendingHits` inchangé (schéma déjà étendu au sous-projet précédent).
- **Garde « pas de cible »** : une action à dégâts (`sk.dmg != null` ou attaque de base) sans `targetId` → toast d'avertissement + abandon **avant** toute consommation de mana/cooldown.
- **id de page inchangé** : l'entrée `PAGES` garde `id:'competences'` (routage/permissions), seul le `label` devient « Combat ».
- **Vérif syntaxe** après tout edit `.jsx` : `npx esbuild <fichier> >/dev/null`.
- Source : `docs/superpowers/specs/2026-06-22-onglet-combat-design.md`.

---

## Fichiers touchés

- `index.html` — **Modify** : `PAGES` label `Compétences` → `Combat`.
- `pages-competences.jsx` — **Modify** : titre, `ActiveCard.onCast`, `cast()` (garde + vars + multi-coups), nouvelle carte « Attaque de base ».
- `pages-sheet.jsx` — **Modify** : `CombatColumn` (retrait action), retrait état/usage `AttackModal`.
- `components.jsx` — **Modify** : suppression `AttackModal` + export.
- `data.jsx` — **Modify** : suppression `computeAttack` + export.
- `CLAUDE.md` — **Modify** : doc.

---

## Task 1 : Renommer l'onglet en « Combat »

**Files:**
- Modify: `index.html` (`PAGES`, ~ligne 117)
- Modify: `pages-competences.jsx` (titre, ~ligne 231)

- [ ] **Step 1 : Renommer le libellé de menu**

Dans `index.html`, remplacer :
```jsx
  { id:'competences', label:'Compétences', render:(auth) => <CompetencesPage lockedCharId={auth.role === 'joueur' ? auth.charId : null} /> },
```
par :
```jsx
  { id:'competences', label:'Combat', render:(auth) => <CompetencesPage lockedCharId={auth.role === 'joueur' ? auth.charId : null} /> },
```

- [ ] **Step 2 : Renommer le titre de page**

Dans `pages-competences.jsx`, remplacer :
```jsx
        <h2 style={{ fontSize: 20 }}>Compétences — {char.name}</h2>
```
par :
```jsx
        <h2 style={{ fontSize: 20 }}>Combat — {char.name}</h2>
```

- [ ] **Step 3 : Vérifier la syntaxe**

Run: `npx esbuild pages-competences.jsx >/dev/null && echo OK`
Expected: `OK`.

- [ ] **Step 4 : Commit**

```bash
git add index.html pages-competences.jsx
git commit -m "feat(combat): renomme l'onglet Compétences en « Combat »"
```

---

## Task 2 : `cast` — variables d'attaque, garde cible, multi-coups

**Files:**
- Modify: `pages-competences.jsx` (`ActiveCard` `onCast` ~138 + appel ~281 ; `cast` ~179-226)

**Interfaces:**
- Consumes: `rollCrit(critPct, dcrit)` (déjà sur `window`), `addHit`, `pushLog`, `toast`.
- Produces: `cast(sk, ctx, dmgArg, nbHits)` — `ctx` = `{...baseCtx, ...vars}`, `dmgArg` = dégâts/cible déjà calculés par la carte, `nbHits` = nombre de coups (≥1).

- [ ] **Step 1 : `ActiveCard` remonte le contexte au cast (bouton « Lancer », ~138)**

Dans `pages-competences.jsx`, remplacer :
```jsx
          <button className="btn btn-gold" onClick={onCast} disabled={!ready || !enoughMana}
            title={!enoughMana ? 'Pas assez de mana' : (!ready ? 'En cooldown' : '')}>Lancer</button>
```
par :
```jsx
          <button className="btn btn-gold" onClick={() => onCast(ctx, dmg, needed.includes('nbTargets') ? Math.max(1, vars.nbTargets || 1) : 1)} disabled={!ready || !enoughMana}
            title={!enoughMana ? 'Pas assez de mana' : (!ready ? 'En cooldown' : '')}>Lancer</button>
```

- [ ] **Step 2 : Adapter l'appel `onCast` du parent (~281)**

Remplacer :
```jsx
            manaCur={state.manaCur || 0} onCast={() => cast(sk)}
```
par :
```jsx
            manaCur={state.manaCur || 0} onCast={(ctx, dmg, nbHits) => cast(sk, ctx, dmg, nbHits)}
```

- [ ] **Step 3 : Réécrire `cast` (garde cible + vars + boucle multi-coups, ~179-226)**

Remplacer **tout** le bloc `function cast(sk) { … }` (de la ligne `function cast(sk) {` jusqu'à sa `}` fermante, juste avant `return (`) par :
```jsx
  function cast(sk, ctx, dmgArg, nbHits) {
    ctx = ctx || baseCtx;
    nbHits = Math.max(1, nbHits || 1);
    const cost = sk.mana || 0;
    const skIndex = kit.actives.indexOf(sk);
    if (!skillUnlocked(skIndex, level)) {
      toast(`<b>${char.name}</b> — ${sk.name} se débloque au niveau ${skIndex + 1}`, 'gold');
      return;
    }
    // Dégâts/cible (réutilise le calcul de la carte ; repli si appel sans dmgArg).
    const dmg = sk.dmg ? (dmgArg != null ? dmgArg : sk.dmg(eff, ctx)) : null;
    // Garde « pas de cible » : une action à dégâts exige une cible (avant toute dépense).
    if (dmg != null && !targetId) {
      toast(`<b>${char.name}</b> — choisis une cible d'abord`, 'gold');
      return;
    }
    const manaCur = state.manaCur || 0;
    if (manaCur < cost) { toast(`<b>${char.name}</b> — pas assez de mana (${manaCur}/${cost})`, 'gold'); return; }
    setField('manaCur', manaCur - cost);
    if (sk.kind === 'combat') setCooldown(sk.id, CD_LOCKED);
    else setCooldown(sk.id, nextReadyAt(turn, sk.kind === 'turn' ? 1 : sk.cd));
    const logParts = []; // effets appliqués au lanceur, agrégés en une entrée de journal
    // Buff sur soi : snapshot des mods plats (% de la stat de base) → effet de combat orange.
    if (sk.selfBuff) {
      const flat = {};
      Object.keys(sk.selfBuff).forEach(k => { const f = Math.round(sk.selfBuff[k] * (base[k] || 0)); if (f) flat[k] = f; });
      setSkillBuff(sk.id, flat);
      if (flat.hp) {
        const newMax = (eff.hp || 0) + flat.hp;
        setField('hpCur', Math.min((state.hpCur || 0) + flat.hp, newMax));
      }
      logParts.push(flat.hp ? `+${flat.hp} PV` : 'effet de combat');
      toast(`<b>${char.name}</b> — ${sk.name} actif (effet de combat)`, 'gold');
    }
    // Bouclier au cast (one-shot, ajouté au pool).
    if (sk.shield) {
      const sh = sk.shield(eff, ctx);
      if (sh) { setField('shield', (state.shield || 0) + sh); logParts.push(`+${sh} bouclier`); toast(`<b>${char.name}</b> gagne ${sh} bouclier`, 'gold'); }
    }
    // Comp à dégâts + cible → N attaques en attente (un coup = une carte ; chacune son crit).
    if (dmg != null && targetId) {
      let anyCrit = false;
      for (let i = 0; i < nbHits; i++) {
        const cr = rollCrit(eff.crit || 0, eff.dcrit || 0);
        if (cr.didCrit) anyCrit = true;
        addHit({ attackerId: char.id, attackerName: char.name, skillId: sk.id, skillName: sk.name,
          type: (ctx.wType === 'Magique' || wType === 'Magique' ? 'magique' : 'physique'),
          computedDmg: dmg, critDmg: Math.round(dmg * cr.multiplier), didCrit: cr.didCrit,
          critMult: cr.multiplier, letha: eff.letha || 0, crit: eff.crit || 0, dcrit: eff.dcrit || 0, targetId });
      }
      const tgt = enemies.find(en => en.id === targetId);
      const suffix = nbHits > 1 ? ` ×${nbHits}` : '';
      pushLog(`<b>${char.name}</b> vise <b>${tgt ? tgt.name : 'un ennemi'}</b> avec <b>${sk.name}</b>${suffix} (${dmg}/coup${anyCrit ? ' — CRIT !' : ''}) — en attente MJ`, anyCrit ? 'buff' : 'gold');
      toast(`<b>${char.name}</b> — ${sk.name} : ${nbHits} coup(s) envoyé(s) au MJ`, 'buff');
    } else {
      pushLog(`<b>${char.name}</b> lance <b>${sk.name}</b>${logParts.length ? ' — ' + logParts.join(', ') : ''}`, logParts.length ? 'buff' : 'gold');
      toast(`<b>${char.name}</b> lance ${sk.name}`, 'buff');
    }
  }
```

- [ ] **Step 4 : Vérifier la syntaxe**

Run: `npx esbuild pages-competences.jsx >/dev/null && echo OK`
Expected: `OK`.

- [ ] **Step 5 : Commit**

```bash
git add pages-competences.jsx
git commit -m "fix(combat): cast respecte les variables d'attaque + garde cible + multi-coups (N cartes)"
```

---

## Task 3 : Carte « Attaque de base » dans l'onglet Combat

**Files:**
- Modify: `pages-competences.jsx` (`CompetencesBody` : handler + carte, après le bandeau cible / avant `PassiveCard`)

**Interfaces:**
- Consumes: `rollCrit`, `addHit`, `pushLog`, `toast`, `weaponTypeOf`, `WEAPONS`, `eff`, `state`, `targetId`, `enemies` (tous dans le scope de `CompetencesBody`).

- [ ] **Step 1 : Ajouter le handler `basicAttack` dans `CompetencesBody`**

Dans `pages-competences.jsx`, juste après la fin de la fonction `cast` (sa `}` fermante, avant `return (`), ajouter :
```jsx
  // Attaque de base : même flux que les comps (cible → attaque en attente MJ), sans mana ni cooldown.
  const eqWeaponName = (() => {
    const eqId = state.equipment && state.equipment.armePrincipale;
    const it = (eqId && state.inventory) ? state.inventory[eqId] : null;
    return (it && it.name) || (WEAPONS.find(w => w.id === char.weaponId) || {}).name || 'Arme';
  })();
  const basicDmg = (wType === 'Magique' ? (eff.ap || 0) : (eff.ad || 0));
  function basicAttack() {
    if (!targetId) { toast(`<b>${char.name}</b> — choisis une cible d'abord`, 'gold'); return; }
    const cr = rollCrit(eff.crit || 0, eff.dcrit || 0);
    const critDmg = Math.round(basicDmg * cr.multiplier);
    addHit({ attackerId: char.id, attackerName: char.name, skillId: 'basic', skillName: 'Attaque de base',
      type: (wType === 'Magique' ? 'magique' : 'physique'), computedDmg: basicDmg, critDmg,
      didCrit: cr.didCrit, critMult: cr.multiplier, letha: eff.letha || 0, crit: eff.crit || 0, dcrit: eff.dcrit || 0, targetId });
    const tgt = enemies.find(en => en.id === targetId);
    const shown = cr.didCrit ? `${critDmg} — CRITIQUE !` : `${basicDmg}`;
    pushLog(`<b>${char.name}</b> attaque <b>${tgt ? tgt.name : 'un ennemi'}</b> (${shown}) — en attente MJ`, cr.didCrit ? 'buff' : 'gold');
    toast(`<b>${char.name}</b> attaque (${shown}) — envoyé au MJ`, 'buff');
  }
```

- [ ] **Step 2 : Rendre la carte (après le bloc « Effets de combat actifs », avant `<PassiveCard …/>`)**

Dans le `return (...)`, juste avant la ligne `<PassiveCard kit={kitWithId} …/>`, insérer :
```jsx
      <div className="panel" style={{ borderLeft: '3px solid var(--gold)' }}>
        <div className="panel-head">
          <h3>⚔ Attaque de base</h3>
          <span className="overline">{eqWeaponName} · {wType === 'Magique' ? 'AP' : 'AD'}</span>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 14px' }}>
          <span className="mono" style={{ fontSize: 22, color: 'var(--hp)', fontWeight: 700 }}>
            {basicDmg}<span style={{ fontSize: 12, color: 'var(--faint)' }}> dégâts</span>
          </span>
          <button className="btn btn-gold" onClick={basicAttack}>Attaquer</button>
        </div>
      </div>
```

- [ ] **Step 3 : Vérifier la syntaxe**

Run: `npx esbuild pages-competences.jsx >/dev/null && echo OK`
Expected: `OK`.

- [ ] **Step 4 : Commit**

```bash
git add pages-competences.jsx
git commit -m "feat(combat): carte Attaque de base (cible → attaque en attente MJ)"
```

---

## Task 4 : Fiche — retirer l'action d'attaque (garder l'info arme)

**Files:**
- Modify: `pages-sheet.jsx` (`CombatColumn` ~178-216 ; état `modal`/prop `onAttack`/usage `AttackModal` ~283, ~338, ~345)

- [ ] **Step 1 : Nettoyer `CombatColumn` (retirer léthalité 0-3 + bouton attaque)**

Dans `pages-sheet.jsx`, dans `CombatColumn`, remplacer le bloc qui va de `const [lethality, setLethality] = useState(char.lethality);` jusqu'au bouton d'attaque par une version sans léthalité ni bouton. Concrètement :

1. Supprimer la ligne :
```jsx
  const [lethality, setLethality] = useState(char.lethality);
```
2. Supprimer le bloc léthalité (commentaire `{/* léthalité */}` + les deux `div` jusqu'à la fin des boutons `[0,1,2,3].map`) :
```jsx
          {/* léthalité */}
          <div className="row" style={{ justifyContent:'space-between', marginBottom:7 }}>
            <span className="overline">Léthalité</span>
            <span className="faint" style={{ fontSize:11 }}>{['Aucune','Physique','Magique','Phys. & Mag.'][lethality]}</span>
          </div>
          <div className="row gap-2" style={{ marginBottom:16 }}>
            {[0,1,2,3].map(l => (
              <button key={l} onClick={() => setLethality(l)} className={'btn btn-sm' + (l === lethality ? ' btn-gold' : ' btn-ghost')} style={{ flex:1, justifyContent:'center' }}>{l}</button>
            ))}
          </div>
```
3. Supprimer le bouton d'attaque :
```jsx
          <button className="btn btn-gold btn-lg" style={{ width:'100%', justifyContent:'center' }} onClick={onAttack}>⚔ Lancer une attaque</button>
```

Le panneau « Arme équipée » (icône, nom, type, **Dégâts estimés**) reste en place.

- [ ] **Step 2 : Retirer le prop `onAttack` de la signature `CombatColumn`**

Repérer la déclaration `function CombatColumn({ … onAttack … })` et retirer `onAttack` de la liste des props (les autres props restent).

- [ ] **Step 3 : Retirer l'état `modal` et l'usage `AttackModal` (corps de la fiche)**

1. Supprimer :
```jsx
  const [modal, setModal] = useState(false);
```
2. Retirer le prop `onAttack={() => setModal(true)}` de l'appel `<CombatColumn … />` (~338). Exemple : `<CombatColumn char={char} weapon={equippedWeapon} eff={eff} onAttack={() => setModal(true)}` → `<CombatColumn char={char} weapon={equippedWeapon} eff={eff}` (conserver les autres props de la balise).
3. Supprimer la ligne :
```jsx
      {modal && <AttackModal char={char} onClose={() => setModal(false)} />}
```

- [ ] **Step 4 : Vérifier la syntaxe**

Run: `npx esbuild pages-sheet.jsx >/dev/null && echo OK`
Expected: `OK`.

- [ ] **Step 5 : Commit**

```bash
git add pages-sheet.jsx
git commit -m "feat(combat): fiche — retrait de l'action d'attaque (info arme conservée)"
```

---

## Task 5 : Supprimer `AttackModal` + `computeAttack` (code mort)

**Files:**
- Modify: `components.jsx` (composant `AttackModal` + export ~785)
- Modify: `data.jsx` (`computeAttack` + export ~424)

- [ ] **Step 1 : Vérifier l'absence d'autre usage**

Run: `grep -rn "AttackModal\|computeAttack" *.jsx *.js index.html`
Expected: uniquement les définitions/exports dans `components.jsx` et `data.jsx` (plus aucune utilisation après Task 4).

- [ ] **Step 2 : Supprimer le composant `AttackModal` (components.jsx)**

Supprimer entièrement la fonction `function AttackModal({ char, onClose }) { … }` (du commentaire `/* --- Modal d'attaque … */` jusqu'à sa `}` fermante). Dans le bloc `Object.assign(window, { … })`, retirer `AttackModal,` de la liste d'export.

- [ ] **Step 3 : Supprimer `computeAttack` (data.jsx)**

Supprimer entièrement `function computeAttack({ … }) { … }` (avec son commentaire). Dans `Object.assign(window, { computeAttack, computeAttack? … })`, retirer `computeAttack,` de l'export.

- [ ] **Step 4 : Vérifier syntaxe + absence de résidu + tests**

Run:
```bash
npx esbuild components.jsx >/dev/null && npx esbuild data.jsx >/dev/null && echo "esbuild OK"
grep -rn "AttackModal\|computeAttack" *.jsx *.js index.html || echo "aucun résidu"
node --test test/game-logic.test.js test/auth.test.js
```
Expected: `esbuild OK`, `aucun résidu`, tous les tests PASS.

- [ ] **Step 5 : Commit**

```bash
git add components.jsx data.jsx
git commit -m "chore(combat): supprime AttackModal + computeAttack (remplacés par le flux Combat)"
```

---

## Task 6 : Documentation + vérification finale

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1 : Mettre à jour CLAUDE.md**

- Dans la carte des fichiers, entrée `index.html` : noter que l'onglet `competences` a pour libellé **« Combat »**.
- Entrée `pages-competences.jsx` : préciser que l'onglet (libellé **« Combat »**) contient une **carte « Attaque de base »** (cible → attaque en attente MJ, sans mana/cooldown), que `cast` **respecte les variables d'attaque** (1er coup/camouflé/cases/cibles) et qu'une comp à **N cibles génère N attaques en attente** (un coup = une carte). **Garde « pas de cible »** sur toute action à dégâts.
- Entrée `pages-sheet.jsx` : l'action d'attaque est **retirée** (déplacée dans l'onglet Combat) ; le panneau « Arme équipée » reste en info.
- Entrée `components.jsx` : retirer la mention `AttackModal`. Entrée `data.jsx` : retirer `computeAttack`.
- Section « Décisions figées » ou « État actuel » : ajouter une ligne — attaque de base unifiée au flux d'attaques en attente, onglet renommé « Combat ».

- [ ] **Step 2 : Vérification finale complète**

Run:
```bash
node --test test/game-logic.test.js test/auth.test.js
for f in pages-competences.jsx pages-sheet.jsx components.jsx data.jsx; do npx esbuild "$f" >/dev/null && echo "OK $f"; done
```
Expected: tous les tests PASS + `OK` pour les 4 fichiers.

- [ ] **Step 3 : Vérification visuelle (manuelle, à signaler à l'utilisateur)**

Servir l'app (`python -m http.server 5050 --bind 127.0.0.1`). Vérifier : menu affiche **« Combat »** ; onglet Combat a la carte **Attaque de base** → « Attaquer » sans cible = **toast d'avertissement**, avec cible = attaque en attente côté MJ (crit éventuel) ; une comp à plusieurs **cibles** crée **plusieurs cartes** MJ, chacune se ferme à l'application ; les variables (1er coup/camouflé/cases) **modifient** les dégâts envoyés ; la **fiche** n'a plus de bouton d'attaque mais montre toujours l'arme équipée.

- [ ] **Step 4 : Commit**

```bash
git add CLAUDE.md
git commit -m "docs(combat): onglet Combat + attaque de base (CLAUDE.md)"
```

---

## Self-review (couverture spec)

- **Renommage onglet** → Task 1.
- **Attaque de base dans Combat (cible → MJ, sans mana/cd)** → Task 3.
- **Fiche : retrait action, info arme conservée** → Task 4.
- **Suppression AttackModal/computeAttack** → Task 5.
- **Fix variables d'attaque dans cast** → Task 2 (Step 1-3).
- **Multi-coups (N cartes, crit indépendant)** → Task 2 (Step 3, boucle `nbHits`).
- **Garde « pas de cible »** → Task 2 (cast) + Task 3 (attaque de base).
- **Une carte = un coup, se ferme à l'application** → déjà via `removeHit` (sous-projet précédent) ; chaque coup = un hit distinct (Task 2).
- **Aucune règle RTDB** → respecté.
