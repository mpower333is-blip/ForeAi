import { Vibration, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { PanelWeather } from "../services/weather";
import { getNotifPrefs, loadNotifPrefs } from "./notifPrefs";

// A loud lightning alarm: when a strike is within ~10 km (or a thunderstorm is
// imminent), fire a system notification with sound + a strong vibration, at most
// once every 20 minutes so it warns without nagging. Local-only (no push server,
// no APNs entitlement) — it fires while the app is open or recently backgrounded.

const NEAR_KM = 10;
const COOLDOWN_MS = 20 * 60 * 1000;

let inited = false;
let permitted = false;
let lastAlarmAt = 0;

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

  if (Platform.OS === "android") {
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
}

export async function maybeLightningAlarm(wx: PanelWeather): Promise<void> {
  if (!getNotifPrefs().lightning) return; // player turned lightning alerts off
  const L = wx.lightning;
  const nearby = L.level === "warning" && (L.nearestKm == null || L.nearestKm <= NEAR_KM);
  if (!nearby) return;

  const now = Date.now();
  if (now - lastAlarmAt < COOLDOWN_MS) return;
  lastAlarmAt = now;

  // Strong vibration fires regardless of notification permission.
  Vibration.vibrate([0, 500, 250, 500, 250, 800]);

  if (!permitted) return;
  const body =
    (L.nearestKm != null ? `Strike ${L.nearestKm} km ${L.nearestDir ?? ""}. ` : "") +
    "Get off the course and take shelter — never under trees.";
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: "⚡ Lightning nearby", body, sound: "default" },
      // 1-second trigger so Android routes to the high-importance "lightning"
      // channel; effectively immediate. iOS ignores channelId.
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        channelId: "lightning",
      } as Notifications.TimeIntervalTriggerInput,
    });
  } catch {}
}
