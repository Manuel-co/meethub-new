// Meeting recordings, stored as video blobs in IndexedDB (too big for
// localStorage). Like the rest of the mock data, they stay on this device.
"use client";

import { useCallback, useEffect, useState } from "react";

export type Recording = {
  id: string;
  meetingId: string;
  userId: string;
  meetingTitle: string;
  createdAt: string;
  /** seconds */
  duration: number;
  mimeType: string;
  size: number;
  blob: Blob;
};

const DB_NAME = "meethub";
const STORE = "recordings";
const CHANGED = "meethub:recordings-changed";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore(STORE, { keyPath: "id" });
      s.createIndex("userId", "userId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveRecording(rec: Omit<Recording, "id" | "createdAt" | "size">) {
  const full: Recording = {
    ...rec,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    size: rec.blob.size,
  };
  await tx("readwrite", (s) => s.put(full));
  window.dispatchEvent(new Event(CHANGED));
  return full;
}

export async function deleteRecording(id: string) {
  await tx("readwrite", (s) => s.delete(id));
  window.dispatchEvent(new Event(CHANGED));
}

/** Remove every recording this user made on this device */
export async function deleteAllRecordings(userId: string) {
  const all = await listForUser(userId);
  for (const r of all) await tx("readwrite", (s) => s.delete(r.id));
  window.dispatchEvent(new Event(CHANGED));
}

async function listForUser(userId: string): Promise<Recording[]> {
  const all = await tx<Recording[]>("readonly", (s) => s.index("userId").getAll(userId));
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Recordings made by this user, newest first */
export function useRecordings(userId: string) {
  const [recordings, setRecordings] = useState<Recording[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    listForUser(userId)
      .then(setRecordings)
      .catch(() => {
        setError("Recordings aren't available in this browser.");
        setRecordings([]);
      });
  }, [userId]);

  useEffect(() => {
    load();
    window.addEventListener(CHANGED, load);
    return () => window.removeEventListener(CHANGED, load);
  }, [load]);

  return { recordings, error };
}

// One object URL per blob for the life of the page. Blobs are already held in
// memory by the recordings list, so caching the URL costs nothing extra.
const urls = new WeakMap<Blob, string>();
export function urlFor(blob: Blob) {
  let u = urls.get(blob);
  if (!u) {
    u = URL.createObjectURL(blob);
    urls.set(blob, u);
  }
  return u;
}

/** Pick a container the browser can actually record */
export function pickMimeType() {
  const options = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  return options.find((t) => MediaRecorder.isTypeSupported?.(t)) ?? "";
}

export function fmtBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function fmtClock(totalSeconds: number) {
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}
