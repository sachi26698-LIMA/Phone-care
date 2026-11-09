import type { Metadata } from "next";
import { DeviceView } from "@/components/views/device-view";

export const metadata: Metadata = {
  title: "Device information",
  description:
    "Browser-reported smartphone model, platform, screen geometry, GPU, memory class and language signals with clear provenance.",
};

export default function DevicePage() {
  return <DeviceView />;
}
