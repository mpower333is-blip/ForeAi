# Google Play — subscriptions setup (direct Play Billing)

ForeAi Pro uses **direct Google Play Billing** (via `react-native-iap`) — there is
no RevenueCat or other middleman. The app fetches the products, starts the
purchase, and reads the active subscription straight from Play.

## 1. Create the subscriptions (once)

Play Console → **Monetize → Products → Subscriptions → Create subscription**.
Create **two**, with these exact product ids (they must match the app —
`mobile/src/config/purchases.ts`):

| Product id | Name | Base plan | Price (example) |
|---|---|---|---|
| `foreai_pro_monthly` | ForeAi Pro (Monthly) | auto-renewing, 1 month | R99 / month |
| `foreai_pro_annual`  | ForeAi Pro (Annual)  | auto-renewing, 1 year  | R799 / year |

For each subscription:
1. Add a **base plan** (auto-renewing) with the billing period above and set the
   price. **Activate** the base plan — a draft plan is not returned to the app.
2. Add an **offer** on the base plan of type **Free trial**, length **7 days**.
   Activate it. This is what gives every new subscriber the 7-day trial; Play
   runs the trial-then-charge automatically.

## 2. Enable live billing in the build

The app ships in safe **demo-unlock** mode until you turn billing on. In the
`foreai-android-play` workflow (`codemagic.yaml`) set:

```
EXPO_PUBLIC_BILLING: "1"
```

Without it, the paywall still works end-to-end for testing but nothing is charged.

## 3. Testing

- Add testers under **Setup → License testing** (their purchases aren't charged).
- Install a build from an **Internal testing** track (Play Billing only works for
  apps installed via Play, not a sideloaded APK).
- Open the paywall: the two plans should load with their local prices; buying one
  should start the 7-day trial and unlock Pro; **Restore** should re-detect it.

## Notes

- Entitlement is read client-side from Play's active purchases (no server receipt
  validation) — same trust model the app used before.
- The Play Billing library and `com.android.vending.BILLING` permission are added
  automatically by `react-native-iap` autolinking; the R8 keep-rules for it are in
  `mobile/app.config.js`.
