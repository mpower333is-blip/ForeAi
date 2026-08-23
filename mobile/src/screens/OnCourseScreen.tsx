import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Share } from "react-native";
import { Screen, ScreenHeader, Card, Button, EmptyState, Chip } from "../components/ui";
import { colors, spacing, radius, type } from "../theme";
import { useRound } from "../state/RoundContext";
import { useCourseCoords, HolePointKey } from "../state/CourseCoordsContext";
import { useLocation } from "../hooks/useLocation";
import { greenDistancesMeters, bearingDegrees, compass8 } from "../lib/geo";
import { ydToM } from "../lib/units";

// On-course GPS: which hole you're on, how far to the green (front / middle /
// back), and an arrow to the green. Plus a capture mode: stand at each point and
// tap to record its GPS, so a course with no GPS data becomes fully mapped.
export default function OnCourseScreen({ navigation }: any) {
  const { course, currentHole, setCurrentHole, courseName, courseId } = useRound();
  const { points, capture, clearPoint, greensCaptured, exportCourse } = useCourseCoords();
  const loc = useLocation();
  const [capturing, setCapturing] = useState(false);

  const hole = course.find((h) => h.number === currentHole) ?? course[0];
  const cap = points(courseId, hole.number); // on-site captures for this hole

  // Merge captured coords over any bundled ones.
  const green = cap.green ?? hole.green ?? null;
  const greenFront = cap.greenFront ?? hole.greenFront;
  const greenBack = cap.greenBack ?? hole.greenBack;
  const pin = green ?? greenFront ?? greenBack ?? null;
  const hasGps = !!pin;

  const fmb =
    loc.coord && pin ? greenDistancesMeters(loc.coord, { greenFront, green: green ?? pin, greenBack }) : null;
  const bearing = loc.coord && pin ? bearingDegrees(loc.coord, pin) : null;
  const arrowDeg = bearing != null ? (bearing - (loc.heading ?? 0) + 360) % 360 : null;

  const goHole = (delta: number) =>
    setCurrentHole(Math.max(1, Math.min(course.length, currentHole + delta)));

  const mark = (key: HolePointKey) => {
    if (loc.coord) capture(courseId, hole.number, key, loc.coord);
  };

  const shareSurvey = () => {
    Share.share({
      message: `ForeAi GPS survey — ${courseName}\n\n${exportCourse(courseId, course.length)}`,
    }).catch(() => {});
  };

  const captured = greensCaptured(courseId);
  const accuracyOk = loc.accuracy != null && loc.accuracy <= 12;

  return (
    <Screen>
      <ScreenHeader
        title="On the course"
        subtitle={`⛳ ${courseName}`}
        onBack={navigation?.canGoBack?.() ? () => navigation.goBack() : undefined}
      />

      <Card>
        <View style={styles.holeRow}>
          <TouchableOpacity style={styles.navBtn} onPress={() => goHole(-1)}>
            <Text style={styles.navTxt}>‹</Text>
          </TouchableOpacity>
          <View style={styles.holeMid}>
            <Text style={styles.holeNo}>Hole {hole.number}</Text>
            <Text style={styles.holeMeta}>Par {hole.par} · {ydToM(hole.yards)} m · SI {hole.si}</Text>
          </View>
          <TouchableOpacity style={styles.navBtn} onPress={() => goHole(1)}>
            <Text style={styles.navTxt}>›</Text>
          </TouchableOpacity>
        </View>
      </Card>

      {loc.status === "denied" && (
        <Card>
          <Text style={styles.note}>Location is off. Turn it on to see live distances and to capture GPS.</Text>
          <Button label="Enable GPS" variant="ghost" onPress={loc.request} />
        </Card>
      )}

      {capturing ? (
        <>
          <Card accent>
            <View style={styles.capHead}>
              <Text style={styles.capTitle}>Capture hole {hole.number}</Text>
              <Chip label={accuracyOk ? `±${Math.round(loc.accuracy!)}m` : loc.accuracy != null ? `±${Math.round(loc.accuracy)}m` : "locating…"} tone={accuracyOk ? "accent" : "gold"} />
            </View>
            <Text style={styles.hint}>
              Stand on the exact spot, then tap to record it. For the best fix wait until accuracy is ≤ 12m.
            </Text>
            {(["greenFront", "green", "greenBack", "tee"] as HolePointKey[]).map((key) => (
              <View key={key} style={styles.capRow}>
                <Text style={styles.capLabel}>
                  {POINT_LABEL[key]} {cap[key] ? "✓" : ""}
                </Text>
                <View style={styles.capBtns}>
                  {cap[key] && (
                    <TouchableOpacity onPress={() => clearPoint(courseId, hole.number, key)}>
                      <Text style={styles.clear}>clear</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.markBtn, !loc.coord && styles.markDisabled]}
                    disabled={!loc.coord}
                    onPress={() => mark(key)}
                  >
                    <Text style={styles.markTxt}>{cap[key] ? "Re-mark" : "Mark here"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </Card>

          <Card>
            <Text style={styles.progress}>{captured} / {course.length} holes have a green marked</Text>
            <Button label="↗ Share / export the survey" variant="ghost" onPress={shareSurvey} />
            <Button label="Done capturing" onPress={() => setCapturing(false)} />
          </Card>
        </>
      ) : !hasGps ? (
        <EmptyState
          emoji="🛰"
          title="No GPS for this hole yet"
          body="Walk the course once and capture each hole's green (and tee) — then live distances and the direction arrow work here for everyone using the app."
          actionLabel="📍 Capture GPS"
          onAction={() => setCapturing(true)}
        />
      ) : (
        <>
          <Card accent>
            <Text style={styles.dirLabel}>To the green</Text>
            <View style={styles.dirRow}>
              <View style={styles.compass}>
                <Text style={[styles.arrow, arrowDeg != null && { transform: [{ rotate: `${arrowDeg}deg` }] }]}>↑</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bigDist}>
                  {fmb?.middle ?? "–"} <Text style={styles.unit}>m</Text>
                </Text>
                <Text style={styles.bearingTxt}>
                  {bearing != null ? `Head ${compass8(bearing)}` : "Locating…"}
                  {loc.accuracy != null ? ` · ±${Math.round(loc.accuracy)}m` : ""}
                </Text>
              </View>
            </View>
            <Text style={styles.hint}>
              {loc.heading != null
                ? "The arrow points the way to the green — walk toward it."
                : `Arrow is North-up — the green is to the ${bearing != null ? compass8(bearing) : "…"}.`}
            </Text>
          </Card>

          <Card>
            <View style={styles.fmbRow}>
              <View style={styles.fmbCol}>
                <Text style={styles.fmbLabel}>Front</Text>
                <Text style={styles.fmbVal}>{fmb?.front ?? "–"}</Text>
              </View>
              <View style={[styles.fmbCol, styles.fmbMid]}>
                <Text style={styles.fmbLabel}>Middle</Text>
                <Text style={[styles.fmbVal, { color: colors.accent }]}>{fmb?.middle ?? "–"}</Text>
              </View>
              <View style={styles.fmbCol}>
                <Text style={styles.fmbLabel}>Back</Text>
                <Text style={styles.fmbVal}>{fmb?.back ?? "–"}</Text>
              </View>
            </View>
            <Button label="📍 Capture / fix this course's GPS" variant="ghost" onPress={() => setCapturing(true)} />
          </Card>
        </>
      )}
    </Screen>
  );
}

const POINT_LABEL: Record<HolePointKey, string> = {
  greenFront: "Green — front",
  green: "Green — middle (pin)",
  greenBack: "Green — back",
  tee: "Tee box",
};

const styles = StyleSheet.create({
  holeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navBtn: {
    width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceAlt,
    borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center",
  },
  navTxt: { color: colors.accent, fontSize: 30, fontWeight: "800" },
  holeMid: { alignItems: "center" },
  holeNo: { ...(type.h1 as any), color: colors.text },
  holeMeta: { color: colors.textMuted, fontSize: 14, marginTop: 2 },

  capHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  capTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  capRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  capLabel: { color: colors.text, fontSize: 15, fontWeight: "600", flex: 1 },
  capBtns: { flexDirection: "row", alignItems: "center", gap: 14 },
  clear: { color: colors.negative, fontSize: 13, fontWeight: "700" },
  markBtn: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 14 },
  markDisabled: { opacity: 0.4 },
  markTxt: { color: colors.onAccent, fontWeight: "800", fontSize: 13 },
  progress: { color: colors.textMuted, fontSize: 14, marginBottom: 4 },

  dirLabel: { color: colors.textMuted, fontSize: 13, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  dirRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: 8 },
  compass: {
    width: 86, height: 86, borderRadius: 43, borderWidth: 2, borderColor: colors.accentDeep,
    backgroundColor: colors.bg, alignItems: "center", justifyContent: "center",
  },
  arrow: { color: colors.accent, fontSize: 48, fontWeight: "900", lineHeight: 52 },
  bigDist: { color: colors.text, fontSize: 46, fontWeight: "800" },
  unit: { color: colors.textFaint, fontSize: 18, fontWeight: "600" },
  bearingTxt: { color: colors.textMuted, fontSize: 15, marginTop: 2 },

  fmbRow: { flexDirection: "row", gap: spacing.sm },
  fmbCol: { flex: 1, alignItems: "center", backgroundColor: colors.bg, borderRadius: radius.sm, paddingVertical: spacing.md },
  fmbMid: { borderWidth: 1, borderColor: colors.accent },
  fmbLabel: { color: colors.textMuted, fontSize: 13 },
  fmbVal: { color: colors.text, fontSize: 30, fontWeight: "800", marginTop: 4 },

  note: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  hint: { color: colors.textFaint, fontSize: 12, lineHeight: 17, marginTop: spacing.sm },
});
