# Kempton Park Golf — App Store / store assets

Store listing assets for the Kempton club app (bundle id `com.foreai.kempton`,
"Kempton Park Golf"). Screenshots are faithful recreations of the app screens in
the club's navy + gold theme, rendered at the App Store 6.7" iPhone size.

## Files
- `app-icon-1024.png` — 1024×1024 App Store icon (no alpha). Same crest as the
  in-app assets (`mobile/assets/kempton-icon.png`).
- `screenshots/` — **6.7" iPhone (1290×2796)** — use for the 6.7"/6.9" slot.
- `screenshots-6.5/` — the same six at **6.5" iPhone (1284×2778)** — use if App
  Store Connect shows a 6.5" Display slot (it rejects 1290×2796).
  (The app is iPhone-only, so no iPad set is needed.) The six screens are:
  - `01_home.png` — home / crest hero + feature cards
  - `02_gps.png` — GPS rangefinder (front/middle/back)
  - `03_membership.png` — digital membership card + QR check-in
  - `04_teetimes.png` — tee-time booking
  - `05_competitions.png` — competition leaderboard
  - `06_news.png` — club news

## Listing metadata (paste into App Store Connect)

- **Name:** Kempton Park Golf
- **Subtitle:** GPS, tee times & live scores
- **Category:** Sports
- **Age rating:** 4+
- **Copyright:** 2026 Kempton Park Golf Club
- **Support URL:** https://kemptongolfclub.co.za
- **Marketing URL:** https://kemptongolfclub.co.za
- **Privacy Policy URL:** https://foreai.co.za/privacy.html

**Promotional text:**
> The official app for Kempton Park Golf Club — GPS rangefinder, tee-time
> bookings, live competitions, your digital membership card and club news.

**Keywords:** golf,gps,rangefinder,tee times,scorecard,handicap,stableford,leaderboard,golf club,kempton,fourball

**Description:**
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

CLUB NEWS
• Announcements, results and notices from the club
• Pro shop contacts and bookings

Built for the members of Kempton Park Golf Club.
```

**App Review notes:**
```
No login required to review the app. GPS rangefinder, course maps, scorecard and
club info are all open. "Link membership" is optional and only personalises the
digital card; it is not needed to use the app. No account or payment is required.
```

**App Privacy — Data Collection** (App Store Connect → App Privacy)

Answer **"Yes, we collect data from this app."** The app stores member data on the
Kempton backend when someone links their membership, books a tee time, or enters a
competition. There are **no** analytics or advertising SDKs.

Declare **only** these data types, each: used for **App Functionality** only,
**linked** to the user's identity, **not** used for tracking.

| Category | Data type | Notes |
|---|---|---|
| Contact Info | Name | member profile |
| Contact Info | Email Address | member profile / bookings |
| Contact Info | Phone Number | only if member phone numbers are stored |
| Identifiers | User ID | membership number / linked account |
| Other Data | Other Data Types | handicap index (no golf-specific field) |

Do **NOT** declare:
- **Location** — the GPS rangefinder uses location **on-device only**; it is never
  sent to or stored on the backend, so it is not "collected".
- Health & Fitness, Financial Info, Purchases (no payments yet), Contacts,
  Browsing/Search History, Sensitive Info, Usage Data, Diagnostics.

Resulting label: "Data Linked to You — used for App Functionality, no tracking."

**TestFlight test information** (required for external testing):
- Feedback email: proshop@kemptongolfclub.co.za
- Beta App Review contact: a real name + phone + email

## Regenerating the screenshots
They are rendered from HTML mockups via headless Chromium at 3× (430×932 →
1290×2796). Ask Claude to regenerate if the theme or content changes, or replace
them with live device captures from a TestFlight build.
