"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

const testimonials = [
  {
    quote:
      "MeetHub's security features give us peace of mind during client meetings. The platform strikes the perfect balance between user-friendly design and robust security.",
    name: "Joanna Prohaska",
    title: "Lead Solutions Designer",
    image: "/testimonal-img.png",
  },
  {
    quote:
      "Scheduling across time zones used to be a nightmare. MeetHub made it effortless. Our team productivity has gone up significantly since we switched.",
    name: "Marcus Webb",
    title: "Senior Product Manager",
    image: "/heromale.png",
  },
  {
    quote:
      "The virtual whiteboard and team chat features are game changers. Everything we need for a productive meeting is in one place.",
    name: "Aisha Kamara",
    title: "UX Research Lead",
    image: "/herofemale.png",
  },
];

export default function Testimonials() {
  const [current, setCurrent] = useState(0);

  const prev = () =>
    setCurrent((i) => (i === 0 ? testimonials.length - 1 : i - 1));
  const next = () =>
    setCurrent((i) => (i === testimonials.length - 1 ? 0 : i + 1));

  const t = testimonials[current];

  return (
    <section
      id="testimonials"
      className="relative z-10 w-full border-t border-line bg-paper px-4 py-28 sm:px-8"
    >
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-12">
        {/* Index */}
        <div className="flex flex-col gap-2 md:col-span-3">
          <span className="text-sm">Testimonials</span>
          <span className="text-sm text-stone">
            {String(current + 1).padStart(2, "0")} / {String(testimonials.length).padStart(2, "0")}
          </span>
        </div>

        {/* Quote */}
        <div className="flex flex-col justify-between gap-10 md:col-span-5">
          <blockquote key={current} className="display animate-in fade-in text-[clamp(1.6rem,2.8vw,2.5rem)] duration-500">
            “{t.quote}”
          </blockquote>

          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-base font-medium">{t.name}</p>
              <p className="text-sm text-stone">{t.title}</p>
            </div>
            <div className="flex gap-1">
              <button
                onClick={prev}
                aria-label="Previous testimonial"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink transition-colors hover:bg-ink hover:text-paper"
              >
                <ArrowLeft size={16} />
              </button>
              <button
                onClick={next}
                aria-label="Next testimonial"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink transition-colors hover:bg-ink hover:text-paper"
              >
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Portrait */}
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-sage md:col-span-3 md:col-start-10">
          <Image
            key={t.image}
            src={t.image}
            alt={t.name}
            fill
            sizes="(min-width: 768px) 25vw, 100vw"
            className="animate-in fade-in object-cover object-top duration-500"
          />
        </div>
      </div>
    </section>
  );
}
