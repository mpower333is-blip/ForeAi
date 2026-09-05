import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { TEvent } from "./tournament";

// Local reminders for a golf day: the evening before, a couple of hours before
// tee-off, an hour before, and at the start. Local-only (no push server), so
// they work on both iOS and Android once notification permission is granted.

function fmtTime(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// The event's start as a local Date (device timezone), from its ISO date + the
// first tee-off minute-of-day.
function eventStart(ev: TEvent): Date | null {
  if (!ev.date) return null;
  const [y, mo, d] = ev.date.split("-").map(Number);
  if (!y || !mo || !d) return null;
  const mins = typeof ev.firstTeeMin === "number" ? ev.firstTeeMin : 8 * 60;
  return new Date(y, mo - 1, d, Math.floor(mins / 60), mins % 60, 0, 0);
}

let permitted: boolean | null = null;
async function ensurePermission(): Promise<boolean> {
  if (permitted !== null) return permitted;
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
    permitted = status === "granted";
  } catch {
    permitted = false;
  }
  if (permitted && Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync("reminders", {
        name: "Golf day reminders",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
      });
    } catch {}
  }
  return permitted;
}

// Schedule (or refresh) the reminders for one event. Deterministic identifiers
// mean re-calling this just replaces the existing set — no duplicates.
export async function scheduleEventReminders(ev: TEvent, venue: string): Promise<void> {
  const start = eventStart(ev);
  if (!start) return;
  if (!(await ensurePermission())) return;

  const tee = fmtTime(typeof ev.firstTeeMin === "number" ? ev.firstTeeMin : 8 * 60);
  const name = ev.name || "Golf day";
  const startFmt = ev.shotgun ? `shotgun ${tee}` : `first tee ${tee}`;

  const eve = new Date(start);
  eve.setDate(eve.getDate() - 1);
  eve.setHours(18, 0, 0, 0);

  const slots: { key: string; when: Date; title: string; body: string }[] = [
    { key: "eve", when: eve, title: `${name} tomorrow`, body: `${venue} · ${startFmt}. Pack the clubs — good luck!` },
    { key: "2h", when: new Date(start.getTime() - 120 * 60000), title: `${name} today`, body: `${startFmt} at ${venue}. Time to head to the course.` },
    { key: "1h", when: new Date(start.getTime() - 60 * 60000), title: "Tee off in 1 hour", body: `${name} — head to the club and check in.` },
    { key: "start", when: start, title: "Tee off — good luck! ⛳", body: `${name} is starting at ${venue}. Have a great round.` },
  ];

  const now = Date.now();
  for (const s of slots) {
    const id = `evt_${ev.id}_${s.key}`;
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {}
    if (s.when.getTime() <= now + 30000) continue; // skip past / imminent slots
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: { title: s.title, body: s.body, sound: "default" },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: s.when,
          channelId: "reminders",
        } as Notifications.DateTriggerInput,
      });
    } catch {}
  }
}

// Cancel all reminders for an event (e.g. if the player leaves it).
export async function cancelEventReminders(eventId: string): Promise<void> {
  for (const key of ["eve", "2h", "1h", "start"]) {
    try {
      await Notifications.cancelScheduledNotificationAsync(`evt_${eventId}_${key}`);
    } catch {}
  }
}
