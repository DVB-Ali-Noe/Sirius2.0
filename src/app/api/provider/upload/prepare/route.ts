import { NextRequest, NextResponse } from "next/server";
import { ingestDataset, type DatasetDescription } from "@/lib/sirius";
import { buildMPTokenMetadata, type DatasetMetadata } from "@/lib/xrpl";
import { requireAuth, apiError, validationError } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as {
      providerAddress?: string;
      description?: DatasetDescription;
      rows?: unknown[];
      schema?: string;
      pricePerDay?: string;
    };

    if (!body.providerAddress) return validationError("providerAddress");
    if (!body.description?.name) return validationError("description.name");
    if (!body.description?.category) return validationError("description.category");
    if (!Array.isArray(body.rows) || body.rows.length === 0) return validationError("rows");
    if (body.rows.length > 10000) return validationError("rows (max 10000)");
    if (!body.schema) return validationError("schema");

    const pricePerDay = body.pricePerDay ?? body.description.pricePerDay ?? "0.5";
    const priceNum = parseFloat(pricePerDay);
    if (!Number.isFinite(priceNum) || priceNum <= 0) return validationError("pricePerDay");

    const description: DatasetDescription = {
      ...body.description,
      pricePerDay,
    };

    // Step 1 — Sirius: encrypt + IPFS + ZK proof
    const ingestion = await ingestDataset({
      providerAddress: body.providerAddress,
      description,
      rows: body.rows,
      schema: body.schema,
    });

    // Calculate quality score
    const dupRate = parseFloat(ingestion.boundlessProof.assertions.duplicateRate) / 100;
    let qualityScore = 0;
    if (ingestion.entryCount >= 1000) qualityScore += 30;
    else if (ingestion.entryCount >= 500) qualityScore += 20;
    else if (ingestion.entryCount >= 100) qualityScore += 10;
    if (dupRate < 0.001) qualityScore += 30;
    else if (dupRate < 0.01) qualityScore += 25;
    else if (dupRate < 0.05) qualityScore += 15;
    else if (dupRate < 0.1) qualityScore += 5;
    qualityScore += 20;
    qualityScore += 20;
    qualityScore = Math.min(qualityScore, 100);

    const metadata: DatasetMetadata = {
      dataset: description,
      ipfsHash: ingestion.manifestCid,
      zkProofRef: ingestion.boundlessProof.verifierUri,
      schemaHash: ingestion.boundlessProof.assertions.schemaHash,
      qualityCertificate: {
        entryCount: ingestion.entryCount,
        duplicateRate: ingestion.boundlessProof.assertions.duplicateRate,
        schema: body.schema,
        certifiedAt: Date.now(),
        qualityScore,
      },
      version: `${new Date().toISOString().slice(0, 10)}-v1`,
    };

    const mptMetadataHex = buildMPTokenMetadata(metadata);

    return NextResponse.json({
      datasetId: ingestion.datasetId,
      manifestCid: ingestion.manifestCid,
      merkleRoot: ingestion.merkleRoot,
      entryCount: ingestion.entryCount,
      qualityScore,
      pricePerDay,
      proof: {
        proofId: ingestion.boundlessProof.proofId,
        duplicateRate: ingestion.boundlessProof.assertions.duplicateRate,
        schemaHash: ingestion.boundlessProof.assertions.schemaHash,
        commitment: ingestion.boundlessProof.commitment,
        verifierUri: ingestion.boundlessProof.verifierUri,
      },
      metadata,
      transaction: {
        TransactionType: "MPTokenIssuanceCreate",
        Account: body.providerAddress,
        MaximumAmount: "1",
        AssetScale: 0,
        MPTokenMetadata: mptMetadataHex,
        Flags: 36,
      },
    });
  } catch (error) {
    console.error("[provider/upload/prepare] Error:", error);
    return apiError(error);
  }
}
