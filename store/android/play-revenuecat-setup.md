# Android on Google Play + RevenueCat — setup

Get ForeAi onto Google Play and turn on real subscriptions (Monthly + Annual)
through RevenueCat. The app code is already wired — you only do store/CI setup.

- **Package:** `com.foreai.mobile`
- **Entitlement (RevenueCat):** `pro`
- **Products:** one Monthly + one Annual subscription
- **App reads:** `EXPO_PUBLIC_RC_ANDROID_KEY` (RevenueCat Android SDK key, `goog_…`)

Order matters: Play app + a signed upload → create products → service account →
RevenueCat → SDK key → test. Do it top to bottom.

---

## 1. Google Play developer account
- Sign up at https://play.google.com/console (one-time US$25).
- Use the same Google account you'll manage the app with.

## 2. Create the app
Play Console → **Create app**:
- App name: **ForeAi**
- Default language, App (not game), Free.
- Accept the declarations. You now have an empty app for `com.foreai.mobile`
  (the package locks in on your first upload).

## 3. Make the upload keystore (once) and put it in Codemagic
Play needs a **signed AAB**. Create an upload keystore and store it as
Codemagic env vars so `foreai-android-play` can sign with it.

If you have any computer with Java, run:
```bash
keytool -genkeypair -v -keystore upload.keystore \
  -alias foreai -keyalg RSA -keysize 2048 -validity 10000
```
Answer the prompts; remember the **store password**, **alias** (`foreai`) and
**key password**. Then base64 it:
```bash
base64 -w0 upload.keystore > upload.keystore.b64   # macOS: base64 -i upload.keystore -o upload.keystore.b64
```
No computer? Ask and Codemagic's **Android code signing** UI can generate and
hold the keystore for you instead — then the workflow references it by
reference name rather than the env vars below.

In Codemagic → your app → **Environment variables**, group **`google_play`**
(mark secure):
- `CM_KEYSTORE` = contents of `upload.keystore.b64`
- `CM_KEYSTORE_PASSWORD` = store password
- `CM_KEY_ALIAS` = `foreai`
- `CM_KEY_PASSWORD` = key password

> Keep this keystore safe forever — losing it means you can't update the app
> (unless you enrol in Play App Signing, which is recommended — see step 5).

## 4. Build the AAB
Codemagic → **Start new build** → workflow **`foreai-android-play`**.
It emails you `app-release.aab`, signed with your upload key and stamped with a
versionCode = the Codemagic build number (so every build is uploadable).

## 5. First upload → create a release
Play Console → **Testing → Internal testing → Create new release**:
- Upload the `.aab`.
- When prompted, **let Google Play manage your app signing key** (Play App
  Signing) — recommended; your upload key stays the key you sign with.
- Add release notes, save, and **roll out to Internal testing**.
- Under **Testers**, add your Google account and copy the opt-in link.

Fill in the required **App content** (privacy policy URL, data safety — see
`store/android/data-safety.md`, ads = no, content rating, target audience).
Play won't activate purchases until the app record is complete.

## 6. Create the subscriptions
Play Console → **Monetize → Products → Subscriptions → Create subscription**.
Make two (the app auto-detects them by billing period):

| Product ID            | Billing period | Base plan id |
|-----------------------|----------------|--------------|
| `foreai_pro_monthly`  | Monthly        | `monthly`    |
| `foreai_pro_annual`   | Yearly         | `annual`     |

For each: add a **base plan** (auto-renewing, the period above), set the price
(e.g. ZAR), and **activate** it. (Any product IDs are fine — RevenueCat maps
them; these are just tidy names.)

## 7. Service account (lets RevenueCat + Play talk)
1. Play Console → **Setup → API access** → link/create a Google Cloud project.
2. Create a **service account**, grant it access, and in Play Console give it
   **View financial data** + **Manage orders and subscriptions** (and app
   access to ForeAi).
3. Create a **JSON key** for that service account and download it.

## 8. RevenueCat
https://app.revenuecat.com → your ForeAi project (or create it):
1. **Add app → Google Play**, package `com.foreai.mobile`. Upload the service
   account **JSON** from step 7.
2. **Products** → add `foreai_pro_monthly` and `foreai_pro_annual`.
3. **Entitlements** → create **`pro`** → attach both products.
4. **Offerings** → in the **current** offering add two packages:
   Monthly → `foreai_pro_monthly`, Annual → `foreai_pro_annual`.
   (The paywall reads the current offering and shows both automatically.)
5. **API keys** → copy the **Android** public SDK key (`goog_…`).

## 9. Give the app its key and rebuild
Codemagic → env group **`google_play`** → add:
- `EXPO_PUBLIC_RC_ANDROID_KEY` = `goog_…`

Re-run **`foreai-android-play`**, upload the new `.aab` to Internal testing.
(The key is inlined at build time; without it the app stays in safe "demo
unlock" mode and never charges.)

## 10. Test a real purchase
- Install ForeAi from the **Internal testing opt-in link** on a device signed in
  with a tester account (purchases only work for Play-installed builds).
- Add your account under Play Console → **Setup → License testing** so purchases
  are free sandbox transactions.
- Open **Upgrade** in the app → buy Monthly or Annual → it should unlock `pro`.
  **Restore purchases** should re-unlock on a reinstall.

---

## Notes
- Real charges need a **completed, live** app record; sandbox/license-test buys
  work on internal testing before you go to production.
- To auto-publish future AABs to Internal testing from Codemagic, add a
  `publishing: google_play:` block with the same service-account JSON — ask and
  I'll wire it in.
- iOS is the parallel setup (App Store Connect + `EXPO_PUBLIC_RC_IOS_KEY`,
  `appl_…`) using the `foreai-ios` workflow.
