// Staff / organiser login for the app — the SAME Firebase accounts organisers
// use on the clubhouse website (email + password). Signing in here lets club
// staff use the in-app Clubhouse tools (course survey, and more later) so they
// need ONE app, not a separate survey app.
//
// Only loaded when the app is built with EXPO_PUBLIC_USE_FIRESTORE=1 (AuthContext
// require()s it behind that flag), so the firebase SDK stays out of non-Firestore
// builds.

import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  signInAnonymously,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { getFunctions, httpsCallable, type Functions } from "firebase/functions";
import { auth, firestore } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { getApp } from "firebase/app";

export type StaffProfile = {
  uid: string;
  email: string | null;
  name: string | null;
  clubKey: string | null;
  role: string | null;
  isStaff: boolean; // organiser or platform owner
};

let _fns: Functions | null = null;
function fns(): Functions {
  // Functions are deployed in europe-west1 (see functions/src/index.ts).
  if (!_fns) _fns = getFunctions(getApp(), "europe-west1");
  return _fns;
}

// Read the signed-in user's organiser record. provisionOrganiser (Cloud Function)
// creates/updates adminUsers/{uid} and returns the authoritative clubKey/role —
// exactly what the website does on sign-in. Falls back to reading the doc
// directly if the callable isn't reachable.
async function loadProfile(user: User): Promise<StaffProfile> {
  const base: StaffProfile = {
    uid: user.uid,
    email: user.email,
    name: user.displayName,
    clubKey: null,
    role: null,
    isStaff: false,
  };
  try {
    const res: any = await httpsCallable(fns(), "provisionOrganiser")();
    const d = res?.data ?? {};
    return { ...base, name: d.name ?? base.name, clubKey: d.clubKey ?? null, role: d.role ?? null, isStaff: true };
  } catch {
    // Callable unavailable — read the record directly (exists if they've used
    // the web office before). Rules allow reading your own adminUsers doc.
    try {
      const snap = await getDoc(doc(firestore(), "adminUsers", user.uid));
      if (snap.exists()) {
        const d = snap.data() as any;
        return { ...base, name: d.name ?? base.name, clubKey: d.clubKey ?? null, role: d.role ?? "organiser", isStaff: true };
      }
    } catch {}
    return base;
  }
}

export async function staffSignIn(email: string, password: string): Promise<StaffProfile> {
  const cred = await signInWithEmailAndPassword(auth(), email.trim(), password);
  return loadProfile(cred.user);
}

// Sign the staff member out, then re-establish anonymous auth so the normal
// player flows (Firestore reads/writes gated on being signed in) keep working.
export async function staffSignOut(): Promise<void> {
  try {
    await fbSignOut(auth());
  } catch {}
  try {
    await signInAnonymously(auth());
  } catch {}
}

// Subscribe to auth changes. Reports a StaffProfile when a NON-anonymous (email)
// user is present, else null. Lets the app restore a staff session on launch.
export function watchStaff(cb: (profile: StaffProfile | null) => void): () => void {
  return onAuthStateChanged(auth(), async (user) => {
    if (user && !user.isAnonymous) {
      try {
        cb(await loadProfile(user));
      } catch {
        cb(null);
      }
    } else {
      cb(null);
    }
  });
}
