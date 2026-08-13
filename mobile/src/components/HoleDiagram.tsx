import React from "react";
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Path,
  Ellipse,
  Circle,
  Line,
  Polygon,
  Text as SvgText,
} from "react-native-svg";
import { Hole } from "../data/courses";
import { colors } from "../theme";

// A stylized top-down schematic of a hole, generated from its par/yardage/index.
// It's a representative illustration (there's no real hole-map data), drawn so
// the shape reads differently per hole: doglegs, hazards and green size vary.
export default function HoleDiagram({ hole, height = 300 }: { hole: Hole; height?: number }) {
  const W = 120;
  const H = 200;

  // Deterministic shape from the hole's identity — same hole always looks the same.
  const seed = hole.number * 7 + hole.si;
  const doglegDir = hole.par === 3 ? 0 : seed % 3 === 0 ? 1 : seed % 3 === 1 ? -1 : 0;
  const bend = hole.par >= 5 ? 20 : hole.par === 4 ? 12 : 0;

  const teeX = 60;
  const teeY = 178;
  const greenX = clamp(60 + doglegDir * bend * 1.4, 32, 88);
  const greenY = 34;
  const midX = clamp(60 + doglegDir * bend * 2.2, 26, 94);
  const midY = 108;

  // Fairway corridor as a thick rounded stroke following a bend.
  const fairwayPath = `M ${teeX} ${teeY - 4} Q ${midX} ${midY} ${greenX} ${greenY + 12}`;
  const fairwayWidth = hole.par === 3 ? 22 : 30;

  // Hazards vary by hole.
  const hasWater = seed % 4 === 0;
  const hasFrontBunker = hole.par !== 5 && seed % 3 !== 0;
  const bunkerSide = seed % 2 === 0 ? 1 : -1;

  const greenR = hole.par === 3 ? 15 : 13;

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      <Defs>
        <LinearGradient id="rough" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0c2a1b" />
          <Stop offset="1" stopColor="#0a2016" />
        </LinearGradient>
      </Defs>

      {/* rough background */}
      <Rect x="0" y="0" width={W} height={H} rx="10" fill="url(#rough)" />

      {/* water hazard */}
      {hasWater && (
        <Path
          d={`M 4 ${midY - 30} Q 20 ${midY} 6 ${midY + 40} L 2 ${midY + 40} Z`}
          fill="#245a86"
          opacity={0.9}
        />
      )}

      {/* fairway */}
      <Path
        d={fairwayPath}
        stroke="#1f7a44"
        strokeWidth={fairwayWidth}
        strokeLinecap="round"
        fill="none"
      />
      {/* fairway highlight */}
      <Path
        d={fairwayPath}
        stroke="#2b9455"
        strokeWidth={fairwayWidth - 12}
        strokeLinecap="round"
        fill="none"
        opacity={0.6}
      />

      {/* 150y marker line across the fairway */}
      <Line
        x1={midX - 16}
        y1={midY + 18}
        x2={midX + 16}
        y2={midY + 18}
        stroke="#ffffff"
        strokeWidth="0.8"
        opacity={0.4}
      />

      {/* fairway bunker */}
      {hole.par !== 3 && (
        <Ellipse
          cx={clamp(midX + bunkerSide * 20, 12, 108)}
          cy={midY + 6}
          rx="9"
          ry="6"
          fill="#e6d59a"
        />
      )}

      {/* green */}
      <Ellipse cx={greenX} cy={greenY} rx={greenR + 2} ry={greenR} fill="#37b862" />
      <Ellipse cx={greenX} cy={greenY} rx={greenR - 3} ry={greenR - 4} fill="#41d071" opacity={0.7} />

      {/* front greenside bunker */}
      {hasFrontBunker && (
        <Ellipse cx={greenX + bunkerSide * (greenR + 6)} cy={greenY + 4} rx="7" ry="5" fill="#e6d59a" />
      )}

      {/* pin + flag */}
      <Line x1={greenX} y1={greenY} x2={greenX} y2={greenY - 16} stroke="#ffffff" strokeWidth="1" />
      <Polygon
        points={`${greenX},${greenY - 16} ${greenX + 9},${greenY - 13} ${greenX},${greenY - 10}`}
        fill={colors.accent}
      />

      {/* tee box */}
      <Rect x={teeX - 7} y={teeY} width="14" height="7" rx="2" fill="#c9d3cb" />

      {/* labels */}
      <SvgText x={greenX} y={greenY + 1} fill="#04140b" fontSize="7" fontWeight="bold" textAnchor="middle">
        {hole.number}
      </SvgText>
      <SvgText x="60" y="196" fill="#8ba394" fontSize="7" textAnchor="middle">
        {hole.yards} yds · par {hole.par}
      </SvgText>
    </Svg>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
