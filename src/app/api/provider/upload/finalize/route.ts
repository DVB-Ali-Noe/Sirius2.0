import { NextRequest, NextResponse } from "next/server";
import { createLoanBroker, getLoanBroker } from "@/lib/xrpl";
import { requireAuth, apiError, validationError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as {
      datasetId?: string;
      mptIssuanceId?: string;
      vaultId?: string;
    };

    if (!body.datasetId) return validationError("datasetId");
    if (!body.mptIssuanceId) return validationError("mptIssuanceId");
    if (!body.vaultId) return validationError("vaultId");

    const loanBroker = getLoanBroker();
    const loanBrokerId = await createLoanBroker(loanBroker, body.vaultId);

    return NextResponse.json({
      success: true,
      datasetId: body.datasetId,
      mptIssuanceId: body.mptIssuanceId,
      vaultId: body.vaultId,
      loanBrokerId,
    });
  } catch (error) {
    console.error("[provider/upload/finalize] Error:", error);
    return apiError(error);
  }
}
