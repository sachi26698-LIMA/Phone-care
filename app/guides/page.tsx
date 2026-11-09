import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Clock } from "lucide-react";
import { GUIDES } from "@/lib/guides";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Troubleshooting guides",
  description:
    "Research-backed troubleshooting playbooks for battery wear, storage pressure, slow networks, overheating, touch faults and display defects.",
  alternates: { canonical: "/guides" },
};

const CATEGORY_TONE: Record<string, string> = {
  Battery: "border-good/30 bg-good/[0.06]",
  Storage: "border-accent/30 bg-accent/[0.06]",
  Network: "border-info/30 bg-info/[0.06]",
  Thermal: "border-bad/25 bg-bad/[0.05]",
  Display: "border-violet/30 bg-violet/[0.06]",
  Performance: "border-warn/25 bg-warn/[0.05]",
  Methodology: "border-line bg-surface-2/40",
};

export default function GuidesPage() {
  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent/85">
          Knowledge base
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-fg sm:text-[32px]">
          Troubleshooting guides
        </h1>
        <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
          Eight playbooks written for real symptoms, each with a sequence of checks, the safety limits
          that matter, and the sources behind the advice.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {GUIDES.map((guide) => (
          <Link key={guide.slug} href={`/guides/${guide.slug}`} className="group">
            <Card className="h-full transition-all duration-300 group-hover:border-line group-hover:shadow-[0_20px_50px_-30px_rgba(103,232,249,0.3)]">
              <CardContent className="flex h-full flex-col p-5">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted ${
                      CATEGORY_TONE[guide.category] ?? "border-line bg-surface-2/40"
                    }`}
                  >
                    {guide.category}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-faint">
                    <Clock className="size-3" aria-hidden="true" />
                    {guide.readMinutes} min
                  </span>
                </div>
                <h2 className="mt-3 font-display text-[15px] font-semibold leading-snug text-fg transition-colors group-hover:text-accent">
                  {guide.title}
                </h2>
                <p className="mt-1.5 line-clamp-3 text-[12px] leading-relaxed text-muted">
                  {guide.summary}
                </p>
                <div className="mt-auto flex items-center gap-2 pt-4 text-[11px] text-accent">
                  Read guide
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl border border-line-soft bg-surface-2 text-accent">
            <BookOpen className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="font-display text-sm font-semibold text-fg">Want device-specific steps?</p>
            <p className="text-[11.5px] text-muted">
              Run a scan, then ask the AI Brain to prioritise against your readings.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="good">Research-backed</Badge>
          <Link
            href="/assistant"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline"
          >
            Ask the AI Brain
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </Card>
    </div>
  );
}
