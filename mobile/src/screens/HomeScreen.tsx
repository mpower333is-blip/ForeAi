import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Screen, Card, StatTile, Button, Hero, FlagMark, IconChip, Chip } from "../components/ui";
import { shareApp } from "../components/Upsell";
import WeatherPanel from "../components/WeatherPanel";
import { colors, spacing, type, radius } from "../theme";
import { useRound } from "../state/RoundContext";
import { usePlan } from "../state/PlanContext";
import { useProfile } from "../state/ProfileContext";
import { PACKAGE_NAME } from "../config/appConfig";
import { signed } from "../lib/golfEngine";
import { ydToM } from "../lib/units";

// A feature card with an icon chip, headline, blurb and CTA.
function FeatureCard({
  emoji,
  tone,
  title,
  body,
  cta,
  onPress,
  primary,
  badge,
  locked,
  onUpgrade,
}: {
  emoji: string;
  tone?: "accent" | "gold" | "sky";
  title: string;
  body: string;
  cta: string;
  onPress: () => void;
  primary?: boolean;
  badge?: string;
  locked?: boolean; // Pro feature not yet unlocked
  onUpgrade?: () => void;
}) {
  return (
    <Card accent={primary}>
      <View style={styles.featHead}>
        <IconChip emoji={emoji} tone={tone} />
        <View style={styles.featHeadText}>
          <Text style={styles.cardHeadline}>{title}</Text>
          {locked ? (
            <Chip label="🔒 PRO" tone="muted" />
          ) : badge ? (
            <Chip label={badge} tone={tone === "gold" ? "gold" : "accent"} />
          ) : null}
        </View>
      </View>
      <Text style={styles.cardBody}>{body}</Text>
      <Button
        variant={primary ? "primary" : "ghost"}
        label={locked ? "Unlock with Pro" : cta}
        onPress={locked ? onUpgrade! : onPress}
      />
    </Card>
  );
}

export default function HomeScreen({ navigation }: any) {
  const { shots, totalStrokesGained, categorySG, course, currentHole, courseName } = useRound();
  const { isPro } = usePlan();
  const { name } = useProfile();
  const cats = categorySG();
  const best = [...cats].sort((a, b) => b.value - a.value)[0];
  const hole = course.find((h) => h.number === currentHole) ?? course[0];
  const demo = !isPro;

  // Weather is shown for the course you're playing (its mapped GPS), so no
  // location prompt on the home screen. Falls back to null (a gentle hint) for
  // a course we don't have coordinates for yet.
  const wxCoord = React.useMemo(() => {
    for (const h of course) {
      if (h.tee) return h.tee;
      if (h.green) return h.green;
    }
    return null;
  }, [course]);
  const toUpgrade = () => navigation.navigate("Upgrade");
  const firstName = (name || "").trim().split(" ")[0];

  return (
    <Screen>
      <Hero
        title="ForeAi"
        tagline={firstName ? `Welcome back, ${firstName} 👋` : "AI Golf Performance Platform"}
        right={<FlagMark size={56} />}
      />

      {demo && (
        <Card accent onPress={toUpgrade}>
          <View style={styles.featHead}>
            <IconChip emoji="⛳" tone="gold" />
            <View style={styles.featHeadText}>
              <Text style={styles.cardHeadline}>Unlock {PACKAGE_NAME}</Text>
              <Chip label="FREE DEMO" tone="gold" />
            </View>
          </View>
          <Text style={styles.cardBody}>
            You're on the free demo — Swing Coach, AI Caddie and Golf Days are open. Unlock live
            rounds, GPS, stats and more.
          </Text>
          <Button label="See what's included" icon="🔓" onPress={toUpgrade} />
        </Card>
      )}

      <View style={styles.grid}>
        <StatTile
          label="Round SG"
          value={shots.length ? signed(totalStrokesGained) : "—"}
          hint={shots.length ? `${shots.length} shots logged` : "No shots yet"}
          tone={totalStrokesGained < 0 ? "negative" : "accent"}
        />
        <StatTile label="Current Hole" value={`${hole.number}`} hint={`Par ${hole.par} • ${ydToM(hole.yards)} m`} tone="neutral" />
        <StatTile
          label="Strong Suit"
          value={best && best.value !== 0 ? best.label.split(" ")[0] : "—"}
          hint={best && best.value !== 0 ? signed(best.value) : "Play a hole"}
          tone="gold"
        />
      </View>

      <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate("CourseSelect")} style={styles.courseChipRow}>
        <Text style={styles.courseChipLabel}>⛳ Playing</Text>
        <Text style={styles.courseChipName} numberOfLines={1}>{courseName}</Text>
        <Text style={styles.courseChipCta}>Change ›</Text>
      </TouchableOpacity>

      <WeatherPanel coord={wxCoord} />

      <View style={styles.sectionRow}>
        <View style={styles.sectionBar} />
        <Text style={styles.sectionTitle}>Jump back in</Text>
      </View>

      <FeatureCard
        emoji="🏌️"
        primary
        badge="LIVE"
        title="Live Round"
        body="Track shots, get club calls and watch your strokes gained update in real time."
        cta="Go to Round"
        onPress={() => navigation.navigate("Play")}
        locked={demo}
        onUpgrade={toUpgrade}
      />

      <FeatureCard
        emoji="📍"
        title="Course GPS & Survey"
        body="Live distances to the front, middle and back of every green — plus a survey mode to record a course's tee and green coordinates while you walk it."
        cta="Open GPS"
        onPress={() => navigation.navigate("Survey")}
      />

      <FeatureCard
        emoji="🎥"
        title="Swing Coach"
        body="Frame yourself and take a swing — ForeAi detects it from your phone's motion and coaches your tempo, posture and balance."
        cta="Analyze my swing"
        onPress={() => navigation.navigate("Coach")}
      />

      <FeatureCard
        emoji="🏆"
        tone="gold"
        title="Tournaments & Golf Days"
        body="Register players, set tee times, and follow everyone live — see who's on which hole and the running leaderboard."
        cta="Manage events"
        onPress={() => navigation.navigate("Events")}
      />

      <FeatureCard
        emoji="🎮"
        tone="sky"
        title="Range Games"
        body="Gamified practice — closest to the pin, target challenge, long drive and a tempo trainer. Chase a high score."
        cta="Play"
        onPress={() => navigation.navigate("Games")}
        locked={demo}
        onUpgrade={toUpgrade}
      />

      <View style={styles.pairRow}>
        <Card style={styles.pairCard}>
          <IconChip emoji="🎒" />
          <Text style={[styles.cardHeadline, { marginTop: 10 }]}>AI Caddie</Text>
          <Text style={styles.cardBody}>Club calls that learn your real distances.</Text>
          <Button variant="ghost" label="Open" onPress={() => navigation.navigate("Caddie")} />
        </Card>
        <Card style={styles.pairCard}>
          <IconChip emoji="🧭" />
          <Text style={[styles.cardHeadline, { marginTop: 10 }]}>Strategy {demo ? "🔒" : ""}</Text>
          <Text style={styles.cardBody}>Aggressive or safe? Plan every hole.</Text>
          <Button
            variant="ghost"
            label={demo ? "Unlock" : "Open"}
            onPress={demo ? toUpgrade : () => navigation.navigate("Strategy")}
          />
        </Card>
      </View>

      <Card>
        <View style={styles.featHead}>
          <IconChip emoji="📊" />
          <View style={styles.featHeadText}>
            <Text style={styles.cardHeadline}>Strokes Gained</Text>
          </View>
        </View>
        {shots.length === 0 ? (
          <Text style={styles.cardBody}>
            Your strokes-gained breakdown appears here once you log shots in a round.
          </Text>
        ) : (
          cats.map((c) => (
            <View key={c.label} style={styles.sgLine}>
              <Text style={styles.sgLabel}>{c.label}</Text>
              <Text
                style={[
                  styles.sgVal,
                  { color: c.value >= 0 ? colors.positive : colors.negative },
                ]}
              >
                {signed(c.value)}
              </Text>
            </View>
          ))
        )}
        <Button
          variant="ghost"
          label={demo ? "🔒 Unlock stats" : "Full stats"}
          onPress={demo ? toUpgrade : () => navigation.navigate("Stats")}
        />
      </Card>

      <Card>
        <View style={styles.featHead}>
          <IconChip emoji="📲" tone="sky" />
          <View style={styles.featHeadText}>
            <Text style={styles.cardHeadline}>Get the app</Text>
          </View>
        </View>
        <Text style={styles.cardBody}>
          Share ForeAi with your fourball so everyone can join the golf day and score live.
        </Text>
        <Button variant="ghost" label="Share the app" icon="↗" onPress={shareApp} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },

  courseChipRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: spacing.lg,
  },
  courseChipLabel: { color: colors.textMuted, fontSize: 14, fontWeight: "700" },
  courseChipName: { color: colors.text, fontSize: 14, fontWeight: "700", flex: 1, marginLeft: 10 },
  courseChipCta: { color: colors.accent, fontSize: 14, fontWeight: "700" },

  sectionRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  sectionBar: { width: 4, height: 22, borderRadius: 2, backgroundColor: colors.accent, marginRight: 10 },
  sectionTitle: { ...(type.h2 as any), color: colors.text },

  featHead: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  featHeadText: { marginLeft: 12, flex: 1, gap: 6 },
  cardHeadline: { fontSize: 19, fontWeight: "800", color: colors.text },
  cardBody: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: 4 },

  pairRow: { flexDirection: "row", gap: spacing.sm },
  pairCard: { flex: 1 },

  sgLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sgLabel: { color: colors.textMuted, fontSize: 15 },
  sgVal: { fontWeight: "700", fontSize: 15 },
});
