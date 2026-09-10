// ForeAi design system — a single source of truth for colors, spacing and type.
// Keeping this centralized lets every screen read as one product.
//
// The palette is club-aware: a club flavour (EXPO_PUBLIC_CLUB) can ship its own
// brand colours while keeping the exact same token names, so every screen
// re-themes with no other change. Kempton Park GC = navy + gold (its crest).

import { Platform } from "react-native";

type Palette = {
  bg: string; bgElevated: string; surface: string; surfaceAlt: string; surfaceHi: string;
  border: string; borderSoft: string;
  accent: string; accentDim: string; accentDeep: string; accentSoft: string;
  gold: string; goldSoft: string; sky: string;
  text: string; textMuted: string; textFaint: string;
  positive: string; negative: string; warning: string;
  onAccent: string; overlay: string;
};
type Grad = readonly [string, string, ...string[]]; // ≥2 colour stops
type GradientSet = {
  brand: Grad; fairway: Grad; accent: Grad; accentPressed: Grad; night: Grad; gold: Grad;
};

// ForeAi default — deep green + lime.
const FOREAI_COLORS: Palette = {
  bg: "#06170F", bgElevated: "#0A2016", surface: "#10261C", surfaceAlt: "#16362A", surfaceHi: "#1B4030",
  border: "#204636", borderSoft: "#1A3A2C",
  accent: "#8DFF6B", accentDim: "#4ea83a", accentDeep: "#2FA24B", accentSoft: "rgba(141,255,107,0.14)",
  gold: "#FFD36A", goldSoft: "rgba(255,211,106,0.14)", sky: "#6BD5FF",
  text: "#F4FBF6", textMuted: "#C2D2C6", textFaint: "#87A092",
  positive: "#8DFF6B", negative: "#FF6B6B", warning: "#FFCF5C",
  onAccent: "#052012", overlay: "rgba(3,12,8,0.55)",
};
const FOREAI_GRADIENTS: GradientSet = {
  brand: ["#134E32", "#0C3222", "#06170F"],
  fairway: ["#1B5A38", "#0F3A24"],
  accent: ["#B6FF8E", "#8DFF6B", "#46C85A"],
  accentPressed: ["#8DFF6B", "#46C85A", "#2FA24B"],
  night: ["#0A2016", "#06170F"],
  gold: ["#FFE39A", "#FFD36A", "#F5B73C"],
};

// Kempton Park Golf Club — navy + gold (the club crest: navy crane & wording,
// gold ring, on white). Dark navy ground with a gold accent.
const KEMPTON_COLORS: Palette = {
  bg: "#081226", bgElevated: "#0C1B38", surface: "#0F2143", surfaceAlt: "#152C55", surfaceHi: "#1C3868",
  border: "#26407A", borderSoft: "#1B3160",
  accent: "#F3C33B", accentDim: "#C99A2E", accentDeep: "#A97E1E", accentSoft: "rgba(243,195,59,0.15)",
  gold: "#FFD36A", goldSoft: "rgba(255,211,106,0.14)", sky: "#6BB8FF",
  text: "#F2F6FF", textMuted: "#C2CFE8", textFaint: "#7F92B6",
  positive: "#4FD98A", negative: "#FF6B6B", warning: "#FFCF5C",
  onAccent: "#10203F", overlay: "rgba(3,8,20,0.6)",
};
const KEMPTON_GRADIENTS: GradientSet = {
  brand: ["#1B3F7E", "#122C58", "#081226"],
  fairway: ["#1D3F7C", "#122B57"],
  accent: ["#FBD972", "#F3C33B", "#D6A22A"],
  accentPressed: ["#F3C33B", "#D6A22A", "#B9891F"],
  night: ["#0C1B38", "#081226"],
  gold: ["#FFE39A", "#FFD36A", "#F5B73C"],
};

const PALETTES: Record<string, { colors: Palette; gradients: GradientSet }> = {
  kempton: { colors: KEMPTON_COLORS, gradients: KEMPTON_GRADIENTS },
};
const CLUB = process.env.EXPO_PUBLIC_CLUB || "";
const THEME = PALETTES[CLUB] ?? { colors: FOREAI_COLORS, gradients: FOREAI_GRADIENTS };

export const colors = THEME.colors;
// Gradients (consumed by expo-linear-gradient). Each is a colour stop list.
export const gradients = THEME.gradients;

export const spacing = {
  xs: 6,
  sm: 12,
  md: 18,
  lg: 26,
  xl: 36,
};

export const radius = {
  sm: 14,
  md: 20,
  lg: 28,
  pill: 999,
};

// Soft elevation for cards — gives the flat surfaces depth on device.
export const shadow = {
  card: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOpacity: 0.35,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 6 },
    default: {},
  }) as object,
  soft: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 3 },
    default: {},
  }) as object,
  glow: Platform.select({
    ios: {
      shadowColor: colors.accent,
      shadowOpacity: 0.5,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    },
    android: { elevation: 8 },
    default: {},
  }) as object,
};

export const type = {
  brand: { fontSize: 46, fontWeight: "800" as const, letterSpacing: -1 },
  h1: { fontSize: 30, fontWeight: "800" as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.3 },
  metric: { fontSize: 40, fontWeight: "800" as const },
  body: { fontSize: 16, fontWeight: "400" as const },
  small: { fontSize: 13, fontWeight: "400" as const },
};
