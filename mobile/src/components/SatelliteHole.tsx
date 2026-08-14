import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import Svg, { Line, Circle } from "react-native-svg";
import { Hole } from "../data/courses";
import { Coord } from "../lib/geo";
import { colors } from "../theme";

// Real satellite imagery for a hole using Esri World Imagery (no API key).
// When a hole has GPS coordinates (tee/green) it frames the hole tightly and
// draws the tee→green line; otherwise it shows the course from above using the
// course centre. The container is square so the overlay lines up with the image.
export default function SatelliteHole({
  hole,
  center,
}: {
  hole: Hole;
  center?: Coord;
}) {
  const perHole = !!(hole.green || hole.tee);
  const focus = hole.green ?? hole.tee ?? center;

  if (!focus) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.none}>No GPS location for this course yet.</Text>
      </View>
    );
  }

  // Roughly-square ground window; tighter when we can frame a specific hole.
  const latSpan = perHole ? 0.005 : 0.02;
  const lonSpan = latSpan / Math.cos((focus.lat * Math.PI) / 180);
  const minX = focus.lng - lonSpan / 2;
  const minY = focus.lat - latSpan / 2;
  const maxX = focus.lng + lonSpan / 2;
  const maxY = focus.lat + latSpan / 2;

  const bbox = `${minX},${minY},${maxX},${maxY}`;
  const url =
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export` +
    `?bbox=${bbox}&bboxSR=4326&imageSR=4326&size=640,640&format=png&transparent=false&f=image`;

  // Map a coordinate to 0-100 percentage inside the (linear 4326) bbox.
  const toXY = (p: Coord) => ({
    x: ((p.lng - minX) / (maxX - minX)) * 100,
    y: ((maxY - p.lat) / (maxY - minY)) * 100,
  });

  return (
    <View style={styles.wrap}>
      <Image source={{ uri: url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {perHole && (
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
          {hole.tee && hole.green && (
            <Line
              x1={toXY(hole.tee).x}
              y1={toXY(hole.tee).y}
              x2={toXY(hole.green).x}
              y2={toXY(hole.green).y}
              stroke={colors.accent}
              strokeWidth="0.7"
              strokeDasharray="2,1.2"
            />
          )}
          {hole.tee && <Circle cx={toXY(hole.tee).x} cy={toXY(hole.tee).y} r="1.6" fill="#ffffff" />}
          {hole.green && <Circle cx={toXY(hole.green).x} cy={toXY(hole.green).y} r="1.9" fill={colors.accent} />}
        </Svg>
      )}
      <Text style={styles.tag}>{perHole ? `Hole ${hole.number}` : "Course view"}</Text>
      <Text style={styles.attr}>Imagery © Esri</Text>
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
});
