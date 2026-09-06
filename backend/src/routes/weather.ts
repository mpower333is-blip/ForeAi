import { Router } from "express";
import { buildReport, diagnoseProviders, Report } from "../lib/weatherCore";

// Weather + LIVE lightning for a location. The app and the clubhouse board both
// read this so the lightning provider's secret key stays server-side (never in
// the phone app or a public web page).
//
// Conditions come from Open-Meteo (free, no key). Real lightning strikes come
// from Xweather (Aeris) when XWEATHER_ID / XWEATHER_SECRET are set — each strike
// has a location + time, so we report the nearest one's distance and direction.
// With no provider key it falls back to Open-Meteo's thunderstorm forecast so the
// endpoint always works; add the key to upgrade to real detected strikes.
//
// All of the fetching + risk logic lives in ../lib/weatherCore so the background
// lightning watcher (which pushes alerts to phones) shares exactly this logic.

const router = Router();

// tiny in-memory cache so we don't hammer providers (rounded to ~1 km, 60 s TTL)
const cache = new Map<string, { at: number; data: Report }>();
const TTL_MS = 60 * 1000;

router.get("/", async (req, res) => {
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  if (!isFinite(lat) || !isFinite(lng)) {
    res.status(400).json({ error: "lat and lng are required" });
    return;
  }
  // Diagnostic probe: /weather?lat=..&lng=..&debug=1 reports which strike
  // provider is configured and what it returned (no secrets, bypasses cache).
  if (req.query.debug) {
    const [data, providers] = await Promise.all([buildReport(lat, lng), diagnoseProviders(lat, lng)]);
    res.json({ ...data, providers });
    return;
  }

  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    res.json(hit.data);
    return;
  }

  const data = await buildReport(lat, lng);
  cache.set(key, { at: Date.now(), data });
  res.json(data);
});

export default router;
