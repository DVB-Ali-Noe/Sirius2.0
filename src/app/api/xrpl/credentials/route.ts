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

export async function POST(request: NextRequest) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as {
      action?: string;
      credentialType?: string;
      target?: string;
      address?: string;
    };

    if (!body.action || (body.action !== "issue" && body.action !== "accept")) {
      return validationError("action (issue | accept)");
    }

    if (!body.credentialType || !(body.credentialType in CREDENTIAL_TYPES)) {
      return validationError("credentialType");
    }

    const loanBroker = getLoanBroker();
    const credentialType = body.credentialType as CredentialTypeName;

    if (body.action === "issue") {
      let subjectAddress: string;

      if (body.address) {
        subjectAddress = body.address;
      } else if (body.target === "provider") {
        subjectAddress = getProvider().classicAddress;
      } else if (body.target === "borrower") {
        subjectAddress = getBorrower().classicAddress;
      } else {
        return validationError("address or target (provider | borrower)");
      }

      await issueCredential(loanBroker, subjectAddress, credentialType);

      return NextResponse.json({
        status: "issued",
        issuer: loanBroker.classicAddress,
        subject: subjectAddress,
        credentialType,
      });
    }

    if (body.target === "provider") {
      await acceptCredential(getProvider(), loanBroker.classicAddress, credentialType);
      return NextResponse.json({ status: "accepted", subject: getProvider().classicAddress, credentialType });
    }
    if (body.target === "borrower") {
      await acceptCredential(getBorrower(), loanBroker.classicAddress, credentialType);
      return NextResponse.json({ status: "accepted", subject: getBorrower().classicAddress, credentialType });
    }

    return validationError("target (provider | borrower) — accept requires a known wallet");
  } catch (error) {
    return apiError(error);
  }
}
