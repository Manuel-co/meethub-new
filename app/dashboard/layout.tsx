"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { CalendarPlus, Clock, ExternalLink, History, LayoutGrid, LogOut } from "lucide-react";
import Logo from "@/components/app/Logo";
import Avatar from "@/components/app/Avatar";
import { logOut, useCurrentUser, useHydrated } from "@/lib/store";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/dashboard/schedule", label: "Schedule", icon: CalendarPlus },
  { href: "/dashboard/availability", label: "Availability", icon: Clock },
  { href: "/dashboard/history", label: "History", icon: History },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const user = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (hydrated && !user) router.replace("/login");
  }, [hydrated, user, router]);

  if (!hydrated || !user) {
    return (
      <div className="flex min-h-[100svh] w-full items-center justify-center text-sm text-stone">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-[100svh] w-full flex-col md:flex-row">
      <aside className="flex flex-col gap-4 border-b border-line bg-paper px-4 py-4 md:sticky md:top-0 md:h-[100svh] md:w-64 md:shrink-0 md:gap-8 md:border-b-0 md:border-r md:px-5 md:py-6">
        <div className="flex items-center justify-between">
          <Logo href="/dashboard" />
          <button
            onClick={logOut}
            className="text-stone hover:text-ink md:hidden"
            aria-label="Log out"
          >
            <LogOut size={18} />
          </button>
        </div>

        <nav className="-mx-1 flex gap-1 overflow-x-auto md:mx-0 md:flex-col">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex shrink-0 items-center gap-2.5 rounded-full px-3.5 py-2 text-sm transition-colors ${
                  active ? "bg-ink text-paper" : "text-ink hover:bg-white"
                }`}
              >
                <Icon size={16} strokeWidth={1.75} />
                {label}
              </Link>
            );
          })}
          <a
            href={`/book/${user.username}`}
            target="_blank"
            rel="noreferrer"
            className="flex shrink-0 items-center gap-2.5 rounded-full px-3.5 py-2 text-sm text-ink transition-colors hover:bg-white"
          >
            <ExternalLink size={16} strokeWidth={1.75} />
            Booking page
          </a>
        </nav>

        <div className="mt-auto hidden items-center gap-3 rounded-2xl bg-white p-3 md:flex">
          <Avatar name={user.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-stone">{user.email}</p>
          </div>
          <button onClick={logOut} className="text-stone hover:text-ink" aria-label="Log out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-12 lg:py-10">{children}</main>
    </div>
  );
}
