# Running ForeAi on an Android tablet

ForeAi is **one codebase for iOS and Android**. The app you use on iPhone is
the same app that CI builds as a native Android APK — so to get it on an
Android tablet you don't run the iOS app, you install the Android build of it.

> **Why you can't run iOS apps directly:** Android cannot open `.ipa` files or
> anything from the Apple App Store. iOS apps are compiled for a different
> operating system and are locked to Apple hardware by Apple's DRM — there is
> no emulator or compatibility layer that runs modern iOS apps on Android.
> Because ForeAi is built with React Native, the same features ship natively
> on both platforms instead.

## Install on the tablet (2 minutes)

1. On the tablet, open the browser and go to the rolling test release:

   - **ForeAi (full app):**
     <https://github.com/mpower333is-blip/ForeAi/releases/download/test-latest/ForeAi.apk>
   - **ECS Golf Day (event app):**
     <https://github.com/mpower333is-blip/ForeAi/releases/download/test-latest/ECS-Golf-Day.apk>

   (Or go to `foreai.co.za/download.html` and tap Download / scan the QR.)

2. Open the downloaded file from the notification shade or the Files app.

3. When Android warns about the source, choose **"Install anyway" / "Allow
   from this source"**. Play Protect may offer to scan the app — that's normal
   for test builds outside the Play Store.

4. Done — ForeAi appears in the app drawer like any other app.

These links always point at the **newest** build: CI republishes the APKs to
the `test-latest` GitHub release on every push to `main`, so to update, just
download and install again (it upgrades in place, keeping your data).

## Tablet notes

- The APK is the same package (`com.foreai.mobile`) as the phone build and
  installs on any Android 7+ phone or tablet.
- The app is portrait-oriented; on a tablet it runs full-screen in portrait,
  which suits the scorecard and leaderboard layouts.
- Camera (swing coach), GPS distances, and offline courses all work the same
  as on a phone, provided the tablet has those sensors (Wi-Fi-only tablets
  without GPS will not show live distances).
