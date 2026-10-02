import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { buildReport, buildOutlook, diagnoseProviders } from "./weatherCore";
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

// ── Shared weather cache ─────────────────────────────────────────────────────
// One report per ~1 km area, cached in Firestore so EVERY caller shares it: all
// the phones polling from a course, the clubhouse board, and the scheduled
// lightning watcher collapse into a single provider call per area per TTL,
// instead of one call each. A Firestore read is effectively free next to a
// metered Xweather access, so this is the main lever for staying in budget.
//
// Adaptive TTL: refresh fast (60 s) while lightning is active so a moving storm
// stays current; a moderate 3 min when clear. The clear window is kept short so
// a NEWLY developing storm is picked up within ~3 min (not left stale) — safe to
// do because a clear area makes no metered call at all (convectivePotential gate
// in buildReport), so the only thing a short clear TTL costs is extra free
// Open-Meteo calls and cheap Firestore reads. Many phones in an area still
// collapse into one backend refresh per TTL.
const WX_GRID = 100; // ~0.01° ≈ 1 km
const WX_TTL_ACTIVE_MS = 60 * 1000;
const WX_TTL_CLEAR_MS = 3 * 60 * 1000;
const wxAreaDoc = (lat: number, lng: number) =>
  `${Math.round(lat * WX_GRID) / WX_GRID}_${Math.round(lng * WX_GRID) / WX_GRID}`;

async function cachedReport(lat: number, lng: number): Promise<any> {
  const ref = db.collection("weatherCache").doc(wxAreaDoc(lat, lng));
  const now = Date.now();
  try {
    const snap = await ref.get();
    if (snap.exists) {
      const d = snap.data() as any;
      const active = d?.data?.lightning?.level && d.data.lightning.level !== "none";
      const ttl = active ? WX_TTL_ACTIVE_MS : WX_TTL_CLEAR_MS;
      if (typeof d?.at === "number" && now - d.at < ttl && d.data) return d.data;
    }
  } catch {
    /* cache read failed — fall through and build fresh */
  }
  const data = await buildReport(lat, lng);
  ref.set({ at: now, data }).catch(() => {}); // best-effort write; don't block the response
  return data;
}

// The planning outlook is a forecast — it changes slowly, so cache it per area
// for 30 min, shared across all clients. This keeps the metered Xweather
// forecast call down to ~2/hour per area regardless of how many phones ask.
const OUTLOOK_TTL_MS = 30 * 60 * 1000;
async function cachedOutlook(lat: number, lng: number, hours: number): Promise<any> {
  const ref = db.collection("outlookCache").doc(`${wxAreaDoc(lat, lng)}_${hours}`);
  const now = Date.now();
  try {
    const snap = await ref.get();
    if (snap.exists) {
      const d = snap.data() as any;
      if (typeof d?.at === "number" && now - d.at < OUTLOOK_TTL_MS && d.data) return d.data;
    }
  } catch {
    /* fall through and build fresh */
  }
  const data = await buildOutlook(lat, lng, hours);
  if (data) ref.set({ at: now, data }).catch(() => {});
  return data;
}

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
    // Planning outlook: /weather?outlook=1&lat=&lng=[&hours=8] — the hour-by-hour
    // forecast + play verdict the app's "Planning to play?" card reads.
    if (req.query.outlook) {
      const hours = Math.min(24, Math.max(1, Number(req.query.hours) || 8));
      const outlook = await cachedOutlook(lat, lng, hours);
      if (!outlook) {
        res.status(502).json({ error: "outlook unavailable" });
        return;
      }
      res.json(outlook);
      return;
    }
    if (req.query.debug) {
      const [data, providers] = await Promise.all([buildReport(lat, lng), diagnoseProviders(lat, lng)]);
      res.json({ ...data, providers });
      return;
    }
    res.json(await cachedReport(lat, lng));
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
      // Share the same per-area cache the phones/board warm, so the watcher
      // rarely spends its own provider call.
      report = await cachedReport(area.lat, area.lng);
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
