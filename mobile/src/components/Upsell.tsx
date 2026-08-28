import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking, Share, Platform } from "react-native";
import Svg, { Path, G } from "react-native-svg";
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

// The Apple logo, drawn as a vector so it renders on Android too. The old
// text glyph () is an Apple private-use codepoint that shows nothing on
// non-Apple devices.
function AppleLogo({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#fff"
        d="M17.05 12.94c-.03-2.4 1.96-3.55 2.05-3.61-1.12-1.64-2.86-1.86-3.48-1.89-1.48-.15-2.89.87-3.64.87-.75 0-1.91-.85-3.14-.83-1.62.02-3.11.94-3.94 2.39-1.68 2.92-.43 7.24 1.21 9.61.8 1.16 1.76 2.46 3.02 2.41 1.21-.05 1.67-.78 3.14-.78 1.46 0 1.88.78 3.16.76 1.3-.02 2.13-1.18 2.93-2.35.92-1.35 1.3-2.66 1.32-2.73-.03-.01-2.53-.97-2.56-3.86zM14.63 5.9c.67-.81 1.12-1.94.99-3.06-.96.04-2.12.64-2.81 1.45-.62.72-1.16 1.87-1.02 2.97 1.07.08 2.17-.55 2.84-1.36z"
      />
    </Svg>
  );
}

// The Google Play triangle, in its four brand colours, drawn as a vector.
function PlayLogo({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <G>
        <Path fill="#00D2FF" d="M47 24 306 256 47 488c-9-5-15-15-15-27V51c0-12 6-22 15-27z" />
        <Path fill="#00F076" d="M47 24c4-2 9-3 14-3 8 0 16 2 23 6l278 160-56 69L47 24z" />
        <Path fill="#FF3A44" d="M306 256l56 69-278 160c-7 4-15 6-23 6-5 0-10-1-14-3l259-232z" />
        <Path fill="#FFC900" d="M362 187l84 48c17 10 17 32 0 42l-84 48-56-69 56-69z" />
      </G>
    </Svg>
  );
}

// App Store + Google Play buttons.
export function StoreButtons() {
  return (
    <View style={styles.storeRow}>
      <TouchableOpacity style={styles.store} activeOpacity={0.85} onPress={() => openUrl(APP_STORE_URL)}>
        <View style={styles.storeGlyph}><AppleLogo size={24} /></View>
        <View>
          <Text style={styles.storeSmall}>Download on the</Text>
          <Text style={styles.storeBig}>App Store</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.store} activeOpacity={0.85} onPress={() => openUrl(PLAY_STORE_URL)}>
        <View style={styles.storeGlyph}><PlayLogo size={22} /></View>
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
  storeGlyph: { width: 26, alignItems: "center", justifyContent: "center" },
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
