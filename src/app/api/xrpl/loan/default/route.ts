import { NextRequest, NextResponse } from "next/server";
import { getLoan, transitionLoan } from "@/lib/xrpl/loan-state";
import { terminateLoanAccess } from "@/lib/sirius/xrpl-bridge";
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

    if (loan.status === "COMPLETED" || loan.status === "DEFAULTED") {
      return NextResponse.json({ error: `Loan already ${loan.status}` }, { status: 400 });
    }

    const updated = transitionLoan(body.loanId, "DEFAULTED");
    terminateLoanAccess(body.loanId, "default_triggered");

    return NextResponse.json({ loan: updated });
  } catch (error) {
    return apiError(error);
  }
}
