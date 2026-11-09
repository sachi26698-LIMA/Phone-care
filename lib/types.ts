/**
 * Core diagnostic data model.
 *
 * Every single reading in PhoneCare carries an `evidence` level. This is a
 * product integrity requirement, not a UI nicety: browser APIs cannot read
 * most phone hardware, so the interface must never blur the line between a
 * real sensor reading, a computed estimate, a value the user typed in, and a
 * metric that simply is not obtainable from the web platform.
 */

export const EVIDENCE_LEVELS = ["measured", "estimated", "user", "unavailable"] as const;

export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

export type ReadingStatus = "good" | "warn" | "bad" | "neutral";

export type ModuleStatus =
  | "idle"
  | "running"
  | "complete"
  | "partial"
  | "unavailable"
  | "error";

export type ModuleId =
  | "device"
  | "battery"
  | "storage"
  | "network"
  | "temperature"
  | "screen"
  | "touch"
  | "compatibility"
  | "performance";

export interface Reading {
  /** Stable identifier used for lookups in the recommendation engine. */
  key: string;
  label: string;
  /** Pre-formatted display value. `null` means the reading could not be taken. */
  value: string | null;
  unit?: string;
  evidence: EvidenceLevel;
  /** Human-readable provenance, e.g. "Battery Status API". */
  source: string;
  /** Why the value matters, or why it is unavailable. */
  detail?: string;
  status?: ReadingStatus;
  /** Raw numeric value where one exists, for scoring and charts. */
  numeric?: number;
}

export interface ModuleResult {
  id: ModuleId;
  status: ModuleStatus;
  /** 0-100 sub-score, or null when no score can be justified. */
  score: number | null;
  /** Share (0-1) of the module's expected signals that were actually obtained. */
  coverage: number;
  readings: Reading[];
  summary: string;
  notes: string[];
  completedAt: number | null;
  durationMs?: number;
}

export interface UserProfile {
  deviceLabel?: string;
  batteryDesignCapacityMah?: number;
  batteryFullChargeCapacityMah?: number;
  batteryCycleCount?: number;
  storageTotalGb?: number;
  storageFreeGb?: number;
  storageUsedGb?: number;
  carrierNetwork?: string;
  /** Ambient room temperature in °C, entered by the user for thermal context. */
  ambientTempC?: number;
  /** Battery/skin temperature read from an on-device tool, in °C. */
  measuredDeviceTempC?: number;
}

export interface ScreenUserCheck {
  id: string;
  label: string;
  passed: boolean;
}

export interface TouchSessionData {
  maxPoints: number;
  coveredCells: number;
  totalCells: number;
  missedCells: string[];
  pointerTypes: string[];
  durationMs: number;
}

export interface DisplayMeasurement {
  cssWidth: number;
  cssHeight: number;
  physicalWidth: number;
  physicalHeight: number;
  dpr: number;
  colorDepth: number;
  refreshHz: number | null;
  p3: boolean;
  hdr: boolean;
  wideGamutHdr: boolean;
}

export interface DiagnosticsState {
  version: 1;
  startedAt: number;
  updatedAt: number;
  modules: Partial<Record<ModuleId, ModuleResult>>;
  profile: UserProfile;
  manual: {
    screenChecks?: ScreenUserCheck[];
    touchSession?: TouchSessionData | null;
    display?: DisplayMeasurement;
  };
}

export interface ModuleMeta {
  id: ModuleId;
  title: string;
  short: string;
  description: string;
  icon: string;
  href: string;
  /** `auto` runs unattended, `hybrid` needs input, `manual` is a guided check. */
  mode: "auto" | "hybrid" | "manual";
  weight: number;
  evidenceNote: string;
}

export const createEmptyState = (): DiagnosticsState => ({
  version: 1,
  startedAt: Date.now(),
  updatedAt: Date.now(),
  modules: {},
  profile: {},
  manual: {},
});
