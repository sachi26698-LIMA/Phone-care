import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-45 whitespace-nowrap select-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-accent to-violet text-canvas font-semibold shadow-[0_8px_30px_-12px] shadow-accent/60 hover:brightness-110 hover:shadow-accent/45 active:scale-[0.985]",
  secondary:
    "bg-surface-2 text-fg border border-line hover:border-accent/50 hover:bg-surface-2/80 active:scale-[0.985]",
  outline:
    "border border-line text-fg hover:border-accent/60 hover:text-accent hover:bg-accent/5 active:scale-[0.985]",
  ghost: "text-muted hover:text-fg hover:bg-surface-2/70",
  danger: "bg-bad/15 text-bad border border-bad/35 hover:bg-bad/25",
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
