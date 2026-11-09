"use client";

import { useState } from "react";
import { Flame, Save, Thermometer } from "lucide-react";
import { ModuleHeader } from "@/components/diagnostics/module-header";
import { ModuleResultPanel } from "@/components/diagnostics/module-result";
import { MetricStrip } from "@/components/diagnostics/metric-strip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Note } from "@/components/ui/misc";
import { useDiagnostics } from "@/context/diagnostic-provider";

export function TemperatureView() {
  const { state, updateProfile, runModule, running, progress } = useDiagnostics();
  const profile = state.profile;
  const result = state.modules.temperature;

  const [ambient, setAmbient] = useState(profile.ambientTempC?.toString() ?? "");
  const [deviceTemp, setDeviceTemp] = useState(profile.measuredDeviceTempC?.toString() ?? "");
  const [saved, setSaved] = useState(false);

  const save = async () => {
    updateProfile({
      ambientTempC: Number.parseFloat(ambient) || undefined,
      measuredDeviceTempC: Number.parseFloat(deviceTemp) || undefined,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2600);
    await runModule("temperature");
  };

  return (
    <div className="space-y-5">
      <ModuleHeader
        moduleId="temperature"
        description="No browser can read your phone's thermometer. This module measures how much performance drops under sustained load — a throttling signal, clearly labelled as an estimate."
      />

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-bad/[0.07] blur-2xl" aria-hidden="true" />
          <CardHeader>
            <div>
              <CardTitle>Sustained-load inference</CardTitle>
              <p className="mt-1 text-[11.5px] text-faint">Three rounds · ~7 seconds · no permissions</p>
            </div>
            <Badge tone="violet">Estimate</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-line-soft bg-surface-2/30 p-4">
              <Thermometer className="mt-0.5 size-5 shrink-0 text-faint" aria-hidden="true" />
              <div>
                <p className="text-[12.5px] font-medium text-fg">Device temperature</p>
                <p className="mt-0.5 font-display text-lg font-semibold text-faint">Unavailable</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">
                  Restricted to native apps. Any website showing a live temperature is inferring or
                  inventing it.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-line-soft bg-surface-2/60 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-faint">
                  Throttling signal
                </p>
                <span className="text-[10px] uppercase tracking-wide text-violet">Estimated</span>
              </div>
              <p className="mt-1.5 font-display text-lg font-semibold text-fg">
                {result?.readings.find((r) => r.key === "throttle")?.value ?? "Not tested"}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                {running === "temperature"
                  ? (progress?.message ?? "Running load rounds…")
                  : "Compares throughput between benchmark rounds after warm-up. A drop can come from heat, a power limit, or the browser deprioritising this tab."}
              </p>
            </div>

            <Button onClick={() => void runModule("temperature")} disabled={Boolean(running)} className="w-full">
              <Flame className="size-4" />
              {running === "temperature" ? "Testing under load…" : "Run thermal stress test"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Optional on-device readings</CardTitle>
              <p className="mt-1 text-[11.5px] text-faint">
                Copied from your phone&rsquo;s native diagnostics — labelled as your input
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Room / ambient" suffix="°C" htmlFor="ambient-temp">
                <Input
                  id="ambient-temp"
                  type="number"
                  inputMode="decimal"
                  min={-20}
                  max={60}
                  step={0.5}
                  placeholder="e.g. 27"
                  value={ambient}
                  onChange={(e) => setAmbient(e.target.value)}
                />
              </Field>
              <Field label="Phone temperature" suffix="°C" htmlFor="device-temp">
                <Input
                  id="device-temp"
                  type="number"
                  inputMode="decimal"
                  min={-20}
                  max={100}
                  step={0.1}
                  placeholder="e.g. 38.5"
                  value={deviceTemp}
                  onChange={(e) => setDeviceTemp(e.target.value)}
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={() => void save()} disabled={Boolean(running)}>
                <Save className="size-4" />
                Save & re-run
              </Button>
              {saved ? (
                <span className="text-[11.5px] text-good" role="status">
                  Saved locally
                </span>
              ) : null}
            </div>
            <Note tone="warn">
              Above 45 °C, stop charging and close heavy apps. Persistent heat while idle, or a
              bulging case, is a hardware safety issue — power down and seek service.
            </Note>
            <div className="grid grid-cols-3 gap-2 border-t border-line-soft pt-3 text-center">
              {[
                { label: "Comfortable", range: "20–35 °C", tone: "text-good" },
                { label: "Warm", range: "35–45 °C", tone: "text-warn" },
                { label: "Too hot", range: "45 °C+", tone: "text-bad" },
              ].map((band) => (
                <div key={band.label}>
                  <p className={`text-[11px] font-semibold ${band.tone}`}>{band.label}</p>
                  <p className="text-[10px] text-faint">{band.range}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {result?.readings.length ? (
        <MetricStrip readings={result.readings} keys={["throttle", "fps-load", "ambient", "user-temp"]} columns={4} />
      ) : null}

      <ModuleResultPanel moduleId="temperature" title="Thermal readings" />
    </div>
  );
}
