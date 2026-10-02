"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string };

/**
 * shadcn Select styled for MeetHub. `tone="dark"` is for the meeting screens.
 * Note: Radix doesn't allow "" as a value — use a sentinel like "default".
 */
export default function SelectField({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder,
  tone = "light",
  invalid,
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  ariaLabel: string;
  placeholder?: string;
  tone?: "light" | "dark";
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className={cn(
          "h-10! w-full gap-2 rounded-xl px-3.5 text-sm shadow-none",
          dark
            ? "border-paper/15 bg-paper/5 text-paper hover:bg-paper/10 focus-visible:border-paper/40 focus-visible:ring-lime/40 [&>svg]:text-paper/60"
            : "border-line bg-white text-ink hover:border-ink/40 focus-visible:border-ink focus-visible:ring-lime/60 [&>svg]:text-stone",
          invalid && "border-clay! ring-2 ring-clay/30",
          className,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        position="popper"
        sideOffset={6}
        className={cn(
          "max-h-72 rounded-xl p-1 shadow-lg",
          dark ? "border border-paper/10 bg-ink text-paper ring-paper/10" : "border border-line bg-white text-ink ring-0",
        )}
      >
        {options.map((o) => (
          <SelectItem
            key={o.value}
            value={o.value}
            className={cn(
              "rounded-lg py-2 pl-2.5 text-sm",
              dark
                ? "focus:bg-paper/10 focus:text-paper data-[state=checked]:text-lime"
                : "focus:bg-paper focus:text-ink data-[state=checked]:font-medium",
            )}
          >
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
