import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Screen, ScreenHeader, Card, Segmented, Stepper } from "../components/ui";
import { colors, spacing } from "../theme";
import { useRound } from "../state/RoundContext";
import { recommendClub, Lie } from "../lib/golfEngine";

const LIES: { key: Lie; label: string }[] = [
  { key: "tee", label: "Tee" },
  { key: "fairway", label: "Fairway" },
  { key: "rough", label: "Rough" },
  { key: "sand", label: "Sand" },
  { key: "recovery", label: "Trees" },
];

export default function CaddieScreen() {
  const { bag } = useRound();
  const [yardage, setYardage] = useState(155);
  const [wind, setWind] = useState(0);
  const [elevation, setElevation] = useState(0);
  const [lie, setLie] = useState<Lie>("fairway");
  const [temp, setTemp] = useState(70);

  const rec = useMemo(
    () => recommendClub({ yardage, windSpeed: wind, elevation, lie, temperature: temp }, bag),
    [yardage, wind, elevation, lie, temp, bag]
  );

  const confTone =
    rec.confidence === "high" ? colors.positive : rec.confidence === "medium" ? colors.warning : colors.negative;

  return (
    <Screen>
      <ScreenHeader title="AI Caddie" subtitle="Dial in the conditions — get the club and the plan." />

      <Card accent>
        <Text style={styles.club}>{rec.club}</Text>
        <Text style={styles.plays}>plays {rec.playingYards} yds</Text>
        <View style={[styles.confPill, { borderColor: confTone }]}>
          <Text style={[styles.confText, { color: confTone }]}>{rec.confidence} confidence</Text>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  club: { color: colors.accent, fontSize: 52, fontWeight: "800" },
  plays: { color: colors.text, fontSize: 18, marginTop: 2 },
  confPill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginTop: spacing.sm,
  },
  confText: { fontWeight: "700", fontSize: 13 },
  notes: { marginTop: spacing.md },
  note: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
});
