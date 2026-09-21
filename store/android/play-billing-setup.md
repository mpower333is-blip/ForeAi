# Android on Google Play — subscriptions setup (store-direct)

Get ForeAi onto Google Play and turn on real subscriptions (Monthly + Annual)
using **Google Play Billing directly** — no third-party billing service. The app
uses `expo-iap` (OpenIAP / Play Billing 8), so "am I Pro?" comes straight from
Play's own report of the device's active subscriptions. The app code is already
wired — you only do the store/CI setup below.

- **Package:** `com.foreai.mobile`
- **Products (must match exactly):** `foreai_pro_monthly`, `foreai_pro_annual`
- **App reads:** `EXPO_PUBLIC_IAP_LIVE=1` (turns billing on; already set in the
  `foreai-android-play` Codemagic workflow)

> Product IDs matter: the app fetches these exact SKUs from Play. Use the names
> above verbatim — there is no mapping layer to rename them.

Order matters: Play app + a signed upload → create products → test. Do it top to
bottom.

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
It produces `ForeAi-Phone-<build>.aab`, signed with your upload key and stamped
with a versionCode = the Codemagic build number (so every build is uploadable).
`EXPO_PUBLIC_IAP_LIVE=1` is already set in that workflow, so billing is live.

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
(Monthly R99 · Annual R799 in ZAR), and **activate** it.

### 7-day free trial (optional but recommended)
On each subscription, add an **Offer** on top of the base plan:
- Offer id e.g. `free-trial-7d`
- Eligibility: **New customer acquisition**
- First phase: **Free**, 1 week → then the base plan price.
- **Activate** the offer.

The app reads the trial live from the offer's free pricing phase and shows
"Start with a 7-day free trial" on the paywall automatically.

## 7. Build must be Play-delivered to test billing
Google Play Billing only works for a build installed **from Play** (signed with
the Play/upload key), not a sideloaded debug APK. So always test via the
Internal testing opt-in link.

## 8. Test a real purchase (free in test)
- Install ForeAi from the **Internal testing opt-in link** on a device signed in
  with a tester account.
- Add your account under Play Console → **Setup → License testing** so purchases
  are free sandbox transactions (real purchase flow, no charge; trial/renewal
  run on accelerated test timers).
- Open **Upgrade** in the app → both plans show with live prices and the trial
  label → buy Monthly or Annual → the app flips to Pro.
  **Restore purchases** should re-unlock on a reinstall.

---

## Notes
- Entitlement is **client-side**: the app asks Play `hasActiveSubscriptions`
  on-device — no backend, no third-party service. Good enough to ship; add
  server-side validation via the Play Developer API later if revenue justifies it.
- Real charges need a **completed, live** app record; sandbox/license-test buys
  work on internal testing before you go to production.
- To auto-publish future AABs to Internal testing from Codemagic, add a
  `publishing: google_play:` block with a service-account JSON (Play Console →
  **Setup → API access**) — ask and I'll wire it in. (This is only for
  auto-publishing uploads; it is **not** needed for billing/entitlement.)
- iOS is the parallel setup — see `store/ios/ios-billing-setup.md`.
