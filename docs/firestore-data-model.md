# ForeAi Firestore data model (target)

The collections that replace the Postgres/Prisma schema when Render is retired.
Mapped 1:1 from `backend/prisma/schema.prisma`. Rules live in
`firestore.rules.next` (promoted to `firestore.rules` at the web cutover — see
`docs/firebase-migration.md`).

## Auth model (replaces admin PINs)

- **Organisers** sign in with Firebase Auth (email/password + Google). Their
  Firebase **uid** is the identity. A Cloud Function provisions
  `adminUsers/{uid}` on sign-in and sets `clubKey` from the `CLUB_ADMIN_EMAILS`
  mapping — the client never writes `clubKey`, so no one can self-grant a club.
- **Players / the public register form** use Firebase **Anonymous Auth**, so the
  "just play / just register" flow needs no account. Every write path below that
  says "any signed-in user" means "has at least an anonymous session".
- **Event admin** = the event's `ownerUid` (the organiser who created it), or —
  for legacy events migrated without an owner — any organiser. This replaces the
  per-event admin PIN.

## Collections

```
users/{uid}                                  # golfer (User); Firebase Auth uid
  rounds/{roundId}                            # Round {courseName,totalScore,createdAt}
    shots/{shotId}                            # Shot {hole,club,yardage,lie,wind,…,strokesGained}
  clubs/{clubId}                              # the golfer's bag (Club) {name,avgCarry,dispersion}

adminUsers/{uid}                             # organiser account {email,name,clubKey,role,…}

events/{eventId}                             # Tournament {code,name,courseId,format,firstTeeMin,
                                             #   intervalMin,shotgun,cause,causePhoto,logo,banking,
                                             #   teamFee,holeFee,reminders,ownerUid,createdAt,updatedAt}
  players/{playerId}                          # TournamentPlayer {name,handicap,deviceId,groupId,createdAt}
  positions/{playerId}                        # live heartbeat {name,lat,lng,lastSeen}
  scores/{playerId_hole}                      # TournamentScore {playerId,hole,strokes}
  groups/{groupId}                            # TournamentGroup {order}
  contests/{contestId}                        # TournamentContest {type,hole}
    results/{playerId}                        # TournamentContestResult {value}
  sponsors/{sponsorId}                        # TournamentSponsor {name,tier,hole,message,logo}
  registrations/{regId}                       # TournamentRegistration {type,company,…,payload,status,sponsorId}
  shotMarks/{markId}                          # TournamentShotMark {playerId,hole,club,lat,lng,source,createdAt}
eventCodes/{CODE} -> {eventId}                # join-code lookup (code is the doc id = uniqueness)

clubs/{clubKey}                              # ClubSettings {name,courseId,firstTeeMin,lastTeeMin,
                                             #   intervalMin,slotCapacity,bookingWindowDays,openDays}
  members/{memberId}                          # Member {memberNumber,firstName,lastName,email,cell,
                                             #   category,status,handicapIndex,hnaId,deviceId,photo,…}
  bookings/{bookingId}                        # TeeBooking {teeAt,courseId,memberId,partySize,players,note,status}
  competitions/{compId}                       # Competition {name,date,format,status,pars,sis,allowance,slope,…}
    entries/{entryId}                         # CompetitionEntry {memberId,playerName,handicapIndex,
                                             #   playingHandicap,holeScores,grossTotal,netTotal,stableford,status}
  notices/{noticeId}                          # Notice {title,body,category,pinned,image,authorName,status,publishAt}

pushDevices/{deviceId}                       # PushDevice {token,platform,lat,lng,enabled} — read only by
                                             #   the lightningWatch function (Admin SDK)
```

Notes:
- **`adminPin` and `ownerId` are dropped** — replaced by Firebase Auth + rules.
- **`clubKey` scoping** (`Member`, `TeeBooking`, `Competition`, `Notice`) becomes
  the parent `clubs/{clubKey}` path instead of a field, so one project serves
  many club apps and rules scope by path.
- **Scores** stay a subcollection keyed `playerId_hole` (was `@@unique`), giving
  the same idempotent upsert the backend has today.
- **`updatedAt`** is written by the client on each write (or by a Function) — no
  Prisma `@updatedAt` equivalent.

## Access control (summary — see `firestore.rules.next`)

| Data | Read | Write |
|---|---|---|
| `users/**` | owner (uid) | owner (uid) |
| `adminUsers/{uid}` | owner | **Cloud Function only** (clubKey server-set) |
| `events/{id}` meta | public | create: signed-in (sets ownerUid); edit/delete: event admin |
| players, positions, scores, groups | public | any signed-in (self-register, heartbeat, group scoring) |
| contests (structure) | public | event admin |
| contest results | public | any signed-in |
| sponsors | public | create: signed-in (registration); edit/delete: event admin |
| registrations | event admin | create: signed-in (public form); manage: event admin |
| `eventCodes/{code}` | public | create: signed-in; immutable after |
| `clubs/{clubKey}` settings | public | club admin |
| members, bookings, competitions | signed-in | club admin |
| notices (club news) | public | club admin |
| `pushDevices/**` | none (Admin SDK) | any signed-in (device registers itself) |

Loosest paths (scores/players "any signed-in") match today's behaviour: the
event is gated by knowing the join code, and any device in a group may post a
score. They can be tightened later (e.g. group membership) without a data change.
