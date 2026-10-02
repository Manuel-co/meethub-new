import type { DayHours, Meeting } from "./store";
import { zonedParts, zonedToUtc } from "./tz";

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Mon–Fri, 9 to 5 (matches the database default) */
export const DEFAULT_HOURS: DayHours[] = WEEKDAYS.map((_, i) => ({
  enabled: i >= 1 && i <= 5,
  start: "09:00",
  end: "17:00",
}));

export const DURATIONS = [15, 30, 45, 60, 90];

/** How far ahead guests can book (the database allows 61 days) */
export const BOOKING_HORIZON_DAYS = 60;

export function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** "00:00", "00:30", … "23:30" */
export function timeOptions(step = 30) {
  const out: string[] = [];
  for (let t = 0; t < 24 * 60; t += step) {
    out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  }
  return out;
}

export type Busy = { start: number; end: number };

export const busyFromMeetings = (meetings: Meeting[]): Busy[] =>
  meetings
    .filter((m) => m.status === "scheduled")
    .map((m) => {
      const start = new Date(m.start).getTime();
      return { start, end: start + m.duration * 60_000 };
    });

export function findConflict(
  meetings: Meeting[],
  start: Date,
  duration: number,
): Meeting | null {
  const s = start.getTime();
  const e = s + duration * 60_000;
  return (
    meetings.find((m) => {
      if (m.status !== "scheduled") return false;
      const ms = new Date(m.start).getTime();
      return s < ms + m.duration * 60_000 && e > ms;
    }) ?? null
  );
}

/**
 * Free start times between `from` and `to` for a meeting of `duration` minutes.
 * Working hours are read in the host's own timezone, so a guest anywhere gets
 * the right instants (show them with the guest's local clock).
 */
export function getSlots({
  availability,
  timezone,
  busy,
  duration,
  from,
  to,
  now = new Date(),
}: {
  availability: DayHours[];
  timezone: string;
  busy: Busy[];
  duration: number;
  from: Date;
  to: Date;
  now?: Date;
}): Date[] {
  const step = duration <= 15 ? 15 : 30;
  const earliest = Math.max(from.getTime(), now.getTime());
  const slots: Date[] = [];

  // Walk the host's calendar days covering the range (one extra each side,
  // because the host's day can straddle the viewer's)
  const first = zonedParts(new Date(from.getTime() - 86_400_000), timezone);
  const last = zonedParts(new Date(to.getTime() + 86_400_000), timezone);
  let cursor = Date.UTC(first.y, first.m - 1, first.d);
  const end = Date.UTC(last.y, last.m - 1, last.d);

  for (; cursor <= end; cursor += 86_400_000) {
    const day = new Date(cursor);
    const hours = availability[day.getUTCDay()];
    if (!hours?.enabled) continue;
    const y = day.getUTCFullYear();
    const m = day.getUTCMonth() + 1;
    const d = day.getUTCDate();
    for (let t = toMinutes(hours.start); t + duration <= toMinutes(hours.end); t += step) {
      const s = zonedToUtc(y, m, d, t, timezone).getTime();
      const e = s + duration * 60_000;
      if (s <= earliest || s >= to.getTime()) continue;
      if (busy.some((b) => s < b.end && e > b.start)) continue;
      slots.push(new Date(s));
    }
  }
  return slots.sort((a, b) => a.getTime() - b.getTime());
}
