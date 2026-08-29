// Official scorecards captured from handicaps.co.za (par, stroke index and
// metre distances per hole, straight off each club's course-info page).
//
// Compact by design: transcribe the three rows a card shows — Par, Stroke and
// Dist (metres) — and cardToLayout() converts the metres to the yard field the
// rest of the app uses (× 1.09361, so the app's metre display matches the card
// exactly). Distances are for the tee noted in `tee`; par and stroke index are
// the same across tees, which is what scoring and handicap allocation need.
//
// Ids reuse an existing course id where one already exists (so the curated
// approximate course is upgraded to an exact card); otherwise a new id is added.

export type HcpCard = {
  id: string;
  name: string;
  town: string;
  province: string;
  par: number;
  tee: string; // which tee the distances came from
  lat?: number;
  lng?: number;
  pars: number[];   // 18 values
  sis: number[];    // 18 values, stroke index 1-18
  metres: number[]; // 18 values, tee-to-centre in metres
};

const M2Y = 1.09361;

export function cardToLayout(c: HcpCard): { par: number; yards: number; si: number }[] {
  return c.pars.map((p, i) => ({ par: p, yards: Math.round(c.metres[i] * M2Y), si: c.sis[i] }));
}

// prettier-ignore
export const HANDICAPS_CARDS: HcpCard[] = [
  { id:"kempton-golf-club", name:"Kempton Golf Club", town:"Kempton Park", province:"Gauteng", par:72, tee:"White", lat:-26.101, lng:28.231,
    pars:  [5,4,4,4,3,4,4,5,3, 4,3,5,5,4,4,4,3,4],
    sis:   [3,11,9,1,13,7,5,17,15, 8,16,12,14,4,2,10,18,6],
    metres:[561,326,384,403,190,393,367,432,173, 346,156,485,488,382,379,362,156,363] },

  { id:"avion-golf-club", name:"Avion Golf Club", town:"Kempton Park", province:"Gauteng", par:72, tee:"White", lat:-26.129, lng:28.223,
    pars:  [4,3,4,5,4,5,4,4,3, 4,3,4,5,4,5,4,4,3],
    sis:   [11,5,9,13,7,3,17,1,15, 2,12,10,16,14,4,18,6,8],
    metres:[321,193,365,459,343,512,279,379,133, 365,175,365,459,343,512,280,351,198] },

  { id:"benoni-country-club", name:"Benoni Country Club", town:"Benoni", province:"Gauteng", par:72, tee:"Yellow", lat:-26.188, lng:28.315,
    pars:  [5,4,3,4,4,4,4,3,5, 5,4,3,4,4,3,4,4,5],
    sis:   [7,5,15,13,11,3,1,17,9, 6,8,16,2,18,10,14,4,12],
    metres:[522,393,181,357,410,401,446,164,530, 521,401,170,452,277,184,350,439,540] },

  { id:"benoni-lake-golf-club", name:"Benoni Lake Golf Club", town:"Benoni", province:"Gauteng", par:72, tee:"White",
    pars:  [4,4,5,5,3,4,4,4,3, 5,4,4,3,4,5,3,4,4],
    sis:   [8,6,14,12,16,4,2,18,10, 15,5,9,17,3,7,11,1,13],
    metres:[390,403,504,506,159,428,400,370,199, 465,365,354,148,372,528,179,403,372] },

  { id:"blair-atholl-golf-and-equestrian-estate", name:"Blair Atholl Golf & Equestrian Estate", town:"Lanseria", province:"Gauteng", par:72, tee:"Black",
    pars:  [5,4,3,4,5,3,4,3,4, 5,3,4,5,4,4,4,3,5],
    sis:   [8,4,12,2,16,14,10,18,6, 7,17,5,13,3,9,1,15,11],
    metres:[582,459,189,458,554,222,379,215,434, 586,213,434,594,479,518,512,180,519] },

  { id:"blue-valley-golf-estate", name:"Blue Valley Golf Estate", town:"Midrand", province:"Gauteng", par:72, tee:"Yellow", lat:-25.947, lng:28.128,
    pars:  [4,3,5,4,5,4,4,3,4, 4,4,3,5,4,3,4,4,5],
    sis:   [18,16,10,8,2,4,12,14,6, 17,1,15,11,3,9,13,5,7],
    metres:[358,173,466,430,516,404,393,204,445, 364,433,169,530,384,192,391,406,494] },

  { id:"bronkhorstspruit-golf-club", name:"Bronkhorstspruit Golf Club", town:"Bronkhorstspruit", province:"Gauteng", par:72, tee:"White", lat:-25.808, lng:28.748,
    pars:  [4,4,4,4,3,5,3,5,4, 4,3,4,5,4,5,3,4,4],
    sis:   [17,7,3,1,15,9,11,5,13, 10,6,4,16,18,8,14,2,12],
    metres:[290,375,415,405,157,472,137,483,308, 363,198,418,495,341,509,170,401,373] },

  { id:"bryanston-country-club", name:"Bryanston Country Club", town:"Sandton", province:"Gauteng", par:72, tee:"Yellow", lat:-26.052, lng:28.017,
    pars:  [5,5,4,3,4,4,4,4,3, 4,3,4,4,3,5,4,5,4],
    sis:   [18,14,2,10,8,12,4,6,16, 1,9,7,15,13,11,5,17,3],
    metres:[500,490,410,175,380,385,420,400,170, 440,200,415,320,155,525,405,465,435] },

  { id:"centurion-country-club", name:"Centurion Country Club", town:"Centurion", province:"Gauteng", par:70, tee:"Yellow", lat:-25.861, lng:28.189,
    pars:  [5,4,3,4,4,4,5,3,4, 4,3,3,4,4,5,4,3,4],
    sis:   [17,1,15,3,7,5,13,11,9, 14,8,12,6,16,2,10,18,4],
    metres:[499,465,175,455,391,368,540,163,277, 371,211,120,398,344,552,336,153,418] },

  { id:"cmr-golf-club", name:"CMR Golf Club", town:"Pretoria", province:"Gauteng", par:72, tee:"Yellow", lat:-25.730, lng:28.132,
    pars:  [5,4,4,5,5,3,4,3,4, 4,4,4,4,3,4,4,3,5],
    sis:   [13,7,5,17,15,9,1,11,3, 14,10,2,6,18,4,16,8,12],
    metres:[550,358,415,491,530,175,497,150,435, 367,369,379,380,122,414,292,182,524] },

  { id:"cullinan-golf-club", name:"Cullinan Golf Club", town:"Cullinan", province:"Gauteng", par:72, tee:"White", lat:-25.674, lng:28.523,
    pars:  [5,4,4,5,4,3,4,3,4, 5,4,4,5,4,3,4,3,4],
    sis:   [9,5,13,15,3,11,1,17,7, 10,6,14,16,4,12,2,18,8],
    metres:[487,332,375,470,396,198,425,135,366, 446,370,352,495,372,220,392,158,355] },

  { id:"dainfern-country-club", name:"Dainfern Country Club", town:"Fourways", province:"Gauteng", par:72, tee:"Yellow", lat:-25.993, lng:28.001,
    pars:  [4,5,4,3,4,3,4,5,4, 4,3,5,4,4,4,3,4,5],
    sis:   [3,17,5,9,11,15,1,7,13, 6,8,16,12,4,2,18,10,14],
    metres:[393,472,404,195,374,165,426,468,366, 360,189,496,389,377,405,195,394,500] },

  { id:"delmas-golf-club", name:"Delmas Golf Club", town:"Delmas", province:"Mpumalanga", par:72, tee:"Yellow", lat:-26.146, lng:28.681,
    pars:  [4,3,4,4,4,4,5,5,3, 4,3,4,4,4,4,5,5,3],
    sis:   [3,17,7,11,1,15,9,5,13, 4,18,8,12,2,16,10,6,14],
    metres:[384,135,364,357,359,365,532,558,160, 370,117,364,345,373,365,500,565,201] },

  { id:"eagle-canyon-golf-estate", name:"Eagle Canyon Golf Estate", town:"Roodepoort", province:"Gauteng", par:72, tee:"Yellow", lat:-26.052, lng:27.934,
    pars:  [4,5,4,3,5,4,4,3,4, 4,3,4,4,5,4,4,3,5],
    sis:   [3,17,1,7,13,9,11,15,5, 6,12,2,4,18,8,16,14,10],
    metres:[398,478,369,179,485,374,418,216,444, 422,155,468,390,490,393,330,170,512] },

  { id:"ebotse-links", name:"Ebotse Links", town:"Benoni", province:"Gauteng", par:72, tee:"Yellow",
    pars:  [4,3,4,4,5,4,5,3,4, 4,3,5,4,4,3,4,4,5],
    sis:   [9,13,5,1,15,3,11,17,7, 10,14,4,12,6,18,8,2,16],
    metres:[367,219,393,448,569,400,508,152,365, 385,187,548,310,417,152,432,427,570] },

  { id:"emfuleni-country-club", name:"Emfuleni Country Club", town:"Vanderbijlpark", province:"Gauteng", par:72, tee:"Yellow", lat:-26.690, lng:27.834,
    pars:  [4,4,4,3,4,5,3,4,5, 5,4,3,4,4,4,4,3,5],
    sis:   [9,17,1,15,5,7,13,3,11, 12,4,14,2,10,18,16,6,8],
    metres:[389,363,471,164,423,508,135,366,509, 510,347,167,407,371,387,320,157,524] },

  { id:"erpm-golf-club", name:"ERPM Golf Club", town:"Boksburg", province:"Gauteng", par:72, tee:"Yellow", lat:-26.234, lng:28.276,
    pars:  [4,5,4,5,3,4,3,4,4, 4,4,3,5,3,4,4,5,4],
    sis:   [9,15,1,17,11,3,13,7,5, 10,6,12,16,14,4,8,18,2],
    metres:[336,509,441,541,196,432,179,427,367, 313,399,169,527,137,406,369,512,419] },

  { id:"eye-of-africa-golf-club", name:"Eye of Africa Golf Club", town:"Eikenhof", province:"Gauteng", par:72, tee:"Black", lat:-26.421, lng:27.933,
    pars:  [4,5,4,4,3,4,4,5,3, 4,5,3,4,4,4,3,5,4],
    sis:   [14,8,2,16,12,6,4,18,10, 5,11,7,17,3,9,13,15,1],
    metres:[395,574,427,337,214,370,430,581,210, 396,606,180,371,445,419,192,567,496] },

  { id:"glendower-golf-club", name:"Glendower Golf Club", town:"Edenvale", province:"Gauteng", par:72, tee:"Yellow", lat:-26.152, lng:28.152,
    pars:  [4,5,3,4,4,3,4,5,4, 4,4,4,5,3,5,4,3,4],
    sis:   [7,13,9,1,3,15,5,17,11, 2,10,8,14,18,16,6,12,4],
    metres:[407,509,201,465,460,170,444,477,367, 436,396,372,511,158,500,403,203,412] },

  { id:"glenvista-country-club", name:"Glenvista Country Club", town:"Johannesburg", province:"Gauteng", par:72, tee:"Yellow", lat:-26.312, lng:28.031,
    pars:  [4,5,4,3,5,4,4,3,4, 4,5,4,3,4,3,4,5,4],
    sis:   [8,16,10,12,18,4,2,14,6, 5,11,1,15,13,7,9,17,3],
    metres:[415,530,337,170,491,416,406,194,369, 383,496,428,168,305,181,386,459,427] },

  { id:"goldfields-west-golf-club", name:"Goldfields West Private Golf Club", town:"Westonaria", province:"Gauteng", par:72, tee:"White", lat:-26.320, lng:27.652,
    pars:  [4,4,4,3,5,3,4,5,4, 4,4,5,3,4,5,4,3,4],
    sis:   [9,1,3,7,11,13,5,15,17, 2,6,18,10,14,12,8,16,4],
    metres:[366,448,387,194,483,151,371,475,351, 453,379,485,172,339,477,375,169,450] },

  { id:"houghton-golf-club", name:"Houghton Golf Club", town:"Johannesburg", province:"Gauteng", par:72, tee:"Yellow", lat:-26.166, lng:28.061,
    pars:  [4,4,5,4,5,4,3,4,3, 5,4,4,4,3,5,3,4,4],
    sis:   [10,2,18,4,16,6,14,8,12, 11,5,1,13,17,9,7,15,3],
    metres:[333,463,497,425,498,399,162,373,163, 523,362,421,361,179,525,210,354,408] },

  { id:"huddle-park-golf-club", name:"Huddle Park Golf & Recreation", town:"Johannesburg", province:"Gauteng", par:72, tee:"Yellow", lat:-26.163, lng:28.121,
    pars:  [4,4,3,4,4,5,3,4,5, 4,4,4,3,5,4,5,3,4],
    sis:   [7,5,15,3,11,13,17,1,9, 6,16,8,10,18,2,12,14,4],
    metres:[388,411,168,393,405,475,160,446,493, 445,405,410,178,439,382,496,183,429] },

  { id:"irene-country-club", name:"Irene Country Club", town:"Centurion", province:"Gauteng", par:71, tee:"Yellow", lat:-25.879, lng:28.211,
    pars:  [4,5,4,3,4,4,3,3,5, 5,4,4,3,4,4,3,5,4],
    sis:   [15,11,1,7,3,9,17,5,13, 8,6,4,14,2,10,12,18,16],
    metres:[368,557,465,205,410,352,135,155,515, 522,396,386,168,432,308,126,508,329] },

  { id:"jackal-creek-golf-club", name:"Jackal Creek Golf Club", town:"Randburg", province:"Gauteng", par:72, tee:"Yellow", lat:-26.030, lng:27.941,
    pars:  [5,4,3,4,4,5,3,4,5, 4,4,3,4,4,3,4,4,5],
    sis:   [7,5,15,1,13,11,17,3,9, 6,8,18,10,2,16,12,14,4],
    metres:[558,453,162,409,398,494,128,352,508, 369,360,163,353,404,203,354,335,537] },

  { id:"killarney-country-club", name:"Killarney Country Club", town:"Johannesburg", province:"Gauteng", par:70, tee:"Yellow", lat:-26.162, lng:28.052,
    pars:  [4,4,4,3,5,3,4,4,4, 4,4,4,4,3,5,4,3,4],
    sis:   [13,11,5,7,15,17,3,9,1, 2,6,12,4,14,18,8,16,10],
    metres:[394,326,393,197,498,188,421,350,421, 435,380,364,400,186,464,398,203,362] },

  { id:"krugersdorp-golf-club", name:"Krugersdorp Golf Club", town:"Krugersdorp", province:"Gauteng", par:72, tee:"Yellow", lat:-26.103, lng:27.773,
    pars:  [5,5,4,3,4,3,5,4,4, 4,3,5,4,3,4,4,4,4],
    sis:   [5,15,7,17,1,9,13,3,11, 4,12,18,10,16,2,6,8,14],
    metres:[520,488,381,195,422,172,534,368,394, 364,174,528,431,176,474,438,420,360] },

  { id:"kyalami-country-club", name:"Kyalami Country Club", town:"Midrand", province:"Gauteng", par:72, tee:"Yellow", lat:-25.992, lng:28.073,
    pars:  [4,4,3,5,4,3,4,4,5, 4,4,4,5,3,4,4,3,5],
    sis:   [11,3,7,13,1,17,9,5,15, 6,2,14,18,16,10,4,8,12],
    metres:[343,404,186,444,392,180,414,421,560, 378,448,337,496,154,378,416,200,480] },

  { id:"maccauvlei-golf-club", name:"Maccauvlei Golf Club", town:"Vereeniging", province:"Gauteng", par:72, tee:"Yellow", lat:-26.720, lng:27.851,
    pars:  [4,5,4,4,3,4,5,3,4, 4,4,4,4,3,5,3,4,5],
    sis:   [7,13,17,3,5,11,15,9,1, 6,2,10,8,16,12,14,4,18],
    metres:[384,515,311,405,219,367,521,159,452, 352,408,377,391,169,548,157,422,474] },

  { id:"magaliespark-country-club", name:"Magaliespark Country Club", town:"Hartbeespoort", province:"North West", par:72, tee:"Yellow", lat:-25.752, lng:27.861,
    pars:  [4,4,4,5,3,5,4,3,3, 4,3,4,5,3,5,4,4,5],
    sis:   [4,14,12,6,16,8,2,10,18, 3,17,7,9,13,5,1,15,11],
    metres:[391,341,367,517,171,510,335,167,187, 416,183,328,481,161,461,364,358,541] },

  { id:"meyerton-golf-club", name:"Meyerton Golf Club", town:"Meyerton", province:"Gauteng", par:72, tee:"Yellow", lat:-26.556, lng:28.017,
    pars:  [5,5,4,4,3,4,4,3,4, 4,3,5,4,4,3,4,4,5],
    sis:   [13,17,9,3,11,1,5,7,15, 4,12,14,2,8,16,6,10,18],
    metres:[493,517,401,407,137,402,361,179,320, 404,192,503,430,407,204,448,426,466] },
];
