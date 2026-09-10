import prisma from "../config/db";

// Seed club settings on boot so a club app starts on its real course + tee
// hours instead of the generic defaults. Idempotent and non-destructive:
//   • create — full seed values, the first time only
//   • update — only name + courseId, so the tee-sheet shape the club tunes on
//              the admin page survives every redeploy
//
// Starting tee hours are sensible defaults, NOT confirmed with the club — the
// club adjusts them once on the Tee Sheet admin page (first/last tee, interval).

type ClubSeed = {
  clubKey: string;
  name: string;
  courseId: string;
  firstTeeMin: number;
  lastTeeMin: number;
  intervalMin: number;
  slotCapacity: number;
  bookingWindowDays: number;
  openDays: string;
};

const SEEDS: ClubSeed[] = [
  {
    clubKey: "kempton",
    name: "Kempton Park Golf Club",
    courseId: "kempton-park", // matches the surveyed course in the app
    firstTeeMin: 390, // 06:30
    lastTeeMin: 960, // 16:00
    intervalMin: 8, // typical SA club tee interval
    slotCapacity: 4, // a four-ball
    bookingWindowDays: 14, // members may book two weeks ahead
    openDays: "0,1,2,3,4,5,6", // open seven days
  },
];

export async function seedClubs(): Promise<void> {
  for (const s of SEEDS) {
    try {
      await prisma.clubSettings.upsert({
        where: { clubKey: s.clubKey },
        create: s,
        update: { name: s.name, courseId: s.courseId },
      });
      console.log(`Seeded club settings for "${s.clubKey}"`);
    } catch (e) {
      console.error(`Club seed failed for "${s.clubKey}":`, e);
    }
  }
}
