import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Optional server-side assistant proxy.
 *
 * The deployment owner supplies credentials via server-only environment
 * variables (never NEXT_PUBLIC_*). If they are absent the endpoint reports
 * `enabled: false` and the client keeps using the deterministic local engine,
 * so the product is fully functional without any paid API.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 12;
const hits = new Map<string, { count: number; resetAt: number }>();

function isEnabled() {
  return Boolean(process.env.ASSISTANT_API_URL && process.env.ASSISTANT_API_KEY);
}

function clientKey(request: Request) {
  // On Vercel the platform overwrites these headers; treat them as advisory
  // only and never as identity.
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

export async function GET() {
  return NextResponse.json(
    {
      enabled: isEnabled(),
      model: isEnabled() ? (process.env.ASSISTANT_MODEL ?? "default") : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (!isEnabled()) {
    return NextResponse.json(
      {
        enabled: false,
        error: "Enhanced assistant is not configured on this deployment.",
      },
      { status: 501 },
    );
  }

  const key = clientKey(request);
  const now = Date.now();
  // Keep the in-memory window table bounded on long-lived instances.
  if (hits.size > 500) {
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }
  const entry = hits.get(key);
  if (entry && entry.resetAt > now && entry.count >= MAX_REQUESTS) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429 },
    );
  }
  hits.set(key, {
    count: entry && entry.resetAt > now ? entry.count + 1 : 1,
    resetAt: entry && entry.resetAt > now ? entry.resetAt : now + WINDOW_MS,
  });
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
  }

  let body: { question?: unknown; context?: unknown };
  try {
    body = (await request.json()) as { question?: unknown; context?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.slice(0, 600).trim() : "";
  if (!question) {
    return NextResponse.json({ error: "A question is required." }, { status: 400 });
  }

  const contextJson = JSON.stringify(body.context ?? {}).slice(0, 12_000);

  const system = [
    "You are the PhoneCare diagnostic assistant for a browser-based smartphone diagnostics app.",
    "Rules you must never break:",
    "1. Only use the readings supplied in the context. Never invent device values.",
    "2. Respect evidence labels: measured, estimated, user-provided, unavailable.",
    "3. If a metric is unavailable, say the web platform does not expose it and why.",
    "4. Never claim to read battery temperature, cycle count, CPU temperature or disk usage from a browser.",
    "5. Be concise: at most 120 words, plain English, no markdown headings.",
    "6. Do not give medical, legal or safety-certifying advice; direct hardware safety issues to a service centre.",
    "Use British English. Speak directly to the device owner.",
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(process.env.ASSISTANT_API_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ASSISTANT_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.ASSISTANT_MODEL ?? "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 320,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Scan context (JSON):\n${contextJson}\n\nQuestion: ${question}` },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "The assistant provider rejected the request." },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      return NextResponse.json({ error: "Empty response from provider." }, { status: 502 });
    }
    return NextResponse.json(
      { answer: answer.slice(0, 2000) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Assistant request failed or timed out." }, { status: 504 });
  } finally {
    clearTimeout(timeout);
  }
}
