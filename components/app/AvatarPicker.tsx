"use client";

import { useRef, useState } from "react";
import { ImagePlus, Shuffle, Trash2 } from "lucide-react";
import ProfileAvatar from "@/components/app/ProfileAvatar";
import {
  AVATAR_STYLES,
  PICKABLE_STYLES,
  photoFromFile,
  randomAvatar,
  randomSeed,
  type AvatarSpec,
  type AvatarStyleId,
} from "@/lib/avatar";

/** Shuffle a random DiceBear avatar, pick its style, or upload a photo */
export default function AvatarPicker({
  name,
  value,
  onChange,
  tone = "dark",
}: {
  name: string;
  value: AvatarSpec;
  onChange: (a: AvatarSpec) => void;
  /** dark = meeting screens, light = dashboard */
  tone?: "dark" | "light";
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  // Keep the last DiceBear seed around so switching back from a photo restores it
  const [lastSeed, setLastSeed] = useState(value.kind === "dicebear" ? value.seed : randomSeed());
  const seed = value.kind === "dicebear" ? value.seed : lastSeed;
  const style: AvatarStyleId = value.kind === "dicebear" ? value.style : "notionists";

  const dark = tone === "dark";
  const secondary = dark ? "pill bg-paper/10 text-paper hover:bg-paper/20" : "pill bg-paper text-ink hover:bg-paper-deep";
  const primary = dark ? "pill bg-lime text-ink hover:bg-paper" : "pill bg-ink text-paper hover:bg-clay hover:text-ink";

  function pick(next: AvatarSpec) {
    if (next.kind === "dicebear") setLastSeed(next.seed);
    onChange(next);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    setError("");
    try {
      onChange({ kind: "photo", src: await photoFromFile(file) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That image couldn't be used.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <ProfileAvatar name={name || "?"} avatar={value} size={72} />
        <div className="flex flex-wrap gap-2">
          {value.kind === "dicebear" ? (
            <button type="button" onClick={() => pick(randomAvatar(style))} className={primary}>
              <Shuffle size={13} /> Shuffle
            </button>
          ) : (
            <button type="button" onClick={() => pick({ kind: "dicebear", style, seed })} className={secondary}>
              <Trash2 size={13} /> Remove photo
            </button>
          )}
          <button type="button" onClick={() => fileRef.current?.click()} className={secondary}>
            <ImagePlus size={13} /> {value.kind === "photo" ? "Change photo" : "Use a photo"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        </div>
      </div>

      {error && <p className={`text-xs ${dark ? "text-clay" : "text-ink"}`}>{error}</p>}

      {/* Same seed in every style, so you can compare looks */}
      <div className="grid max-w-sm grid-cols-6 gap-2" role="radiogroup" aria-label="Avatar style">
        {PICKABLE_STYLES.map((id) => {
          const selected = value.kind === "dicebear" && value.style === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={AVATAR_STYLES[id].label}
              title={AVATAR_STYLES[id].label}
              onClick={() => pick({ kind: "dicebear", style: id, seed })}
              className={`rounded-full p-0.5 transition-transform hover:scale-105 ${
                selected
                  ? dark ? "ring-2 ring-lime" : "ring-2 ring-ink"
                  : dark ? "ring-1 ring-paper/15" : "ring-1 ring-line"
              }`}
            >
              <ProfileAvatar name={name} avatar={{ kind: "dicebear", style: id, seed }} size={44} className="!h-auto !w-full" />
            </button>
          );
        })}
      </div>
      <p className={`text-[11px] ${dark ? "text-paper/40" : "text-stone"}`}>
        Avatars by{" "}
        <a href="https://www.dicebear.com" target="_blank" rel="noreferrer" className="underline underline-offset-2">
          DiceBear
        </a>
      </p>
    </div>
  );
}
