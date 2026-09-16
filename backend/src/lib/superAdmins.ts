// Platform owners — the accounts that may open the super-admin console and see /
// manage every organiser, club and event across ForeAi.
//
// Set SUPER_ADMIN_EMAILS to a comma/space-separated list of emails, e.g.
//   SUPER_ADMIN_EMAILS="mpower333is@gmail.com, marcell.laubscher@outlook.com"
// Those accounts get role="owner" on sign-in (server-controlled, like clubKey),
// which the /admin routes and the admin.html console require.
export function isSuperAdmin(email: string): boolean {
  const raw = process.env.SUPER_ADMIN_EMAILS || "";
  if (!raw.trim()) return false;
  const target = String(email || "").trim().toLowerCase();
  if (!target) return false;
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(target);
}
