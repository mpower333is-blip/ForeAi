// RevenueCat wrapper (native: iOS + Android).
//
// Thin, crash-safe layer over react-native-purchases so the rest of the app
// deals in a tiny interface (packages + purchase + restore + "am I Pro?").
// Everything fails soft: if RevenueCat isn't configured or the native module
// isn't present, calls resolve to "not Pro / no packages" and the caller falls
// back to the local demo unlock.
//
// The web build never sees this file — Metro resolves purchases.web.ts there,
// so react-native-purchases (native-only) is never bundled for web.
import { RC_API_KEY, RC_OFFERING, RC_ENTITLEMENT, PURCHASES_CONFIGURED } from "../config/purchases";

export type SubPeriod = "monthly" | "annual" | "other";

export type SubPackage = {
  id: string; // RevenueCat package identifier
  period: SubPeriod;
  title: string; // product title from the store
  priceString: string; // localized, e.g. "R99.00" / "$4.99"
  raw: unknown; // the RevenueCat package, passed back to purchasePackage
};

export const purchasesConfigured = PURCHASES_CONFIGURED;

// Loaded lazily so a missing/older native module can never crash startup.
let Purchases: any = null;
let configured = false;

function load(): any {
  if (Purchases) return Purchases;
  try {
    // Literal require so Metro bundles the native module on device.
    Purchases = require("react-native-purchases").default;
  } catch {
    Purchases = null;
  }
  return Purchases;
}

export async function initPurchases(): Promise<void> {
  if (!PURCHASES_CONFIGURED || configured) return;
  const P = load();
  if (!P) return;
  try {
    P.configure({ apiKey: RC_API_KEY });
    configured = true;
  } catch {
    configured = false;
  }
}

function periodOf(pkg: any): SubPeriod {
  const t = String(pkg?.packageType || "").toUpperCase();
  if (t === "MONTHLY") return "monthly";
  if (t === "ANNUAL") return "annual";
  return "other";
}

function mapPackage(pkg: any): SubPackage {
  return {
    id: String(pkg?.identifier ?? ""),
    period: periodOf(pkg),
    title: String(pkg?.product?.title ?? ""),
    priceString: String(pkg?.product?.priceString ?? ""),
    raw: pkg,
  };
}

// Available subscription packages (monthly / annual) from the current offering.
export async function getPackages(): Promise<SubPackage[]> {
  const P = load();
  if (!P || !configured) return [];
  try {
    const offerings = await P.getOfferings();
    const offering = RC_OFFERING ? offerings?.all?.[RC_OFFERING] : offerings?.current;
    const list: any[] = offering?.availablePackages ?? [];
    // Sort so annual sits under monthly (nice default order on the paywall).
    const order: Record<SubPeriod, number> = { monthly: 0, annual: 1, other: 2 };
    return list.map(mapPackage).sort((a, b) => order[a.period] - order[b.period]);
  } catch {
    return [];
  }
}

function entitlementActive(info: any): boolean {
  return !!info?.entitlements?.active?.[RC_ENTITLEMENT];
}

// Buy a package. Returns true if the user is Pro afterwards. Throws only on a
// genuine error; a user cancellation resolves to the current (unchanged) state.
export async function purchasePackage(raw: unknown): Promise<boolean> {
  const P = load();
  if (!P || !configured) return false;
  try {
    const { customerInfo } = await P.purchasePackage(raw);
    return entitlementActive(customerInfo);
  } catch (e: any) {
    if (e?.userCancelled) return currentIsPro();
    throw e;
  }
}

export async function restorePurchases(): Promise<boolean> {
  const P = load();
  if (!P || !configured) return false;
  try {
    const info = await P.restorePurchases();
    return entitlementActive(info);
  } catch {
    return false;
  }
}

export async function currentIsPro(): Promise<boolean> {
  const P = load();
  if (!P || !configured) return false;
  try {
    return entitlementActive(await P.getCustomerInfo());
  } catch {
    return false;
  }
}

// Subscribe to entitlement changes (renewals, lapses, cross-device). Returns an
// unsubscribe function.
export function addProListener(cb: (pro: boolean) => void): () => void {
  const P = load();
  if (!P || !configured) return () => {};
  const handler = (info: any) => cb(entitlementActive(info));
  try {
    P.addCustomerInfoUpdateListener(handler);
    return () => {
      try {
        P.removeCustomerInfoUpdateListener(handler);
      } catch {
        /* ignore */
      }
    };
  } catch {
    return () => {};
  }
}
