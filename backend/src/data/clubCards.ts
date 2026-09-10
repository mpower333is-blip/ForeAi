// Course cards (par + stroke index per hole) per club, used to score
// competitions server-side. Kempton is the club's official Lindsay Saker VW
// card (par 72), the same numbers the app ships in courseGps/courses.

export type Card = { pars: number[]; sis: number[] };

export const CLUB_CARDS: Record<string, Card> = {
  kempton: {
    pars: [5, 4, 4, 4, 3, 4, 4, 5, 3, 4, 3, 5, 5, 4, 4, 4, 3, 4],
    sis: [4, 16, 8, 2, 10, 6, 14, 12, 18, 13, 17, 11, 5, 1, 3, 9, 15, 7],
  },
};

// A club's card, or a neutral par-72 / SI 1..18 fallback for an unknown club.
export function cardFor(clubKey: string): Card {
  return (
    CLUB_CARDS[clubKey] ?? {
      pars: Array(18).fill(4),
      sis: Array.from({ length: 18 }, (_, i) => i + 1),
    }
  );
}
