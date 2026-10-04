import { useEffect } from "react";
import { useSetTheme } from "./ThemeContext";
import { useAuth } from "./AuthContext";
import { useMember } from "./MemberContext";

// Resolves the active club branding and applies it at runtime, tied to login AND
// membership: a signed-in organiser's clubKey wins, otherwise the club of the
// membership claimed on this device. When neither has a club (or the club has no
// theme), the app stays on the default ForeAi look. Renders nothing.
//
// Must sit inside ThemeProvider + AuthProvider + MemberProvider.

const USE_FIRESTORE = process.env.EXPO_PUBLIC_USE_FIRESTORE === "1";

export default function ThemeBrandingSync() {
  const setTheme = useSetTheme();
  const { staff } = useAuth();
  const { member } = useMember();

  const clubKey = staff?.clubKey || member?.clubKey || "";

  useEffect(() => {
    let alive = true;
    if (!USE_FIRESTORE || !clubKey) {
      setTheme(null); // back to default ForeAi
      return;
    }
    (async () => {
      try {
        const mod = require("../services/clubTheme") as typeof import("../services/clubTheme");
        const theme = await mod.fetchClubTheme(clubKey);
        if (alive) setTheme(theme); // null → default; otherwise the club's brand
      } catch {
        /* keep the default look */
      }
    })();
    return () => {
      alive = false;
    };
  }, [clubKey]);

  return null;
}
