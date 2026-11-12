import type { Metadata } from "next";
import { CompatibilityView } from "@/components/views/compatibility-view";

export const metadata: Metadata = {
  title: "Browser compatibility",
  description:
    "A 36-point feature matrix showing which diagnostic APIs your browser exposes, and what that means for the readings you can get.",
};

export default function CompatibilityPage() {
  return <CompatibilityView />;
}
