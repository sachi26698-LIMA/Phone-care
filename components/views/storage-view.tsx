"use client";

import { useState } from "react";
import { HardDrive, Save } from "lucide-react";
import { ModuleHeader } from "@/components/diagnostics/module-header";
import { ModuleResultPanel } from "@/components/diagnostics/module-result";
import { MetricStrip } from "@/components/diagnostics/metric-strip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Note } from "@/components/ui/misc";
import { StoragePersistence } from "@/components/diagnostics/storage-persistence";
import { useDiagnostics } from "@/context/diagnostic-provider";
import { clamp } from "@/lib/utils";

export function StorageView() {
  const { state, updateProfile, runModule, running } = useDiagnostics();
  const profile = state.profile;
  const result = state.modules.storage;

  const [total, setTotal] = useState(profile.storageTotalGb?.toString() ?? "");
  const [free, setFree] = useState(profile.storageFreeGb?.toString() ?? "");
  const [saved, setSaved] = useState(false);

  const totalNum = Number.parseFloat(total);
  const freeNum = Number.parseFloat(free);
  const valid = Number.isFinite(totalNum) && totalNum > 0 && Number.isFinite(freeNum) && freeNum >= 0 && freeNum <= totalNum;
  const freePct = valid ? clamp((freeNum / totalNum) * 100, 0, 100) : null;

  const save = async () => {
    if (!valid) return;
    updateProfile({ storageTotalGb: totalNum, storageFreeGb: freeNum });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2600);
    await runModule("storage");
  };

  return (
    <div className="space-y-5">
      <ModuleHeader moduleId="storage" />

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Device storage model</CardTitle>
              <p className="mt-1 text-[11.5px] text-faint">Two numbers from your OS unlock real analysis</p>
            </div>
            <Badge tone={freePct == null ? "neutral" : freePct >= 15 ? "good" : freePct >= 7 ? "warn" : "bad"}>
              {freePct == null ? "Awaiting input" : `${freePct.toFixed(0)}% free`}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Total storage" suffix="GB" htmlFor="storage-total">
                <Input
                  id="storage-total"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={4096}
                  step={0.1}
                  placeholder="e.g. 128"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                />
              </Field>
              <Field label="Free storage" suffix="GB" htmlFor="storage-free">
                <Input
                  id="storage-free"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={4096}
                  step={0.1}
                  placeholder="e.g. 26"
                  value={free}
                  onChange={(e) => setFree(e.target.value)}
                />
              </Field>
            </div>

            {freePct != null ? (
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-[0.13em] text-faint">
                    Free space
                  </span>
                  <span className="font-display text-lg font-semibold text-fg">
                    {freeNum.toFixed(1)} GB / {totalNum.toFixed(0)} GB
                  </span>
                </div>
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${100 - freePct}%`,
                      background:
                        freePct < 7
                          ? "var(--color-bad)"
                          : freePct < 15
                            ? "var(--color-warn)"
                            : "var(--color-accent)",
                    }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-[10.5px] text-faint">
                  <span>Used {(totalNum - freeNum).toFixed(1)} GB</span>
                  <span>Healthy target: 15%+ free</span>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void save()} disabled={!valid || Boolean(running)}>
                <Save className="size-4" />
                Save & analyse
              </Button>
              {saved ? (
                <span className="text-[11.5px] text-good" role="status">
                  Saved locally
                </span>
              ) : null}
              {!valid && (total || free) ? (
                <span className="text-[11px] text-warn">Free space must be between 0 and total.</span>
              ) : null}
            </div>

            <Note tone="neutral">
              Browsers deliberately hide disk usage. PhoneCare never guesses it: without these entries,
              the module reports device storage as <span className="font-medium text-fg">unavailable</span>{" "}
              and analyses the browser quota instead.
            </Note>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Browser storage footprint</CardTitle>
              <p className="mt-1 text-[11.5px] text-faint">
                This site&rsquo;s quota — not your phone&rsquo;s disk
              </p>
            </div>
            <HardDrive className="size-4 text-faint" aria-hidden="true" />
          </CardHeader>
          <CardContent className="space-y-3">
            {(result?.readings ?? [])
              .filter((r) => ["origin-usage", "persisted", "local", "indexeddb"].includes(r.key))
              .map((r) => (
                <div key={r.key} className="flex items-start justify-between gap-3 border-b border-line-soft pb-2.5 last:border-0">
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium text-fg">{r.label}</p>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-faint">{r.source}</p>
                  </div>
                  <p className="max-w-[58%] shrink text-right text-[12.5px] font-medium text-muted">
                    {r.value ?? "Unavailable"}
                  </p>
                </div>
              ))}
            {!result || result.readings.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-faint">
                Run the storage module to measure this browser&rsquo;s quota.
              </p>
            ) : null}
            <p className="pt-1 text-[10.5px] leading-relaxed text-faint">
              Browser quota is typically a fraction of free disk space and is shared across this
              origin only. It is useful for cache planning, not for judging phone storage.
            </p>
            <StoragePersistence />
          </CardContent>
        </Card>
      </div>

      {result?.readings.length ? (
        <MetricStrip
          readings={result.readings}
          keys={["device-free", "device-used", "origin-usage", "persisted"]}
          columns={4}
        />
      ) : null}

      <ModuleResultPanel moduleId="storage" title="Storage readings" />
    </div>
  );
}
