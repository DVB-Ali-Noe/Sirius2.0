import { NextRequest, NextResponse } from "next/server";
import { verifyQualityProof, computeDatasetDigest, getDataset, decryptDatasetWithKey } from "@/lib/sirius";
import { requireAuth, apiError, validationError } from "@/lib/api-utils";

interface VerifyBody {
  datasetId?: string;
  sampleRows?: unknown[];
  schema?: string;
}

export async function POST(request: NextRequest) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as VerifyBody;

    if (!body.datasetId) return validationError("datasetId");

    const dataset = getDataset(body.datasetId);
    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    if (!body.sampleRows || !body.schema) {
      const rows = await decryptDatasetWithKey(dataset.manifestCid, dataset.masterKeyEncoded);
      const realDigest = computeDatasetDigest(rows, dataset.boundlessProof.assertions.schema);
      const valid = verifyQualityProof(dataset.boundlessProof, realDigest);
      return NextResponse.json({
        proof: dataset.boundlessProof,
        verified: valid.valid,
        reason: valid.reason,
        note: "verified against decrypted dataset",
      });
    }

    const digest = computeDatasetDigest(body.sampleRows, body.schema);
    const result = verifyQualityProof(dataset.boundlessProof, digest);

    return NextResponse.json({
      proof: dataset.boundlessProof,
      verified: result.valid,
      reason: result.reason,
    });
  } catch (error) {
    return apiError(error);
  }
}
