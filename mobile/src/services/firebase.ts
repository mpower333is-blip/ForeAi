// Firebase for the app — Firestore + Anonymous Auth, lazily initialised.
//
// The Firestore data layer is switched on at build time with
// EXPO_PUBLIC_USE_FIRESTORE=1 (set in the Codemagic "flip" build). Until then
// USE_FIRESTORE is false and nothing here runs, so the app keeps using the REST
// backend exactly as before. Players sign in ANONYMOUSLY so the "just play" flow
// needs no account; an organiser can later sign in to own their events.

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { initializeFirestore, type Firestore } from "firebase/firestore";
import * as firebaseAuth from "firebase/auth";
import { initializeAuth, signInAnonymously, type Auth, type Persistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FIREBASE_CONFIG } from "../config/firebaseConfig";

// getReactNativePersistence exists at runtime in firebase 10.x (the app uses it
// for auth persistence on device) but isn't in the package's published TS types
// on all 10.x releases, which breaks `tsc --noEmit` with TS2305. Pull it off the
// module with a cast — no runtime change, just a type the SDK forgot to export.
const getReactNativePersistence = (firebaseAuth as unknown as {
  getReactNativePersistence: (storage: unknown) => Persistence;
}).getReactNativePersistence;

export const USE_FIRESTORE = process.env.EXPO_PUBLIC_USE_FIRESTORE === "1";

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _auth: Auth | null = null;

function app(): FirebaseApp {
  if (_app) return _app;
  _app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
  return _app;
}

export function firestore(): Firestore {
  if (_db) return _db;
  // Auto-detected long-polling is the most reliable transport on React Native.
  _db = initializeFirestore(app(), { experimentalAutoDetectLongPolling: true });
  return _db;
}

export function auth(): Auth {
  if (_auth) return _auth;
  _auth = initializeAuth(app(), { persistence: getReactNativePersistence(AsyncStorage) });
  return _auth;
}

// Ensure there is a Firebase user (anonymous) so Firestore writes satisfy the
// security rules. Returns the uid, or null if disabled / it failed (fail-soft).
export async function ensureSignedIn(): Promise<string | null> {
  if (!USE_FIRESTORE) return null;
  const a = auth();
  if (a.currentUser) return a.currentUser.uid;
  try {
    const cred = await signInAnonymously(a);
    return cred.user.uid;
  } catch {
    return null;
  }
}
