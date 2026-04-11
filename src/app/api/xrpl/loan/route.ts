import { NextRequest, NextResponse } from "next/server";
import {
  createLoan,
  deleteLoan,
  getBorrower,
  getLoanBroker,
} from "@/lib/xrpl";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    action: "create" | "delete";
    loanId?: string;
    principalAmount?: string;
    interestRate?: number;
    paymentTotal?: number;
    paymentInterval?: number;
    gracePeriod?: number;
  };

  const borrower = getBorrower();
  const loanBroker = getLoanBroker();

  if (body.action === "create") {
    const loanId = await createLoan(borrower, {
      loanBrokerId: loanBroker.classicAddress,
      principalAmount: body.principalAmount ?? "1",
      interestRate: body.interestRate ?? 500,
      paymentTotal: body.paymentTotal ?? 1,
      paymentInterval: body.paymentInterval ?? 2592000,
      gracePeriod: body.gracePeriod,
    });

    return NextResponse.json({ loanId });
  }

  await deleteLoan(borrower, body.loanId!);

  return NextResponse.json({ status: "deleted", loanId: body.loanId });
}
