# Hub d'accueil — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la page Accueil mockup par un hub d'atterrissage : carrousel coverflow 3D des personnages (barres PV/mana/bouclier, bio), accès rapides, et mémorial des morts.

**Architecture :** Logique pure de positionnement du carrousel dans `game-logic.js` (testée). Routing ajusté dans `auth.js`. Données statiques `bio`/`MEMORIAL`/`PORTRAITS` dans `data.jsx`. UI dans `pages-lobby.jsx` (`HubPage` + `CharCarousel` + `MemorialSection`). Styles 3D dans `runeterra.css`.

**Tech Stack :** React 18 + Babel standalone via CDN (zéro-build), Firebase RTDB compat, `node --test`, `npx esbuild`.

## Global Constraints

- **Zéro-build** : chaque fichier définit ses fonctions localement PUIS `Object.assign(window, { ... })`. Toute nouvelle fonction/constante exportée doit y être ajoutée. L'ordre de chargement dans `index.html` compte (`game-logic.js` → `data.jsx` → `data-state.jsx` → `components.jsx` → `pages-*.jsx`).
- **Aucune nouvelle règle RTDB, aucun changement de schéma Firebase.** Lectures existantes seulement.
- **Contrainte de lecture (Option C)** : un joueur ne peut lire que sa propre fiche. `useAllCharStates()` (lit `campaign/characters`) renvoie `null` pour un joueur (lecture refusée, non fatale). Donc : staff = barres live des 5 ; joueur = sa carte live, les autres en barres vides.
- **UI en français.** Portraits dans `ATH/Perso/*.webp` (mapping par id, pas par nom).
- **Cache-busting au déploiement** : bumper `?v=…` + `window.APPV` dans `index.html` (dernière tâche).
- **Tests** : `node --test test/game-logic.test.js test/auth.test.js` verts ; `npx esbuild <fichier>.jsx >/dev/null` sur les `.jsx` modifiés.

---

### Task 1 : `carouselTransforms` — positionnement coverflow (logique pure)

**Files:**
- Modify: `game-logic.js` (ajouter la fonction + l'export)
- Test: `test/game-logic.test.js`

**Interfaces:**
- Produces: `carouselTransforms(count, activeIndex)` → tableau de longueur `count` de `{ offset, rotateY, translateZ, scale, opacity, zIndex }`. `offset` = distance signée la plus courte autour de l'anneau (wrap). Carte active (offset 0) : `rotateY 0, translateZ 0, scale 1, opacity 1, zIndex = count`.

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter à la fin de `test/game-logic.test.js` :

```javascript
test('carouselTransforms : carte active centrée, voisins symétriques, wrap', () => {
  const t = L.carouselTransforms(5, 0);
  assert.equal(t.length, 5);
  // carte active
  assert.equal(t[0].offset, 0);
  assert.equal(t[0].rotateY, 0);
  assert.equal(t[0].scale, 1);
  assert.equal(t[0].opacity, 1);
  assert.equal(t[0].zIndex, 5);
  // voisins immédiats : offset +1 (index 1) et -1 (index 4 via wrap)
  assert.equal(t[1].offset, 1);
  assert.equal(t[4].offset, -1);
  // symétrie de l'angle gauche/droite
  assert.equal(t[1].rotateY, -t[4].rotateY);
  // l'active a l'échelle maximale
  assert.ok(t[0].scale >= t[1].scale);
});
test('carouselTransforms : active = dernier index, wrap correct', () => {
  const t = L.carouselTransforms(5, 4);
  assert.equal(t[4].offset, 0);
  assert.equal(t[0].offset, 1);   // 0-4=-4 → +5 = 1
  assert.equal(t[3].offset, -1);
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run : `node --test test/game-logic.test.js`
Expected : FAIL (`L.carouselTransforms is not a function`).

- [ ] **Step 3 : Implémenter `carouselTransforms`**

Ajouter dans `game-logic.js` (près des autres helpers purs, ex. après `statBreakdown`) :

```javascript
  /* Positionnement coverflow 3D d'un carrousel circulaire : pour chaque carte, l'offset signé le
     plus court par rapport à la carte active (avec wrap autour de l'anneau) → transform 3D.
     Carte active : face, centrée, pleine ; voisines : tournées/reculées/atténuées. */
  function carouselTransforms(count, activeIndex) {
    count = Math.max(1, count | 0);
    var out = [];
    for (var i = 0; i < count; i++) {
      var off = i - activeIndex;
      while (off > count / 2) off -= count;
      while (off < -count / 2) off += count;
      var abs = Math.abs(off);
      out.push({
        offset: off,
        rotateY: off * -35,
        translateZ: -abs * 120,
        scale: Math.max(0.6, 1 - abs * 0.18),
        opacity: abs > 2 ? 0 : Math.max(0.35, 1 - abs * 0.3),
        zIndex: count - abs,
      });
    }
    return out;
  }
```

Ajouter `carouselTransforms` au bloc `Object.assign(window, { … })` final de `game-logic.js`.

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run : `node --test test/game-logic.test.js`
Expected : PASS (suite verte).

- [ ] **Step 5 : Commit**

```bash
git add game-logic.js test/game-logic.test.js
git commit -m "feat(hub): carouselTransforms — positionnement coverflow 3D (logique pure testée)"
```

---

### Task 2 : Routing — hub = atterrissage pour tous (`auth.js`)

**Files:**
- Modify: `auth.js:32` (ajouter `'lobby'` à `PAGE_ACCESS.joueur`) et `auth.js:40` (`defaultRoute`)
- Test: `test/auth.test.js`

**Interfaces:**
- Produces: `defaultRoute(role)` → `'lobby'` pour tous ; `canSeePage('lobby','joueur')` → `true`.

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter à `test/auth.test.js` (en s'appuyant sur le `require('../auth.js')` déjà présent — utiliser le même alias que les tests existants du fichier ; on suppose `A`) :

```javascript
test('hub : atterrissage lobby pour tous les rôles', () => {
  assert.equal(A.defaultRoute('joueur'), 'lobby');
  assert.equal(A.defaultRoute('mj'), 'lobby');
  assert.equal(A.defaultRoute('admin'), 'lobby');
});
test('hub : le joueur peut voir la page lobby', () => {
  assert.equal(A.canSeePage('lobby', 'joueur'), true);
});
```

(Si l'alias d'import du fichier n'est pas `A`, adapter au nom utilisé en haut de `test/auth.test.js`.)

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run : `node --test test/auth.test.js`
Expected : FAIL (`defaultRoute('joueur')` vaut `'sheet'`, `canSeePage('lobby','joueur')` vaut `false`).

- [ ] **Step 3 : Modifier `auth.js`**

`auth.js:32` — ajouter `'lobby'` en tête de la liste joueur :

```javascript
    joueur: ['lobby', 'sheet', 'equip', 'inv', 'recap', 'runes', 'competences', 'prog'],
```

`auth.js:40` — `defaultRoute` :

```javascript
  const defaultRoute = (role) => 'lobby';
```

- [ ] **Step 4 : Lancer les tests, vérifier le succès**

Run : `node --test test/auth.test.js`
Expected : PASS.

- [ ] **Step 5 : Commit**

```bash
git add auth.js test/auth.test.js
git commit -m "feat(hub): hub d'accueil = page d'atterrissage pour tous les rôles"
```

---

### Task 3 : Données — `bio`, `PORTRAITS`, `MEMORIAL` (`data.jsx`)

**Files:**
- Modify: `data.jsx` (champ `bio` sur les 5 `CHARACTERS` ; constantes `PORTRAITS` + `MEMORIAL` ; export)
- Modify: `pages-equip.jsx:34-39` (réutiliser `PORTRAITS` au lieu du `EQUIP_PORTRAITS` local — DRY)

**Interfaces:**
- Produces : `PORTRAITS` (`{ [charId]: 'ATH/Perso/X.webp' }`), `MEMORIAL` (`[{ name, player, img, fell, epitaph, tale }]`), et `char.bio` (string) sur chaque personnage.

- [ ] **Step 1 : Ajouter `PORTRAITS` + `MEMORIAL` dans `data.jsx`**

Juste avant `const CHARACTERS = [` (vers `data.jsx:89`), insérer :

```javascript
/* Portrait réel par perso (id interne → fichier ATH/Perso). Partagé hub + équipement. */
const PORTRAITS = {
  rathael:'ATH/Perso/Rathael.webp', urskaar:'ATH/Perso/Urskaar.webp',
  smith:'ATH/Perso/Smith.webp',     lunick:'ATH/Perso/Elias.webp',
  jett:'ATH/Perso/Jett.webp',
};

/* Personnages tombés (mémorial du hub). Données statiques, non persistées. */
const MEMORIAL = [
  { name:'Lunick', player:'Fab', img:'ATH/Perso/Lunick.webp',
    fell:'Séance n°13 — Désert de Shurima (30/05)',
    epitaph:'Achevé non par le Xer’Sai, mais par un coup d’Urskaar en plein chaos. Mâchoire relocalisée, côtes criblées de pierres.',
    tale:'Bataille des Xer’Sai à Shurima. Après avoir achevé une bête à la Relique Lunaire (et encaissé le renvoi de la connexion astrale), Lunick rejoint le front truffé de bombes Hextech. Dans la confusion, Urskaar — échec critique, bras fracturé — le tue accidentellement. Le groupe, bouleversé, poursuit la route de Taliyah.' },
];
```

- [ ] **Step 2 : Ajouter un champ `bio` à chaque personnage**

Dans chaque appel `mkChar({ … })` de `CHARACTERS`, ajouter une clé `bio` (texte court — le MJ réécrira). `mkChar` fait `{ ...o }` donc le champ est conservé. Valeurs seedées :

- `rathael` : `bio:'Chevalier déchu rongé par un serment brisé. Sa chair gèle à mesure que son âme se fend — plus on le frappe, plus il s’endurcit.'`
- `urskaar` : `bio:'Colosse au sang d’ours, encaisseur né. Frappe fort, tombe rarement — et veille (parfois maladroitement) sur les siens.'`
- `smith` : `bio:'Lame précise et froide, héros discret des combats. Là où les autres improvisent, lui tranche net.'`
- `lunick` (Elias Crowe) : `bio:'Elias Crowe, arrivé dans l’ombre de Lunick. Mage de précision, instinct de chasseur, il marque ses proies avant de frapper.'`
- `jett` : `bio:'Artificière hextech, la Flèche. Cellules nano, pièges et duplications : le champ de bataille devient son atelier.'`

- [ ] **Step 3 : Exporter les nouvelles constantes**

Repérer le `Object.assign(window, { … })` de `data.jsx` (qui exporte `CHARACTERS`, `BUFFS`, …) et y ajouter `PORTRAITS, MEMORIAL`.

- [ ] **Step 4 : DRY — `pages-equip.jsx` réutilise `PORTRAITS`**

Dans `pages-equip.jsx`, supprimer le bloc local `EQUIP_PORTRAITS` (`pages-equip.jsx:34-39`) et remplacer ses usages par `PORTRAITS`. Vérifier les références :

Run : `grep -n "EQUIP_PORTRAITS" pages-equip.jsx`
Pour chaque occurrence restante, remplacer `EQUIP_PORTRAITS` par `PORTRAITS`. (Supprimer la définition, garder les usages pointant sur le global.)

- [ ] **Step 5 : Vérif syntaxe**

Run : `npx esbuild data.jsx >/dev/null && npx esbuild pages-equip.jsx >/dev/null && echo OK`
Expected : `OK`.

- [ ] **Step 6 : Commit**

```bash
git add data.jsx pages-equip.jsx
git commit -m "feat(hub): bio par perso + PORTRAITS partagé + MEMORIAL (Lunick)"
```

---

### Task 4 : `ResourceBar` — option sans chiffres (`components.jsx`)

**Files:**
- Modify: `components.jsx:26-45` (`ResourceBar`)

**Interfaces:**
- Produces: `ResourceBar({ kind, cur, max, big, segments, hideText })`. `hideText=true` → ne rend pas le texte `cur/max` (barre de remplissage seule).

- [ ] **Step 1 : Ajouter la prop `hideText`**

`components.jsx:26` — signature :

```javascript
function ResourceBar({ kind='hp', cur, max, big=false, segments=0, hideText=false }) {
```

`components.jsx:42` — conditionner le texte :

```javascript
      {!hideText && <div className="txt">{Math.round(cur)} / {max}</div>}
```

- [ ] **Step 2 : Vérif syntaxe**

Run : `npx esbuild components.jsx >/dev/null && echo OK`
Expected : `OK`. (Les appels existants n'ont pas `hideText` → comportement inchangé.)

- [ ] **Step 3 : Commit**

```bash
git add components.jsx
git commit -m "feat(ui): ResourceBar prop hideText (barre sans chiffres, pour le hub)"
```

---

### Task 5 : Hub — `CharCarousel` + `MemorialSection` + `HubPage` + styles

**Files:**
- Modify: `pages-lobby.jsx` (remplacer `LobbyPage` par `HubPage` + composants)
- Modify: `runeterra.css` (styles carrousel 3D + tombstone)

**Interfaces:**
- Consumes: `carouselTransforms` (T1), `PORTRAITS`/`MEMORIAL` (T3), `ResourceBar` `hideText` (T4), `charBaseStats`/`computeEffective` (existants), `useAllCharStates`/`useCharState`/`useSharedTurn`/`useMJEnemies`/`useAuthIdentity` (existants), `isStaff`, `RECAPS`.
- Produces: `HubPage({ go })` (exporté `window`).

- [ ] **Step 1 : Styles `runeterra.css`**

Ajouter à la fin de `runeterra.css` :

```css
/* --- Hub : carrousel coverflow 3D --- */
.carousel-stage { position:relative; height:380px; perspective:1200px; transform-style:preserve-3d; margin:0 auto; }
.carousel-card { position:absolute; top:50%; left:50%; width:230px; height:330px;
  transition: transform .5s cubic-bezier(.2,.7,.2,1), opacity .4s; cursor:pointer;
  background:linear-gradient(180deg, var(--bg-panel-2), var(--bg-inset));
  border:1px solid var(--line-gold); border-radius:12px; box-shadow:0 10px 40px rgba(0,0,0,.55);
  display:flex; flex-direction:column; overflow:hidden; }
.carousel-card.is-active { box-shadow:0 0 38px var(--gold-glow); border-color:var(--gold); }
.carousel-portrait { width:100%; height:200px; background-size:cover; background-position:top center; }
.carousel-nav { display:flex; justify-content:center; gap:16px; margin-top:10px; }
.carousel-nav button { width:42px; height:42px; border-radius:50%; border:1px solid var(--line-gold);
  background:var(--bg-inset); color:var(--gold-pale); font-size:18px; cursor:pointer; }
.carousel-bio { text-align:center; max-width:520px; margin:14px auto 0; color:var(--ink-faint); font-size:14px; min-height:42px; }
/* --- Hub : mémorial --- */
.tomb { background:linear-gradient(180deg,#1a1714,#0e0c0a); border:1px solid #3a342a; border-radius:10px;
  padding:14px; width:220px; text-align:center; }
.tomb img { width:80px; height:80px; border-radius:8px; object-fit:cover; filter:sepia(.6) grayscale(.3); }
.tomb .epitaph { color:#b9a98a; font-size:12px; font-style:italic; margin-top:8px; }
```

- [ ] **Step 2 : Écrire `HubPage` + sous-composants dans `pages-lobby.jsx`**

Remplacer **tout** le contenu de `pages-lobby.jsx` par :

```javascript
/* ============================================================
   PAGE — HUB D'ACCUEIL (carrousel 3D persos + accès + mémorial)
   ============================================================ */

/* Carrousel coverflow 3D des personnages. Barres sans chiffres ; remplissage selon accès. */
function CharCarousel({ chars, statesById, accessibleIds, staff }) {
  const [active, setActive] = useState(0);
  const tf = carouselTransforms(chars.length, active);
  const acc = new Set(accessibleIds || []);
  const rotate = (dir) => setActive(a => (a + dir + chars.length) % chars.length);
  const activeChar = chars[active];
  return (
    <div>
      <div className="carousel-stage">
        {chars.map((c, i) => {
          const t = tf[i];
          const st = statesById[c.id];
          const ok = acc.has(c.id) && st;
          const max = ok ? charBaseStats(c, st) : null;
          return (
            <div key={c.id} className={'carousel-card' + (i === active ? ' is-active' : '')}
              onClick={() => i !== active && t.opacity > 0 && setActive(i)}
              style={{ transform:`translate(-50%,-50%) rotateY(${t.rotateY}deg) translateZ(${t.translateZ}px) scale(${t.scale})`,
                opacity:t.opacity, zIndex:t.zIndex, pointerEvents: t.opacity > 0 ? 'auto' : 'none' }}>
              <div className="carousel-portrait" style={{ backgroundImage:`url(${PORTRAITS[c.id]})` }} />
              <div style={{ padding:'10px 12px', flex:1 }}>
                <div style={{ fontFamily:'var(--font-display)', fontSize:17, color:'var(--gold-pale)' }}>{c.name}</div>
                <div className="faint" style={{ fontSize:11, marginBottom:8 }}>{c.cls} · Niv {(st && st.level) || c.level}</div>
                <div className="col gap-1">
                  <ResourceBar kind="hp"     cur={ok ? (st.hpCur || 0) : 0}  max={ok ? max.hp : 0}            hideText />
                  <ResourceBar kind="mana"   cur={ok ? (st.manaCur || 0) : 0} max={ok ? max.mana : 0}          hideText />
                  <ResourceBar kind="shield" cur={ok ? (st.shield || 0) : 0}  max={ok ? (c.shieldMax || 0) : 0} hideText />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="carousel-nav">
        <button onClick={() => rotate(-1)} aria-label="Précédent">◄</button>
        <button onClick={() => rotate(1)} aria-label="Suivant">►</button>
      </div>
      <div className="carousel-bio">
        <span className="faint" style={{ fontStyle:'italic' }}>« {activeChar.title} »</span>
        {activeChar.bio ? <div style={{ marginTop:4 }}>{activeChar.bio}</div> : null}
      </div>
    </div>
  );
}

/* Mémorial des personnages morts (tombstones). */
function MemorialSection() {
  if (!MEMORIAL || !MEMORIAL.length) return null;
  return (
    <div style={{ marginTop:40, textAlign:'center' }}>
      <div className="overline" style={{ marginBottom:14, color:'var(--gold-deep)' }}>🪦 Aux disparus</div>
      <div className="row gap-4" style={{ justifyContent:'center', flexWrap:'wrap' }}>
        {MEMORIAL.map((m, i) => (
          <div key={i} className="tomb">
            <img src={m.img} alt={m.name} />
            <div style={{ fontFamily:'var(--font-display)', fontSize:16, color:'var(--gold-pale)', marginTop:8 }}>{m.name}</div>
            <div className="faint" style={{ fontSize:11 }}>Joueur {m.player} · {m.fell}</div>
            <div className="epitaph">{m.epitaph}</div>
            {m.tale ? <details style={{ marginTop:8, textAlign:'left' }}>
              <summary style={{ cursor:'pointer', fontSize:11, color:'var(--gold-deep)' }}>Le récit</summary>
              <div className="faint" style={{ fontSize:11, marginTop:6 }}>{m.tale}</div>
            </details> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/* Hub d'accueil — atterrissage pour tous. */
function HubPage({ go }) {
  const auth = useAuthIdentity();
  const staff = isStaff(auth.role);
  const myId = auth.charId;
  const all = useAllCharStates();           // staff : peuplé ; joueur : null (lecture refusée, non fatale)
  const own = useCharState(myId || CHARACTERS[0].id);
  const { turn } = useSharedTurn();
  const { enemies } = useMJEnemies();

  const statesById = {};
  let accessibleIds = [];
  if (staff && all) {
    CHARACTERS.forEach(c => { if (all[c.id] && all[c.id].state) statesById[c.id] = all[c.id].state; });
    accessibleIds = Object.keys(statesById);
  } else if (myId && own.state) {
    statesById[myId] = own.state;
    accessibleIds = [myId];
  }
  const combatActif = (enemies && enemies.length > 0) || turn > 1;
  const lastRecap = (typeof RECAPS !== 'undefined' && RECAPS.length) ? RECAPS[0] : null;

  return (
    <div className="hex-bg" style={{ minHeight:'100%', position:'relative', overflow:'auto' }}>
      <div style={{ position:'absolute', top:'-25%', left:'50%', transform:'translateX(-50%)', width:900, height:900,
        background:'radial-gradient(circle, rgba(200,155,60,.10), transparent 65%)', pointerEvents:'none' }} />
      <div style={{ position:'relative', padding:'40px 24px', maxWidth:1000, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <h1 style={{ fontSize:44, letterSpacing:'.04em', textShadow:'0 0 40px var(--gold-glow)' }}>Chroniques de Runeterra</h1>
          <div className="dim" style={{ fontSize:14, marginTop:4 }}>Bonjour <b>{auth.username}</b></div>
        </div>

        <CharCarousel chars={CHARACTERS} statesById={statesById} accessibleIds={accessibleIds} staff={staff} />

        <div className="row gap-4" style={{ justifyContent:'center', flexWrap:'wrap', marginTop:28 }}>
          <button className="btn btn-gold btn-lg" onClick={() => go(staff ? 'mj' : 'sheet')}>▶ Reprendre</button>
          {combatActif && <button className="btn btn-lg" onClick={() => go('competences')}>⚔ Combat en cours — Tour {turn}</button>}
          {lastRecap && <button className="btn btn-lg" onClick={() => go('recap')}>📖 Dernier récap — {lastRecap.titre || lastRecap.date}</button>}
        </div>

        <MemorialSection />
      </div>
    </div>
  );
}
window.HubPage = HubPage;
```

- [ ] **Step 3 : Vérif syntaxe**

Run : `npx esbuild pages-lobby.jsx >/dev/null && echo OK`
Expected : `OK`.

- [ ] **Step 4 : Commit**

```bash
git add pages-lobby.jsx runeterra.css
git commit -m "feat(hub): HubPage — carrousel 3D persos + accès rapides + mémorial"
```

---

### Task 6 : Câblage `index.html` + cache-bump + vérification finale

**Files:**
- Modify: `index.html:136` (entrée `PAGES` lobby → `HubPage`) + jeton `?v=` / `window.APPV`

**Interfaces:**
- Consumes: `HubPage` (T5).

- [ ] **Step 1 : Pointer l'entrée `lobby` sur `HubPage`**

`index.html:136` — remplacer :

```javascript
  { id:'lobby',   label:'Accueil',      render:() => <LobbyPage go={setRoute} /> },
```

par :

```javascript
  { id:'lobby',   label:'Accueil',      render:() => <HubPage go={setRoute} /> },
```

- [ ] **Step 2 : Suite de tests complète**

Run : `node --test test/game-logic.test.js test/auth.test.js`
Expected : suites vertes (0 fail).

- [ ] **Step 3 : Vérif syntaxe de tous les `.jsx` modifiés**

Run : `for f in pages-lobby.jsx pages-equip.jsx components.jsx data.jsx; do npx esbuild "$f" >/dev/null && echo "OK $f"; done`
Expected : `OK` pour les quatre.

- [ ] **Step 4 : Bumper le cache**

Dans `index.html`, repérer le jeton courant (ex. `20260628-1`) et l'incrémenter partout (search-replace, ex. → `20260629-1`), `window.APPV` inclus.

Run : `grep -c "20260629-1" index.html` → > 0 ; `grep -c "20260628-1" index.html` → 0.

- [ ] **Step 5 : Vérification visuelle (manuel)**

Servir (`python -m http.server 5050 --bind 127.0.0.1`), se connecter :
- À la connexion, on atterrit sur le **Hub** (joueur ET staff).
- Carrousel : 1 carte de face, voisines de profil, rotation via ◄/► et clic ; bio sous la carte de face.
- Staff : barres remplies pour les 5 ; joueur : sa carte remplie, les autres barres vides.
- Boutons Reprendre / (Combat si actif) / Dernier récap fonctionnent.
- Mémorial : tombstone de Lunick, « Le récit » dépliable.

- [ ] **Step 6 : Commit**

```bash
git add index.html
git commit -m "chore(hub): câblage HubPage dans PAGES + cache-bump 20260629-1"
```

---

## Self-review (couverture de la spec)

- Hub = atterrissage pour tous → T2 (routing). ✅
- Carrousel coverflow 3D en premier, sous le titre → T1 (logique) + T5 (UI) + styles. ✅
- Barres PV/mana/bouclier+niveau sans chiffres, live staff / sa carte joueur, grisées autres → T4 (`hideText`) + T5 (`accessibleIds`). ✅
- Bio sous la carte de face → T3 (`bio`) + T5 (`CharCarousel`). ✅
- Mémorial (Lunick) → T3 (`MEMORIAL`) + T5 (`MemorialSection`). ✅
- Blocs Reprendre / Combat / Récap → T5 (`HubPage`). *(Bandeau « Séance en cours » staff = différé YAGNI — couplage à `useSession` évité en v1 ; à ajouter plus tard si besoin.)*
- Zéro règle RTDB / zéro schéma → respecté (lectures existantes ; `bio`/`MEMORIAL`/`PORTRAITS` statiques). ✅
- `PORTRAITS` partagé (DRY) → T3. ✅
- Cache-bump → T6. ✅
```
