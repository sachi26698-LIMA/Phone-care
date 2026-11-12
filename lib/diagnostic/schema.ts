/**
 * Shared diagnostic report contract (v1).
 *
 * The JSON Schema lives at `shared/diagnostics.schema.json` and is the
 * normative document. This module is the runtime validator used by
 * /api/reports and by the tests in `scripts/contract-test.mjs`, so a report
 * that one app produces can be checked by the other without a build step.
 *
 * Design rule: a measurement without a value is legal, but only when its
 * evidence is "unavailable" and its value is null. That makes fabrication a
 * schema error instead of a judgement call.
 */

export const REPORT_SCHEMA_VERSION = "phonecare.report/1" as const;

export const EVIDENCE_LEVELS = ["measured", "estimated", "user", "unavailable"] as const;
export type ReportEvidence = (typeof EVIDENCE_LEVELS)[number];

export const AVAILABILITY_STATES = [
  "available",
  "permission_denied",
  "unsupported",
  "transient",
] as const;
export type Availability = (typeof AVAILABILITY_STATES)[number];

export const UNITS = ["dBm", "dB", "ms", "Mbps", "%", "count", "MHz", "dBm/MHz"] as const;
export type Unit = (typeof UNITS)[number];

export const PLATFORMS = ["web", "android"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const TRANSPORTS = ["wifi", "cellular", "ethernet", "unknown"] as const;
export type Transport = (typeof TRANSPORTS)[number];

export const TRIGGERS = ["manual", "scheduled", "survey"] as const;
export type Trigger = (typeof TRIGGERS)[number];

export interface MeasurementUncertainty {
  kind: "resolution" | "sample_spread" | "none";
  value: number | null;
  unit: string;
}

export interface Measurement {
  id: string;
  label: string;
  value: number | null;
  unit: Unit;
  evidence: ReportEvidence;
  source: string;
  availability: Availability;
  timestamp: string;
  uncertainty?: MeasurementUncertainty;
  sampleCount?: number | null;
  context?: Record<string, string | number | boolean | null>;
  notes?: string[];
}

export interface SimInfo {
  slot: number;
  carrier: string | null;
  rat: string | null;
  roaming?: boolean | null;
  active?: boolean | null;
}

export interface DiagnosticReport {
  schemaVersion: typeof REPORT_SCHEMA_VERSION;
  id: string;
  generatedAt: string;
  platform: Platform;
  app: { name: string; version: string; build?: string | null };
  device: {
    manufacturer: string | null;
    model: string | null;
    osVersion: string | null;
    sdkInt: number | null;
  };
  session: { startedAt: string; durationMs: number; trigger: Trigger };
  network: { transport: Transport; carrier: string | null; server: string | null; sims?: SimInfo[] };
  measurements: Measurement[];
  limitations: string[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  report?: DiagnosticReport;
}

const MAX_MEASUREMENTS = 400;
const MAX_STRING = 500;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE.test(value) && !Number.isNaN(Date.parse(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function checkString(
  value: unknown,
  path: string,
  errors: ValidationIssue[],
  { nullable = false, max = MAX_STRING }: { nullable?: boolean; max?: number } = {},
) {
  if (value === null && nullable) return;
  if (typeof value !== "string") {
    errors.push({ path, message: `expected a string${nullable ? " or null" : ""}` });
    return;
  }
  if (value.length === 0) errors.push({ path, message: "must not be empty" });
  if (value.length > max) errors.push({ path, message: `must be at most ${max} characters` });
}

function unknownKeys(
  value: Record<string, unknown>,
  allowed: string[],
  path: string,
  errors: ValidationIssue[],
) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.push({ path: `${path}.${key}`, message: "unexpected property" });
  }
}

/** Validates and returns a normalized deep copy, or the list of problems. */
export function validateReport(input: unknown): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!isObject(input)) {
    return { ok: false, errors: [{ path: "$", message: "report must be a JSON object" }], warnings };
  }

  unknownKeys(
    input,
    [
      "schemaVersion",
      "id",
      "generatedAt",
      "platform",
      "app",
      "device",
      "session",
      "network",
      "measurements",
      "limitations",
    ],
    "$",
    errors,
  );

  if (input.schemaVersion !== REPORT_SCHEMA_VERSION) {
    errors.push({
      path: "$.schemaVersion",
      message: `must equal "${REPORT_SCHEMA_VERSION}"`,
    });
  }

  checkString(input.id, "$.id", errors, { max: 64 });
  if (!isIsoDate(input.generatedAt)) {
    errors.push({ path: "$.generatedAt", message: "must be an ISO 8601 date-time with a timezone" });
  }
  if (!PLATFORMS.includes(input.platform as Platform)) {
    errors.push({ path: "$.platform", message: `must be one of ${PLATFORMS.join(", ")}` });
  }

  // app
  if (!isObject(input.app)) {
    errors.push({ path: "$.app", message: "must be an object" });
  } else {
    unknownKeys(input.app, ["name", "version", "build"], "$.app", errors);
    checkString(input.app.name, "$.app.name", errors, { max: 80 });
    checkString(input.app.version, "$.app.version", errors, { max: 40 });
    if (input.app.build !== undefined) {
      checkString(input.app.build, "$.app.build", errors, { nullable: true, max: 40 });
    }
  }

  // device
  if (!isObject(input.device)) {
    errors.push({ path: "$.device", message: "must be an object" });
  } else {
    unknownKeys(input.device, ["manufacturer", "model", "osVersion", "sdkInt"], "$.device", errors);
    checkString(input.device.manufacturer, "$.device.manufacturer", errors, { nullable: true, max: 80 });
    checkString(input.device.model, "$.device.model", errors, { nullable: true, max: 80 });
    checkString(input.device.osVersion, "$.device.osVersion", errors, { nullable: true, max: 80 });
    const sdk = input.device.sdkInt;
    if (sdk !== null) {
      if (!Number.isInteger(sdk) || (sdk as number) < 1 || (sdk as number) > 100) {
        errors.push({ path: "$.device.sdkInt", message: "must be an integer 1-100 or null" });
      }
    }
  }

  // session
  if (!isObject(input.session)) {
    errors.push({ path: "$.session", message: "must be an object" });
  } else {
    unknownKeys(input.session, ["startedAt", "durationMs", "trigger"], "$.session", errors);
    if (!isIsoDate(input.session.startedAt)) {
      errors.push({ path: "$.session.startedAt", message: "must be an ISO 8601 date-time" });
    }
    if (!isFiniteNumber(input.session.durationMs) || (input.session.durationMs as number) < 0) {
      errors.push({ path: "$.session.durationMs", message: "must be a non-negative number" });
    }
    if (!TRIGGERS.includes(input.session.trigger as Trigger)) {
      errors.push({ path: "$.session.trigger", message: `must be one of ${TRIGGERS.join(", ")}` });
    }
  }

  // network
  if (!isObject(input.network)) {
    errors.push({ path: "$.network", message: "must be an object" });
  } else {
    unknownKeys(input.network, ["transport", "carrier", "server", "sims"], "$.network", errors);
    if (!TRANSPORTS.includes(input.network.transport as Transport)) {
      errors.push({ path: "$.network.transport", message: `must be one of ${TRANSPORTS.join(", ")}` });
    }
    checkString(input.network.carrier, "$.network.carrier", errors, { nullable: true, max: 80 });
    checkString(input.network.server, "$.network.server", errors, { nullable: true, max: 200 });
    if (input.network.sims !== undefined) {
      if (!Array.isArray(input.network.sims)) {
        errors.push({ path: "$.network.sims", message: "must be an array" });
      } else if (input.network.sims.length > 4) {
        errors.push({ path: "$.network.sims", message: "at most 4 SIM records" });
      } else {
        input.network.sims.forEach((sim, index) => {
          const at = `$.network.sims[${index}]`;
          if (!isObject(sim)) {
            errors.push({ path: at, message: "must be an object" });
            return;
          }
          unknownKeys(sim, ["slot", "carrier", "rat", "roaming", "active"], at, errors);
          if (!Number.isInteger(sim.slot) || (sim.slot as number) < 0 || (sim.slot as number) > 3) {
            errors.push({ path: `${at}.slot`, message: "must be an integer 0-3" });
          }
          checkString(sim.carrier, `${at}.carrier`, errors, { nullable: true, max: 80 });
          checkString(sim.rat, `${at}.rat`, errors, { nullable: true, max: 16 });
          for (const key of ["roaming", "active"] as const) {
            if (sim[key] !== undefined && sim[key] !== null && typeof sim[key] !== "boolean") {
              errors.push({ path: `${at}.${key}`, message: "must be a boolean or null" });
            }
          }
        });
      }
    }
  }

  // measurements
  const measurements = input.measurements;
  if (!Array.isArray(measurements)) {
    errors.push({ path: "$.measurements", message: "must be an array" });
  } else if (measurements.length > MAX_MEASUREMENTS) {
    errors.push({ path: "$.measurements", message: `at most ${MAX_MEASUREMENTS} measurements` });
  } else {
    measurements.forEach((m, index) => {
      const at = `$.measurements[${index}]`;
      if (!isObject(m)) {
        errors.push({ path: at, message: "must be an object" });
        return;
      }
      unknownKeys(
        m,
        [
          "id",
          "label",
          "value",
          "unit",
          "evidence",
          "source",
          "availability",
          "timestamp",
          "uncertainty",
          "sampleCount",
          "context",
          "notes",
        ],
        at,
        errors,
      );
      checkString(m.id, `${at}.id`, errors, { max: 64 });
      checkString(m.label, `${at}.label`, errors, { max: 80 });
      checkString(m.source, `${at}.source`, errors, { max: 200 });
      if (!UNITS.includes(m.unit as Unit)) {
        errors.push({ path: `${at}.unit`, message: `must be one of ${UNITS.join(", ")}` });
      }
      if (!EVIDENCE_LEVELS.includes(m.evidence as ReportEvidence)) {
        errors.push({ path: `${at}.evidence`, message: `must be one of ${EVIDENCE_LEVELS.join(", ")}` });
      }
      if (!AVAILABILITY_STATES.includes(m.availability as Availability)) {
        errors.push({
          path: `${at}.availability`,
          message: `must be one of ${AVAILABILITY_STATES.join(", ")}`,
        });
      }
      if (!isIsoDate(m.timestamp)) {
        errors.push({ path: `${at}.timestamp`, message: "must be an ISO 8601 date-time" });
      }
      if (m.value !== null && !isFiniteNumber(m.value)) {
        errors.push({ path: `${at}.value`, message: "must be a finite number or null" });
      }
      // Integrity rules: this is the whole point of the contract.
      if (m.value === null && m.evidence !== "unavailable") {
        errors.push({
          path: `${at}.evidence`,
          message: "a null value must be reported as unavailable, never as measured or estimated",
        });
      }
      if (m.value !== null && m.evidence === "unavailable") {
        errors.push({
          path: `${at}.value`,
          message: "evidence is unavailable, so the value must be null",
        });
      }
      if (m.value === null && m.availability === "available") {
        errors.push({
          path: `${at}.availability`,
          message: "a null value cannot be marked available; use permission_denied, unsupported or transient",
        });
      }
      if (m.value !== null && m.availability !== "available") {
        errors.push({
          path: `${at}.availability`,
          message: "a numeric value must be marked available",
        });
      }
      if (m.uncertainty !== undefined) {
        if (!isObject(m.uncertainty)) {
          errors.push({ path: `${at}.uncertainty`, message: "must be an object" });
        } else {
          unknownKeys(m.uncertainty, ["kind", "value", "unit"], `${at}.uncertainty`, errors);
          if (!["resolution", "sample_spread", "none"].includes(m.uncertainty.kind as string)) {
            errors.push({
              path: `${at}.uncertainty.kind`,
              message: "must be resolution, sample_spread or none",
            });
          }
          if (m.uncertainty.value !== null && !isFiniteNumber(m.uncertainty.value)) {
            errors.push({ path: `${at}.uncertainty.value`, message: "must be a finite number or null" });
          }
          checkString(m.uncertainty.unit, `${at}.uncertainty.unit`, errors, { max: 16 });
        }
      }
      if (m.sampleCount !== undefined && m.sampleCount !== null) {
        if (!Number.isInteger(m.sampleCount) || (m.sampleCount as number) < 1) {
          errors.push({ path: `${at}.sampleCount`, message: "must be a positive integer or null" });
        }
      }
      if (m.context !== undefined) {
        if (!isObject(m.context)) {
          errors.push({ path: `${at}.context`, message: "must be an object" });
        } else if (Object.keys(m.context).length > 12) {
          errors.push({ path: `${at}.context`, message: "at most 12 context keys" });
        } else {
          for (const [key, value] of Object.entries(m.context)) {
            const okType =
              value === null ||
              typeof value === "string" ||
              typeof value === "number" ||
              typeof value === "boolean";
            if (!okType) errors.push({ path: `${at}.context.${key}`, message: "unsupported value type" });
            if (typeof value === "string" && value.length > 200) {
              errors.push({ path: `${at}.context.${key}`, message: "string too long" });
            }
          }
        }
      }
      if (m.notes !== undefined) {
        if (!Array.isArray(m.notes) || m.notes.length > 10 || m.notes.some((n) => typeof n !== "string")) {
          errors.push({ path: `${at}.notes`, message: "must be an array of at most 10 strings" });
        }
      }
    });

    // Duplicate ids make before/after comparisons ambiguous.
    const seen = new Set<string>();
    measurements.forEach((m, index) => {
      if (!isObject(m) || typeof m.id !== "string") return;
      if (seen.has(m.id)) {
        warnings.push({ path: `$.measurements[${index}].id`, message: `duplicate measurement id "${m.id}"` });
      }
      seen.add(m.id);
    });
  }

  // limitations
  if (!Array.isArray(input.limitations) || input.limitations.length === 0) {
    errors.push({ path: "$.limitations", message: "at least one limitation statement is required" });
  } else if (input.limitations.length > 20) {
    errors.push({ path: "$.limitations", message: "at most 20 limitations" });
  } else {
    input.limitations.forEach((limit, index) => {
      if (typeof limit !== "string" || limit.length === 0 || limit.length > MAX_STRING) {
        errors.push({ path: `$.limitations[${index}]`, message: `must be a string of 1-${MAX_STRING} characters` });
      }
    });
  }

  // Semantic checks that are advisory rather than fatal.
  if (input.platform === "web") {
    const hasRadio = (measurements as unknown[] | undefined)?.some?.(
      (m) =>
        isObject(m) &&
        typeof m.id === "string" &&
        m.value !== null &&
        /^(lte|nr|wcdma|gsm|wifi)\.(rsrp|rsrq|sinr|rssi)$/.test(m.id),
    );
    if (hasRadio) {
      warnings.push({
        path: "$.measurements",
        message: "a web report claims radio-level measurements; browsers cannot read them",
      });
    }
  }
  if (input.platform === "android" && Array.isArray(measurements)) {
    const cellular = measurements.some(
      (m) => isObject(m) && typeof m.id === "string" && m.id.startsWith("lte."),
    );
    const limitations = Array.isArray(input.limitations) ? (input.limitations as unknown[]) : [];
    if (
      cellular &&
      !limitations.some((limit) => typeof limit === "string" && /modem|RSRP|signal/i.test(limit))
    ) {
      warnings.push({
        path: "$.limitations",
        message: "cellular reports should state that radio values are modem-reported",
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors, warnings };

  return { ok: true, errors, warnings, report: normalizeReport(input as unknown as DiagnosticReport) };
}

/** Deep copy with stable key order; prevents callers mutating the parsed input. */
export function normalizeReport(report: DiagnosticReport): DiagnosticReport {
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    id: report.id,
    generatedAt: report.generatedAt,
    platform: report.platform,
    app: { ...report.app },
    device: { ...report.device },
    session: { ...report.session },
    network: {
      transport: report.network.transport,
      carrier: report.network.carrier,
      server: report.network.server,
      ...(report.network.sims ? { sims: report.network.sims.map((sim) => ({ ...sim })) } : {}),
    },
    measurements: report.measurements.map((m) => ({
      ...m,
      ...(m.context ? { context: { ...m.context } } : {}),
      ...(m.notes ? { notes: [...m.notes] } : {}),
      ...(m.uncertainty ? { uncertainty: { ...m.uncertainty } } : {}),
    })),
    limitations: [...report.limitations],
  };
}

/** Convenience for tests and server code: JSON with the contract's key order. */
export function serializeReport(report: DiagnosticReport): string {
  return JSON.stringify(normalizeReport(report), null, 2);
}
