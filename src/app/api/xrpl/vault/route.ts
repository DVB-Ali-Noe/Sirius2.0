import { NextRequest, NextResponse } from "next/server";
import {
  createLendingPool,
  createPermissionedDomain,
  depositToVault,
  withdrawFromVault,
  getLoanBroker,
  getProvider,
} from "@/lib/xrpl";
import { requireAuth, apiError, validationError } from "@/lib/api-utils";

const VALID_ACTIONS = ["create", "deposit", "withdraw"] as const;

export async function POST(request: NextRequest) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as {
      action?: string;
      mptIssuanceId?: string;
      vaultId?: string;
      amount?: string;
    };

    if (!body.action || !VALID_ACTIONS.includes(body.action as typeof VALID_ACTIONS[number])) {
      return validationError("action (create | deposit | withdraw)");
    }

    if (!body.mptIssuanceId) {
      return validationError("mptIssuanceId");
    }

    const loanBroker = getLoanBroker();
    const provider = getProvider();

    if (body.action === "create") {
      const domainId = await createPermissionedDomain(loanBroker, [
        {
          issuer: loanBroker.classicAddress,
          credentialType: "DataProviderCertified",
        },
      ]);

      const vaultId = await createLendingPool(
        loanBroker,
        body.mptIssuanceId,
        domainId
      );

      return NextResponse.json({ vaultId, domainId });
    }

    if (!body.vaultId) {
      return validationError("vaultId");
    }

    if (body.action === "deposit") {
      await depositToVault(
        provider,
        body.vaultId,
        body.mptIssuanceId,
        body.amount ?? "1"
      );

      return NextResponse.json({ status: "deposited", vaultId: body.vaultId });
    }

    await withdrawFromVault(
      provider,
      body.vaultId,
      body.mptIssuanceId,
      body.amount ?? "1"
    );

    return NextResponse.json({ status: "withdrawn", vaultId: body.vaultId });
  } catch (error) {
    console.error("[vault] Error:", error);
    return apiError(error);
  }
}
