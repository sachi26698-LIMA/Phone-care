"use client";

import { Cpu, Info, MonitorSmartphone, Smartphone } from "lucide-react";
import { ModuleHeader } from "@/components/diagnostics/module-header";
import { ModuleResultPanel } from "@/components/diagnostics/module-result";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Note } from "@/components/ui/misc";
import { useDiagnostics } from "@/context/diagnostic-provider";
import { formatTimestamp } from "@/lib/utils";

export function DeviceView() {
  const { state } = useDiagnostics();
  const result = state.modules.device;
  const get = (key: string) => result?.readings.find((r) => r.key === key);

  const highlights = [
    { key: "model", icon: Smartphone, label: "Model" },
    { key: "os", icon: MonitorSmartphone, label: "Platform" },
    { key: "browser", icon: Info, label: "Browser" },
    { key: "gpu", icon: Cpu, label: "GPU" },
  ] as const;

  return (
    <div className="space-y-5">
      <ModuleHeader moduleId="device" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {highlights.map(({ key, icon: Icon, label }) => {
          const reading = get(key);
          return (
            <Card key={key}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <Icon className="size-4 text-accent" aria-hidden="true" />
                  <Badge tone={reading?.evidence === "measured" ? "good" : reading?.evidence === "estimated" ? "violet" : "neutral"}>
                    {reading?.evidence === "measured" ? "Measured" : reading?.evidence === "estimated" ? "Estimate" : "Unavailable"}
                  </Badge>
                </div>
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
                  {label}
                </p>
                <p className="mt-1 line-clamp-2 text-[13px] font-medium leading-snug text-fg" title={reading?.value ?? undefined}>
                  {reading?.value ?? "Not available"}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <ModuleResultPanel moduleId="device" title="Detected device properties" />
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>How this was detected</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[12px] leading-relaxed text-muted">
              <p>
                <span className="font-medium text-fg">User-Agent + Client Hints</span> supply platform,
                browser and (on Android) model. Chromium is progressively freezing the legacy
                user-agent string, so model detection is best-effort.
              </p>
              <p>
                <span className="font-medium text-fg">WebGL</span> exposes the GPU renderer, which many
                browsers mask for privacy. A masked value is reported as such, not as a fault.
              </p>
              <p>
                <span className="font-medium text-fg">Screen and viewport</span> values are exact CSS
                pixels. Multiply by the device pixel ratio for physical pixels.
              </p>
              <Note tone="info">
                Last scan: {result?.completedAt ? formatTimestamp(result.completedAt) : "not run yet"}.
                Nothing in this module is uploaded.
              </Note>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Not available to any website</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                "Serial number / IMEI",
                "Exact RAM (only a coarse class)",
                "Storage chip model and health",
                "Screen manufacturer or panel revision",
                "Installed app list",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-[12px] text-muted">
                  <span className="size-1 shrink-0 rounded-full bg-faint" aria-hidden="true" />
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
