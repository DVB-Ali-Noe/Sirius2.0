import { NextRequest, NextResponse } from "next/server";
import { getLoanBroker, getProvider } from "@/lib/xrpl";
import { distributeInterest } from "@/lib/xrpl/distribution";
import { getLoan } from "@/lib/xrpl/loan-state";
import { requireAuth, apiError, validationError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as { loanId?: string };

    if (!body.loanId) return validationError("loanId");

    const loan = getLoan(body.loanId);
    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    if (loan.status !== "COMPLETED") {
      return NextResponse.json({ error: "Loan must be COMPLETED to distribute" }, { status: 400 });
    }

    if (loan.distributedAt) {
      return NextResponse.json({ error: "Already distributed" }, { status: 400 });
    }

    const loanBroker = getLoanBroker();
    const provider = getProvider();

    const result = await distributeInterest(loanBroker, body.loanId, [
      { address: provider.classicAddress, sharePercent: 100 },
    ]);

    loan.distributedAt = Date.now();

    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
