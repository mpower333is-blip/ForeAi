// Types for the ported Firestore data layer (clubFs.js). It returns a fetch-like
// response so the existing REST-style API clients work unchanged.
export interface ClubFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<any>;
  text(): Promise<string>;
}
export function clubFetch(
  path: string,
  init?: { method?: string; body?: string; headers?: Record<string, string> },
): Promise<ClubFetchResponse>;
export const CLUB_FS_ENABLED: boolean;
