# Phase 2 — Network diagnostics specification

A measurement contract both apps implement. If a number cannot meet this spec, it is reported as
unavailable rather than approximated.

---

## 1. Metric definitions

| Metric | Definition | Unit | Method | Uncertainty we publish |
| --- | --- | --- | --- | --- |
| RTT (latency) | Time from request start to last byte of a 200-byte response, same origin | ms | N sequential probes; report **median** and **minimum** (minimum ≈ path RTT per RFC 6349 §3.2.1) | `±(p75 − p25)/2`, plus timer resolution (≥ 5 ms) |
| Jitter | Mean absolute difference between consecutive RTTs | ms | Same probe series (RFC 3550-style deviation) | `±` half of the sample MAD |
| Probe failure rate | Failed probes ÷ attempted probes | % | Any of timeout (2 s), TCP error, non-2xx | Reported as "probe failures", **never** called packet loss |
| DNS time | `domainLookupEnd − domainLookupStart` of the first probe | ms | `PerformanceResourceTiming` | `null` when the browser reports 0 (cached/opaque) |
| TTFB | `responseStart − requestStart` | ms | Same entry | `null` when unavailable |
| Download | Bytes received ÷ elapsed transfer time × 8 | Mbps | Random payload, 1/3/6 MB by connection hint, auto-retry at 8 MB when timed too short | `±` from two samples if the second is run |
| Upload | Bytes sent ÷ elapsed | Mbps | Random incompressible payload, 2 MB then 4 MB when fast | same |
| Stability | Coefficient of variation of repeated RTT series | % | 3 rounds ≥ 5 probes each | classified stable / variable / unstable |
| Cell RSRP/RSRQ/SINR | Modem-reported per serving cell | dBm / dB | `CellSignalStrengthLte` / `CellSignalStrengthNr` | 1 dB resolution; `unavailable` if `CellInfo.UNAVAILABLE` |
| Wi-Fi RSSI | Connected link RSSI | dBm | `NetworkCapabilities.getSignalStrength()` / `WifiInfo.getRssi()` | ≤ 3 dB quantisation on many OEM drivers |
| Wi-Fi band | Frequency → 2.4 / 5 / 6 GHz | — | `WifiInfo.getFrequency()` | — |
| Room score | Median of that room's probe results | 0–100 | See §4 | ± the spread of the samples; hidden if < 3 samples |

## 2. Sampling rules

1. **Never one sample.** Minimum 5 probes for latency, 3 rounds for stability.
2. Discard the first (cold connection) probe; record the discard in the raw data.
3. Report both **median** (typical) and **minimum** (best case) — a median alone hides congestion.
4. Timestamps in ISO 8601 UTC, plus `elapsedRealtime` on Android for monotonic ordering.
5. If the device is on a metered connection and the user enabled Data Saver, cap transfer at 1 MB
   and say so.

## 3. Validity gates

Per RFC 6349 §3, a throughput test on a broken link is meaningless. We refuse to score when:

| Condition | Behaviour |
| --- | --- |
| Jitter > 150 ms | Throughput shown, marked **unreliable**, module not scored |
| Probe failure rate > 5 % | Same as above; reason surfaced |
| Transfer finished under 8 ms | Reading suppressed (timer resolution) |
| Fewer than 3 successful probes | Latency reading `unavailable` |
| Page hidden (rAF throttled) | Frame-based metrics suppressed — never published |

## 4. Scoring (network quality index, 0–100)

Only applied when the validity gates pass.

```
quality = 0.45 × downloadScore + 0.25 × uploadScore + 0.20 × latencyScore + 0.10 × stabilityScore
```

| Band | Threshold |
| --- | --- |
| downloadScore | ≥ 50 Mbps → 95 · ≥ 20 → 85 · ≥ 8 → 70 · ≥ 2 → 55 · else 35 |
| uploadScore | ≥ 20 Mbps → 92 · ≥ 8 → 80 · ≥ 3 → 66 · ≥ 1 → 52 · else 38 |
| latencyScore | ≤ 40 ms → 94 · ≤ 80 → 84 · ≤ 150 → 70 · ≤ 300 → 52 · else 34 |
| stabilityScore | CV ≤ 10 % → 92 · ≤ 25 % → 74 · ≤ 50 % → 52 · else 30 |

Explicitly **not** claimed: this is not a carrier ranking, not a line-rate measurement, and not a
prediction of video quality. The UI must state the test server and duration next to the number.

## 5. Room score (survey)

For each room: `score = median(round probe scores)` with at least 3 samples.
Classification (cellular, per 3GPP-adjacent industry bands used by Network Cell Info and others):

| RSRP | Label |
| --- | --- |
| ≥ −80 dBm | Excellent |
| −90…−80 | Good |
| −100…−90 | Fair |
| −110…−100 | Weak |
| < −110 | Very weak |

Wi-Fi RSSI bands: ≥ −50 excellent · −60…−50 good · −70…−60 fair · −80…−70 weak · < −80 very weak.
These are **indicative**, not carrier guarantees.

## 6. Before/after comparison

```
Δ% = (after − before) / before × 100
significant if |Δ%| > 2 × combined uncertainty, otherwise "no measurable change"
```

The comparison must report: test server, both timestamps, sample counts, the delta with its
uncertainty band, and an explicit "no measurable improvement" outcome when the delta is inside noise.

## 7. Signal diagnosis logic (used by the triage engine)

Inputs: transport, cellular RSRP + RAT, Wi-Fi RSSI + band, latency/jitter/failure rate, DNS time,
per-room scores, and whether the device is roaming.

| Observation | Primary conclusion | Allowed next steps |
| --- | --- | --- |
| Wi-Fi RSSI < −75 dBm **and** cellular RSRP ≥ −95 dBm | Wi-Fi coverage problem (room-specific) | Move router / add mesh node / switch band; measure again |
| Wi-Fi RSSI ≥ −60 dBm **and** latency > 150 ms | Wi-Fi link fine; upstream (ISP/DNS/congestion) | Check DNS time, retest at another time, router reboot *then* measure |
| Cellular RSRP < −105 dBm | Weak cellular coverage | Window/balcony test, Wi-Fi Calling, carrier booster (approved) |
| RSRP strong but throughput low | Congestion or backhaul | Repeat test at different time; carrier ticket |
| Jitter > 60 ms with failures | Interference / handover instability | Change Wi-Fi channel, check for 2.4 GHz congestion |
| DNS time > 100 ms and TTFB normal | DNS latency | Try a DNS resolver change in router settings |
| Everything normal but user reports problems | Measurement window too short | Run a longer stability series |

No conclusion may be emitted without the readings that support it; unknown inputs downgrade the
output to "insufficient data" and list what is missing.

## 8. Acceptance criteria

- [x] Latency reports median + minimum + jitter + sample count + failure rate.
- [x] Every reading has `source`, `timestamp`, `evidence`, `availability`.
- [x] Throughput tests state server, size, duration and validity.
- [x] No packet-loss claim from browser data.
- [x] Survey stores ≥ 3 samples per room before scoring.
- [x] Before/after comparison refuses to claim improvement inside noise.
- [ ] Native: RSRP/RSRQ/SINR capture on real hardware (Phase 4).
- [ ] Native: Wi-Fi RSSI + band capture on real hardware (Phase 4).
