# Google Play — Data safety form answers (ForeAi, com.foreai.mobile)

Play Console → App content → Data safety. Answer as below. These reflect the
app only (the website's registration form is separate).

## Section 1 — Overview
- Does your app collect or share any of the required user data types? **Yes**
- Is all of the user data collected by your app encrypted in transit? **Yes** (HTTPS)
- Do you provide a way for users to request that their data is deleted? **Yes**
  - Method: users can request deletion by emailing **support@foreai.co.za**; an
    organiser can also remove a player from an event. (No in-app account exists.)
- Is your app in the Play Families / designed-for-kids programme? **No** (rated 4+, but not a kids app)

## Section 2 — Data types
Only the types below are collected. Everything else = **Not collected**
(no email, phone, address, contacts, calendar, messages, photos/videos, audio,
files, health, web-browsing, installed apps, search history, or advertising IDs).

Camera note: the Swing Coach uses the camera, but the video is processed **on the
device** and never uploaded — so no photos/videos are collected.

For every collected type below: **Processed ephemerally = No**, and **Used for
advertising = No**. Data is **not sold**.

| Data type | Collected | Shared (3rd party) | Optional? | Purpose |
|---|---|---|---|---|
| **Location — Precise location** | Yes | No | **Optional** (only when you share your position) | App functionality — GPS distances to the green and showing your team on the live course map |
| **Personal info — Name** | Yes | No | Required | App functionality — identify you on the tee sheet, leaderboard and scoring |
| **Financial info — Purchase history** | Yes | **Yes** (RevenueCat) | Optional (only if you subscribe) | App functionality — manage your subscription and unlock Pro features |
| **App activity — Other user-generated content** (scores, handicap, contest results) | Yes | No | Required | App functionality — live scoring and the leaderboard |
| **Device or other IDs** | Yes | **Yes** (RevenueCat) | Required | App functionality — link this phone to your player (presence / live map) and manage the subscription entitlement |

### Purposes to tick (all types)
- **App functionality** ✅ (only this)
- Analytics ❌, Developer communications ❌, Advertising/marketing ❌,
  Fraud prevention/security ❌, Personalisation ❌, Account management ❌

### Third parties who receive data
- **RevenueCat** — receives an app-user/device ID and purchase info to run the
  subscription (receipt validation, entitlements, restore).
- Our own backend (foreai.co.za / Render) stores name, scores and shared
  position — that's first-party, not "sharing".
- **No** advertising or analytics SDKs are included.
