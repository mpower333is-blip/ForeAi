// ForeAi Cloud Functions.
//
// Real push for open-game invites: when a member is invited to a game
// (a doc is created at clubs/{clubKey}/invites/{inviteId}), push a notification
// to the invited member's device(s) so they see it even when the app is closed.
//
// Delivery goes through Expo's push service (https://exp.host), which relays to
// APNs (iOS) and FCM (Android) using the credentials configured on the Expo
// project — so this function never touches Apple/Google keys directly. The app
// registers each member's Expo push token at clubs/{clubKey}/pushTokens/{memberId}.
//
// This is a 1st-gen Cloud Function (functions/v1 Firestore trigger) ON PURPOSE:
// 1st-gen Firestore triggers do NOT use Eventarc/Cloud Run/Pub-Sub, so deploying
// them does not require granting extra roles to Google service agents (which an
// org policy was blocking for 2nd gen).
//
// Deploy:  firebase deploy --only functions   (needs the Blaze plan)
// or push to kempton to deploy via GitHub Actions (.github/workflows/
// firebase-functions-deploy.yml). See docs/push-invites-setup.md.

const functions = require("firebase-functions/v1");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

const EXPO_ENDPOINT = "https://exp.host/--/api/v2/push/send";

function isExpoToken(t) {
  return typeof t === "string" && (t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken["));
}

// POST the messages to Expo (batches of 100) and return the tokens Expo reports
// as permanently invalid (DeviceNotRegistered) so we can prune them.
async function sendExpo(messages) {
  const valid = messages.filter((m) => isExpoToken(m.to));
  const invalidTokens = [];
  for (let i = 0; i < valid.length; i += 100) {
    const batch = valid.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });
      if (!res.ok) {
        console.error("Expo push HTTP error:", res.status, await res.text().catch(() => ""));
        continue;
      }
      const json = await res.json();
      const tickets = Array.isArray(json && json.data) ? json.data : [];
      tickets.forEach((ticket, idx) => {
        if (ticket && ticket.status === "error") {
          const err = ticket.details && ticket.details.error;
          if (err === "DeviceNotRegistered") invalidTokens.push(batch[idx].to);
          else console.error("Expo push ticket error:", err, ticket.message);
        }
      });
    } catch (e) {
      console.error("Expo push send failed:", e);
    }
  }
  return invalidTokens;
}

function teeLabel(iso) {
  if (!iso) return "a tee time";
  try {
    return new Date(iso).toLocaleString("en-ZA", {
      weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "a tee time";
  }
}

exports.onGameInviteCreated = functions
  .region("us-central1")
  .firestore.document("clubs/{clubKey}/invites/{inviteId}")
  .onCreate(async (snap, context) => {
    const inv = (snap && snap.data()) || {};
    if (inv.status && inv.status !== "pending") return null;

    const clubKey = context.params.clubKey;
    const toMemberId = String(inv.toMemberId || "");
    if (!toMemberId) return null;

    const tokRef = db.doc(`clubs/${clubKey}/pushTokens/${toMemberId}`);
    const tokSnap = await tokRef.get();
    if (!tokSnap.exists) return null;
    const tokens = Array.isArray(tokSnap.data().tokens) ? tokSnap.data().tokens : [];
    if (tokens.length === 0) return null;

    const body = `${inv.fromName || "A member"} invited you to a game — ${teeLabel(inv.teeAt)}. Tap to join.`;
    const messages = tokens.map((t) => ({
      to: t,
      sound: "default",
      title: "Golf invite ⛳",
      body,
      priority: "high",
      channelId: "default",
      data: { type: "gameInvite", clubKey, gameId: inv.gameId || null, inviteId: context.params.inviteId },
    }));

    const invalid = await sendExpo(messages);
    if (invalid.length > 0) {
      await tokRef.update({ tokens: FieldValue.arrayRemove(...invalid) }).catch(() => {});
    }
    return null;
  });

// ── Lightning safety watcher ────────────────────────────────────────────────
// A club is evacuated when lightning is near — the biggest weather danger on a
// course. This scheduled function checks each club course every 15 minutes and,
// when lightning is near or a thunderstorm is imminent, pushes a loud warning to
// EVERY member's phone — so they're warned even with the app closed. It
// complements the in-app (foreground) lightning alarm already in the app.
//
// Source: if Xweather credentials are set (XWEATHER_CLIENT_ID/SECRET), it uses
// Xweather's REAL detected lightning strikes for precise distance (the safest
// signal). It always ALSO checks the free Open-Meteo forecast, which needs no
// key and gives an earlier "approaching" heads-up and a fallback when Xweather
// is unset or unreachable.
const CLUB_SITES = [
  { clubKey: "kempton", name: "Kempton Park Golf Club", lat: -26.1051, lng: 28.217 },
];
// A real strike this close (km) means take shelter now.
const STRIKE_NEAR_KM = 12; // real strike within this many km = take shelter now

const XW_ID = process.env.XWEATHER_CLIENT_ID || "";
const XW_SECRET = process.env.XWEATHER_CLIENT_SECRET || "";
const XW_ENABLED = !!(XW_ID && XW_SECRET);

function haversineKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const toR = (x) => (x * Math.PI) / 180;
  const dLat = toR(bLat - aLat);
  const dLng = toR(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(aLat)) * Math.cos(toR(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Nearest REAL detected strike (km) in the last ~12 min within 15 miles, or null.
async function xwNearestStrikeKm(site) {
  const url =
    `https://data.api.xweather.com/lightning/closest?p=${site.lat},${site.lng}` +
    `&radius=15miles&limit=10&filter=all&from=-12minutes&sort=dt:-1&format=json` +
    `&client_id=${encodeURIComponent(XW_ID)}&client_secret=${encodeURIComponent(XW_SECRET)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const j = await res.json();
  if (!j || j.success !== true || !Array.isArray(j.response)) return null;
  let nearest = Infinity;
  for (const r of j.response) {
    let d = null;
    if (r.relativeTo && typeof r.relativeTo.distanceKM === "number") d = r.relativeTo.distanceKM;
    else if (r.loc && typeof r.loc.lat === "number" && typeof r.loc.long === "number") d = haversineKm(site.lat, site.lng, r.loc.lat, r.loc.long);
    if (d != null && d < nearest) nearest = d;
  }
  return nearest === Infinity ? null : nearest;
}

// WMO weather codes for thunderstorms (95 = thunderstorm, 96/99 = with hail).
function isThunderCode(c) {
  return c === 95 || c === 96 || c === 99;
}
async function openMeteoLevel(site) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${site.lat}&longitude=${site.lng}` +
    `&current=weather_code&hourly=weather_code&forecast_hours=2&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const j = await res.json();
  const cur = j && j.current ? j.current.weather_code : undefined;
  const next = j && j.hourly && Array.isArray(j.hourly.weather_code) ? j.hourly.weather_code.slice(0, 2) : [];
  if (isThunderCode(cur)) {
    return { level: "overhead", body: "Thunderstorm over the course — get off the course and take shelter NOW. Never shelter under trees." };
  }
  if (next.some(isThunderCode)) {
    return { level: "approaching", body: "Thunderstorm approaching within the hour — be ready to leave the course and take shelter." };
  }
  return null;
}
async function lightningLevelFor(site) {
  // 1) Precise real strikes (Xweather) → highest-confidence "take shelter now".
  if (XW_ENABLED) {
    try {
      const km = await xwNearestStrikeKm(site);
      if (km != null && km <= STRIKE_NEAR_KM) {
        return { level: "overhead", body: `Lightning detected ${Math.round(km)} km away — get off the course and take shelter NOW. Never shelter under trees.` };
      }
    } catch (e) {
      console.error("Xweather lightning lookup failed", e);
    }
  }
  // 2) Free forecast (Open-Meteo) → early "approaching" heads-up + fallback.
  return openMeteoLevel(site);
}

async function pushClubTokens(clubKey, title, body) {
  const snap = await db.collection(`clubs/${clubKey}/pushTokens`).get();
  const tokens = [];
  snap.forEach((d) => {
    const arr = d.data() && d.data().tokens;
    if (Array.isArray(arr)) arr.forEach((t) => tokens.push(t));
  });
  if (tokens.length === 0) return [];
  const messages = tokens.map((t) => ({
    to: t,
    sound: "default",
    title,
    body,
    priority: "high",
    channelId: "lightning",
    data: { type: "lightning", clubKey },
  }));
  return sendExpo(messages);
}

exports.clubLightningWatch = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 60, memory: "256MB" })
  .pubsub.schedule("every 15 minutes")
  .timeZone("Africa/Johannesburg")
  .onRun(async () => {
    const COOLDOWN_MS = 45 * 60 * 1000; // don't repeat the same warning within 45 min
    for (const site of CLUB_SITES) {
      try {
        const risk = await lightningLevelFor(site);
        const alarmRef = db.doc(`clubs/${site.clubKey}/alarms/lightning`);
        const prev = (await alarmRef.get()).data() || {};
        const now = Date.now();
        if (!risk) {
          // Storm cleared — record it so the next storm alerts immediately.
          if (prev.level) await alarmRef.set({ level: null, clearedAt: now }, { merge: true });
          continue;
        }
        // Skip if we already warned recently at the same level (avoid nagging);
        // an escalation (approaching → overhead) always re-alerts.
        const same = prev.level === risk.level;
        if (same && prev.lastAt && now - prev.lastAt < COOLDOWN_MS) continue;
        await pushClubTokens(site.clubKey, "⚡ Lightning warning", risk.body);
        await alarmRef.set({ level: risk.level, body: risk.body, lastAt: now }, { merge: true });
      } catch (e) {
        console.error("lightning watch failed for", site.clubKey, e);
      }
    }
    return null;
  });
