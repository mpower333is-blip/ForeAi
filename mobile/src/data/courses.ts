// Course catalog. In a production build this comes from a hosted course
// database (keyed by GPS); here we ship a handful of full 18-hole layouts so
// course selection, scorecards and tournaments work out of the box.

export type Hole = {
  number: number;
  par: number;
  yards: number;
  si: number; // stroke index 1-18 (handicap allocation)
};

export type Course = {
  id: string;
  name: string;
  location: string;
  par: number;
  holes: Hole[];
};

// Build 18 holes from compact par / yard / stroke-index arrays.
function build(pars: number[], yards: number[], si: number[]): Hole[] {
  return pars.map((par, i) => ({
    number: i + 1,
    par,
    yards: yards[i],
    si: si[i],
  }));
}

const RAW: Omit<Course, "par">[] = [
  {
    id: "riverbend",
    name: "Riverbend Links",
    location: "Coastal 18 • Par 72",
    holes: build(
      [4, 5, 3, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4, 4],
      [410, 538, 175, 388, 445, 205, 560, 402, 370, 425, 160, 512, 398, 460, 188, 548, 355, 432],
      [5, 1, 17, 11, 3, 15, 7, 9, 13, 6, 18, 2, 12, 4, 16, 8, 14, 10]
    ),
  },
  {
    id: "pinehurst-heath",
    name: "Pinehurst Heath",
    location: "Parkland 18 • Par 71",
    holes: build(
      [4, 4, 5, 3, 4, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 4, 3, 4],
      [398, 415, 505, 168, 440, 372, 195, 460, 548, 405, 388, 205, 520, 430, 355, 448, 178, 410],
      [7, 3, 11, 17, 1, 13, 15, 5, 9, 8, 12, 16, 10, 2, 14, 4, 18, 6]
    ),
  },
  {
    id: "sunset-canyon",
    name: "Sunset Canyon",
    location: "Desert 18 • Par 70",
    holes: build(
      [4, 3, 4, 4, 5, 3, 4, 4, 4, 4, 3, 4, 5, 3, 4, 4, 4, 4],
      [360, 190, 425, 402, 560, 205, 388, 440, 375, 415, 165, 430, 535, 180, 395, 455, 340, 420],
      [9, 15, 3, 5, 7, 13, 11, 1, 17, 6, 18, 4, 8, 16, 12, 2, 14, 10]
    ),
  },
  {
    id: "the-old-nine",
    name: "The Old Nine (x2)",
    location: "Classic 18 • Par 72",
    holes: build(
      [4, 4, 4, 3, 5, 4, 3, 4, 5, 4, 4, 4, 3, 5, 4, 3, 4, 5],
      [385, 420, 405, 155, 512, 395, 185, 430, 545, 385, 420, 405, 155, 512, 395, 185, 430, 545],
      [11, 5, 3, 17, 7, 9, 15, 1, 13, 12, 6, 4, 18, 8, 10, 16, 2, 14]
    ),
  },
];

export const COURSES: Course[] = RAW.map((c) => ({
  ...c,
  par: c.holes.reduce((sum, h) => sum + h.par, 0),
}));

export function getCourse(id: string): Course {
  return COURSES.find((c) => c.id === id) ?? COURSES[0];
}

export function frontNinePar(course: Course): number {
  return course.holes.slice(0, 9).reduce((s, h) => s + h.par, 0);
}
export function backNinePar(course: Course): number {
  return course.holes.slice(9).reduce((s, h) => s + h.par, 0);
}
