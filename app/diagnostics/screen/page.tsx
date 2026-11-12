import type { Metadata } from "next";
import { ScreenLab } from "@/components/views/screen-lab";

export const metadata: Metadata = {
  title: "Screen & display test",
  description:
    "Full-screen colour, greyscale, gradient and pixel patterns for checking dead pixels and uniformity, plus browser-measured display metadata.",
};

export default function ScreenPage() {
  return <ScreenLab />;
}
