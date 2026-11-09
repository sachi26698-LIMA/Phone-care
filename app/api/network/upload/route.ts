import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Consumes an upload payload and reports how many bytes arrived. Nothing is
 * written to disk, logged, or persisted: the bytes are counted and dropped.
 */
export async function POST(request: Request) {
  const declared = Number.parseInt(request.headers.get("content-length") ?? "0", 10);
  if (Number.isFinite(declared) && declared > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 });
  }

  let received = 0;
  try {
    const reader = request.body?.getReader();
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > MAX_BYTES) {
          await reader.cancel();
          return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 });
        }
      }
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Upload interrupted" }, { status: 400 });
  }

  return NextResponse.json(
    { ok: true, received },
    { headers: { "Cache-Control": "no-store", "Timing-Allow-Origin": "*" } },
  );
}
