# Official handicap sync (HNA / DotGolf) — scope & design

Goal: let a player's **official** Handicaps Network Africa (HNA) index flow into
ForeAi automatically, so a club can run its competitions on ForeAi alone —
closing the one feature gap vs ScoreCapture.

## Status

| Piece | State |
|---|---|
| Player enters **SA Player ID (HNA)** + handicap index in the app | ✅ done (`ProfileContext.saId`, Profile screen) |
| Club roster carries `hnaId` + `handicapIndex` per member | ✅ already in `members.html` (old backend) |
| Competition scoring uses the index (course/playing handicap, strokes received) | ✅ `compScoring.ts` |
| **Live pull of the current index from HNA** | ⛔ blocked on API access (see below) |

So everything we control is built; the only missing piece is the live data feed,
which only HNA/DotGolf can grant.

## The blocker: there is no public HNA API

HNA moved its platform to **DotGolf** (the HNA Handicaps app is
`za.co.dotgolf.mygolf`). Players authenticate with an **SA Player ID (Golf RSA
ID) + PIN**; indexes recompute nightly (~22:00). There is **no documented public
API** — third-party integrations go through HNA/DotGolf directly.

**Action to unblock:** email **info@handicaps.co.za** (and ask about DotGolf's
partner/developer programme). Request: a server-to-server endpoint to read a
player's current Handicap Index by SA Player ID, plus an API key. This is the
same situation we had with Xweather — once credentials exist, the code below
activates.

## Design (ready to switch on)

Mirror the weather pattern: a credential-gated Cloud Function, free/manual
fallback until configured, secret stays server-side.

1. **Env** (`functions/.env`, git-ignored — placeholders in `.env.example`):
   `HNA_API_URL`, `HNA_API_KEY`, optional `HNA_CLUB_ID`.

2. **`functions/src/hna.ts`** — `fetchHnaIndex(saId): Promise<number | null>`
   - returns `null` when `HNA_API_URL`/`HNA_API_KEY` are unset (→ caller falls
     back to the manually-entered index);
   - when set, GETs the player's record from the HNA/DotGolf endpoint and parses
     the current index. (Exact path/field names come from DotGolf's spec.)

3. **`functions/src/index.ts`** — two gen2 endpoints (region `europe-west1`):
   - `hnaLookup` (onRequest/onCall): `{ saId } → { configured, handicapIndex? }`.
     The app's Profile "Update from HNA" button calls this and, on success, sets
     `handicapIndex` locally (fail-soft to manual entry).
   - `syncClubHna` (onCall, club-admin only): iterates the club roster's members
     that have an `hnaId`, calls `fetchHnaIndex`, writes `handicapIndex` back to
     each `members/{id}` doc. Returns `{ configured, candidates, updated }` —
     matching the contract `members.html syncHna()` already expects
     (`{ notConfigured, candidates }` today).

4. **Caching / budget:** indexes change at most once/day, so cache a player's
   lookup for ~12–24h (Firestore, keyed by `saId`) to keep partner-API calls
   minimal. A club batch sync is a once-a-day job (or on-demand before a comp).

## Wiring notes

- The club roster (`members.html`) currently talks to the **retired Render
  backend**; to point `syncClubHna` at Firestore, migrate that page's
  `/members/:club/sync-hna` call to the `syncClubHna` callable (small change,
  do it when the roster page is moved onto Firestore).
- Never put `HNA_API_KEY` in the app — all HNA calls go through the function.
