// Firestore implementation of the tournament (events) API — the cutover target
// for retiring Render. Same method surface as tournamentApi (REST), so it is a
// drop-in: each mutation writes the one doc it changes and then re-assembles the
// full TEvent (the app polls get()/getByCode(), so this stays compatible).
//
// WIRING: tournamentApi.ts selects this module only when the app is built with
// EXPO_PUBLIC_USE_FIRESTORE=1 (the coordinated flip build). Because that env var
// is inlined at build time, the require() there is dead-code-eliminated from
// every normal build, so this module — and the firebase SDK — is not bundled and
// the current ForeAi / Kempton builds are unchanged. See
// docs/render-firebase-cutover.md.
//
// Model (native subcollections, see firestore.rules):
//   events/{id}                                 meta
//   events/{id}/players/{playerId}              {name,handicap,deviceId,groupId}
//   events/{id}/positions/{playerId}            {lat,lng,lastSeen} (GPS heartbeat)
//   events/{id}/groups/{groupId}                {order}
//   events/{id}/scores/{playerId_hole}          {playerId,hole,strokes}
//   events/{id}/contests/{contestId}            {type,hole}
//   events/{id}/contests/{contestId}/results/{playerId}  {value}
//   events/{id}/sponsors/{sponsorId}            {name,tier,hole,message,logo}
//   eventCodes/{CODE} -> {eventId}              join-code lookup (unique doc id)

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, query, where,
} from "firebase/firestore";
import { firestore, ensureSignedIn, auth } from "./firebase";
import { TEvent, TPlayer, TGroup, Contest, Sponsor } from "../lib/tournament";

const db = () => firestore();
const evRef = (id: string) => doc(db(), "events", id);
const col = (id: string, name: string) => collection(db(), "events", id, name);

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeCode(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return out;
}

// Read the event doc + every subcollection and build the TEvent the app uses.
async function assembleEvent(id: string): Promise<TEvent | null> {
  const evSnap = await getDoc(evRef(id));
  if (!evSnap.exists()) return null;
  const d: any = evSnap.data();

  const [playersSnap, posSnap, groupsSnap, scoresSnap, contestsSnap, sponsorsSnap] = await Promise.all([
    getDocs(col(id, "players")),
    getDocs(col(id, "positions")),
    getDocs(col(id, "groups")),
    getDocs(col(id, "scores")),
    getDocs(col(id, "contests")),
    getDocs(col(id, "sponsors")),
  ]);

  const pos: Record<string, any> = {};
  posSnap.forEach((s) => (pos[s.id] = s.data()));

  const players: TPlayer[] = playersSnap.docs.map((s) => {
    const p: any = s.data();
    const pp: any = pos[s.id] || {};
    return {
      id: s.id, name: p.name, handicap: p.handicap ?? 0, deviceId: p.deviceId ?? null, groupId: p.groupId ?? null,
      lastSeen: pp.lastSeen ?? null, lat: pp.lat ?? null, lng: pp.lng ?? null,
    };
  });

  const groups: TGroup[] = groupsSnap.docs
    .map((s) => ({ id: s.id, order: (s.data() as any).order ?? 0 }))
    .sort((a, b) => a.order - b.order)
    .map((g) => ({ id: g.id, playerIds: players.filter((p) => p.groupId === g.id).map((p) => p.id) }));

  const scores: Record<string, Record<number, number>> = {};
  scoresSnap.forEach((s) => {
    const x: any = s.data();
    (scores[x.playerId] ||= {})[x.hole] = x.strokes;
  });

  const contests: Contest[] = [];
  const contestResults: Record<string, Record<string, number>> = {};
  await Promise.all(
    contestsSnap.docs.map(async (cs) => {
      const c: any = cs.data();
      contests.push({ id: cs.id, type: c.type, hole: c.hole });
      const rs = await getDocs(collection(db(), "events", id, "contests", cs.id, "results"));
      const map: Record<string, number> = {};
      rs.forEach((r) => (map[r.id] = (r.data() as any).value));
      contestResults[cs.id] = map;
    })
  );

  const sponsors: Sponsor[] = sponsorsSnap.docs.map((s) => {
    const x: any = s.data();
    return { id: s.id, name: x.name, tier: x.tier, hole: x.hole ?? null, message: x.message ?? null, logo: x.logo ?? null };
  });

  return {
    id, name: d.name, date: d.date ?? new Date().toISOString(), courseId: d.courseId, format: d.format,
    firstTeeMin: d.firstTeeMin, intervalMin: d.intervalMin, shotgun: !!d.shotgun,
    players, groups, scores, contests, contestResults,
    reminders: d.reminders ?? [], cause: d.cause ?? null, causePhoto: d.causePhoto ?? null,
    sponsors, logo: d.logo ?? null, banking: d.banking ?? null,
    teamFee: d.teamFee ?? null, holeFee: d.holeFee ?? null,
    code: d.code, remote: true,
  } as TEvent;
}

// Delete every doc a query returns, in batches (Firestore has no cascade).
async function deleteWhere(id: string, name: string, field: string, value: string) {
  const snap = await getDocs(query(col(id, name), where(field, "==", value)));
  if (snap.empty) return;
  const batch = writeBatch(db());
  snap.forEach((s) => batch.delete(s.ref));
  await batch.commit();
}

export const tournamentFsApi = {
  create: async (input: {
    name: string; courseId: string; format: string; firstTeeMin: number; intervalMin: number;
    shotgun?: boolean; adminPin?: string | null; playerFee?: number | null;
  }): Promise<TEvent | null> => {
    await ensureSignedIn();
    const uid = auth().currentUser?.uid ?? null;
    const ref = doc(collection(db(), "events"));
    const id = ref.id;
    // Allocate a unique join code (retry on the rare collision).
    let code = makeCode();
    for (let i = 0; i < 5; i++) {
      const c = await getDoc(doc(db(), "eventCodes", code));
      if (!c.exists()) break;
      code = makeCode();
    }
    const now = Date.now();
    await setDoc(ref, {
      id, name: input.name, date: new Date().toISOString(), courseId: input.courseId, format: input.format,
      firstTeeMin: input.firstTeeMin ?? 480, intervalMin: input.intervalMin ?? 10, shotgun: !!input.shotgun,
      code, ownerUid: uid, playerFee: input.playerFee ?? null, createdAt: now, updatedAt: now,
    });
    await setDoc(doc(db(), "eventCodes", code), { eventId: id });
    return assembleEvent(id);
  },

  // PINs are replaced by ownerUid in the Firestore model — this is a no-op that
  // just returns the current event, so existing callers don't break.
  setAdminPin: async (id: string, _pin: string, _currentPin?: string | null) => assembleEvent(id),

  get: (id: string) => assembleEvent(id),

  getByCode: async (code: string): Promise<TEvent | null> => {
    const key = code.trim().toUpperCase();
    const c = await getDoc(doc(db(), "eventCodes", key));
    if (!c.exists()) return null;
    return assembleEvent((c.data() as any).eventId);
  },

  update: async (id: string, patch: Record<string, unknown>): Promise<TEvent | null> => {
    await ensureSignedIn();
    await updateDoc(evRef(id), { ...patch, updatedAt: Date.now() });
    return assembleEvent(id);
  },

  addSponsor: async (id: string, sponsor: { name: string; tier: string; hole?: number | null; message?: string | null; logo?: string | null }) => {
    await ensureSignedIn();
    const ref = doc(col(id, "sponsors"));
    await setDoc(ref, { name: sponsor.name, tier: sponsor.tier, hole: sponsor.hole ?? null, message: sponsor.message ?? null, logo: sponsor.logo ?? null, createdAt: Date.now() });
    return assembleEvent(id);
  },

  removeSponsor: async (id: string, sponsorId: string) => {
    await ensureSignedIn();
    await deleteDoc(doc(col(id, "sponsors"), sponsorId));
    return assembleEvent(id);
  },

  addPlayer: async (id: string, player: { name: string; handicap: number; deviceId?: string; groupId?: string | null }) => {
    await ensureSignedIn();
    const ref = doc(col(id, "players"));
    await setDoc(ref, { name: player.name, handicap: player.handicap ?? 0, deviceId: player.deviceId ?? null, groupId: player.groupId ?? null, createdAt: Date.now() });
    return assembleEvent(id);
  },

  removePlayer: async (id: string, playerId: string) => {
    await ensureSignedIn();
    await deleteDoc(doc(col(id, "players"), playerId));
    await deleteDoc(doc(col(id, "positions"), playerId)).catch(() => {});
    await deleteWhere(id, "scores", "playerId", playerId); // clear that player's scores
    return assembleEvent(id);
  },

  assignPlayer: async (id: string, playerId: string, groupId: string | null) => {
    await ensureSignedIn();
    await updateDoc(doc(col(id, "players"), playerId), { groupId: groupId ?? null });
    return assembleEvent(id);
  },

  // Link (or, with deviceId null, unlink) this device to a player. One phone =
  // one player per event, so clear any prior link for this device first.
  claimPlayer: async (id: string, playerId: string, deviceId: string | null) => {
    await ensureSignedIn();
    if (deviceId) {
      const prior = await getDocs(query(col(id, "players"), where("deviceId", "==", deviceId)));
      const batch = writeBatch(db());
      prior.forEach((s) => { if (s.id !== playerId) batch.update(s.ref, { deviceId: null }); });
      await batch.commit();
    }
    await updateDoc(doc(col(id, "players"), playerId), { deviceId: deviceId ?? null });
    return assembleEvent(id);
  },

  addGroup: async (id: string) => {
    await ensureSignedIn();
    const existing = await getDocs(col(id, "groups"));
    const ref = doc(col(id, "groups"));
    await setDoc(ref, { order: existing.size, createdAt: Date.now() });
    return assembleEvent(id);
  },

  removeGroup: async (id: string, groupId: string) => {
    await ensureSignedIn();
    await deleteDoc(doc(col(id, "groups"), groupId));
    // Unassign any players that were in this group.
    const inGroup = await getDocs(query(col(id, "players"), where("groupId", "==", groupId)));
    const batch = writeBatch(db());
    inGroup.forEach((s) => batch.update(s.ref, { groupId: null }));
    await batch.commit();
    return assembleEvent(id);
  },

  setScore: async (id: string, playerId: string, hole: number, strokes: number) => {
    await ensureSignedIn();
    const ref = doc(col(id, "scores"), `${playerId}_${hole}`);
    if (strokes == null || strokes <= 0) await deleteDoc(ref).catch(() => {});
    else await setDoc(ref, { playerId, hole, strokes, updatedAt: Date.now() });
    return assembleEvent(id);
  },

  addContest: async (id: string, type: string, hole: number) => {
    await ensureSignedIn();
    const ref = doc(col(id, "contests"));
    await setDoc(ref, { type, hole, createdAt: Date.now() });
    return assembleEvent(id);
  },

  removeContest: async (id: string, contestId: string) => {
    await ensureSignedIn();
    const rs = await getDocs(collection(db(), "events", id, "contests", contestId, "results"));
    const batch = writeBatch(db());
    rs.forEach((r) => batch.delete(r.ref));
    batch.delete(doc(col(id, "contests"), contestId));
    await batch.commit();
    return assembleEvent(id);
  },

  setContestResult: async (id: string, contestId: string, playerId: string, value: number) => {
    await ensureSignedIn();
    const ref = doc(collection(db(), "events", id, "contests", contestId, "results"), playerId);
    if (value == null || value <= 0) await deleteDoc(ref).catch(() => {});
    else await setDoc(ref, { value, updatedAt: Date.now() });
    return assembleEvent(id);
  },

  // Heartbeat: mark this player live and optionally share GPS. Returns quickly.
  ping: async (id: string, playerId: string, coord?: { lat: number; lng: number }) => {
    try {
      await ensureSignedIn();
      await setDoc(
        doc(col(id, "positions"), playerId),
        { lastSeen: Date.now(), ...(coord && typeof coord.lat === "number" ? { lat: coord.lat, lng: coord.lng } : {}) },
        { merge: true }
      );
      return { ok: true };
    } catch {
      return { ok: false };
    }
  },
};
