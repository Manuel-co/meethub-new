"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, Sparkles } from "lucide-react";
import { logIn, signUp, suggestUsername, useCurrentUser, useDb } from "@/lib/store";
import { logInAsDemo } from "@/lib/demo";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const user = useCurrentUser();
  const db = useDb();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  // Already signed in? Skip straight to the app.
  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  const isSignup = mode === "signup";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    const res = isSignup
      ? await signUp({ name, email, password })
      : await logIn(email, password);
    setPending(false);
    if (!res.ok) setError(res.error);
    // success: the effect above redirects once the session updates
  }

  async function onDemo() {
    setPending(true);
    await logInAsDemo();
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
            {name.trim().length > 1 && (
              <p className="mt-1.5 text-xs text-stone">
                Your booking link: <span className="text-ink">/book/{suggestUsername(name, db.users)}</span>
              </p>
            )}
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
          disabled={pending}
          className="pill mt-2 justify-center bg-ink py-3.5 text-paper hover:bg-clay hover:text-ink disabled:opacity-60"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : null}
          {isSignup ? "Create account" : "Log in"}
          {!pending && <ArrowRight size={14} />}
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-stone">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>

      <button
        type="button"
        onClick={onDemo}
        disabled={pending}
        className="pill justify-center bg-white py-3.5 text-ink hover:bg-lime disabled:opacity-60"
      >
        <Sparkles size={14} /> Explore with a demo account
      </button>

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
