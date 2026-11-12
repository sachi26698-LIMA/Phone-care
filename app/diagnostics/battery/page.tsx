import type { Metadata } from "next";
import { BatteryView } from "@/components/views/battery-view";

export const metadata: Metadata = {
  title: "Battery & health",
  description:
    "Live charge level and charging state where the Battery Status API exists, plus a transparent battery-health estimate from capacities you enter.",
};

export default function BatteryPage() {
  return <BatteryView />;
}
