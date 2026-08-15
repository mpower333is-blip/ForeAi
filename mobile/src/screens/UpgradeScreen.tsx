import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Screen, Card, Button, Chip, IconChip } from "../components/ui";
import { StoreButtons, shareApp } from "../components/Upsell";
import { colors, spacing, radius, type } from "../theme";
import { usePlan } from "../state/PlanContext";
import {
  PACKAGE_NAME,
  PACKAGE_PRICE,
  FREE_FEATURES,
  PRO_FEATURES,
} from "../config/appConfig";

export default function UpgradeScreen({ navigation }: any) {
  const { isPro, purchase, restore } = usePlan();

  return (
    <Screen>
      <View style={styles.head}>
        <IconChip emoji="⛳" tone="gold" />
        <Text style={styles.title}>{PACKAGE_NAME}</Text>
        <Text style={styles.subtitle}>
          {isPro
            ? "You've unlocked the full package. Enjoy every feature — thanks for supporting ForeAi!"
            : "Try the demo free. Unlock the full game-improvement toolkit when you're ready."}
        </Text>
      </View>

      {!isPro && (
        <Card accent>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{PACKAGE_PRICE}</Text>
            <Chip label="ONE-OFF" tone="gold" />
          </View>
          <Text style={styles.priceHint}>Unlock everything below on this device.</Text>
          <Button label={`Unlock ${PACKAGE_NAME}`} icon="🔓" onPress={purchase} />
          <Button variant="ghost" label="Restore purchase" onPress={restore} />
        </Card>
      )}

      <Card>
        <Text style={styles.groupTitle}>✓ Free — always</Text>
        {FREE_FEATURES.map((f) => (
          <FeatureRow key={f} label={f} tone="free" />
        ))}
      </Card>

      <Card>
        <View style={styles.groupHead}>
          <Text style={styles.groupTitle}>★ {PACKAGE_NAME}</Text>
          {isPro ? <Chip label="ACTIVE" tone="accent" /> : <Chip label="LOCKED" tone="muted" />}
        </View>
        {PRO_FEATURES.map((f) => (
          <FeatureRow key={f} label={f} tone={isPro ? "on" : "pro"} />
        ))}
      </Card>

      <Card>
        <Text style={styles.groupTitle}>Share ForeAi</Text>
        <Text style={styles.shareBody}>
          Playing the golf day? Send teammates the app so everyone can score live.
        </Text>
        <Button variant="ghost" label="Share the app" icon="↗" onPress={shareApp} />
        <View style={{ height: spacing.sm }} />
        <StoreButtons />
      </Card>

      <Button variant="ghost" label="Back" onPress={() => navigation.goBack()} />
    </Screen>
  );
}

function FeatureRow({ label, tone }: { label: string; tone: "free" | "pro" | "on" }) {
  const mark = tone === "pro" ? "🔒" : "✓";
  const color = tone === "pro" ? colors.textFaint : colors.accent;
  return (
    <View style={styles.row}>
      <Text style={[styles.mark, { color }]}>{mark}</Text>
      <Text style={[styles.rowText, tone === "pro" && { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: "center", marginTop: spacing.sm, marginBottom: spacing.md, gap: 8 },
  title: { ...(type.h1 as any), color: colors.text, marginTop: 8 },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: "center", paddingHorizontal: spacing.sm },

  priceRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  price: { color: colors.gold, fontSize: 44, fontWeight: "800" },
  priceHint: { color: colors.textMuted, fontSize: 14, marginTop: 4, marginBottom: 4 },

  groupHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  groupTitle: { color: colors.text, fontSize: 17, fontWeight: "800", marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 6 },
  mark: { fontSize: 16, fontWeight: "800", width: 20 },
  rowText: { color: colors.text, fontSize: 15, flex: 1, lineHeight: 21 },

  shareBody: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 4 },
});
