// Load a club's brand theme from Firestore (clubs/{clubKey}.theme) and turn it
// into a runtime Theme. The website "add a club" tool writes the brand colours
// there; the app applies them when a member/organiser of that club signs in — so
// one downloadable ForeAi app shows each club's own branding, no separate builds.
//
// Lazy-required behind EXPO_PUBLIC_USE_FIRESTORE (see ThemeBrandingSync), so the
// firebase SDK isn't pulled into non-Firestore builds.

import { doc, getDoc } from "firebase/firestore";
import { firestore } from "./firebase";
import { buildTheme, type Theme, type Palette } from "../theme";

// Pull the brand palette out of the club doc, wherever it's stored, and build a
// coherent Theme (missing colours fall back to the ForeAi base). Returns null
// when the club has no theme set — the app then keeps the default ForeAi look.
export async function fetchClubTheme(clubKey: string): Promise<Theme | null> {
  try {
    const snap = await getDoc(doc(firestore(), "clubs", clubKey));
    if (!snap.exists()) return null;
    const d = snap.data() as any;
    const t = d?.theme;
    if (!t || typeof t !== "object") return null;
    const colorOverrides: Partial<Palette> = (t.colors && typeof t.colors === "object" ? t.colors : t) as Partial<Palette>;
    const grad = t.gradients && typeof t.gradients === "object" ? t.gradients : undefined;
    // Ignore anything that isn't a string colour so a malformed doc can't crash.
    const clean: Partial<Palette> = {};
    for (const [k, v] of Object.entries(colorOverrides)) {
      if (typeof v === "string") (clean as Record<string, string>)[k] = v;
    }
    if (Object.keys(clean).length === 0 && !grad) return null;
    return buildTheme(clean, grad);
  } catch {
    return null;
  }
}
