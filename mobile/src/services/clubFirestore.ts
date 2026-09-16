// Firestore implementation of the club features (membership + tee sheet,
// competitions, news) — the cutover target for retiring Render, mirroring the
// member-facing surface of membershipApi / competitionsApi / newsApi.
//
// NOT WIRED unless the app is built with EXPO_PUBLIC_USE_FIRESTORE=1 — each of
// those three service files selects this only under that flag (dead-code-
// eliminated otherwise), exactly like tournamentApi ↔ tournamentFirestore.
//
// Only the MEMBER-FACING operations live here (look up / claim a card, tee-sheet
// slots + book/cancel, competition list/detail/enter/withdraw/score, news
// list/item). Admin/office operations (roster CRUD, imports, HNA sync, creating
// competitions, blocking slots) are done on the web office pages, not the app.
//
// Slot generation and leaderboard scoring are ported from the backend
// (routes/bookings.ts and routes/competitions.ts + lib/scoring.ts) so results
// match Render exactly — the scoring port (lib/compScoring.ts) is verified
// against the server file with a differential test.
//
// Model (matches firestore.rules — clubs/{clubKey}/...):
//   clubs/{clubKey}                                   settings (public read)
//   clubs/{clubKey}/members/{memberId}                roster
//   clubs/{clubKey}/bookings/{bookingId}              tee bookings (teeMs keyed)
//   clubs/{clubKey}/competitions/{compId}             competition meta + card
//   clubs/{clubKey}/competitions/{compId}/entries/{}  entries (holeScores)
//   clubs/{clubKey}/notices/{noticeId}                noticeboard

import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, query, where,
} from "firebase/firestore";
import { firestore, ensureSignedIn } from "./firebase";
import { CLUB } from "../config/appVariant";
import { scoreRound, countback, courseHandicap, playingHandicap, cardFor } from "../lib/compScoring";
import type { MemberCard, ClubInfo, DaySheet, Slot, Booking } from "./membershipApi";
import type { CompetitionSummary, CompetitionDetail, CompEntry, LeaderRow } from "./competitionsApi";
import type { Notice } from "./newsApi";

const db = () => firestore();
const CK = () => CLUB || "kempton";
const clubRef = () => doc(db(), "clubs", CK());
const clubCol = (name: string) => collection(db(), "clubs", CK(), name);

// ---- club-local time (South Africa, UTC+2, no DST) — ported from bookings.ts -
const SAST = "+02:00";
const pad = (n: number) => String(n).padStart(2, "0");
function slotMs(dateStr: string, minute: number): number {
  const h = Math.floor(minute / 60), m = minute % 60;
  return new Date(`${dateStr}T${pad(h)}:${pad(m)}:00${SAST}`).getTime();
}
function dayBounds(dateStr: string): [number, number] {
  const start = new Date(`${dateStr}T00:00:00${SAST}`).getTime();
  return [start, start + 24 * 3600 * 1000];
}
function weekday(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00${SAST}`).getUTCDay();
}
const timeLabel = (minute: number) => `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
function todayStrSAST(): string {
  return new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);
}

// ---- settings --------------------------------------------------------------
const SETTINGS_DEFAULTS = {
  name: CK().charAt(0).toUpperCase() + CK().slice(1),
  courseId: "",
  firstTeeMin: 360,
  lastTeeMin: 960,
  intervalMin: 10,
  slotCapacity: 4,
  bookingWindowDays: 14,
  openDays: "0,1,2,3,4,5,6",
};
async function settings(): Promise<typeof SETTINGS_DEFAULTS & { hasAdminPin?: boolean }> {
  const s = await getDoc(clubRef());
  return s.exists() ? { ...SETTINGS_DEFAULTS, ...(s.data() as any) } : { ...SETTINGS_DEFAULTS };
}

function memberCard(id: string, m: any): MemberCard {
  return {
    id, clubKey: CK(), memberNumber: m.memberNumber, firstName: m.firstName, lastName: m.lastName,
    category: m.category ?? "member", status: m.status ?? "active",
    handicapIndex: m.handicapIndex ?? null, handicapSyncedAt: m.handicapSyncedAt ?? null, photo: m.photo ?? null,
  };
}

// ---- membership + tee sheet ------------------------------------------------
export const membershipFsApi = {
  club: async (): Promise<ClubInfo> => {
    const s = await settings();
    return {
      clubKey: CK(), name: s.name, courseId: s.courseId, firstTeeMin: s.firstTeeMin, lastTeeMin: s.lastTeeMin,
      intervalMin: s.intervalMin, slotCapacity: s.slotCapacity, bookingWindowDays: s.bookingWindowDays,
      openDays: s.openDays, hasAdminPin: !!s.hasAdminPin,
    };
  },

  lookup: async (params: { number?: string; email?: string }): Promise<MemberCard> => {
    await ensureSignedIn();
    if (!params.number && !params.email) throw new Error("Provide number or email");
    let snap;
    if (params.number) {
      snap = await getDocs(query(clubCol("members"), where("memberNumber", "==", String(params.number).trim())));
    } else {
      const email = String(params.email).trim().toLowerCase();
      const all = await getDocs(clubCol("members"));
      const hit = all.docs.find((d) => String((d.data() as any).email ?? "").toLowerCase() === email);
      if (!hit) throw new Error("No member found");
      return memberCard(hit.id, hit.data());
    }
    if (snap.empty) throw new Error("No member found");
    return memberCard(snap.docs[0].id, snap.docs[0].data());
  },

  claim: async (body: { memberNumber: string; email?: string; lastName?: string; deviceId?: string }): Promise<MemberCard> => {
    await ensureSignedIn();
    if (!body.memberNumber) throw new Error("memberNumber required");
    const snap = await getDocs(query(clubCol("members"), where("memberNumber", "==", String(body.memberNumber).trim())));
    if (snap.empty) throw new Error("No member with that number");
    const d = snap.docs[0];
    const m: any = d.data();
    const okEmail = body.email && m.email && String(body.email).trim().toLowerCase() === String(m.email).toLowerCase();
    const okName = body.lastName && String(body.lastName).trim().toLowerCase() === String(m.lastName).toLowerCase();
    if (!okEmail && !okName) throw new Error("Details don't match our records");
    if (body.deviceId) await updateDoc(d.ref, { deviceId: String(body.deviceId) });
    return memberCard(d.id, m);
  },

  slots: async (date: string): Promise<DaySheet> => {
    const s = await settings();
    const day = (date || todayStrSAST()).slice(0, 10);
    const openDays = String(s.openDays).split(",").map((x) => Number(x.trim()));
    const open = openDays.includes(weekday(day));
    const [start, end] = dayBounds(day);
    // Range on teeMs only (no composite index); filter status in memory.
    const snap = await getDocs(query(clubCol("bookings"), where("teeMs", ">=", start), where("teeMs", "<", end)));

    const byMs = new Map<number, { seats: number; names: string[]; blocked: boolean }>();
    snap.forEach((docSnap) => {
      const b: any = docSnap.data();
      if (b.status !== "booked" && b.status !== "blocked") return;
      const ms = b.teeMs;
      const g = byMs.get(ms) ?? { seats: 0, names: [], blocked: false };
      if (b.status === "blocked") g.blocked = true;
      g.seats += b.partySize ?? 1;
      const names = Array.isArray(b.players) ? b.players.map(String) : [];
      if (names.length) g.names.push(...names);
      byMs.set(ms, g);
    });

    const slots: Slot[] = [];
    for (let minute = s.firstTeeMin; minute <= s.lastTeeMin; minute += s.intervalMin) {
      const ms = slotMs(day, minute);
      const g = byMs.get(ms);
      const seats = g?.seats ?? 0;
      slots.push({
        minute, time: timeLabel(minute), teeAt: new Date(ms).toISOString(), capacity: s.slotCapacity,
        booked: seats, available: g?.blocked ? 0 : Math.max(0, s.slotCapacity - seats), blocked: !!g?.blocked, names: g?.names ?? [],
      });
    }
    return { date: day, open, courseId: s.courseId, bookingWindowDays: s.bookingWindowDays, slotCapacity: s.slotCapacity, slots };
  },

  myBookings: async (memberId: string): Promise<Booking[]> => {
    if (!memberId) throw new Error("memberId required");
    await ensureSignedIn();
    const snap = await getDocs(query(clubCol("bookings"), where("memberId", "==", memberId)));
    const now = Date.now();
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((b) => b.status === "booked" && (b.teeMs ?? 0) >= now)
      .sort((a, b) => (a.teeMs ?? 0) - (b.teeMs ?? 0))
      .map((b) => bookingOut(b.id, b));
  },

  book: async (body: { memberId: string; date: string; minute: number; partySize?: number; players?: string[]; note?: string }): Promise<Booking> => {
    await ensureSignedIn();
    const s = await settings();
    const memberId = body.memberId ? String(body.memberId) : "";
    const date = body.date ? String(body.date).slice(0, 10) : "";
    const minute = Number(body.minute);
    const partySize = Math.max(1, Math.min(s.slotCapacity, Number(body.partySize) || 1));
    if (!memberId || !date || !Number.isFinite(minute)) throw new Error("memberId, date and minute required");

    const mSnap = await getDoc(doc(clubCol("members"), memberId));
    if (!mSnap.exists()) throw new Error("Member not found");
    const member: any = mSnap.data();
    if (member.status !== "active") throw new Error("Membership is not active");

    const aligned = minute >= s.firstTeeMin && minute <= s.lastTeeMin && (minute - s.firstTeeMin) % s.intervalMin === 0;
    if (!aligned) throw new Error("Not a valid tee time");
    const openDays = String(s.openDays).split(",").map((x) => Number(x.trim()));
    if (!openDays.includes(weekday(date))) throw new Error("The course is closed that day");
    const today = todayStrSAST();
    const daysAhead = Math.round((slotMs(date, 0) - slotMs(today, 0)) / 86400000);
    if (daysAhead < 0) throw new Error("That day has passed");
    if (daysAhead > s.bookingWindowDays) throw new Error(`Bookings open ${s.bookingWindowDays} days ahead`);

    const ms = slotMs(date, minute);
    // Capacity check (read-then-create, matching the backend's own non-atomic check).
    const existingSnap = await getDocs(query(clubCol("bookings"), where("teeMs", "==", ms)));
    const existing = existingSnap.docs.map((d) => d.data() as any).filter((e) => e.status === "booked" || e.status === "blocked");
    if (existing.some((e) => e.status === "blocked")) throw new Error("That slot is blocked");
    if (existing.some((e) => e.memberId === memberId)) throw new Error("You already have this slot");
    const seats = existing.reduce((n, e) => n + (e.partySize ?? 1), 0);
    if (seats + partySize > s.slotCapacity) throw new Error(`Only ${s.slotCapacity - seats} seat(s) left in that slot`);

    const players = Array.isArray(body.players) && body.players.length
      ? body.players.map(String).slice(0, partySize)
      : [`${member.firstName} ${member.lastName}`];

    const rec = {
      teeMs: ms, teeAt: new Date(ms).toISOString(), courseId: s.courseId, memberId, partySize, players,
      note: body.note ? String(body.note) : null, status: "booked", createdAt: Date.now(),
    };
    const ref = await addDoc(clubCol("bookings"), rec);
    return bookingOut(ref.id, rec);
  },

  cancel: async (id: string, memberId: string): Promise<Booking> => {
    await ensureSignedIn();
    const ref = doc(clubCol("bookings"), id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("Booking not found");
    const b: any = snap.data();
    if (String(memberId) !== b.memberId) throw new Error("Not allowed to cancel this booking");
    await updateDoc(ref, { status: "cancelled" });
    return bookingOut(id, { ...b, status: "cancelled" });
  },
};

function bookingOut(id: string, b: any): Booking {
  return {
    id, clubKey: CK(), teeAt: b.teeAt ?? new Date(b.teeMs ?? Date.now()).toISOString(), courseId: b.courseId ?? "",
    memberId: b.memberId ?? null, partySize: b.partySize ?? 1, players: Array.isArray(b.players) ? b.players : null,
    note: b.note ?? null, status: b.status ?? "booked",
  };
}

// ---- competitions ----------------------------------------------------------
const parTotal = (pars: number[]) => pars.reduce((a, b) => a + (b || 0), 0);
// A competition stores its own card (pars/sis); fall back to the club card if a
// doc is ever missing them, so scoring never indexes undefined.
function compCard(comp: any) {
  const fb = cardFor(CK());
  return { pars: Array.isArray(comp.pars) && comp.pars.length === 18 ? comp.pars : fb.pars,
           sis: Array.isArray(comp.sis) && comp.sis.length === 18 ? comp.sis : fb.sis };
}

function compSummary(id: string, c: any, entryCount: number): CompetitionSummary {
  return {
    id, name: c.name, date: c.date, format: c.format, courseId: c.courseId ?? "", status: c.status ?? "open",
    handicapAllowance: c.handicapAllowance ?? 95, description: c.description ?? null, entryCount,
  };
}

// Recompute a leaderboard from stored per-hole scores — ported from
// competitions.ts (same sort + WHS countback).
function buildLeaderboard(comp: any, entries: { id: string; data: any }[]): LeaderRow[] {
  const card = compCard(comp);
  const stab = comp.format === "stableford";
  const rows = entries
    .filter((e) => e.data.status !== "withdrawn")
    .map((e) => ({ e, ...scoreRound(e.data.holeScores || [], card, e.data.playingHandicap ?? 0) }));

  rows.sort((a, b) => {
    if ((a.holesIn > 0) !== (b.holesIn > 0)) return a.holesIn > 0 ? -1 : 1;
    if (stab) {
      if (b.stableford !== a.stableford) return b.stableford - a.stableford;
      const ca = countback(a.ptsPerHole), cb = countback(b.ptsPerHole);
      for (let i = 0; i < 4; i++) if (cb[i] !== ca[i]) return cb[i] - ca[i];
    } else {
      if (a.net !== b.net) return a.net - b.net;
      const ca = countback(a.netPerHole), cb = countback(b.netPerHole);
      for (let i = 0; i < 4; i++) if (ca[i] !== cb[i]) return ca[i] - cb[i];
    }
    return 0;
  });

  return rows.map((r, i) => ({
    pos: r.holesIn > 0 ? i + 1 : null, entryId: r.e.id, memberId: r.e.data.memberId ?? null,
    name: r.e.data.playerName, playingHandicap: r.e.data.playingHandicap ?? 0, handicapIndex: r.e.data.handicapIndex ?? null,
    gross: r.gross, net: r.net, stableford: r.stableford, thru: r.holesIn, status: r.e.data.status ?? "entered",
  }));
}

function entryOut(id: string, e: any): CompEntry {
  return {
    id, memberId: e.memberId ?? null, playerName: e.playerName, handicapIndex: e.handicapIndex ?? null,
    playingHandicap: e.playingHandicap ?? 0, holeScores: e.holeScores || [], grossTotal: e.grossTotal ?? null,
    netTotal: e.netTotal ?? null, stableford: e.stableford ?? null, status: e.status ?? "entered",
  };
}

async function loadComp(id: string) {
  const cSnap = await getDoc(doc(clubCol("competitions"), id));
  if (!cSnap.exists()) return null;
  const entriesSnap = await getDocs(collection(db(), "clubs", CK(), "competitions", id, "entries"));
  const entries = entriesSnap.docs.map((d) => ({ id: d.id, data: d.data() as any }));
  return { comp: cSnap.data() as any, entries };
}

export const competitionsFsApi = {
  list: async (status?: string): Promise<CompetitionSummary[]> => {
    const snap = await getDocs(clubCol("competitions"));
    const rows = await Promise.all(
      snap.docs.map(async (d) => {
        const c: any = d.data();
        const cnt = (await getDocs(collection(db(), "clubs", CK(), "competitions", d.id, "entries"))).size;
        return { id: d.id, c, cnt };
      })
    );
    return rows
      .filter((r) => r.c.status !== "draft" && (!status || r.c.status === status))
      .sort((a, b) => String(b.c.date).localeCompare(String(a.c.date)))
      .map((r) => compSummary(r.id, r.c, r.cnt));
  },

  detail: async (id: string, memberId?: string): Promise<CompetitionDetail> => {
    const loaded = await loadComp(id);
    if (!loaded) throw new Error("Competition not found");
    const { comp, entries } = loaded;
    const mine = memberId ? entries.find((e) => e.data.memberId === memberId) ?? null : null;
    return {
      ...compSummary(id, comp, entries.length), pars: compCard(comp).pars, sis: compCard(comp).sis,
      leaderboard: buildLeaderboard(comp, entries), myEntry: mine ? entryOut(mine.id, mine.data) : null,
    };
  },

  enter: async (id: string, memberId: string): Promise<CompEntry> => {
    await ensureSignedIn();
    const cSnap = await getDoc(doc(clubCol("competitions"), id));
    if (!cSnap.exists()) throw new Error("Competition not found");
    const comp: any = cSnap.data();
    if (comp.status !== "open") throw new Error("Entries are closed for this competition");

    const mSnap = await getDoc(doc(clubCol("members"), memberId));
    if (!mSnap.exists()) throw new Error("Member not found");
    const m: any = mSnap.data();
    if (m.status !== "active") throw new Error("Membership is not active");

    const entriesCol = collection(db(), "clubs", CK(), "competitions", id, "entries");
    const dupSnap = await getDocs(query(entriesCol, where("memberId", "==", memberId)));
    if (!dupSnap.empty) {
      const dup = dupSnap.docs[0];
      if ((dup.data() as any).status !== "withdrawn") throw new Error("You're already entered");
      await updateDoc(dup.ref, { status: "entered" });
      return entryOut(dup.id, { ...(dup.data() as any), status: "entered" });
    }

    const index = m.handicapIndex ?? null;
    const ch = index != null ? courseHandicap(index, comp.slope ?? 113, comp.courseRating ?? undefined, parTotal(compCard(comp).pars)) : 0;
    const ph = playingHandicap(ch, comp.handicapAllowance ?? 95);
    const rec = {
      memberId, playerName: `${m.firstName} ${m.lastName}`, handicapIndex: index, playingHandicap: ph,
      holeScores: [], grossTotal: null, netTotal: null, stableford: null, status: "entered", createdAt: Date.now(),
    };
    const ref = await addDoc(entriesCol, rec);
    return entryOut(ref.id, rec);
  },

  withdraw: async (id: string, memberId: string): Promise<{ ok: boolean }> => {
    await ensureSignedIn();
    const entriesCol = collection(db(), "clubs", CK(), "competitions", id, "entries");
    const snap = await getDocs(query(entriesCol, where("memberId", "==", memberId)));
    if (snap.empty) throw new Error("Entry not found");
    await updateDoc(snap.docs[0].ref, { status: "withdrawn" });
    return { ok: true };
  },

  submitScore: async (id: string, memberId: string, holeScores: number[]): Promise<{ entry: CompEntry; result: any }> => {
    await ensureSignedIn();
    const cSnap = await getDoc(doc(clubCol("competitions"), id));
    if (!cSnap.exists()) throw new Error("Competition not found");
    const comp: any = cSnap.data();

    const scores: number[] = Array.isArray(holeScores) ? holeScores.map((x) => Number(x) || 0).slice(0, 18) : [];
    while (scores.length < 18) scores.push(0);

    const entriesCol = collection(db(), "clubs", CK(), "competitions", id, "entries");
    const snap = await getDocs(query(entriesCol, where("memberId", "==", memberId)));
    if (snap.empty) throw new Error("Entry not found — enter the competition first");
    const entryDoc = snap.docs[0];
    const entry: any = entryDoc.data();

    const r = scoreRound(scores, compCard(comp), entry.playingHandicap ?? 0);
    const patch = {
      holeScores: scores, grossTotal: r.gross || null, netTotal: r.holesIn ? r.net : null,
      stableford: r.holesIn ? r.stableford : null, status: r.holesIn >= 18 ? "submitted" : "entered",
    };
    await updateDoc(entryDoc.ref, patch);
    return { entry: entryOut(entryDoc.id, { ...entry, ...patch }), result: r };
  },
};

// ---- news ------------------------------------------------------------------
function noticeOut(id: string, n: any): Notice {
  return {
    id, clubKey: CK(), title: n.title, body: n.body, category: n.category ?? "news", pinned: !!n.pinned,
    image: n.image ?? null, authorName: n.authorName ?? null, status: n.status ?? "published",
    publishAt: n.publishAt ?? new Date().toISOString(),
  };
}

export const newsFsApi = {
  list: async (): Promise<Notice[]> => {
    const snap = await getDocs(clubCol("notices"));
    const now = Date.now();
    const pubMs = (n: any) => {
      const t = typeof n.publishAt === "number" ? n.publishAt : Date.parse(n.publishAt ?? "");
      return Number.isFinite(t) ? t : 0;
    };
    return snap.docs
      .map((d) => ({ id: d.id, data: d.data() as any }))
      .filter((x) => (x.data.status ?? "published") === "published" && pubMs(x.data) <= now)
      .sort((a, b) => {
        const pin = (b.data.pinned ? 1 : 0) - (a.data.pinned ? 1 : 0);
        return pin !== 0 ? pin : pubMs(b.data) - pubMs(a.data);
      })
      .slice(0, 100)
      .map((x) => noticeOut(x.id, x.data));
  },

  item: async (id: string): Promise<Notice> => {
    const snap = await getDoc(doc(clubCol("notices"), id));
    if (!snap.exists()) throw new Error("Notice not found");
    return noticeOut(id, snap.data());
  },
};
