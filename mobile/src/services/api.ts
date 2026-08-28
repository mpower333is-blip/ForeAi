// Thin client for the ForeAi backend.
//
// The app is designed to work fully offline using the on-device engine in
// lib/golfEngine. This client is only used for persistence + sync when a
// backend is reachable; every call fails soft so the UI never blocks on it.

import { Conditions, StrategyInput } from "../lib/golfEngine";

// The live backend. Override with EXPO_PUBLIC_API_URL for local dev (use your
// machine's LAN IP, e.g. http://192.168.1.20:5000, so a phone can reach it).
export const API_BASE =
  (process.env.EXPO_PUBLIC_API_URL as string | undefined) ??
  "https://foreai.onrender.com";

async function post<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null; // offline / unreachable — caller falls back to local engine
  }
}

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const api = {
  ping: () => get<{ status: string }>("/health"),

  recommendClub: (c: Conditions) =>
    post<{ recommendation: string }>("/caddie/recommend", c),

  strategy: (input: StrategyInput) =>
    post<{ strategy: unknown }>("/strategy/plan", input),

  saveShot: (shot: unknown) => post("/shots/add", shot),

  getClubs: (userId: string) => get<unknown[]>(`/clubs/${userId}`),
};
