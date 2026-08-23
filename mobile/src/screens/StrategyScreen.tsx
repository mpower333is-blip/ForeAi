import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Screen, ScreenHeader, Card, Segmented, MetreStepper } from "../components/ui";
import { colors, spacing } from "../theme";
import { courseStrategy, StrategyInput } from "../lib/golfEngine";

const HAZARDS: { key: NonNullable<StrategyInput["hazard"]>; label: string }[] = [
  { key: "none", label: "None" },
  { key: "water-left", label: "Water L" },
  { key: "water-right", label: "Water R" },
  { key: "bunker-front", label: "Bunker F" },
  { key: "ob-left", label: "OB L" },
  { key: "ob-right", label: "OB R" },
];

const PINS: { key: NonNullable<StrategyInput["pin"]>; label: string }[] = [
  { key: "front", label: "Front" },
  { key: "middle", label: "Middle" },
  { key: "back-left", label: "Back L" },
  { key: "back-right", label: "Back R" },
  { key: "tucked", label: "Tucked" },
];

const MISSES: { key: NonNullable<StrategyInput["miss"]>; label: string }[] = [
  { key: "none", label: "Straight" },
  { key: "left", label: "Left" },
  { key: "right", label: "Right" },
];

export default function StrategyScreen({ navigation }: any) {
  const [parYards, setParYards] = useState(410);
  const [hazard, setHazard] = useState<NonNullable<StrategyInput["hazard"]>>("water-right");
  const [pin, setPin] = useState<NonNullable<StrategyInput["pin"]>>("back-right");
  const [miss, setMiss] = useState<NonNullable<StrategyInput["miss"]>>("right");

  const plan = useMemo(
    () => courseStrategy({ parYards, hazard, pin, miss }),
    [parYards, hazard, pin, miss]
  );

  const tone =
    plan.aggression === "aggressive"
      ? colors.positive
      : plan.aggression === "conservative"
      ? colors.warning
      : colors.text;

  return (
    <Screen>
      <ScreenHeader title="Course Strategy" subtitle="Plan the smart play for the hole in front of you." onBack={() => navigation.goBack()} />

      <Card accent>
        <View style={[styles.aggPill, { borderColor: tone }]}>
          <Text style={[styles.aggText, { color: tone }]}>{plan.aggression}</Text>
        </View>
        <Text style={styles.headline}>{plan.headline}</Text>
        <Text style={styles.target}>🎯 {plan.target}</Text>
        <Text style={styles.reason}>{plan.reasoning}</Text>
      </Card>

      <Card>
        <MetreStepper label="Hole length" value={parYards} onChange={setParYards} stepM={5} min={100} max={620} />
        <Segmented label="Hazard" options={HAZARDS} value={hazard} onChange={setHazard} />
        <Segmented label="Pin position" options={PINS} value={pin} onChange={setPin} />
        <Segmented label="Your typical miss" options={MISSES} value={miss} onChange={setMiss} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  aggPill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginBottom: spacing.sm,
  },
  aggText: { fontWeight: "700", fontSize: 13, textTransform: "uppercase", letterSpacing: 1 },
  headline: { color: colors.text, fontSize: 24, fontWeight: "800" },
  target: { color: colors.accent, fontSize: 17, fontWeight: "700", marginTop: spacing.sm },
  reason: { color: colors.textMuted, fontSize: 15, lineHeight: 23, marginTop: spacing.sm },
});
