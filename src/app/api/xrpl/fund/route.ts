import { NextRequest, NextResponse } from "next/server";
import { XRPL_FAUCET_URL } from "@/lib/xrpl/constants";
import { requireAuth, apiError, validationError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as { address?: string };

    if (!body.address) return validationError("address");

    if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(body.address)) {
      return validationError("address (invalid XRPL classic address format)");
    }

    const res = await fetch(XRPL_FAUCET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destination: body.address }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Faucet error: ${text}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    return NextResponse.json({
      address: body.address,
      funded: true,
      balance: data.balance ?? data.amount ?? null,
    });
  } catch (error) {
    return apiError(error);
  }
}
