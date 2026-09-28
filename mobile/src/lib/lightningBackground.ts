import { Alert } from "react-native";
import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchLiveWeather } from "../services/weather";
import { WEATHER_URL } from "../services/api";
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
const LOC_TASK = "foreai-lightning-loc";
const COORD_KEY = "foreai.lastCoord.v1";
const WX_CHECK_KEY = "foreai.lightning.lastWxCheck.v1";
// Don't hit the weather API on every GPS tick — check at most this often.
const WX_MIN_GAP_MS = 90 * 1000;

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

    const wx = await fetchLiveWeather(coord, WEATHER_URL);
    if (wx && isLightningNear(wx)) {
      await ensureLightningChannel();
      await fireLightningNotification(wx); // shared cooldown prevents double-alerts
    }
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// Throttled storm check used by the location task: saves the coord, and no more
// than once every WX_MIN_GAP_MS fetches the weather and fires the shared alarm
// if lightning is near. Fail-soft throughout.
async function checkStormAndAlert(coord: { lat: number; lng: number }): Promise<void> {
  await saveLastCoord(coord);
  try {
    if (!getNotifPrefs().lightning) {
      await loadNotifPrefs();
      if (!getNotifPrefs().lightning) return;
    }
    const raw = await AsyncStorage.getItem(WX_CHECK_KEY);
    const last = raw ? Number(raw) : 0;
    if (Date.now() - last < WX_MIN_GAP_MS) return;
    await AsyncStorage.setItem(WX_CHECK_KEY, String(Date.now()));

    const wx = await fetchLiveWeather(coord, WEATHER_URL);
    if (wx && isLightningNear(wx)) {
      await ensureLightningChannel();
      await fireLightningNotification(wx); // shared cooldown prevents double-alerts
    }
  } catch {}
}

// Location task: near-real-time watch. While a round is active, expo-location
// keeps delivering position — even when the app is closed (a foreground service
// on Android, "Always" background location on iOS) — and each fix re-checks
// storm risk. This is the responsive path; the periodic TASK above is the
// battery-cheap fallback for when no round is running.
TaskManager.defineTask(LOC_TASK, async ({ data, error }: any) => {
  if (error) return;
  const locs: any[] = data?.locations ?? [];
  const latest = locs[locs.length - 1];
  if (!latest?.coords) return;
  await checkStormAndAlert({ lat: latest.coords.latitude, lng: latest.coords.longitude });
});

const BG_CONSENT_KEY = "foreai.bgLocConsent.v1";

// Prominent disclosure REQUIRED before requesting background location, per
// Google Play policy (and good practice on iOS): the app must, in its own UI,
// tell the player it collects location in the background and why, BEFORE the OS
// permission prompt — otherwise the app is rejected even with the Play
// declaration filled in. Shown once; remembers the choice.
export async function ensureBackgroundLocationConsent(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(BG_CONSENT_KEY);
    if (v === "granted") return true;
    if (v === "declined") return false;
  } catch {}
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      "Lightning safety uses your location",
      "While you're on a round, ForeAi checks your location — including in the background and when the app is closed — to watch for nearby lightning and warn you to take shelter. Location is used only during a round, stops when the round ends, and is never shared.",
      [
        {
          text: "Not now",
          style: "cancel",
          onPress: () => {
            AsyncStorage.setItem(BG_CONSENT_KEY, "declined").catch(() => {});
            resolve(false);
          },
        },
        {
          text: "Allow",
          onPress: () => {
            AsyncStorage.setItem(BG_CONSENT_KEY, "granted").catch(() => {});
            resolve(true);
          },
        },
      ],
      { cancelable: false },
    );
  });
}

// Start the near-real-time lightning watch for an active round. Shows the
// prominent background-location disclosure first, then requests foreground +
// background location; degrades gracefully (to the periodic watch) if the player
// declines. Safe to call repeatedly.
export async function startRoundLightningWatch(): Promise<void> {
  if (!getNotifPrefs().lightning) return;
  // Google Play: the in-app disclosure must precede the OS permission request.
  if (!(await ensureBackgroundLocationConsent())) return;
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== "granted") return;
    // "Always"/background is what lets the watch keep running when the app is
    // closed. If it's denied we still start updates (they run while the app is
    // foregrounded), and the periodic background task covers the rest.
    try {
      await Location.requestBackgroundPermissionsAsync();
    } catch {}

    const already = await Location.hasStartedLocationUpdatesAsync(LOC_TASK).catch(() => false);
    if (already) return;

    await Location.startLocationUpdatesAsync(LOC_TASK, {
      accuracy: Location.Accuracy.Balanced,
      // A storm check every ~2 min is plenty; the weather fetch is throttled too.
      timeInterval: 2 * 60 * 1000,
      distanceInterval: 0,
      pausesUpdatesAutomatically: false,
      // iOS: show the blue background-location indicator during a round.
      showsBackgroundLocationIndicator: true,
      activityType: Location.ActivityType.Fitness,
      // Android: a persistent foreground-service notification is required to keep
      // receiving location in the background.
      foregroundService: {
        notificationTitle: "⚡ Lightning watch active",
        notificationBody: "Watching for nearby lightning while you play.",
        notificationColor: "#FF6B6B",
      },
    });
  } catch {
    // Background updates unavailable — the periodic watch still runs.
  }
}

// Stop the round watch (round finished / left the on-course screen).
export async function stopRoundLightningWatch(): Promise<void> {
  try {
    const already = await Location.hasStartedLocationUpdatesAsync(LOC_TASK).catch(() => false);
    if (already) await Location.stopLocationUpdatesAsync(LOC_TASK);
  } catch {}
}

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

// Called when the player turns lightning alerts OFF — disarm both the periodic
// watch and any active round (location) watch.
export async function unregisterLightningBackground(): Promise<void> {
  try {
    const already = await TaskManager.isTaskRegisteredAsync(TASK);
    if (already) await BackgroundTask.unregisterTaskAsync(TASK);
  } catch {}
  await stopRoundLightningWatch();
  registered = false;
}
