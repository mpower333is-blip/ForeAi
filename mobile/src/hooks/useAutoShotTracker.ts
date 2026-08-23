import { useEffect, useRef, useState } from "react";
import { Accelerometer } from "expo-sensors";
import { Coord, distanceYards } from "../lib/geo";
import { Club } from "../lib/golfEngine";
import { Surface, Lie } from "../lib/golfEngine";

// Hands-free automatic shot logging — the "Arccos without hardware" engine.
//
// It watches the accelerometer continuously for the sharp spike of a golf
// impact, and remembers WHERE (GPS) each detected swing happened. A shot is the
// segment between two consecutive swing locations: when you swing, walk/ride to
// your ball, and swing again, the distance between those two spots is the carry
// of the first shot. The club is taken from what you've selected (e.g. on the
// watch) or inferred from the carry against your bag.
//
// Why this shape: the phone (or watch) can feel the swing, and GPS knows the
// position — together that reconstructs the shot without any grip sensor. A
// minimum-move gate throws away practice swings and waggles (no movement), and
// a refractory period stops one swing registering twice.
//
// The phone must be ON YOUR BODY (pocket) to feel the swing — in the cart it
// can't, which is exactly what the watch integration solves: the watch detects
// the swing and this same logic logs it.

export type AutoShotInput = {
  hole: number;
  club: string;
  startYards: number;
  startSurface: Surface;
  endYards: number;
  endSurface: Surface;
  lie: Lie;
  holed: boolean;
};

export type AutoTrackerStatus = {
  sensorOk: boolean | null;
  active: boolean; // listener running
  swingsThisHole: number; // swings detected on the current hole
  shotsThisHole: number; // completed (logged) shots this hole
  lastCarryYards: number | null; // carry of the most recent logged shot
  awaitingMove: boolean; // a swing is marked, waiting for you to reach the ball
};

const IMPACT_G = 0.8; // spike magnitude that counts as an impact (gravity removed)
const REFRACTORY_MS = 2500; // ignore further spikes for this long after one
const MIN_MOVE_YARDS = 12; // a real shot moves you at least this far
const SAMPLE_MS = 20;

function inferClub(carryYards: number, bag: Club[]): string {
  if (bag.length === 0) return "—";
  let best = bag[0];
  let bestGap = Math.abs(best.carry - carryYards);
  for (const c of bag) {
    const gap = Math.abs(c.carry - carryYards);
    if (gap < bestGap) {
      best = c;
      bestGap = gap;
    }
  }
  return best.name;
}

export function useAutoShotTracker({
  enabled,
  hole,
  coord,
  greenCoord,
  bag,
  selectedClub,
  onShot,
}: {
  enabled: boolean;
  hole: number;
  coord: Coord | null;
  greenCoord?: Coord;
  bag: Club[];
  selectedClub?: string | null; // when set (e.g. from the watch), overrides inference
  onShot: (s: AutoShotInput) => void;
}): AutoTrackerStatus {
  const [sensorOk, setSensorOk] = useState<boolean | null>(null);
  const [active, setActive] = useState(false);
  const [swingsThisHole, setSwingsThisHole] = useState(0);
  const [shotsThisHole, setShotsThisHole] = useState(0);
  const [lastCarryYards, setLastCarryYards] = useState<number | null>(null);

  // The last accepted swing location + the surface we were on there. `null`
  // until the first swing of the hole is marked.
  const lastLocRef = useRef<Coord | null>(null);
  const shotIndexRef = useRef(0); // shots logged on this hole (0 = still on the tee)
  const awaitingRef = useRef(false);
  const lastImpactRef = useRef(0);

  // Keep the latest inputs in refs so the accelerometer callback (registered
  // once) always sees current values without re-subscribing on every GPS tick.
  const coordRef = useRef(coord);
  coordRef.current = coord;
  const greenRef = useRef(greenCoord);
  greenRef.current = greenCoord;
  const bagRef = useRef(bag);
  bagRef.current = bag;
  const clubRef = useRef(selectedClub);
  clubRef.current = selectedClub;
  const onShotRef = useRef(onShot);
  onShotRef.current = onShot;

  const [awaiting, setAwaiting] = useState(false);

  // Reset per-hole state whenever the hole changes.
  useEffect(() => {
    lastLocRef.current = null;
    shotIndexRef.current = 0;
    awaitingRef.current = false;
    setAwaiting(false);
    setSwingsThisHole(0);
    setShotsThisHole(0);
    setLastCarryYards(null);
  }, [hole]);

  useEffect(() => {
    Accelerometer.isAvailableAsync()
      .then(setSensorOk)
      .catch(() => setSensorOk(false));
  }, []);

  useEffect(() => {
    if (!enabled) {
      setActive(false);
      return;
    }
    let sub: { remove: () => void } | null = null;

    const onSwing = () => {
      const here = coordRef.current;
      if (!here) return; // no GPS fix — can't place the shot
      const prev = lastLocRef.current;
      setSwingsThisHole((n) => n + 1);

      if (!prev) {
        // First swing of the hole (the tee shot leaves from here).
        lastLocRef.current = here;
        awaitingRef.current = true;
        setAwaiting(true);
        return;
      }

      const carry = distanceYards(prev, here);
      if (carry < MIN_MOVE_YARDS) {
        // No real movement — a practice swing or a re-detected impact. Ignore,
        // but keep the anchor fresh so a tiny drift doesn't accumulate.
        return;
      }

      // Complete the shot that started at `prev` and ended here.
      const green = greenRef.current;
      const startYards = green ? distanceYards(prev, green) : carry;
      const endYards = green ? distanceYards(here, green) : 0;
      const onTee = shotIndexRef.current === 0;
      const club = clubRef.current || inferClub(carry, bagRef.current);

      onShotRef.current({
        hole,
        club,
        startYards,
        startSurface: onTee ? "tee" : "fairway",
        endYards,
        endSurface: endYards <= 30 ? "green" : "fairway",
        lie: onTee ? "tee" : "fairway",
        holed: false,
      });

      lastLocRef.current = here;
      shotIndexRef.current += 1;
      awaitingRef.current = true;
      setAwaiting(true);
      setShotsThisHole((n) => n + 1);
      setLastCarryYards(carry);
    };

    const onSample = ({ x, y, z }: { x: number; y: number; z: number }) => {
      const mag = Math.abs(Math.sqrt(x * x + y * y + z * z) - 1);
      const now = Date.now();
      if (mag > IMPACT_G && now - lastImpactRef.current > REFRACTORY_MS) {
        lastImpactRef.current = now;
        onSwing();
      }
    };

    Accelerometer.setUpdateInterval(SAMPLE_MS);
    sub = Accelerometer.addListener(onSample);
    setActive(true);

    return () => {
      sub?.remove();
      setActive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, hole]);

  return {
    sensorOk,
    active,
    swingsThisHole,
    shotsThisHole,
    lastCarryYards,
    awaitingMove: awaiting,
  };
}
