import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  htmlFor,
  suffix,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  suffix?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="flex items-baseline justify-between gap-2 text-[12.5px] font-medium text-fg"
      >
        <span>{label}</span>
        {suffix ? <span className="text-[11px] font-normal text-faint">{suffix}</span> : null}
      </label>
      {children}
      {hint ? <p className="text-[11.5px] leading-relaxed text-faint">{hint}</p> : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-fg outline-none transition-colors placeholder:text-faint focus:border-accent/70 focus:ring-2 focus:ring-accent/20 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-fg outline-none transition-colors focus:border-accent/70 focus:ring-2 focus:ring-accent/20",
        className,
      )}
      {...props}
    />
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 text-[12.5px] text-muted transition-colors hover:text-fg"
    >
      <span
        className={cn(
          "relative h-5 w-9 rounded-full border transition-colors",
          checked ? "border-accent/60 bg-accent/25" : "border-line bg-surface-2",
        )}
        aria-hidden="true"
      >
        <span
          className={cn(
            "absolute top-0.5 size-3.5 rounded-full transition-all",
            checked ? "left-[18px] bg-accent" : "left-0.5 bg-faint",
          )}
        />
      </span>
      {label}
    </button>
  );
}
