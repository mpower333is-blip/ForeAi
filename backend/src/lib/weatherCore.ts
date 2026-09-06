// Shared weather + lightning logic used by both the /weather route (which the
// app and clubhouse board poll) and the background lightning watcher (which
// pushes alerts to phones even when the app is closed). Conditions come from
// Open-Meteo (free, no key); real strikes come from Xweather when a key is set.

const R = 6371; // km
const rad = Math.PI / 180;

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function bearing8(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const y = Math.sin((to.lng - from.lng) * rad) * Math.cos(to.lat * rad);
  const x = Math.cos(from.lat * rad) * Math.sin(to.lat * rad) - Math.sin(from.lat * rad) * Math.cos(to.lat * rad) * Math.cos((to.lng - from.lng) * rad);
  const deg = (Math.atan2(y, x) / rad + 360) % 360;
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8];
}

export function describeCode(code: number): string {
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

export async function withTimeout(url: string, ms = 6000): Promise<any | null> {
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

export type Lightning = {
  level: "none" | "watch" | "warning";
  message: string;
  nearestKm?: number;
  nearestDir?: string;
  strikeCount?: number;
  source: "strikes" | "forecast";
};

export type Report = {
  updatedAt: string;
  current: { tempC: number; windKmh: number; gustKmh: number; code: number; condition: string } | null;
  lightning: Lightning;
};

export async function openMeteo(lat: number, lng: number) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m,precipitation` +
    // 15-minute nowcast for the next ~2h — the finest free lead time on a storm.
    `&minutely_15=weather_code,precipitation,cape&forecast_minutely_15=8` +
    `&hourly=weather_code,precipitation_probability,cape&forecast_hours=6` +
    `&wind_speed_unit=kmh&temperature_unit=celsius&timezone=auto`;
  return withTimeout(url);
}

// Real detected strikes near the point in the last 15 minutes (Xweather/Aeris).
export async function fetchStrikes(lat: number, lng: number): Promise<{ lat: number; lng: number }[] | null> {
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

export function forecastRisk(om: any): Lightning {
  const code = Number(om?.current?.weather_code) || 0;
  if (code >= 95) return { level: "warning", message: "Thunderstorm overhead — seek shelter now.", source: "forecast" };

  // CAPE "now" — Open-Meteo doesn't put CAPE in `current`, so use the first
  // 15-min nowcast bucket as the present value (storm energy in J/kg).
  const nowCape = Number(om?.minutely_15?.cape?.[0]) || 0;
  const nowPrecip = Number(om?.current?.precipitation) || 0;
  const nowShowers = code >= 80 || (code >= 61 && code <= 67); // rain showers / heavy rain now

  // Active-storm proxy: the model may not code a thunderstorm even while one is
  // on top of you. High convective energy + rain falling right now is the best
  // free signal that it's an electrical storm — treat it as a warning. A false
  // "seek shelter" is far cheaper than a missed strike, so we err toward safety.
  if (nowCape >= 1500 && (nowPrecip >= 0.3 || nowShowers)) {
    return { level: "warning", message: "Storm conditions overhead — treat as lightning risk, seek shelter.", source: "forecast" };
  }

  // 1) 15-minute nowcast — the finest lead time (next ~2 hours).
  const mCodes: number[] = om?.minutely_15?.weather_code ?? [];
  const mi = mCodes.findIndex((wc) => Number(wc) >= 95);
  if (mi >= 0) {
    const mins = mi * 15;
    if (mins <= 30) return { level: "warning", message: `Thunderstorm within ~${mins || 15} min — get off the course now.`, source: "forecast" };
    return { level: "watch", message: `Thunderstorm likely in ~${mins} min.`, source: "forecast" };
  }

  // 2) Hourly outlook (roughly 2–6 hours out).
  const hCodes: number[] = om?.hourly?.weather_code ?? [];
  const hi = hCodes.findIndex((wc) => Number(wc) >= 95);
  if (hi >= 0) {
    return hi <= 1
      ? { level: "watch", message: "Thunderstorms likely within the hour.", source: "forecast" }
      : { level: "watch", message: `Thunderstorms expected in ~${hi}h.`, source: "forecast" };
  }

  // 3) No coded storm yet, but high instability now + rain chance = building
  //    risk. Threshold lowered (1200 J/kg / 30%) so a developing cell nudges
  //    the board to "watch" earlier.
  const capeVals = (om?.minutely_15?.cape ?? om?.hourly?.cape ?? []) as any[];
  const maxCape = Math.max(nowCape, ...capeVals.map((v) => Number(v) || 0));
  const maxProb = Math.max(0, ...(om?.hourly?.precipitation_probability ?? []).map((v: any) => Number(v) || 0));
  if (maxCape >= 1200 && maxProb >= 30) return { level: "watch", message: "Storm potential building — keep an eye on the sky.", source: "forecast" };
  return { level: "none", message: "No storms nearby.", source: "forecast" };
}

// Build the full report (conditions + lightning) for a point, preferring real
// strikes when a provider key is set and falling back to the forecast signal.
export async function buildReport(lat: number, lng: number): Promise<Report> {
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

  let lightning: Lightning;
  if (strikes && strikes.length > 0) {
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
    lightning = om ? forecastRisk(om) : { level: "none", message: "Weather unavailable.", source: "forecast" };
  }

  return { updatedAt: new Date().toISOString(), current, lightning };
}
