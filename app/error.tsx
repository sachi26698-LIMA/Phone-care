"use client";

import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the digest for debugging without leaking user data.
    console.error("PhoneCare route error", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center text-center">
      <span className="grid size-14 place-items-center rounded-2xl border border-bad/30 bg-bad/10 text-bad">
        <TriangleAlert className="size-6" aria-hidden="true" />
      </span>
      <h1 className="mt-5 font-display text-xl font-semibold text-fg">Something interrupted the scan</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        This view failed to render. Your stored readings are safe in local storage. Retry, or return to
        the dashboard if the problem persists.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-[10.5px] text-faint">Ref: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex gap-2">
        <Button onClick={reset} size="sm">
          <RefreshCw className="size-3.5" />
          Try again
        </Button>
        <a
          href="/"
          className="inline-flex h-9 items-center rounded-xl border border-line px-3.5 text-[13px] text-muted transition-colors hover:text-fg"
        >
          Dashboard
        </a>
      </div>
    </div>
  );
}
