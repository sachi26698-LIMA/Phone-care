import { NextResponse } from "next/server";
import { validateReport } from "@/lib/diagnostic/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 4 * 1024 * 1024;

/**
 * Validates a DiagnosticReport against the shared contract.
 *
 * Nothing is stored and nothing is logged beyond the validation outcome, so
 * this endpoint can be used to prove that the web app and the Android app
 * speak the same language without introducing a database, an account system or
 * a privacy question.
 */
export async function POST(request: Request) {
  const declared = Number.parseInt(request.headers.get("content-length") ?? "0", 10);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 });
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return NextResponse.json({ ok: false, error: "Body could not be read" }, { status: 400 });
  }

  if (text.length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "Body is not valid JSON" }, { status: 400 });
  }

  const result = validateReport(parsed);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, errors: result.errors, warnings: result.warnings },
      { status: 422, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { ok: true, report: result.report, errors: [], warnings: result.warnings },
    { headers: { "Cache-Control": "no-store" } },
  );
}
