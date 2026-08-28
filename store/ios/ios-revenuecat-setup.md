# ForeAi — iOS setup (build + subscriptions)

Get ForeAi onto TestFlight/App Store and turn on real subscriptions on iOS.
The **build pipeline is already done** (Codemagic `foreai-ios`), and the app
shares the **same RevenueCat entitlement as Android: `foreai_pro`**. iOS just
needs its own App Store products mapped to that entitlement, and the iOS
RevenueCat key in the build.

You do **not** need a Mac — Codemagic builds on a Mac for you. Everything below
is done from a browser / your phone.

## The names (must match, iOS + Android share the entitlement)
- **Entitlement (RevenueCat):** `foreai_pro`  ← same one Android uses
- **Products (App Store, auto-renewable):** `foreai_pro_monthly`, `foreai_pro_annual`
- **Prices:** Monthly ≈ R99, Annual ≈ R799 (pick the closest App Store tier)

---

## 1. App Store Connect — one-time account bits
These gate whether a purchase is even possible; without them the paywall loads
but nothing charges.

1. **Business → Agreements**: sign the **Paid Applications** agreement and fill
   in **banking + tax**. Until this is "Active", subscriptions can't be bought.
2. Confirm the app record exists with bundle id **`com.foreai.mobile`**.

## 2. App Store Connect — create the subscriptions
Your app → **Monetization → Subscriptions**.

1. Create a **Subscription Group** (e.g. "ForeAi Pro").
2. Add two auto-renewable subscriptions **in that group**:

   | Reference name  | Product ID            | Duration |
   | --------------- | --------------------- | -------- |
   | ForeAi Pro Monthly | `foreai_pro_monthly` | 1 month  |
   | ForeAi Pro Annual  | `foreai_pro_annual`  | 1 year   |

3. For each: set a **price**, add a **localized display name + description**,
   and upload the **review screenshot** (`store/ios/subscription-review-*.png`).
4. Each subscription should reach **"Ready to Submit"** (a yellow "Missing
   Metadata" means it won't appear yet — fill the gaps).

## 3. RevenueCat — map the iOS products
RevenueCat dashboard → your **ForeAi** project.

1. **Apps** → add/confirm the **App Store** app (bundle `com.foreai.mobile`).
   Give RevenueCat access to receipts via either:
   - the **App Store Connect API key** (recommended), or
   - the **app-specific shared secret** (App Store Connect → your app →
     App Information → Manage/Generate the shared secret).
2. **Products** → add `foreai_pro_monthly` and `foreai_pro_annual` (App Store).
3. **Entitlements** → open **`foreai_pro`** → attach **both** iOS products
   (it already has the two Android ones).
4. **Offerings** → in the **current** offering, the existing **Monthly** and
   **Annual** packages should now list the iOS product alongside the Android
   one (a package can hold one product per store). The paywall reads the current
   offering, so no app change is needed.
5. **API keys** → copy the **iOS** public key — it starts with **`appl_`**.

## 4. Codemagic — add the iOS RevenueCat key
Codemagic → your app → **Environment variables** → group **`ios_signing`**:

- `EXPO_PUBLIC_RC_IOS_KEY = appl_XXXXXXXX`  (mark **Secure**)

Without this the iOS build runs in "demo unlock" mode (paywall works but nothing
charges). It's read in `mobile/src/config/purchases.ts`.

## 5. Build → TestFlight
Codemagic → **Start new build → `foreai-ios`**. It will:
- `expo prebuild` the iOS project, install Pods, sign with your persistent
  distribution cert (via the **ForeAi ASC** integration + `IOS_DIST_KEY`),
- build a signed `.ipa`, and **upload to TestFlight**.

Then in TestFlight (on your iPhone), install the build.

## 6. Test the purchase (sandbox)
1. On the iPhone: **Settings → App Store → Sandbox Account** → sign in with a
   **Sandbox Apple ID** (App Store Connect → Users and Access → Sandbox).
2. Open **Upgrade** in the app → buy Monthly or Annual → it should unlock the
   **`foreai_pro`** entitlement and flip the app to Pro.
3. In RevenueCat → **Customers**, you should see the purchase as **Active**.

---

## Quick troubleshooting
- **Paywall says "DEMO"** → `EXPO_PUBLIC_RC_IOS_KEY` wasn't in the build; add it
  (step 4) and rebuild.
- **"Plans aren't showing"** → the App Store subscriptions aren't "Ready to
  Submit" yet, or the Paid Apps agreement isn't Active, or RevenueCat can't
  read receipts (shared secret / API key missing).
- **Buys but doesn't unlock** → the iOS products aren't attached to the
  `foreai_pro` entitlement (step 3.3).
- **Build fails signing** → the `ForeAi ASC` integration name in `codemagic.yaml`
  must match the Codemagic App Store Connect integration exactly, and
  `IOS_DIST_KEY` (base64 PKCS#8 private key) must be in the `ios_signing` group.
