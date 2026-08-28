import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { FeatureKey, FREE_FEATURE_KEYS } from "../config/appConfig";
import { useTournament } from "./TournamentContext";
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
  refreshPackages: () => Promise<void>; // re-fetch from the store (new subs can lag)
  purchasePackage: (pkg: SubPackage) => Promise<void>;
  restore: () => Promise<void>;
  // Back-compat helpers
  purchase: () => Promise<void>; // buys the first package, or demo-unlocks
  resetToDemo: () => void; // testing the demo experience
};

const Ctx = createContext<PlanState | null>(null);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  // While the player is in a golf day they've joined, the whole app is unlocked
  // so everyone can try every feature on the day; personal use afterwards needs
  // the subscription.
  const { inLiveEvent } = useTournament();
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

  const refreshPackages = useCallback(async () => {
    if (!purchasesConfigured) return;
    const pkgs = await getPackages();
    setPackages(pkgs);
  }, []);

  // Wire up RevenueCat once. New store products can take a while to appear, so
  // retry the package fetch a few times before giving up.
  useEffect(() => {
    if (!purchasesConfigured) return;
    let unsub = () => {};
    let cancelled = false;
    (async () => {
      await initPurchases();
      if (cancelled) return;
      setEntitledPro(await currentIsPro());
      unsub = addProListener(setEntitledPro);
      for (let i = 0; i < 5 && !cancelled; i++) {
        const pkgs = await getPackages();
        if (cancelled) return;
        setPackages(pkgs);
        if (pkgs.length > 0) break;
        await new Promise((r) => setTimeout(r, 3000));
      }
    })();
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const isPro = inLiveEvent || (purchasesConfigured ? entitledPro : demoPro);

  const value = useMemo<PlanState>(() => {
    const grantDemo = () => setDemoPro(true);

    const purchasePackage = async (pkg: SubPackage) => {
      if (!purchasesConfigured) {
        grantDemo();
        return;
      }
      if (!pkg || !pkg.raw) {
        throw new Error("Plans are still loading from the store — please try again in a moment.");
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
      refreshPackages,
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
  }, [isPro, packages, refreshPackages]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlan(): PlanState {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlan must be used within a PlanProvider");
  return v;
}
