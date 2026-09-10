import React from "react";
import { View, Text, StyleSheet, Linking, TouchableOpacity, Image } from "react-native";
import { Screen, Hero, Card, Button, Chip } from "../components/ui";
import { colors, spacing, radius } from "../theme";
import { useRound } from "../state/RoundContext";
import { CLUB_CONFIG } from "../config/appVariant";

// The landing screen for a single-club flavour (e.g. "Kempton Park Golf").
// Placeholder branding — a green/white theme + text mark and safe default copy
// the club can correct later. Everything is fully unlocked in a club build.
export default function ClubHomeScreen({ navigation }: any) {
  const { selectedCourse } = useRound();
  const club = CLUB_CONFIG;
  if (!club) return null; // never rendered unless it's a club build

  const holes = selectedCourse?.holes?.length ?? 18;
  const open = (url?: string) => { if (url) Linking.openURL(url).catch(() => {}); };
  const c = club.contact;
  const hasContact = !!(c.phone || c.email || c.web || c.address);

  return (
    <Screen>
      <Hero
        title={club.shortName}
        tagline={club.tagline}
        right={
          <View style={styles.logoBadge}>
            <Image source={require("../../assets/kempton-logo.png")} style={styles.logoImg} resizeMode="contain" />
          </View>
        }
      />

      {/* The course — the heart of the club app */}
      <Card accent>
        <View style={styles.rowHead}>
          <Text style={styles.h}>The course</Text>
          <Chip label={`⛳ ${holes} holes mapped`} tone="accent" />
        </View>
        <Text style={styles.body}>
          Full GPS rangefinder — front, middle and back of every green — hole maps and a live
          scorecard for all {holes} holes.
        </Text>
        <Button icon="🏌️" label="Play the course" onPress={() => navigation.navigate("Play")} />
        <Button icon="📍" variant="ghost" label="GPS rangefinder" onPress={() => navigation.navigate("Survey")} />
      </Card>

      {/* Membership + tee-time booking (club "complete package") */}
      <Card accent>
        <View style={styles.rowHead}>
          <Text style={styles.h}>Membership</Text>
          <Chip label="Members" tone="accent" />
        </View>
        <Text style={styles.body}>Your digital membership card, handicap and tee-time bookings — all in one place.</Text>
        <Button icon="🪪" label="My membership card" onPress={() => navigation.navigate("Membership")} />
        <Button icon="⛳" variant="ghost" label="Book a tee time" onPress={() => navigation.navigate("TeeTimes")} />
        <Button icon="🏆" variant="ghost" label="Competitions" onPress={() => navigation.navigate("Competitions")} />
      </Card>

      {/* Pro shop bookings */}
      <Card>
        <View style={styles.rowHead}>
          <Text style={styles.h}>Pro Shop</Text>
          <Chip label="Bookings" tone="accent" />
        </View>
        <Text style={styles.body}>Book a lesson or contact the pro shop directly.</Text>
        <Button icon="🛒" label="Pro shop & lessons" onPress={() => navigation.navigate("ProShop")} />
      </Card>

      {/* Club event (placeholder — the ECS Golf Day) */}
      <Card>
        <View style={styles.rowHead}>
          <Text style={styles.h}>{club.event.title}</Text>
          <Chip label="Event" tone="gold" />
        </View>
        <Text style={styles.body}>{club.event.blurb}</Text>
        <Button icon="🏆" variant="ghost" label="Open events" onPress={() => navigation.navigate("Events")} />
      </Card>

      {/* Coach — bundled, fully unlocked */}
      <Card>
        <Text style={styles.h}>Swing Coach</Text>
        <Text style={styles.body}>Film a swing and get instant posture and tempo feedback.</Text>
        <Button icon="🎥" variant="ghost" label="Open coach" onPress={() => navigation.navigate("Coach")} />
      </Card>

      {/* About the club */}
      <Card>
        <Text style={styles.h}>About the club</Text>
        <Text style={styles.body}>{club.about}</Text>
      </Card>

      {/* Contact — only shows filled-in details; placeholders stay hidden */}
      <Card>
        <Text style={styles.h}>Contact</Text>
        {hasContact ? (
          <View style={{ gap: 4, marginTop: 4 }}>
            {c.phone ? <TouchableOpacity onPress={() => open(`tel:${c.phone}`)}><Text style={styles.link}>📞 {c.phone}</Text></TouchableOpacity> : null}
            {c.email ? <TouchableOpacity onPress={() => open(`mailto:${c.email}`)}><Text style={styles.link}>✉️ {c.email}</Text></TouchableOpacity> : null}
            {c.web ? <TouchableOpacity onPress={() => open(c.web!.startsWith("http") ? c.web : `https://${c.web}`)}><Text style={styles.link}>🌐 {c.web}</Text></TouchableOpacity> : null}
            {c.address ? <Text style={styles.body}>📍 {c.address}</Text> : null}
          </View>
        ) : (
          <Text style={styles.muted}>Club contact details go here.</Text>
        )}
      </Card>

      {/* Sponsors (placeholder names) */}
      <Card>
        <Text style={styles.h}>Our sponsors</Text>
        <View style={styles.sponsorWrap}>
          {club.sponsors.map((s, i) => (
            <View key={i} style={styles.sponsor}><Text style={styles.sponsorTxt}>{s}</Text></View>
          ))}
        </View>
      </Card>

      <Text style={styles.footer}>Powered by ForeAi</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logoBadge: { width: 60, height: 60, borderRadius: 14, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", padding: 4 },
  logoImg: { width: "100%", height: "100%" },
  rowHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 },
  h: { color: colors.text, fontSize: 17, fontWeight: "800" },
  body: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 10 },
  muted: { color: colors.textFaint, fontSize: 14, marginTop: 4 },
  link: { color: colors.accent, fontSize: 15, fontWeight: "600", paddingVertical: 4 },
  sponsorWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  sponsor: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: colors.bg, minWidth: "46%", alignItems: "center" },
  sponsorTxt: { color: colors.textFaint, fontSize: 13, fontWeight: "600" },
  footer: { color: colors.textFaint, fontSize: 12, textAlign: "center", marginTop: spacing.lg, marginBottom: spacing.md },
});
