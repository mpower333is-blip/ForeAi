import React from "react";
import { View, Text, StyleSheet, Linking, TouchableOpacity, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Screen, Card, Button, Chip } from "../components/ui";
import { colors, spacing, gradients } from "../theme";
import { useRound } from "../state/RoundContext";
import { CLUB_CONFIG } from "../config/appVariant";
import { newsApi, Notice } from "../services/newsApi";

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

  const [news, setNews] = React.useState<Notice[]>([]);
  React.useEffect(() => { newsApi.list().then((n) => setNews(n.slice(0, 3))).catch(() => {}); }, []);

  return (
    <Screen>
      {/* Club crest is the hero — the club's own branding, no text mark. */}
      <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.crestWrap}>
          <Image source={require("../../assets/kempton-logo.png")} style={styles.crestImg} resizeMode="contain" />
        </View>
        {club.tagline ? <Text style={styles.heroTag}>{club.tagline}</Text> : null}
      </LinearGradient>

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

      {/* Club news */}
      <Card>
        <View style={styles.rowHead}>
          <Text style={styles.h}>Club News</Text>
          <Chip label="Latest" tone="accent" />
        </View>
        {news.length === 0 ? (
          <Text style={styles.body}>Announcements, results and notices from the club.</Text>
        ) : (
          <View style={{ marginBottom: 6 }}>
            {news.map((n) => (
              <Text key={n.id} style={styles.newsLine} numberOfLines={1}>{n.pinned ? "📌 " : "• "}{n.title}</Text>
            ))}
          </View>
        )}
        <Button icon="📰" variant="ghost" label="Open news" onPress={() => navigation.navigate("News")} />
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

      {/* Events — the club's golf days */}
      <Card>
        <View style={styles.rowHead}>
          <Text style={styles.h}>Events</Text>
          <Chip label="Golf days" tone="gold" />
        </View>
        <Text style={styles.body}>The club's golf days. Open events to join one and score live with your fourball.</Text>
        <Button icon="🏆" label="Open events" onPress={() => navigation.navigate("Events")} />
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
            {c.phone ? <TouchableOpacity onPress={() => open(`tel:${c.phone!.replace(/\s/g, "")}`)}><Text style={styles.link}>📞 {c.phone}</Text></TouchableOpacity> : null}
            {c.email ? <TouchableOpacity onPress={() => open(`mailto:${c.email}`)}><Text style={styles.link}>✉️ {c.email}</Text></TouchableOpacity> : null}
            {c.web ? <TouchableOpacity onPress={() => open(c.web!.startsWith("http") ? c.web : `https://${c.web}`)}><Text style={styles.link}>🌐 {c.web}</Text></TouchableOpacity> : null}
            {c.address ? <Text style={styles.body}>📍 {c.address}</Text> : null}
          </View>
        ) : (
          <Text style={styles.muted}>Club contact details go here.</Text>
        )}
      </Card>


      <Text style={styles.footer}>Powered by ForeAi</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 28, paddingVertical: 30, paddingHorizontal: 24, marginBottom: spacing.md, alignItems: "center", overflow: "hidden" },
  crestWrap: { backgroundColor: "#fff", borderRadius: 22, paddingVertical: 16, paddingHorizontal: 24 },
  crestImg: { width: 210, height: 210 },
  heroTag: { color: colors.textMuted, fontSize: 16, fontWeight: "600", marginTop: spacing.md, textAlign: "center" },
  rowHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 },
  h: { color: colors.text, fontSize: 17, fontWeight: "800" },
  body: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 10 },
  muted: { color: colors.textFaint, fontSize: 14, marginTop: 4 },
  link: { color: colors.accent, fontSize: 15, fontWeight: "600", paddingVertical: 4 },
  newsLine: { color: colors.textMuted, fontSize: 14, lineHeight: 22 },
  footer: { color: colors.textFaint, fontSize: 12, textAlign: "center", marginTop: spacing.lg, marginBottom: spacing.md },
});
