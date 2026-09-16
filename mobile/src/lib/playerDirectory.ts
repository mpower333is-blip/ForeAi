import { loadJSON, saveJSON } from "./storage";

// A reusable roster of players kept on this device, so an organiser can add
// players to "the system" once and pull them into any event — handy for school
// leagues where the same players recur across many events. Device-local (no
// account needed); the event still holds its own copy once players are added.
export type RosterPlayer = {
  id: string;
  name: string;
  handicap: number;
  team?: string; // school / grade / team — optional
};

const KEY = "foreai.roster.v1";

export function loadRoster(): Promise<RosterPlayer[]> {
  return loadJSON<RosterPlayer[]>(KEY).then((r) => r ?? []);
}

export function saveRoster(list: RosterPlayer[]): Promise<void> {
  return saveJSON(KEY, list);
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
