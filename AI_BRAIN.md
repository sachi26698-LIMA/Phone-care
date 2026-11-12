# AI_BRAIN.md — PhoneCare

> Permanent engineering brain for the PhoneCare project. Read this before any major
> development task. Last updated: 2026-11-09.

---

## 1. Operating rules (permanent)

These rules are binding for every future task on this repository.

1. **Research first.** Before a major feature, review current platform documentation and at least
   three comparable products. Record sources and findings here. No decisions by assumption.
2. **Truthfulness is a hard requirement.** Never present an inference, a user entry, or a
   plausible-looking placeholder as a hardware measurement. Every reading must carry one of four
   evidence levels: `measured`, `estimated`, `user`, `unavailable`.
3. **No fake functionality.** No dead buttons, no "coming soon" cards that imply a working feature,
   no fabricated metrics. If a web API does not exist, the UI says so and explains why.
4. **Privacy by architecture.** Diagnostics run client-side. No reading is uploaded. No analytics,
   advertising, or third-party measurement services are contacted. Optional AI integration is
   server-proxied with server-only credentials.
5. **Server-first, client only where needed.** Static content renders on the server. Browser APIs
   live inside explicit client islands.
6. **Quality gates before shipping.** `tsc --noEmit`, production build, navigation checks, mobile /
   tablet / desktop layouts, keyboard and contrast checks, error/loading/empty states, and a review
   of the complete diff.
7. **Light theme only.** PhoneCare is a premium warm-light product: off-white canvas, white cards,
   purple primary actions, lavender secondary highlights, amber for important actions and
   indicators, charcoal typography. No dark dashboard, no black canvas, no neon treatment. The
   only intentionally dark surface is the full-screen display-test pattern viewer, because a
   panel test must be able to show true black.
8. **Permission discipline.** Request nothing by default. Every optional permission must be
   explained in plain language *before* the request, must be triggered by a user gesture, must
   handle granted / denied / unsupported states, and must never be implied to unlock hardware
   data the platform does not expose.
9. **Design is evidence-based.** Component decisions follow the brand tokens and the documented
   contrast budget, not taste. Every redesign closes with a measured contrast and overflow pass.
10. **Update this file** whenever a new permanent rule, platform constraint, or architecture
    decision is established.

---

## 2. Research log

### 2.1 Market research (2026-11-09)

Reviewed the smartphone diagnostics market through current app listings and comparison articles.

| Source | What it told us |
| --- | --- |
| Play Store listing — Phone Doctor Pro / Phone Doctor | Markets 40+ hardware tests, screen/touch tests, battery health, CPU monitor, speed test, AI chat, and a colour-coded test report summary. |
| Phone Clinix — "Top 10 Phone Diagnostic Software Tools in 2025" | Confirms feature expectations: one-tap scanning, battery health, storage analysis, network checks, report sharing. |
| Phone Clinix — "Android Diagnostic Tools: Run a Full Health Check" | Identifies the canonical module list: battery, CPU, RAM, sensors, camera, mic, screen, touch, Wi-Fi/Bluetooth/cellular. |
| AccuBattery documentation and listings | Battery health is the highest-demand metric; it needs charge/discharge observation over time, not a single snapshot. |
| TestM (used-phone inspection tool) | The "condition report for buying/selling" use case: readable summary, shareable, multi-language. |
| Samsung Members diagnostics | OEM-native tests (screen, sensors, battery) set the expectation of guided, interactive checks. |

**Market gap identified:** every credible native app can read hardware sensors that the web cannot.
Web-based "phone check" pages, by contrast, frequently claim battery temperature, CPU usage or
"battery health" without saying how (or whether) it was obtained. That is the trust gap PhoneCare
targets: **be the most honest browser-based diagnostic suite, with a premium interface.**

### 2.2 Platform capability research (2026-11-09)

| API / capability | Reality | Decision |
| --- | --- | --- |
| Battery Status API (`navigator.getBattery`) | Chrome 38+, Edge 79+, Opera, Samsung Internet, Chrome Android. **Firefox removed it in v52** (fingerprinting); **Safari never shipped it**. Requires HTTPS. Precision is deliberately reduced. | Use with feature detection; render an explicit unavailable state with the reason and a browser suggestion. |
| `navigator.deviceMemory` | Chromium only; rounded buckets (0.25–8 GB, capped). Hidden in Firefox/Safari. | Display as a **memory class**, never exact RAM. |
| `navigator.hardwareConcurrency` | Widely available; may be clamped. | Use for context and benchmark normalisation, not as a performance verdict. |
| `navigator.connection` (Network Information API) | Chromium-only hints; `effectiveType` is a coarse, browser-computed bucket; `downlink` capped at 10 Mbps. | Treat as **estimated**, and always pair with a real throughput measurement. |
| `navigator.storage.estimate()` | Available across modern browsers on secure origins; reports **this origin's** quota/usage, padded to resist fingerprinting. `.persisted()`/`.persist()` vary. | Present as browser quota, explicitly not device disk. |
| Disk space, battery health/capacity, battery temperature, voltage, cycle count, CPU temperature, signal dBm | **Not exposed to any web page.** | Mark unavailable; accept user input only where it adds real value, and label it. |
| `PointerEvent`, `navigator.maxTouchPoints` | Reliable for coverage and contact-count mapping. Raw pressure/accuracy not exposed on most phones. | Build the grid-coverage test; state the pressure limitation. |
| Fullscreen API in embedded contexts | Can be blocked inside iframes. | Guided test works as a fixed overlay; fullscreen is an optional enhancement. |
| Screen geometry / `devicePixelRatio` / `matchMedia(color-gamut, dynamic-range)` | Reliable, exact for CSS pixels. | Measured display facts. |
| `requestAnimationFrame` cadence | Reliable for a cadence floor; the compositor may cap it. | Report as **inferred** refresh rate. |

Sources for this section are listed in §9.

### 2.3 Technical research (2026-11-09)

- **Next.js App Router (16.x)**: server components by default, `params`/`searchParams` are Promises,
  route handlers for dynamic endpoints, metadata API for SEO, typed route config.
- **Tailwind CSS v4**: CSS-first configuration via `@theme`, no JS config, `@utility` for custom
  utilities, native OKLCH colour support.
- **WCAG 2.2 / accessibility**: 4.5:1 text contrast, visible focus, semantic landmarks, reduced-motion
  support, never colour-only signalling, 320 px reflow.
- **Font strategy**: self-hosted variable fonts (`@fontsource-variable/*`) to avoid third-party font
  requests, layout shift, and GDPR exposure.

---

## 3. Competitor analysis

| Product | Strengths | Weaknesses | UI/UX read | What we adopt / avoid |
| --- | --- | --- | --- | --- |
| **Phone Doctor (Plus)** | Very broad test set (40+), hardware button/vibration/sensor tests, report graph, speed test, AI chat. | Cluttered home; ads/IPA upsells; "AI chat" is generic; health claims often unexplained; permissions friction. | Dense grid of coloured tiles, mascot-driven, playful rather than premium. | Adopt the completeness and report summary. Avoid ad-driven density and unexplained metrics. |
| **TestM** | Excellent for used-phone inspection; clean condition report; shareable; multilingual; states no user data collected. | Tests are pass/fail booleans; limited depth on battery and storage; little explanation of what a result means. | Calm, checklist-driven, utilitarian. | Adopt the report/share mindset; go deeper with evidence labels and explanations. |
| **AccuBattery** | Best-in-class battery insight; charge/discharge observation; wear modelling; clear charging advice. | Requires days of background data; no broad diagnostics; native only; dense charts. | Data-dense, chart-led, utilitarian. | Adopt session drain sampling and capacity-retention maths; avoid pretending a snapshot equals health. |
| **Phone Check and Test / Phone Clinix suites** | 20+ component tests, deep/quick modes, Wi-Fi/GPS/cellular checks, technician-friendly reports. | Desktop-style UI ported to mobile; unclear data provenance; heavy permission requests. | Form/table heavy. | Adopt the module taxonomy; do not copy the layout. |
| **Samsung Members (OEM)** | Trusted, native sensor access, excellent guided screen/sensor tests, real battery diagnostics. | Samsung-only; limited cross-brand use; no export-friendly report. | Friendly, brand-native, step-by-step. | Adopt the guided interactive test pattern; cannot match native sensor access — and we say so. |
| **CPU-Z** | Precise-looking hardware data, real-time monitoring, tiny binary. | Read-only info dump; no guidance; no scoring; confusing for non-technical users. | Spreadsheet-like. | Adopt the depth of device identity; add interpretation and guidance. |

### Feature comparison

| Capability | Phone Doctor | TestM | AccuBattery | Samsung Members | CPU-Z | **PhoneCare (web)** |
| --- | --- | --- | --- | --- | --- | --- |
| Device identity | ✅ | ✅ | ➖ | ✅ | ✅ | ✅ (browser-reported) |
| Battery level / charging | ✅ | ➖ | ✅ | ✅ | ✅ | ✅ (Chromium only) |
| Battery health | Claimed | ➖ | ✅ (native) | ✅ (native) | ➖ | ⚠️ Estimate from user capacities |
| Battery temperature | ✅ native | ❌ | ✅ native | ✅ native | ✅ native | ❌ Unavailable (stated) |
| Storage analysis | ✅ | ➖ | ➖ | ✅ | ➖ | ✅ quota + user-modelled disk |
| Network speed test | ✅ | ➖ | ➖ | ➖ | ➖ | ✅ same-origin, no third party |
| Thermal / throttling | Temperature | ➖ | ➖ | ✅ | Temperature | ⚠️ Throttling inference |
| Screen test | ✅ | ✅ | ➖ | ✅ | ➖ | ✅ guided patterns + measured geometry |
| Touch test | ✅ | ✅ | ➖ | ✅ | ➖ | ✅ 40-zone coverage map |
| Compatibility matrix | ➖ | ➖ | ➖ | ➖ | ➖ | ✅ 36-point matrix |
| Performance benchmark | ✅ | ➖ | ➖ | ➖ | ✅ info | ✅ session-relative |
| Explainable recommendations | Partial | ❌ | Partial | Partial | ❌ | ✅ rule-based with evidence |
| Install required | ✅ | ✅ | ✅ | preinstalled | ✅ | ❌ none |
| Data leaves device | Varies | Claims no | Yes (analytics) | Yes | Varies | ❌ no |

Legend: ✅ available · ⚠️ available with explicit limits · ➖ not offered · ❌ not possible.

---

## 4. Technical architecture

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 · lucide-react ·
self-hosted variable fonts. No database, no auth, no third-party runtime dependency.

```
Browser (client islands)
├── DiagnosticProvider (state machine + localStorage persistence)
├── collectors (lib/collect/*)  ← all sensor/API access happens here
├── scoring / recommendations / assistant (pure TS, testable)
└── views (dashboard, modules, labs, report, AI Brain)

Server (Next.js)
├── Static/SSG pages: dashboard shell, guides, methodology, SEO
├── Route handlers:
│   ├── GET  /api/network/ping      → no-store round-trip probe
│   ├── GET  /api/network/download  → capped incompressible stream (≤8 MB)
│   ├── POST /api/network/upload    → counts and discards bytes (≤4 MB)
│   └── *    /api/assistant         → optional LLM proxy (server-only key)
└── Security headers applied in next.config.ts
```

**Key decisions**

- *No backend for diagnostics.* Sensor reads must happen on the device; a server round-trip would
  add latency, privacy risk, and no capability.
- *Backend only for what genuinely needs it*: throughput endpoints (must be same-origin and
  measurable) and the optional AI proxy (key isolation).
- *Evidence level in the type system.* `Reading.evidence` is a required union member, so a metric can
  never be rendered without its provenance. This is the structural guarantee behind the product
  promise.
- *Deterministic local assistant by default.* The assistant works with no API key, no cost and no
  data egress. `POST /api/assistant` is the extension point for a real model, gated by
  `ASSISTANT_API_URL` + `ASSISTANT_API_KEY` and never exposed to the client.
- *Scoring excludes unavailable data.* Modules publish `score: null` when a score cannot be
  justified; the weighted index normalises only over scored modules and reports evidence coverage
  separately.
- *Persistence is local and disposable.* `localStorage` key `phonecare.state.v1`, versioned; a scan
  can be cleared from the report page. Nothing is synchronised.

### Data-integrity invariants

1. A reading with `value: null` must have `evidence: "unavailable"` and explain why.
2. Only `measured` readings may be used as primary evidence in recommendations.
3. Health estimates never render without the "estimated" label.
4. The assistant may not introduce numbers that are absent from the snapshot.
5. Every module declares `coverage`; the dashboard never shows 100% when data is missing.

---

## 5. UI/UX design plan (light theme v2)

**Direction:** premium warm-light clinical product — a trustworthy health instrument, not a
gamified utility and not a dark dashboard. The reference point is a well-made consumer health
app: calm surfaces, confident type, one purple action per view, amber reserved for attention.

### 5.1 Official colour system

| Token | Hex | Role in the product |
| --- | --- | --- |
| Charcoal | `#1A1A1F` | Body and heading text, dark text on amber fills |
| Deep indigo | `#2D2B55` | Emphasised values, device chrome, footer depth |
| Primary purple | `#6A5ACD` | Primary buttons, active navigation, links, ring gradient start |
| Lavender | `#A678B9` | Secondary icon tints, ring gradient end, ambient washes |
| Champagne | `#F0D9B5` | Warm hero wash, "hold awake" tint, soft section separation |
| Amber orange | `#F4A62A` | Important secondary actions (AI Assistant, Run all tests), attention indicators |

Semantic surfaces built on those brand colours:

| Alias | Value | Notes |
| --- | --- | --- |
| `--color-canvas` | `#FAF7F3` | Warm off-white page background |
| `--color-surface` | `#FFFFFF` | Cards, header bar, drawer |
| `--color-surface-2` | `#F7F3FA` | Lavender-tinted insets, chips, quiet panels |
| `--color-canvas-deep` | `#F2ECE3` | Warm inset for disabled/placeholder areas |
| `--color-line` / `--color-line-soft` | `#E3DDD4` / `#EFE9E1` | Borders and dividers |
| `--color-fg` | `#1A1A1F` | Charcoal body text |
| `--color-muted` | `#5C5666` | Secondary text (≈6.6:1 on canvas) |
| `--color-faint` | `#766F80` | Metadata (≈4.8:1 on white) |
| `--color-accent` | `#6A5ACD` | Primary action / link (≈5.3:1 on white) |
| `--color-accent-deep` | `#5646B0` | Hover/pressed state for primary purple |
| `--color-warn` | `#A15A00` | Text-safe amber; `--color-amber` stays for fills |
| `--color-good` | `#1E7A4C` | Measured/healthy status |
| `--color-bad` | `#B3261E` | Action-needed status |
| `--color-info` | `#3B5BDB` | Neutral informational accents |

Rules: white text only on purple (5.3:1) or indigo; charcoal on amber (≈8:1); amber is never used
as small text on white; status is never encoded by colour alone (dot + label + text). Shadows are
soft and warm (`0 1px 2px rgba(26,26,31,.04), 0 18px 40px -28px rgba(45,43,85,.35)`), never glow.

### 5.2 Layout

- **Desktop ≥1024 px:** floating white navigation bar with a purple pill for the active route, a
  full-width hero, a two-column health/assistant row, a 3-up tool grid, then module cards.
- **Tablet 768–1023 px:** same top bar with the drawer for navigation, hero stacks, health and
  assistant become full-width, tools stay 2-up, bottom tab bar remains.
- **Mobile <640 px:** compact header (menu + wordmark), hero copy + actions only (illustration
  hidden to keep the first screen useful), 2-up tool grid, single-column cards, 5-item bottom bar
  with a purple indicator.
- Content max width 1280 px; 12–20 px page gutters; 20–24 px card padding; 16 px radii.

### 5.3 Component language

White cards with 1 px warm borders and soft shadows; purple icon tiles for primary modules, amber
tiles for attention modules, lavender for secondary; score rings that fade purple→lavender with a
dashed lavender placeholder when no score exists; evidence badges (measured / estimate / your input
/ unavailable) repeated in every list; collapsible explanations instead of hidden caveats.

### 5.4 Motion and accessibility

150–550 ms ease-out transitions, a single soft sheen on the logo, no parallax; everything collapses
under `prefers-reduced-motion`. Skip link first in tab order, focus-visible purple rings, focus
trap + Escape in the mobile drawer, 44 px touch targets, colour-independent status, and a contrast
budget verified by script (see §7.6: 115 text samples, 0 failures).

---

## 6. Project structure

```
app/
  layout.tsx, page.tsx, globals.css, icon.svg, loading.tsx, error.tsx, not-found.tsx
  diagnostics/{page,device,battery,storage,network,temperature,screen,touch,compatibility,performance}
  results/ assistant/ guides/[slug]/ methodology/
  api/network/{ping,download,upload}/route.ts, api/assistant/route.ts
  sitemap.ts robots.ts
components/
  layout/    app-shell, nav-items, run-scan-button
  ui/        button, card, badge, evidence-badge, score-ring, readings, misc, field, icon
  diagnostics/ module-card, module-header, module-result, run-module-button, metric-strip,
               storage-persistence (request + states), wake-lock (request + states)
  views/     dashboard, device, battery, storage, network, temperature, screen-lab, touch-lab,
             compatibility, performance, results, assistant
context/     diagnostic-provider.tsx
lib/
  types.ts modules.ts utils.ts scoring.ts recommendations.ts assistant.ts
  collect/{common,device,battery,storage,network,performance,temperature,screen,touch,compatibility}.ts
  guides/index.ts
```

---

## 6.1 Permissions policy

**Required: none.** No module asks for camera, microphone, location, notifications, motion or
bluetooth. Those APIs exist, but none of them reveals battery health, temperature, disk usage or
chip load, so requesting them would be theatre.

Two optional, user-initiated permissions are implemented:

| Permission | Where | Why it exists | Explainer shown first | States implemented |
| --- | --- | --- | --- | --- |
| Persistent storage (`navigator.storage.persist()`) | Storage module | Stops the browser evicting the saved scan when space is low | Yes — states it cannot read files, disk or free space | checking, granted, not-requested, declined-without-prompt, blocked (`NotAllowedError`), unsupported, retry |
| Screen wake lock (`navigator.wakeLock.request("screen")`) | Display test | Prevents the display sleeping while a human inspects patterns | Yes — states it is released on close and never reads the screen | active, released, declined (`NotAllowedError`), error, unsupported, browser-inactive re-acquire |

Both are triggered by an explicit button press (user gesture), never automatically on page load.
Permission state is displayed inline, and failure never blocks the underlying diagnostic.

**Explicitly impossible:** no permission grant exposes battery capacity/health, battery or CPU
temperature, cycle count, voltage, total disk usage, CPU load or signal strength to a web page.
Where those values are needed (capacity, ambient heat), the app asks the user to copy them from
the OS and labels them `user`.

### 6.2 Native integration (Phase 3: separate Android app)

The browser build remains the source of truth and ships no native code. Phase 3 adds a
**separate** Android app in `native/android/` — a real Kotlin project sharing the report schema,
not a webview wrapper. It has **not been compiled in this environment** (no JDK/Android SDK), so
no value it produces has been verified on a device. The APIs worth the cost, with constraints:

| Data | Android | iOS | Requirement |
| --- | --- | --- | --- |
| Battery capacity/health, cycles | `BatteryManager` (API 21+), `BatteryManager.EXTRA_CYCLE_COUNT` (API 34+) | `UIDevice` battery level only; health via private/entitlement APIs — not available to App Store apps | Native wrapper + runtime permission review |
| Thermal state | `PowerManager.getCurrentThermalStatus()` (API 29+) | `ProcessInfo.thermalState` (public) | Native wrapper |
| CPU / memory detail | `ActivityManager.MemoryInfo`, `/proc` (restricted) | `os_proc_available_memory`, no per-core load | Native wrapper, store-review justification |
| Disk totals | `StatFs` | `FileManager` volume capacities | Native wrapper |

A Capacitor/React-Native shell would add an app-store release cycle, privacy disclosures and a
second code path to audit. The browser build stays the source of truth; any future native layer
must feed the same evidence model (`measured` with a native source label) and must never be
simulated in the web build.

---

## 7. QA plan and results

### 7.1 How it was tested

QA ran against a **production build** (`next build` → `next start`, port 3100), driven by
puppeteer-core 23 with a headless Chromium shell (`@sparticuz/chromium`), on Linux x64.

> Caveat worth keeping: the **Turbopack dev server (`next dev`) is unreliable for automated QA** in
> this sandbox — its HMR websocket (`/_next/hmr`) fails to handshake, so client-side work never
> advances and the scan appears frozen. Every result below comes from `next start`. Manual browsing
> in a normal browser is unaffected, but re-run automated checks against a production build.

Environment note: headless Chromium throttles `requestAnimationFrame` to ~4 fps and reports a 1×
display, so frame-cadence and refresh-rate inference are *expected* to be unavailable there. The
app now refuses to publish those numbers below 24 Hz / 20 fps instead of inventing them.

### 7.2 Results

| Area | Method | Result |
| --- | --- | --- |
| Type safety | `tsc --noEmit` (strict, `noUncheckedIndexedAccess`) | ✅ 0 errors |
| Production build | `next build` | ✅ 28 routes, 0 warnings |
| Full scan | Click "Start full scan", await completion, read `localStorage['phonecare.state.v1']` | ✅ 7/9 modules complete; screen + touch are guided-only by design |
| Measured run | Same run, production build | device 93, storage 78, compatibility 98, network 94, temperature 88, performance 89, battery partial; health **83 Good**, 41% evidence after adding user data, 21 healthy / 1 watch / 2 action |
| Network module | Real socket round-trip via `/api/network/*` | ✅ 9 ms latency, 1452.6 Mbps down, 154.3 Mbps up on the sandbox loopback |
| Guided screen checks | Answered all 8 patterns in the overlay, saved, reloaded | ✅ 8/8 checks persisted, module 100, score restored on revisit |
| Touch lab | CDP pointer drag sweeping all 40 zones, then save | ✅ "40 of 40 zones covered" → 100% coverage, module 80 |
| Battery calibration | Entered 4500 mAh design / 3600 mAh full, re-ran | ✅ 80% *estimate* (labelled `estimated`), score 80 |
| Storage form | Entered 128 GB total / 9 GB free, re-ran | ✅ 7% free, warn state, "Free space is getting tight" recommendation |
| Export | Click "Export JSON" with CDP download capture | ✅ `phonecare-report-2026-11-09.json`, 13.5 KB, valid JSON |
| Responsive | 320, 390, 820, 1440 px | ✅ 0 px horizontal overflow at all four |
| Mobile drawer | Open/close, focus, Escape, tab order | ✅ mounts only while open, focus moves to close button, Escape closes, focus trapped |
| Empty/loading/error | Fresh profile, 404 route, bad guide slug, reduced motion | ✅ skeleton → empty states; `/missing` and `/guides/not-a-guide` return 404 with correct titles |
| Print | `page.pdf()` with print media emulation | ✅ sidebar/nav hidden, report prints on A4 |
| Reduced motion | `prefers-reduced-motion: reduce` | ✅ animations collapse to 0.01 ms |
| Security headers | `curl -I` | ✅ HSTS, X-Frame-Options SAMEORIGIN, nosniff, Referrer-Policy, Permissions-Policy |
| API limits | `curl` oversize requests | ✅ 5 MB upload → 413, 20 MB download capped to 8 MB, assistant POST → 501 without a configured model |
| Console | `console` + `pageerror` capture across every flow | ✅ 0 app errors (see caveat below) |
| Accessibility | Skip link first in tab order, labels, focus rings, contrast tokens, colour-independent badges | ✅ reviewed; no automated axe run yet (roadmap item) |

### 7.3 Issues found by QA and fixed in this pass

1. **`/api/network/download` aborted** — a streamed response surfaced as `net::ERR_ABORTED` even
   though every byte arrived. Replaced with a full pre-built buffer; payload verified byte-exact at
   1 MiB and 8 MiB.
2. **Stale state after form edits** — saving a profile then immediately re-running a module read the
   previous render's state, so the battery estimate silently stayed empty. The provider now treats
   its ref as authoritative on write.
3. **Screen checks not rehydrating** — revisiting the screen module showed `0/8` despite saved
   confirmations. Answers now initialise from saved checks.
4. **Bogus refresh/frame readings in throttled tabs** — "4 Hz refresh" and "4 fps" were presented as
   measurements. Both are now `unavailable` below plausible thresholds, with an explanation, and a
   2–4 thread device can no longer score "excellent" on raw loop speed alone.
5. **Overconfident overall score** — one perfect module produced "100 Excellent" at 11% evidence.
   Scores under 40% coverage or fewer than 4 scored modules are now labelled **Provisional** and the
   assistant says "early signal, not a verdict".
6. **Mobile drawer left hidden links focusable** — it is now conditionally mounted, focuses its close
   button, traps Tab and closes on Escape.
7. **Copy/grammar** — "1 items", raw ISO timestamps, "0 touch points", duplicated empty states and a
   duplicated note block on the screen module are fixed.

### 7.4 Known limitation kept on purpose

The download endpoint is served with `Transfer-Encoding: chunked` by the Next.js server even when the
buffer is complete, so Chromium's DevTools records one `net::ERR_ABORTED` for the largest transfer
while the body is fully received (verified by byte count). It is a transport-layer artifact, not data
loss; the module falls back to the previous successful measurement. Consumers see no error.

Product limitations (stated in-app, not bugs): battery/network hints are Chromium-only; thermal state
is throttling inference; browser storage is an origin quota, not the device disk; benchmarks are
session-relative; guided checks depend on human confirmation.

---

### 7.5 Module-by-module audit (2026-11-09)

Each module was checked against four questions: what can genuinely be read, which API provides it,
what is explicitly unavailable, and which states are handled.

| Module | Genuinely readable (measured) | API / technique | Explicitly unavailable | Permission | Last-updated + retry |
| --- | --- | --- | --- | --- | --- |
| Device identity | platform, browser, engine, screen geometry, DPR, colour depth, GPU string, core count, memory class, language | User-Agent + Client Hints, `screen`, `devicePixelRatio`, WebGL `RENDERER`, `hardwareConcurrency`, `deviceMemory` | exact model, RAM size, IMEI, storage chip, panel revision | none | module timestamp + per-reading source, "Run module" retry |
| Battery & health | level, charging state, coarse charge/discharge time (Chromium) | Battery Status API | capacity, temperature, voltage, cycles, wattage | none | timestamp; recalibration re-runs; unsupported and error states |
| Storage | origin quota/usage, persistence state, localStorage size, IndexedDB availability | `navigator.storage.estimate/persisted`, `localStorage` | device disk total/free (user-entered only) | optional persistence | timestamp; input validation; denied/blocked/unsupported handled |
| Network | latency, jitter, download, upload, connection class/hints (Chromium) | `fetch` to same-origin probe routes, `performance.now`, Network Information API | public IP, packet loss, cellular dBm | none | timestamp; failure falls back to previous value and explains; RTT 0 reported unavailable |
| Thermal | throttling signal under sustained load | three-round compute benchmark, rAF cadence | any temperature reading | none | timestamp; fps sample below 20 fps reported unavailable instead of a false limit |
| Screen & display | CSS/physical resolution, DPR, colour depth, gamut, HDR, refresh (when plausible) | `matchMedia`, `screen`, rAF cadence | panel defects, burn-in, true brightness | optional wake lock | timestamp; 8 guided confirmations persist; Escape/arrow keys; re-measure action |
| Touch | contact count, coverage, missed zones, input types | Pointer Events, `maxTouchPoints` | pressure curve, hover/proximity, millimetre accuracy | none | timestamp; save trace; clear grid; unsupported (no digitiser) state |
| Compatibility | 37 feature-detections, API coverage tier | `'x' in window`, `matchMedia`, context creation | physical hardware behind the APIs | none | timestamp; category filters; explicit unsupported marks |
| Performance | compute index, storage write/read, JS heap (Chromium), frame cadence (foreground only) | deterministic loop, IndexedDB round-trip, `performance.memory`, rAF | CPU load %, GPU load, thermal state, cross-device scores | none | timestamp; note explains background-tab throttling; low-thread cap |

Fixes made during this audit: removed a static `ProgressBar value={18}` that implied a measured
quota; corrected the matrix size (28 → 37); stopped publishing 0 ms RTT, 4 Hz refresh and 4 fps
frame cadence as measurements; removed a duplicated empty state on every module; corrected the
thermal frame-reading contradiction; changed "Calculating…"/"Sampling…" placeholders to explicit
"Not reported"/"Needs more samples"; fixed a duplicated category label in the feature matrix.

### 7.6 Light-theme redesign verification

| Check | Method | Result |
| --- | --- | --- |
| Type safety | `tsc --noEmit` | ✅ 0 errors |
| Production build | `next build` | ✅ 28 routes |
| Full scan on light build | headless Chromium, production server | ✅ 7/9 auto modules; device 93, storage 78, compatibility 98, network 94, performance 74, thermal 68–88 (session variance), battery partial |
| Contrast | scripted WCAG pass over 111 rendered text nodes on `/` (count shifts with the readings rendered) | ✅ 0 failures (≥4.5:1 body, ≥3:1 large) |
| Horizontal overflow | 320 / 390 / 820 / 1440 px | ✅ 0 px at every width |
| Mobile drawer | open, focus, Escape, focus trap | ✅ dialog mounts on open, focuses close button, closes on Escape |
| Bottom navigation | 5 routes at 390 px | ✅ active purple indicator, no overlap with content (pb-28) |
| Permission states | persistence request + wake lock request in headless Chromium | ✅ persistence granted; wake lock denied path renders with explanation, test still usable |
| Guided tests | 8 screen patterns saved; 40-zone touch drag | ✅ persist across reload; touch 80/100 |
| Print | `page.pdf()` with print media | ✅ navigation hidden, A4 output |
| Console | `pageerror` + console error capture across all flows | ✅ 0 application errors |
| No dark surfaces | visual review of every route | ✅ only the display-test overlay is dark by design |

### 7.7 Real-device testing — what has actually run

Rules: a result is only labelled **Physical** when a person ran it on the named phone or desktop.
Emulation is layout evidence only; it is never sensor evidence.

| Target | Engine | Status in this session | Evidence |
| --- | --- | --- | --- |
| Desktop Chrome | Blink | **Engine** — real Chromium, headless, production build | Full scan 7/9, touch N/A, wake lock declined, persistence granted |
| Android Chrome | Blink | **Emulated** — Android UA + 412×915 @2.6 + touch | Layout, 40/40 touch trace, orientation `portrait-primary`, 0 overflow |
| iPhone Safari | WebKit | **Emulated** — iOS UA + 393×852 @3 on Chromium | Layout only. **Not a WebKit result** |
| Android Firefox | Gecko | **UA only** — not runnable here | Never reported as Firefox |
| Desktop Firefox / Safari | Gecko / WebKit | **BLOCKED** — engine download unreachable in the sandbox | Not tested |

Additional **simulated** runs (API removed or forced to reject before page load) prove the fallback
UI: Battery Status deleted → battery module `unavailable`, "This browser does not expose battery
data", badge **Unsupported**; `navigator.storage` deleted → origin usage unavailable, persistence
card **Unsupported here**; `persist()` → `false` → **Declined**; `persist()` → `NotAllowedError` →
**Blocked**; `wakeLock` deleted → **Unsupported** + disabled button; `wakeLock.request()` stubbed to
resolve → **Awake**, release returns to "Hold awake". No console errors in any scenario.

The manual checklist for the five remaining physical targets lives in
[`docs/DEVICE_TESTING.md`](docs/DEVICE_TESTING.md) (per-module steps, permission-denial paths,
accessibility, and a results table to fill in).

### 7.8 Browser API compatibility matrix

Feature-detected per session; every gap has a visible fallback rather than a fabricated number.

| API | Chrome / Edge / Samsung (Android) | Firefox | Safari (iOS / macOS) | What PhoneCare does when missing |
| --- | --- | --- | --- | --- |
| Battery Status (`getBattery`) | ✅ | ❌ removed in v52 | ❌ never shipped | Module `unavailable`; explains why and offers a capacity-based estimate |
| `storage.estimate()` | ✅ | ✅ | ✅ (recent versions) | Origin usage shown as unavailable, never guessed |
| `storage.persist()` | ✅ (may auto-decide) | ✅ (usually silent grant) | ⚠️ version-dependent | Explanatory card, then Persistent / Declined / Blocked / Unsupported |
| Screen Wake Lock | ✅ | ⚠️ behind flag | ✅ 16.4+ | "Unsupported here" badge, disabled request button, test still usable |
| Network Information | ✅ | ❌ | ❌ | `effectiveType` row reads unavailable; measured latency/throughput still used |
| `deviceMemory` | ✅ (capped at 8) | ❌ | ❌ | Falls back to `hardwareConcurrency`, labelled coarse |
| `hardwareConcurrency` | ✅ | ✅ | ✅ | Shown as reported thread count |
| Screen Orientation + `type`/`angle` | ✅ | ✅ | ✅ | — |
| `orientation.lock()` | ✅ (fullscreen/installed) | ❌ | ❌ on web | Button hidden when unsupported; no error toast |
| Pointer Events | ✅ | ✅ | ✅ | Mouse fallback on non-touch desktops |
| Touch (multi) | ✅ | ✅ | ✅ | 40-zone grid works with mouse as well |
| WebGL / WebGL2 | ✅ | ✅ | ✅ | Compatibility row marks it unsupported instead of faking a GPU |
| Web Bluetooth / NFC / File System Access | ✅ (Android) | ❌ | ❌ | Compatibility rows only; no feature pretends to exist |

### 7.9 Security standards

| Control | Implementation | Verified |
| --- | --- | --- |
| Content Security Policy | `default-src 'self'`, no inline script beyond `'unsafe-inline'` needed by the Next bootstrap, `object-src 'none'`, `frame-ancestors 'self'` | Header present on every route; console clean |
| Transport | HSTS `max-age=63072000; includeSubDomains; preload` | Header present |
| Framing / sniffing | `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff` | Present |
| Referrer / capabilities | `strict-origin-when-cross-origin`; `camera=(), microphone=(), geolocation=()` | Present |
| Injection surface | No `dangerouslySetInnerHTML`, `eval`, or `new Function` anywhere | `grep` clean |
| Secrets | Assistant key read only in route handlers; `NEXT_PUBLIC_*` holds the site URL only | Client bundle contains no key path |
| Abuse limits | Download cap 8 MB, upload cap 4 MB, assistant 12 req/min + body caps | Verified in earlier QA |
| Data residency | Diagnostics live in `localStorage` only; no cookies, no third-party requests, no analytics | Network panel clean |
| Dependencies | `npm audit --omit=dev` | 0 vulnerabilities |

### 7.10 Pre-merge code review (2026-11-09)

Full pass over all 89 files of PR #1. Issues found and fixed in the review commit:

| Issue | Why it mattered | Fix |
| --- | --- | --- |
| Device identity was scored `72 + coverage×24` | The number rose and fell with how many UA fields the browser exposes, so "device 93/100" described the browser's chattyness, not the phone | Module is now unscored (`—`) and says so in its notes |
| Storage was scored a fixed **78** when only the origin quota was readable | A constant dressed up as a health score; the quota says nothing about how full the disk is | Score only exists once the user enters device totals (pressure model); otherwise `partial` + `—` |
| "Time to full / remaining" showed `—` labelled **Measured** | A dash was presented as a measurement | Not-applicable rows are `unavailable` |
| Upload payload was ~99.98% zeros (`i += 4096`) while the comment claimed incompressibility | A compressing proxy would have inflated upload Mbps | Every byte filled via `crypto.getRandomValues` in 64 KB blocks |
| Performance injected a neutral **70** for an unmeasured storage benchmark | Pulled every such device toward 70 without disclosure | Only measured signals carry weight, matching the network module |
| IndexedDB write errors rejected the whole performance module | Private modes can expose IDB but refuse writes | Benchmark returns `null` (reading unavailable) instead |
| BatteryManager listeners were never removed | Leak + state updates after unmount on a global object | Listeners removed in the effect cleanup |
| `ScoreRing` built its gradient id from size+score | Two rings with the same score would collide in the DOM | `useId()` |
| Compatibility used `"getBattery" in nav` | Contradicted `hasBatteryApi()`, which requires a callable function | Same `typeof === "function"` test |
| Health index could read "Excellent" with under half the weighted model scored | The headline verdict rested on 4 of 9 modules | `provisional` now also requires ≥50% of the model weight to be scored |
| Dead exports (`moduleIsStale`, `MODULE_ORDER`, `DEVICE_UNSUPPORTED_READING`), "no uploads" copy, redundant `isRunning` condition | Unnecessary code and two absolute privacy claims the speed test contradicted | Removed / reworded |
| Storage page showed origin usage and persistence twice (footprint card + metric tiles + readings panel) | Redundant presentation of the same three numbers | Metric strip now carries only the device figures the user enters |

Result after the fixes (headless Chromium, production build): 7/9 modules complete, **4 scored**, health
index **88 Provisional** at 58% evidence and 42% of the weighted model, contrast 111/0, touch 40/40,
overflow 0 at 320/390/820/1440, no console errors.

---

## 8. Deployment readiness (Vercel)

| Item | State |
| --- | --- |
| Production build | Verified locally with `next build` |
| Runtime | Node.js route handlers; no edge-only APIs |
| Env vars | `NEXT_PUBLIC_SITE_URL` (metadata), optional `ASSISTANT_API_URL`, `ASSISTANT_API_KEY`, `ASSISTANT_MODEL`. See `.env.example` |
| Secrets | Only server-side; never referenced in client components |
| Security headers | CSP, nosniff, frame options, referrer policy, permissions policy, HSTS |
| SEO | Metadata templates, per-page descriptions, sitemap, robots, canonical guide URLs |
| Performance | Static-first pages; client islands only for diagnostic views; self-hosted fonts |
| Health probe | `GET /api/health` returns status, assistant mode (local or enhanced), site, runtime and time with `no-store` |
| Runbook | [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — env vars, deploy steps, post-deploy curls, rollback |
| Verification | **Local build + runtime verified (build, 29 routes, headers, health probe). Live Vercel deployment has not been performed — do not claim it has.** |

---

## 9. Sources

- MDN — Battery Status API: https://developer.mozilla.org/en-US/docs/Web/API/Battery_Status_API
- MDN — StorageManager.estimate(): https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate
- MDN — Network Information API: https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API
- MDN — Navigator.deviceMemory: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory
- MDN — Pointer events: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
- Chrome for Developers — Estimating available storage space: https://developer.chrome.com/blog/estimating-available-storage-space
- web.dev — Core Web Vitals: https://web.dev/articles/vitals
- Apple — Maximising battery life and lifespan: https://www.apple.com/batteries/maximizing-performance/
- Google Support — Free up space on Android: https://support.google.com/android/answer/7436584
- LambdaTest — Battery Status API support & privacy: https://www.lambdatest.com/web-technologies/battery-status
- Castle — `navigator.deviceMemory` implementation and capping: https://blog.castle.io/deep-dive-how-navigator-devicememory-can-be-used-for-fingerprinting-and-bot-detection/
- Phone Clinix — Top 10 phone diagnostic tools (2025): https://phoneclinix.wordpress.com/2025/02/25/top-10-phone-diagnostic-software-tools-in-2025/
- Phone Clinix — Android diagnostic tools guide: https://phoneclinix.com/android-diagnostic-tools-run-a-full-health-check-with-ease/
- Play Store — Phone Doctor Pro: https://play.google.com/store/apps/details?id=com.predictapps.mobiletester
- WCAG 2.2 understanding documents: https://www.w3.org/WAI/WCAG22/Understanding/
- MDN — Screen Wake Lock API: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
- MDN — `StorageManager.persist()`: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
- MDN — `NetworkInformation.rtt` (0 means unknown): https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation/rtt
- web.dev — Persistent storage: https://web.dev/articles/persistent-storage
- Chrome for Developers — Page visibility and `requestAnimationFrame` throttling: https://developer.chrome.com/docs/web-platform/page-lifecycle-api
- MDN — Content-Security-Policy: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
- MDN — Screen Orientation API (`lock()` availability): https://developer.mozilla.org/en-US/docs/Web/API/Screen_Orientation_API
- MDN — Network Information API availability: https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API
- React — Hydration mismatch (`onRecoverableError` / text mismatch): https://react.dev/reference/react-dom/client/hydrateRoot
- Android — `CellSignalStrengthLte`: https://developer.android.com/reference/android/telephony/CellSignalStrengthLte
- Android — `TelephonyManager`: https://developer.android.com/reference/android/telephony/TelephonyManager
- Android — `WifiManager` (`getConnectionInfo` deprecation): https://developer.android.com/reference/android/net/wifi/WifiManager
- Android 14 — foreground service types: https://developer.android.com/about/versions/14/changes/fgs-types-required
- Apple — `CTCarrier` deprecation: https://developer.apple.com/documentation/coretelephony/ctcarrier
- IETF — RFC 6349 TCP throughput methodology: https://www.rfc-editor.org/info/rfc6349/
- ITU-T — Y.1541 network performance objectives: https://www.itu.int/rec/T-REC-Y.1541

---

## 10. Roadmap

**v1.0 — shipped**
Nine modules, evidence-labelled readings, weighted scoring, recommendations engine, guides library,
AI Brain (local engine + server extension point), JSON/print report, responsive shell, SEO,
methodology page.

**v2.0 — light brand redesign (this build)**
Official six-colour palette, light-only surfaces, floating top navigation with purple pill, hero
dashboard, 2-up mobile tool grid, permission explainers and states, module-by-module API audit,
contrast and overflow verification. Remaining: real-device pass on Android/iOS and axe CI.

**v1.1 — depth**
- Audio/speaker and microphone tests with explicit consent and clear permission copy.
- Camera sensor check (dead pixels, focus) without uploading frames.
- Save and compare multiple scan snapshots over time.
- Export a PDF via print refinement; add QR hand-off for used-device sellers.

**v1.2 — intelligence**
- Optional server-assisted report summarisation (already stubbed) with strict evidence constraints.
- Trend detection across scans ("battery health fell 4% in 60 days").
- Localisation framework (message catalogs, RTL support).

**v1.3 — platform**
- PWA install + offline shell (service worker) while keeping scans local.
- Web Bluetooth accessory telemetry (explicitly *not* presented as phone internals).
- Automated accessibility regression tests in CI.

**v1.4 — network intelligence (this build)**
Web: quality test with validity gates, indoor survey with manual rooms, rule-based troubleshooting,
noise-aware before/after comparison, shared report schema and `/api/reports` validator.
Native: separate Kotlin Android app for radio/Wi-Fi/dual-SIM measurements and report export.
Blocked on hardware and SDK: device validation of every native reading, real indoor coverage study.

---

## 11. Decision log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-11-09 | Evidence level is a required field on every reading | Structural guarantee against fake metrics; supports the whole trust position |
| 2026-11-09 | No backend for diagnostics | Sensor access must be local; avoids privacy and latency costs |
| 2026-11-09 | Network tests against same-origin endpoints only | Avoids third-party dependencies and keeps IP addresses private |
| 2026-11-09 | Local deterministic assistant as default | Works with zero configuration and zero cost; remote model is opt-in |
| 2026-11-09 | Maturity achieved without claiming native capability | Product honesty; unavailable states are a feature, not a gap |
| 2026-11-09 | Self-hosted variable fonts | No third-party requests, no layout shift, predictable privacy posture |
| 2026-11-09 | Light theme only; dark surfaces removed | User directive and brand system; warm-light surfaces read as a health product rather than a gaming dashboard |
| 2026-11-09 | Top navigation replaces the desktop sidebar | Matches the approved reference, returns 268 px of width to the report content, keeps one navigation model across breakpoints |
| 2026-11-09 | Display-test overlay stays black | A dead-pixel/black-field test must be able to render true black; documented as the single intentional dark surface |
| 2026-11-09 | Only two optional permissions implemented | Persistence and wake lock add real value; any other prompt would imply hardware access the web cannot give |
| 2026-11-09 | Unavailable beats implausible when sampling is throttled | 4 Hz refresh / 4 fps cadence are background-tab artifacts; publishing them would be a fabricated measurement |
| 2026-11-09 | Touch digitiser count is read after mount | Reading `navigator.maxTouchPoints` during render made server HTML ("no digitiser") disagree with the first client paint on phones — the source of React error #418 |
| 2026-11-09 | `hasBatteryApi()` requires a callable function | `"getBattery" in navigator` was true for browsers exposing the property as `undefined`, so the badge said Supported while the readings said unavailable |
| 2026-11-09 | Modules labelled by dominant evidence, not "measured" count | A thermal score built from estimated signals displayed "0 measured"; the report now says "N estimated" |
| 2026-11-09 | CSP added with `'unsafe-inline'` for scripts only | Next injects an inline bootstrap; a nonce pipeline needs middleware and is deferred. Everything else is `'self'` |
| 2026-11-09 | Identity and browser capability are never scored as device health | A score must describe the device's condition. Availability of UA fields or APIs is information, not health |
| 2026-11-09 | An index needs ≥50% of the model weight scored to be called a verdict | With battery (20%) and disk (14%) unknown, the weighted coverage is 42% — enough for a provisional reading, not a verdict |
| 2026-11-09 | Upload payload is fully random | Test fidelity: a compressible body would overstate upload speed |
| 2026-11-09 | No absolute "no uploads" claim | The speed test POSTs synthetic bytes to our own endpoint; copy now says no account and no third-party uploads |
| 2026-11-09 | Native Android app, not a webview shell | Radio metrics and dual-SIM state have no browser API; the app shares the report schema instead of duplicating logic |
| 2026-11-09 | Radio rows are null with `availability: unsupported` in web reports | Makes fabrication a schema error and documents the platform limit in the data itself |
| 2026-11-09 | No packet-loss claim from HTTP probes | Probe failures are not dropped packets; conflating them would be the classic speed-test lie |
| 2026-11-09 | Scores withheld when jitter > 150 ms or failures > 5 % | RFC 6349 §3: a throughput number on a link that unstable is meaningless |
| 2026-11-09 | Before/after needs 2× uncertainty | Router tweaks mostly land inside noise; claiming victory would be dishonest |
| 2026-11-09 | No Wi-Fi scanning in the native app | It adds permission surface and cannot reveal router transmit power, which is what users actually want |
| 2026-11-09 | Survey location is typed, not GPS | Avoids location tracking and keeps the feature usable on desktop |


---

## 12. Phase 3 — Network intelligence and the native Android app (2026-11-09)

### 12.1 Research method

Five rounds of primary-source reading before any code: Android telephony and Wi-Fi reference
pages (API level, permission and "unavailable" semantics), Apple Core Telephony limits, RFC 6349
for throughput methodology, Android 14/15 foreground-service rules, and seven competing
diagnostic products (Network Cell Info Lite, OpenSignal, nPerf, CellMapper, WiFiAnalyzer, NetSpot,
Ookla Speedtest). Findings are recorded in `docs/native/RESEARCH-NETWORK-CELLULAR.md`; product
scope decisions follow from them, not from preference.

### 12.2 Capability matrix (implemented in `lib/diagnostic/capabilities.ts`)

| Capability | Web | Android | iOS |
| --- | --- | --- | --- |
| RTT, jitter, throughput, DNS/TTFB | yes | yes | yes |
| Probe-failure rate | yes (not packet loss) | yes | yes |
| LTE RSRP/RSRQ/RSSNR | **no** | permission (API 26+) | **no** |
| 5G NR SS-RSRP/RSRQ/SINR | **no** | permission (API 29+) | **no** |
| Cell identity, band, timing advance | **no** | permission | **no** |
| Dual-SIM carrier/state | **no** | permission | **no** |
| Wi-Fi RSSI / band / link speed | **no** | permission | **no** |
| Wi-Fi scan / channel occupancy | **no** | permission | **no** |
| Packet loss | **no** | only with root/VPN | only with elevated tooling |
| Deep-link to network settings | **no** | yes | partial |

Consequences baked into the product: no browser card ever shows a dBm value; the Android app is
the only place radio metrics appear; the report schema marks every radio row as
`availability: unsupported` in a web report.

### 12.3 Permission matrix (Android)

| Permission | Needed for | Requested when | If denied | If permanently denied |
| --- | --- | --- | --- | --- |
| `ACCESS_FINE_LOCATION` | cell identity + signal, SSID | tapping "Read cellular" | empty cellular card with reason; link tests still work | button to app settings |
| `READ_PHONE_STATE` | carrier, RAT, SIM slots | same gesture | carrier/SIM rows unavailable | button to app settings |
| `ACCESS_NETWORK_STATE` / `ACCESS_WIFI_STATE` | connected-link metrics | normal permissions, no prompt | n/a | n/a |
| `NEARBY_WIFI_DEVICES` (declared, unused) | future scanning only | never in this build | n/a | n/a |

Location is used *only* because Android gates cell identity behind it. The app requests no
location fix, stores no coordinates, and has no background permission. Room names are typed by
the user, so the survey works without location at all.

### 12.4 Measurement standards

- **RFC 6349 principles**, not compliance: measure each direction separately; minimum RTT as the
  baseline; refuse to score when jitter > 150 ms or probe failures > 5 %.
- **ITU-T Y.1541** bands inform the latency score; no QoS class is claimed.
- **RFC 3550-style** jitter: mean absolute difference of consecutive RTTs.
- Every published number carries `source`, `timestamp`, `evidence`, `availability` and, where it
  exists, an uncertainty (sample spread, or the modem's 1 dB resolution).
- RSRP bands (≥ −80 excellent … < −110 very weak) are indicative industry bands, not carrier
  guarantees.

### 12.5 Diagnosis logic

Rules live in `lib/diagnostic/triage.ts` and fire only when their inputs exist:

| Inputs | Conclusion | Confidence |
| --- | --- | --- |
| Wi-Fi RSSI < −75 and cellular RSRP ≥ −95 | Wi-Fi coverage, not carrier | likely |
| Wi-Fi RSSI ≥ −60 and RTT > 150 ms | upstream / congestion | likely |
| Cellular RSRP < −105 | cellular coverage | likely |
| DNS > 100 ms with TTFB < 60 ms | name resolution | possible |
| Strong radio and download < 2 Mbps | congestion or backhaul | possible |
| Jitter > 60 ms or failures > 5 % | instability, not slowness | likely |
| Room scores differ by ≥ 25 | location-specific coverage | likely |
| No anomaly but the user reports one | measurement window too short | possible |

Unknown inputs downgrade the output to `insufficient_data` and list exactly what is missing. No
conclusion is emitted without its evidence lines, and the engine has no "verified fix" state — a
fix is only proven by a before/after comparison that exceeds the noise band.

### 12.6 Before/after honesty

`lib/diagnostic/compare.ts` requires the change to exceed **twice the combined uncertainty**
(latency: derived from each run's half-IQR; throughput: 10 % floor). Otherwise the verdict is
"no measurable change". Different servers, fewer than three samples, and single-run comparisons
are surfaced as caveats rather than silently ignored.

### 12.7 Privacy rules

Measurements stay in `localStorage` / app-private storage. No analytics, no accounts, no upload
unless the user explicitly posts a report to `/api/reports` (validation only, no storage). No Wi-Fi
credentials, no location track, no background collection. Android survey runs foreground-only,
which also avoids Android 15's time limit on `dataSync` foreground services.

### 12.8 Limitations that remain

1. **Native code compiles and its engine logic is verified, but no APK exists** — the environment has no Android SDK/Gradle, Google Maven is unreachable, and no desktop `d8`/`apksigner` is obtainable offline (see §13).
2. Same-origin throughput includes the distance to this deployment; not comparable to ISP figures.
3. Browser probe failures are HTTP-level; packet loss is not measurable without native privileges.
4. Wi-Fi RSSI is driver-quantised; channel width and neighbour occupancy are not available without scanning.
5. iOS has no public cellular signal or Wi-Fi RSSI API, so a comparable iOS app is not feasible.
6. Real indoor coverage still depends on construction, materials and the access point's placement;
   nothing here can change radio physics.

### 12.9 Test evidence for this phase

| Check | Result |
| --- | --- |
| `tsc --noEmit` | 0 errors |
| `next build` | success, 28 routes, 6 API routes |
| `npm run test:contract` | 46 assertions, 0 failures (schema invariants, probe stats, comparison noise, triage rules, survey thresholds, report builder) |
| `POST /api/reports` with a valid Android report | 200, normalized echo |
| `POST /api/reports` with fabricated value (`null` + `measured`) | 422 with JSON-pointer path |
| Oversized body | 413 cap enforced at 4 MB |
| Android Kotlin compile | ✅ 10 files, `android.jar` API 35, exit 0, 0 warnings (47 classes) |
| Android engine checks | ✅ 27 passed, 0 failed |
| aapt2 resource link | ✅ manifest + resources → 2.1 KB APK shell |
| Android APK (`assembleDebug`) | **not run** — no SDK/Gradle/d8/apksigner here |
| Real-device measurement | **not run** — requires hardware |

### 12.10 Phase status

| Phase | Status |
| --- | --- |
| 1 research + architecture | ✅ `docs/native/` |
| 2 diagnostics specification | ✅ `docs/native/NETWORK-SPEC.md` |
| 3 native prototype | ✅ compiles + 27 engine checks; ⚠️ APK not built |
| 4 real device measurements | ⛔ blocked: needs hardware |
| 5 indoor mapping | ✅ web survey implemented; native session code written |
| 6 AI troubleshooting | ✅ deterministic triage + comparison |
| 7 website integration | ✅ shared schema, validator, endpoint, labs linked |
| 8 security/performance | ⚠️ web verified; native blocked |
| 9 release readiness | ⛔ cannot be claimed without Phase 4 |

---

## 13. Phase 4 — native Android execution record

### 13.1 Toolchain actually used

| Component | Source | Notes |
| --- | --- | --- |
| Kotlin compiler 2.4.21 | npm `kotlin-compiler@2.4.21` | full `kotlinc`, not a runner |
| JRE 25.0.2 | PyPI `jdk4py` | runtime only — no `javac`, `jarsigner` |
| `android.jar` API 35 | GitHub `Sable/android-platforms` tarball (codeload) | 27,092,450 bytes |
| `aapt2` 2.20 | npm `aaptjs3` (bundled Linux binary) | compile + link work; `dump badging` confirms package/SDK/permissions/icon |
| `d8` | npm `d8-termux` | **unusable** — it is a Dalvik `classes.dex` container, not a JVM jar |

Network reachability from this sandbox: `dl.google.com` → `000`, `repo.maven.apache.org` → `000`,
`services.gradle.org` → `000`. That is why no SDK, AGP, Compose or Gradle distribution can be
obtained here.

### 13.2 Code changes made to reach a compiling, dependency-free app

1. `enum class Unit` shadowed `kotlin.Unit` and broke every `() -> Unit` lambda → renamed
   `MeasureUnit` throughout (schema, collectors, UI, checks).
2. Removed `kotlinx.coroutines`: `InternetQualityEngine.run` is now synchronous; the Activity owns a
   single-thread `ExecutorService`.
3. Removed `androidx.core` (`ContextCompat`/`ActivityCompat`) → `Activity.checkSelfPermission`,
   `requestPermissions`.
4. Removed `FileProvider` and `res/xml`: report sharing is `ACTION_SEND` `text/plain` with the JSON
   in `EXTRA_TEXT`, so no storage permission and no file surface.
5. Replaced the Compose UI with a framework `ScrollView`/`LinearLayout` UI. This removed the last
   AndroidX dependency, which is what made a full desktop compile possible. It also means the app
   builds with nothing but the SDK.
6. `CellIdentityLte.timingAdvance` does not exist; the accessor is on
   `CellSignalStrengthLte.getTimingAdvance()`, frequently `UNAVAILABLE` — reported as null.
7. Added `net/ConnectivityMonitor` (transition counts during a run), `optimization/Tips` (12 rule
   ids, always ending with the `limits` boundary), gateway/DNS capture in `WifiCollector`, `rat` +
   `rsrpDbm` in `CellularCollector`, and a TCP gateway probe in the quality engine.
8. Stability now distinguishes CV noise from real drift: `rangeMs <= 20` counts as stable even when
   CV is high, because sub-20 ms spread is measurement noise, not a bad link.

### 13.3 Evidence

```
$ KOTLINC=… ANDROID_JAR=…/android-35/android.jar ./verify-engine.sh
Compiling 10 Kotlin files against android-35…
Compiling verification harness…
Running engine checks…
native engine checks: 27 passed, 0 failed
OK: all sources compile; engine checks passed.
```

```
$ aapt2 compile --dir app/src/main/res -o res.zip          # exit 0
$ aapt2 link -o base-unsigned.apk -I android.jar --manifest AndroidManifest.xml \
    -R res.zip --auto-add-overlay --min-sdk-version 26 --target-sdk-version 35   # exit 0
base-unsigned.apk: AndroidManifest.xml (3408 B), resources.arsc (740 B)
```

Manifest needed an explicit `package=` attribute because `aapt2` link is run outside AGP (AGP
injects the namespace). This is compatible with AGP 8 and harmless.

### 13.4 Exact APK blocker

| Needed | Why it is missing |
| --- | --- |
| `d8` (dexer) | Android build-tools only; Google Maven/SDK unreachable; npm's `d8` package is an Android-format dex container |
| `apksigner` / `zipalign` | same |
| Gradle 8.9 + AGP 8.7.3 | `services.gradle.org` and Google Maven unreachable |
| Device/emulator | none in the sandbox |

**Resolution.** None of those tools were obtained locally; instead the build moved to GitHub
Actions (`.github/workflows/android-debug-apk.yml`), which has the SDK. Run 43191694923 completed
green: unit tests, `assembleDebug`, then `aapt2`/`unzip`/`apksigner` assertions, producing a
935,496-byte debug APK, v2-signed, SHA-256
`b42e7cbfce4da5894a420dcbff493bd886961e46dd6191421e36a7fa2da33ff5`, uploaded as the
`phonecare-debug-apk` artifact. Nothing was fabricated locally, and the local `build-local.sh`
remains for offline builds.

### 13.5 Next roadmap

1. ✅ Build the APK — done in CI (run 43191694923), artifact `phonecare-debug-apk`.
2. **Install it on a physical phone** and execute `docs/native/DEVICE-TEST-CHECKLIST.md`: emulator
   smoke round, then cellular, Wi-Fi, permission matrix, transitions, indoor/outdoor, report interop.
3. Launcher icon (adaptive vector) and label are in place; a release keystore comes only after device
   evidence exists.
4. Feed real device reports back through `POST /api/reports` and compare against the web engines —
   differences between modem-reported and browser-measured values must stay visible, not averaged.
5. Optional hardening: instrumented tests (`androidTest`) for the permission matrix; R8 + shrinking
   for a release build.

---

## 14. Dual-platform build pipeline

Both products are first-class; neither is a demo of the other.

| Platform | Gate | Status |
| --- | --- | --- |
| Web | `npx tsc --noEmit`, `npm run test:contract`, `npm run build` | ✅ green locally; `.github/workflows/web-checks.yml` written, unexecuted |
| Android | `gradle testDebugUnitTest`, `gradle assembleDebug`, APK assertions | ✅ green in CI (push run 43191694923 and PR run 43191704293); APK artifact published |

It took three failed runs to get there, all diagnosed from annotations rather than logs (the log
storage host is unreachable from this sandbox): (1) `android-actions/setup-android@v3` failed on the
runner → replaced with SDK discovery + `sdkmanager`; (2) verification failed silently → assertions
now emit `::error::`/`::notice::` annotations containing the real badging lines; (3) that annotation
showed the key is `minSdkVersion:'26'`, not `sdkVersion:'26'`.

`.github/workflows/android-debug-apk.yml` does not merely build: it fails the job unless the APK
exists, the badging matches package / minSdk 26 / targetSdk 35 / launcher activity, `classes.dex`
and `resources.arsc` are present, and `apksigner verify` reports a **v2 signature**. The artifact
(`phonecare-debug-apk`) carries the APK, its SHA-256, badging, contents and signature transcript,
so a download can be checked instead of trusted.

Why cloud CI is the right answer here: this sandbox cannot reach Google Maven and has no `d8` or
`apksigner`, so no APK can exist locally. GitHub's runners have the SDK; the repository therefore
needs one approved push, not a workaround.

Shared definitions stay shared: `shared/diagnostics.schema.json` + `lib/diagnostic/*` (web) and
`native/android/.../core` (Kotlin) are checked by two independent harnesses
(`scripts/contract-test.cjs` 46 assertions, `verification/EngineChecks.kt` 27 checks, plus 4 JUnit
tests), so a drift in one platform shows up as a failing test rather than a silent mismatch.

Browser readings and native readings are never merged: `/network` labels each capability with its
source, and Android measurements carry `evidence` + `source` describing the telephony API used.
