import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/space-grotesk/wght.css";
import "./globals.css";
import { DiagnosticProvider } from "@/context/diagnostic-provider";
import { AppShell } from "@/components/layout/app-shell";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://phonecare.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "PhoneCare AI — Smartphone diagnostics in your browser",
    template: "%s · PhoneCare AI",
  },
  description:
    "A premium, browser-based smartphone diagnostic suite: battery, storage, network, thermal, display, touch and performance checks — with every reading labelled Measured, Estimated or Unavailable.",
  applicationName: "PhoneCare AI",
  keywords: [
    "phone diagnostics",
    "battery health check",
    "smartphone test",
    "touch screen test",
    "network speed test",
    "device information",
    "browser diagnostics",
  ],
  authors: [{ name: "PhoneCare" }],
  creator: "PhoneCare",
  openGraph: {
    type: "website",
    siteName: "PhoneCare AI",
    title: "PhoneCare AI — Smartphone diagnostics, honestly labelled",
    description:
      "Run nine diagnostic modules in your browser. No permissions, no uploads, and no invented readings.",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "PhoneCare AI — Smartphone diagnostics, honestly labelled",
    description:
      "Battery, storage, network, thermal, display and touch diagnostics that tell you what they can and cannot measure.",
  },
  robots: {
    index: true,
    follow: true,
  },
  category: "technology",
};

export const viewport: Viewport = {
  themeColor: "#faf7f3",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <DiagnosticProvider>
          <AppShell>{children}</AppShell>
        </DiagnosticProvider>
      </body>
    </html>
  );
}
