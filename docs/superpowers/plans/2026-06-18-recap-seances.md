# Onglet « Récap » (résumés de séance + BD flipbook) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Note environnement :** les subagents ne peuvent pas lancer tests/git ici → exécution **inline** (voir [[subagent-sandbox-no-bash]]).

**Goal:** Ajouter un onglet « Récap » (visible joueurs + MJ) qui présente, par séance, un résumé texte court et une BD illustrée feuilletable comme un vrai livre (double page + animation de tournage de page), à partir d'images de planches commitées dans le repo.

**Architecture:** 100 % statique, zéro Firebase, zéro temps réel. Un fichier de données `recaps.js` liste les séances (`{id,date,titre,resume,pages:[...]}`) ; les images vivent dans `recaps/seance-XX/`. Une page React `pages-recap.jsx` (3 composants isolés : `RecapPage` → `RecapBook` → `RecapLightbox`) lit ces données. Seule logique non-triviale : `paginate()` (pure, testée). Le flip est fait-main en CSS 3D, dimensionné sur une page A4 portrait à largeur fixe (`--pw`).

**Tech Stack:** React 18 + Babel standalone (CDN, zéro build), CSS 3D transforms, `node --test` pour la logique pure. Pattern projet : chaque fichier fait `Object.assign(window, {...})`, ordre de chargement géré dans `index.html`.

## Global Constraints

- **Zéro build / zéro dépendance nouvelle** : pas de librairie de flipbook (incompatible React zéro-build) ; flip fait-main CSS/React.
- **Zéro Firebase / zéro règle RTDB** : un récap est figé, lecture seule pour tous.
- **Pattern d'export** : tout fichier `.js`/`.jsx` définit localement puis `Object.assign(window, {...})`.
- **Ordre de chargement** (`index.html`) : `recaps.js` après `data.jsx` ; `pages-recap.jsx` après les autres `pages-*.jsx`.
- **1 image = 1 page** : les planches sont déjà finies (titre, cases, texte, n° de page incrustés). L'app n'ajoute ni grille ni texte.
- **Pages A4 portrait** : ratio hauteur = largeur × 1.414. Taille pilotée par la variable CSS `--pw`.
- **Accès** : page `recap` ajoutée à `PAGE_ACCESS` pour les 3 rôles (`joueur`, `mj`, `admin`).
- **Tests** : `node --test test/game-logic.test.js test/auth.test.js` doit rester vert. Vérif syntaxe `.jsx` : `npx esbuild fichier.jsx >/dev/null`.
- **Serveur de dev** : `python -m http.server 5050 --bind 127.0.0.1`.

---

## File Structure

- `game-logic.js` — **modifier** : + fonction pure `paginate(pages)` + export.
- `test/game-logic.test.js` — **modifier** : + tests `paginate`.
- `recaps.js` — **créer** : données `RECAPS` (déclaratif, pas de JSX).
- `recaps/seance-01/page1.webp`, `page2.webp` — **créer** : 1res planches (copiées de `idée/`).
- `pages-recap.jsx` — **créer** : `useMediaQuery`, `RecapPage`, `RecapBook`, `RecapLightbox`.
- `runeterra.css` — **modifier** : + styles livre / feuille / lightbox.
- `index.html` — **modifier** : + `<script>` `recaps.js` & `pages-recap.jsx` ; + entrée `PAGES`.
- `auth.js` — **modifier** : + `'recap'` dans `PAGE_ACCESS` des 3 rôles.
- `CLAUDE.md` — **modifier** : doc.

---

## Task 1 : Logique pure `paginate()`

**Files:**
- Modify: `game-logic.js` (ajout fonction + export dans le `return`)
- Test: `test/game-logic.test.js`

**Interfaces:**
- Consumes: rien.
- Produces: `paginate(pages: string[]): string[][]` — regroupe une liste de pages en doubles-pages. `[]`→`[]`, `[a]`→`[[a]]`, `[a,b,c]`→`[[a,b],[c]]`. Exposée sur `window` (UMD).

- [ ] **Step 1 : Écrire les tests qui échouent**

Dans `test/game-logic.test.js`, ajouter à la fin :

```js
/* --- Récap : pagination en doubles-pages --- */
test('paginate regroupe les pages en doubles-pages', () => {
  assert.deepEqual(L.paginate([]), []);
  assert.deepEqual(L.paginate(['a']), [['a']]);
  assert.deepEqual(L.paginate(['a','b']), [['a','b']]);
  assert.deepEqual(L.paginate(['a','b','c']), [['a','b'],['c']]);
  assert.deepEqual(L.paginate(['a','b','c','d']), [['a','b'],['c','d']]);
});

test('paginate tolère null/undefined', () => {
  assert.deepEqual(L.paginate(null), []);
  assert.deepEqual(L.paginate(undefined), []);
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `node --test test/game-logic.test.js`
Expected: FAIL — `L.paginate is not a function`.

- [ ] **Step 3 : Implémenter la fonction**

Dans `game-logic.js`, juste avant `/* --- État de départ d'un perso ... */` (la fonction `buildDefaultState`), ajouter :

```js
  /* --- Récap : regroupe une liste de pages en doubles-pages [[p1,p2],[p3,p4],…] --- */
  function paginate(pages) {
    pages = pages || [];
    var out = [];
    for (var i = 0; i < pages.length; i += 2) out.push(pages.slice(i, i + 2));
    return out;
  }
```

Puis, dans l'objet `return { … }` du module, ajouter `paginate` à la dernière ligne :

```js
    STACK_MAX, fillStacks, planItemAdd,
    paginate,
  };
```

- [ ] **Step 4 : Lancer les tests, vérifier le succès**

Run: `node --test test/game-logic.test.js`
Expected: PASS — tous les tests verts (35 au total).

- [ ] **Step 5 : Commit**

```bash
git add game-logic.js test/game-logic.test.js
git commit -m "feat(recap): paginate() pour regrouper les planches en doubles-pages"
```

---

## Task 2 : Données, assets, routing — onglet « Récap » minimal (pages empilées)

But : un onglet visible par tous qui affiche le résumé + les planches **empilées verticalement** (pas encore de livre). Déjà testable visuellement.

**Files:**
- Create: `recaps/seance-01/page1.webp`, `recaps/seance-01/page2.webp`
- Create: `recaps.js`
- Create: `pages-recap.jsx` (version minimale `RecapPage`)
- Modify: `index.html` (scripts + `PAGES`)
- Modify: `auth.js` (`PAGE_ACCESS`)

**Interfaces:**
- Consumes: `window.RECAPS`.
- Produces: `window.RecapPage` (composant React, aucune prop) ; `window.RECAPS` (array de `{id,date,titre,resume,pages}`).

- [ ] **Step 1 : Copier les 1res planches dans un dossier commité**

Run:
```bash
mkdir -p recaps/seance-01
cp "idée/page1.webp" recaps/seance-01/page1.webp
cp "idée/page2.webp" recaps/seance-01/page2.webp
ls -1 recaps/seance-01/
```
Expected: `page1.webp` et `page2.webp` listés.

- [ ] **Step 2 : Créer `recaps.js`**

```js
/* ============================================================
   DONNÉES — RÉCAPS DE SÉANCE
   Chaque entrée = une séance (la plus récente EN PREMIER).
   Images = planches déjà finies, dans recaps/seance-XX/.
   Ajouter une séance : déposer les .webp + ajouter une entrée ici.
   ============================================================ */
const RECAPS = [
  {
    id:    'seance-01',
    date:  '2026-06-14',
    titre: 'La dernière session',
    resume: "Après avoir sauvé Elias, les cinq compagnons reprennent la route à travers Shurima. " +
            "Ils traversent les sables, croisent des nomades méfiants, longent un cimetière de monstres, " +
            "et atteignent un ermite reclus qui leur propose une eau prétendue miraculeuse contre 25 pièces d'argent.",
    pages: [
      'recaps/seance-01/page1.webp',
      'recaps/seance-01/page2.webp',
    ],
  },
];

Object.assign(window, { RECAPS });
```

- [ ] **Step 3 : Créer `pages-recap.jsx` (version minimale)**

```jsx
/* ============================================================
   PAGE — RÉCAP DE SÉANCE
   Sélecteur de séance + résumé texte + BD (livre, Task 3).
   ============================================================ */
function RecapPage() {
  const recaps = window.RECAPS || [];
  const [sel, setSel] = useState(0);
  if (!recaps.length) {
    return <div style={{ padding:40 }} className="dim">Aucun récap pour l'instant.</div>;
  }
  const i = Math.min(sel, recaps.length - 1);
  const s = recaps[i];
  return (
    <div style={{ padding:'24px', height:'100%', overflow:'auto' }}>
      <div className="row" style={{ justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:18 }}>
        <div>
          <h2 style={{ fontSize:24 }}>Récap de séance</h2>
          <span className="faint" style={{ fontSize:12 }}>{s.date}</span>
        </div>
      </div>

      {/* sélecteur de séance (la plus récente = numéro le plus haut) */}
      <div className="row gap-2 wrap" style={{ marginBottom:18 }}>
        {recaps.map((r, idx) => (
          <button key={r.id} onClick={() => setSel(idx)}
            className={'btn btn-sm' + (idx === i ? ' btn-gold' : ' btn-ghost')}>
            Séance {recaps.length - idx} · {r.titre}
          </button>
        ))}
      </div>

      {/* résumé TL;DR (masqué si absent) */}
      {s.resume ? (
        <div className="panel" style={{ marginBottom:18, padding:'16px 20px' }}>
          <div className="overline" style={{ marginBottom:6 }}>Résumé</div>
          <p style={{ margin:0, fontSize:14, color:'var(--ink)', lineHeight:1.6 }}>{s.resume}</p>
        </div>
      ) : null}

      {/* BD — version minimale : planches empilées (remplacée par <RecapBook> en Task 3) */}
      <div className="col gap-4" style={{ alignItems:'center' }}>
        {(s.pages || []).map((src, idx) => (
          <img key={idx} src={src} alt={'Page ' + (idx + 1)}
            style={{ maxWidth:'min(92vw,440px)', width:'100%', border:'1px solid var(--line-gold)', borderRadius:6 }} />
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { RecapPage });
```

- [ ] **Step 4 : Charger les scripts dans `index.html`**

Après la ligne `<script type="text/babel" src="data.jsx"></script>` (data), ajouter :

```html
<script type="text/babel" src="recaps.js"></script>
```

Après la ligne `<script type="text/babel" src="pages-equip.jsx"></script>`, ajouter :

```html
<script type="text/babel" src="pages-recap.jsx"></script>
```

- [ ] **Step 5 : Enregistrer la page dans `PAGES` (`index.html`)**

Dans le tableau `const PAGES = [ … ]`, ajouter avant la ligne `{ id:'admin', … }` :

```js
  { id:'recap',   label:'Récap',        render:() => <RecapPage /> },
```

- [ ] **Step 6 : Donner l'accès aux 3 rôles (`auth.js`)**

Remplacer le bloc `PAGE_ACCESS` par :

```js
  const PAGE_ACCESS = {
    joueur: ['sheet', 'equip', 'inv', 'recap'],
    mj:     ['lobby', 'mj', 'sheet', 'equip', 'journal', 'prog', 'ds', 'inv', 'recap'],
    admin:  ['lobby', 'mj', 'sheet', 'equip', 'journal', 'prog', 'ds', 'inv', 'recap', 'admin'],
  };
```

- [ ] **Step 7 : Vérifier la syntaxe + le bon fonctionnement**

Run: `npx esbuild pages-recap.jsx >/dev/null && echo OK`
Expected: `OK`.

Run: `python -m http.server 5050 --bind 127.0.0.1` (autre terminal), ouvrir http://127.0.0.1:5050, se connecter, cliquer l'onglet **Récap**.
Expected: titre « Récap de séance », bouton « Séance 1 · La dernière session », le bloc Résumé, puis les 2 planches empilées.

- [ ] **Step 8 : Commit**

```bash
git add recaps.js recaps/ pages-recap.jsx index.html auth.js
git commit -m "feat(recap): onglet Récap (données + page + routing, planches empilées)"
```

---

## Task 3 : `RecapBook` — le livre feuilletable (double page + flip)

But : remplacer l'empilement par un vrai livre. Double page sur large écran, page simple sur mobile, animation de tournage de page (CSS 3D), navigation flèches + clavier.

**Files:**
- Modify: `pages-recap.jsx` (+ `useMediaQuery`, + `RecapBook`, remplacer le bloc empilé de `RecapPage`)
- Modify: `runeterra.css` (styles livre/feuille)

**Interfaces:**
- Consumes: `window.paginate`, `useState`, `useEffect`.
- Produces: `window.RecapBook` — `<RecapBook pages={string[]} onZoom={(index:number)=>void} />`. `onZoom` optionnel (branché en Task 4).

- [ ] **Step 1 : Ajouter les styles du livre dans `runeterra.css`**

Ajouter à la fin du fichier :

```css
/* ====== Récap — livre / flipbook ====== */
.recap-book { --pw: min(46vw, 430px); display:flex; flex-direction:column; align-items:center; gap:14px; }
.recap-book.is-narrow { --pw: min(92vw, 440px); }
.recap-stage {
  position:relative;
  width: calc(var(--pw) * 2);
  height: calc(var(--pw) * 1.414);
  perspective: 2200px;
}
.recap-book.is-narrow .recap-stage { width: var(--pw); }
.recap-half {
  position:absolute; top:0; width: var(--pw); height:100%;
  background:#0a0908; overflow:hidden;
  box-shadow: inset 0 0 40px rgba(0,0,0,.5);
}
.recap-half.left  { left:0; border-radius:6px 0 0 6px; }
.recap-half.right { left: var(--pw); border-radius:0 6px 6px 0; }
.recap-book.is-narrow .recap-half.right { display:none; }
.recap-half img, .recap-leaf .face img { display:block; width:100%; height:100%; object-fit:contain; cursor:zoom-in; }
.recap-half.empty, .recap-leaf .face.empty { background:#080706; }

/* feuille qui tourne : occupe la moitié droite, pivote autour de la reliure (bord gauche) */
.recap-leaf {
  position:absolute; top:0; left: var(--pw); width: var(--pw); height:100%;
  transform-style: preserve-3d; transform-origin: left center;
  transition: transform .6s ease-in-out; z-index:6;
}
.recap-book.is-narrow .recap-leaf { left:0; }
.recap-leaf.flip-next { transform: rotateY(-180deg); }
.recap-leaf.start-prev { transform: rotateY(-180deg); transition:none; } /* position de départ d'un retour */
.recap-leaf.flip-prev { transform: rotateY(0deg); }
.recap-leaf .face {
  position:absolute; inset:0; backface-visibility:hidden; -webkit-backface-visibility:hidden;
  background:#0a0908; overflow:hidden;
}
.recap-leaf .face.back { transform: rotateY(180deg); }
.recap-book .recap-shadow { box-shadow: 0 22px 60px rgba(0,0,0,.65); border-radius:6px; }

.recap-nav { display:flex; align-items:center; gap:16px; }
.recap-nav .count { font-family:var(--font-mono); font-size:12px; color:var(--ink-faint); }
```

- [ ] **Step 2 : Ajouter `useMediaQuery` et `RecapBook` dans `pages-recap.jsx`**

Au-dessus de `function RecapPage()`, ajouter :

```jsx
/* Hook : true si la media query matche (recalculé au resize). */
function useMediaQuery(query) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const fn = () => setMatch(m.matches);
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, [query]);
  return match;
}

/* Livre feuilletable. Une "vue" = ce qui est affiché d'un coup :
   - large écran : une double-page [gauche, droite] (via paginate)
   - mobile      : une seule page [page]
   Le flip fait tourner une feuille (CSS 3D) entre deux vues consécutives. */
function RecapBook({ pages, onZoom }) {
  const narrow = useMediaQuery('(max-width: 820px)');
  const views = narrow ? (pages || []).map(p => [p]) : paginate(pages);
  const [vi, setVi] = useState(0);
  const [anim, setAnim] = useState(null);   // 'next' | 'prev' pendant l'animation
  useEffect(() => { setVi(0); setAnim(null); }, [narrow, pages]);

  const total = views.length;
  const go = (dir) => {
    if (anim) return;
    const nv = vi + (dir === 'next' ? 1 : -1);
    if (nv < 0 || nv >= total) return;
    setAnim(dir);
    window.setTimeout(() => { setVi(nv); setAnim(null); }, 620);  // = durée transition CSS
  };
  useEffect(() => {
    const fn = (e) => {
      if (e.key === 'ArrowRight') go('next');
      else if (e.key === 'ArrowLeft') go('prev');
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  });

  if (!total) return <div className="faint">Aucune page.</div>;

  const cur  = views[vi] || [];
  const next = views[vi + 1] || [];
  const prev = views[vi - 1] || [];
  const pageAt = (viewIdx, side) => { const v = views[viewIdx] || []; return v[side]; };

  // Image ou placeholder vide. zoomGlobalIdx = index de la page dans `pages` (pour la lightbox).
  const Img = ({ src, cls }) => src
    ? <div className={'face ' + (cls || '')}>
        <img src={src} alt="" onClick={() => onZoom && onZoom(pages.indexOf(src))}
          onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
      </div>
    : <div className={'face empty ' + (cls || '')} />;

  // Faces de la feuille selon la direction de l'animation.
  // NEXT : front = page droite courante ; back = page gauche de la vue suivante.
  // PREV : front = page gauche courante ; back = page droite de la vue précédente.
  const leafFrontSrc = anim === 'prev' ? cur[0] : cur[1];
  const leafBackSrc  = anim === 'prev' ? (prev[1]) : (next[0]);
  const leafClass = anim === 'next' ? 'recap-leaf flip-next'
                  : anim === 'prev' ? 'recap-leaf start-prev flip-prev'
                  : 'recap-leaf';

  return (
    <div className={'recap-book' + (narrow ? ' is-narrow' : '')}>
      <div className="recap-stage recap-shadow">
        {/* page gauche : en NEXT reste la page gauche courante ; sinon idem */}
        {!narrow && (
          cur[0]
            ? <div className="recap-half left"><img src={cur[0]} alt="" onClick={() => onZoom && onZoom(pages.indexOf(cur[0]))} onError={(e)=>{e.currentTarget.style.visibility='hidden';}} /></div>
            : <div className="recap-half left empty" />
        )}
        {/* page droite : pendant NEXT, on montre dessous la page droite suivante ; au repos, la courante */}
        {(() => {
          const rightSrc = anim === 'next' ? next[1] : cur[narrow ? 0 : 1];
          return rightSrc
            ? <div className="recap-half right"><img src={rightSrc} alt="" onClick={() => onZoom && onZoom(pages.indexOf(rightSrc))} onError={(e)=>{e.currentTarget.style.visibility='hidden';}} /></div>
            : <div className="recap-half right empty" />;
        })()}
        {/* feuille animée (montée seulement pendant l'anim) */}
        {anim && (
          <div className={leafClass}>
            <Img src={leafFrontSrc} cls="front" />
            <Img src={leafBackSrc}  cls="back" />
          </div>
        )}
      </div>

      <div className="recap-nav">
        <button className="btn btn-sm btn-ghost" disabled={vi === 0} onClick={() => go('prev')}>◀</button>
        <span className="count">{narrow ? `page ${vi + 1} / ${total}` : `vue ${vi + 1} / ${total}`}</span>
        <button className="btn btn-sm btn-ghost" disabled={vi >= total - 1} onClick={() => go('next')}>▶</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3 : Brancher `RecapBook` dans `RecapPage`**

Dans `RecapPage`, remplacer tout le bloc `{/* BD — version minimale … */}` (le `<div className="col gap-4">…</div>`) par :

```jsx
      {/* BD — livre feuilletable */}
      <RecapBook pages={s.pages || []} />
```

- [ ] **Step 4 : Vérifier la syntaxe + le flip**

Run: `npx esbuild pages-recap.jsx >/dev/null && echo OK`
Expected: `OK`.

Servir le site, onglet Récap :
- Large écran : double page (planche 1 à gauche, 2 à droite). Clic ▶ ou flèche → : la feuille de droite tourne vers la gauche.
- Réduire la fenêtre < 820px : une seule page à la fois, le flip tourne la page entière.
- Flèches clavier ←/→ naviguent. Le compteur s'incrémente.
Expected: navigation fluide, l'animation de tournage se joue, pas d'erreur console.

- [ ] **Step 5 : Commit**

```bash
git add pages-recap.jsx runeterra.css
git commit -m "feat(recap): RecapBook — livre double page + flip CSS 3D + responsive"
```

---

## Task 4 : `RecapLightbox` — lecture plein écran zoomable

But : clic sur une planche → plein écran pour lire le texte des cases ; navigation prec/suiv + fermeture Échap.

**Files:**
- Modify: `pages-recap.jsx` (+ `RecapLightbox`, état `lightbox` dans `RecapPage`, prop `onZoom` passée à `RecapBook`)
- Modify: `runeterra.css` (styles lightbox)

**Interfaces:**
- Consumes: `window.RecapBook` (via prop `onZoom`).
- Produces: `window.RecapLightbox` — `<RecapLightbox pages={string[]} index={number} onClose={()=>void} />`.

- [ ] **Step 1 : Styles lightbox dans `runeterra.css`**

Ajouter à la fin :

```css
/* ====== Récap — lightbox plein écran ====== */
.recap-lb { position:fixed; inset:0; z-index:300; background:rgba(0,0,0,.92);
  display:flex; align-items:center; justify-content:center; }
.recap-lb img { max-width:95vw; max-height:92vh; object-fit:contain; border-radius:4px;
  box-shadow:0 10px 60px rgba(0,0,0,.8); }
.recap-lb .lb-btn { position:absolute; top:50%; transform:translateY(-50%);
  background:rgba(20,16,10,.7); border:1px solid var(--line-gold); color:var(--ink);
  width:46px; height:46px; border-radius:50%; font-size:20px; cursor:pointer; }
.recap-lb .lb-btn:disabled { opacity:.25; cursor:default; }
.recap-lb .lb-prev { left:18px; }
.recap-lb .lb-next { right:18px; }
.recap-lb .lb-close { position:absolute; top:16px; right:18px; background:none; border:none;
  color:var(--ink); font-size:26px; cursor:pointer; }
.recap-lb .lb-count { position:absolute; bottom:16px; left:50%; transform:translateX(-50%);
  font-family:var(--font-mono); font-size:12px; color:var(--ink-faint); }
```

- [ ] **Step 2 : Ajouter `RecapLightbox` dans `pages-recap.jsx`**

Au-dessus de `function RecapBook(`, ajouter :

```jsx
/* Lecture plein écran d'une planche, avec navigation et fermeture clavier. */
function RecapLightbox({ pages, index, onClose }) {
  const [i, setI] = useState(index);
  useEffect(() => setI(index), [index]);
  useEffect(() => {
    const fn = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setI(v => Math.min(pages.length - 1, v + 1));
      else if (e.key === 'ArrowLeft')  setI(v => Math.max(0, v - 1));
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [pages.length, onClose]);
  return (
    <div className="recap-lb" onClick={onClose}>
      <button className="lb-close" onClick={onClose}>✕</button>
      <button className="lb-btn lb-prev" disabled={i === 0}
        onClick={(e) => { e.stopPropagation(); setI(v => Math.max(0, v - 1)); }}>◀</button>
      <img src={pages[i]} alt={'Page ' + (i + 1)} onClick={(e) => e.stopPropagation()} />
      <button className="lb-btn lb-next" disabled={i >= pages.length - 1}
        onClick={(e) => { e.stopPropagation(); setI(v => Math.min(pages.length - 1, v + 1)); }}>▶</button>
      <div className="lb-count">{i + 1} / {pages.length}</div>
    </div>
  );
}
```

Puis ajouter à l'export en bas du fichier : `Object.assign(window, { useMediaQuery, RecapBook, RecapLightbox, RecapPage });` (remplace l'éventuel export partiel existant).

- [ ] **Step 3 : Brancher la lightbox dans `RecapPage`**

Dans `RecapPage`, après `const s = recaps[i];`, ajouter l'état :

```jsx
  const [zoom, setZoom] = useState(null);   // index de page en plein écran, ou null
```

Remplacer `<RecapBook pages={s.pages || []} />` par :

```jsx
      <RecapBook pages={s.pages || []} onZoom={(idx) => setZoom(idx)} />
      {zoom != null && (
        <RecapLightbox pages={s.pages || []} index={zoom} onClose={() => setZoom(null)} />
      )}
```

- [ ] **Step 4 : Vérifier la syntaxe + le zoom**

Run: `npx esbuild pages-recap.jsx >/dev/null && echo OK`
Expected: `OK`.

Servir le site, onglet Récap : cliquer sur une planche → ouverture plein écran lisible ; flèches ◀ ▶ et clavier ←/→ changent de page ; ✕, Échap ou clic hors image ferment.
Expected: lecture confortable du texte des cases, navigation et fermeture OK.

- [ ] **Step 5 : Commit**

```bash
git add pages-recap.jsx runeterra.css
git commit -m "feat(recap): RecapLightbox — lecture plein écran zoomable des planches"
```

---

## Task 5 : Documentation (`CLAUDE.md`)

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1 : Ajouter l'entrée dans la carte des fichiers**

Dans la section « Carte des fichiers », après la ligne `pages-equip.jsx` (avant `pages-lobby/journal/...`), ajouter :

```
- `recaps.js` — données des **récaps de séance** : `RECAPS = [{id,date,titre,resume,pages:[...]}]`
  (plus récente en premier ; images dans `recaps/seance-XX/`, commitées/statiques).
- `pages-recap.jsx` — onglet **Récap** (`RecapPage`) : sélecteur de séance + résumé texte + BD
  feuilletable. `useMediaQuery` (double page ≥820px, page simple en dessous), `RecapBook`
  (livre, flip CSS 3D fait-main, page A4 portrait via `--pw`, `paginate`), `RecapLightbox`
  (lecture plein écran zoomable). Visible des 3 rôles, lecture seule, zéro Firebase.
```

- [ ] **Step 2 : Mettre à jour le backlog**

Dans « Chantiers en cours / backlog », retirer la ligne « Journal de combat partagé » si on veut, ou laisser. Ajouter sous l'état actuel :

```
- **Onglet Récap (résumés de séance + BD flipbook)** : fait. `recaps.js` + `pages-recap.jsx`
  + `recaps/`. Ajouter une séance = déposer les .webp dans `recaps/seance-XX/` + une entrée
  `RECAPS`. `paginate` testée. Aucune règle RTDB.
```

- [ ] **Step 3 : Commit**

```bash
git add CLAUDE.md
git commit -m "docs: onglet Récap (mémoire projet)"
```

---

## Self-Review (effectuée)

- **Couverture du spec** : architecture statique + `recaps.js` (T2) ; routing/accès 3 rôles (T2) ;
  `RecapPage`/résumé/sélecteur (T2) ; `RecapBook` double page + flip + responsive (T3) ; lightbox (T4) ;
  `paginate` pure + tests, cas vide/impair (T1) ; états vides & fallback image (`onError`, `resume` masqué — T2/T3) ;
  doc (T5). ✔
- **Placeholders** : aucun « TODO/TBD » ; tout le code est fourni.
- **Cohérence des types** : `paginate(string[]) → string[][]` (T1) consommé par `RecapBook` (T3) ;
  `RecapBook` prop `onZoom(index)` (T3) branché par `RecapPage` (T4) ; `RecapLightbox(pages,index,onClose)` (T4).
- **Cas limite restant** : si `pages` contient des chemins en double, `pages.indexOf(src)` renvoie le 1er index
  (acceptable : les planches sont uniques). Noté, pas bloquant.
