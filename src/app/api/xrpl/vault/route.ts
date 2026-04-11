import { NextRequest, NextResponse } from "next/server";
import {
  createLendingPool,
  createPermissionedDomain,
  depositToVault,
  withdrawFromVault,
  getLoanBroker,
  getProvider,
} from "@/lib/xrpl";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    action: "create" | "deposit" | "withdraw";
    mptIssuanceId: string;
    vaultId?: string;
    amount?: string;
  };

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

  if (body.action === "deposit") {
    await depositToVault(
      provider,
      body.vaultId!,
      body.mptIssuanceId,
      body.amount ?? "1"
    );

    return NextResponse.json({ status: "deposited", vaultId: body.vaultId });
  }

  await withdrawFromVault(
    provider,
    body.vaultId!,
    body.mptIssuanceId,
    body.amount ?? "1"
  );

  return NextResponse.json({ status: "withdrawn", vaultId: body.vaultId });
}
