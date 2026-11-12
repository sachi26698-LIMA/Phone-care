import type { Metadata } from "next";
import { AssistantView } from "@/components/views/assistant-view";

export const metadata: Metadata = {
  title: "AI Brain",
  description:
    "Ask questions about your diagnostic readings. The assistant explains results, flags missing data and links research-backed guides.",
  alternates: { canonical: "/assistant" },
};

export default function AssistantPage() {
  return <AssistantView />;
}
