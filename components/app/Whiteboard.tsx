"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Blocks } from "@/components/app/Loader";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import type { BoardElement, BoardView } from "@/lib/whiteboard";

// Excalidraw needs the browser (and is ~1 MB), so it's only loaded when the
// board is first opened
const Excalidraw = dynamic(async () => (await import("@excalidraw/excalidraw")).Excalidraw, {
  ssr: false,
  loading: () => (
    <div role="status" className="flex h-full flex-col items-center justify-center gap-3 text-sm text-stone">
      <Blocks size={10} /> Loading whiteboard…
    </div>
  ),
});

export default function Whiteboard({
  initialElements,
  onLocalChange,
  setView,
  onClose,
}: {
  initialElements: BoardElement[];
  onLocalChange: (all: readonly BoardElement[]) => void;
  setView: (v: BoardView | null) => void;
  onClose: () => void;
}) {
  const api = useRef<ExcalidrawImperativeAPI | null>(null);

  // Let the sync engine push other people's changes into this board
  useEffect(() => {
    let cancelled = false;
    void import("@excalidraw/excalidraw").then(({ reconcileElements, CaptureUpdateAction }) => {
      if (cancelled) return;
      setView({
        applyRemote: (all) => {
          const a = api.current;
          if (!a) return;
          const merged = reconcileElements(
            a.getSceneElementsIncludingDeleted(),
            all as unknown as Parameters<typeof reconcileElements>[1],
            a.getAppState(),
          );
          // NEVER = remote strokes don't go into *your* undo history
          a.updateScene({ elements: merged, captureUpdate: CaptureUpdateAction.NEVER });
        },
      });
    });
    return () => {
      cancelled = true;
      setView(null);
    };
  }, [setView]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[1.25rem] bg-white text-ink">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-2">
        <p className="min-w-0 truncate text-sm">
          <span className="font-medium">Whiteboard</span>
          <span className="text-stone"> · everyone here can draw</span>
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close whiteboard"
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-ink px-3 text-xs font-semibold text-paper hover:bg-clay hover:text-ink"
        >
          <X size={14} /> Close
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
      <Excalidraw
        excalidrawAPI={(a) => {
          api.current = a;
        }}
        initialData={{
          elements: initialElements as never,
          appState: { viewBackgroundColor: "#ffffff", currentItemStrokeColor: "#241f21" },
        }}
        onChange={() => {
          // include deleted elements so erasing syncs too
          const a = api.current;
          if (a) onLocalChange(a.getSceneElementsIncludingDeleted() as unknown as BoardElement[]);
        }}
        UIOptions={{
          // pasted images aren't part of the live sync, so hide the image tool
          tools: { image: false },
          canvasActions: { loadScene: false, saveToActiveFile: false, toggleTheme: false },
        }}
      />
      </div>
    </div>
  );
}
