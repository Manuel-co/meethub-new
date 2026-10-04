"use client";

// Live whiteboard sync over LiveKit text streams (topic "whiteboard").
//
// Messages (JSON):
//   { type: "update",   elements }  changed elements from one person
//   { type: "sync-req" }            "send me the whole board" (on join)
//   { type: "sync",     elements }  the whole board, to whoever asked
//   { type: "opened",   name }      someone opened the board (for a notice)
//
// Every Excalidraw element carries `version` / `versionNonce`; merging keeps
// the higher version (ties broken by the lower nonce) — the same rule
// Excalidraw's own collaboration uses — so everyone converges on one board.

import { useCallback, useEffect, useRef } from "react";
import type { Room } from "livekit-client";

export type BoardElement = {
  id: string;
  version: number;
  versionNonce: number;
  isDeleted?: boolean;
  [key: string]: unknown;
};

type Msg =
  | { type: "update" | "sync"; elements: BoardElement[] }
  | { type: "sync-req" }
  | { type: "opened"; name: string };

const TOPIC = "whiteboard";

const newer = (a: BoardElement, b: BoardElement | undefined) =>
  !b || a.version > b.version || (a.version === b.version && a.versionNonce < b.versionNonce);

/** What the on-screen board registers so remote changes reach it */
export type BoardView = { applyRemote: (all: BoardElement[]) => void };

export function useWhiteboardSync({
  room,
  connected,
  onOpenedBy,
}: {
  room: Room;
  connected: boolean;
  /** someone else opened the board */
  onOpenedBy: (name: string) => void;
}) {
  const scene = useRef(new Map<string, BoardElement>());
  // highest version of each element we've already sent or received (no echoes)
  const known = useRef(new Map<string, number>());
  const view = useRef<BoardView | null>(null);
  const onOpenedRef = useRef(onOpenedBy);
  useEffect(() => {
    onOpenedRef.current = onOpenedBy;
  }, [onOpenedBy]);

  const send = useCallback(
    async (msg: Msg, to?: string[]) => {
      try {
        await room.localParticipant.sendText(JSON.stringify(msg), {
          topic: TOPIC,
          ...(to ? { destinationIdentities: to } : {}),
        });
      } catch {
        // not connected yet / left — the next change or sync will catch up
      }
    },
    [room],
  );

  /** Merge remote elements; returns true if anything changed */
  const mergeRemote = useCallback((incoming: BoardElement[]) => {
    let changed = false;
    for (const el of incoming) {
      if (!el?.id) continue;
      if (newer(el, scene.current.get(el.id))) {
        scene.current.set(el.id, el);
        changed = true;
      }
      known.current.set(el.id, Math.max(known.current.get(el.id) ?? -1, el.version));
    }
    return changed;
  }, []);

  // Receive
  useEffect(() => {
    const handler = async (
      reader: { readAll: () => Promise<string> },
      info: { identity: string },
    ) => {
      let msg: Msg;
      try {
        msg = JSON.parse(await reader.readAll());
      } catch {
        return;
      }
      if (msg.type === "update" || msg.type === "sync") {
        if (mergeRemote(msg.elements ?? [])) view.current?.applyRemote([...scene.current.values()]);
      } else if (msg.type === "sync-req") {
        if (scene.current.size) void send({ type: "sync", elements: [...scene.current.values()] }, [info.identity]);
      } else if (msg.type === "opened") {
        onOpenedRef.current(msg.name);
      }
    };
    try {
      room.registerTextStreamHandler(TOPIC, handler as Parameters<Room["registerTextStreamHandler"]>[1]);
    } catch {
      // already registered (dev double-mount) — the cleanup below resets it
    }
    return () => room.unregisterTextStreamHandler(TOPIC);
  }, [room, mergeRemote, send]);

  // On connecting, ask whoever's here for the current board
  useEffect(() => {
    if (connected) void send({ type: "sync-req" });
  }, [connected, send]);

  // Local edits: send only what changed, at most ~12 times a second
  const pending = useRef<readonly BoardElement[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const publishLocal = useCallback(
    (all: readonly BoardElement[]) => {
      pending.current = all;
      if (timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = undefined;
        const latest = pending.current ?? [];
        const changed: BoardElement[] = [];
        for (const el of latest) {
          if ((known.current.get(el.id) ?? -1) < el.version) {
            changed.push(el);
            known.current.set(el.id, el.version);
            scene.current.set(el.id, el);
          }
        }
        if (changed.length) void send({ type: "update", elements: changed });
      }, 80);
    },
    [send],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  return {
    /** current board (for opening the view) */
    snapshot: () => [...scene.current.values()],
    /** the on-screen board registers/unregisters itself here */
    setView: (v: BoardView | null) => {
      view.current = v;
    },
    publishLocal,
    announceOpened: (name: string) => void send({ type: "opened", name }),
  };
}
