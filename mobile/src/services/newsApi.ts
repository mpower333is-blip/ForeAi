// Backend client for club news / noticeboard. Scoped to the app's club flavour.

import { API_BASE } from "./api";
import { CLUB } from "../config/appVariant";

export type Notice = {
  id: string;
  clubKey: string;
  title: string;
  body: string;
  category: string; // news | event | notice | result | urgent
  pinned: boolean;
  image: string | null;
  authorName: string | null;
  status: string;
  publishAt: string;
};

async function j<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as any)?.error || `Request failed (${res.status})`);
  return body as T;
}
const CK = () => CLUB || "kempton";

const newsRestApi = {
  list: () => j<Notice[]>(`/news/${CK()}`),
  item: (id: string) => j<Notice>(`/news/${CK()}/item/${id}`),
};

// Firestore under EXPO_PUBLIC_USE_FIRESTORE=1 (build-time constant → dead-code-
// eliminated from normal builds). See docs/render-firebase-cutover.md.
export const newsApi: typeof newsRestApi =
  process.env.EXPO_PUBLIC_USE_FIRESTORE === "1"
    ? // eslint-disable-next-line @typescript-eslint/no-var-requires
      (require("./clubFirestore").newsFsApi as unknown as typeof newsRestApi)
    : newsRestApi;
