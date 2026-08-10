import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ScrollView,
  TextInput,
  KeyboardTypeOptions,
} from "react-native";
import { colors, radius, spacing, type } from "../theme";

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={styles.h1}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({
  children,
  style,
  accent,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  accent?: boolean;
}) {
  return (
    <View style={[styles.card, accent && styles.cardAccent, style]}>{children}</View>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "accent",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "accent" | "positive" | "negative" | "neutral";
}) {
  const valueColor =
    tone === "negative"
      ? colors.negative
      : tone === "neutral"
      ? colors.text
      : colors.accent;
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, { color: valueColor }]}>{value}</Text>
      {hint ? <Text style={styles.tileHint}>{hint}</Text> : null}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost";
  style?: ViewStyle;
}) {
  const isGhost = variant === "ghost";
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.btn, isGhost && styles.btnGhost, style]}
    >
      <Text style={[styles.btnText, isGhost && styles.btnTextGhost]}>{label}</Text>
    </TouchableOpacity>
  );
}

// A horizontal pill selector for enum-like inputs.
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <View style={styles.segRow}>
        {options.map((o) => {
          const active = o.key === value;
          return (
            <TouchableOpacity
              key={o.key}
              onPress={() => onChange(o.key)}
              activeOpacity={0.8}
              style={[styles.seg, active && styles.segActive]}
            >
              <Text style={[styles.segText, active && styles.segTextActive]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  style,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ marginBottom: spacing.md }, style]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

// A +/- stepper for numeric inputs (avoids finicky keyboards on-course).
export function Stepper({
  label,
  value,
  onChange,
  step = 5,
  min = 0,
  max = 9999,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.stepRow}>
        <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(clamp(value - step))}>
          <Text style={styles.stepBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepValue}>
          {value}
          {unit ? <Text style={styles.stepUnit}> {unit}</Text> : null}
        </Text>
        <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(clamp(value + step))}>
          <Text style={styles.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// A tiny horizontal bar chart for strokes-gained categories.
export function SGBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.min(1, Math.abs(value) / max);
  const positive = value >= 0;
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <View style={styles.sgHeader}>
        <Text style={styles.sgLabel}>{label}</Text>
        <Text style={[styles.sgValue, { color: positive ? colors.positive : colors.negative }]}>
          {positive ? "+" : ""}
          {value.toFixed(2)}
        </Text>
      </View>
      <View style={styles.sgTrack}>
        <View
          style={{
            width: `${pct * 100}%`,
            height: "100%",
            borderRadius: 6,
            backgroundColor: positive ? colors.accent : colors.negative,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: spacing.lg, paddingBottom: 60 },
  h1: { ...(type.h1 as TextStyle), color: colors.text },
  subtitle: { ...(type.body as TextStyle), color: colors.textMuted, marginTop: 4 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardAccent: { backgroundColor: colors.surfaceAlt },

  tile: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 100,
  },
  tileLabel: { color: colors.textMuted, fontSize: 13 },
  tileValue: { fontSize: 30, fontWeight: "800", marginTop: 6 },
  tileHint: { color: colors.textFaint, fontSize: 12, marginTop: 2 },

  btn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.accentDim },
  btnText: { color: "#062012", fontWeight: "800", fontSize: 16 },
  btnTextGhost: { color: colors.accent },

  fieldLabel: { color: colors.textMuted, fontSize: 14, marginBottom: 8 },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  segRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  seg: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  segText: { color: colors.textMuted, fontWeight: "600" },
  segTextActive: { color: "#062012" },

  stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepBtn: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepBtnText: { color: colors.accent, fontSize: 30, fontWeight: "700" },
  stepValue: { color: colors.text, fontSize: 30, fontWeight: "800" },
  stepUnit: { color: colors.textFaint, fontSize: 16, fontWeight: "500" },

  sgHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  sgLabel: { color: colors.textMuted, fontSize: 14 },
  sgValue: { fontWeight: "700", fontSize: 14 },
  sgTrack: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
});
