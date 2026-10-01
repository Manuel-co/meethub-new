import Link from "next/link";
import { Video } from "lucide-react";

export default function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex w-fit items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink">
        <Video size={13} className="text-paper" strokeWidth={2.25} />
      </span>
      <span className="text-lg font-medium tracking-[-0.04em] text-ink">MeetHub</span>
    </Link>
  );
}
