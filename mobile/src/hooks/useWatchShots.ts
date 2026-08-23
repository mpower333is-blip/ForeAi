import { useEffect, useRef } from "react";
import { API_BASE } from "../services/api";
import { Coord, distanceYards } from "../lib/geo";
import { Club, Surface, Lie } from "../lib/golfEngine";

// Phone-side ingestor for the watch's swing marks (Stage 3).
//
// While you're in a live golf day and the phone sits in the cart, the watch on
// your wrist posts a mark on each shot (its GPS + the chosen club + hole). This
// polls those marks and reconstructs shots the same way the on-phone auto
// tracker does — the segment between two consecutive marks on a hole is the
// carry — and logs them, so the caddie still learns even with the phone away.
//
// De-dupes by movement: repeated marks at one spot (practice swings, re-marks)
// collapse until you've actually moved to your ball.

export type MarkShot = {
  hole: number;
  club: string;
  startYards: number;
  startSurface: Surface;
  endYards: number;
  endSurface: Surface;
  lie: Lie;
  holed: boolean;
};

const POLL_MS = 4000;
const MIN_MOVE_YARDS = 12;

function inferClub(carry: number, bag: Club[]): string {
  if (bag.length === 0) return "—";
  let best = bag[0];
  let gap = Math.abs(best.carry - carry);
  for (const c of bag) {
    const g = Math.abs(c.carry - carry);
    if (g < gap) {
      best = c;
      gap = g;
    }
  }
  return best.name;
}

export function useWatchShots({
  enabled,
  eventId,
  playerId,
  bag,
  onShot,
}: {
  enabled: boolean;
  eventId?: string;
  playerId?: string;
  bag: Club[];
  onShot: (s: MarkShot) => void;
}): void {
  const sinceRef = useRef<string | null>(null);
  // Per-hole anchor: last mark location + the club you'd hit from there.
  const anchorRef = useRef<Record<number, { coord: Coord; club: string | null }>>({});
  const shotIndexRef = useRef<Record<number, number>>({});
  const bagRef = useRef(bag);
  bagRef.current = bag;
  const onShotRef = useRef(onShot);
  onShotRef.current = onShot;

  useEffect(() => {
    if (!enabled || !eventId || !playerId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const since = sinceRef.current ? `?since=${encodeURIComponent(sinceRef.current)}` : "";
        const res = await fetch(
          `${API_BASE}/tournaments/${eventId}/players/${playerId}/marks${since}`
        );
        if (!res.ok) return;
        const marks: any[] = await res.json();
        for (const m of marks) {
          if (m.createdAt) sinceRef.current = m.createdAt;
          if (typeof m.lat !== "number" || typeof m.lng !== "number") continue;
          const hole: number = typeof m.hole === "number" ? m.hole : 1;
          const coord: Coord = { lat: m.lat, lng: m.lng };
          const club: string | null = m.club ?? null;

          const prev = anchorRef.current[hole];
          if (!prev) {
            anchorRef.current[hole] = { coord, club };
            continue;
          }
          const carry = distanceYards(prev.coord, coord);
          if (carry < MIN_MOVE_YARDS) {
            // Same spot — keep the anchor but adopt the latest intended club.
            anchorRef.current[hole] = { coord: prev.coord, club };
            continue;
          }
          const idx = shotIndexRef.current[hole] ?? 0;
          const onTee = idx === 0;
          onShotRef.current({
            hole,
            club: prev.club || inferClub(carry, bagRef.current),
            startYards: carry,
            startSurface: onTee ? "tee" : "fairway",
            endYards: 0,
            endSurface: carry <= 30 ? "green" : "fairway",
            lie: onTee ? "tee" : "fairway",
            holed: false,
          });
          anchorRef.current[hole] = { coord, club };
          shotIndexRef.current[hole] = idx + 1;
        }
      } catch {
        // offline / transient — try again next tick
      }
    };

    poll();
    const iv = setInterval(() => {
      if (!cancelled) poll();
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [enabled, eventId, playerId]);
}
