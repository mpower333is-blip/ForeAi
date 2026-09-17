// Download each Kempton hole's satellite image (from the manifest computed by
// gen-kempton-tiles.ts) and bundle it into the app: writes the PNGs to
// mobile/assets/sat/ and regenerates mobile/src/data/satTiles.ts to require them.
//
// Run at build time (Codemagic Kempton workflow) BEFORE expo prebuild / bundle.
// Never fails the build: any tile that can't be fetched is skipped and the app
// falls back to its on-device cache / live imagery for that hole.
//
//   node scripts/fetch-sat-tiles.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "kempton-tiles.json"), "utf8"));
const courseId = manifest.courseId;
const outDir = path.join(root, "mobile/assets/sat");
const tilesFile = path.join(root, "mobile/src/data/satTiles.ts");

fs.mkdirSync(outDir, { recursive: true });

// Fetch one tile with retries + backoff and a per-attempt timeout. The tile
// server returns the odd transient 500, so a single hiccup must not lose a hole.
async function fetchTile(url, hole, tries = 4) {
  let lastErr = "";
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30000);
      let res;
      try {
        res = await fetch(url, { signal: ctrl.signal });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) {
        lastErr = `HTTP ${res.status}`;
      } else {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 1000) lastErr = `suspiciously small (${buf.length}b)`;
        else return buf;
      }
    } catch (e) {
      lastErr = e?.message ?? String(e);
    }
    if (attempt < tries) {
      const wait = 1000 * 2 ** (attempt - 1); // 1s, 2s, 4s
      console.error(`hole ${hole}: ${lastErr} — retrying in ${wait / 1000}s (attempt ${attempt}/${tries})`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  console.error(`hole ${hole}: gave up after ${tries} attempts — ${lastErr}`);
  return null;
}

const got = [];
for (const t of manifest.tiles) {
  if (!t.url) continue;
  const buf = await fetchTile(t.url, t.hole);
  if (!buf) continue;
  fs.writeFileSync(path.join(outDir, `kempton-${t.hole}.png`), buf);
  got.push(t.hole);
  console.log(`hole ${t.hole}: ${(buf.length / 1024).toFixed(0)} KB`);
}

const body = got.length
  ? `export const SAT_TILES: Record<string, Record<number, number>> = {\n  "${courseId}": {\n` +
    got.map((h) => `    ${h}: require("../../assets/sat/kempton-${h}.png"),`).join("\n") +
    `\n  },\n};\n`
  : `export const SAT_TILES: Record<string, Record<number, number>> = {};\n`;

fs.writeFileSync(
  tilesFile,
  `// AUTO-GENERATED at build time by scripts/fetch-sat-tiles.mjs — do not edit.\n` + body,
);

console.log(`bundled ${got.length}/${manifest.tiles.length} tiles into ${courseId}`);

// Fail-soft (see header): after retries, a still-missing hole is a warning, not a
// build failure — the app falls back to live/cached imagery for that hole, and a
// flaky tile server must never block an app release. satTiles.ts is written above
// with whatever succeeded, so a later re-run only re-fetches the gaps.
if (got.length !== manifest.tiles.length) {
  const missing = manifest.tiles.filter((t) => t.url && !got.includes(t.hole)).map((t) => t.hole);
  console.error(`WARNING: only ${got.length}/${manifest.tiles.length} tiles bundled — missing holes: ${missing.join(", ")}. App uses live/cached imagery for these; not failing the build.`);
}
