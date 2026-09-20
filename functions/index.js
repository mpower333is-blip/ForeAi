// ForeAi Cloud Functions.
//
// Real push for open-game invites: when a member is invited to a game
// (a doc is created at clubs/{clubKey}/invites/{inviteId}), push a notification
// to the invited member's device(s) so they see it even when the app is closed.
//
// Delivery goes through Expo's push service (https://exp.host), which relays to
// APNs (iOS) and FCM (Android) using the credentials configured on the Expo
// project — so this function never touches Apple/Google keys directly. The app
// registers each member's Expo push token at clubs/{clubKey}/pushTokens/{memberId}.
//
// Deploy:  firebase deploy --only functions   (needs the Blaze plan)
// See docs/push-invites-setup.md for the one-time Expo/EAS setup.

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const EXPO_ENDPOINT = "https://exp.host/--/api/v2/push/send";

function isExpoToken(t) {
  return typeof t === "string" && (t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken["));
}

// POST the messages to Expo (batches of 100) and return the tokens Expo reports
// as permanently invalid (DeviceNotRegistered) so we can prune them.
async function sendExpo(messages) {
  const valid = messages.filter((m) => isExpoToken(m.to));
  const invalidTokens = [];
  for (let i = 0; i < valid.length; i += 100) {
    const batch = valid.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_ENDPOINT, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });
      if (!res.ok) {
        console.error("Expo push HTTP error:", res.status, await res.text().catch(() => ""));
        continue;
      }
      const json = await res.json();
      const tickets = Array.isArray(json && json.data) ? json.data : [];
      tickets.forEach((ticket, idx) => {
        if (ticket && ticket.status === "error") {
          const err = ticket.details && ticket.details.error;
          if (err === "DeviceNotRegistered") invalidTokens.push(batch[idx].to);
          else console.error("Expo push ticket error:", err, ticket.message);
        }
      });
    } catch (e) {
      console.error("Expo push send failed:", e);
    }
  }
  return invalidTokens;
}

function teeLabel(iso) {
  if (!iso) return "a tee time";
  try {
    return new Date(iso).toLocaleString("en-ZA", {
      weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "a tee time";
  }
}

exports.onGameInviteCreated = onDocumentCreated("clubs/{clubKey}/invites/{inviteId}", async (event) => {
  const snap = event.data;
  if (!snap) return;
  const inv = snap.data() || {};
  if (inv.status && inv.status !== "pending") return;

  const clubKey = event.params.clubKey;
  const toMemberId = String(inv.toMemberId || "");
  if (!toMemberId) return;

  const tokRef = db.doc(`clubs/${clubKey}/pushTokens/${toMemberId}`);
  const tokSnap = await tokRef.get();
  if (!tokSnap.exists) return;
  const tokens = Array.isArray(tokSnap.data().tokens) ? tokSnap.data().tokens : [];
  if (tokens.length === 0) return;

  const body = `${inv.fromName || "A member"} invited you to a game — ${teeLabel(inv.teeAt)}. Tap to join.`;
  const messages = tokens.map((t) => ({
    to: t,
    sound: "default",
    title: "Golf invite ⛳",
    body,
    priority: "high",
    channelId: "default",
    data: { type: "gameInvite", clubKey, gameId: inv.gameId || null, inviteId: event.params.inviteId },
  }));

  const invalid = await sendExpo(messages);
  if (invalid.length > 0) {
    await tokRef.update({ tokens: FieldValue.arrayRemove(...invalid) }).catch(() => {});
  }
});
