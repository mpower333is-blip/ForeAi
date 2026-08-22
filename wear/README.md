# ForeAi — Wear OS app

A **standalone Wear OS** companion for the ForeAi golf day. It talks straight to
the same backend the phones use (`https://foreai-backend.onrender.com`) and the
same event (join code `3YG6JS`), so scores entered on the watch land on the same
live leaderboard — the phone can stay in the bag.

This is a **separate native Android project** from `../mobile` (which is the
Expo/React Native phone app). It is **not** built by the Expo prebuild or the
GitHub Actions APK workflow — open and build it in Android Studio.

## Requirements
- Android Studio (Ladybug or newer)
- A Wear OS emulator (Device Manager → add a Wear OS device) or a real watch in
  developer/ADB mode

## Open & run
1. Android Studio → **Open** → select this `wear/` folder (not the repo root).
2. Let Gradle sync. Versions here are a known-good, stable set (AGP 8.5.2,
   Kotlin 1.9.24, Compose BOM 2024.06.00); accept any upgrade Studio suggests.
3. Pick a Wear OS emulator/device and **Run** the `app` module.
4. On the watch: pick your name → use **− / +** to set your score for the hole →
   it syncs to the leaderboard. **‹ / ›** move between holes.

> The first request can take ~30s while the free backend cold-starts.

## What works now — Stage 1 (score sync)
- Auto-connects to the ECS Golf Day event (code `3YG6JS`).
- "Who are you?" player picker; the choice is remembered on the watch.
- Per-hole score entry (**team score** for a scramble — writes to the team
  captain's card, matching the phone) that PUTs to `/tournaments/:id/scores`.
- Hole navigation, "thru" and running total.

## Next stages
- **Stage 2 — GPS distances:** front/middle/back of the green on the wrist. Needs
  the course hole coordinates (the Kempton Park GPS capture that's still
  outstanding) made available to the watch (bundled or served by the backend).
- **Stage 3 — shot logging + stats.**

## Configuration
`app/src/main/java/com/foreai/wear/Backend.kt` → `Config`:
- `API_BASE` — backend URL
- `PRESET_EVENT_CODE` — event the watch joins on launch

## Layout
```
wear/
  settings.gradle.kts, build.gradle.kts, gradle.properties
  app/
    build.gradle.kts
    src/main/AndroidManifest.xml
    src/main/java/com/foreai/wear/
      Backend.kt          # API client + models (OkHttp + org.json)
      RoundViewModel.kt   # state + round/score logic
      MainActivity.kt     # Compose for Wear UI
```
