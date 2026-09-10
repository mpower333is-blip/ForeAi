import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loadJSON, saveJSON, remove } from "../lib/storage";
import { MemberCard } from "../services/membershipApi";

// Who "I" am at the club — the membership claimed on this device. Persisted so
// the digital card and tee bookings survive restarts. Null until the member
// claims their membership on the Membership screen.

const KEY = "foreai.member.v1";

type MemberState = {
  member: MemberCard | null;
  ready: boolean; // storage read (avoid a flash of the claim form)
  setMember: (m: MemberCard) => void;
  clear: () => void;
};

const Ctx = createContext<MemberState | null>(null);

export function MemberProvider({ children }: { children: React.ReactNode }) {
  const [member, setMemberState] = useState<MemberCard | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    loadJSON<MemberCard>(KEY).then((saved) => {
      if (!alive) return;
      if (saved) setMemberState(saved);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<MemberState>(
    () => ({
      member,
      ready,
      setMember: (m) => {
        setMemberState(m);
        saveJSON(KEY, m);
      },
      clear: () => {
        setMemberState(null);
        remove(KEY);
      },
    }),
    [member, ready],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMember(): MemberState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMember must be used within MemberProvider");
  return ctx;
}
