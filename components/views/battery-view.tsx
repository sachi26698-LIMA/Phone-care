"use client";

import { useEffect, useRef, useState } from "react";
import { BatteryCharging, Info, Save, Zap } from "lucide-react";
import { ModuleHeader } from "@/components/diagnostics/module-header";
import { ModuleResultPanel } from "@/components/diagnostics/module-result";
import { MetricStrip } from "@/components/diagnostics/metric-strip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Note } from "@/components/ui/misc";
import { useDiagnostics } from "@/context/diagnostic-provider";
import { estimateDrain, estimateHealth, hasBatteryApi, readBattery, type DrainSample } from "@/lib/collect/battery";


interface LiveBattery {
  level: number;
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
}

function formatSeconds(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 86_400) return null;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function BatteryView() {
  const { state, updateProfile, runModule, running } = useDiagnostics();
  const profile = state.profile;
  const result = state.modules.battery;

  const [live, setLive] = useState<LiveBattery | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [samples, setSamples] = useState<DrainSample[]>([]);
  const batteryRef = useRef<{ removeEventListener?: (t: string, cb: () => void) => void } | null>(null);

  const [design, setDesign] = useState(profile.batteryDesignCapacityMah?.toString() ?? "");
  const [full, setFull] = useState(profile.batteryFullChargeCapacityMah?.toString() ?? "");
  const [cycles, setCycles] = useState(profile.batteryCycleCount?.toString() ?? "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    setSupported(hasBatteryApi());
    if (!hasBatteryApi()) return;
    let interval: number | undefined;
    const events = ["levelchange", "chargingchange", "chargingtimechange", "dischargingtimechange"];
    let sync: (() => void) | null = null;

    void (async () => {
      const battery = await readBattery();
      if (!battery || !active) return;
      sync = () => {
        setLive({
          level: battery.level,
          charging: battery.charging,
          chargingTime: battery.chargingTime,
          dischargingTime: battery.dischargingTime,
        });
      };
      sync();
      for (const event of events) battery.addEventListener?.(event, sync);
      batteryRef.current = battery;

      const push = () =>
        setSamples((prev) =>
          [...prev, { t: Date.now(), level: battery.level, charging: battery.charging }].slice(-60),
        );
      push();
      interval = window.setInterval(push, 15_000);
    })();

    return () => {
      active = false;
      if (interval) window.clearInterval(interval);
      if (sync) for (const event of events) batteryRef.current?.removeEventListener?.(event, sync);
      batteryRef.current = null;
    };
  }, []);

  const drain = estimateDrain(samples);
  const health = estimateHealth(
    Number.parseFloat(design) || undefined,
    Number.parseFloat(full) || undefined,
  );
  const levelPct = live ? Math.round(live.level * 100) : null;

  const saveProfile = async () => {
    updateProfile({
      batteryDesignCapacityMah: Number.parseFloat(design) || undefined,
      batteryFullChargeCapacityMah: Number.parseFloat(full) || undefined,
      batteryCycleCount: Number.parseInt(cycles, 10) || undefined,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2600);
    await runModule("battery");
  };

  return (
    <div className="space-y-5">
      <ModuleHeader moduleId="battery" />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
        {/* Live battery */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Live battery telemetry</CardTitle>
              <p className="mt-1 text-[11.5px] text-faint">
                Battery Status API · Chromium browsers only
              </p>
            </div>
            {supported ? <Badge tone="good">Supported</Badge> : <Badge tone="warn">Unsupported</Badge>}
          </CardHeader>
          <CardContent>
            {supported === null ? (
              <div className="h-40 animate-pulse rounded-xl bg-surface-2/50" />
            ) : !supported ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-xl border border-line-soft bg-surface-2/30 p-4">
                  <Info className="size-5 shrink-0 text-faint" aria-hidden="true" />
                  <div>
                    <p className="text-[13px] font-medium text-fg">This browser does not expose battery data</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
                      Firefox removed the Battery Status API in v52 and Safari never shipped it. Both
                      cite fingerprinting risk. Try Chrome, Edge, Opera or Samsung Internet on Android.
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-line-soft bg-surface-2/60 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-faint">
                    Live level
                  </p>
                  <p className="mt-1 font-display text-3xl font-semibold text-faint">Unavailable</p>
                  <p className="mt-1 text-[11.5px] text-muted">
                    We will not display a placeholder percentage. Enter capacities below to at least
                    get a health estimate.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="relative">
                    <svg width="96" height="52" viewBox="0 0 104 56" className="max-w-full" aria-hidden="true">
                      <rect x="2" y="6" width="88" height="44" rx="9" fill="none" stroke="var(--color-line)" strokeWidth="3" />
                      <rect x="93" y="21" width="7" height="14" rx="2" fill="var(--color-line)" />
                      <rect
                        x="8"
                        y="12"
                        width={Math.max(4, (76 * (levelPct ?? 0)) / 100)}
                        height="32"
                        rx="5"
                        fill={live?.charging ? "var(--color-good)" : levelPct != null && levelPct <= 20 ? "var(--color-bad)" : "var(--color-accent)"}
                        className="transition-all duration-700"
                      />
                    </svg>
                    {live?.charging ? (
                      <span className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-good/20 text-good">
                        <Zap className="size-3.5" aria-hidden="true" />
                      </span>
                    ) : null}
                  </div>
                  <div>
                    <p className="font-display text-4xl font-semibold tabular-nums leading-none text-fg">
                      {levelPct != null ? `${levelPct}%` : "—"}
                    </p>
                    <p className="mt-1 text-[12px] text-muted">
                      {live?.charging ? "Charging" : "On battery"}
                    </p>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-3 border-t border-line-soft pt-4">
                  <div>
                    <dt className="text-[10px] uppercase tracking-[0.13em] text-faint">Time to full</dt>
                    <dd className="text-[13px] font-medium text-fg">
                      {live?.charging
                        ? (formatSeconds(live.chargingTime) ?? "Not reported")
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-[0.13em] text-faint">Time remaining</dt>
                    <dd className="text-[13px] font-medium text-fg">
                      {live && !live.charging
                        ? (formatSeconds(live.dischargingTime) ?? "Not reported")
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-[0.13em] text-faint">Drain rate</dt>
                    <dd className="text-[13px] font-medium text-fg">
                      {drain ? `${drain.perHour.toFixed(0)}% / hour` : "Needs more samples"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-[0.13em] text-faint">Samples</dt>
                    <dd className="text-[13px] font-medium text-fg">{samples.length}</dd>
                  </div>
                </dl>

                <p className="text-[10.5px] leading-relaxed text-faint">
                  Drain rate is estimated from level changes while unplugged. Keep this tab open for a
                  couple of minutes for a meaningful figure. It is a measured trend, not a battery test
                  rig.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calibration */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Health calibration</CardTitle>
              <p className="mt-1 text-[11.5px] text-faint">
                Browsers cannot read capacity — so we ask, and label it as your input
              </p>
            </div>
            {health ? (
              <Badge tone={health.pct >= 85 ? "good" : health.pct >= 80 ? "warn" : "bad"}>
                {health.pct.toFixed(0)}% est.
              </Badge>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Design capacity" suffix="mAh" htmlFor="battery-design">
                <Input
                  id="battery-design"
                  type="number"
                  inputMode="numeric"
                  min={500}
                  max={20000}
                  placeholder="e.g. 4500"
                  value={design}
                  onChange={(e) => setDesign(e.target.value)}
                />
              </Field>
              <Field label="Current full capacity" suffix="mAh" htmlFor="battery-full">
                <Input
                  id="battery-full"
                  type="number"
                  inputMode="numeric"
                  min={200}
                  max={20000}
                  placeholder="e.g. 3800"
                  value={full}
                  onChange={(e) => setFull(e.target.value)}
                />
              </Field>
            </div>
            <Field
              label="Charge cycles (optional)"
              suffix="cycles"
              htmlFor="battery-cycles"
              hint="Android: Settings → Battery → Battery usage. iPhone: Settings → Battery → Battery Health."
            >
              <Input
                id="battery-cycles"
                type="number"
                inputMode="numeric"
                min={0}
                max={5000}
                placeholder="e.g. 412"
                value={cycles}
                onChange={(e) => setCycles(e.target.value)}
              />
            </Field>

            <div className="rounded-xl border border-violet/25 bg-violet/[0.06] px-4 py-3">
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-violet">
                  Estimated health
                </p>
                <span className="font-display text-xl font-semibold text-violet">
                  {health ? `${health.pct.toFixed(0)}%` : "—"}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                {health
                  ? `Capacity retention with about ${health.wear.toFixed(0)}% wear. Estimated from the numbers you entered — PhoneCare cannot verify them.`
                  : "Enter both capacities to compute capacity retention. Values are not uploaded anywhere."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void saveProfile()} disabled={Boolean(running)}>
                <Save className="size-4" />
                Save & re-run battery module
              </Button>
              {saved ? (
                <span className="text-[11.5px] text-good" role="status">
                  Saved locally
                </span>
              ) : null}
            </div>

            <Note tone="neutral">
              These fields accept numbers you copy from your phone&rsquo;s own settings. On Android,
              some manufacturers expose them in the service menu or a diagnostic app; on iPhone,
              Maximum Capacity is shown directly.
            </Note>
          </CardContent>
        </Card>
      </div>

      {result?.readings.length ? (
        <MetricStrip readings={result.readings} keys={["level", "health-estimate", "cycles", "time-to-empty"]} columns={4} />
      ) : null}

      <ModuleResultPanel moduleId="battery" title="Battery readings" />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            title: "Temperature",
            body: "Not exposed by any browser. Use your phone's built-in diagnostics for a real reading.",
          },
          {
            title: "Voltage / current",
            body: "Restricted to native apps. No browser API returns these values.",
          },
          {
            title: "Cycle count",
            body: "Only available from the OS. The field above is asked for, then clearly labelled as your input.",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-dashed border-line-soft bg-surface-2/50 px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <BatteryCharging className="size-3.5 text-faint" aria-hidden="true" />
              <p className="text-[12px] font-semibold text-muted">{item.title}</p>
              <Badge tone="neutral" className="ml-auto">
                Unavailable
              </Badge>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-faint">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
