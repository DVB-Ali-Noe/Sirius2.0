import { NextRequest, NextResponse } from "next/server";
import { getLoan, getAllLoans } from "@/lib/xrpl/loan-state";
import { getRepaymentInfo } from "@/lib/xrpl/repayment";

export async function GET(request: NextRequest) {
  const loanId = request.nextUrl.searchParams.get("loanId");

  if (!loanId) {
    const loans = getAllLoans();
    return NextResponse.json({ loans });
  }

  const loan = getLoan(loanId);
  if (!loan) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  }

  const repayment = getRepaymentInfo(loanId);

  return NextResponse.json({ loan, repayment });
}
