import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Card, StatTile } from "./ui";
import { colors, spacing, radius } from "../theme";
import { useRound } from "../state/RoundContext";
import { signed } from "../lib/golfEngine";

// Post-round summary — the scorecard headline (gross vs par, net, Stableford)
// plus the eagle→triple score distribution as a little bar chart. Reads the
// live round from RoundContext, so it fills in as you score and renders nothing
// until at least one hole is in.
type Bucket = { key: string; label: string; color: string; count: number };

export default function RoundSummaryCard() {
  const { scores, pickups, selectedCourse, scoreTotals } = useRound();
  const t = scoreTotals;

  // Score distribution vs par (gross). A picked-up hole counts as a double.
  const dist = React.useMemo(() => {
    const b = { eagle: 0, birdie: 0, par: 0, bogey: 0, dbl: 0, other: 0 };
    for (const h of selectedCourse.holes) {
      const g = scores[h.number];
      const picked = pickups[h.number];
      if (!g && !picked) continue;
      const diff = picked ? 2 : (g as number) - h.par;
      if (diff <= -2) b.eagle += 1;
      else if (diff === -1) b.birdie += 1;
      else if (diff === 0) b.par += 1;
      else if (diff === 1) b.bogey += 1;
      else if (diff === 2) b.dbl += 1;
      else b.other += 1;
    }
    return b;
  }, [scores, pickups, selectedCourse]);

  if (t.holesPlayed === 0) return null;

  const buckets: Bucket[] = [
    { key: "eagle", label: "Eagle+", color: colors.gold, count: dist.eagle },
    { key: "birdie", label: "Birdie", color: colors.positive, count: dist.birdie },
    { key: "par", label: "Par", color: colors.textMuted, count: dist.par },
    { key: "bogey", label: "Bogey", color: colors.warning, count: dist.bogey },
    { key: "dbl", label: "Double", color: colors.negative, count: dist.dbl },
    { key: "other", label: "Triple+", color: "#8A3B3B", count: dist.other },
  ];
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));
  const toParLabel = t.toPar === 0 ? "E" : signed(t.toPar);

  return (
    <Card>
      <Text style={styles.title}>Round summary</Text>
      <Text style={styles.sub}>
        {t.holesPlayed} hole{t.holesPlayed === 1 ? "" : "s"} · {selectedCourse.name}
      </Text>

      <View style={styles.grid}>
        <StatTile label="Score" value={`${t.total}`} hint={`${toParLabel} to par`} tone="neutral" />
        <StatTile label="Net" value={`${t.net}`} tone="neutral" />
        <StatTile label="Stableford" value={`${t.points}`} tone="gold" />
      </View>

      <Text style={styles.distTitle}>Score breakdown</Text>
      <View style={styles.bars}>
        {buckets.map((b) => (
          <View key={b.key} style={styles.barCol}>
            <Text style={[styles.barCount, b.count === 0 && styles.barCountZero]}>{b.count}</Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { height: `${Math.max(4, (b.count / maxCount) * 100)}%`, backgroundColor: b.color, opacity: b.count ? 1 : 0.18 },
                ]}
              />
            </View>
            <Text style={styles.barLabel}>{b.label}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "700", color: colors.text },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  grid: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  distTitle: { fontSize: 13, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: spacing.sm },
  bars: { flexDirection: "row", gap: spacing.xs, alignItems: "flex-end" },
  barCol: { flex: 1, alignItems: "center" },
  barCount: { fontSize: 14, fontWeight: "800", color: colors.text, marginBottom: 4 },
  barCountZero: { color: colors.textFaint },
  barTrack: { width: "100%", height: 64, backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, justifyContent: "flex-end", overflow: "hidden" },
  barFill: { width: "100%", borderRadius: radius.sm },
  barLabel: { fontSize: 10, color: colors.textFaint, marginTop: 5, textAlign: "center" },
});
