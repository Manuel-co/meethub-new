import type { DayHours, Meeting, User } from "./store";

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Mon–Fri, 9 to 5 */
export const DEFAULT_HOURS: DayHours[] = WEEKDAYS.map((_, i) => ({
  enabled: i >= 1 && i <= 5,
  start: "09:00",
  end: "17:00",
}));

export const DURATIONS = [15, 30, 45, 60, 90];

/** How far ahead guests can book */
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

const range = (m: Meeting) => {
  const s = new Date(m.start).getTime();
  return [s, s + m.duration * 60_000] as const;
};

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
      const [ms, me] = range(m);
      return s < me && e > ms;
    }) ?? null
  );
}

/**
 * Free start times on `day` for a meeting of `duration` minutes, based on the
 * host's weekly hours and existing meetings. Slots start every 15/30 min.
 */
export function getSlots(
  host: Pick<User, "availability">,
  day: Date,
  meetings: Meeting[],
  duration: number,
  now = new Date(),
): Date[] {
  const hours = host.availability[day.getDay()];
  if (!hours?.enabled) return [];

  const step = duration <= 15 ? 15 : 30;
  const open = toMinutes(hours.start);
  const close = toMinutes(hours.end);
  const slots: Date[] = [];

  for (let t = open; t + duration <= close; t += step) {
    const s = new Date(day);
    s.setHours(0, t, 0, 0);
    if (s.getTime() <= now.getTime()) continue;
    if (findConflict(meetings, s, duration)) continue;
    slots.push(s);
  }
  return slots;
}
