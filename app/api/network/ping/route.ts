import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Minimal round-trip probe. Never cached, never stores anything. */
export async function GET() {
  return new NextResponse(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Timing-Allow-Origin": "*",
      "X-PhoneCare-Probe": "ping",
    },
  });
}
