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
  // Live presence + position, updated by a heartbeat from the player's phone.
  lastSeen?: number | null; // epoch ms of the last heartbeat (recent = on the app now)
  lat?: number | null;
  lng?: number | null;
};

// A player is "live" (app open) if their last heartbeat was within this window.
export const PRESENCE_WINDOW_MS = 3 * 60 * 1000;

export function isPlayerLive(p: TPlayer, now: number): boolean {
  return !!p.lastSeen && now - p.lastSeen < PRESENCE_WINDOW_MS;
}

// How many players in a group are live right now.
export function groupLiveCount(event: TEvent, group: TGroup, now: number): number {
  return group.playerIds.filter((id) => {
    const p = event.players.find((x) => x.id === id);
    return p ? isPlayerLive(p, now) : false;
  }).length;
}

export type TGroup = {
  id: string;
  playerIds: string[];
};

export type EventFormat = "stroke" | "stableford" | "scramble";

// A mini-game type is any key in CONTEST_CATALOG below.
export type ContestType = string;
export type Contest = { id: string; type: ContestType; hole: number };

// The side games an organiser can run. `dir` is how a winner is picked for a
// measured game (min = nearest, max = longest); `dir: null` marks a fundraiser
// game with no auto-scored leaderboard (a winner is decided off-app). Kept in
// sync with the web office picker, the board, and the backend whitelist.
export const CONTEST_CATALOG: Record<
  string,
  { label: string; unit: string; dir: "min" | "max" | null; charity?: boolean }
> = {
  closest:     { label: "Closest to the Pin",        unit: "m", dir: "min" },
  closest2:    { label: "Closest to the Pin in 2",   unit: "m", dir: "min" },
  longest:     { label: "Longest Drive",             unit: "m", dir: "max" },
  straightest: { label: "Straightest Drive",         unit: "m", dir: "min" },
  longestputt: { label: "Longest Putt",              unit: "m", dir: "max" },
  beatthepro:  { label: "Beat the Pro",              unit: "", dir: null, charity: true },
  putting:     { label: "Putting Competition",       unit: "", dir: null, charity: true },
  holeinone:   { label: "Hole-in-One Challenge",     unit: "", dir: null, charity: true },
  mulligan:    { label: "Mulligans",                 unit: "", dir: null, charity: true },
  splitpot:    { label: "50/50 Split the Pot",       unit: "", dir: null, charity: true },
  headstails:  { label: "Heads or Tails",            unit: "", dir: null, charity: true },
  luckyball:   { label: "Lucky Ball (Yellow Ball)",  unit: "", dir: null, charity: true },
  string:      { label: "String Game",               unit: "", dir: null, charity: true },
  raffle:      { label: "Raffle / Auction",          unit: "", dir: null, charity: true },
};

export type SponsorTier = "title" | "hole" | "prize" | "general";
export type Sponsor = {
  id: string;
  name: string;
  tier: SponsorTier;
  hole?: number | null;
  message?: string | null;
  logo?: string | null; // data URL uploaded on registration
};

export type TEvent = {
  id: string;
  name: string;
  date: string;
  courseId: string;
  format: EventFormat;
  firstTeeMin: number; // minutes from midnight for the first tee time (or shotgun time)
  intervalMin: number; // gap between groups (ignored for a shotgun start)
  shotgun?: boolean; // all groups tee off at once on different holes
  players: TPlayer[];
  groups: TGroup[];
  // scores[playerId][holeNumber] = strokes
  scores: Record<string, Record<number, number>>;
  // Side games (closest to pin / longest drive) run during the day.
  contests?: Contest[];
  contestResults?: Record<string, Record<string, number>>; // [contestId][playerId] = yards
  // Organiser's custom reminders → each player's phone as local notifications.
  // offsetMin = minutes before the first tee (e.g. 3 days = 4320).
  reminders?: { offsetMin: number; title: string; body: string }[];
  // Fundraiser branding.
  cause?: string | null; // e.g. "Supporting Lyla Roux vs ALK+ ALCL"
  causePhoto?: string | null; // photo of the beneficiary (data URL, from the backend)
  sponsors?: Sponsor[];
  logoKey?: string; // key into the bundled event-logo registry (e.g. "ecs")
  // Per-event branding + money, set by the organiser (see the web office setup).
  logo?: string | null; // the event's own logo (data URL)
  banking?: string | null; // banking details block for the registration forms
  teamFee?: number | null; // entry fee per four-ball team
  holeFee?: number | null; // fee per hole sponsor
  // Multi-device fields — present only for events hosted on the backend.
  code?: string; // join code shared with other devices
  hasAdminPin?: boolean; // whether an organiser admin PIN is set (the PIN itself is never sent)
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

// ---- scramble (team) + shotgun -------------------------------------------

// A scramble team's single score lives under its captain (first player added).
export function teamCaptain(group: TGroup): string | null {
  return group.playerIds[0] ?? null;
}

// Shotgun: group index i starts on hole i+1 (wraps for more than 18 groups).
export function shotgunStartHole(groupIndex: number): number {
  return (groupIndex % 18) + 1;
}

// Holes a group has completed. Scramble reads the captain's card; stroke play
// uses the slowest player in the group.
export function groupHolesDone(event: TEvent, group: TGroup): number {
  if (event.format === "scramble") {
    const cap = teamCaptain(group);
    return cap ? playerThru(event, cap) : 0;
  }
  return groupThru(event, group);
}

// The hole a group is currently playing — shotgun- and format-aware.
export function currentHole(event: TEvent, group: TGroup, groupIndex: number): number | null {
  const done = groupHolesDone(event, group);
  if (done >= 18) return null;
  if (event.shotgun) {
    const start = shotgunStartHole(groupIndex);
    return ((start - 1 + done) % 18) + 1;
  }
  return done + 1;
}

export function teamGross(event: TEvent, group: TGroup): number {
  const cap = teamCaptain(group);
  return cap ? playerGross(event, cap) : 0;
}

export type TeamStanding = {
  group: TGroup;
  index: number;
  names: string;
  thru: number;
  gross: number;
  hole: number | null;
};

// Team leaderboard for a scramble: lowest team total wins.
export function teamStandings(event: TEvent): TeamStanding[] {
  const rows: TeamStanding[] = event.groups.map((group, index) => ({
    group,
    index,
    names: group.playerIds
      .map((id) => event.players.find((p) => p.id === id)?.name)
      .filter(Boolean)
      .join(", "),
    thru: groupHolesDone(event, group),
    gross: teamGross(event, group),
    hole: currentHole(event, group, index),
  }));
  const started = rows.filter((r) => r.thru > 0).sort((a, b) => a.gross - b.gross);
  const rest = rows.filter((r) => r.thru === 0);
  return [...started, ...rest];
}

// ---- side games ----------------------------------------------------------

export function contestName(c: Contest): string {
  return CONTEST_CATALOG[c.type]?.label ?? c.type;
}

export function contestUnit(c: Contest): string {
  return CONTEST_CATALOG[c.type]?.unit ?? "";
}

// True for fundraiser games whose winner is decided off-app (no per-player score).
export function contestIsScored(c: Contest): boolean {
  return (CONTEST_CATALOG[c.type]?.dir ?? null) !== null;
}

export function holeSponsor(event: TEvent, hole: number): Sponsor | undefined {
  return event.sponsors?.find((s) => s.tier === "hole" && s.hole === hole);
}

export function sponsorTierLabel(tier: SponsorTier): string {
  return tier === "title" ? "Title sponsor" : tier === "hole" ? "Hole sponsor" : tier === "prize" ? "Prize sponsor" : "Sponsor";
}

// Winner of a contest: nearest the pin (min) or longest drive (max).
export function contestLeader(
  event: TEvent,
  contest: Contest
): { player: TPlayer; value: number } | null {
  const results = event.contestResults?.[contest.id];
  if (!results) return null;
  const entries = Object.entries(results);
  if (entries.length === 0) return null;
  const dir = CONTEST_CATALOG[contest.type]?.dir ?? "max";
  const winner = entries.reduce((best, e) =>
    dir === "min" ? (e[1] < best[1] ? e : best) : e[1] > best[1] ? e : best
  );
  const player = event.players.find((p) => p.id === winner[0]);
  return player ? { player, value: winner[1] } : null;
}
