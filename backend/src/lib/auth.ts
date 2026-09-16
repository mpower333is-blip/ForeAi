import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

// Organiser/club login: password hashing (scrypt) + a small HMAC-signed token
// (a minimal JWT-style token). Uses only Node's built-in crypto — no extra deps.
//
// Set AUTH_SECRET in the environment to keep tokens valid across restarts. If it
// is unset we fall back to a random per-boot secret (secure, but everyone is
// signed out when the server restarts).
const SECRET = process.env.AUTH_SECRET || crypto.randomBytes(32).toString("hex");
if (!process.env.AUTH_SECRET) {
  console.warn("[auth] AUTH_SECRET is not set — using a random per-boot secret; logins won't survive restarts.");
}

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const dk = crypto.scryptSync(pw, salt, 64).toString("hex");
  return `scrypt$${salt}$${dk}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const parts = (stored || "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, dk] = parts;
  const calc = crypto.scryptSync(pw, salt, 64).toString("hex");
  const a = Buffer.from(dk, "hex");
  const b = Buffer.from(calc, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");

export type TokenPayload = { sub: string; email: string; name?: string | null; role?: string; clubKey?: string | null };

// Read + verify the organiser token from an Authorization: Bearer header.
// Returns the claims, or null if there is no valid token.
export function bearerClaims(req: { headers: Record<string, any>; header?: (n: string) => any }): (TokenPayload & { exp: number }) | null {
  const hdr = (req.header ? req.header("authorization") : req.headers?.authorization) || "";
  const token = typeof hdr === "string" && hdr.startsWith("Bearer ") ? hdr.slice(7) : "";
  return verifyToken(token);
}

export function signToken(payload: TokenPayload, days = 30): string {
  const body = { ...payload, iat: Date.now(), exp: Date.now() + days * 86400000 };
  const p = b64(JSON.stringify(body));
  const sig = crypto.createHmac("sha256", SECRET).update(p).digest("base64url");
  return `${p}.${sig}`;
}

export function verifyToken(token: string | undefined | null): (TokenPayload & { exp: number }) | null {
  if (!token) return null;
  const [p, sig] = token.split(".");
  if (!p || !sig) return null;
  const expect = crypto.createHmac("sha256", SECRET).update(p).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const body = JSON.parse(Buffer.from(p, "base64url").toString());
    if (body.exp && Date.now() > body.exp) return null;
    return body;
  } catch {
    return null;
  }
}

// Express middleware: require a valid organiser token (Authorization: Bearer …).
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : "";
  const claims = verifyToken(token);
  if (!claims) return res.status(401).json({ error: "Sign in required." });
  (req as any).auth = claims;
  next();
}
