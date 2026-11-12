/**
 * Capability matrix used by the network lab and reproduced in AI_BRAIN.md.
 *
 * Every row has a source. If a platform cannot provide a value, the cell says
 * so — that is the entire point of the table.
 */

export type Support = "yes" | "partial" | "no" | "permission";

export interface CapabilityRow {
  capability: string;
  web: Support;
  android: Support;
  ios: Support;
  webApi: string;
  nativeApi: string;
  /** Only set when the iOS API differs from the Android one. */
  iosApi?: string;
  note: string;
}

export const CAPABILITIES: CapabilityRow[] = [
  {
    capability: "Latency (RTT)",
    web: "yes",
    android: "yes",
    ios: "yes",
    webApi: "fetch + Performance.now",
    nativeApi: "OkHttp / URLSession",
    iosApi: "URLSession",
    note: "Median and minimum, plus jitter from consecutive samples.",
  },
  {
    capability: "Download / upload throughput",
    web: "yes",
    android: "yes",
    ios: "yes",
    webApi: "fetch against same-origin endpoint",
    nativeApi: "OkHttp / URLSession",
    iosApi: "URLSession",
    note: "HTTP throughput, not line rate. Server distance is part of the result.",
  },
  {
    capability: "DNS lookup timing",
    web: "partial",
    android: "yes",
    ios: "partial",
    webApi: "Resource Timing",
    nativeApi: "InetAddress / DnsResolver",
    iosApi: "URLSession (no public resolver timing)",
    note: "Browsers return 0 for cached lookups, which is not a measurement.",
  },
  {
    capability: "Packet loss",
    web: "no",
    android: "partial",
    ios: "partial",
    webApi: "—",
    nativeApi: "ICMP needs root or a VPN service",
    iosApi: "Network.framework (no ICMP)",
    note: "We report HTTP probe failures instead and never call them packet loss.",
  },
  {
    capability: "Connection type (Wi-Fi / cellular)",
    web: "partial",
    android: "yes",
    ios: "partial",
    webApi: "Network Information API (Chromium, coarse)",
    nativeApi: "ConnectivityManager",
    iosApi: "NWPathMonitor",
    note: "Browsers do not distinguish 5G from LTE honestly.",
  },
  {
    capability: "LTE RSRP / RSRQ / SINR",
    web: "no",
    android: "permission",
    ios: "no",
    webApi: "—",
    nativeApi: "TelephonyManager.getAllCellInfo (API 26+)",
    note: "Requires ACCESS_FINE_LOCATION; values are modem-reported and often UNAVAILABLE.",
  },
  {
    capability: "5G NR SS-RSRP / SS-RSRQ / SS-SINR",
    web: "no",
    android: "permission",
    ios: "no",
    webApi: "—",
    nativeApi: "CellSignalStrengthNr (API 29+)",
    note: "OEMs differ; absent on many devices even when 5G is connected.",
  },
  {
    capability: "Cell identity, band, timing advance",
    web: "no",
    android: "permission",
    ios: "no",
    webApi: "—",
    nativeApi: "CellIdentityLte / CellIdentityNr",
    note: "34+ (band) / 30+ (timing advance). Location permission gates it.",
  },
  {
    capability: "Dual-SIM status",
    web: "no",
    android: "permission",
    ios: "no",
    webApi: "—",
    nativeApi: "SubscriptionManager (API 22+)",
    note: "READ_PHONE_STATE for carrier names.",
  },
  {
    capability: "Network type (2G–5G)",
    web: "partial",
    android: "yes",
    ios: "partial",
    webApi: "effectiveType (coarse bucket)",
    nativeApi: "TelephonyManager.getDataNetworkType",
    iosApi: "CTTelephonyNetworkInfo",
    note: "effectiveType is derived from traffic, not from the radio.",
  },
  {
    capability: "Service state (in/out of service, roaming)",
    web: "no",
    android: "permission",
    ios: "no",
    webApi: "—",
    nativeApi: "TelephonyManager.getServiceState",
    note: "READ_PHONE_STATE + location.",
  },
  {
    capability: "Wi-Fi RSSI",
    web: "no",
    android: "permission",
    ios: "no",
    webApi: "—",
    nativeApi: "NetworkCapabilities.getSignalStrength (API 29+)",
    note: "NEARBY_WIFI_DEVICES on Android 13+; location for SSID.",
  },
  {
    capability: "Wi-Fi band / frequency / link speed",
    web: "no",
    android: "permission",
    ios: "no",
    webApi: "—",
    nativeApi: "WifiInfo.getFrequency / getLinkSpeedMbps",
    note: "Interface-level; the router's channel width is not visible.",
  },
  {
    capability: "Nearby networks / channel scan",
    web: "no",
    android: "permission",
    ios: "no",
    webApi: "—",
    nativeApi: "WifiManager.getScanResults",
    note: "Android 13+ needs NEARBY_WIFI_DEVICES instead of location.",
  },
  {
    capability: "Gateway reachability",
    web: "no",
    android: "partial",
    ios: "no",
    webApi: "—",
    nativeApi: "LinkProperties.getRoutes + socket probe",
    iosApi: "NWPathMonitor + socket probe",
    note: "Best-effort; no raw ICMP without elevated privileges.",
  },
  {
    capability: "Open system settings screens",
    web: "no",
    android: "yes",
    ios: "partial",
    webApi: "—",
    nativeApi: "Settings.ACTION_* intents",
    note: "The user makes every change; nothing is toggled silently.",
  },
  {
    capability: "Background monitoring",
    web: "no",
    android: "partial",
    ios: "no",
    webApi: "—",
    nativeApi: "Foreground service (dataSync type)",
    iosApi: "No equivalent for this use",
    note: "Android 15 time-bounds dataSync, so surveys stay foreground-only.",
  },
];
