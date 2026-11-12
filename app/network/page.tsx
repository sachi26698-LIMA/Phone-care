import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowRight, Gauge, Home, ShieldCheck, Wifi } from "lucide-react";
import { NetworkNav } from "@/components/network/network-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, LinkButton } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/misc";
import { CAPABILITIES, type Support } from "@/lib/diagnostic/capabilities";

export const metadata: Metadata = {
  title: "Network lab",
  description:
    "Measured internet quality, room-by-room indoor surveys and rule-based troubleshooting — with an honest capability matrix of what browsers and phones can actually read.",
};

const SUPPORT_LABEL: Record<Support, { label: string; tone: "good" | "warn" | "bad" | "neutral" }> = {
  yes: { label: "Yes", tone: "good" },
  partial: { label: "Partial", tone: "warn" },
  permission: { label: "Permission", tone: "warn" },
  no: { label: "No", tone: "neutral" },
};

const TOOLS = [
  {
    href: "/network/quality",
    title: "Internet quality test",
    description:
      "Repeated probes with median, minimum, jitter, failure rate, DNS and TTFB; directional throughput with RFC 6349 style validity gates. Exports a report against the shared schema.",
    icon: Gauge,
  },
  {
    href: "/network/survey",
    title: "Indoor signal survey",
    description:
      "Name your rooms, measure each one at least three times, and compare. Weak spots are ranked by measured latency and probe failures — no invented heatmap.",
    icon: Home,
  },
  {
    href: "/network/troubleshoot",
    title: "Troubleshooting workflow",
    description:
      "Classify the cause from the numbers you already have: Wi-Fi coverage, cellular coverage, congestion, DNS or instability. Then re-measure and compare.",
    icon: Activity,
  },
] as const;

export default function NetworkPage() {
  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Network lab"
        title="What can actually be measured — and what cannot"
        description="The browser can measure the internet path. Only the phone can read the radio. This lab keeps those two claims separate, which is why it can be trusted with the numbers it does produce."
        actions={
          <LinkButton href="/network/quality" size="sm">
            Run a quality test
            <ArrowRight className="size-4" aria-hidden="true" />
          </LinkButton>
        }
      />
      <NetworkNav />

      <div className="grid gap-3 md:grid-cols-3">
        {TOOLS.map(({ href, title, description, icon: Icon }) => (
          <Card key={href} className="flex flex-col">
            <CardContent className="flex flex-1 flex-col p-5">
              <span className="grid size-9 place-items-center rounded-xl border border-purple/20 bg-purple/[0.07] text-purple">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <h2 className="mt-3 font-display text-[15px] font-semibold text-fg">{title}</h2>
              <p className="mt-1.5 flex-1 text-[12.5px] leading-relaxed text-muted">{description}</p>
              <Link
                href={href}
                className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-purple hover:text-indigo"
              >
                Open <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Capability matrix</CardTitle>
            <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-muted">
              Sourced from Android and Apple documentation plus browser specifications; the reasoning is
              recorded in <code className="rounded bg-surface-2 px-1 py-0.5 text-[11px]">docs/native/RESEARCH-NETWORK-CELLULAR.md</code>.
            </p>
          </div>
          <Badge tone="neutral">v1 · 2026-11</Badge>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[860px] table-fixed border-collapse text-left">
              <caption className="sr-only">
                Network measurement capabilities by platform. Web means this browser app, Android the native
                Kotlin app, iOS a hypothetical native app.
              </caption>
              <colgroup>
                <col className="w-[20%]" />
                <col className="w-[13%]" />
                <col className="w-[15%]" />
                <col className="w-[11%]" />
                <col className="w-[41%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.12em] text-faint">
                  <th scope="col" className="px-2 py-2 font-semibold">Capability</th>
                  <th scope="col" className="px-2 py-2 font-semibold">Web</th>
                  <th scope="col" className="px-2 py-2 font-semibold">Android</th>
                  <th scope="col" className="px-2 py-2 font-semibold">iOS</th>
                  <th scope="col" className="px-2 py-2 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody className="text-[12.5px]">
                {CAPABILITIES.map((row) => (
                  <tr key={row.capability} className="border-b border-line-soft/70 align-top last:border-0">
                    <th scope="row" className="px-2 py-2.5 font-medium text-fg">{row.capability}</th>
                    {(["web", "android", "ios"] as const).map((platform) => {
                      const meta = SUPPORT_LABEL[row[platform]];
                      return (
                        <td key={platform} className="px-2 py-2.5">
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                          <span className="mt-1 block break-words text-[10.5px] leading-snug text-faint">
                            {row[platform] === "no"
                              ? "—"
                              : platform === "web"
                                ? row.webApi
                                : platform === "ios"
                                  ? (row.iosApi ?? row.nativeApi)
                                  : row.nativeApi}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-2 py-2.5 text-[11.5px] leading-snug text-muted">
                      <span className="block break-words">{row.note}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-good" aria-hidden="true" />
              What this lab will never claim
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <ul className="space-y-2.5 text-[12.5px] leading-relaxed text-muted">
              <li>· That it boosts, amplifies or repairs a signal. No app can raise radio power.</li>
              <li>· That it measured RSRP, SINR or Wi-Fi RSSI in a browser. Those rows are null by design.</li>
              <li>· That one speed test describes your connection. It describes a moment.</li>
              <li>· That a change helped when the difference is inside the noise band.</li>
              <li>· That packet loss occurred. Browsers only see HTTP probe failures.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="size-4 text-purple" aria-hidden="true" />
              Native Android app
            </CardTitle>
            <Badge tone="warn">Not compiled here</Badge>
          </CardHeader>
          <CardContent className="space-y-3 pt-3">
            <p className="text-[12.5px] leading-relaxed text-muted">
              The Kotlin collector lives in <code className="rounded bg-surface-2 px-1 py-0.5 text-[11px]">native/android/</code> and
              emits the same <code className="rounded bg-surface-2 px-1 py-0.5 text-[11px]">DiagnosticReport</code> this site validates.
              It reads LTE/NR signal metrics, dual-SIM state and Wi-Fi link data, with every value tagged with availability and
              permission state.
            </p>
            <p className="text-[12.5px] leading-relaxed text-muted">
              It has <strong className="font-semibold text-fg">not been compiled or run</strong> in this build environment: no JDK,
              Gradle or Android SDK is available. The native readings on this page therefore come from documented APIs, not
              from a device.
            </p>
            <Button variant="outline" size="sm" disabled title="Requires an installed Android build">
              Install the Android app — not available yet
            </Button>
          </CardContent>
        </Card>
      </div>

      <p className="text-[11.5px] leading-relaxed text-faint">
        Methodology: RFC 6349 for directional throughput and minimum-RTT baselines, ITU-T Y.1541 for latency bands,
        RFC 3550-style jitter, 3GPP band definitions for RSRP/RSRQ/SINR. PhoneCare makes no RFC 6349 compliance claim —
        it borrows the method, not the certification.
      </p>
    </div>
  );
}
