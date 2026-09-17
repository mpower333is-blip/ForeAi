// Native in-app subscriptions via expo-iap (the Expo-native OpenIAP library —
// iOS StoreKit + Google Play Billing 8, no third-party billing service). Apple/
// Google are the only middlemen. Thin, crash-safe layer so the rest of the app
// deals in a tiny interface (packages + purchase + restore + "am I Pro?").
//
// Client-side entitlement: "am I Pro?" comes from the store's own report of the
// device's active subscriptions (hasActiveSubscriptions) — no backend. Trade-off:
// a determined user on a modified device could fake it. When revenue justifies
// it, add server-side receipt validation or bring RevenueCat back behind the
// same interface.
//
// Fails soft: if billing isn't live (EXPO_PUBLIC_IAP_LIVE unset) or the native
// module is absent, calls resolve to "not Pro / no packages" and the caller
// falls back to the local demo unlock. The web build resolves purchases.web.ts.
import { Platform } from "react-native";
import { PURCHASES_CONFIGURED, SUBSCRIPTION_SKUS } from "../config/purchases";

export type SubPeriod = "monthly" | "annual" | "other";

export type SubPackage = {
  id: string; // the store product id (SKU)
  period: SubPeriod;
  title: string;
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
    IAP = require("expo-iap");
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
    // ones). Finish it (Android auto-refunds unacknowledged buys) and mark Pro.
    P.purchaseUpdatedListener(async (purchase: any) => {
      try {
        await P.finishTransaction({ purchase, isConsumable: false });
      } catch {
        /* retried next launch */
      }
      notify(true);
      if (pending) {
        pending(true);
        pending = null;
      }
    });
    P.purchaseErrorListener((_e: any) => {
      // Cancellation / failure — resolve the in-flight purchase to the current
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
function trialFromIso(iso?: string | null): string | undefined {
  if (!iso) return "Free trial";
  const m = /P(\d+)([DWMY])/.exec(String(iso).toUpperCase());
  if (!m) return "Free trial";
  const unit = ({ D: "day", W: "week", M: "month", Y: "year" } as Record<string, string>)[m[2]] ?? "day";
  return trialLabel(Number(m[1]), unit);
}

// An offer grants a free trial when its payment mode says so, or a pricing phase
// is priced at zero.
function isFreeOffer(o: any): boolean {
  if (o?.paymentMode === "free-trial") return true;
  const phases: any[] = o?.pricingPhasesAndroid?.pricingPhaseList ?? [];
  return phases.some((ph) => Number(ph?.priceAmountMicros) === 0);
}

function mapProduct(p: any): SubPackage {
  const id = String(p?.id ?? "");
  const offers: any[] = Array.isArray(p?.subscriptionOffers) ? p.subscriptionOffers : [];
  // Prefer an offer that includes the free trial so buyers actually get it.
  const offer = offers.find(isFreeOffer) ?? offers[0];
  let trial: string | undefined;
  if (offer && isFreeOffer(offer)) {
    const freePhase = (offer?.pricingPhasesAndroid?.pricingPhaseList ?? []).find(
      (ph: any) => Number(ph?.priceAmountMicros) === 0,
    );
    trial = trialFromIso(freePhase?.billingPeriod);
  }
  return {
    id,
    period: periodOf(id),
    title: String(p?.title ?? p?.displayName ?? ""),
    priceString: String(p?.displayPrice ?? ""),
    trial,
    raw: { sku: id, offerToken: offer?.offerTokenAndroid ?? undefined },
  };
}

export async function getPackages(): Promise<SubPackage[]> {
  const P = load();
  if (!P || !PURCHASES_CONFIGURED) return [];
  try {
    await initPurchases();
    const products: any[] = (await P.fetchProducts({ skus: SUBSCRIPTION_SKUS, type: "subs" })) ?? [];
    const order: Record<SubPeriod, number> = { monthly: 0, annual: 1, other: 2 };
    return products.map(mapProduct).sort((a, b) => order[a.period] - order[b.period]);
  } catch {
    return [];
  }
}

export async function purchasePackage(raw: unknown): Promise<boolean> {
  const P = load();
  if (!P || !PURCHASES_CONFIGURED) return false;
  await initPurchases();
  const info = (raw ?? {}) as { sku?: string; offerToken?: string };
  const sku = info.sku;
  if (!sku) return false;
  return new Promise<boolean>((resolve) => {
    pending = resolve;
    const request: any = { apple: { sku } };
    request.google = {
      skus: [sku],
      subscriptionOffers: info.offerToken ? [{ sku, offerToken: info.offerToken }] : [],
    };
    Promise.resolve(P.requestPurchase({ type: "subs", request })).catch(() => {
      if (pending) {
        pending(proNow);
        pending = null;
      }
    });
  });
}

async function hasActiveSub(sync: boolean): Promise<boolean> {
  const P = load();
  if (!P || !PURCHASES_CONFIGURED) return false;
  try {
    await initPurchases();
    if (sync && P.restorePurchases) {
      try {
        await P.restorePurchases();
      } catch {
        /* best effort */
      }
    }
    const active: boolean = await P.hasActiveSubscriptions(SUBSCRIPTION_SKUS);
    notify(active);
    return active;
  } catch {
    return false;
  }
}

export async function restorePurchases(): Promise<boolean> {
  return hasActiveSub(true);
}

export async function currentIsPro(): Promise<boolean> {
  return hasActiveSub(false);
}

// Notified when a purchase completes / renews. Returns an unsubscribe fn.
// (Lapses are re-checked on next launch via currentIsPro.)
export function addProListener(cb: (pro: boolean) => void): () => void {
  proCbs.add(cb);
  return () => {
    proCbs.delete(cb);
  };
}
