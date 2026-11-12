# Android UI walk — emulator run

- Steps: **58** · pass 54 · fail 2 · notes 2 · skipped 0
- Screenshots: **30** in this folder
- Device: Device: sdk_gphone64_x86_64 · Android 14 (API 34) · emulator, not physical hardware

> Produced by `native/android/ui-walk.py` on a GitHub Actions emulator. This is emulator
> evidence, not a physical handset. Every line came from a `uiautomator` dump or `logcat`.

| Result | Step | Detail |
| --- | --- | --- |
| ✅ | Emulator finished booting | 1 |
| ✅ | Install APK | 1055062 bytes, runtime permissions granted |
| ✅ | Launch MainActivity | Complete |
| ✅ | Dashboard renders | app bar title and content present |
| ✅ | Tab Home → Dashboard |  |
| ✅ | Tab Diagnose → Diagnostics |  |
| ✅ | Tab Network → Network |  |
| ✅ | Tab Results → Results |  |
| ✅ | Tab More → More |  |
| ✅ | Device identity opens |  |
| ✅ | Device identity back returns to Diagnostics |  |
| ✅ | Battery & health opens |  |
| ✅ | Battery & health back returns to Diagnostics |  |
| ✅ | Storage opens |  |
| ✅ | Storage back returns to Diagnostics |  |
| ✅ | Temperature opens |  |
| ✅ | Temperature back returns to Diagnostics |  |
| ✅ | Display opens |  |
| ✅ | Display back returns to Diagnostics |  |
| ✅ | Touch opens |  |
| ✅ | Touch back returns to Diagnostics |  |
| ✅ | Performance opens |  |
| ✅ | Performance back returns to Diagnostics |  |
| ✅ | Compatibility opens |  |
| ✅ | Compatibility back returns to Diagnostics |  |
| ✅ | Cellular diagnostics opens |  |
| ✅ | Cellular diagnostics back returns to Network |  |
| ✅ | Wi-Fi diagnostics opens |  |
| ✅ | Wi-Fi diagnostics back returns to Network |  |
| ✅ | Internet quality opens |  |
| ✅ | Internet quality back returns to Network |  |
| ✅ | Indoor survey opens |  |
| ✅ | Indoor survey back returns to Network |  |
| ✅ | Troubleshoot opens |  |
| ✅ | Troubleshoot back returns to Network |  |
| ✅ | Guides opens |  |
| ✅ | Guides back returns to More |  |
| ✅ | Assistant opens |  |
| ✅ | Assistant back returns to More |  |
| ✅ | Methodology opens |  |
| ✅ | Methodology back returns to More |  |
| ✅ | Settings opens |  |
| ✅ | Settings back returns to More |  |
| ✅ | Privacy & permissions opens |  |
| ✅ | Privacy & permissions back returns to More |  |
| ✅ | Permission request shows the system prompt | Allow PhoneCare Diagnostics to access this device’s location? |
| ✅ | Permission granted from the prompt | tapped the system dialog |
| ❌ | Read cellular now button present | button not found on the Cellular screen |
| ✅ | Guide detail opens | battery-health-decline |
| ❌ | Guide search field present | no EditText on the Guides screen |
| ℹ️ | Permission dialog shown | no request was needed on this emulator image |
| ✅ | Full check reports progress or results | on-screen measurement text present |
| ✅ | Export opens the system share sheet | No recommended people to share with |
| ✅ | Settings save round-trips | confirmation shown |
| ℹ️ | System dark mode captured | the app must stay light; compare 01-dashboard |
| ✅ | Wide layout still renders the dashboard | 1600x1000 @ 160 dpi (800x500 dp) |
| ✅ | No uncaught exceptions in logcat | clean run |
| ✅ | App process still alive at the end |  |

## Screenshots

- `01-dashboard.png`
- `tab-home.png`
- `tab-diagnose.png`
- `tab-network.png`
- `tab-results.png`
- `tab-more.png`
- `03-device-identity.png`
- `04-battery-health.png`
- `05-storage.png`
- `06-temperature.png`
- `07-display.png`
- `08-touch.png`
- `09-performance.png`
- `10-compatibility.png`
- `11-cellular-diagnostics.png`
- `12-wi-fi-diagnostics.png`
- `13-internet-quality.png`
- `14-indoor-survey.png`
- `15-troubleshoot.png`
- `16-guides.png`
- `17-assistant.png`
- `18-methodology.png`
- `19-settings.png`
- `20-privacy-permissions.png`
- `25-permission-dialog.png`
- `24-guide-detail.png`
- `26-full-check.png`
- `27-export-sheet.png`
- `28-system-dark-mode.png`
- `29-wide-layout.png`
