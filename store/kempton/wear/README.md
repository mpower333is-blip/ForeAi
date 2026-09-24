# Kempton Park Golf — Wear OS Play Store assets

Graphics for the **Wear OS** listing of the Kempton Park Golf app on Google Play.
The watch app ships under the **same** Play app as the phone
(`com.foreai.kempton`), so on the "Wear OS" store-listing tab you only need to
add the watch screenshots — the app icon and feature graphic are shared with the
phone listing and reused here for convenience.

## What to upload (Play Console → Store listing → Wear OS)

| Asset | File | Size | Notes |
|-------|------|------|-------|
| Watch screenshots | `wear-01-distance.png` … `wear-06-teetimes.png` | 480 × 480 (1:1) | Min 2 required. Play accepts 1:1, 384–3840 px. |
| App icon | `wear-icon-512.png` | 512 × 512 | Same icon as the phone listing. |
| Feature graphic | `wear-feature-1024x500.png` | 1024 × 500 | Same as the phone listing (optional on Wear tab). |

> **Wear screenshots must show ONLY the app interface.** Put *only* the six
> `wear-0*.png` app screens in the Play "Wear OS screenshots" slots. Do **not** add
> the app icon, the feature graphic, or the club crest as a screenshot — Google
> rejects the listing ("Wear screenshots showing only the app interface") if a
> logo/branding image is in a screenshot slot. The screenshots below have no device
> frame or bezel — just the app screen — which is what Play requires.

### Screenshots, in order — each mirrors a real screen in the app
1. **wear-01-distance** — GPS distance to the pin (front / centre / back).
2. **wear-02-hole** — hole number, par, stroke index, metres.
3. **wear-03-club** — club selection for the shot (carry distances).
4. **wear-04-score** — per-hole score stepper (when a live event is connected).
5. **wear-05-lightning** — the lightning safety alarm (real-strike alert + buzz).
6. **wear-06-teetimes** — the club's next tee times off the sheet.

## The watch app, in short

A **standalone GPS rangefinder** for Kempton Park: the course card (green GPS,
par, length) is bundled, so distances work offline the moment it opens — no phone,
no login, no backend needed. On top of that it polls a small public endpoint
(`watchStatus`) for two on-wrist extras: the club's **lightning safety alarm**
(buzzes + takes over the screen when a strike is detected near the course) and the
**next tee times**. Both fail silent — if the endpoint is unreachable the watch is
still a working rangefinder, so a Play reviewer never sees an error or a crash.

## Regenerating

The screenshots are rendered from an HTML watch mockup with headless Chromium:

```
node scripts/wear-shots.mjs        # writes the six wear-0*.png here
```

The mockup + render script live in `scripts/` (`wear-mock.html`,
`wear-shots.mjs`). Edit the mockup to change copy/branding, then re-run. The navy
`#081226` + gold `#F3C33B` palette matches the club crest used across the app and
admin portal.
