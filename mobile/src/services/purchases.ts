// Direct store billing (native: iOS StoreKit + Android Google Play Billing).
//
// Thin, crash-safe layer over react-native-iap so the rest of the app deals in a
// tiny interface (packages + purchase + restore + "am I Pro?"). This replaces the
// old RevenueCat wrapper — same interface, no third-party service. Everything
// fails soft: if billing isn't enabled or the native module isn't present, calls
// resolve to "not Pro / no packages" and the caller falls back to the local demo
// unlock.
//
// The web build never sees this file — Metro resolves purchases.web.ts there, so
// react-native-iap (native-only) is never bundled for web.
//
// Entitlement is read directly from the store's active purchases (no server-side
// receipt validation), which is the same client-side trust model the app used
// before. The store's 7-day free trial shows up here as an active subscription.
import {
  PURCHASES_CONFIGURED,
  SUBSCRIPTION_SKUS,
  SKU_MONTHLY,
  SKU_ANNUAL,
} from "../config/purchases";

export type SubPeriod = "monthly" | "annual" | "other";

export type SubPackage = {
  id: string; // product id (SKU)
  period: SubPeriod;
  title: string; // product title from the store
  priceString: string; // localized, e.g. "R99.00" / "$4.99"
  raw: unknown; // the store subscription object, passed back to purchasePackage
};

export const purchasesConfigured = PURCHASES_CONFIGURED;

// Loaded lazily so a missing/older native module can never crash startup.
let IAP: any = null;
let connected = false;
// Listeners registered with the native module, torn down on end.
let purchaseUpdateSub: any = null;
let purchaseErrorSub: any = null;
// App-side "am I Pro?" subscribers, notified when the entitlement changes.
const proListeners = new Set<(pro: boolean) => void>();

function load(): any {
  if (IAP) return IAP;
  try {
    // Literal require so Metro bundles the native module on device.
    IAP = require("react-native-iap");
  } catch {
    IAP = null;
  }
  return IAP;
}

function notifyPro(pro: boolean) {
  proListeners.forEach((cb) => {
    try {
      cb(pro);
    } catch {
      /* ignore */
    }
  });
}

export async function initPurchases(): Promise<void> {
  if (!PURCHASES_CONFIGURED || connected) return;
  const P = load();
  if (!P) return;
  try {
    await P.initConnection();
    connected = true;
  } catch {
    connected = false;
    return;
  }
  // A purchase can complete asynchronously (Play "pending", trial start,
  // renewal, cross-device). Finish the transaction and refresh the entitlement.
  try {
    purchaseUpdateSub = P.purchaseUpdatedListener(async (purchase: any) => {
      try {
        await P.finishTransaction({ purchase, isConsumable: false });
      } catch {
        /* ignore — will be retried on next launch */
      }
      notifyPro(await currentIsPro());
    });
    purchaseErrorSub = P.purchaseErrorListener((_e: any) => {
      // User cancellation and store errors surface via the purchase() promise;
      // nothing to do here beyond not crashing.
    });
  } catch {
    /* listeners are best-effort */
  }
}

// Tear down the store connection + listeners (e.g. on sign-out). Optional.
export async function endPurchases(): Promise<void> {
  const P = load();
  try {
    purchaseUpdateSub?.remove?.();
    purchaseErrorSub?.remove?.();
  } catch {
    /* ignore */
  }
  purchaseUpdateSub = null;
  purchaseErrorSub = null;
  if (P && connected) {
    try {
      await P.endConnection();
    } catch {
      /* ignore */
    }
  }
  connected = false;
}

function periodOf(productId: string): SubPeriod {
  if (productId === SKU_MONTHLY) return "monthly";
  if (productId === SKU_ANNUAL) return "annual";
  return "other";
}

// The recurring (not the free-trial) price, localized, from either store shape.
function priceOf(sub: any): string {
  // iOS (StoreKit): localizedPrice, e.g. "R99.00".
  if (sub?.localizedPrice) return String(sub.localizedPrice);
  // Android (Play Billing): the last pricing phase of the first offer is the
  // recurring charge (earlier phases are the free trial / intro price).
  const offers = sub?.subscriptionOfferDetails ?? [];
  const phases = offers[0]?.pricingPhases?.pricingPhaseList ?? [];
  const recurring = phases[phases.length - 1];
  if (recurring?.formattedPrice) return String(recurring.formattedPrice);
  return "";
}

function mapSub(sub: any): SubPackage {
  const id = String(sub?.productId ?? "");
  return {
    id,
    period: periodOf(id),
    title: String(sub?.title ?? sub?.name ?? ""),
    priceString: priceOf(sub),
    raw: sub,
  };
}

// Available subscription packages (monthly / annual) from the store.
export async function getPackages(): Promise<SubPackage[]> {
  const P = load();
  if (!P || !connected) return [];
  try {
    const subs: any[] = await P.getSubscriptions({ skus: SUBSCRIPTION_SKUS });
    const order: Record<SubPeriod, number> = { monthly: 0, annual: 1, other: 2 };
    return subs
      .map(mapSub)
      .sort((a, b) => order[a.period] - order[b.period]);
  } catch {
    return [];
  }
}

// Buy a subscription. Returns true if the user is Pro afterwards. Throws only on
// a genuine error; a user cancellation resolves to the current (unchanged) state.
export async function purchasePackage(raw: unknown): Promise<boolean> {
  const P = load();
  if (!P || !connected) return false;
  const sub: any = raw;
  const sku = String(sub?.productId ?? "");
  if (!sku) throw new Error("Plans are still loading from the store — please try again in a moment.");
  try {
    // Android requires the offer token; iOS ignores it.
    const offerToken = sub?.subscriptionOfferDetails?.[0]?.offerToken;
    await P.requestSubscription({
      sku,
      ...(offerToken
        ? { subscriptionOffers: [{ sku, offerToken }] }
        : {}),
    });
    // The purchaseUpdatedListener finishes the transaction; confirm entitlement.
    return await currentIsPro();
  } catch (e: any) {
    // react-native-iap raises E_USER_CANCELLED when the buyer backs out.
    if (e?.code === "E_USER_CANCELLED") return currentIsPro();
    throw e;
  }
}

// Any active (non-expired) purchase for one of our subscription SKUs.
async function hasActiveSub(): Promise<boolean> {
  const P = load();
  if (!P || !connected) return false;
  try {
    const purchases: any[] = await P.getAvailablePurchases();
    return purchases.some((p) => SUBSCRIPTION_SKUS.includes(String(p?.productId ?? "")));
  } catch {
    return false;
  }
}

export async function restorePurchases(): Promise<boolean> {
  const restored = await hasActiveSub();
  if (restored) notifyPro(true);
  return restored;
}

export async function currentIsPro(): Promise<boolean> {
  return hasActiveSub();
}

// Subscribe to entitlement changes (renewals, lapses, cross-device). Returns an
// unsubscribe function.
export function addProListener(cb: (pro: boolean) => void): () => void {
  proListeners.add(cb);
  return () => {
    proListeners.delete(cb);
  };
}
