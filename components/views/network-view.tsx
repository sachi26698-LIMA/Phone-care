"use client";

import { Download, Info, Upload, Waves } from "lucide-react";
import { ModuleHeader } from "@/components/diagnostics/module-header";
import { ModuleResultPanel } from "@/components/diagnostics/module-result";
import { MetricStrip } from "@/components/diagnostics/metric-strip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Note } from "@/components/ui/misc";
import { useDiagnostics } from "@/context/diagnostic-provider";
import { cn } from "@/lib/utils";

export function NetworkView() {
  const { state } = useDiagnostics();
  const result = state.modules.network;
  const get = (key: string) => result?.readings.find((r) => r.key === key);

  const tiles = [
    { key: "download", label: "Download", icon: Download, accent: "text-accent" },
    { key: "upload", label: "Upload", icon: Upload, accent: "text-violet" },
    { key: "latency", label: "Latency", icon: Waves, accent: "text-good" },
  ] as const;

  return (
    <div className="space-y-5">
      <ModuleHeader
        moduleId="network"
        description="Real throughput and latency measured against PhoneCare's own endpoints. No third-party speed service, no IP lookup."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map(({ key, label, icon: Icon, accent }) => {
          const reading = get(key);
          return (
            <Card key={key} className="relative overflow-hidden">
              <div className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-accent/[0.06] blur-2xl" aria-hidden="true" />
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <Icon className={cn("size-4", accent)} aria-hidden="true" />
                  <Badge tone={reading ? "good" : "neutral"}>
                    {reading ? "Measured" : "Not tested"}
                  </Badge>
                </div>
                <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
                  {label}
                </p>
                <p className="mt-1 font-display text-[26px] font-semibold leading-none tracking-tight tabular-nums text-fg">
                  {reading?.value ?? "—"}
                </p>
                <p className="mt-2 line-clamp-2 text-[10.5px] leading-relaxed text-faint">
                  {reading?.detail ?? "Run the module to measure this link."}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <ModuleResultPanel moduleId="network" title="Network measurements" />

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Test methodology</CardTitle>
              <Badge tone="info">Same-origin</Badge>
            </CardHeader>
            <CardContent className="space-y-3 text-[12px] leading-relaxed text-muted">
              <p>
                <span className="font-medium text-fg">Latency:</span> six no-cache HTTPS probes. The
                first is discarded as a cold-connection sample; the median of the rest is reported,
                along with jitter.
              </p>
              <p>
                <span className="font-medium text-fg">Download:</span> a capped, incompressible payload
                (1–6 MB depending on your connection hint) streamed from this site and counted as it
                arrives.
              </p>
              <p>
                <span className="font-medium text-fg">Upload:</span> 1 MB posted to a stateless endpoint
                that counts bytes and discards them. Nothing is stored.
              </p>
              <Note tone="warn">
                Distance to the host is included in every number. Compare runs from the same place and
                network; do not compare against a carrier&rsquo;s advertised speed.
              </Note>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deliberately not measured</CardTitle>
              <Info className="size-4 text-faint" aria-hidden="true" />
            </CardHeader>
            <CardContent className="space-y-2 text-[12px] leading-relaxed text-muted">
              <p>
                <span className="font-medium text-fg">Public IP / ISP:</span> would require a third-party
                service. Skipped by design.
              </p>
              <p>
                <span className="font-medium text-fg">Packet loss:</span> not measurable from HTTPS
                fetch timings.
              </p>
              <p>
                <span className="font-medium text-fg">Signal strength (dBm):</span> mobile radios do not
                expose this to browsers.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {result?.readings.length ? (
        <MetricStrip readings={result.readings} keys={["effective-type", "downlink-hint", "rtt-hint", "latency"]} columns={4} />
      ) : null}
    </div>
  );
}
