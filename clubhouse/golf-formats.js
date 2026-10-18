// Golf-format catalog for the clubhouse web pages (organiser setup, board).
// Mirror of mobile/src/lib/golfFormats.ts — keep the two in sync (same keys,
// same text). `engine` is the built-in live-scoring engine a format maps to
// ("stableford" | "stroke" | "scramble"), or null when the winner is decided
// off-app (match play, skins, flag, eclectic).
(function () {
  var FORMATS = [
    { key: "stroke", name: "Stroke Play", aliases: ["Medal", "Strokeplay"], team: false, playersPerSide: "1", needsHoleScores: true, engine: "stroke",
      howPlayed: "Each player plays their own ball on every hole and holes out, counting every stroke. You play all 18 holes and add up your total. There is no conceding of holes or putts — everything must be holed.",
      howScored: "Add every stroke for the round to get your gross score, then subtract your handicap for a net score. Lowest net total wins (lowest gross wins the scratch prize). Ties are broken by countback on the last 9, 6, 3 and final hole.",
      handicapAllowance: "95% (WHS; 100% for fields under 30)",
      fastFact: "Punishing — a single blow-up hole can wreck an otherwise good card, unlike Stableford where the damage is capped." },
    { key: "stableford", name: "Stableford", aliases: ["Points", "Nett Stableford"], team: false, playersPerSide: "1", needsHoleScores: true, engine: "stableford",
      howPlayed: "Play your own ball as in stroke play, but you earn points on each hole instead of counting raw strokes. Your handicap gives you extra shots on the hardest holes (by stroke index). Once you can't score on a hole you pick up and move on, which keeps play fast.",
      howScored: "Points per hole against your net score: double bogey or worse = 0, bogey = 1, par = 2, birdie = 3, eagle = 4 (all net). Add all 18 holes — highest total wins. A good round for a mid-handicapper is around 36 points.",
      handicapAllowance: "95%",
      fastFact: "The most popular club format — one disaster hole only costs you a single hole's points, not your whole card." },
    { key: "modified-stableford", name: "Modified Stableford", aliases: ["Modified Points", "Stableford Plus"], team: false, playersPerSide: "1", needsHoleScores: true, engine: null,
      howPlayed: "Played exactly like Stableford — your own ball, points per hole — but the points table is skewed to reward low scoring and penalise high scores. Par is worth zero, so you only gain ground with birdies and eagles.",
      howScored: "A common table is eagle +5, birdie +2, par 0, bogey -1, double bogey or worse -3. Scores can go negative. Highest total wins. A cautious round of all pars scores zero.",
      handicapAllowance: "95% (as Stableford) when played net; often played gross",
      fastFact: "Used on the PGA Tour's Barracuda Championship — great for a fun society day as it rewards risk-takers." },
    { key: "par-bogey", name: "Par / Bogey", aliases: ["Par Competition", "Bogey Competition"], team: false, playersPerSide: "1", needsHoleScores: true, engine: null,
      howPlayed: "You play a match against the course itself. On each hole, compare your net score to par: beat or match it and you 'win' the hole, take more and you 'lose' it. As in Stableford, once you can't halve a hole you pick up and move on.",
      howScored: "Each hole is win (+1), halve (0) or loss (-1) against net par, added up to a single figure like '+3' or '-2'. Best (highest) result wins. 'Bogey' is the older variant against a fixed bogey score rather than modern par.",
      handicapAllowance: "95%",
      fastFact: "A traditional format that feels like match play but lets a whole field compete at once against the same opponent — the course." },
    { key: "scramble", name: "Scramble", aliases: ["Texas Scramble", "Ambrose", "Florida Scramble"], team: true, playersPerSide: "2-4", needsHoleScores: true, engine: "scramble",
      howPlayed: "Everyone in the team tees off, then the team picks the single best shot and all players play their next shot from that spot (within a club-length, no nearer the hole). Keep choosing the best ball and all playing from it until it's holed, then repeat. 'Texas Scramble' requires a minimum number of each player's drives to be used over the round.",
      howScored: "The team records one gross score per hole (the strokes to hole the chosen ball), adds them up, then applies the team handicap allowance for a net total. Lowest net wins. 'Ambrose' is the Australian name for the same idea.",
      handicapAllowance: "4 players 25/20/15/10% · 3 players 30/20/10% · 2 players 35/15% of each Course Handicap",
      fastFact: "The go-to charity and corporate-day format — fast, sociable and forgiving. 'Shotgun' is the start type, not the scoring." },
    { key: "champagne-scramble", name: "Champagne Scramble", aliases: ["Shamble", "Las Vegas Scramble", "Bramble"], team: true, playersPerSide: "2-4", needsHoleScores: true, engine: null,
      howPlayed: "A hybrid of scramble and fourball. Everyone tees off and the team takes the best drive, but from there each player plays their OWN ball all the way to the hole. You get the safety of the best tee shot plus individual approach play and putting.",
      howScored: "Having played their own ball in, the team counts the best one (or best two) net scores on each hole and totals them. Lowest net wins. Definitions vary between clubs, so always read the day's rules sheet.",
      handicapAllowance: "Commonly a fourball/best-ball allowance (around 85%) for the own-ball element",
      fastFact: "A good middle ground — more individual skill than a scramble, but a bad drive still can't hurt you." },
    { key: "fourball-betterball", name: "Fourball Betterball", aliases: ["Four-Ball", "Better Ball", "Best Ball"], team: true, playersPerSide: "2", needsHoleScores: true, engine: null,
      howPlayed: "Two players partner up and each plays their own ball throughout the hole, just as in normal play. On every hole the pair uses only the better of their two scores. Your partner is a safety net — if one of you blows up, the other's score carries the hole.",
      howScored: "On each hole take the better net score (or Stableford points) of the two partners as the team's score, and total all 18 — lowest net, or highest points, wins. Played as Stableford it's the commonest club pairs format.",
      handicapAllowance: "85% of each player's Course Handicap (90% for four-ball match play)",
      fastFact: "'Fourball' means four balls in play (two per side) — don't confuse it with a foursome, where a pair shares one ball." },
    { key: "best-2-stableford", name: "Best 2 of 4 Stableford", aliases: ["Team Stableford", "Best 2 to Count"], team: true, playersPerSide: "4", needsHoleScores: true, engine: null,
      howPlayed: "A team of four all play their own ball on every hole, each keeping an individual Stableford score. On each hole, only the best two of the four scores count towards the team. The other two are discarded for that hole, so a couple of players can have a shaky hole without hurting the team.",
      howScored: "Add the two best net Stableford points on each hole for the team's hole score, then total all 18 — highest wins. Organisers vary how many count (best 1, 2 or 3); best-2-to-count is the society-day standard.",
      handicapAllowance: "85% of each player's Course Handicap",
      fastFact: "Ideal for mixed-ability fours — everyone contributes but no single weak player sinks the team." },
    { key: "foursomes", name: "Foursomes", aliases: ["Alternate Shot", "Scotch Foursomes"], team: true, playersPerSide: "2", needsHoleScores: true, engine: null,
      howPlayed: "Two partners share a single ball and alternate shots — one plays the tee shot, the partner the second, and so on until holed. They also alternate who drives: one tees off on odd holes, the other on even holes. Only one ball per side is ever in play.",
      howScored: "Count the strokes the pair took to hole their shared ball on each hole, total all 18 and apply the combined allowance for a net score. Lowest net wins. In match play, holes are won, lost or halved.",
      handicapAllowance: "50% of the pair's combined Course Handicaps",
      fastFact: "A true test of partnership — you play from wherever your partner leaves it. Used in the Ryder Cup." },
    { key: "greensomes", name: "Greensomes", aliases: ["Scotch Greensomes", "Modified Foursomes"], team: true, playersPerSide: "2", needsHoleScores: true, engine: null,
      howPlayed: "Both partners tee off on every hole, then the pair chooses which of the two drives to continue with. From that point they play alternate shots with the single chosen ball until holed. It softens strict foursomes because you keep the better of two tee shots.",
      howScored: "Record the strokes to hole the chosen ball on each hole, total the round and apply the combined allowance for a net score; lowest net wins. The player whose drive was not used plays the second shot.",
      handicapAllowance: "60% of the lower handicap + 40% of the higher handicap",
      fastFact: "More forgiving and faster than foursomes — a popular choice for mixed and member-guest days." },
    { key: "chapman-pinehurst", name: "Chapman / Pinehurst", aliases: ["Pinehurst", "American Foursomes"], team: true, playersPerSide: "2", needsHoleScores: true, engine: null,
      howPlayed: "Both partners drive, then swap balls and each plays the partner's ball for the second shot. After those two shots the pair picks the better-positioned ball and plays alternate shots with it until holed. It blends fourball early with foursomes to finish.",
      howScored: "Count the strokes to hole the chosen ball from the third shot onward, total the round and apply the combined allowance for a net score; lowest net wins. Whoever's ball was chosen plays the fourth shot, then alternate.",
      handicapAllowance: "60% of the lower handicap + 40% of the higher handicap",
      fastFact: "A clever leveller — the swap means a weak second shot is less likely to be the ball you keep." },
    { key: "fourball-match", name: "Four-Ball Match Play", aliases: ["Fourball Match", "Better Ball Match"], team: true, playersPerSide: "2", needsHoleScores: false, engine: null,
      howPlayed: "Two pairs play head-to-head, every player using their own ball. On each hole, each side's better ball is compared and the lower net score wins the hole for that side. Shots are taken off the lowest-handicapped player in the match.",
      howScored: "Score by holes, not strokes: a side goes '1 up', '2 up' as it wins holes; the match ends when a side is more holes up than there are left (e.g. '3&2'). The organiser records the margin — there's no net total to rank.",
      handicapAllowance: "90% of each player's Course Handicap, off the lowest player",
      fastFact: "Match play — the result is holes-up, not a stroke total, so the organiser records the margin." },
    { key: "singles-match", name: "Singles Match Play", aliases: ["Match Play", "Head-to-Head"], team: false, playersPerSide: "1", needsHoleScores: false, engine: null,
      howPlayed: "Two players compete directly, each playing their own ball, and the hole goes to whoever has the lower net score. The higher-handicapped player gets the difference in handicaps as extra shots on the hardest holes. Putts and holes can be conceded.",
      howScored: "Score by holes won, not total strokes: you track who is 'up' and by how much. The match is won when a player leads by more holes than remain (e.g. '4&3' = 4 up with 3 to play). 'All square' means level.",
      handicapAllowance: "100% of the difference between the two Course Handicaps (lower plays off scratch)",
      fastFact: "The format of knockouts and club championships — a run of bad holes costs you at most those holes." },
    { key: "skins", name: "Skins", aliases: ["Skins Game", "Carryovers"], team: false, playersPerSide: "1", needsHoleScores: true, engine: null,
      howPlayed: "Each hole is worth a prize — a 'skin'. Players compete hole by hole and the single best score on a hole wins that skin outright. If two or more tie for best, nobody wins it and the skin 'carries over', adding to the value of the next hole.",
      howScored: "You need a score on every hole to decide each skin; gross or net. The winner collects the most skins (or the most money) over the round. Carryovers make later holes increasingly valuable.",
      handicapAllowance: "Organiser's choice — commonly gross, or off full net handicap",
      fastFact: "Best in small groups — you must win a hole outright, so a single tied hole makes the pot grow." },
    { key: "eclectic", name: "Eclectic", aliases: ["Ringer", "Ringer Board"], team: false, playersPerSide: "1", needsHoleScores: true, engine: null,
      howPlayed: "Played over two or more rounds on the same course. You keep your score on every hole from each round, then build one composite card by taking your best-ever score on each individual hole across all the rounds — assembling your dream round hole by hole.",
      howScored: "For each hole take your lowest recorded score across the rounds, then total those 18 best holes; lowest eclectic total wins. Can run gross or net, often as a season-long competition.",
      handicapAllowance: "Organiser's choice — often a reduced allowance because you cherry-pick your best holes",
      fastFact: "A great season-long sweep — one lucky birdie stays on your card for the whole competition." },
    { key: "flag", name: "Flag Competition", aliases: ["Tombstone", "Flag Day"], team: false, playersPerSide: "1", needsHoleScores: true, engine: null,
      howPlayed: "Every player gets a fixed number of shots for the day equal to par plus their full handicap (par 72 + 18 handicap = 90 shots). You play until you've used up your allotted shots, then plant a small flag with your name where your final stroke comes to rest.",
      howScored: "No stroke total to add up — the winner is whoever's flag is furthest round the course. Strong players may use up their shots after the 18th and start again down the 1st.",
      handicapAllowance: "Full (100%) — your whole handicap is added to par",
      fastFact: "A novelty-day favourite — finishing position is literally marked on the course." }
  ];

  var BY_KEY = {};
  FORMATS.forEach(function (f) { BY_KEY[f.key] = f; });

  window.GOLF_FORMATS = FORMATS;
  window.GolfFormats = {
    all: FORMATS,
    get: function (key) { return key ? BY_KEY[key] : undefined; },
    individual: FORMATS.filter(function (f) { return !f.team; }),
    team: FORMATS.filter(function (f) { return f.team; }),
    // The format to explain for an event: its chosen gameKey, else the catalog
    // entry matching its scoring engine, else stroke.
    forEvent: function (evt) {
      evt = evt || {};
      return BY_KEY[evt.gameKey] || BY_KEY[evt.format] || BY_KEY.stroke;
    },
  };
})();
