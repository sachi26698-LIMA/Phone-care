"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CircleAlert,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Note, Spinner } from "@/components/ui/misc";
import { useDiagnostics } from "@/context/diagnostic-provider";
import { summarizeHealth } from "@/lib/scoring";
import { buildRecommendations } from "@/lib/recommendations";
import { answerQuestion, suggestedQuestions, type AssistantReply } from "@/lib/assistant";
import { GUIDES } from "@/lib/guides";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  text?: string;
  reply?: AssistantReply;
}

export function AssistantView() {
  const { state, hydrated } = useDiagnostics();
  const health = summarizeHealth(state);
  const recommendations = useMemo(() => buildRecommendations(state), [state]);
  const ctx = useMemo(() => ({ state, health, recommendations }), [state, health, recommendations]);
  const relevantSlugs = useMemo(
    () => new Set(recommendations.map((rec) => rec.guide).filter((slug): slug is string => Boolean(slug))),
    [recommendations],
  );
  const relatedGuides = useMemo(() => {
    const matched = GUIDES.filter((guide) => relevantSlugs.has(guide.slug));
    return matched.length > 0 ? matched.slice(0, 4) : GUIDES.slice(0, 3);
  }, [relevantSlugs]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [enhancedAvailable, setEnhancedAvailable] = useState(false);
  const [useEnhanced, setUseEnhanced] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const counter = useRef(0);

  useEffect(() => {
    let active = true;
    fetch("/api/assistant")
      .then((res) => res.json())
      .then((data: { enabled?: boolean }) => {
        if (active && data.enabled) {
          setEnhancedAvailable(true);
        }
      })
      .catch(() => {
        // Local engine remains the default.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  const nextId = () => {
    counter.current += 1;
    return `m${counter.current}`;
  };

  const ask = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || thinking) return;
    setInput("");
    setMessages((prev) => [...prev, { id: nextId(), role: "user", text: trimmed }]);
    setThinking(true);

    // Local reasoning first: deterministic, explainable, zero latency.
    const local = answerQuestion(trimmed, ctx);

    if (useEnhanced && enhancedAvailable) {
      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: trimmed,
            context: {
              health,
              modules: Object.fromEntries(
                Object.entries(state.modules).map(([id, mod]) => [
                  id,
                  mod
                    ? {
                        status: mod.status,
                        score: mod.score,
                        summary: mod.summary,
                        readings: mod.readings.map((r) => ({
                          label: r.label,
                          value: r.value,
                          evidence: r.evidence,
                        })),
                      }
                    : null,
                ]),
              ),
              recommendations: recommendations.map((r) => ({
                title: r.title,
                severity: r.severity,
                body: r.body,
              })),
            },
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { answer?: string };
          const answerText = data.answer;
          if (answerText) {
            setMessages((prev) => [
              ...prev,
              {
                id: nextId(),
                role: "assistant",
                reply: {
                  ...local,
                  mode: "enhanced",
                  paragraphs: [answerText, ...local.paragraphs.slice(1)],
                },
              },
            ]);
            setThinking(false);
            return;
          }
        }
      } catch {
        // Fall through to the local answer.
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 260));
    setMessages((prev) => [...prev, { id: nextId(), role: "assistant", reply: local }]);
    setThinking(false);
  };

  const suggestions = suggestedQuestions(state).slice(0, 4);
  const canAsk = Boolean(input.trim()) && !thinking;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent/85">
            AI Brain
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-fg sm:text-[30px]">
            Your diagnostic assistant
          </h1>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted">
            Explanations grounded in this session&rsquo;s readings and the PhoneCare guide library.
            It will tell you when data is missing rather than guessing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={health.runModules > 0 ? "good" : "neutral"}>
            {health.runModules}/9 modules in context
          </Badge>
          <Badge tone="violet">
            <Sparkles className="size-3" />
            {useEnhanced && enhancedAvailable ? "Enhanced model" : "Local reasoning"}
          </Badge>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <Card className="flex min-h-[560px] flex-col">
          <CardHeader className="items-center border-b border-line-soft pb-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-accent/25 to-violet/20 text-accent">
                <Sparkles className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="font-display text-sm font-semibold text-fg">PhoneCare Brain</p>
                <p className="text-[10px] uppercase tracking-[0.14em] text-faint">
                  {health.runModules > 0 ? "Reading your scan" : "No scan data yet"}
                </p>
              </div>
            </div>
            {messages.length > 0 ? (
              <button
                type="button"
                onClick={() => setMessages([])}
                className="inline-flex items-center gap-1 text-[11px] text-faint transition-colors hover:text-fg"
              >
                <RotateCcw className="size-3" />
                Reset
              </button>
            ) : null}
          </CardHeader>

          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5" aria-live="polite">
            {messages.length === 0 ? (
              <div className="space-y-4">
                <div className="rounded-2xl rounded-tl-md border border-line-soft bg-surface-2/40 p-4">
                  <p className="text-[12.5px] leading-relaxed text-fg">
                    {hydrated && health.runModules > 0
                      ? `I have ${health.runModules} module${health.runModules === 1 ? "" : "s"} of context and ${health.confidence}% evidence coverage. Ask me to interpret a reading, prioritise fixes, or explain what a browser genuinely cannot measure.`
                      : "I do not have a scan yet. You can still ask about methodology, or run a full scan from the dashboard and come back for device-specific advice."}
                  </p>
                </div>
                <div>
                  <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint">
                    Try asking
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => void ask(q)}
                        className="rounded-full border border-line px-3 py-1.5 text-[11.5px] text-muted transition-colors hover:border-accent/50 hover:text-accent"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-gradient-to-br from-accent/20 to-violet/15 px-4 py-2.5 text-[12.5px] leading-relaxed text-fg">
                    {message.text}
                  </div>
                </div>
              ) : (
                <div key={message.id} className="max-w-[95%]">
                  <div className="rounded-2xl rounded-tl-md border border-line-soft bg-surface-2/40 p-4">
                    <p className="font-display text-[13.5px] font-semibold text-fg">
                      {message.reply?.title}
                    </p>
                    <div className="mt-2 space-y-2">
                      {message.reply?.paragraphs.map((p) => (
                        <p key={p.slice(0, 40)} className="text-[12.5px] leading-relaxed text-muted">
                          {p}
                        </p>
                      ))}
                    </div>
                    {message.reply?.bullets.length ? (
                      <ul className="mt-3 space-y-1.5 border-t border-line-soft pt-2.5">
                        {message.reply.bullets.map((bullet) => (
                          <li key={bullet} className="flex gap-2 text-[11.5px] leading-relaxed text-muted">
                            <span className="mt-[6px] size-1 shrink-0 rounded-full bg-accent/70" aria-hidden="true" />
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {message.reply?.caveats.length ? (
                      <div className="mt-3 space-y-1.5">
                        {message.reply.caveats.map((caveat) => (
                          <p key={caveat} className="flex gap-1.5 text-[10.5px] leading-relaxed text-warn/85">
                            <CircleAlert className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                            {caveat}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    {message.reply?.sources.length ? (
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line-soft pt-2.5">
                        <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-faint">
                          Sources
                        </span>
                        {message.reply.sources.map((source) => (
                          <a
                            key={source.url}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10.5px] text-accent/85 hover:text-accent hover:underline"
                          >
                            {source.label}
                            <ArrowUpRight className="size-2.5" aria-hidden="true" />
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {message.reply?.followUps.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {message.reply.followUps.slice(0, 3).map((followUp) => (
                        <button
                          key={followUp}
                          type="button"
                          onClick={() => void ask(followUp)}
                          className="rounded-full border border-line-soft px-2.5 py-1 text-[10.5px] text-muted transition-colors hover:border-accent/40 hover:text-accent"
                        >
                          {followUp}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ),
            )}

            {thinking ? (
              <div className="flex items-center gap-2 text-[11.5px] text-accent">
                <Spinner />
                Reading your scan…
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void ask(input);
            }}
            className="border-t border-line-soft p-3 sm:p-4"
          >
            <div className="flex items-end gap-2">
              <label htmlFor="assistant-input" className="sr-only">
                Ask the PhoneCare assistant
              </label>
              <input
                id="assistant-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about your battery, storage, network or what a browser can measure…"
                className="h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[13px] text-fg outline-none transition-colors placeholder:text-faint focus:border-accent/70 focus:ring-2 focus:ring-accent/20"
                autoComplete="off"
              />
              <Button type="submit" size="icon" disabled={!canAsk} aria-label="Send question">
                <Send className="size-4" />
              </Button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-faint">
              Answers are generated from your local readings and the guide library. Not a substitute
              for professional service advice.
            </p>
          </form>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Context it can see</CardTitle>
              <Badge tone="neutral">{health.confidence}% coverage</Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.values(state.modules)
                .filter((m) => m?.completedAt)
                .slice(0, 6)
                .map((mod) => (
                  <div key={mod!.id} className="flex items-start gap-2 border-b border-line-soft pb-2 last:border-0">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-good" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[11.5px] font-medium capitalize text-fg">{mod!.id}</p>
                      <p className="line-clamp-1 text-[10.5px] text-faint">{mod!.summary}</p>
                    </div>
                    <span className="ml-auto shrink-0 text-[10.5px] tabular-nums text-muted">
                      {mod!.score ?? "—"}
                    </span>
                  </div>
                ))}
              {health.runModules === 0 ? (
                <p className="py-4 text-center text-[11.5px] text-faint">
                  No modules scanned. Run a scan for device-specific answers.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reasoning model</CardTitle>
              <ShieldCheck className="size-4 text-good" aria-hidden="true" />
            </CardHeader>
            <CardContent className="space-y-3 text-[11.5px] leading-relaxed text-muted">
              <p>
                <span className="font-medium text-fg">Default: local engine.</span> Deterministic rules
                run in your browser over your readings and the guide library. No data leaves the
                device.
              </p>
              {enhancedAvailable ? (
                <label className="flex items-start gap-2 rounded-lg border border-line-soft bg-surface-2/30 p-2.5">
                  <input
                    type="checkbox"
                    checked={useEnhanced}
                    onChange={(event) => setUseEnhanced(event.target.checked)}
                    className="mt-0.5 size-3.5 accent-[var(--color-accent)]"
                  />
                  <span>
                    <span className="block text-[11px] font-medium text-fg">Use enhanced model</span>
                    Sends a sanitised reading summary to this site&rsquo;s server-side assistant
                    proxy. API keys stay on the server.
                  </span>
                </label>
              ) : (
                <p className="text-[10.5px] text-faint">
                  Enhanced model not configured on this deployment. The architecture supports it via
                  server-only environment variables — see the methodology page.
                </p>
              )}
              <Note tone="info">
                The assistant never invents sensor values. If a reading is unavailable, it says so and
                explains why.
              </Note>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Guide library</CardTitle>
              <BookOpen className="size-4 text-faint" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {relatedGuides.map((guide) => (
                  <Link
                    key={guide.slug}
                    href={`/guides/${guide.slug}`}
                    className="flex items-start gap-2 text-[11.5px] leading-relaxed text-muted transition-colors hover:text-fg"
                  >
                    <span
                      className={cn(
                        "mt-[6px] size-1 shrink-0 rounded-full",
                        relevantSlugs.has(guide.slug) ? "bg-accent" : "bg-line",
                      )}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">{guide.title}</span>
                    <ArrowUpRight className="mt-[2px] size-3 shrink-0 text-faint" aria-hidden="true" />
                  </Link>
                ))}
              </div>
              <Link
                href="/guides"
                className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-medium text-accent transition-colors hover:text-accent-strong"
              >
                Browse all {GUIDES.length} guides
                <ArrowUpRight className="size-3" aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
