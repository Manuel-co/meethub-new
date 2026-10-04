"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download, MessageSquare, Play, Trash2, Video, X } from "lucide-react";
import Avatar from "@/components/app/Avatar";
import { useNow } from "@/components/app/useNow";
import {
  loadMeetingExtras,
  useCurrentUser,
  useMyMeetings,
  type Attendance,
  type ChatMessage,
  type Meeting,
} from "@/lib/store";
import {
  deleteRecording,
  fmtBytes,
  fmtClock,
  urlFor,
  useRecordings,
  type Recording,
} from "@/lib/recordings";
import { meetingHref } from "@/lib/meetingCode";
import { dayLabel, fmtDuration, fmtTime, startOfDay } from "@/lib/format";

type Filter = "all" | "attended" | "recorded";

export default function HistoryPage() {
  const user = useCurrentUser()!;
  const meetings = useMyMeetings();
  const { recordings, error } = useRecordings(user.id);
  const now = useNow(60_000);
  const [filter, setFilter] = useState<Filter>("all");
  const [playing, setPlaying] = useState<Recording | null>(null);
  const [openChat, setOpenChat] = useState<string | null>(null);
  const [extras, setExtras] = useState<{ messages: ChatMessage[]; attendance: Attendance[] }>({
    messages: [],
    attendance: [],
  });

  // Chat transcripts + attendance for meetings that have started
  const startedIds = meetings
    .filter((m) => m.status === "scheduled" && new Date(m.start) <= now)
    .map((m) => m.id)
    .join(",");
  useEffect(() => {
    let cancelled = false;
    loadMeetingExtras(startedIds ? startedIds.split(",") : [])
      .then((x) => !cancelled && setExtras(x))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [startedIds]);

  const attendance = (m: Meeting) => attendanceFor(extras.attendance, m, user.id, now);
  const attendedBy = (m: Meeting) => !!attendance(m);

  const byMeeting = useMemo(() => {
    const map = new Map<string, Recording[]>();
    for (const r of recordings ?? []) map.set(r.meetingId, [...(map.get(r.meetingId) ?? []), r]);
    return map;
  }, [recordings]);

  // Past = ended, or anything you actually joined (even if it's still running)
  const past = useMemo(() => {
    return meetings
      .filter((m) => m.status === "scheduled")
      .filter((m) => {
        const end = new Date(m.start).getTime() + m.duration * 60_000;
        const joined = extras.attendance.some((a) => a.meetingId === m.id && a.userId === user.id);
        return end <= now.getTime() || joined || byMeeting.has(m.id);
      })
      .sort((a, b) => +new Date(b.start) - +new Date(a.start));
  }, [meetings, now, user.id, byMeeting, extras.attendance]);

  const shown = past.filter((m) =>
    filter === "attended" ? attendedBy(m) : filter === "recorded" ? byMeeting.has(m.id) : true,
  );

  const groups = useMemo(() => {
    const g = new Map<string, Meeting[]>();
    for (const m of shown) {
      const k = startOfDay(new Date(m.start)).toISOString();
      g.set(k, [...(g.get(k) ?? []), m]);
    }
    return [...g.entries()];
  }, [shown]);

  const totalSize = (recordings ?? []).reduce((n, r) => n + r.size, 0);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <span className="text-sm text-stone">History</span>
          <h1 className="display text-[clamp(2.2rem,4vw,3.4rem)]">Past meetings</h1>
          <p className="max-w-lg text-[15px] text-stone">
            Meetings you hosted or attended, with their chat and any recordings you made.
          </p>
        </div>
        <div className="flex gap-1 rounded-full bg-white p-1">
          {(["all", "attended", "recorded"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-2 text-sm capitalize transition-colors ${
                filter === f ? "bg-ink text-paper" : "hover:bg-paper"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Past meetings" value={past.length} tone="bg-white" />
        <Stat label="Attended" value={past.filter((m) => attendedBy(m)).length} tone="bg-sage" />
        <Stat
          label={`Recordings${totalSize ? ` · ${fmtBytes(totalSize)}` : ""}`}
          value={recordings?.length ?? "–"}
          tone="bg-lime"
        />
      </section>

      {error && <p className="rounded-lg bg-clay/20 px-3 py-2 text-sm">{error}</p>}

      {groups.length === 0 ? (
        <div className="panel flex flex-col items-start gap-3 p-8">
          <p className="display text-2xl">
            {filter === "recorded" ? "No recordings yet." : "No past meetings yet."}
          </p>
          <p className="text-sm text-stone">
            Join a meeting from your dashboard. Hit record in the room and it&apos;ll show up here.
          </p>
          <Link href="/dashboard" className="pill bg-ink text-paper hover:bg-clay hover:text-ink">
            Go to dashboard
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map(([day, list]) => (
            <div key={day} className="flex flex-col gap-2">
              <h2 className="text-sm text-stone">{dayLabel(new Date(day), now)}</h2>
              <ul className="flex flex-col gap-2">
                {list.map((m) => {
                  const recs = byMeeting.get(m.id) ?? [];
                  const mine = attendance(m);
                  const chat = extras.messages.filter((c) => c.meetingId === m.id);
                  return (
                    <li key={m.id} className="panel flex flex-col gap-4 p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
                        <div className="flex w-28 shrink-0 flex-col">
                          <span className="text-lg tracking-[-0.02em]">{fmtTime(new Date(m.start))}</span>
                          {(() => {
                            const lasted = actualLength(extras.attendance, m);
                            return lasted !== null ? (
                              <>
                                <span className="text-xs text-ink" title="From the first person joining to the last one leaving">
                                  Lasted {lasted < 1 ? "under 1 min" : fmtDuration(lasted)}
                                </span>
                                <span className="text-xs text-stone">Scheduled {fmtDuration(m.duration)}</span>
                              </>
                            ) : (
                              <span className="text-xs text-stone">{fmtDuration(m.duration)}</span>
                            );
                          })()}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{m.title}</p>
                            {m.hostId === user.id ? (
                              <span className="chip bg-paper text-ink">Host</span>
                            ) : (
                              <span className="chip bg-paper text-ink">Guest</span>
                            )}
                            {mine ? (
                              <span className="chip bg-sage text-ink">
                                Attended{mine.minutes ? ` · ${fmtDuration(mine.minutes)}` : ""}
                              </span>
                            ) : (
                              <span className="chip bg-paper-deep text-stone">Not joined</span>
                            )}
                          </div>
                          <p className="truncate text-sm text-stone">
                            {m.guest ? `${m.guest.name} · ${m.guest.email}` : m.invitees.join(", ") || "No invitees"}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {chat.length > 0 && (
                            <button
                              onClick={() => setOpenChat(openChat === m.id ? null : m.id)}
                              className="pill bg-paper text-ink hover:bg-paper-deep"
                            >
                              <MessageSquare size={13} /> Chat ({chat.length})
                            </button>
                          )}
                          <Link href={meetingHref(m)} className="pill bg-paper text-ink hover:bg-lime">
                            <Video size={13} /> Reopen room
                          </Link>
                        </div>
                      </div>

                      {openChat === m.id && (
                        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto rounded-xl bg-paper p-4">
                          {chat.map((c) => (
                            <div key={c.id} className="flex gap-2 text-sm">
                              <Avatar name={c.senderName} size={24} />
                              <div className="min-w-0">
                                <span className="text-xs text-stone">
                                  {c.senderName} · {fmtTime(new Date(c.sentAt))}
                                </span>
                                <p className="whitespace-pre-wrap break-words">{c.body}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {recs.length > 0 && (
                        <ul className="flex flex-col gap-2 border-t border-line pt-4">
                          {recs.map((r) => (
                            <li key={r.id} className="flex flex-wrap items-center gap-3">
                              <button
                                onClick={() => setPlaying(r)}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-paper hover:bg-clay hover:text-ink"
                                aria-label="Play recording"
                              >
                                <Play size={14} fill="currentColor" />
                              </button>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm">Recording · {fmtClock(r.duration)}</p>
                                <p className="text-xs text-stone">
                                  {fmtTime(new Date(r.createdAt))} · {fmtBytes(r.size)}
                                </p>
                              </div>
                              <DownloadLink rec={r} />
                              <button
                                onClick={() => window.confirm("Delete this recording? This can't be undone.") && deleteRecording(r.id)}
                                className="flex h-9 w-9 items-center justify-center rounded-full text-stone hover:bg-paper hover:text-ink"
                                aria-label="Delete recording"
                              >
                                <Trash2 size={15} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {playing && <Player rec={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}

/**
 * How long the call actually ran, in minutes: first join → last "present
 * until" time across everyone we can see (hosts see all attendees; invitees
 * only themselves). Null if nobody's attendance was recorded.
 */
function actualLength(all: Attendance[], m: Meeting) {
  const rows = all.filter((a) => a.meetingId === m.id);
  if (!rows.length) return null;
  const start = Math.min(...rows.map((a) => new Date(a.joinedAt).getTime()));
  const end = Math.max(...rows.map((a) => new Date(a.leftAt ?? a.joinedAt).getTime()));
  return Math.round((end - start) / 60_000);
}

/** How long `userId` spent in meeting `m`, or null if they never joined */
function attendanceFor(all: Attendance[], m: Meeting, userId: string, now: Date) {
  const mine = all.filter((a) => a.meetingId === m.id && a.userId === userId);
  if (!mine.length) return null;
  // "left" is refreshed every 30s during the call, so if it's missing they
  // were only there for a few seconds — unless they're in the call right now
  const ms = mine.reduce((n, a) => {
    const joined = new Date(a.joinedAt).getTime();
    const left = a.leftAt ? new Date(a.leftAt).getTime() : joined;
    return n + Math.max(0, Math.min(left, now.getTime()) - joined);
  }, 0);
  return { minutes: Math.round(ms / 60_000) };
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className={`flex flex-col gap-6 rounded-[1.25rem] p-5 ${tone}`}>
      <span className="text-sm">{label}</span>
      <span className="display text-5xl">{value}</span>
    </div>
  );
}

function DownloadLink({ rec }: { rec: Recording }) {
  const url = urlFor(rec.blob);
  const ext = rec.mimeType.includes("mp4") ? "mp4" : "webm";
  const name = `${rec.meetingTitle.replace(/[^\w-]+/g, "-")}-${rec.createdAt.slice(0, 10)}.${ext}`;
  return (
    <a
      href={url}
      download={name}
      className="flex h-9 w-9 items-center justify-center rounded-full text-stone hover:bg-paper hover:text-ink"
      aria-label="Download recording"
    >
      <Download size={15} />
    </a>
  );
}

function Player({ rec, onClose }: { rec: Recording; onClose: () => void }) {
  const url = urlFor(rec.blob);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Recording of ${rec.meetingTitle}`}
    >
      <div className="flex w-full max-w-4xl flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between text-paper">
          <p className="text-sm">
            {rec.meetingTitle} · {fmtClock(rec.duration)}
          </p>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-paper/10">
            <X size={18} />
          </button>
        </div>
        <video src={url} controls autoPlay className="w-full rounded-[1.25rem] bg-black" />
      </div>
    </div>
  );
}
