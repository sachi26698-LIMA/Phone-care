"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Lock, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type PersistState = "checking" | "granted" | "available" | "denied" | "unsupported" | "error";

/**
 * Persistent-storage request.
 *
 * This is the only storage-related permission that exists on the web. It does not
 * grant access to the device disk — it only asks the browser to avoid evicting
 * this origin's saved report when space runs low. Explained before requesting.
 */
export function StoragePersistence() {
  const [state, setState] = useState<PersistState>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof navigator === "undefined" || !navigator.storage?.persisted) {
        if (!cancelled) setState("unsupported");
        return;
      }
      try {
        const already = await navigator.storage.persisted();
        if (cancelled) return;
        setState(already ? "granted" : "available");
      } catch {
        if (!cancelled) setState("unsupported");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const request = useCallback(async () => {
    if (!navigator.storage?.persist) {
      setState("unsupported");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const granted = await navigator.storage.persist();
      setState(granted ? "granted" : "denied");
      setMessage(
        granted
          ? "Granted. Your saved report will not be evicted automatically."
          : "The browser declined without showing a prompt. It usually grants persistence once the site is installed or has been used a few times.",
      );
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "The browser blocked the request (NotAllowedError). This can happen in private windows."
          : "The request could not be completed. Nothing was changed.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="rounded-xl border border-line-soft bg-surface-2/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[12.5px] font-semibold text-indigo">
          <Lock className="size-3.5 text-lavender" aria-hidden="true" />
          Keep this report on this device
        </p>
        {state === "checking" ? (
          <Badge tone="neutral">
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            Checking
          </Badge>
        ) : state === "granted" ? (
          <Badge tone="good">
            <Check className="size-3" aria-hidden="true" />
            Persistent
          </Badge>
        ) : state === "available" ? (
          <Badge tone="neutral">Not requested</Badge>
        ) : state === "denied" ? (
          <Badge tone="warn">
            <ShieldAlert className="size-3" aria-hidden="true" />
            Declined
          </Badge>
        ) : state === "error" ? (
          <Badge tone="bad">
            <ShieldAlert className="size-3" aria-hidden="true" />
            Blocked
          </Badge>
        ) : (
          <Badge tone="neutral">Unsupported here</Badge>
        )}
      </div>

      <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
        <span className="font-medium text-fg">Why:</span> browsers may delete site data when space is
        low, which would remove your scan. Asking for persistent storage prevents that for this origin.
        It does <span className="font-medium text-fg">not</span> read your disk, your files or free
        space — no permission can unlock those.
      </p>

      {state === "unsupported" ? (
        <p className="mt-2 text-[11.5px] leading-relaxed text-warn">
          This browser does not expose the Storage persistence API. Your report stays in{" "}
          <code className="rounded bg-white px-1">localStorage</code> until normal eviction, and the
          rest of the module still works.
        </p>
      ) : null}

      {state === "available" || state === "denied" || state === "error" ? (
        <Button
          variant={state === "available" ? "secondary" : "outline"}
          size="sm"
          className="mt-3"
          onClick={() => void request()}
          disabled={busy}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Lock className="size-3.5" />}
          {state === "available" ? "Request persistent storage" : "Try again"}
        </Button>
      ) : null}

      {message ? (
        <p className="mt-2 text-[11px] leading-relaxed text-muted" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
