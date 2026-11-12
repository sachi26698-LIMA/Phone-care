import type { Metadata } from "next";
import { NetworkNav } from "@/components/network/network-nav";
import { TroubleshootLab } from "@/components/network/troubleshoot-lab";
import { SectionTitle } from "@/components/ui/misc";

export const metadata: Metadata = {
  title: "Network troubleshooting workflow",
  description:
    "Classify a network problem from measured latency, jitter, probe failures and user-supplied signal values, then compare before and after without overstating the result.",
};

export default function TroubleshootPage() {
  return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="Network lab · workflow"
        title="Troubleshooting that admits uncertainty"
        description="Separate coverage from congestion from DNS. Every conclusion lists the numbers behind it, the inputs that are missing, and a re-measurement step — because a fix you have not measured is a guess."
      />
      <NetworkNav />
      <TroubleshootLab />
    </div>
  );
}
