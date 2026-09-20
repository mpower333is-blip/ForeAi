import React from "react";
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl, ScrollView, TouchableOpacity } from "react-native";
import { Screen, ScreenHeader, Card, Button, Chip } from "../components/ui";
import { colors, spacing } from "../theme";
import { CLUB_CONFIG } from "../config/appVariant";
import { useMember } from "../state/MemberContext";
import { membershipApi, Booking } from "../services/membershipApi";

// Open games — Playtomic-style social matchmaking. Members post a tee time with
// open spots; anyone can join instantly until the 4-ball is full. Handicaps are
// shown so you can play with people at your level, and a "near my level" filter
// narrows the board to games close to your handicap.

// How wide "near my level" reaches (handicap index points, either side).
const LEVEL_BAND = 6;

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// The game's handicap span, for the level chip and level filtering.
function handicaps(g: Booking): number[] {
  return (g.members ?? []).map((m) => m.handicapIndex).filter((h): h is number => h != null);
}
function levelLabel(g: Booking): string {
  const hs = handicaps(g);
  if (hs.length === 0) return "All levels";
  const lo = Math.min(...hs), hi = Math.max(...hs);
  return lo === hi ? `hcp ${lo}` : `hcp ${lo}–${hi}`;
}
function avgHandicap(g: Booking): number | null {
  const hs = handicaps(g);
  return hs.length ? hs.reduce((a, b) => a + b, 0) / hs.length : null;
}

export default function OpenGamesScreen({ navigation }: any) {
  const { member } = useMember();
  const [games, setGames] = React.useState<Booking[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [nearMe, setNearMe] = React.useState(false);

  const myHcp = member?.handicapIndex ?? null;

  const load = React.useCallback(() => {
    setLoading(true);
    membershipApi.openGames().then((rows) => setGames(rows ?? [])).catch(() => setGames([])).finally(() => setLoading(false));
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const shown = React.useMemo(() => {
    if (!nearMe || myHcp == null) return games;
    return games.filter((g) => {
      const a = avgHandicap(g);
      return a == null || Math.abs(a - myHcp) <= LEVEL_BAND;
    });
  }, [games, nearMe, myHcp]);

  const iAmIn = (g: Booking) => !!member && (g.members ?? []).some((m) => m.memberId === member.id);
  const iHost = (g: Booking) => !!member && (g.hostMemberId ?? g.memberId) === member.id;

  const join = async (g: Booking) => {
    if (!member) return;
    setBusyId(g.id);
    try {
      await membershipApi.joinGame(g.id, member.id);
      load();
    } catch (e: any) {
      // eslint-disable-next-line no-alert
      alert(e?.message ?? "Couldn't join — the game may have just filled up.");
      load();
    } finally {
      setBusyId(null);
    }
  };
  const leave = async (g: Booking) => {
    if (!member) return;
    setBusyId(g.id);
    try {
      await membershipApi.leaveGame(g.id, member.id);
      load();
    } catch (e: any) {
      // eslint-disable-next-line no-alert
      alert(e?.message ?? "Couldn't leave the game.");
    } finally {
      setBusyId(null);
    }
  };

  if (!member) {
    return (
      <Screen>
        <ScreenHeader onBack={() => navigation.goBack()} title="Open Games" subtitle="Find a 4-ball" />
        <Card>
          <Text style={styles.lead}>Link your membership first, then you can join open games here.</Text>
          <Button icon="🪪" label="Link my membership" onPress={() => navigation.navigate("Membership")} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader onBack={() => navigation.goBack()} title="Open Games" subtitle={CLUB_CONFIG?.shortName ?? "Find a 4-ball"} />

      <Card accent>
        <Text style={styles.introTitle}>Play with the club</Text>
        <Text style={styles.introBody}>
          Join an open 4-ball, or post your own tee time and let members fill the spots.
        </Text>
        <View style={styles.filters}>
          <TouchableOpacity onPress={() => setNearMe((v) => !v)} activeOpacity={0.8} disabled={myHcp == null}>
            <Chip label={nearMe ? "★ Near my level" : "All levels"} tone={nearMe ? "gold" : "muted"} />
          </TouchableOpacity>
          {myHcp != null && <Text style={styles.myHcp}>Your hcp {myHcp}</Text>}
        </View>
        <Button icon="➕" variant="ghost" label="Post an open game" onPress={() => navigation.navigate("TeeTimes")} />
      </Card>

      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
      >
        {loading && games.length === 0 ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.xl }} />
        ) : shown.length === 0 ? (
          <Card>
            <Text style={styles.empty}>
              {nearMe ? "No open games near your level right now." : "No open games yet — be the first to post one."}
            </Text>
          </Card>
        ) : (
          shown.map((g) => {
            const spots = g.openSpots ?? 0;
            const count = (g.members ?? []).length;
            const max = g.maxPlayers ?? count + spots;
            const mine = iAmIn(g);
            const host = iHost(g);
            return (
              <Card key={g.id}>
                <View style={styles.head}>
                  <Text style={styles.when}>{when(g.teeAt)}</Text>
                  <Chip label={levelLabel(g)} tone="sky" />
                </View>
                <Text style={styles.who}>{(g.members ?? []).map((m) => m.name).join(", ") || "—"}</Text>
                <View style={styles.metaRow}>
                  <Chip label={`${count}/${max} players`} tone="muted" />
                  <Chip label={spots === 1 ? "1 spot open" : `${spots} spots open`} tone="accent" />
                  {host && <Chip label="You're hosting" tone="gold" />}
                </View>
                {busyId === g.id ? (
                  <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.sm }} />
                ) : host ? (
                  <Text style={styles.hint}>Manage or cancel this game under My tee times.</Text>
                ) : mine ? (
                  <Button variant="ghost" label="Leave game" onPress={() => leave(g)} />
                ) : (
                  <Button icon="✅" label="Join this game" onPress={() => join(g)} />
                )}
              </Card>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.textMuted, marginBottom: spacing.md, lineHeight: 20 },
  introTitle: { color: colors.text, fontSize: 17, fontWeight: "800", marginBottom: spacing.xs },
  introBody: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: spacing.sm },
  filters: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  myHcp: { color: colors.textFaint, fontSize: 12 },

  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  when: { color: colors.text, fontWeight: "800", fontSize: 15 },
  who: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.sm },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xs, marginBottom: spacing.sm },
  hint: { color: colors.textFaint, fontSize: 12, marginTop: spacing.xs },
  empty: { color: colors.textMuted, fontSize: 14, lineHeight: 20, paddingVertical: spacing.sm },
});
