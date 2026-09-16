// Golf COMPETITION scoring — WHS-style, pure functions. This is a faithful port
// of the backend's lib/scoring.ts (backend/src/lib/scoring.ts), moved on-device
// so club competitions can compute their own net/gross/Stableford leaderboards
// when the app reads competitions straight from Firestore (the Render cutover).
//
// It is kept byte-for-byte equivalent to the server version on purpose: the same
// card + handicaps must produce the same result whether a leaderboard is built
// by Render (today) or by the app/web (after the flip). Verified against the
// server file with a differential test — do not "improve" it in isolation.
//
// NOTE: distinct from golfEngine.courseHandicap(index), which is a simplified
// single-argument variant used by the on-course caddie. Competitions use THIS.

export type Card = { pars: number[]; sis: number[] }; // 18 values each

// Course handicap from a handicap index. With the neutral defaults (slope 113,
// rating = par) this reduces to Math.round(index); pass a real slope/rating for
// an exact WHS course handicap: HI × slope/113 + (rating − par).
export function courseHandicap(index: number, slope = 113, courseRating?: number, par = 72): number {
  const cr = courseRating ?? par;
  return Math.round(index * (slope / 113) + (cr - par));
}

// Playing handicap = course handicap × allowance% (e.g. 95% for a WHS medal,
// 100% for a general-play Stableford).
export function playingHandicap(courseHcp: number, allowancePct = 100): number {
  return Math.round((courseHcp * allowancePct) / 100);
}

// Strokes a player receives on a hole of stroke index `si`, given their playing
// handicap. Handles handicaps above 18 (two+ strokes on the hardest holes) and
// plus handicaps (strokes GIVEN BACK on the easiest holes).
export function strokesOnHole(playingHcp: number, si: number, holes = 18): number {
  if (playingHcp < 0) {
    const give = -playingHcp; // plus player gives back on holes SI (holes-give+1..holes)
    return si > holes - give ? -1 : 0;
  }
  const base = Math.floor(playingHcp / holes);
  const extra = playingHcp % holes;
  return base + (si <= extra ? 1 : 0);
}

// Stableford points on a hole. net = gross − strokes received; points =
// 2 + (par − net), floored at 0. gross ≤ 0 means "no score / picked up" → 0.
export function stablefordHole(gross: number, par: number, strokes: number): number {
  if (!gross || gross <= 0) return 0;
  return Math.max(0, 2 + (par - (gross - strokes)));
}

export type RoundResult = {
  gross: number;         // sum of gross on completed holes
  net: number;           // gross − strokes received (completed holes)
  stableford: number;    // total Stableford points
  holesIn: number;       // completed holes
  netPerHole: number[];  // per-hole net (0 where not played) — for countback
  ptsPerHole: number[];  // per-hole Stableford points — for countback
};

// Score a full round from per-hole gross scores (18 values; 0 = not played).
export function scoreRound(holeScores: number[], card: Card, playingHcp: number): RoundResult {
  let gross = 0, net = 0, stableford = 0, holesIn = 0;
  const netPerHole: number[] = [];
  const ptsPerHole: number[] = [];
  for (let i = 0; i < 18; i++) {
    const g = Number(holeScores[i]) || 0;
    const s = strokesOnHole(playingHcp, card.sis[i] ?? i + 1);
    const pts = stablefordHole(g, card.pars[i] ?? 4, s);
    if (g > 0) { gross += g; net += g - s; holesIn++; stableford += pts; }
    netPerHole.push(g > 0 ? g - s : 0);
    ptsPerHole.push(pts);
  }
  return { gross, net, stableford, holesIn, netPerHole, ptsPerHole };
}

// Countback tiebreak values (last 9, 6, 3, 1 holes). For Stableford use the
// points arrays (higher is better); for medal use the net arrays (lower better).
export function countback(perHole: number[]): [number, number, number, number] {
  const sum = (from: number) => perHole.slice(from).reduce((a, b) => a + (b || 0), 0);
  return [sum(9), sum(12), sum(15), sum(17)];
}

// A club's card, or a neutral par-72 / SI 1..18 fallback — mirrors the backend's
// data/clubCards.ts cardFor(). Competitions store their own pars/sis, so this is
// only the last-resort default.
export function cardFor(clubKey: string): Card {
  const CLUB_CARDS: Record<string, Card> = {
    kempton: {
      pars: [5, 4, 4, 4, 3, 4, 4, 5, 3, 4, 3, 5, 5, 4, 4, 4, 3, 4],
      sis: [4, 16, 8, 2, 10, 6, 14, 12, 18, 13, 17, 11, 5, 1, 3, 9, 15, 7],
    },
  };
  return (
    CLUB_CARDS[clubKey] ?? {
      pars: Array(18).fill(4),
      sis: Array.from({ length: 18 }, (_, i) => i + 1),
    }
  );
}
