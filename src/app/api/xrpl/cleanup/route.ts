import { NextRequest, NextResponse } from "next/server";
import {
  withdrawFromVault,
  deleteVault,
  deleteLoanBroker,
  destroyMPT,
  deleteLoan,
  getLoanBroker,
  getProvider,
  getAllLoans,
  removeLoan,
  clearAllLoans,
} from "@/lib/xrpl";
import { unregisterDataset, listDatasets, clearAllDatasets } from "@/lib/sirius/dataset-registry";
import { removeByLoan, clearAllKeys } from "@/lib/sirius/key-store";
import { requireAuth, apiError } from "@/lib/api-utils";

interface CleanupTarget {
  vaultId: string;
  mptIssuanceId: string;
  loanBrokerId?: string;
  datasetId?: string;
}

interface StepResult {
  step: string;
  status: "ok" | "skipped" | "failed";
  error?: string;
}

async function cleanupPool(
  target: CleanupTarget,
  loanBroker: ReturnType<typeof getLoanBroker>,
  provider: ReturnType<typeof getProvider>
): Promise<StepResult[]> {
  const results: StepResult[] = [];

  // 1. Delete active loans for this vault
  const loans = getAllLoans().filter((l) => l.vaultId === target.vaultId);
  for (const loan of loans) {
    try {
      if (!loan.loanId.startsWith("loan-") && !loan.loanId.startsWith("demo-loan-")) {
        await deleteLoan(loanBroker, loan.loanId);
      }
      removeByLoan(loan.loanId);
      removeLoan(loan.loanId);
      results.push({ step: `loan:${loan.loanId}`, status: "ok" });
    } catch (e) {
      results.push({ step: `loan:${loan.loanId}`, status: "failed", error: (e as Error).message });
    }
  }

  // 2. Withdraw MPT from vault
  try {
    await withdrawFromVault(provider, target.vaultId, target.mptIssuanceId, "1");
    results.push({ step: "withdraw", status: "ok" });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("tecINSUFFICIENT") || msg.includes("tecNO_ENTRY")) {
      results.push({ step: "withdraw", status: "skipped", error: "vault already empty" });
    } else {
      results.push({ step: "withdraw", status: "failed", error: msg });
    }
  }

  // 3. Delete loan broker (if provided)
  if (target.loanBrokerId) {
    try {
      await deleteLoanBroker(loanBroker, target.loanBrokerId);
      results.push({ step: "loanBrokerDelete", status: "ok" });
    } catch (e) {
      results.push({ step: "loanBrokerDelete", status: "failed", error: (e as Error).message });
    }
  }

  // 4. Delete vault
  try {
    await deleteVault(loanBroker, target.vaultId);
    results.push({ step: "vaultDelete", status: "ok" });
  } catch (e) {
    results.push({ step: "vaultDelete", status: "failed", error: (e as Error).message });
  }

  // 5. Destroy MPT issuance
  try {
    await destroyMPT(provider, target.mptIssuanceId);
    results.push({ step: "mptDestroy", status: "ok" });
  } catch (e) {
    results.push({ step: "mptDestroy", status: "failed", error: (e as Error).message });
  }

  // 6. Cleanup in-memory dataset record
  if (target.datasetId) {
    unregisterDataset(target.datasetId);
    results.push({ step: "datasetUnregister", status: "ok" });
  }

  return results;
}

export async function POST(request: NextRequest) {
  const authErr = requireAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as {
      action: "pool" | "clear-stores";
      targets?: CleanupTarget[];
    };

    const loanBroker = getLoanBroker();
    const provider = getProvider();

    if (body.action === "clear-stores") {
      const loansCleared = clearAllLoans();
      const datasetsCleared = clearAllDatasets();
      const keysCleared = clearAllKeys();
      return NextResponse.json({
        status: "cleared",
        loansCleared,
        datasetsCleared,
        keysCleared,
      });
    }

    if (body.action === "pool") {
      if (!body.targets?.length) {
        return NextResponse.json({ error: "targets[] required" }, { status: 400 });
      }

      const allResults: Array<{ target: CleanupTarget; steps: StepResult[] }> = [];

      for (const target of body.targets) {
        const steps = await cleanupPool(target, loanBroker, provider);
        allResults.push({ target, steps });
      }

      return NextResponse.json({ status: "done", results: allResults });
    }

    return NextResponse.json({ error: "action must be 'pool' or 'clear-stores'" }, { status: 400 });
  } catch (error) {
    console.error("[cleanup] Error:", error);
    return apiError(error);
  }
}
