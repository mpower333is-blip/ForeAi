// Live weather for the AI Caddie — current temperature + wind at the player's
// location. Uses Open-Meteo (open-meteo.com): free, no API key, https.
//
// The caddie needs a signed head/tail wind (+ into, − down). A weather API only
// gives wind speed + the direction it blows FROM, so we convert that to a
// head/tail component along the shot line when we know the bearing to the target
// (on-course, from the GPS pin mark). Without a bearing we return the raw speed
// and let the player set the sign.

import { Coord, bearingDegrees } from "../lib/geo";

export type Weather = {
  tempF: number;
  windMph: number;
  windFromDeg: number; // meteorological: direction the wind blows FROM
};

export async function fetchWeather(c: Coord): Promise<Weather | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lng}` +
      `&current=temperature_2m,wind_speed_10m,wind_direction_10m` +
      `&wind_speed_unit=mph&temperature_unit=fahrenheit`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const j: any = await res.json();
    const cur = j?.current;
    if (!cur) return null;
    return {
      tempF: Math.round(cur.temperature_2m),
      windMph: Math.round(cur.wind_speed_10m),
      windFromDeg: Number(cur.wind_direction_10m) || 0,
    };
  } catch {
    return null;
  }
}

// ── On-course weather report + lightning risk ───────────────────────────────
// Golf's biggest weather danger is lightning — courses evacuate when a storm is
// near. Open-Meteo gives the WMO weather code (95/96/99 = thunderstorm) plus
// CAPE (storm energy) and precip probability in the hourly forecast, which we
// turn into a simple none / watch / warning level with lead time.

export type LightningLevel = "none" | "watch" | "warning";

export type WeatherReport = {
  tempF: number;
  windMph: number;
  gustMph: number;
  windFromDeg: number;
  code: number;
  condition: string;
  lightning: { level: LightningLevel; message: string; etaHours?: number };
};

// WMO weather-code → short label.
export function describeWeatherCode(code: number): string {
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

export async function fetchWeatherReport(c: Coord): Promise<WeatherReport | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lng}` +
      `&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation` +
      // 15-minute nowcast for the next ~2h — the finest free lead time on a storm.
      `&minutely_15=weather_code,precipitation,cape&forecast_minutely_15=8` +
      `&hourly=weather_code,precipitation_probability,cape&forecast_hours=6` +
      `&wind_speed_unit=mph&temperature_unit=fahrenheit&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const j: any = await res.json();
    const cur = j?.current;
    if (!cur) return null;
    const code = Number(cur.weather_code) || 0;

    return {
      tempF: Math.round(cur.temperature_2m),
      windMph: Math.round(cur.wind_speed_10m),
      gustMph: Math.round(cur.wind_gusts_10m ?? cur.wind_speed_10m),
      windFromDeg: Number(cur.wind_direction_10m) || 0,
      code,
      condition: describeWeatherCode(code),
      lightning: forecastRisk(j),
    };
  } catch {
    return null;
  }
}

// Lightning risk from a free Open-Meteo forecast — kept in lock-step with the
// server's weatherCore.forecastRisk so the app warns identically whether or not
// the weather function is reachable. The golfer's safety can't depend on a coded
// thunderstorm: WMO code 95 lags the real sky by many minutes, so we also treat
// high convective energy with rain falling right now as a storm overhead. A
// false "seek shelter" is far cheaper than a missed strike — we err to safety.
function forecastRisk(j: any): WeatherReport["lightning"] {
  const code = Number(j?.current?.weather_code) || 0;
  if (code >= 95) {
    return { level: "warning", message: "Thunderstorm overhead — seek shelter now.", etaHours: 0 };
  }

  // CAPE "now" — Open-Meteo doesn't put CAPE in `current`, so use the first
  // 15-min nowcast bucket as the present value (storm energy in J/kg).
  const nowCape = Number(j?.minutely_15?.cape?.[0]) || 0;
  const nowPrecip = Number(j?.current?.precipitation) || 0;
  const nowShowers = code >= 80 || (code >= 61 && code <= 67); // rain showers / heavy rain now

  // Active-storm proxy: the model may not code a thunderstorm even while one is
  // on top of you. High convective energy + rain falling right now is the best
  // free signal that it's an electrical storm — treat it as a warning.
  if (nowCape >= 1500 && (nowPrecip >= 0.3 || nowShowers)) {
    return { level: "warning", message: "Storm conditions overhead — treat as lightning risk, seek shelter.", etaHours: 0 };
  }

  // 1) 15-minute nowcast — the finest lead time (next ~2 hours).
  const mCodes: number[] = j?.minutely_15?.weather_code ?? [];
  const mi = mCodes.findIndex((wc) => Number(wc) >= 95);
  if (mi >= 0) {
    const mins = mi * 15;
    if (mins <= 30) return { level: "warning", message: `Thunderstorm within ~${mins || 15} min — get off the course now.`, etaHours: 0 };
    return { level: "watch", message: `Thunderstorm likely in ~${mins} min.`, etaHours: Math.round(mins / 60) };
  }

  // 2) Hourly outlook (roughly 2–6 hours out).
  const hCodes: number[] = j?.hourly?.weather_code ?? [];
  const hi = hCodes.findIndex((wc) => Number(wc) >= 95);
  if (hi >= 0) {
    return hi <= 1
      ? { level: "watch", message: "Thunderstorms likely within the hour.", etaHours: hi }
      : { level: "watch", message: `Thunderstorms expected in ~${hi}h.`, etaHours: hi };
  }

  // 3) No coded storm yet, but high instability now + rain chance = building
  //    risk. Thresholds match the server (1200 J/kg / 30%) so a developing cell
  //    nudges the panel to "watch" early.
  const capeVals = (j?.minutely_15?.cape ?? j?.hourly?.cape ?? []) as any[];
  const maxCape = Math.max(nowCape, ...capeVals.map((v) => Number(v) || 0));
  const maxProb = Math.max(0, ...(j?.hourly?.precipitation_probability ?? []).map((v: any) => Number(v) || 0));
  if (maxCape >= 1200 && maxProb >= 30) {
    return { level: "watch", message: "Storm potential building — keep an eye on the sky." };
  }
  return { level: "none", message: "No storms nearby." };
}

// ── Planning outlook ─────────────────────────────────────────────────────────
// Before heading out you want the NEXT few hours, not just now: is a storm
// rolling in during your round? This returns a compact hour-by-hour outlook plus
// a plain play verdict, all metric for SA.

export type OutlookHour = {
  time: string; // "14:00" local
  tempC: number;
  code: number;
  condition: string;
  rainProb: number; // %
  storm: boolean; // thunderstorm coded this hour
};

export type PlayVerdict = {
  level: LightningLevel; // none = good to play, watch = caution, warning = don't go
  headline: string;
  detail: string;
};

export type WeatherOutlook = {
  hours: OutlookHour[];
  verdict: PlayVerdict;
};

// "HH:MM" from an Open-Meteo local ISO time like "2026-09-28T14:00".
function hourLabel(iso: string): string {
  const t = String(iso).slice(11, 16);
  return t || "—";
}

// Prefer the weather function (server-side, cached, same place the live
// lightning comes from); fall back to a direct Open-Meteo forecast if the
// function is unset or unreachable so the outlook always renders.
export async function fetchOutlook(
  c: Coord,
  weatherUrl: string,
  hours = 8,
): Promise<WeatherOutlook | null> {
  if (weatherUrl) {
    try {
      const sep = weatherUrl.includes("?") ? "&" : "?";
      const res = await fetch(`${weatherUrl}${sep}outlook=1&hours=${hours}&lat=${c.lat}&lng=${c.lng}`);
      if (res.ok) {
        const j: any = await res.json();
        if (Array.isArray(j?.hours) && j?.verdict) return j as WeatherOutlook;
      }
    } catch {
      /* fall through to direct forecast */
    }
  }
  return fetchOutlookDirect(c, hours);
}

async function fetchOutlookDirect(c: Coord, hours = 8): Promise<WeatherOutlook | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lng}` +
      `&hourly=temperature_2m,weather_code,precipitation_probability` +
      `&forecast_hours=${hours + 1}&temperature_unit=celsius&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const j: any = await res.json();
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
        condition: describeWeatherCode(code),
        rainProb: Math.round(Number(probs[i]) || 0),
        storm: code >= 95,
      };
    });

    // Earliest storm hour in the window drives the verdict.
    const stormIdx = list.findIndex((h) => h.storm);
    const maxRain = Math.max(0, ...list.map((h) => h.rainProb));
    let verdict: PlayVerdict;
    if (stormIdx === 0) {
      verdict = {
        level: "warning",
        headline: "Lightning risk now",
        detail: "Thunderstorms overhead — hold off heading out.",
      };
    } else if (stormIdx > 0 && stormIdx <= 2) {
      verdict = {
        level: "warning",
        headline: `Storms in ~${stormIdx}h`,
        detail: "A quick nine now, or wait it out — plan to be off the course before it hits.",
      };
    } else if (stormIdx > 2) {
      verdict = {
        level: "watch",
        headline: `Storms later (~${stormIdx}h)`,
        detail: "Clear for now — an early round should beat the weather.",
      };
    } else if (maxRain >= 60) {
      verdict = {
        level: "watch",
        headline: "Showers likely",
        detail: "Rain about, but no lightning expected — playable if you don't mind getting wet.",
      };
    } else {
      verdict = {
        level: "none",
        headline: "Good window to play",
        detail: "No lightning in the next few hours.",
      };
    }

    return { hours: list, verdict };
  } catch {
    return null;
  }
}

// Metric report the on-course panel renders. Prefers the backend (which adds
// REAL detected lightning strikes with distance/direction when a provider key is
// configured server-side), and falls back to the direct Open-Meteo forecast so
// the panel always shows something.
export type PanelWeather = {
  tempC: number;
  windKmh: number;
  gustKmh: number;
  condition: string;
  lightning: {
    level: LightningLevel;
    message: string;
    nearestKm?: number;
    nearestDir?: string;
    strikeCount?: number;
    source: "strikes" | "forecast";
  };
};

// `weatherUrl` is the FULL weather-function endpoint (see api.ts WEATHER_URL) —
// the server-side proxy that adds REAL Xweather lightning strikes. Falls back to
// the direct Open-Meteo forecast when it's unset or unreachable.
export async function fetchLiveWeather(c: Coord, weatherUrl: string): Promise<PanelWeather | null> {
  // 1) Weather function — real strikes when a provider key is configured on it.
  if (weatherUrl) {
    try {
      const sep = weatherUrl.includes("?") ? "&" : "?";
      const res = await fetch(`${weatherUrl}${sep}lat=${c.lat}&lng=${c.lng}`);
      if (res.ok) {
        const j: any = await res.json();
        if (j && (j.current || j.lightning)) {
          return {
            tempC: Math.round(j.current?.tempC ?? 0),
            windKmh: Math.round(j.current?.windKmh ?? 0),
            gustKmh: Math.round(j.current?.gustKmh ?? j.current?.windKmh ?? 0),
            condition: j.current?.condition ?? "—",
            lightning: j.lightning ?? { level: "none", message: "No storms nearby.", source: "forecast" },
          };
        }
      }
    } catch {
      /* fall through to direct forecast */
    }
  }
  // 2) Direct Open-Meteo forecast fallback.
  const r = await fetchWeatherReport(c);
  if (!r) return null;
  return {
    tempC: Math.round((r.tempF - 32) * (5 / 9)),
    windKmh: Math.round(r.windMph * 1.60934),
    gustKmh: Math.round(r.gustMph * 1.60934),
    condition: r.condition,
    lightning: { ...r.lightning, source: "forecast" },
  };
}

// Head/tail component of the wind along a shot aimed at `bearingDeg` (0..360,
// clockwise from North). Positive = headwind (plays longer), negative = tailwind.
// When the wind blows FROM the target direction it's a full headwind.
export function headwind(windFromDeg: number, windMph: number, bearingDeg: number): number {
  const angle = ((windFromDeg - bearingDeg) * Math.PI) / 180;
  return Math.round(windMph * Math.cos(angle));
}

// Convenience: signed wind for a shot from `from` toward `target`.
export function windForShot(w: Weather, from: Coord, target: Coord): number {
  return headwind(w.windFromDeg, w.windMph, bearingDegrees(from, target));
}
