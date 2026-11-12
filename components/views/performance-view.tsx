"use client";

import { Activity, Cpu, Gauge, HardDrive } from "lucide-react";
import { ModuleHeader } from "@/components/diagnostics/module-header";
import { ModuleResultPanel } from "@/components/diagnostics/module-result";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Note } from "@/components/ui/misc";
import { useDiagnostics } from "@/context/diagnostic-provider";
import { cn } from "@/lib/utils";

export function PerformanceView() {
  const { state } = useDiagnostics();
  const result = state.modules.performance;
  const get = (key: string) => result?.readings.find((r) => r.key === key);

  const tiles = [
    { key: "fps", label: "Frame cadence", icon: Activity },
    { key: "compute", label: "JS compute", icon: Cpu },
    { key: "cores", label: "CPU threads", icon: Gauge },
    { key: "storage-speed", label: "Browser storage", icon: HardDrive },
  ] as const;

  return (
    <div className="space-y-5">
      <ModuleHeader
        moduleId="performance"
        description="Session benchmarks for compute throughput, frame cadence and browser storage. Relative to this session — not a universal device ranking."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map(({ key, label, icon: Icon }) => {
          const reading = get(key);
          return (
            <Card key={key}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <Icon className="size-4 text-accent" aria-hidden="true" />
                  <Badge tone={reading?.value ? "good" : "neutral"}>
                    {reading?.value ? "Measured" : "Unavailable"}
                  </Badge>
                </div>
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
                  {label}
                </p>
                <p
                  className={cn(
                    "mt-1 font-display text-xl font-semibold tracking-tight tabular-nums",
                    reading?.status === "warn" ? "text-warn" : "text-fg",
                  )}
                >
                  {reading?.value ?? "—"}
                </p>
                <p className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-faint">
                  {reading?.detail ?? "Run the module."}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <ModuleResultPanel moduleId="performance" title="Performance readings" />
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-5 text-[12px] leading-relaxed text-muted">
              <p className="font-display text-sm font-semibold text-fg">How to read these numbers</p>
              <p>
                <span className="font-medium text-fg">Frame cadence</span> is capped by your display
                refresh rate and by the browser&rsquo;s compositor. A 60 Hz phone reporting ~60 fps is
                performing correctly, not poorly.
              </p>
              <p>
                <span className="font-medium text-fg">Compute index</span> reflects JavaScript engine
                speed, background load and thermal state — not raw silicon capability. The module
                score is capped when very few logical threads are reported, so a 2-thread device is
                not rated excellent purely on raw loop speed.
              </p>
              <p>
                <span className="font-medium text-fg">Browser storage speed</span> measures the
                IndexedDB path, which is slower than native NAND and shared with other tabs.
              </p>
              <Note tone="info">
                Run the module twice, a minute apart. A large swing between runs usually means
                background load or throttling, not a failing device.
              </Note>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="font-display text-sm font-semibold text-fg">
                Metrics we refuse to fabricate
              </p>
              <ul className="mt-2 space-y-1.5 text-[12px] text-muted">
                <li>• CPU usage percentage</li>
                <li>• GPU load or clock speed</li>
                <li>• RAM in use by other apps</li>
                <li>• Battery wattage or current draw</li>
              </ul>
              <p className="mt-2 text-[11px] leading-relaxed text-faint">
                These require OS-level access. No web page has it, so no honest dashboard can show it.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
