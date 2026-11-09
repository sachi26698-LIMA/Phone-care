import type { ModuleId, ModuleMeta } from "@/lib/types";

export const MODULES: ModuleMeta[] = [
  {
    id: "device",
    title: "Device identity",
    short: "Device",
    description:
      "Browser-reported model, platform, screen geometry, GPU and language signals.",
    icon: "smartphone",
    href: "/diagnostics/device",
    mode: "auto",
    weight: 0.1,
    evidenceNote:
      "Read directly from the user-agent, Client Hints and WebGL. Model names are inferred and can be hidden by privacy-focused browsers.",
  },
  {
    id: "battery",
    title: "Battery & health",
    short: "Battery",
    description:
      "Live charge level and charging state, plus a transparent health estimate you calibrate yourself.",
    icon: "battery",
    href: "/diagnostics/battery",
    mode: "hybrid",
    weight: 0.2,
    evidenceNote:
      "Level and charging state are measured where the Battery Status API exists. Design-capacity health is an estimate computed only from numbers you enter.",
  },
  {
    id: "storage",
    title: "Storage analyser",
    short: "Storage",
    description:
      "Browser storage quota and device free-space modelling with pressure thresholds.",
    icon: "database",
    href: "/diagnostics/storage",
    mode: "hybrid",
    weight: 0.14,
    evidenceNote:
      "The Storage API reports this site's quota, not your phone's disk. Device totals are shown only when you enter them.",
  },
  {
    id: "network",
    title: "Network diagnostics",
    short: "Network",
    description:
      "Real latency, download and upload measurements plus connection-class reporting.",
    icon: "wifi",
    href: "/diagnostics/network",
    mode: "auto",
    weight: 0.18,
    evidenceNote:
      "Throughput is measured against this site's own endpoints. Connection class and downlink hints are Chromium-only.",
  },
  {
    id: "temperature",
    title: "Thermal state",
    short: "Thermal",
    description:
      "No browser can read a phone thermometer. We infer throttling from sustained-load benchmarks instead.",
    icon: "thermometer",
    href: "/diagnostics/temperature",
    mode: "auto",
    weight: 0.08,
    evidenceNote:
      "Temperature itself is unavailable to all web pages. Thermal pressure here is an inference from performance throttling under load.",
  },
  {
    id: "screen",
    title: "Screen & display",
    short: "Screen",
    description:
      "Guided full-screen colour, uniformity, greyscale and pixel-density checks with your confirmations.",
    icon: "monitor",
    href: "/diagnostics/screen",
    mode: "manual",
    weight: 0.12,
    evidenceNote:
      "Defects are confirmed by you. Resolution, density, colour depth and gamut come from browser queries; refresh rate is inferred from frame cadence and reported unavailable when the sample is implausible.",
  },
  {
    id: "touch",
    title: "Touch interaction",
    short: "Touch",
    description:
      "Multi-touch capability, grid coverage and missed-region mapping on a live canvas.",
    icon: "fingerprint",
    href: "/diagnostics/touch",
    mode: "manual",
    weight: 0.1,
    evidenceNote:
      "Coverage and contact counts are measured from pointer events. Judgements about accuracy rely on your trace.",
  },
  {
    id: "compatibility",
    title: "Browser compatibility",
    short: "Compatibility",
    description:
      "A 37-point feature matrix across sensors, media, storage and rendering APIs.",
    icon: "shapes",
    href: "/diagnostics/compatibility",
    mode: "auto",
    weight: 0.08,
    evidenceNote:
      "Feature detection is measured; it describes this browser, not the physical hardware behind it.",
  },
  {
    id: "performance",
    title: "Performance profile",
    short: "Performance",
    description:
      "Core count, frame cadence, JS compute throughput and storage write speed.",
    icon: "gauge",
    href: "/diagnostics/performance",
    mode: "auto",
    weight: 0.14,
    evidenceNote:
      "Benchmarks measure this browser session. Results vary with background load and thermal state.",
  },
];

export const MODULE_MAP: Record<ModuleId, ModuleMeta> = Object.fromEntries(
  MODULES.map((m) => [m.id, m]),
) as Record<ModuleId, ModuleMeta>;

export const MANUAL_MODULES: ModuleId[] = ["screen", "touch"];

export const AUTOMATED_MODULES: ModuleId[] = MODULES.filter(
  (m) => m.mode !== "manual",
).map((m) => m.id);
