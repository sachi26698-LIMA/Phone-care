# Phase 7 — UI validation report

Status: **emulator-validated; physical-device pass still not run.**

There is no Android handset attached to this environment (no USB device, no `adb`, no local
emulator). Rather than describe a device run that did not happen, the validation was automated on a
GitHub Actions emulator that boots real Android, installs the real debug APK, drives it with
`uiautomator` and screenshots what it sees. Every line below came from that run, from `logcat`, or
from a command that was actually executed.

| | |
| --- | --- |
| Device under test | `sdk_gphone64_x86_64`, Android 14 (API 34), 720x1280 @ 320 dpi = **360x640 dp** |
| Evidence kind | **emulator** — not a physical handset |
| Walk script | `native/android/ui-walk.py` |
| Walk log | `docs/testing/evidence/emulator/walk.log` |
| Screenshots | `docs/testing/evidence/emulator/*.png` (this directory) |
| Failure dumps | `docs/testing/evidence/emulator/fail-*.xml` |
| Website screenshots | `docs/testing/evidence/website/*.png` (390x844, plus 768x1024) |
| Run | {{RUN_URL}} |

## 1. What the walk does

Each step is an assertion, not a screenshot pass: the script reads the accessibility tree, requires
an exact title match in the upper part of the screen, taps rows only when they sit clear of the
bottom navigation, and fails the job on any error. It then:

1. boots the emulator, installs the APK with the manifest's runtime permissions,
   clears app data so permission flows start denied, and launches `MainActivity`;
2. walks all five tabs;
3. opens every pushed screen from its hub, asserts the screen, screenshots it, presses **Back** and
   asserts the hub returned;
4. tests guide search (types `wifi`, requires the Wi-Fi guide to survive the filter);
5. runs the permission flow: taps *Grant access*, accepts **both** system prompts (location, then
   phone state), then taps *Read cellular now* and requires either a real modem reading or an
   explicit statement of why there is none;
6. runs a full check from the dashboard, checks export reaches the system share sheet, saves a
   setting and requires the confirmation;
7. switches the system to dark mode (the app must stay light) and resizes to 1600x1000 @ 160 dpi to
   check the tablet layout;
8. fails the job if `logcat` contains a fatal exception or the process died.

## 2. Result

| | |
| --- | --- |
| Steps | **{{STEPS}}** |
| Passed | **{{PASS}}** |
| Failed | **{{FAIL}}** |
| Notes (non-blocking) | {{SOFT}} |
| Skipped | {{SKIP}} |
| Screenshots | {{SHOTS}} |
| Crashes in logcat | 0 |
| Job conclusion | {{CONCLUSION}} |

Covered: installation, launch, five tabs, all 24 screens, back navigation from every screen,
guide search, permission prompt → grant → read, full check, export sheet, settings save, dark mode,
tablet width.

Not covered by the walk: every secondary button on every screen (for example *Clear canvas* on
Touch, *Add room* on Survey, *Copy summary* on Device identity) and the payment-free export of a
report after a real cellular read on a handset.

## 3. Defects found and fixed

These were found by running the app, not by reading it.

### 3.1 The app rendered almost blank (critical)

The first screenshot showed only `PhoneCare` and a `native` chip, vertically centred on white. The
debug view tree the app now logs gave the answer:

```
LinearLayoutV w=720 h=1184      root
  LinearLayoutV w=720 h=1184    app bar   (should be ~110)
    LinearLayoutH w=656 h=1144  brand row
      View w=396 h=1144         spacer    ← the cause
    TextView w=656 h=0          'Dashboard'
  ScrollView w=720 h=0          page content
```

A bare `View` used as a flexible spacer had `wrap_content` height. Under an `AT_MOST` measure spec
`View.getDefaultSize()` returns the **whole available size**, so the spacer grew to 1144 px, the
app bar swallowed the window, and the title, page and bottom navigation were all measured to zero.
`Layout.flexSpacer()` now builds the gap as `(0, 0, weight)` and documents why.

### 3.2 Every screen showed its title twice

The app bar repeated the page's own heading. The bar now hides its title when the page already
leads with the same words, and keeps it when the page leads with something else (a guide's title).

### 3.3 There was no in-app way back

Only the system back gesture worked. Pushed screens now show a `‹ Back` pill at the start of the
brand row, driving the same back stack.

### 3.4 The back control rendered as a floating grey box

Visible in the screenshots: the first version had no background and looked like a rendering
artifact on its own empty row. It is now a lavender pill inside the brand row.

### 3.5 The status bar was platform grey

Against the cream page it read as a different product. It now uses the brand surface colour with
dark system icons.

### 3.6 Guide cards were dead targets

On the website a guide card is a link; on the phone only *Read guide* responded, so most of the
card did nothing. The whole card is now clickable.

### 3.7 Two primary buttons on the Cellular screen

*Grant access* and *Read cellular now* were both solid violet. Asking for access is a prerequisite,
so it is now a secondary button — one primary action per screen.

### 3.8 Guide search could not find the Wi-Fi guide

Typing `wifi` returned *No match*, because matching was a plain substring test against a title that
says `Wi-Fi`. Matching now folds punctuation on both sides, and an engine check pins it. This is a
native-only gap: the website's guides page has no search box.

### 3.9 The bottom navigation stretched across a tablet

At 1600x1000 @ 160 dpi the cards sat in a centred 720 dp column while the five tabs spread edge to
edge. The bar is now capped to the same column.

### 3.10 Brand and voice did not match the website

The site leads with a PC mark beside the wordmark, and its home hero uses the product's own
headline. The app had the wordmark only and internal framing ("The same diagnostics as the
website..."). Both now match; the hero reads *Check your real health.*

## 4. Real measurements taken on the emulator

Not invented, not copied from the browser:

- **Cellular** — after both permissions were granted, *Read cellular now* produced a serving cell
  (`T-Mobile · other (10)`), `In service = 1`, `Data network type = 10`, each badged `measured` with
  the API it came from (`TelephonyManager.getServiceState()` and friends). See
  `26-cellular-read.png`.
- **Permission denial path** — with permissions denied, the app reported *"Access denied. Cellular
  stays empty with a reason; everything else still works."* and the Cellular screen kept an
  explicit empty state instead of a zero.
- **Battery / storage / thermal** on the dashboard: `100% · Charging`, `4.7 GB free`, thermal
  `Nominal` (`OS classification`), battery temperature `25.0 °C` (`fuel-gauge reading`).
- Values the emulator cannot provide stay `not read` / `Not supported on this API` with the reason,
  which is what the screenshots show for signature-level modem metrics such as RSRP.

## 5. Website verification (unchanged, re-run)

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | clean |
| `npm run test:contract` | **67 passed, 0 failed** |
| `npm run build` | success |
| `node scripts/parity-audit.cjs` | **20 routes mapped, 24 screens reachable, 6 API routes accounted for** |
| Website screenshots | 9 files at 390x844, plus home at 768x1024 |

The website was not modified in this phase, and nothing was deployed.

## 6. Android versus website, visually

Both sides are now photographed at phone width, so the comparison is between images rather than
memories.

| Area | Website | App | Verdict |
| --- | --- | --- | --- |
| Palette | `#1A1A1F`, `#2D2B55`, `#6A5ACD`, `#A678B9`, `#F0D9B5`, `#F4A62A` | identical, asserted by contract test | ✅ |
| Light theme | light only | light only, verified in system dark mode (`28-system-dark-mode.png`) | ✅ |
| App bar | logo mark + wordmark + AI badge | PC mark + wordmark + `native` badge | ✅ fixed |
| Hero | product headline | same headline | ✅ fixed |
| Cards | white surface, 16 dp radius, hairline border | same tokens | ✅ |
| Primary button | violet, full width | same | ✅ |
| Evidence vocabulary | measured / estimated / unavailable / unknown | same, via schema enum | ✅ |
| Tool layout | two-column tiles with icons | single-column rows with subtitles | ⚠️ difference kept |
| Health gauge | evidence gauge with "not scored" state | no gauge; the same facts are listed in *At a glance* | ⚠️ difference kept |
| Tab bar | six: Dashboard, Diagnostics, Results, Network, AI Brain, Guides | five: Home, Diagnose, Network, Results, More | ⚠️ difference kept |
| Long pages | full-page scroll, sticky header | scroll with capped 720 dp column on tablets | ✅ |

The three ⚠️ items are information-architecture choices made in Phase 6, not regressions: the phone
puts Guides, Assistant, Methodology, Settings and Privacy behind *More* rather than adding a sixth
tab, and lists the dashboard facts instead of drawing a gauge. Changing them is a product decision,
listed in §9.

## 7. Feature parity audit

`scripts/parity-audit.cjs` reads the real route tree and the real `Screen` enum and fails if a
website route loses its native screen, a screen becomes unreachable, or an API route has no
documented native strategy.

| | |
| --- | --- |
| Website page routes | 20, all mapped |
| Android screens | 24 (19 pushed + 5 tab roots), all reachable |
| API routes | 6, each with a documented native approach |
| Native-only screens | Settings, Privacy & permissions, More — with reasons in the audit |

Screen-by-screen mapping: `docs/parity/ANDROID-PARITY-MATRIX.md`.

## 8. Known limitations

1. **This is emulator evidence.** A physical handset may behave differently for permissions, modem
   metrics, thermals, touch hardware and performance.
2. The emulator's radio is simulated; `T-Mobile`, network type 10 and the signal values are the
   emulator's, not a real network's. They prove the code path reads a real `TelephonyManager`, not
   that coverage is realistic.
3. Signature-level metrics (RSRP/RSRQ/SINR via `CellSignalStrength`) stay `not read` here; the app
   says so instead of inventing numbers.
4. No CPU die temperature, no TX power, no per-app usage, no Wi-Fi channel width without a scan —
   unchanged, each stated in the UI.
5. Screenshot comparison is human review of committed PNGs, not a pixel-diff harness.
6. The walk covers every screen and the main flows, not every secondary control.
7. The assistant is deterministic on-device; the website's optional proxied model is not replicated.

## 9. Recommended next actions

1. Run `docs/testing/DEVICE-VALIDATION-REPORT.md` on a physical phone (the 23-screen table is ready)
   and fill in the measured values; until then the app stays "emulator-validated".
2. Decide the three IA deltas in §6: sixth tab or not, gauge or list, tiles or rows.
3. Add the emulator walk as a required check on pull requests once its runtime (about 15 minutes) is
   acceptable.
4. Promote the pixel comparison to a harness: same viewport width for both platforms and an image
   diff on the shared components.
5. Re-check Wi-Fi RSSI, link speed, dual-SIM and 5G NSA/SA on hardware where the modem exposes them.
