# Kempton Park — its own isolated instance

Kempton runs on **its own database and backend**, separate from the shared ForeAi
data. Same codebase (nothing is forked or rewritten) — just a dedicated Postgres
and a dedicated API service, so the club's members, bookings and events live only
in Kempton's database.

```
Kempton app (com.foreai.kempton)  ─┐
Members / Tee Sheet admin pages   ─┼─►  foreai-kempton-backend  ──►  kempton-db
                                            (same code)               (isolated)

Main ForeAi app + ECS golf-day    ──►  foreai-backend           ──►  foreai-db
```

## What's wired

- **`render.yaml`** provisions two extra resources: **`kempton-db`** (Postgres)
  and **`foreai-kempton-backend`** (the API, pointed at `kempton-db`). Applying
  the blueprint creates them alongside the shared ones.
- **`codemagic.yaml`** — the `foreai-kempton-android` (APK) and
  `foreai-kempton-ios` (TestFlight) builds set
  `EXPO_PUBLIC_API_URL=https://foreai-kempton-backend.onrender.com`, so both
  apps talk to Kempton's backend, and bundle all 18 offline satellite tiles.
- **Admin pages** (`clubhouse/manage/members.html`, `teesheet.html`) default their
  connection to the Kempton backend (still overridable in the connect box).
- On first boot the backend **seeds Kempton's `ClubSettings`** (course
  `kempton-park` + tee hours) into `kempton-db`.

## Deploy it

1. **Render → Blueprint → Apply** this repo. It creates `kempton-db` and
   `foreai-kempton-backend` (plus the shared ones, if not already there). Wait for
   `foreai-kempton-backend` to go live at
   `https://foreai-kempton-backend.onrender.com` — first request wakes a free
   service (~30s).
2. **Verify:** open `https://foreai-kempton-backend.onrender.com/health` → `{"status":"ok"}`.
3. **App:** the next `foreai-kempton-android` build already points here — nothing
   else to do. (Rebuild the APK so the new URL is baked in.)
4. **Admin:** open `foreai.co.za/manage/members.html`, it connects to the Kempton
   backend by default — set the **admin PIN** (🔑) before sharing.

## Mobile apps (Android + iOS)

Both apps are the same codebase built with `EXPO_PUBLIC_CLUB=kempton`, so they get
the club name ("Kempton Park Golf"), the Kempton icon/splash, the navy+gold theme,
and are pinned to the Kempton course — bundle id **`com.foreai.kempton`** on both
platforms.

### Android — `foreai-kempton-android`
Produces a signed **`ForeAi-Kempton-<code>.apk`** (Codemagic email artifact). Not on
Play — members **sideload** it or install via a shared link. Nothing to set up on
Google's side beyond the shared upload keystore the workflow already uses.

### iOS — `foreai-kempton-ios` → TestFlight
Apple doesn't allow sideloading, so the iOS app ships via **TestFlight** (invite
members with a public TestFlight link). It reuses the **same Apple team**, the same
Codemagic **`ForeAi ASC`** App Store Connect integration, and the **same persistent
distribution certificate** (`IOS_DIST_KEY` in the `ios_signing` group) as the main
ForeAi app — the build just creates a new provisioning profile for
`com.foreai.kempton`, so there's no certificate churn (no ITMS-90035).

**One-time Apple setup** (do once, before the first iOS build):

1. **Register the App ID** — Apple Developer → Certificates, IDs & Profiles →
   Identifiers → **+** → App IDs → App → explicit Bundle ID **`com.foreai.kempton`**.
2. **Create the App Store Connect app** — App Store Connect → My Apps → **+** →
   New App → iOS → pick `com.foreai.kempton` → name **"Kempton Park Golf"** → any SKU
   (e.g. `kempton-park-golf`).
3. Confirm the Codemagic **`ios_signing`** group has `IOS_DIST_KEY` and the
   **`ForeAi ASC`** integration is connected (both already exist from the main app).

Then a push to `kempton` (or a manual `foreai-kempton-ios` build) produces a signed
`.ipa` and uploads it to TestFlight under the new app record. The provisioning
profile is created automatically — no manual profile management.

> Separate Apple account instead? If Kempton ever moves to the **club's own** Apple
> Developer account, it needs its own App Store Connect API-key integration and its
> own distribution signing key; the `foreai-kempton-ios` workflow would then point at
> a Kempton-specific integration + signing group instead of the shared ones.

## Branch & deployments

Kempton work lives on the **`kempton`** branch (a superset of `main` — it carries all
shared ForeAi fixes plus the club work). Periodically merge `origin/main` into
`kempton` to pick up shared fixes (course data, hole view, engine).

Both build/deploy pipelines are wired to that branch:

- **Codemagic** — `foreai-kempton-android` and `foreai-kempton-ios` each have a
  `triggering` block that auto-builds on **pushes to `kempton`**. (Requires the app
  to use codemagic.yaml-based configuration with the GitHub webhook connected.)
- **Render** — `foreai-kempton-backend` declares `branch: kempton` in `render.yaml`.
  Because Render reads the blueprint from whichever branch it tracks, set it in the
  dashboard too: either **service → Settings → Build & Deploy → Branch → `kempton`**
  (simplest), or point the **Blueprint** at `kempton` and Sync.

## Notes

- **URL name:** Render derives the URL from the service name; if it isn't exactly
  `foreai-kempton-backend`, update `EXPO_PUBLIC_API_URL` in `codemagic.yaml` and
  `KEMPTON_API` in the two admin pages to match.
- **Free tier:** free Postgres/services sleep and have storage/retention limits —
  fine for pilots. For a live, sold club instance, upgrade `kempton-db` and
  `foreai-kempton-backend` off `free` in `render.yaml`.
- **Want it in Google instead of Render?** The same backend deploys to **Cloud
  Run** with **Cloud SQL (Postgres)** as `kempton-db` — same code, just a
  different `DATABASE_URL`. Ask and I'll add that path.
- **Every other club** added later gets the same treatment: one more `*-db` +
  `*-backend` pair and a build var. `clubKey` already keeps data separated even
  within a shared DB, so isolation is a deploy choice, not a code change.
