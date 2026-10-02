// The picture shown when someone's camera is off.
// Either a DiceBear avatar (random by default) or an uploaded photo.
// Saved in localStorage and shared with the call as a participant attribute:
// for DiceBear only the style + seed are sent, and everyone draws it locally.
import { createAvatar, type Style } from "@dicebear/core";
import { glass, lorelei, notionists, openPeeps, pixelArt, thumbs } from "@dicebear/collection";

// Only MIT-licensed DiceBear styles, so no attribution is required.
// (Other styles are CC BY 4.0 and would need a credit on the site.)
export const AVATAR_STYLES = {
  notionists: { label: "Notionists", style: notionists, pickable: true },
  lorelei: { label: "Lorelei", style: lorelei, pickable: true },
  openPeeps: { label: "Open Peeps", style: openPeeps, pickable: true },
  thumbs: { label: "Thumbs", style: thumbs, pickable: true },
  pixelArt: { label: "Pixel art", style: pixelArt, pickable: true },
  // Looks like an empty bubble at small sizes — still drawn for anyone who
  // already has it, but no longer offered or picked at random
  glass: { label: "Glass", style: glass, pickable: false },
} as const;

export type AvatarStyleId = keyof typeof AVATAR_STYLES;

/** Styles offered in the picker and used for random avatars */
export const PICKABLE_STYLES = (Object.keys(AVATAR_STYLES) as AvatarStyleId[]).filter(
  (id) => AVATAR_STYLES[id].pickable,
);

export type AvatarSpec =
  | { kind: "dicebear"; style: AvatarStyleId; seed: string }
  | { kind: "photo"; src: string };

const KEY = "meethub:avatar";
// Participant attributes are small; keep photos to a few KB
const MAX_PHOTO_CHARS = 16_000;
// Background colours from the site palette (DiceBear picks one per seed)
const BACKGROUNDS = ["e8e47a", "ef8f63", "c7d5bb", "bcd7ea", "d5c8ec", "e7d3b5"];

const isStyle = (s: unknown): s is AvatarStyleId =>
  typeof s === "string" && Object.hasOwn(AVATAR_STYLES, s);

export const randomSeed = () => crypto.randomUUID().slice(0, 12);

export function randomAvatar(style?: AvatarStyleId): AvatarSpec {
  return {
    kind: "dicebear",
    style: style ?? PICKABLE_STYLES[Math.floor(Math.random() * PICKABLE_STYLES.length)],
    seed: randomSeed(),
  };
}

/** Validate anything that came from storage or another participant */
export function parseAvatar(raw: string | null | undefined): AvatarSpec | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v?.kind === "dicebear" && isStyle(v.style) && typeof v.seed === "string" && v.seed.length <= 64) {
      return { kind: "dicebear", style: v.style, seed: v.seed };
    }
    if (
      v?.kind === "photo" &&
      typeof v.src === "string" &&
      v.src.startsWith("data:image/jpeg;base64,") &&
      v.src.length <= MAX_PHOTO_CHARS
    ) {
      return { kind: "photo", src: v.src };
    }
  } catch {}
  return null;
}

export const encodeAvatar = (a: AvatarSpec) => JSON.stringify(a);

/** Saved avatar, or a fresh random one (saved so it stays the same next time) */
export function loadAvatar(): AvatarSpec {
  try {
    const saved = parseAvatar(localStorage.getItem(KEY));
    if (saved) return saved;
  } catch {}
  const fresh = randomAvatar();
  saveAvatar(fresh);
  return fresh;
}

export function saveAvatar(a: AvatarSpec) {
  try {
    localStorage.setItem(KEY, encodeAvatar(a));
  } catch {}
}

// Drawing an SVG is cheap but not free; tiles re-render often
const cache = new Map<string, string>();

/** Image URL for any avatar spec */
export function avatarSrc(a: AvatarSpec): string {
  if (a.kind === "photo") return a.src;
  const key = `${a.style}:${a.seed}`;
  let uri = cache.get(key);
  if (!uri) {
    // Each style has its own option types; we only pass shared options
    uri = createAvatar(AVATAR_STYLES[a.style].style as unknown as Style<object>, {
      seed: a.seed,
      backgroundColor: BACKGROUNDS,
      radius: 50,
    }).toDataUri();
    if (cache.size > 200) cache.clear();
    cache.set(key, uri);
  }
  return uri;
}

/** Centre-crop and shrink an image file to a small square JPEG data URL */
export async function photoFromFile(file: File, size = 96): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("That image couldn't be opened."));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    canvas
      .getContext("2d")!
      .drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    // step quality down until it fits
    for (const q of [0.82, 0.7, 0.55, 0.4]) {
      const data = canvas.toDataURL("image/jpeg", q);
      if (data.length <= MAX_PHOTO_CHARS) return data;
    }
    throw new Error("That image is too detailed. Try a different photo.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
