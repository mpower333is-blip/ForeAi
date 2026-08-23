import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Screen, Card, Button, Segmented, MetreStepper, KmhStepper, StatTile } from "../components/ui";
import { colors, spacing, type } from "../theme";
import { useRound } from "../state/RoundContext";
import { useLocation } from "../hooks/useLocation";
import HoleGps, { HoleMarks } from "../components/HoleGps";
import ScoreCaptureCard from "../components/ScoreCaptureCard";
import StatsEntry from "../components/StatsEntry";
import { useAutoShotTracker } from "../hooks/useAutoShotTracker";
import { TEES } from "../data/courses";
import { Coord, compass8 } from "../lib/geo";
import { ydToM, mphToKmh, fToC } from "../lib/units";
import { fetchWeather, windForShot } from "../services/weather";
import {
  recommendClub,
  Surface,
  Lie,
  signed,
} from "../lib/golfEngine";

const SURFACES: { key: Surface; label: string }[] = [
  { key: "tee", label: "Tee" },
  { key: "fairway", label: "Fairway" },
  { key: "rough", label: "Rough" },
  { key: "sand", label: "Sand" },
  { key: "green", label: "Green" },
];

export default function PlayScreen({ navigation }: any) {
  const {
    course,
    courseId,
    courseName,
    currentHole,
    setCurrentHole,
    effectiveBag,
    logShot,
    removeLastShot,
    shotsForHole,
    totalStrokesGained,
    scores,
    setHoleScore,
    scoreTotals,
    pickups,
    setPickup,
    courseHcp,
    holeStats,
    setHoleStat,
    bag,
    teeId,
    setTee,
  } = useRound();

  const hole = course.find((h) => h.number === currentHole) ?? course[0];

  const [distance, setDistance] = useState(hole.yards);
  const [surface, setSurface] = useState<Surface>("tee");
  const [wind, setWind] = useState(0);
  const [elevation, setElevation] = useState(0); // yards up(+)/down(-) to the target
  const [temp, setTemp] = useState(70); // °F, filled by live weather
  const [wxNote, setWxNote] = useState<string | null>(null);
  const [wxBusy, setWxBusy] = useState(false);
  const [result, setResult] = useState(140); // distance remaining after the shot

  // On-course GPS: tee/pin marks per hole feed the rangefinder.
  const loc = useLocation();
  const [teeMarks, setTeeMarks] = useState<Record<string, Coord>>({});
  const [pinMarks, setPinMarks] = useState<Record<string, Coord>>({});
  const gpsKey = `${courseId}-${currentHole}`;
  const marks: HoleMarks = { tee: teeMarks[gpsKey], pin: pinMarks[gpsKey] };
  const markTee = () => {
    if (loc.coord) setTeeMarks((m) => ({ ...m, [gpsKey]: loc.coord as Coord }));
  };
  const markPin = () => {
    if (loc.coord) setPinMarks((m) => ({ ...m, [gpsKey]: loc.coord as Coord }));
  };

  const holeShots = shotsForHole(currentHole);

  // When you switch tees, the hole length changes — reset the caddie's target
  // to the new tee's yardage for this hole.
  useEffect(() => {
    setDistance(hole.yards);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teeId]);

  // Hands-free automatic shot logging. When on, the phone (in your pocket) or a
  // paired watch detects each swing and GPS reconstructs the shot — no tapping.
  const [autoTrack, setAutoTrack] = useState(false);
  const auto = useAutoShotTracker({
    enabled: autoTrack,
    hole: currentHole,
    coord: loc.coord,
    greenCoord: hole.green,
    bag: effectiveBag,
    selectedClub: null, // inferred from carry; the watch will set this later
    onShot: (s) => logShot(s),
  });

  const rec = useMemo(
    () =>
      recommendClub(
        {
          yardage: distance,
          windSpeed: wind,
          elevation,
          temperature: temp,
          lie: surface === "green" ? "fairway" : (surface as Lie),
        },
        effectiveBag
      ),
    [distance, wind, elevation, temp, surface, effectiveBag]
  );

  // Live weather: fill temperature, and — because we're on the course — turn the
  // wind into a real head/tail component along the line to the pin when we have
  // a pin GPS mark. Without a pin mark we fall back to the raw wind speed.
  const useLiveWeather = async () => {
    if (wxBusy) return;
    const here = loc.coord;
    if (!here) {
      setWxNote("Turn on location to use live weather.");
      return;
    }
    setWxBusy(true);
    const w = await fetchWeather(here);
    setWxBusy(false);
    if (!w) {
      setWxNote("Couldn't reach the weather service — check your connection.");
      return;
    }
    setTemp(w.tempF);
    const pin = pinMarks[gpsKey];
    if (pin) {
      setWind(windForShot(w, here, pin));
      setWxNote(`${mphToKmh(w.windMph)} km/h from ${compass8(w.windFromDeg)} · ${fToC(w.tempF)}°C — head/tail set for this pin`);
    } else {
      setWind(w.windMph);
      setWxNote(`${mphToKmh(w.windMph)} km/h from ${compass8(w.windFromDeg)} · ${fToC(w.tempF)}°C — mark the pin for auto head/tail`);
    }
  };

  const lieForSurface = (s: Surface): Lie =>
    s === "green" ? "fairway" : (s as Lie);

  const onLogShot = (holed: boolean) => {
    logShot({
      hole: currentHole,
      club: rec.club,
      startYards: distance,
      startSurface: surface,
      endYards: holed ? 0 : result,
      endSurface: holed ? "green" : result <= 30 ? "green" : "fairway",
      lie: lieForSurface(surface),
      holed,
    });
    if (!holed) {
      // Set up the next shot from where this one finished.
      setDistance(result);
      setSurface(result <= 30 ? "green" : "fairway");
    }
  };

  const goHole = (delta: number) => {
    const next = Math.max(1, Math.min(course.length, currentHole + delta));
    setCurrentHole(next);
    const h = course.find((x) => x.number === next)!;
    setDistance(h.yards);
    setSurface("tee");
  };

  const parScore = hole.par;
  const holeScore = scores[currentHole] ?? 0;

  return (
    <Screen>
      <View style={styles.courseBar}>
        <Text style={styles.courseName} numberOfLines={1}>
          ⛳ {courseName}
        </Text>
        <View style={styles.courseActions}>
          <TouchableOpacity onPress={() => navigation.navigate("CoursePreview")}>
            <Text style={styles.courseChange}>Preview</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("CourseSelect")}>
            <Text style={styles.courseChange}>Change ›</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.teeRow}>
        <Text style={styles.teeLabel}>Tees</Text>
        <View style={styles.teeChips}>
          {TEES.map((t) => {
            const on = t.id === teeId;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => setTee(t.id)}
                style={[styles.teeChip, on && styles.teeChipOn]}
                activeOpacity={0.85}
              >
                <Text style={[styles.teeChipName, on && styles.teeChipNameOn]}>{t.name}</Text>
                <Text style={[styles.teeChipWho, on && styles.teeChipWhoOn]}>{t.who}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.headerRow}>
        <View>
          <Text style={styles.holeLabel}>Hole {hole.number}</Text>
          <Text style={styles.holeMeta}>
            Par {hole.par} • {ydToM(hole.yards)} m
          </Text>
        </View>
        <View style={styles.navBtns}>
          <Button variant="ghost" label="‹" onPress={() => goHole(-1)} style={styles.navBtn} />
          <Button variant="ghost" label="›" onPress={() => goHole(1)} style={styles.navBtn} />
        </View>
      </View>

      <HoleGps
        holeNumber={hole.number}
        holeYards={hole.yards}
        greenCoord={hole.green}
        greenFront={hole.greenFront}
        greenBack={hole.greenBack}
        loc={loc}
        marks={marks}
        onMarkTee={markTee}
        onMarkPin={markPin}
        onPlayFromHere={(yards) => {
          setDistance(yards);
          setSurface("fairway");
        }}
      />

      <Card>
        <View style={styles.autoRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.autoTitle}>🎯 Auto-track shots</Text>
            <Text style={styles.autoHint}>
              {autoTrack
                ? auto.micOk === false
                  ? "Microphone off — enable it so the app can hear the ball strike."
                  : !loc.coord
                  ? "Waiting for GPS… turn on location."
                  : auto.awaitingMove
                  ? "Strike heard — walk to your ball and hit again to log it."
                  : auto.listening
                  ? "Listening for the ball strike. Keep the phone in your pocket (or use your ForeAi watch)."
                  : "Starting the microphone…"
                : "Hands-free: the app listens for the ball strike (not practice swings) and uses GPS to log the shot and its club."}
            </Text>
          </View>
          <Button
            label={autoTrack ? "On" : "Off"}
            variant={autoTrack ? "primary" : "ghost"}
            onPress={() => setAutoTrack((v) => !v)}
          />
        </View>
        {autoTrack && (
          <Text style={styles.autoStat}>
            {auto.shotsThisHole} shot{auto.shotsThisHole === 1 ? "" : "s"} this hole
            {auto.lastCarryYards != null ? ` · last ${ydToM(auto.lastCarryYards)} m` : ""}
            {` · ${auto.swingsThisHole} swings`}
          </Text>
        )}
        <Button
          variant="ghost"
          label="⌚ Set up your watch"
          onPress={() => navigation.navigate("WatchSetup")}
        />
      </Card>

      {/* Strokes-gained shot tracking: AI Caddie recommendation + shot log. */}
      <Card accent>
        <Text style={styles.recTop}>AI Caddie says</Text>
        <View style={styles.recRow}>
          <Text style={styles.recClub}>{rec.club}</Text>
          <View style={styles.recRight}>
            <Text style={styles.recYards}>plays {ydToM(rec.playingYards)} m</Text>
            <Text style={[styles.recConf, confColor(rec.confidence)]}>
              {rec.confidence} confidence
            </Text>
          </View>
        </View>
        {rec.notes.map((n, i) => (
          <Text key={i} style={styles.recNote}>
            • {n}
          </Text>
        ))}
      </Card>

      <Card>
        <MetreStepper label="Distance to target" value={distance} onChange={setDistance} stepM={5} />
        <Segmented label="Lie" options={SURFACES} value={surface} onChange={setSurface} />
        <Button
          variant="ghost"
          label={wxBusy ? "Getting weather…" : "🌤 Use live weather"}
          onPress={useLiveWeather}
        />
        {wxNote && <Text style={styles.wxNote}>{wxNote}</Text>}
        <KmhStepper
          label="Wind (+ into / − down)"
          value={wind}
          onChange={setWind}
          stepKmh={3}
          min={-40}
          max={40}
        />
        <MetreStepper
          label="Elevation (+ up / − down)"
          value={elevation}
          onChange={setElevation}
          stepM={2}
          min={-40}
          max={40}
        />
        <MetreStepper
          label="Distance remaining after shot"
          value={result}
          onChange={setResult}
          stepM={5}
        />
        <View style={styles.logRow}>
          <Button label="Log Shot" onPress={() => onLogShot(false)} style={{ flex: 1 }} />
          <Button label="Holed" variant="ghost" onPress={() => onLogShot(true)} style={{ flex: 1 }} />
        </View>
      </Card>

      <View style={styles.grid}>
        <StatTile label="Shots this hole" value={`${holeShots.length}`} />
        <StatTile
          label="Round SG"
          value={signed(totalStrokesGained)}
          tone={totalStrokesGained < 0 ? "negative" : "accent"}
        />
      </View>

      {holeShots.length > 0 && (
        <Card>
          <View style={styles.shotHeader}>
            <Text style={styles.sectionTitle}>Hole {currentHole} shots</Text>
            <Button variant="ghost" label="Undo" onPress={removeLastShot} style={styles.undoBtn} />
          </View>
          {holeShots.map((s, i) => (
            <View key={s.id} style={styles.shotLine}>
              <Text style={styles.shotText}>
                {i + 1}. {s.club} · {ydToM(s.startYards)}→{s.holed ? "🏁" : `${ydToM(s.endYards)} m`}
              </Text>
              <Text style={[styles.shotSG, { color: s.strokesGained >= 0 ? colors.positive : colors.negative }]}>
                {signed(s.strokesGained)}
              </Text>
            </View>
          ))}
        </Card>
      )}

      <Text style={styles.sectionTitle}>Score — hole {currentHole}</Text>
      <ScoreCaptureCard
        hole={hole}
        courseHcp={courseHcp}
        gross={scores[currentHole]}
        pickup={!!pickups[currentHole]}
        onChange={(g) => setHoleScore(currentHole, g)}
        onPickup={(p) => setPickup(currentHole, p)}
        onClear={() => {
          setHoleScore(currentHole, 0);
          setPickup(currentHole, false);
        }}
        onTapMap={() => navigation.navigate("CoursePreview", { hole: currentHole })}
      />

      <StatsEntry
        par={hole.par}
        bag={bag}
        stats={holeStats[currentHole] ?? {}}
        onChange={(patch) => setHoleStat(currentHole, patch)}
      />

      <Card>
        <View style={styles.cardTitleRow}>
          <Text style={styles.sectionTitle}>Scorecard</Text>
          <Text style={styles.scoreTotal}>
            {scoreTotals.total || 0}{" "}
            <Text style={{ color: colors.textFaint }}>
              ({scoreTotals.holesPlayed ? scoreLabel(scoreTotals.toPar) : "—"})
            </Text>
          </Text>
        </View>
        <ScorecardGrid
          course={course}
          scores={scores}
          currentHole={currentHole}
          onTapHole={setCurrentHole}
        />
        <Text style={styles.scoreTotalsRow}>
          Out {scoreTotals.out || 0} • In {scoreTotals.in || 0} • Gross {scoreTotals.total || 0}
        </Text>
        <Text style={styles.scoreTotalsRow}>
          Net {scoreTotals.net || 0} • Stableford {scoreTotals.points || 0} pts • CH {courseHcp}
        </Text>
      </Card>
    </Screen>
  );
}

function scoreLabel(toPar: number): string {
  if (toPar === 0) return "par";
  return toPar > 0 ? `+${toPar}` : `${toPar}`;
}

function ScorecardGrid({
  course,
  scores,
  currentHole,
  onTapHole,
}: {
  course: { number: number; par: number; yards: number }[];
  scores: Record<number, number>;
  currentHole: number;
  onTapHole: (n: number) => void;
}) {
  const renderNine = (holes: typeof course) => (
    <View style={styles.gridScroll}>
      <View style={styles.gridRow}>
        {holes.map((h) => (
          <TouchableOpacity
            key={h.number}
            onPress={() => onTapHole(h.number)}
            style={[styles.cell, h.number === currentHole && styles.cellActive]}
          >
            <Text style={styles.cellHole}>{h.number}</Text>
            <Text style={styles.cellPar}>{h.par}</Text>
            <Text
              style={[
                styles.cellScore,
                !!scores[h.number] &&
                  scores[h.number] < h.par && { color: colors.positive },
                !!scores[h.number] &&
                  scores[h.number] > h.par && { color: colors.negative },
              ]}
            >
              {scores[h.number] ?? "·"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
  return (
    <View>
      {renderNine(course.slice(0, 9))}
      {renderNine(course.slice(9))}
    </View>
  );
}

function confColor(c: string) {
  return { color: c === "high" ? colors.positive : c === "medium" ? colors.warning : colors.negative };
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  holeLabel: { ...(type.h1 as any), color: colors.accent },
  holeMeta: { color: colors.textMuted, fontSize: 15, marginTop: 2 },
  navBtns: { flexDirection: "row", gap: 8 },
  navBtn: { width: 52, marginTop: 0 },

  recTop: { color: colors.textMuted, fontSize: 13, textTransform: "uppercase", letterSpacing: 1 },
  recRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 4 },
  recClub: { color: colors.accent, fontSize: 34, fontWeight: "800" },
  recRight: { alignItems: "flex-end" },
  recYards: { color: colors.text, fontSize: 15 },
  recConf: { fontSize: 13, fontWeight: "700", marginTop: 2 },
  recNote: { color: colors.textMuted, fontSize: 14, marginTop: 6, lineHeight: 20 },

  wxNote: { color: colors.accent, fontSize: 13, fontWeight: "600", marginTop: 8, marginBottom: 2 },
  autoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  autoTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  autoHint: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  autoStat: { color: colors.accent, fontSize: 13, fontWeight: "700", marginTop: spacing.sm },
  logRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  grid: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle: { ...(type.h2 as any), color: colors.text },
  shotHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  undoBtn: { marginTop: 0, paddingVertical: 8, paddingHorizontal: 14 },
  shotLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  shotText: { color: colors.text, fontSize: 15 },
  shotSG: { fontWeight: "700", fontSize: 15 },

  courseBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: spacing.sm,
  },
  courseName: { color: colors.text, fontSize: 15, fontWeight: "700", flexShrink: 1, marginRight: 8 },
  courseActions: { flexDirection: "row", gap: 16 },
  courseChange: { color: colors.accent, fontSize: 14, fontWeight: "600" },

  teeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  teeLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  teeChips: { flexDirection: "row", gap: 6, flex: 1 },
  teeChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  teeChipOn: { borderColor: colors.accent, backgroundColor: colors.surfaceAlt },
  teeChipName: { color: colors.textMuted, fontSize: 13, fontWeight: "800" },
  teeChipNameOn: { color: colors.accent },
  teeChipWho: { color: colors.textFaint, fontSize: 10 },
  teeChipWhoOn: { color: colors.text },

  cardTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  scoreTotal: { color: colors.text, fontSize: 18, fontWeight: "800" },

  scoreEntry: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  scoreBtn: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  scoreBtnText: { color: colors.accent, fontSize: 30, fontWeight: "700" },
  scoreMid: { alignItems: "center" },
  scoreBig: { color: colors.text, fontSize: 40, fontWeight: "800" },
  scoreVsPar: { color: colors.textMuted, fontSize: 14 },

  gridScroll: { marginBottom: 8 },
  gridRow: { flexDirection: "row", justifyContent: "space-between" },
  cell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    marginHorizontal: 1,
    borderRadius: 8,
    backgroundColor: colors.bg,
  },
  cellActive: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.accent },
  cellHole: { color: colors.textFaint, fontSize: 11 },
  cellPar: { color: colors.textMuted, fontSize: 11 },
  cellScore: { color: colors.text, fontSize: 16, fontWeight: "700", marginTop: 2 },
  scoreTotalsRow: { color: colors.textMuted, fontSize: 14, marginTop: 4, textAlign: "center" },
});
