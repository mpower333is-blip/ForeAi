import React, { createContext, useContext, useState } from "react";
import { TEvent, TPlayer, TGroup, EventFormat } from "../lib/tournament";
import { COURSES } from "../data/courses";

let idc = 0;
export function newId(prefix: string): string {
  idc += 1;
  return `${prefix}_${idc}`;
}

type TournamentState = {
  events: TEvent[];
  createEvent: (input: {
    name: string;
    courseId: string;
    format: EventFormat;
    firstTeeMin: number;
    intervalMin: number;
    date: string;
  }) => TEvent;
  getEvent: (id: string) => TEvent | undefined;
  updateEvent: (id: string, patch: Partial<TEvent>) => void;
  addPlayer: (eventId: string, name: string, handicap: number) => void;
  removePlayer: (eventId: string, playerId: string) => void;
  addGroup: (eventId: string) => void;
  removeGroup: (eventId: string, groupId: string) => void;
  togglePlayerInGroup: (eventId: string, groupId: string, playerId: string) => void;
  setScore: (eventId: string, playerId: string, hole: number, strokes: number) => void;
};

const Ctx = createContext<TournamentState | null>(null);

export function TournamentProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<TEvent[]>([]);

  const mutate = (id: string, fn: (e: TEvent) => TEvent) =>
    setEvents((prev) => prev.map((e) => (e.id === id ? fn(e) : e)));

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
    };
    setEvents((prev) => [ev, ...prev]);
    return ev;
  };

  const getEvent = (id: string) => events.find((e) => e.id === id);

  const updateEvent: TournamentState["updateEvent"] = (id, patch) =>
    mutate(id, (e) => ({ ...e, ...patch }));

  const addPlayer: TournamentState["addPlayer"] = (eventId, name, handicap) =>
    mutate(eventId, (e) => {
      const player: TPlayer = { id: newId("ply"), name, handicap };
      return { ...e, players: [...e.players, player] };
    });

  const removePlayer: TournamentState["removePlayer"] = (eventId, playerId) =>
    mutate(eventId, (e) => {
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

  const addGroup: TournamentState["addGroup"] = (eventId) =>
    mutate(eventId, (e) => {
      const group: TGroup = { id: newId("grp"), playerIds: [] };
      return { ...e, groups: [...e.groups, group] };
    });

  const removeGroup: TournamentState["removeGroup"] = (eventId, groupId) =>
    mutate(eventId, (e) => ({ ...e, groups: e.groups.filter((g) => g.id !== groupId) }));

  const togglePlayerInGroup: TournamentState["togglePlayerInGroup"] = (
    eventId,
    groupId,
    playerId
  ) =>
    mutate(eventId, (e) => ({
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

  const setScore: TournamentState["setScore"] = (eventId, playerId, hole, strokes) =>
    mutate(eventId, (e) => {
      const card = { ...(e.scores[playerId] ?? {}) };
      if (strokes <= 0) delete card[hole];
      else card[hole] = strokes;
      return { ...e, scores: { ...e.scores, [playerId]: card } };
    });

  const value: TournamentState = {
    events,
    createEvent,
    getEvent,
    updateEvent,
    addPlayer,
    removePlayer,
    addGroup,
    removeGroup,
    togglePlayerInGroup,
    setScore,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTournament(): TournamentState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTournament must be used within a TournamentProvider");
  return ctx;
}
