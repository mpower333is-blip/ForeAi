// Backend client for club membership + tee-time booking (the "complete package").
//
// Every call fails soft (returns null / throws a tidy Error) so the UI can show
// a clear message rather than crashing. Scoped to the app's club flavour via
// CLUB (e.g. "kempton"); a non-club build has no clubKey and these are unused.

import { API_BASE } from "./api";
import { CLUB } from "../config/appVariant";

export type MemberCard = {
  id: string;
  clubKey: string;
  memberNumber: string;
  firstName: string;
  lastName: string;
  category: string;
  status: string;
  handicapIndex: number | null;
  handicapSyncedAt: string | null;
  photo: string | null;
};

export type ClubInfo = {
  clubKey: string;
  name: string;
  courseId: string;
  firstTeeMin: number;
  lastTeeMin: number;
  intervalMin: number;
  slotCapacity: number;
  bookingWindowDays: number;
  openDays: string;
  hasAdminPin: boolean;
};

export type Slot = {
  minute: number;
  time: string;
  teeAt: string;
  capacity: number;
  booked: number;
  available: number;
  blocked: boolean;
  names: string[];
};

export type DaySheet = {
  date: string;
  open: boolean;
  courseId: string;
  bookingWindowDays: number;
  slotCapacity: number;
  slots: Slot[];
};

export type Booking = {
  id: string;
  clubKey: string;
  teeAt: string;
  courseId: string;
  memberId: string | null;
  partySize: number;
  players: string[] | null;
  note: string | null;
  status: string;
};

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as any)?.error || `Request failed (${res.status})`);
  return body as T;
}

const CK = () => CLUB || "kempton";

export const membershipApi = {
  club: () => j<ClubInfo>(`/club/${CK()}`),

  // Identify / claim a membership for this device.
  lookup: (params: { number?: string; email?: string }) => {
    const q = new URLSearchParams();
    if (params.number) q.set("number", params.number);
    if (params.email) q.set("email", params.email);
    return j<MemberCard>(`/members/${CK()}/lookup?${q.toString()}`);
  },
  claim: (body: { memberNumber: string; email?: string; lastName?: string; deviceId?: string }) =>
    j<MemberCard>(`/members/${CK()}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),

  // Tee sheet.
  slots: (date: string) => j<DaySheet>(`/bookings/${CK()}/slots?date=${encodeURIComponent(date)}`),
  myBookings: (memberId: string) => j<Booking[]>(`/bookings/${CK()}/mine?memberId=${encodeURIComponent(memberId)}`),
  book: (body: { memberId: string; date: string; minute: number; partySize?: number; players?: string[]; note?: string }) =>
    j<Booking>(`/bookings/${CK()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  cancel: (id: string, memberId: string) =>
    j<Booking>(`/bookings/${CK()}/${id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    }),
};
