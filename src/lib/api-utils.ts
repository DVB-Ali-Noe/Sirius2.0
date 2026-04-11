import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

export function requireAuth(request: NextRequest): NextResponse | null {
  const apiKey = request.headers.get("x-api-key");
  const expected = process.env.API_SECRET_KEY;

  if (!expected) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }

  if (!apiKey || apiKey.length !== expected.length) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isValid = timingSafeEqual(
    Buffer.from(apiKey),
    Buffer.from(expected)
  );

  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export function apiError(error: unknown): NextResponse {
  const message =
    error instanceof Error ? error.message : "Unknown error";

  return NextResponse.json({ error: message }, { status: 500 });
}

export function validationError(field: string): NextResponse {
  return NextResponse.json(
    { error: `Missing or invalid field: ${field}` },
    { status: 400 }
  );
}
