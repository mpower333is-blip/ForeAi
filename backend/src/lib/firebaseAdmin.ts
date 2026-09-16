import admin from "firebase-admin";

// Firestore access for the backend, initialised from a service account provided
// as an environment variable. FAIL-SOFT: if the service account isn't set, `db`
// is null and all mirroring is skipped, so the app keeps working on Postgres
// exactly as before. Set FIREBASE_SERVICE_ACCOUNT to the JSON of a service
// account key (Firebase console → Project settings → Service accounts →
// Generate new private key) to turn on the Firestore mirror.
let db: admin.firestore.Firestore | null = null;

try {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw && raw.trim()) {
    const svc = JSON.parse(raw);
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(svc as admin.ServiceAccount) });
    }
    db = admin.firestore();
    console.log("[firestore] event mirror enabled");
  } else {
    console.warn("[firestore] FIREBASE_SERVICE_ACCOUNT not set — event mirror disabled (Postgres only).");
  }
} catch (e) {
  console.error("[firestore] init failed — event mirror disabled:", e);
  db = null;
}

export { db };
