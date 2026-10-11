import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage";
import { estimatedIndex } from "../lib/handicap";

// Every round you finish in ForeAi, kept on the device so the "My Golf" dashboard
// can show your history, trend, bests and an estimated index. Saved explicitly
// from the round summary ("Save round to My Golf"), so a practice round or an
// abandoned card never pollutes the history.

export type RoundRecord = {
  id: string;
  dateISO: string; // when the round was saved
  courseId: string;
  courseName: string;
  holesPlayed: number;
  gross: number; // strokes for holes played
  net: number; // gross − strokes received
  stableford: number;
  toPar: number;
  sgTotal: number | null; // ForeAi strokes-gained, when the round had logged shots
  differential: number | null; // WHS-style, when the course CR/slope were known
  handicapIndex: number | null; // the index in effect when the round was played
};

const KEY = "foreai.roundhistory.v1";

type HistoryState = {
  ready: boolean;
  records: RoundRecord[]; // newest first
  addRound: (r: Omit<RoundRecord, "id" | "dateISO"> & { dateISO?: string }) => void;
  removeRound: (id: string) => void;
  clearHistory: () => void;
  // derived
  estIndex: number | null; // estimated Handicap Index from logged differentials
  bestGross: RoundRecord | null;
  bestStableford: RoundRecord | null;
  bestSG: RoundRecord | null;
};

const Ctx = createContext<HistoryState | null>(null);

let seq = 0;
const makeId = () => `rd_${Date.now()}_${seq++}`;

export function RoundHistoryProvider({ children }: { children: React.ReactNode }) {
  const [records, setRecords] = useState<RoundRecord[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadJSON<RoundRecord[]>(KEY).then((saved) => {
      if (Array.isArray(saved)) setRecords(saved);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (ready) saveJSON(KEY, records);
  }, [records, ready]);

  const value = useMemo<HistoryState>(() => {
    // Differentials in chronological order (oldest→newest) for the index estimate.
    const diffsChrono = [...records]
      .reverse()
      .map((r) => r.differential)
      .filter((d): d is number => typeof d === "number");

    const by = <T,>(pick: (r: RoundRecord) => number | null, better: (a: number, b: number) => boolean) =>
      records.reduce<RoundRecord | null>((best, r) => {
        const v = pick(r);
        if (v == null) return best;
        const bv = best ? pick(best) : null;
        return bv == null || better(v, bv) ? r : best;
      }, null);

    return {
      ready,
      records,
      addRound: (r) =>
        setRecords((prev) => [
          { ...r, id: makeId(), dateISO: r.dateISO ?? new Date().toISOString() },
          ...prev,
        ]),
      removeRound: (id) => setRecords((prev) => prev.filter((r) => r.id !== id)),
      clearHistory: () => setRecords([]),
      estIndex: estimatedIndex(diffsChrono),
      bestGross: by((r) => (r.holesPlayed >= 18 ? r.gross : null), (a, b) => a < b),
      bestStableford: by((r) => r.stableford, (a, b) => a > b),
      bestSG: by((r) => r.sgTotal, (a, b) => a > b),
    };
  }, [records, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRoundHistory(): HistoryState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRoundHistory must be used within a RoundHistoryProvider");
  return v;
}
