import { Router } from "express";
import admin from "firebase-admin";
import prisma from "../config/db";
import { requireAuth } from "../lib/auth";
import { db as _fs } from "../lib/firebaseAdmin"; // side-effect: initialises the Admin SDK if FIREBASE_SERVICE_ACCOUNT is set
void _fs;

// Platform super-admin API. Every route requires a valid token whose role is
// "owner" (granted by SUPER_ADMIN_EMAILS). Lets the platform owner see every
// organiser, club and event, and track the hybrid billing (per-club
// subscription + per-event fee; school/charity days waived).
const router = Router();

function requireOwner(req: any, res: any, next: any) {
  const a = req.auth;
  if (!a || a.role !== "owner") return res.status(403).json({ error: "Owner access required." });
  next();
}
router.use(requireAuth, requireOwner);

// Everything the owner sees, in one call.
router.get("/overview", async (_req, res) => {
  const [organisers, clubs, events, memberCounts] = await Promise.all([
    prisma.adminUser.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, name: true, clubKey: true, role: true, createdAt: true, lastLoginAt: true },
    }),
    prisma.clubSettings.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.tournament.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, code: true, name: true, courseId: true, ownerId: true, teamFee: true,
        payStatus: true, payFee: true, createdAt: true,
        _count: { select: { players: true, registrations: true, groups: true } },
      },
    }),
    prisma.member.groupBy({ by: ["clubKey"], _count: { _all: true } }),
  ]);
  const mc: Record<string, number> = {};
  for (const m of memberCounts) mc[m.clubKey] = m._count._all;
  res.json({
    totals: { organisers: organisers.length, clubs: clubs.length, events: events.length },
    organisers,
    clubs: clubs.map((c) => ({
      clubKey: c.clubKey, name: c.name, plan: c.plan ?? null, subStatus: c.subStatus,
      subRenewAt: c.subRenewAt, subFee: c.subFee ?? null, members: mc[c.clubKey] || 0, createdAt: c.createdAt,
    })),
    events: events.map((e) => ({
      id: e.id, code: e.code, name: e.name, ownerId: e.ownerId, teamFee: e.teamFee ?? null,
      payStatus: e.payStatus, payFee: e.payFee ?? null,
      players: e._count.players, registrations: e._count.registrations, groups: e._count.groups, createdAt: e.createdAt,
    })),
  });
});

// Per-event fee status.
router.patch("/events/:id/pay", async (req, res) => {
  const { payStatus, payFee } = req.body ?? {};
  const data: any = {};
  if (payStatus !== undefined) {
    if (!["unpaid", "paid", "waived"].includes(payStatus)) return res.status(400).json({ error: "payStatus must be unpaid, paid or waived" });
    data.payStatus = payStatus;
  }
  if (payFee !== undefined) data.payFee = payFee == null || payFee === "" ? null : Number(payFee);
  const t = await prisma.tournament.update({ where: { id: req.params.id }, data });
  res.json({ ok: true, id: t.id, payStatus: t.payStatus, payFee: t.payFee });
});

// Create (or rename) a club.
router.post("/clubs", async (req, res) => {
  const clubKey = String(req.body?.clubKey ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  const name = String(req.body?.name ?? "").trim();
  if (!clubKey || !name) return res.status(400).json({ error: "clubKey and name are required" });
  const club = await prisma.clubSettings.upsert({ where: { clubKey }, update: { name }, create: { clubKey, name } });
  res.json({ ok: true, clubKey: club.clubKey, name: club.name });
});

// Club subscription / billing.
router.patch("/clubs/:clubKey", async (req, res) => {
  const b = req.body ?? {};
  const data: any = {};
  if (b.name !== undefined) data.name = String(b.name);
  if (b.plan !== undefined) data.plan = b.plan == null ? null : String(b.plan);
  if (b.subStatus !== undefined) {
    if (!["trial", "active", "overdue", "cancelled"].includes(b.subStatus)) return res.status(400).json({ error: "bad subStatus" });
    data.subStatus = b.subStatus;
  }
  if (b.subRenewAt !== undefined) data.subRenewAt = b.subRenewAt ? new Date(b.subRenewAt) : null;
  if (b.subFee !== undefined) data.subFee = b.subFee == null || b.subFee === "" ? null : Number(b.subFee);
  const club = await prisma.clubSettings.update({ where: { clubKey: req.params.clubKey }, data });
  res.json({ ok: true, clubKey: club.clubKey });
});

// Create a new organiser login directly (owner onboards a school/club without
// the person having to self-register). Mints the Firebase Auth account (what the
// web sign-in uses) and the matching AdminUser record. Requires the Admin SDK to
// be configured on the server (FIREBASE_SERVICE_ACCOUNT).
router.post("/organisers", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  const name = req.body?.name ? String(req.body.name).trim() : null;
  const clubKey = req.body?.clubKey ? String(req.body.clubKey).trim() : null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
  if (!admin.apps.length) {
    return res.status(503).json({ error: "Firebase isn't configured on the server (set FIREBASE_SERVICE_ACCOUNT). Until then, ask the organiser to self-register on the sign-in page." });
  }
  try {
    let fbUser;
    try {
      fbUser = await admin.auth().createUser({ email, password, displayName: name || undefined });
    } catch (e: any) {
      if (e?.code === "auth/email-already-exists") return res.status(409).json({ error: "An account with that email already exists." });
      if (e?.code === "auth/invalid-password") return res.status(400).json({ error: "Password is too weak (min 6 characters)." });
      throw e;
    }
    const user = await prisma.adminUser.upsert({
      where: { email },
      update: { name, ...(clubKey !== null ? { clubKey } : {}) },
      create: { email, passwordHash: "firebase", name, clubKey },
    });
    res.json({ ok: true, uid: fbUser.uid, user: { id: user.id, email: user.email, name: user.name, clubKey: user.clubKey, role: user.role } });
  } catch (e) {
    console.error("create organiser failed", e);
    res.status(500).json({ error: "Could not create the organiser account." });
  }
});

// Assign an organiser to a club (or clear it) / change their role.
router.patch("/users/:id", async (req, res) => {
  const b = req.body ?? {};
  const data: any = {};
  if (b.clubKey !== undefined) data.clubKey = b.clubKey ? String(b.clubKey).trim() : null;
  if (b.role !== undefined) {
    if (!["organiser", "owner"].includes(b.role)) return res.status(400).json({ error: "bad role" });
    data.role = b.role;
  }
  const u = await prisma.adminUser.update({
    where: { id: req.params.id }, data,
    select: { id: true, email: true, name: true, clubKey: true, role: true },
  });
  res.json({ ok: true, user: u });
});

export default router;
