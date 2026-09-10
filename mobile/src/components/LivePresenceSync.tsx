import React from "react";
import { AppState } from "react-native";
import { useTournament } from "../state/TournamentContext";
import { useLocation } from "../hooks/useLocation";

// Shares this player's live GPS position with the backend during a golf day, so
// organisers see where everyone is on the course from the clubhouse. Renders
// nothing; mounted once, app-wide, so it keeps sending WHILE YOU PLAY — not just
// on the Events screen. Only a registered player on a shared event shares
// location (organisers just browsing never get a permission prompt), and only
// while the app is in the foreground (no background tracking). Matches the
// privacy policy: position is shared only while you're in a live event.
const PING_MS = 30000;

export default function LivePresenceSync() {
  const { events, myPlayerId, pingPresence, inLiveEvent } = useTournament();
  const loc = useLocation(inLiveEvent);
  const coordRef = React.useRef(loc.coord);
  coordRef.current = loc.coord;

  // The events this device is a registered player in (shared + claimed).
  const liveEvents = events.filter((e) => e.remote && !!myPlayerId(e.id));
  const key = liveEvents.map((e) => e.id).join(",");

  React.useEffect(() => {
    if (!key) return;
    const beat = () => {
      if (AppState.currentState !== "active") return; // foreground only
      const c = coordRef.current;
      for (const e of liveEvents) {
        const me = myPlayerId(e.id);
        if (me) pingPresence(e.id, me, c ? { lat: c.lat, lng: c.lng } : undefined);
      }
    };
    beat(); // mark live immediately
    const iv = setInterval(beat, PING_MS);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return null;
}
