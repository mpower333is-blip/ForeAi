# ForeAi — Wear OS app

A **standalone Wear OS** companion for the ForeAi golf day. It talks straight to
the same backend the phones use (`https://foreai-backend.onrender.com`) and the
same event (join code `3YG6JS`), so scores entered on the watch land on the same
live leaderboard — the phone can stay in the bag.

This is a **separate native Android project** from `../mobile` (which is the
Expo/React Native phone app). It is **not** built by the Expo prebuild or the
GitHub Actions APK workflow — open and build it in Android Studio.

> Wear OS only (Pixel Watch, Galaxy Watch 4+, TicWatch, …). It does **not** run
> on an Apple Watch.

## Build it — no computer needed (Codemagic)
You build the phone apps in Codemagic; the watch app builds there too.
1. Codemagic → **Start new build** → workflow **`foreai-watch-android`**.
2. It emails you (and offers to download) a **Play-signed `app-release.aab`** —
   ready to upload to Google Play. It's signed with the same upload keystore as
   the phone app (the `google_play` env group), so no extra signing setup.

## Publish to Play
The watch app is a **separate package** (`com.foreai.wear`, not the phone's
`com.foreai.mobile`) built by this standalone Gradle project, so on Google Play
it's its **own app listing** with the **Wear OS** form factor — not bundled into
the phone app.

1. **Play Console → Create app** → name "ForeAi Watch", app, free.
2. In **App content / Store settings**, mark it a **Wear OS** app and complete
   the usual gates (Data safety, content rating, privacy policy — reuse the
   phone app's answers and `https://foreai.co.za/privacy.html`).
3. **Testing → Internal testing → Create release** → upload the `app-release.aab`
   from the build. Opt into **Play App Signing** when prompted (the upload key
   is the shared keystore; Play manages the app signing key).
4. Add yourself as an internal tester → open the opt-in link on your phone.
5. **Install on the watch:** from the phone app's **Set up your watch** screen
   (button + QR), or the watch's Play Store → your apps — Google installs it
   straight to the paired watch.

Wear listing needs **round-watch screenshots** (take them on a Wear OS emulator
or your watch) and a short description. Rebuilds just re-upload to the track.
> Ask and we can wire Codemagic to auto-publish the AAB to the internal track
> (needs a Google Play service-account key — same idea as the phone app).

> **Target API note:** the app targets **API 35** (Wear OS 5), Play's current
> minimum for new apps. If the Console flags that it needs API 36 at upload,
> say so and we'll do the (larger) bump to compileSdk 36 / AGP 8.7 / Gradle 8.9.

## Or build & run from Android Studio (if you have a computer)
1. Android Studio → **Open** → select this `wear/` folder (not the repo root).
2. Let Gradle sync (AGP 8.6.1, Kotlin 1.9.24, Compose BOM 2024.06.00).
3. Pick a Wear OS emulator/device and **Run** the `app` module (a real watch
   needs Developer options → ADB/Wireless debugging on, paired over `adb`).

## On the watch
Pick your name → the app joins the golf day. **− / +** set your score (syncs to
the leaderboard), **‹ / ›** change holes, tap the club chip to pick a club, and
**＋ Log shot** logs a shot. Grant location for green distances.

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
