import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { FeatureKey, FREE_FEATURE_KEYS } from "../config/appConfig";
import { loadJSON, saveJSON } from "../lib/storage";

const KEY = "foreai.plan.v1";

// The app ships as a free demo: Swing Coach + AI Caddie are demo-only and the
// Golf Day / Events area is fully usable, so players can try it on the day.
// Buying the package unlocks everything ("pro").
//
// NOTE: this is a local unlock stub. It flips the app to Pro for the current
// session so the flow can be demoed end-to-end. Wire it to real in-app
// purchases / a licence check (e.g. RevenueCat or expo-in-app-purchases) before
// charging money — the `purchase()` seam is where that goes.

type Plan = "demo" | "pro";

type PlanState = {
  plan: Plan;
  isPro: boolean;
  hasFeature: (f: FeatureKey) => boolean;
  purchase: () => void; // unlock the full package (stub)
  restore: () => void; // "restore purchases" (stub)
  resetToDemo: () => void; // for testing the demo experience
};

const Ctx = createContext<PlanState | null>(null);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = useState<Plan>("demo");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadJSON<{ plan: Plan }>(KEY).then((saved) => {
      if (saved?.plan === "pro") setPlan("pro");
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (ready) saveJSON(KEY, { plan });
  }, [plan, ready]);

  const value = useMemo<PlanState>(
    () => ({
      plan,
      isPro: plan === "pro",
      hasFeature: (f) => plan === "pro" || FREE_FEATURE_KEYS.includes(f),
      purchase: () => setPlan("pro"),
      restore: () => setPlan("pro"),
      resetToDemo: () => setPlan("demo"),
    }),
    [plan]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlan(): PlanState {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlan must be used within a PlanProvider");
  return v;
}
