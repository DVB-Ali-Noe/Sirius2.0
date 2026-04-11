import { NextRequest, NextResponse } from "next/server";
import { ingestDataset, type DatasetDescription } from "@/lib/sirius";
import { requireAuth, apiError, validationError } from "@/lib/api-utils";

interface UploadBody {
  providerAddress?: string;
  description?: DatasetDescription;
  rows?: unknown[];
  schema?: string;
  version?: string;
  chunkSize?: number;
}

export async function POST(request: NextRequest) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as UploadBody;

    if (!body.providerAddress) return validationError("providerAddress");
    if (!body.description?.name) return validationError("description.name");
    if (!body.description?.category) return validationError("description.category");
    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      return validationError("rows (non-empty array)");
    }
    if (!body.schema) return validationError("schema");

    const result = await ingestDataset({
      providerAddress: body.providerAddress,
      description: body.description,
      rows: body.rows,
      schema: body.schema,
      version: body.version,
      chunkSize: body.chunkSize,
    });

    return NextResponse.json({
      datasetId: result.datasetId,
      manifestCid: result.manifestCid,
      merkleRoot: result.merkleRoot,
      entryCount: result.entryCount,
      boundlessProof: result.boundlessProof,
      ipfs: {
        cid: result.pin.cid,
        size: result.pin.size,
        pinnedAt: result.pin.pinnedAt,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
