package app.phonecare.diagnostics.content

// GENERATED from lib/guides/index.ts by the repository's parity tooling.
// Do not hand-edit: scripts/parity-check.cjs fails if the two drift apart.
// The website and the Android app therefore ship the same guide text, slugs and sources.

data class GuideStep(val title: String, val detail: String)

data class GuideSource(val label: String, val url: String)

data class Guide(
    val slug: String,
    val title: String,
    val category: String,
    val summary: String,
    val readMinutes: Int,
    val updated: String,
    val symptoms: List<String>,
    val steps: List<GuideStep>,
    val warning: String?,
    val sources: List<GuideSource>,
)

object Guides {

    val all: List<Guide> = listOf(
    Guide(
        slug = "battery-health-decline",
        title = "Battery health is dropping: what to do next",
        category = "Battery",
        summary = "How to read a battery-health estimate honestly, how cells wear, and when replacement is the rational choice.",
        readMinutes = 6,
        updated = "2026-10-02",
        symptoms = listOf(
"Runtime noticeably shorter than when the phone was new",
"Sudden shutdown at 15–25% remaining",
"Phone gets warm while idle or charging",
"Battery percentage jumps or stalls",
        ),
        steps = listOf(
GuideStep("Establish the real numbers, not a vibe", "On Android, open Settings → Battery → Battery usage (or a diagnostic screen in the manufacturer app) to find design capacity and current full-charge capacity. On iPhone, Settings → Battery → Battery Health & Charging shows Maximum Capacity directly. Enter those two figures in PhoneCare to compute health."),
GuideStep("Know what 80% means", "Lithium-ion phone cells are typically rated to retain about 80% of design capacity after 500–1000 full cycles. Below 80%, runtime, peak power delivery and thermal behaviour all degrade together. That is a manufacturer-wide convention, not a hard cliff — but it is the threshold service centres use."),
GuideStep("Extend what remains", "Avoid sustained heat, which is the single biggest accelerant of capacity loss. Keep the phone out of direct sun, don't game while charging, and charge between roughly 20% and 85% when convenience allows. Fast charging is fine in moderation; heat, not wattage, does the damage."),
GuideStep("Decide with a cost test", "Compare the price of a quality replacement against the cost of a new device and how long you plan to keep this one. Use an authorised service centre where possible: cheap aftermarket cells often lose capacity within months and may lack proper thermal sensing."),
GuideStep("Verify afterwards", "After replacement, re-check capacity in the OS, then re-run PhoneCare's battery module. A healthy new cell should report at or near design capacity after a few full cycles."),
        ),
        warning = "A swollen battery (screen lifting, back panel bulging, unusual warmth at rest) is a safety issue. Stop using the device, do not puncture it, and have it serviced immediately.",
        sources = listOf(
GuideSource("MDN · Battery Status API", "https://developer.mozilla.org/en-US/docs/Web/API/Battery_Status_API"),
GuideSource("Apple · Maximising battery life and lifespan", "https://www.apple.com/batteries/maximizing-performance/"),
        ),
    ),
    Guide(
        slug = "storage-full",
        title = "Storage is full: a measured clean-up plan",
        category = "Storage",
        summary = "Why free space matters beyond installs, and a priority order for reclaiming storage without losing anything.",
        readMinutes = 5,
        updated = "2026-10-02",
        symptoms = listOf(
"Camera says it cannot save photos",
"Updates fail or refuse to download",
"Apps take seconds to launch or crash on open",
"Phone feels warm and sluggish after a storage warning",
        ),
        steps = listOf(
GuideStep("Measure before deleting", "PhoneCare cannot see your disk — browsers hide that deliberately. Enter total and free space from Settings → Storage so the app can model pressure. Then work through the OS breakdown by category rather than deleting at random."),
GuideStep("Start with copies, not originals", "Photos and videos are usually the largest recoverable block. Copy to a computer or cloud service, verify the copies open, then delete the local originals. Keep at least 10–15% of total capacity free so the OS has room for caches, OTA updates and swap."),
GuideStep("Target messaging caches", "Chat apps quietly accumulate forwarded video and voice notes. Their own storage settings can clear media older than 30–90 days without losing text history. This is often several GB recovered in a minute."),
GuideStep("Audit app data, not just apps", "Uninstalling removes data, but 'offloading' keeps it. Sort apps by size and look at which store offline media, maps and podcasts. Prefer in-app cache clearing for apps you keep."),
GuideStep("Confirm the result", "Re-enter free space and re-run the storage module. A healthy target is 15%+ free; below 7% the platform starts to fight you."),
        ),
        warning = "Never delete the Android 'Android/data' or iOS 'System Data' folders manually. Use the OS tools; manual deletion can break apps or the system.",
        sources = listOf(
GuideSource("Google · Free up space on your Android device", "https://support.google.com/android/answer/7436584"),
GuideSource("Chrome for Developers · Estimating available storage space", "https://developer.chrome.com/blog/estimating-available-storage-space"),
        ),
    ),
    Guide(
        slug = "slow-wifi",
        title = "Diagnosing slow Wi-Fi and laggy connections",
        category = "Network",
        summary = "Separate signal problems from router problems from ISP problems using measurements you can repeat.",
        readMinutes = 6,
        updated = "2026-10-02",
        symptoms = listOf(
"Videos buffer at the same spot every time",
"Video calls freeze while audio continues",
"Games show high ping spikes",
"Speed feels fine on one device but not another",
        ),
        steps = listOf(
GuideStep("Measure three states", "Run PhoneCare's network module on Wi-Fi next to the router, on Wi-Fi in the problem room, and on mobile data with Wi-Fi off. Comparing those three numbers tells you whether the fault is distance, the router, or the internet link itself."),
GuideStep("Read latency before speed", "A 200 Mbps connection with 250 ms latency still feels terrible for calls and games. PhoneCare reports median round-trip time and jitter across six probes; consistent latency above 150 ms or jitter above 60 ms points at congestion or a distant route."),
GuideStep("Remove the usual suspects", "VPNs, private DNS relays, and Data Saver all add hops or throttle traffic. Disable each for one test run. Beware 'Wi-Fi optimiser' apps — many just cycle radios and reset counters."),
GuideStep("Check band and channel", "5 GHz and 6 GHz are faster but travel less far through walls; 2.4 GHz is slower but more penetrating. If the problem room only works on 2.4 GHz, a mesh node or wired access point beats a faster router in another room."),
GuideStep("Know when it is not your phone", "If every device shows the same latency at the same time, escalate to the ISP with your measurement timestamps. If only your phone is affected, test with a hotspot and compare"),
        ),
        warning = null,
        sources = listOf(
GuideSource("MDN · Network Information API", "https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API"),
GuideSource("web.dev · Core Web Vitals", "https://web.dev/articles/vitals"),
        ),
    ),
    Guide(
        slug = "overheating",
        title = "Phone running hot: an evidence-based approach",
        category = "Thermal",
        summary = "Why no website can read your phone's temperature, what throttling looks like, and how to cool the device safely.",
        readMinutes = 5,
        updated = "2026-10-02",
        symptoms = listOf(
"Back of the phone is uncomfortably warm",
"Games or navigation drop frames after a few minutes",
"Charging slows dramatically when the phone is warm",
"Camera app warns it must cool down before recording",
        ),
        steps = listOf(
GuideStep("Accept the measurement limit", "No browser API exposes battery, CPU or skin temperature. PhoneCare infers thermal pressure from how much throughput drops across sustained benchmark rounds. That is a signal, not a thermometer. For a real reading, use your phone's built-in diagnostics or a native system-info app."),
GuideStep("Remove the insulation", "Thick cases, especially with magnetic plates or wallets, trap heat. Remove the case during long gaming or navigation sessions and avoid direct sunlight — sunlight adds more heat than any app."),
GuideStep("Stop stacking loads", "Charging while gaming combines two heat sources. Fast charging plus navigation does the same. If you must navigate long distance, charge before you leave or use a lower-power charger."),
GuideStep("Check what is running", "A phone warm at idle usually has a misbehaving app. Check battery usage by app, look for a background app with high usage and no screen time, and force-stop it. Reboot if the warmth returns immediately."),
GuideStep("Know the danger signs", "Persistent heat at rest, a bulging back panel, or a burning smell are hardware problems. Stop charging, power off, and seek service. Do not put a hot phone in a fridge — condensation can damage it."),
        ),
        warning = null,
        sources = listOf(
GuideSource("Apple · Maximising battery life and lifespan", "https://www.apple.com/batteries/maximizing-performance/"),
GuideSource("web.dev · Core Web Vitals", "https://web.dev/articles/vitals"),
        ),
    ),
    Guide(
        slug = "touchscreen-issues",
        title = "Touchscreen misses and dead zones",
        category = "Touch",
        summary = "How to distinguish a digitiser fault from a protector, a software overlay or a dirty screen.",
        readMinutes = 5,
        updated = "2026-10-02",
        symptoms = listOf(
"Taps near an edge do not register",
"Keyboard repeats or skips letters",
"Ghost touches while charging",
"Multi-finger gestures fail",
        ),
        steps = listOf(
GuideStep("Clean and simplify first", "Oil, moisture and thick tempered glass all interfere with capacitive sensing. Clean the screen, dry your hands, and test without a protector if it is removable. Bubble-prone protectors cause exactly the repeating-gap pattern people mistake for dead zones."),
GuideStep("Map it with a trace", "Use PhoneCare's touch test and draw slowly across the whole grid. Run it twice. A single missed corner is usually technique; the same 2 cm band failing twice is a hardware sign."),
GuideStep("Rule out charging ghost touches", "Ungrounded or failing chargers cause phantom taps. Test on battery power. If ghosting disappears when unplugged, replace the charger or cable before blaming the phone."),
GuideStep("Rule out a software overlay", "Screen protectors with 'sensitivity' apps, accessibility overlays and some launchers intercept touches. Boot into safe mode; if the touch test passes there, an installed app is the cause."),
GuideStep("Then treat it as hardware", "Digitiser faults on modern phones mean a screen assembly replacement. Back up first: the repair may require a full reset, and a failing digitiser can make the backup process slow."),
        ),
        warning = null,
        sources = listOf(
GuideSource("MDN · Pointer events", "https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events"),
        ),
    ),
    Guide(
        slug = "screen-defects",
        title = "Dead pixels, banding and uneven backlight",
        category = "Display",
        summary = "A short taxonomy of panel defects, which ones are software-fixable, and what to show a repair technician.",
        readMinutes = 4,
        updated = "2026-10-02",
        symptoms = listOf(
"A tiny dot stays black or bright on every background",
"Visible bands in a smooth gradient",
"Dark corners or a bright patch on white",
"Colours shift when the phone tilts",
        ),
        steps = listOf(
GuideStep("Document with the right evidence", "Run the full-screen colour patterns and photograph the screen with another device. A screenshot will not capture panel faults — if the flaw appears in a screenshot too, suspect software or an image, not the panel."),
GuideStep("Separate stuck from dead", "A stuck pixel shows one colour constantly; a dead pixel stays black. Stuck pixels occasionally recover after hours of colour cycling; dead pixels do not. Neither is fixable by clearing a cache."),
GuideStep("Recognise OLED characteristics", "Uniformity on large white areas and slight colour shift at extreme angles are normal for OLED, not defects. Visible burn-in — a ghost of a status bar or keyboard — is wear and typically not covered by warranty."),
GuideStep("Check warranty terms", "Many manufacturers only replace panels above a threshold count of defective pixels. Ask for the policy in writing and bring photographs taken at full brightness on a white background."),
        ),
        warning = null,
        sources = listOf(
GuideSource("web.dev · Core Web Vitals", "https://web.dev/articles/vitals"),
        ),
    ),
    Guide(
        slug = "slow-phone-performance",
        title = "Making an older phone feel fast again",
        category = "Performance",
        summary = "A triage order for sluggishness: storage, thermal limits, background load, then expectations.",
        readMinutes = 5,
        updated = "2026-10-02",
        symptoms = listOf(
"Apps take several seconds to open",
"Keyboard lags behind typing",
"Animations stutter while scrolling",
"Notifications arrive late",
        ),
        steps = listOf(
GuideStep("Clear storage first", "Low free space forces the OS to fight for cache room and can slow writes dramatically. Get above 15% free before changing anything else — it is the cheapest fix with the largest effect."),
GuideStep("Check the thermal state", "A warm phone throttles deliberately. If performance improves after ten minutes of rest, heat — not ageing silicon — is your limiter. Remove the case and avoid charging while gaming."),
GuideStep("Audit startup and background work", "Disable auto-start for apps you do not need instant notifications from. Fewer background wake-ups means more CPU and battery for what is on screen. Uninstall 'cleaner' apps; they add background work and ads rather than removing it."),
GuideStep("Reduce animation load", "Turning off animations hides latency but does not remove it. If you want real responsiveness, lower the refresh rate cap only as a battery trade-off, not as a speed fix."),
GuideStep("Set honest expectations", "Four-year-old mid-range phones run current apps with less headroom than they did on launch-day software. PhoneCare's performance index is relative to this session, not a verdict that the hardware is broken."),
        ),
        warning = null,
        sources = listOf(
GuideSource("web.dev · Core Web Vitals", "https://web.dev/articles/vitals"),
GuideSource("MDN · Navigator.deviceMemory", "https://developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory"),
        ),
    ),
    Guide(
        slug = "browser-diagnostics-limits",
        title = "What a website can and cannot know about your phone",
        category = "Methodology",
        summary = "The complete, honest boundary of browser-based diagnostics — and why PhoneCare labels every reading.",
        readMinutes = 4,
        updated = "2026-10-02",
        symptoms = listOf(
"A reading shows 'Unavailable'",
"A different browser shows different results",
"A website claims to measure battery temperature",
        ),
        steps = listOf(
GuideStep("Measured means measured", "Screen geometry, device pixel ratio, touch points, feature support, network throughput, frame timing and compute benchmarks are real measurements taken in your browser. So are battery level and charging state — but only in Chromium browsers."),
GuideStep("Some numbers are estimates", "Battery health from entered capacities, thermal pressure from throttling, connection class from recent traffic, and renderer names inferred from user-agent strings are estimates. Useful, but not sensors."),
GuideStep("Some things are simply unavailable", "Battery temperature, voltage, cycle count, CPU temperature, fan speed and total disk usage cannot be read by any web page. Safari and Firefox deliberately hide battery and memory data to prevent fingerprinting. PhoneCare shows these as unavailable rather than guessing."),
GuideStep("Why browser choice changes results", "Chrome and Edge expose device memory, battery and network hints. Firefox removed the Battery API in version 52; Safari never shipped it. On iPhone, every browser is WebKit underneath, so switching to Chrome does not add these APIs."),
GuideStep("Privacy by design", "PhoneCare runs its diagnostics locally in your browser and does not send readings to a server. Your scan history lives in localStorage on this device and can be cleared at any time."),
        ),
        warning = null,
        sources = listOf(
GuideSource("MDN · Battery Status API", "https://developer.mozilla.org/en-US/docs/Web/API/Battery_Status_API"),
GuideSource("MDN · Navigator.deviceMemory", "https://developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory"),
GuideSource("MDN · Network Information API", "https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API"),
        ),
    ),
    )

    fun bySlug(slug: String): Guide? = all.firstOrNull { it.slug == slug }

    /**
     * Search matches title, summary, category and symptoms — same fields as the website.
     *
     * Matching ignores punctuation, because a phone keyboard makes "wifi" the obvious query and
     * the article calls itself "Wi-Fi". Stripping non-alphanumerics from both sides fixes that
     * without a synonym table.
     */
    fun search(query: String): List<Guide> {
        val q = normalise(query)
        if (q.isEmpty()) return all
        return all.filter { guide ->
            normalise(guide.title).contains(q) ||
                normalise(guide.summary).contains(q) ||
                normalise(guide.category).contains(q) ||
                guide.symptoms.any { normalise(it).contains(q) }
        }
    }

    private fun normalise(value: String): String =
        value.lowercase().filter { it.isLetterOrDigit() }

    val categories: List<String> get() = all.map { it.category }.distinct().sorted()
}
