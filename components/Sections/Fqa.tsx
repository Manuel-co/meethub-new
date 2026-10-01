"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

const faqs = [
  {
    question: "How do I invite participants to my meeting?",
    answer:
      "From your meeting settings, you can send email invites directly or share a unique meeting link. Participants can join from any device without needing an account.",
  },
  {
    question: "Is there a limit to the number of participants in a meeting?",
    answer:
      "MeetHub supports up to 500 participants per meeting depending on your plan. Check our pricing page for details on each tier.",
  },
  {
    question: "Can I record meetings with MeetHub?",
    answer:
      "Yes, meeting recording is available on all paid plans. Recordings are stored securely in the cloud and can be shared or downloaded at any time.",
  },
  {
    question: "How secure are the meetings on MeetHub?",
    answer:
      "All meetings are end-to-end encrypted. We use industry-standard security protocols to ensure your conversations remain private and protected.",
  },
];

export default function Fqa() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="relative z-10 w-full border-t border-line bg-paper px-4 py-28 sm:px-8"
    >
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-12">
        <div className="flex flex-col gap-6 md:col-span-4">
          <span className="text-sm text-stone">FAQ</span>
          <h2 className="display text-[clamp(2rem,4vw,3.4rem)]">
            Questions, answered.
          </h2>
        </div>

        <ul className="border-t border-line md:col-span-7 md:col-start-6">
          {faqs.map((faq, i) => {
            const isOpen = open === i;
            return (
              <li key={i} className="border-b border-line">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-6 py-6 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-lg tracking-[-0.02em] sm:text-xl">
                    {faq.question}
                  </span>
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
                      isOpen ? "bg-ink text-paper" : "bg-white text-ink"
                    }`}
                  >
                    <Plus
                      size={16}
                      className={`transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`}
                    />
                  </span>
                </button>
                <div
                  className={`grid transition-[grid-template-rows] duration-300 ${
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <p className="max-w-xl overflow-hidden text-[15px] leading-relaxed text-stone">
                    <span className="block pb-6">{faq.answer}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
