import {
  Wallet,
  VaultCreate,
  VaultCreateFlags,
  VaultDeposit,
  VaultWithdraw,
} from "xrpl";
import type { MPTAmount } from "xrpl/dist/npm/models/common";
import { getClient } from "./client";

export async function createVault(
  owner: Wallet,
  mptIssuanceId: string,
  domainId?: string
): Promise<string> {
  const client = await getClient();

  const tx: VaultCreate = {
    TransactionType: "VaultCreate",
    Account: owner.classicAddress,
    Asset: { mpt_issuance_id: mptIssuanceId },
    ...(domainId && { DomainID: domainId }),
  };

  const result = await client.submitAndWait(tx, { wallet: owner });

  const createdNode = (
    result.result.meta as { AffectedNodes?: Array<{ CreatedNode?: { LedgerEntryType: string; LedgerIndex: string } }> }
  )?.AffectedNodes?.find(
    (n) => n.CreatedNode?.LedgerEntryType === "Vault"
  );

  const vaultId = createdNode?.CreatedNode?.LedgerIndex;
  if (!vaultId) {
    throw new Error("Vault creation failed: no vault ID");
  }

  return vaultId;
}

export async function depositToVault(
  depositor: Wallet,
  vaultId: string,
  mptIssuanceId: string,
  amount: string
): Promise<void> {
  const client = await getClient();

  const mptAmount: MPTAmount = {
    mpt_issuance_id: mptIssuanceId,
    value: amount,
  };

  const tx: VaultDeposit = {
    TransactionType: "VaultDeposit",
    Account: depositor.classicAddress,
    VaultID: vaultId,
    Amount: mptAmount,
  };

  await client.submitAndWait(tx, { wallet: depositor });
}

export async function createLendingPool(
  loanBroker: Wallet,
  mptIssuanceId: string,
  domainId?: string,
  metadata?: string
): Promise<string> {
  const client = await getClient();

  const tx: VaultCreate = {
    TransactionType: "VaultCreate",
    Account: loanBroker.classicAddress,
    Asset: { mpt_issuance_id: mptIssuanceId },
    Flags: VaultCreateFlags.tfVaultPrivate,
    ...(domainId && { DomainID: domainId }),
    ...(metadata && { Data: Buffer.from(metadata).toString("hex") }),
  };

  const result = await client.submitAndWait(tx, { wallet: loanBroker });

  const createdNode = (
    result.result.meta as { AffectedNodes?: Array<{ CreatedNode?: { LedgerEntryType: string; LedgerIndex: string } }> }
  )?.AffectedNodes?.find(
    (n) => n.CreatedNode?.LedgerEntryType === "Vault"
  );

  const vaultId = createdNode?.CreatedNode?.LedgerIndex;
  if (!vaultId) {
    throw new Error("Lending pool creation failed: no vault ID");
  }

  return vaultId;
}

export async function withdrawFromVault(
  withdrawer: Wallet,
  vaultId: string,
  mptIssuanceId: string,
  amount: string
): Promise<void> {
  const client = await getClient();

  const mptAmount: MPTAmount = {
    mpt_issuance_id: mptIssuanceId,
    value: amount,
  };

  const tx: VaultWithdraw = {
    TransactionType: "VaultWithdraw",
    Account: withdrawer.classicAddress,
    VaultID: vaultId,
    Amount: mptAmount,
  };

  await client.submitAndWait(tx, { wallet: withdrawer });
}
