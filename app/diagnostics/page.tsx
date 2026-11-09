import type { Metadata } from "next";
import { ModuleCard } from "@/components/diagnostics/module-card";
import { RunScanButton } from "@/components/layout/run-scan-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EvidenceLegend } from "@/components/ui/evidence-badge";
import { MODULES } from "@/lib/modules";

export const metadata: Metadata = {
  title: "Diagnostics",
  description:
    "Nine browser-based smartphone diagnostic modules: device identity, battery, storage, network, thermal, display, touch, compatibility and performance.",
  alternates: { canonical: "/diagnostics" },
};

export default function DiagnosticsPage() {
  const automated = MODULES.filter((m) => m.mode !== "manual").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent/85">
            Diagnostic suite
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-fg sm:text-[32px]">
            Nine modules. One honest picture.
          </h1>
          <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
            {automated} automated tests run in seconds. Two guided checks need your eyes and fingers.
            Every reading is labelled with how it was obtained.
          </p>
        </div>
        <RunScanButton size="md" />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line-soft bg-surface/40 px-4 py-3">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-faint">
          Evidence legend
        </span>
        <EvidenceLegend />
        <Badge tone="good" className="ml-auto hidden sm:inline-flex">
          No permissions requested
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {MODULES.map((meta) => (
          <ModuleCard key={meta.id} meta={meta} />
        ))}
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className="font-display text-base font-semibold text-fg">Order matters</h2>
        <p className="mt-2 max-w-3xl text-[12.5px] leading-relaxed text-muted">
          The full scan runs device identity and compatibility first, then storage and battery, then
          performance and thermal inference, and finishes with the network transfer. That order keeps
          heavy work away from timing-sensitive probes, so a benchmark never contaminates a latency
          measurement.
        </p>
      </Card>
    </div>
  );
}
