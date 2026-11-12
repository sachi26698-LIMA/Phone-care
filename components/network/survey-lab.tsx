"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, Home, Loader2, Plus, Radar, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Note } from "@/components/ui/misc";
import { runProbeSeries } from "@/lib/diagnostic/quality";
import {
  classifyRsrp,
  createSurvey,
  loadSurvey,
  makeRoom,
  rankRooms,
  sampleFromProbes,
  saveSurvey,
  summarizeRoom,
  type SurveyRoom,
  type SurveyState,
} from "@/lib/diagnostic/survey";
import { cn } from "@/lib/utils";

function toneForScore(score: number | null): string {
  if (score === null) return "border-line-soft bg-surface-2/50";
  if (score >= 84) return "border-good/35 bg-good/10";
  if (score >= 70) return "border-warn/35 bg-warn/10";
  return "border-bad/35 bg-bad/10";
}

function labelForScore(score: number | null): string {
  if (score === null) return "Needs samples";
  if (score >= 84) return "Strong";
  if (score >= 70) return "Fair";
  return "Weak";
}

export function SurveyLab() {
  const [survey, setSurvey] = useState<SurveyState>(createSurvey);
  const [hydrated, setHydrated] = useState(false);
  const [name, setName] = useState("");
  const [busyRoom, setBusyRoom] = useState<string | null>(null);
  const [dbmDraft, setDbmDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSurvey(loadSurvey() ?? createSurvey());
    setHydrated(true);
  }, []);

  function update(mutator: (draft: SurveyState) => SurveyState) {
    setSurvey((current) => saveSurvey(mutator(current)));
  }

  function addRoom() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (survey.rooms.some((room) => room.name.toLowerCase() === trimmed.toLowerCase())) {
      setError("A room with that name already exists.");
      return;
    }
    setError(null);
    update((current) => ({ ...current, rooms: [...current.rooms, makeRoom(trimmed)].slice(0, 12) }));
    setName("");
  }

  async function measureRoom(roomId: string) {
    setBusyRoom(roomId);
    setError(null);
    try {
      const run = await runProbeSeries({ count: 5 });
      const dbm = Number.parseFloat(dbmDraft[roomId] ?? "");
      const sample = sampleFromProbes(run.samples, Number.isFinite(dbm) ? dbm : null);
      update((current) => ({
        ...current,
        rooms: current.rooms.map((room) =>
          room.id === roomId ? { ...room, samples: [...room.samples, sample].slice(-20) } : room,
        ),
      }));
    } catch {
      setError("The probe series could not be completed. Check the connection and try again.");
    } finally {
      setBusyRoom(null);
    }
  }

  const ranked = useMemo(() => rankRooms(survey.rooms), [survey.rooms]);
  const scored = ranked.filter((entry) => entry.summary.score !== null);
  const best = scored[0] ?? null;
  const worst = scored.length > 1 ? scored[scored.length - 1] ?? null : null;
  const delta = best && worst && best.summary.score !== null && worst.summary.score !== null
    ? Math.round(best.summary.score - worst.summary.score)
    : null;

  function downloadSurvey() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            schema: "phonecare.survey/1",
            exportedAt: new Date().toISOString(),
            method:
              "Per-room HTTP probe series (5 probes). Scores are link quality, not radio measurements. User-entered dBm values are marked as such.",
            rooms: survey.rooms.map((room) => ({ name: room.name, samples: room.samples, summary: summarizeRoom(room) })),
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "phonecare-indoor-survey.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <Note tone="info" title="What this survey measures — and does not">
        Each sample is a real five-probe latency series taken where you are standing. That reflects the whole path from
        your room to this server. It is <strong className="font-semibold">not</strong> a radio heatmap: a browser cannot
        read RSRP or Wi-Fi RSSI, so radio values are only shown when you type in a number you read elsewhere, and they
        are labelled as your input.
      </Note>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle as="h2" className="flex items-center gap-2">
              <Plus className="size-4 text-purple" aria-hidden="true" />
              Add a room
            </CardTitle>
            <Badge tone="neutral">manual location only</Badge>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex-1">
                <Field label="Room name" htmlFor="room-name" hint="Examples: living room, bedroom, balcony, kitchen.">
                  <Input
                    id="room-name"
                    value={name}
                    maxLength={40}
                    placeholder="Living room"
                    onChange={(event) => setName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") addRoom();
                    }}
                  />
                </Field>
              </div>
              <Button onClick={addRoom} disabled={!name.trim()} className="sm:mt-[22px] sm:self-start">
                <Plus className="size-4" aria-hidden="true" />
                Add
              </Button>
            </div>
            {error ? (
              <p role="alert" className="mt-2 text-[12px] text-bad">
                {error}
              </p>
            ) : null}
            <p className="mt-3 text-[11px] leading-relaxed text-faint">
              Location permission is never requested. Rooms are names you type, which keeps the survey working on a
              desktop too and avoids storing a movement track.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2" className="flex items-center gap-2">
              <Radar className="size-4 text-purple" aria-hidden="true" />
              Weak-spot ranking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-3 text-[12px]">
            {scored.length === 0 ? (
              <p className="text-muted">Add rooms and take at least three samples in each.</p>
            ) : (
              <>
                <p className="text-muted">
                  {worst ? (
                    <>
                      <span className="font-semibold text-fg">{best?.room.name}</span> is best at{" "}
                      {Math.round(best?.summary.score ?? 0)}; <span className="font-semibold text-fg">{worst.room.name}</span>{" "}
                      is lowest at {Math.round(worst.summary.score ?? 0)}.
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-fg">{best?.room.name}</span> scores{" "}
                      {Math.round(best?.summary.score ?? 0)} of 100. Add a second scored room to compare.
                    </>
                  )}
                </p>
                {delta !== null ? (
                  <p className="flex items-start gap-2 rounded-lg border border-line-soft bg-surface-2/50 px-3 py-2 text-[11.5px] leading-relaxed text-muted">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden="true" />
                    A gap of {delta} points between rooms points at coverage or obstructions, but it is not proof: test the
                    same rooms again later before moving furniture or buying hardware.
                  </p>
                ) : null}
              </>
            )}
            <Button variant="ghost" size="sm" onClick={downloadSurvey} disabled={survey.rooms.length === 0}>
              <Download className="size-3.5" aria-hidden="true" />
              Export survey JSON
            </Button>
          </CardContent>
        </Card>
      </div>

      {hydrated && survey.rooms.length === 0 ? (
        <Card>
          <CardContent className="grid place-items-center gap-2 p-10 text-center">
            <Home className="size-6 text-lavender" aria-hidden="true" />
            <p className="text-[13px] font-semibold text-fg">No rooms yet</p>
            <p className="max-w-sm text-[12px] leading-relaxed text-muted">
              Name the places you actually use the phone. Take five probes in each, three separate times, then compare.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {survey.rooms.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            busy={busyRoom === room.id}
            dbm={dbmDraft[room.id] ?? ""}
            onDbmChange={(value) => setDbmDraft((current) => ({ ...current, [room.id]: value }))}
            onMeasure={() => measureRoom(room.id)}
            onRemove={() =>
              update((current) => ({ ...current, rooms: current.rooms.filter((entry) => entry.id !== room.id) }))
            }
          />
        ))}
      </div>

      {survey.rooms.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2">Linked comparison</CardTitle>
            <Badge tone="neutral">{survey.rooms.length} rooms</Badge>
          </CardHeader>
          <CardContent className="overflow-x-auto pt-3">
            <table className="w-full min-w-[620px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.12em] text-faint">
                  <th scope="col" className="py-2 pr-3 font-semibold">Room</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Samples</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Median RTT</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Spread</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Failures</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Score</th>
                  <th scope="col" className="py-2 font-semibold">Your dBm input</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map(({ room, summary }) => (
                  <tr key={room.id} className="border-b border-line-soft/70 last:border-0">
                    <th scope="row" className="py-2 pr-3 font-medium text-fg">{room.name}</th>
                    <td className="py-2 pr-3 tabular-nums text-muted">{summary.sampleCount}</td>
                    <td className="py-2 pr-3 tabular-nums text-fg">{summary.latencyMedianMs?.toFixed(0) ?? "—"} ms</td>
                    <td className="py-2 pr-3 tabular-nums text-muted">± {summary.latencySpreadMs?.toFixed(0) ?? "—"} ms</td>
                    <td className="py-2 pr-3 tabular-nums text-muted">{summary.failureRatePct?.toFixed(1) ?? "—"} %</td>
                    <td className="py-2 pr-3 tabular-nums font-semibold text-fg">{summary.score !== null ? Math.round(summary.score) : "—"}</td>
                    <td className={cn("py-2 tabular-nums", summary.userDbmMedian !== null ? "text-fg" : "text-faint")}>
                      {summary.userDbmMedian !== null
                        ? `${summary.userDbmMedian} dBm · ${classifyRsrp(summary.userDbmMedian).label}`
                        : "none"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] leading-relaxed text-faint">
              The dBm column only contains values you entered. It is shown so radio context is not lost, not because the
              browser measured it. Bands: ≥ −80 excellent, −90 to −80 good, −100 to −90 fair, below −105 weak.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function RoomCard({
  room,
  busy,
  dbm,
  onDbmChange,
  onMeasure,
  onRemove,
}: {
  room: SurveyRoom;
  busy: boolean;
  dbm: string;
  onDbmChange: (value: string) => void;
  onMeasure: () => void;
  onRemove: () => void;
}) {
  const summary = summarizeRoom(room);
  const band = summary.userDbmMedian !== null ? classifyRsrp(summary.userDbmMedian) : null;
  return (
    <Card className={cn("transition-colors", toneForScore(summary.score))}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-display text-[14px] font-semibold text-fg">{room.name}</p>
            <p className="mt-0.5 text-[11px] text-faint">
              {summary.sampleCount} sample{summary.sampleCount === 1 ? "" : "s"} · confidence {summary.confidence}
            </p>
          </div>
          <Badge tone={summary.score === null ? "neutral" : summary.score >= 84 ? "good" : summary.score >= 70 ? "warn" : "bad"}>
            {labelForScore(summary.score)}
          </Badge>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="font-display text-[28px] font-semibold leading-none tabular-nums text-fg">
            {summary.score !== null ? Math.round(summary.score) : "—"}
          </span>
          <span className="text-[11px] text-faint">/ 100 link score</span>
        </div>

        <p className="text-[11.5px] leading-relaxed text-muted">{summary.note}</p>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-lg bg-white/70 px-2.5 py-2">
            <p className="text-faint">Median RTT</p>
            <p className="mt-0.5 tabular-nums font-medium text-fg">{summary.latencyMedianMs?.toFixed(0) ?? "—"} ms</p>
          </div>
          <div className="rounded-lg bg-white/70 px-2.5 py-2">
            <p className="text-faint">Spread</p>
            <p className="mt-0.5 tabular-nums font-medium text-fg">± {summary.latencySpreadMs?.toFixed(0) ?? "—"} ms</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Field
            label="Optional dBm you read elsewhere"
            htmlFor={`dbm-${room.id}`}
            hint="From your phone's field-test screen or the Android app. Stored as your input, not a measurement."
          >
            <Input
              id={`dbm-${room.id}`}
              type="number"
              inputMode="numeric"
              min={-140}
              max={-40}
              step={1}
              placeholder="e.g. −104"
              value={dbm}
              onChange={(event) => onDbmChange(event.target.value)}
            />
          </Field>
          {band ? (
            <p className="text-[11px] text-muted">
              Latest median input: <span className="font-medium text-fg">{summary.userDbmMedian} dBm</span> · {band.label}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onMeasure} disabled={busy}>
            {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Radar className="size-3.5" aria-hidden="true" />}
            {busy ? "Measuring…" : "Take 5 probes"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onRemove} aria-label={`Remove ${room.name}`}>
            <Trash2 className="size-3.5" aria-hidden="true" />
            Remove
          </Button>
        </div>

        {room.samples.length > 0 ? (
          <ul className="space-y-1 border-t border-line-soft pt-2 text-[10.5px] text-faint">
            {room.samples
              .slice(-3)
              .reverse()
              .map((sample) => (
                <li key={sample.at} className="flex justify-between gap-2 tabular-nums">
                  <span>{new Date(sample.at).toLocaleTimeString()}</span>
                  <span>
                    {sample.latencyMs !== null ? `${sample.latencyMs.toFixed(0)} ms` : "no RTT"}
                    {sample.userDbm !== null ? ` · ${sample.userDbm} dBm` : ""}
                  </span>
                </li>
              ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
