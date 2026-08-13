import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Card, Button } from "./ui";
import { colors, spacing, radius } from "../theme";
import { Coord, distanceYards } from "../lib/geo";
import { LocationState } from "../hooks/useLocation";

export type HoleMarks = { tee?: Coord; pin?: Coord };

// On-course GPS rangefinder for a single hole. There's no course green-location
// database, so this self-calibrates: mark the tee (or auto on tee-off) and the
// pin from the green, and it computes live distances from your position.
export default function HoleGps({
  holeNumber,
  holeYards,
  loc,
  marks,
  onMarkTee,
  onMarkPin,
  onPlayFromHere,
}: {
  holeNumber: number;
  holeYards: number;
  loc: LocationState;
  marks: HoleMarks;
  onMarkTee: () => void;
  onMarkPin: () => void;
  onPlayFromHere: (yards: number) => void;
}) {
  const { coord, accuracy, status } = loc;

  // Distance to pin: exact if a pin is marked; otherwise estimate from how far
  // you've walked off the tee against the hole's listed length.
  let toPin: number | null = null;
  let source: "pin" | "estimate" | null = null;
  if (coord && marks.pin) {
    toPin = distanceYards(coord, marks.pin);
    source = "pin";
  } else if (coord && marks.tee) {
    const walked = distanceYards(coord, marks.tee);
    toPin = Math.max(0, holeYards - walked);
    source = "estimate";
  }

  const teeToPin =
    marks.tee && marks.pin ? distanceYards(marks.tee, marks.pin) : holeYards;

  return (
    <Card>
      <View style={styles.headerRow}>
        <Text style={styles.title}>📍 GPS · Hole {holeNumber}</Text>
        <Text style={styles.gpsStatus}>
          {status === "granted"
            ? accuracy != null
              ? `±${Math.round(accuracy)}m`
              : "locating…"
            : status === "denied"
            ? "location off"
            : status === "requesting"
            ? "…"
            : status}
        </Text>
      </View>

      <View style={styles.distRow}>
        <View style={styles.distCol}>
          <Text style={styles.distLabel}>Tee → Pin</Text>
          <Text style={styles.distValue}>{teeToPin}</Text>
          <Text style={styles.distUnit}>yds{marks.pin && marks.tee ? " (gps)" : ""}</Text>
        </View>
        <View style={styles.distCol}>
          <Text style={styles.distLabel}>To Pin now</Text>
          <Text style={[styles.distValue, { color: colors.accent }]}>
            {toPin != null ? toPin : "–"}
          </Text>
          <Text style={styles.distUnit}>
            {source === "pin" ? "yds (gps)" : source === "estimate" ? "yds (est)" : "mark to start"}
          </Text>
        </View>
      </View>

      {status === "denied" && (
        <Button label="Enable GPS" variant="ghost" onPress={loc.request} />
      )}

      <View style={styles.btnRow}>
        <Button
          label={marks.tee ? "Re-mark tee" : "I'm at the tee"}
          variant="ghost"
          onPress={onMarkTee}
          style={styles.flexBtn}
        />
        <Button
          label={marks.pin ? "Re-mark pin" : "I'm at the pin"}
          variant="ghost"
          onPress={onMarkPin}
          style={styles.flexBtn}
        />
      </View>

      {toPin != null && (
        <Button label={`Play from here → ${toPin} yds`} onPress={() => onPlayFromHere(toPin!)} />
      )}

      <Text style={styles.note}>
        No course GPS map is loaded, so distances calibrate from the tee/pin you mark. Mark the pin
        from the green once for exact yardage.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  title: { color: colors.text, fontSize: 18, fontWeight: "700" },
  gpsStatus: { color: colors.textFaint, fontSize: 13, fontWeight: "600" },

  distRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  distCol: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: spacing.sm,
    alignItems: "center",
  },
  distLabel: { color: colors.textMuted, fontSize: 13 },
  distValue: { color: colors.text, fontSize: 34, fontWeight: "800", marginTop: 2 },
  distUnit: { color: colors.textFaint, fontSize: 12 },

  btnRow: { flexDirection: "row", gap: spacing.sm },
  flexBtn: { flex: 1 },
  note: { color: colors.textFaint, fontSize: 12, lineHeight: 17, marginTop: spacing.sm },
});
