#!/usr/bin/env node
/**
 * Automated feature-parity checklist (Phase 6 deliverable, re-run in Phase 7).
 *
 * Reads the website's real route tree and the Android app's real Screen enum, then asserts:
 *   1. every website page route is mapped to at least one Android screen;
 *   2. every mapped screen title exists in `Screen(...)` in ui/Host.kt;
 *   3. no Android screen is orphaned (unmapped and unlisted as native-only);
 *   4. every screen is actually reachable — its constant is passed to navigate() somewhere;
 *   5. every API route is accounted for (native equivalent or explicitly server-only).
 *
 * It cannot tell you whether a screen *looks* right; that is what the emulator walk is for.
 * It does catch the failure mode this project cares about: a website module quietly losing its
 * native counterpart, or a native screen that nothing can reach.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HOST_KT = path.join(ROOT, 'native/android/app/src/main/java/app/phonecare/diagnostics/ui/Host.kt');
const SCREENS_DIR = path.join(ROOT, 'native/android/app/src/main/java/app/phonecare/diagnostics/screens');

/** website route → Android screen title(s). `null` means "web-only by design". */
const ROUTES = {
  '/': ['Dashboard'],
  '/diagnostics': ['Diagnostics'],
  '/diagnostics/device': ['Device identity'],
  '/diagnostics/battery': ['Battery & health'],
  '/diagnostics/storage': ['Storage'],
  '/diagnostics/temperature': ['Temperature'],
  '/diagnostics/screen': ['Display'],
  '/diagnostics/touch': ['Touch'],
  '/diagnostics/performance': ['Performance'],
  '/diagnostics/compatibility': ['Compatibility'],
  '/diagnostics/network': ['Cellular', 'Wi-Fi'],
  '/network': ['Network'],
  '/network/quality': ['Internet quality'],
  '/network/survey': ['Indoor survey'],
  '/network/troubleshoot': ['Troubleshoot'],
  '/results': ['Results'],
  '/guides': ['Guides'],
  '/guides/[slug]': ['Guide'],
  '/assistant': ['Assistant'],
  '/methodology': ['Methodology'],
};

/** Screens that exist only on the phone, with the reason they do. */
const NATIVE_ONLY = {
  'Settings': 'the website keeps preferences in localStorage on one device; a phone needs a test-server field',
  'Privacy & permissions': 'native permission state has no browser equivalent',
  'More': 'navigation container for the screens above',
};

/** API route → how the native app satisfies it. */
const API = {
  '/api/assistant': 'deterministic rule engine in core/ReportBuilder + Assistant screen (no network)',
  '/api/health': 'not needed: the app talks to the test server directly',
  '/api/network/ping': 'Quality screen measures latency to the configured test server itself',
  '/api/network/download': 'Quality screen downloads from the test server itself',
  '/api/network/upload': 'Quality screen uploads to the test server itself',
  '/api/reports': 'core/HistoryStore keeps reports in app-private storage; export shares JSON',
};

const problems = [];
const rows = [];

function walk(dir, base = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(base, entry.name);
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

// ---- 1. website routes ------------------------------------------------------------------
const pageFiles = walk(path.join(ROOT, 'app'))
  .filter((f) => f.endsWith('page.tsx'))
  .map((f) => '/' + f.replace(/page\.tsx$/, '').replace(/\/$/, ''))
  .map((r) => (r === '/' ? '/' : r.replace(/\/$/, '')))
  .sort();

const routeSet = new Set(pageFiles);
for (const route of pageFiles) {
  const mapped = ROUTES[route];
  if (!mapped) {
    problems.push(`website route ${route} has no Android counterpart in the audit table`);
    rows.push({ kind: 'route', item: route, native: 'MISSING', ok: false });
  } else {
    rows.push({ kind: 'route', item: route, native: mapped.join(' + '), ok: true });
  }
}
for (const route of Object.keys(ROUTES)) {
  if (!routeSet.has(route)) problems.push(`audit table lists ${route}, which no longer exists on the website`);
}
for (const route of Object.keys(ROUTES)) {
  void route;
}

// ---- 2. Android Screen enum --------------------------------------------------------------
const host = fs.readFileSync(HOST_KT, 'utf8');
const enumBody = host.slice(host.indexOf('enum class Screen'), host.indexOf('companion object'));
const screens = [...enumBody.matchAll(/^\s{4}([A-Z_]+)\("([^"]+)",\s*(Tab\.[A-Z]+|null)/gm)].map((m) => ({
  constant: m[1],
  title: m[2],
  tab: m[3] === 'null' ? null : m[3],
}));
const titles = new Map(screens.map((s) => [s.title, s]));

for (const row of rows.filter((r) => r.ok)) {
  for (const title of row.native.split(' + ')) {
    if (!titles.has(title)) {
      problems.push(`screen title "${title}" (for ${row.item}) is not in the Kotlin Screen enum`);
      row.ok = false;
    }
  }
}

// ---- 3. orphans ---------------------------------------------------------------------------
const mappedTitles = new Set(Object.values(ROUTES).flat());
for (const screen of screens) {
  if (!mappedTitles.has(screen.title) && !(screen.title in NATIVE_ONLY)) {
    problems.push(`Android screen "${screen.title}" is neither mapped from a route nor declared native-only`);
  }
  if (screen.title in NATIVE_ONLY) {
    rows.push({ kind: 'native', item: screen.title, native: NATIVE_ONLY[screen.title], ok: true });
  }
}
const declaredNativeOnly = Object.keys(NATIVE_ONLY).filter((t) => !titles.has(t));
for (const title of declaredNativeOnly) {
  problems.push(`native-only list mentions "${title}", which the app no longer has`);
}

// ---- 4. reachability ----------------------------------------------------------------------
const screenSources = fs
  .readdirSync(SCREENS_DIR)
  .filter((f) => f.endsWith('.kt'))
  .map((f) => fs.readFileSync(path.join(SCREENS_DIR, f), 'utf8'))
  .join('\n');
const mainActivity = fs.readFileSync(path.join(ROOT, 'native/android/app/src/main/java/app/phonecare/diagnostics/MainActivity.kt'), 'utf8');

const tabRootsUseForTab = mainActivity.includes('Screen.forTab');
for (const screen of screens) {
  // Tab roots are opened through forTab(); every pushed screen must be navigated to by name.
  const referenced = screen.tab
    ? tabRootsUseForTab
    : screenSources.includes(`Screen.${screen.constant}`) || mainActivity.includes(`Screen.${screen.constant}`);
  if (!referenced) {
    problems.push(`Screen.${screen.constant} ("${screen.title}") is never navigated to`);
  }
}

// ---- 5. API routes ------------------------------------------------------------------------
const apiFiles = walk(path.join(ROOT, 'app/api'))
  .filter((f) => f.endsWith('route.ts'))
  .map((f) => '/api/' + f.replace(/route\.ts$/, '').replace(/\/$/, ''))
  .sort();
for (const route of apiFiles) {
  if (!(route in API)) {
    problems.push(`API route ${route} has no documented native strategy`);
    rows.push({ kind: 'api', item: route, native: 'UNDOCUMENTED', ok: false });
  } else {
    rows.push({ kind: 'api', item: route, native: API[route], ok: true });
  }
}
for (const route of Object.keys(API)) {
  if (!apiFiles.includes(route)) problems.push(`API table lists ${route}, which no longer exists`);
}

// ---- report -------------------------------------------------------------------------------
const w = (s, n) => String(s).padEnd(n);
console.log(`\nwebsite routes: ${pageFiles.length}   android screens: ${screens.length}   api routes: ${apiFiles.length}\n`);
for (const row of rows) {
  console.log(`${row.ok ? 'ok  ' : 'FAIL'}  ${w(row.kind, 6)} ${w(row.item, 34)} → ${row.native}`);
}
console.log('');
if (problems.length) {
  for (const p of problems) console.log(`parity: ${p}`);
  console.log(`\nparity audit: ${problems.length} problem(s)\n`);
  process.exit(1);
}
console.log(`parity audit: all ${pageFiles.length} website routes mapped, ${screens.length} screens reachable, ` +
  `${apiFiles.length} API routes accounted for\n`);
