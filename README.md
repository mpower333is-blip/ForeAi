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
| Round     | Live shot tracking with real-time club calls and strokes gained   |
| Caddie    | Data-driven club recommender that learns your real distances      |
| Coach     | Camera + motion swing detector with tempo & posture coaching      |
| Strategy  | Aggressive/safe hole plan from hazard, pin and your miss pattern   |
| Stats     | Strokes-gained dashboard by category with round highlights        |
| Profile   | Tune your bag's carry distances (drives every recommendation)     |

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

## Backend

Express API with a Prisma/PostgreSQL data model (users, rounds, shots, clubs).

### Run it

```bash
cd backend
npm install
cp .env.example .env      # fill in your DATABASE_URL
npx prisma migrate deploy # or: npx prisma generate
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

## Security note

`backend/.env` is git-ignored — never commit real credentials. Use
`.env.example` as a template.
