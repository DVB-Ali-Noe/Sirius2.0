import { onXRPLEvent } from "@/lib/xrpl/events";
import { getLoan } from "@/lib/xrpl/loan-state";
import { getByMpt, getDataset } from "./dataset-registry";
import { decodeKey } from "./encryption";
import { issueBorrowerKey, revokeByLoan } from "./key-store";
import { generateSeed, type WatermarkSeed } from "./watermark";

const activeSeeds = new Map<string, WatermarkSeed>();
let installed = false;

export interface BridgeConfig {
  defaultTtlMs: number;
}

const DEFAULT_CONFIG: BridgeConfig = {
  defaultTtlMs: 30 * 24 * 60 * 60 * 1000,
};

export function getWatermarkSeed(loanId: string): WatermarkSeed | undefined {
  return activeSeeds.get(loanId);
}

export function listActiveSeeds(): WatermarkSeed[] {
  return [...activeSeeds.values()];
}

export function activateLoanAccess(
  loanId: string,
  config: BridgeConfig = DEFAULT_CONFIG
): { ok: true; keyId: string } | { ok: false; reason: string } {
  const loan = getLoan(loanId);
  if (!loan) return { ok: false, reason: "loan not found" };
  if (!loan.mptIssuanceId) return { ok: false, reason: "loan has no mpt" };

  const dataset = getByMpt(loan.mptIssuanceId) ?? getDataset(loan.mptIssuanceId);
  if (!dataset) {
    return { ok: false, reason: `no dataset registered for mpt ${loan.mptIssuanceId}` };
  }

  const masterKey = decodeKey(dataset.masterKeyEncoded);
  const ttlMs = Math.max(
    60_000,
    loan.paymentInterval * loan.paymentTotal * 1000 || config.defaultTtlMs
  );

  const record = issueBorrowerKey({
    borrower: loan.borrower,
    loanId,
    datasetId: dataset.datasetId,
    masterKey,
    ttlMs,
  });

  const seed = generateSeed(loan.borrower, loanId, dataset.datasetId);
  activeSeeds.set(loanId, seed);

  return { ok: true, keyId: record.keyId };
}

export function terminateLoanAccess(loanId: string, reason: string): boolean {
  const revoked = revokeByLoan(loanId, reason);
  activeSeeds.delete(loanId);
  return revoked !== null;
}

export function installXrplBridge(): void {
  if (installed) return;

  onXRPLEvent("LoanDelete", (tx) => {
    const loanId = (tx.tx_json as { LoanID?: string })?.LoanID;
    if (loanId) {
      terminateLoanAccess(loanId, "loan_deleted");
    }
  });

  installed = true;
}

export function isBridgeInstalled(): boolean {
  return installed;
}
