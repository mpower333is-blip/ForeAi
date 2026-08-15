import React, { useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Screen, Card, Button, TextField, Stepper, Hero, FlagMark, IconChip, Chip } from "../components/ui";
import { colors, spacing, radius, type } from "../theme";
import { useProfile } from "../state/ProfileContext";
import { useTournament } from "../state/TournamentContext";

// First-run flow: welcome → your details → join a golf day → ready.
// Sets the persisted profile so the app knows who you are from the first tap.
export default function Onboarding() {
  const { name, handicap, setName, setHandicap, completeOnboarding } = useProfile();
  const { joinByCode } = useTournament();

  const [step, setStep] = useState(0);
  const [localName, setLocalName] = useState(name);
  const [localHcp, setLocalHcp] = useState(handicap);
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinMsg, setJoinMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const finish = () => {
    setName(localName.trim() || "Golfer");
    setHandicap(localHcp);
    completeOnboarding();
  };

  const tryJoin = async () => {
    if (code.trim().length < 4) {
      setJoinMsg({ ok: false, text: "Enter the code from the organiser (usually 6 letters)." });
      return;
    }
    // Save the name/handicap first so the join registers "me" correctly.
    setName(localName.trim() || "Golfer");
    setHandicap(localHcp);
    setJoining(true);
    setJoinMsg(null);
    const ev = await joinByCode(code.trim().toUpperCase());
    setJoining(false);
    if (ev) {
      setJoinMsg({ ok: true, text: `Joined “${ev.name}”. You're all set!` });
      setTimeout(finish, 900);
    } else {
      setJoinMsg({
        ok: false,
        text: "Couldn't find that event. Check the code, or skip and join later from the Events tab.",
      });
    }
  };

  return (
    <Screen>
      <View style={styles.dots}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotOn]} />
        ))}
      </View>

      {step === 0 && (
        <>
          <Hero title="ForeAi" tagline="Your AI golf partner" right={<FlagMark size={56} />} />
          <Card>
            <Feature emoji="🎒" title="AI Caddie" body="Club calls that learn your real distances." />
            <Feature emoji="🎥" title="Swing Coach" body="Frame a swing and get tempo & posture feedback." />
            <Feature emoji="🏆" title="Golf Days" body="Join an event and score live with your fourball." />
          </Card>
          <Button label="Get started" onPress={() => setStep(1)} />
        </>
      )}

      {step === 1 && (
        <>
          <StepHead emoji="👤" title="A bit about you" subtitle="This personalises your caddie and golf-day scoring." />
          <Card>
            <TextField
              label="Your name"
              value={localName}
              onChangeText={setLocalName}
              placeholder="e.g. Jan Smit"
            />
            <Stepper
              label="Handicap"
              value={localHcp}
              onChange={setLocalHcp}
              step={1}
              min={0}
              max={54}
            />
            <Text style={styles.hint}>
              Not sure? Leave it at 18 — you can change it any time in Profile.
            </Text>
          </Card>
          <Button label="Continue" onPress={() => setStep(2)} />
          <Button variant="ghost" label="Back" onPress={() => setStep(0)} />
        </>
      )}

      {step === 2 && (
        <>
          <StepHead emoji="🏁" title="Playing a golf day?" subtitle="Enter the join code from the organiser to score live. You can also skip and do this later." />
          <Card>
            <TextField
              label="Event join code"
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase())}
              placeholder="e.g. EC5GLF"
            />
            {joinMsg && (
              <Text style={[styles.msg, { color: joinMsg.ok ? colors.accent : colors.negative }]}>
                {joinMsg.text}
              </Text>
            )}
            {joining ? (
              <View style={styles.joiningRow}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.hint}>Joining…</Text>
              </View>
            ) : (
              <Button label="Join golf day" icon="🏁" onPress={tryJoin} />
            )}
          </Card>
          <Button label="Enter ForeAi" onPress={finish} />
          <Button variant="ghost" label="Back" onPress={() => setStep(1)} />
        </>
      )}
    </Screen>
  );
}

function Feature({ emoji, title, body }: { emoji: string; title: string; body: string }) {
  return (
    <View style={styles.feat}>
      <IconChip emoji={emoji} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.featTitle}>{title}</Text>
        <Text style={styles.featBody}>{body}</Text>
      </View>
    </View>
  );
}

function StepHead({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <View style={styles.stepHead}>
      <IconChip emoji={emoji} tone="gold" />
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepSub}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: "row", gap: 8, justifyContent: "center", marginTop: spacing.sm, marginBottom: spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.accent, width: 22 },

  feat: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  featTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  featBody: { color: colors.textMuted, fontSize: 14, marginTop: 2, lineHeight: 19 },

  stepHead: { alignItems: "center", gap: 8, marginBottom: spacing.md },
  stepTitle: { ...(type.h1 as any), color: colors.text, marginTop: 8, textAlign: "center" },
  stepSub: { color: colors.textMuted, fontSize: 15, lineHeight: 21, textAlign: "center", paddingHorizontal: spacing.sm },

  hint: { color: colors.textFaint, fontSize: 13, lineHeight: 18, marginTop: 8 },
  msg: { fontSize: 14, fontWeight: "600", marginVertical: 8, lineHeight: 19 },
  joiningRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: spacing.sm },
});
