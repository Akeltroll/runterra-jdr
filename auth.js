/* ============================================================
   LOGIQUE D'AUTH PURE — Chroniques de Runeterra
   Aucune dépendance React/DOM/Firebase : testable en Node,
   et exposée sur `window` côté navigateur (UMD léger).
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') Object.assign(window, api);
})(typeof self !== 'undefined' ? self : this, function () {

  const EMAIL_DOMAIN = 'runeterra.local';
  const ROLES = ['joueur', 'mj', 'admin'];

  /* Pseudo -> e-mail factice pour Firebase Email/Password.
     Renvoie null si le pseudo est invalide. */
  function usernameToEmail(username) {
    if (typeof username !== 'string') return null;
    const u = username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{2,30}$/.test(u)) return null;
    return u + '@' + EMAIL_DOMAIN;
  }

  const isStaff = (role) => role === 'mj' || role === 'admin';
  const isAdmin = (role) => role === 'admin';

  /* Un compte joueur sans perso attribué est « en attente ». */
  const isPending = (rec) => !!rec && rec.role === 'joueur' && !rec.charId;

  /* Pages visibles selon le rôle (ids alignés sur PAGES dans index.html). */
  const PAGE_ACCESS = {
    joueur: ['sheet', 'equip', 'inv', 'recap', 'runes', 'competences'],
    mj:     ['lobby', 'mj', 'sheet', 'equip', 'journal', 'prog', 'ds', 'inv', 'recap', 'runes', 'competences'],
    admin:  ['lobby', 'mj', 'sheet', 'equip', 'journal', 'prog', 'ds', 'inv', 'recap', 'runes', 'competences', 'admin'],
  };
  const pagesForRole = (role) => PAGE_ACCESS[role] || [];
  const canSeePage = (pageId, role) => pagesForRole(role).indexOf(pageId) !== -1;

  /* Page d'accueil par défaut selon le rôle. */
  const defaultRoute = (role) => (role === 'joueur' ? 'sheet' : 'mj');

  return {
    EMAIL_DOMAIN, ROLES, usernameToEmail,
    isStaff, isAdmin, isPending,
    pagesForRole, canSeePage, defaultRoute,
  };
});
