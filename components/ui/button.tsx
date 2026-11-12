import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-45 whitespace-nowrap select-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-purple text-white font-semibold shadow-[0_12px_24px_-14px_rgba(106,90,205,0.9)] hover:bg-accent-deep hover:shadow-[0_14px_28px_-14px_rgba(106,90,205,0.95)] active:scale-[0.985]",
  secondary:
    "bg-white text-indigo border border-line hover:border-lavender/70 hover:bg-surface-2 active:scale-[0.985]",
  outline:
    "border border-purple/35 text-purple hover:border-purple hover:bg-purple/[0.06] active:scale-[0.985]",
  ghost: "text-muted hover:text-indigo hover:bg-surface-2",
  danger: "bg-bad/[0.08] text-bad border border-bad/30 hover:bg-bad/[0.14]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px]",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-[15px]",
  icon: "h-10 w-10",
};

export function buttonStyles(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return (
    <button className={buttonStyles(variant, size, className)} {...props}>
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, "href" | "className"> & {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonStyles(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}
