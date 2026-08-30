// Per-hole GPS captured on-course (or from satellite), keyed by course id.
//
// Tee(s), front/middle/back of green, the fairway centreline, and hazards drawn
// as areas. These drive the live Front/Middle/Back rangefinder, the fairway
// route, carry distances and the satellite hole view. A hole may carry several
// tee boxes (club/men/ladies/junior) for mixed and school fields.
//
// Order matches the course's holes (index 0 = hole 1). Decimal degrees.

import { Coord } from "../lib/geo";

export type TeeBox = { name: string; lat: number; lng: number };
export type HoleGps = {
  tee?: Coord;
  tees?: TeeBox[];
  greenFront?: Coord;
  green?: Coord;
  greenBack?: Coord;
  fairway?: Coord[];
  hazards?: { type: "tree" | "water" | "bunker"; points: Coord[]; width?: number }[];
};

export const COURSE_GPS: Record<string, HoleGps[]> = {
  // Kempton Park Golf Club — the ECS event venue. Hole 1 fully surveyed;
  // holes 2–18 have tee + green.
  "kempton-park": [
    // H1
    { tee: { lat: -26.106807, lng: 28.212573 }, greenFront: { lat: -26.109984, lng: 28.21641 }, green: { lat: -26.110071, lng: 28.216533 }, greenBack: { lat: -26.110126, lng: 28.216595 },
      tees: [ { name: "Club", lat: -26.106807, lng: 28.212573 } ],
      fairway: [ { lat: -26.106894, lng: 28.212819 }, { lat: -26.107314, lng: 28.213768 }, { lat: -26.107624, lng: 28.214495 }, { lat: -26.107976, lng: 28.214988 }, { lat: -26.108689, lng: 28.215358 } ],
      hazards: [
        { type: "water", points: [ { lat: -26.108954, lng: 28.217032 }, { lat: -26.109251, lng: 28.21537 }, { lat: -26.109213, lng: 28.216382 } ] },
        { type: "tree", points: [ { lat: -26.106973, lng: 28.212718 }, { lat: -26.10706, lng: 28.212916 }, { lat: -26.107161, lng: 28.212857 }, { lat: -26.107093, lng: 28.21267 } ] },
        { type: "tree", points: [ { lat: -26.106811, lng: 28.212726 }, { lat: -26.106715, lng: 28.212865 }, { lat: -26.10685, lng: 28.213214 }, { lat: -26.106996, lng: 28.213122 } ] },
        { type: "tree", points: [ { lat: -26.107321, lng: 28.212879 }, { lat: -26.107191, lng: 28.213158 }, { lat: -26.107476, lng: 28.213812 }, { lat: -26.10761, lng: 28.213812 }, { lat: -26.107697, lng: 28.213689 }, { lat: -26.107654, lng: 28.213356 }, { lat: -26.107519, lng: 28.212986 } ] },
        { type: "tree", points: [ { lat: -26.107117, lng: 28.213802 }, { lat: -26.107011, lng: 28.213979 }, { lat: -26.107016, lng: 28.214102 }, { lat: -26.107141, lng: 28.214049 }, { lat: -26.107127, lng: 28.213952 } ] },
        { type: "tree", points: [ { lat: -26.107136, lng: 28.214145 }, { lat: -26.10716, lng: 28.214446 }, { lat: -26.107175, lng: 28.214279 } ] },
        { type: "tree", points: [ { lat: -26.107201, lng: 28.214729 }, { lat: -26.107263, lng: 28.214557 }, { lat: -26.107543, lng: 28.214632 }, { lat: -26.107697, lng: 28.214874 }, { lat: -26.107707, lng: 28.215035 } ] },
        { type: "tree", points: [ { lat: -26.107882, lng: 28.215139 }, { lat: -26.107815, lng: 28.215316 }, { lat: -26.108345, lng: 28.215675 }, { lat: -26.108441, lng: 28.21552 } ] },
        { type: "tree", points: [ { lat: -26.107713, lng: 28.213832 }, { lat: -26.107583, lng: 28.214009 }, { lat: -26.107834, lng: 28.214261 }, { lat: -26.107781, lng: 28.214111 } ] },
        { type: "tree", points: [ { lat: -26.108013, lng: 28.214403 }, { lat: -26.108609, lng: 28.214442 }, { lat: -26.109291, lng: 28.214914 }, { lat: -26.109633, lng: 28.215138 }, { lat: -26.10945, lng: 28.21539 }, { lat: -26.108957, lng: 28.215043 }, { lat: -26.108479, lng: 28.214691 }, { lat: -26.108311, lng: 28.214927 } ] },
        { type: "tree", points: [ { lat: -26.109888, lng: 28.215874 }, { lat: -26.109864, lng: 28.2161 }, { lat: -26.109985, lng: 28.216046 } ] },
        { type: "tree", points: [ { lat: -26.10954, lng: 28.216475 }, { lat: -26.109627, lng: 28.216507 } ] },
        { type: "bunker", points: [ { lat: -26.110077, lng: 28.216394 }, { lat: -26.110118, lng: 28.216428 }, { lat: -26.110149, lng: 28.216377 }, { lat: -26.110111, lng: 28.216339 } ] },
        { type: "bunker", points: [ { lat: -26.109901, lng: 28.216442 }, { lat: -26.109882, lng: 28.216498 }, { lat: -26.109937, lng: 28.216533 }, { lat: -26.109951, lng: 28.21647 } ] },
        { type: "bunker", points: [ { lat: -26.107832, lng: 28.214949 }, { lat: -26.107755, lng: 28.215067 }, { lat: -26.107805, lng: 28.215109 }, { lat: -26.1079, lng: 28.215025 } ] }
      ] },
    // H2
    { tee: { lat: -26.109808, lng: 28.21701 }, green: { lat: -26.107831, lng: 28.219363 } },
    // H3
    { tee: { lat: -26.107383, lng: 28.219768 }, green: { lat: -26.110642, lng: 28.219272 } },
    // H4
    { tee: { lat: -26.110748, lng: 28.220157 }, green: { lat: -26.107499, lng: 28.220178 } },
    // H5
    { tee: { lat: -26.107128, lng: 28.220154 }, green: { lat: -26.107282, lng: 28.218124 } },
    // H6
    { tee: { lat: -26.10779, lng: 28.217727 }, green: { lat: -26.104632, lng: 28.215785 } },
    // H7
    { tee: { lat: -26.104957, lng: 28.21539 }, green: { lat: -26.107703, lng: 28.217346 } },
    // H8
    { tee: { lat: -26.108592, lng: 28.217378 }, green: { lat: -26.105514, lng: 28.215114 } },
    // H9
    { tee: { lat: -26.105379, lng: 28.214892 }, green: { lat: -26.10692, lng: 28.214374 } },
    // H10
    { tee: { lat: -26.103546, lng: 28.215656 }, green: { lat: -26.100256, lng: 28.215546 } },
    // H11
    { tee: { lat: -26.100044, lng: 28.21505 }, green: { lat: -26.101046, lng: 28.213977 } },
    // H12
    { tee: { lat: -26.100928, lng: 28.212711 }, green: { lat: -26.104042, lng: 28.21523 } },
    // H13
    { tee: { lat: -26.103618, lng: 28.216632 }, green: { lat: -26.104635, lng: 28.22032 } },
    // H14
    { tee: { lat: -26.105121, lng: 28.220975 }, green: { lat: -26.102195, lng: 28.21888 } },
    // H15
    { tee: { lat: -26.101542, lng: 28.219937 }, green: { lat: -26.100574, lng: 28.216361 } },
    // H16
    { tee: { lat: -26.100754, lng: 28.216171 }, green: { lat: -26.102888, lng: 28.218834 } },
    // H17
    { tee: { lat: -26.10284, lng: 28.217925 }, green: { lat: -26.1033, lng: 28.216391 } },
    // H18
    { tee: { lat: -26.104259, lng: 28.215557 }, green: { lat: -26.106629, lng: 28.213204 } },
  ],
};
