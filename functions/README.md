# ForeAi Cloud Functions

The server-only jobs that can't run in the app or a browser, moved off Render.

## What's here

- **`weather`** (HTTPS) — replaces `GET /weather?lat=&lng=[&debug=1]`. The app
  and the clubhouse board call this; the lightning-provider secret stays
  server-side. CORS is enabled.
- **`lightningWatch`** (scheduled, every 3 min) — replaces the background
  lightning watcher. Reads registered phones from the `pushDevices` Firestore
  collection, groups them into ~1 km areas, and pushes a "warning" alert to each
  area via Expo. Per-area cooldown is stored in `lightningCooldowns`.

Still to migrate here: HNA handicap sync, and the push-send/register endpoints.

## One-time setup

1. Enable the **Blaze** plan on the Firebase project (Cloud Functions require it).
2. Install the CLI and sign in:
   ```
   npm i -g firebase-tools
   firebase login
   ```
3. Optional provider keys for real lightning strikes: copy `.env.example` to
   `functions/.env` and fill in what you have (all optional).

## Deploy

From the repo root:
```
firebase deploy --only functions
```
The deploy prints each function's URL. The `weather` URL looks like
`https://europe-west1-foreai-f9cfa.cloudfunctions.net/weather`.

## After deploy

- Point the clubhouse board / app weather calls at the `weather` function URL
  (this happens as part of the app rebuild + web re-upload during cutover).
- The scheduler runs `lightningWatch` automatically; watch it with
  `firebase functions:log`.
