"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { logIn, signUp, useAuth } from "@/lib/store";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const { user, configError } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  // Signed in (now or already)? Go back where they came from (e.g. a meeting
  // link), or to the app. Only same-site paths, never another website.
  useEffect(() => {
    if (!user) return;
    const next = new URLSearchParams(window.location.search).get("next");
    router.replace(next && /^\/(?!\/)/.test(next) ? next : "/dashboard");
  }, [user, router]);

  const isSignup = mode === "signup";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    if (isSignup) {
      const res = await signUp({ name, email, password });
      setPending(false);
      if (!res.ok) return setError(res.error);
      if (res.data.needsConfirmation) setCheckEmail(true);
      // otherwise the session arrives and the effect above redirects
    } else {
      const res = await logIn(email, password);
      setPending(false);
      if (!res.ok) setError(res.error);
    }
  }

  if (checkEmail) {
    return (
      <div className="flex flex-col items-start gap-5">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-lime">
          <MailCheck size={22} />
        </span>
        <h1 className="display text-[2.6rem]">Check your email</h1>
        <p className="text-[15px] text-stone">
          We sent a confirmation link to <span className="text-ink">{email.trim()}</span>. Click it, then
          come back and log in.
        </p>
        <Link href="/login" className="pill bg-ink px-5 py-3 text-paper hover:bg-clay hover:text-ink">
          Go to log in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="display text-[2.6rem]">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="text-[15px] text-stone">
          {isSignup
            ? "Start scheduling in under a minute. No card needed."
            : "Log in to see your meetings and bookings."}
        </p>
      </div>

      {configError && (
        <p role="alert" className="rounded-lg bg-clay/20 px-3 py-2 text-sm">
          {configError}
        </p>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {isSignup && (
          <div>
            <label htmlFor="name" className="label">Full name</label>
            <input
              id="name"
              className="field"
              autoComplete="name"
              placeholder="Ada Lovelace"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <p className="mt-1.5 text-xs text-stone">Your booking link is made from your name.</p>
          </div>
        )}

        <div>
          <label htmlFor="email" className="label">Email</label>
          <input
            id="email"
            type="email"
            className="field"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="label">Password</label>
          <div className="relative">
            <input
              id="password"
              type={showPw ? "text" : "password"}
              className="field pr-11"
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder={isSignup ? "At least 8 characters" : "••••••••"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone hover:text-ink"
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-clay/20 px-3 py-2 text-sm text-ink">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || Boolean(configError)}
          className="pill mt-2 justify-center bg-ink py-3.5 text-paper hover:bg-clay hover:text-ink disabled:opacity-60"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : null}
          {isSignup ? "Create account" : "Log in"}
          {!pending && <ArrowRight size={14} />}
        </button>
      </form>

      <p className="text-center text-sm text-stone">
        {isSignup ? "Already have an account? " : "New to MeetHub? "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="font-medium text-ink underline underline-offset-4 hover:text-clay"
        >
          {isSignup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
