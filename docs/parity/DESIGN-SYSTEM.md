# Shared design system

One palette, one type scale, one set of component names. The website owns the tokens; the Android
app replicates them in `ui/Theme.kt` + `ui/Components.kt`, and a contract test fails if a hex, a
type size or a corner radius drifts.

Source of truth: [`shared/design-tokens.json`](../../shared/design-tokens.json).

## 1. Palette (light theme only)

| Token | Hex | Used for | On-colour |
| --- | --- | --- | --- |
| Ink | `#1A1A1F` | primary text, headings | — |
| Indigo | `#2D2B55` | deep brand moments, logo lockups | white |
| Violet | `#6A5ACD` | primary action, selected tab, links | white |
| Mauve | `#A678B9` | secondary accents, tags | white |
| Sand | `#F0D9B5` | warm surfaces, emphasised callouts | ink |
| Amber | `#F4A62A` | warnings, attention states | ink |

Neutrals derived for readable light UI (Android): background `#FAF8F5`, surface `#FFFFFF`,
surface-alt `#F4F1EC`, border `#E6E1D9`, muted `#5B5866`, faint `#8A8694`.
Contrast is computed by `Contrast.on(fill)` so text on brand fills never drops below readable levels.

## 2. Type scale

| Role | Size (sp/px) | Weight | Web equivalent |
| --- | --- | --- | --- |
| Display | 28 | 700 | `text-3xl` headings |
| Title | 22 | 700 | page titles |
| Section | 16 | 600/700 | card titles |
| Body | 14 | 400 | paragraphs |
| Small | 12.5 | 400/500 | secondary rows |
| Label | 11.5 | 600, tracked | overlines, badges |

Android uses `sp` so the system font scale is respected; the website uses rem. Neither platform
hard-codes pixels.

## 3. Spacing and shape

Spacing steps: 4 / 8 / 12 / 16 / 24. Cards use 16 px radius and a 1 px `#E6E1D9` border; buttons
and chips are pill-shaped. Touch targets are ≥ 48 dp on Android and ≥ 44 px on the web.

Content width: the Android shell caps content at 720 dp and centres it on tablets/landscape
(`Tokens.isWide`), matching the website's `max-w` containers.

## 4. Component mapping

| Concept | Website component | Android implementation |
| --- | --- | --- |
| Page shell | `layout/app-shell` | `MainActivity` app bar + scroll + bottom nav |
| Card | `ui/card` | `Ui.card`, `Ui.cardWithHeader` |
| Button | `ui/button` | `Ui.primaryButton`, `Ui.secondaryButton`, `Ui.amberButton` |
| Badge | `ui/badge` | `Ui.badge`, `Ui.statusBadge` |
| Evidence badge | `ui/evidence-badge` | badge inside `Pages.measurement` |
| Score ring | `ui/score-ring` | index card (`Ui.card` + display text) |
| Metric strip | `diagnostics/metric-strip` | `Pages.statPair` / `Pages.keyValueBlock` |
| Module card | `diagnostics/module-card` | `Ui.navRow` + live subtitle |
| Run button | `diagnostics/run-module-button` | primary button with `host.isRunning()` guard |
| Empty state | panel copy | `Ui.emptyState` |
| Error state | inline message | `Ui.banner` with `Tokens.WARN`/`BAD` |
| Toast/status | inline status text | `Host.status` line under the app bar |
| Filter chips | `ui/misc` | `Ui.chip` |

## 5. Navigation

Website: top navigation + section sub-nav (`network/network-nav`).
Android: five bottom tabs — **Home, Diagnose, Network, Results, More** — with section screens pushed
onto one back stack, so the system back gesture always returns one level. Tab taps reset the stack;
pushed screens keep it. This is the mobile-appropriate expression of the same hierarchy:

```
Home ──────────────── Dashboard
Diagnose ──────────── Hub → Device · Battery · Storage · Temperature · Display · Touch · Performance · Compatibility
Network ───────────── Hub → Cellular · Wi-Fi · Quality · Survey · Troubleshoot
Results ───────────── History, export
More ──────────────── Guides · Guide · Assistant · Methodology · Settings · Privacy
```

## 6. State vocabulary

| State | Android rendering |
| --- | --- |
| Loading | button label switches to "Running…", disabled, status line "…: working" |
| Empty | `emptyState` with the action that fills it |
| Unsupported | metric row shows `unavailable` + `unsupported` and the API that is missing |
| Permission denied | banner + grant button; metric rows carry `permission_denied` |
| Error | banner naming the failure; the previous result is not overwritten silently |
| Result | value + evidence badge + source API + notes |
| Running twice | explicit "A measurement is already running." — no overlapping runs |

## 7. Accessibility

- Minimum 48 dp touch targets; labels are real text, not images.
- Text uses `sp`; layouts are linear and wrap, so large font scales do not clip.
- Colour is never the only signal: status text accompanies every badge.
- Contrast is computed for text placed on brand fills; muted text is reserved for secondary copy.
- Screen readers get content descriptions from the text itself; decorative swatches and the touch
  canvas are marked clickable/tappable with adjacent explanatory copy.
