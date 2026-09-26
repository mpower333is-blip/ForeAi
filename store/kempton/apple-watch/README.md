# Kempton Park Golf — Apple Watch App Store screenshots

App Store Connect screenshots for the **Apple Watch** app (the watchOS companion
in `apple-watch/`). Apple Watch screenshots are **rectangular, full-bleed** (just
the app screen — no device frame, no logo), unlike the round Wear OS ones.

## What to upload (App Store Connect → the app → Apple Watch screenshots)

Provide the size(s) App Store Connect asks for. Both current sizes are here:

| Device | Size (px) | Files |
|--------|-----------|-------|
| Apple Watch Ultra 3 | **422 × 514** | `apple-422x514-*.png` |
| Apple Watch Ultra / Ultra 2 | **410 × 502** | `apple-410x502-*.png` |
| Apple Watch Series 11 / 10 | **416 × 496** | `apple-416x496-*.png` |

App Store Connect accepts any of these for the Apple Watch screenshot slot — drop
the four screens of whichever size matches (all three are provided). One size is
enough.

### Screens, in order — each mirrors a real watchOS screen
1. `*-01-distance` — GPS distance to the green (front / centre / back) + club + tee-times.
2. `*-02-club` — club selection with carry distances.
3. `*-03-teetimes` — the club's next tee times.
4. `*-04-lightning` — the lightning safety alarm.

(No score screen: the Kempton watch is a standalone rangefinder — same as the Wear
OS build — so there's no live-scoring UI to show.)

## Regenerating

```
node scripts/apple-watch-shots.mjs store/kempton/apple-watch scripts/apple-watch-mock.html
```

Renders all four screens at both Apple sizes from `scripts/apple-watch-mock.html`
(headless Chromium). Navy `#081226` + gold `#F3C33B`, matching the club crest and
the watchOS app UI.

> If Apple ever asks for other sizes, common ones are 45mm 396×484, 44mm 368×448,
> 41mm 352×430. Add them to the `sizes` array in `scripts/apple-watch-shots.mjs`.
