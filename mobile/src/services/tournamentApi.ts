// Backend client for multi-device tournaments.
//
// Every mutation returns the full, freshly-serialized event so the caller can
// replace its local copy — that keeps all devices convergent without diffing.
// All calls fail soft (return null) so the UI can surface a clear error rather
// than throwing.

import { API_BASE } from "./api";
import { TEvent } from "../lib/tournament";

async function req<T>(path: string, method: string, body?: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}/tournaments${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// Server events omit `remote`; stamp it so the app knows they're synced.
function tag(ev: TEvent | null): TEvent | null {
  return ev ? { ...ev, remote: true } : null;
}

export const tournamentApi = {
  create: (input: {
    name: string;
    courseId: string;
    format: string;
    firstTeeMin: number;
    intervalMin: number;
    shotgun?: boolean;
  }) => req<TEvent>("", "POST", input).then(tag),

  get: (id: string) => req<TEvent>(`/${id}`, "GET").then(tag),

  getByCode: (code: string) =>
    req<TEvent>(`/code/${encodeURIComponent(code.trim().toUpperCase())}`, "GET").then(tag),

  update: (
    id: string,
    patch: Partial<
      Pick<TEvent, "name" | "format" | "firstTeeMin" | "intervalMin" | "shotgun" | "cause" | "causePhoto">
    >
  ) => req<TEvent>(`/${id}`, "PATCH", patch).then(tag),

  addSponsor: (
    id: string,
    sponsor: { name: string; tier: string; hole?: number | null; message?: string | null; logo?: string | null }
  ) => req<TEvent>(`/${id}/sponsors`, "POST", sponsor).then(tag),

  removeSponsor: (id: string, sponsorId: string) =>
    req<TEvent>(`/${id}/sponsors/${sponsorId}`, "DELETE").then(tag),

  addPlayer: (id: string, player: { name: string; handicap: number; deviceId?: string; groupId?: string | null }) =>
    req<TEvent>(`/${id}/players`, "POST", player).then(tag),

  removePlayer: (id: string, playerId: string) =>
    req<TEvent>(`/${id}/players/${playerId}`, "DELETE").then(tag),

  assignPlayer: (id: string, playerId: string, groupId: string | null) =>
    req<TEvent>(`/${id}/players/${playerId}`, "PATCH", { groupId }).then(tag),

  // Link (or, with deviceId null, unlink) this device to an existing player.
  claimPlayer: (id: string, playerId: string, deviceId: string | null) =>
    req<TEvent>(`/${id}/players/${playerId}/claim`, "PUT", { deviceId }).then(tag),

  addGroup: (id: string) => req<TEvent>(`/${id}/groups`, "POST", {}).then(tag),

  removeGroup: (id: string, groupId: string) =>
    req<TEvent>(`/${id}/groups/${groupId}`, "DELETE").then(tag),

  setScore: (id: string, playerId: string, hole: number, strokes: number) =>
    req<TEvent>(`/${id}/scores`, "PUT", { playerId, hole, strokes }).then(tag),

  addContest: (id: string, type: string, hole: number) =>
    req<TEvent>(`/${id}/contests`, "POST", { type, hole }).then(tag),

  removeContest: (id: string, contestId: string) =>
    req<TEvent>(`/${id}/contests/${contestId}`, "DELETE").then(tag),

  setContestResult: (id: string, contestId: string, playerId: string, value: number) =>
    req<TEvent>(`/${id}/contests/${contestId}/results`, "PUT", { playerId, value }).then(tag),

  // Heartbeat: mark this player live and optionally share GPS. Returns quickly
  // (no full event) — presence fans out via the regular poll.
  ping: (id: string, playerId: string, coord?: { lat: number; lng: number }) =>
    req<{ ok: boolean }>(`/${id}/players/${playerId}/ping`, "PUT", coord ?? {}),
};
