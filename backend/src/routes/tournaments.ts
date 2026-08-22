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
  sponsors: { orderBy: { createdAt: "asc" } },
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
    shotgun: t.shotgun,
    cause: t.cause,
    causePhoto: t.causePhoto,
    sponsors: t.sponsors.map((s) => ({
      id: s.id,
      name: s.name,
      tier: s.tier,
      hole: s.hole,
      message: s.message,
      logo: s.logo,
    })),
    players: t.players.map((p) => ({
      id: p.id,
      name: p.name,
      handicap: p.handicap,
      deviceId: p.deviceId,
      groupId: p.groupId,
      lastSeen: p.lastSeen ? p.lastSeen.getTime() : null,
      lat: p.lat,
      lng: p.lng,
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
    const { name, courseId, format, firstTeeMin, intervalMin, shotgun } = req.body;
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
            shotgun: !!shotgun,
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
  const { name, format, firstTeeMin, intervalMin, shotgun, cause, causePhoto } = req.body;
  await prisma.tournament.update({
    where: { id: req.params.id },
    data: {
      ...(name != null ? { name } : {}),
      ...(format != null ? { format } : {}),
      ...(firstTeeMin != null ? { firstTeeMin } : {}),
      ...(intervalMin != null ? { intervalMin } : {}),
      ...(shotgun != null ? { shotgun: !!shotgun } : {}),
      ...(cause !== undefined ? { cause } : {}),
      ...(causePhoto !== undefined ? { causePhoto } : {}),
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

// Heartbeat: a player's phone marks itself "live" and (optionally) shares its
// GPS position. Called every ~40s while the event is open so the organiser can
// see who's on the app and roughly where each team is. Kept lightweight — the
// 6-second full-state poll is what fans the presence out to other devices.
router.put("/:id/players/:playerId/ping", async (req, res) => {
  const { lat, lng } = req.body ?? {};
  try {
    await prisma.tournamentPlayer.update({
      where: { id: req.params.playerId },
      data: {
        lastSeen: new Date(),
        ...(typeof lat === "number" ? { lat } : {}),
        ...(typeof lng === "number" ? { lng } : {}),
      },
    });
    res.json({ ok: true });
  } catch {
    // Player may have been removed — don't error the heartbeat.
    res.json({ ok: false });
  }
});

// Assign / unassign a player to a group (groupId null = unassigned).
router.patch("/:id/players/:playerId", async (req, res) => {
  await prisma.tournamentPlayer.update({
    where: { id: req.params.playerId },
    data: { groupId: req.body.groupId ?? null },
  });
  await respondWithEvent(req.params.id, res);
});

// Link this device to an existing (pre-registered) player — "I am this player".
// Sending a null/empty deviceId releases the link instead. A device can only be
// linked to one player per event, so any prior link for this device is cleared
// first (one phone = one player).
router.put("/:id/players/:playerId/claim", async (req, res) => {
  const raw = (req.body ?? {}).deviceId;
  const deviceId = raw ? String(raw) : null;
  if (deviceId) {
    await prisma.tournamentPlayer.updateMany({
      where: { tournamentId: req.params.id, deviceId },
      data: { deviceId: null },
    });
  }
  await prisma.tournamentPlayer.update({
    where: { id: req.params.playerId },
    data: { deviceId },
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

// Add a sponsor.
router.post("/:id/sponsors", async (req, res) => {
  const { name, tier, hole, message, logo } = req.body;
  if (!name || !tier) return res.status(400).json({ error: "name and tier are required" });
  await prisma.tournamentSponsor.create({
    data: {
      tournamentId: req.params.id,
      name,
      tier,
      hole: hole ?? null,
      message: message ?? null,
      logo: logo ?? null,
    },
  });
  await respondWithEvent(req.params.id, res);
});

router.delete("/:id/sponsors/:sponsorId", async (req, res) => {
  await prisma.tournamentSponsor.delete({ where: { id: req.params.sponsorId } });
  await respondWithEvent(req.params.id, res);
});

// ---- public online registration (shared form → immediate import) ----------
//
// These are keyed by the event's join code so the form can be shared without
// exposing internal ids. Each submission is stored in full (for the office) and
// also reflected into the event as players/groups or a sponsor, so it appears
// straight away in the app and on the clubhouse board.

async function findByCode(code: string) {
  return prisma.tournament.findUnique({ where: { code: code.toUpperCase() } });
}

function contactMessage(b: any): string {
  return [b.contactPerson, b.cell, b.email].filter(Boolean).join(" · ");
}

// Team (four-ball) entry.
router.post("/code/:code/register/team", async (req, res) => {
  const t = await findByCode(req.params.code);
  if (!t) return res.status(404).json({ error: "No event with that code" });
  const b = req.body ?? {};
  if (!b.company) return res.status(400).json({ error: "Company name is required" });

  const teams: any[] = Array.isArray(b.teams) && b.teams.length ? b.teams : [{ players: [] }];
  let playersAdded = 0;
  let order = await prisma.tournamentGroup.count({ where: { tournamentId: t.id } });

  for (const team of teams) {
    const group = await prisma.tournamentGroup.create({
      data: { tournamentId: t.id, order: order++ },
    });
    const players: any[] = Array.isArray(team.players) ? team.players : [];
    for (const p of players) {
      const name = (typeof p === "string" ? p : p?.name)?.trim();
      if (!name) continue;
      await prisma.tournamentPlayer.create({
        data: {
          tournamentId: t.id,
          groupId: group.id,
          name,
          handicap: Number(typeof p === "object" ? p?.handicap : 0) || 0,
        },
      });
      playersAdded++;
    }
  }

  await prisma.tournamentRegistration.create({
    data: { tournamentId: t.id, type: "team", ...regColumns(b), payload: JSON.stringify(b) },
  });
  res.json({ ok: true, teamsAdded: teams.length, playersAdded });
});

// Hole (tee/green) sponsor.
router.post("/code/:code/register/hole-sponsor", async (req, res) => {
  const t = await findByCode(req.params.code);
  if (!t) return res.status(404).json({ error: "No event with that code" });
  const b = req.body ?? {};
  if (!b.company) return res.status(400).json({ error: "Company name is required" });

  await prisma.tournamentSponsor.create({
    data: {
      tournamentId: t.id,
      name: b.company,
      tier: "hole",
      hole: b.holePreference != null && b.holePreference !== "" ? Number(b.holePreference) : null,
      message: contactMessage(b) || null,
      logo: typeof b.logo === "string" && b.logo.startsWith("data:") ? b.logo : null,
    },
  });
  await prisma.tournamentRegistration.create({
    data: { tournamentId: t.id, type: "hole", ...regColumns(b), payload: JSON.stringify(b) },
  });
  res.json({ ok: true });
});

// Prize sponsor (cash or item).
router.post("/code/:code/register/prize-sponsor", async (req, res) => {
  const t = await findByCode(req.params.code);
  if (!t) return res.status(404).json({ error: "No event with that code" });
  const b = req.body ?? {};
  if (!b.company) return res.status(400).json({ error: "Company name is required" });

  const prizeBits =
    b.prizeType === "cash"
      ? `Cash: ${b.cashAmount ?? ""}`.trim()
      : (Array.isArray(b.prizes) ? b.prizes.filter(Boolean).join(", ") : "") || "Item prize";
  await prisma.tournamentSponsor.create({
    data: {
      tournamentId: t.id,
      name: b.company,
      tier: "prize",
      message: [prizeBits, contactMessage(b)].filter(Boolean).join(" — ") || null,
      logo: typeof b.logo === "string" && b.logo.startsWith("data:") ? b.logo : null,
    },
  });
  await prisma.tournamentRegistration.create({
    data: { tournamentId: t.id, type: "prize", ...regColumns(b), payload: JSON.stringify(b) },
  });
  res.json({ ok: true });
});

// Office list of raw submissions for an event (for export / follow-up).
router.get("/:id/registrations", async (req, res) => {
  const rows = await prisma.tournamentRegistration.findMany({
    where: { tournamentId: req.params.id },
    orderBy: { createdAt: "desc" },
  });
  res.json(rows.map((r) => ({ ...r, payload: safeJson(r.payload) })));
});

// Office: update a submission's workflow status (new | paid | confirmed).
router.patch("/:id/registrations/:regId", async (req, res) => {
  const { status } = req.body ?? {};
  const allowed = ["new", "paid", "confirmed"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: "status must be new, paid or confirmed" });
  }
  const row = await prisma.tournamentRegistration.update({
    where: { id: req.params.regId },
    data: { status },
  });
  res.json({ ...row, payload: safeJson(row.payload) });
});

// Office: remove a submission (does not remove already-imported players/sponsors).
router.delete("/:id/registrations/:regId", async (req, res) => {
  await prisma.tournamentRegistration.delete({ where: { id: req.params.regId } });
  res.json({ ok: true });
});

function regColumns(b: any) {
  return {
    company: String(b.company),
    regNumber: b.regNumber ?? null,
    vatNumber: b.vatNumber ?? null,
    address: b.address ?? null,
    city: b.city ?? null,
    postalCode: b.postalCode ?? null,
    contactPerson: b.contactPerson ?? null,
    cell: b.cell ?? null,
    email: b.email ?? null,
  };
}

function safeJson(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

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
