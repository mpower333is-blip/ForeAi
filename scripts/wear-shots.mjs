// Render the Kempton Park Wear OS Play Store screenshots from the HTML watch
// mockup (scripts/wear-mock.html) using headless Chromium. Writes five 480x480
// (1:1) PNGs into store/kempton/wear/. Run:  node scripts/wear-shots.mjs
//
// Uses the Chromium that ships in this repo's CI/dev image via Playwright. If the
// path below doesn't exist on your machine, install Playwright's chromium
// (`npx playwright install chromium`) and drop the executablePath option.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const require = (await import('node:module')).createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML = join(__dirname, 'wear-mock.html');
const OUT = join(__dirname, '..', 'store', 'kempton', 'wear');

const shots = {
  s1: 'wear-01-distance.png',
  s2: 'wear-02-hole.png',
  s3: 'wear-03-scorecard.png',
  s4: 'wear-04-lightning.png',
  s5: 'wear-05-teetime.png',
};

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const launchOpts = existsSync(CHROME) ? { executablePath: CHROME } : {};

const browser = await chromium.launch(launchOpts);
const page = await browser.newPage({ deviceScaleFactor: 1 });
await page.goto('file://' + HTML);
for (const [id, name] of Object.entries(shots)) {
  const el = await page.$('#' + id);
  await el.screenshot({ path: join(OUT, name) });
  console.log('wrote', name);
}
await browser.close();
