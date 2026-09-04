import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Coord } from "../lib/geo";
import { fetchWeatherReport, WeatherReport } from "../services/weather";
import { colors, spacing, radius } from "../theme";

// On-course weather with a lightning warning. Golf's real weather danger is
// lightning — this refreshes every few minutes and shows a clear WATCH / WARNING
// banner so players know to get off the course. Metric (°C, km/h) for SA.
export default function WeatherPanel({ coord }: { coord: Coord | null }) {
  const [report, setReport] = React.useState<WeatherReport | null>(null);
  const [state, setState] = React.useState<"idle" | "loading" | "ok" | "failed">("idle");

  React.useEffect(() => {
    if (!coord) return;
    let cancelled = false;
    const load = async () => {
      setState((s) => (s === "ok" ? s : "loading"));
      const r = await fetchWeatherReport(coord);
      if (cancelled) return;
      if (r) {
        setReport(r);
        setState("ok");
      } else {
        setState((s) => (s === "ok" ? s : "failed"));
      }
    };
    load();
    const id = setInterval(load, 5 * 60 * 1000); // refresh every 5 min
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // Re-fetch when the player moves ~1 km (rounded coords keep this stable).
  }, [coord ? Math.round(coord.lat * 100) : 0, coord ? Math.round(coord.lng * 100) : 0]);

  if (!coord) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Weather</Text>
        <Text style={styles.faint}>Turn on location to see on-course conditions and lightning alerts.</Text>
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
  if (state === "failed" || !report) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Weather</Text>
        <Text style={styles.faint}>Couldn't reach the weather service. It'll retry shortly.</Text>
      </View>
    );
  }

  const tempC = Math.round((report.tempF - 32) * (5 / 9));
  const windKmh = Math.round(report.windMph * 1.60934);
  const gustKmh = Math.round(report.gustMph * 1.60934);
  const { level, message, etaHours } = report.lightning;

  const banner =
    level === "warning"
      ? { bg: "rgba(255,107,107,0.16)", border: colors.negative, fg: colors.negative, icon: "⚡", label: "LIGHTNING WARNING" }
      : level === "watch"
      ? { bg: colors.goldSoft, border: colors.warning, fg: colors.warning, icon: "⛈️", label: "STORM WATCH" }
      : null;

  return (
    <View style={styles.wrap}>
      {banner && (
        <View style={[styles.banner, { backgroundColor: banner.bg, borderColor: banner.border }]}>
          <Text style={styles.bannerIcon}>{banner.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerLabel, { color: banner.fg }]}>
              {banner.label}
              {etaHours != null && etaHours > 0 ? ` · ~${etaHours}h` : ""}
            </Text>
            <Text style={styles.bannerMsg}>{message}</Text>
            {level === "warning" && <Text style={styles.bannerRule}>Stop play and shelter in a building or vehicle — never under trees.</Text>}
          </View>
        </View>
      )}

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Weather</Text>
          <Text style={styles.cond}>{report.condition}</Text>
        </View>
        <Text style={styles.temp}>
          {tempC}
          <Text style={styles.tempUnit}>°C</Text>
        </Text>
      </View>

      <View style={styles.metrics}>
        <Metric label="Wind" value={`${windKmh} km/h`} />
        <Metric label="Gusts" value={`${gustKmh} km/h`} />
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
  title: { color: colors.textFaint, fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  faint: { color: colors.textFaint, fontSize: 13 },
  cond: { color: colors.text, fontSize: 20, fontWeight: "800", marginTop: 2 },
  temp: { color: colors.text, fontSize: 40, fontWeight: "800", lineHeight: 42 },
  tempUnit: { fontSize: 16, fontWeight: "700", color: colors.textFaint },
  metrics: { flexDirection: "row", gap: spacing.sm },
  metric: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 10 },
  metricLabel: { color: colors.textFaint, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  metricValue: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 2 },
  banner: {
    flexDirection: "row",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
    alignItems: "flex-start",
  },
  bannerIcon: { fontSize: 22, marginTop: 1 },
  bannerLabel: { fontSize: 13, fontWeight: "900", letterSpacing: 0.5 },
  bannerMsg: { color: colors.text, fontSize: 14, fontWeight: "700", marginTop: 2 },
  bannerRule: { color: colors.textMuted, fontSize: 12, marginTop: 3, lineHeight: 16 },
});
