"use client";

import { useState } from "react";
import { Dialog } from "radix-ui";
import { BellOff, AppWindow, EyeOff, MonitorUp, Volume2, X } from "lucide-react";
import ProfileAvatar from "@/components/app/ProfileAvatar";
import type { AvatarSpec } from "@/lib/avatar";

export type Viewer = { id: string; name: string; avatar: AvatarSpec | null };

/**
 * Asks before screen sharing starts: who will see it, a quick privacy
 * checklist, and whether to include sound. Built on Radix Dialog for focus
 * trapping, Escape-to-close and screen-reader labelling.
 */
export default function ShareScreenDialog({
  open,
  onOpenChange,
  viewers,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** everyone else in the call */
  viewers: Viewer[];
  onConfirm: (opts: { audio: boolean }) => void;
}) {
  const [audio, setAudio] = useState(true);
  const shown = viewers.slice(0, 5);
  const extra = viewers.length - shown.length;

  const tips = [
    { icon: EyeOff, text: "Close private tabs, emails and documents first." },
    { icon: BellOff, text: "Silence notifications so pop-ups don't appear on screen." },
    { icon: AppWindow, text: "Only showing one thing? Pick a single window or tab, not your whole screen." },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-[1.5rem] bg-paper text-ink shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          {/* Illustration: a screen beaming out to people */}
          <div className="relative flex h-36 shrink-0 items-center justify-center overflow-hidden rounded-t-[1.5rem] bg-ink">
            <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_50%_60%,var(--color-lime),transparent_60%)]" />
            <div className="relative flex h-20 w-32 items-center justify-center rounded-lg border-2 border-paper/80 bg-paper/10">
              <MonitorUp size={30} className="text-lime" />
              <span className="absolute -bottom-3 left-1/2 h-3 w-10 -translate-x-1/2 rounded-b-md bg-paper/80" />
            </div>
            <span className="absolute left-[18%] top-1/2 h-1.5 w-1.5 animate-ping rounded-full bg-lime" />
            <span className="absolute right-[18%] top-[38%] h-1.5 w-1.5 animate-ping rounded-full bg-clay [animation-delay:400ms]" />
            <Dialog.Close
              aria-label="Close"
              className="absolute right-3 top-3 rounded-full p-1.5 text-paper/70 transition-colors hover:bg-paper/10 hover:text-paper"
            >
              <X size={16} />
            </Dialog.Close>
          </div>

          <div className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-1.5">
              <Dialog.Title className="display text-3xl">Share your screen?</Dialog.Title>
              <Dialog.Description className="text-sm text-stone">
                Everything in what you choose to share will be visible to everyone in the call
                until you stop.
              </Dialog.Description>
            </div>

            {/* Who will see it */}
            <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3">
              {viewers.length > 0 ? (
                <>
                  <div className="flex -space-x-2">
                    {shown.map((v) => (
                      <span key={v.id} className="rounded-full ring-2 ring-white">
                        <ProfileAvatar name={v.name} avatar={v.avatar} size={28} />
                      </span>
                    ))}
                    {extra > 0 && (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-paper-deep text-[10px] font-semibold ring-2 ring-white">
                        +{extra}
                      </span>
                    )}
                  </div>
                  <p className="text-sm">
                    <span className="font-medium">
                      {viewers.length === 1 ? viewers[0].name || "1 person" : `${viewers.length} people`}
                    </span>{" "}
                    will see your screen
                  </p>
                </>
              ) : (
                <p className="text-sm text-stone">
                  No one else is here yet — anyone who joins will see your screen.
                </p>
              )}
            </div>

            {/* Quick checklist */}
            <ul className="flex flex-col gap-2.5">
              {tips.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage">
                    <Icon size={13} />
                  </span>
                  <span className="pt-0.5">{text}</span>
                </li>
              ))}
            </ul>

            {/* Sound toggle */}
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-line px-4 py-3">
              <span className="flex items-center gap-3">
                <Volume2 size={16} />
                <span className="flex flex-col">
                  <span className="text-sm font-medium">Share sound too</span>
                  <span className="text-xs text-stone">For videos and music. Works best with a tab.</span>
                </span>
              </span>
              <input
                type="checkbox"
                className="peer sr-only"
                checked={audio}
                onChange={(e) => setAudio(e.target.checked)}
              />
              <span className="relative h-6 w-10 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-ink peer-focus-visible:ring-2 peer-focus-visible:ring-lime after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
            </label>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close className="pill justify-center bg-white px-5 py-3 text-ink hover:bg-paper-deep">
                Cancel
              </Dialog.Close>
              <button
                type="button"
                autoFocus
                onClick={() => onConfirm({ audio })}
                className="pill justify-center bg-ink px-5 py-3 text-paper hover:bg-clay hover:text-ink"
              >
                <MonitorUp size={14} /> Start sharing
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
