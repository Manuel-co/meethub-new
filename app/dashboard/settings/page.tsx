"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Check, Loader2, Trash2 } from "lucide-react";
import AvatarPicker from "@/components/app/AvatarPicker";
import { deleteAccount, updateProfile, useCurrentUser, useMyMeetings } from "@/lib/store";
import { deleteAllRecordings } from "@/lib/recordings";
import { encodeAvatar, randomAvatar, saveAvatar, type AvatarSpec } from "@/lib/avatar";

export default function SettingsPage() {
  const user = useCurrentUser()!;
  const router = useRouter();
  const meetings = useMyMeetings();
  const hosted = meetings.filter((m) => m.hostId === user.id).length;

  /* ---- profile ---- */
  const [name, setName] = useState(user.name);
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const nameDirty = name.trim() !== user.name && name.trim().length > 0;

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (n.length < 2) return setNameMsg({ ok: false, text: "Please enter your full name." });
    setSavingName(true);
    const res = await updateProfile({ name: n.slice(0, 80) });
    setSavingName(false);
    setNameMsg(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.error });
  }

  /* ---- avatar ---- */
  const [avatar, setAvatar] = useState<AvatarSpec>(() => user.avatar ?? randomAvatar());
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const avatarDirty = !user.avatar || encodeAvatar(avatar) !== encodeAvatar(user.avatar);

  async function saveAvatarToProfile() {
    setSavingAvatar(true);
    const res = await updateProfile({ avatar });
    setSavingAvatar(false);
    if (res.ok) saveAvatar(avatar); // also the default in meeting rooms on this device
    setAvatarMsg(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.error });
  }

  /* ---- delete account ---- */
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const confirmed = confirmText.trim().toLowerCase() === user.email.toLowerCase();

  async function onDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmed) return;
    setDeleting(true);
    setDeleteError("");
    const userId = user.id;
    const res = await deleteAccount();
    if (!res.ok) {
      setDeleting(false);
      return setDeleteError(res.error);
    }
    // recordings live on this device only
    await deleteAllRecordings(userId).catch(() => {});
    router.replace("/?deleted=1");
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 pb-16">
      <header className="flex flex-col gap-2">
        <span className="text-sm text-stone">Account</span>
        <h1 className="display text-[clamp(2.2rem,4vw,3.4rem)]">Settings</h1>
      </header>

      {/* Profile */}
      <section className="panel flex flex-col gap-6 p-6 sm:p-8">
        <h2 className="text-xl tracking-[-0.02em]">Profile</h2>
        <form onSubmit={saveName} className="flex flex-col gap-4">
          <div>
            <label htmlFor="s-name" className="label">Display name</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="s-name"
                className="field"
                value={name}
                maxLength={80}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameMsg(null);
                }}
              />
              <button
                type="submit"
                disabled={!nameDirty || savingName}
                className="pill shrink-0 justify-center bg-ink px-5 py-3 text-paper hover:bg-clay hover:text-ink disabled:pointer-events-none disabled:opacity-40"
              >
                {savingName ? <Loader2 size={13} className="animate-spin" /> : null}
                Save
              </button>
            </div>
            {nameMsg && (
              <p className={`mt-1.5 flex items-center gap-1 text-xs ${nameMsg.ok ? "text-stone" : "text-ink"}`}>
                {nameMsg.ok && <Check size={12} />} {nameMsg.text}
              </p>
            )}
          </div>
        </form>

        <dl className="grid grid-cols-1 gap-4 border-t border-line pt-6 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-stone">Email</dt>
            <dd className="mt-1 break-all">{user.email}</dd>
          </div>
          <div>
            <dt className="text-stone">Booking link</dt>
            <dd className="mt-1 break-all">/book/{user.username}</dd>
          </div>
        </dl>
      </section>

      {/* Avatar */}
      <section className="panel flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl tracking-[-0.02em]">Avatar</h2>
          <p className="text-sm text-stone">
            Shown on your booking page, in your dashboard, and in meetings when your camera is off.
          </p>
        </div>
        <AvatarPicker
          tone="light"
          name={user.name}
          value={avatar}
          onChange={(a) => {
            setAvatar(a);
            setAvatarMsg(null);
          }}
        />
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <button
            type="button"
            onClick={saveAvatarToProfile}
            disabled={!avatarDirty || savingAvatar}
            className="pill bg-ink px-5 py-3 text-paper hover:bg-clay hover:text-ink disabled:pointer-events-none disabled:opacity-40"
          >
            {savingAvatar ? <Loader2 size={13} className="animate-spin" /> : null}
            Save avatar
          </button>
          {avatarMsg && (
            <p className={`flex items-center gap-1 text-sm ${avatarMsg.ok ? "text-stone" : "text-ink"}`}>
              {avatarMsg.ok && <Check size={13} />} {avatarMsg.text}
            </p>
          )}
        </div>
      </section>

      {/* Danger zone */}
      <section className="flex flex-col gap-5 rounded-[1.25rem] border border-clay/60 bg-clay/10 p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-xl tracking-[-0.02em]">
            <AlertTriangle size={18} /> Delete account
          </h2>
          <p className="max-w-xl text-sm text-stone">
            {`This permanently deletes your account, your booking page, and the ${
              hosted === 1 ? "1 meeting" : `${hosted} meetings`
            } you host — including their chat history.`} Meeting links you&apos;ve shared will stop working. Recordings saved on this
            device are removed too. This can&apos;t be undone.
          </p>
        </div>

        {!confirmOpen ? (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="pill w-fit bg-white px-5 py-3 text-ink ring-1 ring-clay hover:bg-clay"
          >
            <Trash2 size={13} /> Delete my account
          </button>
        ) : (
          <form onSubmit={onDelete} className="flex flex-col gap-4">
            <div>
              <label htmlFor="confirm-email" className="label">
                Type your email <span className="font-normal text-stone">({user.email})</span> to confirm
              </label>
              <input
                id="confirm-email"
                className="field"
                autoComplete="off"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoFocus
              />
            </div>
            {deleteError && (
              <p role="alert" className="rounded-lg bg-white px-3 py-2 text-sm">
                {deleteError}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={!confirmed || deleting}
                className="pill bg-ink px-5 py-3 text-paper hover:bg-clay hover:text-ink disabled:pointer-events-none disabled:opacity-40"
              >
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Permanently delete account
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmText("");
                  setDeleteError("");
                }}
                className="text-sm text-stone hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
