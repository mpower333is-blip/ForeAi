// Backend client for club membership + tee-time booking (the "complete package").
//
// Every call fails soft (returns null / throws a tidy Error) so the UI can show
// a clear message rather than crashing. Scoped to the app's club flavour via
// CLUB (e.g. "kempton"); a non-club build has no clubKey and these are unused.

import { clubRequest } from "./clubBackend";
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

// A player in an open game, with the handicap that drives level matching.
export type GameMember = {
  memberId: string;
  name: string;
  handicapIndex: number | null;
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
  // Open-game fields (Playtomic-style). `open` is false for a normal booking.
  open?: boolean;
  maxPlayers?: number;
  hostMemberId?: string | null;
  members?: GameMember[];
  openSpots?: number;
};

// A saved playing partner in the club's shared directory. `memberId` is set once
// that person links their own membership (so they're a real member, not a guest).
export type PlayerCard = {
  id: string;
  clubKey: string;
  name: string;
  phone: string;
  memberId: string | null;
  memberNumber: string | null;
};

// Firestore in club mode (same store as the web portal), Render otherwise.
const j = clubRequest;

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
  book: (body: { memberId: string; date: string; minute: number; partySize?: number; players?: string[]; note?: string; open?: boolean; maxPlayers?: number }) =>
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

  // Open games (Playtomic-style): the board of joinable games, plus join/leave.
  openGames: () => j<Booking[]>(`/bookings/${CK()}/open`),
  joinGame: (id: string, memberId: string) =>
    j<Booking>(`/bookings/${CK()}/${id}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    }),
  leaveGame: (id: string, memberId: string) =>
    j<Booking>(`/bookings/${CK()}/${id}/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    }),

  // Shared playing-partner directory (buddies) — search it, and save a new
  // partner so it's there for everyone next time.
  players: (q?: string) =>
    j<PlayerCard[]>(`/players/${CK()}${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  savePlayer: (body: { name: string; phone?: string }) =>
    j<PlayerCard>(`/players/${CK()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
};
