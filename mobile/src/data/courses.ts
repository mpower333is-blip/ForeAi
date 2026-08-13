// South African golf course catalog.
//
// Course identity (name, town, province, par) is real. Where we don't have an
// official scorecard, the per-hole layout (yardages, stroke index) is generated
// to be realistic and internally consistent, and the course is flagged
// `approxLayout` so the UI can say so. Par + stroke index are what scoring and
// handicap allocation need, and the caddie always lets you set the exact
// distance — so approximate layouts are still fully usable on the course.
//
// To make a course exact, replace its generated holes with the official card
// (or wire a licensed course-data API and hydrate from it).

import { Coord } from "../lib/geo";

export type Hole = {
  number: number;
  par: number;
  yards: number;
  si: number; // stroke index 1-18 (handicap allocation)
  green?: Coord; // green centre GPS, when the data source provides it
  tee?: Coord; // tee GPS, when available
};

export type Course = {
  id: string;
  name: string;
  location: string; // "Town, Province"
  province: string;
  par: number;
  holes: Hole[];
  approxLayout?: boolean;
};

type Raw = {
  id: string;
  name: string;
  town: string;
  province: string;
  par?: number; // defaults to 72
  yards?: number; // total; layout is scaled to it when given
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Disjoint slots so par-3s and par-5s never collide or cluster.
const PAR3_SLOTS = [3, 6, 8, 12, 15, 17];
const PAR5_SLOTS = [2, 5, 10, 13, 16, 18];

// Build a full 18-hole layout from a total par (and optional total yardage).
function buildLayout(parTotal: number, totalYards?: number): Hole[] {
  // Choose how many par-3s (a) and par-5s (b). Standard par 72 = 4 and 4;
  // every stroke of total par above/below shifts par-5s up / par-3s up.
  let a = 4;
  let b = 4;
  const delta = parTotal - 72;
  if (delta > 0) b += delta;
  else a += -delta;
  a = clamp(a, 2, 6);
  b = clamp(b, 2, 6);
  if (a + b > 16) b = 16 - a; // leave at least two par-4s

  const par3 = new Set(PAR3_SLOTS.slice(0, a));
  const par5 = new Set(PAR5_SLOTS.slice(0, b));

  const pars: number[] = [];
  for (let h = 1; h <= 18; h++) {
    pars.push(par3.has(h) ? 3 : par5.has(h) ? 5 : 4);
  }

  // Base yardage per par, with a deterministic per-hole wobble.
  const base: Record<number, number> = { 3: 170, 4: 400, 5: 525 };
  const raw = pars.map((p, i) => {
    const wobble = (((i * 37) % 11) - 5) * 6; // -30..+30, deterministic
    return base[p] + wobble;
  });

  // Scale to the known total yardage if we have one.
  let yards = raw;
  if (totalYards && totalYards > 0) {
    const sum = raw.reduce((s, y) => s + y, 0);
    const k = totalYards / sum;
    yards = raw.map((y) => Math.round((y * k) / 5) * 5);
  } else {
    yards = raw.map((y) => Math.round(y / 5) * 5);
  }

  // Stroke index: hardest holes (par-5s, then long par-4s) get the lowest SI.
  const order = pars
    .map((p, i) => ({ i, difficulty: p * 1000 + yards[i] }))
    .sort((x, y) => y.difficulty - x.difficulty);
  const si: number[] = new Array(18);
  order.forEach((o, rank) => {
    si[o.i] = rank + 1;
  });

  return pars.map((par, i) => ({
    number: i + 1,
    par,
    yards: yards[i],
    si: si[i],
  }));
}

// prettier-ignore
const RAW_COURSES: Raw[] = [
  // ---- Western Cape ----
  { id: "fancourt-links", name: "Fancourt — The Links", town: "George", province: "Western Cape", par: 73, yards: 7200 },
  { id: "fancourt-montagu", name: "Fancourt — Montagu", town: "George", province: "Western Cape", par: 72 },
  { id: "fancourt-outeniqua", name: "Fancourt — Outeniqua", town: "George", province: "Western Cape", par: 72 },
  { id: "pearl-valley", name: "Pearl Valley (Els)", town: "Paarl", province: "Western Cape", par: 72, yards: 7000 },
  { id: "erinvale", name: "Erinvale", town: "Somerset West", province: "Western Cape", par: 72 },
  { id: "steenberg", name: "Steenberg", town: "Cape Town", province: "Western Cape", par: 72 },
  { id: "royal-cape", name: "Royal Cape", town: "Cape Town", province: "Western Cape", par: 72 },
  { id: "milnerton", name: "Milnerton", town: "Cape Town", province: "Western Cape", par: 72 },
  { id: "king-david-mowbray", name: "King David Mowbray", town: "Cape Town", province: "Western Cape", par: 72 },
  { id: "clovelly", name: "Clovelly", town: "Cape Town", province: "Western Cape", par: 71 },
  { id: "westlake", name: "Westlake", town: "Cape Town", province: "Western Cape", par: 72 },
  { id: "atlantic-beach", name: "Atlantic Beach", town: "Melkbosstrand", province: "Western Cape", par: 72 },
  { id: "arabella", name: "Arabella", town: "Kleinmond", province: "Western Cape", par: 72, yards: 6900 },
  { id: "pinnacle-point", name: "Pinnacle Point", town: "Mossel Bay", province: "Western Cape", par: 71 },
  { id: "oubaai", name: "Oubaai", town: "George", province: "Western Cape", par: 72 },
  { id: "simola", name: "Simola", town: "Knysna", province: "Western Cape", par: 72 },
  { id: "pezula", name: "Pezula", town: "Knysna", province: "Western Cape", par: 72 },
  { id: "goose-valley", name: "Goose Valley", town: "Plettenberg Bay", province: "Western Cape", par: 72 },
  { id: "plettenberg-bay", name: "Plettenberg Bay", town: "Plettenberg Bay", province: "Western Cape", par: 72 },
  { id: "hermanus", name: "Hermanus", town: "Hermanus", province: "Western Cape", par: 73 },
  { id: "de-zalze", name: "De Zalze", town: "Stellenbosch", province: "Western Cape", par: 72 },
  { id: "devonvale", name: "Devonvale", town: "Stellenbosch", province: "Western Cape", par: 72 },
  { id: "stellenbosch", name: "Stellenbosch", town: "Stellenbosch", province: "Western Cape", par: 72 },
  { id: "paarl", name: "Paarl", town: "Paarl", province: "Western Cape", par: 72 },
  { id: "worcester", name: "Worcester", town: "Worcester", province: "Western Cape", par: 72 },
  { id: "kingswood", name: "Kingswood", town: "George", province: "Western Cape", par: 72 },
  { id: "george", name: "George", town: "George", province: "Western Cape", par: 72 },
  { id: "langebaan", name: "Langebaan Country Estate", town: "Langebaan", province: "Western Cape", par: 72 },
  { id: "bellville", name: "Bellville", town: "Cape Town", province: "Western Cape", par: 72 },
  { id: "mowbray", name: "Mowbray", town: "Cape Town", province: "Western Cape", par: 72 },

  // ---- Eastern Cape ----
  { id: "humewood", name: "Humewood", town: "Gqeberha", province: "Eastern Cape", par: 72, yards: 6900 },
  { id: "st-francis-links", name: "St Francis Links", town: "St Francis Bay", province: "Eastern Cape", par: 72, yards: 7100 },
  { id: "wedgewood", name: "Wedgewood", town: "Gqeberha", province: "Eastern Cape", par: 72 },
  { id: "pe-golf-club", name: "Port Elizabeth", town: "Gqeberha", province: "Eastern Cape", par: 72 },
  { id: "fish-river-sun", name: "Fish River Sun", town: "Port Alfred", province: "Eastern Cape", par: 72 },
  { id: "east-london", name: "East London", town: "East London", province: "Eastern Cape", par: 72 },
  { id: "olivewood", name: "Olivewood", town: "East London", province: "Eastern Cape", par: 72 },
  { id: "bushman-sands", name: "Bushman Sands", town: "Alicedale", province: "Eastern Cape", par: 72 },

  // ---- KwaZulu-Natal ----
  { id: "durban-cc", name: "Durban Country Club", town: "Durban", province: "KwaZulu-Natal", par: 72, yards: 6700 },
  { id: "mount-edgecombe-1", name: "Mount Edgecombe No.1", town: "Umhlanga", province: "KwaZulu-Natal", par: 72 },
  { id: "mount-edgecombe-2", name: "Mount Edgecombe No.2", town: "Umhlanga", province: "KwaZulu-Natal", par: 72 },
  { id: "zimbali", name: "Zimbali", town: "Ballito", province: "KwaZulu-Natal", par: 72 },
  { id: "princes-grant", name: "Prince's Grant", town: "KwaDukuza", province: "KwaZulu-Natal", par: 72 },
  { id: "cotswold-downs", name: "Cotswold Downs", town: "Hillcrest", province: "KwaZulu-Natal", par: 72 },
  { id: "san-lameer", name: "San Lameer", town: "Southbroom", province: "KwaZulu-Natal", par: 72 },
  { id: "selborne", name: "Selborne", town: "Pennington", province: "KwaZulu-Natal", par: 72 },
  { id: "southbroom", name: "Southbroom", town: "Southbroom", province: "KwaZulu-Natal", par: 72 },
  { id: "umdoni-park", name: "Umdoni Park", town: "Pennington", province: "KwaZulu-Natal", par: 72 },
  { id: "royal-durban", name: "Royal Durban", town: "Durban", province: "KwaZulu-Natal", par: 72 },
  { id: "beachwood", name: "Beachwood", town: "Durban", province: "KwaZulu-Natal", par: 72 },
  { id: "kloof", name: "Kloof", town: "Kloof", province: "KwaZulu-Natal", par: 72 },
  { id: "gowrie-farm", name: "Gowrie Farm", town: "Nottingham Road", province: "KwaZulu-Natal", par: 72 },
  { id: "champagne-sports", name: "Champagne Sports", town: "Central Drakensberg", province: "KwaZulu-Natal", par: 72 },

  // ---- Gauteng ----
  { id: "royal-jhb-east", name: "Royal Johannesburg & Kensington — East", town: "Johannesburg", province: "Gauteng", par: 72, yards: 7400 },
  { id: "royal-jhb-west", name: "Royal Johannesburg & Kensington — West", town: "Johannesburg", province: "Gauteng", par: 72 },
  { id: "houghton", name: "Houghton", town: "Johannesburg", province: "Gauteng", par: 72, yards: 7500 },
  { id: "glendower", name: "Glendower", town: "Edenvale", province: "Gauteng", par: 72, yards: 7100 },
  { id: "bryanston", name: "Bryanston", town: "Johannesburg", province: "Gauteng", par: 72 },
  { id: "dainfern", name: "Dainfern", town: "Fourways", province: "Gauteng", par: 72 },
  { id: "eagle-canyon", name: "Eagle Canyon", town: "Roodepoort", province: "Gauteng", par: 72 },
  { id: "jackal-creek", name: "Jackal Creek", town: "Randburg", province: "Gauteng", par: 72 },
  { id: "killarney", name: "Killarney", town: "Johannesburg", province: "Gauteng", par: 72 },
  { id: "kyalami", name: "Kyalami", town: "Midrand", province: "Gauteng", par: 72 },
  { id: "serengeti", name: "Serengeti", town: "Kempton Park", province: "Gauteng", par: 72 },
  { id: "ebotse", name: "Ebotse", town: "Benoni", province: "Gauteng", par: 72 },
  { id: "randpark-firethorn", name: "Randpark — Firethorn", town: "Randburg", province: "Gauteng", par: 72 },
  { id: "randpark-bushwillow", name: "Randpark — Bushwillow", town: "Randburg", province: "Gauteng", par: 72 },
  { id: "wanderers", name: "Wanderers", town: "Johannesburg", province: "Gauteng", par: 72 },
  { id: "ccj-woodmead", name: "Country Club Johannesburg — Woodmead", town: "Johannesburg", province: "Gauteng", par: 72 },
  { id: "ccj-rocklands", name: "Country Club Johannesburg — Rocklands", town: "Johannesburg", province: "Gauteng", par: 72 },
  { id: "parkview", name: "Parkview", town: "Johannesburg", province: "Gauteng", par: 70 },
  { id: "benoni-cc", name: "Benoni Country Club", town: "Benoni", province: "Gauteng", par: 72 },
  { id: "zwartkop", name: "Zwartkop", town: "Centurion", province: "Gauteng", par: 72 },
  { id: "irene", name: "Irene", town: "Centurion", province: "Gauteng", par: 72 },
  { id: "waterkloof", name: "Waterkloof", town: "Pretoria", province: "Gauteng", par: 72 },
  { id: "silver-lakes", name: "Silver Lakes", town: "Pretoria", province: "Gauteng", par: 72 },
  { id: "copperleaf", name: "The Els Club Copperleaf", town: "Centurion", province: "Gauteng", par: 72 },
  { id: "pretoria-cc", name: "Pretoria Country Club", town: "Pretoria", province: "Gauteng", par: 72 },
  { id: "wingate-park", name: "Wingate Park", town: "Pretoria", province: "Gauteng", par: 72 },
  { id: "modderfontein", name: "Modderfontein", town: "Johannesburg", province: "Gauteng", par: 72 },

  // ---- North West ----
  { id: "gary-player-cc", name: "Gary Player Country Club", town: "Sun City", province: "North West", par: 72, yards: 7800 },
  { id: "lost-city", name: "Lost City", town: "Sun City", province: "North West", par: 72 },
  { id: "pecanwood", name: "Pecanwood", town: "Hartbeespoort", province: "North West", par: 72 },
  { id: "rustenburg", name: "Rustenburg", town: "Rustenburg", province: "North West", par: 72 },
  { id: "orkney", name: "Orkney", town: "Orkney", province: "North West", par: 72 },

  // ---- Mpumalanga ----
  { id: "leopard-creek", name: "Leopard Creek", town: "Malelane", province: "Mpumalanga", par: 72, yards: 7200 },
  { id: "nelspruit", name: "Nelspruit", town: "Mbombela", province: "Mpumalanga", par: 72 },
  { id: "white-river", name: "White River", town: "White River", province: "Mpumalanga", par: 72 },
  { id: "highland-gate", name: "Highland Gate", town: "Dullstroom", province: "Mpumalanga", par: 72 },
  { id: "middelburg", name: "Middelburg", town: "Middelburg", province: "Mpumalanga", par: 72 },

  // ---- Limpopo ----
  { id: "koro-creek", name: "Koro Creek", town: "Modimolle", province: "Limpopo", par: 72 },
  { id: "euphoria", name: "Euphoria", town: "Mookgophong", province: "Limpopo", par: 72 },
  { id: "zebula", name: "Zebula", town: "Bela-Bela", province: "Limpopo", par: 72 },
  { id: "legend-safari", name: "Legend Golf & Safari", town: "Entabeni", province: "Limpopo", par: 72 },
  { id: "polokwane", name: "Polokwane", town: "Polokwane", province: "Limpopo", par: 72 },

  // ---- Free State ----
  { id: "bloemfontein", name: "Bloemfontein", town: "Bloemfontein", province: "Free State", par: 72 },
  { id: "schoeman-park", name: "Schoeman Park", town: "Bloemfontein", province: "Free State", par: 72 },
  { id: "welkom", name: "Welkom", town: "Welkom", province: "Free State", par: 72 },
  { id: "parys", name: "Parys", town: "Parys", province: "Free State", par: 72 },

  // ---- Northern Cape ----
  { id: "kimberley", name: "Kimberley", town: "Kimberley", province: "Northern Cape", par: 72 },
  { id: "upington", name: "Upington", town: "Upington", province: "Northern Cape", par: 72 },
];

export const COURSES: Course[] = RAW_COURSES.map((r) => {
  const holes = buildLayout(r.par ?? 72, r.yards);
  return {
    id: r.id,
    name: r.name,
    province: r.province,
    location: `${r.town}, ${r.province}`,
    par: holes.reduce((sum, h) => sum + h.par, 0),
    holes,
    approxLayout: true,
  };
});

export const PROVINCES: string[] = Array.from(new Set(COURSES.map((c) => c.province)));

// Courses fetched at runtime from the Golf Course API are registered here so
// getCourse(id) resolves them like the bundled ones.
const DYNAMIC = new Map<string, Course>();

export function registerCourse(course: Course): void {
  DYNAMIC.set(course.id, course);
}

export function hasCourse(id: string): boolean {
  return DYNAMIC.has(id) || COURSES.some((c) => c.id === id);
}

export function getCourse(id: string): Course {
  return DYNAMIC.get(id) ?? COURSES.find((c) => c.id === id) ?? COURSES[0];
}

// A shared helper the API layer reuses to fill missing stroke indexes.
export function assignStrokeIndex(holes: { par: number; yards: number }[]): number[] {
  const order = holes
    .map((h, i) => ({ i, difficulty: h.par * 1000 + h.yards }))
    .sort((a, b) => b.difficulty - a.difficulty);
  const si: number[] = new Array(holes.length);
  order.forEach((o, rank) => {
    si[o.i] = rank + 1;
  });
  return si;
}

export function frontNinePar(course: Course): number {
  return course.holes.slice(0, 9).reduce((s, h) => s + h.par, 0);
}
export function backNinePar(course: Course): number {
  return course.holes.slice(9).reduce((s, h) => s + h.par, 0);
}

// Case-insensitive search over name / town / province.
export function searchCourses(query: string): Course[] {
  const q = query.trim().toLowerCase();
  if (!q) return COURSES;
  return COURSES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) || c.location.toLowerCase().includes(q)
  );
}
