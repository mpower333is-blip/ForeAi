import React from "react";
import { View, Text, StyleSheet, Alert, ActivityIndicator, Image } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Screen, ScreenHeader, Card, Button, TextField, Chip } from "../components/ui";
import { colors, spacing, radius } from "../theme";
import { CLUB, CLUB_CONFIG } from "../config/appVariant";
import { useMember } from "../state/MemberContext";
import { membershipApi, MemberCard } from "../services/membershipApi";
import { DEVICE_ID } from "../state/device";

// The member's digital membership card. Before a membership is claimed on this
// device, a short verify form (membership number + surname or email). After,
// the card shows identity, category, status, the HNA handicap index, and a QR
// the starter scans to check the member in.

const CATEGORY_LABEL: Record<string, string> = {
  full: "Full", social: "Social", senior: "Senior", junior: "Junior",
  ladies: "Ladies", life: "Life", honorary: "Honorary",
};

function statusTone(status: string): "accent" | "gold" | "muted" {
  if (status === "active") return "accent";
  if (status === "pending") return "gold";
  return "muted";
}

export default function MembershipScreen({ navigation }: any) {
  const { member, setMember, clear } = useMember();
  if (!member) return <ClaimForm onClaimed={setMember} navigation={navigation} />;
  return <CardView member={member} onRefresh={setMember} onSignOut={clear} navigation={navigation} />;
}

function ClaimForm({ onClaimed, navigation }: { onClaimed: (m: MemberCard) => void; navigation: any }) {
  const [number, setNumber] = React.useState("");
  const [surname, setSurname] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    if (!number.trim()) return Alert.alert("Membership number", "Enter your club membership number.");
    if (!surname.trim() && !email.trim()) return Alert.alert("Verify it's you", "Add your surname or the email the club has on file.");
    setBusy(true);
    try {
      const card = await membershipApi.claim({
        memberNumber: number.trim(),
        lastName: surname.trim() || undefined,
        email: email.trim() || undefined,
        deviceId: DEVICE_ID,
      });
      onClaimed(card);
    } catch (e: any) {
      Alert.alert("Couldn't link your membership", e?.message ?? "Please check your details and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader onBack={() => navigation.goBack()} title="My Membership" subtitle="Link your club membership to this phone" />
      <Card>
        <Text style={styles.lead}>
          Enter your membership number and one detail we can check against the club's records.
        </Text>
        <TextField label="Membership number" value={number} onChangeText={setNumber} placeholder="e.g. 1042" keyboardType="numbers-and-punctuation" />
        <TextField label="Surname" value={surname} onChangeText={setSurname} placeholder="As on your membership" />
        <Text style={styles.or}>— or —</Text>
        <TextField label="Email on file" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
        {busy ? <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.sm }} /> : <Button icon="🪪" label="Link my membership" onPress={submit} />}
        <Text style={styles.hint}>New to the club? Ask the office to add you, then link here.</Text>
      </Card>
    </Screen>
  );
}

function CardView({ member, onRefresh, onSignOut, navigation }: { member: MemberCard; onRefresh: (m: MemberCard) => void; onSignOut: () => void; navigation: any }) {
  const [busy, setBusy] = React.useState(false);
  const clubName = CLUB_CONFIG?.shortName ?? "Golf Club";
  const hi = member.handicapIndex;

  const refresh = async () => {
    setBusy(true);
    try {
      const fresh = await membershipApi.lookup({ number: member.memberNumber });
      onRefresh(fresh);
    } catch {
      Alert.alert("Offline", "Couldn't refresh your card just now.");
    } finally {
      setBusy(false);
    }
  };

  // What the starter's scanner reads at check-in.
  const qrValue = `foreai:${CLUB || "club"}:member:${member.memberNumber}`;

  return (
    <Screen>
      <ScreenHeader onBack={() => navigation.goBack()} title="My Membership" subtitle={clubName} />

      {/* The card */}
      <View style={styles.cardOuter}>
        <View style={styles.cardTop}>
          <Image source={require("../../assets/kempton-logo.png")} style={styles.crest} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.club}>{clubName}</Text>
            <Text style={styles.memberOf}>Member</Text>
          </View>
          <Chip label={member.status === "active" ? "Active" : member.status} tone={statusTone(member.status)} />
        </View>

        <Text style={styles.name}>{member.firstName} {member.lastName}</Text>
        <View style={styles.metaRow}>
          <Meta label="Member no." value={member.memberNumber} />
          <Meta label="Category" value={CATEGORY_LABEL[member.category] ?? member.category} />
          <Meta label="Handicap" value={hi != null ? hi.toFixed(1) : "—"} />
        </View>

        <View style={styles.qrWrap}>
          <View style={styles.qrBox}>
            <QRCode value={qrValue} size={148} backgroundColor="#ffffff" color="#06170F" />
          </View>
          <Text style={styles.qrHint}>Show this to the starter to check in</Text>
        </View>
      </View>

      <Card>
        <Text style={styles.hiNote}>
          {hi != null
            ? `Handicap index synced from HNA${member.handicapSyncedAt ? ` · ${new Date(member.handicapSyncedAt).toLocaleDateString()}` : ""}.`
            : "Your official handicap index will appear here once the club syncs it from HNA."}
        </Text>
        <Button icon="🔄" variant="ghost" label={busy ? "Refreshing…" : "Refresh card"} onPress={refresh} />
        <Button icon="⛳" label="Book a tee time" onPress={() => navigation.navigate("TeeTimes")} />
        <Button icon="🚪" variant="ghost" label="Sign out of this membership" onPress={() =>
          Alert.alert("Sign out?", "This removes your card from this phone. You can link it again anytime.", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign out", style: "destructive", onPress: onSignOut },
          ])
        } />
      </Card>
    </Screen>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.textMuted, marginBottom: spacing.md, lineHeight: 20 },
  or: { color: colors.textFaint, textAlign: "center", marginBottom: spacing.sm },
  hint: { color: colors.textFaint, fontSize: 12, marginTop: spacing.sm, textAlign: "center" },

  cardOuter: {
    backgroundColor: colors.surfaceHi,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  crest: { width: 44, height: 44, backgroundColor: "#fff", borderRadius: 10, padding: 2 },
  club: { color: colors.text, fontSize: 16, fontWeight: "800" },
  memberOf: { color: colors.textFaint, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  name: { color: colors.text, fontSize: 24, fontWeight: "800", marginBottom: spacing.md },
  metaRow: { flexDirection: "row", gap: spacing.lg, marginBottom: spacing.lg },
  meta: {},
  metaLabel: { color: colors.textFaint, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  metaValue: { color: colors.text, fontSize: 17, fontWeight: "700" },
  qrWrap: { alignItems: "center" },
  qrBox: { backgroundColor: "#fff", padding: 12, borderRadius: radius.md },
  qrHint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },

  hiNote: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: spacing.sm },
});
