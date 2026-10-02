"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarPlus, ChevronDown } from "lucide-react";
import {
  downloadIcs,
  googleCalendarUrl,
  outlookCalendarUrl,
  type CalendarEvent,
} from "@/lib/calendar";

/** Dropdown with Google / Outlook links and an .ics download */
export default function AddToCalendar({
  event,
  className = "pill bg-white text-ink hover:bg-lime",
  align = "left",
}: {
  event: CalendarEvent;
  className?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const item = "block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-paper";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={className}
      >
        <CalendarPlus size={13} /> Add to calendar <ChevronDown size={12} />
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute z-30 mt-2 w-52 rounded-xl border border-line bg-white p-1.5 text-ink shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <a role="menuitem" href={googleCalendarUrl(event)} target="_blank" rel="noreferrer" className={item} onClick={() => setOpen(false)}>
            Google Calendar
          </a>
          <a role="menuitem" href={outlookCalendarUrl(event)} target="_blank" rel="noreferrer" className={item} onClick={() => setOpen(false)}>
            Outlook.com
          </a>
          <button
            role="menuitem"
            type="button"
            className={item}
            onClick={() => {
              downloadIcs(event);
              setOpen(false);
            }}
          >
            Apple / other (.ics)
          </button>
        </div>
      )}
    </div>
  );
}
