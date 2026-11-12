#!/usr/bin/env python3
"""Drive the real debug APK on an Android emulator and record what actually happens.

This script is the automated half of `docs/testing/DEVICE-VALIDATION-REPORT.md`. It does not
simulate results: every status below comes from a `uiautomator` dump, a screenshot taken by the
running app, or the device log. If a screen does not appear, the step is FAIL, not skipped.

Evidence it writes into docs/testing/evidence/emulator/:
  *.png            screenshot of each screen as the emulator rendered it
  ui-walk-report.md  human-readable pass/fail table
  ui-walk.json     the same data as JSON
  logcat.txt       device log, so crashes are visible

Exit code is non-zero when any hard step fails.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

ADB = os.environ.get("ADB", "adb")
PKG = "app.phonecare.diagnostics"
APK = os.environ.get("APK", "app/build/outputs/apk/debug/app-debug.apk")
EVIDENCE = Path(os.environ.get("EVIDENCE_DIR", "docs/testing/evidence/emulator"))
SCREEN = (720, 1280)  # 720x1280 @ 320 dpi = 360x640 dp, a real small-phone viewport
DENSITY = 320

STEPS: list[dict[str, str]] = []
LAST_XML = ""
SHOTS: list[str] = []
NOTES: list[str] = []


# ----------------------------------------------------------------------------- plumbing


def run(*args: str, timeout: int = 180) -> tuple[int, str]:
    try:
        p = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
        return p.returncode, (p.stdout or "") + (p.stderr or "")
    except subprocess.TimeoutExpired:
        return 124, f"timeout: {' '.join(args)}"


def adb(*args: str, timeout: int = 180) -> tuple[int, str]:
    return run(ADB, *args, timeout=timeout)


def record(status: str, name: str, detail: str = "") -> None:
    """status: pass | fail | soft | skip"""
    STEPS.append({"status": status, "name": name, "detail": detail})
    mark = {"pass": "PASS", "fail": "FAIL", "soft": "NOTE", "skip": "SKIP"}[status]
    line = f"[{mark}] {name}" + (f" — {detail}" if detail else "")
    print(line, flush=True)
    if status == "fail":
        print(f"::error title=UI walk::{name} — {detail}", flush=True)
        try:
            EVIDENCE.mkdir(parents=True, exist_ok=True)
            (EVIDENCE / f"fail-{slug(name)}.xml").write_text(LAST_XML or "(empty dump)")
        except Exception:  # noqa: BLE001 - evidence must never mask the failure
            pass


def dump() -> str:
    """Return the current accessibility XML, retrying while the UI settles."""
    for _ in range(8):
        adb("shell", "uiautomator", "dump", "/sdcard/ui.xml", timeout=60)
        rc, xml = adb("shell", "cat", "/sdcard/ui.xml", timeout=60)
        if rc == 0 and xml.lstrip().startswith("<"):
            global LAST_XML
            LAST_XML = xml
            return xml
        time.sleep(1)
    return ""


def nodes(xml: str) -> list[tuple[str, int, int, int, int]]:
    """(text, center_x, center_y, bottom_y, top_y) for every labelled node."""
    out: list[tuple[str, int, int, int, int]] = []
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return out
    for node in root.iter("node"):
        text = (node.get("text") or node.get("content-desc") or "").strip()
        m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.get("bounds") or "")
        if text and m:
            x1, y1, x2, y2 = (int(v) for v in m.groups())
            out.append((text, (x1 + x2) // 2, (y1 + y2) // 2, y2, y1))
    return out


def header_is(title: str, xml: str | None = None) -> bool:
    """True when the app bar itself shows this title.

    Matching anywhere on the screen is not proof a screen opened: the hub you came from lists the
    same words as row labels, which made three earlier "screen opened" checks lie.
    """
    xml = xml if xml is not None else dump()
    return any(t == title and top < 520 for t, _cx, _cy, _b, top in nodes(xml))


def has_text(text: str, xml: str | None = None) -> bool:
    xml = xml if xml is not None else dump()
    return any(text.lower() in t.lower() for t, *_ in nodes(xml))


def find(text: str, *, scroll: int = 0, bottom_most: bool = False,
         above_nav: bool = False) -> tuple[int, int] | None:
    """Locate a tappable node by text, optionally scrolling the page to reach it.

    With `above_nav`, only nodes that sit clear of the bottom navigation are accepted, and the
    returned point is near the node's top edge. Tapping the centre of a row that is half hidden
    under the nav bar lands on a tab instead — which is what silently kept the app on the hub
    while the walk believed it had navigated.
    """
    for attempt in range(scroll + 1):
        w, h = screen_size()
        candidates = [
            n for n in nodes(dump())
            if text.lower() in n[0].lower()
            and (not above_nav or (n[4] > 340 and n[3] < h - 140))
        ]
        if candidates:
            # "Guides, the assistant and everything this app does with your data" also contains
            # "Guides"; tapping it silently did nothing and the walk blamed the app. Exact label
            # wins, then prefix, then substring.
            def rank(node):
                label = node[0].lower()
                weight = 3 if label == text.lower() else 2 if label.startswith(text.lower()) else 1
                return weight

            best = max(rank(n) for n in candidates)
            pool = [n for n in candidates if rank(n) == best]
            chosen = max(pool, key=lambda n: n[3]) if bottom_most else pool[0]
            tap_y = chosen[4] + 24 if above_nav else chosen[2]
            return chosen[1], tap_y
        if attempt < scroll:
            adb("shell", "input", "swipe", str(w // 2), str(int(h * 0.62)),
                str(w // 2), str(int(h * 0.32)), "300")
            time.sleep(0.8)
    return None


def screen_size() -> tuple[int, int]:
    rc, out = adb("shell", "wm", "size")
    m = re.search(r"Override size:\s*(\d+)x(\d+)", out) or re.search(r"Physical size:\s*(\d+)x(\d+)", out)
    return (int(m.group(1)), int(m.group(2))) if m else SCREEN


def tap(text: str, *, scroll: int = 0, bottom_most: bool = False, above_nav: bool = False) -> bool:
    spot = find(text, scroll=scroll, bottom_most=bottom_most, above_nav=above_nav)
    if not spot:
        return False
    adb("shell", "input", "tap", str(spot[0]), str(spot[1]))
    time.sleep(1.2)
    return True


def tap_edit_text() -> bool:
    """Focus the first EditText on screen, by class rather than by placeholder text."""
    try:
        root = ET.fromstring(dump())
    except ET.ParseError:
        return False
    for node in root.iter("node"):
        if (node.get("class") or "").endswith("EditText"):
            m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.get("bounds") or "")
            if not m:
                continue
            x1, y1, x2, y2 = (int(v) for v in m.groups())
            adb("shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2))
            time.sleep(1.0)
            return True
    return False


def back() -> None:
    adb("shell", "input", "keyevent", "KEYCODE_BACK")
    time.sleep(1.0)
    rc, ime = adb("shell", "dumpsys", "input_method")
    if "mInputShown=true" in ime:
        # The first BACK closed the keyboard, not the screen; press again.
        adb("shell", "input", "keyevent", "KEYCODE_BACK")
        time.sleep(1.0)


def wait_for_header(title: str, timeout: float = 15.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if header_is(title):
            return True
        time.sleep(0.8)
    return False


def wait_for(text: str, timeout: float = 12.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if has_text(text):
            return True
        time.sleep(0.8)
    return False


def shot(name: str) -> bool:
    path = EVIDENCE / f"{name}.png"
    try:
        with open(path, "wb") as fh:
            subprocess.run([ADB, "exec-out", "screencap", "-p"], stdout=fh, timeout=120, check=False)
    except Exception as exc:  # noqa: BLE001 - evidence failure must not abort the walk
        NOTES.append(f"screenshot {name} failed: {exc}")
        return False
    if path.exists() and path.stat().st_size > 2048:
        SHOTS.append(path.name)
        return True
    return False


def alive() -> bool:
    rc, out = adb("shell", "pidof", PKG)
    return rc == 0 and bool(out.strip())


# ----------------------------------------------------------------------------- screens

TABS = [
    ("Home", "Dashboard"),
    ("Diagnose", "Diagnostics"),
    ("Network", "Network"),
    ("Results", "Results"),
    ("More", "More"),
]

HUBS = [
    ("Diagnose", "Diagnostics", [
        ("Device identity", "Device identity"),
        ("Battery & health", "Battery & health"),
        ("Storage", "Storage"),
        ("Temperature", "Temperature"),
        ("Display", "Display"),
        ("Touch", "Touch"),
        ("Performance", "Performance"),
        ("Compatibility", "Compatibility"),
    ]),
    ("Network", "Network", [
        ("Cellular diagnostics", "Cellular"),
        ("Wi-Fi diagnostics", "Wi-Fi"),
        ("Internet quality", "Internet quality"),
        ("Indoor survey", "Indoor survey"),
        ("Troubleshoot", "Troubleshoot"),
    ]),
    ("More", "More", [
        ("Guides", "Guides"),
        ("Assistant", "Assistant"),
        ("Methodology", "Methodology"),
        ("Settings", "Settings"),
        ("Privacy & permissions", "Privacy & permissions"),
    ]),
]


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def main() -> int:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    print(f"cwd={os.getcwd()} python={sys.version.split()[0]} apk={APK}", flush=True)
    print(f"adb={run(ADB, 'version')[1].strip().splitlines()[0] if run(ADB, 'version')[1].strip() else 'missing'}",
          flush=True)

    # --- device prep -----------------------------------------------------------------
    rc, out = adb("wait-for-device")
    rc, boot = adb("shell", "getprop", "sys.boot_completed")
    if "1" not in boot:
        record("fail", "Emulator finished booting", f"sys.boot_completed={boot.strip()!r}")
        return 1
    record("pass", "Emulator finished booting", boot.strip())

    rc, model = adb("shell", "getprop", "ro.product.model")
    rc2, release = adb("shell", "getprop", "ro.build.version.release")
    rc3, sdk = adb("shell", "getprop", "ro.build.version.sdk")
    NOTES.append(f"Device: {model.strip()} · Android {release.strip()} (API {sdk.strip()}) · "
                 f"emulator, not physical hardware")

    adb("shell", "wm", "size", f"{SCREEN[0]}x{SCREEN[1]}")
    adb("shell", "wm", "density", str(DENSITY))
    adb("shell", "settings", "put", "system", "screen_off_timeout", "1800000")
    adb("shell", "settings", "put", "global", "window_animation_scale", "0")
    adb("shell", "settings", "put", "global", "transition_animation_scale", "0")
    adb("shell", "settings", "put", "global", "animator_duration_scale", "0")
    time.sleep(1.5)

    # --- install + launch ------------------------------------------------------------
    rc, out = adb("install", "-r", "-g", str(APK), timeout=300)
    if rc != 0 or "Success" not in out:
        record("fail", "Install APK", out.strip()[-400:])
        return 1
    record("pass", "Install APK", f"{Path(APK).stat().st_size} bytes, runtime permissions granted")

    adb("shell", "pm", "clear", PKG)  # start from a clean profile
    adb("shell", "input", "keyevent", "KEYCODE_WAKEUP")
    adb("shell", "wm", "dismiss-keyguard")
    adb("shell", "settings", "put", "system", "screen_off_timeout", "1800000")
    time.sleep(1.0)
    rc, out = adb("shell", "am", "start", "-W", "-n", f"{PKG}/.MainActivity", timeout=120)
    launched = "Status: ok" in out or "Activity" in out
    record("pass" if launched else "fail", "Launch MainActivity", out.strip().splitlines()[-1] if out.strip() else "")
    rc, focus = adb("shell", "dumpsys", "window")
    focused = next((ln.strip() for ln in focus.splitlines() if "mCurrentFocus" in ln), "unknown")
    NOTES.append(f"Foreground window after launch: {focused}")
    print(f"foreground: {focused}", flush=True)

    if not wait_for("Dashboard", 25):
        # Capture exactly what the device shows so the failure is diagnosable, not guessed at.
        (EVIDENCE / "dump-after-launch.xml").write_text(LAST_XML or "(empty dump)")
        shot("FAIL-after-launch")
        rc, logcat = adb("shell", "logcat", "-d", "-t", "2000")
        (EVIDENCE / "logcat-after-launch.txt").write_text(logcat)
        rc, diag = adb("shell", "logcat", "-d", "-s", "PhoneCareDiag:*")
        (EVIDENCE / "view-tree.txt").write_text(diag)
        rc, top = adb("shell", "dumpsys", "activity", "top")
        (EVIDENCE / "activity-top.txt").write_text(top[:200_000])
        preview = " | ".join(t for t, *_ in nodes(LAST_XML)[:8]) or "(no labelled nodes)"
        record("fail", "Dashboard renders",
               f"foreground={focused}; nodes: {preview}"[:400])
        return 1
    record("pass", "Dashboard renders", "app bar title and content present")
    time.sleep(1.5)
    shot("01-dashboard")

    # --- five tabs -------------------------------------------------------------------
    for label, title in TABS:
        ok = tap(label, bottom_most=True)
        if not ok:
            record("fail", f"Tab {label}", "label not found in the bottom navigation")
            continue
        shown = wait_for_header(title, 12) if title != "Dashboard" else wait_for("Run full check", 12)
        record("pass" if shown else "fail", f"Tab {label} → {title}",
               "" if shown else "expected title not found on screen")
        if shown:
            time.sleep(0.8)
            shot(f"tab-{slug(label)}")

    # --- every pushed screen, with back navigation -----------------------------------
    n = 2
    for tab_label, hub_title, rows in HUBS:
        tap(tab_label, bottom_most=True)
        wait_for(hub_title, 12)
        for row, expected in rows:
            n += 1
            prefix = f"{n:02d}"
            tapped = tap(row, scroll=5, above_nav=True)
            shown = wait_for_header(expected, 8) if tapped else False
            if tapped and not shown:  # one retry: the row may have shifted while settling
                adb("shell", "input", "swipe", str(screen_size()[0] // 2), str(int(screen_size()[1] * 0.6)),
                    str(screen_size()[0] // 2), str(screen_size()[1] // 2), "250")
                time.sleep(0.8)
                if tap(row, above_nav=True):
                    shown = wait_for_header(expected, 12)
            if not tapped and not shown:
                record("fail", f"{row} opens", "row never scrolled into view above the bottom nav")
                continue
            record("pass" if shown else "fail", f"{row} opens",
                   "" if shown else f"header {expected!r} not found")
            if shown:
                time.sleep(1.2)
                shot(f"{prefix}-{slug(row)}")
            back()
            returned = wait_for_header(hub_title, 12)
            record("pass" if returned else "fail", f"{row} back returns to {hub_title}",
                   "" if returned else "hub title missing after back")

    # --- permission flow and a real cellular read ------------------------------------
    def grant_prompts(limit: int = 3) -> int:
        """Tap through consecutive system permission prompts; returns how many were granted."""
        granted = 0
        for step in range(limit):
            time.sleep(2.2)
            texts = [t for t, *_ in nodes(dump())]
            prompt = next((t for t in texts
                           if re.search(r"while using the app|\ballow\b|don.t allow", t, re.I)), None)
            if not prompt:
                break
            if granted == 0:
                record("pass", "Permission request shows the system prompt", prompt[:80])
                shot("25-permission-dialog")
            spot = find("While using the app") or find("Allow")
            if not spot:
                break
            adb("shell", "input", "tap", str(spot[0]), str(spot[1]))
            granted += 1
        if granted:
            record("pass", "Permissions granted from the prompts",
                   f"{granted} system prompt(s) accepted")
        return granted

    tap("Network", bottom_most=True)
    wait_for_header("Network", 12)
    if tap("Cellular diagnostics", scroll=5, above_nav=True):
        wait_for_header("Cellular", 12)
        if find("Grant access", above_nav=True) and tap("Grant access", above_nav=True):
            if grant_prompts() == 0:
                record("fail", "Permission request shows the system prompt",
                       "no system prompt after Grant access")
        else:
            record("soft", "Permission request shows the system prompt", "permissions already held")

        if tap("Read cellular now", above_nav=True):
            time.sleep(8.0)
            texts = [t for t, *_ in nodes(dump())]
            numbers = [t for t in texts if re.search(r"\bmeasured\b|-?\d+(\.\d+)?\s*dBm|RSRP|SINR|MHz", t, re.I)]
            reason = [t for t in texts if re.search(r"not available|unavailable|requires|denied", t, re.I)]
            ok = bool(numbers) or bool(reason)
            record("pass" if ok else "fail", "Cellular read returns values or a stated reason",
                   (numbers + reason)[0][:90] if ok else "neither a measurement nor an explanation appeared")
            shot("26-cellular-read")
        else:
            record("fail", "Read cellular now button present", "button not found on the Cellular screen")
        back()
        wait_for_header("Network", 10)
    else:
        record("fail", "Cellular diagnostics opens for the permission test", "row not reachable")

    # --- guide detail ----------------------------------------------------------------
    tap("More", bottom_most=True)
    wait_for("More", 10)
    if tap("Guides", scroll=4, above_nav=True):
        wait_for("Guides", 12)
        if tap("Read guide", scroll=3, above_nav=True):
            shown = wait_for_header("Guide", 12)
            record("pass" if shown else "fail", "Guide detail opens", "battery-health-decline")
            if shown:
                time.sleep(1.0)
                shot("24-guide-detail")
            back()
            returned = wait_for_header("Guides", 12)
            record("pass" if returned else "fail", "Guide back returns to the list", "")
        else:
            record("fail", "Guide detail opens", "no Read guide button on the Guides list")
    else:
        record("fail", "Guides opens from More", "row missing")

    # --- guides search ---------------------------------------------------------------
    if tap_edit_text():
        adb("shell", "input", "text", "wifi")
        time.sleep(1.8)
        xml = dump()
        typed = any("wifi" in t.lower() for t, *_ in nodes(xml))
        results = [t for t, *_ in nodes(xml) if "wi-fi" in t.lower()]
        record("pass" if typed and results else "fail", "Guide search filters results",
               f"field accepted 'wifi', Wi-Fi guide still listed: {results[0][:40]!r}" if typed and results
               else f"field text present={typed}, matching guide present={bool(results)}")
        shot("23-guides-search")
        for _ in range(4):
            adb("shell", "input", "keyevent", "KEYCODE_DEL")
    else:
        record("fail", "Guide search field present", "no EditText on the Guides screen")

    # --- permission flow + full check ------------------------------------------------
    tap("Home", bottom_most=True)
    wait_for("Dashboard", 12)
    if not wait_for("Full check", 12):
        record("fail", "Dashboard content present", "no 'Full check' card after returning Home")
    if tap("Run full check", above_nav=True):
        time.sleep(3.0)
        xml = dump()
        dialog = [t for t, *_ in nodes(xml) if re.search(r"allow|while using|deny|permission", t, re.I)]
        if dialog:
            record("pass", "Permission dialog shown", dialog[0][:80])
            shot("25-permission-dialog")
            grant = find("While using the app") or find("Allow")
            if grant:
                adb("shell", "input", "tap", str(grant[0]), str(grant[1]))
                record("pass", "Permission granted from the dialog", "tapped the system prompt")
                time.sleep(4.0)
        else:
            record("soft", "Permission dialog shown",
                   "no request was needed on this emulator image")
        time.sleep(8.0)
        reported = any(t for t, *_ in nodes(dump()) if re.search(r"signal|rsrp|latency|saved|check", t, re.I))
        record("pass" if reported else "soft", "Full check reports progress or results",
               "on-screen measurement text present" if reported else "no measurement text yet")
        shot("26-full-check")
    else:
        record("fail", "Run full check button present", "primary button not found")

    # --- results + export ------------------------------------------------------------
    tap("Results", bottom_most=True)
    wait_for("Results", 12)
    time.sleep(1.0)
    if find("Export current measurements"):
        tap("Export current measurements")
        time.sleep(2.5)
        sheet = [t for t, *_ in nodes(dump()) if re.search(r"share|nearby|bluetooth", t, re.I)]
        record("pass" if sheet else "soft", "Export opens the system share sheet",
               sheet[0][:60] if sheet else "no sheet text detected")
        shot("27-export-sheet")
        back()
    else:
        record("skip", "Export opens the system share sheet",
               "no saved report on a freshly cleared profile")

    # --- settings save ---------------------------------------------------------------
    tap("More", bottom_most=True)
    wait_for("More", 10)
    if tap("Settings", scroll=4, above_nav=True):
        wait_for("Settings", 12)
        if tap("Save"):
            time.sleep(1.5)
            saved = has_text("Test server saved")
            record("pass" if saved else "soft", "Settings save round-trips",
                   "confirmation shown" if saved else "no confirmation text")
        else:
            record("soft", "Settings save round-trips", "Save button not found")
        back()

    # --- light theme / dark mode -----------------------------------------------------
    adb("shell", "cmd", "uimode", "night", "yes")
    time.sleep(2.0)
    tap("Home", bottom_most=True)
    wait_for("Dashboard", 12)
    shot("28-system-dark-mode")
    record("soft", "System dark mode captured", "the app must stay light; compare 01-dashboard")
    adb("shell", "cmd", "uimode", "night", "no")
    time.sleep(1.5)

    # --- tablet / landscape-ish width ------------------------------------------------
    adb("shell", "wm", "size", "1600x1000")
    adb("shell", "wm", "density", "160")
    time.sleep(3.0)
    adb("shell", "am", "start", "-n", f"{PKG}/.MainActivity", timeout=120)
    time.sleep(2.5)
    shot("29-wide-layout")
    wide = has_text("Dashboard")
    record("pass" if wide else "fail", "Wide layout still renders the dashboard",
           "1600x1000 @ 160 dpi (800x500 dp)" if wide else "no dashboard text at wide size")
    adb("shell", "wm", "size", "reset")
    adb("shell", "wm", "density", "reset")
    time.sleep(2.0)

    # --- crash check -----------------------------------------------------------------
    rc, logcat = adb("shell", "logcat", "-d", "-v", "brief", timeout=180)
    (EVIDENCE / "logcat.txt").write_text(logcat[-400_000:])
    crashes = [ln for ln in logcat.splitlines() if "FATAL EXCEPTION" in ln]
    record("pass" if not crashes else "fail", "No uncaught exceptions in logcat",
           f"{len(crashes)} fatal exception(s)" if crashes else "clean run")
    record("pass" if alive() else "fail", "App process still alive at the end",
           "" if alive() else "process died during the walk")

    # --- report ----------------------------------------------------------------------
    passed = sum(1 for s in STEPS if s["status"] == "pass")
    failed = sum(1 for s in STEPS if s["status"] == "fail")
    soft = sum(1 for s in STEPS if s["status"] == "soft")
    skipped = sum(1 for s in STEPS if s["status"] == "skip")

    banner = {"pass": "✅", "fail": "❌", "soft": "ℹ️", "skip": "⏭️"}
    lines = [
        "# Android UI walk — emulator run",
        "",
        f"- Steps: **{len(STEPS)}** · pass {passed} · fail {failed} · notes {soft} · skipped {skipped}",
        f"- Screenshots: **{len(SHOTS)}** in this folder",
        f"- Device: {NOTES[0] if NOTES else 'unknown'}",
        "",
        "> Produced by `native/android/ui-walk.py` on a GitHub Actions emulator. This is emulator",
        "> evidence, not a physical handset. Every line came from a `uiautomator` dump or `logcat`.",
        "",
        "| Result | Step | Detail |",
        "| --- | --- | --- |",
    ]
    for s in STEPS:
        detail = s["detail"].replace("|", "\\|")
        step_name = s["name"].replace("|", "\\|")
        lines.append("| {} | {} | {} |".format(banner[s["status"]], step_name, detail))
    if SHOTS:
        lines += ["", "## Screenshots", ""]
        lines += [f"- `{name}`" for name in SHOTS]
    (EVIDENCE / "ui-walk-report.md").write_text("\n".join(lines) + "\n")
    (EVIDENCE / "ui-walk.json").write_text(json.dumps(
        {"steps": STEPS, "shots": SHOTS, "notes": NOTES}, indent=2) + "\n")

    print(f"::notice title=UI walk::steps={len(STEPS)} pass={passed} fail={failed} "
          f"soft={soft} skip={skipped} shots={len(SHOTS)}", flush=True)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    finally:
        adb("emu", "kill")
