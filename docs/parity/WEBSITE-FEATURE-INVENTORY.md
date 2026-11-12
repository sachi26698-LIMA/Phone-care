# Website feature inventory

Produced by walking the actual tree (`app/`, `components/`, `lib/`), not from memory.
Every route below exists in the repository at the time of writing; nothing is aspirational.

**Route count:** 20 static/dynamic pages + 6 API routes = 26 route entries (the build reports 33
because `/guides/[slug]` expands to 8 static paths).

---

## 1. Routes

| # | Route | File | Purpose |
| --- | --- | --- | --- |
| 1 | `/` | `app/page.tsx` | Dashboard: module grid, run-scan entry, latest results |
| 2 | `/diagnostics` | `app/diagnostics/page.tsx` | Diagnostics hub listing every module |
| 3 | `/diagnostics/device` | `app/diagnostics/device/page.tsx` | Device identity |
| 4 | `/diagnostics/battery` | `app/diagnostics/battery/page.tsx` | Battery level, charging, health, temperature (Chromium-only) |
| 5 | `/diagnostics/storage` | `app/diagnostics/storage/page.tsx` | Storage estimate + persisted readings |
| 6 | `/diagnostics/network` | `app/diagnostics/network/page.tsx` | Network Information API summary |
| 7 | `/diagnostics/performance` | `app/diagnostics/performance/page.tsx` | JS compute, memory hints, frame timing |
| 8 | `/diagnostics/screen` | `app/diagnostics/screen/page.tsx` | Display geometry, colour/gradient tests |
| 9 | `/diagnostics/touch` | `app/diagnostics/touch/page.tsx` | Pointer test surface |
| 10 | `/diagnostics/temperature` | `app/diagnostics/temperature/page.tsx` | Thermal status where exposed; honesty page otherwise |
| 11 | `/diagnostics/compatibility` | `app/diagnostics/compatibility/page.tsx` | Feature detection matrix |
| 12 | `/network` | `app/network/page.tsx` | Capability matrix: browser vs Android vs iOS |
| 13 | `/network/quality` | `app/network/quality/page.tsx` | Latency, jitter, throughput, stability, score |
| 14 | `/network/survey` | `app/network/survey/page.tsx` | Indoor room-by-room survey |
| 15 | `/network/troubleshoot` | `app/network/troubleshoot/page.tsx` | Rule-based triage + before/after |
| 16 | `/results` | `app/results/page.tsx` | Saved reports, schema validation |
| 17 | `/guides` | `app/guides/page.tsx` | Guide list |
| 18 | `/guides/[slug]` | `app/guides/[slug]/page.tsx` | 8 guides, statically generated |
| 19 | `/assistant` | `app/assistant/page.tsx` | Deterministic assistant + optional proxied model |
| 20 | `/methodology` | `app/methodology/page.tsx` | Evidence model, scoring, privacy, limitations |

API routes: `/api/health`, `/api/assistant`, `/api/network/ping`, `/api/network/download`,
`/api/network/upload`, `/api/reports`.

---

## 2. Modules and shared engines

| Module | Engine (`lib/`) | Collector (`lib/collect/`) | Notes |
| --- | --- | --- | --- |
| Device | `types.ts` | `device.ts` | UA, platform, screen, hardwareConcurrency |
| Battery | — | `battery.ts` | Chromium Battery Status API only |
| Storage | — | `storage.ts` | `storage.estimate()`; quota ≠ free disk |
| Network | `diagnostic/quality.ts` | `network.ts` | Effective type, downlink, RTT hints |
| Performance | `scoring.ts` | `performance.ts` | JS compute + memory hints |
| Screen | — | `screen.ts` | Geometry, colour depth, DPR |
| Touch | — | `touch.ts` | Pointer events, maxTouchPoints |
| Temperature | — | `temperature.ts` | No browser API; honesty module |
| Compatibility | `diagnostic/capabilities.ts` | `compatibility.ts` | Feature matrix |
| Quality | `diagnostic/quality.ts` | — | Probes, transfers, validity, score |
| Survey | `diagnostic/survey.ts` | — | Rooms, medians, confidence |
| Triage | `diagnostic/triage.ts` | — | Deterministic rules |
| Comparison | `diagnostic/compare.ts` | — | Noise band before/after |
| Reports | `diagnostic/report.ts`, `schema.ts`, `store.ts` | — | `phonecare.report/1` |
| Assistant | `assistant.ts`, `recommendations.ts` | — | Local rules + optional server model |
| Guides | `guides/index.ts` | — | 8 articles, shared with Android |

## 3. UI components

| Area | Components |
| --- | --- |
| Layout | `layout/app-shell`, `layout/run-scan-button` |
| UI kit | `ui/card`, `ui/button`, `ui/badge`, `ui/evidence-badge`, `ui/field`, `ui/icon`, `ui/misc`, `ui/readings`, `ui/score-ring` |
| Diagnostics | `diagnostics/module-card`, `module-header`, `module-result`, `run-module-button`, `metric-strip`, `storage-persistence`, `wake-lock` |
| Views | `views/dashboard-view`, `device-view`, `battery-view`, `storage-view`, `network-view`, `performance-view`, `screen-lab`, `touch-lab`, `temperature-view`, `compatibility-view`, `results-view`, `assistant-view` |
| Network | `network/network-nav`, `quality-lab`, `survey-lab`, `troubleshoot-lab` |

## 4. Workflows

1. **Scan** — `/` → run scan → each module writes a reading → `/results` summary.
2. **Single module** — `/diagnostics/*` → run → evidence-labelled result, persisted per module.
3. **Quality test** — `/network/quality` → probes + transfers → validity gates → score or withheld.
4. **Survey** — `/network/survey` → rooms → 3 samples → room score + best/worst.
5. **Troubleshoot** — `/network/troubleshoot` → rules fire only on present readings → before/after compare.
6. **Report** — `/results` → JSON → paste into `/api/reports` for validation.
7. **Assistant** — `/assistant` → question → rule-based answer (+ optional proxied model).
8. **Read a guide** — `/guides` → article → sources.
9. **Understand the method** — `/methodology` → evidence, weights, privacy.

## 5. States that must exist on both platforms

| State | Website implementation |
| --- | --- |
| Loading | run buttons + disabled state, progress text |
| Empty | "run a scan first" panels |
| Unsupported | explicit module state (temperature, iOS battery) |
| Permission denied | not applicable (browser prompts are implicit) — replaced by unavailable |
| Error | fetch/transfer failure surfaced with a reason |
| Result | evidence badge + source per metric |
| Export | copy/download JSON |
