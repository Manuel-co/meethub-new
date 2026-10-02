"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowUpRight, CalendarPlus, Clock, Link2, Loader2, Mail, Users, Video, X, Zap } from "lucide-react";
import Avatar from "@/components/app/Avatar";
import AddToCalendar from "@/components/app/AddToCalendar";
import { meetingUrl } from "@/lib/calendar";
import CopyButton from "@/components/app/CopyButton";
import { useNow } from "@/components/app/useNow";
import { ACCESS_OPTIONS } from "@/components/app/AccessPicker";
import {
  cancelMeeting,
  createInstantMeeting,
  setMeetingAccess,
  useCurrentUser,
  useMyMeetings,
  type Meeting,
} from "@/lib/store";
import { addDays, dayLabel, fmtDuration, fmtTime, fromNow, startOfDay } from "@/lib/format";

const endOf = (m: Meeting) => new Date(new Date(m.start).getTime() + m.duration * 60_000);

function greeting(d: Date) {
  const h = d.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const user = useCurrentUser()!; // guarded by layout
  const all = useMyMeetings();
  const now = useNow();
  const [showPast, setShowPast] = useState(false);
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");

  // Instant meeting: create it now and go straight into the room
  async function startNow() {
    setStarting(true);
    setStartError("");
    const res = await createInstantMeeting(user.name);
    if (!res.ok) {
      setStarting(false);
      setStartError(`Couldn't start a meeting: ${res.error}`);
      return;
    }
    router.push(`/meet/${res.data.id}`);
  }

  const { upcoming, past, thisWeek, booked, groups } = useMemo(() => {
    const active = all
      .filter((m) => m.status === "scheduled")
      .sort((a, b) => +new Date(a.start) - +new Date(b.start));
    const upcoming = active.filter((m) => endOf(m) > now);
    const past = active.filter((m) => endOf(m) <= now).reverse();
    const weekEnd = addDays(startOfDay(now), 7);
    const thisWeek = upcoming.filter((m) => new Date(m.start) < weekEnd).length;
    const booked = upcoming.filter((m) => m.source === "booking").length;

    const groups = new Map<string, Meeting[]>();
    for (const m of upcoming) {
      const key = startOfDay(new Date(m.start)).toISOString();
      groups.set(key, [...(groups.get(key) ?? []), m]);
    }
    return { upcoming, past, thisWeek, booked, groups: [...groups.entries()] };
  }, [all, now]);

  const next = upcoming[0];
  const bookingUrl = `${window.location.origin}/book/${user.username}`;

  function onCancel(m: Meeting) {
    if (!window.confirm(`Cancel "${m.title}"?`)) return;
    cancelMeeting(m.id).then((res) => {
      if (!res.ok) window.alert(`Couldn't cancel the meeting: ${res.error}`);
    });
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <span className="text-sm text-stone">
            {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
          </span>
          <h1 className="display text-[clamp(2.2rem,4vw,3.4rem)]">
            {greeting(now)}, {user.name.split(" ")[0]}.
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={startNow}
            disabled={starting}
            className="pill bg-lime px-5 py-3 text-ink hover:bg-ink hover:text-paper disabled:opacity-60"
          >
            {starting ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            Start meeting now
          </button>
          <Link
            href="/dashboard/schedule"
            className="pill bg-ink px-5 py-3 text-paper hover:bg-clay hover:text-ink"
          >
            <CalendarPlus size={14} /> Schedule meeting
          </Link>
        </div>
      </header>
      {startError && (
        <p role="alert" className="-mt-6 rounded-lg bg-clay/20 px-3 py-2 text-sm">
          {startError}
        </p>
      )}

      {/* Stats */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Upcoming", value: upcoming.length, tone: "bg-white" },
          { label: "Next 7 days", value: thisWeek, tone: "bg-sage" },
          { label: "Booked via your link", value: booked, tone: "bg-lime" },
        ].map((s) => (
          <div key={s.label} className={`flex flex-col gap-6 rounded-[1.25rem] p-5 ${s.tone}`}>
            <span className="text-sm">{s.label}</span>
            <span className="display text-5xl">{s.value}</span>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Upcoming list */}
        <section className="flex flex-col gap-6 lg:col-span-8">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl tracking-[-0.03em]">Upcoming</h2>
            <span className="text-sm text-stone">{upcoming.length} meetings</span>
          </div>

          {groups.length === 0 ? (
            <div className="panel flex flex-col items-start gap-4 p-8">
              <p className="display text-2xl">Nothing on the calendar yet.</p>
              <p className="text-sm text-stone">
                Schedule a meeting yourself, or share your booking link and let people pick a time.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/dashboard/schedule" className="pill bg-ink text-paper hover:bg-clay hover:text-ink">
                  Schedule meeting
                </Link>
                <CopyButton text={bookingUrl} className="pill bg-paper text-ink hover:bg-lime" />
              </div>
            </div>
          ) : (
            groups.map(([day, meetings]) => (
              <div key={day} className="flex flex-col gap-2">
                <h3 className="text-sm text-stone">{dayLabel(new Date(day), now)}</h3>
                <ul className="flex flex-col gap-2">
                  {meetings.map((m) => (
                    <MeetingRow
                      key={m.id}
                      m={m}
                      now={now}
                      onCancel={m.hostId === user.id ? () => onCancel(m) : undefined}
                      isHost={m.hostId === user.id}
                    />
                  ))}
                </ul>
              </div>
            ))
          )}

          {past.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-line pt-6">
              <button
                onClick={() => setShowPast((s) => !s)}
                className="w-fit text-sm text-stone hover:text-ink"
              >
                {showPast ? "Hide" : "Show"} past meetings ({past.length})
              </button>
              {showPast && (
                <ul className="flex flex-col gap-2 opacity-70">
                  {past.slice(0, 10).map((m) => (
                    <MeetingRow key={m.id} m={m} now={now} past />
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* Side column */}
        <aside className="flex flex-col gap-4 lg:col-span-4">
          {/* Next up */}
          <div className="flex flex-col gap-5 rounded-[1.25rem] bg-ink p-6 text-paper">
            <span className="chip w-fit bg-lime text-ink">
              <Clock size={12} /> Next up
            </span>
            {next ? (
              <>
                <div className="flex flex-col gap-1">
                  <p className="display text-3xl">{next.title}</p>
                  <p className="text-sm text-paper/70">
                    {dayLabel(new Date(next.start), now)} · {fmtTime(new Date(next.start))}–
                    {fmtTime(endOf(next))}
                  </p>
                </div>
                <p className="display text-5xl text-lime">
                  {new Date(next.start) <= now ? "Now" : fromNow(new Date(next.start), now)}
                </p>
                <Attendees m={next} dark />
                <Link
                  href={`/meet/${next.id}`}
                  className="pill w-fit bg-lime px-5 py-3 text-ink hover:bg-paper"
                >
                  <Video size={14} /> Join room
                </Link>
              </>
            ) : (
              <p className="text-sm text-paper/70">You&apos;re all clear. Enjoy the quiet.</p>
            )}
          </div>

          {/* Booking link */}
          <div className="flex flex-col gap-4 rounded-[1.25rem] bg-clay p-6">
            <span className="flex items-center gap-2 text-sm">
              <Link2 size={14} /> Your booking link
            </span>
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
            <Link href="/dashboard/availability" className="text-xs underline underline-offset-4">
              Edit availability
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Attendees({ m, dark }: { m: Meeting; dark?: boolean }) {
  const people = m.guest ? [m.guest.name] : m.invitees;
  if (people.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {people.slice(0, 3).map((p) => (
          <span key={p} className={`rounded-full ring-2 ${dark ? "ring-ink" : "ring-white"}`}>
            <Avatar name={p} size={26} />
          </span>
        ))}
      </div>
      <span className={`truncate text-xs ${dark ? "text-paper/70" : "text-stone"}`}>
        {people.length === 1 ? people[0] : `${people.length} people`}
      </span>
    </div>
  );
}

function MeetingRow({
  m,
  now,
  past,
  onCancel,
  isHost = false,
}: {
  m: Meeting;
  now: Date;
  past?: boolean;
  onCancel?: () => void;
  isHost?: boolean;
}) {
  const start = new Date(m.start);
  const live = !past && start <= now;
  const access = ACCESS_OPTIONS.find((o) => o.value === m.access) ?? ACCESS_OPTIONS[0];
  const AccessIcon = access.icon;

  function toggleAccess() {
    const next = m.access === "invite_only" ? "anyone_with_link" : "invite_only";
    setMeetingAccess(m.id, next).then((res) => {
      if (!res.ok) window.alert(res.error);
    });
  }
  return (
    <li className="panel group flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
      <div className="flex w-28 shrink-0 flex-col">
        <span className="text-lg tracking-[-0.02em]">{fmtTime(start)}</span>
        <span className="text-xs text-stone">{fmtDuration(m.duration)}</span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium">{m.title}</p>
          {live && <span className="chip bg-clay text-ink">Live</span>}
          {m.source === "booking" && <span className="chip bg-lime text-ink">Booked</span>}
          {isHost && !past ? (
            <button
              type="button"
              onClick={toggleAccess}
              title={`${access.description} Click to switch.`}
              className="chip bg-paper text-ink transition-colors hover:bg-paper-deep"
            >
              <AccessIcon size={11} /> {access.short}
            </button>
          ) : (
            <span className="chip bg-paper text-stone" title={access.description}>
              <AccessIcon size={11} /> {access.short}
            </span>
          )}
        </div>
        {m.guest ? (
          <p className="flex items-center gap-1.5 truncate text-sm text-stone">
            <Mail size={12} /> {m.guest.name} · {m.guest.email}
          </p>
        ) : m.invitees.length > 0 ? (
          <p className="flex items-center gap-1.5 truncate text-sm text-stone">
            <Users size={12} /> {m.invitees.join(", ")}
          </p>
        ) : null}
        {(m.guest?.note || m.description) && (
          <p className="line-clamp-1 text-sm text-stone">{m.guest?.note || m.description}</p>
        )}
      </div>

      {!past && (
        <div className="flex items-center gap-3 self-start sm:self-center">
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex items-center gap-1 text-xs text-stone transition-colors hover:text-ink sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
            >
              <X size={13} /> Cancel
            </button>
          )}
          <AddToCalendar
            align="right"
            className="pill bg-paper text-ink hover:bg-lime"
            event={{
              id: m.id,
              title: m.title,
              description: m.description,
              start,
              duration: m.duration,
              url: meetingUrl(m.id),
            }}
          />
          <Link
            href={`/meet/${m.id}`}
            className={`pill ${live ? "bg-clay text-ink hover:bg-ink hover:text-paper" : "bg-paper text-ink hover:bg-lime"}`}
          >
            <Video size={13} /> Join
          </Link>
        </div>
      )}
    </li>
  );
}
