import type { ModuleResult, Reading } from "@/lib/types";
import { makeResult, safe, unavailableReading } from "@/lib/collect/common";

interface UADataValues {
  platform?: string;
  platformVersion?: string;
  architecture?: string;
  bitness?: string;
  model?: string;
  mobile?: boolean;
  brands?: { brand: string; version: string }[];
  fullVersionList?: { brand: string; version: string }[];
}

interface NavigatorUAData {
  getHighEntropyValues?: (hints: string[]) => Promise<UADataValues>;
  platform?: string;
  mobile?: boolean;
  brands?: { brand: string; version: string }[];
}

export function detectBrowser(ua: string): string {
  if (/SamsungBrowser\/([\d.]+)/.test(ua))
    return `Samsung Internet ${ua.match(/SamsungBrowser\/([\d.]+)/)?.[1] ?? ""}`.trim();
  if (/EdgA?\/([\d.]+)/.test(ua)) return `Edge ${ua.match(/EdgA?\/([\d.]+)/)?.[1] ?? ""}`.trim();
  if (/OPR\/([\d.]+)/.test(ua)) return `Opera ${ua.match(/OPR\/([\d.]+)/)?.[1] ?? ""}`.trim();
  if (/Firefox\/([\d.]+)/.test(ua)) return `Firefox ${ua.match(/Firefox\/([\d.]+)/)?.[1] ?? ""}`.trim();
  if (/CriOS\/([\d.]+)/.test(ua)) return `Chrome iOS ${ua.match(/CriOS\/([\d.]+)/)?.[1] ?? ""}`.trim();
  if (/Chrome\/([\d.]+)/.test(ua)) return `Chrome ${ua.match(/Chrome\/([\d.]+)/)?.[1] ?? ""}`.trim();
  if (/Version\/([\d.]+).*Safari/.test(ua))
    return `Safari ${ua.match(/Version\/([\d.]+)/)?.[1] ?? ""}`.trim();
  return "Unknown browser";
}

export function detectOS(ua: string, platform = ""): string {
  if (/Windows NT 10/.test(ua)) return "Windows 10/11";
  if (/Windows NT/.test(ua)) return "Windows";
  if (/Android ([\d.]+)/.test(ua)) return `Android ${ua.match(/Android ([\d.]+)/)?.[1] ?? ""}`.trim();
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS / iPadOS";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Linux/.test(ua)) return "Linux";
  return platform || "Unknown platform";
}

export function inferAndroidModel(ua: string): string | null {
  const match = ua.match(/Android\s[\d.]+;\s*([^;)]+?)(?:\s+Build\/[^;)]+)?\)/);
  if (!match?.[1]) return null;
  const model = match[1].replace(/\s*Build\/.*$/, "").trim();
  if (!model || /^(wv|K|Mobile)$/i.test(model)) return null;
  return model;
}

function gpuInfo(): { vendor: string; renderer: string; webgl2: boolean; maxTexture: number | null } {
  const canvas = document.createElement("canvas");
  const gl2 = canvas.getContext("webgl2");
  const gl = gl2 ?? (canvas.getContext("webgl") as WebGLRenderingContext | null);
  if (!gl) return { vendor: "Unavailable", renderer: "Unavailable", webgl2: false, maxTexture: null };
  const debug = gl.getExtension("WEBGL_debug_renderer_info") as {
    UNMASKED_VENDOR_WEBGL: number;
    UNMASKED_RENDERER_WEBGL: number;
  } | null;
  const vendor = debug ? String(gl.getParameter(debug.UNMASKED_VENDOR_WEBGL)) : "Masked by browser";
  const renderer = debug
    ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
    : "Masked by browser";
  const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  // Free the context promptly; some mobile browsers cap concurrent WebGL contexts.
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return { vendor, renderer, webgl2: Boolean(gl2), maxTexture };
}

function formatRenderer(raw: string) {
  return raw
    .replace(/ANGLE \(([^)]*)\)/g, "$1")
    .replace(/\s*\([0-9A-F]{8,}\)/gi, "")
    .replace(/Direct3D11 vs_\d+_\d+ ps_\d+_\d+/, "Direct3D 11")
    .slice(0, 90);
}

export async function collectDevice(): Promise<ModuleResult> {
  const started = performance.now();
  const ua = navigator.userAgent;
  const nav = navigator as Navigator & { userAgentData?: NavigatorUAData; oscpu?: string };
  const readings: Reading[] = [];
  const notes: string[] = [];

  let highEntropy: UADataValues = {};
  if (nav.userAgentData?.getHighEntropyValues) {
    highEntropy = await safe(
      () =>
        nav.userAgentData!.getHighEntropyValues!([
          "platform",
          "platformVersion",
          "architecture",
          "bitness",
          "model",
          "fullVersionList",
        ]),
    ) ?? {};
  }

  const platform = highEntropy.platform ?? nav.userAgentData?.platform ?? navigator.platform;
  const os = detectOS(ua, platform);
  const browser = detectBrowser(ua);
  const androidModel = inferAndroidModel(ua);
  const model =
    (highEntropy.model && highEntropy.model.trim()) ||
    androidModel ||
    (/iPhone/.test(ua) ? "iPhone (model hidden by Safari)" : null) ||
    (/iPad/.test(ua) ? "iPad (model hidden by Safari)" : null);

  readings.push({
    key: "model",
    label: "Device model",
    value: model,
    evidence: model ? "measured" : "unavailable",
    source: model ? (highEntropy.model ? "User-Agent Client Hints" : "User-agent string") : "Browser",
    detail: model
      ? "Reported by the browser. Desktop browsers usually report no model at all."
      : "This browser does not disclose a hardware model. That is a privacy decision, not a fault.",
    status: "neutral",
  });

  readings.push({
    key: "os",
    label: "Operating system",
    value: os,
    evidence: "measured",
    source: "User-agent / Client Hints",
    status: "neutral",
  });

  readings.push({
    key: "browser",
    label: "Browser",
    value: browser,
    evidence: "measured",
    source: "User-agent string",
    status: "neutral",
  });

  const engine = /Firefox/.test(ua) ? "Gecko" : /Safari/.test(ua) && !/Chrome/.test(ua) ? "WebKit" : "Blink";
  const viewport = `${window.innerWidth} × ${window.innerHeight}`;
  const screenRes = `${screen.width} × ${screen.height}`;
  const dpr = window.devicePixelRatio || 1;
  const physical = `${Math.round(screen.width * dpr)} × ${Math.round(screen.height * dpr)}`;

  const gpu = safe(gpuInfo) ?? {
    vendor: "Unavailable",
    renderer: "Unavailable",
    webgl2: false,
    maxTexture: null,
  };

  readings.push(
    {
      key: "screen",
      label: "CSS screen size",
      value: screenRes,
      unit: "px",
      evidence: "measured",
      source: "screen.width / screen.height",
      detail: "Logical CSS pixels. All modern browsers report this reliably.",
      status: "neutral",
    },
    {
      key: "viewport",
      label: "Viewport",
      value: viewport,
      unit: "px",
      evidence: "measured",
      source: "window.innerWidth / innerHeight",
      status: "neutral",
    },
    {
      key: "dpr",
      label: "Device pixel ratio",
      value: `@${dpr.toFixed(2)}× (${physical} physical)`,
      evidence: "measured",
      source: "window.devicePixelRatio",
      status: dpr > 1 ? "good" : "neutral",
      detail:
        dpr > 1
          ? "High-density display: CSS pixels map to multiple physical pixels."
          : "Standard-density display reported by the browser.",
    },
    {
      key: "color-depth",
      label: "Colour depth",
      value: `${screen.colorDepth}-bit`,
      evidence: "measured",
      source: "screen.colorDepth",
      status: screen.colorDepth >= 24 ? "good" : "warn",
    },
    {
      key: "gpu",
      label: "GPU renderer",
      value: gpu.renderer === "Unavailable" ? null : formatRenderer(gpu.renderer),
      evidence: gpu.renderer === "Unavailable" ? "unavailable" : "measured",
      source: "WebGL UNMASKED_RENDERER",
      detail:
        gpu.renderer === "Masked by browser"
          ? "Safari and some privacy modes mask the GPU string as an anti-fingerprinting measure."
          : gpu.renderer === "Unavailable"
            ? "WebGL is disabled or blocked, so no GPU information is available."
            : "The driver-reported GPU name, which can differ from the marketing name.",
      status: gpu.webgl2 ? "good" : "warn",
    },
    {
      key: "webgl",
      label: "WebGL capability",
      value: gpu.webgl2 ? "WebGL 2" : gpu.renderer === "Unavailable" ? "Not available" : "WebGL 1",
      evidence: "measured",
      source: "Canvas.getContext",
      status: gpu.webgl2 ? "good" : "warn",
    },
    {
      key: "cores",
      label: "Logical CPU cores",
      value: navigator.hardwareConcurrency ? String(navigator.hardwareConcurrency) : null,
      evidence: navigator.hardwareConcurrency ? "measured" : "unavailable",
      source: "navigator.hardwareConcurrency",
      detail: "Logical threads exposed by the browser. Browsers may round or clamp this value.",
      status: "neutral",
    },
    {
      key: "memory",
      label: "Device memory class",
      value:
        typeof (navigator as Navigator & { deviceMemory?: number }).deviceMemory === "number"
          ? `${(navigator as Navigator & { deviceMemory?: number }).deviceMemory} GB`
          : null,
      evidence:
        typeof (navigator as Navigator & { deviceMemory?: number }).deviceMemory === "number"
          ? "measured"
          : "unavailable",
      source: "navigator.deviceMemory",
      detail:
        "Chromium rounds RAM to a coarse bucket (0.25–8 GB) and Safari/Firefox hide it, so this is a class, not an exact figure.",
      status: "neutral",
    },
    {
      key: "language",
      label: "Language",
      value: navigator.language || null,
      evidence: "measured",
      source: "navigator.language",
      status: "neutral",
    },
    {
      key: "timezone",
      label: "Time zone",
      value: safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone) ?? null,
      evidence: "measured",
      source: "Intl.DateTimeFormat",
      status: "neutral",
    },
    {
      key: "touch",
      label: "Touch points",
      value: navigator.maxTouchPoints > 0 ? `${navigator.maxTouchPoints} simultaneous` : "No touch input",
      evidence: "measured",
      source: "navigator.maxTouchPoints",
      detail:
        navigator.maxTouchPoints > 0
          ? "The browser reports a touch-capable digitiser."
          : "This browser reports no touch digitiser, which is expected on most desktops.",
      status: "neutral",
    },
    {
      key: "cookies",
      label: "Cookies",
      value: navigator.cookieEnabled ? "Enabled" : "Blocked",
      evidence: "measured",
      source: "navigator.cookieEnabled",
      status: navigator.cookieEnabled ? "neutral" : "warn",
    },
    {
      key: "engine",
      label: "Rendering engine",
      value: engine,
      evidence: "estimated",

      source: "Inferred from the user-agent string",
      detail: "Inferred; user-agent spoofing or in-app browsers can misreport this.",
      status: "neutral",
    },
  );

  if (/iPhone|iPad/.test(ua)) {
    notes.push(
      "iOS forces every browser onto WebKit, so Chrome and Firefox on iPhone report the same underlying capabilities as Safari.",
    );
  }
  if (gpu.renderer === "Masked by browser") {
    notes.push("GPU masking is expected on Safari 12+ and in several privacy modes; it is not a defect.");
  }
  if (!highEntropy.model && androidModel) {
    notes.push("The model name was parsed from the legacy user-agent string, which is being frozen by Chromium.");
  }

  const measuredCount = readings.filter((r) => r.evidence === "measured").length;
  const coverage = measuredCount / readings.length;

  const hasCore =
    readings.find((r) => r.key === "os")?.value &&
    readings.find((r) => r.key === "browser")?.value &&
    readings.find((r) => r.key === "screen")?.value;

  return makeResult("device", {
    status: hasCore ? "complete" : "partial",
    score: hasCore ? Math.round(72 + coverage * 24) : null,
    coverage,
    readings,
    summary: `${browser} on ${os}${model ? ` · ${model}` : ""}, ${viewport} CSS px at ${dpr.toFixed(2)}× density.`,
    notes,
    durationMs: Math.round(performance.now() - started),
  });
}

export function browserFamily(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/Firefox/.test(ua)) return "firefox";
  if (/Edg/.test(ua)) return "edge";
  if (/SamsungBrowser/.test(ua)) return "samsung";
  if (/Chrome|CriOS/.test(ua)) return "chromium";
  if (/Safari/.test(ua)) return "safari";
  return "other";
}

export const DEVICE_UNSUPPORTED_READING = (label: string) =>
  unavailableReading(label.toLowerCase(), label, "Web platform", "Not exposed to web pages.");
