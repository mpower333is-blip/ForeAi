import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Screen, ScreenHeader, Card, StatTile, Button, EmptyState } from "../components/ui";
import { colors, spacing } from "../theme";
import TrendChart from "../components/TrendChart";
import { useProfile } from "../state/ProfileContext";
import { useRoundHistory, RoundRecord } from "../state/RoundHistoryContext";
import { signed } from "../lib/golfEngine";

// "My Golf" — the player's long-term dashboard: official handicap index, an
// estimated index + trend from the rounds logged in ForeAi, personal bests, a
// recent-rounds log, and (uniquely) strokes-gained. The official Handicap Index
// and differentials fill in from HNA when the club has sync switched on.

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso.slice(0, 10);
  }
}

export default function MyGolfScreen({ navigation }: any) {
  const { name, handicap, saId } = useProfile();
  const { records, estIndex, bestGross, bestStableford, bestSG } = useRoundHistory();

  // Chart series: prefer differentials (oldest→newest); fall back to score-to-par
  // so a trend shows even before any course had a CR/slope.
  const chrono = [...records].reverse();
  const diffSeries = chrono.map((r) => r.differential).filter((d): d is number => typeof d === "number");
  const parSeries = chrono.map((r) => r.toPar);
  const usingDiff = diffSeries.length >= 2;
  const series = usingDiff ? diffSeries : parSeries;

  const last20 = records.slice(0, 20);

  return (
    <Screen>
      <ScreenHeader title="My Golf" subtitle="Your handicap, trend and round history." onBack={() => navigation.goBack()} />

      {/* Identity + handicap */}
      <Card accent>
        <View style={styles.idRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeVal}>{handicap != null ? String(handicap) : "—"}</Text>
            <Text style={styles.badgeCap}>index</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{name || "ForeAi Golfer"}</Text>
            <Text style={styles.meta}>
              {saId ? `SA Player ID ${saId}` : "Add your SA Player ID in Profile for official sync"}
            </Text>
            <Text style={styles.metaFaint}>
              {estIndex != null ? `Estimated from your app rounds: ${estIndex}` : "Log 3+ rounds for an estimated index"}
            </Text>
          </View>
        </View>
      </Card>

      {records.length === 0 ? (
        <EmptyState
          emoji="⛳"
          title="No rounds saved yet"
          body="Finish a round and tap “Save round to My Golf” on the Strokes Gained screen. Your handicap trend, bests and history build from there."
          actionLabel="Go to Round"
          onAction={() => navigation.navigate("Play")}
        />
      ) : (
        <>
          {/* Trend */}
          <Card>
            <Text style={styles.sectionTitle}>Last {series.length} rounds</Text>
            <TrendChart
              data={series}
              label={usingDiff ? "Score differential (lower is better)" : "Score to par (lower is better)"}
              color={colors.accent}
              lowerIsBetter
            />
          </Card>

          {/* Personal bests */}
          <Text style={styles.groupTitle}>Personal bests</Text>
          <View style={styles.grid}>
            <StatTile label="Best gross (18)" value={bestGross ? String(bestGross.gross) : "—"} hint={bestGross ? bestGross.courseName : ""} tone="accent" />
            <StatTile label="Best Stableford" value={bestStableford ? String(bestStableford.stableford) : "—"} hint={bestStableford ? bestStableford.courseName : ""} tone="accent" />
            <StatTile
              label="Best SG"
              value={bestSG && bestSG.sgTotal != null ? signed(bestSG.sgTotal) : "—"}
              hint={bestSG ? bestSG.courseName : ""}
              tone="accent"
            />
          </View>

          {/* Recent rounds */}
          <Card>
            <Text style={styles.sectionTitle}>Recent rounds</Text>
            <View style={[styles.row, styles.rowHead]}>
              <Text style={[styles.cDate, styles.hCell]}>Date</Text>
              <Text style={[styles.cCourse, styles.hCell]}>Course</Text>
              <Text style={[styles.cNum, styles.hCell]}>Gross</Text>
              <Text style={[styles.cNum, styles.hCell]}>Diff</Text>
              <Text style={[styles.cNum, styles.hCell]}>Pts</Text>
            </View>
            {last20.map((r: RoundRecord) => (
              <View key={r.id} style={styles.row}>
                <Text style={[styles.cDate, styles.cell]}>{fmtDate(r.dateISO)}</Text>
                <Text style={[styles.cCourse, styles.cell]} numberOfLines={1}>{r.courseName}</Text>
                <Text style={[styles.cNum, styles.cell]}>{r.holesPlayed >= 18 ? r.gross : `${r.gross}*`}</Text>
                <Text style={[styles.cNum, styles.cell]}>{r.differential != null ? r.differential.toFixed(1) : "—"}</Text>
                <Text style={[styles.cNum, styles.cell]}>{r.stableford}</Text>
              </View>
            ))}
            <Text style={styles.foot}>* fewer than 18 holes. Differentials need the course’s rating/slope.</Text>
          </Card>

          <Button variant="ghost" label="Strokes-gained breakdown" onPress={() => navigation.navigate("Stats")} />
        </>
      )}

      {/* Official sync note */}
      <Card>
        <Text style={styles.noteTitle}>Official handicap</Text>
        <Text style={styles.note}>
          The index above is your own entry (or your app-round estimate). When your club has official
          Handicaps Network Africa sync switched on, your real Handicap Index and differentials update
          automatically. Add your SA Player ID in Profile to link up.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  idRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  badge: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: colors.accent,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.surface,
  },
  badgeVal: { color: colors.accent, fontSize: 22, fontWeight: "900" },
  badgeCap: { color: colors.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 },
  name: { color: colors.text, fontSize: 20, fontWeight: "800" },
  meta: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  metaFaint: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  groupTitle: { fontSize: 13, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6, marginTop: spacing.sm, marginBottom: spacing.sm },
  grid: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowHead: { borderBottomColor: colors.borderSoft },
  hCell: { color: colors.textFaint, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: "700" },
  cell: { color: colors.text, fontSize: 13 },
  cDate: { flex: 2.2 },
  cCourse: { flex: 3 },
  cNum: { flex: 1.1, textAlign: "right" },
  foot: { color: colors.textFaint, fontSize: 11, marginTop: 8 },
  noteTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 4 },
  note: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
});
