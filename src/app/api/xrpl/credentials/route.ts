import { NextRequest, NextResponse } from "next/server";
import {
  issueCredential,
  acceptCredential,
  getLoanBroker,
  getProvider,
  getBorrower,
  type CredentialTypeName,
} from "@/lib/xrpl";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    action: "issue" | "accept";
    credentialType: CredentialTypeName;
    target: "provider" | "borrower";
  };

  const loanBroker = getLoanBroker();
  const targetWallet =
    body.target === "provider" ? getProvider() : getBorrower();

  if (body.action === "issue") {
    await issueCredential(
      loanBroker,
      targetWallet.classicAddress,
      body.credentialType
    );

    return NextResponse.json({
      status: "issued",
      issuer: loanBroker.classicAddress,
      subject: targetWallet.classicAddress,
      credentialType: body.credentialType,
    });
  }

  await acceptCredential(
    targetWallet,
    loanBroker.classicAddress,
    body.credentialType
  );

  return NextResponse.json({
    status: "accepted",
    subject: targetWallet.classicAddress,
    credentialType: body.credentialType,
  });
}
