import { Video } from "lucide-react";

const links = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Testimonials", href: "#testimonials" },
  { label: "FAQ", href: "#faq" },
];

export default function Nav() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-8">
        {/* Wordmark */}
        <a href="#" className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink">
            <Video size={13} className="text-paper" strokeWidth={2.25} />
          </span>
          <span className="text-lg font-medium tracking-[-0.04em] text-ink">
            MeetHub
          </span>
        </a>

        {/* Pill links */}
        <ul className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="pill bg-white text-ink hover:bg-ink hover:text-paper"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Auth */}
        <div className="flex items-center gap-1">
          <a href="/login" className="pill bg-white text-ink hover:bg-paper-deep">
            Sign in
          </a>
          <a href="/signup" className="pill bg-ink text-paper hover:bg-clay hover:text-ink">
            Sign up
          </a>
        </div>
      </div>
    </nav>
  );
}
