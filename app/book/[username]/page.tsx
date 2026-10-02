"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Clock, Globe, Loader2 } from "lucide-react";
import Logo from "@/components/app/Logo";
import ProfileAvatar from "@/components/app/ProfileAvatar";
import AddToCalendar from "@/components/app/AddToCalendar";
import { meetingUrl } from "@/lib/calendar";
import { bookMeeting, getBusyTimes, getHost, type Host } from "@/lib/store";
import { BOOKING_HORIZON_DAYS, getSlots, type Busy } from "@/lib/scheduling";
import { addDays, fmtDay, fmtDuration, fmtMonth, fmtTime, isSameDay, startOfDay } from "@/lib/format";
import { browserTimeZone } from "@/lib/tz";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEEK_HEAD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function BookingPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  // undefined = loading, null = not found
  const [host, setHost] = useState<Host | null | undefined>(undefined);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getHost(decodeURIComponent(username))
      .then((h) => !cancelled && setHost(h))
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : "Couldn't load this page."));
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (loadError) {
    return (
      <Shell>
        <p role="alert" className="max-w-md rounded-lg bg-clay/20 px-4 py-3 text-sm">{loadError}</p>
      </Shell>
    );
  }

  if (host === undefined) {
    return (
      <Shell>
        <Loader2 className="animate-spin text-stone" />
      </Shell>
    );
  }

  if (!host) {
    return (
      <Shell>
        <div className="flex max-w-md flex-col items-start gap-4">
          <h1 className="display text-4xl">This booking page doesn&apos;t exist.</h1>
          <p className="text-sm text-stone">Check the link and try again.</p>
          <Link href="/" className="pill bg-ink text-paper hover:bg-clay hover:text-ink">
            Go to MeetHub
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <Booker host={host} />
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

type Booked = { id: string; title: string; start: Date; duration: number };

function Booker({ host }: { host: Host }) {
  const [today] = useState(() => startOfDay(new Date()));
  const lastDay = addDays(today, BOOKING_HORIZON_DAYS);
  const duration = host.meetingLength;
  const guestTz = browserTimeZone();

  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [busy, setBusy] = useState<Busy[] | null>(null);
  const [picked, setPicked] = useState<Date | null>(null);
  const [slot, setSlot] = useState<Date | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState<Booked | null>(null);

  // The visible month, clipped to [today, horizon]
  const range = useMemo(() => {
    const horizonEnd = addDays(today, BOOKING_HORIZON_DAYS + 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    const from = month < today ? today : month;
    const to = monthEnd > horizonEnd ? horizonEnd : monthEnd;
    return { from, to };
  }, [month, today]);

  const loadBusy = useCallback(() => {
    let cancelled = false;
    getBusyTimes(host.id, range.from, range.to)
      .then((b) => !cancelled && setBusy(b))
      .catch(() => !cancelled && setError("Couldn't load available times. Please refresh."));
    return () => {
      cancelled = true;
    };
  }, [host.id, range]);

  useEffect(() => loadBusy(), [loadBusy]);

  // Free slots (computed in the host's timezone), grouped by the guest's local day
  const byDay = useMemo(() => {
    const map = new Map<string, Date[]>();
    if (!busy) return map;
    for (const s of getSlots({
      availability: host.availability,
      timezone: host.timezone,
      busy,
      duration,
      from: range.from,
      to: range.to,
    })) {
      const key = s.toDateString();
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return map;
  }, [busy, host.availability, host.timezone, duration, range]);

  const firstOpen = useMemo(() => {
    const first = [...byDay.keys()][0];
    return first ? new Date(first) : null;
  }, [byDay]);
  const day = picked && byDay.has(picked.toDateString()) ? picked : firstOpen;
  const slots = day ? byDay.get(day.toDateString()) ?? [] : [];

  const offset = (month.getDay() + 6) % 7; // Monday-first grid
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const canPrev = month > new Date(today.getFullYear(), today.getMonth(), 1);
  const canNext = new Date(month.getFullYear(), month.getMonth() + 1, 1) <= lastDay;

  function changeMonth(delta: number) {
    setBusy(null);
    setError("");
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!slot) return;
    if (name.trim().length < 2) return setError("Please enter your name.");
    if (!EMAIL_RE.test(email.trim())) return setError("Please enter a valid email address.");
    setError("");
    setSubmitting(true);
    const res = await bookMeeting(host.username, slot, {
      name: name.trim(),
      email: email.trim(),
      note: note.trim() || undefined,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      // The slot may have just been taken — refresh and send them back to pick
      if (/someone just booked|outside|passed/i.test(res.error)) {
        setSlot(null);
        loadBusy();
      }
      return;
    }
    setBooked({ id: res.data, title: host.bookingTitle, start: slot, duration });
  }

  /* ---- Confirmation ---- */
  if (booked) {
    return (
      <div className="panel flex w-full max-w-lg flex-col items-start gap-5 p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-lime">
          <Check size={22} />
        </span>
        <h1 className="display text-4xl">You&apos;re booked.</h1>
        <p className="text-[15px] text-stone">
          {`${host.name} can see this on their dashboard.`} Save the meeting link — you&apos;ll use it to
          join.
        </p>
        <div className="w-full rounded-2xl bg-paper p-5">
          <p className="text-lg tracking-[-0.02em]">{booked.title}</p>
          <p className="mt-1 text-sm text-stone">
            {fmtDay(booked.start)} · {fmtTime(booked.start)} · {fmtDuration(booked.duration)}
          </p>
          <p className="mt-3 break-all text-xs text-stone">{meetingUrl(booked.id)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AddToCalendar
            className="pill bg-ink px-5 py-3 text-paper hover:bg-clay hover:text-ink"
            event={{
              id: booked.id,
              title: `${booked.title} with ${host.name}`,
              description: note.trim() || undefined,
              start: booked.start,
              duration: booked.duration,
              url: meetingUrl(booked.id),
            }}
          />
          <Link href={`/meet/${booked.id}`} className="pill bg-paper px-5 py-3 text-ink hover:bg-lime">
            Meeting room
          </Link>
        </div>
        <button
          onClick={() => {
            setBooked(null);
            setSlot(null);
            setNote("");
            loadBusy();
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
        <ProfileAvatar name={host.name} avatar={host.avatar} size={56} />
        <div className="flex flex-col gap-1">
          <span className="text-sm text-stone">{host.name}</span>
          <h1 className="display text-3xl">{host.bookingTitle}</h1>
        </div>
        <ul className="flex flex-col gap-2 text-sm text-stone">
          <li className="flex items-center gap-2"><Clock size={14} /> {fmtDuration(duration)}</li>
          <li className="flex items-center gap-2" title="Times are shown in your timezone">
            <Globe size={14} /> {guestTz}
          </li>
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
              <input id="g-name" className="field" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={80} />
            </div>
            <div>
              <label htmlFor="g-email" className="label">Email</label>
              <input id="g-email" type="email" className="field" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
            </div>
          </div>
          <div>
            <label htmlFor="g-note" className="label">
              Anything to share beforehand? <span className="font-normal text-stone">(optional)</span>
            </label>
            <textarea id="g-note" rows={4} className="field resize-none" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
          </div>
          {error && <p role="alert" className="rounded-lg bg-clay/20 px-3 py-2 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="pill w-fit bg-ink px-6 py-3.5 text-paper hover:bg-clay hover:text-ink disabled:opacity-60"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
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
                  onClick={() => changeMonth(-1)}
                  disabled={!canPrev}
                  aria-label="Previous month"
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-paper disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => changeMonth(1)}
                  disabled={!canNext}
                  aria-label="Next month"
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-paper disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className={`grid grid-cols-7 gap-1 text-center transition-opacity ${busy ? "" : "opacity-40"}`}>
              {WEEK_HEAD.map((d) => (
                <span key={d} className="pb-2 text-xs text-stone">{d}</span>
              ))}
              {Array.from({ length: offset }).map((_, i) => (
                <span key={`pad-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const d = new Date(month.getFullYear(), month.getMonth(), i + 1);
                const open = byDay.has(d.toDateString());
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
            {busy && byDay.size === 0 && (
              <p className="text-sm text-stone">No open times this month. Try the next one.</p>
            )}
          </section>

          {/* ---- Slots ---- */}
          <section className="flex flex-col gap-4 p-6 sm:p-8 lg:col-span-3">
            <h2 className="text-sm text-stone">{day ? fmtDay(day) : busy ? "Pick a day" : "Loading…"}</h2>
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
