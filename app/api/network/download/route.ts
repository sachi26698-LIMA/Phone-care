import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Serves an incompressible test payload for the download speed measurement.
 * A complete buffer is used so the response carries an accurate
 * Content-Length (which avoids spurious request-aborted events in Chromium).
 * Capped at 8 MB so the endpoint cannot be used as a bandwidth amplifier.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requested = Number.parseInt(searchParams.get("bytes") ?? "", 10);
  const size = Number.isFinite(requested)
    ? Math.min(Math.max(requested, 1024), MAX_BYTES)
    : 3 * 1024 * 1024;

  const payload = new Uint8Array(size);
  // A non-repeating byte pattern prevents gzip/brotli from shrinking the payload.
  for (let i = 0; i < size; i += 1) payload[i] = (i * 31 + 7) % 251;

  return new NextResponse(payload as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(size),
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Timing-Allow-Origin": "*",
    },
  });
}
