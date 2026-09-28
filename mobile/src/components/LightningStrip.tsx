import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Coord } from "../lib/geo";
import { useLightning } from "../hooks/useLightning";
import { colors, spacing, radius } from "../theme";

// An always-visible lightning status on the main page. Unlike the weather card
// (which only shows a banner during a storm), this strip is shown at all times
// so the player can see at a glance that the sky is being watched — a calm green
// "clear" when there's no danger, escalating to an amber watch or a loud red
// warning when a storm is near. Tapping isn't needed; it's a passive safety cue.
export default function LightningStrip({ coord }: { coord: Coord | null }) {
  const { wx, state } = useLightning(coord);

  if (!coord) {
    return (
      <View style={[styles.strip, styles.neutral]}>
        <Text style={styles.icon}>⚡</Text>
        <Text style={styles.neutralText}>Turn on location to watch for lightning.</Text>
      </View>
    );
  }
  if (state === "loading" || state === "idle" || !wx) {
    return (
      <View style={[styles.strip, styles.neutral]}>
        <Text style={styles.icon}>⚡</Text>
        <Text style={styles.neutralText}>Checking the sky for lightning…</Text>
      </View>
    );
  }

  const { level, message, source, nearestKm, nearestDir, strikeCount } = wx.lightning;
  const live = source === "strikes";

  if (level === "warning") {
    return (
      <View style={[styles.strip, styles.warning]}>
        <Text style={styles.iconBig}>⚡</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.warningLabel}>
            LIGHTNING WARNING{live && strikeCount ? ` · ${strikeCount} strike${strikeCount === 1 ? "" : "s"} nearby` : ""}
          </Text>
          <Text style={styles.warningMsg}>
            {nearestKm != null ? `Strike ${nearestKm} km ${nearestDir ?? ""} — ` : ""}seek shelter now, never under trees.
          </Text>
        </View>
      </View>
    );
  }
  if (level === "watch") {
    return (
      <View style={[styles.strip, styles.watch]}>
        <Text style={styles.iconBig}>⛈️</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.watchLabel}>STORM WATCH</Text>
          <Text style={styles.watchMsg}>{message}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.strip, styles.clear]}>
      <Text style={styles.icon}>⚡</Text>
      <Text style={styles.clearText}>
        Skies clear — no lightning within 10 km{live ? "" : ""}.
      </Text>
      {live ? <Text style={styles.liveChip}>● LIVE</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  icon: { fontSize: 18 },
  iconBig: { fontSize: 24, marginTop: 1 },

  neutral: { backgroundColor: colors.surface, borderColor: colors.border },
  neutralText: { color: colors.textFaint, fontSize: 13, flex: 1 },

  clear: { backgroundColor: "rgba(80,200,120,0.10)", borderColor: colors.positive },
  clearText: { color: colors.text, fontSize: 14, fontWeight: "700", flex: 1 },
  liveChip: { color: colors.positive, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },

  watch: { backgroundColor: colors.goldSoft, borderColor: colors.warning },
  watchLabel: { color: colors.warning, fontSize: 13, fontWeight: "900", letterSpacing: 0.5 },
  watchMsg: { color: colors.text, fontSize: 14, fontWeight: "700", marginTop: 2 },

  warning: { backgroundColor: "rgba(255,107,107,0.16)", borderColor: colors.negative },
  warningLabel: { color: colors.negative, fontSize: 13, fontWeight: "900", letterSpacing: 0.5 },
  warningMsg: { color: colors.text, fontSize: 14, fontWeight: "700", marginTop: 2, lineHeight: 19 },
});
