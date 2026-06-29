# Hub d'accueil — design

> Chantier C du lot d'améliorations graphiques. Remplace la page Accueil mockup (`pages-lobby.jsx`)
> par un vrai hub : carrousel 3D des personnages + accès rapides + mémorial des morts.
> Aucune nouvelle règle RTDB, aucun nouveau schéma Firebase.

## Contexte / problème

`pages-lobby.jsx` (`LobbyPage`) est un vestige du mockup d'origine :
- Boutons « Rejoindre une session » / « Créer une session » qui ne font que `go('sheet')`/`go('mj')`.
- Un « code de session » `VX-7K2` codé en dur, 100 % décoratif.
- **Invisible des joueurs** : `defaultRoute` envoie les joueurs sur `sheet`, le staff sur `mj` ; seul le staff a `lobby` dans sa nav.

On le transforme en **hub d'accueil**, page d'atterrissage pour tous.

## Contrainte clé (validée : Option C, zéro changement de règle)

Les règles RTDB donnent à un joueur l'accès en lecture à **sa seule fiche** (`joueur = sa fiche seule`).
On **ne touche pas aux règles**. Conséquence sur le carrousel :
- **Staff** : barres PV/mana/bouclier/niveau **live** des 5 persos (`useAllCharStates`).
- **Joueur** : sa propre carte **live** (sa fiche, lisible) ; les 4 autres cartes affichent portrait/nom/
  classe/niveau (statique depuis `CHARACTERS`) mais **barres grisées/non remplies** (données inaccessibles).

## Décisions validées (brainstorming)

- Hub = **page d'atterrissage pour tous** (joueurs + staff).
- **Carrousel coverflow 3D** placé **en premier**, juste sous le titre « Chroniques de Runeterra ».
- Barres **sans chiffres** (remplissage seul) ; les chiffres ne s'affichent que sur sa propre carte.
- **Bio** (description) affichée sous la carte de face.
- **Mémorial** des personnages morts en bas (commence par Lunick).
- Blocs secondaires sous le carrousel : Reprendre / Combat en cours / Dernier récap / Séance (staff).

## Architecture cible

### Routing (`auth.js`)
- `defaultRoute(role)` → **`'lobby'`** pour tous les rôles (au lieu de `sheet`/`mj`).
- `PAGE_ACCESS.joueur` : ajouter `'lobby'`.
- `lobby` reste en groupe `main` (barre de nav) ou devient l'item d'accueil ; libellé « Accueil ».
- Le joueur reste **verrouillé sur son perso** ailleurs (inchangé).

### Page hub (`pages-lobby.jsx` → `HubPage`)
Remplace `LobbyPage`. Structure verticale :
1. **En-tête** : emblème (losange orné existant) + titre « Chroniques de Runeterra » + « Bonjour {pseudo} ».
2. **Carrousel** (`CharCarousel`, voir ci-dessous) — pièce maîtresse, plein largeur.
3. **Bio** de la carte de face (sous le carrousel).
4. **Accès rapides** : bouton **▶ Reprendre** (→ `sheet` joueur / `mj` staff) ; bandeau **⚔ Combat en
   cours** si `useSharedTurn().turn` actif ou `useMJEnemies()` non vide (lisibles par tous) → lien `competences` ;
   vignette **📖 Dernier récap** (`RECAPS[0]`) → lien `recap` ; bandeau **Séance en cours** (staff only,
   `useSession`).
5. **🪦 Mémorial** (`MemorialSection`) : cartes tombstone des persos morts (`MEMORIAL`).

### Carrousel coverflow 3D (`CharCarousel`)
- Disposition **cylindrique** : N cartes réparties autour d'un axe vertical ; 1 carte **de face** (centrée,
  agrandie, pleine opacité), les voisines **de profil** (rotation Y, échelle réduite, opacité dégradée),
  les autres derrière. CSS `transform: rotateY(...) translateZ(...) scale(...)` + `perspective` sur le conteneur.
- **Rotation** : flèches ◄/► + clic sur une carte latérale pour l'amener au centre ; transition CSS douce
  (`transition: transform .5s`). Auto-rotation **non retenue** (YAGNI — peut s'ajouter plus tard).
- L'index actif pilote l'angle de chaque carte via un helper pur **`carouselTransforms(count, activeIndex)`**
  → tableau `[{ rotateY, translateZ, scale, opacity, zIndex }]` (logique pure testable dans `game-logic.js`).
- **Contenu d'une carte** : portrait `ATH/Perso/{...}.webp`, nom, titre, classe, **niveau**, **3 barres**
  (PV/mana/bouclier) via `ResourceBar` (déjà animées). Remplissage selon rôle (voir contrainte) ; chiffres
  seulement sur sa propre carte / pour le staff.
- **Données** : `CHARACTERS` (statique) ; `useAllCharStates()` (staff) ; pour un joueur, `useCharState(monId)`
  pour sa carte. La détection « ma carte » : `localStorage 'runeterra_identity'` / `useAuthIdentity().charId`.

### Bio des personnages (`data.jsx`)
- Ajouter un champ **`bio`** (string courte) à chaque entrée `CHARACTERS`. Seedé avec des descriptions
  brèves tirées des titres/classes (le MJ réécrira). Affiché sous la carte de face.

### Mémorial (`data.jsx` + `MemorialSection`)
- Nouvelle constante **`MEMORIAL`** = `[{ name, player, img, fell, epitaph, tale }]` :
  - `fell` : où/quand (« Séance n°13 — Désert de Shurima, 30/05 »).
  - `epitaph` : courte (« Achevé non par le Xer'Sai mais par un coup d'Urskaar en plein chaos. »).
  - `tale` : récit plus long (optionnel, repliable), texte de la séance 13.
- Première entrée : **Lunick** (`img: 'ATH/Perso/Lunick.webp'`, joueur Fab). Mort lors de la bataille des
  Xer'Sai à Shurima — relique lunaire, puis tué accidentellement par Urskaar (échec critique) ; mâchoire
  relocalisée, côtes criblées de pierres.
- `MemorialSection` : cartes tombstone (🪦, portrait grisé/sépia, épitaphe ; `tale` en dépliable). Visible de tous.

### Styles (`runeterra.css`)
- Classes carrousel (`perspective`, `.carousel-card`, transitions), styles tombstone (sépia, bordure pierre).

## Modèle de données

**Aucun changement de schéma Firebase. Aucune nouvelle règle RTDB.** Lectures existantes uniquement
(`useAllCharStates` staff, `useCharState` joueur sur son perso, `useSharedTurn`, `useMJEnemies`, `useSession`).
`bio` et `MEMORIAL` sont des **données statiques** (`data.jsx`), non persistées.

## Découpage en unités

- `game-logic.js` : `carouselTransforms(count, activeIndex)` (pur, testé).
- `auth.js` : `defaultRoute` → `lobby` + `lobby` dans `PAGE_ACCESS.joueur`.
- `data.jsx` : champ `bio` sur `CHARACTERS` + constante `MEMORIAL`.
- `pages-lobby.jsx` : `HubPage` (remplace `LobbyPage`) + `CharCarousel` + `MemorialSection`.
- `index.html` : `PAGES` — l'entrée `lobby` rend `<HubPage/>` (libellé « Accueil »).
- `runeterra.css` : styles carrousel 3D + tombstone.

## Tests

- `carouselTransforms` : N=5 ; carte active = `rotateY 0, scale max, opacity 1, zIndex max` ; symétrie
  gauche/droite ; enroulement (wrap) de l'index (activeIndex 0 et N-1 voisins).
- Vérif syntaxe `npx esbuild` sur les `.jsx` modifiés ; `node --test` (suite verte).
- Vérif visuelle (rotation, profils, bio qui suit la carte de face, mémorial) en local.

## Hors périmètre (YAGNI)

- Pas d'auto-rotation du carrousel (ajout ultérieur possible).
- Pas de barres live pour les coéquipiers côté joueur (contrainte RTDB assumée — Option C).
- Pas de drag tactile (flèches + clic suffisent en v1).
- Pas de refonte des onglets B (runes) / D (animations) — chantiers séparés.

## Risques

- Routing : bien vérifier qu'un joueur atterrit sur `lobby` et peut naviguer vers sa fiche sans être
  bloqué (`canSeePage('lobby', 'joueur')` doit être vrai).
- Perf CSS 3D : 5 cartes, négligeable.
- Le carrousel doit rester lisible/cliquable sur écran étroit (repli : réduire `translateZ`/échelle, ou
  empiler en liste sous une largeur seuil).
