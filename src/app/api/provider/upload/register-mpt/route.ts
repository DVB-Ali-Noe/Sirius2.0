import { NextRequest, NextResponse } from "next/server";
import { attachMpt, attachVault } from "@/lib/sirius";
import {
  holderOptInMPT,
  createPermissionedDomain,
  createLendingPool,
  getLoanBroker,
} from "@/lib/xrpl";
import { requireAuth, apiError, validationError } from "@/lib/api-utils";

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

    // Link MPT to dataset
    attachMpt(body.datasetId, body.mptIssuanceId);

    // LoanBroker opts in to hold the MPT
    await holderOptInMPT(loanBroker, body.mptIssuanceId);

    // Create permissioned domain
    const domainId = await createPermissionedDomain(loanBroker, [
      { issuer: loanBroker.classicAddress, credentialType: "DataProviderCertified" },
    ]);

    // Create vault (lending pool)
    const vaultId = await createLendingPool(loanBroker, body.mptIssuanceId, domainId);
    attachVault(body.datasetId, vaultId);

    // Create loan broker
    return NextResponse.json({
      domainId,
      vaultId,
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
