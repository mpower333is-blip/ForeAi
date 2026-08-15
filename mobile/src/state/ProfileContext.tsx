import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage";

// The player's identity, persisted across launches. This is the single source
// of truth for who "I" am — it drives the Home greeting, the AI Caddie's
// handicap, and auto-fills my name when registering for a golf day.

const KEY = "foreai.profile.v1";

type Persisted = {
  name: string;
  handicap: number;
  homeClub: string;
  onboarded: boolean;
};

const DEFAULTS: Persisted = { name: "", handicap: 18, homeClub: "", onboarded: false };

type ProfileState = Persisted & {
  ready: boolean; // storage has been read (avoid flashing onboarding)
  setName: (v: string) => void;
  setHandicap: (v: number) => void;
  setHomeClub: (v: string) => void;
  completeOnboarding: (patch?: Partial<Persisted>) => void;
  reset: () => void;
};

const Ctx = createContext<ProfileState | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Persisted>(DEFAULTS);
  const [ready, setReady] = useState(false);

  // Load once on mount.
  useEffect(() => {
    let alive = true;
    loadJSON<Persisted>(KEY).then((saved) => {
      if (!alive) return;
      if (saved) setState({ ...DEFAULTS, ...saved });
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Persist on every change (after the initial load).
  useEffect(() => {
    if (ready) saveJSON(KEY, state);
  }, [state, ready]);

  const value = useMemo<ProfileState>(
    () => ({
      ...state,
      ready,
      setName: (name) => setState((s) => ({ ...s, name })),
      setHandicap: (handicap) => setState((s) => ({ ...s, handicap })),
      setHomeClub: (homeClub) => setState((s) => ({ ...s, homeClub })),
      completeOnboarding: (patch) => setState((s) => ({ ...s, ...patch, onboarded: true })),
      reset: () => setState(DEFAULTS),
    }),
    [state, ready]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfile(): ProfileState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProfile must be used within a ProfileProvider");
  return v;
}
