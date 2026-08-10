import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Screen, ScreenHeader, Card, StatTile, SGBar, Button } from "../components/ui";
import { colors, spacing } from "../theme";
import { useRound } from "../state/RoundContext";
import { signed } from "../lib/golfEngine";

export default function StatsScreen() {
  const { shots, totalStrokesGained, categorySG, resetRound } = useRound();
  const cats = categorySG();
  const maxAbs = Math.max(0.5, ...cats.map((c) => Math.abs(c.value)));

  const best = shots.length
    ? [...shots].sort((a, b) => b.strokesGained - a.strokesGained)[0]
    : null;
  const worst = shots.length
    ? [...shots].sort((a, b) => a.strokesGained - b.strokesGained)[0]
    : null;

  return (
    <Screen>
      <ScreenHeader title="Strokes Gained" subtitle="How your round breaks down by part of the game." />

      {shots.length === 0 ? (
        <Card>
          <Text style={styles.empty}>
            No shots logged yet. Head to the Round tab and log a few shots — your strokes-gained
            dashboard builds itself as you play.
          </Text>
        </Card>
      ) : (
        <>
          <View style={styles.grid}>
            <StatTile
              label="Total SG"
              value={signed(totalStrokesGained)}
              tone={totalStrokesGained < 0 ? "negative" : "accent"}
            />
            <StatTile label="Shots" value={`${shots.length}`} tone="neutral" />
            <StatTile
              label="SG / shot"
              value={signed(totalStrokesGained / shots.length)}
              tone={totalStrokesGained < 0 ? "negative" : "accent"}
            />
          </View>

          <Card>
            <Text style={styles.sectionTitle}>By category</Text>
            {cats.map((c) => (
              <SGBar key={c.label} label={c.label} value={c.value} max={maxAbs} />
            ))}
          </Card>

          {best && (
            <Card>
              <Text style={styles.sectionTitle}>Round highlights</Text>
              <View style={styles.hlLine}>
                <Text style={styles.hlLabel}>Best shot</Text>
                <Text style={styles.hlText}>
                  Hole {best.hole} · {best.club}{" "}
                  <Text style={{ color: colors.positive }}>{signed(best.strokesGained)}</Text>
                </Text>
              </View>
              {worst && worst.id !== best.id && (
                <View style={styles.hlLine}>
                  <Text style={styles.hlLabel}>Costliest</Text>
                  <Text style={styles.hlText}>
                    Hole {worst.hole} · {worst.club}{" "}
                    <Text style={{ color: colors.negative }}>{signed(worst.strokesGained)}</Text>
                  </Text>
                </View>
              )}
            </Card>
          )}

          <Button variant="ghost" label="Reset round" onPress={resetRound} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.textMuted, fontSize: 16, lineHeight: 24 },
  grid: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
  hlLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  hlLabel: { color: colors.textMuted, fontSize: 15 },
  hlText: { color: colors.text, fontSize: 15, fontWeight: "600" },
});
