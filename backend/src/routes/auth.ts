import { Router } from "express";
import prisma from "../config/db";
import { hashPassword, verifyPassword, signToken, requireAuth } from "../lib/auth";

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

    const user = await prisma.adminUser.create({
      data: { email, passwordHash: hashPassword(password), name, clubKey },
    });
    const token = signToken({ sub: user.id, email: user.email, name: user.name, role: user.role });
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
    await prisma.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const token = signToken({ sub: user.id, email: user.email, name: user.name, role: user.role });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, clubKey: user.clubKey } });
  } catch (e) {
    console.error("login error", e);
    res.status(500).json({ error: "Could not sign in." });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const claims = (req as any).auth as { sub: string };
  const user = await prisma.adminUser.findUnique({ where: { id: claims.sub } });
  if (!user) return res.status(401).json({ error: "Account not found." });
  res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, clubKey: user.clubKey } });
});

export default router;
