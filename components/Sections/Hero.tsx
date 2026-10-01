import Image from "next/image";
import { ArrowDown } from "lucide-react";

type Tile = {
  // position as % of the hero box, size in px
  top: string;
  left: string;
  w: number;
  h: number;
  src?: string;
  color?: string;
  opacity?: number;
  delay?: string;
  mobile?: boolean;
};

// Scattered "moodboard" tiles around the headline
const tiles: Tile[] = [
  { top: "12%", left: "16%", w: 92, h: 124, src: "/heromale.png", mobile: true },
  { top: "14%", left: "44%", w: 60, h: 60, color: "bg-sage", opacity: 0.7 },
  { top: "9%", left: "70%", w: 110, h: 140, src: "/Features1.png", mobile: true },
  { top: "30%", left: "6%", w: 54, h: 70, color: "bg-clay", opacity: 0.9 },
  { top: "34%", left: "86%", w: 96, h: 130, src: "/herofemale.png" },
  { top: "28%", left: "30%", w: 38, h: 48, color: "bg-clay", opacity: 0.35 },
  { top: "26%", left: "62%", w: 44, h: 56, color: "bg-lime", opacity: 0.6 },
  { top: "62%", left: "12%", w: 84, h: 110, src: "/testimonal-img.png" },
  { top: "70%", left: "34%", w: 40, h: 52, color: "bg-sage", opacity: 0.5 },
  { top: "66%", left: "58%", w: 54, h: 70, color: "bg-clay", opacity: 0.7 },
  { top: "74%", left: "76%", w: 100, h: 74, src: "/Features1.png", opacity: 0.85, mobile: true },
  { top: "84%", left: "48%", w: 48, h: 64, src: "/herofemale.png", opacity: 0.6 },
  { top: "50%", left: "92%", w: 30, h: 40, color: "bg-ink", opacity: 0.8 },
  { top: "82%", left: "4%", w: 44, h: 44, color: "bg-lime", opacity: 0.8, mobile: true },
];

export default function Hero() {
  return (
    <section className="relative flex min-h-[100svh] w-full items-center justify-center overflow-hidden bg-paper px-4 pt-16">
      {/* Tiles */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {tiles.map((t, i) => (
          <div
            key={i}
            className={`absolute animate-float overflow-hidden ${t.color ?? "bg-paper-deep"} ${
              t.mobile ? "" : "hidden md:block"
            }`}
            style={{
              top: t.top,
              left: t.left,
              width: t.w,
              height: t.h,
              opacity: t.opacity ?? 1,
              animationDelay: `${(i % 5) * -1.3}s`,
            }}
          >
            {t.src && (
              <Image
                src={t.src}
                alt=""
                fill
                sizes={`${t.w}px`}
                className="object-cover"
                priority={i < 3}
              />
            )}
          </div>
        ))}
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
