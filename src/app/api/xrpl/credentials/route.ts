import { NextRequest, NextResponse } from "next/server";
import {
  issueCredential,
  acceptCredential,
  getLoanBroker,
  getProvider,
  getBorrower,
  CREDENTIAL_TYPES,
  type CredentialTypeName,
} from "@/lib/xrpl";
import { requireAuth, apiError, validationError } from "@/lib/api-utils";

const VALID_ACTIONS = ["issue", "accept"] as const;
const VALID_TARGETS = ["provider", "borrower"] as const;

export async function POST(request: NextRequest) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as {
      action?: string;
      credentialType?: string;
      target?: string;
    };

    if (!body.action || !VALID_ACTIONS.includes(body.action as typeof VALID_ACTIONS[number])) {
      return validationError("action (issue | accept)");
    }

    if (!body.credentialType || !(body.credentialType in CREDENTIAL_TYPES)) {
      return validationError("credentialType");
    }

    if (!body.target || !VALID_TARGETS.includes(body.target as typeof VALID_TARGETS[number])) {
      return validationError("target (provider | borrower)");
    }

    const loanBroker = getLoanBroker();
    const targetWallet =
      body.target === "provider" ? getProvider() : getBorrower();
    const credentialType = body.credentialType as CredentialTypeName;

    if (body.action === "issue") {
      await issueCredential(
        loanBroker,
        targetWallet.classicAddress,
        credentialType
      );

      return NextResponse.json({
        status: "issued",
        issuer: loanBroker.classicAddress,
        subject: targetWallet.classicAddress,
        credentialType,
      });
    }

    await acceptCredential(
      targetWallet,
      loanBroker.classicAddress,
      credentialType
    );

    return NextResponse.json({
      status: "accepted",
      subject: targetWallet.classicAddress,
      credentialType,
    });
  } catch (error) {
    return apiError(error);
  }
}
