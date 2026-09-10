import React from "react";
import { View, Text, StyleSheet, Image, ActivityIndicator, ScrollView } from "react-native";
import { Screen, ScreenHeader, Card, Chip } from "../components/ui";
import { colors, spacing, radius } from "../theme";
import { CLUB_CONFIG } from "../config/appVariant";
import { newsApi, Notice } from "../services/newsApi";

// Club news / noticeboard. Members browse announcements (pinned first, then
// newest) and tap one to read it in full.

const CAT: Record<string, { label: string; tone: "accent" | "gold" | "sky" | "muted" }> = {
  news: { label: "News", tone: "accent" },
  event: { label: "Event", tone: "gold" },
  notice: { label: "Notice", tone: "sky" },
  result: { label: "Results", tone: "accent" },
  urgent: { label: "Urgent", tone: "gold" },
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function NewsScreen({ navigation }: any) {
  const [items, setItems] = React.useState<Notice[] | null>(null);
  const [open, setOpen] = React.useState<Notice | null>(null);

  React.useEffect(() => { newsApi.list().then(setItems).catch(() => setItems([])); }, []);

  if (open) {
    const cat = CAT[open.category] ?? CAT.news;
    return (
      <Screen>
        <ScreenHeader onBack={() => setOpen(null)} title="Club News" subtitle={CLUB_CONFIG?.shortName} />
        <Card>
          <View style={styles.rowHead}>
            <Chip label={cat.label} tone={cat.tone} />
            <Text style={styles.date}>{fmt(open.publishAt)}</Text>
          </View>
          <Text style={styles.titleBig}>{open.title}</Text>
          {open.authorName ? <Text style={styles.author}>{open.authorName}</Text> : null}
          {open.image ? <Image source={{ uri: open.image }} style={styles.hero} resizeMode="cover" /> : null}
          <Text style={styles.body}>{open.body}</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader onBack={() => navigation.goBack()} title="Club News" subtitle={CLUB_CONFIG?.shortName ?? "Announcements & notices"} />
      {items === null ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : items.length === 0 ? (
        <Card><Text style={styles.muted}>No announcements yet. Check back soon.</Text></Card>
      ) : (
        items.map((n) => {
          const cat = CAT[n.category] ?? CAT.news;
          return (
            <Card key={n.id} onPress={() => setOpen(n)}>
              <View style={styles.rowHead}>
                <View style={styles.chips}>
                  {n.pinned ? <Chip label="📌 Pinned" tone="muted" /> : null}
                  <Chip label={cat.label} tone={cat.tone} />
                </View>
                <Text style={styles.date}>{fmt(n.publishAt)}</Text>
              </View>
              <Text style={styles.title}>{n.title}</Text>
              {n.image ? <Image source={{ uri: n.image }} style={styles.thumb} resizeMode="cover" /> : null}
              <Text style={styles.snippet} numberOfLines={n.image ? 2 : 3}>{n.body}</Text>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  chips: { flexDirection: "row", gap: 6 },
  date: { color: colors.textFaint, fontSize: 12 },
  title: { color: colors.text, fontSize: 17, fontWeight: "800", marginBottom: 6 },
  titleBig: { color: colors.text, fontSize: 22, fontWeight: "800", marginTop: 6, marginBottom: 4 },
  author: { color: colors.textFaint, fontSize: 13, marginBottom: spacing.sm },
  snippet: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  body: { color: colors.textMuted, fontSize: 15, lineHeight: 23, marginTop: spacing.sm },
  muted: { color: colors.textFaint },
  thumb: { width: "100%", height: 150, borderRadius: radius.sm, marginBottom: spacing.sm, backgroundColor: colors.surfaceAlt },
  hero: { width: "100%", height: 190, borderRadius: radius.md, marginVertical: spacing.sm, backgroundColor: colors.surfaceAlt },
});
