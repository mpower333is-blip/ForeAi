import React from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Coord } from "../lib/geo";
import { fetchOutlook, WeatherOutlook as Outlook } from "../services/weather";
import { colors, spacing, radius } from "../theme";

// A short hour-by-hour outlook for someone deciding whether to head out to play:
// a plain "good to play / storms coming" verdict up top, then the next several
// hours (temp, sky, rain chance, a ⚡ on any thunderstorm hour). Complements the
// live LightningStrip (now) with the forecast (later).
function codeEmoji(code: number): string {
  if (code >= 95) return "⛈️";
  if (code >= 80) return "🌦️";
  if (code >= 71) return "🌨️";
  if (code >= 61) return "🌧️";
  if (code >= 51) return "🌦️";
  if (code === 45 || code === 48) return "🌫️";
  if (code === 3) return "☁️";
  if (code === 2) return "⛅";
  if (code === 1) return "🌤️";
  if (code === 0) return "☀️";
  return "•";
}

export default function WeatherOutlook({ coord }: { coord: Coord | null }) {
  const [data, setData] = React.useState<Outlook | null>(null);
  const [state, setState] = React.useState<"idle" | "loading" | "ok" | "failed">("idle");

  const key = coord ? `${Math.round(coord.lat * 100)},${Math.round(coord.lng * 100)}` : "";
  React.useEffect(() => {
    if (!coord) return;
    let cancelled = false;
    const load = async () => {
      setState((s) => (s === "ok" ? s : "loading"));
      const r = await fetchOutlook(coord);
      if (cancelled) return;
      if (r) {
        setData(r);
        setState("ok");
      } else {
        setState((s) => (s === "ok" ? s : "failed"));
      }
    };
    load();
    const id = setInterval(load, 15 * 60 * 1000); // outlook shifts slowly
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [key]);

  if (!coord || state === "failed") return null; // stay quiet if we can't help
  if (state === "loading" || state === "idle" || !data) {
    return (
      <View style={[styles.wrap, styles.center]}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.faint}>Loading the outlook…</Text>
      </View>
    );
  }

  const v = data.verdict;
  const tone =
    v.level === "warning" ? colors.negative : v.level === "watch" ? colors.warning : colors.positive;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Planning to play?</Text>

      <View style={[styles.verdict, { borderColor: tone, backgroundColor: tone + "22" }]}>
        <View style={[styles.dot, { backgroundColor: tone }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.verdictHead, { color: tone }]}>{v.headline}</Text>
          <Text style={styles.verdictDetail}>{v.detail}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.hoursRow}
      >
        {data.hours.map((h, i) => (
          <View key={i} style={[styles.hour, h.storm && styles.hourStorm]}>
            <Text style={styles.hourTime}>{h.time}</Text>
            <Text style={styles.hourIcon}>{codeEmoji(h.code)}</Text>
            <Text style={styles.hourTemp}>{h.tempC}°</Text>
            <Text style={[styles.hourRain, h.rainProb >= 50 && { color: colors.sky }]}>
              💧{h.rainProb}%
            </Text>
            {h.storm ? <Text style={styles.hourBolt}>⚡</Text> : null}
          </View>
        ))}
      </ScrollView>
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
  center: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  faint: { color: colors.textFaint, fontSize: 13 },
  title: { color: colors.textFaint, fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },

  verdict: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderRadius: radius.sm, padding: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  verdictHead: { fontSize: 15, fontWeight: "900", letterSpacing: 0.3 },
  verdictDetail: { color: colors.text, fontSize: 13, marginTop: 2, lineHeight: 18 },

  hoursRow: { gap: 8, paddingTop: 2 },
  hour: {
    alignItems: "center",
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 60,
    gap: 2,
  },
  hourStorm: { borderWidth: 1, borderColor: colors.negative, backgroundColor: "rgba(255,107,107,0.12)" },
  hourTime: { color: colors.textFaint, fontSize: 12, fontWeight: "700" },
  hourIcon: { fontSize: 20 },
  hourTemp: { color: colors.text, fontSize: 15, fontWeight: "800" },
  hourRain: { color: colors.textFaint, fontSize: 11, fontWeight: "700" },
  hourBolt: { fontSize: 12, marginTop: 1 },
});
