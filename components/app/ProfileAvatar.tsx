import { avatarSrc, type AvatarSpec } from "@/lib/avatar";
import { initials } from "@/lib/format";

/** A participant's avatar (DiceBear or photo), or their initials as a fallback */
export default function ProfileAvatar({
  name,
  avatar,
  size = 64,
  className = "",
}: {
  name: string;
  avatar: AvatarSpec | null;
  size?: number;
  className?: string;
}) {
  if (avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local data URL, nothing for next/image to optimise
      <img
        src={avatarSrc(avatar)}
        alt=""
        aria-hidden
        width={size}
        height={size}
        className={`shrink-0 rounded-full bg-paper-deep object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  // Someone on an older version, or whose avatar didn't arrive
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full bg-lime font-medium text-ink ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name) || "?"}
    </span>
  );
}
