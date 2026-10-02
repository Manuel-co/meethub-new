// App data, backed by Supabase (auth + Postgres with row-level security).
// Pages use the hooks below; the signed-in user's profile and meetings are
// kept in a small in-memory cache that refreshes on login/logout and when
// the meetings table changes (Supabase Realtime).
import { useSyncExternalStore } from "react";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "./supabase";
import { browserTimeZone } from "./tz";
import { encodeAvatar, parseAvatar, type AvatarSpec } from "./avatar";

/* ------------------------------------------------------------------ types */

export type DayHours = { enabled: boolean; start: string; end: string };

export type User = {
  id: string;
  email: string;
  name: string;
  username: string;
  timezone: string;
  /** Index 0 = Sunday … 6 = Saturday, in `timezone` */
  availability: DayHours[];
  meetingLength: number;
  bookingTitle: string;
  bookingMessage: string;
  avatar: AvatarSpec | null;
};

/** What the public booking page can see about a host */
export type Host = Omit<User, "email">;

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
};

export type ChatMessage = {
  id: string;
  meetingId: string;
  senderIdentity: string;
  senderName: string;
  body: string;
  sentAt: string;
};

export type Attendance = {
  id: string;
  meetingId: string;
  userId: string;
  joinedAt: string;
  leftAt?: string;
};

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/* ------------------------------------------------------------- row mapping */

type ProfileRow = {
  id: string;
  name: string;
  username: string;
  timezone: string;
  availability: DayHours[];
  meeting_length: number;
  booking_title: string;
  booking_message: string;
  avatar?: unknown;
};

type MeetingRow = {
  id: string;
  host_id: string;
  title: string;
  description: string;
  start_at: string;
  duration: number;
  invitees: string[];
  source: "manual" | "booking";
  guest_name: string | null;
  guest_email: string | null;
  guest_note: string | null;
  status: "scheduled" | "cancelled";
  created_at: string;
};

const BASE_PROFILE_COLUMNS =
  "id, name, username, timezone, availability, meeting_length, booking_title, booking_message";
// `avatar` comes from migration 0002; until it's run we fall back to the base columns
let PROFILE_COLUMNS = `${BASE_PROFILE_COLUMNS}, avatar`;

/** Run a profiles query, retrying without `avatar` if that column doesn't exist yet */
async function withProfileColumns<T extends { error: { message: string } | null }>(
  run: (columns: string) => PromiseLike<T>,
): Promise<T> {
  const res = await run(PROFILE_COLUMNS);
  if (res.error && /avatar/i.test(res.error.message) && PROFILE_COLUMNS !== BASE_PROFILE_COLUMNS) {
    PROFILE_COLUMNS = BASE_PROFILE_COLUMNS;
    return run(PROFILE_COLUMNS);
  }
  return res;
}

const toHost = (r: ProfileRow): Host => ({
  id: r.id,
  name: r.name,
  username: r.username,
  timezone: r.timezone,
  availability: r.availability,
  meetingLength: r.meeting_length,
  bookingTitle: r.booking_title,
  bookingMessage: r.booking_message,
  avatar: r.avatar ? parseAvatar(JSON.stringify(r.avatar)) : null,
});

const toMeeting = (r: MeetingRow): Meeting => ({
  id: r.id,
  hostId: r.host_id,
  title: r.title,
  description: r.description,
  start: new Date(r.start_at).toISOString(),
  duration: r.duration,
  invitees: r.invitees,
  source: r.source,
  guest: r.guest_name
    ? { name: r.guest_name, email: r.guest_email ?? "", note: r.guest_note ?? undefined }
    : undefined,
  status: r.status,
  createdAt: r.created_at,
});

/* -------------------------------------------------------------- the cache */

type State = {
  /** true once we know whether someone is signed in */
  ready: boolean;
  configError: string;
  session: Session | null;
  profile: Host | null;
  meetings: Meeting[];
};

let state: State = { ready: false, configError: "", session: null, profile: null, meetings: [] };
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

let started = false;
let channel: RealtimeChannel | null = null;
let reloadTimer: ReturnType<typeof setTimeout> | undefined;

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (!supabaseConfigured()) {
    set({
      ready: true,
      configError:
        "Supabase isn't set up yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env, then restart the dev server.",
    });
    return;
  }
  const sb = supabase();
  sb.auth.getSession().then(({ data }) => onSession(data.session));
  // Supabase advises not awaiting other calls inside this callback
  sb.auth.onAuthStateChange((_event, session) => setTimeout(() => onSession(session), 0));
}

async function onSession(session: Session | null) {
  if (!session) {
    stopLiveUpdates();
    set({ ready: true, session: null, profile: null, meetings: [] });
    return;
  }
  const sameUser = state.session?.user.id === session.user.id && state.profile;
  set({ session });
  if (sameUser) return; // token refresh — nothing else changed

  await Promise.all([loadProfile(session.user.id), loadMeetings()]);
  set({ ready: true });

  // Fully remove any previous channel: re-using a name returns the old,
  // already-subscribed channel, which can't take new listeners
  stopLiveUpdates();
  channel = supabase()
    .channel(`meetings-${session.user.id}-${Date.now()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, () => {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(loadMeetings, 300);
    })
    .subscribe();
}

function stopLiveUpdates() {
  clearTimeout(reloadTimer);
  if (channel) void supabase().removeChannel(channel);
  channel = null;
}

async function loadProfile(userId: string) {
  const { data } = await withProfileColumns((cols) =>
    supabase().from("profiles").select(cols).eq("id", userId).single(),
  );
  set({ profile: data ? toHost(data as unknown as ProfileRow) : null });
}

async function loadMeetings() {
  const { data } = await supabase()
    .from("meetings")
    .select("*")
    .order("start_at", { ascending: true });
  set({ meetings: ((data ?? []) as MeetingRow[]).map(toMeeting) });
}

function subscribe(cb: () => void) {
  start();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const SERVER_STATE: State = { ready: false, configError: "", session: null, profile: null, meetings: [] };
const useStore = () => useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);

/* ------------------------------------------------------------------ hooks */

const noopSubscribe = () => () => {};
/** false during SSR/hydration, true in the browser */
export const useHydrated = () =>
  useSyncExternalStore(noopSubscribe, () => true, () => false);

/** `ready` is false until we know whether someone is signed in */
export function useAuth() {
  const s = useStore();
  const user: User | null =
    s.session && s.profile ? { ...s.profile, email: s.session.user.email ?? "" } : null;
  return { ready: s.ready, user, configError: s.configError };
}

export const useCurrentUser = () => useAuth().user;

/** Every meeting the signed-in user hosts or is invited to */
export const useMyMeetings = () => useStore().meetings;

export function useMeetings(hostId: string | undefined) {
  return useStore().meetings.filter((m) => m.hostId === hostId);
}

export function useMeeting(id: string) {
  return useStore().meetings.find((m) => m.id === id) ?? null;
}

/* ------------------------------------------------------------------- auth */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Turn Supabase's technical auth errors into plain language */
function friendlyAuthError(message: string) {
  if (/invalid login credentials/i.test(message)) return "Email or password is incorrect.";
  if (/already registered|already exists/i.test(message)) return "An account with this email already exists.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email first — check your inbox.";
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Please wait a minute and try again.";
  if (/missing email|email.*required/i.test(message)) return "Please enter your email address.";
  if (/password.*(required|missing)/i.test(message)) return "Please enter your password.";
  if (/invalid.*email|unable to validate email/i.test(message)) return "Please enter a valid email address.";
  if (/password should be|weak password/i.test(message)) return "Please choose a stronger password (at least 8 characters).";
  if (/signups? not allowed|signup is disabled/i.test(message)) return "New sign-ups are turned off right now.";
  if (/fetch|network/i.test(message)) return "Can't reach the server. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
}): Promise<Result<{ needsConfirmation: boolean }>> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length < 2) return { ok: false, error: "Please enter your full name." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email address." };
  if (input.password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };

  try {
    const { data, error } = await supabase().auth.signUp({
      email,
      password: input.password,
      options: { data: { name, timezone: browserTimeZone() } },
    });
    if (error) return { ok: false, error: friendlyAuthError(error.message) };
    return { ok: true, data: { needsConfirmation: !data.session } };
  } catch (e) {
    return { ok: false, error: friendlyAuthError(e instanceof Error ? e.message : "") };
  }
}

export async function logIn(email: string, password: string): Promise<Result> {
  if (!email.trim()) return { ok: false, error: "Please enter your email address." };
  if (!EMAIL_RE.test(email.trim())) return { ok: false, error: "Please enter a valid email address." };
  if (!password) return { ok: false, error: "Please enter your password." };
  try {
    const { error } = await supabase().auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) return { ok: false, error: friendlyAuthError(error.message) };
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: friendlyAuthError(e instanceof Error ? e.message : "") };
  }
}

export async function logOut() {
  await supabase().auth.signOut();
}

/** Permanently delete the signed-in user's account and everything they host */
export async function deleteAccount(): Promise<Result> {
  const { error } = await supabase().rpc("delete_my_account");
  if (error) {
    return {
      ok: false,
      error: /could not find the function|does not exist/i.test(error.message)
        ? "Account deletion isn't set up yet. Run supabase/migrations/0002_avatars_and_delete_account.sql in the Supabase SQL editor."
        : error.message,
    };
  }
  // The session belongs to a user that no longer exists; clear it locally
  await supabase().auth.signOut({ scope: "local" }).catch(() => {});
  set({ session: null, profile: null, meetings: [] });
  return { ok: true, data: undefined };
}

/* ---------------------------------------------------------------- profile */

export async function updateProfile(
  patch: Partial<
    Pick<User, "availability" | "meetingLength" | "bookingTitle" | "bookingMessage" | "timezone" | "name"> & {
      avatar: AvatarSpec;
    }
  >,
): Promise<Result> {
  const id = state.session?.user.id;
  if (!id) return { ok: false, error: "You're not signed in." };
  const row: Partial<ProfileRow> = {};
  if (patch.avatar) {
    if (PROFILE_COLUMNS === BASE_PROFILE_COLUMNS) {
      return {
        ok: false,
        error: "Profile avatars aren't set up yet. Run supabase/migrations/0002_avatars_and_delete_account.sql in the Supabase SQL editor.",
      };
    }
    row.avatar = JSON.parse(encodeAvatar(patch.avatar));
  }
  if (patch.availability) row.availability = patch.availability;
  if (patch.meetingLength) row.meeting_length = patch.meetingLength;
  if (patch.bookingTitle !== undefined) row.booking_title = patch.bookingTitle;
  if (patch.bookingMessage !== undefined) row.booking_message = patch.bookingMessage;
  if (patch.timezone) row.timezone = patch.timezone;
  if (patch.name) row.name = patch.name;

  const { data, error } = await withProfileColumns((cols) =>
    supabase().from("profiles").update(row).eq("id", id).select(cols).single(),
  );
  if (error) return { ok: false, error: error.message };
  set({ profile: toHost(data as unknown as ProfileRow) });
  return { ok: true, data: undefined };
}

/* --------------------------------------------------------------- meetings */

export async function createMeeting(input: {
  title: string;
  description: string;
  start: string;
  duration: number;
  invitees: string[];
}): Promise<Result<Meeting>> {
  const hostId = state.session?.user.id;
  if (!hostId) return { ok: false, error: "You're not signed in." };
  const { data, error } = await supabase()
    .from("meetings")
    .insert({
      host_id: hostId,
      title: input.title,
      description: input.description,
      start_at: input.start,
      duration: input.duration,
      invitees: input.invitees.map((e) => e.toLowerCase()),
      source: "manual",
    })
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };
  const meeting = toMeeting(data as MeetingRow);
  set({
    meetings: [...state.meetings.filter((m) => m.id !== meeting.id), meeting].sort(
      (a, b) => +new Date(a.start) - +new Date(b.start),
    ),
  });
  return { ok: true, data: meeting };
}

export async function cancelMeeting(id: string): Promise<Result> {
  const { error } = await supabase().from("meetings").update({ status: "cancelled" }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  set({ meetings: state.meetings.map((m) => (m.id === id ? { ...m, status: "cancelled" } : m)) });
  return { ok: true, data: undefined };
}

/* ------------------------------------------------- public (no login needed) */

export async function getHost(username: string): Promise<Host | null> {
  const { data } = await withProfileColumns((cols) =>
    supabase().from("profiles").select(cols).eq("username", username.toLowerCase()).maybeSingle(),
  );
  return data ? toHost(data as unknown as ProfileRow) : null;
}

/** Busy time ranges for a host (no meeting details) */
export async function getBusyTimes(hostId: string, from: Date, to: Date) {
  const { data, error } = await supabase().rpc("get_busy_times", {
    p_host: hostId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { start_at: string; end_at: string }[]).map((b) => ({
    start: new Date(b.start_at).getTime(),
    end: new Date(b.end_at).getTime(),
  }));
}

const BOOKING_ERRORS: Record<string, string> = {
  host_not_found: "This booking page doesn't exist.",
  invalid_name: "Please enter your name.",
  invalid_email: "Please enter a valid email address.",
  note_too_long: "Your note is too long (1000 characters max).",
  slot_in_past: "That time has already passed. Please pick another.",
  slot_too_far: "That's too far ahead. Please pick an earlier date.",
  slot_unavailable: "That time is outside the host's hours. Please pick another.",
  slot_taken: "Sorry, someone just booked that time. Please pick another.",
};

export async function bookMeeting(
  username: string,
  start: Date,
  guest: { name: string; email: string; note?: string },
): Promise<Result<string>> {
  const { data, error } = await supabase().rpc("book_meeting", {
    p_username: username,
    p_start: start.toISOString(),
    p_name: guest.name,
    p_email: guest.email,
    p_note: guest.note ?? null,
  });
  if (error) {
    const code = Object.keys(BOOKING_ERRORS).find((k) => error.message.includes(k));
    return { ok: false, error: code ? BOOKING_ERRORS[code] : "Couldn't book that time. Please try again." };
  }
  return { ok: true, data: data as string };
}

export type PublicMeeting = {
  id: string;
  title: string;
  start: string;
  duration: number;
  status: "scheduled" | "cancelled";
  hostName: string;
};

/** Title/time for the meeting room — anyone with the link can see this */
export async function getMeetingPublic(id: string): Promise<PublicMeeting | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null; // ad-hoc rooms aren't in the database
  const { data } = await supabase().rpc("get_meeting_public", { p_id: id });
  const row = (data as { id: string; title: string; start_at: string; duration: number; status: "scheduled" | "cancelled"; host_name: string }[] | null)?.[0];
  return row
    ? { id: row.id, title: row.title, start: row.start_at, duration: row.duration, status: row.status, hostName: row.host_name }
    : null;
}

/* ---------------------------------------------- meeting room: chat & presence */

/** Save a chat message once (keyed by its LiveKit id). Signed-in participants only. */
export async function saveChatMessage(msg: ChatMessage) {
  if (!state.session) return;
  await supabase()
    .from("meeting_messages")
    .upsert(
      {
        id: msg.id,
        meeting_id: msg.meetingId,
        sender_identity: msg.senderIdentity,
        sender_name: msg.senderName.slice(0, 80),
        body: msg.body.slice(0, 2000),
        sent_at: msg.sentAt,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
}

/** Record that the signed-in user joined; returns the attendance id */
export async function joinMeeting(meetingId: string): Promise<string | null> {
  if (!state.session) return null;
  const { data } = await supabase()
    .from("attendance")
    .insert({ meeting_id: meetingId })
    .select("id")
    .single();
  return (data as { id: string } | null)?.id ?? null;
}

export async function leaveMeeting(attendanceId: string) {
  await supabase().from("attendance").update({ left_at: new Date().toISOString() }).eq("id", attendanceId);
}

/** Chat transcripts and attendance for the History page */
export async function loadMeetingExtras(meetingIds: string[]) {
  if (!meetingIds.length) return { messages: [] as ChatMessage[], attendance: [] as Attendance[] };
  const sb = supabase();
  const [msgs, att] = await Promise.all([
    sb.from("meeting_messages").select("*").in("meeting_id", meetingIds).order("sent_at"),
    sb.from("attendance").select("*").in("meeting_id", meetingIds),
  ]);
  return {
    messages: ((msgs.data ?? []) as {
      id: string; meeting_id: string; sender_identity: string; sender_name: string; body: string; sent_at: string;
    }[]).map((r) => ({
      id: r.id,
      meetingId: r.meeting_id,
      senderIdentity: r.sender_identity,
      senderName: r.sender_name,
      body: r.body,
      sentAt: r.sent_at,
    })),
    attendance: ((att.data ?? []) as {
      id: string; meeting_id: string; user_id: string; joined_at: string; left_at: string | null;
    }[]).map((r) => ({
      id: r.id,
      meetingId: r.meeting_id,
      userId: r.user_id,
      joinedAt: r.joined_at,
      leftAt: r.left_at ?? undefined,
    })),
  };
}
