import { db } from "./firebaseAdmin";

// Mirror event state into Firestore so realtime readers (the live course map,
// and later the board and app) can subscribe instead of polling. Postgres stays
// the source of truth; these writes are fire-and-forget and never block or fail
// a request. No-ops entirely when Firestore isn't configured.

// The full serialized event, as produced by tournaments.ts `serialize()`. This
// is the read-model the clubhouse board and live map subscribe to.
type SerializedEvent = {
  id: string;
  code: string;
  name: string;
  courseId: string;
  format?: string | null;
  firstTeeMin?: number | null;
  intervalMin?: number | null;
  shotgun?: boolean | null;
  cause?: string | null;
  causePhoto?: string | null;
  logo?: string | null;
  players: { id: string; name: string; handicap: number; groupId: string | null }[];
  groups?: { id: string; playerIds: string[] }[];
  scores?: Record<string, Record<string, number>>;
  contests?: { id: string; type: string; hole: number }[];
  contestResults?: Record<string, Record<string, number>>;
  sponsors?: { id: string; name: string; tier: string; hole: number | null; message: string | null; logo: string | null }[];
};

// Firestore documents are capped at ~1 MB, and the event can carry base64
// `data:` image blobs (cause photo, event/sponsor logos) that would blow that
// cap and aren't needed for a realtime scoreboard. Keep short http(s) URLs,
// drop inline data URIs — the board fetches the full event (with images) once
// from the backend and overlays the realtime dynamic fields on top.
function slimImage(v: string | null | undefined): string | null {
  if (typeof v !== "string" || !v) return null;
  return v.startsWith("data:") ? null : v;
}

// Mirror the whole event read-model. Full overwrite (not a merge) of the
// document's fields so that removals — a cleared score, a deleted player or
// group — propagate; this does NOT touch the `positions` subcollection, which
// mirrorPosition maintains separately.
export function mirrorEvent(ev: SerializedEvent): void {
  if (!db) return;
  const database = db;
  (async () => {
    try {
      await database.collection("events").doc(ev.id).set({
        id: ev.id,
        code: ev.code,
        name: ev.name,
        courseId: ev.courseId,
        format: ev.format ?? null,
        firstTeeMin: ev.firstTeeMin ?? null,
        intervalMin: ev.intervalMin ?? null,
        shotgun: !!ev.shotgun,
        cause: ev.cause ?? null,
        causePhoto: slimImage(ev.causePhoto),
        logo: slimImage(ev.logo),
        // Roster without live positions (those live in the positions subcollection).
        players: (ev.players || []).map((p) => ({ id: p.id, name: p.name, handicap: p.handicap, groupId: p.groupId })),
        groups: (ev.groups || []).map((g) => ({ id: g.id, playerIds: g.playerIds })),
        scores: ev.scores || {},
        contests: (ev.contests || []).map((c) => ({ id: c.id, type: c.type, hole: c.hole })),
        contestResults: ev.contestResults || {},
        sponsors: (ev.sponsors || []).map((s) => ({ id: s.id, name: s.name, tier: s.tier, hole: s.hole, message: s.message, logo: slimImage(s.logo) })),
        updatedAt: Date.now(),
      });
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
