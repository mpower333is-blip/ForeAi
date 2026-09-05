# Testing ForeAi without an Apple device

You don't own an iPhone/iPad/Mac — here's how to test the apps we're building
anyway. Three lanes, from instant to most-realistic:

## 1. In any browser — the web build (instant, free)

ForeAi is one Expo codebase for iOS, Android **and web**. CI deploys the web
version to GitHub Pages on every push, so the newest build is always live at:

- **Full ForeAi app:** <https://mpower333is-blip.github.io/ForeAi/>
- **ECS Golf Day app:** <https://mpower333is-blip.github.io/ForeAi/event/>

Open those on the Android tablet, your PC — anything with a browser. It's the
same JavaScript, screens and logic as the phone apps, so it's the fastest way
to click through what we're building.

*One-time setup:* if the very first "Deploy web app" CI job fails with a
"Pages not enabled" error, enable it once at repo **Settings → Pages →
Source: GitHub Actions**, then re-run the job.

*Limits:* the browser can't do everything a phone does — swing detection
(motion sensors), ball-strike listening, and notifications are degraded or
unavailable; GPS and camera work only if the browser grants permission.

## 2. The real iOS build, in your browser — Appetize (free tier)

To see the app as it actually runs **on iOS** (native navigation, iOS
behaviors, the real binary), use the new Codemagic workflow:

1. Codemagic → Start new build → **ForeAi — iOS Simulator app (browser
   testing via Appetize)**. It builds the iOS app for Apple's *simulator* —
   completely unsigned, so it needs **no Apple account, certificates, or
   paid developer program**.
2. Download the artifact `ForeAi-iOS-simulator.zip` (also emailed to you).
3. Create a free account at <https://appetize.io> → **Upload** → choose the
   zip → platform **iOS**.
4. Appetize gives you a link that boots the app on a simulated iPhone or
   iPad, streamed into your browser. Tap and use it like a real device.

The free tier gives a limited number of streaming minutes per month — plenty
for checking builds. Each new build: re-run the workflow, re-upload the zip
(or replace the existing Appetize app so the link stays the same).

*Limits:* it's Apple's simulator, so no real camera/GPS/motion hardware —
UI, flows, and iOS-specific behavior are what you're testing here.

## 3. Real iPhone testing — TestFlight (needs a physical device)

The existing **foreai-ios** workflow uploads to TestFlight. That's the lane
for real testers with iPhones — invite a friend/tester with an iPhone from
App Store Connect and they install via the TestFlight app. There is no way
to run TestFlight builds without Apple hardware, which is exactly why lanes
1 and 2 exist.

## Android tablet

The tablet runs the **native Android build** — see
[`android-tablet.md`](./android-tablet.md). Quick version: on the tablet,
download and open
<https://github.com/mpower333is-blip/ForeAi/releases/download/test-latest/ForeAi.apk>
and allow "install unknown apps".
