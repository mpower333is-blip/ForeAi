import { db } from "./firebaseAdmin";

// Mirror event state into Firestore so realtime readers (the live course map,
// and later the board and app) can subscribe instead of polling. Postgres stays
// the source of truth; these writes are fire-and-forget and never block or fail
// a request. No-ops entirely when Firestore isn't configured.

type SerializedEvent = {
  id: string;
  code: string;
  name: string;
  courseId: string;
  format?: string;
  players: { id: string; name: string; handicap: number; groupId: string | null; lat: number | null; lng: number | null; lastSeen: number | null }[];
};

// The full event meta + roster (players without live positions — those live in
// the positions subcollection so a single player's move is one cheap write).
export function mirrorEvent(ev: SerializedEvent): void {
  if (!db) return;
  const database = db;
  (async () => {
    try {
      await database.collection("events").doc(ev.id).set(
        {
          id: ev.id,
          code: ev.code,
          name: ev.name,
          courseId: ev.courseId,
          format: ev.format ?? null,
          players: ev.players.map((p) => ({ id: p.id, name: p.name, handicap: p.handicap, groupId: p.groupId })),
          updatedAt: Date.now(),
        },
        { merge: true }
      );
      if (ev.code) await database.collection("eventCodes").doc(ev.code).set({ eventId: ev.id });
    } catch (e) {
      console.error("[firestore] mirrorEvent failed", e);
    }
  })();
}

// One player's live position — a single small write per heartbeat.
export function mirrorPosition(eventId: string, p: { id: string; name?: string | null; lat: number | null; lng: number | null; lastSeen?: number | null }): void {
  if (!db) return;
  const database = db;
  (async () => {
    try {
      await database
        .collection("events").doc(eventId)
        .collection("positions").doc(p.id)
        .set({ id: p.id, name: p.name ?? null, lat: p.lat, lng: p.lng, lastSeen: p.lastSeen ?? Date.now() }, { merge: true });
    } catch (e) {
      console.error("[firestore] mirrorPosition failed", e);
    }
  })();
}
