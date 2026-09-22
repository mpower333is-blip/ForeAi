# Kempton Park Golf — Wear OS Play Store assets

Graphics for the **Wear OS** listing of the Kempton Park Golf app on Google Play.
The watch app ships under the **same** Play app as the phone
(`com.foreai.kempton`), so on the "Wear OS" store-listing tab you only need to
add the watch screenshots — the app icon and feature graphic are shared with the
phone listing and reused here for convenience.

## What to upload (Play Console → Store listing → Wear OS)

| Asset | File | Size | Notes |
|-------|------|------|-------|
| Watch screenshots | `wear-01-distance.png` … `wear-05-teetime.png` | 480 × 480 (1:1) | Min 2 required. Play accepts 1:1, 384–3840 px. |
| App icon | `wear-icon-512.png` | 512 × 512 | Same icon as the phone listing. |
| Feature graphic | `wear-feature-1024x500.png` | 1024 × 500 | Same as the phone listing (optional on Wear tab). |

### Screenshots, in order
1. **wear-01-distance** — GPS distance to the pin (front / centre / back).
2. **wear-02-hole** — hole number, par, stroke index, yards.
3. **wear-03-scorecard** — running scorecard, score to par.
4. **wear-04-lightning** — the lightning safety alarm (real-strike alert).
5. **wear-05-teetime** — your booked tee time and 4-ball.

## Regenerating

The screenshots are rendered from an HTML watch mockup with headless Chromium:

```
node scripts/wear-shots.mjs        # writes the five wear-0*.png here
```

(The mockup HTML + render script live in `scripts/`. Edit the mockup to change
copy/branding, then re-run.) The navy `#081226` + gold `#F3C33B` palette matches
the club crest used across the app and admin portal.
