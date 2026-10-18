// Prominent disclosure for FOREGROUND location, required by Google Play's User
// Data policy: before the OS runtime-permission prompt, the app must, in its own
// UI, tell the player what location data it collects and why — otherwise the app
// is flagged "Inadequate Prominent Disclosure" even with the Play data form
// filled in. This mirrors ensureBackgroundLocationConsent() in lightningBackground.ts
// (which covers the background/lightning case) for the everyday GPS features.
//
// Shown once; "Allow" is remembered so the disclosure never nags again. A decline
// is NOT persisted (GPS is a core feature) — it's suppressed for the session and
// re-offered next launch, so a mis-tap never permanently disables distances.
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const FG_CONSENT_KEY = "foreai.fgLocConsent.v1";

let declinedThisSession = false;
let inFlight: Promise<boolean> | null = null;

// Resolves true once the player has seen and accepted the in-app disclosure, so
// the caller may then request the OS location permission. Call this IMMEDIATELY
// before Location.requestForegroundPermissionsAsync().
export async function ensureForegroundLocationConsent(): Promise<boolean> {
  try {
    if ((await AsyncStorage.getItem(FG_CONSENT_KEY)) === "granted") return true;
  } catch {
    // storage unreadable — fall through and ask
  }
  if (declinedThisSession) return false;
  // Collapse concurrent callers (several screens request location at once) onto
  // a single dialog instead of stacking one per caller.
  if (inFlight) return inFlight;
  inFlight = new Promise<boolean>((resolve) => {
    Alert.alert(
      "ForeAi uses your location",
      "ForeAi collects and uses your device location to:\n\n" +
        "• show GPS distances to the front, middle and back of each green and map the hole you're playing;\n" +
        "• give you local weather; and\n" +
        "• during a golf day you've joined, share your live position with the organiser's clubhouse leaderboard so the event can follow play.\n\n" +
        "Location is used only for these features — never for advertising. You can change this any time in your device settings.",
      [
        { text: "Not now", style: "cancel", onPress: () => { declinedThisSession = true; resolve(false); } },
        {
          text: "Allow",
          onPress: () => {
            AsyncStorage.setItem(FG_CONSENT_KEY, "granted").catch(() => {});
            resolve(true);
          },
        },
      ],
      { cancelable: false }
    );
  }).finally(() => {
    inFlight = null;
  });
  return inFlight;
}
