import AsyncStorage from "@react-native-async-storage/async-storage";

// Per-player notification switches, stored on the device. A synchronous cache
// lets the lightning alarm check instantly; call loadNotifPrefs() once at start.
export type NotifPrefs = { lightning: boolean; reminders: boolean };

const KEY = "foreai.notifPrefs.v1";
let cache: NotifPrefs = { lightning: true, reminders: true };
let loaded = false;
const listeners = new Set<(p: NotifPrefs) => void>();

export function getNotifPrefs(): NotifPrefs {
  return cache;
}

export async function loadNotifPrefs(): Promise<NotifPrefs> {
  if (loaded) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) cache = { ...cache, ...JSON.parse(raw) };
  } catch {}
  loaded = true;
  return cache;
}

export async function setNotifPref(key: keyof NotifPrefs, val: boolean): Promise<void> {
  cache = { ...cache, [key]: val };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch {}
  listeners.forEach((fn) => fn(cache));
}

export function subscribeNotifPrefs(fn: (p: NotifPrefs) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
