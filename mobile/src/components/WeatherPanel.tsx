import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Coord } from "../lib/geo";
import { fetchLiveWeather, PanelWeather } from "../services/weather";
import { API_BASE } from "../services/api";
import { initLightningAlarm, maybeLightningAlarm } from "../lib/lightningAlarm";
import { colors, spacing, radius } from "../theme";

// On-course weather with a LIVE lightning warning. Reads the backend (real
// detected strikes with distance/direction when a provider key is set), falling
// back to the forecast. Refreshes every few minutes; metric (°C, km/h) for SA.
// `compact` trims it for the golf-day / Events screen.
export default function WeatherPanel({ coord, compact }: { coord: Coord | null; compact?: boolean }) {
  const [wx, setWx] = React.useState<PanelWeather | null>(null);
  const [state, setState] = React.useState<"idle" | "loading" | "ok" | "failed">("idle");

  React.useEffect(() => {
    initLightningAlarm();
  }, []);

  React.useEffect(() => {
    if (!coord) return;
    let cancelled = false;
    const load = async () => {
      setState((s) => (s === "ok" ? s : "loading"));
      const r = await fetchLiveWeather(coord, API_BASE);
      if (cancelled) return;
      if (r) {
        setWx(r);
        setState("ok");
        maybeLightningAlarm(r); // loud alarm if lightning is within ~10 km
      } else {
        setState((s) => (s === "ok" ? s : "failed"));
      }
    };
    load();
    // Strikes move fast — refresh every 2 min when there's a live provider.
    const id = setInterval(load, 2 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [coord ? Math.round(coord.lat * 100) : 0, coord ? Math.round(coord.lng * 100) : 0]);

  if (!coord) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Weather</Text>
        <Text style={styles.faint}>Turn on location to see conditions and lightning alerts.</Text>
      </View>
    );
  }
  if (state === "loading" || state === "idle") {
    return (
      <View style={[styles.wrap, styles.row]}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.faint}>Checking the sky…</Text>
      </View>
    );
  }
  if (state === "failed" || !wx) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Weather</Text>
        <Text style={styles.faint}>Couldn't reach the weather service. It'll retry shortly.</Text>
      </View>
    );
  }

  const { level, message, source, strikeCount } = wx.lightning;
  const live = source === "strikes";
  const banner =
    level === "warning"
      ? { bg: "rgba(255,107,107,0.16)", border: colors.negative, fg: colors.negative, icon: "⚡", label: "LIGHTNING WARNING" }
      : level === "watch"
      ? { bg: colors.goldSoft, border: colors.warning, fg: colors.warning, icon: "⛈️", label: "STORM WATCH" }
      : null;

  // Compact (Events / golf-day): the safety banner only, else a one-liner.
  if (compact) {
    return (
      <View style={styles.wrap}>
        {banner ? (
          <View style={[styles.banner, { backgroundColor: banner.bg, borderColor: banner.border }]}>
            <Text style={styles.bannerIcon}>{banner.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerLabel, { color: banner.fg }]}>
                {banner.label}
                {live && strikeCount ? ` · ${strikeCount} strike${strikeCount === 1 ? "" : "s"} nearby` : ""}
              </Text>
              <Text style={styles.bannerMsg}>{message}</Text>
              {level === "warning" && <Text style={styles.bannerRule}>Stop play and shelter — never under trees.</Text>}
            </View>
          </View>
        ) : (
          <View style={styles.row}>
            <Text style={styles.okDot}>⚡</Text>
            <Text style={styles.faint}>
              {wx.condition} · {wx.tempC}°C · wind {wx.windKmh} km/h · <Text style={{ color: colors.positive, fontWeight: "700" }}>no lightning</Text>
              {live ? " (live)" : ""}
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {banner && (
        <View style={[styles.banner, { backgroundColor: banner.bg, borderColor: banner.border }]}>
          <Text style={styles.bannerIcon}>{banner.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerLabel, { color: banner.fg }]}>
              {banner.label}
              {live && strikeCount ? ` · ${strikeCount} nearby` : ""}
            </Text>
            <Text style={styles.bannerMsg}>{message}</Text>
            {level === "warning" && <Text style={styles.bannerRule}>Stop play and shelter in a building or vehicle — never under trees.</Text>}
          </View>
        </View>
      )}

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Weather</Text>
            {live && <Text style={styles.liveChip}>● LIVE STRIKES</Text>}
          </View>
          <Text style={styles.cond}>{wx.condition}</Text>
        </View>
        <Text style={styles.temp}>
          {wx.tempC}
          <Text style={styles.tempUnit}>°C</Text>
        </Text>
      </View>

      <View style={styles.metrics}>
        <Metric label="Wind" value={`${wx.windKmh} km/h`} />
        <Metric label="Gusts" value={`${wx.gustKmh} km/h`} />
        {!banner && <Metric label="Lightning" value="Clear" good />}
      </View>
    </View>
  );
}

function Metric({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, good && { color: colors.positive }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: colors.textFaint, fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  liveChip: { color: colors.negative, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  faint: { color: colors.textFaint, fontSize: 13, flex: 1 },
  okDot: { fontSize: 16 },
  cond: { color: colors.text, fontSize: 20, fontWeight: "800", marginTop: 2 },
  temp: { color: colors.text, fontSize: 40, fontWeight: "800", lineHeight: 42 },
  tempUnit: { fontSize: 16, fontWeight: "700", color: colors.textFaint },
  metrics: { flexDirection: "row", gap: spacing.sm },
  metric: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 10 },
  metricLabel: { color: colors.textFaint, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  metricValue: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 2 },
  banner: { flexDirection: "row", gap: spacing.sm, borderWidth: 1, borderRadius: radius.sm, padding: spacing.sm, alignItems: "flex-start" },
  bannerIcon: { fontSize: 22, marginTop: 1 },
  bannerLabel: { fontSize: 13, fontWeight: "900", letterSpacing: 0.5 },
  bannerMsg: { color: colors.text, fontSize: 14, fontWeight: "700", marginTop: 2 },
  bannerRule: { color: colors.textMuted, fontSize: 12, marginTop: 3, lineHeight: 16 },
});
