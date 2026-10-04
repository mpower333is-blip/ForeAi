import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { StaffProfile } from "../services/staffAuth";

// Staff/organiser auth for the app. Thin wrapper around services/staffAuth
// (lazy-required behind EXPO_PUBLIC_USE_FIRESTORE so the firebase SDK isn't
// bundled in non-Firestore builds). Players never need this — it gates the
// in-app Clubhouse staff tools (course survey, etc.).

const USE_FIRESTORE = process.env.EXPO_PUBLIC_USE_FIRESTORE === "1";

type StaffAuthMod = typeof import("../services/staffAuth");
let _mod: StaffAuthMod | null = null;
function mod(): StaffAuthMod | null {
  if (!USE_FIRESTORE) return null;
  if (!_mod) {
    try {
      _mod = require("../services/staffAuth") as StaffAuthMod;
    } catch {
      _mod = null;
    }
  }
  return _mod;
}

type AuthState = {
  available: boolean; // login is possible in this build
  ready: boolean; // initial auth check done
  staff: StaffProfile | null; // signed-in organiser/owner, or null
  signIn: (email: string, password: string) => Promise<StaffProfile>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [staff, setStaff] = useState<StaffProfile | null>(null);
  const [ready, setReady] = useState(!USE_FIRESTORE);

  useEffect(() => {
    const m = mod();
    if (!m) {
      setReady(true);
      return;
    }
    const unsub = m.watchStaff((p) => {
      setStaff(p);
      setReady(true);
    });
    return unsub;
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      available: USE_FIRESTORE,
      ready,
      staff,
      signIn: async (email, password) => {
        const m = mod();
        if (!m) throw new Error("Sign-in isn't available in this build.");
        const p = await m.staffSignIn(email, password);
        setStaff(p);
        return p;
      },
      signOut: async () => {
        const m = mod();
        if (m) await m.staffSignOut();
        setStaff(null);
      },
    }),
    [ready, staff]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within an AuthProvider");
  return v;
}
