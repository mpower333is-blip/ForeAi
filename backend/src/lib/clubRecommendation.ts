import clubDistances from "../data/clubDistances";

type ShotInput = {
  yardage: number;
  wind?: number; // mph, positive = headwind
  elevation?: number; // yards, positive = uphill
  lie?: string;
};

// Convert the measured yardage into the distance the shot must actually carry.
export function playingDistance(input: ShotInput): number {
  let d = input.yardage;

  if (input.wind) {
    const factor = input.wind > 0 ? 0.01 : 0.005;
    d += input.yardage * factor * input.wind;
  }
  if (input.elevation) d += input.elevation;
  if (input.lie === "rough") d += 8;
  if (input.lie === "sand") d += 12;

  return Math.round(d);
}

// Pick the club whose carry is closest to the playing distance.
export function recommendClub(input: ShotInput): string {
  const target = playingDistance(input);

  let best = "5 Iron";
  let bestGap = Infinity;
  for (const [club, distance] of Object.entries(clubDistances)) {
    const gap = Math.abs(distance - target);
    if (gap < bestGap) {
      bestGap = gap;
      best = club;
    }
  }

  return best;
}
