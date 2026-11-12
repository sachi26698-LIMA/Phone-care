# Real-device testing checklist

PhoneCare is a browser product, so its "hardware" is whatever engine the visitor runs. Automated
runs in CI/sandbox can only exercise Chromium; Safari (WebKit) and Firefox (Gecko) must be checked
on real hardware by a person.

## How to label results

Use one of these labels in the results table. Never record an emulated result as a physical one.

| Label | Meaning |
| --- | --- |
| **Physical** | Ran on the named phone/desktop with the named browser. |
| **Engine** | Ran a real browser engine in a headless/automated environment (no physical sensors). |
| **Emulated** | Another engine pretending to be the target via UA/metrics/touch emulation. Layout only. |
| **Simulated** | The app's fallback path was forced by stubbing/removing an API in DevTools. |

## Targets

| Target | Engine | How to run |
| --- | --- | --- |
| Android Chrome | Blink | Physical phone, Chrome stable, `chrome://version` recorded. Also run with Data Saver on/off. |
| Android Firefox | Gecko | Physical phone, Firefox for Android. Expect no Battery Status and no Network Information. |
| iPhone Safari | WebKit | Physical iPhone, Safari. Use a private tab too (storage eviction + `persist()` behaviour). |
| Desktop Chrome | Blink | Real Chrome on macOS/Windows/Linux. |
| Desktop Firefox | Gecko | Real Firefox. `dom.wakelock.enabled` may gate wake lock. |

## Checklist (repeat per target)

### 1. Load and scan
- [ ] `/` renders with warm off-white background, no dark sections, no layout shift.
- [ ] Full scan completes; progress text updates; cancel works mid-run.
- [ ] Reload restores the previous scan; "Clear data" empties it.
- [ ] No console errors other than the known chunked-download `ERR_ABORTED` (DevTools only).

### 2. Battery (`/diagnostics/battery`)
- [ ] Chromium: level + charging state appear and update after plugging/unplugging.
- [ ] Chromium: "time to full/empty" says *Not reported* rather than inventing a number.
- [ ] Safari/Firefox: "This browser does not expose battery data" panel; badge **Unsupported**.
- [ ] Health estimate only appears after entering both capacities; labelled *Estimate*.

### 3. Storage and persistence (`/diagnostics/storage`)
- [ ] Origin usage/quota are plausible; device totals come only from your entries.
- [ ] "Request persistent storage" shows the explanation before the prompt.
- [ ] Record the resulting state: **Persistent / Not requested / Declined / Blocked / Unsupported**.
- [ ] In a private window, confirm the blocked or declined path renders and the module still works.

### 4. Orientation and wake lock
- [ ] Rotate the phone: layout reflows, no horizontal scroll, bottom nav stays fixed.
- [ ] Forced landscape shows the same content without clipping.
- [ ] `/diagnostics/screen` → "Hold awake": record Awake / Declined / Unsupported.
- [ ] Leave the test: the lock releases (screen may sleep again).

### 5. Touch (`/diagnostics/touch`)
- [ ] Drag one finger across all 40 zones; coverage reaches 100%.
- [ ] Two/three fingers register a peak contact count > 1 on a multi-touch phone.
- [ ] "Save trace" persists after reload.
- [ ] Desktop without a digitiser shows **No touch digitiser** and the trace still records mouse input.

### 6. Network (`/diagnostics/network`)
- [ ] Latency, download and upload complete on Wi-Fi and on cellular.
- [ ] Run twice: values vary, but the module never claims a carrier speed tier.
- [ ] `rtt`/`downlink` hints either show a plausible value or say unavailable (0 ms is not a value).

### 7. Display (`/diagnostics/screen`)
- [ ] Overlay opens full-screen; each pattern renders edge to edge; the header stays readable.
- [ ] Escape/close returns to the page; answers persist.
- [ ] Refresh rate shows a plausible value in the foreground or says unavailable.
- [ ] The overlay is the only intentionally dark surface.

### 8. Compatibility (`/diagnostics/compatibility`)
- [ ] Feature count is 37; note which are unsupported per browser.
- [ ] Safari reports no Battery Status, no Network Information, no Web Bluetooth.
- [ ] Filtering by category returns the right features.

### 9. Permissions
- [ ] No prompt appears on first load or during a full scan.
- [ ] Every optional prompt is preceded by an explanation in the UI.
- [ ] Deny each prompt: the app continues and states the limitation.

### 10. Accessibility
- [ ] Keyboard-only: skip link → navigation → scan → module tabs.
- [ ] Drawer traps focus and closes on Escape.
- [ ] VoiceOver/TalkBack announces score, evidence badge and status (not colour alone).
- [ ] Reduced motion and large text settings do not break layout.

## Recording results

Copy this table into the PR or an issue and fill it in. Leave rows blank until a person runs them.

| Target | Date | Tester | Scan | Battery | Storage | Wake lock | Touch | Network | Display | Permissions | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Android Chrome (physical) | | | | | | | | | | | |
| Android Firefox (physical) | | | | | | | | | | | |
| iPhone Safari (physical) | | | | | | | | | | | |
| Desktop Chrome | | | | | | | | | | | |
| Desktop Firefox | | | | | | | | | | | |
