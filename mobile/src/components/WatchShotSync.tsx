import { useRound } from "../state/RoundContext";
import { useTournament } from "../state/TournamentContext";
import { useWatchShots } from "../hooks/useWatchShots";

// Bridges the watch → phone shot pipeline (Stage 3). Renders nothing; while
// you're in a live golf day with a claimed player, it polls the backend for the
// watch's swing marks and logs them into the round, so hands-free tracking works
// with the phone in the cart. Mounted once, app-wide.
export default function WatchShotSync() {
  const { events, myPlayerId } = useTournament();
  const { logShot, effectiveBag } = useRound();

  const live = events.find((e) => e.remote && !!myPlayerId(e.id));

  useWatchShots({
    enabled: !!live,
    eventId: live?.id,
    playerId: live ? myPlayerId(live.id) : undefined,
    bag: effectiveBag,
    onShot: (s) => logShot(s),
  });

  return null;
}
