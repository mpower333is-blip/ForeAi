import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Screen, Card, StatTile, Button } from "../components/ui";
import { colors, spacing, type } from "../theme";
import { useRound } from "../state/RoundContext";
import { signed } from "../lib/golfEngine";

export default function HomeScreen({ navigation }: any) {
  const { shots, totalStrokesGained, categorySG, course, currentHole } = useRound();
  const cats = categorySG();
  const best = [...cats].sort((a, b) => b.value - a.value)[0];
  const hole = course.find((h) => h.number === currentHole) ?? course[0];

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.brand}>ForeAi</Text>
        <Text style={styles.tag}>AI Golf Performance Platform</Text>
      </View>

      <View style={styles.grid}>
        <StatTile
          label="Round SG"
          value={shots.length ? signed(totalStrokesGained) : "—"}
          hint={shots.length ? `${shots.length} shots logged` : "No shots yet"}
          tone={totalStrokesGained < 0 ? "negative" : "accent"}
        />
        <StatTile label="Current Hole" value={`${hole.number}`} hint={`Par ${hole.par} • ${hole.yards} yds`} />
        <StatTile
          label="Strong Suit"
          value={best && best.value !== 0 ? best.label.split(" ")[0] : "—"}
          hint={best && best.value !== 0 ? signed(best.value) : "Play a hole"}
        />
      </View>

      <Text style={styles.sectionTitle}>Jump back in</Text>

      <Card accent>
        <Text style={styles.cardHeadline}>Live Round</Text>
        <Text style={styles.cardBody}>
          Track shots, get club calls and watch your strokes gained update in real time.
        </Text>
        <Button label="Go to Round" onPress={() => navigation.navigate("Play")} />
      </Card>

      <View style={styles.pairRow}>
        <Card style={styles.pairCard}>
          <Text style={styles.cardHeadline}>AI Caddie</Text>
          <Text style={styles.cardBody}>Club calls for any distance, wind and lie.</Text>
          <Button variant="ghost" label="Open" onPress={() => navigation.navigate("Caddie")} />
        </Card>
        <Card style={styles.pairCard}>
          <Text style={styles.cardHeadline}>Strategy</Text>
          <Text style={styles.cardBody}>Aggressive or safe? Plan every hole.</Text>
          <Button variant="ghost" label="Open" onPress={() => navigation.navigate("Strategy")} />
        </Card>
      </View>

      <Card>
        <Text style={styles.cardHeadline}>Strokes Gained</Text>
        {shots.length === 0 ? (
          <Text style={styles.cardBody}>
            Your strokes-gained breakdown appears here once you log shots in a round.
          </Text>
        ) : (
          cats.map((c) => (
            <View key={c.label} style={styles.sgLine}>
              <Text style={styles.sgLabel}>{c.label}</Text>
              <Text
                style={[
                  styles.sgVal,
                  { color: c.value >= 0 ? colors.positive : colors.negative },
                ]}
              >
                {signed(c.value)}
              </Text>
            </View>
          ))
        )}
        <Button variant="ghost" label="Full stats" onPress={() => navigation.navigate("Stats")} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: spacing.lg, marginBottom: spacing.lg },
  brand: { ...(type.brand as any), color: colors.accent },
  tag: { fontSize: 16, color: colors.textMuted, marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  sectionTitle: { ...(type.h2 as any), color: colors.text, marginBottom: spacing.sm },
  cardHeadline: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: 6 },
  cardBody: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: 4 },
  pairRow: { flexDirection: "row", gap: spacing.sm },
  pairCard: { flex: 1 },
  sgLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sgLabel: { color: colors.textMuted, fontSize: 15 },
  sgVal: { fontWeight: "700", fontSize: 15 },
});
