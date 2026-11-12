import { NextResponse } from "next/server";

/**
 * Deployment probe. Returns no secrets — only whether the optional
 * server-side assistant is configured (the key itself is never echoed).
 */
export const dynamic = "force-dynamic";

export function GET() {
  const assistantConfigured = Boolean(
    process.env.ASSISTANT_API_URL && process.env.ASSISTANT_API_KEY,
  );

  return NextResponse.json(
    {
      status: "ok",
      app: "PhoneCare AI",
      assistant: assistantConfigured ? "enhanced" : "local",
      site: process.env.NEXT_PUBLIC_SITE_URL ?? null,
      runtime: process.env.NEXT_RUNTIME ?? "nodejs",
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
