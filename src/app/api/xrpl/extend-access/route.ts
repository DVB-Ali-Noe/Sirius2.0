import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/xrpl/client";
import { getLoan, extendLoanExpiry, addPayment } from "@/lib/xrpl/loan-state";
import { getDataset } from "@/lib/sirius/dataset-registry";
import { extendKey } from "@/lib/sirius/key-store";
import { requireAuth, apiError, validationError } from "@/lib/api-utils";

const MS_PER_DAY = 86_400_000;

function xrpToDrops(xrp: number): number {
  return Math.round(xrp * 1_000_000);
}

function dropsToXrp(drops: string | number): number {
  const n = typeof drops === "string" ? parseInt(drops, 10) : drops;
  return n / 1_000_000;
}

export async function POST(request: NextRequest) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as {
      txHash?: string;
      loanId?: string;
      additionalDays?: number;
    };

    if (!body.txHash) return validationError("txHash");
    if (!body.loanId) return validationError("loanId");
    if (!body.additionalDays || body.additionalDays <= 0) return validationError("additionalDays");

    const loan = getLoan(body.loanId);
    if (!loan) {
      return NextResponse.json({ success: false, reason: "loan not found" }, { status: 404 });
    }
    if (loan.status !== "ACTIVE" && loan.status !== "REPAYING") {
      return NextResponse.json({
        success: false,
        reason: `loan not extendable in status ${loan.status}`,
      });
    }
    if (loan.expiresAt && loan.expiresAt < Date.now()) {
      return NextResponse.json({ success: false, reason: "loan already expired — use borrow flow" });
    }

    const datasetId = loan.datasetId;
    const dataset = datasetId ? getDataset(datasetId) : undefined;
    if (!dataset) {
      return NextResponse.json(
        { success: false, reason: "dataset for this loan not found" },
        { status: 400 }
      );
    }

    const pricePerDay = loan.pricePerDay ?? dataset.pricePerDay ?? dataset.description.pricePerDay ?? "0.5";
    const priceNum = parseFloat(pricePerDay);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      return NextResponse.json({ success: false, reason: "invalid pricePerDay" }, { status: 400 });
    }
    const expectedDrops = xrpToDrops(priceNum * body.additionalDays);

    const client = await getClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txRes = (await (client as any).request({
      command: "tx",
      transaction: body.txHash,
    })) as { result: Record<string, unknown> };

    const result = txRes.result as {
      TransactionType?: string;
      Destination?: string;
      Amount?: string | { value: string };
      Account?: string;
      validated?: boolean;
      meta?: { TransactionResult?: string };
      tx_json?: {
        TransactionType?: string;
        Destination?: string;
        Amount?: string | { value: string };
        Account?: string;
      };
    };

    const txJson = result.tx_json ?? result;
    const txType = txJson.TransactionType ?? result.TransactionType;
    const destination = txJson.Destination ?? result.Destination;
    const amount = txJson.Amount ?? result.Amount;
    const account = txJson.Account ?? result.Account;
    const validated = result.validated === true;
    const txResult = result.meta?.TransactionResult;

    if (txType !== "Payment") {
      return NextResponse.json({ success: false, reason: `tx is not a Payment (got ${txType})` });
    }
    if (!validated) {
      return NextResponse.json({ success: false, reason: "tx not validated yet" });
    }
    if (txResult !== "tesSUCCESS") {
      return NextResponse.json({ success: false, reason: `tx failed on-chain: ${txResult ?? "unknown"}` });
    }
    if (destination !== dataset.providerAddress) {
      return NextResponse.json({
        success: false,
        reason: `wrong destination (expected ${dataset.providerAddress}, got ${destination})`,
      });
    }
    if (account !== loan.borrower) {
      return NextResponse.json({
        success: false,
        reason: `wrong source (expected borrower ${loan.borrower}, got ${account})`,
      });
    }

    if (loan.payments.some((p) => p.txHash === body.txHash)) {
      return NextResponse.json({ success: false, reason: "txHash already used for this loan" });
    }

    const amountDrops = typeof amount === "string" ? parseInt(amount, 10) : NaN;
    if (!Number.isFinite(amountDrops)) {
      return NextResponse.json({ success: false, reason: "amount is not in drops" });
    }
    if (amountDrops < expectedDrops) {
      return NextResponse.json({
        success: false,
        reason: `insufficient amount: got ${dropsToXrp(amountDrops)} XRP, need ${dropsToXrp(expectedDrops)} XRP`,
      });
    }

    const additionalMs = body.additionalDays * MS_PER_DAY;
    const updated = extendLoanExpiry(body.loanId, additionalMs);
    updated.durationDays = (updated.durationDays ?? 0) + body.additionalDays;

    extendKey(body.loanId, additionalMs);

    addPayment(body.loanId, {
      txHash: body.txHash,
      amount: dropsToXrp(amountDrops).toString(),
      timestamp: Date.now(),
    });
    // addPayment may mark COMPLETED; force back to ACTIVE for ongoing access
    const refreshed = getLoan(body.loanId)!;
    if (refreshed.status === "COMPLETED") {
      refreshed.status = "ACTIVE";
    }

    return NextResponse.json({
      success: true,
      loanId: body.loanId,
      newExpiresAt: updated.expiresAt,
      additionalDays: body.additionalDays,
      amountPaid: dropsToXrp(amountDrops),
    });
  } catch (error) {
    console.error("[extend-access] Error:", error);
    return apiError(error);
  }
}
