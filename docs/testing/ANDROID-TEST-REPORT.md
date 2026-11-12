# Android application — test report

**Date:** 2026-11-09
**Commit:** `71bf5b5` (branch `arena/45529a28-phone-care`)
**Status:** sources compile, engine and unit logic verified locally; **APK not yet built**, CI
workflow written but **not yet run**, no device run.

No APK hash or "build passed" claim appears in this document until a build has actually produced
one and its hash is recorded.

## 1. What was executed here

The sandbox has no Android SDK, Gradle, `d8` or `apksigner`, and Google Maven is unreachable. The
following was nevertheless executed with tools obtained from npm/PyPI/GitHub:

| Check | Tool | Result |
| --- | --- | --- |
| All 10 Kotlin files compile | `kotlinc 2.4.21` + `android-35/android.jar`, `-jvm-target 17` | **exit 0, 0 warnings, 47 classes** |
| Engine behaviour | `verification/EngineChecks.kt` (desktop JVM) | **27 passed, 0 failed** |
| Unit tests | `SchemaInvariantTest` executed via a functional JUnit stub runner | **4 passed, 0 failed** |
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

## 4. CI build — configured, not yet run

`.github/workflows/android-debug-apk.yml`:

1. checkout → Temurin JDK 17 → `android-actions/setup-android@v3`;
2. install `platforms;android-35`, `build-tools;35.0.0`, `platform-tools`;
3. `gradle/actions/setup-gradle@v4` with Gradle 8.9;
4. `gradle testDebugUnitTest` → `gradle assembleDebug`;
5. verification that fails the job unless all of these hold:
   - APK exists; SHA-256 printed;
   - badging shows the expected package, `sdkVersion 26`, `targetSdkVersion 35`, the launcher activity;
   - `classes.dex` and `resources.arsc` are inside the archive;
   - `apksigner verify` reports **Verified using v2 scheme**;
6. uploads `phonecare-debug-apk` (APK + sha256 + badging + contents + signature) and the unit-test
   HTML report as artifacts (14-day retention). Nothing is published to releases.

The workflow only runs once it is pushed. Pushing is explicitly approval-gated, so the current
state is: **ready, unexecuted**.

## 5. Physical device testing

Not started — requires the APK. The full protocol is `docs/native/DEVICE-TEST-CHECKLIST.md`
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
