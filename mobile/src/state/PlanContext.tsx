import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { FeatureKey, FREE_FEATURE_KEYS } from "../config/appConfig";
import { IS_EVENT } from "../config/appVariant";
import { loadJSON, saveJSON } from "../lib/storage";
import {
  purchasesConfigured,
  initPurchases,
  getPackages,
  purchasePackage as buyPackage,
  restorePurchases,
  currentIsPro,
  addProListener,
  SubPackage,
} from "../services/purchases";

const KEY = "foreai.plan.v1";

// The app ships as a free demo: Swing Coach + AI Caddie are demo-only and the
// Golf Day / Events area is fully usable, so players can try it on the day.
// Subscribing (ForeAi Pro, monthly or annual) unlocks everything.
//
// Two modes:
//  • RevenueCat configured (a key is set)  → real subscriptions. `isPro` tracks
//    the live entitlement, so it flips off automatically when a sub lapses.
//  • Not configured (pre-launch / dev)      → a local "demo unlock" so the whole
//    flow can be exercised without charging. Persisted to this device only.

type Plan = "demo" | "pro";

type PlanState = {
  plan: Plan;
  isPro: boolean;
  hasFeature: (f: FeatureKey) => boolean;
  // Real subscriptions
  configured: boolean; // true = live billing, false = demo unlock
  packages: SubPackage[]; // monthly / annual, with localized store prices
  purchasePackage: (pkg: SubPackage) => Promise<void>;
  restore: () => Promise<void>;
  // Back-compat helpers
  purchase: () => Promise<void>; // buys the first package, or demo-unlocks
  resetToDemo: () => void; // testing the demo experience
};

const Ctx = createContext<PlanState | null>(null);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  // Live entitlement from RevenueCat (used when configured).
  const [entitledPro, setEntitledPro] = useState(false);
  // Local demo unlock (used when NOT configured), persisted to this device.
  const [demoPro, setDemoPro] = useState(false);
  const [packages, setPackages] = useState<SubPackage[]>([]);
  const [ready, setReady] = useState(false);

  // Load persisted demo unlock (only meaningful when not configured).
  useEffect(() => {
    loadJSON<{ plan: Plan }>(KEY).then((saved) => {
      if (saved?.plan === "pro") setDemoPro(true);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (ready && !purchasesConfigured) saveJSON(KEY, { plan: demoPro ? "pro" : "demo" });
  }, [demoPro, ready]);

  // Wire up RevenueCat once (skipped for the fully-unlocked event build).
  useEffect(() => {
    if (IS_EVENT || !purchasesConfigured) return;
    let unsub = () => {};
    (async () => {
      await initPurchases();
      setEntitledPro(await currentIsPro());
      setPackages(await getPackages());
      unsub = addProListener(setEntitledPro);
    })();
    return () => unsub();
  }, []);

  const isPro = IS_EVENT || (purchasesConfigured ? entitledPro : demoPro);

  const value = useMemo<PlanState>(() => {
    const grantDemo = () => setDemoPro(true);

    const purchasePackage = async (pkg: SubPackage) => {
      if (!purchasesConfigured) {
        grantDemo();
        return;
      }
      const ok = await buyPackage(pkg.raw);
      if (ok) setEntitledPro(true);
    };

    return {
      plan: isPro ? "pro" : "demo",
      isPro,
      hasFeature: (f) => isPro || FREE_FEATURE_KEYS.includes(f),
      configured: purchasesConfigured,
      packages,
      purchasePackage,
      restore: async () => {
        if (!purchasesConfigured) {
          grantDemo();
          return;
        }
        const ok = await restorePurchases();
        if (ok) setEntitledPro(true);
      },
      purchase: async () => {
        if (packages.length > 0) return purchasePackage(packages[0]);
        grantDemo();
      },
      resetToDemo: () => {
        setDemoPro(false);
        setEntitledPro(false);
      },
    };
  }, [isPro, packages]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlan(): PlanState {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlan must be used within a PlanProvider");
  return v;
}
