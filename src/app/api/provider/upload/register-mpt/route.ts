import { NextRequest, NextResponse } from "next/server";
import { attachMpt, attachVault } from "@/lib/sirius";
import {
  holderOptInMPT,
  createPermissionedDomain,
  createLendingPool,
  createLoanBroker,
  getLoanBroker,
} from "@/lib/xrpl";
import { requireAuth, apiError, validationError } from "@/lib/api-utils";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as {
      providerAddress?: string;
      datasetId?: string;
      mptIssuanceId?: string;
    };

    if (!body.providerAddress) return validationError("providerAddress");
    if (!body.datasetId) return validationError("datasetId");
    if (!body.mptIssuanceId) return validationError("mptIssuanceId");

    const loanBroker = getLoanBroker();
    console.log("[register-mpt] LoanBroker address:", loanBroker.classicAddress);

    // Link MPT to dataset
    attachMpt(body.datasetId, body.mptIssuanceId);

    // LoanBroker opts in to hold the MPT
    console.log("[register-mpt] Step 1/4: holderOptInMPT...");
    await holderOptInMPT(loanBroker, body.mptIssuanceId);
    console.log("[register-mpt] Step 1/4: done");

    // Create permissioned domain
    console.log("[register-mpt] Step 2/4: createPermissionedDomain...");
    const domainId = await createPermissionedDomain(loanBroker, [
      { issuer: loanBroker.classicAddress, credentialType: "DataProviderCertified" },
    ]);
    console.log("[register-mpt] Step 2/4: done, domainId:", domainId);

    // Create vault (lending pool)
    console.log("[register-mpt] Step 3/4: createLendingPool...");
    const vaultId = await createLendingPool(loanBroker, body.mptIssuanceId, domainId);
    attachVault(body.datasetId, vaultId);
    console.log("[register-mpt] Step 3/4: done, vaultId:", vaultId);

    // Create loan broker object on-chain
    let loanBrokerId: string | null = null;
    try {
      console.log("[register-mpt] Step 4/4: createLoanBroker...");
      loanBrokerId = await createLoanBroker(loanBroker, vaultId);
      console.log("[register-mpt] Step 4/4: done, loanBrokerId:", loanBrokerId);
    } catch (e) {
      console.warn("[register-mpt] LoanBrokerSet failed (non-blocking):", (e as Error).message?.slice(0, 80));
    }

    return NextResponse.json({
      domainId,
      vaultId,
      loanBrokerId,
      loanBrokerAddress: loanBroker.classicAddress,
      transactions: {
        mptAuthorize: {
          TransactionType: "MPTokenAuthorize",
          Account: body.providerAddress,
          MPTokenIssuanceID: body.mptIssuanceId,
          Holder: loanBroker.classicAddress,
        },
        vaultDeposit: {
          TransactionType: "VaultDeposit",
          Account: body.providerAddress,
          VaultID: vaultId,
          Amount: {
            mpt_issuance_id: body.mptIssuanceId,
            value: "1",
          },
        },
      },
    });
  } catch (error) {
    console.error("[provider/upload/register-mpt] Error:", error);
    return apiError(error);
  }
}
