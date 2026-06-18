# Design — Onglet « Récap » (résumés de séance + BD illustrée)

Date : 2026-06-18
Statut : validé (brainstorming), prêt pour le plan d'implémentation.

## But

À la fin de chaque séance de JDR, archiver un **récap** consultable par les joueurs
et le MJ, sous deux formes complémentaires :

1. **Texte rapide et concis** — un TL;DR pour se rafraîchir la mémoire avant la
   prochaine séance.
2. **BD illustrée** — des planches générées par IA, présentées comme un **vrai livre**
   qu'on feuillette (double page + animation de tournage de page).

Objectif global : **traçabilité** des événements de la campagne, séance après séance.

## Faits cadrants (décidés au brainstorming)

- **Chaque image est une planche complète et finie** : bandeau-titre, cases numérotées,
  **tout le texte narratif déjà incrusté** (encadrés, dialogues, choix, récompenses),
  **numéro de page gravé** dans l'image. Conséquence : l'app **n'ajoute ni grille ni
  texte** par-dessus. **1 image = 1 page.**
- Format des planches : **portrait type A4** (vu sur `idée/page1.webp`, `idée/page2.webp`).
  Dense en texte → **lisibilité only en plein écran** : un zoom/lightbox au clic est requis.
- **Stockage : images commitées dans le repo public**, servies en statique par GitHub Pages.
  Choix assumé : repo public → images techniquement atteignables par URL (OK, contenu entre
  potes). Le plus léger, pleine résolution, **zéro charge Firebase**, traçabilité via git.
  Écarté : Drive (hotlink cassé par Google), data URL RTDB (gonfle la base), Firebase Storage
  (non configuré, hors zéro-build).
- **Pas de temps réel** : un récap est un document **figé** (écrit une fois, jamais réédité
  en direct). Donc **aucune** machinerie Firebase, **aucune** nouvelle règle RTDB.
- **Pas de dépendance externe** : l'animation de flip est faite-main en React/CSS 3D
  (les libs type turn.js/StPageFlip prennent le contrôle du DOM et s'entendent mal avec
  React en zéro-build).

## Architecture

Cohérent avec le pattern zéro-build du projet (`Object.assign(window, …)`, ordre de
chargement dans `index.html`).

### Données — `recaps.js` (nouveau, chargé comme `data.jsx`)

```js
const RECAPS = [
  {
    id:     'seance-01',
    date:   '2026-06-14',
    titre:  'La dernière session',
    resume: 'Texte rapide et concis…',   // format TL;DR ; optionnel
    pages: [
      'recaps/seance-01/page1.webp',
      'recaps/seance-01/page2.webp',
      // …
    ],
  },
  // séances suivantes ajoutées EN TÊTE (plus récente en premier)
];
Object.assign(window, { RECAPS });
```

- Images dans `recaps/seance-XX/` (commitées, statiques).
- **Ajouter une séance** = déposer les webp + ajouter une entrée `RECAPS` → commit/push.
  Rien d'autre. Faisable sans dev (juste fichiers + une entrée).

### Routing / accès

- Nouvelle page enregistrée dans `PAGES` (`index.html`) :
  `{ id:'recap', label:'Récap', render:() => <RecapPage /> }`.
- `auth.js` → ajouter `'recap'` à **PAGE_ACCESS des 3 rôles** (`joueur`, `mj`, `admin`).
  Visible par tout le monde, lecture seule pour tous (pas d'édition in-app).
- Charger `<script type="text/babel" src="recaps.js">` et `pages-recap.jsx` dans le bon
  ordre (data avant pages).

## Composants (isolés, testables séparément)

### `RecapPage` — `pages-recap.jsx`
- **En-tête** : sélecteur de séance (boutons « Séance 1 · La dernière session », la plus
  récente en premier) + date affichée.
- **Bloc résumé** : panneau dark-fantasy avec `resume` (masqué si absent).
- Rend `<RecapBook pages={seance.pages} />` en dessous.
- État vide si `RECAPS` est vide (« Aucun récap pour l'instant »).
- Dépend de : `RECAPS` (window), styles CSS existants.

### `RecapBook` — `pages-recap.jsx` (réutilisable, reçoit `pages=[…]`)
- **Desktop/tablette** : double page (page N gauche, N+1 droite), reliure centrale, fond
  sombre. Clic moitié droite → **flip** (CSS 3D `rotateY` + `preserve-3d`, transition) vers
  les 2 pages suivantes. Flèches ◀ ▶ + clavier ←/→.
- **Mobile / écran étroit** : **page simple**, même flip, une page à la fois (détection via
  media query / largeur).
- Compteur discret « pages 3–4 / 12 ».
- Dimensionné sur le ratio portrait A4, centré.
- Clic sur une page → ouvre `RecapLightbox` (image + index courant).
- Dépend de : `paginate()` (logique pure), `RecapLightbox`.

### `RecapLightbox` — `pages-recap.jsx`
- Plein écran zoomable (lecture confortable du texte des cases).
- Navigation page précédente/suivante, fermeture Échap / clic hors-zone.
- Reçoit la liste des images + l'index ; autonome.

## Logique pure & tests

- `paginate(pages)` → regroupe le tableau d'images en doubles-pages `[[p1,p2],[p3,p4],…]`.
  Ajoutée à `game-logic.js` (UMD, déjà testable en Node + exposée sur `window`) et exportée
  dans le `return` du module. Cas couverts par `node --test test/game-logic.test.js` :
  - `[]` → `[]` (vide)
  - 1 page → `[[p1]]`
  - nombre pair → doubles-pages pleines
  - nombre impair → dernière paire avec une seule page (côté droit vide)
- Le reste (flip, lightbox, sélecteur) = UI React, **vérifié visuellement** (pas de test auto).

## Cas limites

- **`RECAPS` vide** → état vide propre.
- **Pages impaires** → dernière double-page = page seule à gauche, droite vide (comme un livre).
- **Image manquante / chemin cassé** → fallback discret (`onError`), pas de croix navigateur.
- **`resume` absent** → bloc texte masqué, le livre s'affiche quand même.

## Hors scope (YAGNI)

- Upload in-app des images (workflow = commit).
- Édition in-app du récap / temps réel Firebase.
- Courbure de papier photoréaliste (un flip propre suffit).
- Page de couverture dédiée (la planche 1 titrée fait office d'ouverture).
- Captions/grille ajoutées par l'app (les planches sont déjà finies).

## Impacts

- **Nouveaux fichiers** : `recaps.js`, `pages-recap.jsx`, dossier `recaps/seance-XX/`.
- **Modifs** : `index.html` (scripts + `PAGES`), `auth.js` (`PAGE_ACCESS`),
  `game-logic.js` (+`paginate` + test), `runeterra.css` (styles livre/flip/lightbox),
  `CLAUDE.md` (doc).
- **Aucune** règle RTDB, **aucune** dépendance CDN nouvelle.
