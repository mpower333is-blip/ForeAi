import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, Platform } from "react-native";
import Constants from "expo-constants";
import { Screen, ScreenHeader, Card, Stepper, MetreStepper, TextField, Button } from "../components/ui";
import { colors, spacing, radius } from "../theme";
import { ydToM } from "../lib/units";
import { useRound } from "../state/RoundContext";
import { clubComparison, gearLabel, MIN_SAMPLES, ClubGear, ClubComparison } from "../lib/golfEngine";
import { useProfile } from "../state/ProfileContext";
import { API_BASE } from "../services/api";
import { getNotifPrefs, loadNotifPrefs, setNotifPref, NotifPrefs } from "../lib/notifPrefs";
import { unregisterForPush } from "../lib/pushRegister";
import { registerLightningBackground, unregisterLightningBackground } from "../lib/lightningSafe";
import { IAP_ENABLED } from "../config/appConfig";

// App version + build, shown at the bottom of Profile so any device/tester can
// confirm at a glance which build they're on (the version string distinguishes a
// fixed build from an old one). nativeBuildVersion reads the real binary's build
// number; falls back to the config values.
const APP_VERSION = Constants.expoConfig?.version ?? "?";
const BUILD_NUMBER =
  (Constants as any).nativeBuildVersion ||
  Constants.expoConfig?.ios?.buildNumber ||
  Constants.expoConfig?.android?.versionCode ||
  "";

export default function ProfileScreen({ navigation }: any) {
  const {
    bag,
    setBag,
    gear,
    setClubDetails,
    replaceClub,
    learned,
    shots,
    totalStrokesGained,
    calibrationHoles,
    isCalibrated,
    resetCaddieLearning,
    playerHandicap,
    setPlayerHandicap,
    courseHcp,
  } = useRound();
  const { name, setName, homeClub, setHomeClub, saId, setSaId } = useProfile();
  const [editing, setEditing] = useState<number | null>(null);

  const [prefs, setPrefs] = useState<NotifPrefs>(getNotifPrefs());
  useEffect(() => {
    loadNotifPrefs().then(setPrefs);
  }, []);
  const togglePref = (key: keyof NotifPrefs, val: boolean) => {
    setPrefs((p) => ({ ...p, [key]: val }));
    setNotifPref(key, val);
    // Turning lightning alerts off also stops the backend pushing to this phone
    // AND cancels the on-device background watch. Turning it back on re-arms the
    // background watch immediately (the server push re-registers automatically
    // when a weather panel is next shown).
    if (key === "lightning") {
      if (val) {
        registerLightningBackground();
      } else {
        unregisterForPush(API_BASE);
        unregisterLightningBackground();
      }
    }
  };

  const updateCarry = (index: number, carry: number) => {
    const next = bag.map((c, i) => (i === index ? { ...c, carry } : c));
    setBag(next);
  };

  // Pull the player's current official index from HNA (via the hnaLookup Cloud
  // Function) and apply it. Fails soft to manual entry when the club hasn't got
  // official sync switched on, or the ID isn't in their HNA records.
  const [hnaBusy, setHnaBusy] = useState(false);
  const updateFromHna = async () => {
    if (!saId.trim()) {
      Alert.alert("Add your SA Player ID", "Enter your HNA / SA Player ID above first.");
      return;
    }
    if (process.env.EXPO_PUBLIC_USE_FIRESTORE !== "1") {
      Alert.alert("Not available", "Official handicap sync isn't enabled in this build.");
      return;
    }
    setHnaBusy(true);
    try {
      const mod = require("../services/hna") as typeof import("../services/hna");
      const res = await mod.lookupHandicapFromHna(saId.trim());
      if (!res.configured) {
        Alert.alert("Not connected yet", "Official HNA sync isn't switched on for your club yet — enter your index manually for now.");
      } else if (res.handicapIndex == null) {
        Alert.alert("Not found", "That SA Player ID isn't in your club's HNA records. Check the number, or enter your index manually.");
      } else {
        setPlayerHandicap(res.handicapIndex);
        Alert.alert("Updated", `Your handicap index is now ${res.handicapIndex}, from HNA.`);
      }
    } catch {
      Alert.alert("Couldn't reach HNA", "Try again shortly, or enter your index manually.");
    } finally {
      setHnaBusy(false);
    }
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
        <MoreLink emoji="📈" label="My Golf — handicap & history" onPress={() => navigation.navigate("MyGolf")} />
        <MoreLink emoji="🎒" label="AI Caddie" onPress={() => navigation.navigate("Caddie")} />
        <MoreLink emoji="📊" label="Strokes-gained stats" onPress={() => navigation.navigate("Stats")} />
        <MoreLink emoji="🧭" label="Course strategy" onPress={() => navigation.navigate("Strategy")} />
        <MoreLink emoji="🎮" label="Range games" onPress={() => navigation.navigate("Games")} />
        <MoreLink emoji="👥" label="Player directory" onPress={() => navigation.navigate("PlayerDirectory")} />
        <MoreLink emoji="⌚" label="Set up your watch" onPress={() => navigation.navigate("WatchSetup")} last={!IAP_ENABLED} />
        {IAP_ENABLED && (
          <MoreLink emoji="⛳" label="ForeAi Pro" onPress={() => navigation.navigate("Upgrade")} last />
        )}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Club staff</Text>
        <MoreLink
          emoji="🏠"
          label="Clubhouse — sign in & tools"
          onPress={() => navigation.navigate("Clubhouse")}
          last
        />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Handicap</Text>
        <Text style={styles.hint}>
          Drives strokes received per hole and your net / Stableford scores. Course handicap:{" "}
          <Text style={{ color: colors.accent, fontWeight: "700" }}>{courseHcp}</Text>
        </Text>
        <Stepper label="Handicap index" value={playerHandicap} onChange={setPlayerHandicap} step={1} min={0} max={54} unit="" />
        <View style={{ marginTop: spacing.md }}>
          <TextField
            label="SA Player ID (HNA)"
            value={saId}
            onChangeText={setSaId}
            placeholder="e.g. 1234567"
            keyboardType="number-pad"
          />
          <Text style={styles.hint}>
            Your Handicaps Network Africa / Golf RSA player number. Add it once and, where your club
            has official sync switched on, your handicap index updates automatically for competitions.
          </Text>
          <Button
            variant="ghost"
            label={hnaBusy ? "Updating…" : "Update from HNA"}
            onPress={hnaBusy ? () => {} : updateFromHna}
            style={{ marginTop: spacing.sm }}
          />
        </View>
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
        <Text style={styles.hint}>
          Tap a club to add its make &amp; model and tune its carry. When you get a new club, mark it
          as new — we'll save the old one's numbers so you can see the difference it makes.
        </Text>
        {bag.map((club, i) => (
          <BagClubRow
            key={club.name}
            club={club}
            gear={gear[club.name]}
            comparison={clubComparison(club.name, gear, learned)}
            expanded={editing === i}
            onToggle={() => setEditing(editing === i ? null : i)}
            onCarryChange={(v) => updateCarry(i, v)}
            onSaveDetails={(make, model) => {
              setClubDetails(club.name, make, model);
              setEditing(null);
            }}
            onReplace={(make, model) => {
              replaceClub(club.name, make, model);
              setEditing(null);
            }}
          />
        ))}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.prefRow}>
          <View style={styles.prefText}>
            <Text style={styles.prefLabel}>⚡ Lightning alerts</Text>
            <Text style={styles.hint}>Loud warning when lightning is within ~10 km — keeps watching even when the app is closed.</Text>
          </View>
          <Switch
            value={prefs.lightning}
            onValueChange={(v) => togglePref("lightning", v)}
            trackColor={{ true: colors.accentDeep, false: colors.border }}
            thumbColor={prefs.lightning ? colors.accent : "#8aa"}
          />
        </View>
        <View style={styles.prefRow}>
          <View style={styles.prefText}>
            <Text style={styles.prefLabel}>⛳ Golf-day reminders</Text>
            <Text style={styles.hint}>The night before, before tee-off, and any organiser reminders.</Text>
          </View>
          <Switch
            value={prefs.reminders}
            onValueChange={(v) => togglePref("reminders", v)}
            trackColor={{ true: colors.accentDeep, false: colors.border }}
            thumbColor={prefs.reminders ? colors.accent : "#8aa"}
          />
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Connection</Text>
        <Text style={styles.hint}>
          The app runs fully on-device. When a backend is configured, rounds sync automatically.
        </Text>
        <Text style={styles.apiText}>API: {API_BASE}</Text>
        <Text style={styles.versionText}>
          ForeAi {APP_VERSION}
          {BUILD_NUMBER ? ` (${BUILD_NUMBER})` : ""} · {Platform.OS} {String(Platform.Version)}
        </Text>
      </Card>
    </Screen>
  );
}

// One row in "My bag": the club, its make/model, the carry pill, and — once a
// club's been replaced — how far the new one carries versus the old one.
function BagClubRow({
  club,
  gear,
  comparison,
  expanded,
  onToggle,
  onCarryChange,
  onSaveDetails,
  onReplace,
}: {
  club: { name: string; carry: number };
  gear?: ClubGear;
  comparison: ClubComparison | null;
  expanded: boolean;
  onToggle: () => void;
  onCarryChange: (yards: number) => void;
  onSaveDetails: (make: string, model: string) => void;
  onReplace: (make: string, model: string) => void;
}) {
  const label = gearLabel(gear);
  return (
    <View>
      <TouchableOpacity style={styles.clubRow} onPress={onToggle} activeOpacity={0.7}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.clubName}>{club.name}</Text>
          {label ? (
            <Text style={styles.clubGear}>{label}</Text>
          ) : (
            <Text style={styles.clubGearEmpty}>Add make &amp; model</Text>
          )}
          <ClubDelta comparison={comparison} />
        </View>
        <View style={styles.carryPill}>
          <Text style={styles.carryText}>{ydToM(club.carry)} m</Text>
        </View>
      </TouchableOpacity>
      {expanded && (
        <BagClubEditor
          club={club}
          gear={gear}
          onCarryChange={onCarryChange}
          onSaveDetails={onSaveDetails}
          onReplace={onReplace}
        />
      )}
    </View>
  );
}

// The "+8 m vs your old TaylorMade Qi9" line (or a "coming soon" note while the
// new club is still gathering shots).
function ClubDelta({ comparison }: { comparison: ClubComparison | null }) {
  if (!comparison) return null;
  const prevLabel =
    gearLabel({ make: comparison.prevMake, model: comparison.prevModel }) || "your old club";
  if (comparison.curCarry != null && comparison.prevCarry != null) {
    const deltaM = ydToM(comparison.curCarry) - ydToM(comparison.prevCarry);
    const longer = deltaM > 0;
    const same = deltaM === 0;
    const tone = same ? colors.textMuted : longer ? colors.accent : colors.negative;
    const arrow = same ? "=" : longer ? "▲" : "▼";
    const sign = deltaM > 0 ? "+" : "";
    return (
      <Text style={[styles.clubDelta, { color: tone }]}>
        {arrow} {sign}
        {deltaM} m vs {prevLabel}
      </Text>
    );
  }
  return (
    <Text style={styles.clubDeltaPending}>
      {comparison.curSamples}/{MIN_SAMPLES} shots on the new club — carry vs {prevLabel} coming soon
    </Text>
  );
}

// The expanded editor for a bag slot: make/model, carry, and the "new club"
// switch that triggers a fresh-distances swap.
function BagClubEditor({
  club,
  gear,
  onCarryChange,
  onSaveDetails,
  onReplace,
}: {
  club: { name: string; carry: number };
  gear?: ClubGear;
  onCarryChange: (yards: number) => void;
  onSaveDetails: (make: string, model: string) => void;
  onReplace: (make: string, model: string) => void;
}) {
  const [make, setMake] = useState(gear?.make ?? "");
  const [model, setModel] = useState(gear?.model ?? "");
  const [isNew, setIsNew] = useState(false);
  const hasExisting = !!gearLabel(gear);

  const save = () => {
    const m = make.trim();
    const md = model.trim();
    if (isNew && hasExisting) {
      Alert.alert(
        "New club",
        `Start fresh distances for your ${club.name}? We'll save your current ${gearLabel(
          gear
        )} numbers so the new club can be compared against them.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Start fresh", onPress: () => onReplace(m, md) },
        ]
      );
    } else {
      onSaveDetails(m, md);
    }
  };

  return (
    <View style={styles.editBox}>
      <TextField label="Make" value={make} onChangeText={setMake} placeholder="e.g. TaylorMade" />
      <TextField label="Model" value={model} onChangeText={setModel} placeholder="e.g. Qi10" />
      <MetreStepper
        label={`${club.name} carry`}
        value={club.carry}
        onChange={onCarryChange}
        stepM={2}
        min={30}
        max={340}
      />
      {hasExisting && (
        <View style={styles.newRow}>
          <View style={styles.prefText}>
            <Text style={styles.newLabel}>New / different club</Text>
            <Text style={styles.hint}>
              Switch on if you've changed this club — its distances start fresh and we keep the old
              numbers to compare against.
            </Text>
          </View>
          <Switch
            value={isNew}
            onValueChange={setIsNew}
            trackColor={{ true: colors.accentDeep, false: colors.border }}
            thumbColor={isNew ? colors.accent : "#8aa"}
          />
        </View>
      )}
      <Button label={isNew && hasExisting ? "Save new club" : "Save club"} onPress={save} />
    </View>
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
  prefRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  prefText: { flex: 1 },
  prefLabel: { color: colors.text, fontSize: 16, fontWeight: "700" },
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
  clubGear: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  clubGearEmpty: { color: colors.textFaint, fontSize: 13, marginTop: 2, fontStyle: "italic" },
  clubDelta: { fontSize: 13, fontWeight: "700", marginTop: 3 },
  clubDeltaPending: { color: colors.textFaint, fontSize: 12, marginTop: 3 },
  carryPill: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  carryText: { color: colors.accent, fontWeight: "700" },
  editBox: { paddingVertical: spacing.sm },
  newRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  newLabel: { color: colors.text, fontSize: 15, fontWeight: "700" },
  apiText: { color: colors.textFaint, fontSize: 13, marginTop: 4 },
  versionText: { color: colors.textFaint, fontSize: 12, marginTop: 10, fontWeight: "700", letterSpacing: 0.3 },
});
