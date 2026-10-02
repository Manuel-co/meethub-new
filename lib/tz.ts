// Timezone maths with the built-in Intl API (no extra dependency).

type Parts = { y: number; m: number; d: number; h: number; mi: number };

const formatters = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Wall-clock date/time of an instant in `tz` */
export function zonedParts(date: Date, tz: string): Parts {
  const p: Record<string, number> = {};
  for (const { type, value } of fmt(tz).formatToParts(date)) {
    if (type !== "literal") p[type] = Number(value);
  }
  return { y: p.year, m: p.month, d: p.day, h: p.hour === 24 ? 0 : p.hour, mi: p.minute };
}

/** The instant when the wall clock in `tz` reads y-m-d + `minutes` past midnight */
export function zonedToUtc(y: number, m: number, d: number, minutes: number, tz: string): Date {
  const target = Date.UTC(y, m - 1, d, 0, minutes);
  let t = target;
  // two passes settle the offset, including around daylight-saving changes
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(t), tz);
    t += target - Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi);
  }
  return new Date(t);
}

export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** e.g. "Africa/Lagos" -> "Lagos" */
export const tzLabel = (tz: string) => tz.split("/").pop()!.replace(/_/g, " ");
