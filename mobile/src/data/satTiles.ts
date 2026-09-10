// Bundled offline satellite tiles, per course → hole → required image module.
//
// This default is EMPTY. The Kempton APK build regenerates this file and
// downloads the images (scripts/fetch-sat-tiles.mjs) so the whole course ships
// inside the app for zero-setup offline use. Other builds keep it empty and the
// app falls back to the on-device cache / live imagery.
//
// Values are `require("...png")` module refs, usable directly as an <Image>
// source (bundled in the binary, so they load with no network).

export const SAT_TILES: Record<string, Record<number, number>> = {};
