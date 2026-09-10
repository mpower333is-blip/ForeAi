import { Router } from "express";
import prisma from "../config/db";
import { requireAdmin } from "./club";

// Tee-time booking.
//
// A day is a set of tee slots generated from ClubSettings (first/last tee,
// interval). Each slot holds up to `slotCapacity` players; a booking takes
// `partySize` seats. Times are club-local (South Africa, UTC+2, no DST), so we
// pin every slot to the +02:00 offset — the server's own timezone never bites.

const router = Router();
const SAST = "+02:00"; // South Africa Standard Time (no daylight saving)

function pad(n: number) {
  return String(n).padStart(2, "0");
}
// The exact instant of `minute` past midnight on `dateStr`, in club-local time.
function slotAt(dateStr: string, minute: number): Date {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return new Date(`${dateStr}T${pad(h)}:${pad(m)}:00${SAST}`);
}
function dayBounds(dateStr: string): [Date, Date] {
  const start = new Date(`${dateStr}T00:00:00${SAST}`);
  return [start, new Date(start.getTime() + 24 * 3600 * 1000)];
}
// Weekday (0=Sun..6=Sat) of dateStr in club-local time.
function weekday(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00${SAST}`).getUTCDay();
}
function timeLabel(minute: number): string {
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}
function todayStrSAST(): string {
  const now = new Date(Date.now() + 2 * 3600 * 1000); // shift into SAST
  return now.toISOString().slice(0, 10);
}

async function getSettings(clubKey: string) {
  return (
    (await prisma.clubSettings.findUnique({ where: { clubKey } })) ?? {
      clubKey,
      adminPin: null,
      courseId: "",
      firstTeeMin: 360,
      lastTeeMin: 960,
      intervalMin: 10,
      slotCapacity: 4,
      bookingWindowDays: 14,
      openDays: "0,1,2,3,4,5,6",
    }
  );
}

// ---- Slots for a day (app-facing) -----------------------------------------

// GET /bookings/:clubKey/slots?date=YYYY-MM-DD  → the day's tee sheet with
// availability and the names already booked in each slot.
router.get("/:clubKey/slots", async (req, res) => {
  const clubKey = req.params.clubKey;
  const date = req.query.date ? String(req.query.date).slice(0, 10) : todayStrSAST();
  const s = await getSettings(clubKey);

  const openDays = String(s.openDays).split(",").map((d) => Number(d.trim()));
  const isOpen = openDays.includes(weekday(date));

  const [start, end] = dayBounds(date);
  const bookings = await prisma.teeBooking.findMany({
    where: { clubKey, teeAt: { gte: start, lt: end }, status: { in: ["booked", "blocked"] } },
    include: { member: { select: { firstName: true, lastName: true } } },
  });

  // Group booked seats + names by the slot instant (ms).
  const byMs = new Map<number, { seats: number; names: string[]; blocked: boolean }>();
  for (const b of bookings) {
    const ms = b.teeAt.getTime();
    const g = byMs.get(ms) ?? { seats: 0, names: [], blocked: false };
    if (b.status === "blocked") g.blocked = true;
    g.seats += b.partySize;
    const names = Array.isArray(b.players) ? (b.players as any[]).map(String) : [];
    if (names.length) g.names.push(...names);
    else if (b.member) g.names.push(`${b.member.firstName} ${b.member.lastName}`);
    byMs.set(ms, g);
  }

  const slots = [];
  for (let minute = s.firstTeeMin; minute <= s.lastTeeMin; minute += s.intervalMin) {
    const at = slotAt(date, minute);
    const g = byMs.get(at.getTime());
    const seats = g?.seats ?? 0;
    slots.push({
      minute,
      time: timeLabel(minute),
      teeAt: at.toISOString(),
      capacity: s.slotCapacity,
      booked: seats,
      available: g?.blocked ? 0 : Math.max(0, s.slotCapacity - seats),
      blocked: !!g?.blocked,
      names: g?.names ?? [],
    });
  }

  res.json({
    date,
    open: isOpen,
    courseId: s.courseId,
    bookingWindowDays: s.bookingWindowDays,
    slotCapacity: s.slotCapacity,
    slots,
  });
});

// A member's upcoming bookings.
router.get("/:clubKey/mine", async (req, res) => {
  const memberId = req.query.memberId ? String(req.query.memberId) : "";
  if (!memberId) return res.status(400).json({ error: "memberId required" });
  const bookings = await prisma.teeBooking.findMany({
    where: { clubKey: req.params.clubKey, memberId, status: "booked", teeAt: { gte: new Date() } },
    orderBy: { teeAt: "asc" },
  });
  res.json(bookings);
});

// ---- Create / cancel (member) ---------------------------------------------

// POST /bookings/:clubKey  { memberId, date, minute, partySize?, players?, note? }
router.post("/:clubKey", async (req, res) => {
  const clubKey = req.params.clubKey;
  const s = await getSettings(clubKey);
  const b = req.body ?? {};
  const memberId = b.memberId ? String(b.memberId) : "";
  const date = b.date ? String(b.date).slice(0, 10) : "";
  const minute = Number(b.minute);
  const partySize = Math.max(1, Math.min(s.slotCapacity, Number(b.partySize) || 1));
  if (!memberId || !date || !Number.isFinite(minute)) {
    return res.status(400).json({ error: "memberId, date and minute required" });
  }

  const member = await prisma.member.findFirst({ where: { id: memberId, clubKey } });
  if (!member) return res.status(404).json({ error: "Member not found" });
  if (member.status !== "active") return res.status(403).json({ error: "Membership is not active" });

  // Valid slot? (aligned to the sheet, within open hours)
  const aligned =
    minute >= s.firstTeeMin && minute <= s.lastTeeMin && (minute - s.firstTeeMin) % s.intervalMin === 0;
  if (!aligned) return res.status(400).json({ error: "Not a valid tee time" });

  // Open day + inside the booking window (today .. today+window).
  const openDays = String(s.openDays).split(",").map((d) => Number(d.trim()));
  if (!openDays.includes(weekday(date))) return res.status(400).json({ error: "The course is closed that day" });
  const today = todayStrSAST();
  const daysAhead = Math.round((new Date(`${date}T00:00:00${SAST}`).getTime() - new Date(`${today}T00:00:00${SAST}`).getTime()) / 86400000);
  if (daysAhead < 0) return res.status(400).json({ error: "That day has passed" });
  if (daysAhead > s.bookingWindowDays) return res.status(400).json({ error: `Bookings open ${s.bookingWindowDays} days ahead` });

  const at = slotAt(date, minute);

  // Capacity check + no double-booking the same slot by the same member.
  const existing = await prisma.teeBooking.findMany({
    where: { clubKey, teeAt: at, status: { in: ["booked", "blocked"] } },
  });
  if (existing.some((e) => e.status === "blocked")) return res.status(409).json({ error: "That slot is blocked" });
  if (existing.some((e) => e.memberId === memberId)) return res.status(409).json({ error: "You already have this slot" });
  const seats = existing.reduce((n, e) => n + e.partySize, 0);
  if (seats + partySize > s.slotCapacity) {
    return res.status(409).json({ error: `Only ${s.slotCapacity - seats} seat(s) left in that slot` });
  }

  const players = Array.isArray(b.players)
    ? (b.players as any[]).map(String).slice(0, partySize)
    : [`${member.firstName} ${member.lastName}`];

  const booking = await prisma.teeBooking.create({
    data: {
      clubKey,
      teeAt: at,
      courseId: s.courseId,
      memberId,
      partySize,
      players,
      note: b.note ? String(b.note) : null,
    },
  });
  res.json(booking);
});

// Cancel a booking — the owning member (memberId) or an admin (PIN).
router.post("/:clubKey/:id/cancel", async (req, res) => {
  const s = await getSettings(req.params.clubKey);
  const booking = await prisma.teeBooking.findFirst({ where: { id: req.params.id, clubKey: req.params.clubKey } });
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  const asMember = req.body?.memberId && String(req.body.memberId) === booking.memberId;
  const givenPin = String(req.header("x-admin-pin") ?? req.body?.adminPin ?? "");
  const asAdmin = s.adminPin ? givenPin === s.adminPin : false;
  if (!asMember && !asAdmin) return res.status(403).json({ error: "Not allowed to cancel this booking" });

  const updated = await prisma.teeBooking.update({ where: { id: booking.id }, data: { status: "cancelled" } });
  res.json(updated);
});

// ---- Admin: day view + block ----------------------------------------------

// All bookings for a day (admin) — the office tee sheet.
router.get("/:clubKey/day", async (req, res) => {
  const s = await getSettings(req.params.clubKey);
  if (!requireAdmin(s as any, req, res)) return;
  const date = req.query.date ? String(req.query.date).slice(0, 10) : todayStrSAST();
  const [start, end] = dayBounds(date);
  const bookings = await prisma.teeBooking.findMany({
    where: { clubKey: req.params.clubKey, teeAt: { gte: start, lt: end } },
    include: { member: { select: { memberNumber: true, firstName: true, lastName: true, handicapIndex: true } } },
    orderBy: { teeAt: "asc" },
  });
  res.json({ date, bookings });
});

// Block (or unblock) a slot (admin). POST { date, minute, on }.
router.post("/:clubKey/block", async (req, res) => {
  const clubKey = req.params.clubKey;
  const s = await getSettings(clubKey);
  if (!requireAdmin(s as any, req, res)) return;
  const date = String(req.body?.date ?? "").slice(0, 10);
  const minute = Number(req.body?.minute);
  const on = req.body?.on !== false;
  if (!date || !Number.isFinite(minute)) return res.status(400).json({ error: "date and minute required" });
  const at = slotAt(date, minute);

  if (on) {
    const block = await prisma.teeBooking.create({
      data: { clubKey, teeAt: at, memberId: null, partySize: s.slotCapacity, status: "blocked", note: req.body?.note ? String(req.body.note) : "Blocked" },
    });
    return res.json(block);
  }
  await prisma.teeBooking.deleteMany({ where: { clubKey, teeAt: at, status: "blocked" } });
  res.json({ ok: true });
});

export default router;
