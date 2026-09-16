// One-off Postgres -> Firestore migration for retiring Render.
//
// Copies a Render Postgres database into the Firestore model documented in
// docs/firestore-data-model.md. Non-destructive and re-runnable: every document
// is written under the source row's id, so re-running overwrites rather than
// duplicates. Run it ONCE PER DATABASE (the ForeAi backend DB holds the events;
// the Kempton backend DB holds the club data) into the SAME Firestore project.
//
// Usage:
//   cd migration && npm install
//   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json   # or FIREBASE_SERVICE_ACCOUNT='{...}'
//   export DATABASE_URL='postgres://…@…render.com/…'                     # a Render DB's External URL
//   node migrate-to-firestore.mjs                                        # add --dry to preview counts only
//
// Notes:
// - AdminUser is NOT migrated: organiser accounts are re-provisioned under their
//   Firebase Auth uid on next sign-in (provisionOrganiser function), so a cuid
//   row can't map to a uid. Migrated events therefore get ownerUid=null (any
//   organiser may manage them — the "legacy event" path in the rules).
// - All timestamps are stored as epoch millis (numbers), matching the realtime
//   read-model the board/live map already use.

import { readFileSync } from "node:fs";
import pg from "pg";
import admin from "firebase-admin";

const DRY = process.argv.includes("--dry");

// ---- Firebase ---------------------------------------------------------------
if (process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
} else {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}
const db = admin.firestore();

// ---- Postgres ---------------------------------------------------------------
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("Set DATABASE_URL to the Render database URL."); process.exit(1); }
const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

// A table may not exist in a given database (e.g. no club data in the ForeAi DB).
async function rows(table) {
  try {
    const r = await pool.query(`SELECT * FROM "${table}"`);
    return r.rows;
  } catch (e) {
    if (String(e.message || e).match(/does not exist/)) { console.log(`  (no "${table}" table — skipping)`); return []; }
    throw e;
  }
}

const ms = (d) => (d ? new Date(d).getTime() : null);
const num = (v) => (v == null ? null : Number(v));

// ---- Batched writer (Firestore commits max 500 ops) -------------------------
class Batcher {
  constructor() { this.batch = db.batch(); this.n = 0; this.total = 0; }
  async set(ref, data) {
    if (DRY) { this.total++; return; }
    this.batch.set(ref, data, { merge: true });
    if (++this.n >= 450) await this.flush();
    this.total++;
  }
  async flush() { if (this.n > 0) { await this.batch.commit(); this.batch = db.batch(); this.n = 0; } }
}

async function main() {
  console.log(`Migrating ${DATABASE_URL.replace(/:[^:@/]+@/, ":****@")}${DRY ? "  (DRY RUN)" : ""}`);
  const w = new Batcher();

  // ===== golfer app data =====================================================
  for (const u of await rows("User")) {
    await w.set(db.collection("users").doc(u.id), { email: u.email ?? null, handicap: num(u.handicap), createdAt: ms(u.createdAt) });
  }
  const roundUser = {};
  for (const r of await rows("Round")) {
    roundUser[r.id] = r.userId;
    await w.set(db.collection("users").doc(r.userId).collection("rounds").doc(r.id),
      { courseName: r.courseName, totalScore: r.totalScore, createdAt: ms(r.createdAt) });
  }
  for (const s of await rows("Shot")) {
    const uid = roundUser[s.roundId]; if (!uid) continue;
    await w.set(db.collection("users").doc(uid).collection("rounds").doc(s.roundId).collection("shots").doc(s.id),
      { hole: s.hole, club: s.club, yardage: s.yardage, lie: s.lie ?? null, wind: s.wind ?? null, elevation: s.elevation ?? null,
        result: s.result, dispersion: s.dispersion ?? null, expectedStrokes: num(s.expectedStrokes), strokesGained: num(s.strokesGained), createdAt: ms(s.createdAt) });
  }
  for (const c of await rows("Club")) {
    await w.set(db.collection("users").doc(c.userId).collection("clubs").doc(c.id),
      { name: c.name, avgCarry: c.avgCarry, dispersion: c.dispersion ?? null, createdAt: ms(c.createdAt) });
  }

  // ===== events (tournaments) ================================================
  for (const t of await rows("Tournament")) {
    await w.set(db.collection("events").doc(t.id), {
      code: t.code, name: t.name, courseId: t.courseId, format: t.format,
      firstTeeMin: t.firstTeeMin, intervalMin: t.intervalMin, shotgun: !!t.shotgun,
      cause: t.cause ?? null, causePhoto: t.causePhoto ?? null, logo: t.logo ?? null,
      banking: t.banking ?? null, teamFee: t.teamFee ?? null, holeFee: t.holeFee ?? null,
      playerFee: t.playerFee ?? null,
      reminders: t.reminders ?? [], ownerUid: null,
      createdAt: ms(t.createdAt), updatedAt: ms(t.updatedAt),
    });
    if (t.code) await w.set(db.collection("eventCodes").doc(t.code), { eventId: t.id });
  }
  for (const p of await rows("TournamentPlayer")) {
    const base = db.collection("events").doc(p.tournamentId);
    await w.set(base.collection("players").doc(p.id),
      { name: p.name, handicap: num(p.handicap), deviceId: p.deviceId ?? null, groupId: p.groupId ?? null, createdAt: ms(p.createdAt) });
    if (p.lat != null && p.lng != null && p.lastSeen) {
      await w.set(base.collection("positions").doc(p.id), { id: p.id, name: p.name, lat: num(p.lat), lng: num(p.lng), lastSeen: ms(p.lastSeen) });
    }
  }
  for (const g of await rows("TournamentGroup")) {
    await w.set(db.collection("events").doc(g.tournamentId).collection("groups").doc(g.id), { order: g.order, createdAt: ms(g.createdAt) });
  }
  for (const s of await rows("TournamentScore")) {
    await w.set(db.collection("events").doc(s.tournamentId).collection("scores").doc(`${s.playerId}_${s.hole}`),
      { playerId: s.playerId, hole: s.hole, strokes: s.strokes, updatedAt: ms(s.updatedAt) });
  }
  const contestEvent = {};
  for (const c of await rows("TournamentContest")) {
    contestEvent[c.id] = c.tournamentId;
    await w.set(db.collection("events").doc(c.tournamentId).collection("contests").doc(c.id), { type: c.type, hole: c.hole, createdAt: ms(c.createdAt) });
  }
  for (const r of await rows("TournamentContestResult")) {
    const eid = contestEvent[r.contestId]; if (!eid) continue;
    await w.set(db.collection("events").doc(eid).collection("contests").doc(r.contestId).collection("results").doc(r.playerId),
      { playerId: r.playerId, value: num(r.value), updatedAt: ms(r.updatedAt) });
  }
  for (const s of await rows("TournamentSponsor")) {
    await w.set(db.collection("events").doc(s.tournamentId).collection("sponsors").doc(s.id),
      { name: s.name, tier: s.tier, hole: s.hole ?? null, message: s.message ?? null, logo: s.logo ?? null, createdAt: ms(s.createdAt) });
  }
  for (const r of await rows("TournamentRegistration")) {
    let payload = r.payload; try { payload = JSON.parse(r.payload); } catch {}
    await w.set(db.collection("events").doc(r.tournamentId).collection("registrations").doc(r.id),
      { type: r.type, company: r.company, regNumber: r.regNumber ?? null, vatNumber: r.vatNumber ?? null,
        address: r.address ?? null, city: r.city ?? null, postalCode: r.postalCode ?? null,
        contactPerson: r.contactPerson ?? null, cell: r.cell ?? null, email: r.email ?? null,
        payload, status: r.status, sponsorId: r.sponsorId ?? null, createdAt: ms(r.createdAt) });
  }
  for (const m of await rows("TournamentShotMark")) {
    await w.set(db.collection("events").doc(m.tournamentId).collection("shotMarks").doc(m.id),
      { playerId: m.playerId, hole: m.hole ?? null, club: m.club ?? null, lat: num(m.lat), lng: num(m.lng), source: m.source, createdAt: ms(m.createdAt) });
  }

  // ===== club data (scoped by clubKey) =======================================
  for (const c of await rows("ClubSettings")) {
    await w.set(db.collection("clubs").doc(c.clubKey), {
      name: c.name, courseId: c.courseId, firstTeeMin: c.firstTeeMin, lastTeeMin: c.lastTeeMin,
      intervalMin: c.intervalMin, slotCapacity: c.slotCapacity, bookingWindowDays: c.bookingWindowDays,
      openDays: c.openDays, createdAt: ms(c.createdAt), updatedAt: ms(c.updatedAt),
    });
  }
  for (const m of await rows("Member")) {
    await w.set(db.collection("clubs").doc(m.clubKey).collection("members").doc(m.id), {
      memberNumber: m.memberNumber, firstName: m.firstName, lastName: m.lastName, email: m.email ?? null, cell: m.cell ?? null,
      category: m.category, status: m.status, joinedAt: ms(m.joinedAt), handicapIndex: num(m.handicapIndex),
      hnaId: m.hnaId ?? null, handicapSyncedAt: m.handicapSyncedAt ? new Date(m.handicapSyncedAt).toISOString() : null, deviceId: m.deviceId ?? null, photo: m.photo ?? null,
      createdAt: ms(m.createdAt), updatedAt: ms(m.updatedAt),
    });
  }
  for (const b of await rows("TeeBooking")) {
    // The tee sheet queries + keys slots by teeMs (epoch millis) and shows teeAt
    // as an ISO string — write BOTH so migrated bookings appear on the sheet.
    const teeMs = ms(b.teeAt);
    await w.set(db.collection("clubs").doc(b.clubKey).collection("bookings").doc(b.id), {
      teeMs, teeAt: teeMs != null ? new Date(teeMs).toISOString() : null,
      courseId: b.courseId, memberId: b.memberId ?? null, partySize: b.partySize,
      players: b.players ?? null, note: b.note ?? null, status: b.status, createdAt: ms(b.createdAt), updatedAt: ms(b.updatedAt),
    });
  }
  const compClub = {};
  for (const c of await rows("Competition")) {
    compClub[c.id] = c.clubKey;
    await w.set(db.collection("clubs").doc(c.clubKey).collection("competitions").doc(c.id), {
      name: c.name, date: c.date ? new Date(c.date).toISOString() : null, format: c.format, courseId: c.courseId, status: c.status,
      pars: c.pars ?? [], sis: c.sis ?? [], handicapAllowance: c.handicapAllowance, slope: c.slope,
      courseRating: num(c.courseRating), description: c.description ?? null, createdAt: ms(c.createdAt), updatedAt: ms(c.updatedAt),
    });
  }
  for (const e of await rows("CompetitionEntry")) {
    const clubKey = compClub[e.competitionId]; if (!clubKey) continue;
    await w.set(db.collection("clubs").doc(clubKey).collection("competitions").doc(e.competitionId).collection("entries").doc(e.id), {
      memberId: e.memberId ?? null, playerName: e.playerName, handicapIndex: num(e.handicapIndex), playingHandicap: e.playingHandicap,
      holeScores: e.holeScores ?? [], grossTotal: e.grossTotal ?? null, netTotal: e.netTotal ?? null, stableford: e.stableford ?? null,
      status: e.status, teeTime: ms(e.teeTime), groupNo: e.groupNo ?? null, createdAt: ms(e.createdAt), updatedAt: ms(e.updatedAt),
    });
  }
  for (const n of await rows("Notice")) {
    await w.set(db.collection("clubs").doc(n.clubKey).collection("notices").doc(n.id), {
      title: n.title, body: n.body, category: n.category, pinned: !!n.pinned, image: n.image ?? null,
      authorName: n.authorName ?? null, status: n.status,
      publishAt: n.publishAt ? new Date(n.publishAt).toISOString() : new Date().toISOString(),
      createdAt: ms(n.createdAt), updatedAt: ms(n.updatedAt),
    });
  }

  // ===== push devices ========================================================
  for (const d of await rows("PushDevice")) {
    await w.set(db.collection("pushDevices").doc(d.id),
      { token: d.token, platform: d.platform ?? null, lat: num(d.lat), lng: num(d.lng), enabled: !!d.enabled, createdAt: ms(d.createdAt), updatedAt: ms(d.updatedAt) });
  }

  await w.flush();
  console.log(`${DRY ? "Would write" : "Wrote"} ${w.total} documents.`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
