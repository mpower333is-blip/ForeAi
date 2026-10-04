import React, { createContext, useContext, useMemo, useState } from "react";
import { DEFAULT_THEME, type Theme } from "../theme";

// Runtime theming for the single-app, club-branded model. The active Theme
// starts as the build-time default (ForeAi, or a build-time club flavour) and is
// swapped at runtime when a member/organiser whose club has branding signs in.
//
// Migration: a screen re-skins with the active theme by building its styles with
// useThemedStyles() instead of a module-level StyleSheet.create against the
// static `colors`. Un-migrated screens keep the default palette and are
// unaffected — so this rolls out screen-by-screen with no big-bang refactor.

type ThemeState = {
  theme: Theme;
  setTheme: (t: Theme | null) => void; // null → back to the default
};

const Ctx = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const value = useMemo<ThemeState>(
    () => ({
      theme,
      setTheme: (t) => setThemeState(t ?? DEFAULT_THEME),
    }),
    [theme]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Active theme. Safe outside a provider (falls back to the default) so a screen
// can migrate before the provider is guaranteed in every entry path.
export function useTheme(): Theme {
  return useContext(Ctx)?.theme ?? DEFAULT_THEME;
}

export function useSetTheme(): (t: Theme | null) => void {
  return useContext(Ctx)?.setTheme ?? (() => {});
}

// Build (and memoise) a screen's styles from the active theme. Re-creates only
// when the theme changes.
//   const styles = useThemedStyles((t) => StyleSheet.create({ box: { backgroundColor: t.colors.surface } }));
export function useThemedStyles<T>(factory: (t: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme]);
}
