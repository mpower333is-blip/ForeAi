import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import Svg, { Circle, Text as SvgText, G } from "react-native-svg";
import { Course } from "../data/courses";
import { Coord } from "../lib/geo";
import { TEvent, TPlayer, isPlayerLive, teamCaptain } from "../lib/tournament";
import { colors } from "../theme";

// A live overhead view of the whole course with a dot for each team that's on
// the app, plotted from the GPS positions their phones share via the heartbeat.
// Uses Esri World Imagery (no API key) as the backdrop — same approach as the
// per-hole SatelliteHole view — with an SVG overlay for the team markers.

// Distinct, high-contrast marker colours cycled per team.
const TEAM_COLORS = [
  "#8DFF6B", "#FFD36A", "#6BC6FF", "#FF8DA1", "#C79BFF",
  "#7CF5D0", "#FFB067", "#B6FF8E", "#FF9BE0", "#9AD0FF",
];

type TeamDot = { key: string; label: string; coord: Coord; color: string; live: number; isMe: boolean };

function avg(ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0) / ns.length;
}

export default function CourseMap({
  event,
  course,
  meId,
}: {
  event: TEvent;
  course: Course;
  meId?: string | null;
}) {
  const now = Date.now();

  // One dot per team, at the average position of its live members.
  const dots: TeamDot[] = [];
  event.groups.forEach((g, i) => {
    const live = g.playerIds
      .map((id) => event.players.find((p) => p.id === id))
      .filter((p): p is TPlayer => !!p && isPlayerLive(p, now) && p.lat != null && p.lng != null);
    if (live.length === 0) return;
    const isScramble = event.format === "scramble";
    // Prefer the captain's fix if they're live, else the group's average.
    const cap = teamCaptain(g);
    const capP = live.find((p) => p.id === cap);
    const coord: Coord = capP
      ? { lat: capP.lat as number, lng: capP.lng as number }
      : { lat: avg(live.map((p) => p.lat as number)), lng: avg(live.map((p) => p.lng as number)) };
    dots.push({
      key: g.id,
      label: `${isScramble ? "T" : "G"}${i + 1}`,
      coord,
      color: TEAM_COLORS[i % TEAM_COLORS.length],
      live: live.length,
      isMe: !!meId && g.playerIds.includes(meId),
    });
  });

  // Frame the view around everything we know: live teams, any hole coordinates
  // the course has, and the course centre.
  const holeCoords: Coord[] = course.holes
    .map((h) => h.green ?? h.tee)
    .filter((c): c is Coord => !!c);
  const framePoints: Coord[] = [
    ...dots.map((d) => d.coord),
    ...holeCoords,
    ...(course.center ? [course.center] : []),
  ];

  if (framePoints.length === 0) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.none}>
          Waiting for the first live position — teams appear here as players open the app on the
          course.
        </Text>
      </View>
    );
  }

  // Square ground window (in linear 4326) that fits all the framing points,
  // with padding and a sensible minimum so a single point isn't over-zoomed.
  const lats = framePoints.map((p) => p.lat);
  const lngs = framePoints.map((p) => p.lng);
  const cLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const cLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const cosLat = Math.cos((cLat * Math.PI) / 180) || 1;
  const MIN_SPAN = 0.009; // ~1 km — enough to show a course around a lone dot
  const dLat = Math.max(...lats) - Math.min(...lats);
  const dLng = Math.max(...lngs) - Math.min(...lngs);
  // Make the window square in ground terms (image + container are square).
  let latSpan = Math.max(dLat, dLng * cosLat, MIN_SPAN) * 1.35;
  const lngSpan = latSpan / cosLat;

  const minX = cLng - lngSpan / 2;
  const maxX = cLng + lngSpan / 2;
  const minY = cLat - latSpan / 2;
  const maxY = cLat + latSpan / 2;

  const bbox = `${minX},${minY},${maxX},${maxY}`;
  const url =
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export` +
    `?bbox=${bbox}&bboxSR=4326&imageSR=4326&size=640,640&format=png&transparent=false&f=image`;

  const toXY = (p: Coord) => ({
    x: ((p.lng - minX) / (maxX - minX)) * 100,
    y: ((maxY - p.lat) / (maxY - minY)) * 100,
  });

  return (
    <View>
      <View style={styles.wrap}>
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Faint hole markers if the course has GPS. */}
          {course.holes.map((h) => {
            const c = h.green ?? h.tee;
            if (!c) return null;
            const { x, y } = toXY(c);
            return <Circle key={`h${h.number}`} cx={x} cy={y} r="0.8" fill="rgba(255,255,255,0.55)" />;
          })}
          {/* Team dots — the current player's team gets a "you are here" ring. */}
          {dots.map((d) => {
            const { x, y } = toXY(d.coord);
            return (
              <G key={d.key}>
                {d.isMe && (
                  <>
                    <Circle cx={x} cy={y} r="4.6" fill="none" stroke="#FFFFFF" strokeWidth="0.9" />
                    <Circle cx={x} cy={y} r="4.6" fill={d.color} fillOpacity={0.18} />
                    <SvgText
                      x={x}
                      y={y - 5.6}
                      fontSize="2.3"
                      fontWeight="bold"
                      fill="#FFFFFF"
                      textAnchor="middle"
                    >
                      You are here
                    </SvgText>
                  </>
                )}
                <Circle cx={x} cy={y} r="2.6" fill={d.color} stroke="#04120B" strokeWidth="0.5" />
                <SvgText
                  x={x}
                  y={y + 0.9}
                  fontSize="2.4"
                  fontWeight="bold"
                  fill="#04120B"
                  textAnchor="middle"
                >
                  {d.label}
                </SvgText>
              </G>
            );
          })}
        </Svg>
        <Text style={styles.tag}>
          {dots.length > 0 ? `${dots.length} team${dots.length === 1 ? "" : "s"} live` : "Live map"}
        </Text>
        <Text style={styles.attr}>Imagery © Esri</Text>
      </View>

      {dots.length > 0 && (
        <View style={styles.legend}>
          {dots.map((d) => {
            const names = event.groups
              .find((g) => g.id === d.key)
              ?.playerIds.map((id) => event.players.find((p) => p.id === id)?.name)
              .filter(Boolean)
              .join(", ");
            return (
              <View key={d.key} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: d.color }, d.isMe && styles.legendDotMe]} />
                <Text style={styles.legendLabel}>{d.label}</Text>
                <Text style={styles.legendNames} numberOfLines={1}>
                  {names || "—"}
                  {d.isMe ? "  · you" : ""}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#0a2016",
    alignItems: "center",
    justifyContent: "center",
  },
  none: { color: colors.textFaint, fontSize: 14, textAlign: "center", paddingHorizontal: 20 },
  tag: {
    position: "absolute",
    top: 8,
    left: 10,
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  attr: {
    position: "absolute",
    bottom: 4,
    right: 6,
    color: "rgba(255,255,255,0.7)",
    fontSize: 9,
  },
  legend: { marginTop: 10, gap: 6 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendDotMe: { borderWidth: 2, borderColor: "#FFFFFF" },
  legendLabel: { color: colors.text, fontSize: 13, fontWeight: "800", width: 30 },
  legendNames: { color: colors.textMuted, fontSize: 13, flex: 1 },
});
