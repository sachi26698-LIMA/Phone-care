import type { Metadata } from "next";
import { ResultsView } from "@/components/views/results-view";

export const metadata: Metadata = {
  title: "Diagnostic report",
  description:
    "A weighted smartphone health report with per-module evidence, prioritised recommendations and JSON export.",
  alternates: { canonical: "/results" },
};

export default function ResultsPage() {
  return <ResultsView />;
}
