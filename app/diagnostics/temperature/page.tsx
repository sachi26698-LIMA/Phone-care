import type { Metadata } from "next";
import { TemperatureView } from "@/components/views/temperature-view";

export const metadata: Metadata = {
  title: "Thermal state",
  description:
    "No browser can read your phone's temperature. PhoneCare infers thermal throttling from sustained-load benchmarks and labels it as an estimate.",
};

export default function TemperaturePage() {
  return <TemperatureView />;
}
