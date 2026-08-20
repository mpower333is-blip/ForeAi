import React, { createContext, useContext, useState } from "react";
import { TEvent, TPlayer, TGroup, EventFormat, ContestType, SponsorTier } from "../lib/tournament";
import { COURSES } from "../data/courses";
import { tournamentApi } from "../services/tournamentApi";
import { DEVICE_ID } from "./device";

let idc = 0;
export function newId(prefix: string): string {
  idc += 1;
  return `${prefix}_${idc}`;
}

type CreateInput = {
  name: string;
  courseId: string;
  format: EventFormat;
  firstTeeMin: number;
  intervalMin: number;
  date: string;
  shotgun?: boolean;
};

type TournamentState = {
  events: TEvent[];
  deviceId: string;
  // creation / joining
  createEvent: (input: CreateInput) => TEvent; // local, offline
  createEcsGolfDay: () => TEvent; // pre-loaded ECS fundraiser (local, no code)
  createEcsGolfDayLive: () => Promise<TEvent | null>; // shared ECS fundraiser with a join code
  createSharedEvent: (input: CreateInput) => Promise<TEvent | null>; // backend
  joinByCode: (code: string) => Promise<TEvent | null>;
  refreshEvent: (id: string) => Promise<void>;
  registerSelf: (eventId: string, name: string, handicap: number) => Promise<TEvent | null>;
  myPlayerId: (eventId: string) => string | undefined;
  // Heartbeat: mark this device's player live (+ optional GPS) so organisers
  // can see who's on the app and where each team is.
  pingPresence: (eventId: string, playerId: string, coord?: { lat: number; lng: number }) => void;
  // mutations (branch local vs remote automatically)
  getEvent: (id: string) => TEvent | undefined;
  updateEvent: (id: string, patch: Partial<TEvent>) => void;
  addPlayer: (eventId: string, name: string, handicap: number) => void;
  removePlayer: (eventId: string, playerId: string) => void;
  addGroup: (eventId: string) => void;
  removeGroup: (eventId: string, groupId: string) => void;
  togglePlayerInGroup: (eventId: string, groupId: string, playerId: string) => void;
  setScore: (eventId: string, playerId: string, hole: number, strokes: number) => void;
  addContest: (eventId: string, type: ContestType, hole: number) => void;
  removeContest: (eventId: string, contestId: string) => void;
  setContestResult: (eventId: string, contestId: string, playerId: string, value: number) => void;
  addSponsor: (eventId: string, name: string, tier: SponsorTier, hole?: number, message?: string) => void;
  removeSponsor: (eventId: string, sponsorId: string) => void;
};

const Ctx = createContext<TournamentState | null>(null);

export function TournamentProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<TEvent[]>([]);
  const [myByEvent, setMyByEvent] = useState<Record<string, string>>({});

  const getEvent = (id: string) => events.find((e) => e.id === id);
  const myPlayerId = (eventId: string) => myByEvent[eventId];

  // Insert or replace an event by id (used after every remote response).
  const replaceEvent = (ev: TEvent) =>
    setEvents((prev) => {
      const idx = prev.findIndex((e) => e.id === ev.id);
      if (idx === -1) return [ev, ...prev];
      const next = [...prev];
      next[idx] = ev;
      return next;
    });

  const localMutate = (id: string, fn: (e: TEvent) => TEvent) =>
    setEvents((prev) => prev.map((e) => (e.id === id ? fn(e) : e)));

  // Run a remote call and fold the returned event back into state.
  const runRemote = async (p: Promise<TEvent | null>) => {
    const ev = await p;
    if (ev) replaceEvent(ev);
    return ev;
  };

  // ---- creation / joining -------------------------------------------------

  const createEvent: TournamentState["createEvent"] = (input) => {
    const ev: TEvent = {
      id: newId("evt"),
      name: input.name || "New Event",
      date: input.date,
      courseId: input.courseId || COURSES[0].id,
      format: input.format,
      firstTeeMin: input.firstTeeMin,
      intervalMin: input.intervalMin,
      players: [],
      groups: [],
      scores: {},
      shotgun: !!input.shotgun,
      remote: false,
    };
    setEvents((prev) => [ev, ...prev]);
    return ev;
  };

  // A ready-to-run demo of the ECS Golf Day fundraiser (local/offline). Everything
  // is editable in the event afterwards — teams, sponsors, cause and contests.
  const createEcsGolfDay: TournamentState["createEcsGolfDay"] = () => {
    const names = [
      "James Botha", "Riaan Naidoo", "Pieter van Wyk", "Sipho Dlamini",
      "Kyle Roberts", "Thabo Mokoena", "Andre du Toit", "Liam O'Connor",
    ];
    const players: TPlayer[] = names.map((n, i) => ({
      id: newId("ply"),
      name: n,
      handicap: 8 + ((i * 5) % 20),
    }));
    const g1: TGroup = { id: newId("grp"), playerIds: players.slice(0, 4).map((p) => p.id) };
    const g2: TGroup = { id: newId("grp"), playerIds: players.slice(4, 8).map((p) => p.id) };

    const ev: TEvent = {
      id: newId("evt"),
      name: "ECS Golf Day Fundraiser",
      date: "2026-10-15",
      courseId: "kempton-park",
      format: "scramble",
      firstTeeMin: 8 * 60, // 08:00 shotgun (07:30 for 08:00, per the registration forms)
      intervalMin: 10,
      shotgun: true,
      players,
      groups: [g1, g2],
      scores: {},
      cause:
        "Proudly supporting Lyla Roux in her fight against ALK-positive Anaplastic Large Cell Lymphoma. Together we make a difference.",
      logoKey: "ecs",
      sponsors: [
        { id: newId("spo"), name: "Engine Control Systems (ECS)", tier: "title" },
        { id: newId("spo"), name: "Hole 3 sponsor (tap to edit)", tier: "hole", hole: 3 },
        { id: newId("spo"), name: "Hole 7 sponsor (tap to edit)", tier: "hole", hole: 7 },
        { id: newId("spo"), name: "Prize sponsor (tap to edit)", tier: "prize" },
      ],
      contests: [
        { id: newId("con"), type: "closest", hole: 3 },
        { id: newId("con"), type: "longest", hole: 7 },
      ],
      contestResults: {},
      remote: false,
    };
    setEvents((prev) => [ev, ...prev]);
    return ev;
  };

  const createSharedEvent: TournamentState["createSharedEvent"] = (input) =>
    runRemote(
      tournamentApi.create({
        name: input.name || "New Event",
        courseId: input.courseId || COURSES[0].id,
        format: input.format,
        firstTeeMin: input.firstTeeMin,
        intervalMin: input.intervalMin,
        shotgun: !!input.shotgun,
      })
    );

  // Create the ECS Golf Day on the backend (so it has a shareable join code) and
  // apply its branding — cause, title/hole/prize sponsors and side games. Real
  // players register themselves; no demo players are added. Returns null offline.
  const createEcsGolfDayLive: TournamentState["createEcsGolfDayLive"] = async () => {
    const created = await runRemote(
      tournamentApi.create({
        name: "ECS Golf Day Fundraiser",
        courseId: "kempton-park",
        format: "scramble",
        firstTeeMin: 8 * 60, // 08:00 shotgun (07:30 for 08:00)
        intervalMin: 10,
        shotgun: true,
      })
    );
    if (!created) return null;
    const id = created.id;
    let ev: TEvent = created;
    const step = async (p: Promise<TEvent | null>) => {
      const r = await runRemote(p);
      if (r) ev = r;
    };
    await step(
      tournamentApi.update(id, {
        cause:
          "Proudly supporting Lyla Roux in her fight against ALK-positive Anaplastic Large Cell Lymphoma. Together we make a difference.",
      })
    );
    await step(tournamentApi.addSponsor(id, { name: "Engine Control Systems (ECS)", tier: "title" }));
    await step(tournamentApi.addSponsor(id, { name: "Hole 3 sponsor (tap to edit)", tier: "hole", hole: 3 }));
    await step(tournamentApi.addSponsor(id, { name: "Hole 7 sponsor (tap to edit)", tier: "hole", hole: 7 }));
    await step(tournamentApi.addSponsor(id, { name: "Prize sponsor (tap to edit)", tier: "prize" }));
    await step(tournamentApi.addContest(id, "closest", 3));
    await step(tournamentApi.addContest(id, "longest", 7));
    return ev;
  };

  const joinByCode: TournamentState["joinByCode"] = (code) =>
    runRemote(tournamentApi.getByCode(code));

  const refreshEvent: TournamentState["refreshEvent"] = async (id) => {
    const ev = getEvent(id);
    if (!ev?.remote) return;
    await runRemote(tournamentApi.get(id));
  };

  const registerSelf: TournamentState["registerSelf"] = async (eventId, name, handicap) => {
    const ev = await runRemote(
      tournamentApi.addPlayer(eventId, { name, handicap, deviceId: DEVICE_ID })
    );
    if (ev) {
      // Prefer a matching-device player we haven't already claimed as "me".
      const mine =
        ev.players.find((p) => p.deviceId === DEVICE_ID && myByEvent[eventId] !== p.id) ??
        ev.players.find((p) => p.deviceId === DEVICE_ID);
      if (mine) setMyByEvent((prev) => ({ ...prev, [eventId]: mine.id }));
    }
    return ev;
  };

  const pingPresence: TournamentState["pingPresence"] = (eventId, playerId, coord) => {
    const ev = getEvent(eventId);
    if (!ev?.remote || !playerId) return;
    // Fire-and-forget — a missed heartbeat just means "not seen for a bit".
    tournamentApi.ping(eventId, playerId, coord);
  };

  // ---- mutations (local or remote) ---------------------------------------

  const updateEvent: TournamentState["updateEvent"] = (id, patch) => {
    const ev = getEvent(id);
    if (ev?.remote) {
      runRemote(
        tournamentApi.update(id, {
          name: patch.name,
          format: patch.format,
          firstTeeMin: patch.firstTeeMin,
          intervalMin: patch.intervalMin,
          shotgun: patch.shotgun,
          cause: patch.cause,
        })
      );
      return;
    }
    localMutate(id, (e) => ({ ...e, ...patch }));
  };

  const addPlayer: TournamentState["addPlayer"] = (eventId, name, handicap) => {
    const ev = getEvent(eventId);
    if (ev?.remote) {
      runRemote(tournamentApi.addPlayer(eventId, { name, handicap }));
      return;
    }
    localMutate(eventId, (e) => {
      const player: TPlayer = { id: newId("ply"), name, handicap };
      return { ...e, players: [...e.players, player] };
    });
  };

  const removePlayer: TournamentState["removePlayer"] = (eventId, playerId) => {
    const ev = getEvent(eventId);
    if (ev?.remote) {
      runRemote(tournamentApi.removePlayer(eventId, playerId));
      return;
    }
    localMutate(eventId, (e) => {
      const scores = { ...e.scores };
      delete scores[playerId];
      return {
        ...e,
        players: e.players.filter((p) => p.id !== playerId),
        groups: e.groups.map((g) => ({
          ...g,
          playerIds: g.playerIds.filter((id) => id !== playerId),
        })),
        scores,
      };
    });
  };

  const addGroup: TournamentState["addGroup"] = (eventId) => {
    const ev = getEvent(eventId);
    if (ev?.remote) {
      runRemote(tournamentApi.addGroup(eventId));
      return;
    }
    localMutate(eventId, (e) => {
      const group: TGroup = { id: newId("grp"), playerIds: [] };
      return { ...e, groups: [...e.groups, group] };
    });
  };

  const removeGroup: TournamentState["removeGroup"] = (eventId, groupId) => {
    const ev = getEvent(eventId);
    if (ev?.remote) {
      runRemote(tournamentApi.removeGroup(eventId, groupId));
      return;
    }
    localMutate(eventId, (e) => ({ ...e, groups: e.groups.filter((g) => g.id !== groupId) }));
  };

  const togglePlayerInGroup: TournamentState["togglePlayerInGroup"] = (
    eventId,
    groupId,
    playerId
  ) => {
    const ev = getEvent(eventId);
    if (ev?.remote) {
      const inGroup = ev.groups.find((g) => g.id === groupId)?.playerIds.includes(playerId);
      runRemote(tournamentApi.assignPlayer(eventId, playerId, inGroup ? null : groupId));
      return;
    }
    localMutate(eventId, (e) => ({
      ...e,
      groups: e.groups.map((g) => {
        // A player can only be in one group at a time.
        if (g.id === groupId) {
          const has = g.playerIds.includes(playerId);
          return {
            ...g,
            playerIds: has
              ? g.playerIds.filter((id) => id !== playerId)
              : [...g.playerIds, playerId],
          };
        }
        return { ...g, playerIds: g.playerIds.filter((id) => id !== playerId) };
      }),
    }));
  };

  const setScore: TournamentState["setScore"] = (eventId, playerId, hole, strokes) => {
    const ev = getEvent(eventId);
    if (ev?.remote) {
      runRemote(tournamentApi.setScore(eventId, playerId, hole, strokes));
      return;
    }
    localMutate(eventId, (e) => {
      const card = { ...(e.scores[playerId] ?? {}) };
      if (strokes <= 0) delete card[hole];
      else card[hole] = strokes;
      return { ...e, scores: { ...e.scores, [playerId]: card } };
    });
  };

  const addContest: TournamentState["addContest"] = (eventId, type, hole) => {
    const ev = getEvent(eventId);
    if (ev?.remote) {
      runRemote(tournamentApi.addContest(eventId, type, hole));
      return;
    }
    localMutate(eventId, (e) => ({
      ...e,
      contests: [...(e.contests ?? []), { id: newId("con"), type, hole }],
    }));
  };

  const removeContest: TournamentState["removeContest"] = (eventId, contestId) => {
    const ev = getEvent(eventId);
    if (ev?.remote) {
      runRemote(tournamentApi.removeContest(eventId, contestId));
      return;
    }
    localMutate(eventId, (e) => {
      const cr = { ...(e.contestResults ?? {}) };
      delete cr[contestId];
      return { ...e, contests: (e.contests ?? []).filter((c) => c.id !== contestId), contestResults: cr };
    });
  };

  const setContestResult: TournamentState["setContestResult"] = (eventId, contestId, playerId, value) => {
    const ev = getEvent(eventId);
    if (ev?.remote) {
      runRemote(tournamentApi.setContestResult(eventId, contestId, playerId, value));
      return;
    }
    localMutate(eventId, (e) => {
      const cr = { ...(e.contestResults ?? {}) };
      const inner = { ...(cr[contestId] ?? {}) };
      if (value <= 0) delete inner[playerId];
      else inner[playerId] = value;
      cr[contestId] = inner;
      return { ...e, contestResults: cr };
    });
  };

  const addSponsor: TournamentState["addSponsor"] = (eventId, name, tier, hole, message) => {
    const ev = getEvent(eventId);
    if (ev?.remote) {
      runRemote(tournamentApi.addSponsor(eventId, { name, tier, hole: hole ?? null, message: message ?? null }));
      return;
    }
    localMutate(eventId, (e) => ({
      ...e,
      sponsors: [...(e.sponsors ?? []), { id: newId("spo"), name, tier, hole: hole ?? null, message: message ?? null }],
    }));
  };

  const removeSponsor: TournamentState["removeSponsor"] = (eventId, sponsorId) => {
    const ev = getEvent(eventId);
    if (ev?.remote) {
      runRemote(tournamentApi.removeSponsor(eventId, sponsorId));
      return;
    }
    localMutate(eventId, (e) => ({ ...e, sponsors: (e.sponsors ?? []).filter((s) => s.id !== sponsorId) }));
  };

  const value: TournamentState = {
    events,
    deviceId: DEVICE_ID,
    createEvent,
    createEcsGolfDay,
    createEcsGolfDayLive,
    createSharedEvent,
    joinByCode,
    refreshEvent,
    registerSelf,
    myPlayerId,
    pingPresence,
    getEvent,
    updateEvent,
    addPlayer,
    removePlayer,
    addGroup,
    removeGroup,
    togglePlayerInGroup,
    setScore,
    addContest,
    removeContest,
    setContestResult,
    addSponsor,
    removeSponsor,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTournament(): TournamentState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTournament must be used within a TournamentProvider");
  return ctx;
}
