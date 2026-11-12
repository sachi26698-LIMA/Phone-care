"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardList, GitCompareArrows, Info, ShieldAlert, SignalHigh } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Note } from "@/components/ui/misc";
import { compareSnapshots } from "@/lib/diagnostic/compare";
import { triage, SETTINGS_GUIDANCE, type Finding, type TriageInput } from "@/lib/diagnostic/triage";
import { loadRuns, type StoredRun } from "@/lib/diagnostic/store";
import { loadSurvey, summarizeRoom } from "@/lib/diagnostic/survey";
import { cn } from "@/lib/utils";

function parseDbm(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed <= -20 && parsed >= -150 ? parsed : null;
}

function FindingCard({ finding, primary }: { finding: Finding; primary: boolean }) {
  return (
    <Card className={cn(primary ? "border-purple/25" : undefined)}>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-display text-[15px] font-semibold text-fg">{finding.title}</h3>
          <Badge tone={finding.confidence === "likely" ? "good" : "warn"}>{finding.confidence}</Badge>
        </div>
        <p className="text-[12.5px] leading-relaxed text-muted">{finding.explanation}</p>
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint">Evidence used</p>
          <ul className="mt-1 space-y-1 text-[11.5px] leading-relaxed text-muted">
            {finding.evidence.map((line) => (
              <li key={line}>· {line}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint">Next steps</p>
          <ul className="mt-1.5 space-y-2">
            {finding.actions.map((action) => (
              <li key={action.label} className="rounded-lg border border-line-soft bg-surface-2/40 px-3 py-2">
                <p className="flex items-center gap-2 text-[12px] font-medium text-fg">
                  <span className="rounded border border-line bg-white px-1.5 py-px text-[9.5px] uppercase tracking-wide text-faint">
                    {action.kind}
                  </span>
                  {action.label}
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{action.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export function TroubleshootLab() {
  const [runs, setRuns] = useState<StoredRun[]>([]);
  const [rssi, setRssi] = useState("");
  const [rsrp, setRsrp] = useState("");
  const [transport, setTransport] = useState<TriageInput["transport"]>("wifi");
  const [reportedProblem, setReportedProblem] = useState(true);
  const [beforeId, setBeforeId] = useState("");
  const [afterId, setAfterId] = useState("");
  const [surveyRooms, setSurveyRooms] = useState<Array<{ room: string; score: number | null; dbm: number | null }>>([]);

  useEffect(() => {
    const stored = loadRuns();
    setRuns(stored);
    if (stored.length >= 2) {
      setBeforeId(stored[1]!.id);
      setAfterId(stored[0]!.id);
    } else if (stored.length === 1) {
      setBeforeId(stored[0]!.id);
    }
    const survey = loadSurvey();
    if (survey) {
      setSurveyRooms(
        survey.rooms.map((room) => {
          const summary = summarizeRoom(room);
          return { room: room.name, score: summary.score, dbm: summary.userDbmMedian };
        }),
      );
    }
  }, []);

  const latest = runs[0] ?? null;

  const input: TriageInput = useMemo(
    () => ({
      transport,
      wifiRssiDbm: transport === "wifi" ? parseDbm(rssi) : null,
      cellularRsrpDbm: parseDbm(rsrp),
      latencyMedianMs: latest?.snapshot.latencyMedianMs ?? null,
      jitterMs: latest?.snapshot.jitterMs ?? null,
      failureRatePct: latest?.snapshot.failureRatePct ?? null,
      dnsMs: latest?.report.measurements.find((m) => m.id === "net.dns.lookup_time")?.value ?? null,
      ttfbMs: latest?.report.measurements.find((m) => m.id === "net.ttfb")?.value ?? null,
      downloadMbps: latest?.snapshot.downloadMbps ?? null,
      uploadMbps: latest?.snapshot.uploadMbps ?? null,
      survey: surveyRooms,
      reportedProblem,
    }),
    [transport, rssi, rsrp, latest, surveyRooms, reportedProblem],
  );

  const result = useMemo(() => triage(input), [input]);

  const before = runs.find((run) => run.id === beforeId) ?? null;
  const after = runs.find((run) => run.id === afterId) ?? null;
  const comparison = before && after && before.id !== after.id ? compareSnapshots(before.snapshot, after.snapshot) : null;

  return (
    <div className="space-y-4">
      <Note tone="info" title="This workflow classifies, it does not repair">
        The engine reads the measurements you already took, names the most likely cause, and lists what else is missing.
        It cannot change settings, cannot boost a radio, and will say &quot;no measurable change&quot; when a change lands
        inside the noise band.
      </Note>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle as="h2" className="flex items-center gap-2">
              <SignalHigh className="size-4 text-purple" aria-hidden="true" />
              Signal context
            </CardTitle>
            <Badge tone="neutral">your input, not measured here</Badge>
          </CardHeader>
          <CardContent className="space-y-3 pt-3">
            <p className="text-[12px] leading-relaxed text-muted">
              Latency, jitter, failures and throughput come from your latest quality test
              {latest ? ` (${new Date(latest.savedAt).toLocaleString()})` : " — none saved yet"}. Signal values must be
              entered manually in this browser; the Android app reads them directly.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Transport" htmlFor="transport">
                <select
                  id="transport"
                  value={transport}
                  onChange={(event) => setTransport(event.target.value as TriageInput["transport"])}
                  className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-fg outline-none focus:border-accent/70 focus:ring-2 focus:ring-accent/20"
                >
                  <option value="wifi">Wi-Fi</option>
                  <option value="cellular">Cellular</option>
                  <option value="ethernet">Ethernet</option>
                  <option value="unknown">Unknown</option>
                </select>
              </Field>
              <Field label="Wi-Fi RSSI" htmlFor="rssi" suffix="dBm" hint="From router app or phone">
                <Input
                  id="rssi"
                  type="number"
                  min={-100}
                  max={-20}
                  value={rssi}
                  placeholder="-72"
                  onChange={(event) => setRssi(event.target.value)}
                />
              </Field>
              <Field label="Cellular RSRP" htmlFor="rsrp" suffix="dBm" hint="Field-test screen">
                <Input
                  id="rsrp"
                  type="number"
                  min={-140}
                  max={-40}
                  value={rsrp}
                  placeholder="-104"
                  onChange={(event) => setRsrp(event.target.value)}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-[12px] text-muted">
              <input
                type="checkbox"
                checked={reportedProblem}
                onChange={(event) => setReportedProblem(event.target.checked)}
                className="size-4 rounded border-line text-purple focus:ring-purple/30"
              />
              I am experiencing a problem even if the numbers look acceptable
            </label>
            <div className="flex flex-wrap gap-2">
              <Link href="/network/quality">
                <Button size="sm" variant="secondary">
                  <ClipboardList className="size-3.5" aria-hidden="true" />
                  {latest ? "Re-measure" : "Run a quality test first"}
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Button>
              </Link>
              <Link href="/network/survey">
                <Button size="sm" variant="ghost">
                  Open the room survey
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Missing inputs</CardTitle>
            <Badge tone={result.missing.length ? "warn" : "good"}>{result.missing.length ? result.missing.length : "none"}</Badge>
          </CardHeader>
          <CardContent className="pt-3 text-[12px] leading-relaxed text-muted">
            {result.missing.length === 0 ? (
              <p>The engine has the readings it needs for this transport.</p>
            ) : (
              <ul className="space-y-1.5">
                {result.missing.map((item) => (
                  <li key={item}>· {item}</li>
                ))}
              </ul>
            )}
            <p className="mt-3 border-t border-line-soft pt-2 text-[11px] text-faint">
              Unknown inputs downgrade the conclusion instead of being filled in.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-fg">Diagnosis</h2>
        {result.findings.map((finding, index) => (
          <FindingCard key={`${finding.cause}-${index}`} finding={finding} primary={index === 0} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <GitCompareArrows className="size-4 text-purple" aria-hidden="true" />
            Before / after comparison
          </CardTitle>
          <Badge tone="neutral">
            {runs.length} saved run{runs.length === 1 ? "" : "s"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3 pt-3">
          {runs.length < 2 ? (
            <p className="text-[12.5px] leading-relaxed text-muted">
              Two saved quality tests are needed. Change one thing between them — move the router, switch band, reboot it —
              then compare. The comparison uses each run&apos;s measured spread, not a fixed percentage.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Before" htmlFor="before-run">
                  <select
                    id="before-run"
                    value={beforeId}
                    onChange={(event) => setBeforeId(event.target.value)}
                    className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-fg outline-none focus:border-accent/70 focus:ring-2 focus:ring-accent/20"
                  >
                    {runs.map((run) => (
                      <option key={run.id} value={run.id}>
                        {new Date(run.savedAt).toLocaleString()} · {run.snapshot.latencyMedianMs?.toFixed(0) ?? "—"} ms
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="After" htmlFor="after-run">
                  <select
                    id="after-run"
                    value={afterId}
                    onChange={(event) => setAfterId(event.target.value)}
                    className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-fg outline-none focus:border-accent/70 focus:ring-2 focus:ring-accent/20"
                  >
                    {runs.map((run) => (
                      <option key={run.id} value={run.id}>
                        {new Date(run.savedAt).toLocaleString()} · {run.snapshot.latencyMedianMs?.toFixed(0) ?? "—"} ms
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {comparison ? (
                <div className="space-y-2">
                  <p
                    className={cn(
                      "text-[13px] font-medium",
                      comparison.verdict === "improved" ? "text-good" : comparison.verdict === "worse" ? "text-bad" : "text-fg",
                    )}
                    role="status"
                  >
                    {comparison.summary}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-[12px]">
                      <thead>
                        <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.12em] text-faint">
                          <th scope="col" className="py-2 pr-3 font-semibold">Metric</th>
                          <th scope="col" className="py-2 pr-3 font-semibold">Before</th>
                          <th scope="col" className="py-2 pr-3 font-semibold">After</th>
                          <th scope="col" className="py-2 pr-3 font-semibold">Change</th>
                          <th scope="col" className="py-2 font-semibold">Noise band</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparison.changes.map((change) => (
                          <tr key={change.id} className="border-b border-line-soft/70 last:border-0">
                            <th scope="row" className="py-2 pr-3 font-medium text-fg">{change.label}</th>
                            <td className="py-2 pr-3 tabular-nums text-muted">{change.before?.toFixed(1) ?? "—"} {change.unit}</td>
                            <td className="py-2 pr-3 tabular-nums text-muted">{change.after?.toFixed(1) ?? "—"} {change.unit}</td>
                            <td className={cn("py-2 pr-3 tabular-nums font-medium", change.direction === "improved" ? "text-good" : change.direction === "worse" ? "text-bad" : "text-faint")}>
                              {change.deltaPct === null ? "—" : `${change.deltaPct > 0 ? "+" : ""}${change.deltaPct.toFixed(0)} %`}
                            </td>
                            <td className="py-2 tabular-nums text-faint">±{change.thresholdPct.toFixed(0)} %</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ul className="space-y-1 text-[11px] leading-relaxed text-faint">
                    {comparison.caveats.map((caveat) => (
                      <li key={caveat}>· {caveat}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-[12px] text-muted">Select two different runs.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-warn" aria-hidden="true" />
            Safe actions only
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 pt-3 text-[12px] leading-relaxed text-muted">
          {SETTINGS_GUIDANCE.map((action) => (
            <div key={action.label}>
              <p className="font-medium text-fg">{action.label}</p>
              <p>{action.detail}</p>
            </div>
          ))}
          <p className="border-t border-line-soft pt-2">
            <span className="font-medium text-fg">Approved boosters only.</span> A consumer amplifier that retransmits
            licensed spectrum is illegal in many countries. Only a carrier-approved, fixed booster is a legitimate option,
            and it is installed by a technician — not by an app.
          </p>
          <p className="flex items-start gap-2 text-[11.5px] text-faint">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            PhoneCare never silently changes a setting, never disables a security control, and never claims to increase
            router or radio transmit power.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
