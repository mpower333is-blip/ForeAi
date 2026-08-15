// ForeAi design system — a single source of truth for colors, spacing and type.
// Keeping this centralized lets every screen read as one product.

import { Platform } from "react-native";

export const colors = {
  bg: "#06170F",
  bgElevated: "#0A2016",
  surface: "#10261C",
  surfaceAlt: "#16362A",
  surfaceHi: "#1B4030",
  border: "#204636",
  borderSoft: "#1A3A2C",

  accent: "#8DFF6B",
  accentDim: "#4ea83a",
  accentDeep: "#2FA24B",
  accentSoft: "rgba(141,255,107,0.14)", // translucent lime — chips, glows

  gold: "#FFD36A", // fundraiser / highlights
  goldSoft: "rgba(255,211,106,0.14)",
  sky: "#6BD5FF",

  text: "#F4FBF6",
  textMuted: "#C2D2C6",
  textFaint: "#87A092",

  positive: "#8DFF6B",
  negative: "#FF6B6B",
  warning: "#FFCF5C",

  onAccent: "#052012", // text/icons on top of the lime accent
  overlay: "rgba(3,12,8,0.55)",
};

// Gradients (consumed by expo-linear-gradient). Each is a colour stop list.
export const gradients = {
  brand: ["#134E32", "#0C3222", "#06170F"] as const, // hero banner
  fairway: ["#1B5A38", "#0F3A24"] as const, // green accent panels
  accent: ["#B6FF8E", "#8DFF6B", "#46C85A"] as const, // primary buttons
  accentPressed: ["#8DFF6B", "#46C85A", "#2FA24B"] as const,
  night: ["#0A2016", "#06170F"] as const, // subtle card sheen
  gold: ["#FFE39A", "#FFD36A", "#F5B73C"] as const,
};

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
