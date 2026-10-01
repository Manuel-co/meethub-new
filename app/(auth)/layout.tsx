import Image from "next/image";
import Logo from "@/components/app/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[100svh] w-full lg:grid-cols-2">
      {/* Form side */}
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <p className="text-xs text-stone">© {new Date().getFullYear()} MeetHub</p>
      </div>

      {/* Visual side */}
      <aside className="relative hidden overflow-hidden bg-ink p-10 text-paper lg:flex lg:flex-col lg:justify-end">
        <Image
          src="/Features1.png"
          alt=""
          fill
          sizes="50vw"
          className="object-cover opacity-70"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
        <div className="relative flex max-w-md flex-col gap-5">
          <span className="chip w-fit bg-lime text-ink">Scheduling, simplified</span>
          <p className="display text-4xl">
            Share one link. Let people pick a time. Meet.
          </p>
          <p className="text-sm text-paper/70">
            Set your hours once and MeetHub keeps your calendar free of double-bookings.
          </p>
        </div>
      </aside>
    </div>
  );
}
