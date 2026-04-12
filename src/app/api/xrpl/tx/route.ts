import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/xrpl";
import { apiError, validationError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const hash = request.nextUrl.searchParams.get("hash");
    if (!hash) return validationError("hash");

    const client = await getClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (client as any).request({
      command: "tx",
      transaction: hash,
    });

    const result = res.result as Record<string, unknown>;
    const meta = result.meta as Record<string, unknown> | undefined;

    // Extract mpt_issuance_id if this was a MPTokenIssuanceCreate
    let mptIssuanceId: string | null = null;
    if (meta?.mpt_issuance_id) {
      mptIssuanceId = meta.mpt_issuance_id as string;
    }

    return NextResponse.json({
      hash,
      validated: result.validated,
      transactionType: (result.tx_json as Record<string, unknown>)?.TransactionType ?? result.TransactionType,
      result: meta?.TransactionResult,
      mptIssuanceId,
    });
  } catch (error) {
    return apiError(error);
  }
}
