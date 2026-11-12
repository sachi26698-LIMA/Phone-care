import type { Metadata } from "next";
import { NetworkNav } from "@/components/network/network-nav";
import { QualityLab } from "@/components/network/quality-lab";
import { SectionTitle } from "@/components/ui/misc";

export const metadata: Metadata = {
  title: "Internet quality test",
  description:
    "Repeated latency probes with jitter, failure rate, DNS and TTFB timing, directional throughput and an RFC 6349-style validity gate before any score is published.",
};

export default function QualityPage() {
  return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="Network lab · measurement"
        title="Internet quality test"
        description="Median and minimum round-trip time, jitter, HTTP probe failures, DNS lookup, time to first byte, and directional throughput against this deployment. If the link is too unstable, the index is withheld rather than invented."
      />
      <NetworkNav />
      <QualityLab />
    </div>
  );
}
