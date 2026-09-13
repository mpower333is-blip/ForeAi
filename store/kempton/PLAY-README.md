# Kempton Park Golf — Google Play listing

Everything needed to publish the Kempton club app on Google Play. The signed
**.aab** is produced by the Codemagic workflow **`foreai-kempton-android-play`**
(run it manually; it emails the `ForeAi-Kempton-<code>.aab`). Package
`com.foreai.kempton`, name "Kempton Park Golf Club".

## Assets in this folder
- `play-icon-512.png` — 512×512 app icon (Play requires 512).
- `play-feature-1024x500.png` — 1024×500 feature graphic (top of the store listing).
- `screenshots/` — the 1290×2796 phone screenshots also work for Play (min 2, up to 8).
  (Play has no separate 6.5"/6.7" split — any 16:9 or 9:16 phone shots 320–3840px are fine.)

## Create app (Play Console → All apps → Create app)
- **App name:** Kempton Park Golf Club
- **Default language:** English (United Kingdom) – en-GB
- **App or game:** App
- **Free or paid:** Free
- Tick both declarations (Developer Program Policies + US export laws).

## Store listing (Main store listing)
- **App name:** Kempton Park Golf Club
- **Short description** (≤80 chars):
  ```
  GPS rangefinder, tee times, competitions & digital membership for the club.
  ```
- **Full description** (≤4000 chars):
  ```
  The official app of Kempton Park Golf Club — your course, in your pocket.

  GPS RANGEFINDER
  • Automatic front, middle and back distances to every green
  • Hole-by-hole satellite maps for all 18 holes — available offline
  • Live scorecard and shot tracking as you play

  MEMBERSHIP
  • Your digital membership card with QR check-in
  • Handicap index synced from HNA
  • Book tee times and view the club tee sheet

  COMPETITIONS
  • Enter club medals and Stableford days
  • Post your card hole-by-hole with live net & Stableford scoring
  • Real-time leaderboards with countback

  CLUB NEWS & ACCOUNT
  • Announcements, results and notices from the club
  • Dues, green fees and competition entries in one place

  Built for the members of Kempton Park Golf Club.
  ```
- **App icon:** `play-icon-512.png`
- **Feature graphic:** `play-feature-1024x500.png`
- **Phone screenshots:** upload from `screenshots/` (at least 2).
- **App category:** Sports
- **Tags:** golf, sports
- **Contact details:** email `golfforeai@gmail.com` · website `https://kemptongolfclub.co.za`
- **Privacy Policy:** `https://foreai.co.za/privacy.html`

## App content (all required before publishing)
- **Privacy policy:** https://foreai.co.za/privacy.html
- **Ads:** No, the app contains no ads.
- **App access:** All functionality is available without special access — no login
  required to review the app. ("Link membership" is optional and only personalises
  the digital card.) So choose "All functionality is available without restrictions".
- **Content rating** (questionnaire): category **Utility / Productivity / Other**;
  answer **No** to every content question (no violence, sex, language, gambling,
  etc.). Result: **Everyone / PEGI 3**. Email for the certificate: `golfforeai@gmail.com`.
- **Target audience:** target age **18 and over** (members' club app). Not designed
  for children → not in the Families programme.
- **Data safety** (mirrors the App Store privacy label):
  - Does your app collect or share user data? **Yes** (collects; does **not** share).
  - Data types collected: **Name**, **Email address**, (optional **Phone number**),
    and **Other** (golf handicap index). No location is collected — the GPS
    rangefinder runs on-device only and is never sent to the backend.
  - For each: purpose **App functionality**; **linked** to the user; **not** used
    for tracking/advertising.
  - Is all data **encrypted in transit**? **Yes** (HTTPS).
  - Can users request data deletion? **Yes** — contact `golfforeai@gmail.com`
    (also list `clubmanager@kemptongolfclub.co.za`).
- **Government app:** No.
- **Financial features:** None. (Card payments, when enabled, are handled on
  PayFast's own web checkout — there is no in-app digital purchase / Play Billing.)
- **Health apps / COVID:** No.

## Release
1. Build the bundle: Codemagic → **`foreai-kempton-android-play`** → Start build
   → it emails `ForeAi-Kempton-<versionCode>.aab` (versionCode starts at 3001).
2. Play Console → **Test and release** → start with **Internal testing** → Create
   release → **enrol in Play App Signing** when prompted (register the shared
   upload key), upload the `.aab`, add release notes, roll out.
3. Once happy, promote the same build to **Production** (or Closed/Open testing).
4. Later updates: run the workflow again — each build has a higher versionCode, so
   it uploads cleanly.

> Play App Signing: Google holds the app signing key; you upload with the upload
> key baked into the `google_play` Codemagic group. Keep that keystore safe — it's
> how every future update is authenticated.

## Wear OS watch app (optional, same Play app)

The Kempton watch app is the golf-day companion (join an event by code and score
from the wrist), built from the shared `wear/` source with the Kempton install id,
name and backend. It ships **inside the same Kempton Play app** as its **Wear OS
form factor** — the same model as ForeAi's phone+watch.

1. Build it: Codemagic → **`foreai-kempton-watch-android`** → Start build → it
   emails `ForeAi-Kempton-Watch-<versionCode>.aab` (93000+ lane, so it never
   clashes with the phone bundles at 3000+).
2. Play Console → the Kempton app → **Test and release** → create/edit a release
   → add the watch `.aab` **alongside** the phone `.aab` (Play detects it as the
   Wear OS form factor).
3. Signed with the same shared upload key, so no extra signing setup.

> The watch talks to `foreai-kempton-backend` and carries the "Kempton Park Golf"
> name. It's optional — publish the phone app first; add the watch when you want it.
