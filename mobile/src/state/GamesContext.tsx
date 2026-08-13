import React, { createContext, useContext, useState } from "react";
import { GameId } from "../lib/games";

// Tracks best scores per game for the session (in-memory; a future enhancement
// can persist these via AsyncStorage or sync them to the backend).
type GamesState = {
  best: Record<string, number>;
  recordScore: (id: GameId, score: number) => boolean; // returns true if new best
};

const Ctx = createContext<GamesState | null>(null);

export function GamesProvider({ children }: { children: React.ReactNode }) {
  const [best, setBest] = useState<Record<string, number>>({});

  const recordScore = (id: GameId, score: number): boolean => {
    const prev = best[id] ?? -Infinity;
    if (score > prev) {
      setBest((b) => ({ ...b, [id]: score }));
      return true;
    }
    return false;
  };

  return <Ctx.Provider value={{ best, recordScore }}>{children}</Ctx.Provider>;
}

export function useGames(): GamesState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGames must be used within a GamesProvider");
  return ctx;
}
