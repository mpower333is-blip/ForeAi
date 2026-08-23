import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors, radius, spacing } from "../theme";
import { Hole } from "../data/courses";
import { strokesReceivedOnHole, stablefordPoints } from "../lib/golfEngine";
import { ydToM } from "../lib/units";

// Score-Capture-style per-hole entry: PAR, strokes received (dots), big gross
// with +/-, live NET and Stableford POINTS, PICKUP/CLEAR, and a tap-for-map
// distance readout.
export default function ScoreCaptureCard({
  hole,
  courseHcp,
  gross,
  pickup,
  onChange,
  onPickup,
  onClear,
  onTapMap,
}: {
  hole: Hole;
  courseHcp: number;
  gross?: number;
  pickup: boolean;
  onChange: (gross: number) => void;
  onPickup: (picked: boolean) => void;
  onClear: () => void;
  onTapMap: () => void;
}) {
  const received = strokesReceivedOnHole(courseHcp, hole.si);
  const hasScore = gross != null && gross > 0;
  const display = hasScore ? (gross as number) : hole.par;

  const net = pickup ? hole.par + 2 : display - received;
  const points = pickup ? 0 : stablefordPoints(hole.par, display, received);
  const dots = "•".repeat(Math.min(received, 6)) || "—";

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.side}>
          <Text style={styles.label}>PAR</Text>
          <Text style={styles.parVal}>{hole.par}</Text>
          <Text style={styles.stroke}>
            SI {hole.si} · <Text style={{ color: colors.accent }}>{dots}</Text>
          </Text>
        </View>

        <View style={styles.center}>
          <TouchableOpacity style={[styles.pm, styles.minus]} onPress={() => onChange(Math.max(1, display - 1))}>
            <Text style={styles.pmText}>−</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bigWrap} onPress={() => onChange(display)}>
            <Text style={styles.big}>{pickup ? "PU" : hasScore ? display : `${display}?`}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.pm, styles.plus]} onPress={() => onChange(display + 1)}>
            <Text style={styles.pmText}>+</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.side}>
          <Text style={styles.label}>NET</Text>
          <Text style={styles.netVal}>{net}</Text>
          <Text style={styles.label}>PTS</Text>
          <Text style={styles.ptsVal}>{points}</Text>
        </View>
      </View>

      <View style={styles.btnRow}>
        <TouchableOpacity
          style={[styles.action, pickup && styles.actionActive]}
          onPress={() => onPickup(!pickup)}
        >
          <Text style={[styles.actionText, pickup && styles.actionTextActive]}>
            {pickup ? "Picked up ✓" : "Pickup ✕"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={onClear}>
          <Text style={styles.actionText}>Clear ↺</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.action, styles.mapAction]} onPress={onTapMap}>
          <Text style={styles.mapText}>🗺 {ydToM(hole.yards)} m</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  side: { alignItems: "center", minWidth: 64 },
  label: { color: colors.textFaint, fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  parVal: { color: colors.text, fontSize: 30, fontWeight: "800" },
  stroke: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  netVal: { color: colors.text, fontSize: 22, fontWeight: "800", marginBottom: 6 },
  ptsVal: { color: colors.accent, fontSize: 22, fontWeight: "800" },

  center: { flexDirection: "row", alignItems: "center", gap: 10 },
  pm: {
    width: 54,
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  minus: { backgroundColor: "#7a1f1f" },
  plus: { backgroundColor: "#1f3f7a" },
  pmText: { color: "#fff", fontSize: 30, fontWeight: "800" },
  bigWrap: { minWidth: 78, alignItems: "center" },
  big: { color: colors.text, fontSize: 46, fontWeight: "800" },

  btnRow: { flexDirection: "row", gap: 8, marginTop: spacing.md },
  action: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  actionActive: { backgroundColor: colors.warning, borderColor: colors.warning },
  actionText: { color: colors.textMuted, fontWeight: "700", fontSize: 14 },
  actionTextActive: { color: "#062012" },
  mapAction: { backgroundColor: colors.accent, borderColor: colors.accent },
  mapText: { color: "#062012", fontWeight: "800", fontSize: 14 },
});
