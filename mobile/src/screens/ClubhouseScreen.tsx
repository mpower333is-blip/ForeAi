import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Screen, ScreenHeader, Card, Button, IconChip } from "../components/ui";
import { colors, spacing } from "../theme";
import { useAuth } from "../state/AuthContext";

// In-app Clubhouse hub for signed-in staff/organisers. Collapses the separate
// survey app into the main ForeAi app: once a staff member signs in, their tools
// (course survey today, more later) live right here. Players never see this.
export default function ClubhouseScreen({ navigation }: any) {
  const { staff, ready, signOut } = useAuth();

  // Not signed in → send them to sign-in.
  if (ready && !staff) {
    return (
      <Screen>
        <ScreenHeader
          title="Clubhouse"
          subtitle="Club staff & organisers"
          onBack={navigation?.canGoBack?.() ? () => navigation.goBack() : undefined}
        />
        <Card accent>
          <Text style={styles.lead}>
            Sign in with your clubhouse account to map your course and manage your club — all in this
            one app.
          </Text>
          <Button label="Sign in" onPress={() => navigation.navigate("StaffLogin")} />
        </Card>
      </Screen>
    );
  }

  const who = staff?.name || staff?.email || "Staff";

  return (
    <Screen>
      <ScreenHeader
        title="Clubhouse"
        subtitle={staff?.clubKey ? `Signed in · ${staff.clubKey}` : "Signed in"}
        onBack={navigation?.canGoBack?.() ? () => navigation.goBack() : undefined}
      />

      <Card accent>
        <Text style={styles.hello}>👋 {who}</Text>
        <Text style={styles.sub}>
          {staff?.clubKey ? `Managing ${staff.clubKey}` : "Organiser tools"}
          {staff?.role ? ` · ${staff.role}` : ""}
        </Text>
      </Card>

      <View style={styles.sectionRow}>
        <View style={styles.sectionBar} />
        <Text style={styles.sectionTitle}>Course</Text>
      </View>

      <Card>
        <View style={styles.head}>
          <IconChip emoji="🛰" />
          <View style={styles.headText}>
            <Text style={styles.cardTitle}>Map your course</Text>
          </View>
        </View>
        <Text style={styles.body}>
          Walk your course once with the guided survey — mark each tee and green and it goes live for
          everyone instantly. This is the survey tool, now built into the main app.
        </Text>
        <Button label="Start guided survey" onPress={() => navigation.navigate("CourseSurvey")} />
      </Card>

      <Card>
        <View style={styles.head}>
          <IconChip emoji="📍" tone="sky" />
          <View style={styles.headText}>
            <Text style={styles.cardTitle}>On-course GPS & fix pins</Text>
          </View>
        </View>
        <Text style={styles.body}>
          Open the on-course view to check live distances and re-mark individual points (e.g. when a
          green is rebuilt or a tee moves).
        </Text>
        <Button variant="ghost" label="Open on-course GPS" onPress={() => navigation.navigate("Survey")} />
      </Card>

      <View style={styles.sectionRow}>
        <View style={styles.sectionBar} />
        <Text style={styles.sectionTitle}>Events</Text>
      </View>

      <Card>
        <View style={styles.head}>
          <IconChip emoji="🏆" tone="gold" />
          <View style={styles.headText}>
            <Text style={styles.cardTitle}>Golf days & tournaments</Text>
          </View>
        </View>
        <Text style={styles.body}>
          Run a golf day, follow the live leaderboard, and manage players from the Events tab.
        </Text>
        <Button variant="ghost" label="Open Events" onPress={() => navigation.navigate("Tabs", { screen: "Events" })} />
      </Card>

      <Card>
        <Text style={styles.body}>Signed in as {staff?.email}.</Text>
        <Button
          variant="ghost"
          label="Sign out"
          onPress={async () => {
            await signOut();
            navigation.goBack();
          }}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: spacing.md },
  hello: { color: colors.text, fontSize: 20, fontWeight: "800" },
  sub: { color: colors.textMuted, fontSize: 14, marginTop: 4 },
  sectionRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm, marginTop: spacing.sm },
  sectionBar: { width: 4, height: 20, borderRadius: 2, backgroundColor: colors.accent, marginRight: 10 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  head: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  headText: { marginLeft: 12, flex: 1 },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  body: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: spacing.sm },
});
