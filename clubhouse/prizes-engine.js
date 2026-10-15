// Prize-giving engine — browser port of mobile/src/lib/prizes.ts.
//
// Turns a finished event's scores into the full set of golf-day prizes:
// overall winners (with countback), best gross, handicap divisions, front/back
// nines, the two's club, a team prize, and the side-game winners. It mirrors
// the app's tournament.ts handicap-stroke + Stableford logic function-for-
// function so the board, the app and the ceremony all agree on who won.
//
// Exposed as window.PrizesEngine. No modules — same plain-global style as
// events-fs.js / club-fs.js.
(function () {
  "use strict";

  // ---- side-game catalog (kept in sync with the app + board) -------------
  var CONTEST_CATALOG = {
    closest:     { label: "Closest to the Pin",      unit: "m", dir: "min" },
    closest2:    { label: "Closest to the Pin in 2", unit: "m", dir: "min" },
    longest:     { label: "Longest Drive",           unit: "m", dir: "max" },
    straightest: { label: "Straightest Drive",       unit: "m", dir: "min" },
    longestputt: { label: "Longest Putt",            unit: "m", dir: "max" },
    beatthepro:  { label: "Beat the Pro",            unit: "",  dir: null },
    putting:     { label: "Putting Competition",     unit: "",  dir: null },
    holeinone:   { label: "Hole-in-One Challenge",   unit: "",  dir: null },
    mulligan:    { label: "Mulligans",               unit: "",  dir: null },
    splitpot:    { label: "50/50 Split the Pot",     unit: "",  dir: null },
    headstails:  { label: "Heads or Tails",          unit: "",  dir: null },
    luckyball:   { label: "Lucky Ball (Yellow Ball)", unit: "", dir: null },
    string:      { label: "String Game",             unit: "",  dir: null },
    raffle:      { label: "Raffle / Auction",        unit: "",  dir: null },
  };

  // ---- course cards (par + stroke index per hole) ------------------------
  // The assembled event carries only courseId, so the ceremony needs the real
  // card to score net / Stableford. These mirror EXACT_LAYOUTS in the app's
  // data/courses.ts. An unknown course falls back to a standard par-72 card and
  // the page flags it as approximate.
  // Each entry: [par, strokeIndex] per hole in order.
  var COURSE_CARDS = {
    "kempton-park": {
      name: "Kempton Park Golf Club",
      holes: [[5,4],[4,16],[4,8],[4,2],[3,10],[4,6],[4,14],[5,12],[3,18],
              [4,13],[3,17],[5,11],[5,5],[4,1],[4,3],[4,9],[3,15],[4,7]],
    },
    "avion-park": {
      name: "Avion Park Golf Club",
      holes: [[4,15],[3,7],[4,9],[5,13],[4,3],[5,5],[4,17],[4,1],[3,11]],
    },
    "modderfontein": {
      name: "Modderfontein Golf Club",
      holes: [[5,18],[4,4],[3,14],[4,10],[4,2],[4,6],[4,8],[5,16],[3,12],
              [5,9],[3,17],[4,3],[5,13],[3,11],[4,1],[4,15],[4,5],[4,7]],
    },
    "serengeti-masai": {
      name: "Serengeti — Masai Mara",
      // No official SI on the app card → the app derives it with assignStrokeIndex
      // (rank by par*1000+yards desc, stable). This SI MUST equal that output, or
      // the ceremony silently disagrees with the app/board on per-hole strokes.
      holes: [[4,8],[4,13],[5,2],[4,10],[3,17],[4,9],[4,7],[5,4],[3,16],
              [4,11],[5,3],[3,15],[4,6],[4,14],[3,18],[5,1],[4,12],[4,5]],
    },
    "serengeti-serengeti": {
      name: "Serengeti — Whistling Thorn",
      holes: [[3,7],[3,11],[3,1],[3,15],[3,17],[3,5],[3,13],[3,9],[3,3],
              [3,14],[3,4],[3,12],[3,10],[3,18],[3,2],[3,16],[3,8],[3,6]],
    },
  };

  // Standard par-72 fallback: par pattern with par-3s/5s spread, SI 1..18 by a
  // conventional men's allocation (odds on the front, evens on the back).
  function defaultCard() {
    var pars = [4,5,4,3,4,4,5,3,4, 4,4,3,5,4,4,3,5,4];
    var si   = [5,1,13,17,7,11,3,15,9, 6,2,14,10,8,12,18,4,16];
    var holes = [];
    for (var i = 0; i < 18; i++) holes.push({ number: i + 1, par: pars[i], si: si[i] });
    return { name: "", holes: holes, approx: true };
  }

  // Resolve a course id → { name, holes:[{number,par,si}], approx }.
  function cardFor(courseId, fallbackName) {
    var raw = COURSE_CARDS[courseId];
    if (!raw) {
      var d = defaultCard();
      d.name = fallbackName || courseId || "Course";
      return d;
    }
    return {
      name: raw.name,
      approx: false,
      holes: raw.holes.map(function (h, i) { return { number: i + 1, par: h[0], si: h[1] }; }),
    };
  }

  // ---- handicap strokes (mirror tournament.ts) ---------------------------
  function handicapStrokesOnHole(handicap, si) {
    var hc = Math.round(handicap || 0);
    var strokes = 0;
    if (hc >= si) strokes += 1;
    if (hc >= si + 18) strokes += 1;
    return strokes;
  }

  // ---- per-player card ---------------------------------------------------
  function buildCard(event, course, player) {
    var scores = (event.scores && event.scores[player.id]) || {};
    var grossByHole = {}, netByHole = {}, pointsByHole = {};
    var gross = 0, net = 0, stableford = 0, holesPlayed = 0;
    for (var i = 0; i < course.holes.length; i++) {
      var h = course.holes[i];
      var g = scores[h.number];
      if (g == null) continue;
      holesPlayed += 1;
      var received = handicapStrokesOnHole(player.handicap, h.si);
      var holeNet = g - received;
      var pts = Math.max(0, 2 - (holeNet - h.par));
      grossByHole[h.number] = g;
      netByHole[h.number] = holeNet;
      pointsByHole[h.number] = pts;
      gross += g; net += holeNet; stableford += pts;
    }
    return {
      player: player, holesPlayed: holesPlayed,
      complete: holesPlayed === course.holes.length && holesPlayed > 0,
      gross: gross, net: net, stableford: stableford,
      grossByHole: grossByHole, netByHole: netByHole, pointsByHole: pointsByHole,
    };
  }

  // ---- countback ---------------------------------------------------------
  function countbackStarts(holeCount) {
    if (holeCount >= 18) return [10, 13, 16, 18];
    if (holeCount === 9) return [4, 7, 9];
    var back = Math.floor(holeCount / 2) + 1;
    var arr = [back, Math.max(back, holeCount - 2), holeCount];
    return arr.filter(function (v, i) { return arr.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
  }

  function segmentSum(byHole, from) {
    var sum = 0;
    for (var k in byHole) {
      if (!byHole.hasOwnProperty(k)) continue;
      if (Number(k) >= from) sum += byHole[k];
    }
    return sum;
  }

  function metricTotal(c, metric) { return metric === "stableford" ? c.stableford : c.net; }
  function metricByHole(c, metric) { return metric === "stableford" ? c.pointsByHole : c.netByHole; }

  function compareCards(a, b, metric, higherBetter, starts) {
    // Finished rounds always rank ahead of unfinished ones — a partial card must
    // never beat a complete one (matters most for net/gross, lower-is-better).
    if (a.complete !== b.complete) return a.complete ? -1 : 1;
    var at = metricTotal(a, metric), bt = metricTotal(b, metric);
    if (at !== bt) return higherBetter ? bt - at : at - bt;
    var am = metricByHole(a, metric), bm = metricByHole(b, metric);
    for (var i = 0; i < starts.length; i++) {
      var av = segmentSum(am, starts[i]), bv = segmentSum(bm, starts[i]);
      if (av !== bv) return higherBetter ? bv - av : av - bv;
    }
    return 0;
  }

  function rankCards(cards, metric, higherBetter, holeCount) {
    var starts = countbackStarts(holeCount);
    var sorted = cards.slice().sort(function (a, b) { return compareCards(a, b, metric, higherBetter, starts); });
    var rows = [];
    sorted.forEach(function (c, i) {
      var place = i + 1, countback = false, tie = false;
      if (i > 0) {
        var prev = sorted[i - 1];
        var samePrimary = prev.complete === c.complete && metricTotal(prev, metric) === metricTotal(c, metric);
        var cmp = compareCards(prev, c, metric, higherBetter, starts);
        if (cmp === 0) { place = rows[i - 1].place; tie = samePrimary; }
        else if (samePrimary) { countback = true; }
      }
      rows.push({
        place: place, player: c.player, gross: c.gross, net: c.net,
        stableford: c.stableford, thru: c.holesPlayed, complete: c.complete,
        countback: countback, tie: tie,
      });
    });
    return rows;
  }

  // ---- nines -------------------------------------------------------------
  function bestNine(cards, metric, higherBetter, holes) {
    if (!holes.length) return null; // nine doesn't exist on this course
    var best = null;
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i], by = metricByHole(c, metric);
      var played = holes.filter(function (h) { return by[h] != null; });
      if (played.length < holes.length) continue;
      var value = played.reduce(function (s, h) { return s + by[h]; }, 0);
      if (!best || (higherBetter ? value > best.value : value < best.value)) best = { player: c.player, value: value };
    }
    return best;
  }

  // ---- divisions ---------------------------------------------------------
  function splitThirds(cards) {
    var byHcp = cards.slice().sort(function (a, b) { return a.player.handicap - b.player.handicap; });
    var n = byHcp.length;
    if (n < 6) return [{ label: "Overall", range: "all", cards: byHcp }];
    var cut1 = Math.ceil(n / 3), cut2 = Math.ceil((2 * n) / 3);
    var groups = [byHcp.slice(0, cut1), byHcp.slice(cut1, cut2), byHcp.slice(cut2)];
    var labels = ["Division A", "Division B", "Division C"];
    return groups.filter(function (g) { return g.length > 0; }).map(function (g, i) {
      return { label: labels[i], range: g[0].player.handicap + "–" + g[g.length - 1].player.handicap + " hcp", cards: g };
    });
  }

  function splitBands(cards, bands) {
    var ordered = bands.slice().sort(function (a, b) { return a.max - b.max; });
    var out = [], prevMax = -Infinity;
    ordered.forEach(function (band) {
      var members = cards.filter(function (c) { return c.player.handicap > prevMax && c.player.handicap <= band.max; });
      var range = prevMax === -Infinity ? "up to " + band.max
        : band.max === Infinity ? (prevMax + 1) + "+" : (prevMax + 1) + "–" + band.max;
      out.push({ label: band.label, range: range, cards: members });
      prevMax = band.max;
    });
    return out.filter(function (d) { return d.cards.length > 0; });
  }

  // ---- team prize --------------------------------------------------------
  function teamNames(event, group) {
    return group.playerIds.map(function (id) {
      var p = event.players.find(function (x) { return x.id === id; });
      return p ? p.name : null;
    }).filter(Boolean).join(", ");
  }

  function computeTeams(event, course, cardsById, metric, higherBetter, format) {
    var resolved = format === "auto" ? (event.format === "scramble" ? "scramble" : "combined") : format;
    if (!event.groups || event.groups.length === 0) return null;
    var hb = higherBetter, label;
    var rawRows = event.groups.map(function (group, index) {
      var members = group.playerIds.map(function (id) { return cardsById[id]; }).filter(Boolean);
      var value = 0, complete = members.length > 0, played = 0;
      if (resolved === "scramble") {
        var cap = members[0];
        value = cap ? cap.gross : 0;
        complete = !!cap && cap.complete;
        played = cap ? cap.holesPlayed : 0;
        hb = false;
      } else if (resolved === "best2") {
        hb = true;
        for (var i = 0; i < course.holes.length; i++) {
          var hn = course.holes[i].number;
          var pts = members.map(function (m) { return m.pointsByHole[hn]; })
            .filter(function (v) { return v != null; }).sort(function (a, b) { return b - a; });
          value += (pts[0] || 0) + (pts[1] || 0);
        }
        complete = members.length > 0 && members.some(function (m) { return m.complete; });
        played = members.reduce(function (mx, m) { return Math.max(mx, m.holesPlayed); }, 0);
      } else {
        value = members.reduce(function (s, m) { return s + metricTotal(m, metric); }, 0);
        complete = members.length > 0 && members.every(function (m) { return m.complete; });
        played = members.reduce(function (mx, m) { return Math.max(mx, m.holesPlayed); }, 0);
      }
      return { group: group, index: index, names: teamNames(event, group), value: value, complete: complete, played: played };
    });
    label = resolved === "scramble" ? "Team — scramble gross"
      : resolved === "best2" ? "Team — best 2 Stableford"
      : metric === "stableford" ? "Team — combined Stableford" : "Team — combined net";
    // Only teams that have posted a hole can be ranked — a team with no card must
    // never win (critical for scramble gross, where 0 would rank first). Finished
    // teams rank ahead of partial ones.
    var started = rawRows.filter(function (r) { return r.names && r.played > 0; });
    started.sort(function (a, b) {
      if (a.complete !== b.complete) return a.complete ? -1 : 1;
      return hb ? b.value - a.value : a.value - b.value;
    });
    var rows = [];
    started.forEach(function (r, i) {
      var place = i + 1, tie = false;
      if (i > 0) {
        var prev = started[i - 1];
        if (prev.complete === r.complete && prev.value === r.value) { place = rows[i - 1].place; tie = true; }
      }
      rows.push({ place: place, group: r.group, index: r.index, names: r.names, value: r.value, complete: r.complete, tie: tie });
    });
    return { format: resolved, label: label, higherBetter: hb, rows: rows };
  }

  // ---- two's club --------------------------------------------------------
  function twosClub(cards, course) {
    var par3 = {};
    course.holes.forEach(function (h) { if (h.par === 3) par3[h.number] = true; });
    var rows = [];
    cards.forEach(function (c) {
      var holes = Object.keys(c.grossByHole).map(Number)
        .filter(function (n) { return par3[n] && c.grossByHole[n] === 2; })
        .sort(function (a, b) { return a - b; });
      if (holes.length) rows.push({ player: c.player, holes: holes });
    });
    return rows;
  }

  // ---- side games --------------------------------------------------------
  function sideGames(event) {
    var contests = event.contests || [];
    return contests.map(function (c) {
      var info = CONTEST_CATALOG[c.type] || { label: c.type, unit: "", dir: "max" };
      var fundraiser = (info.dir == null);
      var winner = null;
      if (!fundraiser) {
        var results = event.contestResults && event.contestResults[c.id];
        var entries = results ? Object.entries(results) : [];
        if (entries.length) {
          var dir = info.dir || "max";
          var best = entries.reduce(function (b, x) {
            return dir === "min" ? (x[1] < b[1] ? x : b) : (x[1] > b[1] ? x : b);
          });
          var player = event.players.find(function (p) { return p.id === best[0]; });
          if (player) winner = { player: player, value: best[1] };
        }
      }
      return { contest: c, label: info.label, unit: info.unit, hole: c.hole, fundraiser: fundraiser, winner: winner };
    });
  }

  // ---- top-level ---------------------------------------------------------
  function computePrizes(event, course, opts) {
    opts = opts || {};
    var metric = event.format === "stableford" ? "stableford" : "net";
    var higherBetter = metric === "stableford";
    var holeCount = course.holes.length;
    var starts = countbackStarts(holeCount);

    var allCards = event.players.map(function (p) { return buildCard(event, course, p); });
    var cardsById = {};
    allCards.forEach(function (c) { cardsById[c.player.id] = c; });

    var played = allCards.filter(function (c) { return c.holesPlayed > 0; });
    var eligible = opts.onlyComplete ? played.filter(function (c) { return c.complete; }) : played;

    var overall = rankCards(eligible, metric, higherBetter, holeCount);

    var completePool = eligible.filter(function (c) { return c.complete; });
    var grossPool = completePool.length ? completePool : eligible;
    var bestGross = null;
    if (grossPool.length) {
      var gsorted = grossPool.slice().sort(function (a, b) {
        if (a.gross !== b.gross) return a.gross - b.gross;
        for (var i = 0; i < starts.length; i++) {
          var av = segmentSum(a.grossByHole, starts[i]), bv = segmentSum(b.grossByHole, starts[i]);
          if (av !== bv) return av - bv;
        }
        return 0;
      });
      bestGross = { player: gsorted[0].player, gross: gsorted[0].gross, complete: gsorted[0].complete };
    }

    var mode = event.format === "scramble" ? "none" : (opts.divisions || "none");
    var divisions = [];
    if (mode !== "none") {
      var groups = (mode === "bands" && opts.bands && opts.bands.length) ? splitBands(eligible, opts.bands) : splitThirds(eligible);
      divisions = groups.map(function (g) {
        return { label: g.label, range: g.range, winners: rankCards(g.cards, metric, higherBetter, holeCount).slice(0, 3) };
      });
    }

    var frontHoles = course.holes.filter(function (h) { return h.number <= 9; }).map(function (h) { return h.number; });
    var backHoles = course.holes.filter(function (h) { return h.number >= 10; }).map(function (h) { return h.number; });
    var front = bestNine(eligible, metric, higherBetter, frontHoles);
    var back = bestNine(eligible, metric, higherBetter, backHoles);

    var team = computeTeams(event, course, cardsById, metric, higherBetter, opts.teamFormat || "auto");
    var twos = twosClub(eligible, course);
    var games = sideGames(event);

    return {
      eventName: event.name, date: event.date, courseName: course.name,
      courseApprox: !!course.approx,
      format: event.format, holeCount: holeCount, metric: metric,
      metricLabel: metric === "stableford" ? "Stableford points" : "Net strokes",
      higherBetter: higherBetter,
      playedCount: played.length, eligibleCount: eligible.length,
      allComplete: eligible.length > 0 && eligible.every(function (c) { return c.complete; }),
      overall: overall, bestGross: bestGross, divisions: divisions,
      nines: { front: front, back: back }, team: team, twos: twos, sideGames: games,
    };
  }

  window.PrizesEngine = {
    CONTEST_CATALOG: CONTEST_CATALOG,
    COURSE_CARDS: COURSE_CARDS,
    cardFor: cardFor,
    handicapStrokesOnHole: handicapStrokesOnHole,
    buildCard: buildCard,
    countbackStarts: countbackStarts,
    rankCards: rankCards,
    computePrizes: computePrizes,
  };
})();
