// Official handicap sync — Handicaps Network Africa via the DotGolf ISV API.
//
// Auth is JWT-based (HS256) and two-step, per DotGolf's ISV docs:
//   1. Build a short "client token" JWT signed with your Secret Key, claims:
//        alg HS256 (header), aud "isv-api", iss <username>, iat <unix now>.
//   2. POST { clientToken } to /api/<country>/v1/account/token  → { accessToken,
//        refreshToken, expiresAtUTC }.
//   3. Send `Authorization: Bearer <accessToken>` on every data request.
//   4. When the access token expires, POST { refreshToken } to /account/renew.
//
// Credentials are issued PER CLUB (username + secret key). We read a single
// club's creds from env for now (HNA_USERNAME / HNA_SECRET_KEY); multi-club can
// later resolve creds per clubKey (e.g. from Secret Manager or a protected
// config doc) and pass them to these functions unchanged.
//
// The signing is done with Node's built-in crypto (HMAC-SHA256) so we add no
// dependency. Rate limit is 300 req/min per username — we cache the access token
// in-memory per warm instance and sync in batches, so a club sync is a handful
// of calls.

import * as crypto from "crypto";

const DEFAULT_BASE = "http://isvapi.wa.dotgolf.co.uk";
const DEFAULT_COUNTRY = "wal"; // country code in the path (/api/<country>/<version>/...)
const DEFAULT_VERSION = "v1"; // path version; the Swagger is labelled V3, so set
// HNA_API_VERSION=v3 if the endpoints live under /v3.

export type HnaCreds = { username: string; secretKey: string };

// A member as the sync cares about it: every identity value we can match a
// roster `hnaId` against + their current index. A club admin or player may have
// stored any of the membership number, central (SAGA) code, SA ID number, or the
// DotGolf UID as the "HNA id", so we match on all of them.
export type HnaMember = {
  ids: string[]; // membershipNumber, centralMemberCode, nationalIdentityNumber, memberUID
  memberUID: string;
  handicapIndex: number | null; // WHS signed (plus handicaps negative)
  displayIndex?: string;
  firstName?: string;
  lastName?: string;
};

function base() {
  return (process.env.HNA_API_BASE || DEFAULT_BASE).replace(/\/+$/, "");
}
function country() {
  return process.env.HNA_COUNTRY || DEFAULT_COUNTRY;
}
function version() {
  return process.env.HNA_API_VERSION || DEFAULT_VERSION;
}
function apiUrl(path: string) {
  return `${base()}/api/${country()}/${version()}${path}`;
}

// Read the single configured club's credentials from env. Returns null when not
// configured, so callers fall back to manually-entered indexes.
export function hnaCredsFromEnv(): HnaCreds | null {
  const username = process.env.HNA_USERNAME;
  const secretKey = process.env.HNA_SECRET_KEY;
  if (!username || !secretKey) return null;
  return { username, secretKey };
}

export function hnaConfigured(): boolean {
  return !!hnaCredsFromEnv();
}

// ── JWT (HS256) ──────────────────────────────────────────────────────────────
function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// The short-lived client token we exchange for an access token.
function buildClientToken(creds: HnaCreds): string {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = { aud: "isv-api", iss: creds.username, iat: Math.floor(Date.now() / 1000) };
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const sig = crypto.createHmac("sha256", creds.secretKey).update(data).digest();
  return `${data}.${b64url(sig)}`;
}

// ── Access-token lifecycle (cached per warm instance) ────────────────────────
type TokenState = { accessToken: string; refreshToken: string; expiresAt: number };
const tokenCache = new Map<string, TokenState>(); // key: username

async function postJson(url: string, body: any, bearer?: string): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HNA ${url} → HTTP ${res.status}`);
  return res.json();
}

async function freshToken(creds: HnaCreds): Promise<TokenState> {
  const clientToken = buildClientToken(creds);
  const j = await postJson(apiUrl("/account/token"), { clientToken });
  return {
    accessToken: String(j.accessToken),
    refreshToken: String(j.refreshToken),
    expiresAt: Date.parse(j.expiresAtUTC) || Date.now() + 10 * 60 * 1000,
  };
}

async function renewToken(creds: HnaCreds, refreshToken: string): Promise<TokenState> {
  const j = await postJson(apiUrl("/account/renew"), { refreshToken });
  return {
    accessToken: String(j.accessToken),
    refreshToken: String(j.refreshToken || refreshToken),
    expiresAt: Date.parse(j.expiresAtUTC) || Date.now() + 10 * 60 * 1000,
  };
}

// A valid access token, reusing the cached one and renewing/re-authing as needed.
async function accessToken(creds: HnaCreds): Promise<string> {
  const SKEW = 60 * 1000; // renew a minute before expiry
  const cached = tokenCache.get(creds.username);
  if (cached && cached.expiresAt - SKEW > Date.now()) return cached.accessToken;

  let next: TokenState;
  if (cached) {
    try {
      next = await renewToken(creds, cached.refreshToken);
    } catch {
      next = await freshToken(creds); // refresh failed/expired → full re-auth
    }
  } else {
    next = await freshToken(creds);
  }
  tokenCache.set(creds.username, next);
  return next.accessToken;
}

async function getJson(path: string, creds: HnaCreds): Promise<any> {
  const token = await accessToken(creds);
  const res = await fetch(apiUrl(path), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`HNA GET ${path} → HTTP ${res.status}`);
  return res.json();
}

// ── Club members ─────────────────────────────────────────────────────────────
// Parse a member row defensively: the DotGolf response field names are confirmed
// against the Swagger UI (Club Members endpoint). We look for the SA Player ID
// and the current handicap index under the common spellings so a minor schema
// difference doesn't silently drop everyone. Set HNA_MEMBERS_PATH to override the
// endpoint path if your account's differs from the default.
const num = (v: any): number | null => (v == null || v === "" || isNaN(Number(v)) ? null : Number(v));
const str = (v: any): string => (v == null ? "" : String(v)).trim();
// Normalise an id for matching: drop spaces, lower-case (UIDs/codes vary in case).
export const normId = (v: any): string => str(v).replace(/\s+/g, "").toLowerCase();

// Parse one DotGolf ISV member row. The index is nested under member.handicap,
// and a plus handicap (better than scratch) shows a leading "+" in displayIndex
// and plays as a NEGATIVE index, so we sign it from the display string.
export function parseMember(r: any): HnaMember | null {
  const m = r?.member ?? {};
  const ids = [
    str(r?.membershipNumber),
    str(m?.centralMemberCode),
    str(r?.nationalIdentityNumber),
    str(r?.memberUID),
    str(m?.uid),
  ].filter(Boolean);
  if (!ids.length) return null;

  const idxNum = num(m?.handicap?.index);
  const displayIndex = str(m?.handicap?.displayIndex);
  const handicapIndex = idxNum == null ? null : displayIndex.startsWith("+") ? -Math.abs(idxNum) : idxNum;

  return {
    ids,
    memberUID: str(r?.memberUID) || str(m?.uid),
    handicapIndex,
    displayIndex: displayIndex || undefined,
    firstName: str(r?.firstName) || undefined,
    lastName: str(r?.lastName) || undefined,
  };
}

// Build a lookup from every identity value → member, so a roster `hnaId`
// matching any of a member's ids resolves. Later ids don't overwrite an earlier
// member on collision (membershipNumber wins over the UID).
export function buildMemberLookup(members: HnaMember[]): (id: string) => HnaMember | undefined {
  const map = new Map<string, HnaMember>();
  for (const mem of members) {
    for (const id of mem.ids) {
      const k = normId(id);
      if (k && !map.has(k)) map.set(k, mem);
    }
  }
  return (id: string) => map.get(normId(id));
}

// All members for the configured club, with their current handicap index.
export async function fetchClubMembers(creds: HnaCreds): Promise<HnaMember[]> {
  const path = process.env.HNA_MEMBERS_PATH || "/members";
  const j = await getJson(path, creds);
  // The list may be the array itself or wrapped (e.g. { members: [...] } / { data: [...] }).
  const rows: any[] = Array.isArray(j)
    ? j
    : (Array.isArray(j?.members) && j.members) || (Array.isArray(j?.data) && j.data) || (Array.isArray(j?.items) && j.items) || [];
  return rows.map(parseMember).filter((m): m is HnaMember => !!m);
}

// Cached member list for read-heavy lookups. Indexes recompute nightly on HNA,
// so a 1-hour cache keeps player "update from HNA" taps far inside the 300/min
// rate limit without serving stale data. The club-admin SYNC uses the uncached
// fetchClubMembers so an explicit sync always pulls fresh.
const membersCache = new Map<string, { at: number; members: HnaMember[] }>();
const MEMBERS_TTL_MS = 60 * 60 * 1000;

async function fetchClubMembersCached(creds: HnaCreds): Promise<HnaMember[]> {
  const c = membersCache.get(creds.username);
  if (c && Date.now() - c.at < MEMBERS_TTL_MS) return c.members;
  const members = await fetchClubMembers(creds);
  membersCache.set(creds.username, { at: Date.now(), members });
  return members;
}

// Single player's current index by any of their HNA ids (for the app's "update
// from HNA" button). The ISV API is club-scoped, so we pull the club roster and
// match against every identity field.
export async function lookupHandicap(creds: HnaCreds, saId: string): Promise<number | null> {
  if (!normId(saId)) return null;
  const members = await fetchClubMembersCached(creds);
  const hit = buildMemberLookup(members)(saId);
  return hit ? hit.handicapIndex : null;
}
