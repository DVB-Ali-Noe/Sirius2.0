import { NextRequest, NextResponse } from "next/server";
import { getBorrower, getLoanBroker } from "@/lib/xrpl";
import { makeRepayment, getRepaymentInfo } from "@/lib/xrpl/repayment";
import { getLoan, checkDefault } from "@/lib/xrpl/loan-state";
import { requireAuth, apiError, validationError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as {
      loanId?: string;
      amountXrp?: string;
    };

    if (!body.loanId) {
      return validationError("loanId");
    }

    if (!body.amountXrp || isNaN(parseFloat(body.amountXrp)) || parseFloat(body.amountXrp) <= 0) {
      return validationError("amountXrp (must be a positive number)");
    }

    const loan = getLoan(body.loanId);
    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    if (loan.status === "COMPLETED" || loan.status === "DEFAULTED") {
      return NextResponse.json({ error: `Loan is ${loan.status}` }, { status: 400 });
    }

    if (checkDefault(body.loanId)) {
      return NextResponse.json({ error: "Loan has defaulted", loan }, { status: 400 });
    }

    const borrower = getBorrower();
    const loanBroker = getLoanBroker();

    const updatedLoan = await makeRepayment(
      borrower,
      loanBroker.classicAddress,
      body.loanId,
      body.amountXrp
    );

    const repayment = getRepaymentInfo(body.loanId);

    return NextResponse.json({ loan: updatedLoan, repayment });
  } catch (error) {
    return apiError(error);
  }
}
