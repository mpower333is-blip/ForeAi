# ForeAi — iOS setup (build + subscriptions, store-direct)

Get ForeAi onto TestFlight/App Store and turn on real subscriptions on iOS using
**StoreKit directly** — no third-party billing service. The app uses `expo-iap`
(OpenIAP / StoreKit), so "am I Pro?" comes straight from the store's report of
the device's active subscriptions. The **build pipeline is already done**
(Codemagic `foreai-ios`); iOS just needs its own App Store products created.

You do **not** need a Mac — Codemagic builds on a Mac for you. Everything below
is done from a browser / your phone.

> iOS ships paywall-OFF by default (App-Review-safe). Turn the iOS paywall on
> only once your products are **Ready to Submit** by building with
> `EXPO_PUBLIC_IOS_IAP=1` (see `mobile/src/config/appConfig.ts`).

## The names (must match — the app fetches these exact product IDs)
- **Products (App Store, auto-renewable):** `foreai_pro_monthly`, `foreai_pro_annual`
- **Prices:** Monthly ≈ R99, Annual ≈ R799 (pick the closest App Store tier)

---

## 1. App Store Connect — one-time account bits
These gate whether a purchase is even possible; without them the paywall loads
but nothing charges.

1. **Business → Agreements**: sign the **Paid Applications** agreement and fill
   in **banking + tax**. Until this is "Active", subscriptions can't be bought.
2. Confirm the app record exists with bundle id **`com.foreai.mobile`**.

> Worth doing: enrol in the **Apple Small Business Program** (App Store Connect →
> Agreements) to drop Apple's cut from 30% to **15%** while you're under
> US$1M/year.

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

### 7-day free trial (optional)
On each subscription, add an **Introductory Offer** → **Free**, 1 week, for new
subscribers. The app reads the trial live and shows the "7-day free trial" label
on the paywall automatically.

## 3. Turn the iOS paywall on in the build
Codemagic → your app → **Environment variables** → group **`ios_signing`**:

- `EXPO_PUBLIC_IOS_IAP = 1`  (turns the iOS paywall on)
- `EXPO_PUBLIC_IAP_LIVE = 1` (turns real billing on)

Leave both unset for an App-Review-safe build that ships fully unlocked with no
paywall. Set them only once the products above are **Ready to Submit** and you
want to sandbox-test or go live.

## 4. Build → TestFlight
Codemagic → **Start new build → `foreai-ios`**. It will:
- `expo prebuild` the iOS project, install Pods, sign with your persistent
  distribution cert (via the **ForeAi ASC** integration + `IOS_DIST_KEY`),
- build a signed `.ipa`, and **upload to TestFlight**.

Then in TestFlight (on your iPhone), install the build.

## 5. Test the purchase (sandbox)
1. On the iPhone: **Settings → App Store → Sandbox Account** → sign in with a
   **Sandbox Apple ID** (App Store Connect → Users and Access → Sandbox).
2. Open **Upgrade** in the app → both plans show with live prices → buy Monthly
   or Annual → the app flips to Pro.
3. **Restore purchases** should re-unlock on a reinstall.

---

## Quick troubleshooting
- **Paywall doesn't appear on iOS** → the build didn't have `EXPO_PUBLIC_IOS_IAP=1`;
  add it (step 3) and rebuild.
- **"Plans aren't showing"** → the App Store subscriptions aren't "Ready to
  Submit" yet, or the Paid Apps agreement isn't Active.
- **Buys but doesn't unlock** → the product IDs in App Store Connect don't match
  `foreai_pro_monthly` / `foreai_pro_annual` exactly.
- **Build fails signing** → the `ForeAi ASC` integration name in `codemagic.yaml`
  must match the Codemagic App Store Connect integration exactly, and
  `IOS_DIST_KEY` (base64 PKCS#8 private key) must be in the `ios_signing` group.
