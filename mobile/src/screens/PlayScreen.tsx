import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Screen, Card, Button, Segmented, Stepper, StatTile } from "../components/ui";
import { colors, spacing, type } from "../theme";
import { useRound } from "../state/RoundContext";
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

export default function PlayScreen() {
  const {
    course,
    currentHole,
    setCurrentHole,
    bag,
    logShot,
    removeLastShot,
    shotsForHole,
    totalStrokesGained,
  } = useRound();

  const hole = course.find((h) => h.number === currentHole) ?? course[0];

  const [distance, setDistance] = useState(hole.yards);
  const [surface, setSurface] = useState<Surface>("tee");
  const [wind, setWind] = useState(0);
  const [result, setResult] = useState(140); // distance remaining after the shot

  const holeShots = shotsForHole(currentHole);

  const rec = useMemo(
    () =>
      recommendClub(
        {
          yardage: distance,
          windSpeed: wind,
          lie: surface === "green" ? "fairway" : (surface as Lie),
        },
        bag
      ),
    [distance, wind, surface, bag]
  );

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

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.holeLabel}>Hole {hole.number}</Text>
          <Text style={styles.holeMeta}>
            Par {hole.par} • {hole.yards} yds
          </Text>
        </View>
        <View style={styles.navBtns}>
          <Button variant="ghost" label="‹" onPress={() => goHole(-1)} style={styles.navBtn} />
          <Button variant="ghost" label="›" onPress={() => goHole(1)} style={styles.navBtn} />
        </View>
      </View>

      <Card accent>
        <Text style={styles.recTop}>AI Caddie says</Text>
        <View style={styles.recRow}>
          <Text style={styles.recClub}>{rec.club}</Text>
          <View style={styles.recRight}>
            <Text style={styles.recYards}>plays {rec.playingYards} yds</Text>
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
        <Stepper label="Distance to target" value={distance} onChange={setDistance} step={5} unit="yds" />
        <Segmented label="Lie" options={SURFACES} value={surface} onChange={setSurface} />
        <Stepper
          label="Wind (+ into / − down)"
          value={wind}
          onChange={setWind}
          step={2}
          min={-40}
          max={40}
          unit="mph"
        />
        <Stepper
          label="Distance remaining after shot"
          value={result}
          onChange={setResult}
          step={5}
          unit="yds"
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
                {i + 1}. {s.club} · {s.startYards}→{s.holed ? "🏁" : `${s.endYards} yds`}
              </Text>
              <Text style={[styles.shotSG, { color: s.strokesGained >= 0 ? colors.positive : colors.negative }]}>
                {signed(s.strokesGained)}
              </Text>
            </View>
          ))}
        </Card>
      )}
    </Screen>
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
});
