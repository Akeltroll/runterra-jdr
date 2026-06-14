# Design — Authentification par comptes & rôles

> Spec validée le 2026-06-15. Fait suite à la v1 (auth anonyme).
> Objectif : remplacer la connexion anonyme par de **vrais comptes** (identifiant +
> mot de passe), avec un **cloisonnement par rôle appliqué côté serveur**.

## 1. Objectif & exigence centrale

Aujourd'hui l'app se connecte en **anonyme** : l'identité (perso choisi ou « mj »)
n'est qu'un `localStorage`, sans aucune protection — n'importe qui peut voir et
modifier n'importe quelle fiche.

**Exigence centrale (mot du commanditaire) :**
> « Les joueurs ont accès **uniquement à leur fiche de perso**, jamais à celle des
> autres. »

Ce cloisonnement doit être **réel** (refusé par Firebase, pas juste masqué dans
l'UI). L'architecture par rôle doit aussi permettre **d'ouvrir plus tard d'autres
pages aux joueurs** sans refonte.

## 2. Rôles

Trois rôles, stockés par compte dans `/users/{uid}` :

| Rôle     | Accès |
|----------|-------|
| `joueur` | **Sa seule** fiche de perso, en lecture/écriture. Rien d'autre. |
| `mj`     | Vue MJ (temps réel) + **toutes** les fiches en lecture/écriture. Pas de gestion des comptes. |
| `admin`  | Tout ce que le MJ a, **+** une page Admin pour attribuer rôle & perso aux comptes. |

MJ et admin sont **deux rôles distincts** (pour pouvoir un jour confier le MJ à
quelqu'un sans lui donner les clés des comptes).

## 3. Décisions figées (issues du brainstorming)

- **Création des comptes** : par l'**admin**. Le compte Auth (identifiant + mot de
  passe) se crée dans la **console Firebase** ; l'attribution rôle+perso se fait
  dans une **page Admin** du site.
- **Identifiant de connexion** : un **nom d'utilisateur** (pas un vrai e-mail).
  L'app fabrique en coulisse un e-mail factice `username@runeterra.local` pour
  Firebase Email/Password. Le joueur ne voit jamais cet e-mail.
- **Mots de passe** : création et **réinitialisation** gérées dans la **console
  Firebase** (pas de reset auto par e-mail, puisque les e-mails sont factices).
  La page Admin ne touche **pas** aux mots de passe.
- **Droits MJ** : le MJ **modifie** l'état de tous les persos (cohérent avec le
  tableau de bord temps réel).
- **Connexion obligatoire d'emblée** : tant qu'on n'est pas authentifié, on ne voit
  **que l'écran de connexion** — pas de topbar, pas de nav, aucune page.
- **Enforcement** : par **table de correspondance dans la base** (`/users/{uid}`)
  consultée par les règles RTDB. Pas de Cloud Functions, pas de custom claims, pas
  de clé de service (cohérent avec le dépôt public & le « zéro build »).

## 4. Modèle de données

Nouveau nœud à la racine, à côté de `/campaign` :

```
/users/{uid}
    username : "jett"                 (affichage + confort admin)
    role     : "joueur" | "mj" | "admin"
    charId   : "jett"                 (présent seulement pour role=joueur)
```

`/campaign/runeterra/characters/{charId}/state/...` : **inchangé**.

`charId` ∈ {rathael, urskaar, smith, lunick, jett}.

## 5. Règles RTDB (le cœur)

Les règles RTDB n'ont pas de fonctions : les conditions de rôle sont **répétées**
(verbeux mais sans impact à cette échelle). Logique cible :

### `/users`
- `/users` (collection) : **lecture réservée à l'admin** (pour lister les comptes
  dans la page Admin).
- `/users/{uid}` :
  - **lecture** : `auth.uid === $uid` (son propre enregistrement) **ou** admin.
  - **écriture** : **admin uniquement**, *sauf* l'exception d'auto-inscription
    ci-dessous.
  - **Exception « première connexion »** : un compte peut créer **son propre**
    `/users/{uid}` **s'il n'existe pas encore** (`!data.exists()`), avec valeurs
    **contraintes** : `role` forcé à `"joueur"` et **pas de `charId`**. Cela évite
    de copier des UID à la main, tout en empêchant toute auto-promotion. Une fois
    créé, seul l'admin peut le modifier.

### `/campaign/runeterra/characters`
- **lecture** au niveau `characters` (toute la collection) : autorisée si `mj` ou
  `admin` (nécessaire car la Vue MJ s'abonne à la collection entière — les règles
  RTDB ne cascadent pas vers le haut).
- au niveau `characters/{charId}` :
  - **lecture** : si `mj`/`admin`, **ou** si `charId` est le perso du compte
    (`/users/{uid}/charId === $charId`).
  - **écriture** : `mj`/`admin` partout, **ou** le joueur **sur son seul perso**.

Conséquence : un joueur qui tente d'accéder à la fiche d'un autre via la console du
navigateur est **refusé par le serveur**.

## 6. Flux d'authentification

1. **Écran de connexion** (remplace l'actuel `IdentityModal` « Qui es-tu ? ») :
   champs **nom d'utilisateur** + **mot de passe**, bouton « Se connecter »,
   message d'erreur clair en cas d'échec.
2. L'app transforme le pseudo en e-mail : `usernameToEmail("Jett")` →
   `"jett@runeterra.local"` (minuscules, jeu de caractères validé), puis
   `signInWithEmailAndPassword`.
3. Après connexion, l'app lit `/users/{uid}` → `role` + `charId` → décide quoi
   afficher.
4. **Gating** :
   - non connecté → **écran de connexion seul** ;
   - connecté mais `/users/{uid}` « en attente » (role `joueur`, pas de `charId`)
     → écran **« Compte en attente d'attribution par le MJ »** ;
   - sinon → app filtrée selon le rôle (Section 7).

### `firebase-config.js`
- Retirer `signInAnonymously`.
- S'appuyer sur `onAuthStateChanged` ; `RTDB.ready` ⇒ « état d'auth connu » (et non
  plus « connecté »).
- Exposer : `RTDB.signIn(username, password)`, `RTDB.signOut()`, et l'utilisateur
  courant (uid).

### `data-state.jsx`
- Remplacer `useIdentity` (localStorage) par un hook dérivé de l'auth Firebase +
  `/users/{uid}` : retourne `{ uid, username, role, charId, loading }`.

## 7. UI par rôle

Navigation et pages **filtrées selon le rôle** :

- **Joueur** : **uniquement sa fiche**, verrouillée sur son perso. Le sélecteur de
  perso de `SheetPage` est **masqué** pour un joueur. Pas de Vue MJ, Journal,
  Progression, Design System, ni Admin. (Réservé volontairement pour l'instant ;
  d'autres pages joueurs viendront plus tard.)
- **MJ** : Vue MJ + fiches de tous (sélecteur conservé) + Journal/Progression/DS.
- **Admin** : idem MJ + **page Admin**.

**Topbar** : ajouter un bouton **« Se déconnecter »** et l'affichage du pseudo/rôle
courant (remplace le faux `SESSION · VX-7K2` statique).

## 8. Amorçage & page Admin

### Premier admin (manuel, une seule fois)
Problème de l'œuf et la poule : écrire dans `/users` exige déjà d'être admin.
1. Console Firebase → **Authentication** : créer le compte admin
   (`akeltroll@runeterra.local` + mot de passe). *(Déjà fait par l'utilisateur.)*
2. Console Firebase → **Realtime Database → onglet Données** : ajouter à la main
   `/users/{adminUID}` = `{ username:"akeltroll", role:"admin" }`. La clé du nœud
   **est l'UID** (copié depuis Authentication). Faisable car le propriétaire du
   projet écrit via la console même si les règles refusent (ou tant que les règles
   ouvertes sont actives).

### Onboarding d'un joueur (flux courant, sans copier d'UID)
1. Admin crée le compte dans **Authentication** (username→e-mail + mot de passe
   provisoire).
2. **Première connexion** du joueur → l'app auto-crée `/users/{uid}` « en attente »
   (role `joueur`, sans perso). Le joueur voit l'écran d'attente.
3. Admin ouvre la **page Admin**, voit le compte en attente, lui **attribue son
   perso** (et son rôle si besoin).
4. Le joueur rafraîchit → il a sa fiche.

### Page Admin (rôle admin only)
Tableau des comptes `/users` : par ligne le **pseudo**, un sélecteur **rôle**
(joueur/mj/admin) et un sélecteur **perso**. Enregistrer → écrit `/users/{uid}`.
Ne gère **pas** les mots de passe (console Firebase).

## 9. Migration

- Données `/campaign/...` : **conservées**, aucune migration.
- `localStorage 'runeterra_identity'` : **abandonné**.
- **Ordre de bascule au déploiement** (check-list, à exécuter quand le code est
  prêt — pas avant) :
  1. Pousser le nouveau code sur `main` (GitHub Pages).
  2. Créer les comptes joueurs dans **Authentication**.
  3. Vérifier le nœud admin `/users/{adminUID}` (onglet **Données**).
  4. **Publier les règles strictes** (onglet **Règles**).
  5. **Désactiver l'Anonyme** (E-mail/Mot de passe prend le relais).
  6. Chaque joueur se connecte une fois → attribution du perso via page Admin.

**Pendant le développement** : Anonyme **et** E-mail/Mot de passe activés tous les
deux, **anciennes règles ouvertes** en place (sinon le site v1 casse).

## 10. Tests

- `usernameToEmail()` : helper pur, **testé unitairement** (`node --test`, comme
  `game-logic`).
- `test/smoke.mjs` : adapté pour **se connecter avec un compte de test dédié**
  (au lieu de l'anonyme).
- `test/game-logic.test.js` : inchangé.

## 11. Documentation

Mettre à jour `CLAUDE.md` : section Auth (anonyme → comptes + rôles), modèle de
données (`/users`), et la check-list de déploiement.

## 12. Hors périmètre (plus tard)

- Création de comptes **depuis la page Admin** (nécessiterait une instance Firebase
  secondaire pour ne pas déconnecter l'admin) — pour l'instant via la console.
- Reset de mot de passe en self-service (impossible avec des e-mails factices).
- Custom claims / règles scopées par token.
- Nouvelles pages accessibles aux joueurs (le filtrage par rôle les rendra triviales
  à brancher).
