// Local handicap maths for the "My Golf" dashboard — a WHS-style index ESTIMATED
// from the rounds you log in ForeAi. This is a personal trend, not your official
// index: the official Handicap Index + differentials come from HNA (DotGolf) when
// your club has sync switched on. We label the local one "estimated" everywhere.

// WHS Score Differential for an 18-hole round:
//   (113 / slope) × (adjusted gross − course rating)
// We use the gross as entered (no ESC adjustment yet), so treat it as an estimate.
export function scoreDifferential(gross: number, cr: number, slope: number): number | null {
  if (!gross || !cr || !slope) return null;
  return Math.round((113 / slope) * (gross - cr) * 10) / 10;
}

// WHS "how many of your lowest differentials count" table, by number of rounds in
// your last 20. Fewer than 20 rounds use fewer best scores and a small adjustment,
// exactly like the official system, so the estimate tracks reality as it fills in.
// [roundsAvailable, countOfLowest, adjustment]
const WHS_TABLE: Array<[number, number, number]> = [
  [3, 1, -2.0],
  [4, 1, -1.0],
  [5, 1, 0],
  [6, 2, -1.0],
  [8, 2, 0],
  [11, 3, 0],
  [14, 4, 0],
  [16, 5, 0],
  [18, 6, 0],
  [19, 7, 0],
  [20, 8, 0],
];

// Estimated Handicap Index from a list of score differentials (any order). Uses
// the most recent 20, the WHS best-of table, and rounds to one decimal. Returns
// null until there are at least 3 rounds (WHS minimum).
export function estimatedIndex(differentials: number[]): number | null {
  const last20 = differentials.slice(-20);
  const n = last20.length;
  if (n < 3) return null;
  let count = 8, adj = 0;
  for (const [upTo, c, a] of WHS_TABLE) {
    if (n <= upTo) { count = c; adj = a; break; }
  }
  const lowest = [...last20].sort((a, b) => a - b).slice(0, count);
  const avg = lowest.reduce((s, d) => s + d, 0) / lowest.length;
  return Math.round((avg + adj) * 10) / 10;
}
