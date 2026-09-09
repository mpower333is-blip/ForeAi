import React from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Share, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import { Screen, ScreenHeader, Card, Button, Chip } from "../components/ui";
import { colors, spacing, radius, type as ty } from "../theme";
import { useLocation } from "../hooks/useLocation";
import { Coord } from "../lib/geo";

// The standalone "ForeAi Survey" app (com.foreai.surveyor). A pure on-course
// GPS capture tool: you WALK or DRIVE the hole and tap to record each point at
// your real location — the tee (by colour), the green front/middle/back, each
// hazard as you pass it, and the fairway line down the middle. Export hands the
// coords file to Share, in the same format the web tool produces, so it bakes
// into the app the same way. (The satellite map-drawing tool lives on the
// website for off-course desk work.)

type Pt = Coord;
type Hz = { type: "bunker" | "water" | "tree"; mode?: "pond" | "river"; width?: number; points: Pt[]; _closed?: boolean };
type Hole = { tees: Record<string, Pt>; green?: Pt; greenFront?: Pt; greenBack?: Pt; fairway: Pt[]; hazards: Hz[] };
type Book = { course: string; holeCount: number; holes: Record<number, Hole> };

const KEY = "foreai.surveyapp.v1";
const TEES = ["White", "Blue", "Red", "Yellow", "Green", "Black", "Gold"];
const TEE_COLOR: Record<string, string> = {
  White: "#f4f4f4", Blue: "#5aa0ff", Red: "#e8563e", Yellow: "#f2c94c", Green: "#39d98a", Black: "#20242b", Gold: "#e9c46a",
};
const TEE_ORDER = ["Black", "Blue", "White", "Gold", "Yellow", "Green", "Red"];
function backTee(h: Hole): Pt | undefined {
  for (const n of TEE_ORDER) if (h.tees[n]) return h.tees[n];
  const k = Object.keys(h.tees)[0];
  return k ? h.tees[k] : undefined;
}
const emptyHole = (): Hole => ({ tees: {}, fairway: [], hazards: [] });

export default function SurveyApp() {
  const loc = useLocation();
  const [book, setBook] = React.useState<Book>({ course: "", holeCount: 18, holes: {} });
  const [cur, setCur] = React.useState(1);
  const [page, setPage] = React.useState<"capture" | "hazards" | "fairway">("capture");
  const [teeColor, setTeeColor] = React.useState("White");
  const [hzType, setHzType] = React.useState<Hz["type"]>("bunker");
  const [waterMode, setWaterMode] = React.useState<"pond" | "river">("pond");
  const [loaded, setLoaded] = React.useState(false);

  // Load / persist.
  React.useEffect(() => {
    (async () => {
      try { const raw = await AsyncStorage.getItem(KEY); if (raw) setBook(JSON.parse(raw)); } catch {}
      setLoaded(true);
    })();
  }, []);
  const persist = (b: Book) => { setBook(b); AsyncStorage.setItem(KEY, JSON.stringify(b)).catch(() => {}); };

  const hole = book.holes[cur] ?? emptyHole();
  const setHole = (h: Hole) => persist({ ...book, holes: { ...book.holes, [cur]: h } });
  const acc = loc.accuracy;
  const accOk = acc != null && acc <= 12;
  const coord = loc.coord;

  const markTee = () => { if (coord) setHole({ ...hole, tees: { ...hole.tees, [teeColor]: coord } }); };
  const markGreen = (k: "green" | "greenFront" | "greenBack") => { if (coord) setHole({ ...hole, [k]: coord }); };
  const addFairway = () => { if (coord) setHole({ ...hole, fairway: [...hole.fairway, coord] }); };
  const undoFairway = () => setHole({ ...hole, fairway: hole.fairway.slice(0, -1) });

  const openHz = hole.hazards[hole.hazards.length - 1];
  const openIsCurrentType = openHz && openHz.type === hzType && (hzType !== "water" || openHz.mode === waterMode) && !openHz._closed;
  const markHazard = () => {
    if (!coord) return;
    const list = [...hole.hazards];
    let hz = list[list.length - 1] as (Hz & { _closed?: boolean }) | undefined;
    if (!hz || hz._closed || hz.type !== hzType || (hzType === "water" && hz.mode !== waterMode)) {
      hz = hzType === "water" ? { type: "water", mode: waterMode, ...(waterMode === "river" ? { width: 10 } : {}), points: [] }
                              : { type: hzType, points: [] };
      list.push(hz);
    }
    hz.points = [...hz.points, coord];
    setHole({ ...hole, hazards: list });
  };
  const finishHazard = () => {
    const list = [...hole.hazards];
    const hz = list[list.length - 1] as (Hz & { _closed?: boolean }) | undefined;
    if (hz && !hz._closed) { if (!hz.points.length) list.pop(); else hz._closed = true; setHole({ ...hole, hazards: list }); }
  };
  const undoHazardPoint = () => {
    const list = [...hole.hazards];
    const hz = list[list.length - 1] as (Hz & { _closed?: boolean }) | undefined;
    if (!hz) return;
    hz.points = hz.points.slice(0, -1);
    if (!hz.points.length) list.pop();
    setHole({ ...hole, hazards: list });
  };

  const step = (d: number) => { setCur((c) => Math.max(1, Math.min(book.holeCount, c + d))); setPage("capture"); };

  const greensDone = Object.values(book.holes).filter((h) => h.green).length;

  const exportSurvey = async () => {
    const holes: any[] = [];
    for (let n = 1; n <= book.holeCount; n++) {
      const h = book.holes[n]; if (!h) continue;
      const o: any = { hole: n };
      const bt = backTee(h); if (bt) o.tee = bt;
      if (h.green) o.green = h.green;
      if (h.greenFront) o.greenFront = h.greenFront;
      if (h.greenBack) o.greenBack = h.greenBack;
      const teeNames = Object.keys(h.tees);
      if (teeNames.length) o.tees = teeNames.map((name) => ({ name, lat: h.tees[name].lat, lng: h.tees[name].lng }));
      if (h.fairway.length) o.fairway = h.fairway;
      const hz = h.hazards.filter((z) => z.points.length).map((z) => (z.type === "water" && z.width ? { type: "water", width: z.width, points: z.points } : { type: z.type, points: z.points }));
      if (hz.length) o.hazards = hz;
      if (Object.keys(o).length > 1) holes.push(o);
    }
    const data = { course: book.course || "(unnamed course)", capturedAt: new Date().toISOString(), holeCount: book.holeCount, holes };
    const json = JSON.stringify(data, null, 2);
    const fname = (book.course || "course").replace(/[^a-z0-9]+/gi, "-").toLowerCase() + "-coords.json";
    try {
      const uri = (FileSystem.cacheDirectory || "") + fname;
      await FileSystem.writeAsStringAsync(uri, json);
      await Share.share(Platform.OS === "ios" ? { url: uri } : { title: fname, message: json });
    } catch {}
  };

  if (!loaded) return <Screen><Text style={styles.dim}>Loading…</Text></Screen>;

  return (
    <Screen>
      <ScreenHeader title="Course Survey" subtitle="📍 Walk or drive the hole — tap to record each point" />

      {/* Course name + hole nav */}
      <Card>
        <Text style={styles.lbl}>Course</Text>
        <TextInput
          style={styles.input}
          value={book.course}
          onChangeText={(t) => persist({ ...book, course: t })}
          placeholder="Course name (e.g. Kempton Park Golf Club)"
          placeholderTextColor={colors.textFaint}
        />
        <View style={styles.holeRow}>
          <TouchableOpacity style={styles.nav} onPress={() => step(-1)}><Text style={styles.navTxt}>‹</Text></TouchableOpacity>
          <View style={{ alignItems: "center", flex: 1 }}>
            <Text style={styles.holeNo}>Hole {cur}</Text>
            <Text style={styles.dim}>{greensDone} / {book.holeCount} greens marked</Text>
          </View>
          <TouchableOpacity style={styles.nav} onPress={() => step(1)}><Text style={styles.navTxt}>›</Text></TouchableOpacity>
        </View>
        <View style={styles.accRow}>
          <Chip label={acc != null ? `GPS ±${Math.round(acc)}m` : "Locating…"} tone={accOk ? "accent" : "gold"} />
          {loc.status === "denied" && <Text style={styles.warn}>Turn on location to capture.</Text>}
          {!accOk && acc != null && <Text style={styles.dim}>Wait for ≤ 12m for a good fix.</Text>}
        </View>
      </Card>

      {page === "capture" && (
        <>
          {/* Tees */}
          <Card>
            <Text style={styles.section}>🏳️ Tee boxes</Text>
            <View style={styles.teeWrap}>
              {TEES.map((name) => (
                <TouchableOpacity key={name} onPress={() => setTeeColor(name)}
                  style={[styles.teeChip, teeColor === name && styles.teeChipOn]}>
                  <View style={[styles.teeDot, { backgroundColor: TEE_COLOR[name] }]} />
                  <Text style={styles.teeTxt}>{name}{hole.tees[name] ? " ✓" : ""}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button label={coord ? `Mark ${teeColor} tee here` : "Locating GPS…"} onPress={markTee} />
          </Card>

          {/* Green */}
          <Card>
            <Text style={styles.section}>🟢 Green</Text>
            {(["greenFront", "green", "greenBack"] as const).map((k) => (
              <View key={k} style={styles.markRow}>
                <Text style={styles.markLbl}>{k === "greenFront" ? "Front" : k === "green" ? "Middle (pin)" : "Back"} {hole[k] ? "✓" : ""}</Text>
                <TouchableOpacity style={[styles.mark, !coord && styles.markOff]} disabled={!coord} onPress={() => markGreen(k)}>
                  <Text style={styles.markTxt}>{hole[k] ? "Re-mark" : "Mark here"}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </Card>

          {/* Next steps */}
          <Card>
            <Button label={`⛳ Hazards on hole ${cur} (${hole.hazards.length})`} variant="ghost" onPress={() => setPage("hazards")} />
            <Button label={`🛣 Fairway line (${hole.fairway.length} pts)`} variant="ghost" onPress={() => setPage("fairway")} />
            <Text style={styles.dim}>Do the tee and green first, then walk the fairway line and mark the hazards.</Text>
          </Card>

          <Card>
            <Button label="↗ Export / share the survey" variant="ghost" onPress={exportSurvey} />
          </Card>
        </>
      )}

      {page === "hazards" && (
        <>
          <Card accent>
            <Text style={styles.section}>⛳ Hazards · hole {cur}</Text>
            <Text style={styles.dim}>Pick a type, then tap “Mark point” at each spot as you pass it. Tap around a bunker/tree-line/pond, then Finish.</Text>
            <View style={styles.teeWrap}>
              {(["bunker", "water", "tree"] as const).map((t) => (
                <TouchableOpacity key={t} onPress={() => setHzType(t)} style={[styles.typeChip, hzType === t && styles.teeChipOn]}>
                  <Text style={styles.teeTxt}>{t === "bunker" ? "🏖️ Bunker" : t === "water" ? "💧 Water" : "🌳 Trees"}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {hzType === "water" && (
              <View style={styles.teeWrap}>
                {(["pond", "river"] as const).map((m) => (
                  <TouchableOpacity key={m} onPress={() => setWaterMode(m)} style={[styles.typeChip, waterMode === m && styles.teeChipOn]}>
                    <Text style={styles.teeTxt}>{m === "pond" ? "Pond (loop)" : "River (line)"}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Button label={coord ? "＋ Mark point here" : "Locating GPS…"} onPress={markHazard} />
            <View style={styles.rowBtns}>
              <Button label="Undo point" variant="ghost" onPress={undoHazardPoint} />
              <Button label="✓ Finish this hazard" variant="ghost" onPress={finishHazard} />
            </View>
            <Text style={styles.dim}>{hole.hazards.length} hazard(s) on this hole{openIsCurrentType ? ` · drawing ${openHz.points.length} pts…` : ""}</Text>
          </Card>
          <Card><Button label="‹ Back to hole" onPress={() => setPage("capture")} /></Card>
        </>
      )}

      {page === "fairway" && (
        <>
          <Card accent>
            <Text style={styles.section}>🛣 Fairway line · hole {cur}</Text>
            <Text style={styles.dim}>Walk or drive from the tee toward the green and tap at each bend down the middle. The app draws the playing line through these.</Text>
            <Button label={coord ? "＋ Add fairway point here" : "Locating GPS…"} onPress={addFairway} />
            <View style={styles.rowBtns}>
              <Button label="Undo point" variant="ghost" onPress={undoFairway} />
            </View>
            <Text style={styles.dim}>{hole.fairway.length} fairway point(s) recorded.</Text>
          </Card>
          <Card><Button label="‹ Back to hole" onPress={() => setPage("capture")} /></Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dim: { color: colors.textMuted, fontSize: 13, marginTop: 6 },
  warn: { color: colors.negative, fontSize: 13 },
  lbl: { color: colors.textMuted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  input: { color: colors.text, fontSize: 16, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: 10, marginTop: 6 },
  holeRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.md },
  nav: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  navTxt: { color: colors.accent, fontSize: 28, fontWeight: "800" },
  holeNo: { ...(ty.h1 as any), color: colors.text },
  accRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: spacing.sm, flexWrap: "wrap" },
  section: { color: colors.text, fontSize: 17, fontWeight: "800", marginBottom: 6 },
  teeWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 8 },
  teeChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 12 },
  typeChip: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14 },
  teeChipOn: { borderColor: colors.accent, backgroundColor: colors.surface },
  teeDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: "#08130c" },
  teeTxt: { color: colors.text, fontSize: 14, fontWeight: "700" },
  markRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  markLbl: { color: colors.text, fontSize: 15, fontWeight: "600", flex: 1 },
  mark: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: 9, paddingHorizontal: 16 },
  markOff: { opacity: 0.4 },
  markTxt: { color: colors.onAccent, fontWeight: "800", fontSize: 14 },
  rowBtns: { flexDirection: "row", gap: 10 },
});
