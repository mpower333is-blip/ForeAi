// Tournament / golf-day engine.
//
// Pure functions over an event's data: who's registered, which group is on
// which hole (derived from scores entered), and the live leaderboard. Keeping
// this pure makes the standings logic easy to test and lets the UI stay dumb.

import { Course } from "../data/courses";

export type TPlayer = {
  id: string;
  name: string;
  handicap: number;
  deviceId?: string | null; // set when a player self-registers from their phone
  groupId?: string | null;
};

export type TGroup = {
  id: string;
  playerIds: string[];
};

export type EventFormat = "stroke" | "stableford";

export type TEvent = {
  id: string;
  name: string;
  date: string;
  courseId: string;
  format: EventFormat;
  firstTeeMin: number; // minutes from midnight for the first tee time
  intervalMin: number; // gap between groups
  players: TPlayer[];
  groups: TGroup[];
  // scores[playerId][holeNumber] = strokes
  scores: Record<string, Record<number, number>>;
  // Multi-device fields — present only for events hosted on the backend.
  code?: string; // join code shared with other devices
  remote?: boolean; // true when this event is synced with the server
};

// ---- tee times -----------------------------------------------------------

export function groupTeeTime(event: TEvent, groupIndex: number): string {
  const total = event.firstTeeMin + groupIndex * event.intervalMin;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ---- progress ("which hole are they on") ---------------------------------

// Holes a player has completed (has a score for).
export function playerThru(event: TEvent, playerId: string): number {
  const card = event.scores[playerId];
  if (!card) return 0;
  return Object.keys(card).length;
}

// The hole a group is currently playing = one past the fewest-progressed
// player still on the course (whole group moves together). Capped at 18.
export function groupThru(event: TEvent, group: TGroup): number {
  if (group.playerIds.length === 0) return 0;
  const thrus = group.playerIds.map((id) => playerThru(event, id));
  return Math.min(...thrus);
}

export function groupCurrentHole(event: TEvent, group: TGroup): number | null {
  const thru = groupThru(event, group);
  if (thru >= 18) return null; // finished
  return thru + 1;
}

// ---- scoring -------------------------------------------------------------

export function playerGross(event: TEvent, playerId: string): number {
  const card = event.scores[playerId];
  if (!card) return 0;
  return Object.values(card).reduce((a, b) => a + b, 0);
}

// Gross relative to the par of the holes actually played.
export function playerToPar(event: TEvent, course: Course, playerId: string): number {
  const card = event.scores[playerId];
  if (!card) return 0;
  let parPlayed = 0;
  for (const h of course.holes) {
    if (card[h.number] != null) parPlayed += h.par;
  }
  return playerGross(event, playerId) - parPlayed;
}

// Stableford points: 2 for par, +1 per shot better, -1 per shot worse,
// floored at 0, adjusted by the player's handicap stroke on each hole.
export function playerStableford(event: TEvent, course: Course, player: TPlayer): number {
  const card = event.scores[player.id];
  if (!card) return 0;
  let points = 0;
  for (const h of course.holes) {
    const gross = card[h.number];
    if (gross == null) continue;
    const strokesReceived = handicapStrokesOnHole(player.handicap, h.si);
    const net = gross - strokesReceived;
    const p = 2 - (net - h.par);
    points += Math.max(0, p);
  }
  return points;
}

// How many handicap strokes a player gets on a hole given its stroke index.
export function handicapStrokesOnHole(handicap: number, si: number): number {
  const hc = Math.round(handicap);
  let strokes = 0;
  if (hc >= si) strokes += 1;
  if (hc >= si + 18) strokes += 1; // very high handicaps get a second stroke
  return strokes;
}

export type Standing = {
  player: TPlayer;
  thru: number;
  gross: number;
  toPar: number;
  net: number;
  stableford: number;
};

export function leaderboard(event: TEvent, course: Course): Standing[] {
  const rows: Standing[] = event.players.map((player) => {
    const thru = playerThru(event, player.id);
    const gross = playerGross(event, player.id);
    return {
      player,
      thru,
      gross,
      toPar: playerToPar(event, course, player.id),
      net: gross - Math.round(player.handicap),
      stableford: playerStableford(event, course, player),
    };
  });

  const started = rows.filter((r) => r.thru > 0);
  const notStarted = rows.filter((r) => r.thru === 0);

  if (event.format === "stableford") {
    started.sort((a, b) => b.stableford - a.stableford);
  } else {
    started.sort((a, b) => a.toPar - b.toPar);
  }
  return [...started, ...notStarted];
}

export function formatToPar(toPar: number): string {
  if (toPar === 0) return "E";
  return toPar > 0 ? `+${toPar}` : `${toPar}`;
}
