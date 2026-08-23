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

## What works now

### Stage 1 — score sync
- Auto-connects to the ECS Golf Day event (code `3YG6JS`).
- "Who are you?" player picker; the choice is remembered on the watch.
- Per-hole score entry (**team score** for a scramble — writes to the team
  captain's card, matching the phone) that PUTs to `/tournaments/:id/scores`.
- Hole navigation, "thru" and running total. Score defaults to the hole's par.

### Stage 2 — club selection + GPS distances
- **Club picker:** tap the club chip → choose your club (Driver … LW, with
  metre carries). The choice is remembered on the watch, so you glance and go.
- **GPS distance to the green** using the watch's own GPS (via the platform
  `LocationManager` — no Google Play Services needed). Shows the middle number
  big, with **F**ront and **B**ack when the course has a full green survey, plus
  the fix accuracy (±m). All distances are in **metres**.
- **Course card bundled on the watch** (`Course.kt`): par + length per hole
  (Kempton Park is the real card; others are a par-72 placeholder). Until a
  course's greens are surveyed, the watch shows the hole length to the centre
  and notes "GPS after survey"; drop the captured green coordinates into
  `Course.kt` (`green` / `greenFront` / `greenBack`) to switch to live GPS.

> Distances need the **on-site GPS survey** (capture each green in the phone
> app → export → paste the coords into `Course.kt`). The mechanism is built;
> it just needs the coordinates.

### Stage 3 — the watch as the swing trigger
- **＋ Log shot** button: tap when you hit — posts a *mark* (your club + the
  watch's GPS + hole) to the backend and buzzes to confirm. Reliable, one tap.
- **Auto (beta)** toggle: the wrist accelerometer detects swings and posts a
  mark automatically. Practice swings can't be told apart on the wrist, so the
  **phone de-dupes by movement** — repeated marks at one spot collapse into a
  single shot once you've walked to your ball.
- The **phone** (`useWatchShots` + `WatchShotSync`, mounted app-wide) polls
  `GET /tournaments/:id/players/:pid/marks` while you're in a live event and
  logs each mark as a shot in the round — so the caddie keeps learning with the
  phone in the cart. Marks are stored via `POST …/marks`
  (`TournamentShotMark`).

> Deploy the backend (a `prisma db push` adds the `TournamentShotMark` table)
> and rebuild the phone app for the phone side; rebuild the watch for the
> trigger.

## Later
- Reconstruct proper front/middle/back strokes-gained on the phone using the
  hole's green GPS once surveyed (marks already carry the hole).
- Show the phone's logged-shot count back on the watch.

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
      Course.kt           # bundled course cards + club bag (metres)
      Geo.kt              # LatLng + haversine distance (metres)
      LocationProvider.kt # watch GPS via android.location.LocationManager
      RoundViewModel.kt   # state + round/score/club/distance logic
      MainActivity.kt     # Compose for Wear UI (round, club picker)
```
