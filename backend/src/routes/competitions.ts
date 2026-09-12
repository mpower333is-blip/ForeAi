import { Router } from "express";
import prisma from "../config/db";
import { requireAdmin } from "./club";
import { cardFor } from "../data/clubCards";
import { courseHandicap, playingHandicap, scoreRound, countback, Card } from "../lib/scoring";
import { raiseCompEntryInvoice } from "../lib/invoices";

// Club competitions: the calendar of medals / Stableford / betterball days.
// Members enter (using their roster handicap), submit a card, and see a live
// net/gross/Stableford leaderboard. Admin (PIN) creates and manages them.

const router = Router();

async function settings(clubKey: string) {
  return (
    (await prisma.clubSettings.findUnique({ where: { clubKey } })) ?? { adminPin: null as string | null }
  );
}
const parTotal = (pars: number[]) => pars.reduce((a, b) => a + (b || 0), 0);
const cardOf = (c: { pars: number[]; sis: number[] }): Card => ({ pars: c.pars, sis: c.sis });

// Recompute a leaderboard from stored per-hole scores. Sorted by the format's
// result with WHS countback (last 9/6/3/1) breaking ties.
function leaderboard(comp: any) {
  const card = cardOf(comp);
  const stab = comp.format === "stableford";
  const rows = comp.entries
    .filter((e: any) => e.status !== "withdrawn")
    .map((e: any) => ({ e, ...scoreRound(e.holeScores || [], card, e.playingHandicap) }));

  rows.sort((a: any, b: any) => {
    if (a.holesIn > 0 !== b.holesIn > 0) return a.holesIn > 0 ? -1 : 1; // scored first
    if (stab) {
      if (b.stableford !== a.stableford) return b.stableford - a.stableford; // higher better
      const ca = countback(a.ptsPerHole), cb = countback(b.ptsPerHole);
      for (let i = 0; i < 4; i++) if (cb[i] !== ca[i]) return cb[i] - ca[i];
    } else {
      if (a.net !== b.net) return a.net - b.net; // lower better
      const ca = countback(a.netPerHole), cb = countback(b.netPerHole);
      for (let i = 0; i < 4; i++) if (ca[i] !== cb[i]) return ca[i] - cb[i];
    }
    return 0;
  });

  return rows.map((r: any, i: number) => ({
    pos: r.holesIn > 0 ? i + 1 : null,
    entryId: r.e.id,
    memberId: r.e.memberId,
    name: r.e.playerName,
    playingHandicap: r.e.playingHandicap,
    handicapIndex: r.e.handicapIndex,
    gross: r.gross,
    net: r.net,
    stableford: r.stableford,
    thru: r.holesIn,
    status: r.e.status,
    holeScores: r.e.holeScores || [], // lets the admin card editor pre-fill
  }));
}

function summary(c: any) {
  return {
    id: c.id, clubKey: c.clubKey, name: c.name, date: c.date, format: c.format,
    courseId: c.courseId, status: c.status, handicapAllowance: c.handicapAllowance,
    description: c.description, entryCount: c._count?.entries ?? c.entries?.length ?? 0,
  };
}

// ---- List / detail (member-facing) ----------------------------------------

// GET /competitions/:clubKey?status=open  → upcoming/past competitions.
router.get("/:clubKey", async (req, res) => {
  const status = req.query.status ? String(req.query.status) : "";
  const comps = await prisma.competition.findMany({
    where: { clubKey: req.params.clubKey, ...(status ? { status } : {}), NOT: { status: "draft" } },
    include: { _count: { select: { entries: true } } },
    orderBy: { date: "desc" },
  });
  res.json(comps.map(summary));
});

// GET /competitions/:clubKey/:id?memberId=  → detail + leaderboard + my entry.
router.get("/:clubKey/:id", async (req, res) => {
  const comp = await prisma.competition.findFirst({
    where: { id: req.params.id, clubKey: req.params.clubKey },
    include: { entries: true },
  });
  if (!comp) return res.status(404).json({ error: "Competition not found" });
  const memberId = req.query.memberId ? String(req.query.memberId) : "";
  const mine = memberId ? comp.entries.find((e) => e.memberId === memberId) ?? null : null;
  res.json({ ...summary({ ...comp, entries: comp.entries }), pars: comp.pars, sis: comp.sis, leaderboard: leaderboard(comp), myEntry: mine });
});

// ---- Admin: create / edit / delete ----------------------------------------

function compData(clubKey: string, b: any, existing?: any) {
  const card = cardFor(clubKey);
  const arr = (v: any, d: number[]) => (Array.isArray(v) && v.length === 18 ? v.map((x) => Number(x) || 0) : d);
  return {
    name: b.name != null ? String(b.name) : existing?.name,
    date: b.date ? new Date(b.date) : existing?.date,
    format: b.format != null ? String(b.format) : existing?.format ?? "stableford",
    courseId: b.courseId != null ? String(b.courseId) : existing?.courseId ?? "",
    status: b.status != null ? String(b.status) : existing?.status ?? "open",
    handicapAllowance: b.handicapAllowance != null ? Number(b.handicapAllowance) : existing?.handicapAllowance ?? 95,
    slope: b.slope != null ? Number(b.slope) : existing?.slope ?? 113,
    courseRating: b.courseRating != null ? Number(b.courseRating) : existing?.courseRating ?? null,
    pars: arr(b.pars, existing?.pars ?? card.pars),
    sis: arr(b.sis, existing?.sis ?? card.sis),
    description: b.description != null ? String(b.description) : existing?.description ?? null,
    entryFeeCents:
      b.entryFeeCents != null
        ? Math.max(0, Math.round(Number(b.entryFeeCents)) || 0)
        : existing?.entryFeeCents ?? null,
  };
}

router.post("/:clubKey", async (req, res) => {
  const clubKey = req.params.clubKey;
  const s = await settings(clubKey);
  if (!requireAdmin(s as any, req, res)) return;
  const d = compData(clubKey, req.body ?? {});
  if (!d.name || !d.date) return res.status(400).json({ error: "name and date required" });
  const comp = await prisma.competition.create({ data: { clubKey, ...d } });
  res.json(comp);
});

router.put("/:clubKey/:id", async (req, res) => {
  const s = await settings(req.params.clubKey);
  if (!requireAdmin(s as any, req, res)) return;
  const existing = await prisma.competition.findFirst({ where: { id: req.params.id, clubKey: req.params.clubKey } });
  if (!existing) return res.status(404).json({ error: "Competition not found" });
  const comp = await prisma.competition.update({ where: { id: existing.id }, data: compData(req.params.clubKey, req.body ?? {}, existing) });
  res.json(comp);
});

router.delete("/:clubKey/:id", async (req, res) => {
  const s = await settings(req.params.clubKey);
  if (!requireAdmin(s as any, req, res)) return;
  try {
    await prisma.competition.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Competition not found" });
  }
});

// ---- Enter / withdraw / score ---------------------------------------------

// Enter a competition. Member: { memberId }. Guest (admin only): { playerName, handicapIndex }.
router.post("/:clubKey/:id/enter", async (req, res) => {
  const clubKey = req.params.clubKey;
  const comp = await prisma.competition.findFirst({ where: { id: req.params.id, clubKey } });
  if (!comp) return res.status(404).json({ error: "Competition not found" });
  if (comp.status !== "open") return res.status(409).json({ error: "Entries are closed for this competition" });

  const b = req.body ?? {};
  let memberId: string | null = b.memberId ? String(b.memberId) : null;
  let playerName = b.playerName ? String(b.playerName) : "";
  let index: number | null = b.handicapIndex != null ? Number(b.handicapIndex) : null;

  if (memberId) {
    const m = await prisma.member.findFirst({ where: { id: memberId, clubKey } });
    if (!m) return res.status(404).json({ error: "Member not found" });
    if (m.status !== "active") return res.status(403).json({ error: "Membership is not active" });
    playerName = `${m.firstName} ${m.lastName}`;
    index = m.handicapIndex;
    const dup = await prisma.competitionEntry.findFirst({ where: { competitionId: comp.id, memberId } });
    if (dup && dup.status !== "withdrawn") return res.status(409).json({ error: "You're already entered" });
    if (dup) {
      const r = await prisma.competitionEntry.update({ where: { id: dup.id }, data: { status: "entered" } });
      await raiseCompEntryInvoice({ id: r.id, clubKey, competitionId: comp.id, memberId, playerName }).catch(() => {});
      return res.json(r);
    }
  } else {
    // Guests may only be added by an admin.
    const s = await settings(clubKey);
    if (!requireAdmin(s as any, req, res)) return;
    if (!playerName) return res.status(400).json({ error: "playerName required for a guest" });
  }

  const ch = index != null ? courseHandicap(index, comp.slope, comp.courseRating ?? undefined, parTotal(comp.pars)) : 0;
  const ph = playingHandicap(ch, comp.handicapAllowance);
  const entry = await prisma.competitionEntry.create({
    data: { competitionId: comp.id, memberId, playerName, handicapIndex: index, playingHandicap: ph, holeScores: [] },
  });
  // Raise an entry-fee invoice if the competition has an entry fee.
  await raiseCompEntryInvoice({ id: entry.id, clubKey, competitionId: comp.id, memberId, playerName }).catch(() => {});
  res.json(entry);
});

router.post("/:clubKey/:id/withdraw", async (req, res) => {
  const comp = await prisma.competition.findFirst({ where: { id: req.params.id, clubKey: req.params.clubKey } });
  if (!comp) return res.status(404).json({ error: "Competition not found" });
  const memberId = req.body?.memberId ? String(req.body.memberId) : "";
  const entry = memberId ? await prisma.competitionEntry.findFirst({ where: { competitionId: comp.id, memberId } }) : null;
  if (!entry) return res.status(404).json({ error: "Entry not found" });
  await prisma.competitionEntry.update({ where: { id: entry.id }, data: { status: "withdrawn" } });
  res.json({ ok: true });
});

// Submit / edit a card. Member submits own (matched by memberId); admin (PIN)
// may submit/edit any entry (pass entryId).
router.post("/:clubKey/:id/score", async (req, res) => {
  const clubKey = req.params.clubKey;
  const comp = await prisma.competition.findFirst({ where: { id: req.params.id, clubKey }, include: { entries: true } });
  if (!comp) return res.status(404).json({ error: "Competition not found" });

  const b = req.body ?? {};
  const holeScores: number[] = Array.isArray(b.holeScores) ? b.holeScores.map((x: any) => Number(x) || 0).slice(0, 18) : [];
  while (holeScores.length < 18) holeScores.push(0);

  let entry = b.entryId ? comp.entries.find((e) => e.id === b.entryId) : b.memberId ? comp.entries.find((e) => e.memberId === String(b.memberId)) : null;
  if (!entry) return res.status(404).json({ error: "Entry not found — enter the competition first" });

  // Authorisation: the owning member, or an admin.
  const asMember = b.memberId && entry.memberId === String(b.memberId);
  if (!asMember) {
    const s = await settings(clubKey);
    if (!requireAdmin(s as any, req, res)) return;
  }

  const r = scoreRound(holeScores, cardOf(comp), entry.playingHandicap);
  const updated = await prisma.competitionEntry.update({
    where: { id: entry.id },
    data: {
      holeScores,
      grossTotal: r.gross || null,
      netTotal: r.holesIn ? r.net : null,
      stableford: r.holesIn ? r.stableford : null,
      status: r.holesIn >= 18 ? "submitted" : "entered",
    },
  });
  res.json({ entry: updated, result: r });
});

// GET /competitions/:clubKey/:id/leaderboard
router.get("/:clubKey/:id/leaderboard", async (req, res) => {
  const comp = await prisma.competition.findFirst({ where: { id: req.params.id, clubKey: req.params.clubKey }, include: { entries: true } });
  if (!comp) return res.status(404).json({ error: "Competition not found" });
  res.json({ id: comp.id, name: comp.name, format: comp.format, status: comp.status, leaderboard: leaderboard(comp) });
});

export default router;
