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
