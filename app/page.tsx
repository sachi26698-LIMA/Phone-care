import type { Metadata } from "next";
import { DashboardView } from "@/components/views/dashboard-view";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "A live, evidence-labelled overview of your smartphone's battery, storage, network, thermal, display and performance signals.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return <DashboardView />;
}
