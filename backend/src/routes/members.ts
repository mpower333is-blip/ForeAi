import { Router } from "express";
import prisma from "../config/db";
import { requireAdmin } from "./club";
import { applyHandicaps, fetchFromHna, HandicapEntry } from "../lib/hnaSync";

// Club membership.
//
//  • App-facing (no PIN): look up / claim a membership to show the digital card.
//  • Admin-facing (PIN):  full roster CRUD, CSV import, HNA handicap sync.
//
// The roster holds contact details, so the full list is admin-only; the app
// only ever gets a single member's card-safe fields via lookup/claim.

const router = Router();

async function settings(clubKey: string) {
  return (
    (await prisma.clubSettings.findUnique({ where: { clubKey } })) ?? {
      adminPin: null as string | null,
    }
  );
}

// Card-safe projection — what the app is allowed to see for a member.
function card(m: any) {
  return {
    id: m.id,
    clubKey: m.clubKey,
    memberNumber: m.memberNumber,
    firstName: m.firstName,
    lastName: m.lastName,
    category: m.category,
    status: m.status,
    handicapIndex: m.handicapIndex,
    handicapSyncedAt: m.handicapSyncedAt,
    photo: m.photo ?? null,
  };
}

// ---- App: identify & claim -------------------------------------------------

// Look up a member by membership number or email (read-only, card-safe).
router.get("/:clubKey/lookup", async (req, res) => {
  const clubKey = req.params.clubKey;
  const number = req.query.number ? String(req.query.number).trim() : "";
  const email = req.query.email ? String(req.query.email).trim().toLowerCase() : "";
  if (!number && !email) return res.status(400).json({ error: "Provide number or email" });

  const m = number
    ? await prisma.member.findUnique({ where: { clubKey_memberNumber: { clubKey, memberNumber: number } } })
    : await prisma.member.findFirst({ where: { clubKey, email: { equals: email, mode: "insensitive" } } });

  if (!m) return res.status(404).json({ error: "No member found" });
  res.json(card(m));
});

// Claim a membership to this device: verify number + (email OR surname), then
// bind deviceId so the app remembers who this phone is. Returns the card.
router.post("/:clubKey/claim", async (req, res) => {
  const clubKey = req.params.clubKey;
  const { memberNumber, email, lastName, deviceId } = req.body ?? {};
  if (!memberNumber) return res.status(400).json({ error: "memberNumber required" });

  const m = await prisma.member.findUnique({
    where: { clubKey_memberNumber: { clubKey, memberNumber: String(memberNumber).trim() } },
  });
  if (!m) return res.status(404).json({ error: "No member with that number" });

  const okEmail = email && m.email && String(email).trim().toLowerCase() === m.email.toLowerCase();
  const okName = lastName && String(lastName).trim().toLowerCase() === m.lastName.toLowerCase();
  if (!okEmail && !okName) return res.status(403).json({ error: "Details don't match our records" });

  const updated = deviceId
    ? await prisma.member.update({ where: { id: m.id }, data: { deviceId: String(deviceId) } })
    : m;
  res.json(card(updated));
});

// ---- Admin: roster ---------------------------------------------------------

// Full roster (admin). Optional ?q= filters by name / number / email.
router.get("/:clubKey/all", async (req, res) => {
  const s = await settings(req.params.clubKey);
  if (!requireAdmin(s as any, req, res)) return;
  const q = req.query.q ? String(req.query.q).trim() : "";
  const members = await prisma.member.findMany({
    where: {
      clubKey: req.params.clubKey,
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { memberNumber: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  res.json(members);
});

function memberData(b: any) {
  const d: any = {};
  const str = (k: string) => (b[k] != null ? String(b[k]) : undefined);
  if (str("memberNumber") !== undefined) d.memberNumber = str("memberNumber");
  if (str("firstName") !== undefined) d.firstName = str("firstName");
  if (str("lastName") !== undefined) d.lastName = str("lastName");
  if ("email" in b) d.email = b.email ? String(b.email) : null;
  if ("cell" in b) d.cell = b.cell ? String(b.cell) : null;
  if (str("category") !== undefined) d.category = str("category");
  if (str("status") !== undefined) d.status = str("status");
  if ("hnaId" in b) d.hnaId = b.hnaId ? String(b.hnaId) : null;
  if ("photo" in b) d.photo = b.photo ? String(b.photo) : null;
  if (b.handicapIndex != null && Number.isFinite(Number(b.handicapIndex))) d.handicapIndex = Number(b.handicapIndex);
  if (b.joinedAt) d.joinedAt = new Date(b.joinedAt);
  return d;
}

// Create a member (admin).
router.post("/:clubKey", async (req, res) => {
  const clubKey = req.params.clubKey;
  const s = await settings(clubKey);
  if (!requireAdmin(s as any, req, res)) return;
  const d = memberData(req.body ?? {});
  if (!d.memberNumber || !d.firstName || !d.lastName) {
    return res.status(400).json({ error: "memberNumber, firstName, lastName required" });
  }
  try {
    const m = await prisma.member.create({ data: { clubKey, ...d } });
    res.json(m);
  } catch (e: any) {
    if (e?.code === "P2002") return res.status(409).json({ error: "That membership number already exists" });
    res.status(500).json({ error: "Unable to create member" });
  }
});

// Update a member (admin).
router.put("/:clubKey/:id", async (req, res) => {
  const s = await settings(req.params.clubKey);
  if (!requireAdmin(s as any, req, res)) return;
  try {
    const m = await prisma.member.update({ where: { id: req.params.id }, data: memberData(req.body ?? {}) });
    res.json(m);
  } catch (e: any) {
    if (e?.code === "P2002") return res.status(409).json({ error: "That membership number already exists" });
    res.status(404).json({ error: "Member not found" });
  }
});

// Delete a member (admin).
router.delete("/:clubKey/:id", async (req, res) => {
  const s = await settings(req.params.clubKey);
  if (!requireAdmin(s as any, req, res)) return;
  try {
    await prisma.member.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Member not found" });
  }
});

// Bulk import (admin). Body: { members: [ {memberNumber, firstName, ...}, ... ] }.
// Upserts by (clubKey, memberNumber) so re-importing a corrected sheet is safe.
router.post("/:clubKey/import", async (req, res) => {
  const clubKey = req.params.clubKey;
  const s = await settings(clubKey);
  if (!requireAdmin(s as any, req, res)) return;
  const rows: any[] = Array.isArray(req.body?.members) ? req.body.members : [];
  let created = 0,
    updated = 0,
    skipped = 0;
  for (const row of rows) {
    const d = memberData(row);
    if (!d.memberNumber || !d.firstName || !d.lastName) {
      skipped++;
      continue;
    }
    const { memberNumber, ...rest } = d;
    try {
      const existing = await prisma.member.findUnique({
        where: { clubKey_memberNumber: { clubKey, memberNumber } },
      });
      if (existing) {
        await prisma.member.update({ where: { id: existing.id }, data: rest });
        updated++;
      } else {
        await prisma.member.create({ data: { clubKey, memberNumber, ...rest } });
        created++;
      }
    } catch {
      skipped++;
    }
  }
  res.json({ ok: true, created, updated, skipped, total: rows.length });
});

// ---- Admin: handicap sync (HNA) -------------------------------------------

// Apply handicap indexes. Body either:
//   { entries: [{ memberNumber|hnaId|memberId, handicapIndex }] }  — manual/CSV, or
//   { live: true }  — pull from HNA for members that have an hnaId (needs
//                     HNA_API_URL configured; otherwise reports notConfigured).
router.post("/:clubKey/sync-hna", async (req, res) => {
  const clubKey = req.params.clubKey;
  const s = await settings(clubKey);
  if (!requireAdmin(s as any, req, res)) return;

  if (req.body?.live) {
    const withHna = await prisma.member.findMany({
      where: { clubKey, hnaId: { not: null } },
      select: { hnaId: true },
    });
    const ids = withHna.map((m) => m.hnaId!).filter(Boolean);
    const fetched = await fetchFromHna(ids);
    if (!fetched) return res.json({ ok: false, notConfigured: true, updated: 0, candidates: ids.length });
    const updated = await applyHandicaps(clubKey, fetched);
    return res.json({ ok: true, updated, candidates: ids.length });
  }

  const entries: HandicapEntry[] = Array.isArray(req.body?.entries) ? req.body.entries : [];
  const updated = await applyHandicaps(clubKey, entries);
  res.json({ ok: true, updated, total: entries.length });
});

export default router;
