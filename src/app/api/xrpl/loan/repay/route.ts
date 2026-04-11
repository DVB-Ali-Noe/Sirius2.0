import { NextRequest, NextResponse } from "next/server";
import { getBorrower, getLoanBroker } from "@/lib/xrpl";
import { makeRepayment, getRepaymentInfo, checkAndTriggerDefault } from "@/lib/xrpl/repayment";
import { getLoan } from "@/lib/xrpl/loan-state";

export async function POST(request: NextRequest) {
  const { loanId, amountXrp } = (await request.json()) as {
    loanId: string;
    amountXrp: string;
  };

  const loan = getLoan(loanId);
  if (!loan) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  }

  if (loan.status === "COMPLETED" || loan.status === "DEFAULTED") {
    return NextResponse.json({ error: `Loan is ${loan.status}` }, { status: 400 });
  }

  if (checkAndTriggerDefault(loanId)) {
    return NextResponse.json({ error: "Loan has defaulted", loan }, { status: 400 });
  }

  const borrower = getBorrower();
  const loanBroker = getLoanBroker();

  const updatedLoan = await makeRepayment(
    borrower,
    loanBroker.classicAddress,
    loanId,
    amountXrp
  );

  const repayment = getRepaymentInfo(loanId);

  return NextResponse.json({ loan: updatedLoan, repayment });
}
