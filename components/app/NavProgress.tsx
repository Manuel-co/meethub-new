"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Phase = "idle" | "loading" | "done";

/**
 * Thin bar across the top of the page while moving between pages. Starts when
 * an internal link to another page is clicked, finishes when the URL changes.
 */
export default function NavProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const [run, setRun] = useState(0);
  const [lastPath, setLastPath] = useState(pathname);

  // The new page has arrived: finish the bar
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (phase === "loading") setPhase("done");
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || a.hasAttribute("download")) return;
      if (a.target && a.target !== "_self") return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      // Same page (or just a #section on it): nothing to load
      if (url.pathname === location.pathname && url.search === location.search) return;
      setRun((n) => n + 1);
      setPhase("loading");
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Fade out once finished; give up quietly if a navigation never lands
  useEffect(() => {
    if (phase === "idle") return;
    const t = setTimeout(() => setPhase("idle"), phase === "done" ? 400 : 15_000);
    return () => clearTimeout(t);
  }, [phase, run]);

  if (phase === "idle") return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]">
      <div
        key={run}
        className={`h-full origin-left bg-clay ${
          phase === "loading"
            ? "animate-nav-progress"
            : "scale-x-100 opacity-0 transition-[transform,opacity] duration-300 ease-out"
        }`}
      />
    </div>
  );
}
