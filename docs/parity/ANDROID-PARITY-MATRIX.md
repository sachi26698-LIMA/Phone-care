# Android ↔ Website parity matrix

Every website route has a native screen. "Implemented" means the screen exists, compiles and is
wired to real logic. Phase 7 added an automated walk (`native/android/ui-walk.py`) that opens every
screen on an Android 14 emulator, screenshots it and checks back navigation — see
`docs/testing/PHASE7-UI-VALIDATION.md`. **Physical-device verification is still NOT RUN** and is
tracked in `docs/testing/DEVICE-VALIDATION-REPORT.md`.

Legend for limitations: **API** = Android does not expose it; **WEB** = browser-only capability;
**NONE** = no known gap.

## 1. Routes → screens

| Website route | Android screen | Shared functionality | Native-only enhancement | Platform limitation | Test status |
| --- | --- | --- | --- | --- | --- |
| `/` | Dashboard (`Screen.DASHBOARD`) | module overview, last result, next steps | battery %, storage, thermal status, RSRP/RSSI at a glance | — | emulator PASS · physical **NOT RUN** |
| `/diagnostics` | Diagnostics hub | 8-module list with live summaries | hardware values per module | — | emulator PASS · physical **NOT RUN** |
| `/diagnostics/device` | Device identity | model/OS/screen | RAM, ABI, cores, uptime, security patch | WEB cannot read most of it | emulator PASS · physical **NOT RUN** |
| `/diagnostics/battery` | Battery & health | level, charging state | voltage, charge counter, current, health flag, temperature | WEB: Chromium only, no health/current | emulator PASS · physical **NOT RUN** |
| `/diagnostics/storage` | Storage | free space estimate | real `StatFs` totals per volume, cache size | WEB: quota only, not disk | emulator PASS · physical **NOT RUN** |
| `/diagnostics/network` | Network hub + Cellular/Wi-Fi | transport, latency hints | modem RSRP/RSRQ/SINR/band, Wi-Fi RSSI/link speed/gateway/DNS | WEB: no radio data at all | emulator PASS · physical **NOT RUN** |
| `/network/quality` | Internet quality | probes, transfers, validity, score | gateway TCP probe, transition counts | same server dependency | emulator PASS · engine 30/30 · physical **NOT RUN** |
| `/network/survey` | Indoor survey | rooms, 3-sample minimum, best/worst | optional typed dBm, native latency | — | emulator PASS · physical **NOT RUN** |
| `/network/troubleshoot` | Troubleshoot | full rule set + evidence lines | settings deep links, Wi-Fi Calling screen | WEB cannot open OS settings | emulator PASS · physical **NOT RUN** |
| `/network` | Network hub | browser/native capability framing | — | — | emulator PASS |
| `/diagnostics/temperature` | Temperature | honesty-first presentation | thermal status API 29+, battery temp, idle/power-save | API: no CPU die temperature; WEB: nothing | emulator PASS · physical **NOT RUN** |
| `/diagnostics/screen` | Display | resolution, colour tests | refresh rates, HDR types, physical size | WEB: no refresh/HDR list | emulator PASS · physical **NOT RUN** |
| `/diagnostics/touch` | Touch | pointer surface, max touch points | per-pointer trace on a native canvas | — | emulator PASS · physical **NOT RUN** |
| `/diagnostics/performance` | Performance | same "compare this device, not brands" framing | native integer loop, memory class, cores | numbers not comparable across platforms | emulator PASS · physical **NOT RUN** |
| `/diagnostics/compatibility` | Compatibility | feature list | 16 `PackageManager` features incl. telephony/NFC/Vulkan | WEB: detection by UA only | emulator PASS · physical **NOT RUN** |
| `/results` | Results | saved runs, export | on-device history, share sheet | WEB stores in localStorage | emulator PASS · physical **NOT RUN** |
| `/guides` + `/guides/[slug]` | Guides + Guide detail | **identical text** generated from `lib/guides/index.ts` | offline availability, in-app search | — | emulator PASS (list, search, detail) · content parity asserted by contract test |
| `/assistant` | Assistant | deterministic answers from measurements + guides | uses native readings | no language model on-device | emulator PASS · physical **NOT RUN** |
| `/methodology` | Methodology | evidence model, weights, limitations | native-vs-browser section | — | emulator PASS |
| — (no web equivalent) | Settings | test server, clear data, permissions | local preferences | WEB has no settings screen | emulator PASS |
| — (no web equivalent) | Privacy & permissions | permission states, never-read list | live grant/deny state, app-settings deep link | WEB cannot show OS permissions | emulator PASS |

## 2. Shared logic, one implementation per platform

| Concern | Website | Android | Kept in sync by |
| --- | --- | --- | --- |
| Report schema | `shared/diagnostics.schema.json`, `lib/diagnostic/schema.ts` | `core/DiagnosticSchema.kt`, `ReportBuilder.kt` | `npm run test:contract` (67 assertions) + `EngineChecks` (30) |
| Quality score weights | `lib/diagnostic/quality.ts` | `InternetQualityEngine.score()` | contract test compares Kotlin weights to `shared/design-tokens.json` |
| Stability noise floor (20 ms) | `quality.ts` | `InternetQualityEngine.stability()` | engine checks exercise the floor |
| Survey thresholds | `lib/diagnostic/survey.ts` | `SurveySession.classifyRsrp/Rssi` | contract test + engine checks |
| Guide text | `lib/guides/index.ts` | generated `content/Guides.kt` | contract test asserts slug + title parity |
| Design tokens | CSS variables | `ui/Theme.kt` | contract test asserts every palette hex + type scale |
| Evidence vocabulary | schema enum | `core/Evidence.kt` | contract test compares enums |
| Triage rules | `lib/diagnostic/triage.ts` | `optimization/Tips.kt` | engine checks (rule ids and ordering) |

## 3. Native advantages actually implemented

- Modem: LTE RSRP/RSRQ/RSSNR/RSSI/band/TA, 5G NR SS-RSRP/RSRQ/SINR/PCI, GSM/WCDMA, service state,
  dual-SIM carriers, RAT.
- Wi-Fi: RSSI, frequency/band, link speed, gateway, DNS resolvers, gateway TCP reachability.
- Network: transition counting during a run via `NetworkCallback`.
- Device: RAM, storage volumes, battery electricals, thermal status, refresh-rate modes, HDR types.
- Permissions: rationale, denial vs permanent denial, app-settings deep link.
- Reports: on-device history with share; identical schema to the website.

## 4. Deliberately absent (truthful alternatives instead)

| Not implemented | Why | What the screen does instead |
| --- | --- | --- |
| Signal boosting / TX power control | No public API; impossible without privileged access | explains it, links to carrier/placement guidance |
| CPU die temperature | Not exposed to apps | OS thermal status + battery temperature, labelled as such |
| Wi-Fi scan list / channel width | Needs location + scanning, which looks like tracking | connected-link metrics only, states why |
| Per-app storage or data usage | `UsageStats` needs special access | app-visible volumes only |
| Cloud sync of reports | Not a product goal; privacy-first | share sheet, user chooses destination |
| Language-model assistant on-device | Model size, no offline model | deterministic answers grounded in measurements |

## 5. Verification status

| Layer | Status |
| --- | --- |
| Kotlin compile (all sources, `android.jar` API 35) | ✅ 84 classes, 0 warnings |
| Engine checks | ✅ 27/27 |
| Unit tests (schema + engine) | ✅ 5 tests in CI |
| Contract/parity tests (web + parity) | ✅ 67/67 |
| APK build + badging/`classes.dex`/v2 signature | ✅ GitHub Actions |
| Screen-by-screen device walkthrough | ⛔ **NOT RUN** — see the device report |
| Screenshot comparison at equivalent sizes | ⛔ **NOT RUN** — requires a device/emulator |

## 3. How this matrix is enforced

| Check | What it proves | Where it runs |
| --- | --- | --- |
| `node scripts/parity-audit.cjs` | all 20 routes mapped, all 24 screens reachable, 6 API routes accounted for | CI, every push |
| `npm run test:contract` | palette, type scale, radius, guide text, weights, enum vocabulary identical | CI, every push |
| `native/android/verify-engine.sh` | 30 engine checks incl. guide search, scoring and triage rules | CI, every push |
| `native/android/ui-walk.py` | every screen opens, renders, goes back; permissions, full check, export, settings | CI, emulator job |

A screen existing is no longer the bar: the emulator job fails if a screen does not open, does not
render its title, or does not return to its hub.
