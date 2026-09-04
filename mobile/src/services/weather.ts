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
      `&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
      `&hourly=weather_code,precipitation_probability,cape&forecast_hours=6` +
      `&wind_speed_unit=mph&temperature_unit=fahrenheit&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const j: any = await res.json();
    const cur = j?.current;
    if (!cur) return null;
    const code = Number(cur.weather_code) || 0;

    // Assess lightning risk from the current code and the next few hours.
    const hCodes: number[] = j?.hourly?.weather_code ?? [];
    const hProb: number[] = j?.hourly?.precipitation_probability ?? [];
    const hCape: number[] = j?.hourly?.cape ?? [];
    let lightning: WeatherReport["lightning"] = { level: "none", message: "No storms nearby." };

    if (code >= 95) {
      lightning = { level: "warning", message: "Thunderstorm overhead — seek shelter now.", etaHours: 0 };
    } else {
      // First upcoming hour flagged as a thunderstorm.
      const idx = hCodes.findIndex((wc) => Number(wc) >= 95);
      if (idx >= 0) {
        lightning = {
          level: idx <= 1 ? "warning" : "watch",
          message: idx <= 1 ? "Thunderstorms imminent — plan to get off the course." : `Thunderstorms expected in ~${idx}h.`,
          etaHours: idx,
        };
      } else {
        // No coded storm yet, but high instability + rain chance = building risk.
        const maxCape = Math.max(0, ...hCape.map((v) => Number(v) || 0));
        const maxProb = Math.max(0, ...hProb.map((v) => Number(v) || 0));
        if (maxCape >= 2000 && maxProb >= 40) {
          lightning = { level: "watch", message: "Storm potential building this afternoon — keep an eye on the sky." };
        }
      }
    }

    return {
      tempF: Math.round(cur.temperature_2m),
      windMph: Math.round(cur.wind_speed_10m),
      gustMph: Math.round(cur.wind_gusts_10m ?? cur.wind_speed_10m),
      windFromDeg: Number(cur.wind_direction_10m) || 0,
      code,
      condition: describeWeatherCode(code),
      lightning,
    };
  } catch {
    return null;
  }
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
