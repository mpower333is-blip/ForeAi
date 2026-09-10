import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { Screen, ScreenHeader, Card, Button, Chip } from "../components/ui";
import { colors, spacing, radius } from "../theme";
import { CLUB_CONFIG } from "../config/appVariant";
import { useMember } from "../state/MemberContext";
import { competitionsApi, CompetitionSummary, CompetitionDetail } from "../services/competitionsApi";

// Club competitions: the calendar of medals / Stableford days. Members see the
// list, enter, submit their card hole-by-hole, and watch the live leaderboard.
// Scoring is done on the backend; the card entry shows a live local preview.

// --- local scoring mirror (matches backend/src/lib/scoring for live preview) ---
function strokesOnHole(ph: number, si: number): number {
  if (ph < 0) return si > 18 + ph ? -1 : 0;
  return Math.floor(ph / 18) + (si <= ph % 18 ? 1 : 0);
}
function preview(holeScores: number[], pars: number[], sis: number[], ph: number) {
  let gross = 0, net = 0, stableford = 0, thru = 0;
  for (let i = 0; i < 18; i++) {
    const g = holeScores[i] || 0;
    if (g <= 0) continue;
    const s = strokesOnHole(ph, sis[i] ?? i + 1);
    gross += g; net += g - s; thru++;
    stableford += Math.max(0, 2 + ((pars[i] ?? 4) - (g - s)));
  }
  return { gross, net, stableford, thru };
}

const FORMAT_LABEL: Record<string, string> = { stableford: "Stableford", stroke: "Medal (stroke)", betterball: "Betterball" };
function fmtDate(d: string) { return new Date(d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }); }

export default function CompetitionsScreen({ navigation }: any) {
  const { member } = useMember();
  const [view, setView] = React.useState<"list" | "detail" | "card">("list");
  const [comps, setComps] = React.useState<CompetitionSummary[] | null>(null);
  const [detail, setDetail] = React.useState<CompetitionDetail | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [scores, setScores] = React.useState<number[]>(Array(18).fill(0));

  const loadList = React.useCallback(() => {
    competitionsApi.list().then(setComps).catch(() => setComps([]));
  }, []);
  React.useEffect(() => { loadList(); }, [loadList]);

  const openDetail = async (id: string) => {
    setView("detail"); setDetail(null);
    try { setDetail(await competitionsApi.detail(id, member?.id)); }
    catch (e: any) { Alert.alert("Couldn't open", e?.message ?? "Try again."); setView("list"); }
  };
  const refreshDetail = async () => { if (detail) setDetail(await competitionsApi.detail(detail.id, member?.id).catch(() => detail)); };

  const enter = async () => {
    if (!member || !detail) return;
    setBusy(true);
    try { await competitionsApi.enter(detail.id, member.id); await refreshDetail(); }
    catch (e: any) { Alert.alert("Couldn't enter", e?.message ?? "Try again."); }
    finally { setBusy(false); }
  };

  const openCard = () => {
    if (!detail) return;
    setScores(detail.myEntry?.holeScores?.length === 18 ? [...detail.myEntry.holeScores] : Array(18).fill(0));
    setView("card");
  };

  const submitCard = async () => {
    if (!member || !detail) return;
    setBusy(true);
    try {
      await competitionsApi.submitScore(detail.id, member.id, scores);
      await refreshDetail();
      setView("detail");
    } catch (e: any) { Alert.alert("Couldn't submit", e?.message ?? "Try again."); }
    finally { setBusy(false); }
  };

  // ----- not a member yet -----
  if (!member) {
    return (
      <Screen>
        <ScreenHeader onBack={() => navigation.goBack()} title="Competitions" subtitle="Club medals & Stableford" />
        <Card>
          <Text style={styles.lead}>Link your membership to enter competitions and post scores.</Text>
          <Button icon="🪪" label="Link my membership" onPress={() => navigation.navigate("Membership")} />
        </Card>
      </Screen>
    );
  }

  // ----- card entry -----
  if (view === "card" && detail) {
    const ph = detail.myEntry?.playingHandicap ?? 0;
    const pv = preview(scores, detail.pars, detail.sis, ph);
    const setHole = (i: number, v: number) => setScores((s) => { const n = [...s]; n[i] = Math.max(0, Math.min(15, v)); return n; });
    return (
      <Screen>
        <ScreenHeader onBack={() => setView("detail")} title={detail.name} subtitle={`Playing handicap ${ph} · enter your gross score`} />
        <Card accent>
          <View style={styles.totRow}>
            <Tot k="Thru" v={`${pv.thru}`} />
            <Tot k="Gross" v={pv.gross ? `${pv.gross}` : "—"} />
            <Tot k="Net" v={pv.thru ? `${pv.net}` : "—"} />
            <Tot k="Points" v={`${pv.stableford}`} />
          </View>
        </Card>
        <Card>
          {detail.pars.map((par, i) => {
            const recv = strokesOnHole(ph, detail.sis[i]);
            const g = scores[i] || 0;
            return (
              <View key={i} style={styles.holeRow}>
                <Text style={styles.holeNo}>{i + 1}</Text>
                <Text style={styles.holeMeta}>Par {par}{"  "}<Text style={styles.si}>SI {detail.sis[i]}{recv > 0 ? ` · +${recv}` : ""}</Text></Text>
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => setHole(i, g - 1)}><Text style={styles.stepTxt}>−</Text></TouchableOpacity>
                  <Text style={styles.stepVal}>{g > 0 ? g : "–"}</Text>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => setHole(i, (g || par) + 1)}><Text style={styles.stepTxt}>＋</Text></TouchableOpacity>
                </View>
              </View>
            );
          })}
        </Card>
        {busy ? <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.md }} /> : (
          <>
            <Button icon="✅" label="Submit card" onPress={submitCard} />
            <Button variant="ghost" label="Back" onPress={() => setView("detail")} />
          </>
        )}
      </Screen>
    );
  }

  // ----- detail + leaderboard -----
  if (view === "detail") {
    if (!detail) return <Screen><ScreenHeader onBack={() => setView("list")} title="Competition" /><ActivityIndicator color={colors.accent} /></Screen>;
    const stab = detail.format !== "stroke";
    const entered = detail.myEntry && detail.myEntry.status !== "withdrawn";
    return (
      <Screen>
        <ScreenHeader onBack={() => { setView("list"); loadList(); }} title={detail.name} subtitle={`${fmtDate(detail.date)} · ${FORMAT_LABEL[detail.format] ?? detail.format}`} />
        <Card accent>
          <View style={styles.rowHead}>
            <Text style={styles.h}>Your entry</Text>
            <Chip label={detail.status === "open" ? "Entries open" : detail.status} tone={detail.status === "open" ? "accent" : "muted"} />
          </View>
          {entered ? (
            <>
              <Text style={styles.body}>
                Entered · playing handicap {detail.myEntry!.playingHandicap}
                {detail.myEntry!.status === "submitted" ? ` · card in (${stab ? `${detail.myEntry!.stableford} pts` : `net ${detail.myEntry!.netTotal}`})` : ""}
              </Text>
              <Button icon="⛳" label={detail.myEntry!.status === "submitted" ? "Edit my card" : "Enter my card"} onPress={openCard} />
            </>
          ) : detail.status === "open" ? (
            <>
              <Text style={styles.body}>Enter this competition to post a score. Your handicap index {member.handicapIndex != null ? `(${member.handicapIndex.toFixed(1)})` : ""} sets your playing handicap.</Text>
              {busy ? <ActivityIndicator color={colors.accent} /> : <Button icon="✍️" label="Enter competition" onPress={enter} />}
            </>
          ) : (
            <Text style={styles.body}>Entries are closed for this competition.</Text>
          )}
        </Card>

        <Card>
          <View style={styles.rowHead}>
            <Text style={styles.h}>Leaderboard</Text>
            <TouchableOpacity onPress={refreshDetail}><Text style={styles.refresh}>↻</Text></TouchableOpacity>
          </View>
          {detail.leaderboard.length === 0 ? (
            <Text style={styles.muted}>No cards in yet — be the first to post.</Text>
          ) : (
            <>
              <View style={[styles.lbRow, styles.lbHead]}>
                <Text style={[styles.lbPos, styles.lbHeadTxt]}>#</Text>
                <Text style={[styles.lbName, styles.lbHeadTxt]}>Player</Text>
                <Text style={[styles.lbThru, styles.lbHeadTxt]}>Thru</Text>
                <Text style={[styles.lbKey, styles.lbHeadTxt]}>{stab ? "Pts" : "Net"}</Text>
              </View>
              {detail.leaderboard.map((r) => {
                const me = r.memberId === member.id;
                return (
                  <View key={r.entryId} style={[styles.lbRow, me && styles.lbMe]}>
                    <Text style={styles.lbPos}>{r.pos ?? "–"}</Text>
                    <Text style={styles.lbName} numberOfLines={1}>{r.name} <Text style={styles.lbHcp}>({r.playingHandicap})</Text></Text>
                    <Text style={styles.lbThru}>{r.thru || "–"}</Text>
                    <Text style={styles.lbKey}>{r.thru ? (stab ? r.stableford : r.net) : "–"}</Text>
                  </View>
                );
              })}
            </>
          )}
        </Card>
      </Screen>
    );
  }

  // ----- list -----
  return (
    <Screen>
      <ScreenHeader onBack={() => navigation.goBack()} title="Competitions" subtitle={CLUB_CONFIG?.shortName ?? "Club medals & Stableford"} />
      {comps === null ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : comps.length === 0 ? (
        <Card><Text style={styles.muted}>No competitions on the calendar yet. Check back soon.</Text></Card>
      ) : (
        comps.map((c) => (
          <Card key={c.id} onPress={() => openDetail(c.id)}>
            <View style={styles.rowHead}>
              <Text style={styles.h}>{c.name}</Text>
              <Chip label={c.status === "open" ? "Open" : c.status} tone={c.status === "open" ? "accent" : c.status === "results" ? "gold" : "muted"} />
            </View>
            <Text style={styles.body}>{fmtDate(c.date)} · {FORMAT_LABEL[c.format] ?? c.format}{c.entryCount ? ` · ${c.entryCount} entered` : ""}</Text>
            {c.description ? <Text style={styles.muted}>{c.description}</Text> : null}
          </Card>
        ))
      )}
    </Screen>
  );
}

function Tot({ k, v }: { k: string; v: string }) {
  return <View style={styles.tot}><Text style={styles.totK}>{k}</Text><Text style={styles.totV}>{v}</Text></View>;
}

const styles = StyleSheet.create({
  lead: { color: colors.textMuted, marginBottom: spacing.md, lineHeight: 20 },
  h: { color: colors.text, fontSize: 17, fontWeight: "800" },
  body: { color: colors.textMuted, marginVertical: spacing.xs, lineHeight: 20 },
  muted: { color: colors.textFaint, marginTop: 4 },
  rowHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
  refresh: { color: colors.accent, fontSize: 18, fontWeight: "800" },

  totRow: { flexDirection: "row", justifyContent: "space-between" },
  tot: { alignItems: "center", flex: 1 },
  totK: { color: colors.textFaint, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  totV: { color: colors.text, fontSize: 22, fontWeight: "800", marginTop: 2 },

  holeRow: { flexDirection: "row", alignItems: "center", paddingVertical: 7, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  holeNo: { color: colors.text, fontWeight: "800", width: 26, fontSize: 15 },
  holeMeta: { color: colors.textMuted, flex: 1, fontSize: 13 },
  si: { color: colors.textFaint, fontSize: 12 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 4 },
  stepBtn: { width: 34, height: 34, borderRadius: 9, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  stepTxt: { color: colors.accent, fontSize: 18, fontWeight: "800" },
  stepVal: { color: colors.text, width: 34, textAlign: "center", fontSize: 17, fontWeight: "800" },

  lbRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  lbHead: { borderTopWidth: 0 },
  lbHeadTxt: { color: colors.textFaint, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: "700" },
  lbMe: { backgroundColor: colors.accentSoft, borderRadius: radius.sm },
  lbPos: { width: 26, color: colors.text, fontWeight: "800" },
  lbName: { flex: 1, color: colors.text },
  lbHcp: { color: colors.textFaint, fontSize: 12 },
  lbThru: { width: 44, textAlign: "center", color: colors.textMuted },
  lbKey: { width: 46, textAlign: "right", color: colors.accent, fontWeight: "800" },
});
