# ForeAi — Store Listing Assets

Generated brand assets for the App Store (iOS) and Google Play (Android).
All icons/graphics are **opaque RGB (no transparency)** so Apple won't reject them.

## Apple App Store (`ios/`)

| File | Spec | Where it goes |
|------|------|---------------|
| `appstore-icon-1024.png` | 1024×1024, no alpha | App Store Connect → App Information → App Icon (also the source Xcode/EAS uses) |
| `screenshots-6.7/01–05-*.png` | 1290×2796 (6.7"/6.9" iPhone) | App Store Connect → Screenshots. A single 6.7" set is accepted for all modern iPhones. |

Captions: Home → "Your AI caddie, in your pocket" · Round → "Club calls & GPS on
every shot" · Caddie → "Clubs that learn your real distances" · Coach → "AI swing
coach" · Events → "Run live tournaments & golf days".

## Google Play (`android/`)

| File | Spec | Where it goes |
|------|------|---------------|
| `play-icon-512.png` | 512×512 | Play Console → Store listing → App icon |
| `feature-graphic-1024x500.png` | 1024×500, no alpha | Play Console → Store listing → Feature graphic |
| `screenshots/01–05-*.png` | 1080×1920 (9:16) | Play Console → Phone screenshots (2–8 required) |

## Sources (`screenshots-src/`)

Raw, un-framed captures of the real app (Home, Round, Caddie, Coach, Events with
the ECS Golf Day demo loaded). Kept so the framed marketing screenshots can be
regenerated or re-captioned later.

## Notes / action items

- **iPad:** `app.config.js` currently sets `ios.supportsTablet: true`. If you keep
  that, Apple **requires** a 13" iPad screenshot set (2064×2752). For a phone-first
  launch, either provide iPad screenshots or set `supportsTablet: false`.
- **Bundle identifiers** are `com.foreai.mobile` (iOS & Android) — make sure these
  match the App IDs you register in App Store Connect and Play Console.
- These marketing screenshots use the app's own dark theme; regenerate after any
  major UI change so the store shots stay current.
