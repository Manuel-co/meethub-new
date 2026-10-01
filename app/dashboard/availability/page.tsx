"use client";

import { useState } from "react";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import CopyButton from "@/components/app/CopyButton";
import { updateUser, useCurrentUser, type DayHours } from "@/lib/store";
import { DURATIONS, WEEKDAYS, timeOptions, toMinutes } from "@/lib/scheduling";
import { fmtDuration, fmtHHMM, timeZone } from "@/lib/format";

const TIMES = timeOptions(30);
// Show Monday first
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function AvailabilityPage() {
  const user = useCurrentUser()!;
  const [hours, setHours] = useState<DayHours[]>(user.availability);
  const [meetingLength, setMeetingLength] = useState(user.meetingLength);
  const [bookingTitle, setBookingTitle] = useState(user.bookingTitle);
  const [bookingMessage, setBookingMessage] = useState(user.bookingMessage);
  const [saved, setSaved] = useState(false);

  const invalidDays = hours
    .map((h, i) => (h.enabled && toMinutes(h.end) <= toMinutes(h.start) ? i : -1))
    .filter((i) => i >= 0);
  const noneEnabled = hours.every((h) => !h.enabled);

  const dirty =
    JSON.stringify(hours) !== JSON.stringify(user.availability) ||
    meetingLength !== user.meetingLength ||
    bookingTitle !== user.bookingTitle ||
    bookingMessage !== user.bookingMessage;

  function setDay(i: number, patch: Partial<DayHours>) {
    setSaved(false);
    setHours((h) => h.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  }

  function copyToWeekdays(i: number) {
    setSaved(false);
    setHours((h) => h.map((d, j) => (j >= 1 && j <= 5 ? { ...h[i], enabled: true } : d)));
  }

  function onSave() {
    if (invalidDays.length) return;
    updateUser(user.id, {
      availability: hours,
      meetingLength,
      bookingTitle: bookingTitle.trim() || "Meeting",
      bookingMessage: bookingMessage.trim(),
    });
    setSaved(true);
  }

  const bookingUrl = `${window.location.origin}/book/${user.username}`;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 pb-24">
      <header className="flex flex-col gap-2">
        <span className="text-sm text-stone">Scheduling</span>
        <h1 className="display text-[clamp(2.2rem,4vw,3.4rem)]">Availability</h1>
        <p className="max-w-lg text-[15px] text-stone">
          Set when people can book time with you. Your booking page only offers slots inside
          these hours that don&apos;t clash with existing meetings.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Weekly hours */}
        <section className="panel flex flex-col p-2 sm:p-4 lg:col-span-7">
          <div className="flex items-baseline justify-between px-3 pb-2 pt-3">
            <h2 className="text-xl tracking-[-0.02em]">Weekly hours</h2>
            <span className="text-xs text-stone">{timeZone()}</span>
          </div>
          <ul>
            {ORDER.map((i) => {
              const d = hours[i];
              const bad = invalidDays.includes(i);
              return (
                <li
                  key={i}
                  className="flex flex-col gap-3 border-t border-line px-3 py-4 first:border-t-0 sm:flex-row sm:items-center"
                >
                  <label className="flex w-40 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={d.enabled}
                      onChange={(e) => setDay(i, { enabled: e.target.checked })}
                    />
                    <span className="relative h-6 w-10 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-ink peer-focus-visible:ring-2 peer-focus-visible:ring-lime after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
                    <span className="text-sm font-medium">{WEEKDAYS[i]}</span>
                  </label>

                  {d.enabled ? (
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                      <select
                        aria-label={`${WEEKDAYS[i]} start`}
                        className="field !w-auto !py-2"
                        value={d.start}
                        onChange={(e) => setDay(i, { start: e.target.value })}
                      >
                        {TIMES.map((t) => (
                          <option key={t} value={t}>{fmtHHMM(t)}</option>
                        ))}
                      </select>
                      <span className="text-stone">–</span>
                      <select
                        aria-label={`${WEEKDAYS[i]} end`}
                        className={`field !w-auto !py-2 ${bad ? "!border-clay" : ""}`}
                        value={d.end}
                        onChange={(e) => setDay(i, { end: e.target.value })}
                      >
                        {TIMES.map((t) => (
                          <option key={t} value={t}>{fmtHHMM(t)}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => copyToWeekdays(i)}
                        className="ml-auto flex items-center gap-1 whitespace-nowrap rounded-full p-1.5 text-xs text-stone hover:bg-paper hover:text-ink"
                        title="Apply these hours to Monday–Friday"
                        aria-label={`Copy ${WEEKDAYS[i]} hours to weekdays`}
                      >
                        <Copy size={13} /> <span className="hidden 2xl:inline">Weekdays</span>
                      </button>
                      {bad && <p className="w-full text-xs text-ink">End time must be after start time.</p>}
                    </div>
                  ) : (
                    <span className="text-sm text-stone">Unavailable</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Booking settings */}
        <aside className="flex flex-col gap-4 lg:col-span-5">
          <div className="panel flex flex-col gap-5 p-6">
            <h2 className="text-xl tracking-[-0.02em]">Booking page</h2>
            <div>
              <label htmlFor="btitle" className="label">Meeting name</label>
              <input
                id="btitle"
                className="field"
                value={bookingTitle}
                onChange={(e) => {
                  setSaved(false);
                  setBookingTitle(e.target.value);
                }}
              />
            </div>
            <div>
              <span className="label">Meeting length</span>
              <div className="flex flex-wrap gap-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setSaved(false);
                      setMeetingLength(d);
                    }}
                    className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                      meetingLength === d
                        ? "border-ink bg-ink text-paper"
                        : "border-line bg-white hover:border-ink"
                    }`}
                  >
                    {fmtDuration(d)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="bmsg" className="label">Welcome message</label>
              <textarea
                id="bmsg"
                rows={3}
                className="field resize-none"
                value={bookingMessage}
                onChange={(e) => {
                  setSaved(false);
                  setBookingMessage(e.target.value);
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-[1.25rem] bg-clay p-6">
            <span className="text-sm">Your booking link</span>
            <p className="break-all text-lg tracking-[-0.02em]">
              {bookingUrl.replace(/^https?:\/\//, "")}
            </p>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={bookingUrl} />
              <a
                href={`/book/${user.username}`}
                target="_blank"
                rel="noreferrer"
                className="pill bg-paper text-ink hover:bg-white"
              >
                Preview <ArrowUpRight size={13} />
              </a>
            </div>
          </div>
        </aside>
      </div>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/90 backdrop-blur md:left-64">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-8 lg:px-12">
          <p className="text-sm text-stone">
            {noneEnabled
              ? "No days enabled — nobody can book you."
              : saved
                ? "All changes saved."
                : dirty
                  ? "You have unsaved changes."
                  : "Up to date."}
          </p>
          <button
            onClick={onSave}
            disabled={!dirty || invalidDays.length > 0}
            className="pill bg-ink px-5 py-3 text-paper hover:bg-clay hover:text-ink disabled:pointer-events-none disabled:opacity-40"
          >
            {saved && !dirty ? <Check size={13} /> : null}
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
