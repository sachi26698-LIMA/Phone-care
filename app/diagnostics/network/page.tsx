import type { Metadata } from "next";
import { NetworkView } from "@/components/views/network-view";

export const metadata: Metadata = {
  title: "Network diagnostics",
  description:
    "Measured download, upload and latency against same-origin endpoints, with connection-class hints and no third-party tracking.",
};

export default function NetworkPage() {
  return <NetworkView />;
}
