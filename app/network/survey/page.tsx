import type { Metadata } from "next";
import { NetworkNav } from "@/components/network/network-nav";
import { SurveyLab } from "@/components/network/survey-lab";
import { SectionTitle } from "@/components/ui/misc";

export const metadata: Metadata = {
  title: "Indoor signal survey",
  description:
    "Room-by-room network survey with repeatable probe samples, a weak-spot ranking and optional user-entered dBm values. No location tracking, no invented radio data.",
};

export default function SurveyPage() {
  return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="Network lab · indoor mapping"
        title="Indoor survey"
        description="Name the rooms you actually use, take repeated measurements in each, and let the ranking show where the link is weakest. Three samples minimum before a room gets a score."
      />
      <NetworkNav />
      <SurveyLab />
    </div>
  );
}
