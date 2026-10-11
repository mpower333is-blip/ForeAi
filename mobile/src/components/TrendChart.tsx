import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Polyline, Circle, Line } from "react-native-svg";
import { colors, spacing } from "../theme";

// A compact sparkline for the My Golf dashboard — plots a series (oldest→newest)
// such as score differentials or Stableford points. No axes clutter: just the
// line, the points, and the first/last value labels. Pure react-native-svg (no
// chart dependency).

type Props = {
  data: number[]; // oldest → newest
  color?: string;
  height?: number;
  label?: string;
  // Most golf metrics are "lower is better" (differential, score). Set false for
  // Stableford where higher is better — only affects the min/max framing hint.
  lowerIsBetter?: boolean;
};

export default function TrendChart({ data, color = colors.accent, height = 90, label, lowerIsBetter = true }: Props) {
  const W = 300; // viewBox width; the Svg scales to the container
  const H = height;
  const pad = 10;

  if (!data || data.length < 2) {
    return (
      <View style={[styles.wrap, { height: H }]}>
        <Text style={styles.empty}>Play a couple of rounds to see your trend.</Text>
      </View>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const n = data.length;
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (n - 1);
  const y = (v: number) => pad + ((max - v) / span) * (H - 2 * pad); // higher value → higher on screen

  const points = data.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const first = data[0];
  const last = data[n - 1];
  const improved = lowerIsBetter ? last < first : last > first;

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {/* baseline */}
        <Line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke={colors.border} strokeWidth={1} />
        <Polyline points={points} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((v, i) => (
          <Circle key={i} cx={x(i)} cy={y(v)} r={i === n - 1 ? 4 : 2.5} fill={i === n - 1 ? color : colors.surface} stroke={color} strokeWidth={1.5} />
        ))}
      </Svg>
      <View style={styles.footer}>
        <Text style={styles.cap}>{fmt(first)}</Text>
        <Text style={[styles.trend, { color: improved ? colors.positive : colors.textMuted }]}>
          {improved ? "▼ improving" : "▲ steady"}
        </Text>
        <Text style={[styles.cap, { color: color, fontWeight: "800" }]}>{fmt(last)}</Text>
      </View>
    </View>
  );
}

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.sm },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: 4 },
  empty: { color: colors.textMuted, fontSize: 14, textAlign: "center", paddingVertical: 24 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  cap: { color: colors.textMuted, fontSize: 12 },
  trend: { fontSize: 12, fontWeight: "700" },
});
