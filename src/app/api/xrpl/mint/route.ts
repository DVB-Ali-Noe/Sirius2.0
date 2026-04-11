import { NextRequest, NextResponse } from "next/server";
import {
  mintDatasetMPT,
  authorizeMPTHolder,
  holderOptInMPT,
  getProvider,
  getLoanBroker,
  type DatasetMetadata,
} from "@/lib/xrpl";
import { requireAuth, apiError, validationError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as { metadata?: DatasetMetadata };

    if (!body.metadata?.ipfsHash || !body.metadata?.dataset?.name) {
      return validationError("metadata (ipfsHash, dataset.name required)");
    }

    const provider = getProvider();
    const loanBroker = getLoanBroker();

    const { mptIssuanceId } = await mintDatasetMPT(provider, body.metadata);

    await holderOptInMPT(loanBroker, mptIssuanceId);
    await authorizeMPTHolder(provider, mptIssuanceId, loanBroker.classicAddress);

    return NextResponse.json({ mptIssuanceId });
  } catch (error) {
    return apiError(error);
  }
}
