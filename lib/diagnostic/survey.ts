/**
 * Indoor signal survey.
 *
 * Browsers cannot read signal strength, so the survey measures what it can
 * actually observe — latency, jitter, probe failures, throughput — per room,
 * and accepts a *user-entered* dBm value from the phone's own field-test screen
 * as a clearly-labelled secondary signal. Room scores stay null until three
 * samples exist; a single reading is never presented as a room's quality.
 */

import { summariseProbes, type ProbeSample } from "./quality";

export const SURVEY_STORAGE_KEY = "phonecare.survey.v1";

export interface RoomSample {
  at: string;
  latencyMs: number | null;
  jitterMs: number | null;
  failureRatePct: number;
  /** Link score derived only from network probes. */
  score: number | null;
  /** Optional dBm the user read elsewhere; never measured by the browser. */
  userDbm: number | null;
  note?: string;
}

export interface SurveyRoom {
  id: string;
  name: string;
  samples: RoomSample[];
}

export interface SurveyState {
  version: 1;
  startedAt: string;
  updatedAt: string;
  rooms: SurveyRoom[];
}

export interface RoomSummary {
  score: number | null;
  sampleCount: number;
  latencyMedianMs: number | null;
  latencySpreadMs: number | null;
  failureRatePct: number | null;
  userDbmMedian: number | null;
  confidence: "none" | "low" | "medium" | "high";
  note: string;
}

export function createSurvey(): SurveyState {
  const at = new Date().toISOString();
  return { version: 1, startedAt: at, updatedAt: at, rooms: [] };
}

export function makeRoom(name: string): SurveyRoom {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `room-${Date.now()}`,
    name,
    samples: [],
  };
}

export function sampleFromProbes(samples: ProbeSample[], userDbm: number | null, note?: string): RoomSample {
  const summary = summariseProbes(samples);
  // A room score only needs the latency band; throughput is optional here.
  const score =
    summary.medianMs === null
      ? null
      : summary.medianMs <= 40
        ? 94
        : summary.medianMs <= 80
          ? 84
          : summary.medianMs <= 150
            ? 70
            : summary.medianMs <= 300
              ? 52
              : 34;
  return {
    at: new Date().toISOString(),
    latencyMs: summary.medianMs,
    jitterMs: summary.jitterMs,
    failureRatePct: summary.failureRatePct,
    score,
    userDbm,
    ...(note ? { note } : {}),
  };
}

export function summarizeRoom(room: SurveyRoom): RoomSummary {
  const usable = room.samples.filter((s) => s.latencyMs !== null);
  const latencies = usable.map((s) => s.latencyMs as number).sort((a, b) => a - b);
  const scores = usable.map((s) => s.score).filter((s): s is number => s !== null);
  const dbms = room.samples.map((s) => s.userDbm).filter((v): v is number => v !== null && Number.isFinite(v));
  const median = (values: number[]) =>
    values.length === 0 ? null : values.length % 2 ? values[Math.floor(values.length / 2)] ?? null : ((values[values.length / 2 - 1] ?? 0) + (values[values.length / 2] ?? 0)) / 2;
  const med = median(latencies);
  const p25 = latencies.length ? latencies[Math.floor(latencies.length * 0.25)] ?? null : null;
  const p75 = latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.75))] ?? null : null;
  const confidence: RoomSummary["confidence"] =
    usable.length >= 5 ? "high" : usable.length >= 3 ? "medium" : usable.length >= 1 ? "low" : "none";

  return {
    score: scores.length >= 3 ? median(scores) : null,
    sampleCount: room.samples.length,
    latencyMedianMs: usable.length >= 3 ? med : null,
    latencySpreadMs: p25 !== null && p75 !== null ? (p75 - p25) / 2 : null,
    failureRatePct:
      usable.length >= 3
        ? usable.reduce((sum, s) => sum + s.failureRatePct, 0) / usable.length
        : null,
    userDbmMedian: dbms.length >= 2 ? median(dbms) : null,
    confidence,
    note:
      usable.length === 0
        ? "No measured samples yet."
        : usable.length < 3
          ? `${3 - usable.length} more sample${3 - usable.length === 1 ? "" : "s"} needed before this room can be scored.`
          : scores.length < 3
            ? "Some samples failed, so the room score is withheld."
            : dbms.length < 2
              ? "Link-based score only. Add a dBm reading from your phone's field-test screen for a radio view."
              : "Link score with accompanying user-entered dBm readings.",
  };
}

/** Indicative RSRP bands, aligned with the spec and common field-test tools. */
export function classifyRsrp(dbm: number): { label: string; tone: "good" | "warn" | "bad" } {
  if (dbm >= -80) return { label: "Excellent", tone: "good" };
  if (dbm >= -90) return { label: "Good", tone: "good" };
  if (dbm >= -100) return { label: "Fair", tone: "warn" };
  if (dbm >= -110) return { label: "Weak", tone: "bad" };
  return { label: "Very weak", tone: "bad" };
}

export function classifyRssi(dbm: number): { label: string; tone: "good" | "warn" | "bad" } {
  if (dbm >= -50) return { label: "Excellent", tone: "good" };
  if (dbm >= -60) return { label: "Good", tone: "good" };
  if (dbm >= -70) return { label: "Fair", tone: "warn" };
  if (dbm >= -80) return { label: "Weak", tone: "bad" };
  return { label: "Very weak", tone: "bad" };
}

export function loadSurvey(): SurveyState | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SURVEY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SurveyState;
    if (parsed.version !== 1 || !Array.isArray(parsed.rooms)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSurvey(state: SurveyState): SurveyState {
  const next = { ...state, updatedAt: new Date().toISOString() };
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(SURVEY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Quota or private mode: the caller still gets the in-memory state.
    }
  }
  return next;
}

/** Busiest and quietest rooms, used for the window/balcony comparison. */
export function rankRooms(rooms: SurveyRoom[]) {
  return rooms
    .map((room) => ({ room, summary: summarizeRoom(room) }))
    .sort((a, b) => {
      const sa = a.summary.score ?? -1;
      const sb = b.summary.score ?? -1;
      return sb - sa;
    });
}
