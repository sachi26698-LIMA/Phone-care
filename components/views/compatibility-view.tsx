"use client";

import { useState } from "react";
import { Check, X, ShieldQuestion } from "lucide-react";
import { ModuleHeader } from "@/components/diagnostics/module-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/misc";
import { useDiagnostics } from "@/context/diagnostic-provider";
import { cn } from "@/lib/utils";

const CATEGORIES = ["All", "Sensors", "Network", "Media", "Storage", "Platform"] as const;

export function CompatibilityView() {
  const { state } = useDiagnostics();
  const result = state.modules.compatibility;
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");

  const featureReadings = (result?.readings ?? []).filter((r) => r.key.startsWith("f-"));
  const filtered =
    category === "All"
      ? featureReadings
      : featureReadings.filter((r) => r.source.includes(category));

  const supported = featureReadings.filter((r) => r.value === "Supported").length;
  const total = featureReadings.length;
  const tier = result?.readings.find((r) => r.key === "tier");
  const coverage = result?.readings.find((r) => r.key === "coverage");

  return (
    <div className="space-y-5">
      <ModuleHeader
        moduleId="compatibility"
        description="A 37-point feature matrix. This describes what your browser exposes — not the physical capability of your phone."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
              Diagnostic capability
            </p>
            <p className="mt-1.5 font-display text-2xl font-semibold text-fg">
              {tier?.value ?? "Not tested"}
            </p>
            <p className="mt-1 text-[11px] text-muted">{tier?.detail ?? "Run the module to detect."}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
              API coverage
            </p>
            <p className="mt-1.5 font-display text-2xl font-semibold text-fg">
              {coverage?.value ?? "—"}
            </p>
            <div className="mt-2">
              <ProgressBar value={total ? (supported / total) * 100 : 0} />
            </div>
            <p className="mt-1.5 text-[11px] text-muted">
              {total ? `${supported} features available in this browser` : "Run the module to detect."}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
              Browser family
            </p>
            <p className="mt-1.5 font-display text-2xl font-semibold capitalize text-fg">
              {result?.readings.find((r) => r.key === "browser-family")?.value ?? "—"}
            </p>
            <p className="mt-1 text-[11px] text-muted">
              Chromium exposes the widest diagnostic surface today.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Feature matrix</CardTitle>
          <Badge tone="neutral">{filtered.length} features</Badge>
        </CardHeader>
        <CardContent>
          <div className="no-scrollbar -mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Feature categories">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={category === cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  "shrink-0 rounded-lg border px-3 py-1.5 text-[11.5px] font-medium transition-colors",
                  category === cat
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-line-soft text-muted hover:border-line hover:text-fg",
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <ShieldQuestion className="size-8 text-faint" aria-hidden="true" />
              <p className="text-[13px] text-muted">
                {result ? "No features in this category." : "Run the module to build the feature matrix."}
              </p>
            </div>
          ) : (
            <div className="grid gap-1 sm:grid-cols-2">
              {filtered.map((reading) => {
                const ok = reading.value === "Supported";
                return (
                  <div
                    key={reading.key}
                    className="flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2/40"
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border",
                        ok
                          ? "border-good/35 bg-good/10 text-good"
                          : "border-line bg-surface-2 text-faint",
                      )}
                    >
                      {ok ? (
                        <Check className="size-3" aria-hidden="true" />
                      ) : (
                        <X className="size-3" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-medium text-fg">
                        {reading.label}
                        <span className="ml-2 align-middle text-[9.5px] uppercase tracking-wide text-faint">
                          {reading.source.replace("Feature detection · ", "")}
                        </span>
                      </p>
                      <p className="text-[10.5px] leading-relaxed text-faint">
                        {ok ? reading.detail : `Unlocks: ${reading.detail}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {result?.notes?.length ? (
        <Card>
          <CardContent className="space-y-2 p-5">
            {result.notes.map((note) => (
              <p key={note} className="text-[12px] leading-relaxed text-muted">
                {note}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
