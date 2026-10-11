// Calls the hnaLookup Cloud Function to fetch a player's current OFFICIAL
// handicap index by SA Player ID (Handicaps Network Africa, via DotGolf). The
// provider secret lives only on the function, never in the app.
//
// Only loaded when the app is built with EXPO_PUBLIC_USE_FIRESTORE=1 — callers
// guard on that flag and lazy-require this module, so the firebase SDK stays out
// of non-Firestore builds (same pattern as staffAuth).

import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";

export type HnaLookupResult = {
  configured: boolean; // false until the club's DotGolf creds are set on the function
  saId?: string;
  handicapIndex?: number | null; // null = not found in the club's HNA records
};

export async function lookupHandicapFromHna(saId: string): Promise<HnaLookupResult> {
  // Functions are deployed in europe-west1 (see functions/src/index.ts).
  const fns = getFunctions(getApp(), "europe-west1");
  const res: any = await httpsCallable(fns, "hnaLookup")({ saId });
  return (res?.data ?? { configured: false }) as HnaLookupResult;
}
