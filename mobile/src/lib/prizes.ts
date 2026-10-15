// Prize-giving engine.
//
// Pure functions that turn a finished event's scores into the full set of
// golf-day prizes a society hands out at the ceremony: overall winners (with
// countback), best gross, handicap divisions, front/back nines, the two's club,
// a team prize, and the side-game (nearest-pin / longest-drive) winners.
//
// It reuses tournament.ts's handicap-stroke and Stableford logic so the prizes
// agree exactly with the standings every player watched on their phone and on
// the board — no second, drifting scoring model. The browser port in
// clubhouse/prizes-engine.js mirrors this file function-for-function.

import { Course } from "../data/courses";
import {
  TEvent,
  TPlayer,
  TGroup,
  Contest,
  CONTEST_CATALOG,
  handicapStrokesOnHole,
} from "./tournament";

// ---- per-player card -----------------------------------------------------

export type PlayerCard = {
  player: TPlayer;
  holesPlayed: number;
  complete: boolean;
  gross: number; // total strokes on played holes
  net: number; // total net strokes on played holes
  stableford: number; // total Stableford points
  // per-hole arrays keyed by hole number (undefined where not played)
  grossByHole: Record<number, number>;
  netByHole: Record<number, number>;
  pointsByHole: Record<number, number>;
};

export function buildCard(event: TEvent, course: Course, player: TPlayer): PlayerCard {
  const scores = event.scores[player.id] || {};
  const grossByHole: Record<number, number> = {};
  const netByHole: Record<number, number> = {};
  const pointsByHole: Record<number, number> = {};
  let gross = 0;
  let net = 0;
  let stableford = 0;
  let holesPlayed = 0;
  for (const h of course.holes) {
    const g = scores[h.number];
    if (g == null) continue;
    holesPlayed += 1;
    const received = handicapStrokesOnHole(player.handicap, h.si);
    const holeNet = g - received;
    const pts = Math.max(0, 2 - (holeNet - h.par));
    grossByHole[h.number] = g;
    netByHole[h.number] = holeNet;
    pointsByHole[h.number] = pts;
    gross += g;
    net += holeNet;
    stableford += pts;
  }
  return {
    player,
    holesPlayed,
    complete: holesPlayed === course.holes.length && holesPlayed > 0,
    gross,
    net,
    stableford,
    grossByHole,
    netByHole,
    pointsByHole,
  };
}

// ---- countback -----------------------------------------------------------

// Card-position countback tiers, as hole numbers to sum "from". Standard golf:
// 18 holes → last 9 / 6 / 3 / 1 (holes 10, 13, 16, 18); 9 holes → last 6 / 3 / 1
// (holes 4, 7, 9). A generic fallback covers other hole counts.
export function countbackStarts(holeCount: number): number[] {
  if (holeCount >= 18) return [10, 13, 16, 18];
  if (holeCount === 9) return [4, 7, 9];
  const back = Math.floor(holeCount / 2) + 1;
  return Array.from(new Set([back, Math.max(back, holeCount - 2), holeCount])).sort(
    (a, b) => a - b
  );
}

// Sum a per-hole metric over the holes numbered >= `from`.
function segmentSum(byHole: Record<number, number>, from: number): number {
  let sum = 0;
  for (const k of Object.keys(byHole)) {
    const n = Number(k);
    if (n >= from) sum += byHole[n];
  }
  return sum;
}

export type Metric = "stableford" | "net";

function metricTotal(c: PlayerCard, metric: Metric): number {
  return metric === "stableford" ? c.stableford : c.net;
}
function metricByHole(c: PlayerCard, metric: Metric): Record<number, number> {
  return metric === "stableford" ? c.pointsByHole : c.netByHole;
}

// Compare two cards for ranking. Returns <0 if a ranks ahead of b.
// `higherBetter` is true for Stableford points, false for net strokes — it
// steers both the primary total and every countback tier.
function compareCards(
  a: PlayerCard,
  b: PlayerCard,
  metric: Metric,
  higherBetter: boolean,
  starts: number[]
): number {
  const at = metricTotal(a, metric);
  const bt = metricTotal(b, metric);
  if (at !== bt) return higherBetter ? bt - at : at - bt;
  const am = metricByHole(a, metric);
  const bm = metricByHole(b, metric);
  for (const s of starts) {
    const av = segmentSum(am, s);
    const bv = segmentSum(bm, s);
    if (av !== bv) return higherBetter ? bv - av : av - bv;
  }
  return 0; // true tie — shares the place
}

export type PrizeRow = {
  place: number;
  player: TPlayer;
  gross: number;
  net: number;
  stableford: number;
  thru: number;
  complete: boolean;
  countback: boolean; // true when this row's place was split from the one above by countback
  tie: boolean; // true when it's an unresolved dead-heat with the row above
};

// Rank cards and assign places, resolving ties by countback (and flagging
// true dead-heats). `metric` chooses the scoring basis; `higherBetter` its
// direction.
export function rankCards(
  cards: PlayerCard[],
  metric: Metric,
  higherBetter: boolean,
  holeCount: number
): PrizeRow[] {
  const starts = countbackStarts(holeCount);
  const sorted = [...cards].sort((a, b) => compareCards(a, b, metric, higherBetter, starts));
  const rows: PrizeRow[] = [];
  sorted.forEach((c, i) => {
    let place = i + 1;
    let countback = false;
    let tie = false;
    if (i > 0) {
      const prev = sorted[i - 1];
      const samePrimary = metricTotal(prev, metric) === metricTotal(c, metric);
      const cmp = compareCards(prev, c, metric, higherBetter, starts);
      if (cmp === 0) {
        place = rows[i - 1].place; // genuine dead-heat: share the place
        tie = samePrimary;
      } else if (samePrimary) {
        countback = true; // same points/net, separated on countback
      }
    }
    rows.push({
      place,
      player: c.player,
      gross: c.gross,
      net: c.net,
      stableford: c.stableford,
      thru: c.holesPlayed,
      complete: c.complete,
      countback,
      tie,
    });
  });
  return rows;
}

// ---- nines ---------------------------------------------------------------

export type NineResult = { player: TPlayer; value: number } | null;

function bestNine(
  cards: PlayerCard[],
  metric: Metric,
  higherBetter: boolean,
  holes: number[]
): NineResult {
  if (holes.length === 0) return null; // nine doesn't exist on this course
  let best: { player: TPlayer; value: number } | null = null;
  for (const c of cards) {
    const by = metricByHole(c, metric);
    // only count a nine the player actually completed
    const played = holes.filter((h) => by[h] != null);
    if (played.length < holes.length) continue;
    const value = played.reduce((s, h) => s + by[h], 0);
    if (!best || (higherBetter ? value > best.value : value < best.value)) {
      best = { player: c.player, value };
    }
  }
  return best;
}

// ---- divisions -----------------------------------------------------------

export type DivisionMode = "none" | "thirds" | "bands";
export type Band = { label: string; max: number };

export type Division = {
  label: string;
  range: string;
  winners: PrizeRow[];
};

function splitThirds(cards: PlayerCard[]): { label: string; range: string; cards: PlayerCard[] }[] {
  const byHcp = [...cards].sort((a, b) => a.player.handicap - b.player.handicap);
  const n = byHcp.length;
  if (n < 6) return [{ label: "Overall", range: "all", cards: byHcp }];
  const cut1 = Math.ceil(n / 3);
  const cut2 = Math.ceil((2 * n) / 3);
  const groups = [byHcp.slice(0, cut1), byHcp.slice(cut1, cut2), byHcp.slice(cut2)];
  const labels = ["Division A", "Division B", "Division C"];
  return groups
    .filter((g) => g.length > 0)
    .map((g, i) => {
      const lo = g[0].player.handicap;
      const hi = g[g.length - 1].player.handicap;
      return { label: labels[i], range: `${lo}–${hi} hcp`, cards: g };
    });
}

function splitBands(
  cards: PlayerCard[],
  bands: Band[]
): { label: string; range: string; cards: PlayerCard[] }[] {
  const ordered = [...bands].sort((a, b) => a.max - b.max);
  const out: { label: string; range: string; cards: PlayerCard[] }[] = [];
  let prevMax = -Infinity;
  for (const band of ordered) {
    const members = cards.filter((c) => c.player.handicap > prevMax && c.player.handicap <= band.max);
    const range =
      prevMax === -Infinity
        ? `up to ${band.max}`
        : band.max === Infinity
        ? `${prevMax + 1}+`
        : `${prevMax + 1}–${band.max}`;
    out.push({ label: band.label, range, cards: members });
    prevMax = band.max;
  }
  return out.filter((d) => d.cards.length > 0);
}

// ---- team prize ----------------------------------------------------------

export type TeamFormat = "auto" | "scramble" | "combined" | "best2";

export type TeamRow = {
  place: number;
  group: TGroup;
  index: number;
  names: string;
  value: number;
  complete: boolean;
};

export type TeamPrize = { format: TeamFormat; label: string; higherBetter: boolean; rows: TeamRow[] };

function teamNames(event: TEvent, group: TGroup): string {
  return group.playerIds
    .map((id) => event.players.find((p) => p.id === id)?.name)
    .filter(Boolean)
    .join(", ");
}

function computeTeams(
  event: TEvent,
  course: Course,
  cardsById: Record<string, PlayerCard>,
  metric: Metric,
  higherBetter: boolean,
  format: TeamFormat
): TeamPrize | null {
  const resolved: Exclude<TeamFormat, "auto"> =
    format === "auto" ? (event.format === "scramble" ? "scramble" : "combined") : format;
  if (!event.groups || event.groups.length === 0) return null;

  let label: string;
  let hb = higherBetter;
  const rawRows = event.groups.map((group, index) => {
    const members = group.playerIds.map((id) => cardsById[id]).filter(Boolean) as PlayerCard[];
    let value = 0;
    let complete = members.length > 0;
    if (resolved === "scramble") {
      // team score lives on the captain's (first player's) card
      const cap = members[0];
      value = cap ? cap.gross : 0;
      complete = !!cap && cap.complete;
      hb = false; // lowest gross wins
    } else if (resolved === "best2") {
      // sum, per hole, of the best two players' Stableford points
      hb = true;
      for (const h of course.holes) {
        const pts = members
          .map((m) => m.pointsByHole[h.number])
          .filter((v) => v != null)
          .sort((a, b) => b - a);
        value += (pts[0] || 0) + (pts[1] || 0);
      }
      complete = members.some((m) => m.complete);
    } else {
      // combined: sum of every team member's metric total
      value = members.reduce((s, m) => s + metricTotal(m, metric), 0);
      complete = members.length > 0 && members.every((m) => m.complete);
    }
    return { group, index, names: teamNames(event, group), value, complete };
  });

  label =
    resolved === "scramble"
      ? "Team — scramble gross"
      : resolved === "best2"
      ? "Team — best 2 Stableford"
      : metric === "stableford"
      ? "Team — combined Stableford"
      : "Team — combined net";

  const played = rawRows.filter((r) => r.names);
  played.sort((a, b) => (hb ? b.value - a.value : a.value - b.value));
  const rows: TeamRow[] = played.map((r, i) => ({ ...r, place: i + 1 }));
  return { format: resolved, label, higherBetter: hb, rows };
}

// ---- two's club ----------------------------------------------------------

export type TwoClubRow = { player: TPlayer; holes: number[] };

function twosClub(cards: PlayerCard[], course: Course): TwoClubRow[] {
  const par3 = new Set(course.holes.filter((h) => h.par === 3).map((h) => h.number));
  const rows: TwoClubRow[] = [];
  for (const c of cards) {
    const holes = Object.keys(c.grossByHole)
      .map(Number)
      .filter((n) => par3.has(n) && c.grossByHole[n] === 2)
      .sort((a, b) => a - b);
    if (holes.length) rows.push({ player: c.player, holes });
  }
  return rows;
}

// ---- side games ----------------------------------------------------------

export type SideGameResult = {
  contest: Contest;
  label: string;
  unit: string;
  hole: number;
  fundraiser: boolean;
  winner: { player: TPlayer; value: number } | null;
};

function sideGames(event: TEvent): SideGameResult[] {
  const contests = event.contests || [];
  return contests.map((c) => {
    const info = CONTEST_CATALOG[c.type] || { label: c.type, unit: "", dir: "max" as const };
    const fundraiser = (info.dir ?? null) === null;
    let winner: { player: TPlayer; value: number } | null = null;
    if (!fundraiser) {
      const results = event.contestResults?.[c.id];
      const entries = results ? Object.entries(results) : [];
      if (entries.length) {
        const dir = info.dir ?? "max";
        const best = entries.reduce((b, x) =>
          dir === "min" ? (x[1] < b[1] ? x : b) : x[1] > b[1] ? x : b
        );
        const player = event.players.find((p) => p.id === best[0]);
        if (player) winner = { player, value: best[1] };
      }
    }
    return { contest: c, label: info.label, unit: info.unit, hole: c.hole, fundraiser, winner };
  });
}

// ---- top-level -----------------------------------------------------------

export type PrizeOptions = {
  divisions?: DivisionMode;
  bands?: Band[];
  teamFormat?: TeamFormat;
  onlyComplete?: boolean; // restrict to players who finished every hole
};

export type PrizeResults = {
  eventName: string;
  date: string;
  courseName: string;
  format: TEvent["format"];
  holeCount: number;
  metric: Metric;
  metricLabel: string;
  higherBetter: boolean;
  playedCount: number; // players with at least one hole
  eligibleCount: number; // players counted for prizes
  allComplete: boolean; // every counted player finished
  overall: PrizeRow[];
  bestGross: { player: TPlayer; gross: number; complete: boolean } | null;
  divisions: Division[];
  nines: { front: NineResult; back: NineResult };
  team: TeamPrize | null;
  twos: TwoClubRow[];
  sideGames: SideGameResult[];
};

export function computePrizes(
  event: TEvent,
  course: Course,
  opts: PrizeOptions = {}
): PrizeResults {
  const metric: Metric = event.format === "stableford" ? "stableford" : "net";
  const higherBetter = metric === "stableford";
  const holeCount = course.holes.length;
  const starts = countbackStarts(holeCount);

  const allCards = event.players.map((p) => buildCard(event, course, p));
  const cardsById: Record<string, PlayerCard> = {};
  for (const c of allCards) cardsById[c.player.id] = c;

  const played = allCards.filter((c) => c.holesPlayed > 0);
  const eligible = opts.onlyComplete ? played.filter((c) => c.complete) : played;

  const overall = rankCards(eligible, metric, higherBetter, holeCount);

  // Best gross — lowest total, among complete rounds when any exist.
  const grossPool = eligible.filter((c) => c.complete).length
    ? eligible.filter((c) => c.complete)
    : eligible;
  let bestGross: PrizeResults["bestGross"] = null;
  if (grossPool.length) {
    const sorted = [...grossPool].sort((a, b) => {
      if (a.gross !== b.gross) return a.gross - b.gross;
      // gross countback: lowest back-nine etc.
      for (const s of starts) {
        const av = segmentSum(a.grossByHole, s);
        const bv = segmentSum(b.grossByHole, s);
        if (av !== bv) return av - bv;
      }
      return 0;
    });
    const w = sorted[0];
    bestGross = { player: w.player, gross: w.gross, complete: w.complete };
  }

  // Divisions (not for scramble — that's a team format).
  const mode: DivisionMode = event.format === "scramble" ? "none" : opts.divisions ?? "none";
  let divisions: Division[] = [];
  if (mode !== "none") {
    const groups =
      mode === "bands" && opts.bands && opts.bands.length
        ? splitBands(eligible, opts.bands)
        : splitThirds(eligible);
    divisions = groups.map((g) => ({
      label: g.label,
      range: g.range,
      winners: rankCards(g.cards, metric, higherBetter, holeCount).slice(0, 3),
    }));
  }

  const front = bestNine(eligible, metric, higherBetter, course.holes.filter((h) => h.number <= 9).map((h) => h.number));
  const back = bestNine(eligible, metric, higherBetter, course.holes.filter((h) => h.number >= 10).map((h) => h.number));

  const team = computeTeams(event, course, cardsById, metric, higherBetter, opts.teamFormat ?? "auto");
  const twos = twosClub(eligible, course);
  const games = sideGames(event);

  return {
    eventName: event.name,
    date: event.date,
    courseName: course.name,
    format: event.format,
    holeCount,
    metric,
    metricLabel: metric === "stableford" ? "Stableford points" : "Net strokes",
    higherBetter,
    playedCount: played.length,
    eligibleCount: eligible.length,
    allComplete: eligible.length > 0 && eligible.every((c) => c.complete),
    overall,
    bestGross,
    divisions,
    nines: { front, back },
    team,
    twos,
    sideGames: games,
  };
}
