// Per-hole GPS captured on-course (or from satellite), keyed by course id.
//
// Tee, front/middle/back of green, the fairway centreline, and hazards drawn as
// areas (an outline of points each). These drive the live Front/Middle/Back
// rangefinder, the fairway route, carry distances and the satellite hole view.
//
// Order matches the course's holes (index 0 = hole 1). Coordinates are decimal
// degrees (lat, lng).

import { Coord } from "../lib/geo";

export type HoleGps = {
  tee?: Coord;
  greenFront?: Coord;
  green?: Coord;
  greenBack?: Coord;
  fairway?: Coord[];
  hazards?: { type: "tree" | "water" | "bunker"; points: Coord[] }[];
};

export const COURSE_GPS: Record<string, HoleGps[]> = {
  // Kempton Park Golf Club — the ECS event venue. Hole 1 fully surveyed with a
  // routed fairway and hazards drawn as areas; holes 2–18 have tee + green.
  "kempton-park": [
    // H1
    { tee: { lat: -26.106786, lng: 28.212572 }, greenFront: { lat: -26.110011, lng: 28.21641 }, green: { lat: -26.110071, lng: 28.216514 }, greenBack: { lat: -26.110126, lng: 28.216595 },
      fairway: [ { lat: -26.106996, lng: 28.212947 }, { lat: -26.107446, lng: 28.214079 }, { lat: -26.107841, lng: 28.214784 }, { lat: -26.108428, lng: 28.21528 }, { lat: -26.108826, lng: 28.215527 }, { lat: -26.109084, lng: 28.215742 }, { lat: -26.109399, lng: 28.216045 }, { lat: -26.109695, lng: 28.216243 }, { lat: -26.109869, lng: 28.216321 } ],
      hazards: [
        { type: "water", points: [ { lat: -26.109238, lng: 28.215387 }, { lat: -26.109209, lng: 28.215515 }, { lat: -26.109184, lng: 28.215601 }, { lat: -26.109155, lng: 28.21577 }, { lat: -26.109148, lng: 28.215928 }, { lat: -26.109203, lng: 28.216041 }, { lat: -26.109216, lng: 28.216127 }, { lat: -26.109223, lng: 28.216166 }, { lat: -26.109206, lng: 28.216268 }, { lat: -26.109189, lng: 28.216364 }, { lat: -26.109153, lng: 28.216455 }, { lat: -26.109126, lng: 28.216539 } ] },
        { type: "bunker", points: [ { lat: -26.110132, lng: 28.216383 }, { lat: -26.110118, lng: 28.216405 }, { lat: -26.110091, lng: 28.21638 }, { lat: -26.110098, lng: 28.216361 }, { lat: -26.110111, lng: 28.216361 }, { lat: -26.110124, lng: 28.216359 } ] },
        { type: "tree", points: [ { lat: -26.10988, lng: 28.216054 }, { lat: -26.109868, lng: 28.215901 }, { lat: -26.109925, lng: 28.215925 }, { lat: -26.109966, lng: 28.215987 } ] },
        { type: "tree", points: [ { lat: -26.107276, lng: 28.212911 }, { lat: -26.107147, lng: 28.213161 }, { lat: -26.107267, lng: 28.213362 } ] },
        { type: "bunker", points: [ { lat: -26.107836, lng: 28.215099 }, { lat: -26.107909, lng: 28.215023 }, { lat: -26.107817, lng: 28.214936 }, { lat: -26.107756, lng: 28.215043 } ] },
        { type: "tree", points: [ { lat: -26.107637, lng: 28.214096 }, { lat: -26.10728, lng: 28.213371 }, { lat: -26.107713, lng: 28.213677 }, { lat: -26.108577, lng: 28.214651 }, { lat: -26.108297, lng: 28.214852 }, { lat: -26.10785, lng: 28.214414 } ] },
        { type: "bunker", points: [ { lat: -26.109891, lng: 28.216481 }, { lat: -26.109916, lng: 28.216511 }, { lat: -26.109938, lng: 28.216461 }, { lat: -26.109903, lng: 28.216439 } ] },
        { type: "tree", points: [ { lat: -26.106969, lng: 28.212732 }, { lat: -26.107061, lng: 28.212641 }, { lat: -26.107162, lng: 28.212785 }, { lat: -26.107075, lng: 28.212957 } ] },
        { type: "tree", points: [ { lat: -26.106796, lng: 28.212764 }, { lat: -26.106719, lng: 28.212877 }, { lat: -26.106868, lng: 28.213268 }, { lat: -26.10699, lng: 28.21314 }, { lat: -26.106836, lng: 28.212804 } ] },
        { type: "tree", points: [ { lat: -26.107132, lng: 28.213823 }, { lat: -26.107035, lng: 28.213941 }, { lat: -26.107046, lng: 28.214101 }, { lat: -26.107171, lng: 28.213929 } ] },
        { type: "tree", points: [ { lat: -26.107126, lng: 28.214147 }, { lat: -26.10714, lng: 28.214464 }, { lat: -26.107228, lng: 28.214282 } ] },
        { type: "tree", points: [ { lat: -26.107267, lng: 28.214573 }, { lat: -26.10719, lng: 28.214792 }, { lat: -26.107549, lng: 28.215329 }, { lat: -26.107698, lng: 28.214929 }, { lat: -26.107624, lng: 28.214708 }, { lat: -26.107444, lng: 28.214573 } ] },
        { type: "tree", points: [ { lat: -26.108295, lng: 28.215027 } ] },
        { type: "tree", points: [ { lat: -26.108439, lng: 28.215145 } ] },
        { type: "tree", points: [ { lat: -26.108459, lng: 28.21499 } ] },
        { type: "tree", points: [ { lat: -26.109013, lng: 28.215348 } ] },
        { type: "tree", points: [ { lat: -26.108611, lng: 28.215672 }, { lat: -26.108603, lng: 28.215919 }, { lat: -26.10838, lng: 28.215872 }, { lat: -26.108312, lng: 28.215721 }, { lat: -26.10821, lng: 28.21549 }, { lat: -26.108267, lng: 28.215372 }, { lat: -26.108561, lng: 28.21543 } ] },
        { type: "tree", points: [ { lat: -26.107893, lng: 28.215193 }, { lat: -26.10783, lng: 28.215311 }, { lat: -26.107951, lng: 28.215375 }, { lat: -26.10811, lng: 28.215354 } ] },
        { type: "tree", points: [ { lat: -26.107673, lng: 28.215356 }, { lat: -26.107644, lng: 28.215522 }, { lat: -26.107872, lng: 28.215691 }, { lat: -26.107845, lng: 28.215395 } ] },
        { type: "tree", points: [ { lat: -26.109279, lng: 28.216255 } ] },
        { type: "tree", points: [ { lat: -26.10952, lng: 28.216344 } ] },
        { type: "tree", points: [ { lat: -26.109571, lng: 28.216473 } ] }
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
