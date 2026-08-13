import React, { createContext, useContext, useState } from "react";
import { TEvent, TPlayer, TGroup, EventFormat, ContestType } from "../lib/tournament";
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
};

type TournamentState = {
  events: TEvent[];
  deviceId: string;
  // creation / joining
  createEvent: (input: CreateInput) => TEvent; // local, offline
  createSharedEvent: (input: CreateInput) => Promise<TEvent | null>; // backend
  joinByCode: (code: string) => Promise<TEvent | null>;
  refreshEvent: (id: string) => Promise<void>;
  registerSelf: (eventId: string, name: string, handicap: number) => Promise<TEvent | null>;
  myPlayerId: (eventId: string) => string | undefined;
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
      })
    );

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

  const value: TournamentState = {
    events,
    deviceId: DEVICE_ID,
    createEvent,
    createSharedEvent,
    joinByCode,
    refreshEvent,
    registerSelf,
    myPlayerId,
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
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTournament(): TournamentState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTournament must be used within a TournamentProvider");
  return ctx;
}
