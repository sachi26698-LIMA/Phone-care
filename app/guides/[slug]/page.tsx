import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Clock, ShieldAlert, TriangleAlert } from "lucide-react";
import { GUIDES, getGuide } from "@/lib/guides";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return { title: "Guide not found" };
  return {
    title: guide.title,
    description: guide.summary,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: { title: guide.title, description: guide.summary, type: "article" },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const related = GUIDES.filter((g) => g.slug !== guide.slug && g.category === guide.category).slice(0, 2);
  const fallback = GUIDES.filter((g) => g.slug !== guide.slug).slice(0, 2);
  const relatedGuides = related.length > 0 ? related : fallback;

  return (
    <article className="space-y-6">
      <Link
        href="/guides"
        className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-3.5" />
        All guides
      </Link>

      <header className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{guide.category}</Badge>
          <span className="inline-flex items-center gap-1 text-[11px] text-faint">
            <Clock className="size-3" aria-hidden="true" />
            {guide.readMinutes} min read
          </span>
          <span className="text-[11px] text-faint">Updated {guide.updated}</span>
        </div>
        <h1 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-tight text-fg sm:text-[34px]">
          {guide.title}
        </h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-muted">{guide.summary}</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardContent className="p-5 sm:p-6">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
                Typical symptoms
              </h2>
              <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {guide.symptoms.map((symptom) => (
                  <p key={symptom} className="flex gap-2 text-[12.5px] leading-relaxed text-muted">
                    <span className="mt-[7px] size-1 shrink-0 rounded-full bg-accent/70" aria-hidden="true" />
                    {symptom}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>

          <div>
            <h2 className="mb-3 font-display text-lg font-semibold text-fg">What to do, in order</h2>
            <ol className="space-y-3">
              {guide.steps.map((step, index) => (
                <li key={step.title}>
                  <Card>
                    <CardContent className="flex gap-4 p-5">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-accent/25 bg-accent/[0.08] font-display text-[12px] font-semibold text-accent">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h3 className="font-display text-[14px] font-semibold text-fg">{step.title}</h3>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{step.detail}</p>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          </div>

          {guide.warning ? (
            <div className="flex gap-3 rounded-xl border border-bad/30 bg-bad/[0.07] p-4">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden="true" />
              <div>
                <p className="text-[12px] font-semibold text-bad">Safety note</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{guide.warning}</p>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
                <ShieldAlert className="size-3.5" aria-hidden="true" />
                Sources
              </h2>
              <ul className="mt-3 space-y-2">
                {guide.sources.map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-start gap-1 text-[11.5px] leading-relaxed text-accent/85 hover:text-accent hover:underline"
                    >
                      {source.label}
                      <ArrowUpRight className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-line-soft pt-3 text-[10.5px] leading-relaxed text-faint">
                Guidance combines platform documentation with the diagnostic limits documented in
                PhoneCare&rsquo;s methodology. It is not a warranty determination.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
                Test it on your device
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                Run the matching module to see whether this applies to you.
              </p>
              <LinkButton href="/diagnostics" variant="secondary" size="sm" className="mt-3">
                Open diagnostics
              </LinkButton>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
                Related guides
              </p>
              <div className="mt-3 space-y-2.5">
                {relatedGuides.map((item) => (
                  <Link
                    key={item.slug}
                    href={`/guides/${item.slug}`}
                    className="block text-[12px] leading-snug text-muted transition-colors hover:text-accent"
                  >
                    {item.title}
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </article>
  );
}
