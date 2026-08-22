// Web stub for the purchases service — react-native-purchases is native-only, so
// the web build (expo export -p web) never bundles it. Everything here is a
// no-op that reports "not configured / not Pro", which keeps the web bundle
// building and the paywall harmlessly inert on web.
export type SubPeriod = "monthly" | "annual" | "other";

export type SubPackage = {
  id: string;
  period: SubPeriod;
  title: string;
  priceString: string;
  raw: unknown;
};

export const purchasesConfigured = false;

export async function initPurchases(): Promise<void> {}
export async function getPackages(): Promise<SubPackage[]> {
  return [];
}
export async function purchasePackage(_raw: unknown): Promise<boolean> {
  return false;
}
export async function restorePurchases(): Promise<boolean> {
  return false;
}
export async function currentIsPro(): Promise<boolean> {
  return false;
}
export function addProListener(_cb: (pro: boolean) => void): () => void {
  return () => {};
}
