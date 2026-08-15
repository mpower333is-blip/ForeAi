import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking, Share, Platform } from "react-native";
import { Screen, Card, Button, IconChip, Chip } from "./ui";
import { colors, spacing, radius, type } from "../theme";
import { usePlan } from "../state/PlanContext";
import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  LANDING_URL,
  FEATURE_LABELS,
  FeatureKey,
} from "../config/appConfig";

export function openUrl(url: string) {
  Linking.openURL(url).catch(() => {});
}

export function shareApp() {
  Share.share({
    message: `Get ForeAi — your AI golf caddie & swing coach. Download: ${LANDING_URL}`,
  }).catch(() => {});
}

// App Store + Google Play buttons.
export function StoreButtons() {
  return (
    <View style={styles.storeRow}>
      <TouchableOpacity style={styles.store} activeOpacity={0.85} onPress={() => openUrl(APP_STORE_URL)}>
        <Text style={styles.storeGlyph}></Text>
        <View>
          <Text style={styles.storeSmall}>Download on the</Text>
          <Text style={styles.storeBig}>App Store</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.store} activeOpacity={0.85} onPress={() => openUrl(PLAY_STORE_URL)}>
        <Text style={styles.storeGlyph}>▶</Text>
        <View>
          <Text style={styles.storeSmall}>GET IT ON</Text>
          <Text style={styles.storeBig}>Google Play</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// A slim ribbon shown at the top of a free demo feature (Caddie / Coach).
// Hides itself once the full package is unlocked.
export function DemoBanner({ onUpgrade }: { onUpgrade: () => void }) {
  const { isPro } = usePlan();
  if (isPro) return null;
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onUpgrade} style={styles.ribbon}>
      <Chip label="DEMO" tone="gold" />
      <Text style={styles.ribbonText}>You're trying the free demo — tap to unlock the full package.</Text>
      <Text style={styles.ribbonArrow}>›</Text>
    </TouchableOpacity>
  );
}

// The full-screen lock shown when a Pro-only feature is opened on the demo.
export function UpgradeGate({ feature, navigation }: { feature: FeatureKey; navigation: any }) {
  const label = FEATURE_LABELS[feature];
  return (
    <Screen>
      <View style={styles.gateWrap}>
        <IconChip emoji="🔒" tone="gold" />
        <Text style={styles.gateTitle}>{label} is part of ForeAi Pro</Text>
        <Text style={styles.gateBody}>
          This is a free demo. Swing Coach and AI Caddie are open to try, and Golf Days work fully so
          you can play the day. Unlock {label.toLowerCase()} and everything else with the full package.
        </Text>
        <Button label="See what's included" onPress={() => navigation.navigate("Upgrade")} />
        <Button variant="ghost" label="Back" onPress={() => navigation.goBack()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  storeRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  store: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#000",
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  storeGlyph: { color: "#fff", fontSize: 26 },
  storeSmall: { color: "#cfd8d0", fontSize: 10, fontWeight: "600" },
  storeBig: { color: "#fff", fontSize: 16, fontWeight: "800", marginTop: -1 },

  ribbon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  ribbonText: { color: colors.text, fontSize: 13, fontWeight: "600", flex: 1, lineHeight: 18 },
  ribbonArrow: { color: colors.gold, fontSize: 22, fontWeight: "800" },

  gateWrap: { alignItems: "center", paddingTop: spacing.xl, gap: spacing.sm },
  gateTitle: { ...(type.h1 as any), color: colors.text, textAlign: "center", marginTop: spacing.md },
  gateBody: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
});
