import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;

const OUT = process.argv[2];
const HTML = process.argv[3];

// Current App Store Connect Apple Watch screenshot sizes.
// App Store Connect accepted Apple Watch sizes (from the uploader).
const sizes = [
  { tag: '422x514', w: 422, h: 514 }, // Apple Watch Ultra 3
  { tag: '410x502', w: 410, h: 502 }, // Apple Watch Ultra / Ultra 2
  { tag: '416x496', w: 416, h: 496 }, // Apple Watch Series 11 / 10
];
const screens = {
  a1: '01-distance', a2: '02-club', a3: '03-teetimes', a4: '04-lightning',
};

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ deviceScaleFactor: 1 });
await page.goto('file://' + HTML);

for (const s of sizes) {
  await page.addStyleTag({ content: `:root{ --W:${s.w}px !important; --H:${s.h}px !important; }` });
  for (const [id, name] of Object.entries(screens)) {
    const el = await page.$('#' + id);
    const file = `${OUT}/apple-${s.tag}-${name}.png`;
    await el.screenshot({ path: file });
    console.log('wrote', file.split('/').pop());
  }
}
await browser.close();
