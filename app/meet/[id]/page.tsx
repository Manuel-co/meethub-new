"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import {
  Circle,
  Info,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Send,
  Square,
  Users,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import Avatar from "@/components/app/Avatar";
import { useNow } from "@/components/app/useNow";
import {
  PRESENCE_TTL_MS,
  canAccess,
  heartbeat,
  joinMeeting,
  leaveMeeting,
  sendChat,
  useCurrentUser,
  useHydrated,
  useMeeting,
  type Meeting,
  type User,
} from "@/lib/store";
import { fmtClock, pickMimeType, saveRecording } from "@/lib/recordings";
import { fmtTime } from "@/lib/format";

export default function MeetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const hydrated = useHydrated();
  const user = useCurrentUser();
  const meeting = useMeeting(id);

  if (!hydrated) return <Center>Loading…</Center>;

  if (!user) {
    return (
      <Center>
        <p className="display text-3xl">Log in to join this meeting.</p>
        <Link href="/login" className="pill bg-paper text-ink hover:bg-lime">Log in</Link>
      </Center>
    );
  }

  if (!meeting || !canAccess(meeting, user) || meeting.status === "cancelled") {
    return (
      <Center>
        <p className="display text-3xl">
          {meeting?.status === "cancelled" ? "This meeting was cancelled." : "Meeting not found."}
        </p>
        <p className="text-sm text-paper/60">
          {meeting ? "" : "The link may be wrong, or you weren't invited."}
        </p>
        <Link href="/dashboard" className="pill bg-paper text-ink hover:bg-lime">Back to dashboard</Link>
      </Center>
    );
  }

  return <Room meeting={meeting} user={user} />;
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100svh] w-full flex-col items-center justify-center gap-4 bg-ink px-4 text-center text-paper">
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Room({ meeting, user }: { meeting: Meeting; user: User }) {
  const router = useRouter();
  const now = useNow(5_000);

  // media
  const camRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const stageVideo = useRef<HTMLVideoElement>(null);
  const selfVideo = useRef<HTMLVideoElement>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [hasCam, setHasCam] = useState(false);
  const [hasMic, setHasMic] = useState(false);

  // recording
  const recorderRef = useRef<MediaRecorder | null>(null);
  const stopDrawRef = useRef<() => void>(() => {});
  const [recording, setRecording] = useState(false);
  const [recStart, setRecStart] = useState(0);
  const [recSeconds, setRecSeconds] = useState(0);
  const [toast, setToast] = useState("");

  // panels
  const [panel, setPanel] = useState<"chat" | "people" | null>("chat");
  // A fresh id per visit, created up front so render can use it
  const [attendanceId] = useState(() => crypto.randomUUID());

  /* ---- join / presence ---- */
  useEffect(() => {
    const aid = attendanceId;
    joinMeeting(meeting.id, user, aid);
    const beat = setInterval(() => heartbeat(meeting.id, aid), 8_000);
    const onUnload = () => leaveMeeting(meeting.id, aid);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      clearInterval(beat);
      window.removeEventListener("beforeunload", onUnload);
      leaveMeeting(meeting.id, aid);
    };
    // join once per meeting/user
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting.id, user.id]);

  /* ---- camera + mic ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        camRef.current = stream;
        setHasCam(true);
        setHasMic(true);
      } catch {
        // try audio only, then nothing
        try {
          const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (cancelled) return audio.getTracks().forEach((t) => t.stop());
          camRef.current = audio;
          setHasMic(true);
          setCamOn(false);
          setMediaError("No camera access — you're joining with audio only.");
        } catch {
          setCamOn(false);
          setMicOn(false);
          setMediaError("Camera and microphone are blocked. Allow access in your browser to use them.");
        }
      }
    })();
    return () => {
      cancelled = true;
      camRef.current?.getTracks().forEach((t) => t.stop());
      screenRef.current?.getTracks().forEach((t) => t.stop());
      stopDrawRef.current();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    };
  }, []);

  // Put the right streams on the stage and the self-view tile
  useEffect(() => {
    const screen = screenRef.current;
    const cam = camRef.current;
    if (stageVideo.current) stageVideo.current.srcObject = screen ?? cam;
    if (selfVideo.current) selfVideo.current.srcObject = screen ? cam : null;
  }, [sharing, hasCam, camOn]);

  function toggleMic() {
    const next = !micOn;
    camRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
  }

  function toggleCam() {
    const next = !camOn;
    camRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
    setCamOn(next);
  }

  async function toggleShare() {
    if (sharing) return stopShare();
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenRef.current = stream;
      // user clicked the browser's own "Stop sharing"
      stream.getVideoTracks()[0].addEventListener("ended", stopShare);
      setSharing(true);
    } catch {
      // picker dismissed — nothing to do
    }
  }

  function stopShare() {
    screenRef.current?.getTracks().forEach((t) => t.stop());
    screenRef.current = null;
    setSharing(false);
  }

  /* ---- recording ---- */
  // We draw the stage onto a canvas and record that, so the recording follows
  // whatever is on stage (camera, screen share, or the avatar when camera is off).
  function startRecording() {
    if (typeof MediaRecorder === "undefined") {
      setToast("Recording isn't supported in this browser.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d")!;
    const draw = () => {
      const v = stageVideo.current;
      ctx.fillStyle = "#241f21";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const showVideo = v && v.videoWidth > 0 && (screenRef.current || camOnRef.current);
      if (showVideo) {
        const scale = Math.min(canvas.width / v.videoWidth, canvas.height / v.videoHeight);
        const w = v.videoWidth * scale;
        const h = v.videoHeight * scale;
        ctx.drawImage(v, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      } else {
        ctx.fillStyle = "#e8e47a";
        ctx.beginPath();
        ctx.arc(640, 330, 90, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#241f21";
        ctx.font = "500 64px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(user.name.split(" ").map((p) => p[0]).join("").slice(0, 2), 640, 334);
      }
      ctx.fillStyle = "rgba(242,239,234,0.85)";
      ctx.font = "20px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(`${meeting.title} · ${user.name}`, 28, 692);
    };
    // setInterval keeps drawing even when the tab is in the background
    const timer = setInterval(draw, 1000 / 30);
    stopDrawRef.current = () => clearInterval(timer);

    const out = canvas.captureStream(30);
    camRef.current?.getAudioTracks().forEach((t) => out.addTrack(t));

    const mimeType = pickMimeType();
    const rec = new MediaRecorder(out, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    const started = Date.now();
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      stopDrawRef.current();
      const blob = new Blob(chunks, { type: rec.mimeType || "video/webm" });
      try {
        await saveRecording({
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          userId: user.id,
          duration: (Date.now() - started) / 1000,
          mimeType: blob.type,
          blob,
        });
        setToast("Recording saved to History.");
      } catch {
        setToast("Couldn't save the recording (storage full or blocked).");
      }
    };
    rec.start(1000);
    recorderRef.current = rec;
    setRecStart(started);
    setRecording(true);
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  // camOn is read inside the draw loop, so mirror it in a ref
  const camOnRef = useRef(camOn);
  useEffect(() => {
    camOnRef.current = camOn;
  }, [camOn]);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setRecSeconds((Date.now() - recStart) / 1000), 500);
    return () => clearInterval(t);
  }, [recording, recStart]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // warn before closing the tab mid-recording
  useEffect(() => {
    if (!recording) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [recording]);

  function leave() {
    if (recording) stopRecording();
    router.push("/dashboard/history");
  }

  /* ---- people in the room (other tabs/devices sharing this storage) ---- */
  const present = (meeting.attendance ?? []).filter(
    (a) =>
      !a.leftAt &&
      a.id !== attendanceId &&
      now.getTime() - new Date(a.seenAt).getTime() < PRESENCE_TTL_MS,
  );

  const start = new Date(meeting.start);
  const showStageVideo = sharing || (camOn && hasCam);

  return (
    <div className="flex h-[100svh] w-full flex-col bg-ink text-paper">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/dashboard" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper" aria-label="MeetHub dashboard">
            <Video size={14} className="text-ink" />
          </Link>
          <div className="min-w-0">
            <p className="truncate font-medium">{meeting.title}</p>
            <p className="text-xs text-paper/60">
              {fmtTime(start)} · {meeting.duration} min
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {recording && (
            <span className="chip bg-clay text-ink">
              <span className="h-2 w-2 animate-pulse rounded-full bg-ink" /> REC {fmtClock(recSeconds)}
            </span>
          )}
          <span className="chip bg-paper/10 text-paper">
            <Users size={12} /> {present.length + 1}
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3 sm:px-4">
        {/* Stage */}
        <div className="relative flex min-w-0 flex-1 flex-col gap-3">
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[1.25rem] bg-black/40">
            <video
              ref={stageVideo}
              autoPlay
              playsInline
              muted
              className={`h-full w-full ${sharing ? "object-contain" : "object-cover"} ${
                showStageVideo ? "" : "invisible"
              } ${!sharing ? "-scale-x-100" : ""}`}
            />
            {!showStageVideo && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <Avatar name={user.name} size={96} />
                <p className="text-sm text-paper/60">Camera is off</p>
              </div>
            )}
            <span className="absolute bottom-3 left-3 rounded-full bg-ink/70 px-3 py-1 text-xs">
              {sharing ? "You are presenting" : `${user.name} (you)`}
              {!micOn && " · muted"}
            </span>

            {/* self view while sharing */}
            {sharing && (
              <div className="absolute bottom-3 right-3 h-28 w-44 overflow-hidden rounded-xl bg-ink ring-1 ring-paper/20">
                {camOn && hasCam ? (
                  <video ref={selfVideo} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center"><Avatar name={user.name} size={44} /></div>
                )}
              </div>
            )}
          </div>

          {/* Other participants */}
          {present.length > 0 && (
            <div className="flex gap-2 overflow-x-auto">
              {present.map((p) => (
                <div key={p.id} className="flex h-20 w-36 shrink-0 flex-col items-center justify-center gap-1 rounded-xl bg-paper/10">
                  <Avatar name={p.name} size={32} />
                  <span className="max-w-full truncate px-2 text-xs">{p.name}</span>
                </div>
              ))}
            </div>
          )}

          {mediaError && (
            <p className="flex items-center gap-2 rounded-xl bg-paper/10 px-3 py-2 text-xs text-paper/80">
              <Info size={14} className="shrink-0" /> {mediaError}
            </p>
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
                    {p}
                  </button>
                ))}
              </div>
              <button onClick={() => setPanel(null)} aria-label="Close panel" className="text-stone hover:text-ink">
                <X size={16} />
              </button>
            </div>
            {panel === "chat" ? (
              <Chat meeting={meeting} user={user} />
            ) : (
              <People meeting={meeting} user={user} present={present.map((p) => p.userId)} />
            )}
          </aside>
        )}
      </div>

      {/* Controls */}
      <footer className="flex items-center justify-center gap-2 px-4 pb-5 pt-1">
        <CtrlButton on={micOn} onClick={toggleMic} label={micOn ? "Mute" : "Unmute"} disabled={!hasMic}>
          {micOn ? <Mic size={18} /> : <MicOff size={18} />}
        </CtrlButton>
        <CtrlButton on={camOn} onClick={toggleCam} label={camOn ? "Turn camera off" : "Turn camera on"} disabled={!hasCam}>
          {camOn ? <Video size={18} /> : <VideoOff size={18} />}
        </CtrlButton>
        <CtrlButton on={!sharing} active={sharing} onClick={toggleShare} label={sharing ? "Stop sharing" : "Share screen"}>
          <MonitorUp size={18} />
        </CtrlButton>
        <CtrlButton
          on={!recording}
          active={recording}
          activeClass="bg-clay text-ink"
          onClick={recording ? stopRecording : startRecording}
          label={recording ? "Stop recording" : "Record"}
        >
          {recording ? <Square size={16} fill="currentColor" /> : <Circle size={18} />}
        </CtrlButton>
        <CtrlButton on={panel !== "chat"} active={panel === "chat"} onClick={() => setPanel(panel === "chat" ? null : "chat")} label="Chat">
          <MessageSquare size={18} />
        </CtrlButton>
        <button
          onClick={leave}
          className="ml-2 flex h-12 items-center gap-2 rounded-full bg-clay px-5 text-sm font-semibold text-ink transition-colors hover:bg-paper"
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

function CtrlButton({
  on,
  active,
  activeClass = "bg-lime text-ink",
  label,
  disabled,
  onClick,
  children,
}: {
  on: boolean;
  active?: boolean;
  activeClass?: string;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const tone = active ? activeClass : on ? "bg-paper/10 text-paper hover:bg-paper/20" : "bg-paper text-ink";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active ?? !on}
      className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors disabled:opacity-30 ${tone}`}
    >
      {children}
    </button>
  );
}

function Chat({ meeting, user }: { meeting: Meeting; user: User }) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const messages = meeting.chat ?? [];

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    sendChat(meeting.id, user, text);
    setText("");
  }

  return (
    <>
      <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="m-auto max-w-[14rem] text-center text-sm text-stone">
            No messages yet. Say hello — chat is saved with the meeting.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.userId === user.id;
            return (
              <div key={m.id} className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
                <span className="text-[11px] text-stone">
                  {mine ? "You" : m.name} · {fmtTime(new Date(m.at))}
                </span>
                <p
                  className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                    mine ? "rounded-br-sm bg-ink text-paper" : "rounded-bl-sm bg-white"
                  }`}
                >
                  {m.text}
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
          disabled={!text.trim()}
          aria-label="Send"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-paper disabled:opacity-30"
        >
          <Send size={15} />
        </button>
      </form>
    </>
  );
}

function People({ meeting, user, present }: { meeting: Meeting; user: User; present: string[] }) {
  const invited = meeting.guest ? [meeting.guest.email] : meeting.invitees;
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 text-sm">
      <div className="flex flex-col gap-2">
        <span className="text-xs text-stone">In the room</span>
        <div className="flex items-center gap-2">
          <Avatar name={user.name} size={28} /> {user.name} <span className="text-stone">(you)</span>
        </div>
        {(meeting.attendance ?? [])
          .filter((a) => present.includes(a.userId) && a.userId !== user.id)
          .filter((a, i, arr) => arr.findIndex((b) => b.userId === a.userId) === i)
          .map((a) => (
            <div key={a.id} className="flex items-center gap-2">
              <Avatar name={a.name} size={28} /> {a.name}
            </div>
          ))}
      </div>
      {invited.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs text-stone">Invited</span>
          {invited.map((e) => (
            <div key={e} className="flex items-center gap-2 text-stone">
              <Avatar name={e} size={28} /> {e}
            </div>
          ))}
        </div>
      )}
      <p className="mt-auto rounded-xl bg-paper-deep p-3 text-xs text-stone">
        Demo note: live video between people needs a real-time server (WebRTC). Right now
        only your own camera and screen are shown; presence and chat sync across tabs.
      </p>
    </div>
  );
}
