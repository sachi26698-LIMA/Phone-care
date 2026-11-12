import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "panel relative overflow-hidden rounded-2xl",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex items-start justify-between gap-4 p-5 pb-0", className)} {...props} />;
}

export function CardTitle({
  as: Tag = "h3",
  className,
  ...props
}: ComponentProps<"h3"> & { as?: "h2" | "h3" }) {
  return <Tag className={cn("text-base font-semibold tracking-tight text-fg", className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("mt-1.5 text-[13px] leading-relaxed text-muted", className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-3 border-t border-line-soft px-5 py-3.5", className)}
      {...props}
    />
  );
}
