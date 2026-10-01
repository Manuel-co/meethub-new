"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Clock, Globe } from "lucide-react";
import Logo from "@/components/app/Logo";
import Avatar from "@/components/app/Avatar";
import { createMeeting, findUserByUsername, useDb, useHydrated, type Meeting } from "@/lib/store";
import { BOOKING_HORIZON_DAYS, getSlots } from "@/lib/scheduling";
import {
  addDays,
  fmtDay,
  fmtDuration,
  fmtMonth,
  fmtTime,
  isSameDay,
  startOfDay,
  timeZone,
} from "@/lib/format";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEEK_HEAD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function BookingPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const hydrated = useHydrated();
  const db = useDb();
  const host = findUserByUsername(db.users, decodeURIComponent(username));

  if (!hydrated) {
    return <Shell><p className="text-sm text-stone">Loading…</p></Shell>;
  }

  if (!host) {
    return (
      <Shell>
        <div className="flex max-w-md flex-col items-start gap-4">
          <h1 className="display text-4xl">This booking page doesn&apos;t exist.</h1>
          <p className="text-sm text-stone">
            Check the link and try again. (In this demo, accounts are stored in the browser,
            so booking links only work on the device where the account was created.)
          </p>
          <Link href="/" className="pill bg-ink text-paper hover:bg-clay hover:text-ink">
            Go to MeetHub
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <Booker
        host={host}
        meetings={db.meetings.filter((m) => m.hostId === host.id)}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100svh] w-full flex-col px-4 py-6 sm:px-8">
      <Logo />
      <main className="flex flex-1 items-start justify-center py-10 lg:items-center">{children}</main>
      <p className="text-center text-xs text-stone">
        Powered by <Link href="/" className="underline underline-offset-4">MeetHub</Link>
      </p>
    </div>
  );
}

type Host = NonNullable<ReturnType<typeof findUserByUsername>>;

function Booker({ host, meetings }: { host: Host; meetings: Meeting[] }) {
  const today = startOfDay(new Date());
  const lastDay = addDays(today, BOOKING_HORIZON_DAYS);
  const duration = host.meetingLength;

  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [picked, setPicked] = useState<Date | null>(null);
  const [slot, setSlot] = useState<Date | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [booked, setBooked] = useState<Meeting | null>(null);

  // Which days in the visible month have at least one free slot
  const openDays = useMemo(() => {
    const set = new Set<string>();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(month.getFullYear(), month.getMonth(), d);
      if (day < today || day > lastDay) continue;
      if (getSlots(host, day, meetings, duration).length) set.add(day.toDateString());
    }
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, host, meetings, duration]);

  // Default to the first open day in view
  const firstOpen = useMemo(() => {
    const first = [...openDays][0];
    return first ? new Date(first) : null;
  }, [openDays]);
  const day = picked && openDays.has(picked.toDateString()) ? picked : firstOpen;
  const slots = day ? getSlots(host, day, meetings, duration) : [];

  const offset = (month.getDay() + 6) % 7; // Monday-first grid
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const canPrev = month > new Date(today.getFullYear(), today.getMonth(), 1);
  const canNext = new Date(month.getFullYear(), month.getMonth() + 1, 1) <= lastDay;

  function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!slot) return;
    if (name.trim().length < 2) return setError("Please enter your name.");
    if (!EMAIL_RE.test(email.trim())) return setError("Please enter a valid email address.");
    // Re-check: someone may have taken the slot meanwhile
    if (!getSlots(host, startOfDay(slot), meetings, duration).some((s) => +s === +slot)) {
      setSlot(null);
      return setError("Sorry, that time was just taken. Please pick another.");
    }
    setBooked(
      createMeeting({
        hostId: host.id,
        title: host.bookingTitle,
        description: "",
        start: slot.toISOString(),
        duration,
        invitees: [email.trim().toLowerCase()],
        source: "booking",
        guest: { name: name.trim(), email: email.trim().toLowerCase(), note: note.trim() || undefined },
      }),
    );
  }

  /* ---- Confirmation ---- */
  if (booked) {
    const s = new Date(booked.start);
    return (
      <div className="panel flex w-full max-w-lg flex-col items-start gap-5 p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-lime">
          <Check size={22} />
        </span>
        <h1 className="display text-4xl">You&apos;re booked.</h1>
        <p className="text-[15px] text-stone">
          {host.name} will see this on their dashboard. A confirmation would be sent to{" "}
          <span className="text-ink">{booked.guest?.email}</span>.
        </p>
        <div className="w-full rounded-2xl bg-paper p-5">
          <p className="text-lg tracking-[-0.02em]">{booked.title}</p>
          <p className="mt-1 text-sm text-stone">
            {fmtDay(s)} · {fmtTime(s)} · {fmtDuration(booked.duration)}
          </p>
        </div>
        <button
          onClick={() => {
            setBooked(null);
            setSlot(null);
            setNote("");
          }}
          className="text-sm text-stone underline underline-offset-4 hover:text-ink"
        >
          Book another time
        </button>
      </div>
    );
  }

  return (
    <div className="panel grid w-full max-w-5xl grid-cols-1 overflow-hidden lg:grid-cols-12">
      {/* Host info */}
      <section className="flex flex-col gap-5 border-b border-line p-6 sm:p-8 lg:col-span-4 lg:border-b-0 lg:border-r">
        <Avatar name={host.name} size={48} />
        <div className="flex flex-col gap-1">
          <span className="text-sm text-stone">{host.name}</span>
          <h1 className="display text-3xl">{host.bookingTitle}</h1>
        </div>
        <ul className="flex flex-col gap-2 text-sm text-stone">
          <li className="flex items-center gap-2"><Clock size={14} /> {fmtDuration(duration)}</li>
          <li className="flex items-center gap-2"><Globe size={14} /> {timeZone()}</li>
        </ul>
        {host.bookingMessage && <p className="text-[15px] leading-relaxed">{host.bookingMessage}</p>}
        {slot && (
          <div className="mt-auto rounded-2xl bg-lime p-4 text-sm">
            <p className="font-medium">{fmtDay(slot)}</p>
            <p>{fmtTime(slot)} – {fmtTime(new Date(+slot + duration * 60_000))}</p>
          </div>
        )}
      </section>

      {slot ? (
        /* ---- Details form ---- */
        <form onSubmit={confirm} className="flex flex-col gap-5 p-6 sm:p-8 lg:col-span-8" noValidate>
          <button
            type="button"
            onClick={() => {
              setSlot(null);
              setError("");
            }}
            className="flex w-fit items-center gap-1.5 text-sm text-stone hover:text-ink"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <h2 className="text-2xl tracking-[-0.03em]">Your details</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="g-name" className="label">Name</label>
              <input id="g-name" className="field" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div>
              <label htmlFor="g-email" className="label">Email</label>
              <input id="g-email" type="email" className="field" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="g-note" className="label">
              Anything to share beforehand? <span className="font-normal text-stone">(optional)</span>
            </label>
            <textarea id="g-note" rows={4} className="field resize-none" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && <p role="alert" className="rounded-lg bg-clay/20 px-3 py-2 text-sm">{error}</p>}
          <button type="submit" className="pill w-fit bg-ink px-6 py-3.5 text-paper hover:bg-clay hover:text-ink">
            Confirm booking
          </button>
        </form>
      ) : (
        <>
          {/* ---- Calendar ---- */}
          <section className="flex flex-col gap-4 border-b border-line p-6 sm:p-8 lg:col-span-5 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between">
              <h2 className="text-lg tracking-[-0.02em]">{fmtMonth(month)}</h2>
              <div className="flex gap-1">
                <button
                  onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                  disabled={!canPrev}
                  aria-label="Previous month"
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-paper disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                  disabled={!canNext}
                  aria-label="Next month"
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-paper disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEK_HEAD.map((d) => (
                <span key={d} className="pb-2 text-xs text-stone">{d}</span>
              ))}
              {Array.from({ length: offset }).map((_, i) => (
                <span key={`pad-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const d = new Date(month.getFullYear(), month.getMonth(), i + 1);
                const open = openDays.has(d.toDateString());
                const selected = day && isSameDay(d, day);
                return (
                  <button
                    key={i}
                    disabled={!open}
                    onClick={() => {
                      setPicked(d);
                      setError("");
                    }}
                    aria-pressed={!!selected}
                    aria-label={fmtDay(d)}
                    className={`relative mx-auto flex aspect-square w-full max-w-11 items-center justify-center rounded-full text-sm transition-colors ${
                      selected
                        ? "bg-ink text-paper"
                        : open
                          ? "bg-paper font-medium hover:bg-lime"
                          : "text-stone/50"
                    }`}
                  >
                    {i + 1}
                    {isSameDay(d, today) && !selected && (
                      <span className="absolute bottom-1 h-1 w-1 rounded-full bg-clay" />
                    )}
                  </button>
                );
              })}
            </div>
            {openDays.size === 0 && (
              <p className="text-sm text-stone">No open times this month. Try the next one.</p>
            )}
          </section>

          {/* ---- Slots ---- */}
          <section className="flex flex-col gap-4 p-6 sm:p-8 lg:col-span-3">
            <h2 className="text-sm text-stone">{day ? fmtDay(day) : "Pick a day"}</h2>
            {error && <p role="alert" className="rounded-lg bg-clay/20 px-3 py-2 text-sm">{error}</p>}
            <div className="flex max-h-[22rem] flex-col gap-2 overflow-y-auto pr-1">
              {slots.map((s) => (
                <button
                  key={+s}
                  onClick={() => {
                    setSlot(s);
                    setError("");
                  }}
                  className="rounded-xl border border-line py-3 text-sm transition-colors hover:border-ink hover:bg-ink hover:text-paper"
                >
                  {fmtTime(s)}
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
