import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors, spacing, radius } from "../theme";
import { Course, TeeCard } from "../data/courses";

// Full official scorecard for a course that has real per-tee data: par, stroke
// index and per-hole distance for the selected tee, with Out/In/Total and the
// tee's Course Rating / Slope. Men's / Ladies toggle switches the stroke index,
// the tees offered and the ratings. Falls back to nothing when the course has no
// official card (the caller shows its simple par summary instead).
const M_TO_YD = 1.09361;

export default function MultiTeeScorecard({ course }: { course: Course }) {
  const sc = course.scorecard;
  const holes = course.holes;
  const nine = holes.length <= 9;

  const [who, setWho] = React.useState<"Men's" | "Ladies">("Men's");
  const teesForWho = React.useMemo<TeeCard[]>(
    () => (sc?.tees || []).filter((t) => t.who === who),
    [sc, who]
  );
  const [teeId, setTeeId] = React.useState<string | null>(null);
  React.useEffect(() => {
    setTeeId((prev) => (teesForWho.some((t) => t.id === prev) ? prev : teesForWho[0]?.id ?? null));
  }, [teesForWho]);
  const [unit, setUnit] = React.useState<"m" | "yd">("m");

  if (!sc || !sc.tees.length) return null;

  const genders: ("Men's" | "Ladies")[] = [];
  if (sc.tees.some((t) => t.who === "Men's")) genders.push("Men's");
  if (sc.tees.some((t) => t.who === "Ladies")) genders.push("Ladies");

  const tee = teesForWho.find((t) => t.id === teeId) || teesForWho[0];
  const si = (who === "Ladies" ? sc.ladiesSi : sc.menSi) || holes.map((h) => h.si);
  const conv = (m: number) => (unit === "yd" ? Math.round(m * M_TO_YD) : m);

  const sum = (arr: number[], a: number, b: number) => arr.slice(a, b).reduce((s, n) => s + n, 0);
  const pars = holes.map((h) => h.par);
  const dist = tee ? tee.metres.map(conv) : holes.map(() => 0);

  const cr = nine ? tee?.cr9 : tee?.cr;
  const slope = nine ? tee?.slope9 : tee?.slope;

  const Cell = ({ children, flex = 1, style, textStyle }: any) => (
    <View style={[styles.cell, { flex }, style]}>
      <Text style={[styles.cellText, textStyle]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );

  const SummaryRow = ({ label, par, d, bold }: { label: string; par: number; d: number; bold?: boolean }) => (
    <View style={[styles.row, styles.sumRow]}>
      <Cell flex={1.1} textStyle={[styles.holeText, bold && styles.bold]}>{label}</Cell>
      <Cell textStyle={[bold && styles.bold]}>{par}</Cell>
      <Cell textStyle={styles.faint}>—</Cell>
      <Cell flex={1.3} textStyle={[styles.distText, bold && styles.bold]}>{d}</Cell>
    </View>
  );

  return (
    <View>
      {/* Gender + unit toggles */}
      <View style={styles.toggles}>
        <View style={styles.seg}>
          {genders.map((g) => (
            <TouchableOpacity key={g} onPress={() => setWho(g)} style={[styles.segBtn, who === g && styles.segOn]}>
              <Text style={[styles.segText, who === g && styles.segTextOn]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.seg}>
          {(["m", "yd"] as const).map((u) => (
            <TouchableOpacity key={u} onPress={() => setUnit(u)} style={[styles.segBtn, unit === u && styles.segOn]}>
              <Text style={[styles.segText, unit === u && styles.segTextOn]}>{u === "m" ? "Metres" : "Yards"}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tee chips (only when the gender has more than one tee) */}
      {teesForWho.length > 1 && (
        <View style={styles.teeChips}>
          {teesForWho.map((t) => (
            <TouchableOpacity key={t.id} onPress={() => setTeeId(t.id)} style={[styles.teeChip, tee?.id === t.id && styles.teeChipOn]}>
              <View style={[styles.swatch, { backgroundColor: t.colour }]} />
              <Text style={[styles.teeChipText, tee?.id === t.id && styles.bold]}>{t.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Header */}
      <View style={[styles.row, styles.headRow]}>
        <Cell flex={1.1} textStyle={styles.headText}>Hole</Cell>
        <Cell textStyle={styles.headText}>Par</Cell>
        <Cell textStyle={styles.headText}>SI</Cell>
        <Cell flex={1.3} style={styles.teeHeadCell} textStyle={styles.headText}>
          {tee ? `${tee.name} (${unit})` : unit}
        </Cell>
      </View>

      {/* Hole rows */}
      {holes.map((h, i) => (
        <View key={h.number} style={[styles.row, i % 2 === 1 && styles.rowAlt]}>
          <Cell flex={1.1} textStyle={styles.holeText}>{h.number}</Cell>
          <Cell>{pars[i]}</Cell>
          <Cell textStyle={styles.faint}>{si[i] ?? "—"}</Cell>
          <Cell flex={1.3} textStyle={styles.distText}>{dist[i]}</Cell>
        </View>
      ))}

      {/* Totals */}
      {nine ? (
        <SummaryRow label="Total" par={sum(pars, 0, 9)} d={sum(dist, 0, 9)} bold />
      ) : (
        <>
          <SummaryRow label="Out" par={sum(pars, 0, 9)} d={sum(dist, 0, 9)} />
          <SummaryRow label="In" par={sum(pars, 9, 18)} d={sum(dist, 9, 18)} />
          <SummaryRow label="Total" par={sum(pars, 0, 18)} d={sum(dist, 0, 18)} bold />
        </>
      )}

      {/* CR / Slope footer */}
      {tee && (cr != null || slope != null) && (
        <View style={styles.ratingRow}>
          <View style={[styles.swatch, { backgroundColor: tee.colour }]} />
          <Text style={styles.ratingText}>
            {tee.name} {who} · Course rating <Text style={styles.bold}>{cr ?? "—"}</Text> · Slope{" "}
            <Text style={styles.bold}>{slope ?? "—"}</Text>
            {nine ? " (9 holes)" : ""}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toggles: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  seg: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, overflow: "hidden", flex: 1 },
  segBtn: { flex: 1, paddingVertical: 8, alignItems: "center" },
  segOn: { backgroundColor: colors.accent },
  segText: { color: colors.textMuted, fontWeight: "700", fontSize: 13 },
  segTextOn: { color: "#0A1B10" },

  teeChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: spacing.sm },
  teeChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  teeChipOn: { borderColor: colors.accent },
  teeChipText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  swatch: { width: 12, height: 12, borderRadius: 3, borderWidth: 1, borderColor: "rgba(0,0,0,0.25)" },

  row: { flexDirection: "row", alignItems: "center", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  rowAlt: { backgroundColor: colors.surfaceAlt },
  headRow: { backgroundColor: colors.surfaceHi, borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm, paddingVertical: 9 },
  sumRow: { backgroundColor: colors.surface },
  teeHeadCell: {},
  cell: { alignItems: "center", justifyContent: "center", paddingHorizontal: 2 },
  cellText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  headText: { color: colors.textMuted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  holeText: { color: colors.textMuted },
  distText: { color: colors.accent, fontWeight: "700" },
  faint: { color: colors.textFaint, fontWeight: "500" },
  bold: { fontWeight: "800", color: colors.text },

  ratingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.sm, paddingHorizontal: 2 },
  ratingText: { color: colors.textMuted, fontSize: 12.5, flex: 1, lineHeight: 18 },
});
