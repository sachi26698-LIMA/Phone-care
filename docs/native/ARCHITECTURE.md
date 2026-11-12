# Architecture — web + native, one diagnostic contract

Status: **proposed and partially implemented**. The web app exists today; the Android app is a
Phase-3 prototype in `native/android/` that has **not been compiled** (no JDK/Android SDK in the
build environment).

---

## 1. Why two apps

| Capability | Browser | Android app |
| --- | --- | --- |
| Latency, throughput, jitter to a server | ✅ | ✅ |
| DNS resolution timing | partial | ✅ |
| Radio metrics (RSRP/RSRQ/SINR, band, cell id) | ❌ impossible | ✅ with permissions |
| Wi-Fi RSSI, band, link speed, channel survey | ❌ | ✅ with permissions |
| Room-by-room survey with automatic cell changes | ❌ | ✅ |
| Deep links into network/Wi-Fi Calling settings | ❌ | ✅ |
| Zero-install, cross-platform, private | ✅ | — |

A browser page that pretends to read signal strength is a lie. A native-only product loses the
zero-install audience. The split is therefore **by capability, not by preference**.

## 2. System map

```
┌─────────────────────────────┐        ┌──────────────────────────────────┐
│  Next.js web app            │        │  Android app (Kotlin)            │
│  /diagnostics/*             │        │  com.phonecare.diagnostics       │
│  - quality engine (HTTP)    │        │  - CellularCollector             │
│  - survey lab (manual)      │        │  - WifiCollector                 │
│  - Wi-Fi lab (guidance)     │        │  - InternetQualityEngine         │
│  - triage + before/after    │        │  - SurveySession (rooms)         │
│  - report viewer            │        │  - PermissionManager             │
└──────────┬──────────────────┘        └───────────────┬──────────────────┘
           │                                           │
           │  DiagnosticReport (JSON, schema v1)       │
           └──────────────┬────────────────────────────┘
                          ▼
        shared/diagnostics.schema.json  (single source of truth)
                          │
        ┌─────────────────┴──────────────────┐
        │ POST /api/reports (validate-only)  │  no storage, no accounts
        └────────────────────────────────────┘
```

Storage model: **local-first, no server state.** The web keeps reports in `localStorage`; Android
keeps them in app-private storage and exports JSON. `/api/reports` validates and echoes a normalized
report so the two apps can be tested against one contract without a database.

## 3. Shared schema (v1)

`shared/diagnostics.schema.json` is a JSON Schema (2020-12) for a `DiagnosticReport`:

```
report
├─ schemaVersion: "phonecare.report/1"
├─ id, generatedAt (ISO 8601), platform: "web" | "android"
├─ app: { name, version, build? }
├─ device: { manufacturer?, model?, osVersion?, sdkInt?, fingerprint? }
├─ session: { startedAt, durationMs, trigger: "manual" | "scheduled" | "survey" }
├─ network: { transport, carrier?, sims[], metrics[] }
├─ measurements[]        ← the unit that matters
└─ limitations[]         ← what this report cannot say
```

`measurements[]` entries are deliberately uniform so both apps speak the same language:

```json
{
  "id": "lte.rsrp",
  "label": "LTE RSRP",
  "value": -97,
  "unit": "dBm",
  "evidence": "measured",            // measured | estimated | user | unavailable
  "source": "TelephonyManager.getAllCellInfo → CellSignalStrengthLte.getRsrp()",
  "availability": "available",        // available | permission_denied | unsupported | transient
  "timestamp": "2026-11-09T10:12:04.120Z",
  "uncertainty": { "kind": "resolution", "value": 1, "unit": "dBm" },
  "sampleCount": 12,
  "context": { "simSlot": 0, "rat": "LTE", "band": 3 }
}
```

Rules encoded in the schema:

- `value` is **nullable** and must be `null` when `evidence` is `unavailable`.
- `unit` is a closed list (`dBm`, `dB`, `ms`, `Mbps`, `%`, `count`, `MHz`, `dBm/MHz`).
- `timestamp` is required; a reading without a time cannot be compared before/after.
- `availability` distinguishes "the phone cannot do this" from "you said no to the permission".
- `limitations[]` must be non-empty for cellular reports — every native report states that RSRP is
  modem-reported and that no browser or app can read the antenna's true state.

## 4. API contract

| Method | Path | Purpose | Notes |
| --- | --- | --- | --- |
| `POST` | `/api/reports` | Validate a report against the schema, return a normalized copy + issue list | 4 MB cap, no storage, `no-store` |
| `GET` | `/api/health` | Deployment probe | existing |

The web app never uploads a report automatically; the endpoint exists for the Android app (or a
user pasting JSON) to prove interop, and for future sync. Responses:

- `200` `{ ok: true, report, warnings }` — schema-valid.
- `422` `{ ok: false, errors[] }` with JSON-pointer paths — invalid.
- `413` — body too large.

## 5. Native module layout

```
native/android/app/src/main/java/app/phonecare/diagnostics/
├─ MainActivity.kt                 // Compose shell, permission prompts, run button
├─ core/DiagnosticSchema.kt        // Kotlin mirrors of the schema types
├─ core/Evidence.kt                // EvidenceLevel / Availability / Measurement
├─ permissions/PermissionManager.kt // rationale, request, denied/permanently-denied
├─ cellular/CellularCollector.kt   // TelephonyManager → measurements
├─ cellular/SimInfoProvider.kt     // dual-SIM metadata
├─ wifi/WifiCollector.kt           // ConnectivityManager/NetworkCallback → measurements
├─ quality/InternetQualityEngine.kt// latency/jitter/TTFB/DNS/throughput
├─ survey/SurveySession.kt         // rooms, repeatable samples, heatmap data
└─ report/ReportExporter.kt        // JSON export matching the shared schema
```

Every collector returns `List<Measurement>`; nothing throws when a field is missing — it returns an
`Availability` instead. That is the same rule the web engine uses.

## 6. Privacy model

- Web: everything in `localStorage`, no analytics, no third-party requests.
- Android: app-private storage, no analytics, no background collection, no upload without an
  explicit user action; location is used only to label a measurement, never stored as a track.
- Neither app collects Wi-Fi credentials, and neither can.
- Permissions are requested **at feature activation**, with a rationale first, and every feature has
  a manual/no-permission path (room names typed by the user instead of GPS; manual router guidance
  instead of Wi-Fi scanning).

## 7. Delivery phases

| Phase | Deliverable | Status in this commit |
| --- | --- | --- |
| 1 | Research + architecture (this folder) | ✅ docs |
| 2 | Network diagnostics specification | ✅ `NETWORK-SPEC.md` |
| 3 | Native Android prototype | ✅ source written, **not compiled** |
| 4 | Real-device measurements | ⛔ requires hardware — instructions in `docs/DEVICE_TESTING.md` |
| 5 | Indoor survey | ✅ web lab implemented; native session code written |
| 6 | AI troubleshooting engine | ✅ rule-based triage + before/after (web), spec for native |
| 7 | Website integration | ✅ shared schema, validator, `/api/reports`, labs linked |
| 8 | Security/performance testing | ⚠️ web: automated; native: blocked without SDK |
| 9 | Release readiness | ⛔ requires Phase 4 evidence |

## 8. What we will not build

- No "signal booster" feature, no claim of amplification.
- No iOS cellular analyzer (no API exists).
- No hidden background monitoring.
- No attempt to bypass carrier/OEM restrictions (no privileged APIs, no `MODIFY_PHONE_STATE`).
