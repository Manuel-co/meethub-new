import { Video } from "lucide-react";
import type { SVGProps } from "react";

const links = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Testimonials", href: "#testimonials" },
  { label: "FAQ", href: "#faq" },
];

// lucide-react no longer ships brand icons, so these are inline SVGs.
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const filled = ({ size = 18, ...props }: IconProps) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "currentColor",
  "aria-hidden": true,
  ...props,
});

const Facebook = (p: IconProps) => (
  <svg {...filled(p)}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const X = (p: IconProps) => (
  <svg {...filled(p)}>
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
  </svg>
);

const Linkedin = (p: IconProps) => (
  <svg {...filled(p)}>
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const Instagram = ({ size = 18, ...props }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    aria-hidden
    {...props}
  >
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const Youtube = (p: IconProps) => (
  <svg {...filled(p)}>
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const socials = [
  { label: "Facebook", Icon: Facebook },
  { label: "X (Twitter)", Icon: X },
  { label: "LinkedIn", Icon: Linkedin },
  { label: "Instagram", Icon: Instagram },
  { label: "YouTube", Icon: Youtube },
];

export default function Footer() {
  return (
    <footer className="relative z-10 w-full overflow-hidden bg-ink px-4 pt-24 text-paper sm:px-8">
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-12">
        {/* Closing CTA */}
        <div className="flex flex-col items-start gap-8 md:col-span-7">
          <h2 className="display text-[clamp(2.25rem,5vw,4.25rem)]">
            Ready when your team is.
          </h2>
          <a href="/signup" className="pill bg-paper px-5 py-3 text-ink hover:bg-lime">
            Schedule your first meeting
          </a>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 gap-8 md:col-span-4 md:col-start-9">
          <div className="flex flex-col gap-3">
            <span className="text-sm text-paper/50">Explore</span>
            <ul className="flex flex-col gap-2">
              {links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="text-sm transition-colors hover:text-lime">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-sm text-paper/50">Follow</span>
            <div className="flex flex-wrap gap-3">
              {socials.map(({ label, Icon }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="text-paper/70 transition-colors hover:text-lime"
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mx-auto mt-20 flex max-w-[1440px] items-center justify-between border-t border-paper/15 py-5 text-xs text-paper/50">
        <span>© {new Date().getFullYear()} MeetHub</span>
        <a href="#" className="hover:text-paper">Back to top ↑</a>
      </div>

      {/* Oversized wordmark */}
      <div
        aria-hidden
        className="mx-auto flex max-w-[1440px] select-none items-end gap-[0.06em] pb-4 text-[clamp(4rem,19vw,17rem)] font-medium leading-[0.8] tracking-[-0.07em]"
      >
        <span className="mb-[0.08em] flex h-[0.62em] w-[0.62em] shrink-0 items-center justify-center rounded-[0.1em] bg-paper">
          <Video className="h-[0.32em] w-[0.32em] text-ink" strokeWidth={2.25} />
        </span>
        MeetHub
      </div>
    </footer>
  );
}
