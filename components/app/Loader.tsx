/**
 * Loading UI shared across the site. Server-safe (no hooks), so it works in
 * `loading.tsx` files as well as inside client pages.
 */

const BLOCKS = ["bg-sage", "bg-clay", "bg-lime"];

/** Three colour blocks hopping in turn — the MeetHub loader */
export function Blocks({ size = 10, className = "" }: { size?: number; className?: string }) {
  return (
    <span aria-hidden className={`inline-flex items-end gap-1.5 ${className}`}>
      {BLOCKS.map((c, i) => (
        <span
          key={c}
          className={`animate-hop block rounded-[3px] ${c}`}
          style={{ width: size, height: size * 1.3, animationDelay: `${i * 0.14}s` }}
        />
      ))}
    </span>
  );
}

/** Full-screen loader with an optional line of text underneath */
export function PageLoader({
  label = "Loading",
  tone = "light",
  fullScreen = true,
}: {
  label?: string;
  tone?: "light" | "dark";
  fullScreen?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex w-full flex-1 flex-col items-center justify-center gap-4 px-4 ${
        fullScreen ? "min-h-[100svh]" : "min-h-[50svh]"
      } ${tone === "dark" ? "bg-ink text-paper/70" : "text-stone"}`}
    >
      <Blocks size={12} />
      <span className="text-sm tracking-[0.01em]">{label}…</span>
    </div>
  );
}

/** Grey placeholder with a shimmer, sized by `className` */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`skeleton block ${className}`} />;
}

/** Placeholder for a dashboard page: heading, a row of cards and a list */
export function DashboardPageSkeleton({ cards = 3, rows = 4 }: { cards?: number; rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="mx-auto flex max-w-6xl flex-col gap-10">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-12 w-72 max-w-full rounded-2xl" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      {cards > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: cards }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-[1.25rem]" />
          ))}
        </div>
      )}
      <MeetingListSkeleton rows={rows} />
    </div>
  );
}

/** Placeholder rows shaped like the meeting cards */
export function MeetingListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul aria-hidden className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="panel flex items-center gap-6 p-5">
          <div className="flex w-24 shrink-0 flex-col gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="hidden h-9 w-24 rounded-full sm:block" />
        </li>
      ))}
    </ul>
  );
}
