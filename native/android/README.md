# PhoneCare Android — native diagnostics

A single-Activity Android app that reads **real** modem and Wi-Fi values, runs a latency /
throughput / stability test against a server you control, and exports the result as a
`phonecare.report/1` document that the web app can validate.

The app uses **only the Android framework and the Kotlin standard library**. There is no Compose,
no AndroidX, no coroutines, no third-party runtime dependency. That keeps the APK small, the build
simple, and the permission story auditable.

---

## 1. What is verified, and what is not

Honesty first: this repository's CI-less environment has no JDK, Gradle, Android SDK, emulator or
device. Here is exactly what has been proven.

| Step | Status | Evidence |
| --- | --- | --- |
| All 10 Kotlin files compile against `android-35/android.jar` | ✅ | `kotlinc 2.4.21`, `-jvm-target 17`, exit 0, 47 classes, no warnings |
| Engine logic behaves as specified | ✅ | `verification/EngineChecks.kt` → `27 passed, 0 failed` |
| Manifest + resources + icon link into an APK shell | ✅ | `aapt2 2.20` link → `AndroidManifest.xml`, `resources.arsc`; badging shows package, min/target SDK, permissions, launcher activity, icon |
| `classes.dex` produced | ❌ | no desktop `d8` available offline |
| Signed, installable debug APK | ❌ | no `apksigner` / `zipalign`, no `d8` |
| Gradle build (`assembleDebug`) | ❌ | no Gradle, Android SDK, and `dl.google.com` / `repo.maven.apache.org` / `services.gradle.org` are unreachable here |
| Installed on a phone | ❌ | requires hardware |

So: **the code compiles and its logic is tested; the APK has not been built.** Nothing in this
folder should be described as a shipped app until `./build-local.sh` has produced and installed
one on your machine.

Re-run the verified parts at any time:

```bash
KOTLINC=/path/to/kotlinc \
ANDROID_JAR=$ANDROID_HOME/platforms/android-35/android.jar \
./verify-engine.sh
```

Expected tail:

```
native engine checks: 27 passed, 0 failed
OK: all sources compile; engine checks passed.
```

---

## 2. Layout

```
native/android/
├─ build-local.sh                 // preflight + assembleDebug + sha256 (+ optional adb install)
├─ verify-engine.sh               // desktop compile + engine checks (no SDK build tools needed)
├─ gradle/wrapper/…               // distributionUrl only; run `gradle wrapper` to generate the jar
├─ local.properties.example
├─ app/src/main/
│  ├─ AndroidManifest.xml         // permissions, single exported activity
│  ├─ res/values/{strings,themes}.xml
│  └─ java/app/phonecare/diagnostics/
│     ├─ MainActivity.kt          // framework Views: sections, buttons, status, report sharing
│     ├─ core/                    // schema types, Measurement, Availability, Evidence
│     ├─ permissions/             // rationale, request, permanently-denied handling, settings intents
│     ├─ cellular/                // TelephonyManager → CellSignalStrengthLte/Nr, SIM list
│     ├─ wifi/                    // ConnectivityManager/WifiManager → RSSI, link speed, band, gateway, DNS
│     ├─ quality/                 // HTTPS probes, throughput, DNS, gateway TCP probe, scoring
│     ├─ net/                     // ConnectivityMonitor (NetworkCallback transitions during a run)
│     ├─ optimization/            // Tips: deterministic guidance rules + explicit "limits" boundary
│     └─ survey/                  // rooms, repeated samples, median/confidence
├─ verification/EngineChecks.kt   // 27 desktop checks (no Android runtime needed)
└─ app/src/test/java/…/SchemaInvariantTest.kt
```

## 3. Configuration

| Setting | Value |
| --- | --- |
| `compileSdk` / `targetSdk` | 35 |
| `minSdk` | 26 (Android 8.0) |
| Java / Kotlin target | 17 / `2.0.21` |
| AGP | 8.7.3 |

`minSdk 26` is deliberate: it gives `NetworkCallback` capability reporting and avoids the older
`WifiManager.getConnectionInfo()` pitfalls that would force deprecated fallbacks.

## 4. Build it yourself

Prerequisites: **JDK 17+**, **Android SDK** with `platforms;android-35`, `build-tools;35.0.0`,
`platform-tools`, and **Gradle 8.9+** (or Android Studio, which provides all of it).

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
cd native/android
cp local.properties.example local.properties   # then set sdk.dir
./build-local.sh            # checks everything, builds app/build/outputs/apk/debug/app-debug.apk
./build-local.sh install    # same, then adb install -r
```

The script refuses to run with a readable message if anything is missing — it never pretends to
have built something. Without a wrapper (this repo does not commit `gradle-wrapper.jar`):

```bash
gradle wrapper --gradle-version 8.9   # once, needs network for the distribution
./gradlew assembleDebug
```

## 5. Install on a physical phone

1. Build the APK (above), or receive `app-debug.apk`.
2. On the phone: Settings → About phone → tap *Build number* 7× to unlock Developer options.
3. Enable *USB debugging*, connect the cable, accept the RSA fingerprint prompt.
4. `adb install -r app/build/outputs/apk/debug/app-debug.apk`
5. Launch: `adb shell am start -n app.phonecare.diagnostics/.MainActivity`

Sideloading without a cable works too (transfer the APK, allow "install unknown apps" for the file
manager). Debug builds are signed with a debug key: fine for testing, never for distribution.

The launcher icon is an adaptive vector (signal bars on a dark tile, `res/mipmap-anydpi-v26/`),
so the APK stays small and needs no raster assets. `minSdk 26` means no legacy `mipmap-*dpi`
fallback is required.

## 6. Permissions and what happens without them

| Permission | Used for | If denied |
| --- | --- | --- |
| `ACCESS_FINE_LOCATION` | required by Android to read cell identity/signal on modern versions | cellular card empty, reason shown; Wi-Fi/quality still work |
| `READ_PHONE_STATE` | SIM state, carrier, multi-SIM slots | SIM list limited; signal may still read |
| `ACCESS_NETWORK_STATE` | connectivity + `LinkProperties` (gateway, DNS) | gateway/DNS unavailable |
| `ACCESS_WIFI_STATE` | Wi-Fi link values | Wi-Fi card unavailable |
| `NEARBY_WIFI_DEVICES` (API 33+) | declared for future Wi-Fi detail work; **not requested today** because the app does not scan | no effect |
| `INTERNET` | quality probes and report sharing | quality test fails, clearly labelled |

Permanent denial is detected and routed to app settings instead of re-prompting forever. Every
measurement carries `availability` (`available`, `permission_denied`, `unsupported`, `transient`)
so a missing number is explainable rather than blank.

## 7. What the numbers mean — and do not

- RSRP/RSRQ/SINR are **modem-reported**, quantised, and throttled by Android; repeated reads can
  differ without anything changing.
- Wi-Fi RSSI is driver-quantised and describes phone↔AP, not the internet path.
- Probe failures are HTTP-level failures, not packet loss.
- Gateway probe = TCP connect attempt to 53/80/443. No answer proves only "no TCP service
  answered", never "the gateway is down".
- The link index is withheld when the sample is too small or too noisy; a score without a valid
  sample would be fiction.
- Throughput includes the distance to your test server; it is not an ISP benchmark.

## 8. Known limitations

1. No signed APK or device run has happened yet (see §1).
2. No 5G NSA/SA distinction beyond what `TelephonyManager` reports; `CellIdentityNr` band
   availability is OEM-dependent.
3. Timing advance is frequently `UNAVAILABLE`; it is reported as null, never guessed.
4. No Wi-Fi scanning, no channel-width/neighbour data — scanning needs location and looks like
   stalking to users; the app deliberately does not do it.
5. No background monitoring: all collection happens while a screen is open and a button was pressed.
6. No telephony API can increase transmit power or tower priority; the guidance says so explicitly.

## 9. Troubleshooting a local build

| Symptom | Cause | Fix |
| --- | --- | --- |
| `SDK location not found` | no `local.properties` / `ANDROID_HOME` | `cp local.properties.example local.properties`, set `sdk.dir` |
| `Unsupported class file major version` | JDK too new/old for AGP 8.7 | use JDK 17 |
| `Failed to find target android-35` | platform not installed | `sdkmanager "platforms;android-35"` |
| `Could not resolve org.jetbrains.kotlin…` | no network / blocked Maven | allow `repo.maven.apache.org` and `dl.google.com` |
| Compile error in `MainActivity.kt` | UI code is framework-only; check imports | the engine must never import `androidx.*` |
