#!/usr/bin/env node
/**
 * Contract and engine tests for the network diagnostic layer.
 *
 * Run with: npm run test:contract
 * It compiles the pure modules with tsc into .contract-build/ and then exercises
 * the schema validator, the comparison engine, the triage rules and the survey
 * aggregation. No browser and no Android device are needed for these checks.
 */

const path = require("node:path");
const { validateReport, normalizeReport } = require(path.join(__dirname, "..", ".contract-build", "diagnostic", "schema.js"));
const { summariseProbes } = require(path.join(__dirname, "..", ".contract-build", "diagnostic", "quality.js"));
const { compareSnapshots } = require(path.join(__dirname, "..", ".contract-build", "diagnostic", "compare.js"));
const { triage } = require(path.join(__dirname, "..", ".contract-build", "diagnostic", "triage.js"));
const {
  sampleFromProbes,
  summarizeRoom,
  classifyRsrp,
  classifyRssi,
  makeRoom,
} = require(path.join(__dirname, "..", ".contract-build", "diagnostic", "survey.js"));
const { buildWebReport } = require(path.join(__dirname, "..", ".contract-build", "diagnostic", "report.js"));

let passed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    return;
  }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const T = "2026-11-09T10:00:00.000Z";
const report = (overrides = {}) => ({
  schemaVersion: "phonecare.report/1",
  id: "native-test-1",
  generatedAt: T,
  platform: "android",
  app: { name: "PhoneCare Android", version: "0.1.0" },
  device: { manufacturer: "Google", model: "Pixel 7", osVersion: "14", sdkInt: 34 },
  session: { startedAt: T, durationMs: 42000, trigger: "manual" },
  network: { transport: "cellular", carrier: "Test Carrier", server: "https://phonecare.app" },
  measurements: [],
  limitations: ["RSRP is reported by the modem and reflects the serving cell, not the true antenna state."],
  ...overrides,
});

const measured = (overrides = {}) => ({
  id: "lte.rsrp",
  label: "LTE RSRP",
  value: -97,
  unit: "dBm",
  evidence: "measured",
  source: "CellSignalStrengthLte.getRsrp()",
  availability: "available",
  timestamp: T,
  ...overrides,
});

// ---- schema -------------------------------------------------------------
{
  const valid = report({ measurements: [measured()] });
  const result = validateReport(valid);
  check("valid android report accepted", result.ok === true, JSON.stringify(result.errors));
  check("valid report has no warnings", result.warnings.length === 0, JSON.stringify(result.warnings));
  check("normalizeReport keeps version", normalizeReport(result.report).schemaVersion === "phonecare.report/1");
}
{
  const result = validateReport(report({ measurements: [measured({ value: null })] }));
  check("null value with measured evidence rejected", !result.ok);
  check(
    "null/measured error points at evidence",
    result.errors.some((e) => e.path.endsWith(".evidence")),
    JSON.stringify(result.errors),
  );
}
{
  const result = validateReport(report({ measurements: [measured({ availability: "unsupported" })] }));
  check("numeric value with unavailable availability rejected", !result.ok);
}
{
  const result = validateReport(
    report({
      measurements: [
        measured({ value: null, evidence: "unavailable", availability: "available", unit: "dBm" }),
      ],
    }),
  );
  check("null value marked available rejected", !result.ok);
}
{
  const result = validateReport(report({ measurements: [measured({ unit: "dBmW" })] }));
  check("unknown unit rejected", !result.ok);
}
{
  const result = validateReport(report({ measurements: [measured({ value: null, evidence: "unavailable", availability: "permission_denied" })] }));
  check("permission_denied null value accepted", result.ok === true, JSON.stringify(result.errors));
}
{
  const result = validateReport(report({ measurements: [measured({ id: "lte.rsrp", surprise: 1 })] }));
  check("unexpected property rejected", !result.ok);
}
{
  const result = validateReport(report({ limitations: [] }));
  check("empty limitations rejected", !result.ok);
}
{
  const result = validateReport({ ...report({ measurements: [] }), schemaVersion: "phonecare.report/2" });
  check("wrong schema version rejected", !result.ok);
}
{
  const result = validateReport(
    report({ platform: "web", measurements: [measured()] }),
  );
  check("web report claiming RSRP accepted but warned", result.ok === true && result.warnings.length === 1);
}
{
  // A web report may carry radio rows as long as they are null.
  const result = validateReport(
    report({
      platform: "web",
      measurements: [
        measured({ value: null, evidence: "unavailable", availability: "unsupported", source: "Browser platform" }),
      ],
    }),
  );
  check("web report with null radio row has no radio warning", result.ok === true && result.warnings.length === 0);
}

// ---- probe summary ------------------------------------------------------
{
  const samples = [90, 50, 40, 60, 50].map((rtt, index) => ({
    index,
    rttMs: rtt,
    failure: "none",
    dnsMs: null,
    ttfbMs: null,
    at: T,
  }));
  const summary = summariseProbes(samples);
  check("first probe excluded from median", summary.medianMs === 50, String(summary.medianMs));
  check("min excludes cold probe", summary.minMs === 40, String(summary.minMs));
  check("jitter is mean absolute difference", Math.abs(summary.jitterMs - 13.333) < 0.01, String(summary.jitterMs));
  check("failure rate computed", summary.failureRatePct === 0);
}
{
  const samples = [
    { index: 0, rttMs: 50, failure: "none", dnsMs: null, ttfbMs: null, at: T },
    { index: 1, rttMs: null, failure: "timeout", dnsMs: null, ttfbMs: null, at: T },
    { index: 2, rttMs: null, failure: "network", dnsMs: null, ttfbMs: null, at: T },
  ];
  const summary = summariseProbes(samples);
  check("failures counted", summary.failures === 2 && summary.succeeded === 1);
  check("failure rate is percentage", Math.round(summary.failureRatePct) === 67, String(summary.failureRatePct));
}

// ---- comparison ---------------------------------------------------------
{
  const before = { at: T, server: "https://a", latencyMedianMs: 50, latencySpreadMs: 2, jitterMs: 5, downloadMbps: 20, uploadMbps: 5, sampleCount: 10 };
  const after = { at: T, server: "https://a", latencyMedianMs: 48, latencySpreadMs: 2, jitterMs: 5, downloadMbps: 19, uploadMbps: 5, sampleCount: 10 };
  const result = compareSnapshots(before, after);
  check("small change is not an improvement", result.changes.every((c) => c.direction !== "improved"), JSON.stringify(result.changes));
  check("verdict is no measurable change", result.verdict === "no measurable change", result.verdict);
}
{
  const before = { at: T, server: "https://a", latencyMedianMs: 100, latencySpreadMs: 2, jitterMs: 40, downloadMbps: 10, uploadMbps: 3, sampleCount: 10 };
  const after = { at: T, server: "https://a", latencyMedianMs: 50, latencySpreadMs: 2, jitterMs: 20, downloadMbps: 25, uploadMbps: 8, sampleCount: 10 };
  const result = compareSnapshots(before, after);
  check("large latency drop is an improvement", result.changes.find((c) => c.id === "latency").direction === "improved");
  check("verdict improved", result.verdict === "improved", result.verdict);
}
{
  const before = { at: T, server: "https://a", latencyMedianMs: 50, latencySpreadMs: null, jitterMs: 5, downloadMbps: 20, uploadMbps: 5, sampleCount: 10 };
  const after = { at: T, server: "https://b", latencyMedianMs: 50, latencySpreadMs: null, jitterMs: 5, downloadMbps: 5, uploadMbps: 2, sampleCount: 10 };
  const result = compareSnapshots(before, after);
  check("download drop is worse", result.changes.find((c) => c.id === "download").direction === "worse");
  check("server mismatch is a caveat", result.caveats.some((c) => /different servers/i.test(c)));
}

// ---- triage -------------------------------------------------------------
const baseInput = {
  transport: "wifi",
  wifiRssiDbm: -80,
  cellularRsrpDbm: -90,
  latencyMedianMs: 45,
  jitterMs: 8,
  failureRatePct: 0,
  dnsMs: 20,
  ttfbMs: 30,
  downloadMbps: 30,
  uploadMbps: 8,
  survey: null,
  reportedProblem: true,
};
{
  const result = triage(baseInput);
  check("weak wifi with usable cellular → wifi_coverage", result.primary && result.primary.cause === "wifi_coverage", JSON.stringify(result.primary));
}
{
  const result = triage({ ...baseInput, transport: "cellular", cellularRsrpDbm: -112, wifiRssiDbm: null });
  check("weak cellular → cellular_coverage", result.primary && result.primary.cause === "cellular_coverage");
}
{
  const result = triage({ ...baseInput, wifiRssiDbm: -52, latencyMedianMs: 220 });
  check("strong wifi but slow → upstream", result.primary && result.primary.cause === "upstream", JSON.stringify(result.primary));
}
{
  const result = triage({ ...baseInput, latencyMedianMs: null, transport: "wifi", wifiRssiDbm: null });
  check("missing latency → insufficient data", result.primary && result.primary.cause === "insufficient_data");
  check("missing inputs listed", result.missing.length >= 2, JSON.stringify(result.missing));
}
{
  const result = triage({ ...baseInput, wifiRssiDbm: -55, latencyMedianMs: 60, jitterMs: 90, failureRatePct: 8 });
  check("jitter/failures → instability present", result.findings.some((f) => f.cause === "instability"));
}
{
  const result = triage({
    ...baseInput,
    wifiRssiDbm: null,
    transport: "wifi",
    survey: [
      { room: "Living room", score: 92, dbm: -55 },
      { room: "Balcony", score: 48, dbm: -105 },
    ],
  });
  check("room gap → room_specific", result.findings.some((f) => f.cause === "room_specific"));
}
{
  const result = triage(baseInput);
  check("engine never claims a verified fix", result.verifiedFix === false);
}

// ---- survey -------------------------------------------------------------
{
  const probes = [40, 44, 42, 46, 41].map((rtt, index) => ({
    index,
    rttMs: rtt,
    failure: "none",
    dnsMs: null,
    ttfbMs: null,
    at: T,
  }));
  const sample = sampleFromProbes(probes, -98);
  const room = { id: "r1", name: "Study", samples: [sample] };
  check("sample carries median latency", Math.round(sample.latencyMs) === 43, String(sample.latencyMs));
  check("single sample yields no room score", summarizeRoom(room).score === null);
  const room3 = { ...room, samples: [sample, sample, sample].map((s, i) => ({ ...s, at: `${T}-${i}` })) };
  const summary3 = summarizeRoom(room3);
  check("three samples produce a score", typeof summary3.score === "number", JSON.stringify(summary3));
  check("confidence rises with samples", summary3.confidence === "medium", summary3.confidence);
  check("user dBm kept separate", summary3.userDbmMedian === -98);
}
{
  check("RSRP bands", classifyRsrp(-75).label === "Excellent" && classifyRsrp(-95).label === "Fair" && classifyRsrp(-115).label === "Very weak");
  check("RSSI bands", classifyRssi(-52).label === "Good" && classifyRssi(-78).label === "Weak" && classifyRssi(-20).label === "Excellent");
  check("makeRoom produces unique ids", makeRoom("A").id !== makeRoom("A").id);
}

// ---- web report builder -------------------------------------------------
{
  const run = {
    startedAt: T,
    finishedAt: T,
    durationMs: 30000,
    server: { origin: "http://localhost:3100", endpoint: "/api/network/ping", label: "test server" },
    transport: "wifi",
    samples: [
      { index: 0, rttMs: 60, failure: "none", dnsMs: 4, ttfbMs: 30, at: T },
      { index: 1, rttMs: 50, failure: "none", dnsMs: 2, ttfbMs: 25, at: T },
      { index: 2, rttMs: 55, failure: "none", dnsMs: null, ttfbMs: 22, at: T },
    ],
    latency: { attempted: 3, succeeded: 3, failures: 0, failureRatePct: 0, medianMs: 52.5, minMs: 50, maxMs: 55, jitterMs: 5, cvPct: 4, spreadMs: 2.5 },
    stability: { roundMedians: [52, 55, 51], cvPct: 3.8, label: "stable" },
    download: { direction: "download", bytes: 3_000_000, ms: 4000, mbps: 6, endpoint: "/api/network/download", startedAt: T },
    upload: { direction: "upload", bytes: 2_000_000, ms: 3000, mbps: 5.3, endpoint: "/api/network/upload", startedAt: T },
    dnsMs: 4,
    ttfbMs: 30,
    validity: { scored: true, reasons: [] },
    scores: { download: 55, upload: 66, latency: 84, stability: 92, total: 66 },
    limitations: ["Test limitation."],
  };
  const webReport = buildWebReport(run, { id: "web-test-1" });
  const result = validateReport(webReport);
  check("generated web report is schema-valid", result.ok === true, JSON.stringify(result.errors));
  check("web report declares radio rows unavailable", webReport.measurements.filter((m) => m.value === null && m.availability === "unsupported").length >= 4);
  check("web report has limitations", webReport.limitations.length >= 3);
  const serialized = JSON.parse(JSON.stringify(webReport));
  check("web report survives serialization validation", validateReport(serialized).ok === true);
}


// ---- cross-platform parity ----------------------------------------------
// The Android app is a second implementation of the same product, so the shared
// definitions must match the generated Kotlin, not merely look similar.
{
  const fsSync = require("node:fs");
  const tokensPath = path.join(__dirname, "..", "shared", "design-tokens.json");
  const tokens = JSON.parse(fsSync.readFileSync(tokensPath, "utf8"));
  const androidRoot = path.join(__dirname, "..", "native", "android", "app", "src", "main", "java", "app", "phonecare", "diagnostics");
  const themeKt = fsSync.readFileSync(path.join(androidRoot, "ui", "Theme.kt"), "utf8");

  for (const [name, hex] of Object.entries(tokens.palette)) {
    const literal = hex.replace("#", "").toUpperCase();
    check(`Android token ${name} matches palette ${hex}`, themeKt.includes(`0xFF${literal}`));
  }
  check("Android type scale matches shared tokens", themeKt.includes("const val DISPLAY = 28f") && themeKt.includes("const val BODY = 14f"));
  check("Android radius matches shared tokens", themeKt.includes("const val RADIUS_CARD = 16f"));

  const { GUIDES } = require(path.join(__dirname, "..", ".contract-build", "guides", "index.js"));
  const guidesKt = fsSync.readFileSync(path.join(androidRoot, "content", "Guides.kt"), "utf8");
  check("guide count matches on both platforms", (guidesKt.match(/^    Guide\($/gm) || []).length === GUIDES.length);
  for (const guide of GUIDES) {
    check(
      `Android guide slug+title matches website: ${guide.slug}`,
      guidesKt.includes(`slug = "${guide.slug}"`) && guidesKt.includes(`title = "${guide.title.replace(/"/g, '\\"')}"`),
    );
  }
  check("Android guide search matches title and summary", guidesKt.includes("fun search(query: String)"));

  const schema = JSON.parse(fsSync.readFileSync(path.join(__dirname, "..", "shared", "diagnostics.schema.json"), "utf8"));
  const measurementProps = schema.properties?.measurements?.items?.properties ?? {};
  const evidenceEnum =
    schema.$defs?.evidence?.enum ?? schema.definitions?.evidence?.enum ?? measurementProps.evidence?.enum;
  const availabilityEnum =
    schema.$defs?.availability?.enum ?? schema.definitions?.availability?.enum ?? measurementProps.availability?.enum;
  if (Array.isArray(evidenceEnum)) {
    check("token evidence list equals schema enum", JSON.stringify(tokens.evidence) === JSON.stringify(evidenceEnum));
  }
  if (Array.isArray(availabilityEnum)) {
    check("token availability list equals schema enum", JSON.stringify(tokens.availability) === JSON.stringify(availabilityEnum));
  }

  const qualityKt = fsSync.readFileSync(path.join(androidRoot, "quality", "InternetQualityEngine.kt"), "utf8");
  check(
    "Android quality weights match shared tokens",
    qualityKt.includes("download to 0.45") &&
      qualityKt.includes("upload to 0.25") &&
      qualityKt.includes("latencyScore to 0.2") &&
      qualityKt.includes("stabilityScore to 0.1"),
  );
}

// ---- summary ------------------------------------------------------------
console.log(`contract tests: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
