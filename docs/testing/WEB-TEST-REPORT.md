# Web application — test report

**Date:** 2026-11-09
**Commit:** `71bf5b5` (branch `arena/45529a28-phone-care`)
**Environment:** Linux sandbox, Node 22.22.3, Next.js 16.4.5, no Vercel deployment performed.
**Rule:** only commands that were actually executed are listed. Deployment is **not** verified.

## 1. Gate results

| Check | Command | Result |
| --- | --- | --- |
| TypeScript | `npx tsc --noEmit` | **0 errors** |
| Shared contract | `npm run test:contract` | **46 passed, 0 failed** |
| Production build | `npm run build` | **exit 0** — 33 route entries (27 pages + 6 API), 32 static pages generated |
| CI workflow | `.github/workflows/web-checks.yml` | written and YAML-validated locally; **not yet run on GitHub** (push awaits approval) |

Build routes: `/`, `/diagnostics/*` (10), `/network`, `/network/quality`, `/network/survey`,
`/network/troubleshoot`, `/guides`, `/guides/[slug]` (8 generated), `/methodology`, `/results`,
`/icon.svg`, `/robots.txt`, `/sitemap.xml`, plus `/api/{assistant,health,network/download,network/ping,network/upload,reports}`.

## 2. What the contract tests cover

`scripts/contract-test.cjs` (46 assertions) exercises the shared layer both apps depend on:

- schema invariants — `null` value must be `unavailable`, `measured` must have a value, closed enums;
- probe statistics — median excludes the cold probe, min/max, jitter, failure-rate arithmetic;
- comparison noise band — a change must exceed twice the combined uncertainty;
- triage/rules — which evidence allows which conclusion, and that no conclusion appears without it;
- survey thresholds — RSRP/RSSI band classification and sample minimums;
- report builder — `phonecare.report/1` shape, `limitations` required, JSON-pointer error paths.

These are the same definitions the Android app mirrors in Kotlin; the Android side is checked by
`native/android/verification/EngineChecks.kt` (27 checks) and the JUnit unit tests (4).

## 3. Browser/runtime behaviour verified earlier (Phase 3, commit `4d1fa18`)

Recorded in `AI_BRAIN.md` §12; not re-run in this round, so treat as dated evidence:

- headless Chromium sweep: 205 contrast samples / 0 failures, 0 console or page errors, no 320 px overflow;
- quality lab run: 94/100 index, 858.9 Mbps down, 134.7 up, 6 ms median, 0/18 failures;
- API matrix: valid report → 200, fabricated `null`+`measured` → 422, oversized body → 413, malformed → 400;
- known honest gaps: headless Chromium reports `requestStart`/`responseStart`/`domainLookup*` as 0,
  so DNS/TTFB render as "—" rather than invented numbers.

## 4. Vercel deployment readiness

| Item | Status |
| --- | --- |
| Framework detection | Next.js — zero-config, no `vercel.json` needed |
| Build command / output | `npm run build` / Next default `.next` |
| Node runtime | CI pins Node 22 (matches Vercel's default); `next@16` needs ≥ 20.9 |
| Lockfile | `package-lock.json` committed → reproducible `npm ci` |
| Required env vars | **none** |
| Optional env vars | `NEXT_PUBLIC_SITE_URL` (canonical URLs in metadata/sitemap, defaults to `https://phonecare.app`); `ASSISTANT_API_URL` + `ASSISTANT_API_KEY` + `ASSISTANT_MODEL` (AI assistant proxy; without them `/api/assistant` reports itself disabled and the UI falls back to rule-based triage) |
| Database / storage | none — reports are validated in memory and never persisted |
| Max request body | 4 MB enforced in `/api/reports` |

**Not done:** no deployment, no preview URL, no live smoke test. A Vercel link can only be claimed
after an approved deploy.

## 5. Deploy checklist (when approved)

1. `npm ci && npm run build` locally — already green.
2. Set `NEXT_PUBLIC_SITE_URL` to the production origin.
3. Deploy (Vercel dashboard or CLI); do not set `ASSISTANT_*` unless a provider is actually intended.
4. Smoke test: `/`, `/network/quality`, `/api/health`, `POST /api/reports` with a real Android report.
5. Re-run the browser sweep against the live origin; record the results here.
