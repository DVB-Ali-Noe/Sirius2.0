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
  createLoan,
  type DatasetMetadata,
} from "@/lib/xrpl";
import { createLoanRecord, transitionLoan } from "@/lib/xrpl/loan-state";
import { subscribeToAccounts } from "@/lib/xrpl/events";
import { requireAuth, apiError } from "@/lib/api-utils";

function buildDemoMetadata(): DatasetMetadata {
  return {
    dataset: {
      name: "GPT-4 Instruction Tuning Dataset",
      description: "High-quality instruction-response pairs for LLM fine-tuning. Covers reasoning, coding, and general knowledge.",
      category: "instruction-tuning",
      language: "en",
      format: "jsonl",
      sampleFields: ["instruction", "response", "category", "difficulty"],
    },
    ipfsHash: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    zkProofRef: "boundless://proof/demo-001",
    schemaHash: "0xa1b2c3d4e5f6789012345678deadbeef",
    qualityCertificate: {
      entryCount: 100000,
      duplicateRate: "0.02%",
      schema: "openai-chat-v1",
      certifiedAt: Date.now(),
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

    await issueCredential(loanBroker, provider.classicAddress, "DataProviderCertified");
    await issueCredential(loanBroker, borrower.classicAddress, "BorrowerKYB");
    steps.push({ step: "credentials_issued", result: { provider: provider.classicAddress, borrower: borrower.classicAddress } });

    await acceptCredential(provider, loanBroker.classicAddress, "DataProviderCertified");
    await acceptCredential(borrower, loanBroker.classicAddress, "BorrowerKYB");
    steps.push({ step: "credentials_accepted", result: "ok" });

    const { mptIssuanceId } = await mintDatasetMPT(provider, buildDemoMetadata());
    steps.push({ step: "mpt_minted", result: { mptIssuanceId } });

    await holderOptInMPT(loanBroker, mptIssuanceId);
    await authorizeMPTHolder(provider, mptIssuanceId, loanBroker.classicAddress);
    steps.push({ step: "loanbroker_authorized", result: "ok" });

    const domainId = await createPermissionedDomain(loanBroker, [
      { issuer: loanBroker.classicAddress, credentialType: "DataProviderCertified" },
    ]);

    const vaultId = await createLendingPool(loanBroker, mptIssuanceId, domainId, "DataLend Tier 2 - Instruction Tuning");
    steps.push({ step: "lending_pool_created", result: { vaultId, domainId } });

    await depositToVault(provider, vaultId, mptIssuanceId, "1");
    steps.push({ step: "mpt_deposited", result: { vaultId } });

    await subscribeToAccounts([
      provider.classicAddress,
      borrower.classicAddress,
      loanBroker.classicAddress,
    ]);
    steps.push({ step: "events_subscribed", result: "ok" });

    const loanId = await createLoan(borrower, {
      loanBrokerId: loanBroker.classicAddress,
      principalAmount: "1",
      interestRate: 500,
      paymentTotal: 1,
      paymentInterval: 2592000,
      gracePeriod: 86400,
    });
    steps.push({ step: "loan_created", result: { loanId } });

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

    return NextResponse.json({
      success: true,
      steps,
      summary: {
        provider: provider.classicAddress,
        borrower: borrower.classicAddress,
        loanBroker: loanBroker.classicAddress,
        mptIssuanceId,
        vaultId,
        domainId,
        loanId,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
