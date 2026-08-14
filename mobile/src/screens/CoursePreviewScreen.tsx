import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Screen, Card, Button, StatTile } from "../components/ui";
import { colors, spacing, radius } from "../theme";
import { getCourse, frontNinePar, backNinePar } from "../data/courses";
import { useRound } from "../state/RoundContext";
import HoleDiagram from "../components/HoleDiagram";
import SatelliteHole from "../components/SatelliteHole";

export default function CoursePreviewScreen({ navigation, route }: any) {
  const { courseId, setCourse, setCurrentHole } = useRound();
  const previewId: string = route?.params?.courseId ?? courseId;
  const course = getCourse(previewId);
  const [idx, setIdx] = useState<number>((route?.params?.hole ?? 1) - 1);

  const hole = course.holes[idx];
  const isActiveCourse = previewId === courseId;
  const hasSat = !!(course.center || hole.green || hole.tee);
  const [view, setView] = useState<"sat" | "schematic">(hasSat ? "sat" : "schematic");

  const go = (delta: number) => setIdx((i) => Math.max(0, Math.min(17, i + delta)));

  const playThisHole = () => {
    if (!isActiveCourse) setCourse(previewId);
    setCurrentHole(hole.number);
    navigation.navigate("Tabs", { screen: "Play" });
  };

  return (
    <Screen>
      <Text style={styles.courseName}>{course.name}</Text>
      <Text style={styles.courseMeta}>
        {course.location} · Par {course.par}
        {course.approxLayout ? " · approx layout" : ""}
      </Text>

      {/* hole chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {course.holes.map((h, i) => (
          <TouchableOpacity
            key={h.number}
            onPress={() => setIdx(i)}
            style={[styles.chip, i === idx && styles.chipActive]}
          >
            <Text style={[styles.chipText, i === idx && styles.chipTextActive]}>{h.number}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {hasSat && (
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, view === "sat" && styles.toggleActive]}
            onPress={() => setView("sat")}
          >
            <Text style={[styles.toggleText, view === "sat" && styles.toggleTextActive]}>🛰 Satellite</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, view === "schematic" && styles.toggleActive]}
            onPress={() => setView("schematic")}
          >
            <Text style={[styles.toggleText, view === "schematic" && styles.toggleTextActive]}>Schematic</Text>
          </TouchableOpacity>
        </View>
      )}

      <Card style={{ padding: spacing.sm }}>
        {view === "sat" && hasSat ? (
          <>
            <SatelliteHole hole={hole} center={course.center} />
            <Text style={styles.diagramNote}>
              {hole.green || hole.tee
                ? "Real satellite imagery, framed on this hole."
                : "Real satellite imagery of the course. Mark each hole's tee & green on-course (GPS) to frame holes precisely and enable auto distance-to-pin."}
            </Text>
          </>
        ) : (
          <>
            <HoleDiagram hole={hole} height={320} />
            <Text style={styles.diagramNote}>
              Illustrative schematic — par, yardage and stroke index are real; the hole shape is not
              a GPS map of {course.name}.
            </Text>
          </>
        )}
      </Card>

      <View style={styles.navRow}>
        <Button label="‹ Prev" variant="ghost" onPress={() => go(-1)} style={styles.flex} />
        <Text style={styles.holeOf}>
          Hole {hole.number} of 18
        </Text>
        <Button label="Next ›" variant="ghost" onPress={() => go(1)} style={styles.flex} />
      </View>

      <View style={styles.grid}>
        <StatTile label="Par" value={`${hole.par}`} tone="neutral" />
        <StatTile label="Yards" value={`${hole.yards}`} />
        <StatTile label="Stroke Index" value={`${hole.si}`} tone="neutral" />
      </View>

      <Card>
        <View style={styles.nineRow}>
          <Text style={styles.nineLabel}>Front nine</Text>
          <Text style={styles.nineVal}>Par {frontNinePar(course)}</Text>
        </View>
        <View style={styles.nineRow}>
          <Text style={styles.nineLabel}>Back nine</Text>
          <Text style={styles.nineVal}>Par {backNinePar(course)}</Text>
        </View>
        <View style={styles.nineRow}>
          <Text style={[styles.nineLabel, { color: colors.text }]}>Total</Text>
          <Text style={[styles.nineVal, { color: colors.accent }]}>Par {course.par}</Text>
        </View>
      </Card>

      <Button label={isActiveCourse ? `Play hole ${hole.number}` : "Play this course"} onPress={playThisHole} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  courseName: { color: colors.text, fontSize: 24, fontWeight: "800" },
  courseMeta: { color: colors.textMuted, fontSize: 14, marginTop: 2, marginBottom: spacing.md },
  diagramNote: { color: colors.textFaint, fontSize: 12, fontStyle: "italic", lineHeight: 17, paddingHorizontal: 4, marginTop: 6 },
  viewToggle: { flexDirection: "row", gap: 8, marginBottom: spacing.sm },
  toggleBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  toggleActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  toggleText: { color: colors.textMuted, fontWeight: "700" },
  toggleTextActive: { color: "#062012" },
  chipScroll: { marginBottom: spacing.md },
  chip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontWeight: "700" },
  chipTextActive: { color: "#062012" },
  navRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  flex: { flex: 1 },
  holeOf: { color: colors.text, fontSize: 15, fontWeight: "700", flex: 1, textAlign: "center" },
  grid: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  nineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  nineLabel: { color: colors.textMuted, fontSize: 15 },
  nineVal: { color: colors.textMuted, fontSize: 15, fontWeight: "700" },
});
