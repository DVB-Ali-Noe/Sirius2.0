import { NextRequest, NextResponse } from "next/server";
import {
  mintDatasetMPT,
  authorizeMPTHolder,
  holderOptInMPT,
  getProvider,
  getLoanBroker,
  type DatasetMetadata,
} from "@/lib/xrpl";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { metadata: DatasetMetadata };

  const provider = getProvider();
  const loanBroker = getLoanBroker();

  const { mptIssuanceId } = await mintDatasetMPT(provider, body.metadata);

  await holderOptInMPT(loanBroker, mptIssuanceId);
  await authorizeMPTHolder(provider, mptIssuanceId, loanBroker.classicAddress);

  return NextResponse.json({ mptIssuanceId });
}
