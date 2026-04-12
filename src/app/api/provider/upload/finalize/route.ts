import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, validationError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as {
      datasetId?: string;
      mptIssuanceId?: string;
      vaultId?: string;
      loanBrokerId?: string;
      mptAuthorizeTxHash?: string;
      vaultDepositTxHash?: string;
    };

    if (!body.datasetId) return validationError("datasetId");

    return NextResponse.json({
      success: true,
      datasetId: body.datasetId,
      mptIssuanceId: body.mptIssuanceId,
      vaultId: body.vaultId,
      loanBrokerId: body.loanBrokerId,
      mptAuthorizeTxHash: body.mptAuthorizeTxHash,
      vaultDepositTxHash: body.vaultDepositTxHash,
    });
  } catch (error) {
    return apiError(error);
  }
}
