import { NextRequest, NextResponse } from "next/server";
import { listDatasets, getDataset } from "@/lib/sirius";
import { requireAuth, apiError } from "@/lib/api-utils";

function publicView(d: ReturnType<typeof listDatasets>[number]) {
  return {
    datasetId: d.datasetId,
    providerAddress: d.providerAddress,
    description: d.description,
    manifestCid: d.manifestCid,
    merkleRoot: d.merkleRoot,
    entryCount: d.entryCount,
    schemaHash: d.schemaHash,
    boundlessProof: d.boundlessProof,
    version: d.version,
    createdAt: d.createdAt,
    mptIssuanceId: d.mptIssuanceId,
  };
}

export async function GET(request: NextRequest) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  try {
    const datasetId = request.nextUrl.searchParams.get("datasetId");

    if (datasetId) {
      const d = getDataset(datasetId);
      if (!d) return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
      return NextResponse.json({ dataset: publicView(d) });
    }

    return NextResponse.json({ datasets: listDatasets().map(publicView) });
  } catch (error) {
    return apiError(error);
  }
}
