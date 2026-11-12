# Phase 4 — real-device measurement plan

**Status: not executed.** This requires physical phones, an Android SDK build, and time in real
rooms. Nothing in this document is evidence yet; it is the protocol that produces evidence.

---

## 1. What must be true before Phase 4 starts

| Prerequisite | Status |
| --- | --- |
| Android app compiles (`./gradlew assembleDebug`) | ⛔ no JDK/SDK in the build environment |
| App installs on a physical device | ⛔ |
| Test server reachable from the phone (same deployment, HTTPS) | ✅ endpoints exist |
| Report JSON accepted by `POST /api/reports` | ✅ verified with a synthetic report |
| Rooms and router location chosen | ⬜ user decision |

Until all rows are ✅ or ⬜, Phase 4 cannot produce evidence and must not be reported as done.

## 2. Devices and settings to record

For each device, capture before measuring:

- manufacturer, model, Android version, build fingerprint, app version;
- SIM count, carrier(s), plan type (prepaid/postpaid), roaming state;
- Wi-Fi band and channel as shown in the router UI, router model and firmware;
- distance to the router and whether a wall/floor is between phone and router.

Do **not** record IMEI, phone number, MAC address, or Wi-Fi password.

## 3. Measurement protocol

### 3.1 Cellular, per location

1. Stand still for 30 s; screen on, no case covering the antenna.
2. Take 10 readings, ≥ 30 s apart (Android throttles cell queries).
3. Record RSRP, RSRQ, SINR/RSSNR, RAT, band, PCI, timing advance, service state.
4. Note `availability` for every missing value (permission, unsupported, transient).
5. Repeat with the phone on the other SIM if dual-SIM.

### 3.2 Cellular, window/balcony comparison

Same steps at: working position, window sill, balcony/outside. Same SIM, same time window
(within 10 minutes). Expected dB differences of 3–10 dB are meaningful; 1 dB is not.

### 3.3 Wi-Fi, per room

1. Run the quality test three times, ≥ 2 minutes apart.
2. Record RSSI, band, frequency, link speed, latency median/min, jitter, failures, throughput.
3. If RSSI is missing, mark it unavailable — do not estimate it from bars.

### 3.4 Wi-Fi Calling check

Only if the carrier supports it: note whether the toggle exists, whether it is enabled, and
whether calls route over Wi-Fi (carrier UI or in-call indicator). Never toggle it for the user in
the report — record what the user did.

### 3.5 Before/after change

One change at a time, e.g. router moved 2 m, band switched, channel changed, mesh node added.
Run the full protocol before and after, at the same time of day, same server. Then:

```
change is real only if |Δ| > 2 × combined uncertainty
otherwise record "no measurable change"
```

## 4. Evidence table (fill in per session)

| Session | Device | Android | Location | Transport | RSSI dBm | RSRP dBm | RAT | Latency med (ms) | Jitter (ms) | Failures % | Down (Mbps) | Up (Mbps) | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| _empty_ | | | | | | | | | | | | | |

Rules for this table:

- Every cell must come from a recorded report file; attach the JSON filename.
- `—` means the value was unavailable, never "approximately".
- The verdict is `improved`, `worse`, `no measurable change`, or `not comparable` (different server/time).
- A row without a timestamp is not evidence.

## 5. Indoor coverage study (Phase 5 extension)

Minimum design for a claim about a home:

- ≥ 5 rooms, ≥ 3 samples each, two sessions on different days;
- a router-position baseline plus at least one alternative position;
- report the median and spread per room, not a single reading;
- publish the layout sketch with distances, and the router model;
- state explicitly that results do not generalise to other homes.

## 6. What Phase 4 cannot prove

- That a carrier is "better" — one home and one plan are not a benchmark.
- That an app improves reception — only hardware placement or approved boosters can.
- That throughput equals plan speed — server distance and Wi-Fi overhead are included.
- That iOS behaves the same — it exposes no equivalent signal APIs.
