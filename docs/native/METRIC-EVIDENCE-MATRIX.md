# Metric → API → evidence matrix

Every number the Android app can show, where it comes from, and what it means when it is missing.
This is the audit trail for claims like "LTE RSRP: −97 dBm": the value must exist, and the API that
produced it must be the one listed here.

**Rules that apply to every row**

1. `null` value ⇒ the reading was **not** obtained. The row still exists, with an `availability`
   reason. A missing metric never becomes `0`, `-1` or an estimate.
2. `evidence = measured` only when the platform API returned a usable value.
3. `evidence = user` when a human typed the number (survey dBm input).
4. `evidence = unavailable` + `availability ∈ {permission_denied, unsupported, transient}` otherwise.
5. Browser readings never appear in this table. The web app cannot read any of it.

---

## 1. Cellular

| id | Label | Unit | API | Min API | Notes / honesty limits |
| --- | --- | --- | --- | --- | --- |
| `lte.rsrp` | LTE RSRP | dBm | `CellSignalStrengthLte.getRsrp()` | 17 | Modem-reported, 1 dB quantisation, `UNAVAILABLE` when the modem hides it |
| `lte.rsrq` | LTE RSRQ | dB | `CellSignalStrengthLte.getRsrq()` | 17 | Negative dB; wide device-to-device spread |
| `lte.rssnr` | LTE RSSNR | dB | `CellSignalStrengthLte.getRssnr()` | 26 | An **estimate** of SINR computed by the modem; may be `UNAVAILABLE` on 5G NSA |
| `lte.rssi` | LTE RSSI | dBm | `CellSignalStrengthLte.getRssi()` | 29 | Wider-range legacy metric; not comparable to RSRP |
| `lte.band` | LTE band | count (EARFCN band number) | `CellIdentityLte.getBands()` | 30 | First reported band only; no EARFCN, no channel width |
| `lte.timing_advance` | Timing advance | count | `CellSignalStrengthLte.getTimingAdvance()` | 17 | Frequently `UNAVAILABLE`; reported as null, **never** as 0 |
| `lte.pci` (context of band) | PCI | count | `CellIdentityLte.getPci()` | 30 | Included as context, not as a separate metric |
| `nr.ss_rsrp` | 5G NR SS-RSRP | dBm | `CellSignalStrengthNr.getSsRsrp()` | 29 | Per-cell, not per-beam; NSA devices may expose no NR cell at all |
| `nr.ss_rsrq` | 5G NR SS-RSRQ | dB | `CellSignalStrengthNr.getSsRsrq()` | 29 | Often `UNAVAILABLE` in NSA mode |
| `nr.ss_sinr` | 5G NR SS-SINR | dB | `CellSignalStrengthNr.getSsSinr()` | 29 | Often `UNAVAILABLE`; never derived from LTE RSSNR |
| `nr.pci` | 5G NR PCI | count | `CellIdentityNr.getPci()` | 29 | Identity only, no gNB ID exposed |
| `gsm.rssi` | GSM RSSI | dBm | `CellSignalStrengthGsm.getDbm()` | 17 | Legacy RAT; declining network availability |
| `wcdma.rscp` | WCDMA RSCP | dBm | `CellSignalStrengthWcdma.getDbm()` | 30 | On API 26–29 this is reported `unsupported`, not guessed |
| `net.in_service` | In service | count (1/0) | `TelephonyManager.getServiceState()` | 17 | Requires `READ_PHONE_STATE`; context carries state + roaming |
| `net.data_network_type` | Data network type | count (`NETWORK_TYPE_*`) | `TelephonyManager.getDataNetworkType()` | 24 | Numeric; the `rat` context carries the name. NSA 5G often reports `LTE` |
| `net.internet_capability` | Internet capability | count (1/0) | `NetworkCapabilities.NET_CAPABILITY_INTERNET` | 23 | OS belief, not a test |
| `net.internet_validated` | Internet validated | count (1/0) | `NET_CAPABILITY_VALIDATED` | 23 | `0` often means a captive portal |

**Permissions:** `ACCESS_FINE_LOCATION` gates cell identity and signal (`getAllCellInfo`);
`READ_PHONE_STATE` gates service state, data network type and subscriptions.

**Dual SIM is partially accessible.** `SubscriptionManager.activeSubscriptionInfoList` gives slots,
carriers and per-slot `dataNetworkType` (via `createForSubscriptionId`). `getAllCellInfo()` returns a
flat list of cells with no reliable slot attribution, so the app does **not** claim per-SIM signal.
The checklist verifies the slot/carrier/RAT part only.

---

## 2. Wi-Fi

| id | Label | Unit | API | Min API | Notes / honesty limits |
| --- | --- | --- | --- | --- | --- |
| `wifi.rssi` | Wi-Fi RSSI | dBm | `NetworkCapabilities.getSignalStrength()` (29+), else `WifiInfo.getRssi()` | 26 | Driver quantisation is often 3 dB; describes phone↔AP only |
| `wifi.frequency` | Wi-Fi frequency | MHz | `WifiInfo.getFrequency()` | 21 | Band is derived (`2.4 GHz`, `5 GHz`, `6 GHz`); channel is not exposed |
| `wifi.link_speed` | Wi-Fi link speed | Mbps | `WifiInfo.getLinkSpeed()` | 1 | Negotiated PHY rate, **not** internet throughput |
| `wifi.ssid` | SSID (context, not a metric) | — | `WifiInfo.getSSID()` | 1 | Masked without location; API 33+ also wants `NEARBY_WIFI_DEVICES`, which this build declares but never requests |
| `wifi.gateway_tcp` | Gateway TCP probe | count (1/0) | raw `Socket` to the `LinkProperties` default gateway on 53/80/443 | 26 | `0` = no TCP answer; it does **not** prove the gateway is down |
| `net.dns.lookup_time` | DNS lookup time | ms | `InetAddress.getAllByName` | 1 | System resolver only; no custom resolver |
| `net.connectivity_events` | Network transitions | count | `ConnectivityManager.NetworkCallback` | 24 | First callback describes the already-connected network |

**Not readable from an app (and never faked):** AP transmit power, channel width, noise floor,
neighbour-AP list, per-SSID contention, DHCP lease details, router CPU, WAN status. A network scan
could reveal some of these but requires location access, is throttled, and looks like tracking —
this build deliberately does not scan.

---

## 3. Quality / throughput

| id | Label | Unit | Method | Notes |
| --- | --- | --- | --- | --- |
| `net.latency.median` | Median RTT | ms | HTTPS probe series against the configured server | Median excludes the cold first probe |
| `net.latency.jitter` | Jitter | ms | Mean absolute difference of consecutive RTTs | Not RFC 3550 jitter |
| `net.probe.failure_rate` | Probe failure rate | % | HTTP-level failures | **Not** packet loss |
| `net.download.mbps` | Download | Mbps | Transfer from `/api/network/download` | Includes the path to that server |
| `net.upload.mbps` | Upload | Mbps | Transfer to `/api/network/upload` | Capped by the endpoint |
| `net.stability` | Stability label | — | CV + range with a 20 ms noise floor | "unstable" requires a real spread, not jitter alone |

---

## 4. Signals the app will never read

| Data | Why not |
| --- | --- |
| IMEI / IMSI / ICCID / phone number | Not needed; Android restricts it; privacy risk |
| MAC address / BSSID | Location-gated and unnecessary for a connection diagnosis |
| GPS coordinates | Not requested — no location fix is ever taken; room names are typed |
| Wi-Fi passwords | Impossible and never requested |
| Other apps' network usage | Requires privileged permissions |
| Tower location / cell ID mapping | Would require an external database and imply precision the modem does not give |
| Transmit power, carrier limits, QoS class | Not exposed to unprivileged apps; the app cannot and will not claim to change them |
