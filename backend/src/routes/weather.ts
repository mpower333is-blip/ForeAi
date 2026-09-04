import { Router } from "express";

// Weather + LIVE lightning for a location. The app and the clubhouse board both
// read this so the lightning provider's secret key stays server-side (never in
// the phone app or a public web page).
//
// Conditions come from Open-Meteo (free, no key). Real lightning strikes come
// from Xweather (Aeris) when XWEATHER_ID / XWEATHER_SECRET are set — each strike
// has a location + time, so we report the nearest one's distance and direction.
// With no provider key it falls back to Open-Meteo's thunderstorm forecast so the
// endpoint always works; add the key to upgrade to real detected strikes.

const router = Router();

const R = 6371; // km
const rad = Math.PI / 180;
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function bearing8(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const y = Math.sin((to.lng - from.lng) * rad) * Math.cos(to.lat * rad);
  const x = Math.cos(from.lat * rad) * Math.sin(to.lat * rad) - Math.sin(from.lat * rad) * Math.cos(to.lat * rad) * Math.cos((to.lng - from.lng) * rad);
  const deg = (Math.atan2(y, x) / rad + 360) % 360;
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8];
}

function describeCode(code: number): string {
  if (code >= 95) return "Thunderstorm";
  if (code >= 80) return "Rain showers";
  if (code >= 71) return "Snow";
  if (code >= 61) return "Rain";
  if (code >= 51) return "Drizzle";
  if (code === 45 || code === 48) return "Fog";
  if (code === 3) return "Overcast";
  if (code === 2) return "Partly cloudy";
  if (code === 1) return "Mainly clear";
  if (code === 0) return "Clear";
  return "—";
}

async function withTimeout(url: string, ms = 6000): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

type Report = {
  updatedAt: string;
  current: { tempC: number; windKmh: number; gustKmh: number; code: number; condition: string } | null;
  lightning: {
    level: "none" | "watch" | "warning";
    message: string;
    nearestKm?: number;
    nearestDir?: string;
    strikeCount?: number;
    source: "strikes" | "forecast";
  };
};

// tiny in-memory cache so we don't hammer providers (rounded to ~1 km, 60 s TTL)
const cache = new Map<string, { at: number; data: Report }>();
const TTL_MS = 60 * 1000;

async function openMeteo(lat: number, lng: number) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m` +
    `&hourly=weather_code,precipitation_probability,cape&forecast_hours=6` +
    `&wind_speed_unit=kmh&temperature_unit=celsius&timezone=auto`;
  return withTimeout(url);
}

// Real detected strikes near the point in the last 15 minutes (Xweather/Aeris).
async function fetchStrikes(lat: number, lng: number): Promise<{ lat: number; lng: number }[] | null> {
  const id = process.env.XWEATHER_ID, secret = process.env.XWEATHER_SECRET;
  if (!id || !secret) return null;
  const url =
    `https://data.api.xweather.com/lightning/${lat},${lng}` +
    `?format=json&radius=40km&from=-15minutes&limit=200&client_id=${id}&client_secret=${secret}`;
  const j = await withTimeout(url);
  const rows: any[] = j?.response ?? [];
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => {
      const la = r?.loc?.lat ?? r?.lat, ln = r?.loc?.long ?? r?.loc?.lng ?? r?.long ?? r?.lng;
      return typeof la === "number" && typeof ln === "number" ? { lat: la, lng: ln } : null;
    })
    .filter((x): x is { lat: number; lng: number } => !!x);
}

function forecastRisk(om: any): Report["lightning"] {
  const code = Number(om?.current?.weather_code) || 0;
  if (code >= 95) return { level: "warning", message: "Thunderstorm overhead — seek shelter now.", source: "forecast" };
  const hCodes: number[] = om?.hourly?.weather_code ?? [];
  const idx = hCodes.findIndex((wc) => Number(wc) >= 95);
  if (idx >= 0) {
    return idx <= 1
      ? { level: "warning", message: "Thunderstorms imminent — plan to get off the course.", source: "forecast" }
      : { level: "watch", message: `Thunderstorms expected in ~${idx}h.`, source: "forecast" };
  }
  const maxCape = Math.max(0, ...(om?.hourly?.cape ?? []).map((v: any) => Number(v) || 0));
  const maxProb = Math.max(0, ...(om?.hourly?.precipitation_probability ?? []).map((v: any) => Number(v) || 0));
  if (maxCape >= 2000 && maxProb >= 40) return { level: "watch", message: "Storm potential building — keep an eye on the sky.", source: "forecast" };
  return { level: "none", message: "No storms nearby.", source: "forecast" };
}

router.get("/", async (req, res) => {
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  if (!isFinite(lat) || !isFinite(lng)) {
    res.status(400).json({ error: "lat and lng are required" });
    return;
  }
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    res.json(hit.data);
    return;
  }

  const [om, strikes] = await Promise.all([openMeteo(lat, lng), fetchStrikes(lat, lng)]);

  const current = om?.current
    ? {
        tempC: Math.round(om.current.temperature_2m),
        windKmh: Math.round(om.current.wind_speed_10m),
        gustKmh: Math.round(om.current.wind_gusts_10m ?? om.current.wind_speed_10m),
        code: Number(om.current.weather_code) || 0,
        condition: describeCode(Number(om.current.weather_code) || 0),
      }
    : null;

  let lightning: Report["lightning"];
  if (strikes && strikes.length > 0) {
    // Real strikes: report the nearest and how many are close.
    const here = { lat, lng };
    const withDist = strikes.map((s) => ({ ...s, km: haversineKm(here, s) })).sort((a, b) => a.km - b.km);
    const nearest = withDist[0];
    const within15 = withDist.filter((s) => s.km <= 15).length;
    const km = Math.round(nearest.km);
    const dir = bearing8(here, nearest);
    if (nearest.km <= 15) {
      lightning = { level: "warning", message: `Lightning ${km} km ${dir} — seek shelter now.`, nearestKm: km, nearestDir: dir, strikeCount: within15, source: "strikes" };
    } else if (nearest.km <= 30) {
      lightning = { level: "watch", message: `Lightning ${km} km ${dir} — storm approaching.`, nearestKm: km, nearestDir: dir, strikeCount: withDist.length, source: "strikes" };
    } else {
      lightning = { level: "watch", message: `Distant lightning ${km} km ${dir}.`, nearestKm: km, nearestDir: dir, strikeCount: withDist.length, source: "strikes" };
    }
  } else {
    // No strike provider (or no strikes): fall back to the forecast signal.
    lightning = om ? forecastRisk(om) : { level: "none", message: "Weather unavailable.", source: "forecast" };
  }

  const data: Report = { updatedAt: new Date().toISOString(), current, lightning };
  cache.set(key, { at: Date.now(), data });
  res.json(data);
});

export default router;
