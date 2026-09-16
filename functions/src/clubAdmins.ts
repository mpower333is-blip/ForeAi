// Designate which organiser accounts belong to which club, by email.
//
// Firebase/Google sign-ins create an organiser account with no clubKey, so we
// can't tell the Kempton club admin apart from any other organiser. This lets
// you name club admins via an environment variable instead of editing the DB:
//
//   CLUB_ADMIN_EMAILS="kempton:marcell.laubscher@outlook.com, kempton:someone@else.co.za"
//
// Each entry is `<clubKey>:<email>`, separated by commas or semicolons. The
// mapping is authoritative — on login the account's clubKey is set to match, so
// the club-only pages (members, competitions, tee sheet, news) become visible
// to exactly those accounts and no others.
export function clubKeyForEmail(email: string): string | null {
  const raw = process.env.CLUB_ADMIN_EMAILS || "";
  if (!raw.trim()) return null;
  const target = String(email || "").trim().toLowerCase();
  if (!target) return null;
  for (const entry of raw.split(/[,;\n]+/)) {
    const t = entry.trim();
    if (!t) continue;
    const i = t.indexOf(":");
    if (i < 0) continue;
    const clubKey = t.slice(0, i).trim();
    const mail = t.slice(i + 1).trim().toLowerCase();
    if (clubKey && mail && mail === target) return clubKey;
  }
  return null;
}
