import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Card, Button } from "./ui";
import { colors, spacing, radius } from "../theme";
import { Coord, distanceYards, greenDistancesMeters } from "../lib/geo";
import { ydToM } from "../lib/units";
import { LocationState } from "../hooks/useLocation";

export type HoleMarks = { tee?: Coord; pin?: Coord };

// On-course GPS rangefinder for a single hole. There's no course green-location
// database, so this self-calibrates: mark the tee (or auto on tee-off) and the
// pin from the green, and it computes live distances from your position.
export default function HoleGps({
  holeNumber,
  holeYards,
  greenCoord,
  greenFront,
  greenBack,
  loc,
  marks,
  onMarkTee,
  onMarkPin,
  onPlayFromHere,
}: {
  holeNumber: number;
  holeYards: number;
  greenCoord?: Coord; // real green GPS from the course data, when available
  greenFront?: Coord; // front-of-green GPS (for the B/M/F readout)
  greenBack?: Coord; // back-of-green GPS
  loc: LocationState;
  marks: HoleMarks;
  onMarkTee: () => void;
  onMarkPin: () => void;
  onPlayFromHere: (yards: number) => void;
}) {
  const { coord, accuracy, status } = loc;

  // Distance to pin, best source first:
  //  1. the course's real green coordinate (fully automatic)
  //  2. a pin you marked from the green
  //  3. an estimate from how far you've walked off the tee
  const pin = greenCoord ?? marks.pin;
  let toPin: number | null = null;
  let source: "auto" | "pin" | "estimate" | null = null;
  if (coord && pin) {
    toPin = distanceYards(coord, pin);
    source = greenCoord ? "auto" : "pin";
  } else if (coord && marks.tee) {
    const walked = distanceYards(coord, marks.tee);
    toPin = Math.max(0, holeYards - walked);
    source = "estimate";
  }

  // Score-Capture-style Front / Middle / Back readout when the course has full
  // green GPS and we have a live fix.
  const fmb =
    coord && greenFront && greenBack
      ? greenDistancesMeters(coord, { greenFront, green: greenCoord, greenBack })
      : null;

  const teeToPin =
    marks.tee && pin ? distanceYards(marks.tee, pin) : holeYards;

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

      {fmb ? (
        // Front / Middle / Back — the classic rangefinder readout.
        <View style={styles.distRow}>
          <View style={styles.distCol}>
            <Text style={styles.distLabel}>Front</Text>
            <Text style={styles.distValueSm}>{fmb.front ?? "–"}</Text>
            <Text style={styles.distUnit}>m</Text>
          </View>
          <View style={[styles.distCol, styles.distColMid]}>
            <Text style={styles.distLabel}>Middle</Text>
            <Text style={[styles.distValue, { color: colors.accent }]}>{fmb.middle ?? "–"}</Text>
            <Text style={styles.distUnit}>m · auto GPS</Text>
          </View>
          <View style={styles.distCol}>
            <Text style={styles.distLabel}>Back</Text>
            <Text style={styles.distValueSm}>{fmb.back ?? "–"}</Text>
            <Text style={styles.distUnit}>m</Text>
          </View>
        </View>
      ) : (
        <View style={styles.distRow}>
          <View style={styles.distCol}>
            <Text style={styles.distLabel}>Tee → Pin</Text>
            <Text style={styles.distValue}>{ydToM(teeToPin)}</Text>
            <Text style={styles.distUnit}>m{marks.pin && marks.tee ? " (gps)" : ""}</Text>
          </View>
          <View style={styles.distCol}>
            <Text style={styles.distLabel}>To Pin now</Text>
            <Text style={[styles.distValue, { color: colors.accent }]}>
              {toPin != null ? ydToM(toPin) : "–"}
            </Text>
            <Text style={styles.distUnit}>
              {source === "auto"
                ? "m · auto GPS"
                : source === "pin"
                ? "m (gps)"
                : source === "estimate"
                ? "m (est)"
                : "mark to start"}
            </Text>
          </View>
        </View>
      )}

      {status === "denied" && (
        <Button label="Enable GPS" variant="ghost" onPress={loc.request} />
      )}

      {!greenCoord && (
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
      )}

      {toPin != null && (
        <Button label={`Play from here → ${ydToM(toPin)} m`} onPress={() => onPlayFromHere(toPin!)} />
      )}

      <Text style={styles.note}>
        {greenCoord
          ? "Distance to the pin is automatic from this course's GPS data."
          : "No GPS map for this course, so distances calibrate from the tee/pin you mark — mark the pin from the green once for exact distance."}
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
  distColMid: { borderWidth: 1, borderColor: colors.accent },
  distLabel: { color: colors.textMuted, fontSize: 13 },
  distValue: { color: colors.text, fontSize: 34, fontWeight: "800", marginTop: 2 },
  distValueSm: { color: colors.text, fontSize: 26, fontWeight: "800", marginTop: 2 },
  distUnit: { color: colors.textFaint, fontSize: 12 },

  btnRow: { flexDirection: "row", gap: spacing.sm },
  flexBtn: { flex: 1 },
  note: { color: colors.textFaint, fontSize: 12, lineHeight: 17, marginTop: spacing.sm },
});
