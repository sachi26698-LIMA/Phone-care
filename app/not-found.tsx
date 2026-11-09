import Link from "next/link";
import { Compass, Radar } from "lucide-react";
import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center text-center">
      <span className="grid size-14 place-items-center rounded-2xl border border-line-soft bg-surface-2/50 text-accent">
        <Compass className="size-6" aria-hidden="true" />
      </span>
      <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-faint">404</p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-fg">This page is off the grid</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        The route you requested does not exist. Your scan data is untouched and still stored locally.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <LinkButton href="/" size="sm">
          <Radar className="size-3.5" />
          Back to dashboard
        </LinkButton>
        <Link
          href="/diagnostics"
          className="inline-flex h-9 items-center rounded-xl border border-line px-3.5 text-[13px] text-muted transition-colors hover:text-fg"
        >
          Browse modules
        </Link>
      </div>
    </div>
  );
}

export const metadata = { title: "Page not found" };
