import type { Metadata } from "next";
import { TouchLab } from "@/components/views/touch-lab";

export const metadata: Metadata = {
  title: "Touch interaction test",
  description:
    "Map touchscreen dead zones and multi-touch capability with a live 40-zone grid test.",
};

export default function TouchPage() {
  return <TouchLab />;
}
