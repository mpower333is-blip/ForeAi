import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Screen, ScreenHeader, Card, Button, Chip } from "../components/ui";
import { colors, spacing, radius, type } from "../theme";
import { useRound } from "../state/RoundContext";
import { useCourseCoords, HolePointKey } from "../state/CourseCoordsContext";
import { useLocation } from "../hooks/useLocation";
import { ydToM } from "../lib/units";

// Guided course self-survey — the onboarding flow a club walks through to map
// their course. Stand on each tee and green and tap to record the GPS; every
// capture publishes live (CourseCoordsContext → Firestore), so the course becomes
// available to everyone the moment it's mapped — no rebuild, no release. This is
// how ForeAi builds its OWN course database instead of paying for a course API.

const STEPS: { key: HolePointKey; label: string; hint: string }[] = [
  { key: "tee", label: "Tee box", hint: "Stand on the main tee marker" },
  { key: "greenFront", label: "Green — front", hint: "Front edge of the green" },
  { key: "green", label: "Green — middle", hint: "Centre of the green (the pin area)" },
  { key: "greenBack", label: "Green — back", hint: "Back edge of the green" },
];

export default function CourseSurveyScreen({ navigation }: any) {
  const { course, courseId, courseName } = useRound();
  const { points, capture, clearPoint } = useCourseCoords();
  const loc = useLocation();
  const [idx, setIdx] = useState(1); // current hole number

  const holeCount = course.length;
  const hole = course.find((h) => h.number === idx) ?? course[0];
  const cap = points(courseId, hole.number);

  // A hole counts as "mapped" once it has a green (captured OR already bundled).
  const holeMapped = (n: number) => {
    const c = points(courseId, n);
    const h = course.find((x) => x.number === n);
    return !!(c.green || c.greenFront || c.greenBack || h?.green || h?.greenFront || h?.greenBack);
  };
  const holeHasTee = (n: number) => {
    const c = points(courseId, n);
    const h = course.find((x) => x.number === n);
    return !!(c.tee || h?.tee);
  };

  const mappedCount = useMemo(
    () => course.filter((h) => holeMapped(h.number)).length,
    [course, courseId, points]
  );
  const fullyDone = mappedCount >= holeCount;
  const pct = Math.round((mappedCount / Math.max(1, holeCount)) * 100);

  const accuracy = loc.accuracy;
  const accuracyOk = accuracy != null && accuracy <= 12;

  const mark = (key: HolePointKey) => {
    if (loc.coord) capture(courseId, hole.number, key, loc.coord);
  };

  const greenOnThisHole = !!(cap.green || cap.greenFront || cap.greenBack);
  const go = (n: number) => setIdx(Math.max(1, Math.min(holeCount, n)));

  return (
    <Screen>
      <ScreenHeader
        title="Map your course"
        subtitle={`⛳ ${courseName}`}
        onBack={navigation?.canGoBack?.() ? () => navigation.goBack() : undefined}
      />

      {/* Overall progress */}
      <Card accent>
        <View style={styles.progHead}>
          <Text style={styles.progTitle}>{mappedCount} / {holeCount} holes mapped</Text>
          <Chip label={`${pct}%`} tone={fullyDone ? "accent" : "gold"} />
        </View>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.sharedNote}>
          🛰 Every point you mark publishes live — the course works for everyone the moment it's mapped.
        </Text>
      </Card>

      {fullyDone && (
        <Card>
          <Text style={styles.doneTitle}>🎉 {courseName} is mapped</Text>
          <Text style={styles.doneBody}>
            Every hole has a green. GPS distances and the direction arrow now work on this course for
            everyone — and you can re-mark any point any time (e.g. when a green is rebuilt).
          </Text>
        </Card>
      )}

      {/* Hole picker grid */}
      <Card>
        <Text style={styles.gridLabel}>Jump to a hole</Text>
        <View style={styles.grid}>
          {course.map((h) => {
            const mapped = holeMapped(h.number);
            const tee = holeHasTee(h.number);
            const active = h.number === idx;
            return (
              <TouchableOpacity
                key={h.number}
                onPress={() => go(h.number)}
                style={[
                  styles.cell,
                  mapped && tee && styles.cellDone,
                  mapped && !tee && styles.cellPartial,
                  active && styles.cellActive,
                ]}
              >
                <Text style={[styles.cellNo, (mapped || active) && styles.cellNoOn]}>{h.number}</Text>
                {mapped && <Text style={styles.cellTick}>{tee ? "✓" : "◐"}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.legend}>✓ green + tee   ◐ green only   ○ not mapped</Text>
      </Card>

      {/* Current hole capture */}
      <Card accent>
        <View style={styles.holeNav}>
          <TouchableOpacity style={styles.navBtn} onPress={() => go(idx - 1)} disabled={idx <= 1}>
            <Text style={[styles.navTxt, idx <= 1 && styles.navOff]}>‹</Text>
          </TouchableOpacity>
          <View style={styles.holeMid}>
            <Text style={styles.holeNo}>Hole {hole.number}</Text>
            <Text style={styles.holeMeta}>Par {hole.par} · {ydToM(hole.yards)} m · SI {hole.si}</Text>
          </View>
          <TouchableOpacity style={styles.navBtn} onPress={() => go(idx + 1)} disabled={idx >= holeCount}>
            <Text style={[styles.navTxt, idx >= holeCount && styles.navOff]}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.accRow}>
          <Chip
            label={accuracy != null ? `GPS ±${Math.round(accuracy)}m` : "locating…"}
            tone={accuracyOk ? "accent" : "gold"}
          />
          <Text style={styles.accHint}>{accuracyOk ? "Good fix — mark away" : "Wait for ≤ 12m for the best accuracy"}</Text>
        </View>

        {loc.status === "denied" && (
          <Button label="Enable GPS" variant="ghost" onPress={loc.request} />
        )}

        {STEPS.map((s) => (
          <View key={s.key} style={styles.stepRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepLabel}>
                {cap[s.key] ? "✓ " : ""}{s.label}
              </Text>
              <Text style={styles.stepHint}>{s.hint}</Text>
            </View>
            <View style={styles.stepBtns}>
              {cap[s.key] && (
                <TouchableOpacity onPress={() => clearPoint(courseId, hole.number, s.key)}>
                  <Text style={styles.clear}>clear</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.markBtn, !loc.coord && styles.markOff]}
                disabled={!loc.coord}
                onPress={() => mark(s.key)}
              >
                <Text style={styles.markTxt}>{cap[s.key] ? "Re-mark" : "Mark"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {idx < holeCount ? (
          <Button
            label={greenOnThisHole ? "Next hole →" : "Skip to next hole →"}
            onPress={() => go(idx + 1)}
          />
        ) : (
          <Button label="Review all holes" variant="ghost" onPress={() => go(1)} />
        )}
      </Card>

      <Text style={styles.foot}>
        Tip: you only need the green (middle) for distances to work. Mark the tee too for the aerial
        hole view. Walk the whole course once and you're done.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  progTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  bar: { height: 12, borderRadius: 6, backgroundColor: colors.bg, overflow: "hidden" },
  barFill: { height: 12, borderRadius: 6, backgroundColor: colors.accent },
  sharedNote: { color: colors.textFaint, fontSize: 12, lineHeight: 17, marginTop: 10 },

  doneTitle: { color: colors.accent, fontSize: 20, fontWeight: "800" },
  doneBody: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 6 },

  gridLabel: { color: colors.textMuted, fontSize: 13, fontWeight: "700", marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: {
    width: 52, height: 52, borderRadius: radius.sm, backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center",
  },
  cellDone: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  cellPartial: { borderColor: colors.gold },
  cellActive: { borderColor: colors.accent, borderWidth: 2 },
  cellNo: { color: colors.textMuted, fontSize: 16, fontWeight: "800" },
  cellNoOn: { color: colors.text },
  cellTick: { color: colors.accent, fontSize: 11, fontWeight: "900", marginTop: -2 },
  legend: { color: colors.textFaint, fontSize: 11, marginTop: 10 },

  holeNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  navBtn: {
    width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
    borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center",
  },
  navTxt: { color: colors.accent, fontSize: 28, fontWeight: "800" },
  navOff: { color: colors.textFaint, opacity: 0.4 },
  holeMid: { alignItems: "center" },
  holeNo: { ...(type.h1 as any), color: colors.text },
  holeMeta: { color: colors.textMuted, fontSize: 13, marginTop: 2 },

  accRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.sm },
  accHint: { color: colors.textFaint, fontSize: 12, flex: 1 },

  stepRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  stepLabel: { color: colors.text, fontSize: 15, fontWeight: "700" },
  stepHint: { color: colors.textFaint, fontSize: 12, marginTop: 2 },
  stepBtns: { flexDirection: "row", alignItems: "center", gap: 14 },
  clear: { color: colors.negative, fontSize: 13, fontWeight: "700" },
  markBtn: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 18 },
  markOff: { opacity: 0.4 },
  markTxt: { color: colors.onAccent, fontWeight: "800", fontSize: 14 },

  foot: { color: colors.textFaint, fontSize: 12, lineHeight: 18, marginTop: spacing.sm, marginBottom: spacing.lg },
});
