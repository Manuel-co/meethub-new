"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, Check, Clock, X } from "lucide-react";
import AddToCalendar from "@/components/app/AddToCalendar";
import CopyButton from "@/components/app/CopyButton";
import { meetingUrl } from "@/lib/calendar";
import { createMeeting, useCurrentUser, useMeetings, type Meeting } from "@/lib/store";
import { DURATIONS, busyFromMeetings, findConflict, getSlots } from "@/lib/scheduling";
import {
  addDays,
  dayLabel,
  fmtDuration,
  fmtTime,
  fromInputs,
  timeZone,
  toDateInput,
} from "@/lib/format";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SchedulePage() {
  const user = useCurrentUser()!;
  const meetings = useMeetings(user.id);
  const today = toDateInput(new Date());

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(toDateInput(addDays(new Date(), 1)));
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(30);
  const [invitees, setInvitees] = useState<string[]>([]);
  const [inviteDraft, setInviteDraft] = useState("");
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Meeting | null>(null);

  const start = date && time ? fromInputs(date, time) : null;
  const conflict = start ? findConflict(meetings, start, duration) : null;

  const [saving, setSaving] = useState(false);

  // Suggestions from your weekly hours (in your profile's timezone), shown on this device's clock
  const freeSlots = useMemo(() => {
    if (!date) return [];
    const from = fromInputs(date, "00:00");
    return getSlots({
      availability: user.availability,
      timezone: user.timezone,
      busy: busyFromMeetings(meetings),
      duration,
      from,
      to: addDays(from, 1),
    });
  }, [user.availability, user.timezone, date, meetings, duration]);

  function addInvitee(raw: string) {
    const emails = raw
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const bad = emails.find((e) => !EMAIL_RE.test(e));
    if (bad) {
      setError(`"${bad}" doesn't look like an email address.`);
      return;
    }
    setError("");
    setInvitees((list) => [...new Set([...list, ...emails])]);
    setInviteDraft("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Give your meeting a title.");
    if (!start) return setError("Pick a date and time.");
    if (start < new Date()) return setError("That time is in the past.");

    // Include any half-typed email
    let list = invitees;
    if (inviteDraft.trim()) {
      const extra = inviteDraft.trim().toLowerCase();
      if (!EMAIL_RE.test(extra)) return setError(`"${extra}" doesn't look like an email address.`);
      list = [...new Set([...invitees, extra])];
    }

    setSaving(true);
    const res = await createMeeting({
      title: title.trim(),
      description: description.trim(),
      start: start.toISOString(),
      duration,
      invitees: list,
    });
    setSaving(false);
    if (!res.ok) return setError(`Couldn't save the meeting: ${res.error}`);
    setCreated(res.data);
  }

  function reset() {
    setCreated(null);
    setTitle("");
    setDescription("");
    setInvitees([]);
    setInviteDraft("");
    setError("");
  }

  if (created) {
    const s = new Date(created.start);
    return (
      <div className="mx-auto flex max-w-xl flex-col items-start gap-6 py-10">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-lime">
          <Check size={22} />
        </span>
        <h1 className="display text-[clamp(2.2rem,4vw,3.2rem)]">Meeting scheduled.</h1>
        <div className="panel w-full p-6">
          <p className="text-xl tracking-[-0.02em]">{created.title}</p>
          <p className="mt-1 text-sm text-stone">
            {dayLabel(s)} · {fmtTime(s)} · {fmtDuration(created.duration)}
          </p>
          {created.invitees.length > 0 && (
            <p className="mt-3 text-sm text-stone">Invites: {created.invitees.join(", ")}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <span className="min-w-0 flex-1 truncate text-sm text-stone">{meetingUrl(created.id)}</span>
            <CopyButton text={meetingUrl(created.id)} label="Copy meeting link" />
          </div>
        </div>
        <p className="text-sm text-stone">
          Send the meeting link to your invitees — they can join without an account.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard" className="pill bg-ink px-5 py-3 text-paper hover:bg-clay hover:text-ink">
            Back to dashboard
          </Link>
          <AddToCalendar
            className="pill bg-white px-5 py-3 text-ink hover:bg-lime"
            event={{
              id: created.id,
              title: created.title,
              description: created.description,
              start: s,
              duration: created.duration,
              url: meetingUrl(created.id),
            }}
          />
          <button onClick={reset} className="pill bg-white px-5 py-3 text-ink hover:bg-lime">
            Schedule another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      <header className="flex flex-col gap-2">
        <span className="text-sm text-stone">Schedule</span>
        <h1 className="display text-[clamp(2.2rem,4vw,3.4rem)]">New meeting</h1>
      </header>

      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-8 lg:grid-cols-12" noValidate>
        {/* Main fields */}
        <div className="panel flex flex-col gap-5 p-6 sm:p-8 lg:col-span-7">
          <div>
            <label htmlFor="title" className="label">Title</label>
            <input
              id="title"
              className="field"
              placeholder="e.g. Design review"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="desc" className="label">
              Description <span className="font-normal text-stone">(optional)</span>
            </label>
            <textarea
              id="desc"
              rows={3}
              className="field resize-none"
              placeholder="What's this meeting about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="date" className="label">Date</label>
              <input
                id="date"
                type="date"
                min={today}
                className="field"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="time" className="label">Start time</label>
              <input
                id="time"
                type="time"
                step={900}
                className="field"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <span className="label">Duration</span>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                    duration === d
                      ? "border-ink bg-ink text-paper"
                      : "border-line bg-white text-ink hover:border-ink"
                  }`}
                >
                  {fmtDuration(d)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="invite" className="label">Invite people</label>
            <div className="field flex min-h-12 flex-wrap items-center gap-1.5 !py-2 focus-within:border-ink">
              {invitees.map((e) => (
                <span key={e} className="chip bg-paper text-ink">
                  {e}
                  <button
                    type="button"
                    onClick={() => setInvitees((l) => l.filter((x) => x !== e))}
                    aria-label={`Remove ${e}`}
                    className="text-stone hover:text-ink"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <input
                id="invite"
                className="min-w-40 flex-1 bg-transparent py-1 outline-none placeholder:text-stone/70"
                placeholder={invitees.length ? "Add another…" : "name@company.com, press Enter"}
                value={inviteDraft}
                onChange={(e) => {
                  setInviteDraft(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (["Enter", ",", " "].includes(e.key) && inviteDraft.trim()) {
                    e.preventDefault();
                    addInvitee(inviteDraft);
                  } else if (e.key === "Backspace" && !inviteDraft && invitees.length) {
                    setInvitees((l) => l.slice(0, -1));
                  }
                }}
                onBlur={() => inviteDraft.trim() && addInvitee(inviteDraft)}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-clay/20 px-3 py-2 text-sm">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="pill bg-ink px-6 py-3.5 text-paper hover:bg-clay hover:text-ink disabled:opacity-60"
            >
              {saving ? "Saving…" : "Schedule meeting"}
            </button>
            <Link href="/dashboard" className="text-sm text-stone hover:text-ink">
              Cancel
            </Link>
          </div>
        </div>

        {/* Helper column */}
        <aside className="flex flex-col gap-4 lg:col-span-5">
          {/* Summary */}
          <div className="flex flex-col gap-3 rounded-[1.25rem] bg-ink p-6 text-paper">
            <span className="chip w-fit bg-lime text-ink">Summary</span>
            <p className="display text-3xl">{title.trim() || "Untitled meeting"}</p>
            <p className="text-sm text-paper/70">
              {start
                ? `${dayLabel(start)} · ${fmtTime(start)} – ${fmtTime(
                    new Date(start.getTime() + duration * 60_000),
                  )}`
                : "Pick a date and time"}
            </p>
            <p className="text-xs text-paper/50">Times shown in {timeZone()}</p>
          </div>

          {conflict && (
            <div className="flex gap-3 rounded-[1.25rem] bg-clay/30 p-5 text-sm">
              <AlertTriangle size={18} className="shrink-0" />
              <p>
                This overlaps <strong className="font-medium">{conflict.title}</strong> at{" "}
                {fmtTime(new Date(conflict.start))}. You can still schedule it.
              </p>
            </div>
          )}

          {/* Free slots */}
          <div className="panel flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm">
                <Clock size={14} /> Free in your working hours
              </span>
              <Link href="/dashboard/availability" className="text-xs text-stone underline underline-offset-4 hover:text-ink">
                Edit hours
              </Link>
            </div>
            {freeSlots.length === 0 ? (
              <p className="text-sm text-stone">
                No free {fmtDuration(duration)} slots on this day within your working hours.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {freeSlots.slice(0, 18).map((s) => {
                  const v = `${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setTime(v)}
                      className={`rounded-lg border px-2 py-2 text-sm transition-colors ${
                        time === v ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"
                      }`}
                    >
                      {fmtTime(s)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </form>
    </div>
  );
}
