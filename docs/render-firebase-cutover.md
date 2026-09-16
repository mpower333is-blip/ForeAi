# Render → Firebase: the cutover plan (engineering)

The concrete plan to retire Render, refined after reading the app. Companion to
`docs/firebase-migration.md` (phases) and `docs/firestore-data-model.md` (model).

## The key insight: the app is offline-first

`mobile/src/services/api.ts` says it plainly: the golfer's own play (rounds,
shots, AI caddie, strategy) runs on the **on-device engine** (`lib/golfEngine`);
the backend client is "only used for persistence + sync when reachable" and
**every call fails soft**. So the golfer's solo data does NOT need migrating to
keep the app working — it already works with no backend.

Render is only load-bearing for the **shared, multi-device** features:

| Service (mobile) | What it powers | Backend routes |
|---|---|---|
| `tournamentApi.ts` | Events: create/join by code, players, groups, live scores, contests, sponsors, GPS heartbeat | `/tournaments/**` |
| `membershipApi.ts` | Club members + tee sheet (Kempton) | `/club`, `/members`, `/bookings` |
| `competitionsApi.ts` | Club competitions + entries | `/competitions/**` |
| `newsApi.ts` | Club news | `/news/**` |
| `weather.ts` | Weather + lightning | `/weather` → **already a Cloud Function ✅** |
| `golfCourseApi.ts`, `golfApiIo.ts` | Third-party course data | external APIs, **not Render** |

So the cutover = move **events** and **club data** to Firestore. That's it.

## Firestore representation (resolved)

Use the **native subcollection model** from `firestore.rules.next` as the single
source of truth, and have every reader (app, board, office, live) **assemble the
event client-side** by subscribing to the event doc + its subcollections. Retire
the Postgres→Firestore mirror once clients write Firestore directly — no
server-side aggregate doc, no trigger to keep one in sync.

- `events/{id}` — meta only (name, code, courseId, format, fees, ownerUid, cause…)
- `events/{id}/players|groups|scores|contests|contests/{c}/results|sponsors|positions`

The current `tournamentApi` returns the **whole serialized event** after each
mutation. In Firestore each method instead writes the one doc it changes and the
caller relies on its `onSnapshot` subscription for the fresh state (live, not
poll). A small `assembleEvent(snapshots)` builds the `TEvent` the app already uses.

## Work items

1. **App: add Firebase** — `firebase` JS SDK, `services/firebase.ts` (Firestore +
   **Anonymous Auth** so "just play" needs no account), `config/firebaseConfig.ts`.
2. **App: Firestore adapters** behind `EXPO_PUBLIC_USE_FIRESTORE=1`:
   - `tournamentApi` → Firestore (create/join/score/heartbeat + `subscribe(id)`).
   - `membershipApi`, `competitionsApi`, `newsApi` → Firestore (Kempton).
3. **Web → Firestore** — office, board, live, register (events) and members,
   tee sheet, competitions, news (club). They already sign in with Firebase;
   swap their fetches for the Firestore SDK.
4. **Deploy rules** — promote `firestore.rules.next` → `firestore.rules`.
5. **Migrate data** — `migration/migrate-to-firestore.mjs`, once per Render DB.
6. **Flip + retire** — build both apps with the flag on, upload the web, verify a
   full event end-to-end, then switch off both Render services + Postgres.

## The one hard constraint: coordinated flip

Events are shared state, so the app and the web must read/write the **same**
store. We cannot flip the web to Firestore while the apps still write Render
(a web-created event wouldn't reach the app, and vice-versa). So steps 2–3 land
behind flags, and the **flip happens together**: apps rebuilt with the flag on +
web uploaded + rules deployed + data migrated, in one go. Render stays the source
of truth until that moment.

## Reality on effort

The app changes can't be verified in this environment (no React Native build
here), so each app step is a **Codemagic build → TestFlight/internal test →
adjust** loop. Expect this to run over several iterations, not one — and it must
not disrupt live events (ECS, Kempton, Kruinsig are in use), which is exactly why
the flip is flagged and coordinated.

## Order we'll build

Events first (most-used, already mirrored for reads), verified end-to-end, then
club data, then the coordinated flip + migration + Render shutdown.

## Status — events layer (app + web) is written, behind flags

Both halves of the events cutover are now in the tree, **inert until flagged on**:

- **App** — `services/tournamentFirestore.ts` (native-subcollection adapter) is
  selected by `services/tournamentApi.ts` only when built with
  `EXPO_PUBLIC_USE_FIRESTORE=1`. That env var is a build-time constant, so the
  `require()` (and the whole firebase SDK) is dead-code-eliminated from every
  normal build — ForeAi / Kempton / Surveyor stay byte-for-byte on Render.
- **Web** — `clubhouse/events-fs.js` mirrors the same model. When switched on it
  (1) installs a `window.fetch` shim that serves `<api>/tournaments/**` from
  Firestore, and (2) exposes `subscribeEvent(id, cb)` for realtime. Wired into
  `board`, `manage/live`, `manage/office`, `register`, `get`, `hub`. It is
  gated by `FOREAI_DEFAULTS.useFirestore` (config.js, default **false**) or
  `?fs=1` per-page (`?fs=0` forces off), so the live pages are untouched until
  the flip. `events-fs.js` loads **after** `auth-guard.js` so its shim wraps the
  token layer: `/tournaments/**` → Firestore, `/auth/**` → Bearer as before.

## Status — club data (app side) is written, behind the same flag

The member-facing club features are now ported for the app too, selected by the
same `EXPO_PUBLIC_USE_FIRESTORE=1` guard:

- **`services/clubFirestore.ts`** — Firestore implementations of the member-facing
  surface of `membershipApi` (club info, member lookup/claim, tee-sheet slots,
  book/cancel), `competitionsApi` (list/detail/enter/withdraw/submit score), and
  `newsApi` (list/item). `membershipApi.ts` / `competitionsApi.ts` /
  `newsApi.ts` select it under the flag (dead-code-eliminated otherwise). Admin
  work (roster CRUD, imports, HNA sync, creating competitions, blocking slots)
  stays on the web office — the app never did those.
- **`lib/compScoring.ts`** — a faithful on-device port of the backend's WHS
  scoring (`lib/scoring.ts`) so competition leaderboards compute identically to
  Render. **Verified** against the server file with a 20,000-case differential
  test (course/playing handicap, per-hole strokes, `scoreRound`, countback — incl.
  plus handicaps and varied slope/rating/allowance): zero divergence.
- Tee-sheet slot generation and all booking validation are ported from
  `routes/bookings.ts` (club-local SAST +02:00), keyed by `teeMs` so a day's
  slots need no composite index.

Firestore model: `clubs/{clubKey}` (settings) + subcollections `members`,
`bookings`, `competitions` (+ `entries`), `notices` — matching
`firestore.rules.next`. So one flag-on app build now covers **events + club
data**.

## Status — club data (web side) is written, behind the same flag

- **`clubhouse/club-fs.js`** — the web twin of `clubFirestore.ts`, covering the
  FULL club surface (member-facing **and** admin): club settings, roster CRUD +
  bulk import + manual handicap entries, tee-sheet slots/day view + block +
  cancel, competitions list/detail/create/edit/delete/enter/withdraw/score, and
  notices list/all/item/create/edit/delete. Same shim design as `events-fs.js`
  (routes `/club|/members|/bookings|/competitions|/news` → Firestore). Wired into
  `manage/members`, `manage/teesheet`, `manage/competitions`, `manage/news`. Its
  WHS scoring transcription is **verified** against the server with the same
  20,000-case differential test.
- A live HNA handicap *pull* still needs a server, so `sync-hna {live:true}`
  reports `notConfigured`; manual/CSV handicap entries work.

So both app and web now have the entire Firestore data layer (events + club),
all behind the `useFirestore` / `EXPO_PUBLIC_USE_FIRESTORE` flags.

### Identity: what makes admin writes work (and the one housekeeping item)

`firestore.rules.next` gates admin writes on the organiser's Firebase identity
(event `ownerUid`, or `isClubAdmin` via an `adminUsers/{uid}` doc). This lines up
with the existing flow: **`signin.html` signs the organiser into Firebase**
(email/Google) and that session persists across the manage pages, so
`events-fs.js` / `club-fs.js` run writes under the organiser's real uid — not the
anonymous fallback (anon only covers the public read/register pages). The one
requirement to satisfy before the flip: every organiser must have an
`adminUsers/{uid}` doc with their `clubKey`, created by the `provisionOrganiser`
Cloud Function (or written by the data migration). Club-bound admin writes and
`isEventAdmin` on legacy (ownerless) events depend on it. Events'
contests/players/scores stay open (matching the ungated REST routes), so live
scoring and the board never depend on this.

### To test (single flagged page, no risk to live)

1. Deploy the rules: promote `firestore.rules.next` → `firestore.rules` and
   `firebase deploy --only firestore:rules`. Without this, writes are denied.
2. Make sure the organiser you sign in as has an `adminUsers/{uid}` doc with the
   right `clubKey` (run `provisionOrganiser`, or the migration).
3. **Events:** open `office.html?fs=1`, create an event, add teams; open
   `board.html?fs=1` with the same code — scores/positions stream live from
   Firestore. Nothing hits Render on those tabs.
4. **Club:** sign in, then open `manage/members.html?fs=1`, `manage/teesheet.html?fs=1`,
   `manage/competitions.html?fs=1`, `manage/news.html?fs=1` — add a member, block a
   slot, create a competition + score it, post a notice; all read/write Firestore.
5. When satisfied, flip `useFirestore: true` in `config.js` **and** ship the apps
   with `EXPO_PUBLIC_USE_FIRESTORE=1` — together (the coordinated flip). After the
   flip, retire Render (both services + Postgres) once the data migration has run.
