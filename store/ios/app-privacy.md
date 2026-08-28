# App Privacy answers (App Store Connect → App Privacy)

Applies to **both** apps — ForeAi (`com.foreai.mobile`) and ECS Golf Day
(`com.foreai.event`). They share one codebase, so the data practices are identical.

These answers reflect what the app binary actually does (verified in the source),
not the website. The clubhouse website's registration forms collect contact
details, but the **app** does not — keep that distinction, because App Privacy is
about the app only.

---

## First question: "Do you or your third-party partners collect data from this app?"
**Answer: Yes** (the app sends a few things to the ForeAi backend to run live golf days).

There are **no** third-party SDKs that collect data — no analytics, no ads, no
crash/tracking SDKs. All collection is first-party and only for app functionality.

---

## Data types to declare as COLLECTED

For every item below:
- **Used to track you?** → **No**
- **Linked to the user's identity?** → **Yes** (it's tied to the player they create)
- **Purpose** → **App Functionality** only

| Apple category → data type | What it is in the app |
|---|---|
| **Contact Info → Name** | The display name a player types when they join or create a golf day (auto-filled from their profile). Sent to the backend so their name shows on the live leaderboard. |
| **User Content → Gameplay Content** | Golf handicap and hole-by-hole scores, synced to the backend so everyone in the event sees live scoring. |
| **Identifiers → User ID** | A player ID the backend assigns so scores attach to the right person across devices. |
| **Identifiers → Device ID** | A per-session device identifier used to recognise "this phone's player" in an event. Not an advertising identifier. |

That's the complete list of what leaves the device.

---

## Data types to declare as NOT collected (and why)

- **Location (Precise/Coarse)** — the app uses GPS **on the device only**, to show
  distances to the green and point an arrow at the pin. It is **never sent to a
  server**. (Captured survey coordinates are saved locally; they only leave the
  phone if the user taps "Share / export the survey", which is user-initiated
  sharing, not collection.) → **Not collected.**
- **Camera / Photos or Videos** — the swing coach analyses the camera and motion
  feed **live on the device**. Nothing is recorded, saved, or uploaded.
  → **Not collected.**
- **Health & Fitness, Financial Info, Contacts, Email, Phone, Browsing/Search
  History, Purchases, Usage Data, Diagnostics** — none collected by the app.

---

## Other App Store Connect answers this affects

- **Account creation / login:** The app has **no accounts and no login**, so
  Apple's "offer in-app account deletion" requirement does **not** apply.
- **Data used to track you (App Tracking Transparency):** No — so **no** ATT
  prompt and no `NSUserTrackingUsageDescription` needed.
- **Permission prompt strings** (already set in app.config.js, shown at first use):
  - Location: "ForeAi uses your location to show distances to the pin while you play."
  - Camera: "ForeAi uses the camera to frame your swing and give you posture feedback."
  - Motion: "ForeAi uses motion sensors to detect your swing and measure its tempo."

---

## Privacy Policy URL (required field)

App Store Connect requires a privacy policy URL. Host a short policy at, e.g.,
`https://foreai.co.za/privacy.html` saying, in plain terms:
- The app collects your name, golf handicap and scores only to run live golf
  days, stored on the ForeAi backend.
- Location and camera are used on your device only and are not collected.
- No data is sold or used for advertising or tracking.
- Contact: support@foreai.co.za

(Say the word and I'll write that privacy.html page to match these answers.)
