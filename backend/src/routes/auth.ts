import { Router } from "express";
import prisma from "../config/db";
import { hashPassword, verifyPassword, signToken, requireAuth } from "../lib/auth";
import { verifyFirebaseIdToken } from "../lib/firebase";
import { clubKeyForEmail } from "../lib/clubAdmins";
import { isSuperAdmin } from "../lib/superAdmins";

// Platform owners get role="owner" (server-controlled), everyone else stays
// "organiser". Applied on every sign-in so the allowlist is authoritative.
function roleForEmail(email: string, current?: string | null): string {
  if (isSuperAdmin(email)) return "owner";
  return current || "organiser";
}

// Organiser / club login for the web management portal.
//   POST /auth/register  { email, password, name?, clubKey?, signupCode? }
//   POST /auth/login     { email, password }
//   GET  /auth/me        (Bearer token)  -> the signed-in organiser
//
// Optional gate: set ORGANISER_SIGNUP_CODE in the environment to require a shared
// code for new registrations (stops random sign-ups). Unset = open registration.
const router = Router();

const normEmail = (e: unknown) => String(e || "").trim().toLowerCase();

router.post("/register", async (req, res) => {
  try {
    const email = normEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const name = req.body?.name ? String(req.body.name).trim() : null;
    const clubKey = req.body?.clubKey ? String(req.body.clubKey).trim() : null;

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });

    const gate = process.env.ORGANISER_SIGNUP_CODE;
    if (gate && String(req.body?.signupCode || "") !== gate) {
      return res.status(403).json({ error: "A valid sign-up code is required to register." });
    }

    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "An account with that email already exists." });

    // A club-admin email mapping (env) is authoritative over any requested clubKey.
    const mappedClub = clubKeyForEmail(email);
    const user = await prisma.adminUser.create({
      data: { email, passwordHash: hashPassword(password), name, clubKey: mappedClub ?? clubKey, role: roleForEmail(email) },
    });
    const token = signToken({ sub: user.id, email: user.email, name: user.name, role: user.role, clubKey: user.clubKey });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, clubKey: user.clubKey } });
  } catch (e) {
    console.error("register error", e);
    res.status(500).json({ error: "Could not create the account." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = normEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const user = await prisma.adminUser.findUnique({ where: { email } });
    // Same message whether the email is unknown or the password is wrong.
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }
    // Keep clubKey and role in sync with the env allowlists.
    const mappedClub = clubKeyForEmail(user.email);
    const clubKey = mappedClub ?? user.clubKey;
    const role = roleForEmail(user.email, user.role);
    await prisma.adminUser.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        ...(mappedClub && mappedClub !== user.clubKey ? { clubKey: mappedClub } : {}),
        ...(role !== user.role ? { role } : {}),
      },
    });
    const token = signToken({ sub: user.id, email: user.email, name: user.name, role, clubKey });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role, clubKey } });
  } catch (e) {
    console.error("login error", e);
    res.status(500).json({ error: "Could not sign in." });
  }
});

// Exchange a Firebase Authentication ID token for a ForeAi session token.
// The website signs in with Firebase Auth (passwords, resets, Google) and posts
// the resulting ID token here; we verify it, upsert the organiser account, and
// return the same session token the rest of the API already understands.
router.post("/firebase", async (req, res) => {
  try {
    const idToken = String(req.body?.idToken || "");
    let claims;
    try {
      claims = await verifyFirebaseIdToken(idToken);
    } catch (e) {
      return res.status(401).json({ error: "Could not verify your Firebase sign-in." });
    }
    const email = normEmail(claims.email);
    if (!email) return res.status(400).json({ error: "Your account has no email address." });

    const mappedClub = clubKeyForEmail(email);
    let user = await prisma.adminUser.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.adminUser.create({
        data: { email, passwordHash: "firebase", name: claims.name || null, clubKey: mappedClub, role: roleForEmail(email) },
      });
    } else {
      // Keep clubKey and role in sync with the env allowlists.
      const role = roleForEmail(email, user.role);
      user = await prisma.adminUser.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          ...(mappedClub && mappedClub !== user.clubKey ? { clubKey: mappedClub } : {}),
          ...(role !== user.role ? { role } : {}),
        },
      });
    }
    const token = signToken({ sub: user.id, email: user.email, name: user.name, role: user.role, clubKey: user.clubKey });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, clubKey: user.clubKey } });
  } catch (e) {
    console.error("firebase exchange error", e);
    res.status(500).json({ error: "Could not sign you in." });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const claims = (req as any).auth as { sub: string };
  let user = await prisma.adminUser.findUnique({ where: { id: claims.sub } });
  if (!user) return res.status(401).json({ error: "Account not found." });
  // Promote/sync clubKey + owner role from the env allowlists so a designated
  // club admin or platform owner gains access without signing out and back in.
  const mappedClub = clubKeyForEmail(user.email);
  const role = roleForEmail(user.email, user.role);
  if ((mappedClub && mappedClub !== user.clubKey) || role !== user.role) {
    user = await prisma.adminUser.update({
      where: { id: user.id },
      data: { ...(mappedClub && mappedClub !== user.clubKey ? { clubKey: mappedClub } : {}), ...(role !== user.role ? { role } : {}) },
    });
  }
  res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, clubKey: user.clubKey } });
});

export default router;
