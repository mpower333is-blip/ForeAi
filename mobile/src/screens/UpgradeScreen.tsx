import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Linking, Platform, Alert } from "react-native";
import { Screen, Card, Button, Chip, IconChip } from "../components/ui";
import { shareApp } from "../components/Upsell";
import { colors, spacing, type } from "../theme";
import { usePlan } from "../state/PlanContext";
import type { SubPackage } from "../services/purchases";
import {
  PACKAGE_NAME,
  PACKAGE_PRICE,
  FREE_FEATURES,
  PRO_FEATURES,
} from "../config/appConfig";

// Required on a subscription paywall by both App Store and Play Store. Both are
// self-hosted so the links work identically on iOS and Android (Apple also
// accepts its standard EULA, but Google prefers your own Terms).
const PRIVACY_URL = "https://foreai.co.za/privacy.html";
const TERMS_URL = "https://foreai.co.za/terms.html";

function periodLabel(p: SubPackage["period"]): string {
  return p === "monthly" ? "Monthly" : p === "annual" ? "Annual" : "Subscribe";
}

export default function UpgradeScreen({ navigation }: any) {
  const { isPro, configured, packages, refreshPackages, purchasePackage, restore } = usePlan();
  const [busy, setBusy] = useState(false);

  // Re-check the store for plans whenever the paywall opens (new subs can lag).
  useEffect(() => {
    refreshPackages().catch(() => {});
  }, [refreshPackages]);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      Alert.alert("Purchase problem", e?.message || "Could not complete the purchase. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const reload = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await refreshPackages();
    } finally {
      setBusy(false);
    }
  };

  const hasPlans = configured && packages.length > 0;

  return (
    <Screen>
      <View style={styles.head}>
        <IconChip emoji="⛳" tone="gold" />
        <Text style={styles.title}>{PACKAGE_NAME}</Text>
        <Text style={styles.subtitle}>
          {isPro
            ? "You're subscribed to the full package. Enjoy every feature — thanks for supporting ForeAi!"
            : "Try the demo free. Subscribe to unlock the full game-improvement toolkit."}
        </Text>
      </View>

      {!isPro && (
        <Card accent>
          {hasPlans ? (
            <>
              <Text style={styles.priceHint}>Choose a plan — cancel anytime.</Text>
              {packages.map((pkg) => (
                <View key={pkg.id} style={styles.planRow}>
                  <Button
                    label={`${periodLabel(pkg.period)} — ${pkg.priceString}`}
                    icon="🔓"
                    variant={pkg.period === "monthly" ? "ghost" : undefined}
                    onPress={() => run(() => purchasePackage(pkg))}
                    style={{ flex: 1 }}
                  />
                  {pkg.period === "annual" && <Chip label="BEST VALUE" tone="gold" />}
                </View>
              ))}
              <Button variant="ghost" label={busy ? "Please wait…" : "Restore purchase"} onPress={() => run(restore)} />
              <LegalNote />
            </>
          ) : configured ? (
            // Billing is live, but the store hasn't returned the plans yet.
            // Never try to "buy nothing" — offer a retry while they load.
            <>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{PACKAGE_PRICE}</Text>
                <Chip label="SUBSCRIPTION" tone="gold" />
              </View>
              <Text style={styles.priceHint}>
                {busy
                  ? "Checking the store for plans…"
                  : "Plans aren't showing yet — new subscriptions can take a little while to appear. Tap retry."}
              </Text>
              <Button label={busy ? "Checking…" : "↻ Retry"} onPress={reload} />
              <Button variant="ghost" label="Restore purchase" onPress={() => run(restore)} />
              <LegalNote />
            </>
          ) : (
            // Demo mode — no billing key. Local test unlock (no charge).
            <>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{PACKAGE_PRICE}</Text>
                <Chip label="DEMO" tone="gold" />
              </View>
              <Text style={styles.priceHint}>Test unlock — no charge (store billing isn't set up yet).</Text>
              <Button
                label={busy ? "Please wait…" : `Unlock ${PACKAGE_NAME}`}
                icon="🔓"
                onPress={() => run(() => purchasePackage({} as SubPackage))}
              />
              <Button variant="ghost" label="Restore purchase" onPress={() => run(restore)} />
              <LegalNote />
            </>
          )}
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
      </Card>

      <Button variant="ghost" label="Back" onPress={() => navigation.goBack()} />
    </Screen>
  );
}

// Auto-renew disclosure + Terms/Privacy links — mandatory on the paywall.
function LegalNote() {
  const store = Platform.OS === "ios" ? "Apple ID" : "Google Play";
  return (
    <View style={styles.legalWrap}>
      <Text style={styles.legal}>
        Payment is charged to your {store} account. Subscriptions renew automatically unless cancelled at
        least 24 hours before the end of the period. Manage or cancel anytime in your {store} account settings.
      </Text>
      <View style={styles.legalLinks}>
        <Text style={styles.link} onPress={() => Linking.openURL(TERMS_URL)}>
          Terms of Use
        </Text>
        <Text style={styles.legalDot}>·</Text>
        <Text style={styles.link} onPress={() => Linking.openURL(PRIVACY_URL)}>
          Privacy Policy
        </Text>
      </View>
    </View>
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
  priceHint: { color: colors.textMuted, fontSize: 14, marginTop: 4, marginBottom: 8 },
  planRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },

  legalWrap: { marginTop: 10 },
  legal: { color: colors.textFaint, fontSize: 11, lineHeight: 16 },
  legalLinks: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 8 },
  legalDot: { color: colors.textFaint, fontSize: 12 },
  link: { color: colors.accent, fontSize: 12, fontWeight: "700" },

  groupHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  groupTitle: { color: colors.text, fontSize: 17, fontWeight: "800", marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 6 },
  mark: { fontSize: 16, fontWeight: "800", width: 20 },
  rowText: { color: colors.text, fontSize: 15, flex: 1, lineHeight: 21 },

  shareBody: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 4 },
});
