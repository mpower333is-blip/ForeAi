import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Screen, ScreenHeader, Card, Segmented, Stepper } from "../components/ui";
import { colors, spacing, radius } from "../theme";
import { useRound } from "../state/RoundContext";
import {
  recommendClub,
  Lie,
  isLearned,
  dispersionWindow,
  DEFAULT_BAG,
} from "../lib/golfEngine";

const LIES: { key: Lie; label: string }[] = [
  { key: "tee", label: "Tee" },
  { key: "fairway", label: "Fairway" },
  { key: "rough", label: "Rough" },
  { key: "sand", label: "Sand" },
  { key: "recovery", label: "Trees" },
];

export default function CaddieScreen() {
  const { effectiveBag, learned } = useRound();
  const [yardage, setYardage] = useState(155);
  const [wind, setWind] = useState(0);
  const [elevation, setElevation] = useState(0);
  const [lie, setLie] = useState<Lie>("fairway");
  const [temp, setTemp] = useState(70);

  const rec = useMemo(
    () =>
      recommendClub(
        { yardage, windSpeed: wind, elevation, lie, temperature: temp },
        effectiveBag
      ),
    [yardage, wind, elevation, lie, temp, effectiveBag]
  );

  const learnedClub = isLearned(rec.club, learned);
  const window = dispersionWindow(rec.club, learned);

  const confTone =
    rec.confidence === "high" ? colors.positive : rec.confidence === "medium" ? colors.warning : colors.negative;

  // Show learned clubs sorted by carry, with default-bag clubs filling the gaps.
  const smartRows = useMemo(() => {
    return DEFAULT_BAG.map((c) => {
      const l = learned[c.name];
      const trusted = l && l.samples >= 3;
      return {
        name: c.name,
        carry: trusted ? l.carry : c.carry,
        dispersion: trusted ? l.dispersion : null,
        samples: trusted ? l.samples : 0,
      };
    }).sort((a, b) => b.carry - a.carry);
  }, [learned]);

  const anyLearned = smartRows.some((r) => r.samples > 0);

  return (
    <Screen>
      <ScreenHeader title="AI Caddie" subtitle="Data-driven club calls that learn from every shot you log." />

      <Card accent>
        <Text style={styles.club}>{rec.club}</Text>
        <Text style={styles.plays}>plays {rec.playingYards} yds</Text>

        <View style={styles.badgeRow}>
          <View style={[styles.confPill, { borderColor: confTone }]}>
            <Text style={[styles.confText, { color: confTone }]}>{rec.confidence} confidence</Text>
          </View>
          <View style={[styles.confPill, { borderColor: learnedClub ? colors.accent : colors.border }]}>
            <Text style={[styles.confText, { color: learnedClub ? colors.accent : colors.textFaint }]}>
              {learnedClub ? "your data" : "default bag"}
            </Text>
          </View>
        </View>

        <View style={styles.window}>
          <Text style={styles.windowText}>
            🎯 Expect to finish within{" "}
            <Text style={{ color: colors.accent, fontWeight: "800" }}>±{window} yds</Text> of target
          </Text>
        </View>

        <View style={styles.notes}>
          {rec.notes.map((n, i) => (
            <Text key={i} style={styles.note}>
              • {n}
            </Text>
          ))}
        </View>
      </Card>

      <Card>
        <Stepper label="Distance to pin" value={yardage} onChange={setYardage} step={5} min={20} max={320} unit="yds" />
        <Stepper label="Wind (+ into / − down)" value={wind} onChange={setWind} step={2} min={-40} max={40} unit="mph" />
        <Stepper
          label="Elevation (+ up / − down)"
          value={elevation}
          onChange={setElevation}
          step={2}
          min={-40}
          max={40}
          unit="yds"
        />
        <Stepper label="Temperature" value={temp} onChange={setTemp} step={5} min={20} max={110} unit="°F" />
        <Segmented label="Lie" options={LIES} value={lie} onChange={setLie} />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Smart distances</Text>
        <Text style={styles.hint}>
          {anyLearned
            ? "Learned from your logged shots — dispersion shows your consistency."
            : "Log shots in a round and your real carry distances appear here automatically."}
        </Text>
        {smartRows.map((r) => (
          <View key={r.name} style={styles.distRow}>
            <Text style={styles.distName}>{r.name}</Text>
            <View style={styles.distRight}>
              {r.samples > 0 && (
                <Text style={styles.distDisp}>±{r.dispersion}</Text>
              )}
              <Text style={[styles.distCarry, r.samples > 0 && { color: colors.accent }]}>
                {r.carry} yds
              </Text>
              <Text style={styles.distTag}>{r.samples > 0 ? `${r.samples} shots` : "default"}</Text>
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  club: { color: colors.accent, fontSize: 52, fontWeight: "800" },
  plays: { color: colors.text, fontSize: 18, marginTop: 2 },
  badgeRow: { flexDirection: "row", gap: 8, marginTop: spacing.sm },
  confPill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  confText: { fontWeight: "700", fontSize: 13 },
  window: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  windowText: { color: colors.textMuted, fontSize: 15 },
  notes: { marginTop: spacing.md },
  note: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },

  sectionTitle: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: 4 },
  hint: { color: colors.textFaint, fontSize: 13, marginBottom: spacing.sm },
  distRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  distName: { color: colors.text, fontSize: 16, fontWeight: "600" },
  distRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  distDisp: { color: colors.textFaint, fontSize: 13 },
  distCarry: { color: colors.textMuted, fontSize: 16, fontWeight: "700", minWidth: 64, textAlign: "right" },
  distTag: { color: colors.textFaint, fontSize: 11, minWidth: 52, textAlign: "right" },
});
