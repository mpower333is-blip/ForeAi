import { Router } from "express";
import prisma from "../config/db";

const router = Router();

// Short, unambiguous join code (no 0/O/1/I).
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeCode(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

const includeAll = {
  players: { orderBy: { createdAt: "asc" } },
  groups: { orderBy: { order: "asc" } },
  scores: true,
  contests: { orderBy: { createdAt: "asc" }, include: { results: true } },
} as const;

type LoadedTournament = Awaited<ReturnType<typeof loadRaw>>;

function loadRaw(id: string) {
  return prisma.tournament.findUnique({ where: { id }, include: includeAll });
}

// Map the relational rows into the shape the mobile app consumes directly
// (groups carry playerIds; scores is a nested playerId -> hole -> strokes map).
function serialize(t: NonNullable<LoadedTournament>) {
  const scores: Record<string, Record<number, number>> = {};
  for (const s of t.scores) {
    (scores[s.playerId] ||= {})[s.hole] = s.strokes;
  }
  return {
    id: t.id,
    code: t.code,
    name: t.name,
    courseId: t.courseId,
    format: t.format,
    firstTeeMin: t.firstTeeMin,
    intervalMin: t.intervalMin,
    players: t.players.map((p) => ({
      id: p.id,
      name: p.name,
      handicap: p.handicap,
      deviceId: p.deviceId,
      groupId: p.groupId,
    })),
    groups: t.groups.map((g) => ({
      id: g.id,
      playerIds: t.players.filter((p) => p.groupId === g.id).map((p) => p.id),
    })),
    scores,
    contests: t.contests.map((c) => ({ id: c.id, type: c.type, hole: c.hole })),
    contestResults: t.contests.reduce((acc, c) => {
      acc[c.id] = c.results.reduce((r, x) => {
        r[x.playerId] = x.value;
        return r;
      }, {} as Record<string, number>);
      return acc;
    }, {} as Record<string, Record<string, number>>),
  };
}

async function respondWithEvent(id: string, res: any) {
  const t = await loadRaw(id);
  if (!t) return res.status(404).json({ error: "Tournament not found" });
  res.json(serialize(t));
}

// Create an event, returning a join code that other devices use.
router.post("/", async (req, res) => {
  try {
    const { name, courseId, format, firstTeeMin, intervalMin } = req.body;
    if (!name || !courseId) {
      return res.status(400).json({ error: "name and courseId are required" });
    }

    // Retry a few times in the unlikely event of a code collision.
    let created = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      try {
        created = await prisma.tournament.create({
          data: {
            code: makeCode(),
            name,
            courseId,
            format: format ?? "stroke",
            firstTeeMin: firstTeeMin ?? 480,
            intervalMin: intervalMin ?? 10,
          },
        });
      } catch {
        // unique-constraint on code — try again
      }
    }
    if (!created) return res.status(500).json({ error: "Could not allocate a code" });

    await respondWithEvent(created.id, res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create tournament" });
  }
});

// Full state by id (used for polling).
router.get("/:id", (req, res) => respondWithEvent(req.params.id, res));

// Resolve by join code (used when a player joins from another device).
router.get("/code/:code", async (req, res) => {
  const t = await prisma.tournament.findUnique({
    where: { code: req.params.code.toUpperCase() },
    include: includeAll,
  });
  if (!t) return res.status(404).json({ error: "No event with that code" });
  res.json(serialize(t));
});

// Update event settings.
router.patch("/:id", async (req, res) => {
  const { name, format, firstTeeMin, intervalMin } = req.body;
  await prisma.tournament.update({
    where: { id: req.params.id },
    data: {
      ...(name != null ? { name } : {}),
      ...(format != null ? { format } : {}),
      ...(firstTeeMin != null ? { firstTeeMin } : {}),
      ...(intervalMin != null ? { intervalMin } : {}),
    },
  });
  await respondWithEvent(req.params.id, res);
});

// Register a player (self-registration from a player's own device).
router.post("/:id/players", async (req, res) => {
  const { name, handicap, deviceId, groupId } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  await prisma.tournamentPlayer.create({
    data: {
      tournamentId: req.params.id,
      name,
      handicap: handicap ?? 0,
      deviceId: deviceId ?? null,
      groupId: groupId ?? null,
    },
  });
  await respondWithEvent(req.params.id, res);
});

router.delete("/:id/players/:playerId", async (req, res) => {
  await prisma.tournamentPlayer.delete({ where: { id: req.params.playerId } });
  await respondWithEvent(req.params.id, res);
});

// Assign / unassign a player to a group (groupId null = unassigned).
router.patch("/:id/players/:playerId", async (req, res) => {
  await prisma.tournamentPlayer.update({
    where: { id: req.params.playerId },
    data: { groupId: req.body.groupId ?? null },
  });
  await respondWithEvent(req.params.id, res);
});

router.post("/:id/groups", async (req, res) => {
  const count = await prisma.tournamentGroup.count({ where: { tournamentId: req.params.id } });
  await prisma.tournamentGroup.create({
    data: { tournamentId: req.params.id, order: count },
  });
  await respondWithEvent(req.params.id, res);
});

router.delete("/:id/groups/:groupId", async (req, res) => {
  await prisma.tournamentGroup.delete({ where: { id: req.params.groupId } });
  await respondWithEvent(req.params.id, res);
});

// Submit a score (upsert; strokes <= 0 clears it). Any device in the group can
// post — the unique [playerId, hole] constraint keeps it idempotent.
router.put("/:id/scores", async (req, res) => {
  const { playerId, hole, strokes } = req.body;
  if (!playerId || typeof hole !== "number") {
    return res.status(400).json({ error: "playerId and hole are required" });
  }

  if (strokes == null || strokes <= 0) {
    await prisma.tournamentScore.deleteMany({ where: { playerId, hole } });
  } else {
    await prisma.tournamentScore.upsert({
      where: { playerId_hole: { playerId, hole } },
      update: { strokes },
      create: { tournamentId: req.params.id, playerId, hole, strokes },
    });
  }
  await respondWithEvent(req.params.id, res);
});

// Add a side game (contest) on a hole.
router.post("/:id/contests", async (req, res) => {
  const { type, hole } = req.body;
  if (type !== "closest" && type !== "longest") {
    return res.status(400).json({ error: "type must be 'closest' or 'longest'" });
  }
  if (typeof hole !== "number") return res.status(400).json({ error: "hole is required" });
  await prisma.tournamentContest.create({
    data: { tournamentId: req.params.id, type, hole },
  });
  await respondWithEvent(req.params.id, res);
});

router.delete("/:id/contests/:contestId", async (req, res) => {
  await prisma.tournamentContest.delete({ where: { id: req.params.contestId } });
  await respondWithEvent(req.params.id, res);
});

// Record a player's result for a contest (yards). value <= 0 clears it.
router.put("/:id/contests/:contestId/results", async (req, res) => {
  const { playerId, value } = req.body;
  if (!playerId) return res.status(400).json({ error: "playerId is required" });

  if (value == null || value <= 0) {
    await prisma.tournamentContestResult.deleteMany({
      where: { contestId: req.params.contestId, playerId },
    });
  } else {
    await prisma.tournamentContestResult.upsert({
      where: { contestId_playerId: { contestId: req.params.contestId, playerId } },
      update: { value },
      create: { contestId: req.params.contestId, playerId, value },
    });
  }
  await respondWithEvent(req.params.id, res);
});

export default router;
