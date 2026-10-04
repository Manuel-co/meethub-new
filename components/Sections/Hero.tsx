import Image from "next/image";
import { ArrowDown } from "lucide-react";
import { avatarSrc, type AvatarStyleId } from "@/lib/avatar";
import HeroJoin from "@/components/app/HeroJoin";

/**
 * What fills the image tiles: "avatars" (DiceBear, same as in meetings) or
 * "photos" (the stock images in /public). Flip this to compare.
 */
const HERO_IMAGES: "avatars" | "photos" = "avatars";

type Tile = {
  // position as % of the hero box, size in px
  top: string;
  left: string;
  w: number;
  h: number;
  src?: string;
  /** avatar shown instead of `src` when HERO_IMAGES = "avatars" */
  avatar?: { style: AvatarStyleId; seed: string };
  /** only shown in avatar mode (extra people to fill the scene) */
  avatarOnly?: boolean;
  /** avatar motion: which wandering loop, and how long one loop takes (s) */
  drift?: "a" | "b" | "c";
  speed?: number;
  color?: string;
  opacity?: number;
  delay?: string;
  mobile?: boolean;
};

const DRIFT = { a: "animate-drift-a", b: "animate-drift-b", c: "animate-drift-c" } as const;

// Scattered "moodboard" tiles around the headline. Avatars stay around the
// edges (the headline owns the middle) and each wanders on its own loop.
const tiles: Tile[] = [
  // people (photos in "photos" mode, avatars in "avatars" mode)
  { top: "12%", left: "16%", w: 92, h: 124, src: "/heromale.png", avatar: { style: "notionists", seed: "kofi" }, drift: "a", speed: 13, mobile: true },
  { top: "9%", left: "70%", w: 110, h: 140, src: "/Features1.png", avatar: { style: "lorelei", seed: "amara" }, drift: "b", speed: 15, mobile: true },
  { top: "34%", left: "86%", w: 96, h: 130, src: "/herofemale.png", avatar: { style: "openPeeps", seed: "zara" }, drift: "c", speed: 11 },
  { top: "62%", left: "12%", w: 84, h: 110, src: "/testimonal-img.png", avatar: { style: "notionists", seed: "joanna" }, drift: "b", speed: 14 },
  { top: "74%", left: "76%", w: 100, h: 74, src: "/Features1.png", avatar: { style: "openPeeps", seed: "hiro" }, drift: "a", speed: 12, opacity: 0.85, mobile: true },
  { top: "84%", left: "48%", w: 48, h: 64, src: "/herofemale.png", avatar: { style: "lorelei", seed: "ben" }, drift: "c", speed: 9, opacity: 0.6 },

  // extra people, avatar mode only
  { top: "6%", left: "36%", w: 70, h: 82, avatar: { style: "openPeeps", seed: "chen" }, avatarOnly: true, drift: "c", speed: 12 },
  { top: "18%", left: "88%", w: 64, h: 74, avatar: { style: "notionists", seed: "elena" }, avatarOnly: true, drift: "a", speed: 16 },
  { top: "44%", left: "3%", w: 72, h: 84, avatar: { style: "lorelei", seed: "femi" }, avatarOnly: true, drift: "b", speed: 13, mobile: true },
  { top: "56%", left: "90%", w: 62, h: 72, avatar: { style: "notionists", seed: "grace" }, avatarOnly: true, drift: "a", speed: 10 },
  { top: "80%", left: "24%", w: 74, h: 84, avatar: { style: "lorelei", seed: "tunde" }, avatarOnly: true, drift: "c", speed: 14 },
  { top: "86%", left: "64%", w: 64, h: 70, avatar: { style: "notionists", seed: "dami" }, avatarOnly: true, drift: "b", speed: 11 },
  { top: "5%", left: "54%", w: 56, h: 64, avatar: { style: "lorelei", seed: "ifeoma" }, avatarOnly: true, drift: "a", speed: 15 },
  { top: "26%", left: "20%", w: 58, h: 66, avatar: { style: "openPeeps", seed: "sade" }, avatarOnly: true, drift: "b", speed: 12 },

  // colour blocks
  { top: "14%", left: "44%", w: 60, h: 60, color: "bg-sage", opacity: 0.7 },
  { top: "30%", left: "6%", w: 54, h: 70, color: "bg-clay", opacity: 0.9 },
  { top: "28%", left: "30%", w: 38, h: 48, color: "bg-clay", opacity: 0.35 },
  { top: "26%", left: "62%", w: 44, h: 56, color: "bg-lime", opacity: 0.6 },
  { top: "70%", left: "34%", w: 40, h: 52, color: "bg-sage", opacity: 0.5 },
  { top: "66%", left: "58%", w: 54, h: 70, color: "bg-clay", opacity: 0.7 },
  { top: "50%", left: "92%", w: 30, h: 40, color: "bg-ink", opacity: 0.8 },
  { top: "82%", left: "4%", w: 44, h: 44, color: "bg-lime", opacity: 0.8, mobile: true },
];

export default function Hero() {
  return (
    <section className="relative flex min-h-[100svh] w-full items-center justify-center overflow-hidden bg-paper px-4 pt-16">
      {/* Tiles */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {tiles.map((t, i) => {
          const showAvatar = HERO_IMAGES === "avatars" && !!t.avatar;
          if (t.avatarOnly && !showAvatar) return null;
          return (
          <div
            key={i}
            className={`absolute ${
              // avatars wander (no box, just the drawing); everything else floats
              showAvatar ? DRIFT[t.drift ?? "a"] : `animate-float overflow-hidden ${t.color ?? "bg-paper-deep"}`
            } ${t.mobile ? "" : "hidden md:block"}`}
            style={{
              top: t.top,
              left: t.left,
              width: t.w,
              height: t.h,
              opacity: t.opacity ?? 1,
              // different speeds and start points so they never move in sync
              ...(showAvatar && t.speed ? { animationDuration: `${t.speed}s` } : {}),
              animationDelay: `${showAvatar ? -((i * 2.7) % (t.speed ?? 12)) : (i % 5) * -1.3}s`,
            }}
          >
            {showAvatar && t.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL, nothing to optimise
              <img
                src={avatarSrc({ kind: "dicebear", ...t.avatar }, { radius: 0, background: false })}
                alt=""
                className="absolute inset-0 h-full w-full object-contain"
              />
            ) : (
              t.src && (
                <Image
                  src={t.src}
                  alt=""
                  fill
                  sizes={`${t.w}px`}
                  className="object-cover"
                  priority={i < 3}
                />
              )
            )}
          </div>
          );
        })}
      </div>

      {/* Headline */}
      <div className="relative z-10 flex max-w-4xl flex-col items-center gap-8 text-center">
        <span className="chip bg-lime text-ink">New · Whiteboard 2.0</span>
        <h1 className="display text-[clamp(2.75rem,7vw,5.75rem)] text-ink">
          Seamless meetings,
          <br />
          together in one place.
        </h1>
        <p className="max-w-md text-[15px] leading-relaxed tracking-[0.01em] text-stone">
          Schedule, meet, and share ideas in one calm place. Join thousands of
          teams already working better with MeetHub.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <a href="/signup" className="pill bg-ink px-5 py-3 text-paper hover:bg-clay hover:text-ink">
            Schedule your first meeting
          </a>
          <a href="#how-it-works" className="pill bg-white px-5 py-3 text-ink hover:bg-paper-deep">
            See how it works
          </a>
        </div>
        {/* Your next meetings (signed in), or a code from someone: jump straight in */}
        <HeroJoin />
      </div>

      {/* Scroll cue */}
      <a
        href="#how-it-works"
        className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 text-xs text-ink/70 hover:text-ink"
      >
        Scroll to explore <ArrowDown size={12} />
      </a>
    </section>
  );
}
