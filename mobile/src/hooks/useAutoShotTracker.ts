import { useEffect, useRef, useState } from "react";
import { Accelerometer } from "expo-sensors";
import { Coord, distanceYards } from "../lib/geo";
import { Club } from "../lib/golfEngine";
import { Surface, Lie } from "../lib/golfEngine";
import { useShotAudio } from "./useShotAudio";

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
  micOk: boolean | null; // microphone permission / availability
  listening: boolean; // mic is actively listening for the strike
  active: boolean; // motion listener running
  swingsThisHole: number; // swing motions detected on the current hole
  shotsThisHole: number; // confirmed (logged) shots this hole
  lastCarryYards: number | null; // carry of the most recent logged shot
  awaitingMove: boolean; // a strike is marked, waiting for you to reach the ball
};

const SWING_G = 0.75; // motion spike that counts as a swing (gravity removed)
const REFRACTORY_MS = 2000; // ignore further confirmed hits for this long
const CORROBORATE_MS = 1500; // a crack counts if you swung within this window
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

  // The last accepted strike location + the surface we were on there. `null`
  // until the first strike of the hole is marked.
  const lastLocRef = useRef<Coord | null>(null);
  const shotIndexRef = useRef(0); // shots logged on this hole (0 = still on the tee)
  const awaitingRef = useRef(false);
  const lastHitRef = useRef(0); // time of the last confirmed hit (refractory)
  const lastSwingRef = useRef(0); // time of the last swing MOTION (corroborates a crack)

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

  // A confirmed ball strike (a crack that you actually swung at). Runs the GPS
  // segment logic: mark this spot; the shot from the PREVIOUS spot is now
  // complete, so log it.
  const confirmHitRef = useRef<() => void>(() => {});
  confirmHitRef.current = () => {
    const here = coordRef.current;
    if (!here) return; // no GPS fix — can't place the shot
    const now = Date.now();
    if (now - lastHitRef.current < REFRACTORY_MS) return;
    lastHitRef.current = now;

    const prev = lastLocRef.current;
    if (!prev) {
      // First strike of the hole (the tee shot leaves from here).
      lastLocRef.current = here;
      awaitingRef.current = true;
      setAwaiting(true);
      return;
    }

    const carry = distanceYards(prev, here);
    if (carry < MIN_MOVE_YARDS) {
      // You haven't moved yet — a re-detected strike. Ignore.
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

  // Microphone: fires on the crack of club-on-ball. A crack only counts as a
  // shot if you actually swung just before it (corroboration) — or if it's a
  // very loud, unmistakable strike. Practice swings make motion but no crack;
  // a partner's nearby strike makes a crack but no swing of yours.
  const { micOk, listening } = useShotAudio(enabled, (c) => {
    const now = Date.now();
    const swungRecently = now - lastSwingRef.current < CORROBORATE_MS;
    if (swungRecently || c.strong) confirmHitRef.current();
  });

  useEffect(() => {
    if (!enabled) {
      setActive(false);
      return;
    }
    // Motion listener only records that a swing happened — it never logs a shot
    // on its own, so practice swings are harmless until a crack corroborates.
    let lastCount = 0;
    const onSample = ({ x, y, z }: { x: number; y: number; z: number }) => {
      const mag = Math.abs(Math.sqrt(x * x + y * y + z * z) - 1);
      if (mag > SWING_G) {
        const now = Date.now();
        lastSwingRef.current = now;
        // One swing spans several samples over the threshold — count it once.
        if (now - lastCount > 1000) {
          lastCount = now;
          setSwingsThisHole((n) => n + 1);
        }
      }
    };

    Accelerometer.setUpdateInterval(SAMPLE_MS);
    const sub = Accelerometer.addListener(onSample);
    setActive(true);

    return () => {
      sub.remove();
      setActive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, hole]);

  return {
    sensorOk,
    micOk,
    listening,
    active,
    swingsThisHole,
    shotsThisHole,
    lastCarryYards,
    awaitingMove: awaiting,
  };
}
