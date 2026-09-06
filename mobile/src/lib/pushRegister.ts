import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getNotifPrefs } from "./notifPrefs";

// Registers this phone with the backend so it receives LIGHTNING push alerts
// even when the app is closed. The backend watcher (backend/src/lib/
// lightningWatcher) checks the registered location's storm risk and pushes via
// Expo Push → APNs/FCM.
//
// Fail-soft by design: if the Expo projectId or push credentials aren't set up
// yet (see docs/push-setup.md), or on iOS builds without the push entitlement,
// getExpoPushTokenAsync throws — we catch it and the app simply keeps its
// FOREGROUND local alarm. Nothing breaks; push just isn't active until set up.

const TOKEN_KEY = "foreai.pushToken.v1";
const COORD_KEY = "foreai.pushCoord.v1";

function projectId(): string | undefined {
  const e: any = Constants?.expoConfig?.extra ?? (Constants as any)?.manifest?.extra;
  return e?.eas?.projectId || process.env.EXPO_PUBLIC_EAS_PROJECT_ID || undefined;
}

// Round so we don't spam the backend on every tiny GPS jitter.
function sameCoord(a: { lat: number; lng: number } | null, b: { lat: number; lng: number }): boolean {
  if (!a) return false;
  return Math.abs(a.lat - b.lat) < 0.005 && Math.abs(a.lng - b.lng) < 0.005; // ~0.5 km
}

let lastSent: { lat: number; lng: number } | null = null;

// Call when lightning alerts are ON and a location to watch is known (course
// centre or live GPS). Safe to call repeatedly; it only re-registers when the
// watched location moves meaningfully.
export async function registerForPush(coord: { lat: number; lng: number }, apiBase: string): Promise<void> {
  if (!getNotifPrefs().lightning) return;
  const pid = projectId();
  if (!pid) return; // Expo project not configured yet — foreground alarm still works

  if (lastSent && sameCoord(lastSent, coord)) return;

  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return;

    const tokenResp = await Notifications.getExpoPushTokenAsync({ projectId: pid });
    const token = tokenResp.data;
    if (!token) return;

    const res = await fetch(`${apiBase}/push/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, platform: Platform.OS, lat: coord.lat, lng: coord.lng }),
    });
    if (res.ok) {
      lastSent = coord;
      await AsyncStorage.setItem(TOKEN_KEY, token);
      await AsyncStorage.setItem(COORD_KEY, JSON.stringify(coord));
    }
  } catch {
    // No projectId/credentials/entitlement — keep the foreground local alarm.
  }
}

// Call when the player turns lightning alerts OFF — stop the backend pushing to
// this device. The in-app foreground alarm is independently gated by the pref.
export async function unregisterForPush(apiBase: string): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await fetch(`${apiBase}/push/unregister`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    lastSent = null;
  } catch {
    /* offline — the backend prunes dead tokens on send anyway */
  }
}
