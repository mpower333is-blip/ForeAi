import { Router } from "express";
import prisma from "../config/db";

// Device registration for lightning push alerts. The app sends its Expo push
// token plus the location it wants watched (the course centre, or live GPS).
// The background watcher (src/lib/lightningWatcher) reads these rows and pushes
// alerts when a storm is a danger — so a player is warned even with the app
// closed. Turning lightning alerts off in the app unregisters the device.

const router = Router();

function validToken(t: unknown): t is string {
  return typeof t === "string" && (t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken["));
}

// POST /push/register { token, platform?, lat?, lng? }
router.post("/register", async (req, res) => {
  const { token, platform, lat, lng } = req.body ?? {};
  if (!validToken(token)) {
    res.status(400).json({ error: "a valid Expo push token is required" });
    return;
  }
  const data = {
    platform: typeof platform === "string" ? platform.slice(0, 16) : null,
    lat: isFinite(Number(lat)) ? Number(lat) : null,
    lng: isFinite(Number(lng)) ? Number(lng) : null,
    enabled: true,
  };
  try {
    const device = await prisma.pushDevice.upsert({
      where: { token },
      update: data,
      create: { token, ...data },
    });
    res.json({ ok: true, id: device.id });
  } catch (e) {
    console.error("push/register failed:", e);
    res.status(500).json({ error: "could not register device" });
  }
});

// POST /push/unregister { token } — player turned lightning alerts off, or the
// device is being retired. Idempotent.
router.post("/unregister", async (req, res) => {
  const { token } = req.body ?? {};
  if (!validToken(token)) {
    res.status(400).json({ error: "a valid Expo push token is required" });
    return;
  }
  try {
    await prisma.pushDevice.deleteMany({ where: { token } });
    res.json({ ok: true });
  } catch (e) {
    console.error("push/unregister failed:", e);
    res.status(500).json({ error: "could not unregister device" });
  }
});

export default router;
