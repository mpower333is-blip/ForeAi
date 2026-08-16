# Deploying the ForeAi backend

You only need this for the **multi-device golf-day features** — shared events,
the live clubhouse board, and the online registration/office pages. The mobile
app's AI caddie, swing coach and solo round tracking all work with no backend.

## Option A — Render (free, ~5 minutes)

1. Push this repo to GitHub (already done for the `foreai` repo).
2. Go to https://render.com → sign up → **New → Blueprint**.
3. Connect this repository. Render reads [`backend/render.yaml`](./render.yaml)
   and shows a database (`foreai-db`) + a web service (`foreai-backend`).
4. Click **Apply**. Render provisions Postgres, builds the API, pushes the
   schema, and deploys.
5. When it's live, open the `foreai-backend` service — its URL (e.g.
   `https://foreai-backend.onrender.com`) is your **backend URL**.

Verify: visiting `<backend-url>/health` returns `{"status":"ok"}`.

> The free web service sleeps after ~15 min idle and takes ~30s to wake on the
> first request. Fine for an event; bump the plan for always-on.

## Option B — any Node host (Railway, Fly.io, a VPS…)

Provide a PostgreSQL `DATABASE_URL` and run:

```bash
npm install
npm run build     # prisma generate + tsc → dist/
npm run db:push   # create/update tables from schema.prisma
npm start         # node dist/server.js  (listens on $PORT, default 5000)
```

## After you have a backend URL

Tell me the URL and I'll wire it in as the default in one pass:

- **Mobile app** — set `EXPO_PUBLIC_API_URL` as a repo secret (used by
  `.github/workflows/build.yml`) so the APK ships pointing at it, and update the
  fallback in `mobile/src/services/api.ts`.
- **Clubhouse pages** — set it once in `clubhouse/config.js`
  (`window.FOREAI_DEFAULTS.api`); the hub, register, office and board pages all
  read that as their default, so nobody types a URL.
