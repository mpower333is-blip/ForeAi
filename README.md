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

Built with Expo + React Navigation. Six tabs:

| Tab       | What it does                                                       |
|-----------|-------------------------------------------------------------------|
| Home      | Dashboard — round SG, current hole, quick links                   |
| Round     | Live shot tracking with real-time club calls and strokes gained   |
| Caddie    | Club recommender for any distance, wind, elevation, lie & temp    |
| Strategy  | Aggressive/safe hole plan from hazard, pin and your miss pattern   |
| Stats     | Strokes-gained dashboard by category with round highlights        |
| Profile   | Tune your bag's carry distances (drives every recommendation)     |

The golf logic lives in [`mobile/src/lib/golfEngine.ts`](mobile/src/lib/golfEngine.ts):
playing-distance adjustments, nearest-club recommendation, PGA-baseline expected
strokes with interpolation, per-shot strokes gained, and course strategy.

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
