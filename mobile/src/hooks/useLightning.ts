import React from "react";
import { Coord } from "../lib/geo";
import { fetchLiveWeather, PanelWeather } from "../services/weather";
import { API_BASE, WEATHER_URL } from "../services/api";
import { initLightningAlarm, maybeLightningAlarm } from "../lib/lightningAlarm";
import { registerLightningBackground, saveLastCoord } from "../lib/lightningBackground";
import { registerForPush } from "../lib/pushRegister";

export type LightningState = "idle" | "loading" | "ok" | "failed";

// Live weather + lightning for a location, with all the safety plumbing wired in
// one place so every screen that shows lightning behaves identically:
//   • foreground alarm (loud local notification while the app is open)
//   • background watch registration (fires the same alarm when the app is closed)
//   • last-known-coord persistence (so the background task has a location)
//   • optional server push registration (no-op until a push server is set up)
// Refreshes every 2 min; rounds the coord in deps so tiny GPS jitter doesn't
// restart the loop.
export function useLightning(coord: Coord | null): { wx: PanelWeather | null; state: LightningState } {
  const [wx, setWx] = React.useState<PanelWeather | null>(null);
  const [state, setState] = React.useState<LightningState>("idle");

  React.useEffect(() => {
    initLightningAlarm();
    registerLightningBackground();
  }, []);

  const key = coord ? `${Math.round(coord.lat * 100)},${Math.round(coord.lng * 100)}` : "";

  React.useEffect(() => {
    if (!coord) return;
    // Remember where to check when the app is closed, and register for server
    // push (fail-soft until an Expo project + push server exist).
    saveLastCoord(coord);
    registerForPush({ lat: coord.lat, lng: coord.lng }, API_BASE);
  }, [key]);

  React.useEffect(() => {
    if (!coord) return;
    let cancelled = false;
    const load = async () => {
      setState((s) => (s === "ok" ? s : "loading"));
      const r = await fetchLiveWeather(coord, WEATHER_URL);
      if (cancelled) return;
      if (r) {
        setWx(r);
        setState("ok");
        maybeLightningAlarm(r); // loud alarm if lightning is within ~10 km
      } else {
        setState((s) => (s === "ok" ? s : "failed"));
      }
    };
    load();
    // Strikes move fast — refresh every 2 min when there's a live provider.
    const id = setInterval(load, 2 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [key]);

  return { wx, state };
}
