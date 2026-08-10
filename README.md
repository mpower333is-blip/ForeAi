# ForeAi ⛳

An AI golf performance app for **iOS and Android**. ForeAi acts as a smart
caddie — it recommends clubs for any distance and conditions, plans strategy for
each hole, and tracks your round with real **strokes-gained** analytics.

The mobile app runs **fully on-device**: the caddie, strategy engine and
strokes-gained math all work offline. A backend is included for persistence and
cross-device sync when you want it.

## Structure

```
mobile/    Expo React Native app (iOS / Android / web)
backend/   Express + Prisma + PostgreSQL API
```

## Mobile app

Built with Expo + React Navigation. Seven tabs:

| Tab       | What it does                                                       |
|-----------|-------------------------------------------------------------------|
| Home      | Dashboard — round SG, current hole, quick links                   |
| Round     | Course selection, live shot tracking, club calls, and scorecard   |
| Caddie    | Data-driven club recommender that learns your real distances      |
| Coach     | Camera + motion swing detector with tempo & posture coaching      |
| Events    | Tournaments / golf days — players, tee times, live leaderboard     |
| Stats     | Strokes-gained dashboard by category with round highlights        |
| Profile   | Tune your bag's carry distances (drives every recommendation)     |

(Strategy and Course Select are pushed screens reached from Home / Round.)

### Courses & scorecard

Pick from a catalog of full 18-hole layouts (`mobile/src/data/courses.ts`) on the
Round tab. Each hole carries par, yardage and stroke index. The Round tab has a
tap-to-edit scorecard with per-hole scoring, front/back-nine totals and live
to-par.

### Events — tournaments & golf days

The Events tab is a self-contained golf-day manager:

- **Register players** with handicaps.
- **Build the tee sheet** — create groups, assign players, set the first tee time
  and interval; each group's tee time is computed automatically.
- **Track live** — as scores are entered, each group shows *which hole they're on*
  and a live leaderboard ranks everyone (stroke play or Stableford, handicap-aware).

The scoring/standings logic is pure and tested (`mobile/src/lib/tournament.ts`).

**Multi-device (live sync).** When you create an event as **Shared**, it's hosted
on the backend and gets a short **join code**. Other players open the Events tab,
tap **Join by code**, enter the code, and **register themselves** from their own
phones. Every device polls the server, so tee-sheet changes and scores show up
live for everyone — the leaderboard and each group's current hole update as
scores come in. Any device in a group can post scores (the `[player, hole]`
unique key keeps it idempotent). Choosing **Local only** keeps everything on one
device for when there's no signal.

### AI Caddie (Arccos-style)

The caddie starts from sensible defaults but **learns your real game**. Every
shot you log feeds [`learnDistances`](mobile/src/lib/golfEngine.ts), which
computes each club's average carry and dispersion. Recommendations then use
*your* numbers, show whether they came from your data or the default bag, and
give a dispersion-based finishing window ("expect to finish within ±N yds").

The core golf logic in [`mobile/src/lib/golfEngine.ts`](mobile/src/lib/golfEngine.ts):
playing-distance adjustments (wind/elevation/lie/temperature), nearest-club
recommendation, PGA-baseline expected strokes with interpolation, per-shot
strokes gained, learned smart distances, and course strategy.

### Swing Coach (camera + motion)

The Coach tab uses the **camera** as a framing + posture guide and the phone's
**motion sensors** to detect your swing — the same signal Arccos-style sensors
read. [`swingDetector.ts`](mobile/src/lib/swingDetector.ts) finds the takeaway,
the top, and impact from the accelerometer trace and measures tempo, setup
stability and finish balance. [`swingCoach.ts`](mobile/src/lib/swingCoach.ts)
turns those numbers into a graded report with prioritized tips and drills.

Both engines are pure and unit-testable. Detection is intentionally isolated
behind a `Sample[] → SwingMetrics` interface so on-device camera pose ML
(MoveNet/BlazePose) can be added later without touching the coaching logic.

### Run it

```bash
cd mobile
npm install
npm start          # then press i (iOS), a (Android), or w (web)
```

To point the app at a running backend, set `EXPO_PUBLIC_API_URL`:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.20:5000 npm start
```

(Use your machine's LAN IP so a physical phone can reach it.)

### Testing on a phone & building an APK

There are three levels, easiest first:

1. **Expo Go (fastest, no build).** Install **Expo Go** from the App Store /
   Play Store, run `npm start`, and scan the QR code. The camera and motion
   sensors on the Coach tab need a real device — they don't work in a simulator
   or web. Expo Go is the quickest way to test everything day-to-day.

2. **Install a real APK / dev build (EAS Build — cloud, no Mac needed).**
   ```bash
   npm install -g eas-cli
   eas login
   eas build:configure
   eas build -p android --profile preview   # produces an installable .apk
   eas build -p ios     --profile preview   # iOS build (needs an Apple account)
   ```
   The Android `preview` profile outputs a downloadable **APK** you can sideload
   on any Android phone. Add this to `eas.json` to force APK output:
   ```json
   { "build": { "preview": { "android": { "buildType": "apk" }, "distribution": "internal" } } }
   ```
   Because the app uses native modules (camera/sensors), use a **dev/preview
   build** rather than Expo Go when you want the production-like APK.

3. **Store submission.** `eas build -p android --profile production` (AAB for the
   Play Store) and `eas submit`. iOS uses TestFlight via `eas submit -p ios`.

## Backend

Express API with a Prisma/PostgreSQL data model (users, rounds, shots, clubs).

### Run it

```bash
cd backend
npm install
cp .env.example .env      # fill in your DATABASE_URL
npx prisma db push        # creates all tables, incl. tournaments (dev)
                          # for prod, use: npx prisma migrate deploy
npm run dev               # http://localhost:5000
```

### Endpoints

| Method | Path                  | Purpose                          |
|--------|-----------------------|----------------------------------|
| GET    | `/health`             | Health check                     |
| POST   | `/users`              | Create / upsert a user           |
| GET    | `/users/:id`          | User with clubs and rounds       |
| POST   | `/rounds`             | Start a round                    |
| GET    | `/rounds/:id`         | Round with shots                 |
| POST   | `/shots/add`          | Log a shot (computes SG)         |
| POST   | `/caddie/recommend`   | Club recommendation              |
| POST   | `/strategy/plan`      | Hole strategy                    |
| GET/POST| `/clubs/:userId`     | Read / add clubs                 |
| POST   | `/tournaments`        | Create a shared event (join code)|
| GET    | `/tournaments/code/:code` | Resolve an event by join code |
| GET    | `/tournaments/:id`    | Full event state (live polling)  |
| POST   | `/tournaments/:id/players` | Register / self-register    |
| PUT    | `/tournaments/:id/scores`  | Submit a score (upsert)     |

## Security note

`backend/.env` is git-ignored — never commit real credentials. Use
`.env.example` as a template.
