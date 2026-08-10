// ForeAi design system — a single source of truth for colors, spacing and type.
// Keeping this centralized lets every screen read as one product.

export const colors = {
  bg: "#071b13",
  surface: "#10261c",
  surfaceAlt: "#16362a",
  border: "#1e4433",

  accent: "#7CFF57",
  accentDim: "#4ea83a",

  text: "#ffffff",
  textMuted: "#c8d1c9",
  textFaint: "#8ba394",

  positive: "#7CFF57",
  negative: "#ff6b6b",
  warning: "#ffcf5c",
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
};

export const type = {
  brand: { fontSize: 46, fontWeight: "800" as const },
  h1: { fontSize: 30, fontWeight: "700" as const },
  h2: { fontSize: 22, fontWeight: "700" as const },
  metric: { fontSize: 40, fontWeight: "800" as const },
  body: { fontSize: 16, fontWeight: "400" as const },
  small: { fontSize: 13, fontWeight: "400" as const },
};
