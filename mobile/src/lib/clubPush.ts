import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { membershipApi } from "../services/membershipApi";

// Registers this device's Expo push token against the linked member so the
// Cloud Function (functions/index.js) can push open-game invites to their phone
// even when the app is closed.
//
// Fail-soft by design: if the Expo projectId isn't configured yet (see
// docs/push-invites-setup.md), or the player denies notifications, or on an iOS
// build without the push entitlement, this no-ops — the in-app invites inbox on
// the Open Games screen still works. Nothing breaks; phone push just isn't active
// until the Expo project is set up.

function projectId(): string | undefined {
  const e: any = Constants?.expoConfig?.extra ?? (Constants as any)?.manifest?.extra;
  return e?.eas?.projectId || process.env.EXPO_PUBLIC_EAS_PROJECT_ID || undefined;
}

// Don't re-register the same member on every mount.
let lastMemberId: string | null = null;

export async function registerInvitePush(memberId: string): Promise<void> {
  if (!memberId || memberId === lastMemberId) return;
  try {
    const pid = projectId();
    if (!pid) return; // Expo project not configured yet — in-app inbox still works

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== "granted") return;

    const tokenResp = await Notifications.getExpoPushTokenAsync({ projectId: pid });
    const token = tokenResp.data;
    if (!token) return;

    await membershipApi.savePushToken(memberId, token, Platform.OS);
    lastMemberId = memberId;
  } catch {
    // No projectId/credentials/entitlement, or offline — silently keep the
    // in-app invites inbox as the fallback.
  }
}
