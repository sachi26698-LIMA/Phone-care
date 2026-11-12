# Android device test checklist

Use this **after** an APK exists: either the CI artifact `phonecare-debug-apk` from a green
`Android debug APK` run, or a local `native/android/build-local.sh` build. Every row is either
observed and copied verbatim, or marked `not run`. Do not fill a row from expectation.

Record per session: device model, Android version, build fingerprint, app version
(`adb shell dumpsys package app.phonecare.diagnostics | grep versionName`), date, and who ran it.

---

## 0. Before touching the phone

| Item | Check |
| --- | --- |
| APK obtained (CI artifact `phonecare-debug-apk` or a local `build-local.sh` run) | ⬜ |
| SHA-256 recorded and matched against `apk-sha256.txt` in the artifact | ⬜ |
| Same APK hash installed (`adb shell pm path` + pull-and-hash) | ⬜ |
| Test server reachable from the phone's browser (`/api/network/ping`) | ⬜ |
| Airplane mode **off**, battery saver **off**, VPN **off** | ⬜ |
| Phone case removed (cases with metal affect antennas) | ⬜ |
| Screen-on timeout ≥ 5 min (the quality test needs ~30 s) | ⬜ |

---

## 1. Emulator round (proves the app runs; proves nothing about radio)

An emulator has a synthetic modem and a virtual Wi-Fi stack: signal values are fixed or absent.

| # | Step | Expected | Emulator result |
| --- | --- | --- | --- |
| E1 | Install + launch, no permissions granted | Cellular card reads "not read yet"; no crash | ⬜ |
| E2 | Tap *Read cellular now*, deny | Rationale screen / denial message, card stays empty, app stays usable | ⬜ |
| E3 | Run quality test against the deployment | Latency/throughput values or an explicit failure reason | ⬜ |
| E4 | Rotate during a running test | Test continues or restarts cleanly; no crash | ⬜ |
| E5 | Add two rooms, measure each | Sample counts increase; score withheld until 3 samples | ⬜ |
| E6 | Share JSON report | Chooser opens with JSON text; paste into `/api/reports` → 200 | ⬜ |

Emulator cellular values must **not** be quoted as evidence of radio behaviour.

---

## 2. Physical phone — cellular

| # | Step | Expected | Observed (verbatim) |
| --- | --- | --- | --- |
| C1 | Grant location + phone state | SIM list populated, RAT shown | ⬜ |
| C2 | 10 readings, ≥ 30 s apart, standing still | RSRP varies within a plausible band; no impossible values (−44…−140 dBm) | ⬜ |
| C3 | Read once with location denied | `permission_denied` for cell fields, not zeros | ⬜ |
| C4 | Revoke location in Settings, reopen, read | Reason shown; no stale numbers reused | ⬜ |
| C5 | Walk from strong to weak coverage (window → interior) | RSRP drops monotonically-ish; RAT may fall to 3G/2G | ⬜ |
| C6 | Observe a 4G→5G or 5G→4G transition | `rat` changes; record both readings and elapsed time | ⬜ |
| C7 | Dual SIM: switch active data SIM, re-read | Slot/carrier labels follow the switch | ⬜ |
| C8 | Airplane mode on, read | `unsupported` / no service states, no crash | ⬜ |
| C9 | Airplane mode off, wait 30 s, read | Values return; old values not shown as current | ⬜ |

Sanity bounds (flag, do not silently accept): RSRP −44 to −140 dBm; RSRQ −3 to −20 dB;
SINR −20 to 30 dB; RSSI −20 to −113 dBm.

---

## 3. Physical phone — Wi-Fi

| # | Step | Expected | Observed |
| --- | --- | --- | --- |
| W1 | Connected to 2.4 GHz, read | band=frequency→2.4 GHz, RSSI plausible | ⬜ |
| W2 | Same spot, 5 GHz SSID, read | band=5 GHz, link speed differs | ⬜ |
| W3 | 3 m from router, then 2 rooms away | RSSI drops; gateway stays reachable or the probe says "inconclusive" | ⬜ |
| W4 | Wi-Fi off, read Wi-Fi | `unsupported`, no invented values | ⬜ |
| W5 | Check gateway/DNS against the router's admin page | Hosts match; DNS servers match DHCP | ⬜ |
| W6 | Run quality test on Wi-Fi, then on cellular | Both complete; transport labelled correctly | ⬜ |

The gateway TCP probe result **0** means "no TCP answer on 53/80/443" — write that, never "gateway
down".

---

## 4. Permission state matrix

| State | How to create | Expected behaviour |
| --- | --- | --- |
| Not asked | fresh install | rationale before the system dialog |
| Granted | allow | readings appear |
| Denied once | deny | message + manual path, app usable |
| Permanently denied | deny twice / revoke in settings | routed to app settings, no infinite dialog |
| Partial | location yes, phone state no | cellular partially populated, reason per field |

---

## 5. Connectivity stability

| # | Step | Expected |
| --- | --- | --- |
| S1 | Start quality test, then toggle Wi-Fi off mid-run | Run completes or fails with a reason; transition counted | ⬜ |
| S2 | Start test, enable airplane mode | Failure reason is explicit; no frozen UI | ⬜ |
| S3 | Walk out of Wi-Fi range during a run | Reconnect handled; counts include baseline callback | ⬜ |
| S4 | Screen off during run (if allowed) | Behaviour noted honestly | ⬜ |

Note: the monitor counts the initial callback for the already-connected network, so "transitions"
of 1 with 0 lost is normal and must not be reported as instability.

---

## 6. Indoor vs outdoor

| # | Step | Expected |
| --- | --- | --- |
| I1 | Outdoor, clear sky view, 10 cellular readings | Record as outdoor baseline | ⬜ |
| I2 | Indoor, same building, 10 readings | Compare RSRP/SINR deltas, not absolute bar counts | ⬜ |
| I3 | 3 rooms, 3 samples each (quality test) | Survey scores per room; confidence labelled | ⬜ |
| I4 | Repeat best room 3× within 10 min | Spread within noise band; otherwise flag instability | ⬜ |

---

## 7. Report interoperability

| # | Step | Expected |
| --- | --- | --- |
| R1 | Share JSON report | Valid `phonecare.report/1`, `schemaVersion` present | ⬜ |
| R2 | POST to `/api/reports` | `200` with normalized echo and warnings | ⬜ |
| R3 | Remove `limitations` and POST | `422` with a JSON-pointer path | ⬜ |
| R4 | Open the same report in the web app | Fields render; no browser values mixed in | ⬜ |

---

## 8. Exit criteria

The Android app may be called **operational** only when all of these hold:

- [ ] A locally built APK exists, with hash recorded and reproduced once.
- [ ] It launches without crash on at least one physical phone (Android 8+ and one 13+ ideal).
- [ ] Cellular readings match a reference (e.g. `*#*#4636#*#*` / another signal app) within ±5 dB.
- [ ] Denial paths produce explanations, never zeros.
- [ ] Quality test completes on both Wi-Fi and cellular.
- [ ] Report accepted by `/api/reports` with 200.
- [ ] Every table above has observed values, or an explicit "blocked by …" note.

Until then the correct status is: **compiles and unit-verified, not device-verified.**
