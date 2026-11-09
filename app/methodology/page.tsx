import type { Metadata } from "next";
import { ArrowUpRight, Lock, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EvidenceBadge } from "@/components/ui/evidence-badge";
import { MODULES } from "@/lib/modules";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "Exactly how every PhoneCare reading is obtained, which metrics a browser cannot access, and how your data stays on your device.",
  alternates: { canonical: "/methodology" },
};

const EVIDENCE = [
  {
    level: "measured" as const,
    title: "Measured",
    body: "Taken live from a browser API or produced by a test running in this session — screen geometry, feature detection, throughput, frame timing, compute throughput and, in Chromium, battery level and charging state.",
  },
  {
    level: "estimated" as const,
    title: "Estimated",
    body: "Computed by PhoneCare from other signals. Battery health from capacities you enter, thermal pressure from benchmark throttling, connection class from recent traffic. Useful, but never presented as a sensor reading.",
  },
  {
    level: "user" as const,
    title: "You provided",
    body: "Typed in by you, typically copied from your phone's settings. PhoneCare cannot verify these values, so it labels them and uses them transparently in calculations.",
  },
  {
    level: "unavailable" as const,
    title: "Unavailable",
    body: "The web platform does not expose it. Battery temperature, voltage, cycle count, CPU temperature, total disk usage and signal strength all live here. We show them as unavailable rather than inventing a plausible number.",
  },
];

const LIMITS = [
  ["Battery level & charging state", "Chromium only (Battery Status API). Removed from Firefox, never shipped in Safari.", "Measured"],
  ["Battery capacity / health", "Not exposed by any browser. Estimated only from user-entered capacities.", "Estimated"],
  ["Battery temperature, voltage", "Not exposed to any web page.", "Unavailable"],
  ["Device disk usage", "Browsers hide it. Storage API reports this origin's quota only.", "Unavailable"],
  ["RAM", "Chromium reports a coarse class (≤8 GB); Safari and Firefox hide it.", "Measured (coarse)"],
  ["CPU cores", "navigator.hardwareConcurrency; browsers may clamp for privacy.", "Measured"],
  ["Network throughput", "Measured against this site's own endpoints; includes path to host.", "Measured"],
  ["Connection type (4G/3G)", "Coarse browser-computed bucket, Chromium only.", "Estimated"],
  ["Public IP / ISP", "Would need a third-party service. Deliberately not contacted.", "Unavailable"],
  ["Device temperature", "No web API exists. Throttling under load is inferred instead.", "Unavailable"],
  ["Display defects", "Requires human observation; patterns help your eyes, not a sensor.", "Your input"],
  ["Refresh rate", "Inferred from animation-frame cadence when the sample is plausible; reported unavailable in throttled tabs.", "Estimated / unavailable"],
  ["Touch coverage", "Measured from pointer events over a test grid.", "Measured"],
];

export default function MethodologyPage() {
  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-purple">
          Methodology
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-fg sm:text-[32px]">
          What a browser can know — and what it cannot
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          PhoneCare is built on a single rule: never present an inference as a measurement. This page
          documents every data source, every estimate, and the limits that are inherent to running
          diagnostics inside a web page.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        {EVIDENCE.map((item) => (
          <Card key={item.level}>
            <CardContent className="p-5">
              <div className="flex items-center gap-2">
                <EvidenceBadge level={item.level} />
                <span className="text-[11px] uppercase tracking-[0.12em] text-faint">
                  {item.title}
                </span>
              </div>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted">{item.body}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Reading-by-reading limits</CardTitle>
            <p className="mt-1 text-[11.5px] text-faint">
              The complete map of what produces each class of value
            </p>
          </div>
          <Badge tone="neutral">13 rows</Badge>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-[0.12em] text-faint">
                  <th className="py-2 pr-4 font-semibold">Signal</th>
                  <th className="py-2 pr-4 font-semibold">How it is obtained</th>
                  <th className="py-2 font-semibold">Class</th>
                </tr>
              </thead>
              <tbody>
                {LIMITS.map(([signal, how, cls]) => (
                  <tr key={signal} className="border-b border-line-soft last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-fg">{signal}</td>
                    <td className="py-2.5 pr-4 leading-relaxed text-muted">{how}</td>
                    <td className="py-2.5 whitespace-nowrap text-faint">{cls}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Module sources</CardTitle>
              <p className="mt-1 text-[11.5px] text-faint">What each module relies on</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {MODULES.map((meta) => (
              <div key={meta.id} className="border-b border-line-soft pb-2.5 last:border-0">
                <p className="text-[12px] font-medium text-fg">{meta.title}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{meta.evidenceNote}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Permissions policy</CardTitle>
                <p className="mt-1 text-[11.5px] text-faint">
                  Nothing is requested by default — and nothing can unlock hardware
                </p>
              </div>
              <Badge tone="good">Zero required</Badge>
            </CardHeader>
            <CardContent className="space-y-3 text-[12px] leading-relaxed text-muted">
              <p>
                <span className="font-medium text-fg">Required: none.</span> All nine modules run
                without a permission prompt. Device identity, storage quota, network throughput,
                compatibility, performance and the guided tests use APIs that need no grant.
              </p>
              <div className="rounded-lg border border-line-soft bg-surface-2/60 p-3">
                <p className="font-medium text-fg">Optional: persistent storage</p>
                <p className="mt-1">
                  Asked in the storage module, with the reason shown first. It stops the browser
                  evicting your saved report; it does not read your disk or free space.
                </p>
                <p className="mt-1 text-[11px] text-faint">
                  States handled: granted, declined without a prompt, blocked (NotAllowedError),
                  unsupported API. The module keeps working in every case.
                </p>
              </div>
              <div className="rounded-lg border border-line-soft bg-surface-2/60 p-3">
                <p className="font-medium text-fg">Optional: screen wake lock</p>
                <p className="mt-1">
                  Offered inside the display test so patterns do not vanish mid-check. It is requested
                  from the button click, released when you close the test, and never reads the screen.
                </p>
                <p className="mt-1 text-[11px] text-faint">
                  States handled: active, released, declined (NotAllowedError), unsupported browser.
                </p>
              </div>
              <p className="rounded-lg border border-warn/25 bg-warn/[0.05] p-3 text-[11.5px] text-warn">
                <span className="font-semibold">No permission unlocks hardware.</span> Camera,
                location or notification grants cannot reveal battery capacity, temperature, cycle
                count, CPU heat or total disk usage. Any site claiming otherwise is guessing.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Privacy & security</CardTitle>
                <p className="mt-1 text-[11.5px] text-faint">Local-first by architecture</p>
              </div>
              <ShieldCheck className="size-4 text-good" aria-hidden="true" />
            </CardHeader>
            <CardContent className="space-y-2.5 text-[12px] leading-relaxed text-muted">
              <p>
                <span className="font-medium text-fg">No upload of readings.</span> Diagnostics run in
                the browser. Results persist in localStorage on this device and can be cleared from the
                report page.
              </p>
              <p>
                <span className="font-medium text-fg">No third-party services.</span> The only network
                requests go to this site&rsquo;s own probe endpoints for throughput testing. No
                analytics, advertising or IP-lookup providers are contacted.
              </p>
              <p>
                <span className="font-medium text-fg">No secrets in the client.</span> The optional
                enhanced assistant is proxied server-side via environment variables that never reach
                the browser. Without configuration, the deterministic local engine is used.
              </p>
              <p>
                <span className="font-medium text-fg">Hardened defaults.</span> Security headers
                (nosniff, frame options, referrer policy, permissions policy, HSTS) are set at the edge,
                and the speed-test endpoints cap payload sizes.
              </p>
              <div className="flex items-center gap-2 rounded-lg border border-line-soft bg-surface-2/30 px-3 py-2">
                <Lock className="size-3.5 text-good" aria-hidden="true" />
                <span className="text-[10.5px] text-muted">
                  Environment variables: NEXT_PUBLIC_SITE_URL, ASSISTANT_API_URL, ASSISTANT_API_KEY,
                  ASSISTANT_MODEL
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Why browsers disagree</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[12px] leading-relaxed text-muted">
              <p>
                Chrome and Edge expose battery, memory and network hints. Firefox removed the Battery
                Status API in version 52; Safari never shipped it. Both cite fingerprinting risk.
              </p>
              <p>
                On iPhone every browser runs on WebKit, so installing Chrome does not add APIs that
                Safari withholds. That constraint is the operating system, not the browser brand.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Architecture & quality notes</CardTitle>
          <Badge tone="info">Next.js App Router</Badge>
        </CardHeader>
        <CardContent className="grid gap-4 text-[12px] leading-relaxed text-muted sm:grid-cols-2">
          <div>
            <p className="font-medium text-fg">Server-first rendering, client islands</p>
            <p className="mt-1">
              Static content, guides and metadata render on the server. Only diagnostic views that need
              browser APIs are client components, which keeps the initial bundle small.
            </p>
          </div>
          <div>
            <p className="font-medium text-fg">Backend only where necessary</p>
            <p className="mt-1">
              Three route handlers exist: latency probe, capped download stream, and upload sink — plus
              the optional assistant proxy. There is no database and no account system to breach.
            </p>
          </div>
          <div>
            <p className="font-medium text-fg">Accessibility</p>
            <p className="mt-1">
              Semantic landmarks, visible focus, keyboard-operable controls, reduced-motion support, and
              colour never used as the only signal.
            </p>
          </div>
          <div>
            <p className="font-medium text-fg">Truthfulness as a test case</p>
            <p className="mt-1">
              Every reading declares its evidence level in the type system, so an unavailable metric
              cannot silently be rendered as a value without a visible label.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Primary sources</CardTitle>
          <ArrowUpRight className="size-4 text-faint" aria-hidden="true" />
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {[
            { label: "MDN · Battery Status API", url: "https://developer.mozilla.org/en-US/docs/Web/API/Battery_Status_API" },
            { label: "MDN · StorageManager.estimate()", url: "https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate" },
            { label: "MDN · Network Information API", url: "https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API" },
            { label: "MDN · Navigator.deviceMemory", url: "https://developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory" },
            { label: "Chrome for Developers · Estimating storage space", url: "https://developer.chrome.com/blog/estimating-available-storage-space" },
            { label: "web.dev · Core Web Vitals", url: "https://web.dev/articles/vitals" },
            { label: "Apple · Maximising battery lifespan", url: "https://www.apple.com/batteries/maximizing-performance/" },
            { label: "Android Help · Free up storage", url: "https://support.google.com/android/answer/7436584" },
          ].map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-start gap-1 text-[11.5px] leading-relaxed text-purple hover:text-accent hover:underline"
            >
              {source.label}
              <ArrowUpRight className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            </a>
          ))}
        </CardContent>
      </Card>

      <p className="rounded-xl border border-line-soft bg-surface/30 px-4 py-3 text-[11px] leading-relaxed text-faint">
        PhoneCare is a diagnostic aid, not a certification. It cannot detect all faults, and a clean
        report does not guarantee a healthy device. For safety issues — a swollen battery, burning
        smell, or heat at rest — stop using the device and consult an authorised service centre.
      </p>
    </div>
  );
}
