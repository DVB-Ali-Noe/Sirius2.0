import { randomBytes } from "crypto";
import { encodeKey, type EncryptedPayload } from "./encryption";

export interface BorrowerKey {
  keyId: string;
  borrower: string;
  loanId: string;
  datasetId: string;
  encodedKey: string;
  issuedAt: number;
  expiresAt: number;
  revoked: boolean;
  revokedAt?: number;
  revokedReason?: string;
}

const keys = new Map<string, BorrowerKey>();
const byLoanId = new Map<string, string>();

export interface IssueParams {
  borrower: string;
  loanId: string;
  datasetId: string;
  masterKey: Buffer;
  ttlMs: number;
}

export function issueBorrowerKey(params: IssueParams): BorrowerKey {
  const existing = byLoanId.get(params.loanId);
  if (existing) {
    const prior = keys.get(existing);
    if (prior && !prior.revoked) {
      return prior;
    }
  }

  const keyId = `key_${randomBytes(8).toString("hex")}`;
  const record: BorrowerKey = {
    keyId,
    borrower: params.borrower,
    loanId: params.loanId,
    datasetId: params.datasetId,
    encodedKey: encodeKey(params.masterKey),
    issuedAt: Date.now(),
    expiresAt: Date.now() + params.ttlMs,
    revoked: false,
  };

  keys.set(keyId, record);
  byLoanId.set(params.loanId, keyId);
  return record;
}

export function revokeByLoan(loanId: string, reason: string): BorrowerKey | null {
  const keyId = byLoanId.get(loanId);
  if (!keyId) return null;
  const record = keys.get(keyId);
  if (!record) return null;

  record.revoked = true;
  record.revokedAt = Date.now();
  record.revokedReason = reason;
  return record;
}

export function getKey(keyId: string): BorrowerKey | undefined {
  return keys.get(keyId);
}

export function getKeyByLoan(loanId: string): BorrowerKey | undefined {
  const keyId = byLoanId.get(loanId);
  if (!keyId) return undefined;
  return keys.get(keyId);
}

export function isKeyValid(keyId: string): { valid: boolean; reason?: string } {
  const record = keys.get(keyId);
  if (!record) return { valid: false, reason: "unknown key" };
  if (record.revoked) return { valid: false, reason: `revoked: ${record.revokedReason ?? "unknown"}` };
  if (Date.now() > record.expiresAt) return { valid: false, reason: "expired" };
  return { valid: true };
}

export function listKeys(): BorrowerKey[] {
  return [...keys.values()];
}

export function purgeExpired(): number {
  const now = Date.now();
  let n = 0;
  for (const key of keys.values()) {
    if (!key.revoked && now > key.expiresAt) {
      key.revoked = true;
      key.revokedAt = now;
      key.revokedReason = "ttl_expired";
      n++;
    }
  }
  return n;
}

export type { EncryptedPayload };
