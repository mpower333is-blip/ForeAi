// Satellite framing for a hole — pure geometry, shared by the on-map view and
// the offline prefetcher so both compute the SAME image for a hole.
//
// The frame is built ONLY from the hole's fixed points (tee, green, edges,
// fairway, hazards) — never the viewer's live location. So the map always shows
// the course/hole (not wherever you're opening the app from), and the fetched
// image for a hole is stable, which is what makes it cacheable for offline use.

import { Coord } from "./geo";
import { Hole } from "../data/courses";

export type HoleFrame = {
  perHole: boolean;
  minX: number; maxX: number; minY: number; maxY: number;
  rotateDeg: number; cover: number;
  bbox: string;
  url: string;
};

// Esri World Imagery export (no API key). 1536² so it stays crisp when zoomed.
function esriUrl(bbox: string): string {
  return (
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export` +
    `?bbox=${bbox}&bboxSR=4326&imageSR=4326&size=1536,1536&format=png&transparent=false&f=image`
  );
}

export function holeFrame(hole: Hole, center?: Coord): HoleFrame | null {
  const hazards = hole.hazards ?? [];
  const fairway = hole.fairway ?? [];
  const pts: Coord[] = [];
  if (hole.tee) pts.push(hole.tee);
  if (hole.green) pts.push(hole.green);
  if (hole.greenFront) pts.push(hole.greenFront);
  if (hole.greenBack) pts.push(hole.greenBack);
  fairway.forEach((p) => pts.push(p));
  hazards.forEach((hz) => hz.points.forEach((p) => pts.push(p)));

  const perHole = pts.length > 0;
  if (!perHole && !center) return null;

  let minY: number, maxY: number, minX: number, maxX: number;
  let rotateDeg = 0, cover = 1;

  if (perHole) {
    let loLat = Infinity, hiLat = -Infinity, loLng = Infinity, hiLng = -Infinity;
    for (const p of pts) {
      loLat = Math.min(loLat, p.lat); hiLat = Math.max(hiLat, p.lat);
      loLng = Math.min(loLng, p.lng); hiLng = Math.max(hiLng, p.lng);
    }
    const cLat = (loLat + hiLat) / 2;
    const cLng = (loLng + hiLng) / 2;
    const cosLat = Math.cos((cLat * Math.PI) / 180);

    // Aim the view down the line of play (tee→green, else first→last fairway).
    const tAnchor = hole.tee ?? (fairway.length ? fairway[0] : undefined);
    const gAnchor = hole.green ?? (fairway.length ? fairway[fairway.length - 1] : undefined);
    if (tAnchor && gAnchor) {
      const dE = (gAnchor.lng - tAnchor.lng) * cosLat;
      const dN = gAnchor.lat - tAnchor.lat;
      const alpha = Math.atan2(-dN, dE);
      const rot = -Math.PI / 2 - alpha;
      rotateDeg = (rot * 180) / Math.PI;
      cover = Math.abs(Math.sin(rot)) + Math.abs(Math.cos(rot));
    }

    const latExt = hiLat - loLat;
    const lngExtGround = (hiLng - loLng) * cosLat;
    let half = (Math.max(latExt, lngExtGround) / 2) * 1.25;
    half = Math.max(half, 0.0011);
    half *= cover;
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
  return { perHole, minX, maxX, minY, maxY, rotateDeg, cover, bbox, url: esriUrl(bbox) };
}
