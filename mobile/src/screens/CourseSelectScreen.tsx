import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Screen, ScreenHeader, TextField } from "../components/ui";
import { colors, spacing, radius } from "../theme";
import { searchCourses, COURSES } from "../data/courses";
import { useRound } from "../state/RoundContext";
import { searchOnline, fetchCourse, isConfigured, CourseSummary } from "../services/golfCourseApi";

export default function CourseSelectScreen({ navigation, route }: any) {
  const { courseId, setCourse } = useRound();
  const onPick: ((id: string) => void) | undefined = route?.params?.onPick;
  const selectedId: string = route?.params?.selectedId ?? courseId;

  const [query, setQuery] = useState("");
  const [online, setOnline] = useState<CourseSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const local = useMemo(() => searchCourses(query), [query]);
  const apiOn = isConfigured();

  // Debounced online search over the 30,000+ course database.
  useEffect(() => {
    if (!apiOn || query.trim().length < 2) {
      setOnline([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const res = await searchOnline(query);
      if (!cancelled) {
        setOnline(res);
        setSearching(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, apiOn]);

  const chooseLocal = (id: string) => {
    if (onPick) onPick(id);
    else setCourse(id);
    navigation.goBack();
  };

  const chooseOnline = async (apiId: string) => {
    setLoadingId(apiId);
    setError("");
    const course = await fetchCourse(apiId);
    setLoadingId(null);
    if (!course) {
      setError("Couldn't load that course's data. Try another.");
      return;
    }
    if (onPick) onPick(course.id);
    else setCourse(course.id);
    navigation.goBack();
  };

  return (
    <Screen>
      <ScreenHeader
        title="Choose course"
        subtitle={
          apiOn
            ? "Search 30,000+ courses worldwide, or pick a bundled South African course."
            : `${COURSES.length} South African courses — search by name, town or province.`
        }
      />
      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder={apiOn ? "Search any course worldwide…" : "Search e.g. Durban, Leopard Creek"}
      />

      {error !== "" && <Text style={styles.error}>{error}</Text>}

      {/* Online results */}
      {apiOn && query.trim().length >= 2 && (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Online</Text>
            {searching && <ActivityIndicator size="small" color={colors.accent} />}
          </View>
          {!searching && online.length === 0 && (
            <Text style={styles.hint}>No online matches for “{query}”.</Text>
          )}
          {online.map((c) => (
            <TouchableOpacity
              key={c.apiId}
              activeOpacity={0.85}
              onPress={() => chooseOnline(c.apiId)}
              style={styles.row}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{c.name}</Text>
                {c.location ? <Text style={styles.meta}>{c.location}</Text> : null}
              </View>
              {loadingId === c.apiId ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text style={styles.realTag}>real card ›</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Bundled / offline results */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{apiOn ? "Bundled (offline)" : "Courses"}</Text>
        {local.map((c) => {
          const active = c.id === selectedId;
          return (
            <TouchableOpacity
              key={c.id}
              activeOpacity={0.85}
              onPress={() => chooseLocal(c.id)}
              style={[styles.row, active && styles.rowActive]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{c.name}</Text>
                <Text style={styles.meta}>
                  {c.location}
                  {c.approxLayout ? "  · approx layout" : ""}
                </Text>
              </View>
              <View style={styles.right}>
                <Text style={styles.par}>Par {c.par}</Text>
                {active && <Text style={styles.check}>✓ playing</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {!apiOn && (
        <Text style={styles.apiNote}>
          Tip: set EXPO_PUBLIC_GOLF_API_KEY to search 30,000+ courses with official scorecards.
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.md },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionTitle: { color: colors.textMuted, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: spacing.sm },
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
  name: { color: colors.text, fontSize: 16, fontWeight: "700" },
  meta: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  right: { alignItems: "flex-end", marginLeft: spacing.sm },
  par: { color: colors.textMuted, fontSize: 14 },
  check: { color: colors.accent, fontSize: 13, fontWeight: "700", marginTop: 4 },
  realTag: { color: colors.accent, fontSize: 13, fontWeight: "600", marginLeft: spacing.sm },
  hint: { color: colors.textFaint, fontSize: 14 },
  error: { color: colors.negative, fontSize: 14, marginTop: 4 },
  apiNote: { color: colors.textFaint, fontSize: 12, marginTop: spacing.lg, lineHeight: 17 },
});
