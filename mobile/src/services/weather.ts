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
