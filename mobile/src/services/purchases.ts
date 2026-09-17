// Native in-app subscriptions via react-native-iap (iOS StoreKit + Google Play
// Billing). No third-party billing service — Apple/Google are the only
// middlemen. Thin, crash-safe layer so the rest of the app deals in a tiny
// interface (packages + purchase + restore + "am I Pro?").
//
// Client-side entitlement: "am I Pro?" is derived from the store's own list of
// this device's active purchases (getAvailablePurchases) — no backend needed.
// Trade-off: a determined user on a modified device could fake it. When revenue
// justifies it, add server-side receipt validation (e.g. a Firebase Function) or
// bring RevenueCat back — the app-facing interface below stays identical.
//
// Everything fails soft: if billing isn't live (EXPO_PUBLIC_IAP_LIVE unset) or
// the native module is absent, calls resolve to "not Pro / no packages" and the
// caller falls back to the local demo unlock. The web build never sees this file
// — Metro resolves purchases.web.ts there.
import { Platform } from "react-native";
import { PURCHASES_CONFIGURED, SUBSCRIPTION_SKUS } from "../config/purchases";

export type SubPeriod = "monthly" | "annual" | "other";

export type SubPackage = {
  id: string; // the store product id (SKU)
  period: SubPeriod;
  title: string; // product title from the store
  priceString: string; // localized, e.g. "R99.00"
  trial?: string; // e.g. "7-day free trial", read live from the store product
  raw: unknown; // { sku, offerToken? } — passed back to purchasePackage
};

export const purchasesConfigured = PURCHASES_CONFIGURED;

let IAP: any = null;
let started = false;
let proNow = false;
const proCbs = new Set<(p: boolean) => void>();
let pending: ((ok: boolean) => void) | null = null;

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

function notify(pro: boolean) {
  proNow = pro;
  proCbs.forEach((cb) => cb(pro));
}

export async function initPurchases(): Promise<void> {
  if (!PURCHASES_CONFIGURED || started) return;
  const P = load();
  if (!P) return;
  try {
    await P.initConnection();
    // A completed/renewed purchase arrives here (also on next launch for pending
    // ones). Acknowledge it (Android auto-refunds unacknowledged buys after 3
    // days) and mark the user Pro.
    P.purchaseUpdatedListener(async (purchase: any) => {
      try {
        await P.finishTransaction({ purchase, isConsumable: false });
      } catch {
        /* ignore — retried next launch */
      }
      notify(true);
      if (pending) {
        pending(true);
        pending = null;
      }
    });
    P.purchaseErrorListener((_e: any) => {
      // Cancellation or failure — resolve any in-flight purchase to the current
      // (unchanged) state rather than throwing.
      if (pending) {
        pending(proNow);
        pending = null;
      }
    });
    started = true;
  } catch {
    started = false;
  }
}

function periodOf(sku: string): SubPeriod {
  const s = sku.toLowerCase();
  if (s.includes("month")) return "monthly";
  if (s.includes("annual") || s.includes("year")) return "annual";
  return "other";
}

function trialLabel(n: number, unit: string): string {
  if (!n || !unit) return "Free trial";
  const u = unit.startsWith("day") ? "day" : unit.startsWith("week") ? "week" : unit.startsWith("month") ? "month" : "year";
  return `${n}-${u} free trial`;
}

// "P1W" / "P7D" / "P1M" → "1-week free trial" etc.
function trialFromIso(iso?: string): string | undefined {
  if (!iso) return "Free trial";
  const m = /P(\d+)([DWMY])/.exec(String(iso).toUpperCase());
  if (!m) return "Free trial";
  const unit = ({ D: "day", W: "week", M: "month", Y: "year" } as Record<string, string>)[m[2]] ?? "day";
  return trialLabel(Number(m[1]), unit);
}

function androidBits(sub: any): { price: string; trial?: string; offerToken?: string } {
  const offers: any[] = sub?.subscriptionOfferDetails ?? [];
  // Prefer an offer that grants a free trial (a phase priced at 0), else the base.
  const withTrial = offers.find((o) =>
    (o?.pricingPhases?.pricingPhaseList ?? []).some((p: any) => Number(p?.priceAmountMicros) === 0),
  );
  const offer = withTrial ?? offers[0];
  const phases: any[] = offer?.pricingPhases?.pricingPhaseList ?? [];
  const paid = phases.find((p) => Number(p?.priceAmountMicros) > 0);
  const free = phases.find((p) => Number(p?.priceAmountMicros) === 0);
  return {
    price: String(paid?.formattedPrice ?? sub?.localizedPrice ?? ""),
    trial: free ? trialFromIso(free?.billingPeriod) : undefined,
    offerToken: offer?.offerToken,
  };
}

function iosBits(sub: any): { price: string; trial?: string } {
  const introFree =
    sub?.introductoryPrice != null &&
    (Number(sub?.introductoryPriceAsAmountIOS ?? NaN) === 0 ||
      String(sub?.introductoryPricePaymentModeIOS ?? "").toUpperCase().includes("FREETRIAL"));
  const n = Number(sub?.introductoryPriceNumberOfPeriodsIOS ?? 0) || 0;
  const unit = String(sub?.introductoryPriceSubscriptionPeriodIOS ?? "").toLowerCase(); // day/week/month/year
  return {
    price: String(sub?.localizedPrice ?? ""),
    trial: introFree ? trialLabel(n, unit) : undefined,
  };
}

function mapSub(sub: any): SubPackage {
  const sku = String(sub?.productId ?? "");
  const bits: any = Platform.OS === "android" ? androidBits(sub) : iosBits(sub);
  return {
    id: sku,
    period: periodOf(sku),
    title: String(sub?.title ?? sub?.name ?? ""),
    priceString: String(bits.price ?? ""),
    trial: bits.trial,
    raw: { sku, offerToken: bits.offerToken },
  };
}

export async function getPackages(): Promise<SubPackage[]> {
  const P = load();
  if (!P || !PURCHASES_CONFIGURED) return [];
  try {
    await initPurchases();
    const subs: any[] = await P.getSubscriptions({ skus: SUBSCRIPTION_SKUS });
    const order: Record<SubPeriod, number> = { monthly: 0, annual: 1, other: 2 };
    return subs.map(mapSub).sort((a, b) => order[a.period] - order[b.period]);
  } catch {
    return [];
  }
}

// Buy a package. Returns true if the user is Pro afterwards. A cancellation
// resolves to the current (unchanged) state rather than throwing.
export async function purchasePackage(raw: unknown): Promise<boolean> {
  const P = load();
  if (!P || !PURCHASES_CONFIGURED) return false;
  await initPurchases();
  const info = (raw ?? {}) as { sku?: string; offerToken?: string };
  const sku = info.sku;
  if (!sku) return false;
  return new Promise<boolean>((resolve) => {
    pending = resolve;
    const params =
      Platform.OS === "android" && info.offerToken
        ? { sku, subscriptionOffers: [{ sku, offerToken: info.offerToken }] }
        : { sku };
    Promise.resolve(P.requestSubscription(params)).catch(() => {
      if (pending) {
        pending(proNow);
        pending = null;
      }
    });
  });
}

// True if the store reports this device owns an active ForeAi Pro subscription.
async function hasActiveSub(): Promise<boolean> {
  const P = load();
  if (!P || !PURCHASES_CONFIGURED) return false;
  try {
    await initPurchases();
    const purchases: any[] = await P.getAvailablePurchases();
    const active = purchases.some((p) => SUBSCRIPTION_SKUS.includes(String(p?.productId)));
    notify(active);
    return active;
  } catch {
    return false;
  }
}

export async function restorePurchases(): Promise<boolean> {
  return hasActiveSub();
}

export async function currentIsPro(): Promise<boolean> {
  return hasActiveSub();
}

// Subscribe to entitlement changes (a purchase completing / renewing). Returns
// an unsubscribe function. (Lapses are re-checked on next launch via currentIsPro.)
export function addProListener(cb: (pro: boolean) => void): () => void {
  proCbs.add(cb);
  return () => {
    proCbs.delete(cb);
  };
}
