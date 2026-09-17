# ForeAi — Apple Watch app (watchOS)

A **standalone watchOS** companion (SwiftUI). It reads/writes the **same
Firestore store** the phones and website use (project `foreai-f9cfa`), so a score
tapped in on the watch lands on the same live leaderboard — the phone can stay in
the bag. Feature parity with the Wear OS app (`../../wear`).

**v1 features:** GPS rangefinder (front / middle / back metres to the green),
hole navigation (par + length), and on-wrist score entry that syncs to the
leaderboard. Swing detection (CoreMotion) is a later add-on.

## How it reaches Firestore (no native Firebase SDK)
The watch talks to the **Firestore REST API over `URLSession`** — reads are
public (per the security rules) and writes carry an anonymous ID token from the
Identity Toolkit REST endpoint. This keeps the watch target dependency-free
(no CocoaPods/Firebase on the watch). See `Api.swift`. Same standalone design as
the Wear OS `Backend.kt`, just Firestore instead of the retired Render backend.

## Files
- `ForeAiWatchApp.swift` — `@main` app entry.
- `Course.swift` — bundled course data (Kempton greens, par/length, bag) + haversine rangefinder.
- `Api.swift` — Firestore REST client + anonymous auth + event model + score sync.
- `RoundModel.swift` — round state + `CLLocationManager` location.
- `ContentView.swift` — the SwiftUI screens.
- `expo-target.config.js` — `@bacons/apple-targets` config that adds this as a
  watchOS target during `expo prebuild`.

## Building it (Codemagic `foreai-ios`)
The watch is **gated off by default** so normal phone builds are untouched. To
build the watch-inclusive IPA (it rides the same TestFlight/App Store submission
as the phone), set BOTH env vars in the `foreai-ios` workflow (commented lines
already there):

```
EXPO_PUBLIC_WATCH: "1"                 # wires the watch target into prebuild
WATCH_BUNDLE_ID:   "com.foreai.mobile.watch"   # signs the watch target
```

The signing step already fetches an App Store profile for `WATCH_BUNDLE_ID` when
it's set (same distribution cert as the phone).

## Reality check (Phase 0)
watchOS targets are **not** first-class in Expo — `@bacons/apple-targets` wires
them in, but it's the finickiest part of the build (see
`docs/apple-watch-plan.md`). Budget time for build friction on the **first**
watch build: the generated **watch bundle id** (expected `com.foreai.mobile.watch`)
and the target name may need tweaking to match `WATCH_BUNDLE_ID`. None of the
Swift here can be compiled off a Mac, so the first Codemagic build is where it
gets shaken out.
