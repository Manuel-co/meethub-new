import Image from "next/image";
import { ArrowDown, ArrowUpRight, Video, Mail, MessageSquare, Monitor } from "lucide-react";

const features = [
  {
    icon: Video,
    label: "Virtual meetings",
    body: "Crisp HD video for up to 500 people, with screen share and recording built in.",
  },
  {
    icon: Mail,
    label: "Email & calendar",
    body: "Invites, reminders, and RSVPs that land in the calendars your team already uses.",
  },
  {
    icon: MessageSquare,
    label: "Team chat",
    body: "Keep the conversation going before, during, and after every call.",
  },
  {
    icon: Monitor,
    label: "Online whiteboard",
    body: "Sketch, map, and vote on ideas together in real time.",
  },
];

export default function Features() {
  return (
    <section id="features" className="relative z-10 w-full bg-paper px-4 py-28 sm:px-8">
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-x-8 gap-y-14 md:grid-cols-12">
        {/* Intro */}
        <div className="flex flex-col gap-2 md:col-span-3">
          <span className="text-sm">MeetHub</span>
          <span className="text-sm text-stone">Features</span>
        </div>
        <div className="flex flex-col gap-6 md:col-span-9">
          <h2 className="display max-w-4xl text-[clamp(2.25rem,5vw,4.25rem)]">
            Where scheduling meets versatility.
          </h2>
          <p className="max-w-lg text-[15px] leading-relaxed text-stone">
            Tools for seamless collaboration, efficient planning, and successful
            virtual engagements across every kind of meeting.
          </p>
        </div>

        {/* Image */}
        <div className="relative md:col-span-5">
          <div className="relative aspect-[4/5] w-full overflow-hidden bg-paper-deep">
            <Image
              src="/Features1.png"
              alt="A team collaborating on a MeetHub call"
              fill
              sizes="(min-width: 768px) 40vw, 100vw"
              className="object-cover"
            />
          </div>
          <span className="chip absolute left-4 top-4 bg-lime text-ink">
            <Monitor size={12} /> Live now
          </span>
        </div>

        {/* Feature rows */}
        <div className="flex flex-col md:col-span-6 md:col-start-7">
          <span className="mb-6 flex items-center gap-1.5 text-sm text-stone">
            Everything in one place <ArrowDown size={12} />
          </span>
          <ul className="border-t border-line">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <li
                  key={f.label}
                  className="group grid grid-cols-[3rem_1fr_auto] items-start gap-4 border-b border-line py-7"
                >
                  <span className="pt-1 text-sm text-stone">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex flex-col gap-2">
                    <h3 className="display flex items-center gap-3 text-2xl sm:text-3xl">
                      <Icon size={20} strokeWidth={1.5} className="shrink-0" />
                      {f.label}
                    </h3>
                    <p className="max-w-md text-[15px] leading-relaxed text-stone">
                      {f.body}
                    </p>
                  </div>
                  <ArrowUpRight
                    size={18}
                    className="mt-1 text-stone transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink"
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
