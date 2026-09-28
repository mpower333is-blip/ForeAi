import { Vibration, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PanelWeather } from "../services/weather";
import { getNotifPrefs, loadNotifPrefs } from "./notifPrefs";

// A loud lightning alarm: when a strike is within ~10 km (or a thunderstorm is
// imminent), fire a system notification with sound + a strong vibration, at most
// once every 20 minutes so it warns without nagging. Local-only (no push server,
// no APNs entitlement). The FOREGROUND alarm here fires while the app is open;
// the same notification is fired from a background task (see lightningBackground)
// when the app is closed. Both share ONE cooldown, persisted below, so a
// background alert doesn't immediately repeat when the player opens the app.

export const NEAR_KM = 10;
const COOLDOWN_MS = 20 * 60 * 1000;
const LAST_ALARM_KEY = "foreai.lightning.lastAlarmAt.v1";

let inited = false;
let permitted = false;

// True when the weather says lightning is a live danger within NEAR_KM.
export function isLightningNear(wx: PanelWeather): boolean {
  const L = wx.lightning;
  return L.level === "warning" && (L.nearestKm == null || L.nearestKm <= NEAR_KM);
}

// Shared, persisted cooldown so the foreground alarm and the background task
// don't both fire within 20 min of each other.
async function withinCooldown(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(LAST_ALARM_KEY);
    const last = raw ? Number(raw) : 0;
    return Date.now() - last < COOLDOWN_MS;
  } catch {
    return false;
  }
}
async function stampCooldown(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_ALARM_KEY, String(Date.now()));
  } catch {}
}

// The high-importance Android channel the lightning notification routes through.
// Safe to call repeatedly.
export async function ensureLightningChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync("lightning", {
      name: "Lightning alerts",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      vibrationPattern: [0, 500, 250, 500, 250, 800],
      bypassDnd: true,
      lightColor: "#FF6B6B",
    });
  } catch {}
}

// Compose the warning body from the nearest-strike info, when known.
export function lightningBody(wx: PanelWeather): string {
  const L = wx.lightning;
  return (
    (L.nearestKm != null ? `Strike ${L.nearestKm} km ${L.nearestDir ?? ""}. ` : "") +
    "Get off the course and take shelter — never under trees."
  );
}

// Fire the local lightning notification, honouring the shared cooldown. Returns
// true if it actually fired. Used by both the foreground alarm and the
// background task. `vibrate` is only meaningful in the foreground.
export async function fireLightningNotification(
  wx: PanelWeather,
  opts: { vibrate?: boolean } = {},
): Promise<boolean> {
  if (await withinCooldown()) return false;
  await stampCooldown();

  if (opts.vibrate) Vibration.vibrate([0, 500, 250, 500, 250, 800]);

  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return false;
  } catch {
    return false;
  }

  await ensureLightningChannel();
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: "⚡ Lightning nearby", body: lightningBody(wx), sound: "default" },
      // 1-second trigger so Android routes to the high-importance "lightning"
      // channel; effectively immediate. iOS ignores channelId.
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        channelId: "lightning",
      } as Notifications.TimeIntervalTriggerInput,
    });
    return true;
  } catch {
    return false;
  }
}

export async function initLightningAlarm(): Promise<void> {
  if (inited) return;
  inited = true;
  loadNotifPrefs();

  // Show the banner + play the sound even when the app is in the foreground.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    permitted = status === "granted";
  } catch {
    permitted = false;
  }

  await ensureLightningChannel();
}

export async function maybeLightningAlarm(wx: PanelWeather): Promise<void> {
  if (!getNotifPrefs().lightning) return; // player turned lightning alerts off
  if (!isLightningNear(wx)) return;

  // Strong vibration fires regardless of notification permission; the shared
  // cooldown inside fireLightningNotification prevents nagging.
  if (permitted) {
    await fireLightningNotification(wx, { vibrate: true });
  } else {
    // No notification permission — still buzz, but keep the same cooldown so we
    // don't vibrate every refresh.
    if (!(await cooldownActiveThenStamp())) Vibration.vibrate([0, 500, 250, 500, 250, 800]);
  }
}

// Helper for the no-permission vibrate path: returns true if we're still in the
// cooldown window, otherwise stamps it and returns false so the caller buzzes.
async function cooldownActiveThenStamp(): Promise<boolean> {
  if (await withinCooldown()) return true;
  await stampCooldown();
  return false;
}
