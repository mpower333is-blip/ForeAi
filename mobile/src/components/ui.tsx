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
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, spacing, type, shadow, gradients } from "../theme";
import {
  ydToM,
  mToYd,
  DIST_UNIT,
  mphToKmh,
  kmhToMph,
  WIND_UNIT,
  fToC,
  cToF,
  TEMP_UNIT,
} from "../lib/units";

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void; // shows a back chevron (for pushed screens)
}) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
      ) : null}
      <View style={styles.headerRow}>
        <View style={styles.headerBar} />
        <Text style={styles.h1}>{title}</Text>
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

// A branded gradient hero banner — the product's first impression.
export function Hero({
  title,
  tagline,
  right,
}: {
  title: string;
  tagline?: string;
  right?: React.ReactNode;
}) {
  return (
    <LinearGradient
      colors={gradients.brand}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View style={styles.heroGlow} />
      <View style={styles.heroRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroBrand}>{title}</Text>
          {tagline ? <Text style={styles.heroTag}>{tagline}</Text> : null}
        </View>
        {right}
      </View>
    </LinearGradient>
  );
}

// Small logo mark: a golf flag on a green — pure views, no asset needed.
export function FlagMark({ size = 44 }: { size?: number }) {
  return (
    <View style={[styles.flagWrap, { width: size, height: size, borderRadius: size / 3 }]}>
      <View style={styles.flagPole} />
      <View style={styles.flagCloth} />
      <View style={styles.flagBall} />
    </View>
  );
}

export function Card({
  children,
  style,
  accent,
  onPress,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  accent?: boolean;
  onPress?: () => void;
}) {
  const inner = <View style={[styles.card, accent && styles.cardAccent, style]}>{children}</View>;
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
}

// A rounded pill for tags/labels (e.g. "GPS", "Live", sponsor tiers).
export function Chip({
  label,
  tone = "accent",
  style,
}: {
  label: string;
  tone?: "accent" | "gold" | "sky" | "muted";
  style?: ViewStyle;
}) {
  const bg =
    tone === "gold"
      ? colors.goldSoft
      : tone === "muted"
      ? colors.surfaceAlt
      : colors.accentSoft;
  const fg =
    tone === "gold"
      ? colors.gold
      : tone === "sky"
      ? colors.sky
      : tone === "muted"
      ? colors.textMuted
      : colors.accent;
  return (
    <View style={[styles.chip, { backgroundColor: bg }, style]}>
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

// A rounded emoji "app icon" tile used to head feature cards.
export function IconChip({ emoji, tone = "accent" }: { emoji: string; tone?: "accent" | "gold" | "sky" }) {
  const bg = tone === "gold" ? colors.goldSoft : tone === "sky" ? "rgba(107,213,255,0.14)" : colors.accentSoft;
  return (
    <View style={[styles.iconChip, { backgroundColor: bg }]}>
      <Text style={styles.iconChipText}>{emoji}</Text>
    </View>
  );
}

// A friendly, consistent empty state — icon, title, one line, optional action.
export function EmptyState({
  emoji,
  title,
  body,
  actionLabel,
  onAction,
}: {
  emoji: string;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <Text style={styles.emptyEmoji}>{emoji}</Text>
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={{ alignSelf: "stretch" }} />
      ) : null}
    </View>
  );
}

// An inline loading row (spinner + label) for consistent loading moments.
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <View style={styles.loadingRow}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
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
  tone?: "accent" | "positive" | "negative" | "neutral" | "gold";
}) {
  const valueColor =
    tone === "negative"
      ? colors.negative
      : tone === "neutral"
      ? colors.text
      : tone === "gold"
      ? colors.gold
      : colors.accent;
  return (
    <View style={styles.tile}>
      <View style={[styles.tileAccent, { backgroundColor: valueColor }]} />
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
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost";
  style?: ViewStyle;
  icon?: string;
}) {
  const isGhost = variant === "ghost";
  const content = (
    <Text style={[styles.btnText, isGhost && styles.btnTextGhost]}>
      {icon ? `${icon}  ` : ""}
      {label}
    </Text>
  );
  if (isGhost) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={[styles.btn, styles.btnGhost, style]}>
        {content}
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[styles.btnWrap, style]}>
      <LinearGradient
        colors={gradients.accent}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.btn}
      >
        {content}
      </LinearGradient>
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

// A distance stepper that stores YARDS but shows/edits METRES. `value`, `onChange`,
// `min` and `max` are all in yards — identical to Stepper — so callers keep their
// yard-based state and the golf engine sees yards, while the player sees metres.
export function MetreStepper({
  label,
  value,
  onChange,
  stepM = 5,
  min = 0,
  max = 9999,
}: {
  label: string;
  value: number; // yards
  onChange: (yards: number) => void;
  stepM?: number; // step size in metres
  min?: number; // yards
  max?: number; // yards
}) {
  return (
    <Stepper
      label={label}
      value={ydToM(value)}
      onChange={(m) => onChange(mToYd(m))}
      step={stepM}
      min={ydToM(min)}
      max={ydToM(max)}
      unit={DIST_UNIT}
    />
  );
}

// A wind stepper that stores MPH (what the engine wants) but shows/edits km/h.
export function KmhStepper({
  label,
  value,
  onChange,
  stepKmh = 5,
  min = 0,
  max = 9999,
}: {
  label: string;
  value: number; // mph
  onChange: (mph: number) => void;
  stepKmh?: number;
  min?: number; // mph
  max?: number; // mph
}) {
  return (
    <Stepper
      label={label}
      value={mphToKmh(value)}
      onChange={(k) => onChange(kmhToMph(k))}
      step={stepKmh}
      min={mphToKmh(min)}
      max={mphToKmh(max)}
      unit={WIND_UNIT}
    />
  );
}

// A temperature stepper that stores °F (engine baseline) but shows/edits °C.
export function CelsiusStepper({
  label,
  value,
  onChange,
  stepC = 2,
  min = 0,
  max = 9999,
}: {
  label: string;
  value: number; // °F
  onChange: (f: number) => void;
  stepC?: number;
  min?: number; // °F
  max?: number; // °F
}) {
  return (
    <Stepper
      label={label}
      value={fToC(value)}
      onChange={(c) => onChange(cToF(c))}
      step={stepC}
      min={fToC(min)}
      max={fToC(max)}
      unit={TEMP_UNIT}
    />
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

  backBtn: { marginBottom: spacing.sm },
  backText: { color: colors.accent, fontSize: 16, fontWeight: "700" },
  headerRow: { flexDirection: "row", alignItems: "center" },
  headerBar: {
    width: 4,
    height: 26,
    borderRadius: 2,
    backgroundColor: colors.accent,
    marginRight: 10,
  },
  h1: { ...(type.h1 as TextStyle), color: colors.text },
  subtitle: { ...(type.body as TextStyle), color: colors.textMuted, marginTop: 6, marginLeft: 14 },

  // Hero
  hero: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...shadow.card,
  },
  heroGlow: {
    position: "absolute",
    top: -60,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.accentSoft,
  },
  heroRow: { flexDirection: "row", alignItems: "center" },
  heroBrand: { ...(type.brand as TextStyle), color: colors.accent },
  heroTag: { fontSize: 15, color: colors.textMuted, marginTop: 4, fontWeight: "600" },

  flagWrap: { backgroundColor: colors.surfaceHi, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  flagPole: { position: "absolute", left: "46%", top: "20%", width: 2, height: "55%", backgroundColor: colors.text },
  flagCloth: {
    position: "absolute",
    left: "52%",
    top: "22%",
    width: "26%",
    height: "16%",
    backgroundColor: colors.accent,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  flagBall: {
    position: "absolute",
    bottom: "20%",
    left: "40%",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  cardAccent: { backgroundColor: colors.surfaceAlt, borderColor: colors.accentDeep },

  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  chipText: { fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },

  iconChip: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  iconChipText: { fontSize: 22 },

  tile: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexGrow: 1,
    flexBasis: "30%",
    minWidth: 100,
    overflow: "hidden",
    ...shadow.soft,
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyEmoji: { fontSize: 30 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 320,
  },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: spacing.md },
  loadingText: { color: colors.textMuted, fontSize: 14 },

  tileAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 3, opacity: 0.9 },
  tileLabel: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  tileValue: { fontSize: 30, fontWeight: "800", marginTop: 6 },
  tileHint: { color: colors.textFaint, fontSize: 12, marginTop: 2 },

  btnWrap: { borderRadius: radius.md, marginTop: spacing.sm, overflow: "hidden", ...shadow.glow },
  btn: {
    borderRadius: radius.md,
    paddingVertical: 16,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  btnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.accentDim,
    marginTop: spacing.sm,
  },
  btnText: { color: colors.onAccent, fontWeight: "800", fontSize: 16 },
  btnTextGhost: { color: colors.accent },

  fieldLabel: { color: colors.textMuted, fontSize: 14, marginBottom: 8, fontWeight: "600" },
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
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  segText: { color: colors.textMuted, fontWeight: "600" },
  segTextActive: { color: colors.onAccent },

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
