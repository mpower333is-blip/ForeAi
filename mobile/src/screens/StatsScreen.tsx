import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Screen, ScreenHeader, Card, StatTile, SGBar, Button, EmptyState } from "../components/ui";
import { colors, spacing } from "../theme";
import { useRound } from "../state/RoundContext";
import { signed } from "../lib/golfEngine";

export default function StatsScreen({ navigation }: any) {
  const { shots, totalStrokesGained, categorySG, resetRound, holeStats } = useRound();
  const cats = categorySG();
  const maxAbs = Math.max(0.5, ...cats.map((c) => Math.abs(c.value)));

  const rs = React.useMemo(() => {
    const s = Object.values(holeStats);
    const fwAtt = s.filter((h) => h.fairway).length;
    const fwHit = s.filter((h) => h.fairway === "hit").length;
    const girSet = s.filter((h) => typeof h.gir === "boolean");
    const girHit = girSet.filter((h) => h.gir).length;
    const puttHoles = s.filter((h) => typeof h.putts === "number");
    const totalPutts = puttHoles.reduce((a, h) => a + (h.putts || 0), 0);
    const udChances = s.filter((h) => h.gir === false && typeof h.upDown === "boolean");
    const udMade = udChances.filter((h) => h.upDown).length;
    const penalties = s.reduce((a, h) => a + (h.penalties || 0), 0);
    return {
      count: s.length,
      fwAtt,
      fwHit,
      fwPct: fwAtt ? Math.round((fwHit / fwAtt) * 100) : null,
      girHoles: girSet.length,
      girHit,
      girPct: girSet.length ? Math.round((girHit / girSet.length) * 100) : null,
      puttHoles: puttHoles.length,
      totalPutts,
      avgPutts: puttHoles.length ? (totalPutts / puttHoles.length).toFixed(1) : null,
      udMade,
      udChances: udChances.length,
      penalties,
    };
  }, [holeStats]);

  const best = shots.length
    ? [...shots].sort((a, b) => b.strokesGained - a.strokesGained)[0]
    : null;
  const worst = shots.length
    ? [...shots].sort((a, b) => a.strokesGained - b.strokesGained)[0]
    : null;

  return (
    <Screen>
      <ScreenHeader title="Strokes Gained" subtitle="How your round breaks down by part of the game." />

      {rs.count > 0 && (
        <Card>
          <Text style={styles.roundStatsTitle}>Round stats</Text>
          <View style={styles.grid}>
            <StatTile
              label="Fairways"
              value={rs.fwPct != null ? `${rs.fwPct}%` : "—"}
              hint={`${rs.fwHit}/${rs.fwAtt}`}
              tone="neutral"
            />
            <StatTile
              label="GIR"
              value={rs.girPct != null ? `${rs.girPct}%` : "—"}
              hint={`${rs.girHit}/${rs.girHoles}`}
              tone="neutral"
            />
            <StatTile label="Putts/hole" value={rs.avgPutts ?? "—"} hint={`${rs.totalPutts} total`} tone="neutral" />
          </View>
          <View style={styles.grid}>
            <StatTile
              label="Up & down"
              value={rs.udChances ? `${rs.udMade}/${rs.udChances}` : "—"}
              tone="neutral"
            />
            <StatTile label="Penalties" value={`${rs.penalties}`} tone={rs.penalties ? "negative" : "neutral"} />
          </View>
        </Card>
      )}

      {shots.length === 0 && rs.count === 0 ? (
        <EmptyState
          emoji="📊"
          title="No stats yet"
          body="Log a few shots in a round and your strokes-gained dashboard builds itself as you play."
          actionLabel="Go to Round"
          onAction={() => navigation.navigate("Play")}
        />
      ) : shots.length > 0 ? (
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
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.textMuted, fontSize: 16, lineHeight: 24 },
  grid: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
  roundStatsTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
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
