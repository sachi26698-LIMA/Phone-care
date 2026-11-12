import type { Metadata } from "next";
import { PerformanceView } from "@/components/views/performance-view";

export const metadata: Metadata = {
  title: "Performance profile",
  description:
    "Session-relative frame cadence, JavaScript compute throughput, hardware concurrency and browser storage speed.",
};

export default function PerformancePage() {
  return <PerformanceView />;
}
