import type { ModuleResult, Reading } from "@/lib/types";
import { makeResult, safe } from "@/lib/collect/common";
import { browserFamily } from "@/lib/collect/device";

interface Feature {
  key: string;
  label: string;
  category: "Sensors" | "Network" | "Media" | "Storage" | "Platform";
  core: boolean;
  supported: boolean;
  unlocks: string;
}

function hasSensor(name: string) {
  return typeof window !== "undefined" && name in window;
}

export function collectCompatibility(): ModuleResult {
  const nav = navigator as Navigator & {
    getBattery?: unknown;
    deviceMemory?: number;
    connection?: unknown;
    bluetooth?: unknown;
    usb?: unknown;
    nfc?: unknown;
    contacts?: unknown;
    share?: unknown;
    wakeLock?: unknown;
    getGamepads?: unknown;
  };

  const features: Feature[] = [
    {
      key: "battery",
      label: "Battery Status API",
      category: "Sensors",
      core: true,
      supported: typeof nav.getBattery === "function",
      unlocks: "Live charge level and charging state",
    },
    {
      key: "device-memory",
      label: "Device Memory API",
      category: "Sensors",
      core: true,
      supported: typeof nav.deviceMemory === "number",
      unlocks: "RAM class for performance context",
    },
    {
      key: "cores",
      label: "Hardware concurrency",
      category: "Sensors",
      core: true,
      supported: typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency > 0,
      unlocks: "Logical thread count",
    },
    {
      key: "device-orientation",
      label: "Device orientation",
      category: "Sensors",
      core: false,
      supported: "DeviceOrientationEvent" in window,
      unlocks: "Tilt and rotation tests (permission-gated on iOS)",
    },
    {
      key: "device-motion",
      label: "Device motion",
      category: "Sensors",
      core: false,
      supported: "DeviceMotionEvent" in window,
      unlocks: "Accelerometer-driven stability checks",
    },
    {
      key: "gyroscope",
      label: "Gyroscope sensor",
      category: "Sensors",
      core: false,
      supported: hasSensor("Gyroscope"),
      unlocks: "Raw angular-velocity sampling (Chromium only)",
    },
    {
      key: "accelerometer",
      label: "Accelerometer sensor",
      category: "Sensors",
      core: false,
      supported: hasSensor("Accelerometer"),
      unlocks: "Raw acceleration sampling (Chromium only)",
    },
    {
      key: "ambient-light",
      label: "Ambient light sensor",
      category: "Sensors",
      core: false,
      supported: hasSensor("AmbientLightSensor"),
      unlocks: "Screen brightness context (rarely exposed)",
    },
    {
      key: "vibration",
      label: "Vibration API",
      category: "Sensors",
      core: false,
      supported: typeof nav.vibrate === "function",
      unlocks: "Haptic motor test",
    },
    {
      key: "network-info",
      label: "Network Information API",
      category: "Network",
      core: true,
      supported: "connection" in nav,
      unlocks: "Connection class and downlink hints",
    },
    {
      key: "storage-estimate",
      label: "Storage estimate",
      category: "Storage",
      core: true,
      supported: typeof navigator.storage?.estimate === "function",
      unlocks: "Origin quota and usage",
    },
    {
      key: "indexeddb",
      label: "IndexedDB",
      category: "Storage",
      core: true,
      supported: typeof indexedDB !== "undefined",
      unlocks: "Local scan history and storage speed test",
    },
    {
      key: "cache-storage",
      label: "Cache Storage",
      category: "Storage",
      core: false,
      supported: typeof caches !== "undefined",
      unlocks: "Offline caching of the app shell",
    },
    {
      key: "opfs",
      label: "Origin Private File System",
      category: "Storage",
      core: false,
      supported: typeof navigator.storage?.getDirectory === "function",
      unlocks: "Fast local file-based test payloads",
    },
    {
      key: "persist",
      label: "Persistent storage",
      category: "Storage",
      core: false,
      supported: typeof navigator.storage?.persist === "function",
      unlocks: "Scan history survives storage pressure",
    },
    {
      key: "webgl2",
      label: "WebGL 2",
      category: "Media",
      core: true,
      supported: Boolean(safe(() => document.createElement("canvas").getContext("webgl2"))),
      unlocks: "GPU renderer info and display rendering",
    },
    {
      key: "webgpu",
      label: "WebGPU",
      category: "Media",
      core: false,
      supported: typeof (navigator as Navigator & { gpu?: unknown }).gpu !== "undefined",
      unlocks: "Modern GPU compute for future benchmarks",
    },
    {
      key: "canvas",
      label: "Canvas 2D",
      category: "Media",
      core: false,
      supported: Boolean(safe(() => document.createElement("canvas").getContext("2d"))),
      unlocks: "Screen and touch test surfaces",
    },
    {
      key: "audio",
      label: "Web Audio API",
      category: "Media",
      core: false,
      supported: typeof window.AudioContext !== "undefined",
      unlocks: "Speaker frequency and channel tests",
    },
    {
      key: "media-recorder",
      label: "MediaRecorder",
      category: "Media",
      core: false,
      supported: typeof window.MediaRecorder !== "undefined",
      unlocks: "Camera and microphone recording tests",
    },
    {
      key: "media-devices",
      label: "Media devices",
      category: "Media",
      core: false,
      supported: Boolean(navigator.mediaDevices?.getUserMedia),
      unlocks: "Camera and microphone diagnostics (with consent)",
    },
    {
      key: "picture-in-picture",
      label: "Picture-in-Picture",
      category: "Media",
      core: false,
      supported: "pictureInPictureEnabled" in document,
      unlocks: "Floating video playback",
    },
    {
      key: "av1",
      label: "AV1 video decode",
      category: "Media",
      core: false,
      supported: safe(() => MediaSource.isTypeSupported('video/mp4; codecs="av01.0.05M.08"')) ?? false,
      unlocks: "Efficient modern video playback",
    },
    {
      key: "h264",
      label: "H.264 video decode",
      category: "Media",
      core: false,
      supported:
        safe(
          () =>
            document.createElement("video").canPlayType('video/mp4; codecs="avc1.42E01E"') !== "",
        ) ?? false,
      unlocks: "Baseline video playback",
    },
    {
      key: "service-worker",
      label: "Service workers",
      category: "Platform",
      core: false,
      supported: "serviceWorker" in navigator,
      unlocks: "Offline-first behaviour and installability",
    },
    {
      key: "notifications",
      label: "Notifications",
      category: "Platform",
      core: false,
      supported: "Notification" in window,
      unlocks: "Scheduled maintenance reminders (with consent)",
    },
    {
      key: "share",
      label: "Web Share",
      category: "Platform",
      core: false,
      supported: typeof nav.share === "function",
      unlocks: "Share diagnostic reports natively",
    },
    {
      key: "clipboard",
      label: "Async clipboard",
      category: "Platform",
      core: false,
      supported: Boolean(navigator.clipboard?.writeText),
      unlocks: "Copy report summaries",
    },
    {
      key: "permissions",
      label: "Permissions API",
      category: "Platform",
      core: false,
      supported: typeof navigator.permissions?.query === "function",
      unlocks: "Read permission state without prompting",
    },
    {
      key: "wake-lock",
      label: "Screen Wake Lock",
      category: "Platform",
      core: false,
      supported: "wakeLock" in nav,
      unlocks: "Keep the screen on during long tests",
    },
    {
      key: "fullscreen",
      label: "Fullscreen API",
      category: "Platform",
      core: false,
      supported: Boolean(document.documentElement.requestFullscreen),
      unlocks: "Immersive screen tests",
    },
    {
      key: "bluetooth",
      label: "Web Bluetooth",
      category: "Network",
      core: false,
      supported: "bluetooth" in nav,
      unlocks: "Read accessory telemetry (not phone internals)",
    },
    {
      key: "usb",
      label: "WebUSB",
      category: "Network",
      core: false,
      supported: "usb" in nav,
      unlocks: "Wired accessory diagnostics",
    },
    {
      key: "rtc",
      label: "WebRTC data channel",
      category: "Network",
      core: false,
      supported: typeof window.RTCPeerConnection !== "undefined",
      unlocks: "Future peer-to-peer throughput tests",
    },
    {
      key: "css-backdrop",
      label: "CSS backdrop-filter",
      category: "Platform",
      core: false,
      supported: safe(() => CSS.supports("backdrop-filter", "blur(4px)")) ?? false,
      unlocks: "The frosted-glass panels in this interface",
    },
    {
      key: "css-container",
      label: "CSS container queries",
      category: "Platform",
      core: false,
      supported: safe(() => CSS.supports("container-type", "inline-size")) ?? false,
      unlocks: "Component-level responsive layout",
    },
    {
      key: "css-dvh",
      label: "Dynamic viewport units",
      category: "Platform",
      core: false,
      supported: safe(() => CSS.supports("height", "100dvh")) ?? false,
      unlocks: "Correct full-height layout on mobile browser chrome",
    },
  ];

  const supportedCount = features.filter((f) => f.supported).length;
  const readability = Math.round((supportedCount / features.length) * 100);
  const coreFeatures = features.filter((f) => f.core);
  const coreSupported = coreFeatures.filter((f) => f.supported).length;
  const corePct = (coreSupported / coreFeatures.length) * 100;

  const readings: Reading[] = [
    {
      key: "tier",
      label: "Diagnostic capability",
      value:
        corePct >= 85 ? "Full" : corePct >= 60 ? "Mostly capable" : corePct >= 40 ? "Limited" : "Minimal",
      evidence: "measured",
      source: "Feature detection of core diagnostic APIs",
      detail: `${coreSupported} of ${coreFeatures.length} core APIs used by PhoneCare are available.`,
      status: corePct >= 85 ? "good" : corePct >= 60 ? "warn" : "bad",
      numeric: Math.round(corePct),
    },
    {
      key: "coverage",
      label: "Overall API coverage",
      value: `${supportedCount} / ${features.length}`,
      evidence: "measured",
      source: "Feature detection",
      detail: `${readability}% of the tracked web platform features are present in this browser.`,
      status: readability >= 80 ? "good" : readability >= 60 ? "warn" : "bad",
      numeric: readability,
    },
    {
      key: "browser-family",
      label: "Browser family",
      value: browserFamily(),
      evidence: "measured",
      source: "User-agent string",
      status: "neutral",
    },
    ...features.map<Reading>((f) => ({
      key: `f-${f.key}`,
      label: f.label,
      value: f.supported ? "Supported" : "Not available",
      evidence: f.supported ? "measured" : "unavailable",
      source: `Feature detection · ${f.category}`,
      detail: f.unlocks,
      status: f.core ? (f.supported ? "good" : "warn") : "neutral",
    })),
  ];

  const notes: string[] = [];
  const family = browserFamily();
  if (family === "safari") {
    notes.push(
      "Safari intentionally withholds battery, memory and network-hint APIs. On iPhone every browser uses WebKit, so switching browsers will not add these readings.",
    );
  }
  if (family === "firefox") {
    notes.push("Firefox removed the Battery Status API in version 52 to prevent device fingerprinting.");
  }
  if (family === "chromium") {
    notes.push("Chromium exposes the widest set of diagnostic APIs, though several values are deliberately coarsened.");
  }
  if (!("serviceWorker" in navigator)) {
    notes.push("Service workers are unavailable; the app will not cache offline in this context.");
  }

  return makeResult("compatibility", {
    status: "complete",
    score: Math.round(corePct * 0.7 + readability * 0.3),
    coverage: 1,
    readings,
    summary: `${supportedCount}/${features.length} tracked APIs available · ${coreSupported}/${coreFeatures.length} core diagnostic APIs · ${Math.round(readability)}% coverage.`,
    notes,
    durationMs: 0,
  });
}
