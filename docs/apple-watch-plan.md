# Apple Watch (watchOS) companion — plan

Status: **planned, not built.** This mirrors the existing Wear OS app (`wear/`,
Kotlin) on Apple Watch. Build it after launch, once the phone apps + Wear OS are
stable.

---

## 1. What it does (feature parity with Wear OS)

The Wear OS watch is **standalone** — it talks straight to the ForeAi backend, no
phone required. The Apple Watch app copies that exactly:

- **Join / load an event** by code (or paired from the phone once), reads the
  course + green coordinates.
- **GPS rangefinder** — Front / Middle / Back distance (metres) to the green from
  the watch's own GPS fix, per hole. (Ports `RoundViewModel.dist()` + `Course.kt`.)
- **Hole navigation** — previous / next hole, par + length.
- **Score entry** — tap in your score per hole; it **syncs to the backend
  leaderboard** the phones read (`PUT /tournaments/:id/scores`).
- **Team/your score + thru** readout.
- **Club bag distances** (the metre carries from `DEFAULT_BAG`).
- *(Optional, later)* swing detection via CoreMotion, mirroring `SwingSensor.kt`.

Everything the watch needs is already exposed by the backend, so **no new API
work** — the watch is another client of the same endpoints.

---

## 2. Architecture

- A **native watchOS app in SwiftUI** (watchOS is Swift-only; React Native does
  not run on the watch). It is a separate Xcode target **embedded inside the
  iPhone app's IPA** — on iOS the watch app ships *with* the phone app as ONE App
  Store submission (unlike Android, where phone and Wear OS are separate uploads).
- **Standalone networking**: the watch uses `URLSession` to hit
  `https://foreai-backend.onrender.com` directly — same design as Wear OS's
  `Backend.kt`. This avoids the complexity of WatchConnectivity/phone-relay for v1.
- **Location**: `CoreLocation` (`CLLocationManager`, when-in-use) for the GPS fix.
- Port three small Kotlin files to Swift:
  - `Backend.kt` → `Api.swift` (event model + score sync)
  - `Course.kt` → `Course.swift` (bundled Kempton greens + bag)
  - `Geo.kt` / `RoundViewModel.kt` → `Rangefinder.swift` (haversine F/M/B)

---

## 3. How it fits the Expo / React-Native build (the hard part)

Expo generates `ios/` from `mobile/app.config.js` via `expo prebuild`. watchOS
targets are **not** first-class in Expo, so we add one with a config plugin:

- Use **`@bacons/apple-targets`** (the maintained tool for adding Apple targets —
  widgets, watch apps — to Expo projects). It adds the watchOS target to the
  generated Xcode project on every prebuild, so we stay in the managed workflow
  (no committed `ios/` folder to hand-maintain).
- The SwiftUI source lives in e.g. `mobile/targets/watch/` and the plugin wires it
  into the Xcode project during `expo prebuild`.
- Codemagic's existing `foreai-ios` workflow keeps working (`expo prebuild` →
  pods → build-ipa), with the changes in §5.

**Reality check:** this tooling is less battle-tested than the plain app build.
Budget time for build friction the first time the watch target is wired in.

---

## 4. Effort (phased)

| Phase | Work | Rough size |
|---|---|---|
| 0 | Add `@bacons/apple-targets`, scaffold an empty watchOS target, get it building + on TestFlight | ~0.5–1 day |
| 1 | `Course.swift` + `Rangefinder.swift` + the **F/M/B rangefinder** screen (CoreLocation) | ~1 day |
| 2 | Hole nav + **score entry** + backend sync (`Api.swift`) | ~1 day |
| 3 | Bag distances screen; polish, complications/glances | ~0.5 day |
| 4 | Signing (watch bundle id), build, submit | ~0.5 day + review |

**~3–4 focused days** for a solid v1 (rangefinder + scoring), plus review time.
Swing detection (CoreMotion) is a later add-on.

---

## 5. Build & signing implications (Codemagic)

- **New bundle id** for the watch app, e.g. `com.foreai.mobile.watchkitapp`
  (and its extension, depending on the watchOS template).
- The **signing step must fetch App Store profiles for the extra bundle id(s)**,
  not just `com.foreai.mobile`. Today `app-store-connect fetch-signing-files`
  handles one bundle id — extend it to loop over the app + watch bundle ids, all
  signed with the same persistent distribution certificate (`IOS_DIST_KEY`).
- No change to versionCode logic — iOS uses one build/marketing version for the
  whole IPA (watch included). No separate "watch build id" like Android.
- The watch app rides the **same TestFlight build and the same App Store
  submission** as the phone.

---

## 6. App Review notes

- A watch app must offer **real, watch-appropriate value** — the rangefinder +
  on-wrist scoring clearly qualify (this is exactly what the top golf apps do).
- Location usage string already covers "distances to the pin"; the watch reuses
  it. No new privacy strings expected beyond CoreLocation/CoreMotion.

---

## 7. Recommendation

Ship phone (both stores) + **Wear OS** first. Then do phases 0–2 for an Apple
Watch v1 (rangefinder + scoring), submit it inside the next iOS build, and add
bag/swing later. Keeping the watch **standalone** (like Wear OS) is the key
simplification — no phone-pairing plumbing for v1.
