// One entry point for the club data clients (membership, tee times, competitions,
// news, payments). In Firestore mode it runs the request against Firestore
// (clubFs), which is the SAME store the web portal uses; otherwise it falls back
// to the Render backend over HTTP. Every call fails soft with a tidy Error.

import { API_BASE } from "./api";
import { USE_FIRESTORE } from "../config/appVariant";
import { clubFetch } from "./clubFs";

export async function clubRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = USE_FIRESTORE
    ? await clubFetch(path, init as any)
    : await fetch(`${API_BASE}${path}`, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as any)?.error || `Request failed (${res.status})`);
  return body as T;
}
