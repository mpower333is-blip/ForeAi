import crypto from "crypto";

// Verify a Firebase Authentication ID token WITHOUT the firebase-admin SDK or a
// service account — we only need to check the signature against Google's public
// keys and validate the standard claims. Uses Node's built-in crypto + fetch.
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "foreai-f9cfa";
const CERT_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let certCache: Record<string, string> = {};
let certExpiry = 0;

async function getCerts(): Promise<Record<string, string>> {
  if (Date.now() < certExpiry && Object.keys(certCache).length) return certCache;
  const res = await fetch(CERT_URL);
  if (!res.ok) throw new Error("Could not fetch Google public keys");
  certCache = (await res.json()) as Record<string, string>;
  const cc = res.headers.get("cache-control") || "";
  const m = cc.match(/max-age=(\d+)/);
  certExpiry = Date.now() + (m ? parseInt(m[1], 10) : 3600) * 1000;
  return certCache;
}

export type FirebaseClaims = { sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string };

export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseClaims> {
  const parts = (idToken || "").split(".");
  if (parts.length !== 3) throw new Error("Malformed token");
  const [h, p, sig] = parts;
  const header = JSON.parse(Buffer.from(h, "base64url").toString());
  const payload = JSON.parse(Buffer.from(p, "base64url").toString());
  if (header.alg !== "RS256") throw new Error("Unexpected algorithm");

  const certs = await getCerts();
  const pem = certs[header.kid];
  if (!pem) throw new Error("Unknown signing key");

  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${h}.${p}`);
  verifier.end();
  if (!verifier.verify(pem, Buffer.from(sig, "base64url"))) throw new Error("Bad signature");

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now) throw new Error("Token expired");
  if (typeof payload.iat !== "number" || payload.iat > now + 300) throw new Error("Bad issued-at");
  if (payload.aud !== PROJECT_ID) throw new Error("Wrong audience");
  if (payload.iss !== `https://securetoken.google.com/${PROJECT_ID}`) throw new Error("Wrong issuer");
  if (!payload.sub) throw new Error("Missing subject");

  return { sub: payload.sub, email: payload.email, email_verified: payload.email_verified, name: payload.name, picture: payload.picture };
}
