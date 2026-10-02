"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  isTrackReference,
  useChat,
  useConnectionState,
  useDataChannel,
  useIsSpeaking,
  useLocalParticipant,
  useParticipantAttribute,
  useParticipants,
  useRoomContext,
  useTrackMutedIndicator,
  useTrackToggle,
  useTracks,
  type TrackReference,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import {
  ConnectionError,
  ConnectionErrorReason,
  ConnectionState,
  DisconnectReason,
  Track,
  type Participant,
} from "livekit-client";
import {
  Check,
  Circle,
  Hand,
  Link2,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Send,
  Smile,
  Square,
  Users,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import AvatarPicker from "@/components/app/AvatarPicker";
import ProfileAvatar from "@/components/app/ProfileAvatar";
import {
  encodeAvatar,
  loadAvatar,
  parseAvatar,
  saveAvatar,
  type AvatarSpec,
} from "@/lib/avatar";
import { describeMediaError, listDevices, selectable } from "@/lib/media";
import SelectField from "@/components/app/SelectField";
import {
  getMeetingPublic,
  joinMeeting,
  leaveMeeting,
  saveChatMessage,
  updateProfile,
  useCurrentUser,
  useHydrated,
  useMeeting,
  type Meeting,
} from "@/lib/store";
import { fmtClock, pickMimeType, saveRecording } from "@/lib/recordings";
import { fmtTime } from "@/lib/format";

const NAME_KEY = "meethub:displayName";
// Radix Select can't use "" as a value, so "use the system default" gets a sentinel
const DEFAULT_DEVICE = "default";
const REACTIONS = ["👍", "❤️", "😂", "🎉", "👏", "😮"];

type Session = {
  token: string;
  url: string;
  name: string;
  audio: boolean;
  video: boolean;
  camId?: string;
  micId?: string;
  avatar: AvatarSpec;
};

/** What the room needs to know about a scheduled meeting */
type RoomInfo = Pick<Meeting, "id" | "title" | "start" | "duration" | "status">;

export default function MeetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const hydrated = useHydrated();
  // Hosts/invitees already have the meeting cached; everyone else (guests)
  // gets the public title/time by id. Ad-hoc rooms have no record at all.
  const cached = useMeeting(id);
  const [publicInfo, setPublicInfo] = useState<RoomInfo | null>(null);
  useEffect(() => {
    let cancelled = false;
    getMeetingPublic(id)
      .then((m) => !cancelled && setPublicInfo(m))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);
  const meeting: RoomInfo | null = cached ?? publicInfo;
  const [session, setSession] = useState<Session | null>(null);
  const [left, setLeft] = useState(false);
  const [failure, setFailure] = useState("");
  // Set when the user clicks Leave, so we can tell that apart from React
  // dev-mode remounts (which also disconnect "from the client")
  const userLeft = useRef(false);

  if (!hydrated) return <Center><Loader2 className="animate-spin" /></Center>;

  if (meeting?.status === "cancelled") {
    return (
      <Center>
        <p className="display text-3xl">This meeting was cancelled.</p>
        <Link href="/" className="pill bg-paper text-ink hover:bg-lime">Go to MeetHub</Link>
      </Center>
    );
  }

  if (failure) {
    return (
      <Center>
        <p className="display text-4xl">Couldn&apos;t connect to the call.</p>
        <p className="max-w-md text-sm text-paper/70">{failure}</p>
        <button onClick={() => setFailure("")} className="pill bg-paper px-5 py-3 text-ink hover:bg-lime">
          Try again
        </button>
      </Center>
    );
  }

  if (left) {
    return (
      <Center>
        <p className="display text-4xl">You left the meeting.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button onClick={() => setLeft(false)} className="pill bg-paper px-5 py-3 text-ink hover:bg-lime">
            Rejoin
          </button>
          <Link href="/dashboard/history" className="pill bg-paper/10 px-5 py-3 text-paper hover:bg-paper/20">
            View history
          </Link>
        </div>
      </Center>
    );
  }

  if (!session) return <PreJoin roomId={id} meeting={meeting} onJoin={setSession} />;

  return (
    <LiveKitRoom
      serverUrl={session.url}
      token={session.token}
      connect
      // Devices are turned on one at a time inside <Room>, so a missing or
      // busy camera can't stop the microphone from working (and vice versa)
      audio={false}
      video={false}
      onDisconnected={(reason) => {
        if (userLeft.current) {
          userLeft.current = false;
          setSession(null);
          setLeft(true);
          return;
        }
        // Our own cleanup (e.g. dev-mode remount) — the room reconnects by itself
        if (reason === DisconnectReason.CLIENT_INITIATED || reason === undefined) return;
        setSession(null);
        setFailure(
          reason === DisconnectReason.DUPLICATE_IDENTITY
            ? "You joined this meeting from another tab or device."
            : reason === DisconnectReason.PARTICIPANT_REMOVED
              ? "You were removed from the meeting."
              : `The connection was closed (${DisconnectReason[reason] ?? reason}). Check your network and try again.`,
        );
      }}
      onError={(err) => {
        // A connect attempt we cancelled ourselves isn't a failure
        if (
          (err instanceof ConnectionError && err.reason === ConnectionErrorReason.Cancelled) ||
          /client initiated disconnect/i.test(err.message)
        )
          return;
        // Camera/mic problems are reported inside the room; stay connected
        if (
          ["NotAllowedError", "NotFoundError", "NotReadableError", "OverconstrainedError"].includes(err.name) ||
          /permission denied|device not found|could not start/i.test(err.message)
        )
          return;
        setSession(null);
        setFailure(
          /401|unauthori[sz]ed|invalid|token/i.test(err.message)
            ? "The video server rejected the meeting pass. Check that LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET in .env are the real values from your LiveKit project, then restart the dev server."
            : err.message || "Something went wrong connecting to the video server.",
        );
      }}
      className="h-[100svh] w-full"
    >
      <Room
        roomId={id}
        meeting={meeting}
        session={session}
        onLeave={() => (userLeft.current = true)}
      />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100svh] w-full flex-col items-center justify-center gap-5 bg-ink px-4 text-center text-paper">
      {children}
    </div>
  );
}

/* ------------------------------ Pre-join ------------------------------ */

function PreJoin({
  roomId,
  meeting,
  onJoin,
}: {
  roomId: string;
  meeting: RoomInfo | null;
  onJoin: (s: Session) => void;
}) {
  const user = useCurrentUser();
  const [name, setName] = useState(() => {
    try {
      return user?.name ?? localStorage.getItem(NAME_KEY) ?? "";
    } catch {
      return user?.name ?? "";
    }
  });
  const [audio, setAudio] = useState(true);
  const [video, setVideo] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  // Signed in: start from the profile avatar. Guests: the one remembered on this device.
  const [deviceAvatar] = useState<AvatarSpec>(loadAvatar);
  const [chosenAvatar, setChosenAvatar] = useState<AvatarSpec | null>(null);
  const avatar = chosenAvatar ?? user?.avatar ?? deviceAvatar;
  const [editAvatar, setEditAvatar] = useState(false);
  const preview = useRef<HTMLVideoElement>(null);

  // Devices
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [camId, setCamId] = useState(DEFAULT_DEVICE);
  const [micId, setMicId] = useState(DEFAULT_DEVICE);
  const [camError, setCamError] = useState("");
  const [previewOn, setPreviewOn] = useState(false);
  // bumped by "Try again" to re-request the camera
  const [camAttempt, setCamAttempt] = useState(0);

  function setAvatar(a: AvatarSpec) {
    setChosenAvatar(a);
    saveAvatar(a);
    if (user) void updateProfile({ avatar: a }); // keep the profile in sync
  }

  // Find cameras/mics now and whenever one is plugged in or removed
  useEffect(() => {
    const scan = () =>
      listDevices().then(({ cameras, mics }) => {
        setCameras(cameras);
        setMics(mics);
      });
    scan();
    navigator.mediaDevices?.addEventListener("devicechange", scan);
    return () => navigator.mediaDevices?.removeEventListener("devicechange", scan);
  }, []);

  // Always actually try the camera: the device list alone can't be trusted
  // before permission is granted.
  const wantVideo = video;
  const camChoices = selectable(cameras);
  const micChoices = selectable(mics);

  // Camera preview while deciding
  useEffect(() => {
    if (!wantVideo) return;
    let stream: MediaStream | undefined;
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      queueMicrotask(() =>
        setCamError("This browser can't use a camera here. Use Chrome, Edge or Firefox over https or localhost."),
      );
      return;
    }
    navigator.mediaDevices
      .getUserMedia({
        video: camId !== DEFAULT_DEVICE ? { deviceId: { exact: camId } } : true,
      })
      .then(async (s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (preview.current) preview.current.srcObject = s;
        setCamError("");
        setPreviewOn(true);
        // device names only appear after permission is granted
        const found = await listDevices();
        setCameras(found.cameras);
        setMics(found.mics);
      })
      .catch((err) => {
        if (cancelled) return;
        setPreviewOn(false);
        setCamError(describeMediaError(err, "camera"));
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      setPreviewOn(false);
    };
  }, [wantVideo, camId, camAttempt]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError("Please enter your name.");
    setError("");
    setPending(true);
    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomId, name: n }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't join the meeting.");
      try {
        localStorage.setItem(NAME_KEY, n);
      } catch {}
      onJoin({
        token: data.token,
        url: data.url,
        name: n,
        // still try in the room even if the preview failed — the user may
        // have fixed it since, and the room shows a clear message if not
        video: wantVideo,
        audio,
        camId: camId !== DEFAULT_DEVICE ? camId : undefined,
        micId: micId !== DEFAULT_DEVICE ? micId : undefined,
        avatar,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't join the meeting.");
      setPending(false);
    }
  }

  const start = meeting ? new Date(meeting.start) : null;

  return (
    <div className="flex min-h-[100svh] w-full items-center justify-center bg-ink px-4 py-10 text-paper">
      <div className="grid w-full max-w-5xl grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:items-center">
        <div className="flex flex-col gap-3">
          <div className="relative aspect-video w-full overflow-hidden rounded-[1.25rem] bg-black/40">
            {wantVideo && (
              <video
                ref={preview}
                autoPlay
                playsInline
                muted
                className={`h-full w-full -scale-x-100 object-cover ${previewOn ? "" : "invisible"}`}
              />
            )}
            {(!wantVideo || !previewOn) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 pb-16 text-center">
                <ProfileAvatar name={name || "?"} avatar={avatar} size={96} />
                {wantVideo && camError ? (
                  <>
                    <p className="max-w-sm text-xs text-paper/70">{camError}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setCamError("");
                        setCamAttempt((n) => n + 1);
                      }}
                      className="pill bg-paper text-ink hover:bg-lime"
                    >
                      Try again
                    </button>
                  </>
                ) : wantVideo ? (
                  <p className="text-xs text-paper/60">Starting camera…</p>
                ) : (
                  <p className="text-xs text-paper/60">Camera is off — others will see your avatar.</p>
                )}
              </div>
            )}
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
              <RoundToggle
                on={audio}
                onClick={() => setAudio((a) => !a)}
                label={audio ? "Mute microphone" : "Unmute microphone"}
              >
                {audio ? <Mic size={18} /> : <MicOff size={18} />}
              </RoundToggle>
              <RoundToggle
                on={wantVideo}
                onClick={() => {
                  setCamError("");
                  setVideo((v) => !v);
                }}
                label={video ? "Turn camera off" : "Turn camera on"}
              >
                {wantVideo ? <Video size={18} /> : <VideoOff size={18} />}
              </RoundToggle>
            </div>
          </div>

          {/* Device pickers (only when there's a choice) */}
          {(camChoices.length > 1 || micChoices.length > 1) && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {camChoices.length > 1 && (
                <SelectField
                  tone="dark"
                  ariaLabel="Camera"
                  value={camId}
                  onChange={(v) => {
                    setCamError("");
                    setCamId(v);
                  }}
                  options={[
                    { value: DEFAULT_DEVICE, label: "Default camera" },
                    ...camChoices.map((d, i) => ({ value: d.deviceId, label: d.label || `Camera ${i + 1}` })),
                  ]}
                />
              )}
              {micChoices.length > 1 && (
                <SelectField
                  tone="dark"
                  ariaLabel="Microphone"
                  value={micId}
                  onChange={setMicId}
                  options={[
                    { value: DEFAULT_DEVICE, label: "Default microphone" },
                    ...micChoices.map((d, i) => ({ value: d.deviceId, label: d.label || `Microphone ${i + 1}` })),
                  ]}
                />
              )}
            </div>
          )}
        </div>

        <form onSubmit={join} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-paper/60">Ready to join?</span>
            <h1 className="display text-[clamp(2.2rem,4vw,3.2rem)]">{meeting?.title ?? "MeetHub meeting"}</h1>
            {start && (
              <p className="text-sm text-paper/60">
                {start.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })} · {fmtTime(start)}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="display-name" className="label !text-paper">Your name</label>
            <input
              id="display-name"
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="How others will see you"
              maxLength={40}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="label !mb-0 !text-paper">Your avatar</span>
              <button
                type="button"
                onClick={() => setEditAvatar((o) => !o)}
                aria-expanded={editAvatar}
                className="text-xs text-paper/70 underline underline-offset-4 hover:text-paper"
              >
                {editAvatar ? "Done" : "Customize"}
              </button>
            </div>
            {editAvatar ? (
              <AvatarPicker name={name} value={avatar} onChange={setAvatar} />
            ) : (
              <div className="flex items-center gap-3 text-sm text-paper/70">
                <ProfileAvatar name={name || "?"} avatar={avatar} size={40} />
                Shown when your camera is off
              </div>
            )}
          </div>
          {error && <p role="alert" className="rounded-lg bg-clay/90 px-3 py-2 text-sm text-ink">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="pill w-fit bg-lime px-6 py-3.5 text-ink hover:bg-paper disabled:opacity-60"
          >
            {pending && <Loader2 size={14} className="animate-spin" />} Join now
          </button>
        </form>
      </div>
    </div>
  );
}

function RoundToggle({
  on,
  onClick,
  label,
  disabled,
  children,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
        on ? "bg-paper/15 text-paper backdrop-blur hover:bg-paper/25" : "bg-clay text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/* -------------------------------- Room -------------------------------- */

type Floating = { id: string; emoji: string; name: string; left: number };

function Room({
  roomId,
  meeting,
  session,
  onLeave,
}: {
  roomId: string;
  meeting: RoomInfo | null;
  session: Session;
  onLeave: () => void;
}) {
  const room = useRoomContext();
  const user = useCurrentUser();
  const connection = useConnectionState();
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const [deviceNotice, setDeviceNotice] = useState("");
  const [micBusy, setMicBusy] = useState(false);
  const [camBusy, setCamBusy] = useState(false);

  /* ---- devices: turned on separately so one failing can't block the other ---- */
  const camOpts = session.camId ? { deviceId: session.camId } : undefined;
  const micOpts = session.micId ? { deviceId: session.micId } : undefined;

  async function setMic(on: boolean) {
    setMicBusy(true);
    try {
      await localParticipant.setMicrophoneEnabled(on, micOpts);
      setDeviceNotice("");
    } catch (err) {
      setDeviceNotice(describeMediaError(err, "microphone"));
    } finally {
      setMicBusy(false);
    }
  }

  async function setCam(on: boolean) {
    setCamBusy(true);
    try {
      await localParticipant.setCameraEnabled(on, camOpts);
      setDeviceNotice("");
    } catch (err) {
      setDeviceNotice(describeMediaError(err, "camera"));
    } finally {
      setCamBusy(false);
    }
  }

  // Once connected: start the devices chosen on the pre-join screen and share the avatar
  const started = useRef(false);
  useEffect(() => {
    if (connection !== ConnectionState.Connected || started.current) return;
    started.current = true;
    localParticipant.setAttributes({ avatar: encodeAvatar(session.avatar) }).catch(() => {});
    // after this render, so the busy/notice state updates don't cascade
    queueMicrotask(() => {
      if (session.audio) void setMic(true);
      if (session.video) void setCam(true);
    });
    // run once, when the connection is ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection]);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const screens = tracks.filter(
    (t): t is TrackReference => t.source === Track.Source.ScreenShare && isTrackReference(t),
  );
  const cameras = tracks.filter((t) => t.source === Track.Source.Camera);
  const [pinnedShare, setPinnedShare] = useState<string | null>(null);
  const stage = screens.find((s) => s.participant.identity === pinnedShare) ?? screens[0];

  const [panel, setPanelState] = useState<"chat" | "people" | null>(null);
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState(false);

  /* ---- attendance for the History page (signed-in hosts/invitees only) ---- */
  const meetingId = meeting?.id;
  const userId = user?.id;
  useEffect(() => {
    if (!meetingId || !userId) return;
    let attendanceId: string | null = null;
    let left = false;
    joinMeeting(meetingId).then((aid) => {
      attendanceId = aid;
      // unmounted before the insert finished
      if (left && aid) void leaveMeeting(aid);
    });
    const onUnload = () => attendanceId && void leaveMeeting(attendanceId);
    window.addEventListener("pagehide", onUnload);
    return () => {
      left = true;
      window.removeEventListener("pagehide", onUnload);
      if (attendanceId) void leaveMeeting(attendanceId);
    };
  }, [meetingId, userId]);

  /* ---- chat ---- */
  const { chatMessages, send: sendChatMsg, isSending } = useChat();
  const [seen, setSeen] = useState(0);
  const unread = panel === "chat" ? 0 : chatMessages.length - seen;
  // Opening or closing chat marks everything so far as read
  function setPanel(next: "chat" | "people" | null) {
    if (panel === "chat" || next === "chat") setSeen(chatMessages.length);
    setPanelState(next);
  }
  // Keep a transcript with scheduled meetings so History can show it.
  // Each signed-in participant saves what they see; duplicates are ignored.
  const savedChat = useRef(new Set<string>());
  useEffect(() => {
    if (!meetingId || !userId) return;
    for (const m of chatMessages) {
      if (savedChat.current.has(m.id)) continue;
      savedChat.current.add(m.id);
      void saveChatMessage({
        id: m.id,
        meetingId,
        senderIdentity: m.from?.identity ?? "unknown",
        senderName: m.from?.name || m.from?.identity || "Guest",
        body: m.message,
        sentAt: new Date(m.timestamp).toISOString(),
      });
    }
  }, [chatMessages, meetingId, userId]);

  /* ---- reactions ---- */
  const [floating, setFloating] = useState<Floating[]>([]);
  const encoder = useMemo(() => new TextEncoder(), []);
  function showReaction(emoji: string, name: string) {
    const f = { id: crypto.randomUUID(), emoji, name, left: 10 + Math.random() * 30 };
    setFloating((list) => [...list.slice(-20), f]);
    setTimeout(() => setFloating((list) => list.filter((x) => x.id !== f.id)), 3200);
  }
  const { send: sendData } = useDataChannel("reactions", (msg) => {
    try {
      const { emoji } = JSON.parse(new TextDecoder().decode(msg.payload));
      if (REACTIONS.includes(emoji)) showReaction(emoji, msg.from?.name ?? "Someone");
    } catch {}
  });
  function react(emoji: string) {
    showReaction(emoji, "You");
    sendData(encoder.encode(JSON.stringify({ emoji })), { reliable: true }).catch(() => {});
  }

  /* ---- raise hand (participant attribute, so late joiners see it too) ---- */
  const myHand = useParticipantAttribute("hand", { participant: localParticipant });
  function toggleHand() {
    localParticipant.setAttributes({ hand: myHand ? "" : String(Date.now()) }).catch(() => {
      setToast("Couldn't update your hand. Try again.");
    });
  }

  /* ---- media toggles ---- */
  const share = useTrackToggle({
    source: Track.Source.ScreenShare,
    captureOptions: { audio: true, selfBrowserSurface: "exclude" },
    onDeviceError: () => {}, // picker dismissed
  });

  /* ---- recording ---- */
  const recorder = useTabRecorder({
    title: meeting?.title ?? "MeetHub meeting",
    meetingId: meeting?.id ?? roomId,
    userId: user?.id,
    onMessage: setToast,
  });

  // Tell everyone in the call while you're recording
  useEffect(() => {
    localParticipant.setAttributes({ recording: recorder.recording ? "1" : "" }).catch(() => {});
  }, [recorder.recording, localParticipant]);
  const recorders = participants.filter((p) => p.attributes?.recording);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this link:", window.location.href);
    }
  }

  function leave() {
    recorder.stop();
    onLeave();
    room.disconnect();
  }

  const raisedCount = participants.filter((p) => p.attributes?.hand).length;

  return (
    <div className="flex h-full w-full flex-col bg-ink text-paper">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper">
            <Video size={14} className="text-ink" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{meeting?.title ?? "MeetHub meeting"}</p>
            <p className="text-xs text-paper/60">
              {connection === ConnectionState.Connected
                ? `${participants.length} in call`
                : connection === ConnectionState.Reconnecting
                  ? "Reconnecting…"
                  : "Connecting…"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {recorder.recording ? (
            <span className="chip bg-clay text-ink">
              <span className="h-2 w-2 animate-pulse rounded-full bg-ink" /> REC {fmtClock(recorder.seconds)}
            </span>
          ) : recorders.length > 0 ? (
            <span className="chip bg-clay text-ink" title={`${recorders.map((p) => p.name).join(", ")} is recording`}>
              <span className="h-2 w-2 animate-pulse rounded-full bg-ink" /> {recorders[0].name || "Someone"} is recording
            </span>
          ) : null}
          {raisedCount > 0 && (
            <span className="chip bg-lime text-ink">
              <Hand size={12} /> {raisedCount}
            </span>
          )}
          <button onClick={copyLink} className="pill bg-paper/10 text-paper hover:bg-paper/20">
            {copied ? <Check size={13} /> : <Link2 size={13} />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Invite link"}</span>
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 gap-3 px-3 pb-3 sm:px-4">
        {/* Stage */}
        <div className="relative flex min-w-0 flex-1 flex-col gap-3">
          {stage ? (
            <>
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-[1.25rem] bg-black">
                <VideoTrack trackRef={stage} className="h-full w-full object-contain" />
                <span className="absolute bottom-3 left-3 rounded-full bg-ink/70 px-3 py-1 text-xs">
                  {stage.participant.isLocal ? "You are presenting" : `${stage.participant.name || "Someone"} is presenting`}
                </span>
                {screens.length > 1 && (
                  <div className="absolute right-3 top-3 flex gap-1">
                    {screens.map((s) => (
                      <button
                        key={s.participant.identity}
                        onClick={() => setPinnedShare(s.participant.identity)}
                        className={`rounded-full px-3 py-1 text-xs ${s === stage ? "bg-lime text-ink" : "bg-ink/70"}`}
                      >
                        {s.participant.isLocal ? "You" : s.participant.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex h-28 shrink-0 gap-2 overflow-x-auto">
                {cameras.map((t) => (
                  <div key={t.participant.identity} className="h-full w-44 shrink-0">
                    <Tile trackRef={t} compact />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className={`grid min-h-0 flex-1 auto-rows-fr gap-3 overflow-y-auto ${gridCols(cameras.length)}`}>
              {cameras.map((t) => (
                <Tile key={t.participant.identity} trackRef={t} />
              ))}
            </div>
          )}

          {/* Floating reactions */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            {floating.map((f) => (
              <span
                key={f.id}
                className="animate-rise absolute bottom-6 flex flex-col items-center"
                style={{ left: `${f.left}%` }}
              >
                <span className="text-4xl">{f.emoji}</span>
                <span className="rounded-full bg-ink/70 px-2 py-0.5 text-[10px]">{f.name}</span>
              </span>
            ))}
          </div>

          {deviceNotice && (
            <p className="absolute left-3 top-3 z-10 max-w-[80%] rounded-full bg-ink/80 px-3 py-1.5 text-xs text-paper">
              {deviceNotice}
            </p>
          )}

          {connection !== ConnectionState.Connected && (
            <div className="absolute inset-0 flex items-center justify-center rounded-[1.25rem] bg-ink/70">
              <Loader2 className="animate-spin" />
            </div>
          )}
        </div>

        {/* Side panel */}
        {panel && (
          <aside className="fixed inset-x-3 bottom-24 top-16 z-20 flex flex-col overflow-hidden rounded-[1.25rem] bg-paper text-ink md:static md:w-80 md:shrink-0">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex gap-1">
                {(["chat", "people"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPanel(p)}
                    className={`rounded-full px-3 py-1 text-sm capitalize ${panel === p ? "bg-ink text-paper" : "hover:bg-paper-deep"}`}
                  >
                    {p === "people" ? `People (${participants.length})` : "Chat"}
                  </button>
                ))}
              </div>
              <button onClick={() => setPanel(null)} aria-label="Close panel" className="text-stone hover:text-ink">
                <X size={16} />
              </button>
            </div>
            {panel === "chat" ? (
              <ChatPanel
                messages={chatMessages}
                localIdentity={localParticipant.identity}
                sending={isSending}
                onSend={(t) => sendChatMsg(t).catch(() => setToast("Message failed to send."))}
              />
            ) : (
              <PeoplePanel participants={participants} />
            )}
          </aside>
        )}
      </div>

      {/* Controls */}
      <footer className="flex flex-wrap items-center justify-center gap-2 px-4 pb-5 pt-1">
        <Ctrl label={isMicrophoneEnabled ? "Mute" : "Unmute"} off={!isMicrophoneEnabled} onClick={() => setMic(!isMicrophoneEnabled)} disabled={micBusy}>
          {isMicrophoneEnabled ? <Mic size={18} /> : <MicOff size={18} />}
        </Ctrl>
        <Ctrl label={isCameraEnabled ? "Turn camera off" : "Turn camera on"} off={!isCameraEnabled} onClick={() => setCam(!isCameraEnabled)} disabled={camBusy}>
          {isCameraEnabled ? <Video size={18} /> : <VideoOff size={18} />}
        </Ctrl>
        <Ctrl label={share.enabled ? "Stop presenting" : "Share screen"} active={share.enabled} onClick={() => share.toggle()} disabled={share.pending}>
          <MonitorUp size={18} />
        </Ctrl>
        <ReactionPicker onPick={react} />
        <Ctrl label={myHand ? "Lower hand" : "Raise hand"} active={!!myHand} onClick={toggleHand}>
          <Hand size={18} />
        </Ctrl>
        <Ctrl
          label={recorder.recording ? "Stop recording" : "Record"}
          active={recorder.recording}
          activeClass="bg-clay text-ink"
          onClick={recorder.recording ? recorder.stop : recorder.start}
        >
          {recorder.recording ? <Square size={16} fill="currentColor" /> : <Circle size={18} />}
        </Ctrl>
        <Ctrl label="Chat" active={panel === "chat"} onClick={() => setPanel(panel === "chat" ? null : "chat")}>
          <MessageSquare size={18} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-clay px-1 text-[10px] font-bold text-ink">
              {unread}
            </span>
          )}
        </Ctrl>
        <Ctrl label="People" active={panel === "people"} onClick={() => setPanel(panel === "people" ? null : "people")}>
          <Users size={18} />
        </Ctrl>
        <button
          onClick={leave}
          className="ml-1 flex h-12 items-center gap-2 rounded-full bg-clay px-5 text-sm font-semibold text-ink transition-colors hover:bg-paper"
        >
          <PhoneOff size={16} /> <span className="hidden sm:inline">Leave</span>
        </button>
      </footer>

      {toast && (
        <div role="status" className="fixed bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full bg-lime px-4 py-2 text-sm text-ink shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function gridCols(n: number) {
  if (n <= 1) return "grid-cols-1";
  if (n <= 4) return "grid-cols-1 sm:grid-cols-2";
  if (n <= 9) return "grid-cols-2 lg:grid-cols-3";
  return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";
}

/* ------------------------------- Tiles -------------------------------- */

function Tile({
  trackRef,
  compact = false,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  /** small tiles in the screen-share strip */
  compact?: boolean;
}) {
  const p = trackRef.participant;
  const speaking = useIsSpeaking(p);
  const hand = useParticipantAttribute("hand", { participant: p });
  const avatar = parseAvatar(useParticipantAttribute("avatar", { participant: p }));
  const { isMuted: micMuted } = useTrackMutedIndicator({ participant: p, source: Track.Source.Microphone });
  const hasVideo = isTrackReference(trackRef) && !trackRef.publication.isMuted;
  const name = p.isLocal ? `${p.name || "You"} (you)` : p.name || "Guest";

  return (
    <div
      className={`relative flex h-full min-h-32 items-center justify-center overflow-hidden rounded-[1.25rem] bg-paper/5 transition-shadow ${
        speaking ? "ring-2 ring-lime" : ""
      }`}
    >
      {hasVideo ? (
        <VideoTrack trackRef={trackRef} className={`h-full w-full object-cover ${p.isLocal ? "-scale-x-100" : ""}`} />
      ) : (
        <ProfileAvatar name={p.name || "Guest"} avatar={avatar} size={compact ? 44 : 96} />
      )}
      <span className="absolute bottom-2 left-2 flex max-w-[85%] items-center gap-1.5 truncate rounded-full bg-ink/70 px-2.5 py-1 text-xs">
        {micMuted && <MicOff size={11} className="shrink-0 text-clay" />}
        <span className="truncate">{name}</span>
      </span>
      {hand && (
        <span className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-lime text-ink" title="Hand raised">
          <Hand size={15} />
        </span>
      )}
    </div>
  );
}

/* ------------------------------ Controls ------------------------------ */

function Ctrl({
  label,
  onClick,
  off,
  active,
  activeClass = "bg-lime text-ink",
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  off?: boolean;
  active?: boolean;
  activeClass?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const tone = active ? activeClass : off ? "bg-paper text-ink" : "bg-paper/10 text-paper hover:bg-paper/20";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active || off ? true : false}
      className={`relative flex h-12 w-12 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${tone}`}
    >
      {children}
    </button>
  );
}

function ReactionPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Ctrl label="Send a reaction" active={open} onClick={() => setOpen((o) => !o)}>
        <Smile size={18} />
      </Ctrl>
      {open && (
        <div className="absolute bottom-14 left-1/2 z-30 flex -translate-x-1/2 gap-1 rounded-full bg-paper p-1.5 shadow-lg">
          {REACTIONS.map((e) => (
            <button
              key={e}
              onClick={() => onPick(e)}
              aria-label={`React ${e}`}
              className="flex h-10 w-10 items-center justify-center rounded-full text-2xl transition-transform hover:scale-125 hover:bg-paper-deep"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Panels ------------------------------- */

function ChatPanel({
  messages,
  localIdentity,
  sending,
  onSend,
}: {
  messages: ReturnType<typeof useChat>["chatMessages"];
  localIdentity: string;
  sending: boolean;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  }

  return (
    <>
      <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="m-auto max-w-[14rem] text-center text-sm text-stone">
            No messages yet. Everyone in the call will see what you send.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.from?.identity === localIdentity;
            return (
              <div key={m.id} className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
                <span className="text-[11px] text-stone">
                  {mine ? "You" : m.from?.name || "Guest"} · {fmtTime(new Date(m.timestamp))}
                </span>
                <p
                  className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                    mine ? "rounded-br-sm bg-ink text-paper" : "rounded-bl-sm bg-white"
                  }`}
                >
                  {m.message}
                </p>
              </div>
            );
          })
        )}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-line p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Send a message"
          aria-label="Message"
          className="field !rounded-full !py-2"
          maxLength={2000}
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          aria-label="Send"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-paper disabled:opacity-30"
        >
          <Send size={15} />
        </button>
      </form>
    </>
  );
}

function PeoplePanel({ participants }: { participants: Participant[] }) {
  // raised hands first, in the order they were raised
  const sorted = [...participants].sort((a, b) => {
    const ha = Number(a.attributes?.hand || Infinity);
    const hb = Number(b.attributes?.hand || Infinity);
    return ha - hb;
  });
  return (
    <ul className="flex flex-1 flex-col gap-1 overflow-y-auto p-3 text-sm">
      {sorted.map((p) => (
        <li key={p.identity} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white">
          <ProfileAvatar name={p.name || "Guest"} avatar={parseAvatar(p.attributes?.avatar)} size={30} />
          <span className="min-w-0 flex-1 truncate">
            {p.name || "Guest"} {p.isLocal && <span className="text-stone">(you)</span>}
          </span>
          {p.attributes?.hand && <Hand size={15} className="text-ink" />}
          {!p.isMicrophoneEnabled && <MicOff size={14} className="text-stone" />}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------ Recording ----------------------------- */

/**
 * Records this browser tab (everyone's video as you see it, plus call audio)
 * mixed with your microphone. Free and fully local; the file is saved to
 * History on this device, or downloaded straight away for guests.
 */
function useTabRecorder({
  title,
  meetingId,
  userId,
  onMessage,
}: {
  title: string;
  meetingId: string;
  userId?: string;
  onMessage: (msg: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const t = setInterval(() => setSeconds((Date.now() - started) / 1000), 500);
    return () => clearInterval(t);
  }, [recording]);

  // stop cleanly if the room unmounts mid-recording
  useEffect(() => () => stopRef.current(), []);

  async function start() {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      onMessage("Recording isn't supported in this browser.");
      return;
    }
    let tab: MediaStream;
    try {
      tab = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
        // Chrome: offer "this tab" first so the call is what gets recorded
        preferCurrentTab: true,
        selfBrowserSurface: "include",
      } as DisplayMediaStreamOptions);
    } catch {
      return; // picker dismissed
    }

    let mic: MediaStream | null = null;
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // record without your mic
    }

    // Mix tab audio (other people) + your mic into one track
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    for (const s of [tab, mic]) {
      if (s?.getAudioTracks().length) ctx.createMediaStreamSource(s).connect(dest);
    }
    const out = new MediaStream([...tab.getVideoTracks(), ...dest.stream.getAudioTracks()]);

    const mimeType = pickMimeType();
    const rec = new MediaRecorder(out, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    const startedAt = Date.now();
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      tab.getTracks().forEach((t) => t.stop());
      mic?.getTracks().forEach((t) => t.stop());
      ctx.close();
      setRecording(false);
      const blob = new Blob(chunks, { type: rec.mimeType || "video/webm" });
      if (!blob.size) return;
      if (!userId) {
        // guests have no History page: hand them the file
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${title.replace(/[^\w-]+/g, "-")}.webm`;
        a.click();
        onMessage("Recording downloaded.");
        return;
      }
      try {
        await saveRecording({
          meetingId,
          meetingTitle: title,
          userId,
          duration: (Date.now() - startedAt) / 1000,
          mimeType: blob.type,
          blob,
        });
        onMessage("Recording saved to History.");
      } catch {
        onMessage("Couldn't save the recording (storage full or blocked).");
      }
    };
    // the browser's own "Stop sharing" button ends the recording too
    tab.getVideoTracks()[0]?.addEventListener("ended", () => rec.state === "recording" && rec.stop());

    stopRef.current = () => rec.state === "recording" && rec.stop();
    rec.start(1000);
    setSeconds(0);
    setRecording(true);
    onMessage("Recording started. Everyone in the call can see the REC badge.");
  }

  return { recording, seconds, start, stop: () => stopRef.current() };
}
