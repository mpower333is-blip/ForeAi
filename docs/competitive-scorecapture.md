# Competitive map: ForeAi vs ScoreCapture

Source: ScoreCapture's own 2017 package sheets (clubs, societies, corporate days,
leagues) + current pricing card. Use this to plan features and pricing per market
segment. Honest assessment — "gap" means ScoreCapture does it and we don't yet.

## ScoreCapture's product line & pricing

| Segment | Pricing | What it includes |
|---|---|---|
| Individual golfer | Free | App, live scoring, various scorecards, matchplay card, live leaderboards |
| **Club** | Free · Premium **R2 000/mo or R20 000/yr** · Premium Plus **R10 000 once-off + R1 000/mo** | Free: 2 comps/mo, tournament builder, member mgmt, invites (email/SMS), QR/PIN join, live scoring, capture screen, admin app, matchplay, prize analysis. Premium: unlimited multi-round (eclectic, order of merit, rankings, FedEx/Race-to-Dubai, leagues, knockouts), sponsor logos everywhere. Premium Plus: 40″ clubhouse TV + Mini PC, live board on a 180s cycle with ad slots the club sells (~R750/10s). Newer card: 1-yr R20k / 2-yr R17.5k, or pay in 4–5 fourballs/month; 49″ screens R8 000. |
| **Society** (<200 members) | Free · Premium **R100/member/yr** | Free: unlimited single-round comps, 30 calc types, member mgmt, live scoring. Premium: unlimited multi-round — eclectics, order of merit, rankings, knockouts. |
| **Corporate day** | **R125/player, min R10 000/round** | Full-service: they supply pre-loaded phones for every 4-ball + on-site staff at registration. Track record: Nedbank Corporate Masters, Vodacom Origins, Leopard Creek, Kyalami, all Central Gauteng events. |
| **Union leagues** | Clubs free + Premium upgrade | Unions create seasons/leagues/divisions/teams/fixtures; team admins pick squads per fixture; players score + live league tables. Player upload needs **SAGA Number** (SA Player ID). |

**Their monetization genius:** the club/society rarely pays cash — a **sponsor** carries the fee via ads on the clubhouse screen, leaderboards, emails and prize lists. The screen *pays for itself*.

## ForeAi position per segment

### Individual golfer — we WIN decisively
ForeAi has what no scoring app has: AI caddie, GPS rangefinder, **real lightning
safety**, smartwatch apps, course-survey DB. Keep the app free + a **Pro**
subscription for the player tools.

### Club — we match scoring, win on player value, have commercial gaps
- Match: live scoring, quick-fourball capture, join-by-code, member mgmt,
  Stableford/stroke, handicaps, clubhouse live board (`live.html`), events with
  owners/admins/docs (the "ECS Golf Day" type events already run 100+ fields).
- Win: own-branded app in the stores (not a generic dashboard), caddie, GPS,
  lightning safety, watch.
- **Gaps:** multi-round series, matchplay formats, **sponsor/ad engine**, official
  HNA sync.

### Society — need multi-round + per-member billing
Events system covers single-day society comps today. **Gap:** the multi-round
"keep members involved" features (eclectic, order of merit, rankings, knockouts)
that justify their R100/member/yr Premium.

### Corporate day — lucrative, mostly reachable now
R125/player × 100+ players = R12k+/day, high margin. ForeAi's events + quick
scorecard + live board already cover most of it. **Gap:** the white-glove polish
(bulk field import, on-the-day live board per event, sponsor logos). Worth
targeting — it's cash per event, no long sales cycle.

### Union leagues — biggest build, longest horizon
Full inter-club structure (unions → leagues → divisions → teams → fixtures →
live league tables). ForeAi has none of this yet. High effort; pursue once the
club/society/corporate base is winning.

## Pricing strategy for ForeAi

1. **Copy the sponsor-funded model.** Pair every club/society deal with the
   clubhouse screen + leaderboard ad slots so it's **cash-neutral for the club**.
   This removes the #1 objection and matches how ScoreCapture actually sells.
2. **Undercut on cash.** We run on Firebase (tiny infra cost) and bundle far
   more. Targets: club ~**R1 500/mo or R15 000/yr** (vs their R17.5–20k);
   society **≤R100/member/yr** with more value; corporate **~R100/player, min
   R8 000** (undercut R125/R10k) — or match and win on features.
3. **Lead with what they can't match:** own-branded app, GPS + AI caddie, and the
   **lightning-safety / duty-of-care** story. Safety is a board-level reason a
   club switches — no competitor has it.

## Recommended build order (to achieve parity, then win)

1. **Official HNA sync** — scoped (`docs/HNA.md`), waiting on DotGolf API access. Parity unlock for official comps.
2. **Sponsor / advert engine + clubhouse live-board polish** — logos on leaderboards/emails + an ad-rotation board. *This is the monetization that makes ForeAi free-to-club* and also powers corporate-day sponsor exposure. Highest commercial leverage.
3. **Multi-round series** — eclectic, order of merit, rankings, knockouts. Unlocks Society Premium + Club Premium parity.
4. **Matchplay formats** — betterball, off-the-card (net/points), scratch.
5. **League module** — unions/teams/fixtures/league tables. Biggest; last.

## Compliance note (do not skip)
ScoreCapture publishes a **PAIA manual** — mandatory under SA law (PAIA/POPIA) for
any company processing personal information. ForeAi handles member data, so it
needs the same: a **POPIA-compliant privacy policy** (also required by Apple/Google
for the store listings) and a **PAIA manual**. Flag for the legal/admin track.
