import { NextRequest, NextResponse } from "next/server";
import {
  createLoan,
  deleteLoan,
  getBorrower,
  getLoanBroker,
  getProvider,
  createLoanRecord,
  transitionLoan,
} from "@/lib/xrpl";
import { terminateLoanAccess } from "@/lib/sirius/xrpl-bridge";
import { requireAuth, apiError, validationError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as {
      action?: string;
      loanId?: string;
      principalAmount?: string;
      interestRate?: number;
      paymentTotal?: number;
      paymentInterval?: number;
      gracePeriod?: number;
      vaultId?: string;
      mptIssuanceId?: string;
      loanBrokerId?: string;
    };

    if (body.action !== "create" && body.action !== "delete") {
      return validationError("action (create | delete)");
    }

    const borrower = getBorrower();
    const loanBroker = getLoanBroker();

    if (body.action === "create") {
      const principalAmount = body.principalAmount ?? "1";
      const interestRate = body.interestRate ?? 500;
      const paymentTotal = body.paymentTotal ?? 1;
      const paymentInterval = body.paymentInterval ?? 2592000;
      const gracePeriod = body.gracePeriod ?? 86400;

      if (!body.loanBrokerId) {
        return validationError("loanBrokerId (Hash256 of the LoanBroker ledger object)");
      }

      const loanId = await createLoan(borrower, {
        loanBrokerId: body.loanBrokerId,
        principalAmount,
        interestRate,
        paymentTotal,
        paymentInterval,
        gracePeriod,
      });

      const provider = getProvider();

      createLoanRecord({
        loanId,
        borrower: borrower.classicAddress,
        provider: provider.classicAddress,
        loanBroker: loanBroker.classicAddress,
        vaultId: body.vaultId ?? "",
        mptIssuanceId: body.mptIssuanceId ?? "",
        principalAmount,
        interestRate,
        paymentTotal,
        paymentInterval,
        gracePeriod,
      });

      transitionLoan(loanId, "ACTIVE");

      return NextResponse.json({ loanId });
    }

    if (!body.loanId) {
      return validationError("loanId");
    }

    terminateLoanAccess(body.loanId, "loan_deleted");
    await deleteLoan(borrower, body.loanId);

    return NextResponse.json({ status: "deleted", loanId: body.loanId });
  } catch (error) {
    return apiError(error);
  }
}
