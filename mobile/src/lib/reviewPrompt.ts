import * as StoreReview from "expo-store-review";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Ask for an App Store / Play Store rating at a GENUINELY good moment — right
// after the player finishes a round — using the OS's native in-app review sheet
// (StoreKit SKStoreReviewController on iOS, Play In-App Review on Android). That
// sheet never leaves the app and the OS itself rate-limits it (iOS: ≤3/year).
//
// On top of the OS limit we gate it so it never nags:
//   • Only after the player has finished a couple of rounds (earned some value).
//   • At most once every ~4 months.
//   • At most 3 asks ever, then we stop for good.
//   • At most once per app session.
// We NEVER gate by sentiment (no "are you happy?" filter) — that violates store
// guidelines. We just pick a good moment and let the OS show its sheet.

const KEY = "foreai.review.v1";
const MIN_ROUNDS_BEFORE_ASK = 2; // let them finish ~2 rounds first
const COOLDOWN_MS = 120 * 24 * 60 * 60 * 1000; // ~4 months between asks
const MAX_ASKS = 3;

type State = { rounds: number; asks: number; lastAskAt: number; done: boolean };

const DEFAULT: State = { rounds: 0, asks: 0, lastAskAt: 0, done: false };

let ranThisSession = false;

async function load(): Promise<State> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT };
}

async function save(s: State): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

// Call once at a positive milestone (a completed round). Records the milestone
// and, when every gate passes, shows the native review sheet. Fail-soft and
// silent — it never throws and never blocks the UI.
export async function maybeAskForReview(): Promise<void> {
  if (ranThisSession) return; // one consideration per app session
  ranThisSession = true;
  try {
    const s = await load();
    if (s.done) return;

    s.rounds += 1;

    const gatesPass =
      s.rounds >= MIN_ROUNDS_BEFORE_ASK &&
      s.asks < MAX_ASKS &&
      Date.now() - s.lastAskAt > COOLDOWN_MS;

    if (gatesPass) {
      const available = await StoreReview.isAvailableAsync();
      const hasAction = await StoreReview.hasAction(); // a store listing to point at
      if (available && hasAction) {
        await StoreReview.requestReview();
        s.asks += 1;
        s.lastAskAt = Date.now();
        if (s.asks >= MAX_ASKS) s.done = true;
      }
    }

    await save(s);
  } catch {
    /* never let a review prompt break the round summary */
  }
}
