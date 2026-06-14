import { chromium } from 'playwright';

const URL = process.argv[2] || 'http://127.0.0.1:5050/index.html';
const errors = [];

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });

// 1) écran de connexion
const USER = process.env.SMOKE_USER || 'smoke';
const PASS = process.env.SMOKE_PASS || 'smoke-pass';
await page.getByPlaceholder('Nom d\'utilisateur').waitFor({ timeout: 15000 });
console.log('OK  écran de connexion affiché');

// 2) se connecter avec le compte de test (attribué à un perso côté Admin)
await page.getByPlaceholder('Nom d\'utilisateur').fill(USER);
await page.getByPlaceholder('Mot de passe').fill(PASS);
await page.getByRole('button', { name: 'Se connecter' }).click();

// 3) la fiche charge (état Firebase) -> panneau survie présent et non "Chargement…"
const fatiguePanel = page.locator('.panel', { hasText: 'Fatigue' }).filter({ hasNotText: 'Eau' }).first();
await fatiguePanel.waitFor({ timeout: 15000 });
await page.waitForFunction(() => !document.body.innerText.includes('Chargement…'), { timeout: 15000 });
console.log('OK  fiche chargée depuis Firebase');

// 4) lire la valeur de Fatigue, cliquer +, vérifier l'incrément (aller-retour Firebase)
const readFatigue = async () => {
  const txt = await fatiguePanel.locator('span.mono').first().innerText();
  return parseInt(txt.split('/')[0].trim(), 10);
};
const waitFatigue = async (target) => {
  for (let i = 0; i < 50; i++) {
    if (await readFatigue() === target) return;
    await page.waitForTimeout(200);
  }
  throw new Error('Fatigue n a pas atteint ' + target + ' (valeur=' + await readFatigue() + ')');
};
await fatiguePanel.getByRole('button', { name: '↺' }).click();
await waitFatigue(0);
await fatiguePanel.getByRole('button', { name: '+' }).click();
await waitFatigue(1);
const after = await readFatigue();
if (after !== 1) { console.log('ÉCHEC: Fatigue attendue 1, obtenue ' + after); process.exit(1); }
console.log(`OK  Fatigue 0 -> ${after} (écriture+lecture Firebase temps réel)`);

// (supprimé) — le compte de test est un joueur, pas d'accès Vue MJ

await browser.close();

if (errors.length) {
  console.log('\n⚠️  ERREURS CONSOLE/PAGE:');
  for (const e of errors) console.log('   ' + e);
  process.exit(1);
}
console.log('\n✅ SMOKE TEST PASSÉ — aucune erreur console.');
