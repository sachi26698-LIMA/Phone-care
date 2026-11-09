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
| Compatibility | 36-point feature matrix for this browser | Hardware capability behind the browser |
| Performance | Frame cadence, compute index, browser storage speed | CPU usage %, GPU load, thermal state |

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
- `app/guides`, `app/methodology` — statically rendered content with sources.

## Privacy and security

- Diagnostics run on-device; readings are never uploaded.
- Scan results live in `localStorage` and can be cleared from the report page.
- No third-party analytics, ads, fonts or IP-lookup services.
- Security headers set in `next.config.ts`; API payloads capped; assistant proxy
  rate-limited and key-isolated on the server.

## Documentation

- [`AI_BRAIN.md`](./AI_BRAIN.md) — research log, competitor analysis, architecture
  decisions, QA results and roadmap.

## Verification

Checked against a local production build (`next build` + `next start`) driven by headless Chromium:

- full scan completes 7/9 modules (screen and touch are guided checks by design), health index
  **83 / 100 "Good"** at 41% evidence in that run;
- network module measured a real round-trip (9 ms, 1452.6 Mbps down, 154.3 Mbps up on loopback);
- 8/8 screen confirmations and a 40/40-zone touch trace persist across reloads;
- battery calibration yields an **estimated** 80% health from entered capacities;
- JSON report export, 404 routes, print layout and reduced-motion mode all verified;
- 320, 390, 820 and 1440 px with no horizontal overflow;
- API caps enforced (5 MB upload → 413, download capped at 8 MB, assistant POST → 501 without a key).

Numbers vary by machine and load. Full method, caveats and the one known transport artifact are in
[`AI_BRAIN.md` §7](./AI_BRAIN.md).

## Status

Production build verified locally; live Vercel deployment has **not** been performed.
