import { NextRequest, NextResponse } from "next/server";
import { ingestDataset, attachMpt, attachVault, type DatasetDescription } from "@/lib/sirius";
import {
  mintDatasetMPT,
  authorizeMPTHolder,
  holderOptInMPT,
  createPermissionedDomain,
  createLendingPool,
  depositToVault,
  createLoanBroker,
  getProvider,
  getLoanBroker,
  type DatasetMetadata,
} from "@/lib/xrpl";
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
    };

    if (!body.providerAddress) return validationError("providerAddress");
    if (!body.description?.name) return validationError("description.name");
    if (!body.description?.category) return validationError("description.category");
    if (!Array.isArray(body.rows) || body.rows.length === 0) return validationError("rows");
    if (body.rows.length > 10000) return validationError("rows (max 10000)");
    if (!body.schema) return validationError("schema");

    const steps: Array<{ step: string; detail: string }> = [];

    // Step 1 — Sirius
    const ingestion = await ingestDataset({
      providerAddress: body.providerAddress,
      description: body.description,
      rows: body.rows,
      schema: body.schema,
    });
    steps.push({ step: "sirius_ingested", detail: `${ingestion.entryCount} rows, CID: ${ingestion.manifestCid}` });

    // Quality score
    const dupRate = parseFloat(ingestion.boundlessProof.assertions.duplicateRate) / 100;
    let qualityScore = 0;
    if (ingestion.entryCount >= 1000) qualityScore += 30;
    else if (ingestion.entryCount >= 500) qualityScore += 20;
    else if (ingestion.entryCount >= 100) qualityScore += 10;
    if (dupRate < 0.001) qualityScore += 30;
    else if (dupRate < 0.01) qualityScore += 25;
    else if (dupRate < 0.05) qualityScore += 15;
    else if (dupRate < 0.1) qualityScore += 5;
    qualityScore += 20 + 20;
    qualityScore = Math.min(qualityScore, 100);

    // Step 2 — Mint MPT
    const provider = getProvider();
    const loanBroker = getLoanBroker();

    const metadata: DatasetMetadata = {
      dataset: body.description,
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

    const { mptIssuanceId } = await mintDatasetMPT(provider, metadata);
    attachMpt(ingestion.datasetId, mptIssuanceId);
    steps.push({ step: "mpt_minted", detail: mptIssuanceId });

    // Step 3 — Authorize LoanBroker
    await holderOptInMPT(loanBroker, mptIssuanceId);
    await authorizeMPTHolder(provider, mptIssuanceId, loanBroker.classicAddress);
    steps.push({ step: "loanbroker_authorized", detail: "OK" });

    // Step 4 — Vault
    const domainId = await createPermissionedDomain(loanBroker, [
      { issuer: loanBroker.classicAddress, credentialType: "DataProviderCertified" },
    ]);
    const vaultId = await createLendingPool(loanBroker, mptIssuanceId, domainId);
    attachVault(ingestion.datasetId, vaultId);
    steps.push({ step: "vault_created", detail: vaultId });

    // Step 5 — Deposit
    await depositToVault(provider, vaultId, mptIssuanceId, "1");
    steps.push({ step: "mpt_deposited", detail: "1 MPT" });

    // Step 6 — Create LoanBroker
    const loanBrokerId = await createLoanBroker(loanBroker, vaultId);
    steps.push({ step: "loan_broker_created", detail: loanBrokerId });

    return NextResponse.json({
      success: true,
      datasetId: ingestion.datasetId,
      mptIssuanceId,
      vaultId,
      domainId,
      manifestCid: ingestion.manifestCid,
      merkleRoot: ingestion.merkleRoot,
      entryCount: ingestion.entryCount,
      qualityScore,
      steps,
    });
  } catch (error) {
    console.error("[provider/upload] Error:", error);
    return apiError(error);
  }
}
