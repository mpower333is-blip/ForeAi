// Handicap sync with HNA / GolfRSA.
//
// The OFFICIAL WHS handicap for a South African club lives with Handicaps
// Network Africa (HNA, handicaps.co.za) — Kempton Park GC is HNA clubid 49.
// ForeAi does NOT compute handicaps; it imports the index HNA publishes and
// shows it on the member card. This module is the single integration point.
//
// Two ways an index reaches us, both landing in applyHandicaps():
//   1. Manual / import  — an admin types an index, or uploads an HNA club export
//      (CSV → [{ memberNumber|hnaId, handicapIndex }]). Always available.
//   2. Live fetch       — fetchFromHna() hits an HNA endpoint when one is
//      configured via env (HNA_API_URL [+ HNA_API_KEY]). Left unconfigured it
//      is a no-op, so nothing breaks until the club/HNA gives us access.

import prisma from "../config/db";

export type HandicapEntry = {
  memberId?: string;
  memberNumber?: string;
  hnaId?: string;
  handicapIndex: number;
};

// Update matching members' handicapIndex. Matches by memberId, then hnaId, then
// memberNumber (within the club). Returns how many rows were updated.
export async function applyHandicaps(clubKey: string, entries: HandicapEntry[]): Promise<number> {
  let updated = 0;
  const now = new Date();
  for (const e of entries) {
    const idx = Number(e.handicapIndex);
    if (!Number.isFinite(idx)) continue;
    if (!e.memberId && !e.hnaId && !e.memberNumber) continue;
    try {
      if (e.memberId) {
        await prisma.member.update({
          where: { id: e.memberId },
          data: { handicapIndex: idx, handicapSyncedAt: now },
        });
      } else if (e.hnaId) {
        const r = await prisma.member.updateMany({
          where: { clubKey, hnaId: String(e.hnaId) },
          data: { handicapIndex: idx, handicapSyncedAt: now },
        });
        if (!r.count) continue;
      } else {
        await prisma.member.update({
          where: { clubKey_memberNumber: { clubKey, memberNumber: String(e.memberNumber) } },
          data: { handicapIndex: idx, handicapSyncedAt: now },
        });
      }
      updated++;
    } catch {
      // no matching member — skip, keep going
    }
  }
  return updated;
}

// Best-effort live pull from HNA for the given members. Returns index entries,
// or null when no HNA endpoint is configured (the normal state until we have
// credentials). Configure HNA_API_URL to a service that accepts a POST of
// { clubId, hnaIds } and returns [{ hnaId, handicapIndex }].
export async function fetchFromHna(hnaIds: string[]): Promise<HandicapEntry[] | null> {
  const url = process.env.HNA_API_URL;
  if (!url || hnaIds.length === 0) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.HNA_API_KEY ? { Authorization: `Bearer ${process.env.HNA_API_KEY}` } : {}),
      },
      body: JSON.stringify({ clubId: process.env.HNA_CLUB_ID ?? "49", hnaIds }),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as any[];
    return rows
      .filter((r) => r && r.hnaId != null && Number.isFinite(Number(r.handicapIndex)))
      .map((r) => ({ hnaId: String(r.hnaId), handicapIndex: Number(r.handicapIndex) }));
  } catch {
    return null; // unreachable / not configured — caller falls back to manual
  }
}
