import prisma from "../config/db";
import { buildReport } from "./weatherCore";
import { sendExpoPush, ExpoPushMessage } from "./expoPush";

// Background lightning watcher. Every few minutes it looks at the registered
// phones, groups them by rounded location (an area, not a person — Open-Meteo's
// forecast is area-scale anyway), checks each area's lightning risk, and pushes
// a loud alert to every phone in an area that hits "warning". This is what makes
// the alert fire when the app is CLOSED — the phone is woken by APNs/FCM.
//
// Guards against noise and cost:
//  • No registered devices  → does nothing (no provider calls).
//  • Per-area cooldown       → at most one alert per area per COOLDOWN.
//  • Only "warning" pushes    → "watch" stays on the in-app panel/board.
//
// Enabled by default; set LIGHTNING_WATCH=0 to disable. Note: on a platform that
// sleeps idle web services (e.g. Render free tier) the interval pauses while the
// service is asleep — keep the service warm for reliable event-day coverage.

const INTERVAL_MS = 3 * 60 * 1000; // check every 3 minutes
const COOLDOWN_MS = 25 * 60 * 1000; // don't re-alert an area for 25 minutes
const GRID = 100; // round location to ~0.01° (~1 km) to form areas

const lastAlertAt = new Map<string, number>(); // areaKey -> epoch ms

function areaKey(lat: number, lng: number): string {
  return `${Math.round(lat * GRID) / GRID},${Math.round(lng * GRID) / GRID}`;
}

async function tick(): Promise<void> {
  const devices = await prisma.pushDevice.findMany({
    where: { enabled: true, lat: { not: null }, lng: { not: null } },
  });
  if (devices.length === 0) return;

  // Group devices into areas.
  const areas = new Map<string, { lat: number; lng: number; tokens: { token: string; platform: string | null }[] }>();
  for (const d of devices) {
    if (d.lat == null || d.lng == null) continue;
    const key = areaKey(d.lat, d.lng);
    if (!areas.has(key)) areas.set(key, { lat: d.lat, lng: d.lng, tokens: [] });
    areas.get(key)!.tokens.push({ token: d.token, platform: d.platform });
  }

  const now = Date.now();

  for (const [key, area] of areas) {
    // Respect the per-area cooldown before spending a provider call.
    if (now - (lastAlertAt.get(key) ?? 0) < COOLDOWN_MS) continue;

    let report;
    try {
      report = await buildReport(area.lat, area.lng);
    } catch (e) {
      console.error("lightningWatcher buildReport failed:", e);
      continue;
    }

    if (report.lightning.level !== "warning") continue;

    lastAlertAt.set(key, now);

    const L = report.lightning;
    const body =
      (L.nearestKm != null ? `Strike ${L.nearestKm} km ${L.nearestDir ?? ""}. ` : "") +
      "Get off the course and take shelter — never under trees.";

    const messages: ExpoPushMessage[] = area.tokens.map((t) => ({
      to: t.token,
      title: "⚡ Lightning nearby",
      body,
      sound: "default",
      priority: "high",
      channelId: "lightning",
      data: { type: "lightning", level: L.level, source: L.source },
    }));

    const { invalidTokens } = await sendExpoPush(messages);
    console.log(`lightningWatcher: alerted ${messages.length} device(s) in area ${key} (${L.source})`);

    // Prune tokens Expo says are dead so the table stays clean.
    if (invalidTokens.length > 0) {
      await prisma.pushDevice.deleteMany({ where: { token: { in: invalidTokens } } }).catch(() => {});
    }
  }
}

let started = false;
export function startLightningWatcher(): void {
  if (started) return;
  if (process.env.LIGHTNING_WATCH === "0") {
    console.log("lightningWatcher disabled (LIGHTNING_WATCH=0)");
    return;
  }
  started = true;
  console.log(`lightningWatcher started — checking every ${INTERVAL_MS / 60000} min`);
  // Fire-and-forget interval; each tick guards its own errors.
  setInterval(() => {
    tick().catch((e) => console.error("lightningWatcher tick error:", e));
  }, INTERVAL_MS);
}
