import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import Svg, { Line, Circle, Polyline } from "react-native-svg";
import { Hole } from "../data/courses";
import { Coord, haversineMeters } from "../lib/geo";
import { colors } from "../theme";

// Real satellite imagery for a hole using Esri World Imagery (no API key).
// Frames the hole from every point we have (tee, green, green edges, hazards),
// draws the tee→green line, the green front/middle/back, and any mapped
// bunkers / water / trees on top. Falls back to a course-wide view when a hole
// has no GPS yet. The container is square so the overlay lines up with the image.
export default function SatelliteHole({
  hole,
  center,
  player,
}: {
  hole: Hole;
  center?: Coord;
  player?: Coord | null; // live GPS position, when playing the hole
}) {
  const hazards = hole.hazards ?? [];
  const pts: Coord[] = [];
  if (hole.tee) pts.push(hole.tee);
  if (hole.green) pts.push(hole.green);
  if (hole.greenFront) pts.push(hole.greenFront);
  if (hole.greenBack) pts.push(hole.greenBack);
  if (player) pts.push(player);
  const fairway = hole.fairway ?? [];
  fairway.forEach((p) => pts.push(p));
  hazards.forEach((z) => pts.push({ lat: z.lat, lng: z.lng }));

  const perHole = pts.length > 0;

  if (!perHole && !center) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.none}>No GPS location for this course yet.</Text>
      </View>
    );
  }

  // Build a ground-square bounding box. Per hole: fit all points with padding;
  // otherwise centre a wide window on the course.
  let minY: number, maxY: number, minX: number, maxX: number;
  if (perHole) {
    let loLat = Infinity, hiLat = -Infinity, loLng = Infinity, hiLng = -Infinity;
    for (const p of pts) {
      loLat = Math.min(loLat, p.lat); hiLat = Math.max(hiLat, p.lat);
      loLng = Math.min(loLng, p.lng); hiLng = Math.max(hiLng, p.lng);
    }
    const cLat = (loLat + hiLat) / 2;
    const cLng = (loLng + hiLng) / 2;
    const cosLat = Math.cos((cLat * Math.PI) / 180);
    // Ground extents (degrees), width scaled so the box is square on the ground.
    const latExt = hiLat - loLat;
    const lngExtGround = (hiLng - loLng) * cosLat;
    let half = (Math.max(latExt, lngExtGround) / 2) * 1.25; // 25% padding
    half = Math.max(half, 0.0011); // never tighter than ~120 m so a hole reads
    minY = cLat - half; maxY = cLat + half;
    const halfLng = half / cosLat;
    minX = cLng - halfLng; maxX = cLng + halfLng;
  } else {
    const f = center as Coord;
    const latSpan = 0.02;
    const lonSpan = latSpan / Math.cos((f.lat * Math.PI) / 180);
    minY = f.lat - latSpan / 2; maxY = f.lat + latSpan / 2;
    minX = f.lng - lonSpan / 2; maxX = f.lng + lonSpan / 2;
  }

  const bbox = `${minX},${minY},${maxX},${maxY}`;
  const url =
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export` +
    `?bbox=${bbox}&bboxSR=4326&imageSR=4326&size=640,640&format=png&transparent=false&f=image`;

  const toXY = (p: Coord) => ({
    x: ((p.lng - minX) / (maxX - minX)) * 100,
    y: ((maxY - p.lat) / (maxY - minY)) * 100,
  });

  // Distances to the green edges. Measured from the player's live position when
  // playing the hole; otherwise from the tee as a preview.
  const from = player ?? hole.tee;
  const mid = from && hole.green ? Math.round(haversineMeters(from, hole.green)) : null;
  const front = from && hole.greenFront ? Math.round(haversineMeters(from, hole.greenFront)) : null;
  const back = from && hole.greenBack ? Math.round(haversineMeters(from, hole.greenBack)) : null;

  const HZ_STYLE: Record<string, { fill: string; r: number; opacity: number }> = {
    tree: { fill: "#2f9e4f", r: 0.9, opacity: 0.85 },
    water: { fill: "#3a86c8", r: 1.4, opacity: 0.8 },
    bunker: { fill: "#e6d29a", r: 1.4, opacity: 0.9 },
  };

  return (
    <View style={styles.wrap}>
      <Image source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {perHole && (
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* hazards under the line/markers */}
          {hazards.map((z, i) => {
            const s = HZ_STYLE[z.type] ?? HZ_STYLE.tree;
            const p = toXY({ lat: z.lat, lng: z.lng });
            return <Circle key={i} cx={p.x} cy={p.y} r={s.r} fill={s.fill} opacity={s.opacity} />;
          })}
          {/* Playing route: tee → fairway waypoints → green. Falls back to a
              straight tee→green line when no fairway path has been mapped. */}
          {hole.tee && hole.green && fairway.length > 0 ? (
            <Polyline
              points={[hole.tee, ...fairway, hole.green]
                .map((p) => { const q = toXY(p); return `${q.x},${q.y}`; })
                .join(" ")}
              fill="none" stroke={colors.accent} strokeWidth="0.8"
              strokeLinejoin="round" strokeLinecap="round"
            />
          ) : (
            hole.tee && hole.green && (
              <Line
                x1={toXY(hole.tee).x} y1={toXY(hole.tee).y}
                x2={toXY(hole.green).x} y2={toXY(hole.green).y}
                stroke={colors.accent} strokeWidth="0.7" strokeDasharray="2,1.2"
              />
            )
          )}
          {/* fairway bend markers */}
          {fairway.map((p, i) => {
            const q = toXY(p);
            return <Circle key={`fw${i}`} cx={q.x} cy={q.y} r="0.9" fill={colors.accent} stroke="#0a2016" strokeWidth="0.3" />;
          })}
          {hole.greenFront && <Circle cx={toXY(hole.greenFront).x} cy={toXY(hole.greenFront).y} r="1.2" fill="#ffffff" opacity={0.9} />}
          {hole.greenBack && <Circle cx={toXY(hole.greenBack).x} cy={toXY(hole.greenBack).y} r="1.2" fill="#ffffff" opacity={0.9} />}
          {hole.tee && <Circle cx={toXY(hole.tee).x} cy={toXY(hole.tee).y} r="1.7" fill="#ffffff" stroke="#0a2016" strokeWidth="0.4" />}
          {hole.green && <Circle cx={toXY(hole.green).x} cy={toXY(hole.green).y} r="2" fill={colors.accent} stroke="#0a2016" strokeWidth="0.4" />}
          {/* live player position + line to the green */}
          {player && hole.green && (
            <Line
              x1={toXY(player).x} y1={toXY(player).y}
              x2={toXY(hole.green).x} y2={toXY(hole.green).y}
              stroke="#4dc3ff" strokeWidth="0.8" strokeDasharray="1.5,1"
            />
          )}
          {player && (
            <>
              <Circle cx={toXY(player).x} cy={toXY(player).y} r="2.4" fill="#4dc3ff" opacity={0.3} />
              <Circle cx={toXY(player).x} cy={toXY(player).y} r="1.5" fill="#4dc3ff" stroke="#ffffff" strokeWidth="0.5" />
            </>
          )}
        </Svg>
      )}

      {/* distance-to-reach label at each fairway bend (from player, else tee) */}
      {from && fairway.map((p, i) => {
        const q = toXY(p);
        const d = Math.round(haversineMeters(from, p));
        return (
          <View key={`fl${i}`} style={[styles.fwLabel, { left: `${q.x}%`, top: `${q.y}%` }]} pointerEvents="none">
            <Text style={styles.fwLabelText}>{d} m</Text>
          </View>
        );
      })}

      <Text style={styles.tag}>{perHole ? `Hole ${hole.number}` : "Course view"}</Text>

      {mid != null && (
        <View style={styles.dist}>
          {front != null && <Text style={styles.distSm}>F {front}</Text>}
          <Text style={styles.distBig}>{mid}<Text style={styles.distUnit}> m</Text></Text>
          {back != null && <Text style={styles.distSm}>B {back}</Text>}
        </View>
      )}

      {hazards.length > 0 && (
        <View style={styles.legend}>
          <Legend color="#e6d29a" label="Bunker" />
          <Legend color="#3a86c8" label="Water" />
          <Legend color="#2f9e4f" label="Trees" />
        </View>
      )}

      <Text style={styles.attr}>Imagery © Esri</Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
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
  none: { color: colors.textFaint, fontSize: 14 },
  tag: {
    position: "absolute", top: 8, left: 10, color: "#fff", fontSize: 13, fontWeight: "700",
    backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  dist: {
    position: "absolute", top: 8, right: 10, alignItems: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10,
  },
  distBig: { color: "#fff", fontSize: 22, fontWeight: "800", lineHeight: 24 },
  distUnit: { fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.85)" },
  distSm: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "700" },
  legend: {
    position: "absolute", bottom: 6, left: 8, flexDirection: "row", gap: 10,
    backgroundColor: "rgba(0,0,0,0.4)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  fwLabel: {
    position: "absolute", backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 4, paddingVertical: 1,
    borderRadius: 6, transform: [{ translateX: -13 }, { translateY: -8 }],
  },
  fwLabelText: { color: colors.accent, fontSize: 10, fontWeight: "800" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: "#fff", fontSize: 10, fontWeight: "600" },
  attr: { position: "absolute", bottom: 4, right: 6, color: "rgba(255,255,255,0.7)", fontSize: 9 },
});
