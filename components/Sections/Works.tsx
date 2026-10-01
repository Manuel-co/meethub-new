import Image from "next/image";
import { CalendarCheck, UserPlus, Lightbulb } from "lucide-react";

const steps = [
  {
    number: "01",
    tag: "Schedule",
    icon: CalendarCheck,
    title: "Pick a time that works for everyone, in every time zone.",
    body: "Share your availability, let teammates choose a slot, and MeetHub syncs it straight to their calendars.",
    cta: "Schedule a meeting",
    image: "/Features1.png",
    panel: "bg-sage text-ink",
    chip: "bg-paper text-ink",
    button: "bg-ink text-paper hover:bg-paper hover:text-ink",
  },
  {
    number: "02",
    tag: "Invite",
    icon: UserPlus,
    title: "Bring people in with a single link, no account needed.",
    body: "Send email invites or share a link. Guests join from any device in seconds.",
    cta: "Invite participants",
    image: "/herofemale.png",
    panel: "bg-clay text-ink",
    chip: "bg-paper text-ink",
    button: "bg-ink text-paper hover:bg-paper hover:text-ink",
  },
  {
    number: "03",
    tag: "Collaborate",
    icon: Lightbulb,
    title: "Share ideas together on video, chat, and whiteboard.",
    body: "Everything a productive meeting needs, side by side, so ideas never get lost between apps.",
    cta: "Start collaborating",
    image: "/heromale.png",
    panel: "bg-ink text-paper",
    chip: "bg-lime text-ink",
    button: "bg-paper text-ink hover:bg-lime",
  },
];

export default function Works() {
  return (
    <section id="how-it-works" className="relative w-full">
      {steps.map((s) => {
        const Icon = s.icon;
        return (
          <article
            key={s.number}
            className={`sticky top-0 flex min-h-[100svh] w-full items-center ${s.panel}`}
          >
            <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-10 px-4 py-24 sm:px-8 md:grid-cols-12 md:items-center">
              {/* Side index */}
              <div className="flex flex-col gap-3 md:col-span-2">
                <span className="text-sm">{s.number}</span>
                <span className="h-px w-full bg-current opacity-30" />
                <span className="text-sm">How it works</span>
              </div>

              {/* Copy */}
              <div className="flex flex-col items-start gap-6 md:col-span-5">
                <span className={`chip ${s.chip}`}>
                  <Icon size={12} /> {s.tag}
                </span>
                <h2 className="display text-[clamp(2rem,4vw,3.4rem)]">{s.title}</h2>
                <p className="max-w-md text-[15px] leading-relaxed opacity-80">{s.body}</p>
                <a href="/signup" className={`pill px-5 py-3 ${s.button}`}>
                  {s.cta}
                </a>
              </div>

              {/* Image */}
              <div className="relative aspect-[4/5] w-full overflow-hidden md:col-span-4 md:col-start-9">
                <Image
                  src={s.image}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 30vw, 100vw"
                  className="object-cover"
                />
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
