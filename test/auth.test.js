const test = require('node:test');
const assert = require('node:assert');
const A = require('../auth.js');

test('usernameToEmail normalise et suffixe le domaine factice', () => {
  assert.equal(A.usernameToEmail('Jett'), 'jett@runeterra.local');
  assert.equal(A.usernameToEmail('  AkelTroll '), 'akeltroll@runeterra.local');
  assert.equal(A.usernameToEmail('jean.bap_01'), 'jean.bap_01@runeterra.local');
});

test('usernameToEmail refuse les entrées invalides (null)', () => {
  assert.equal(A.usernameToEmail(''), null);
  assert.equal(A.usernameToEmail('a'), null);            // trop court
  assert.equal(A.usernameToEmail('jett espace'), null);  // espace interne
  assert.equal(A.usernameToEmail('jett@x'), null);       // caractère interdit
  assert.equal(A.usernameToEmail(42), null);
});

test('isStaff / isAdmin', () => {
  assert.equal(A.isStaff('mj'), true);
  assert.equal(A.isStaff('admin'), true);
  assert.equal(A.isStaff('joueur'), false);
  assert.equal(A.isAdmin('admin'), true);
  assert.equal(A.isAdmin('mj'), false);
});

test('isPending = joueur sans perso attribué', () => {
  assert.equal(A.isPending({ role: 'joueur' }), true);
  assert.equal(A.isPending({ role: 'joueur', charId: '' }), true);
  assert.equal(A.isPending({ role: 'joueur', charId: 'jett' }), false);
  assert.equal(A.isPending({ role: 'mj' }), false);
  assert.equal(A.isPending(null), false);
});

test('canSeePage filtre selon le rôle', () => {
  assert.equal(A.canSeePage('sheet', 'joueur'), true);
  assert.equal(A.canSeePage('mj', 'joueur'), false);
  assert.equal(A.canSeePage('admin', 'joueur'), false);
  assert.equal(A.canSeePage('mj', 'mj'), true);
  assert.equal(A.canSeePage('admin', 'mj'), false);
  assert.equal(A.canSeePage('admin', 'admin'), true);
  assert.deepEqual(A.pagesForRole('joueur'), ['sheet', 'equip', 'inv', 'recap', 'runes', 'competences', 'prog']);
});

test("la page inv (inventaire commun) est visible par tous les roles", () => {
  assert.equal(A.canSeePage('inv', 'joueur'), true);
  assert.equal(A.canSeePage('inv', 'mj'), true);
  assert.equal(A.canSeePage('inv', 'admin'), true);
});

test("la page recap est visible par tous les roles", () => {
  assert.equal(A.canSeePage('recap', 'joueur'), true);
  assert.equal(A.canSeePage('recap', 'mj'), true);
  assert.equal(A.canSeePage('recap', 'admin'), true);
});

test("la page runes est visible par tous les roles", () => {
  assert.equal(A.canSeePage('runes', 'joueur'), true);
  assert.equal(A.canSeePage('runes', 'mj'), true);
  assert.equal(A.canSeePage('runes', 'admin'), true);
});

test("la page competences est visible par tous les roles", () => {
  assert.equal(A.canSeePage('competences', 'joueur'), true);
  assert.equal(A.canSeePage('competences', 'mj'), true);
  assert.equal(A.canSeePage('competences', 'admin'), true);
});
