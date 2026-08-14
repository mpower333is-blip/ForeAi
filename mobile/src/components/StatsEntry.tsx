import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { colors, radius, spacing } from "../theme";
import { HoleStats } from "../state/RoundContext";
import { Club } from "../lib/golfEngine";

// Collapsible per-hole stats capture (like Score Capture's ENTER STATS):
// club off the tee, fairway accuracy, GIR, putts, up & down, penalties.
export default function StatsEntry({
  par,
  bag,
  stats,
  onChange,
}: {
  par: number;
  bag: Club[];
  stats: HoleStats;
  onChange: (patch: Partial<HoleStats>) => void;
}) {
  const [open, setOpen] = useState(false);
  const isPar3 = par === 3;
  const putts = stats.putts ?? 0;
  const penalties = stats.penalties ?? 0;

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.header} onPress={() => setOpen((o) => !o)} activeOpacity={0.8}>
        <Text style={styles.headerText}>Enter stats</Text>
        <Text style={styles.chevron}>{open ? "▲" : "▼"}</Text>
      </TouchableOpacity>

      {open && (
        <View style={styles.body}>
          <Text style={styles.label}>Club off the tee</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {bag.map((c) => {
              const active = stats.club === c.name;
              return (
                <TouchableOpacity
                  key={c.name}
                  onPress={() => onChange({ club: active ? undefined : c.name })}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {!isPar3 && (
            <>
              <Text style={styles.label}>Fairway</Text>
              <View style={styles.segRow}>
                {(["left", "hit", "right", "miss"] as const).map((k) => {
                  const active = stats.fairway === k;
                  return (
                    <TouchableOpacity
                      key={k}
                      onPress={() => onChange({ fairway: active ? undefined : k })}
                      style={[styles.seg, active && styles.segActive]}
                    >
                      <Text style={[styles.segText, active && styles.segTextActive]}>
                        {k === "hit" ? "Hit" : k === "left" ? "◄ L" : k === "right" ? "R ►" : "Miss"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <View style={styles.toggleRow}>
            <Text style={styles.label}>Green in regulation</Text>
            <View style={styles.segRow}>
              {[true, false].map((v) => {
                const active = stats.gir === v;
                return (
                  <TouchableOpacity
                    key={String(v)}
                    onPress={() => onChange({ gir: active ? undefined : v })}
                    style={[styles.seg, active && styles.segActive]}
                  >
                    <Text style={[styles.segText, active && styles.segTextActive]}>{v ? "Yes" : "No"}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {stats.gir === false && (
            <View style={styles.toggleRow}>
              <Text style={styles.label}>Up &amp; down</Text>
              <View style={styles.segRow}>
                {[true, false].map((v) => {
                  const active = stats.upDown === v;
                  return (
                    <TouchableOpacity
                      key={String(v)}
                      onPress={() => onChange({ upDown: active ? undefined : v })}
                      style={[styles.seg, active && styles.segActive]}
                    >
                      <Text style={[styles.segText, active && styles.segTextActive]}>{v ? "Yes" : "No"}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <View style={styles.stepRow}>
            <Text style={styles.label}>Putts</Text>
            <Stepper value={putts} onDown={() => onChange({ putts: Math.max(0, putts - 1) })} onUp={() => onChange({ putts: putts + 1 })} />
          </View>
          <View style={styles.stepRow}>
            <Text style={styles.label}>Penalties</Text>
            <Stepper value={penalties} onDown={() => onChange({ penalties: Math.max(0, penalties - 1) })} onUp={() => onChange({ penalties: penalties + 1 })} />
          </View>
        </View>
      )}
    </View>
  );
}

function Stepper({ value, onDown, onUp }: { value: number; onDown: () => void; onUp: () => void }) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity style={styles.stepBtn} onPress={onDown}>
        <Text style={styles.stepBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={styles.stepVal}>{value}</Text>
      <TouchableOpacity style={styles.stepBtn} onPress={onUp}>
        <Text style={styles.stepBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.md },
  headerText: { color: colors.accent, fontSize: 15, fontWeight: "800", letterSpacing: 1 },
  chevron: { color: colors.textMuted, fontSize: 12 },
  body: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  label: { color: colors.textMuted, fontSize: 13, marginTop: spacing.sm, marginBottom: 6 },
  chipRow: { flexDirection: "row" },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: "#062012" },
  segRow: { flexDirection: "row", gap: 8, flexShrink: 0 },
  seg: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  segText: { color: colors.textMuted, fontWeight: "700", fontSize: 13 },
  segTextActive: { color: "#062012" },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  stepRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm },
  stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { color: colors.accent, fontSize: 22, fontWeight: "700" },
  stepVal: { color: colors.text, fontSize: 20, fontWeight: "800", minWidth: 26, textAlign: "center" },
});
