"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, MonitorSmartphone, ShieldAlert, Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type WakeState = "idle" | "active" | "denied" | "unsupported" | "error";

interface WakeSentinel {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
}

function wakeLockApi() {
  const nav = navigator as Navigator & {
    wakeLock?: { request: (type: "screen") => Promise<WakeSentinel> };
  };
  return nav.wakeLock;
}

/**
 * Screen Wake Lock for guided visual tests.
 *
 * Requires a user gesture and is optional. The lock is released when the page is
 * hidden, the test closes, or the component unmounts. It never reads the display.
 */
export function WakeLockToggle() {
  const [state, setState] = useState<WakeState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const sentinelRef = useRef<WakeSentinel | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !wakeLockApi()) {
      setState("unsupported");
    }
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && sentinelRef.current && !sentinelRef.current.released) {
        setState("active");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinelRef.current?.release().catch(() => undefined);
      sentinelRef.current = null;
    };
  }, []);

  const request = useCallback(async () => {
    const api = typeof navigator === "undefined" ? undefined : wakeLockApi();
    if (!api) {
      setState("unsupported");
      return;
    }
    try {
      const sentinel = await api.request("screen");
      sentinelRef.current = sentinel;
      sentinel.addEventListener("release", () => {
        sentinelRef.current = null;
        setState("idle");
      });
      setState("active");
      setMessage("Holding the screen awake for this test only.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setState("denied");
        setMessage(
          "The browser declined the wake lock (NotAllowedError). This usually means the page is not visible or battery saver is on. The test still works — just tap the screen to keep it awake.",
        );
      } else if (error instanceof DOMException && error.name === "NotSupportedError") {
        setState("unsupported");
        setMessage("This browser cannot keep the screen awake. Nothing else is affected.");
      } else {
        setState("error");
        setMessage("The wake lock could not be acquired. You can continue the test without it.");
      }
    }
  }, []);

  const release = useCallback(async () => {
    await sentinelRef.current?.release().catch(() => undefined);
    sentinelRef.current = null;
    setState("idle");
    setMessage("Wake lock released.");
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line-soft bg-white px-3 py-2.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-champagne/60 text-[#8a5a1e]">
        <Sun className="size-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-indigo">
          Keep the screen awake during the test
        </p>
        <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">
          Optional. Asks the browser for a screen wake lock so patterns do not disappear mid-check;
          it is released when you close the test.
        </p>
        {message ? (
          <p className="mt-1 text-[10.5px] leading-relaxed text-warn" role="status">
            {message}
          </p>
        ) : null}
      </div>
      {state === "active" ? (
        <Badge tone="good">
          <Check className="size-3" aria-hidden="true" />
          Awake
        </Badge>
      ) : state === "unsupported" ? (
        <Badge tone="neutral">
          <ShieldAlert className="size-3" aria-hidden="true" />
          Unsupported
        </Badge>
      ) : state === "denied" || state === "error" ? (
        <Badge tone="warn">
          <ShieldAlert className="size-3" aria-hidden="true" />
          Declined
        </Badge>
      ) : null}
      {state === "active" ? (
        <Button variant="ghost" size="sm" onClick={() => void release()}>
          Release
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void request()}
          disabled={state === "unsupported"}
        >
          {state === "idle" ? <MonitorSmartphone className="size-3.5" /> : <Loader2 className="size-3.5" />}
          Hold awake
        </Button>
      )}
    </div>
  );
}
