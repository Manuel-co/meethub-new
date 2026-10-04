// "Add to calendar" links and .ics files. No accounts or services needed:
// Google/Outlook take a pre-filled URL, everything else imports the .ics file.
import { hrefForPath, meetingHref } from "./meetingCode";

export type CalendarEvent = {
  id: string;
  title: string;
  description?: string;
  start: Date;
  /** minutes */
  duration: number;
  /** where to join, e.g. the meeting room URL */
  url: string;
};

const end = (e: CalendarEvent) => new Date(e.start.getTime() + e.duration * 60_000);

/** 2026-10-02T13:00:00.000Z -> 20261002T130000Z */
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const details = (e: CalendarEvent) =>
  [e.description, `Join: ${e.url}`].filter(Boolean).join("\n\n");

export function googleCalendarUrl(e: CalendarEvent) {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${utcStamp(e.start)}/${utcStamp(end(e))}`,
    details: details(e),
    location: e.url,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

export function outlookCalendarUrl(e: CalendarEvent) {
  const p = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: e.title,
    startdt: e.start.toISOString(),
    enddt: end(e).toISOString(),
    body: details(e),
    location: e.url,
  });
  return `https://outlook.live.com/calendar/0/action/compose?${p}`;
}

/** RFC 5545 text escaping + 75-octet line folding */
const esc = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fold = (line: string) => line.match(/.{1,73}/g)!.join("\r\n ");

export function icsFile(e: CalendarEvent) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MeetHub//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.id}@meethub`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(e.start)}`,
    `DTEND:${utcStamp(end(e))}`,
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc(details(e))}`,
    `LOCATION:${esc(e.url)}`,
    `URL:${e.url}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT10M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(e.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function downloadIcs(e: CalendarEvent) {
  const blob = new Blob([icsFile(e)], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${e.title.replace(/[^\w-]+/g, "-").toLowerCase() || "meeting"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Shareable link for a meeting — e.g. https://site/abc-def-ghi when it has a code */
export const meetingUrl = (m: string | { id: string; code?: string | null }) =>
  `${window.location.origin}${typeof m === "string" ? hrefForPath(m) : meetingHref(m)}`;
