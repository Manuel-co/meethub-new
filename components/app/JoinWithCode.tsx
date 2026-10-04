"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, Keyboard, Loader2 } from "lucide-react";
import { hrefForPath, meetingPathFromInput } from "@/lib/meetingCode";

/** "Enter a code or link" → go to that meeting (its own rules decide who gets in) */
export default function JoinWithCode({ tone = "light" }: { tone?: "light" | "dark" }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  // stays true until the meeting page has loaded
  const [pending, startTransition] = useTransition();
  const dark = tone === "dark";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const path = meetingPathFromInput(value);
    if (!path) {
      setError("That doesn't look like a meeting code. Codes look like abc-def-ghi.");
      return;
    }
    startTransition(() => router.push(hrefForPath(path)));
  }

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-1.5" noValidate>
      <div
        className={`flex items-center gap-2 rounded-full border py-1 pl-4 pr-1 transition-colors focus-within:ring-2 ${
          dark
            ? "border-paper/20 bg-paper/5 text-paper focus-within:border-paper/50 focus-within:ring-lime/40"
            : "border-line bg-white text-ink focus-within:border-ink focus-within:ring-lime/60"
        }`}
      >
        <Keyboard size={16} className={dark ? "shrink-0 text-paper/60" : "shrink-0 text-stone"} />
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
          placeholder="Enter a code, e.g. abc-def-ghi"
          aria-label="Meeting code or link"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={`min-w-0 flex-1 bg-transparent py-2 text-sm outline-none ${
            dark ? "placeholder:text-paper/40" : "placeholder:text-stone/70"
          }`}
        />
        <button
          type="submit"
          disabled={!value.trim() || pending}
          className={`pill shrink-0 px-4 py-2.5 disabled:opacity-40 ${
            dark ? "bg-paper text-ink hover:bg-lime" : "bg-ink text-paper hover:bg-clay hover:text-ink"
          }`}
        >
          {pending ? "Joining" : "Join"}{" "}
          {pending ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
        </button>
      </div>
      {error && (
        <p role="alert" className={`px-4 text-xs ${dark ? "text-clay" : "text-ink"}`}>
          {error}
        </p>
      )}
    </form>
  );
}
