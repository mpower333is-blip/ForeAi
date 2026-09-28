import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchLiveWeather } from "../services/weather";
import { API_BASE } from "../services/api";
import { loadNotifPrefs, getNotifPrefs } from "./notifPrefs";
import { isLightningNear, fireLightningNotification, ensureLightningChannel } from "./lightningAlarm";

// Background lightning watch — the piece that makes the warning fire even when
// the app is CLOSED. A periodic OS-scheduled task (BGTaskScheduler on iOS,
// WorkManager on Android via expo-background-task) wakes ~every 15 min, re-checks
// storm risk for the last known location, and fires the SAME local lightning
// notification the foreground alarm uses. No push server and no push entitlement
// are involved, matching the app's local-notifications-only design.
//
// The OS controls the exact cadence and may run it less often on a rarely-opened
// app (especially iOS) — this is a safety NET for a backgrounded/closed phone,
// while the 2-min foreground refresh stays the primary path during a round.

const TASK = "foreai-lightning-bg";
const COORD_KEY = "foreai.lastCoord.v1";

// The foreground weather panel calls this so the background task has a location
// to check even when it can't get a fresh GPS fix (no background-location
// permission is requested — we only ever read the LAST known position).
export async function saveLastCoord(coord: { lat: number; lng: number }): Promise<void> {
  try {
    await AsyncStorage.setItem(COORD_KEY, JSON.stringify({ lat: coord.lat, lng: coord.lng }));
  } catch {}
}

async function readLastCoord(): Promise<{ lat: number; lng: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(COORD_KEY);
    if (raw) {
      const c = JSON.parse(raw);
      if (typeof c?.lat === "number" && typeof c?.lng === "number") return c;
    }
  } catch {}
  return null;
}

// The headless task body. Kept fail-soft: any error just ends the run quietly so
// the OS keeps scheduling us.
TaskManager.defineTask(TASK, async () => {
  try {
    await loadNotifPrefs();
    if (!getNotifPrefs().lightning) return BackgroundTask.BackgroundTaskResult.Success;

    // Prefer a cached last-known fix (instant, no permission prompt); fall back
    // to the location the foreground panel last saved.
    let coord: { lat: number; lng: number } | null = null;
    try {
      const last = await Location.getLastKnownPositionAsync();
      if (last) coord = { lat: last.coords.latitude, lng: last.coords.longitude };
    } catch {}
    if (!coord) coord = await readLastCoord();
    if (!coord) return BackgroundTask.BackgroundTaskResult.Success;

    const wx = await fetchLiveWeather(coord, API_BASE);
    if (wx && isLightningNear(wx)) {
      await ensureLightningChannel();
      await fireLightningNotification(wx); // shared cooldown prevents double-alerts
    }
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

let registered = false;

// Register the periodic watch. Safe to call repeatedly; only registers once and
// only while lightning alerts are on. No-ops gracefully if the platform can't
// schedule background tasks (e.g. restricted/older devices).
export async function registerLightningBackground(): Promise<void> {
  if (registered) return;
  if (!getNotifPrefs().lightning) return;
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status === BackgroundTask.BackgroundTaskStatus.Restricted) return;
    const already = await TaskManager.isTaskRegisteredAsync(TASK);
    if (!already) {
      // 15 min is the practical floor the OS honours; it will often run less
      // frequently. Good enough as a closed-app safety net.
      await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 });
    }
    registered = true;
  } catch {
    // Background scheduling unavailable — the foreground alarm still works.
  }
}

// Called when the player turns lightning alerts OFF.
export async function unregisterLightningBackground(): Promise<void> {
  try {
    const already = await TaskManager.isTaskRegisteredAsync(TASK);
    if (already) await BackgroundTask.unregisterTaskAsync(TASK);
  } catch {}
  registered = false;
}
