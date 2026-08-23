import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Screen, ScreenHeader, Card, Stepper, MetreStepper, TextField } from "../components/ui";
import { colors, spacing, radius } from "../theme";
import { ydToM } from "../lib/units";
import { useRound } from "../state/RoundContext";
import { useProfile } from "../state/ProfileContext";
import { API_BASE } from "../services/api";

export default function ProfileScreen({ navigation }: any) {
  const {
    bag,
    setBag,
    shots,
    totalStrokesGained,
    calibrationHoles,
    isCalibrated,
    resetCaddieLearning,
    playerHandicap,
    setPlayerHandicap,
    courseHcp,
  } = useRound();
  const { name, setName, homeClub, setHomeClub } = useProfile();
  const [editing, setEditing] = useState<number | null>(null);

  const updateCarry = (index: number, carry: number) => {
    const next = bag.map((c, i) => (i === index ? { ...c, carry } : c));
    setBag(next);
  };

  return (
    <Screen>
      <ScreenHeader title="Player Profile" subtitle="Your bag drives every AI club recommendation." />

      <Card accent>
        <View style={styles.profRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(name || "⛳").trim().charAt(0).toUpperCase() || "⛳"}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{name || "ForeAi Golfer"}</Text>
            <Text style={styles.meta}>
              {shots.length} shots this round · SG {totalStrokesGained >= 0 ? "+" : ""}
              {totalStrokesGained}
            </Text>
          </View>
        </View>
        <View style={{ marginTop: spacing.md }}>
          <TextField label="Name" value={name} onChangeText={setName} placeholder="Your name" />
          <TextField label="Home club (optional)" value={homeClub} onChangeText={setHomeClub} placeholder="e.g. Kempton Park GC" />
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>More</Text>
        <MoreLink emoji="🎒" label="AI Caddie" onPress={() => navigation.navigate("Caddie")} />
        <MoreLink emoji="📊" label="Strokes-gained stats" onPress={() => navigation.navigate("Stats")} />
        <MoreLink emoji="🧭" label="Course strategy" onPress={() => navigation.navigate("Strategy")} />
        <MoreLink emoji="🎮" label="Range games" onPress={() => navigation.navigate("Games")} />
        <MoreLink emoji="⌚" label="Set up your watch" onPress={() => navigation.navigate("WatchSetup")} />
        <MoreLink emoji="⛳" label="ForeAi Pro" onPress={() => navigation.navigate("Upgrade")} last />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Handicap</Text>
        <Text style={styles.hint}>
          Drives strokes received per hole and your net / Stableford scores. Course handicap:{" "}
          <Text style={{ color: colors.accent, fontWeight: "700" }}>{courseHcp}</Text>
        </Text>
        <Stepper label="Handicap index" value={playerHandicap} onChange={setPlayerHandicap} step={1} min={0} max={54} unit="" />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>AI Caddie calibration</Text>
        {isCalibrated ? (
          <Text style={styles.hint}>
            ✓ Calibrated — the caddie uses the distances learned from your first 18 holes.
          </Text>
        ) : (
          <Text style={styles.hint}>
            {calibrationHoles} / 18 holes logged. Play your first round and the caddie personalizes
            to your game.
          </Text>
        )}
        <TouchableOpacity onPress={resetCaddieLearning}>
          <Text style={styles.resetLink}>Reset caddie learning</Text>
        </TouchableOpacity>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>My bag</Text>
        <Text style={styles.hint}>Tap a club to tune its carry distance.</Text>
        {bag.map((club, i) => (
          <View key={club.name}>
            <TouchableOpacity
              style={styles.clubRow}
              onPress={() => setEditing(editing === i ? null : i)}
              activeOpacity={0.7}
            >
              <Text style={styles.clubName}>{club.name}</Text>
              <View style={styles.carryPill}>
                <Text style={styles.carryText}>{ydToM(club.carry)} m</Text>
              </View>
            </TouchableOpacity>
            {editing === i && (
              <View style={styles.editBox}>
                <MetreStepper
                  label={`${club.name} carry`}
                  value={club.carry}
                  onChange={(v) => updateCarry(i, v)}
                  stepM={2}
                  min={30}
                  max={340}
                />
              </View>
            )}
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Connection</Text>
        <Text style={styles.hint}>
          The app runs fully on-device. When a backend is configured, rounds sync automatically.
        </Text>
        <Text style={styles.apiText}>API: {API_BASE}</Text>
      </Card>
    </Screen>
  );
}

function MoreLink({
  emoji,
  label,
  onPress,
  last,
}: {
  emoji: string;
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.moreRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.moreEmoji}>{emoji}</Text>
      <Text style={styles.moreLabel}>{label}</Text>
      <Text style={styles.moreChevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  moreRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  moreEmoji: { fontSize: 20, width: 32 },
  moreLabel: { color: colors.text, fontSize: 16, fontWeight: "600", flex: 1 },
  moreChevron: { color: colors.textFaint, fontSize: 22, fontWeight: "700" },
  profRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 30 },
  name: { color: colors.text, fontSize: 22, fontWeight: "800" },
  meta: { color: colors.textMuted, fontSize: 14, marginTop: 2 },

  sectionTitle: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: 4 },
  hint: { color: colors.textFaint, fontSize: 14, marginBottom: spacing.sm },
  resetLink: { color: colors.negative, fontSize: 14, fontWeight: "600", marginTop: 4 },

  clubRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  clubName: { color: colors.text, fontSize: 16, fontWeight: "600" },
  carryPill: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  carryText: { color: colors.accent, fontWeight: "700" },
  editBox: { paddingVertical: spacing.sm },
  apiText: { color: colors.textFaint, fontSize: 13, marginTop: 4 },
});
