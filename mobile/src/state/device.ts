// A stable per-device identifier used to recognize which tournament player is
// "me" on this phone. Persisted via AsyncStorage so "me" survives app restarts
// (otherwise a player would have to pick themselves again every launch).
//
// `DEVICE_ID` is an ES-module live binding: it starts as a fresh random id and
// is replaced in place once storage is read (initDeviceId). Consumers must read
// `DEVICE_ID` at call time (not capture it at import) to see the hydrated value.
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "foreai.device.v1";

function generate(): string {
  return `dev_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export let DEVICE_ID = generate();

let hydrating: Promise<string> | null = null;

// Load the persisted id (or save the freshly-generated one on first run).
// Idempotent — safe to call from several places on startup.
export function initDeviceId(): Promise<string> {
  if (!hydrating) {
    hydrating = (async () => {
      try {
        const saved = await AsyncStorage.getItem(KEY);
        if (saved) {
          DEVICE_ID = saved;
        } else {
          await AsyncStorage.setItem(KEY, DEVICE_ID);
        }
      } catch {
        // storage unavailable — keep the in-memory id for this session
      }
      return DEVICE_ID;
    })();
  }
  return hydrating;
}
