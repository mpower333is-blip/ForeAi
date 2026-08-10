// Default carry distances (yards) used by the AI caddie when a user has not
// calibrated their own bag. Ordered ascending so the recommender can scan for
// the nearest club.
const clubDistances: Record<string, number> = {
  LW: 62,
  SW: 82,
  GW: 100,
  PW: 118,
  "9 Iron": 132,
  "8 Iron": 145,
  "7 Iron": 158,
  "6 Iron": 170,
  "5 Iron": 180,
  "4 Iron": 190,
  Hybrid: 200,
  "5 Wood": 215,
  "3 Wood": 230,
  Driver: 250,
};

export default clubDistances;
