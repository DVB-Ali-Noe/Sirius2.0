import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/xrpl/client";
import { getLoanBroker } from "@/lib/xrpl/wallets";
import { createLoanRecord, transitionLoan, getLoan, addPayment } from "@/lib/xrpl/loan-state";
import { getDataset, listDatasets, getByMpt } from "@/lib/sirius/dataset-registry";
import { activateLoanAccess, getWatermarkSeed } from "@/lib/sirius/xrpl-bridge";
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
      datasetId?: string;
      borrowerAddress?: string;
      durationDays?: number;
    };

    if (!body.txHash) return validationError("txHash");
    if (!body.datasetId) return validationError("datasetId");
    if (!body.borrowerAddress) return validationError("borrowerAddress");
    if (!body.durationDays || body.durationDays <= 0) return validationError("durationDays (must be > 0)");

    let dataset = getDataset(body.datasetId) ?? getByMpt(body.datasetId);
    if (!dataset) {
      const allDatasets = listDatasets();
      dataset = allDatasets.find((d) => d.datasetId === body.datasetId || d.mptIssuanceId === body.datasetId) ?? undefined;
    }
    if (!dataset) {
      return NextResponse.json(
        { success: false, reason: `dataset ${body.datasetId} not found — upload a dataset first` },
        { status: 404 }
      );
    }
    if (!dataset.mptIssuanceId || !dataset.vaultId) {
      return NextResponse.json(
        { success: false, reason: "dataset missing mpt or vault binding" },
        { status: 400 }
      );
    }

    const pricePerDay = dataset.pricePerDay ?? dataset.description.pricePerDay ?? "0.5";
    const priceNum = parseFloat(pricePerDay);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      return NextResponse.json(
        { success: false, reason: "dataset has invalid pricePerDay" },
        { status: 400 }
      );
    }

    const expectedDrops = xrpToDrops(priceNum * body.durationDays);

    const client = await getClient();

    // Poll until tx is validated (up to 15s)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any = null;

    for (let attempt = 0; attempt < 15; attempt++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const txRes: any = await (client as any).request({
        command: "tx",
        transaction: body.txHash,
      });

      if (txRes.result?.validated === true) {
        result = txRes.result;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!result) {
      return NextResponse.json({ success: false, reason: "tx not validated after 15s" });
    }

    const txJson = result.tx_json ?? result;
    const txType = txJson.TransactionType ?? result.TransactionType;
    const destination = txJson.Destination ?? result.Destination;
    const amount = txJson.Amount ?? result.Amount ?? result.DeliverMax ?? txJson.DeliverMax;
    const account = txJson.Account ?? result.Account;
    const txResult = result.meta?.TransactionResult;

    if (txType !== "Payment") {
      return NextResponse.json({ success: false, reason: `tx is not a Payment (got ${txType})` });
    }
    if (txResult !== "tesSUCCESS") {
      return NextResponse.json({ success: false, reason: `tx failed on-chain: ${txResult ?? "unknown"}` });
    }
    if (destination !== dataset.providerAddress) {
      return NextResponse.json({
        success: false,
        reason: `wrong destination (expected provider ${dataset.providerAddress}, got ${destination})`,
      });
    }
    if (account !== body.borrowerAddress) {
      return NextResponse.json({
        success: false,
        reason: `wrong source (expected borrower ${body.borrowerAddress}, got ${account})`,
      });
    }

    let amountDrops: number;
    if (typeof amount === "string") {
      amountDrops = parseInt(amount, 10);
    } else if (amount && typeof amount === "object" && "value" in amount) {
      amountDrops = xrpToDrops(parseFloat(amount.value));
    } else {
      amountDrops = NaN;
    }
    if (!Number.isFinite(amountDrops)) {
      return NextResponse.json({ success: false, reason: `cannot parse amount: ${JSON.stringify(amount)}` });
    }
    if (amountDrops < expectedDrops) {
      return NextResponse.json({
        success: false,
        reason: `insufficient amount: got ${dropsToXrp(amountDrops)} XRP, need ${dropsToXrp(expectedDrops)} XRP`,
      });
    }

    const loanId = `loan-${body.txHash.slice(0, 16).toLowerCase()}`;
    const now = Date.now();
    const ttlMs = body.durationDays * MS_PER_DAY;
    const expiresAt = now + ttlMs;

    const loanBroker = getLoanBroker();
    let loan = getLoan(loanId);
    if (!loan) {
      loan = createLoanRecord({
        loanId,
        borrower: body.borrowerAddress,
        provider: dataset.providerAddress,
        loanBroker: loanBroker.classicAddress,
        vaultId: dataset.vaultId,
        mptIssuanceId: dataset.mptIssuanceId,
        datasetId: dataset.datasetId,
        principalAmount: (priceNum * body.durationDays).toString(),
        interestRate: 0,
        paymentTotal: 1,
        paymentInterval: body.durationDays * 86_400,
        gracePeriod: 86_400,
        pricePerDay,
        durationDays: body.durationDays,
      });
      transitionLoan(loanId, "ACTIVE");
      loan = getLoan(loanId)!;
    }

    loan.activatedAt = loan.activatedAt ?? now;
    loan.expiresAt = expiresAt;
    loan.datasetId = dataset.datasetId;
    loan.pricePerDay = pricePerDay;
    loan.durationDays = body.durationDays;

    addPayment(loanId, {
      txHash: body.txHash,
      amount: dropsToXrp(amountDrops).toString(),
      timestamp: now,
    });
    // addPayment auto-completes if paymentTotal reached; revert to ACTIVE for access
    const refreshed = getLoan(loanId)!;
    if (refreshed.status === "COMPLETED") {
      refreshed.status = "ACTIVE";
    }

    const activation = activateLoanAccess(loanId, undefined, ttlMs);
    if (!activation.ok) {
      return NextResponse.json(
        { success: false, reason: `key activation failed: ${activation.reason}` },
        { status: 500 }
      );
    }

    const seed = getWatermarkSeed(loanId);

    return NextResponse.json({
      success: true,
      loanId,
      expiresAt,
      durationDays: body.durationDays,
      amountPaid: dropsToXrp(amountDrops),
      pricePerDay,
      keyId: activation.keyId,
      watermarkSeedPrefix: seed ? seed.seed.slice(0, 16) : null,
    });
  } catch (error) {
    console.error("[verify-payment] Error:", error);
    return apiError(error);
  }
}
