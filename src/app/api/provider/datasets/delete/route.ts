import { NextRequest, NextResponse } from "next/server";
import {
  getClient,
  getLoanBroker,
  deleteLoanBroker,
  deleteVault,
  getAllLoans,
  removeLoan,
} from "@/lib/xrpl";
import { unregisterDataset, getByMpt } from "@/lib/sirius/dataset-registry";
import { unpinFromIpfs } from "@/lib/sirius/ipfs";
import { removeByLoan } from "@/lib/sirius/key-store";
import { requireAuth, apiError, validationError } from "@/lib/api-utils";

interface StepResult {
  step: string;
  status: "ok" | "skipped" | "failed";
  error?: string;
}

/**
 * Phase 1 — POST { action: "prepare", mptIssuanceId, providerAddress }
 *   Returns unsigned transactions for the client wallet to sign.
 *
 * Phase 2 — POST { action: "finalize", mptIssuanceId }
 *   Server cleans up its own objects (vault, loanBroker, in-memory stores).
 */
export async function POST(request: NextRequest) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as {
      action: "prepare" | "finalize";
      mptIssuanceId?: string;
      providerAddress?: string;
      ipfsCid?: string;
    };

    if (!body.mptIssuanceId) return validationError("mptIssuanceId");

    const client = await getClient();
    const loanBroker = getLoanBroker();
    const mptIssuanceId = body.mptIssuanceId;

    // Check for active loans
    const activeLoans = getAllLoans().filter(
      (l) => l.mptIssuanceId === mptIssuanceId && !["COMPLETED", "DEFAULTED"].includes(l.status)
    );
    if (activeLoans.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete: dataset has active loans", loans: activeLoans.map((l) => l.loanId) },
        { status: 409 }
      );
    }

    // Find vault for this MPT
    let vaultId: string | null = null;
    let loanBrokerId: string | null = null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vaultRes: any = await client.request({
      command: "account_objects",
      account: loanBroker.classicAddress,
      type: "vault",
    });
    const vaults: Array<Record<string, unknown>> = vaultRes.result?.account_objects ?? [];
    const vaultMatch = vaults.find(
      (v) => (v.Asset as { mpt_issuance_id?: string })?.mpt_issuance_id === mptIssuanceId
    );
    if (vaultMatch) vaultId = vaultMatch.index as string;

    // Find LoanBroker
    if (vaultId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const brokerRes: any = await client.request({
        command: "account_objects",
        account: loanBroker.classicAddress,
        type: "loan_broker",
      });
      const brokers: Array<Record<string, unknown>> = brokerRes.result?.account_objects ?? [];
      const brokerMatch = brokers.find((b) => b.VaultID === vaultId);
      if (brokerMatch) loanBrokerId = brokerMatch.index as string;
    }

    // ──────────────────────────────────────────────
    // PREPARE: return unsigned txs for client wallet
    // ──────────────────────────────────────────────
    if (body.action === "prepare") {
      if (!body.providerAddress) return validationError("providerAddress");
      const providerAddress = body.providerAddress;

      const transactions: Array<{ name: string; tx: Record<string, unknown> }> = [];

      // 1. Withdraw from vault (provider signed the deposit, provider must withdraw)
      if (vaultId) {
        transactions.push({
          name: "vaultWithdraw",
          tx: {
            TransactionType: "VaultWithdraw",
            Account: providerAddress,
            VaultID: vaultId,
            Amount: { mpt_issuance_id: mptIssuanceId, value: "1" },
          },
        });
      }

      // 2. Issuer unauthorizes loanBroker as holder
      transactions.push({
        name: "unauthorizeLoanBroker",
        tx: {
          TransactionType: "MPTokenAuthorize",
          Account: providerAddress,
          MPTokenIssuanceID: mptIssuanceId,
          Holder: loanBroker.classicAddress,
          Flags: 1, // tfMPTUnauthorize
        },
      });

      // 3. Destroy MPT (issuer = provider)
      transactions.push({
        name: "mptDestroy",
        tx: {
          TransactionType: "MPTokenIssuanceDestroy",
          Account: providerAddress,
          MPTokenIssuanceID: mptIssuanceId,
        },
      });

      return NextResponse.json({
        phase: "prepare",
        vaultId,
        loanBrokerId,
        transactions,
      });
    }

    // ──────────────────────────────────────────────
    // FINALIZE: server cleans up its own objects
    // ──────────────────────────────────────────────
    if (body.action === "finalize") {
      const steps: StepResult[] = [];

      // Clean stale loans in-memory
      const staleLoans = getAllLoans().filter(
        (l) => l.mptIssuanceId === mptIssuanceId && ["COMPLETED", "DEFAULTED"].includes(l.status)
      );
      for (const loan of staleLoans) {
        removeByLoan(loan.loanId);
        removeLoan(loan.loanId);
      }

      // LoanBroker opt-out from MPT
      try {
        await client.submitAndWait(
          {
            TransactionType: "MPTokenAuthorize",
            Account: loanBroker.classicAddress,
            MPTokenIssuanceID: mptIssuanceId,
            Flags: 1, // tfMPTUnauthorize
          },
          { wallet: loanBroker }
        );
        steps.push({ step: "loanBrokerOptOut", status: "ok" });
      } catch (e) {
        const msg = (e as Error).message;
        if (msg.includes("tecNO_ENTRY") || msg.includes("tecNO_PERMISSION")) {
          steps.push({ step: "loanBrokerOptOut", status: "skipped", error: "already opted out" });
        } else {
          steps.push({ step: "loanBrokerOptOut", status: "failed", error: msg });
        }
      }

      // Delete LoanBroker
      if (loanBrokerId) {
        try {
          await deleteLoanBroker(loanBroker, loanBrokerId);
          steps.push({ step: "loanBrokerDelete", status: "ok" });
        } catch (e) {
          steps.push({ step: "loanBrokerDelete", status: "failed", error: (e as Error).message });
        }
      }

      // Delete vault
      if (vaultId) {
        try {
          await deleteVault(loanBroker, vaultId);
          steps.push({ step: "vaultDelete", status: "ok" });
        } catch (e) {
          steps.push({ step: "vaultDelete", status: "failed", error: (e as Error).message });
        }
      }

      // Unpin from IPFS (use client-provided CID or fall back to registry)
      const dataset = getByMpt(mptIssuanceId);
      const cidToUnpin = body.ipfsCid || dataset?.manifestCid;
      if (cidToUnpin) {
        try {
          const unpinned = await unpinFromIpfs(cidToUnpin);
          steps.push({ step: "ipfsUnpin", status: unpinned ? "ok" : "skipped", error: unpinned ? undefined : "not pinned" });
        } catch (e) {
          steps.push({ step: "ipfsUnpin", status: "failed", error: (e as Error).message });
        }
      }

      // Cleanup in-memory
      if (dataset) {
        unregisterDataset(dataset.datasetId);
        steps.push({ step: "registryCleanup", status: "ok" });
      }

      const failed = steps.filter((s) => s.status === "failed");
      return NextResponse.json({
        phase: "finalize",
        status: failed.length === 0 ? "deleted" : "partial",
        steps,
      });
    }

    return NextResponse.json({ error: "action must be 'prepare' or 'finalize'" }, { status: 400 });
  } catch (error) {
    console.error("[provider/datasets/delete] Error:", error);
    return apiError(error);
  }
}
