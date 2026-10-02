"use client";

import { Link2, Lock } from "lucide-react";
import type { MeetingAccess } from "@/lib/store";

export const ACCESS_OPTIONS: {
  value: MeetingAccess;
  label: string;
  short: string;
  description: string;
  icon: typeof Lock;
}[] = [
  {
    value: "anyone_with_link",
    label: "Anyone with the link",
    short: "Anyone with link",
    description: "People you invited join directly. Anyone else can ask, and waits for you to let them in.",
    icon: Link2,
  },
  {
    value: "invite_only",
    label: "Invite only",
    short: "Invite only",
    description: "Only people you invited can join, logged in with the invited email. Nobody else can ask.",
    icon: Lock,
  },
];

/** Radio cards for choosing who can join a meeting */
export default function AccessPicker({
  value,
  onChange,
}: {
  value: MeetingAccess;
  onChange: (v: MeetingAccess) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Who can join" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {ACCESS_OPTIONS.map((o) => {
        const selected = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`flex flex-col items-start gap-1.5 rounded-xl border p-3.5 text-left transition-colors ${
              selected ? "border-ink bg-ink text-paper" : "border-line bg-white hover:border-ink"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Icon size={14} /> {o.label}
            </span>
            <span className={`text-xs leading-relaxed ${selected ? "text-paper/70" : "text-stone"}`}>
              {o.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
