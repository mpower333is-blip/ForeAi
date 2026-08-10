import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Screen, ScreenHeader } from "../components/ui";
import { colors, spacing, radius } from "../theme";
import { COURSES } from "../data/courses";
import { useRound } from "../state/RoundContext";

// Reused both for choosing the round's course and (via route param) an event's
// course. When `onPick` is provided through navigation params we call that;
// otherwise we set the active round course.
export default function CourseSelectScreen({ navigation, route }: any) {
  const { courseId, setCourse } = useRound();
  const onPick: ((id: string) => void) | undefined = route?.params?.onPick;
  const selectedId: string = route?.params?.selectedId ?? courseId;

  const choose = (id: string) => {
    if (onPick) onPick(id);
    else setCourse(id);
    navigation.goBack();
  };

  return (
    <Screen>
      <ScreenHeader title="Choose course" subtitle="Pick where you're playing." />
      {COURSES.map((c) => {
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
              <Text style={styles.meta}>{c.location}</Text>
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
  name: { color: colors.text, fontSize: 18, fontWeight: "700" },
  meta: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  right: { alignItems: "flex-end" },
  par: { color: colors.textMuted, fontSize: 14 },
  check: { color: colors.accent, fontSize: 13, fontWeight: "700", marginTop: 4 },
});
