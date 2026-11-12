# Phase 1 — Research record: cellular, Wi-Fi and network measurement

Status: **complete for the web + Android scope**. Everything below is sourced from official
documentation or vendor/standards material; no claim here is inferred from PhoneCare's own code.

Date: 2026-11-09. Author: PhoneCare engineering.

---

## 1. Method

- Primary sources: Android platform reference, Apple developer documentation, IETF RFCs, ITU-T
  recommendations, browser specs (MDN/W3C).
- Secondary sources: vendor documentation of six network/diagnostic apps, used only to compare
  product scope and to check what those apps explicitly say they cannot do.
- Rule applied throughout: **a capability only enters the product if a documented API exposes it to
  the class of app we ship** (web page or normal Android app). Anything else becomes an
  "unavailable" state or a manual measurement.

---

## 2. Browser (current PhoneCare) — hard limits

| Data | Available? | Source / limit |
| --- | --- | --- |
| Round-trip latency | Yes, measured | `fetch()` timing against our own endpoint. Includes server processing. |
| Download/upload throughput | Yes, measured | Same-origin transfers. Capped by our server and by TCP window (RFC 6349 explains why a browser cannot see line rate). |
| Jitter | Yes, derived | Spread of repeated probe RTTs. Browser timers are coarse (≥ 5 ms in cross-origin isolated pages, worse without). |
| Packet loss | **No true packet loss** | The network layer is abstracted by TCP/QUIC; we can only count *failed probes*, which mixes loss, DNS failure and timeouts. |
| DNS resolution time | Partly | `PerformanceResourceTiming.domainLookupStart/End`; reported as 0 when DNS is cached or the entry is opaque. |
| Connection type (`4g`, `3g`) | Chromium only | Network Information API, coarse bucket, not a radio measurement. |
| Wi-Fi SSID / BSSID / RSSI / band | **No** | No web API. `navigator.connection` exposes nothing about the Wi-Fi link. |
| Cell ID, RSRP, RSRQ, SINR, band | **No** | No web API on any mobile browser. |
| Cellular vs Wi-Fi distinction | Approximate | `effectiveType` + `saveData`; no transport-type API. |

Consequence: the browser can measure **quality of the path to our server**, never **radio
conditions**. Any "signal bars" in a web page are decoration.

---

## 3. Android telephony — what a normal app can read

All values below require `ACCESS_FINE_LOCATION` for cell info and, depending on the field,
`READ_PHONE_STATE`.

| API | API level | Returns | Notes |
| --- | --- | --- | --- |
| `TelephonyManager.getAllCellInfo()` | 17 | List of `CellInfo` (serving + neighbours) | Requires `ACCESS_FINE_LOCATION` and `FEATURE_TELEPHONY_RADIO_ACCESS`; returns `CellInfo.UNAVAILABLE` for fields the modem hides |
| `CellSignalStrengthLte.getRsrp()` | 26 | dBm, −140…−43 | Reference signal received power |
| `CellSignalStrengthLte.getRsrq()` | 26 | dB | Reference signal received quality |
| `CellSignalStrengthLte.getRssnr()` | 26 | dB, −20…+30 | SINR proxy; not the same as true SINR |
| `CellSignalStrengthLte.getRssi()` | 29 | dBm, −113…−51 or unavailable | Legacy RSSI, often `UNAVAILABLE` on LTE |
| `CellSignalStrengthNr.getSsRsrp/getSsRsrq/getSsSsSinr` | 29 | dBm / dB | 5G NR SSB metrics via `CellInfoNr` |
| `CellSignalStrengthGsm.getRssi()` | 17 / 30 | dBm | 2G |
| `CellSignalStrengthWcdma.getDbm()` | 17 | dBm | 3G |
| `TelephonyManager.getDataNetworkType()` | 24 (per subId) | `NETWORK_TYPE_*` (LTE, NR, …) | Requires `READ_PHONE_STATE` |
| `TelephonyManager.getServiceState()` / `ServiceState` | 1 | In service / emergency / out of service, roaming | `READ_PHONE_STATE` + `ACCESS_COARSE_LOCATION` |
| `TelephonyManager.getSignalStrength()` | 28 | `SignalStrength` snapshot | Requires fine location on modern releases |
| `SubscriptionManager.getActiveSubscriptionInfoList()` | 22 | SIM slots, carrier name, MCC/MNC | `READ_PHONE_STATE`; dual-SIM = one entry per active subscription |
| `TelephonyCallback.SignalStrengthsListener` | 31 | Push updates | Replaces the deprecated `PhoneStateListener` |

Key constraints observed in the reference docs:

- Many fields are `CellInfo.UNAVAILABLE` on real devices — OEM/modem dependent, and 5G metrics
  frequently appear only on NSA/SA deployments that expose them.
- `getAllCellInfo()` may return an empty list under power saving or when location is switched off.
- Timestamps: `CellInfo.getTimeStamp()` exists but its clock source is not guaranteed to match
  `System.currentTimeMillis()`; PhoneCare therefore stamps its own `SystemClock.elapsedRealtime()`
  and wall-clock time at read time.
- Signal strength is **not** a data-quality guarantee: bars can be full on a congested cell
  (documented by nPerf's own product guidance).

## 4. Android Wi-Fi

| Data | API | Constraint |
| --- | --- | --- |
| Connected SSID/BSSID | `ConnectivityManager` + `NetworkCallback(FLAG_INCLUDE_LOCATION_INFO)` | `WifiManager.getConnectionInfo()` deprecated in API 31; SSID masked without location permission and location services on |
| RSSI of the connected link | `WifiInfo.getRssi()` (via transport info) or `NetworkCapabilities.getSignalStrength()` (API 29) | Location permission for the SSID-bearing object |
| Link speed | `WifiInfo.getLinkSpeed()` (Mbps, rounded) | Reported by driver; not throughput |
| Frequency / band | `WifiInfo.getFrequency()` (MHz) → 2.4/5/6 GHz | — |
| Nearby APs, channels | `WifiManager.getScanResults()` | `ACCESS_FINE_LOCATION` + `ACCESS_WIFI_STATE`; Android 13+ also `NEARBY_WIFI_DEVICES` for many APIs |
| Gateway / DNS reachability | No public API | Must be inferred with ICMP/TCP probes; ICMP is often blocked for apps |

No app can change the router's transmit power, channel or beamforming. Wi-Fi "booster" apps that
claim otherwise are measuring, not boosting.

## 5. iOS

- `CTCarrier` deprecated in iOS 16, static placeholders from the 16.4 SDK — carrier name, MCC/MNC
  unavailable for every app.
- `CTTelephonyNetworkInfo.serviceCurrentRadioAccessTechnology` still reports the radio access
  technology (LTE/NR) per service.
- **No public signal-strength API** (no dBm) on iOS, and no Wi-Fi RSSI/SSID API without the
  `NEHotspotNetwork` entitlement (which requires a special provisioning profile).
- No public API for cell identity.

Conclusion: **iOS stays a separate, future evaluation.** PhoneCare will not ship an iOS cellular
analyzer, and the web app must never imply one exists.

## 6. Wi-Fi Calling

- Toggled in the OS/carrier settings; no API to read or change it.
- Availability depends on carrier provisioning, device model and plan; it is not a signal booster.
- PhoneCare can only: (a) explain what Wi-Fi Calling does, (b) deep-link to the OS settings screen,
  (c) verify whether the call path improved by comparing measurements before/after.

## 7. Measurement standards adopted

| Standard | What we take from it |
| --- | --- |
| RFC 6349 (TCP throughput framework) | Throughput is limited by window/RTT, not line rate; measure each direction separately; **> 5 % loss or > 150 ms jitter makes throughput tests meaningless**; use minimum RTT as the baseline, not the first handshake sample |
| ITU-T Y.1541 (QoS classes) | Latency/jitter/loss thresholds for interactive video and VoIP; used to band results rather than invent a "quality score" |
| RFC 3550 (RTP) | Jitter as mean absolute deviation of inter-packet spacing, smoothed |
| ITU-T G.114 | One-way delay guidance (≤ 150 ms for most voice use) |

We deliberately do **not** claim RFC 6349 compliance: a browser cannot set window sizes, and a normal
Android app cannot guarantee path MTU or RWND either. We implement its *principles*: directional
tests, minimum-RTT baseline, sample counts, and a refusal to score when the link is unstable.

## 8. Competitor / adjacent product study

| Product | Platform | Strength | Documented weakness | What PhoneCare borrows |
| --- | --- | --- | --- | --- |
| Network Cell Info Lite | Android | Live RSRP/RSRQ, band, serving + neighbour cells, dual-SIM gauges | Ad-supported; cannot boost signal (its own description) | dBm-first presentation, dual-SIM structure, per-room logging |
| OpenSignal | Android + iOS | Crowd-sourced coverage maps, carrier comparison | Needs location; indoor readings change fast, single tests are noise | Multi-sample requirement, "one test is not a verdict" |
| nPerf | Android + iOS | Speed + browsing + streaming + latency, gap between bars and reality | Data-heavy tests; no radio internals | Test-size configurability, "bars ≠ quality" messaging |
| CellMapper | Android (+web) | Tower/sector/band maps, community data | Steep learning curve; data can be stale | Cell identity fields with explicit provenance |
| WiFiAnalyzer (VREM) | Android | Channel graph, best-channel suggestion, signal over time | Only usable with location on; no internet-quality view | Channel guidance text, “through router UI” framing |
| NetSpot | Desktop/mobile | Room-by-room heatmaps | Paid tiers, manual walking | Room survey model and heatmap idea |
| Speedtest (Ookla) | Android + iOS | Fast, well-instrumented throughput | Single test ≠ overall quality | Server identification, duration, jitter reporting |

Cross-cutting findings:

1. Every serious product reports **dBm with a source**, not bars.
2. None of them can improve radio conditions; the honest ones say so explicitly.
3. Indoor mapping is universally **manual** (walk the room) — no app can read a heatmap from one spot.
4. The single biggest trust failure in this category is presenting one speed test as "network health".

## 9. Indoor coverage — what actually helps

Evidence-based, non-magical interventions:

- Move the handset (window/balcony) — free, measurable, biggest effect.
- Wi-Fi: router placement (central, elevated, away from metal/water), 5 GHz for short range, 2.4 GHz
  for penetration, channel selection through the router UI, mesh node placement.
- Cellular: carrier Wi-Fi Calling, band/mode settings where the OS exposes them, an **approved**
  signal booster (fixed, licensed, installed by the carrier in many markets) — never software
  amplification.
- Structural: metalised windows/foil insulation and basement placement are physical blockers.

Legal/safety: consumer signal boosters are regulated (registration with the carrier in the US,
licence conditions elsewhere). PhoneCare will never instruct users to modify radio hardware or
install non-approved amplifiers.

## 10. Background execution (why monitoring is foreground-only)

- Android 14+ requires a declared foreground-service type for every FGS; `dataSync` requires
  `FOREGROUND_SERVICE_DATA_SYNC`, and Android 15 time-bounds it.
- Background starts are rejected unless an exemption applies (user-initiated, FCM, alarm…).
- Consequence: PhoneCare's survey and long measurements run **only while the app is in the
  foreground with a visible notification**, or in bounded user-initiated jobs. No always-on
  background telemetry — which also matches our privacy rule.

## 11. Sources

- Android — `CellSignalStrengthLte`: https://developer.android.com/reference/android/telephony/CellSignalStrengthLte
- Android — `CellSignalStrengthNr`: https://developer.android.com/reference/android/telephony/CellSignalStrengthNr
- Android — `TelephonyManager.getAllCellInfo()`: https://developer.android.com/reference/android/telephony/TelephonyManager
- Android — `WifiManager` (deprecation notes): https://developer.android.com/reference/android/net/wifi/WifiManager.html
- Android — Foreground service types: https://developer.android.com/about/versions/14/changes/fgs-types-required
- Android — `NetworkCapabilities.getSignalStrength()`: https://developer.android.com/reference/android/net/NetworkCapabilities
- Apple — `CTCarrier` deprecation: https://developer.apple.com/documentation/coretelephony/ctcarrier
- RFC 6349 — Framework for TCP Throughput Testing: https://www.rfc-editor.org/info/rfc6349/
- ITU-T Y.1541 — Network performance objectives: https://www.itu.int/rec/T-REC-Y.1541
- MDN — Network Information API: https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API
- MDN — `PerformanceResourceTiming` (DNS/TTFB phases): https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming
- Network Cell Info Lite (own description: cannot boost signal): https://apkpure.net/network-cell-info-lite-%E2%80%93-all-network-wifi-signal/vpn.network.cellinfolite.wifisignal.signalcheck.networkanalyzer.cellsignal
- Coverage-map comparison (OpenSignal / CellMapper / nPerf): https://simology.io/blog/coverage-map-tools-opensignal-cellmapper-nperf-how-read-them
- Wi-Fi analyzer comparison (no app increases signal): https://bestforandroid.com/wifi-signal-apps/
- Signal-strength app with RSRP bands and permission notes: https://github.com/gdincu/SignalStrength
