# Lightning alerts — how they work & how to switch on the extras

ForeAi has **three** layers of lightning warning. Layer 1 works today with zero
setup. Layers 2 and 3 are optional upgrades you switch on with credentials — no
code changes.

| Layer | What it does | App open needed? | Cost | Setup |
|-------|--------------|------------------|------|-------|
| 1. In-app alarm (free forecast) | Loud alarm + notification while a weather screen is open | Yes | Free | None — already live |
| 2. Real strikes (Xweather) | Actual detected strikes with distance + direction | Yes | Xweather plan | 2 env vars (below) |
| 3. Server push | Alert fires even with the app **closed** | No | Free (Expo) | Expo + FCM/APNs (below) |

Layers stack: turn on Xweather **and** server push and you get real-strike
alerts pushed to a closed phone.

---

## Layer 2 — Real strikes with Xweather (the "where do the keys go" answer)

Xweather (Aeris) gives real detected strikes. The keys are **secret** and live
**only on the backend** — never in the phone app or a web page.

**Where they go:** Render → your `foreai-backend` service → **Environment** →
add two variables:

```
XWEATHER_ID       = <your Xweather client_id>
XWEATHER_SECRET   = <your Xweather client_secret>
```

Save → Render redeploys. That's it. The backend (`backend/src/lib/weatherCore.ts`,
`fetchStrikes()`) auto-detects the keys: when they're present it reports real
strikes; when they're absent it falls back to the free Open-Meteo forecast. No
app rebuild is needed — the app and the clubhouse board both read the backend.

> You do **not** paste an Xweather code snippet anywhere. The integration is
> already written; it only needs those two env vars. If you were given "demo"
> credentials, put the demo `client_id` / `client_secret` in those same two
> variables — the code path is identical.

To test after redeploy:
`https://foreai-backend.onrender.com/weather?lat=-26.106&lng=28.212`
— if `lightning.source` is `"strikes"` the key is working.

---

## Layer 3 — Server push (alerts when the app is closed)

The backend watcher (`backend/src/lib/lightningWatcher.ts`) checks each
registered phone's location every 3 minutes and pushes an alert via **Expo Push**
when a storm is a danger. This requires push credentials, because iOS/Android
only deliver to a closed app through APNs/FCM.

### One-time setup

**A. Expo project id (both platforms)**
1. Create a free account at expo.dev and a project (slug `foreai`).
2. Copy its **Project ID**.
3. Set it as a build env var for the Codemagic builds: `EAS_PROJECT_ID=<id>`.

**B. Android (FCM)**
1. Create a Firebase project, add an Android app with package `com.foreai.mobile`.
2. Download `google-services.json`, commit it to `mobile/` (or provide it at
   build time), and set `GOOGLE_SERVICES_JSON=./google-services.json`.
3. In Firebase → Project settings → Service accounts, generate a private key and
   upload it to your Expo project's credentials (FCM V1) so Expo can deliver.

**C. iOS (APNs) — only if you want push on iPhone**
1. Set `EXPO_PUBLIC_ENABLE_IOS_PUSH=1` for the iOS build. This keeps the
   `aps-environment` entitlement (it's stripped by default so local-only builds
   sign cleanly — see `mobile/plugins/withoutPushEntitlement.js`).
2. In the Apple Developer portal, add the **Push Notifications** capability to
   the `com.foreai.mobile` App ID and **regenerate** the App Store provisioning
   profile.
3. Create an APNs auth key (.p8) and upload it to your Expo project's
   credentials.

> Android and iOS are independent. You can run server push on Android now and
> leave iOS on the in-app alarm until you're ready for steps C.

### Backend

No setup — it's on by default. To disable, set `LIGHTNING_WATCH=0` on Render.

> **Render note:** the watcher runs while the service is awake. On the free tier
> the service sleeps after ~15 min idle, pausing the watcher. For reliable
> event-day coverage keep it warm (a paid instance, or a cron ping every few
> minutes to `/health`).

### How the app registers

When lightning alerts are on and a weather panel is shown, the app sends its
Expo push token + the watched location to `POST /push/register`. Turning
lightning alerts off in Settings calls `POST /push/unregister`. Until the Expo
project id + credentials are set up, registration silently no-ops and the
foreground alarm still works — nothing breaks.
