import { NextRequest, NextResponse } from "next/server";
import {
  createLoan,
  deleteLoan,
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
      borrowerAddress?: string;
    };

    if (body.action !== "create" && body.action !== "delete") {
      return validationError("action (create | delete)");
    }

    const loanBroker = getLoanBroker();

    if (body.action === "create") {
      if (!body.borrowerAddress) {
        return validationError("borrowerAddress");
      }

      // Use provided loanBrokerId, or fall back to empty (mock loan will handle it)
      if (!body.loanBrokerId) {
        body.loanBrokerId = "0000000000000000000000000000000000000000000000000000000000000000";
      }

      const principalAmount = body.principalAmount ?? "1";
      const interestRate = body.interestRate ?? 500;
      const paymentTotal = body.paymentTotal ?? 1;
      const paymentInterval = body.paymentInterval ?? 2592000;
      const gracePeriod = body.gracePeriod ?? 86400;

      // LoanSet may fail on wasm devnet (temBAD_SIGNER bug) — fallback to mock loan
      let loanId: string;
      try {
        loanId = await createLoan(loanBroker, body.borrowerAddress, {
          loanBrokerId: body.loanBrokerId,
          principalAmount,
          interestRate,
          paymentTotal,
          paymentInterval,
          gracePeriod,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("temBAD_SIGNER")) {
          loanId = `loan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
          console.warn("[loan] LoanSet failed (wasm devnet), using mock loanId:", loanId);
        } else {
          throw e;
        }
      }

      createLoanRecord({
        loanId,
        borrower: body.borrowerAddress,
        provider: "",
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
    await deleteLoan(loanBroker, body.loanId);

    return NextResponse.json({ status: "deleted", loanId: body.loanId });
  } catch (error) {
    return apiError(error);
  }
}
