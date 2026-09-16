// Minimal Expo Push client. We send notifications through Expo's push service
// (https://docs.expo.dev/push-notifications/sending-notifications/), which
// relays to APNs (iOS) and FCM (Android) using the credentials configured on
// the Expo project — so the backend never touches Apple/Google keys directly.
// No SDK dependency: it's a single HTTPS POST of up to 100 messages per call.

export type ExpoPushMessage = {
  to: string; // ExponentPushToken[...]
  title: string;
  body: string;
  sound?: "default" | null;
  priority?: "default" | "normal" | "high";
  channelId?: string; // Android notification channel
  data?: Record<string, unknown>;
};

const ENDPOINT = "https://exp.host/--/api/v2/push/send";

function isExpoToken(t: string): boolean {
  return typeof t === "string" && (t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken["));
}

// Returns the tokens Expo reports as permanently invalid (DeviceNotRegistered),
// so the caller can prune them from the database.
export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<{ invalidTokens: string[] }> {
  const valid = messages.filter((m) => isExpoToken(m.to));
  const invalidTokens: string[] = [];

  for (let i = 0; i < valid.length; i += 100) {
    const batch = valid.slice(i, i + 100);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch),
      });
      if (!res.ok) {
        console.error("Expo push HTTP error:", res.status, await res.text().catch(() => ""));
        continue;
      }
      const json: any = await res.json();
      const tickets: any[] = Array.isArray(json?.data) ? json.data : [];
      tickets.forEach((ticket, idx) => {
        if (ticket?.status === "error") {
          const err = ticket?.details?.error;
          if (err === "DeviceNotRegistered") invalidTokens.push(batch[idx].to);
          else console.error("Expo push ticket error:", err, ticket?.message);
        }
      });
    } catch (e) {
      console.error("Expo push send failed:", e);
    }
  }

  return { invalidTokens };
}
