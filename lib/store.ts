// Mock data layer backed by localStorage.
// Everything lives in the browser, so data is per-device. Swap these
// functions for real API calls when a backend exists; the pages only
// talk to the exports below.
import { useSyncExternalStore } from "react";
import { DEFAULT_HOURS } from "./scheduling";

export type DayHours = { enabled: boolean; start: string; end: string };

export type User = {
  id: string;
  name: string;
  email: string;
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  /** Index 0 = Sunday … 6 = Saturday */
  availability: DayHours[];
  meetingLength: number;
  bookingTitle: string;
  bookingMessage: string;
};

export type Meeting = {
  id: string;
  hostId: string;
  title: string;
  description: string;
  /** ISO string */
  start: string;
  /** minutes */
  duration: number;
  invitees: string[];
  source: "manual" | "booking";
  guest?: { name: string; email: string; note?: string };
  status: "scheduled" | "cancelled";
  createdAt: string;
  /** Who joined the room, and when */
  attendance?: Attendance[];
  chat?: ChatMessage[];
};

export type Attendance = {
  id: string;
  userId: string;
  name: string;
  joinedAt: string;
  leftAt?: string;
  /** last heartbeat, so stale "in room" entries can be ignored */
  seenAt: string;
};

export type ChatMessage = {
  id: string;
  userId: string;
  name: string;
  text: string;
  at: string;
};

type DB = { users: User[]; meetings: Meeting[] };

const DB_KEY = "meethub:db";
const SESSION_KEY = "meethub:session";
const EMPTY: DB = { users: [], meetings: [] };

/* ---------- storage plumbing ---------- */

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === DB_KEY || e.key === SESSION_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function safeGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode etc.) — changes are lost on reload
  }
}

// useSyncExternalStore needs a stable snapshot, so cache by raw string
let cachedRaw: string | null | undefined;
let cachedDb: DB = EMPTY;
function readDb(): DB {
  const raw = safeGet(DB_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedDb = raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
    } catch {
      cachedDb = EMPTY;
    }
  }
  return cachedDb;
}

function writeDb(db: DB) {
  safeSet(DB_KEY, JSON.stringify(db));
  emit();
}

const readSession = () => safeGet(SESSION_KEY);
const noopSubscribe = () => () => {};

/* ---------- hooks ---------- */

export const useDb = () => useSyncExternalStore(subscribe, readDb, () => EMPTY);

/** false during SSR/hydration, true once we can read localStorage */
export const useHydrated = () =>
  useSyncExternalStore(noopSubscribe, () => true, () => false);

export function useCurrentUser() {
  const db = useDb();
  const id = useSyncExternalStore(subscribe, readSession, () => null);
  return db.users.find((u) => u.id === id) ?? null;
}

export function useMeetings(hostId: string | undefined) {
  const db = useDb();
  return db.meetings.filter((m) => m.hostId === hostId);
}

/** Meetings the user hosts or was invited to (by email) */
export function useMyMeetings(user: Pick<User, "id" | "email"> | null) {
  const db = useDb();
  if (!user) return [];
  return db.meetings.filter(
    (m) => m.hostId === user.id || m.invitees.includes(user.email),
  );
}

export function useMeeting(id: string) {
  const db = useDb();
  return db.meetings.find((m) => m.id === id) ?? null;
}

export const canAccess = (m: Meeting, u: Pick<User, "id" | "email">) =>
  m.hostId === u.id || m.invitees.includes(u.email);

/* ---------- auth ---------- */

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

// NOTE: client-side hashing is only so plain passwords aren't sitting in
// localStorage. It is not real security — use a server for that.
async function hash(password: string, salt: string) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-") || "user"
  );
}

export function suggestUsername(name: string, users: User[] = readDb().users) {
  const base = slugify(name);
  let candidate = base;
  let n = 2;
  while (users.some((u) => u.username === candidate)) candidate = `${base}-${n++}`;
  return candidate;
}

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
}): Promise<Result<User>> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length < 2) return { ok: false, error: "Please enter your full name." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email address." };
  if (input.password.length < 8)
    return { ok: false, error: "Password must be at least 8 characters." };

  const db = readDb();
  if (db.users.some((u) => u.email === email))
    return { ok: false, error: "An account with this email already exists." };

  const salt = crypto.randomUUID();
  const user: User = {
    id: crypto.randomUUID(),
    name,
    email,
    username: suggestUsername(name, db.users),
    salt,
    passwordHash: await hash(input.password, salt),
    createdAt: new Date().toISOString(),
    availability: DEFAULT_HOURS.map((d) => ({ ...d })),
    meetingLength: 30,
    bookingTitle: "Intro call",
    bookingMessage: "Pick a time that works for you and I'll send over a meeting link.",
  };
  writeDb({ ...db, users: [...db.users, user] });
  safeSet(SESSION_KEY, user.id);
  emit();
  return { ok: true, data: user };
}

export async function logIn(emailRaw: string, password: string): Promise<Result<User>> {
  const email = emailRaw.trim().toLowerCase();
  const user = readDb().users.find((u) => u.email === email);
  if (!user || (await hash(password, user.salt)) !== user.passwordHash)
    return { ok: false, error: "Email or password is incorrect." };
  safeSet(SESSION_KEY, user.id);
  emit();
  return { ok: true, data: user };
}

export function logOut() {
  safeSet(SESSION_KEY, null);
  emit();
}

export function updateUser(id: string, patch: Partial<Omit<User, "id">>) {
  const db = readDb();
  writeDb({
    ...db,
    users: db.users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
  });
}

export function findUserByUsername(users: User[], username: string) {
  return users.find((u) => u.username === username.toLowerCase()) ?? null;
}

/* ---------- meetings ---------- */

export function createMeeting(
  input: Omit<Meeting, "id" | "status" | "createdAt">,
): Meeting {
  const meeting: Meeting = {
    ...input,
    id: crypto.randomUUID(),
    status: "scheduled",
    createdAt: new Date().toISOString(),
  };
  const db = readDb();
  writeDb({ ...db, meetings: [...db.meetings, meeting] });
  return meeting;
}

export function cancelMeeting(id: string) {
  const db = readDb();
  writeDb({
    ...db,
    meetings: db.meetings.map((m) =>
      m.id === id ? { ...m, status: "cancelled" as const } : m,
    ),
  });
}

function patchMeeting(id: string, fn: (m: Meeting) => Meeting) {
  const db = readDb();
  writeDb({ ...db, meetings: db.meetings.map((m) => (m.id === id ? fn(m) : m)) });
}

/* ---------- meeting room ---------- */

/** Someone is "in the room" if they haven't left and pinged recently */
export const PRESENCE_TTL_MS = 20_000;

export function joinMeeting(
  meetingId: string,
  user: Pick<User, "id" | "name">,
  attendanceId: string = crypto.randomUUID(),
) {
  const now = new Date().toISOString();
  const entry: Attendance = {
    id: attendanceId,
    userId: user.id,
    name: user.name,
    joinedAt: now,
    seenAt: now,
  };
  patchMeeting(meetingId, (m) => ({ ...m, attendance: [...(m.attendance ?? []), entry] }));
  return entry.id;
}

export function heartbeat(meetingId: string, attendanceId: string) {
  const now = new Date().toISOString();
  patchMeeting(meetingId, (m) => ({
    ...m,
    attendance: m.attendance?.map((a) => (a.id === attendanceId ? { ...a, seenAt: now } : a)),
  }));
}

export function leaveMeeting(meetingId: string, attendanceId: string) {
  const now = new Date().toISOString();
  patchMeeting(meetingId, (m) => ({
    ...m,
    attendance: m.attendance?.map((a) =>
      a.id === attendanceId ? { ...a, leftAt: now, seenAt: now } : a,
    ),
  }));
}

export function sendChat(meetingId: string, user: Pick<User, "id" | "name">, text: string) {
  const msg: ChatMessage = {
    id: crypto.randomUUID(),
    userId: user.id,
    name: user.name,
    text: text.trim().slice(0, 2000),
    at: new Date().toISOString(),
  };
  if (!msg.text) return;
  patchMeeting(meetingId, (m) => ({ ...m, chat: [...(m.chat ?? []), msg] }));
}

/* ---------- demo seeding (see lib/demo.ts) ---------- */

export function getUserByEmail(email: string) {
  return readDb().users.find((u) => u.email === email.toLowerCase()) ?? null;
}

export function insertSeed(users: User[], meetings: Meeting[]) {
  const db = readDb();
  writeDb({ users: [...db.users, ...users], meetings: [...db.meetings, ...meetings] });
}

export function startSession(userId: string) {
  safeSet(SESSION_KEY, userId);
  emit();
}

export { hash as hashPassword };
