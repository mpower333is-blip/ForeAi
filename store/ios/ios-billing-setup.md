# App Store — subscriptions setup (direct StoreKit)

ForeAi Pro on iOS uses **direct Apple StoreKit** (via `react-native-iap`) — no
RevenueCat. The app fetches products, starts the purchase, and reads the active
subscription from StoreKit.

> **iOS billing is currently OFF.** `mobile/src/config/appConfig.ts` sets
> `IAP_ENABLED = Platform.OS !== "ios"`, so the iOS build ships fully unlocked with
> no paywall (nothing for App Review to reject under Guideline 3.1.2). Do the steps
> below only when you decide to turn iOS paid on.

## 1. Create the subscriptions (once)

App Store Connect → your app → **Subscriptions** → create a subscription group
(e.g. "ForeAi Pro"), then add **two** subscriptions with these exact product ids
(must match `mobile/src/config/purchases.ts`):

| Product id | Duration | Price (example) |
|---|---|---|
| `foreai_pro_monthly` | 1 month | R99 / month |
| `foreai_pro_annual`  | 1 year  | R799 / year |

On each subscription add an **Introductory Offer → Free trial, 7 days**. Fill in
the localizations, review screenshot and review notes so the products reach
**Ready to Submit** (products must be approved with the build).

## 2. Turn iOS billing on

1. In `appConfig.ts`, change `IAP_ENABLED` so it is `true` on iOS as well (e.g.
   `export const IAP_ENABLED = true;`).
2. Add the **In-App Purchase** capability to the iOS app (StoreKit). In this Expo
   project that means the paid-app / IAP entitlement is present when signing — set
   it up in the Apple Developer portal for `com.foreai.mobile`.
3. Set `EXPO_PUBLIC_BILLING: "1"` in the `foreai-ios` workflow (`codemagic.yaml`).

## 3. Testing

- Create a **Sandbox tester** in App Store Connect → Users and Access.
- Sign into that sandbox account on the device (Settings → App Store → Sandbox).
- Open the paywall: both plans load with local prices; buying starts the 7-day
  trial and unlocks Pro; **Restore** re-detects it.

## Notes

- Entitlement is read client-side from StoreKit's active purchases (no server
  receipt validation) — the same trust model used before.
- The paywall already shows the mandatory auto-renew disclosure + Terms/Privacy
  links (`UpgradeScreen.tsx`), required by App Review for subscriptions.
