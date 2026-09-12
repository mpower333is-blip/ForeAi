import { Router } from "express";
import prisma from "../config/db";

// Per-club settings: the admin PIN that gates roster + tee-sheet changes, and
// the shape of the tee sheet. One row per clubKey (the app flavour, e.g.
// "kempton"). The PIN is never sent back to clients — only `hasAdminPin`.

const router = Router();

// Sensible defaults for a new club — a 10-min four-ball sheet, 06:00–16:00.
async function getOrCreate(clubKey: string) {
  const existing = await prisma.clubSettings.findUnique({ where: { clubKey } });
  if (existing) return existing;
  return prisma.clubSettings.create({
    data: { clubKey, name: clubKey.charAt(0).toUpperCase() + clubKey.slice(1) },
  });
}

// Strip the PIN before returning settings to any client.
function publicSettings(s: any) {
  const { adminPin, ...rest } = s;
  return { ...rest, hasAdminPin: adminPin != null && adminPin !== "" };
}

// Admin gate — shared shape with the tournaments router. Returns true if the
// request may proceed; otherwise it has already sent 403 and the caller returns.
export function requireAdmin(s: { adminPin: string | null }, req: any, res: any): boolean {
  if (!s.adminPin) return true; // no PIN configured yet — open (club sets one first)
  const given = String(req.header("x-admin-pin") ?? req.body?.adminPin ?? "");
  if (given && given === s.adminPin) return true;
  res.status(403).json({ error: "Admin PIN required", needsPin: true });
  return false;
}

// Read settings (PIN-safe). Creates the row on first touch.
router.get("/:clubKey", async (req, res) => {
  const s = await getOrCreate(req.params.clubKey);
  res.json(publicSettings(s));
});

// Update the tee-sheet shape / club name. Admin-gated once a PIN is set.
router.post("/:clubKey/settings", async (req, res) => {
  const s = await getOrCreate(req.params.clubKey);
  if (!requireAdmin(s, req, res)) return;

  const b = req.body ?? {};
  const num = (v: any, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
  try {
    const updated = await prisma.clubSettings.update({
      where: { clubKey: req.params.clubKey },
      data: {
        name: b.name != null ? String(b.name) : s.name,
        courseId: b.courseId != null ? String(b.courseId) : s.courseId,
        firstTeeMin: num(b.firstTeeMin, s.firstTeeMin),
        lastTeeMin: num(b.lastTeeMin, s.lastTeeMin),
        intervalMin: Math.max(1, num(b.intervalMin, s.intervalMin)),
        slotCapacity: Math.max(1, num(b.slotCapacity, s.slotCapacity)),
        bookingWindowDays: Math.max(0, num(b.bookingWindowDays, s.bookingWindowDays)),
        openDays: b.openDays != null ? String(b.openDays) : s.openDays,
        currency: b.currency != null ? String(b.currency) : s.currency,
        bankingDetails: "bankingDetails" in b ? (b.bankingDetails ? String(b.bankingDetails) : null) : s.bankingDetails,
        chargeGreenFeeOnBooking:
          "chargeGreenFeeOnBooking" in b ? !!b.chargeGreenFeeOnBooking : s.chargeGreenFeeOnBooking,
      },
    });
    res.json(publicSettings(updated));
  } catch {
    res.status(500).json({ error: "Unable to save settings" });
  }
});

// Set or change the admin PIN. If one is already set, the current PIN must be
// supplied (header x-admin-pin or body.currentPin) to change it.
router.post("/:clubKey/pin", async (req, res) => {
  const s = await getOrCreate(req.params.clubKey);
  if (s.adminPin) {
    const given = String(req.header("x-admin-pin") ?? req.body?.currentPin ?? "");
    if (given !== s.adminPin) return res.status(403).json({ error: "Current PIN required", needsPin: true });
  }
  const newPin = req.body?.newPin != null ? String(req.body.newPin).trim() : "";
  await prisma.clubSettings.update({
    where: { clubKey: req.params.clubKey },
    data: { adminPin: newPin || null },
  });
  res.json({ ok: true, hasAdminPin: !!newPin });
});

export default router;
