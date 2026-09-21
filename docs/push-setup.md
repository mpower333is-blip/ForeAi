# Push & lightning alerts — how they work & how to switch on the extras

ForeAi (and the Kempton club app) has **three** layers of lightning warning, plus
open-game **invite** push. Layer 1 works with zero setup. Layers 2–3 are switched
on with credentials — no code changes.

| Layer | What it does | App open? | Cost | Setup |
|-------|--------------|-----------|------|-------|
| 1. In-app alarm (free forecast) | Loud alarm + notification while the app is open | Yes | Free | None — live |
| 2. Real strikes (Xweather) | Actual detected strikes with distance | Yes/No | Xweather plan | 2 GitHub secrets (below) |
| 3. Server push | Lightning **and** game invites fire on a **closed** phone | No | Free (Expo) | Expo + FCM/APNs (below) |

Everything server-side runs on **Firebase Cloud Functions** (`functions/`), not the
old Render backend:
- `clubLightningWatch` — scheduled every 15 min; checks each club course and pushes
  a warning to all members when lightning is near / a storm is imminent.
- `onGameInviteCreated` — pushes an open-game invite to the invited member.

Both send through **Expo Push** (→ APNs/FCM) to the tokens the app stores at
`clubs/{clubKey}/pushTokens/{memberId}`.

---

## Layer 2 — Real strikes with Xweather

Xweather gives real detected strikes with precise distance. Auth is a **Client ID +
Client Secret** pair (not the "API Key", which is for Maps/MapsGL).

**Where they go:** GitHub → repo **Settings → Secrets and variables → Actions**:

```
XWEATHER_CLIENT_ID       = <your Xweather client id>
XWEATHER_CLIENT_SECRET   = <your Xweather client secret>
```

The functions deploy workflow writes them into the function's runtime env
(`functions/.env`, gitignored) at deploy time. `clubLightningWatch` then uses
`/lightning/closest` for real strikes (warns for a strike within 12 km) and still
falls back to the free Open-Meteo forecast when the keys are absent or a request
fails. Re-run the **Deploy Cloud Functions** workflow after adding the secrets.

---

## Layer 3 — Server push (alerts when the app is closed)

iOS/Android only deliver to a **closed** app through APNs/FCM, so both invite push
and background lightning need push credentials on the app build.

### A. Expo project id (both platforms)
1. Create a free project at **expo.dev** (name ForeAi, slug `foreai`).
2. Copy its **Project ID** (a UUID).
3. It's hardcoded in `mobile/app.config.js` → `extra.eas.projectId` (or set
   `EAS_PROJECT_ID` for the build). Without it, `getExpoPushTokenAsync` no-ops and
   the app keeps only the foreground alarm.

### B. Android (FCM)
1. Firebase console (**foreai-f9cfa**) → add an **Android** app, package
   **`com.foreai.kempton`**.
2. Download **`google-services.json`**; it's committed at `mobile/google-services.json`
   and referenced via `googleServicesFile` in `app.config.js`.
3. Firebase → **Project settings → Service accounts → Generate new private key**, then
   **expo.dev → Credentials → Android → FCM V1 → Upload** that JSON so Expo can deliver.

### C. iOS (APNs)
1. Apple Developer → **Identifiers → `com.foreai.kempton`** → enable **Push
   Notifications**.
2. **Keys → +** → create an **APNs Auth Key**; download the `.p8` (note Key ID + Team ID).
3. **expo.dev → Credentials → iOS → Push Key → Upload** the `.p8`.
4. Set **`EXPO_PUBLIC_ENABLE_IOS_PUSH=1`** on the iOS build. This keeps the
   `aps-environment` entitlement (stripped by default so local-only builds sign
   cleanly — see `mobile/plugins/withoutPushEntitlement.js`). Do this **after** C1
   so the provisioning profile includes push, or iOS signing fails.

Android and iOS are independent — you can run push on Android first and add iOS later.

### How the app registers
Once membership is linked (club app on Firestore), `mobile/src/lib/clubPush.ts`
(`registerInvitePush`, called from `MemberContext`) gets the Expo push token and
stores it at `clubs/{clubKey}/pushTokens/{memberId}`. The functions read those tokens.
Until the Expo project id + credentials are set, registration silently no-ops and the
in-app alarm + in-app invites inbox still work — nothing breaks.

### Deploying the functions
Push to `kempton` (auto-deploys `functions/`), or run the **Deploy Cloud Functions**
GitHub Action. See `docs/push-invites-setup.md` for the one-time Firebase Blaze +
service-account IAM notes.
