# ForeAi → Firebase migration plan

Decision: move ForeAi's backend from **Express + PostgreSQL (Prisma) on Render**
to **Firebase** (Firestore + Firebase Auth, plus Cloud Functions where server
logic is unavoidable).

## Guiding rule: incremental, non-destructive

We do **not** rip out the working backend. Firebase is added alongside it and we
migrate **one feature at a time**, keeping the apps and the ECS golf day working
throughout, and only retire the Express/Postgres backend once every feature runs
on Firebase and the data is copied over.

Order of migration (each is a shippable step):
1. **Auth** — organiser/club web login → Firebase Auth (email/password + Google).
2. **Events** (tournaments, players, groups, scores, live positions).
3. **Club data** (members, competitions, news, tee sheet, settings).
4. **App reads/writes** — swap `services/api.ts` calls to the Firebase SDK.
5. **Server jobs** — HNA handicap sync, lightning watcher, Expo push → Cloud
   Functions (or a tiny keep-alive service).
6. **Data copy** — one-off script Postgres → Firestore, then retire Render.

## Progress

- ✅ **Phase 1 — Auth.** Organiser web login runs on Firebase Auth
  (`clubhouse/manage/signin.html` + `auth-guard.js`); the backend verifies the
  Firebase ID token (`backend/src/lib/firebase.ts`) and exchanges it for a
  session token via `POST /auth/firebase`.
- ✅ **Phase 2 — Live positions read-model.** The backend mirrors each GPS
  heartbeat to `events/{id}/positions/{playerId}` (`eventMirror.mirrorPosition`);
  `clubhouse/manage/live.html` subscribes with `onSnapshot`, polling fallback.
- ✅ **Phase 3 — Event/score read-model.** `eventMirror.mirrorEvent` now writes
  the **full** event read-model (meta + roster + groups + scores + contests +
  contest results + sponsors) to `events/{id}` on every backend write, so the
  clubhouse board (`board.html`) reads scores/leaderboard in realtime via
  `onSnapshot` with a polling fallback. Inline `data:` images are dropped from
  the mirror to stay under Firestore's 1 MB doc cap; the board overlays the
  cause photo it fetched once from the backend.
  - **Not yet done in Phase 3:** the *source of truth* is still Postgres — the
    app and board still WRITE through the Express backend, which mirrors to
    Firestore. Making clients write directly to Firestore (and enforcing the
    write rules below) is the Phase 4 cutover and needs an app rebuild.

## Retiring Render — cutover plan

Decision: **get fully off Render** and consolidate on Firebase. Blaze plan
approved (needed for Cloud Functions). Render currently runs a large app: 15
route groups and 22 models (app data — users, rounds, shots, AI caddie,
strategy, events; club data — members, competitions, tee sheet, news, bookings)
plus background jobs, deployed as **two** services (ForeAi + Kempton).

Guiding rule stays: build the Firebase side in parallel, keep Render running,
then do **one coordinated cutover**. The unavoidable catch: both mobile apps
read/write through the Express API, so the cutover needs a **Codemagic rebuild**
of each app — it can't happen over the air.

Sequence:
1. ✅ **Server jobs → Cloud Functions** (`functions/`). Deployed: `weather`
   (HTTPS) and `lightningWatch` (scheduled). Push-send is the watcher; push
   register becomes a direct Firestore write from the app. HNA live-fetch is a
   no-op until HNA gives credentials, so no scheduled function is needed yet.
   Also deployed-ready: `provisionOrganiser` (onCall) — creates `adminUsers/{uid}`
   and sets `clubKey` from `CLUB_ADMIN_EMAILS`, replacing `POST /auth/firebase`.
2. ✅ **Firestore data model + security rules** — `docs/firestore-data-model.md`
   and `firestore.rules.next` (promoted at the web cutover).
3. **Web pages → Firestore** (board, live, office, members, tee sheet,
   competitions, news, register). Easy to switch — just re-upload.
4. **Mobile apps → Firestore** (`services/api.ts` → Firebase SDK). Needs a
   rebuild of both the ForeAi and Kempton flavors. Players use Anonymous Auth so
   the "just play" flow is unchanged.
5. **Data copy** — `migration/migrate-to-firestore.mjs` (Postgres → Firestore),
   run once per Render database. *(built, run at cutover)*
6. **Cut over & delete Render** — repoint everything, verify, then shut down
   both Render services and the Postgres databases.

Split-brain guard: steps 3–4 write directly to Firestore, so the source of truth
flips at the **cutover** — web + app + rules + data copy happen together, and
Render stays authoritative (mirroring one-way into Firestore) until that moment.

What YOU do for step 1: enable Blaze, `npm i -g firebase-tools`, `firebase
login`, then `firebase deploy --only functions` (see `functions/README.md`).

### Read-model shape (as implemented)

Differs slightly from the draft data model below: for the realtime read-model
we keep **scores as a nested map on the event doc** (`events/{id}.scores =
{playerId: {hole: strokes}}`) rather than a `scores/{playerId_hole}`
subcollection, so a single `onSnapshot` on the event doc drives the whole
board. Live positions stay in the `positions` subcollection (one small write
per heartbeat). When we do the Phase 4 client-write cutover we may split scores
into a subcollection to reduce write contention.

## Firebase products we'll use

- **Firestore (Native mode)** — the database.
- **Firebase Authentication** — Email/Password + Google. Organisers/clubs and
  (optionally) players/parents get real accounts. App players who don't want an
  account use **Anonymous Auth** so the "no login" experience still works.
- **Cloud Functions (Blaze plan)** — only for logic that can't live in the
  client: HNA sync, scheduled lightning checks, push sends. Blaze is pay-as-you-go
  with a large free allowance.
- **Storage** (optional) — club news photos, later.

## Firestore data model (draft)

Mapping the current Prisma models to collections. IDs are Firestore doc ids.

```
adminUsers/{uid}                      # organiser accounts (Auth uid); {email,name,clubKey,role}
clubs/{clubKey}                       # club settings; {name, teeSheet…}
  members/{memberId}                  # club roster; {name, number, category, status, handicapIndex}
  competitions/{compId}               # {name, date, format, status}
    entries/{entryId}                 # {memberId, scores…}
  notices/{noticeId}                  # club news; {title, body, pinned, photoUrl, createdAt}
  bookings/{bookingId}                # tee-sheet bookings; {date, time, memberId}
events/{eventId}                      # tournaments; {code, name, courseId, format, ownerUid, …}
  players/{playerId}                  # {name, handicap, deviceId, lat, lng, lastSeen}
  groups/{groupId}                    # {playerIds[]}
  scores/{playerId_hole}              # {playerId, hole, strokes}
  contests/{contestId}                # closest-to-pin etc.
  sponsors/{sponsorId}
rosters/{ownerUid}/players/{playerId} # the reusable player directory (school leagues)
eventCodes/{CODE} -> {eventId}        # join-code lookup (Firestore has no unique index)
pushDevices/{deviceId}                # for lightning push
```

Notes:
- `eventCodes/{CODE}` is a lookup doc so "join by code" stays a single read
  (Firestore has no unique constraints — we enforce uniqueness by using the code
  as the doc id).
- Live positions stay as fields on `events/{id}/players/{playerId}` and the web
  live map subscribes with a realtime listener (no more 15s polling).

## Security rules (approach)

- `adminUsers/{uid}`: readable/writable only by that uid.
- `clubs/{clubKey}` + subcollections: writes require an authed organiser whose
  `clubKey == clubKey` (or an admin claim). Reads: members' card-safe fields are
  public-ish; full roster admin-only.
- `events/{eventId}`: create by any authed user (sets `ownerUid`); admin writes
  (edit/delete, sponsors, contests) require `request.auth.uid == ownerUid`.
  Player self-registration + score entry allowed with the join code.
- Enforced server-side by Firestore rules (not the client), replacing today's
  admin-PIN checks.

## Auth model

- **Organisers / clubs**: Firebase Auth email/password (+ Google). Replaces the
  custom `AdminUser` + HMAC token and the per-event PIN. Free password reset and
  email verification come built-in.
- **App players**: Firebase **Anonymous Auth** keeps today's "just play" flow; if
  a player later signs in with email/Google, their anonymous data links to the
  account. Needed for HNA-affiliated school players who must be identifiable.

## What YOU need to set up (I can't do these)

1. Create a Firebase project at https://console.firebase.google.com.
2. **Build → Firestore Database → Create** (Native mode, pick a region, e.g.
   europe-west1). Start in **test mode**; we'll add rules.
3. **Build → Authentication → Get started →** enable **Email/Password** (and
   **Google** if you want it).
4. **Project settings → General → Your apps → Web (</>)** → register a web app →
   copy the **firebaseConfig** object (apiKey, authDomain, projectId, appId, …).
   This is safe to share and to put in client code — send it to me.
5. For server jobs / data migration: **Project settings → Service accounts →
   Generate new private key** → a JSON file. This is a **SECRET** — do NOT commit
   it or paste it in chat; you'll set it as an environment variable on the server.
6. Upgrade to the **Blaze** plan only when we get to Cloud Functions (step 5).

## What I'll do once you send the web config

- Add the Firebase SDK to the app + website behind a config, so nothing breaks
  until a feature is switched over.
- Start with **Auth** (organiser login → Firebase Auth), then work down the list.

## Cost

Firestore + Auth have a generous free tier (Spark). Cloud Functions need Blaze
(pay-as-you-go) but the free allowance covers a club/school-league workload.
Watch reads: a realtime live map with many viewers is the main thing to keep an
eye on.
