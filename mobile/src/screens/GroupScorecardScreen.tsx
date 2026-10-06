import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from "react-native";
import { Screen, ScreenHeader, Card, Button } from "../components/ui";
import { colors, spacing, radius, type } from "../theme";
import { useRound } from "../state/RoundContext";
import { useCourseCoords } from "../state/CourseCoordsContext";
import { useLocation } from "../hooks/useLocation";
import { getCourse } from "../data/courses";
import { courseHandicap, strokesReceivedOnHole, stablefordPoints } from "../lib/golfEngine";
import { greenDistancesMeters } from "../lib/geo";
import { loadJSON, saveJSON } from "../lib/storage";

// Quick fourball scorecard — score a whole group on ONE phone with NO event /
// tee-sheet setup. Add 2–4 players + handicaps and go: per hole you get par,
// each player's strokes received, a big +/- score, pickup, net and Stableford
// points, GPS distance to the green, and a running leaderboard. Works offline
// and is saved on the device so the round survives a restart.

const KEY = "foreai.groupround.v1";
const MAX_PLAYERS = 6;

type GPlayer = { id: string; name: string; handicap: number };
type Saved = {
  courseId: string;
  players: GPlayer[];
  scores: Record<string, Record<number, number>>;
  pickups: Record<string, Record<number, boolean>>;
  hole: number;
};

let uid = 0;
const newId = () => `gp_${Date.now()}_${uid++}`;

export default function GroupScorecardScreen({ navigation }: any) {
  const round = useRound();
  const { points: surveyed } = useCourseCoords();
  const loc = useLocation();

  const [ready, setReady] = useState(false);
  const [courseId, setCourseId] = useState(round.courseId);
  const [players, setPlayers] = useState<GPlayer[]>([]);
  const [scores, setScores] = useState<Record<string, Record<number, number>>>({});
  const [pickups, setPickups] = useState<Record<string, Record<number, boolean>>>({});
  const [hole, setHole] = useState(1);

  // Setup-form fields.
  const [newName, setNewName] = useState("");
  const [newHcp, setNewHcp] = useState("");

  // Load any saved round.
  useEffect(() => {
    loadJSON<Saved>(KEY).then((s) => {
      if (s) {
        setCourseId(s.courseId);
        setPlayers(s.players ?? []);
        setScores(s.scores ?? {});
        setPickups(s.pickups ?? {});
        setHole(s.hole ?? 1);
      }
      setReady(true);
    });
  }, []);

  // Persist whenever anything changes.
  useEffect(() => {
    if (!ready) return;
    saveJSON(KEY, { courseId, players, scores, pickups, hole });
  }, [ready, courseId, players, scores, pickups, hole]);

  const course = useMemo(() => getCourse(courseId), [courseId]);
  const holes = course.holes;
  const holeCount = holes.length || 18;
  const h = holes.find((x) => x.number === hole) ?? holes[0];

  // GPS to the green for this hole (surveyed coords override bundled).
  const cap = surveyed(courseId, h.number);
  const green = cap.green ?? h.green ?? null;
  const greenFront = cap.greenFront ?? h.greenFront;
  const greenBack = cap.greenBack ?? h.greenBack;
  const pin = green ?? greenFront ?? greenBack ?? null;
  const fmb = loc.coord && pin ? greenDistancesMeters(loc.coord, { greenFront, green: green ?? pin, greenBack }) : null;

  const addPlayer = () => {
    const name = newName.trim();
    const hcp = Math.round(Number(newHcp) || 0);
    if (!name || players.length >= MAX_PLAYERS) return;
    setPlayers((p) => [...p, { id: newId(), name, handicap: hcp }]);
    setNewName("");
    setNewHcp("");
  };
  const removePlayer = (id: string) => setPlayers((p) => p.filter((x) => x.id !== id));

  const setScore = (pid: string, strokes: number) =>
    setScores((prev) => ({ ...prev, [pid]: { ...(prev[pid] ?? {}), [h.number]: Math.max(1, strokes) } }));
  const clearScore = (pid: string) =>
    setScores((prev) => {
      const c = { ...(prev[pid] ?? {}) };
      delete c[h.number];
      return { ...prev, [pid]: c };
    });
  const togglePickup = (pid: string) =>
    setPickups((prev) => {
      const on = !prev[pid]?.[h.number];
      if (on) clearScore(pid);
      return { ...prev, [pid]: { ...(prev[pid] ?? {}), [h.number]: on } };
    });

  const resetRound = () => {
    setScores({});
    setPickups({});
    setHole(1);
  };

  // Per-player running totals across the course.
  const totals = useMemo(() => {
    return players.map((pl) => {
      const chcp = courseHandicap(pl.handicap);
      let pts = 0;
      let gross = 0;
      let played = 0;
      let toPar = 0;
      for (const hole of holes) {
        const received = strokesReceivedOnHole(chcp, hole.si);
        const picked = pickups[pl.id]?.[hole.number];
        const sc = scores[pl.id]?.[hole.number];
        if (!sc && !picked) continue;
        played += 1;
        const g = picked ? hole.par + received + 2 : (sc as number);
        gross += g;
        toPar += g - hole.par;
        pts += picked ? 0 : stablefordPoints(hole.par, g, received);
      }
      return { player: pl, chcp, pts, gross, played, toPar };
    });
  }, [players, scores, pickups, holes]);

  const leaderboard = useMemo(
    () => [...totals].filter((t) => t.played > 0).sort((a, b) => b.pts - a.pts),
    [totals]
  );

  if (!ready) return <Screen><ScreenHeader title="Fourball scorecard" /></Screen>;

  // ── Setup ──────────────────────────────────────────────────────────────────
  if (players.length === 0) {
    return (
      <Screen>
        <ScreenHeader
          title="Score a fourball"
          subtitle="One phone for the whole group — no event needed"
          onBack={navigation?.canGoBack?.() ? () => navigation.goBack() : undefined}
        />
        <Card accent>
          <Text style={styles.courseLine}>⛳ {course.name}</Text>
          <Button variant="ghost" label="Change course" onPress={() => navigation.navigate("CourseSelect")} />
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Add players</Text>
          <Text style={styles.hint}>Add everyone in the group with their handicap. You'll score for all of them.</Text>
          <View style={styles.addRow}>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Player name"
              placeholderTextColor={colors.textFaint}
              style={[styles.input, { flex: 1 }]}
              returnKeyType="done"
              onSubmitEditing={addPlayer}
            />
            <TextInput
              value={newHcp}
              onChangeText={setNewHcp}
              placeholder="HCP"
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              style={[styles.input, { width: 72 }]}
            />
            <TouchableOpacity style={styles.addBtn} onPress={addPlayer}>
              <Text style={styles.addBtnTxt}>＋</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hintSmall}>Up to {MAX_PLAYERS} players.</Text>
        </Card>
      </Screen>
    );
  }

  // ── Scoring ─────────────────────────────────────────────────────────────────
  const goHole = (n: number) => setHole(Math.max(1, Math.min(holeCount, n)));

  return (
    <Screen>
      <ScreenHeader
        title="Fourball scorecard"
        subtitle={`⛳ ${course.name}`}
        onBack={navigation?.canGoBack?.() ? () => navigation.goBack() : undefined}
      />

      {/* Hole + GPS */}
      <Card accent>
        <View style={styles.holeNav}>
          <TouchableOpacity style={styles.navBtn} onPress={() => goHole(hole - 1)} disabled={hole <= 1}>
            <Text style={[styles.navTxt, hole <= 1 && styles.navOff]}>‹</Text>
          </TouchableOpacity>
          <View style={styles.holeMid}>
            <Text style={styles.holeNo}>Hole {h.number}</Text>
            <Text style={styles.holeMeta}>Par {h.par} · SI {h.si}</Text>
          </View>
          <TouchableOpacity style={styles.navBtn} onPress={() => goHole(hole + 1)} disabled={hole >= holeCount}>
            <Text style={[styles.navTxt, hole >= holeCount && styles.navOff]}>›</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.gpsRow}>
          <Gps label="Front" v={fmb?.front} />
          <Gps label="Middle" v={fmb?.middle} big />
          <Gps label="Back" v={fmb?.back} />
        </View>
        {!pin && <Text style={styles.hintSmall}>No GPS for this hole yet — survey it from the Clubhouse to get distances.</Text>}
      </Card>

      {/* Player score rows */}
      {players.map((pl) => {
        const chcp = courseHandicap(pl.handicap);
        const received = strokesReceivedOnHole(chcp, h.si);
        const picked = !!pickups[pl.id]?.[h.number];
        const sc = scores[pl.id]?.[h.number];
        const net = sc != null ? sc - received : null;
        const pts = picked ? 0 : sc != null ? stablefordPoints(h.par, sc, received) : null;
        const dots = "•".repeat(Math.min(received, 4));
        return (
          <Card key={pl.id} style={{ paddingVertical: spacing.sm }}>
            <View style={styles.pRow}>
              <View style={styles.pInfo}>
                <Text style={styles.pName} numberOfLines={1}>{pl.name}</Text>
                <Text style={styles.pMeta}>
                  HCP {pl.handicap}{received > 0 ? `  ·  gets ${received} ${dots}` : ""}
                </Text>
              </View>

              {picked ? (
                <TouchableOpacity style={styles.pickedPill} onPress={() => togglePickup(pl.id)}>
                  <Text style={styles.pickedTxt}>PICKED UP ✕</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.stepper}>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => (sc ? setScore(pl.id, sc - 1) : null)}>
                    <Text style={styles.stepTxt}>−</Text>
                  </TouchableOpacity>
                  <View style={styles.scoreBox}>
                    <Text style={styles.scoreNum}>{sc ?? "–"}</Text>
                  </View>
                  <TouchableOpacity style={styles.stepBtn} onPress={() => setScore(pl.id, (sc ?? h.par) + (sc ? 1 : 0))}>
                    <Text style={styles.stepTxt}>＋</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.pTotals}>
                <Text style={styles.pTotLabel}>NET</Text>
                <Text style={styles.pTotVal}>{net != null ? net : "–"}</Text>
                <Text style={styles.pTotLabel}>PTS</Text>
                <Text style={[styles.pTotVal, { color: colors.accent }]}>{pts != null ? pts : "–"}</Text>
              </View>
            </View>
            <View style={styles.pActions}>
              {sc != null && (
                <TouchableOpacity onPress={() => clearScore(pl.id)}>
                  <Text style={styles.linkMuted}>clear</Text>
                </TouchableOpacity>
              )}
              {!picked && (
                <TouchableOpacity onPress={() => togglePickup(pl.id)}>
                  <Text style={styles.linkMuted}>pick up</Text>
                </TouchableOpacity>
              )}
            </View>
          </Card>
        );
      })}

      <Button
        label={hole < holeCount ? "Next hole →" : "Review leaderboard"}
        onPress={() => (hole < holeCount ? goHole(hole + 1) : null)}
      />

      {/* Running leaderboard */}
      <Card>
        <Text style={styles.sectionTitle}>Leaderboard</Text>
        {leaderboard.length === 0 ? (
          <Text style={styles.hint}>Enter a score to start the leaderboard.</Text>
        ) : (
          leaderboard.map((t, i) => (
            <View key={t.player.id} style={styles.lbRow}>
              <Text style={styles.lbPos}>{i + 1}</Text>
              <Text style={styles.lbName} numberOfLines={1}>{t.player.name}</Text>
              <Text style={styles.lbThru}>thru {t.played}</Text>
              <Text style={styles.lbPts}>{t.pts} pts</Text>
            </View>
          ))
        )}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Players</Text>
        <AddPlayerInline
          disabled={players.length >= MAX_PLAYERS}
          onAdd={(name, hcp) => setPlayers((p) => [...p, { id: newId(), name, handicap: hcp }])}
        />
        {players.map((pl) => (
          <View key={pl.id} style={styles.editRow}>
            <Text style={styles.editName}>{pl.name} · HCP {pl.handicap}</Text>
            <TouchableOpacity onPress={() => removePlayer(pl.id)}>
              <Text style={styles.linkDanger}>remove</Text>
            </TouchableOpacity>
          </View>
        ))}
        <Button variant="ghost" label="Start a new round (clear scores)" onPress={resetRound} />
      </Card>
    </Screen>
  );
}

function Gps({ label, v, big }: { label: string; v?: number | null; big?: boolean }) {
  return (
    <View style={styles.gpsCol}>
      <Text style={styles.gpsLabel}>{label}</Text>
      <Text style={[styles.gpsVal, big && styles.gpsBig]}>{v != null ? v : "–"}<Text style={styles.gpsUnit}>m</Text></Text>
    </View>
  );
}

function AddPlayerInline({ onAdd, disabled }: { onAdd: (name: string, hcp: number) => void; disabled?: boolean }) {
  const [n, setN] = useState("");
  const [hc, setHc] = useState("");
  if (disabled) return null;
  return (
    <View style={styles.addRow}>
      <TextInput value={n} onChangeText={setN} placeholder="Add a player" placeholderTextColor={colors.textFaint} style={[styles.input, { flex: 1 }]} />
      <TextInput value={hc} onChangeText={setHc} placeholder="HCP" placeholderTextColor={colors.textFaint} keyboardType="number-pad" style={[styles.input, { width: 72 }]} />
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => {
          if (n.trim()) {
            onAdd(n.trim(), Math.round(Number(hc) || 0));
            setN("");
            setHc("");
          }
        }}
      >
        <Text style={styles.addBtnTxt}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  courseLine: { color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: 8 },
  hint: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: spacing.sm },
  hintSmall: { color: colors.textFaint, fontSize: 12, marginTop: 8 },

  addRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontSize: 16,
  },
  addBtn: { width: 48, height: 46, borderRadius: radius.sm, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  addBtnTxt: { color: colors.onAccent, fontSize: 24, fontWeight: "800" },

  holeNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navBtn: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  navTxt: { color: colors.accent, fontSize: 28, fontWeight: "800" },
  navOff: { color: colors.textFaint, opacity: 0.4 },
  holeMid: { alignItems: "center" },
  holeNo: { ...(type.h1 as any), color: colors.text },
  holeMeta: { color: colors.textMuted, fontSize: 13, marginTop: 2 },

  gpsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  gpsCol: { flex: 1, alignItems: "center", backgroundColor: colors.bg, borderRadius: radius.sm, paddingVertical: 10 },
  gpsLabel: { color: colors.textMuted, fontSize: 12 },
  gpsVal: { color: colors.text, fontSize: 22, fontWeight: "800", marginTop: 2 },
  gpsBig: { fontSize: 30, color: colors.accent },
  gpsUnit: { fontSize: 12, color: colors.textFaint, fontWeight: "600" },

  pRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  pInfo: { flex: 1 },
  pName: { color: colors.text, fontSize: 17, fontWeight: "800" },
  pMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepBtn: { width: 40, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  stepTxt: { color: colors.accent, fontSize: 24, fontWeight: "800" },
  scoreBox: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: colors.accent, alignItems: "center", justifyContent: "center" },
  scoreNum: { color: colors.text, fontSize: 24, fontWeight: "800" },
  pickedPill: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.warning, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 12 },
  pickedTxt: { color: colors.warning, fontWeight: "800", fontSize: 12 },
  pTotals: { alignItems: "center", minWidth: 44 },
  pTotLabel: { color: colors.textFaint, fontSize: 10, fontWeight: "700" },
  pTotVal: { color: colors.text, fontSize: 18, fontWeight: "800" },
  pActions: { flexDirection: "row", gap: 18, marginTop: 8, justifyContent: "flex-end" },
  linkMuted: { color: colors.textFaint, fontSize: 13, fontWeight: "700" },
  linkDanger: { color: colors.negative, fontSize: 13, fontWeight: "700" },

  lbRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 },
  lbPos: { color: colors.textMuted, fontSize: 15, fontWeight: "800", width: 22 },
  lbName: { color: colors.text, fontSize: 15, fontWeight: "700", flex: 1 },
  lbThru: { color: colors.textFaint, fontSize: 13 },
  lbPts: { color: colors.accent, fontSize: 16, fontWeight: "800", width: 64, textAlign: "right" },

  editRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  editName: { color: colors.text, fontSize: 15 },
});
