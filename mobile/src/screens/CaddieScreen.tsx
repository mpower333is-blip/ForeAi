import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Screen, ScreenHeader, Card, Button, Segmented, Stepper, MetreStepper } from "../components/ui";
import { DemoBanner } from "../components/Upsell";
import { colors, spacing, radius } from "../theme";
import { useRound } from "../state/RoundContext";
import { useLocation } from "../hooks/useLocation";
import { fetchWeather } from "../services/weather";
import { compass8 } from "../lib/geo";
import { ydToM } from "../lib/units";
import {
  recommendClub,
  Lie,
  isLearned,
  dispersionWindow,
  DEFAULT_BAG,
} from "../lib/golfEngine";

const LIES: { key: Lie; label: string }[] = [
  { key: "tee", label: "Tee" },
  { key: "fairway", label: "Fairway" },
  { key: "rough", label: "Rough" },
  { key: "sand", label: "Sand" },
  { key: "recovery", label: "Trees" },
];

export default function CaddieScreen({ navigation }: any) {
  const { effectiveBag, learned, calibrationHoles, isCalibrated } = useRound();
  const loc = useLocation();
  const [yardage, setYardage] = useState(155);
  const [wind, setWind] = useState(0);
  const [elevation, setElevation] = useState(0);
  const [lie, setLie] = useState<Lie>("fairway");
  const [temp, setTemp] = useState(70);
  const [wxNote, setWxNote] = useState<string | null>(null);
  const [wxBusy, setWxBusy] = useState(false);

  // Pull live temperature + wind from the player's location. Off-course there's
  // no target line, so we fill temperature and the wind speed, and note the
  // direction — the player sets + into / − down for the shot they're facing.
  const useLiveWeather = async () => {
    if (wxBusy) return;
    if (!loc.coord) {
      setWxNote("Turn on location to use live weather.");
      return;
    }
    setWxBusy(true);
    const w = await fetchWeather(loc.coord);
    setWxBusy(false);
    if (!w) {
      setWxNote("Couldn't reach the weather service — check your connection.");
      return;
    }
    setTemp(w.tempF);
    setWind(w.windMph);
    setWxNote(`${w.windMph} mph from ${compass8(w.windFromDeg)} · ${w.tempF}°F — set + into / − down`);
  };

  const rec = useMemo(
    () =>
      recommendClub(
        { yardage, windSpeed: wind, elevation, lie, temperature: temp },
        effectiveBag
      ),
    [yardage, wind, elevation, lie, temp, effectiveBag]
  );

  const learnedClub = isCalibrated && isLearned(rec.club, learned);
  const window = dispersionWindow(rec.club, learned);
  const dataBadge = isCalibrated ? (learnedClub ? "your data" : "default bag") : "calibrating";

  const confTone =
    rec.confidence === "high" ? colors.positive : rec.confidence === "medium" ? colors.warning : colors.negative;

  // Show learned clubs sorted by carry, with default-bag clubs filling the gaps.
  const smartRows = useMemo(() => {
    return DEFAULT_BAG.map((c) => {
      const l = learned[c.name];
      const trusted = l && l.samples >= 3;
      return {
        name: c.name,
        carry: trusted ? l.carry : c.carry,
        dispersion: trusted ? l.dispersion : null,
        samples: trusted ? l.samples : 0,
      };
    }).sort((a, b) => b.carry - a.carry);
  }, [learned]);

  const anyLearned = smartRows.some((r) => r.samples > 0);

  return (
    <Screen>
      <ScreenHeader title="AI Caddie" subtitle="Data-driven club calls that learn from every shot you log." onBack={() => navigation.goBack()} />
      <DemoBanner onUpgrade={() => navigation.navigate("Upgrade")} />

      {isCalibrated ? (
        <View style={styles.calDone}>
          <Text style={styles.calDoneText}>✓ Calibrated to your game — recommendations use your own distances</Text>
        </View>
      ) : (
        <View style={styles.calCard}>
          <Text style={styles.calTitle}>Calibrating your caddie</Text>
          <Text style={styles.calBody}>
            Play and log your first 18 holes so the caddie learns your real distances. Until then it
            uses solid default numbers.
          </Text>
          <View style={styles.calTrack}>
            <View style={[styles.calFill, { width: `${(calibrationHoles / 18) * 100}%` }]} />
          </View>
          <Text style={styles.calCount}>{calibrationHoles} / 18 holes logged</Text>
        </View>
      )}

      <Card accent>
        <Text style={styles.club}>{rec.club}</Text>
        <Text style={styles.plays}>plays {ydToM(rec.playingYards)} m</Text>

        <View style={styles.badgeRow}>
          <View style={[styles.confPill, { borderColor: confTone }]}>
            <Text style={[styles.confText, { color: confTone }]}>{rec.confidence} confidence</Text>
          </View>
          <View
            style={[
              styles.confPill,
              { borderColor: learnedClub ? colors.accent : !isCalibrated ? colors.warning : colors.border },
            ]}
          >
            <Text
              style={[
                styles.confText,
                { color: learnedClub ? colors.accent : !isCalibrated ? colors.warning : colors.textFaint },
              ]}
            >
              {dataBadge}
            </Text>
          </View>
        </View>

        <View style={styles.window}>
          <Text style={styles.windowText}>
            🎯 Expect to finish within{" "}
            <Text style={{ color: colors.accent, fontWeight: "800" }}>±{ydToM(window)} m</Text> of target
          </Text>
        </View>

        <View style={styles.notes}>
          {rec.notes.map((n, i) => (
            <Text key={i} style={styles.note}>
              • {n}
            </Text>
          ))}
        </View>
      </Card>

      <Card>
        <Button
          variant="ghost"
          label={wxBusy ? "Getting weather…" : "🌤 Use live weather"}
          onPress={useLiveWeather}
        />
        {wxNote && <Text style={styles.wxNote}>{wxNote}</Text>}
        <MetreStepper label="Distance to pin" value={yardage} onChange={setYardage} stepM={5} min={20} max={320} />
        <Stepper label="Wind (+ into / − down)" value={wind} onChange={setWind} step={2} min={-40} max={40} unit="mph" />
        <MetreStepper
          label="Elevation (+ up / − down)"
          value={elevation}
          onChange={setElevation}
          stepM={2}
          min={-40}
          max={40}
        />
        <Stepper label="Temperature" value={temp} onChange={setTemp} step={5} min={20} max={110} unit="°F" />
        <Segmented label="Lie" options={LIES} value={lie} onChange={setLie} />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Smart distances</Text>
        <Text style={styles.hint}>
          {anyLearned
            ? "Learned from your logged shots — dispersion shows your consistency."
            : "Log shots in a round and your real carry distances appear here automatically."}
        </Text>
        {smartRows.map((r) => (
          <View key={r.name} style={styles.distRow}>
            <Text style={styles.distName}>{r.name}</Text>
            <View style={styles.distRight}>
              {r.samples > 0 && (
                <Text style={styles.distDisp}>±{ydToM(r.dispersion!)}</Text>
              )}
              <Text style={[styles.distCarry, r.samples > 0 && { color: colors.accent }]}>
                {ydToM(r.carry)} m
              </Text>
              <Text style={styles.distTag}>{r.samples > 0 ? `${r.samples} shots` : "default"}</Text>
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  calCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  calTitle: { color: colors.warning, fontSize: 16, fontWeight: "800" },
  calBody: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 10 },
  calTrack: { height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: "hidden" },
  calFill: { height: "100%", borderRadius: 5, backgroundColor: colors.warning },
  calCount: { color: colors.textMuted, fontSize: 13, marginTop: 6, fontWeight: "600" },
  calDone: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  calDoneText: { color: colors.accent, fontSize: 14, fontWeight: "700" },

  club: { color: colors.accent, fontSize: 52, fontWeight: "800" },
  plays: { color: colors.text, fontSize: 18, marginTop: 2 },
  badgeRow: { flexDirection: "row", gap: 8, marginTop: spacing.sm },
  confPill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  confText: { fontWeight: "700", fontSize: 13 },
  window: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  windowText: { color: colors.textMuted, fontSize: 15 },
  notes: { marginTop: spacing.md },
  note: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },

  wxNote: { color: colors.accent, fontSize: 13, fontWeight: "600", marginTop: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: 4 },
  hint: { color: colors.textFaint, fontSize: 13, marginBottom: spacing.sm },
  distRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  distName: { color: colors.text, fontSize: 16, fontWeight: "600" },
  distRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  distDisp: { color: colors.textFaint, fontSize: 13 },
  distCarry: { color: colors.textMuted, fontSize: 16, fontWeight: "700", minWidth: 64, textAlign: "right" },
  distTag: { color: colors.textFaint, fontSize: 11, minWidth: 52, textAlign: "right" },
});
