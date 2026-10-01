import { initials } from "@/lib/format";

const tones = ["bg-clay", "bg-sage", "bg-lime", "bg-paper-deep"];

/** Initials avatar with a color picked from the name */
export default function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const tone = tones[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % tones.length];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-medium text-ink ${tone}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
