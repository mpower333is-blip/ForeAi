// Thin client for the ForeAi backend.
//
// The app is designed to work fully offline using the on-device engine in
// lib/golfEngine. This client is only used for persistence + sync when a
// backend is reachable; every call fails soft so the UI never blocks on it.

import { Conditions, StrategyInput } from "../lib/golfEngine";

// Render is retired — the app runs on Firestore for shared features and the
// on-device engine for solo play, so there is no default backend. These sync
// calls fail soft (no-op) unless EXPO_PUBLIC_API_URL is set for local dev.
export const API_BASE = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? "";

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
