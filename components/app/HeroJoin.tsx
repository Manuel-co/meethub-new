"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, Video } from "lucide-react";
import JoinWithCode from "@/components/app/JoinWithCode";
import { useNow } from "@/components/app/useNow";
import { meetingHref } from "@/lib/meetingCode";
import { dayLabel, fmtTime } from "@/lib/format";
import { useAuth, useMyMeetings } from "@/lib/store";

/**
 * Under the hero buttons. Signed in: your next meetings, one click to join
 * (no code needed). Everyone: the "enter a code" box.
 */
export default function HeroJoin() {
  const { user } = useAuth();
  const meetings = useMyMeetings();
  const now = useNow();

  const next = useMemo(
    () =>
      meetings
        .filter((m) => m.status === "scheduled")
        .filter((m) => new Date(m.start).getTime() + m.duration * 60_000 > now.getTime())
        .sort((a, b) => +new Date(a.start) - +new Date(b.start))
        .slice(0, 3),
    [meetings, now],
  );

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      {user && next.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-left">
          {next.map((m) => {
            const start = new Date(m.start);
            const live = start <= now;
            return (
              <li key={m.id}>
                <Link
                  href={meetingHref(m)}
                  className="group flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5 transition-colors hover:bg-lime"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      live ? "bg-clay" : "bg-paper"
                    }`}
                  >
                    <Video size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{m.title}</span>
                    <span className="block text-xs text-stone">
                      {live ? "Happening now" : `${dayLabel(start, now)} · ${fmtTime(start)}`}
                      {m.hostId === user.id ? " · You're the host" : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-1 text-xs font-medium">
                    {m.hostId === user.id ? "Start" : "Join"}
                    <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <JoinWithCode />
    </div>
  );
}
