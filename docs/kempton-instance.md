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
- **`codemagic.yaml`** — the `foreai-kempton-android` build sets
  `EXPO_PUBLIC_API_URL=https://foreai-kempton-backend.onrender.com`, so the
  Kempton APK talks to Kempton's backend.
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
