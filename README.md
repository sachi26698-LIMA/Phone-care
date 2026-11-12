# PhoneCare AI

A premium, browser-based smartphone diagnostics suite. Nine diagnostic modules, every
reading labelled by how it was obtained, and a local-first assistant that explains the
results without inventing data.

> **Truthfulness policy:** a browser cannot read battery temperature, cycle count, CPU
> heat or total disk usage. PhoneCare marks those as **Unavailable** rather than showing
> a plausible-looking number. Battery health is an explicit **estimate** from capacities
> you enter.

## What it does

| Module | What is genuinely measured | What is not |
| --- | --- | --- |
| Device identity | Platform, browser, screen geometry, DPR, GPU, memory class | Exact RAM, IMEI, panel revision |
| Battery & health | Live level, charging state, time estimates (Chromium) | Capacity, temperature, voltage, cycles |
| Storage | Origin quota/usage, persistence, browser storage footprint | Device disk usage (ask the user) |
| Network | Download, upload, latency, jitter against this site | Public IP, signal strength, packet loss |
| Thermal | Throttling signal under sustained load | Any temperature reading |
| Screen | Resolution, density, gamut, inferred refresh rate | Panel defects (confirmed by you) |
| Touch | Contact count, 40-zone coverage map | Raw pressure and digitiser accuracy |
| Compatibility | 37-point feature matrix for this browser | Hardware capability behind the browser |
| Performance | Frame cadence, compute index, browser storage speed | CPU usage %, GPU load, thermal state |

### Network lab (Phase 3)

Four additional pages under `/network` go beyond the single network module:

| Page | What it does |
| --- | --- |
| `/network` | Capability matrix: what the browser, Android and iOS can honestly read |
| `/network/quality` | 18 probes in three rounds, 3 MB download, 2 MB random upload, DNS + TTFB; median/min/jitter/failure rate with uncertainty; score withheld when jitter > 150 ms or failures > 5 % |
| `/network/survey` | Room-by-room survey (manual names, no location), minimum three samples per room, weak-spot ranking and optional user-entered dBm |
| `/network/troubleshoot` | Rule-based cause classification (Wi-Fi coverage, cellular coverage, congestion, DNS, instability) plus a noise-aware before/after comparison |

Reports follow the shared contract `shared/diagnostics.schema.json` and can be validated at
`POST /api/reports` (4 MB cap, no storage). Radio rows are present in web reports and are null with
`availability: unsupported` — the schema rejects any report that marks a null as measured.

## Design system

Premium **light** theme only: warm off-white canvas, white cards, soft warm shadows, charcoal
typography. Official palette — charcoal `#1A1A1F`, deep indigo `#2D2B55`, primary purple `#6A5ACD`,
lavender `#A678B9`, champagne `#F0D9B5`, amber `#F4A62A`. Purple is the primary action colour;
amber is reserved for important secondary actions and attention indicators. The only dark surface
is the full-screen display-test viewer, where true black is required to test a panel.

## Permissions

None are required. All nine modules run without a prompt, because the APIs they use need no grant.
Two optional permissions are offered with the reason shown before the request:

- **Persistent storage** (storage module) — keeps the saved report from being evicted.
- **Screen wake lock** (display test) — stops the screen sleeping while you inspect patterns.

Both handle granted, declined, blocked and unsupported states. No permission can unlock battery
health, temperature, cycle count or total disk usage — the app says so instead of pretending.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · lucide-react ·
self-hosted variable fonts. No database, no auth, no analytics, no third-party runtime calls.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
npm run typecheck    # strict TypeScript
npm run build        # production build
npm start            # serve the production build
```

Optional configuration lives in `.env.example`. The app is fully functional without any
environment variables; the assistant falls back to a deterministic local engine.

## Architecture

- `lib/collect/*` — the only place that touches browser APIs. Each collector returns a
  `ModuleResult` whose `readings[]` carry an `evidence` level (`measured`, `estimated`,
  `user`, `unavailable`), a source, and a plain-English explanation.
- `context/diagnostic-provider.tsx` — runs modules, tracks progress, persists results in
  `localStorage` under `phonecare.state.v1`.
- `lib/scoring.ts` — weighted health index over **scored** modules only; evidence coverage
  is reported separately.
- `lib/recommendations.ts` — traceable rules that cite their evidence and link to guides.
- `lib/assistant.ts` — deterministic local reasoning engine; `app/api/assistant` is an
  optional server-side proxy for a real model, gated by server-only env vars.
- `app/api/network/*` — capped, no-store endpoints for throughput measurement
  (8 MB download cap, 4 MB upload cap).
- `lib/diagnostic/*` — network measurement engines: `quality.ts` (probes/throughput/validity),
  `survey.ts`, `triage.ts`, `compare.ts`, `report.ts`, `schema.ts`, `capabilities.ts`.
- `shared/diagnostics.schema.json` — the contract shared with the Android app.
- `native/android/` — separate Kotlin app (radio, Wi-Fi, dual-SIM, survey, report export).
  **Compiles against `android.jar` API 35 and passes 27 engine checks; the APK has not been built**
  (no Android SDK/`d8`/`apksigner` in this environment — see `native/android/README.md` §1).
- `docs/native/` — research record, architecture and the network measurement specification.
- `app/network/*` and `components/network/*` — the network lab UI.
- `app/guides`, `app/methodology` — statically rendered content with sources.

## Privacy and security

- Diagnostics run on-device; readings are never uploaded.
- Scan results live in `localStorage` and can be cleared from the report page.
- No third-party analytics, ads, fonts or IP-lookup services.
- Content-Security-Policy, HSTS, frame, referrer and permissions policies set in
  `next.config.ts`; API payloads capped; assistant proxy rate-limited and key-isolated
  on the server. `npm audit --omit=dev` reports no vulnerabilities.

## Documentation

- [`AI_BRAIN.md`](./AI_BRAIN.md) — research log, competitor analysis, architecture
  decisions, QA results, compatibility matrix, security standards and roadmap.
- [`docs/DEVICE_TESTING.md`](./docs/DEVICE_TESTING.md) — real-device checklist and the
  results table to fill in per phone/browser.
- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) — Vercel setup, environment variables,
  post-deploy checks and rollback.
- [`docs/native/RESEARCH-NETWORK-CELLULAR.md`](./docs/native/RESEARCH-NETWORK-CELLULAR.md) —
  primary-source research: Android telephony/Wi-Fi APIs, iOS limits, standards, competitor review.
- [`docs/native/ARCHITECTURE.md`](./docs/native/ARCHITECTURE.md) — web/native split and contract.
- [`docs/native/NETWORK-SPEC.md`](./docs/native/NETWORK-SPEC.md) — metric definitions, validity
  gates, scoring and diagnosis rules.
- [`native/android/README.md`](./native/android/README.md) — Android build instructions,
  permissions and known limits.

## Verification

Checked against a local production build (`next build` + `next start`) driven by headless Chromium:

- full scan completes 7/9 modules (screen and touch are guided checks by design); without battery
  capacities or device storage totals the index is **88 / 100 "Provisional"** at 58% evidence — the
  ring is labelled provisional because only 42% of the scoring model can be verified;
- network module measured a real round-trip (9 ms, 1452.6 Mbps down, 154.3 Mbps up on loopback);
- 8/8 screen confirmations and a 40/40-zone touch trace persist across reloads;
- battery calibration yields an **estimated** 80% health from entered capacities;
- JSON report export, 404 routes, print layout and reduced-motion mode all verified;
- 320, 390, 820 and 1440 px with no horizontal overflow;
- 111 text nodes measured against WCAG 2.2 contrast (0 failures on the light theme);
- API caps enforced (5 MB upload → 413, download capped at 8 MB, assistant POST → 501 without a key).

Phase 2 added a four-profile automation matrix:

- desktop Chromium (real engine), Android-UA + touch emulation, iOS-UA emulation and a
  Firefox-UA run — the latter two are **layout evidence only**, not WebKit or Gecko;
- every profile: no horizontal overflow, no console errors, one `h1`, warm canvas
  `#FAF7F3`, screen overlay opens and closes on Escape, persistence and wake-lock
  states recorded;
- fallback paths forced by removing each API: battery → *Unsupported*, storage →
  *Unsupported here*, `persist()` false → *Declined*, `NotAllowedError` → *Blocked*,
  no wake lock → disabled request, stubbed grant → *Awake* then *released*;
- one real bug fixed: React hydration error #418 caused by reading
  `navigator.maxTouchPoints` during render (plus the battery badge disagreeing with
  its own readings).

Phase 3 added the network lab and the shared report contract:

- `npm run test:contract` — 46 assertions across schema invariants, probe statistics, comparison
  noise thresholds, triage rules, survey sample minimums and the report builder: **46 passed, 0 failed**;
- `POST /api/reports` accepts a valid Android-shaped report (200) and rejects a fabricated
  `null` + `measured` pair with a JSON-pointer error (422); bodies over 4 MB get 413;
- `tsc --noEmit` clean; production build serves 28 routes and 6 API routes.

The native Android app **compiles** (all 10 Kotlin files against `android.jar` API 35, zero
warnings) and its engine logic passes 27/27 desktop checks; its manifest and resources also link
with `aapt2`. It is **not built into an APK** here: this environment has no Android SDK, Gradle,
`d8` or `apksigner`, and Google Maven is unreachable. Radio, Wi-Fi and dual-SIM readings are
therefore untested on hardware, and the Phase 4 device table is still empty. Run
`native/android/build-local.sh` on a machine with JDK 17 + Android SDK and follow
`docs/native/DEVICE-TEST-CHECKLIST.md`.

Physical iOS/Android/Firefox runs are still pending — see
[`docs/DEVICE_TESTING.md`](./docs/DEVICE_TESTING.md). Numbers vary by machine and load. Full
method, caveats and the one known transport artifact are in [`AI_BRAIN.md` §7](./AI_BRAIN.md).

## Status

Production build verified locally; live Vercel deployment has **not** been performed.
Network lab verified in the browser build; native Android engine compiles and is unit-verified,
but no APK exists yet and nothing has run on a physical phone (`native/android/README.md`).
