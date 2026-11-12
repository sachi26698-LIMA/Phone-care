# Android application — test report

**Date:** 2026-11-09
**Commit:** `71bf5b5` (branch `arena/45529a28-phone-care`)
**Status:** the debug APK is **built and verified in CI**; engine and unit logic are verified
locally; **no physical device run yet**.

The APK was produced by GitHub Actions (run [43191694923](https://github.com/sachi26698-LIMA/Phone-care/actions/runs/43191694923)),
verified there by `aapt2` and `apksigner`, and uploaded as an artifact. It has **not** been installed
on a phone, and it cannot be downloaded into this sandbox (artifact storage host is unreachable
here), so its digest below is the one reported by CI, not one I recomputed locally.

## 1. What was executed here

The sandbox has no Android SDK, Gradle, `d8` or `apksigner`, and Google Maven is unreachable. The
following was nevertheless executed with tools obtained from npm/PyPI/GitHub:

| Check | Tool | Result |
| --- | --- | --- |
| All 10 Kotlin files compile | `kotlinc 2.4.21` + `android-35/android.jar`, `-jvm-target 17` | **exit 0, 0 warnings, 47 classes** |
| Engine behaviour | `app/src/test/.../verification/EngineChecks.kt` (desktop JVM + Gradle test) | **27 passed, 0 failed** |
| Unit tests (desktop) | schema tests executed via a functional JUnit stub runner | **4 passed, 0 failed** |
| Engine checks | `verify-engine.sh` after refactor into the test source set | **27 passed, 0 failed** |
| Unit tests (Gradle) | `gradle testDebugUnitTest` — now includes `EngineChecksTest` (27 checks) | **success** in CI, HTML report uploaded |
| APK build | `gradle assembleDebug` on the CI runner | **success** — `app-debug.apk`, 935,496 B |
| APK verification | `aapt2 dump badging`, `unzip -l`, `apksigner verify` on the runner | **success** — all assertions passed |
| Manifest + resources + adaptive icon | `aapt2 2.20` compile + link | exit 0; badging confirms package, minSdk 26, targetSdk 35, permissions, launcher activity, icon |
| Web contract still consistent with Kotlin types | `npm run test:contract` | 46 passed, 0 failed |

Reproduce the first two:

```bash
cd native/android
KOTLINC=/path/to/kotlinc \
ANDROID_JAR=$ANDROID_HOME/platforms/android-35/android.jar \
./verify-engine.sh
```

### Badging output (from the aapt2-linked shell, no dex)

```
package: name='app.phonecare.diagnostics' versionCode='1' versionName='0.1.0'
  compileSdkVersion='35'
minSdkVersion:'26'
targetSdkVersion:'35'
uses-permission: INTERNET, ACCESS_NETWORK_STATE, ACCESS_WIFI_STATE,
  ACCESS_FINE_LOCATION, READ_PHONE_STATE, NEARBY_WIFI_DEVICES
application: label='PhoneCare Diagnostics' icon='res/mipmap-anydpi-v26/ic_launcher.xml'
launchable-activity: name='app.phonecare.diagnostics.MainActivity'
uses-feature-not-required: android.hardware.telephony, android.hardware.wifi, android.hardware.location
```

## 2. Engine check detail (27)

Null-cannot-be-measured invariant; `Measurement.unavailable()`; report without `limitations`
rejected; median excludes the cold probe (50.0 from 90/50/40/60/50); minimum 40.0; jitter 13.333;
failure counting (2/3 → 67 %); stability labels (52/55/51 stable; 9/11/18 stable via the 20 ms
floor; 20/200/400 unstable); score withheld when `scored=false`, > 80 when valid; tip rules
(`wifi-weak` at −80 dBm, `upstream` at −52 dBm + 220 ms, `wifi-calling` at −112 dBm, `room-gap` at
90 vs 50, `no-fault` when healthy, `limits` always last); survey bands
(`classifyRsrp(-75)="Excellent"`, `-95="Fair"`, `-115="Very weak"`, `classifyRssi(-78)="Weak"`).

## 3. Unit tests (4)

`app/src/test/java/.../SchemaInvariantTest.kt`:

1. a measured value cannot be `permission_denied`;
2. a null value cannot be `transient`/measured;
3. `Measurement.unavailable()` yields `null` value + `UNAVAILABLE` evidence;
4. unit/availability JSON names match `shared/diagnostics.schema.json` (`dBm`, `dBm/MHz`, `permission_denied`).

They will run for real as `gradle testDebugUnitTest` in CI; the local run used a functional
stand-in for JUnit's `Assert` because `junit.jar` cannot be downloaded here.

## 3b. Pre-device hardening (bug fixes found while auditing for this validation round)

Auditing every metric against its API surfaced four real defects. All were fixed before device
testing begins, because each would have produced either a crash or a mislabelled reading:

| # | Defect | Consequence | Fix |
| --- | --- | --- | --- |
| 1 | `NetworkCapabilities.getSignalStrength()` was called without an API check | **crash on Android 8/9** (`NoSuchMethodError`), i.e. minSdk 26–28 | guarded by `SDK_INT >= Q`, with a documented fallback to `WifiInfo.getRssi()` |
| 2 | Invalid platform RSSI suppressed a valid `WifiInfo` value | valid RSSI shown as `unavailable` | platform value used only when inside −120…0, otherwise legacy value, and the `source` string says which |
| 3 | LTE timing advance was inside the API-30 band block | TA silently never read on Android 8–10 | moved out of the guard; still reported `unsupported` when the modem returns `UNAVAILABLE` |
| 4 | A non-NR serving cell on API 29+ produced no 5G row at all | missing row looked like "5G absent" without explanation | now emits `nr.ss_rsrp` as `unsupported` with the NSA explanation |

Also fixed while auditing: service state no longer requires location permission (only
`READ_PHONE_STATE`), its unavailable row uses the same metric id (`net.in_service`) as the available
one, `net.data_network_type` now emits a permission-denied row instead of nothing, `rsrpDbm` falls
back to NR SS-RSRP when the serving cell is 5G, and overlapping measurement runs are refused with an
explicit message (protects the repeated-test protocol).

## 4. CI build — executed successfully

Workflow: `.github/workflows/android-debug-apk.yml`. Latest run on `arena/45529a28-phone-care`:

- push run: [43191694923](https://github.com/sachi26698-LIMA/Phone-care/actions/runs/43191694923) — **success**
- pull-request run: [43191704293](https://github.com/sachi26698-LIMA/Phone-care/actions/runs/43191704293) — **success**
- every step green: checkout → JDK 17 → locate SDK → install `platforms;android-35` + `build-tools;35.0.0` → Gradle 8.9 → **unit tests** → **assembleDebug** → **verify** → upload

### Latest build with the hardening fixes

Run [43197869825](https://github.com/sachi26698-LIMA/Phone-care/actions/runs/43197869825) — **success**

| Field | Value |
| --- | --- |
| Unit tests | annotation reports **`tests=5 failures=0 skipped=0`** (4 schema tests + 1 test running the 27 engine checks) |
| APK | `app-debug.apk`, **936,592 bytes** |
| SHA-256 | `19a71bbf4361a3a1c85e864fe006e5f7d1f121c4d004527e57e5ef98110f94a2` |
| Node/governance | no merge or deploy performed for this round |

This is the APK to install for device validation: it contains the nine fixes listed in §3b.

### Earlier artifact

| Field | Value |
| --- | --- |
| Artifact | `phonecare-debug-apk` (artifact id 13930508447, 929,256 B zip, expires in 14 days) |
| Contains | `app-debug.apk`, `apk-sha256.txt`, `apk-badging.txt`, `apk-contents.txt`, `apk-signature.txt` |
| APK | `app-debug.apk`, **935,496 bytes** |
| SHA-256 | `b42e7cbfce4da5894a420dcbff493bd886961e46dd6191421e36a7fa2da33ff5` |
| Launcher | `app.phonecare.diagnostics.MainActivity` |
| minSdk / targetSdk | 26 / 35 |
| Signature | verified with APK Signature Scheme **v2** (debug key) |

**Download:** Actions run → *Artifacts* → `phonecare-debug-apk`. Compare the extracted APK's
`sha256sum` with the value above before installing.

Caveat: the debug keystore is generated on the runner, so a later run produces a *different*
signature and therefore a different SHA-256. This digest identifies this artifact only.

Confirmed by the follow-up documentation run ([43192155288](https://github.com/sachi26698-LIMA/Phone-care/actions/runs/43192155288)):
same 935,496-byte APK, different digest
`643ad620e1b6f8b325fb97313af41d4e37b4ed115f2f452e3d0ef631fda7354c`. Always read `apk-sha256.txt`
from the artifact you actually downloaded.

### Why this failed three times before passing

| Run | Failure | Fix |
| --- | --- | --- |
| 43190383805 | `android-actions/setup-android@v3` step failed | dropped the action; locate the preinstalled SDK and use `sdkmanager`, with a Google cmdline-tools fallback |
| 43190571657 | APK built, verification failed with no readable log | assertions rewritten to fail with `::error::` annotations carrying the real badging output |
| 43190944392 | annotation revealed the key is `minSdkVersion:'26'` | pattern corrected (the old one used a lowercase `s`) |

Logs themselves are not fetchable from this sandbox (Actions log storage host is unreachable), so the
workflow was made self-describing: every verification failure emits an annotation with the offending
line, and pass/fail is readable through the API.

## 5. Physical device testing

Not started. The APK now exists, so this is the first blocking item. The full protocol is `docs/native/DEVICE-TEST-CHECKLIST.md`
(emulator smoke round, cellular incl. 4G↔5G transitions and dual SIM, Wi-Fi bands and gateway/DNS,
permission matrix, connectivity transitions, indoor/outdoor, repeatability, report interop).
Emulator results may never be quoted as radio evidence.

## 6. Known limitations (unchanged)

- Modem values are OEM-dependent, quantised and throttled; timing advance is often `UNAVAILABLE`
  and is reported as null.
- No Wi-Fi scanning, no channel width, no neighbour data — by design.
- Gateway probe failure means "no TCP answer", never "gateway down".
- Probe failures are HTTP-level, not packet loss.
- No telephony API can raise transmit power; the guidance says so explicitly.
