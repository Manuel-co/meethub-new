export const fmtTime = (d: Date) =>
  d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export const fmtDay = (d: Date) =>
  d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

export const fmtShortDay = (d: Date) =>
  d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

export const fmtMonth = (d: Date) =>
  d.toLocaleDateString([], { month: "long", year: "numeric" });

/** "13:30" -> "1:30 PM" in the user's locale */
export function fmtHHMM(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return fmtTime(d);
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export function dayLabel(d: Date, now = new Date()) {
  if (isSameDay(d, now)) return "Today";
  if (isSameDay(d, addDays(now, 1))) return "Tomorrow";
  if (isSameDay(d, addDays(now, -1))) return "Yesterday";
  return fmtDay(d);
}

export function fromNow(d: Date, now = new Date()) {
  const mins = Math.round((d.getTime() - now.getTime()) / 60_000);
  if (mins <= 0) return "now";
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `in ${h}h${mins % 60 ? ` ${mins % 60}m` : ""}`;
  const days = Math.round(h / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

export function fmtDuration(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return mins % 60 ? `${h} h ${mins % 60} min` : `${h} h`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Date -> "yyyy-mm-dd" in local time (for <input type="date">) */
export function toDateInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "yyyy-mm-dd" + "HH:MM" -> local Date */
export function fromInputs(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(y, m - 1, d, h, min);
}

export const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
