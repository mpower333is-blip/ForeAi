# Official handicap sync (HNA / DotGolf) — scope & design

Goal: let a player's **official** Handicaps Network Africa (HNA) index flow into
ForeAi automatically, so a club can run its competitions on ForeAi alone —
closing the one feature gap vs ScoreCapture.

## Status

| Piece | State |
|---|---|
| Player enters **SA Player ID (HNA)** + handicap index in the app | ✅ done (`ProfileContext.saId`, Profile screen) |
| Club roster carries `hnaId` + `handicapIndex` per member | ✅ `clubs/{clubKey}/members` |
| Competition scoring uses the index (course/playing handicap, strokes received) | ✅ `compScoring.ts` |
| **DotGolf ISV client + sync functions** | ✅ built (`functions/src/hna.ts`, `syncClubHna`/`hnaLookup`) |
| **Live sync switched on** | ⏳ needs per-club DotGolf credentials + a Swagger field-name check |

The integration is **implemented and gated** — it activates the moment the
club's DotGolf credentials are set, exactly like the Xweather weather feed.

## The API: DotGolf ISV

HNA's platform is **DotGolf**. The ISV API (`http://isvapi.wa.dotgolf.co.uk`) is
JWT-based (HS256) and issues a **Username + Secret Key per club**:

1. Build a client-token JWT (claims `aud:"isv-api"`, `iss:<username>`, `iat`),
   signed with the Secret Key.
2. `POST /api/wal/v1/account/token { clientToken }` → `{ accessToken,
   refreshToken, expiresAtUTC }`.
3. Send `Authorization: Bearer <accessToken>` on all requests; renew via
   `/account/renew`.
4. Rate limit: **300 req/min** per username. Endpoints: Club Members, Courses,
   Scores, Visitors. Country code `wal`.

`functions/src/hna.ts` implements all of this with Node's built-in `crypto` (no
dependency): client-token signing, token caching + renew per warm instance, a
defensive member parser, and a 1-hour member-list cache for lookups.

## To switch it on

1. **Get credentials** from DotGolf/HNA (info@handicaps.co.za) — a Username +
   Secret Key for the club.
2. **Set env** in `functions/.env` (git-ignored): `HNA_USERNAME`,
   `HNA_SECRET_KEY` (optional: `HNA_API_BASE`, `HNA_COUNTRY`, `HNA_MEMBERS_PATH`).
3. **Confirm the version + Club Members path** in the Swagger UI
   (`http://isvapi.wa.dotgolf.co.uk`, labelled **V3**): set `HNA_API_VERSION`
   (v1 or v3) to match the endpoint paths, and `HNA_MEMBERS_PATH` if the Club
   Members path isn't `/members`.
4. **Deploy** (`firebase deploy --only functions`) and run a sync.

### Confirmed member schema (DotGolf ISV)

`parseMember()` is matched to the real response:
- **Identity** (we match a roster `hnaId` against *all* of these, normalised):
  `membershipNumber`, `member.centralMemberCode` (SAGA/central code),
  `nationalIdentityNumber`, `memberUID`.
- **Handicap index:** nested at `member.handicap.index` (number). A plus handicap
  shows a leading `+` in `member.handicap.displayIndex`, so we sign it negative
  for WHS scoring. Status flags (`isWithdrawn`/`isProvisional`/`isFrozen`/
  `isPending`) are available if we later want to exclude non-active handicaps.
- **Name:** `firstName`, `lastName`.

## The functions (built, gen2, `europe-west1`)

- **`syncClubHna`** (onCall, club admin): reads the caller's club from the
  server-trusted `adminUsers/{uid}`, pulls HNA Club Members, and updates every
  roster member whose `hnaId` matches an HNA `saId` with the current index
  (writes `handicapIndex` + `handicapSyncedAt`). Returns `{ configured,
  candidates, updated }` — the contract `members.html syncHna()` already expects.
- **`hnaLookup`** (onCall, signed-in player): `{ saId } → { configured,
  handicapIndex }` for the app's "Update from HNA" button. Works when the player
  is in the configured club's roster.

**Budget:** indexes recompute nightly, so `hnaLookup` serves from a 1-hour cache;
`syncClubHna` always pulls fresh (admin-triggered). Both stay far inside 300/min.

**Multi-club:** creds are read from env (one club today). To serve several clubs,
resolve `{username, secretKey}` per `clubKey` (Secret Manager or a protected
config doc) and pass them to the same `hna.ts` functions — no other change.

## Wiring notes

- The club roster (`members.html`) currently talks to the **retired Render
  backend**; to point `syncClubHna` at Firestore, migrate that page's
  `/members/:club/sync-hna` call to the `syncClubHna` callable (small change,
  do it when the roster page is moved onto Firestore).
- Never put `HNA_API_KEY` in the app — all HNA calls go through the function.
