# Physical Android device — validation report

**Status: NOT RUN.** No physical phone has executed this build. Every result cell below is
`NOT RUN` until a tester fills it with something they actually observed.

This is the fill-in report. The step-by-step protocol lives in
[`docs/native/DEVICE-TEST-CHECKLIST.md`](../native/DEVICE-TEST-CHECKLIST.md); the source of every
metric is [`docs/native/METRIC-EVIDENCE-MATRIX.md`](../native/METRIC-EVIDENCE-MATRIX.md).

**Rule for whoever fills this in:** copy values verbatim from the app, `adb` or the router. Do not
write an expected value in a result cell. If a value was not obtained, write `unavailable` **and**
the reason the app showed.

---

## 0. Session metadata

| Field | Value |
| --- | --- |
| Tester | NOT RUN |
| Date / time (with timezone) | NOT RUN |
| Device manufacturer / model | NOT RUN |
| Android version / API level | NOT RUN |
| Build fingerprint (`adb shell getprop ro.build.fingerprint`) | NOT RUN |
| App version / versionCode | NOT RUN |
| APK source (CI run id or local build) | NOT RUN |
| APK SHA-256 (installed copy) | NOT RUN |
| Install method (`adb install` / sideload) | NOT RUN |
| SIM count / carriers | NOT RUN |
| Router model, firmware, band(s) | NOT RUN |
| Test server URL | NOT RUN |
| Network under test (Wi-Fi SSID / cellular carrier) | NOT RUN |

Commands used to fill the metadata:

```bash
adb shell getprop ro.build.fingerprint
adb shell getprop ro.build.version.release
adb shell dumpsys package app.phonecare.diagnostics | grep -E "versionName|versionCode"
adb shell pm path app.phonecare.diagnostics
adb shell dumpsys activity services app.phonecare.diagnostics   # expect: no services
```

---

## 1. Cellular metrics and evidence sources

Run: grant both permissions → tap **Read cellular now** → repeat 10× at ≥ 30 s intervals, standing
still. Copy one representative reading plus the spread.

| Metric (app id) | Source API | Expected sanity bound | Observed | Evidence label shown | Availability shown | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| LTE RSRP (`lte.rsrp`) | `CellSignalStrengthLte.getRsrp()` | −44 … −140 dBm | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| LTE RSRQ (`lte.rsrq`) | `CellSignalStrengthLte.getRsrq()` | −3 … −20 dB | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| LTE RSSNR (`lte.rssnr`) | `CellSignalStrengthLte.getRssnr()` | −20 … 30 dB | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| LTE RSSI (`lte.rssi`) | `CellSignalStrengthLte.getRssi()` (API 29+) | −20 … −113 dBm | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| LTE band (`lte.band`) | `CellIdentityLte.getBands()` (API 30+) | 1 … 71 (plausible for region) | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Timing advance (`lte.timing_advance`) | `CellSignalStrengthLte.getTimingAdvance()` | 0 … 1282 | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| 5G SS-RSRP (`nr.ss_rsrp`) | `CellSignalStrengthNr.getSsRsrp()` | −44 … −140 dBm | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| 5G SS-RSRQ (`nr.ss_rsrq`) | `CellSignalStrengthNr.getSsRsrq()` | −3 … −20 dB | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| 5G SS-SINR (`nr.ss_sinr`) | `CellSignalStrengthNr.getSsSinr()` | −20 … 30 dB | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| 5G PCI (`nr.pci`) | `CellIdentityNr.getPci()` | 0 … 1007 | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| In service (`net.in_service`) | `TelephonyManager.getServiceState()` | 1 with roaming context | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Data network type (`net.data_network_type`) | `TelephonyManager.getDataNetworkType()` | matches status bar RAT | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Dual SIM slots/carriers | `SubscriptionManager.activeSubscriptionInfoList` | both slots listed | NOT RUN | NOT RUN | NOT RUN | NOT RUN |

Cross-check (independent source, so the app is not grading itself):

```bash
adb shell dumpsys telephony.registry | grep -iE "mSignalStrength|mServiceState|mDataConnectionState"
```

**Record every `unavailable` with its reason.** Expected candidates: timing advance on most OEM
firmwares, NR metrics on LTE-only plans or NSA deployments, RSSI on API < 29, band on API < 30.

| Device-specific unavailability | Reason shown by the app |
| --- | --- |
| NOT RUN | NOT RUN |

---

## 2. Wi-Fi diagnostics

Connected-link only; the app does not scan.

| Check | Expected | Observed | Verdict |
| --- | --- | --- | --- |
| RSSI at 3 m from AP | −30 … −55 dBm | NOT RUN | NOT RUN |
| RSSI two rooms away | −65 … −80 dBm, lower than at 3 m | NOT RUN | NOT RUN |
| Band reported on 2.4 GHz SSID | `2.4 GHz`, frequency 2400–2500 MHz | NOT RUN | NOT RUN |
| Band reported on 5 GHz SSID | `5 GHz`, frequency 4900–5900 MHz | NOT RUN | NOT RUN |
| Link speed | plausible PHY rate (e.g. 433/866 Mbps) | NOT RUN | NOT RUN |
| SSID visible | shown when location granted | NOT RUN | NOT RUN |
| SSID with location denied | hidden + explicit note | NOT RUN | NOT RUN |
| Gateway matches router admin page | same IP | NOT RUN | NOT RUN |
| DNS servers match DHCP/router page | same resolvers | NOT RUN | NOT RUN |
| Gateway TCP probe | 1 (answered) or 0 + "inconclusive" wording | NOT RUN | NOT RUN |
| Wi-Fi off | `unsupported`, no invented values | NOT RUN | NOT RUN |
| Airplane mode | transport reported accurately, no crash | NOT RUN | NOT RUN |

---

## 3. Permission states

Reset between cases: `adb shell pm revoke app.phonecare.diagnostics android.permission.ACCESS_FINE_LOCATION`
(or Settings → Apps → PhoneCare → Permissions), or `adb shell pm clear app.phonecare.diagnostics`
for a full reset (this also deletes saved survey rooms).

| State | How created | Expected behaviour | Observed | Verdict |
| --- | --- | --- | --- | --- |
| Not requested | fresh install, first tap | rationale text before the system dialog | NOT RUN | NOT RUN |
| Granted | allow both | cellular card populated | NOT RUN | NOT RUN |
| Denied once | deny | message + manual path; no crash; app keeps working | NOT RUN | NOT RUN |
| Denied twice / "don't ask again" | deny twice | routed to app settings, no repeating dialog | NOT RUN | NOT RUN |
| Revoked in settings | grant, then revoke | permanent-denied path, readings empty with reason | NOT RUN | NOT RUN |
| Partial (location yes, phone state no) | revoke one | per-field reasons; no zeros | NOT RUN | NOT RUN |

Verify what Android actually recorded:

```bash
adb shell dumpsys package app.phonecare.diagnostics | grep -A12 "runtime permissions"
```

---

## 4. 4G/5G transitions

Walk or drive between coverage areas, or toggle the preferred network type in system settings
(Settings → Network → SIM → Preferred network type). Record each transition you actually saw.

| # | Time | RAT before | RSRP before | RAT after | RSRP after | NR metrics appeared? | Transition time | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| 2 | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| 3 | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |

| Expected behaviour | Observed |
| --- | --- |
| `rat` changes and the value updates (`LTE` ⇄ `NR`) | NOT RUN |
| With no NR cell, `nr.ss_rsrp` is `unsupported` with the NSA explanation, not `0` | NOT RUN |
| Values never carried over from the previous RAT as if current | NOT RUN |
| No crash during handover or RAT change | NOT RUN |

Known trap: NSA 5G commonly keeps `dataNetworkType = LTE` and reports no `CellInfoNr`; that is a
platform/OEM limitation, not an app error. Record it as `unavailable`, not as "no 5G".

---

## 5. Indoor versus outdoor survey

Protocol: 10 cellular readings outdoor, 10 indoor in the same building, then 3 quality samples per
room (score withheld until the third sample).

| Location | Type | Readings | RSRP median | SNR median | Notes |
| --- | --- | --- | --- | --- | --- |
| Outdoor (open sky view) | cellular | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Indoor, room 1 | cellular | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Indoor, room 2 | cellular | NOT RUN | NOT RUN | NOT RUN | NOT RUN |

| Survey check | Expected | Observed |
| --- | --- | --- |
| Room scores withheld before 3 samples | "score —, N samples" + confidence label | NOT RUN |
| Score appears after 3 samples | 0–100 with confidence | NOT RUN |
| Best/worst room tip appears | `room-gap` only when the delta is real | NOT RUN |
| Manual dBm typing is labelled as user input, not measured | evidence = `user` | NOT RUN |
| App restart keeps rooms and samples | rooms reload from app storage | NOT RUN |

Outdoor↔indoor delta is reported as a comparison, never as "signal improved by X dB" without the
noise band.

---

## 6. Stability after repeated tests

Run the quality test 10 times back-to-back (about 5–6 minutes) with the app in the foreground.

| Run | Completed? | Score | Median ms | Failure % | Crash/ANR? | UI still responsive? |
| --- | --- | --- | --- | --- | --- | --- |
| 1–10 | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |

| Check | Expected | Observed |
| --- | --- | --- |
| Double-tap **Run quality test** | "A measurement is already running…" — no overlapping runs | NOT RUN |
| Status shows run counter (`Run #n complete`) | increments once per completed run | NOT RUN |
| Rotate during a run | run survives (`configChanges`), no duplicate callbacks | NOT RUN |
| Press Back during a run, reopen app | no crash; monitor unregistered | NOT RUN |
| 10 runs in one session | memory stable, no ANR | NOT RUN |
| Crash log after the session | empty | NOT RUN |

```bash
adb logcat -b crash -d | grep -i phonecare
adb shell dumpsys meminfo app.phonecare.diagnostics | head -20
```

---

## 7. Battery and foreground-service behaviour

**Design facts (verifiable in the repo, not measured here):** the manifest declares no service, no
receiver, no `WAKE_LOCK`, no `FOREGROUND_SERVICE` permission. Collection happens only while a screen
is open and a button was pressed; nothing runs on a timer.

| Check | Command | Expected | Observed |
| --- | --- | --- | --- |
| No services exist | `adb shell dumpsys activity services app.phonecare.diagnostics` | `No services` | NOT RUN |
| No wakelocks held | `adb shell dumpsys power \| grep -i phonecare` | no entries | NOT RUN |
| No background CPU after leaving the app | `adb shell top -b -n 1 \| grep phonecare` | process idle/absent | NOT RUN |
| Battery delta over a 10-run session | reset → session → read | record actual mAh / %, do not estimate | NOT RUN |
| Doze behaviour with app closed | `adb shell dumpsys deviceidle` | app contributes nothing | NOT RUN |

```bash
adb shell dumpsys batterystats --reset
# … run the 10-test session (≈6 minutes, screen on) …
adb shell dumpsys batterystats app.phonecare.diagnostics | head -60
adb shell dumpsys batterystats | grep -iE "phonecare|uid " | head -20
```

Report the measured delta. Screen-on time dominates any realistic battery figure, so also record
the screen-on duration; a percentage without it is not interpretable.

---

## 8. Report interoperability

| Check | Expected | Observed |
| --- | --- | --- |
| Share JSON from the app | valid `phonecare.report/1` | NOT RUN |
| POST the JSON to `/api/reports` | `200` with normalised echo | NOT RUN |
| Remove `limitations` and POST | `422` with a JSON-pointer | NOT RUN |
| Values in the report match the screen | identical, including units | NOT RUN |

---

## 9. Verdict rules

The Android app may be called **device-validated** only when:

- [ ] Sections 1–7 are filled with observed values (or explicit `unavailable` + reason).
- [ ] Cellular values agree with `dumpsys telephony.registry` within ±5 dB.
- [ ] Denial and permanent-denial paths show reasons, never zeros.
- [ ] A 4G↔5G transition was captured at least once (or the device/plan cannot do 5G — recorded).
- [ ] Survey scores are withheld before 3 samples and appear afterwards.
- [ ] 10 consecutive runs with no crash, no ANR, no overlapping run.
- [ ] Battery delta recorded with screen-on duration; no services, no wakelocks.
- [ ] A report round-trips through `/api/reports` with 200.

Until then the status is **built and unit-verified, not device-validated**.
