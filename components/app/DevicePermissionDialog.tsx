"use client";

import { Dialog } from "radix-ui";
import { Lock, Mic, RefreshCw, ShieldCheck, Video, X } from "lucide-react";

export type DeviceAsk = "camera" | "microphone" | "both";

/**
 * Our own explanation around the browser's camera/microphone permission.
 * Browsers don't let sites restyle their permission prompt, so:
 *   mode="ask"     — shown before the browser asks, so people know why
 *   mode="blocked" — shown when access was denied, with steps to unblock
 */
export default function DevicePermissionDialog({
  open,
  onOpenChange,
  mode,
  devices,
  onAllow,
  onSkip,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "ask" | "blocked";
  devices: DeviceAsk;
  /** ask: trigger the browser prompt · blocked: try again */
  onAllow: () => void;
  /** continue without camera/mic */
  onSkip: () => void;
}) {
  const what =
    devices === "both" ? "camera and microphone" : devices === "camera" ? "camera" : "microphone";
  const blocked = mode === "blocked";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-[1.5rem] bg-paper text-ink shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
          {/* Illustration: the devices, locked or ready */}
          <div className={`relative flex h-36 shrink-0 items-center justify-center gap-4 overflow-hidden rounded-t-[1.5rem] ${blocked ? "bg-clay" : "bg-ink"}`}>
            {!blocked && (
              <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_50%_60%,var(--color-lime),transparent_60%)]" />
            )}
            {devices !== "microphone" && (
              <span className={`relative flex h-16 w-16 items-center justify-center rounded-2xl ${blocked ? "bg-ink text-paper" : "bg-paper text-ink"}`}>
                <Video size={28} />
                {blocked && <Lock size={16} className="absolute -bottom-1.5 -right-1.5 rounded-full bg-clay p-0.5 text-ink" />}
              </span>
            )}
            {devices !== "camera" && (
              <span className={`relative flex h-16 w-16 items-center justify-center rounded-2xl ${blocked ? "bg-ink text-paper" : "bg-lime text-ink"}`}>
                <Mic size={28} />
                {blocked && <Lock size={16} className="absolute -bottom-1.5 -right-1.5 rounded-full bg-clay p-0.5 text-ink" />}
              </span>
            )}
            <Dialog.Close
              aria-label="Close"
              className={`absolute right-3 top-3 rounded-full p-1.5 transition-colors ${blocked ? "text-ink/70 hover:bg-ink/10 hover:text-ink" : "text-paper/70 hover:bg-paper/10 hover:text-paper"}`}
            >
              <X size={16} />
            </Dialog.Close>
          </div>

          <div className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-1.5">
              <Dialog.Title className="display text-3xl">
                {blocked ? `Your ${what} ${devices === "both" ? "are" : "is"} blocked` : `Use your ${what}?`}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-stone">
                {blocked
                  ? `This browser isn't letting MeetHub use your ${what}. You can still join and be seen by your avatar.`
                  : `So others can see and hear you. Your browser will ask next — choose “Allow”.`}
              </Dialog.Description>
            </div>

            {blocked ? (
              <ol className="flex flex-col gap-3 text-sm">
                {[
                  <>Click the <strong className="font-medium">lock or camera icon</strong> at the left of the address bar.</>,
                  <>Set <strong className="font-medium">Camera</strong> and <strong className="font-medium">Microphone</strong> to <strong className="font-medium">Allow</strong>.</>,
                  <>Still blocked? On Windows, open <strong className="font-medium">Settings → Privacy &amp; security → Camera / Microphone</strong> and turn on access for apps.</>,
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-paper">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3 text-sm">
                <ShieldCheck size={18} className="mt-0.5 shrink-0" />
                <span>
                  You stay in control: turn them off any time with the buttons at the bottom of the call.
                  Nothing is recorded unless someone presses Record.
                </span>
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onSkip}
                className="pill justify-center bg-white px-5 py-3 text-ink hover:bg-paper-deep"
              >
                Continue without
              </button>
              <button
                type="button"
                autoFocus
                onClick={onAllow}
                className="pill justify-center bg-ink px-5 py-3 text-paper hover:bg-clay hover:text-ink"
              >
                {blocked ? (
                  <>
                    <RefreshCw size={14} /> Try again
                  </>
                ) : (
                  "Allow"
                )}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
