# PhoneCare for Android — native diagnostic app (prototype)

Kotlin app that reads what the web app cannot: cellular signal metrics, network type,
dual-SIM state and the connected Wi-Fi link. It emits the **same**
`DiagnosticReport` JSON as the website (`shared/diagnostics.schema.json`), so both
sides can be validated by `POST /api/reports`.

## Build status — read this first

**This code has not been compiled in the repository's build environment.** That
environment has no JDK, no Gradle and no Android SDK, and cannot download them.
The sources are written for review; nothing here has produced a measurement on a
real device.

To build and run it yourself:

```bash
cd native/android
# Requires JDK 17 and the Android SDK (compileSdk 35)
./gradlew assembleDebug        # wrapper is not committed; use your local Gradle 8.7+ once
./gradlew installDebug
```

If you do not have a `gradlew` wrapper, run `gradle wrapper --gradle-version 8.7`
once with a local Gradle installation, or open the folder in Android Studio
(which supplies its own Gradle and SDK).

## What it measures

| Metric | API | Permission | Notes |
| --- | --- | --- | --- |
| LTE RSRP / RSRQ / RSSNR / RSSI | `CellSignalStrengthLte` | `ACCESS_FINE_LOCATION` | API 26+ (RSSI 29+); modem may return `UNAVAILABLE` |
| 5G NR SS-RSRP / SS-RSRQ / SS-SINR | `CellSignalStrengthNr` | `ACCESS_FINE_LOCATION` | API 29+; absent on many OEM builds |
| Network type (2G–5G), roaming | `TelephonyManager.getDataNetworkType`, `getServiceState` | `READ_PHONE_STATE` + location | Reported by the OS, not inferred |
| Dual SIM carrier/slot | `SubscriptionManager` | `READ_PHONE_STATE` | |
| Wi-Fi RSSI, frequency/band, link speed | `NetworkCapabilities` / `WifiInfo` | `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE` | API 29+ for `getTransportInfo` |
| SSID | `WifiInfo.getSSID` | location services on | Masked to `unknown ssid` otherwise |
| Latency, jitter, DNS, throughput | `HttpURLConnection` | `INTERNET` | Same validity gates as the web engine |

**Not measured, by design:** packet loss (needs root/VPN), router transmit power,
channel utilisation of neighbouring networks (we do not run Wi-Fi scans), and
anything the modem does not expose. Missing values are `null` with an
`availability` reason — never a guess.

## Permissions

Requested at the moment a feature is activated, never at launch:

- **Location (`ACCESS_FINE_LOCATION`)** — required by Android for cell identity and
  SSID. PhoneCare does not request a location fix, does not store coordinates, and
  has no background location permission.
- **Phone state (`READ_PHONE_STATE`)** — carrier name, network type, SIM slots.
- **Wi-Fi state** — link RSSI/frequency.
- `NEARBY_WIFI_DEVICES` is declared with `neverForLocation` for Android 13+, but is
  only needed if a future version adds scanning; this prototype does not scan.

Denial paths are handled per feature: cellular card shows why it is empty and a
button to open app settings when the permission is permanently denied. Nothing
else in the app depends on it.

## Privacy

- No analytics, no accounts, no network calls except the throughput/latency test
  endpoints you configure.
- Reports are written to app-private storage and exported only when you tap export.
- No Wi-Fi passwords, no credentials, no location history.

## Package layout

```
app/src/main/java/app/phonecare/diagnostics/
├── MainActivity.kt
├── core/                 schema types + invariants
├── permissions/          rationale, request, permanent-denial handling
├── cellular/             TelephonyManager collector
├── wifi/                 ConnectivityManager collector
├── quality/              latency/jitter/DNS/throughput engine
├── survey/               room sessions (manual location only)
├── report/               JSON exporter matching the shared schema
└── ui/                   Compose screens
```

## Honest limitations

1. Signal values are modem-reported and vary by OEM and by which SIM is active.
2. `getAllCellInfo` may return stale data because Android throttles it for power.
3. Wi-Fi RSSI is quantised (often 3 dB steps) and is not a coverage map.
4. Throughput depends on the server you point the app at.
5. A phone cannot boost a signal. This app measures and explains; it never claims to
   amplify anything, and it never changes a setting for you.
