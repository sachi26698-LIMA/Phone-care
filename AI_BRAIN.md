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
7. **Update this file** whenever a new permanent rule, platform constraint, or architecture
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

## 5. UI/UX design plan

**Direction:** premium futuristic dark SaaS dashboard — not a gamified utility app.

- **Colour:** OKLCH tokens on a near-black navy canvas (`oklch(0.145 0.018 265)`), cyan→violet accent
  gradient, semantic good/warn/bad, text `oklch(0.976 0.004 265)` on canvas for >12:1 contrast;
  muted text kept above 4.5:1.
- **Typography:** Space Grotesk for display/headings, Inter for UI, tabular numerals for metrics.
- **Layout:** fixed 268 px sidebar with progress summary; sticky glass header; max 1240 px content;
  mobile bottom tab bar + slide-over drawer; single-column flow below 640 px.
- **Surfaces:** translucent panels with 1 px `line-soft` borders, inset top highlight, restrained
  radial glows, 64 px grid backdrop masked to the top of the page.
- **Components:** evidence badges, score rings with gradient stroke, module cards, metric strips,
  reading rows with provenance, progress bars, notes/callouts, empty states.
- **Motion:** 200–550 ms ease-out reveals, gradient sheen on the logo, animated scan status. All
  motion collapses under `prefers-reduced-motion`.
- **Interaction:** one-tap full scan with live progress and cancel; per-module runs; guided labs
  (screen overlay, touch grid); JSON export; print stylesheet for service centres.
- **Accessibility:** skip link, landmarks, `aria-current`, dialog semantics with Escape, keyboard
  operable patterns, focus-visible rings, no colour-only status (dot + text + label), 44 px targets.

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
  diagnostics/ module-card, module-header, module-result, run-module-button, metric-strip
  views/     dashboard, device, battery, storage, network, temperature, screen-lab, touch-lab,
             compatibility, performance, results, assistant
context/     diagnostic-provider.tsx
lib/
  types.ts modules.ts utils.ts scoring.ts recommendations.ts assistant.ts
  collect/{common,device,battery,storage,network,performance,temperature,screen,touch,compatibility}.ts
  guides/index.ts
```

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

## 8. Deployment readiness (Vercel)

| Item | State |
| --- | --- |
| Production build | Verified locally with `next build` |
| Runtime | Node.js route handlers; no edge-only APIs |
| Env vars | `NEXT_PUBLIC_SITE_URL` (metadata), optional `ASSISTANT_API_URL`, `ASSISTANT_API_KEY`, `ASSISTANT_MODEL`. See `.env.example` |
| Secrets | Only server-side; never referenced in client components |
| Security headers | nosniff, frame options, referrer policy, permissions policy, HSTS |
| SEO | Metadata templates, per-page descriptions, sitemap, robots, canonical guide URLs |
| Performance | Static-first pages; client islands only for diagnostic views; self-hosted fonts |
| Verification | **Local build + runtime verified. Live Vercel deployment has not been performed — do not claim it has.** |

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

---

## 10. Roadmap

**v1.0 — shipped (this build)**
Nine modules, evidence-labelled readings, weighted scoring, recommendations engine, guides library,
AI Brain (local engine + server extension point), JSON/print report, responsive shell, SEO,
methodology page.

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
