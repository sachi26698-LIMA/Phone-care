"use client";

import { Play, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { useDiagnostics } from "@/context/diagnostic-provider";
import type { ModuleId } from "@/lib/types";

export function RunModuleButton({
  moduleId,
  label,
  size = "sm",
  variant = "secondary",
  fullWidth = false,
}: {
  moduleId: ModuleId;
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "outline" | "ghost";
  fullWidth?: boolean;
}) {
  const { runModule, running, state } = useDiagnostics();
  const isRunning = running === moduleId;
  const hasRun = Boolean(state.modules[moduleId]?.completedAt);

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => void runModule(moduleId)}
      disabled={Boolean(running)}
      className={fullWidth ? "w-full" : undefined}
      aria-live="polite"
    >
      {isRunning ? (
        <Spinner className="size-3.5" />
      ) : hasRun ? (
        <RefreshCw className="size-3.5" />
      ) : (
        <Play className="size-3.5" />
      )}
      {isRunning ? "Running…" : (label ?? (hasRun ? "Re-run" : "Run test"))}
    </Button>
  );
}
