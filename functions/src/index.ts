import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { buildReport, diagnoseProviders } from "./weatherCore";
import { sendExpoPush, ExpoPushMessage } from "./expoPush";
import { clubKeyForEmail } from "./clubAdmins";

// ForeAi Cloud Functions — the server-only jobs that can't run in the app or a
// browser, migrated off Render. Provider keys (XWEATHER_*, TWC_*) are read from
// process.env; put them in functions/.env (git-ignored) or set them on the
// function. All are optional — without them the weather report falls back to the
// Open-Meteo forecast, exactly as on the old backend.

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

// ── Organiser provisioning ──────────────────────────────────────────────────
// The web calls this after a Firebase sign-in (replacing POST /auth/firebase).
// It creates/updates the caller's adminUsers/{uid} doc and sets clubKey from the
// CLUB_ADMIN_EMAILS mapping — the authoritative, server-only source of clubKey,
// so no one can grant themselves a club by writing their own doc (rules deny
// client writes to adminUsers). Returns the account so the web can gate the UI.
export const provisionOrganiser = onCall(async (req) => {
  const auth = req.auth;
  if (!auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const uid = auth.uid;
  const email = String(auth.token.email || "").trim().toLowerCase();
  const mappedClub = clubKeyForEmail(email);

  const ref = db.collection("adminUsers").doc(uid);
  const snap = await ref.get();
  const prev = (snap.exists ? snap.data() : {}) as any;

  const data: any = {
    email: email || prev.email || null,
    name: auth.token.name || prev.name || null,
    // Mapping wins; otherwise keep any clubKey already set (e.g. set by an admin).
    clubKey: mappedClub ?? prev.clubKey ?? null,
    role: prev.role || "organiser",
    updatedAt: Date.now(),
  };
  if (!snap.exists) data.createdAt = Date.now();
  await ref.set(data, { merge: true });

  return { uid, email: data.email, name: data.name, clubKey: data.clubKey, role: data.role };
});

// ── Weather + live lightning ────────────────────────────────────────────────
// Mirrors the old GET /weather?lat=&lng=[&debug=1]. The app and the clubhouse
// board read this so the lightning provider secret stays server-side.
export const weather = onRequest({ cors: true }, async (req, res) => {
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  if (!isFinite(lat) || !isFinite(lng)) {
    res.status(400).json({ error: "lat and lng are required" });
    return;
  }
  try {
    if (req.query.debug) {
      const [data, providers] = await Promise.all([buildReport(lat, lng), diagnoseProviders(lat, lng)]);
      res.json({ ...data, providers });
      return;
    }
    res.json(await buildReport(lat, lng));
  } catch (e) {
    console.error("weather error", e);
    res.status(502).json({ error: "weather unavailable" });
  }
});

// ── Background lightning watcher ─────────────────────────────────────────────
// Every 3 minutes: group registered phones (pushDevices) into ~1 km areas,
// check each area's lightning risk, and push a loud alert to every phone in an
// area that hits "warning" — this is what fires when the app is CLOSED. The
// per-area cooldown lives in Firestore (lightningCooldowns) since a Cloud
// Function is stateless between runs.
const COOLDOWN_MS = 25 * 60 * 1000; // don't re-alert an area for 25 minutes
const GRID = 100; // round location to ~0.01° (~1 km) to form areas
const areaKey = (lat: number, lng: number) => `${Math.round(lat * GRID) / GRID},${Math.round(lng * GRID) / GRID}`;

type DeviceRow = { id: string; token: string; platform: string | null; lat: number; lng: number };

export const lightningWatch = onSchedule({ schedule: "every 3 minutes", region: "europe-west1" }, async () => {
  if (process.env.LIGHTNING_WATCH === "0") return;

  const snap = await db.collection("pushDevices").where("enabled", "==", true).get();
  const devices: DeviceRow[] = [];
  snap.forEach((doc) => {
    const d = doc.data() as any;
    if (typeof d.lat === "number" && typeof d.lng === "number" && d.token) {
      devices.push({ id: doc.id, token: d.token, platform: d.platform ?? null, lat: d.lat, lng: d.lng });
    }
  });
  if (devices.length === 0) return;

  // Group devices into areas.
  const areas = new Map<string, { lat: number; lng: number; rows: DeviceRow[] }>();
  for (const d of devices) {
    const key = areaKey(d.lat, d.lng);
    if (!areas.has(key)) areas.set(key, { lat: d.lat, lng: d.lng, rows: [] });
    areas.get(key)!.rows.push(d);
  }

  const now = Date.now();
  for (const [key, area] of areas) {
    const cdRef = db.collection("lightningCooldowns").doc(key.replace(/\//g, "_"));
    const cd = await cdRef.get();
    const last = cd.exists ? Number((cd.data() as any)?.at) || 0 : 0;
    if (now - last < COOLDOWN_MS) continue; // respect cooldown before spending a provider call

    let report;
    try {
      report = await buildReport(area.lat, area.lng);
    } catch (e) {
      console.error("lightningWatch buildReport failed:", e);
      continue;
    }
    if (report.lightning.level !== "warning") continue;

    await cdRef.set({ at: now, area: key });

    const L = report.lightning;
    const body =
      (L.nearestKm != null ? `Strike ${L.nearestKm} km ${L.nearestDir ?? ""}. ` : "") +
      "Get off the course and take shelter — never under trees.";
    const messages: ExpoPushMessage[] = area.rows.map((r) => ({
      to: r.token,
      title: "⚡ Lightning nearby",
      body,
      sound: "default",
      priority: "high",
      channelId: "lightning",
      data: { type: "lightning", level: L.level, source: L.source },
    }));

    const { invalidTokens } = await sendExpoPush(messages);
    console.log(`lightningWatch: alerted ${messages.length} device(s) in area ${key} (${L.source})`);

    // Prune tokens Expo says are dead.
    if (invalidTokens.length > 0) {
      const dead = new Set(invalidTokens);
      const batch = db.batch();
      area.rows.filter((r) => dead.has(r.token)).forEach((r) => batch.delete(db.collection("pushDevices").doc(r.id)));
      await batch.commit().catch(() => {});
    }
  }
});
