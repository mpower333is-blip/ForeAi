import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Screen, ScreenHeader, TextField } from "../components/ui";
import { colors, spacing, radius } from "../theme";
import { coursesNearest, allCourses } from "../data/courses";
import { useRound } from "../state/RoundContext";
import { useLocation } from "../hooks/useLocation";
import { useCourseCoords } from "../state/CourseCoordsContext";
import { searchOnline, fetchCourse, isConfigured } from "../services/golfCourseApi";
import {
  searchGolfApi,
  importGolfApiCourse,
  isGolfApiConfigured,
  GolfApiSummary,
} from "../services/golfApiIo";

type Row = { id: string; name: string; location: string; badge?: string; hasGps?: boolean };

export default function CourseSelectScreen({ navigation, route }: any) {
  const { courseId, setCourse } = useRound();
  const onPick: ((id: string) => void) | undefined = route?.params?.onPick;
  const selectedId: string = route?.params?.selectedId ?? courseId;

  const loc = useLocation();
  const { greensCaptured } = useCourseCoords();
  const [query, setQuery] = useState("");
  const [online, setOnline] = useState<Row[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Bundled/imported courses, ordered nearest-first by GPS, then filtered.
  const local = useMemo(() => {
    const nearby = coursesNearest(loc.coord);
    const q = query.trim().toLowerCase();
    if (!q) return nearby;
    return nearby.filter(
      (c) => c.name.toLowerCase().includes(q) || c.location.toLowerCase().includes(q)
    );
  }, [query, loc.coord]);
  const nearestId = loc.coord && local[0]?.distanceKm != null ? local[0].id : null;
  const gioOn = isGolfApiConfigured(); // preferred: real GPS + yardages
  const gcaOn = isConfigured(); // fallback: 30k courses
  const onlineOn = gioOn || gcaOn;

  // Debounced online search over the active provider.
  useEffect(() => {
    if (!onlineOn || query.trim().length < 2) {
      setOnline([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      let rows: Row[] = [];
      if (gioOn) {
        const res = await searchGolfApi(query);
        rows = res
          .filter((c) => c.holes === 18)
          .map((c) => ({ id: c.id, name: c.name, location: c.location, hasGps: c.hasGps, badge: c.hasGps ? "GPS" : undefined }));
      } else {
        const res = await searchOnline(query);
        rows = res.map((c) => ({ id: c.apiId, name: c.name, location: c.location, badge: "card" }));
      }
      if (!cancelled) {
        setOnline(rows);
        setSearching(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, onlineOn, gioOn]);

  const finish = (id: string) => {
    if (onPick) onPick(id);
    else setCourse(id);
    navigation.goBack();
  };

  const chooseOnline = async (row: Row) => {
    setLoadingId(row.id);
    setError("");
    const course = gioOn
      ? await importGolfApiCourse(row.id, !!row.hasGps)
      : await fetchCourse(row.id);
    setLoadingId(null);
    if (!course) {
      setError("Couldn't load that course's data. Try another.");
      return;
    }
    finish(course.id);
  };

  return (
    <Screen>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        title="Choose course"
        subtitle={
          gioOn
            ? "Search real courses with GPS & yardages, or pick a bundled course."
            : gcaOn
            ? "Search 30,000+ courses worldwide, or pick a bundled course."
            : "Pick your course — nearest to you is shown first."
        }
      />
      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder={onlineOn ? "Search any course…" : "Search e.g. Durban, Leopard Creek"}
      />

      {error !== "" && <Text style={styles.error}>{error}</Text>}

      {onlineOn && query.trim().length >= 2 && (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{gioOn ? "GolfAPI · GPS" : "Online"}</Text>
            {searching && <ActivityIndicator size="small" color={colors.accent} />}
          </View>
          {!searching && online.length === 0 && (
            <Text style={styles.hint}>No online matches for “{query}”.</Text>
          )}
          {online.map((c) => (
            <TouchableOpacity key={c.id} activeOpacity={0.85} onPress={() => chooseOnline(c)} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{c.name}</Text>
                {c.location ? <Text style={styles.meta}>{c.location}</Text> : null}
              </View>
              {loadingId === c.id ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text style={styles.realTag}>{c.badge ?? "load"} ›</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{onlineOn ? "Bundled (offline)" : "Courses"}</Text>
        {local.map((c) => {
          const active = c.id === selectedId;
          const isNearest = c.id === nearestId;
          const km = c.distanceKm;
          const surveyed = greensCaptured(c.id); // holes with a green marked
          return (
            <TouchableOpacity
              key={c.id}
              activeOpacity={0.85}
              onPress={() => finish(c.id)}
              style={[styles.row, active && styles.rowActive]}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{c.name}</Text>
                  {isNearest && <Text style={styles.nearBadge}>📍 Nearest</Text>}
                </View>
                <Text style={styles.meta}>
                  {c.location}
                  {km != null ? `  ·  ${km < 10 ? km.toFixed(1) : Math.round(km)} km away` : ""}
                  {c.approxLayout ? "  · approx layout" : ""}
                </Text>
                {surveyed > 0 && (
                  <Text style={styles.survey}>🛰 {surveyed}/{c.holes.length} greens marked</Text>
                )}
              </View>
              <View style={styles.right}>
                <Text style={styles.par}>Par {c.par}</Text>
                {active && <Text style={styles.check}>✓ playing</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {!onlineOn && (
        <Text style={styles.apiNote}>
          Tip: set EXPO_PUBLIC_GOLFAPI_KEY for real courses with GPS &amp; yardages.
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.md },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowActive: { borderColor: colors.accent },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  name: { color: colors.text, fontSize: 16, fontWeight: "700" },
  nearBadge: { color: colors.accent, fontSize: 12, fontWeight: "800" },
  survey: { color: colors.accent, fontSize: 12, marginTop: 3, fontWeight: "600" },
  meta: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  right: { alignItems: "flex-end", marginLeft: spacing.sm },
  par: { color: colors.textMuted, fontSize: 14 },
  check: { color: colors.accent, fontSize: 13, fontWeight: "700", marginTop: 4 },
  realTag: { color: colors.accent, fontSize: 13, fontWeight: "600", marginLeft: spacing.sm },
  hint: { color: colors.textFaint, fontSize: 14 },
  error: { color: colors.negative, fontSize: 14, marginTop: 4 },
  apiNote: { color: colors.textFaint, fontSize: 12, marginTop: spacing.lg, lineHeight: 17 },
});
