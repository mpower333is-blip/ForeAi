// Bundles the canonical survey tool (clubhouse/manage/survey.html) into a TS
// string the survey APK loads in a WebView. Keeps ONE source of truth: edit
// survey.html, then run `node scripts/bundle-survey.js` to regenerate.
const fs = require("fs");
const path = require("path");

const src = path.resolve(__dirname, "../../clubhouse/manage/survey.html");
const out = path.resolve(__dirname, "../src/survey/surveyHtml.ts");

const html = fs.readFileSync(src, "utf8");
const body =
  "// AUTO-GENERATED from clubhouse/manage/survey.html by scripts/bundle-survey.js\n" +
  "// Do not edit by hand — edit survey.html and re-run the bundler.\n" +
  "export const SURVEY_HTML = " +
  JSON.stringify(html) +
  ";\n";

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, body);
console.log(`Wrote ${out} (${html.length} chars of HTML)`);
