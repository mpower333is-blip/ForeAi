import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Screen, ScreenHeader, TextField } from "../components/ui";
import { colors, spacing, radius } from "../theme";
import { searchCourses, COURSES } from "../data/courses";
import { useRound } from "../state/RoundContext";

export default function CourseSelectScreen({ navigation, route }: any) {
  const { courseId, setCourse } = useRound();
  const onPick: ((id: string) => void) | undefined = route?.params?.onPick;
  const selectedId: string = route?.params?.selectedId ?? courseId;
  const [query, setQuery] = useState("");

  const results = useMemo(() => searchCourses(query), [query]);

  const choose = (id: string) => {
    if (onPick) onPick(id);
    else setCourse(id);
    navigation.goBack();
  };

  return (
    <Screen>
      <ScreenHeader
        title="Choose course"
        subtitle={`${COURSES.length} South African courses — search by name, town or province.`}
      />
      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder="Search e.g. Durban, Leopard Creek, Gauteng"
      />
      {results.length === 0 && (
        <Text style={styles.empty}>No courses match “{query}”.</Text>
      )}
      {results.map((c) => {
        const active = c.id === selectedId;
        return (
          <TouchableOpacity
            key={c.id}
            activeOpacity={0.85}
            onPress={() => choose(c.id)}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  name: { color: colors.text, fontSize: 17, fontWeight: "700" },
  meta: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  right: { alignItems: "flex-end", marginLeft: spacing.sm },
  par: { color: colors.textMuted, fontSize: 14 },
  check: { color: colors.accent, fontSize: 13, fontWeight: "700", marginTop: 4 },
  empty: { color: colors.textMuted, fontSize: 15, marginBottom: spacing.md },
});
