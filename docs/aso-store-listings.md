# ForeAi — store listing copy (ASO)

Paste-ready metadata to boost search ranking on the App Store and Play Store.
Character limits are hard limits; counts below are within them. The golden rule:
**don't repeat words across fields** — each indexed word only needs to appear
once to rank for it, so spend every field on *new* keywords.

---

## Apple App Store (iOS)

Apple indexes **App Name + Subtitle + Keywords** as one combined keyword set.
The name already contains *golf*, *caddie*, *AI* — so the subtitle and keywords
must add different terms.

**App Name (≤30)** — keep as is:
```
ForeAi: AI Golf Caddie
```

**Subtitle (≤30)** — currently EMPTY, this is the quick win:
```
GPS Rangefinder & Scorecard
```
(27 chars — adds *GPS*, *rangefinder*, *scorecard*, the three highest-traffic
golf-app search terms you don't yet rank for.)

**Keywords (≤100, comma-separated, NO spaces, no words already in name/subtitle):**
```
swing,score,stats,handicap,shot,tracker,yardage,strokes,putting,stableford,tournament,slope,course
```
(98 chars. Assumes the Subtitle carries gps/rangefinder/scorecard. If the
subtitle can't be set, use this instead so those terms aren't lost:
`gps,rangefinder,swing,score,stats,handicap,shot,tracker,yardage,strokes,putting,stableford,slope`)

**Promotional text (≤170, editable anytime, not indexed — shown at top):**
```
Your AI caddie, GPS rangefinder and swing coach — know every distance, pick the right club, keep score live, and track your stats. Free to start.
```

> Set these in App Store Connect → ForeAi → (version) → English (U.S.) →
> Subtitle / Keywords / Promotional Text.

---

## Google Play Store (Android)

Play indexes the **Title + Short description + Full description** heavily, and
keyword *repetition* in the full description genuinely helps (keep it natural —
Play penalises keyword stuffing). Add *GPS* and *rangefinder* here since the
Play title isn't locked to the iOS name.

**Title (≤30):**
```
ForeAi: Golf GPS Rangefinder
```
(28 chars. Alt if you prefer the brand angle: `ForeAi: Golf GPS & AI Caddie`.)

**Short description (≤80, indexed + shown):**
```
Golf GPS rangefinder, AI caddie, swing coach, live scorecard & stats.
```

**Full description (≤4000):**
```
ForeAi is your AI golf caddie — a GPS rangefinder, swing coach and live
scorecard in one app. Play smarter golf, know every distance, and shoot
lower scores.

⛳ GPS RANGEFINDER
Accurate distances to the front, middle and back of every green, plus
carry distances to hazards and layups. No extra device, no range finder
to carry — just your phone.

🎒 AI CADDIE
Get the right club for every shot. ForeAi learns your real distances as
you play and factors in wind and elevation, so the club recommendation
actually fits your game.

🎥 SWING COACH
Record your swing and get instant feedback on tempo, posture and balance
to groove a more consistent, repeatable golf swing.

📊 LIVE SCORECARD & STATS
Keep score live — strokes, Stableford points and net scores with your
handicap applied automatically. Track fairways, greens in regulation,
putts and strokes gained to see exactly where to improve.

🏆 GOLF DAYS, LEAGUES & TOURNAMENTS
Running a club golf day or a school league? Register players, set tee
times, group fourballs by tee, and follow the live leaderboard — see who's
on which hole in real time.

⚡ LIGHTNING SAFETY
Live lightning alerts warn you when a storm is near so you can get off the
course in time — even when the app is closed.

Whether you're chasing a lower handicap, need a reliable golf GPS, want an
AI caddie for smarter club selection, or you're organising a tournament,
ForeAi brings golf technology end to end. Free to start.

Keywords: golf GPS, rangefinder, AI caddie, golf scorecard, handicap
tracker, swing analysis, strokes gained, golf stats, tee times, golf
tournament app.
```

> Set these in Play Console → ForeAi → Grow → Store presence → Main store
> listing.

---

## Also helps ranking (do once)

- **App Store screenshots:** the first 1–2 captions are indexed-adjacent and
  drive conversion. Lead with "GPS Rangefinder" and "AI Caddie" captions.
- **Ratings:** ranking is heavily driven by rating count/volume. Add a gentle
  in-app "rate us" prompt after a completed round. (Never buy or fake reviews —
  both stores ban it and it's easy to detect.)
- **Fix the App Store link** on the website (`id0000000000` placeholder →
  real App Store ID once live), so web → install actually works.

_Last updated: 2026-10-03._
