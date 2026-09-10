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

const got = [];
for (const t of manifest.tiles) {
  if (!t.url) continue;
  try {
    const res = await fetch(t.url);
    if (!res.ok) { console.error(`hole ${t.hole}: HTTP ${res.status}`); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000) { console.error(`hole ${t.hole}: suspiciously small (${buf.length}b)`); continue; }
    fs.writeFileSync(path.join(outDir, `kempton-${t.hole}.png`), buf);
    got.push(t.hole);
    console.log(`hole ${t.hole}: ${(buf.length / 1024).toFixed(0)} KB`);
  } catch (e) {
    console.error(`hole ${t.hole}: ${e?.message ?? e}`);
  }
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

// Fail the build if any hole is missing, so a partial offline set never ships.
// (satTiles.ts is still written above, so a re-run only re-fetches what failed.)
if (got.length !== manifest.tiles.length) {
  const missing = manifest.tiles.filter((t) => t.url && !got.includes(t.hole)).map((t) => t.hole);
  console.error(`ERROR: only ${got.length}/${manifest.tiles.length} tiles bundled — missing holes: ${missing.join(", ")}`);
  process.exit(1);
}
