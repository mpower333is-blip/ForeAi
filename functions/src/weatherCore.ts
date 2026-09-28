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

export type Point = { lat: number; lng: number };

// Real detected strikes near the point in the last 15 minutes (Xweather/Aeris).
// Returns null when no key is configured, [] when configured but no strikes.
export async function fetchStrikes(lat: number, lng: number): Promise<Point[] | null> {
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
    .filter((x): x is Point => !!x);
}

// ── The Weather Company (weather.com) Lightning API v3 ───────────────────────
// Strikes within 10 miles (17 km) of the geocode over the time window in the
// endpoint path. The response is columnar — parallel arrays indexed by strike
// order — so we zip the latitude + longitude arrays into points (distance and
// direction are computed here). Auth is a single apiKey query param.
//
// Env:
//   TWC_API_KEY            — the weather.com Data API key (required)
//   TWC_LIGHTNING_ENDPOINT — override the path/variant your plan allows
//                            (default /v3/wx/lightning/15minute/desktop)
//   TWC_HOST               — override the host (default https://api.weather.com)

const TWC_DEFAULT_ENDPOINT = "/v3/wx/lightning/15minute/desktop";

export function twcLightningUrl(lat: number, lng: number, key: string): string {
  const host = process.env.TWC_HOST || "https://api.weather.com";
  const path = process.env.TWC_LIGHTNING_ENDPOINT || TWC_DEFAULT_ENDPOINT;
  return `${host}${path}?geocode=${lat},${lng}&format=json&units=m&apiKey=${key}`;
}

// Pull latitude/longitude arrays out of TWC's columnar response, wherever they
// sit (top level or under a wrapper key), and zip them. Defensive about field
// names so it survives small schema differences between variants.
export function parseTwcStrikes(j: any): Point[] {
  if (!j || typeof j !== "object") return [];
  const asArr = (v: any): any[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
  const pick = (o: any, keys: string[]) => {
    for (const k of keys) if (o && o[k] != null) return o[k];
    return undefined;
  };
  // Look at the top level and any nested object (the arrays may be wrapped).
  const containers = [j, ...Object.values(j).filter((v) => v && typeof v === "object")];
  for (const c of containers) {
    const lats = pick(c, ["latitude", "lat", "latitudes"]);
    const lons = pick(c, ["longitude", "lon", "long", "lng", "longitudes"]);
    if (lats != null && lons != null) {
      const la = asArr(lats), lo = asArr(lons);
      const n = Math.min(la.length, lo.length);
      const pts: Point[] = [];
      for (let i = 0; i < n; i++) {
        const a = Number(la[i]), b = Number(lo[i]);
        if (isFinite(a) && isFinite(b)) pts.push({ lat: a, lng: b });
      }
      if (pts.length) return pts;
    }
  }
  return [];
}

// Returns null when no key is configured, [] when configured but no strikes.
export async function fetchTwcStrikes(lat: number, lng: number): Promise<Point[] | null> {
  const key = process.env.TWC_API_KEY;
  if (!key) return null;
  const j = await withTimeout(twcLightningUrl(lat, lng, key));
  return parseTwcStrikes(j);
}

// Best available real strikes: Weather.com first, then Xweather. null only when
// NEITHER provider is configured (so the caller falls back to the forecast).
export async function fetchBestStrikes(lat: number, lng: number): Promise<Point[] | null> {
  const [twc, xw] = await Promise.all([fetchTwcStrikes(lat, lng), fetchStrikes(lat, lng)]);
  if (twc && twc.length) return twc;
  if (xw && xw.length) return xw;
  if (twc != null || xw != null) return []; // a provider is configured, just no strikes now
  return null; // no provider configured
}

// Diagnostics for the /weather?debug=1 probe — reports whether each provider is
// configured and what it returned, WITHOUT exposing any secret. Lets you tell a
// working key from a missing one from a plan that has no lightning package.
export async function diagnoseProviders(lat: number, lng: number): Promise<any> {
  const out: any = {};

  const xId = process.env.XWEATHER_ID, xSec = process.env.XWEATHER_SECRET;
  out.xweather = { configured: !!(xId && xSec) };
  if (xId && xSec) {
    try {
      const r = await fetch(
        `https://data.api.xweather.com/lightning/${lat},${lng}?format=json&radius=40km&from=-15minutes&limit=200&client_id=${xId}&client_secret=${xSec}`
      );
      out.xweather.httpStatus = r.status;
      const j: any = await r.json().catch(() => null);
      out.xweather.apiError = j?.error?.code ?? null;
      out.xweather.strikeCount = Array.isArray(j?.response) ? j.response.length : 0;
    } catch (e) {
      out.xweather.fetchError = String(e);
    }
  }

  const key = process.env.TWC_API_KEY;
  out.twc = { configured: !!key, endpoint: process.env.TWC_LIGHTNING_ENDPOINT || TWC_DEFAULT_ENDPOINT };
  if (key) {
    try {
      const r = await fetch(twcLightningUrl(lat, lng, key));
      out.twc.httpStatus = r.status;
      const j: any = await r.json().catch(() => null);
      out.twc.strikeCount = parseTwcStrikes(j).length;
    } catch (e) {
      out.twc.fetchError = String(e);
    }
  }

  return out;
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

// Should we spend a metered lightning-provider call? Open-Meteo is free and
// unlimited, so we use it as a cheap gate: only pay for real strike data when
// the free forecast shows the atmosphere COULD produce lightning. On a clearly
// stable day this returns false and buildReport makes ZERO provider calls —
// which is how we stay inside Xweather's monthly access budget. The bar is set
// deliberately LOW (any real convective hint trips it) so we never trade away
// safety to save a call.
export function convectivePotential(om: any): boolean {
  if (!om) return true; // no forecast to gate on → don't suppress the safety check
  const code = Number(om?.current?.weather_code) || 0;
  if (code >= 51) return true; // drizzle/rain/showers/thunder coded right now
  if ((Number(om?.current?.precipitation) || 0) > 0) return true; // rain falling now

  const nowCape = Number(om?.minutely_15?.cape?.[0]) || 0;
  const capeVals = (om?.minutely_15?.cape ?? om?.hourly?.cape ?? []) as any[];
  const maxCape = Math.max(nowCape, ...capeVals.map((v) => Number(v) || 0));
  const maxProb = Math.max(0, ...(om?.hourly?.precipitation_probability ?? []).map((v: any) => Number(v) || 0));
  const codesAhead: number[] = [
    ...((om?.minutely_15?.weather_code ?? []) as any[]),
    ...((om?.hourly?.weather_code ?? []) as any[]),
  ].map((v) => Number(v) || 0);
  if (codesAhead.some((c) => c >= 51)) return true; // any precip/storm in the nowcast/hourly window

  // Instability + a real chance of precip, or notable CAPE on its own.
  if (maxCape >= 500 && maxProb >= 20) return true;
  if (maxCape >= 1000) return true;
  return false;
}

// Build the full report (conditions + lightning) for a point, preferring real
// strikes when a provider key is set and falling back to the forecast signal.
// The metered strike call is gated behind the free forecast (convectivePotential)
// so a clear day costs no provider accesses.
export async function buildReport(lat: number, lng: number): Promise<Report> {
  const om = await openMeteo(lat, lng);
  // Only pay for real strikes when the free forecast says lightning is possible.
  const strikes = convectivePotential(om) ? await fetchBestStrikes(lat, lng) : null;

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

// ── Planning outlook ─────────────────────────────────────────────────────────
// The hour-by-hour "planning to play?" view + a plain play verdict, served
// server-side so the app and the board share one implementation (and the
// provider secret / caching stay here). Conditions come from Open-Meteo's hourly
// forecast; lightning nowcast for RIGHT NOW still comes from real strikes via
// buildReport. Metric (°C) for SA.

export type OutlookHour = {
  time: string; // "HH:MM" local
  tempC: number;
  code: number;
  condition: string;
  rainProb: number; // %
  storm: boolean; // thunderstorm coded this hour
};

export type PlayVerdict = {
  level: "none" | "watch" | "warning"; // none = good to play, warning = don't go
  headline: string;
  detail: string;
};

export type Outlook = { hours: OutlookHour[]; verdict: PlayVerdict };

function hourLabel(iso: string): string {
  const t = String(iso).slice(11, 16);
  return t || "—";
}

export async function buildOutlook(lat: number, lng: number, hours = 8): Promise<Outlook | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&hourly=temperature_2m,weather_code,precipitation_probability` +
    `&forecast_hours=${hours + 1}&temperature_unit=celsius&timezone=auto`;
  const j = await withTimeout(url);
  const times: string[] = j?.hourly?.time ?? [];
  const temps: number[] = j?.hourly?.temperature_2m ?? [];
  const codes: number[] = j?.hourly?.weather_code ?? [];
  const probs: number[] = j?.hourly?.precipitation_probability ?? [];
  if (!times.length) return null;

  const list: OutlookHour[] = times.slice(0, hours).map((t, i) => {
    const code = Number(codes[i]) || 0;
    return {
      time: hourLabel(t),
      tempC: Math.round(Number(temps[i]) || 0),
      code,
      condition: describeCode(code),
      rainProb: Math.round(Number(probs[i]) || 0),
      storm: code >= 95,
    };
  });

  const stormIdx = list.findIndex((h) => h.storm);
  const maxRain = Math.max(0, ...list.map((h) => h.rainProb));
  let verdict: PlayVerdict;
  if (stormIdx === 0) {
    verdict = { level: "warning", headline: "Lightning risk now", detail: "Thunderstorms overhead — hold off heading out." };
  } else if (stormIdx > 0 && stormIdx <= 2) {
    verdict = { level: "warning", headline: `Storms in ~${stormIdx}h`, detail: "A quick nine now, or wait it out — plan to be off the course before it hits." };
  } else if (stormIdx > 2) {
    verdict = { level: "watch", headline: `Storms later (~${stormIdx}h)`, detail: "Clear for now — an early round should beat the weather." };
  } else if (maxRain >= 60) {
    verdict = { level: "watch", headline: "Showers likely", detail: "Rain about, but no lightning expected — playable if you don't mind getting wet." };
  } else {
    verdict = { level: "none", headline: "Good window to play", detail: "No lightning in the next few hours." };
  }

  return { hours: list, verdict };
}
