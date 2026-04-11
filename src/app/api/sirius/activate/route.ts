import { NextRequest, NextResponse } from "next/server";
import {
  activateLoanAccess,
  terminateLoanAccess,
  installXrplBridge,
  getWatermarkSeed,
} from "@/lib/sirius/xrpl-bridge";
import { attachMpt } from "@/lib/sirius";
import { requireAuth, apiError, validationError } from "@/lib/api-utils";

interface ActivateBody {
  action?: "activate" | "terminate" | "attach-mpt";
  loanId?: string;
  datasetId?: string;
  mptIssuanceId?: string;
  reason?: string;
}

export async function POST(request: NextRequest) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as ActivateBody;

    if (!body.action) {
      return validationError("action (activate | terminate | attach-mpt)");
    }

    installXrplBridge();

    if (body.action === "attach-mpt") {
      if (!body.datasetId) return validationError("datasetId");
      if (!body.mptIssuanceId) return validationError("mptIssuanceId");
      const record = attachMpt(body.datasetId, body.mptIssuanceId);
      return NextResponse.json({
        datasetId: record.datasetId,
        mptIssuanceId: record.mptIssuanceId,
      });
    }

    if (!body.loanId) return validationError("loanId");

    if (body.action === "activate") {
      const result = activateLoanAccess(body.loanId);
      if (!result.ok) {
        return NextResponse.json({ error: result.reason }, { status: 400 });
      }
      const seed = getWatermarkSeed(body.loanId);
      return NextResponse.json({
        status: "activated",
        loanId: body.loanId,
        keyId: result.keyId,
        watermarkSeed: seed ? seed.seed.slice(0, 16) : null,
      });
    }

    if (body.action === "terminate") {
      const ok = terminateLoanAccess(body.loanId, body.reason ?? "manual_termination");
      if (!ok) {
        return NextResponse.json({ error: "No active key for this loan" }, { status: 404 });
      }
      return NextResponse.json({ status: "terminated", loanId: body.loanId });
    }

    return validationError("action (activate | terminate | attach-mpt)");
  } catch (error) {
    return apiError(error);
  }
}
