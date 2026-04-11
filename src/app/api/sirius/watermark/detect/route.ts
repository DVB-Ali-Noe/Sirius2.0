import { NextRequest, NextResponse } from "next/server";
import { detectWatermark } from "@/lib/sirius";
import { listActiveSeeds } from "@/lib/sirius/xrpl-bridge";
import { requireAuth, apiError, validationError } from "@/lib/api-utils";

interface DetectBody {
  suspectRows?: unknown[];
}

export async function POST(request: NextRequest) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as DetectBody;

    if (!Array.isArray(body.suspectRows) || body.suspectRows.length === 0) {
      return validationError("suspectRows (non-empty array)");
    }

    const candidates = listActiveSeeds();
    if (candidates.length === 0) {
      return NextResponse.json({
        match: null,
        candidatesChecked: 0,
        message: "No active watermark seeds registered",
      });
    }

    const match = detectWatermark(body.suspectRows, candidates);

    if (!match) {
      return NextResponse.json({
        match: null,
        candidatesChecked: candidates.length,
      });
    }

    return NextResponse.json({
      match: {
        borrower: match.borrower,
        loanId: match.loanId,
        datasetId: match.datasetId,
        seedPrefix: match.seed.slice(0, 16),
      },
      candidatesChecked: candidates.length,
    });
  } catch (error) {
    return apiError(error);
  }
}
