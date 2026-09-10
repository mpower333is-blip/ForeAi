// Backend client for club competitions. Fails loud with tidy Error messages so
// the screen can surface them; scoped to the app's club flavour (CLUB).

import { API_BASE } from "./api";
import { CLUB } from "../config/appVariant";

export type CompFormat = "stableford" | "stroke" | "betterball";

export type CompetitionSummary = {
  id: string;
  name: string;
  date: string;
  format: CompFormat;
  courseId: string;
  status: string; // open | closed | results
  handicapAllowance: number;
  description: string | null;
  entryCount: number;
};

export type LeaderRow = {
  pos: number | null;
  entryId: string;
  memberId: string | null;
  name: string;
  playingHandicap: number;
  handicapIndex: number | null;
  gross: number;
  net: number;
  stableford: number;
  thru: number;
  status: string;
};

export type CompEntry = {
  id: string;
  memberId: string | null;
  playerName: string;
  handicapIndex: number | null;
  playingHandicap: number;
  holeScores: number[];
  grossTotal: number | null;
  netTotal: number | null;
  stableford: number | null;
  status: string;
};

export type CompetitionDetail = CompetitionSummary & {
  pars: number[];
  sis: number[];
  leaderboard: LeaderRow[];
  myEntry: CompEntry | null;
};

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as any)?.error || `Request failed (${res.status})`);
  return body as T;
}
const CK = () => CLUB || "kempton";
const jsonBody = (b: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });

export const competitionsApi = {
  list: (status?: string) => j<CompetitionSummary[]>(`/competitions/${CK()}${status ? `?status=${status}` : ""}`),
  detail: (id: string, memberId?: string) => j<CompetitionDetail>(`/competitions/${CK()}/${id}${memberId ? `?memberId=${encodeURIComponent(memberId)}` : ""}`),
  enter: (id: string, memberId: string) => j<CompEntry>(`/competitions/${CK()}/${id}/enter`, jsonBody({ memberId })),
  withdraw: (id: string, memberId: string) => j<{ ok: boolean }>(`/competitions/${CK()}/${id}/withdraw`, jsonBody({ memberId })),
  submitScore: (id: string, memberId: string, holeScores: number[]) =>
    j<{ entry: CompEntry; result: any }>(`/competitions/${CK()}/${id}/score`, jsonBody({ memberId, holeScores })),
};
