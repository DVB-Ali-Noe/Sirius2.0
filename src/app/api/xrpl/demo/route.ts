import { NextRequest, NextResponse } from "next/server";
import {
  getDemoWallets,
  issueCredential,
  acceptCredential,
  mintDatasetMPT,
  authorizeMPTHolder,
  holderOptInMPT,
  createPermissionedDomain,
  createLendingPool,
  depositToVault,
  createLoanBroker,
  createLoan,
  type DatasetMetadata,
} from "@/lib/xrpl";
import { createLoanRecord, transitionLoan } from "@/lib/xrpl/loan-state";
import { subscribeToAccounts } from "@/lib/xrpl/events";
import { ingestDataset, attachMpt, getDataset, type DatasetDescription } from "@/lib/sirius";
import {
  activateLoanAccess,
  installXrplBridge,
  getWatermarkSeed,
} from "@/lib/sirius/xrpl-bridge";
import { requireAuth, apiError } from "@/lib/api-utils";

function demoDatasetDescription(): DatasetDescription {
  return {
    name: "GPT-4 Instruction Tuning Dataset",
    description:
      "High-quality instruction-response pairs for LLM fine-tuning. Covers reasoning, coding, and general knowledge.",
    category: "instruction-tuning",
    language: "en",
    format: "jsonl",
    sampleFields: ["instruction", "response", "category", "difficulty"],
  };
}

const DEMO_SCHEMA = "openai-chat-v1";

function generateDemoRows(count: number): Array<Record<string, unknown>> {
  const categories = ["reasoning", "coding", "math", "knowledge", "writing"];
  const difficulties = ["easy", "medium", "hard"];
  const rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      id: i,
      instruction: `Example instruction #${i} — explain concept ${i % 50}`,
      response: `Example response for prompt #${i}.`,
      category: categories[i % categories.length],
      difficulty: difficulties[i % difficulties.length],
      score: Math.round((0.6 + (i % 40) / 100) * 1000) / 1000,
    });
  }
  return rows;
}

function buildMetadataFromSirius(
  ipfsCid: string,
  entryCount: number,
  schemaHash: string,
  proofId: string,
  duplicateRate: string
): DatasetMetadata {
  return {
    dataset: demoDatasetDescription(),
    ipfsHash: ipfsCid,
    zkProofRef: `boundless://proof/${proofId}`,
    schemaHash,
    qualityCertificate: {
      entryCount,
      duplicateRate,
      schema: DEMO_SCHEMA,
      certifiedAt: Date.now(),
      qualityScore: 92,
    },
    version: "2025-Q1-v1",
  };
}

export async function POST(request: NextRequest) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  try {
    const { provider, borrower, loanBroker } = getDemoWallets();
    const steps: Array<{ step: string; result: unknown }> = [];

    installXrplBridge();

    // Credentials may already exist from prior runs — skip known errors
    const skipKnown = (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("tecDUPLICATE") || msg.includes("temBAD_SIGNER") || msg.includes("already exists") || msg.includes("tecNO_PERMISSION")) {
        return;
      }
      throw e;
    };

    await issueCredential(loanBroker, provider.classicAddress, "DataProviderCertified").catch(skipKnown);
    await issueCredential(loanBroker, borrower.classicAddress, "BorrowerKYB").catch(skipKnown);
    steps.push({ step: "credentials_issued", result: { provider: provider.classicAddress, borrower: borrower.classicAddress } });

    await acceptCredential(provider, loanBroker.classicAddress, "DataProviderCertified").catch(skipKnown);
    await acceptCredential(borrower, loanBroker.classicAddress, "BorrowerKYB").catch(skipKnown);
    steps.push({ step: "credentials_accepted", result: "ok" });

    const demoRows = generateDemoRows(200);
    const ingestion = await ingestDataset({
      providerAddress: provider.classicAddress,
      description: demoDatasetDescription(),
      rows: demoRows,
      schema: DEMO_SCHEMA,
    });
    steps.push({
      step: "sirius_ingested",
      result: {
        datasetId: ingestion.datasetId,
        manifestCid: ingestion.manifestCid,
        merkleRoot: ingestion.merkleRoot,
        entryCount: ingestion.entryCount,
        boundlessProofId: ingestion.boundlessProof.proofId,
      },
    });

    const metadata = buildMetadataFromSirius(
      ingestion.manifestCid,
      ingestion.entryCount,
      ingestion.boundlessProof.assertions.schemaHash,
      ingestion.boundlessProof.proofId,
      ingestion.boundlessProof.assertions.duplicateRate
    );

    const { mptIssuanceId } = await mintDatasetMPT(provider, metadata);
    steps.push({ step: "mpt_minted", result: { mptIssuanceId } });

    attachMpt(ingestion.datasetId, mptIssuanceId);
    steps.push({
      step: "sirius_mpt_attached",
      result: { datasetId: ingestion.datasetId, mptIssuanceId },
    });

    await holderOptInMPT(loanBroker, mptIssuanceId);
    await authorizeMPTHolder(provider, mptIssuanceId, loanBroker.classicAddress);
    steps.push({ step: "loanbroker_authorized", result: "ok" });

    const domainId = await createPermissionedDomain(loanBroker, [
      { issuer: loanBroker.classicAddress, credentialType: "DataProviderCertified" },
    ]);

    const vaultId = await createLendingPool(loanBroker, mptIssuanceId, domainId, "DataLend Tier 2 - Instruction Tuning");
    steps.push({ step: "lending_pool_created", result: { vaultId, domainId } });

    await depositToVault(provider, vaultId, mptIssuanceId, "1");
    const dsRecord = getDataset(ingestion.datasetId);
    if (dsRecord) dsRecord.vaultId = vaultId;
    steps.push({ step: "mpt_deposited", result: { vaultId } });

    // Step — Create LoanBroker object (returns 64-char hex ID)
    const loanBrokerId = await createLoanBroker(loanBroker, vaultId);
    steps.push({ step: "loan_broker_created", result: { loanBrokerId } });

    await subscribeToAccounts([
      provider.classicAddress,
      borrower.classicAddress,
      loanBroker.classicAddress,
    ]);
    steps.push({ step: "events_subscribed", result: "ok" });

    // LoanSet may fail on wasm devnet (temBAD_SIGNER bug) — continue with mock loan
    let loanId: string;
    let loanOnChain = false;
    try {
      loanId = await createLoan(loanBroker, borrower.classicAddress, {
        loanBrokerId,
        principalAmount: "1",
        interestRate: 500,
        paymentTotal: 1,
        paymentInterval: 2592000,
        gracePeriod: 86400,
      });
      loanOnChain = true;
      steps.push({ step: "loan_created", result: { loanId, onChain: true } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[demo] LoanSet failed (wasm devnet limitation):", msg);
      loanId = `demo-loan-${Date.now().toString(36)}`;
      steps.push({ step: "loan_created", result: { loanId, onChain: false, reason: msg } });
    }

    const loanRecord = createLoanRecord({
      loanId,
      borrower: borrower.classicAddress,
      provider: provider.classicAddress,
      loanBroker: loanBroker.classicAddress,
      vaultId,
      mptIssuanceId,
      principalAmount: "1",
      interestRate: 500,
      paymentTotal: 1,
      paymentInterval: 2592000,
      gracePeriod: 86400,
    });

    transitionLoan(loanId, "ACTIVE");
    steps.push({ step: "loan_active", result: loanRecord });

    const activation = activateLoanAccess(loanId);
    if (!activation.ok) {
      throw new Error(`Sirius key activation failed: ${activation.reason}`);
    }
    const watermarkSeed = getWatermarkSeed(loanId);
    steps.push({
      step: "sirius_key_issued",
      result: {
        keyId: activation.keyId,
        watermarkSeedPrefix: watermarkSeed ? watermarkSeed.seed.slice(0, 16) : null,
      },
    });

    return NextResponse.json({
      success: true,
      steps,
      summary: {
        provider: provider.classicAddress,
        borrower: borrower.classicAddress,
        loanBroker: loanBroker.classicAddress,
        datasetId: ingestion.datasetId,
        manifestCid: ingestion.manifestCid,
        mptIssuanceId,
        vaultId,
        domainId,
        loanBrokerId,
        loanId,
        loanOnChain,
        siriusKeyId: activation.keyId,
      },
    });
  } catch (error) {
    console.error("[demo] Error:", error);
    return apiError(error);
  }
}
