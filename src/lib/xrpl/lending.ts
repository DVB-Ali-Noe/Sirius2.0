import { Wallet, LoanSet, LoanDelete, LoanBrokerSet } from "xrpl";
import { getClient } from "./client";

export async function createLoanBroker(
  owner: Wallet,
  vaultId: string,
  managementFeeRate: number = 1000
): Promise<string> {
  const client = await getClient();

  const tx: LoanBrokerSet = {
    TransactionType: "LoanBrokerSet",
    Account: owner.classicAddress,
    VaultID: vaultId,
    ManagementFeeRate: managementFeeRate,
  };

  const result = await client.submitAndWait(tx, { wallet: owner });

  const meta = result.result.meta as { TransactionResult?: string; AffectedNodes?: Array<{ CreatedNode?: { LedgerEntryType: string; LedgerIndex: string } }> } | undefined;
  if (meta?.TransactionResult !== "tesSUCCESS") {
    throw new Error(`LoanBrokerSet failed: ${meta?.TransactionResult ?? "unknown"}`);
  }

  const brokerNode = meta?.AffectedNodes?.find((n) => n.CreatedNode?.LedgerEntryType === "LoanBroker");
  return brokerNode?.CreatedNode?.LedgerIndex ?? result.result.hash;
}

interface LoanTerms {
  loanBrokerId: string;
  principalAmount: string;
  interestRate: number;
  paymentTotal: number;
  paymentInterval: number;
  gracePeriod?: number;
}

export async function createLoan(
  loanBrokerWallet: Wallet,
  borrowerAddress: string,
  terms: LoanTerms
): Promise<string> {
  const client = await getClient();

  const tx: LoanSet = {
    TransactionType: "LoanSet",
    Account: loanBrokerWallet.classicAddress,
    LoanBrokerID: terms.loanBrokerId,
    Counterparty: borrowerAddress,
    PrincipalRequested: terms.principalAmount,
    InterestRate: terms.interestRate,
    PaymentTotal: terms.paymentTotal,
    PaymentInterval: terms.paymentInterval,
    ...(terms.gracePeriod && { GracePeriod: terms.gracePeriod }),
  };

  const result = await client.submitAndWait(tx, { wallet: loanBrokerWallet });

  const meta = result.result.meta as { TransactionResult?: string; AffectedNodes?: Array<{ CreatedNode?: { LedgerEntryType: string; LedgerIndex: string } }> } | undefined;
  if (meta?.TransactionResult !== "tesSUCCESS") {
    throw new Error(`LoanSet failed: ${meta?.TransactionResult ?? "unknown"}`);
  }

  const loanNode = meta?.AffectedNodes?.find((n) => n.CreatedNode?.LedgerEntryType === "Loan");
  return loanNode?.CreatedNode?.LedgerIndex ?? result.result.hash;
}

export async function deleteLoan(
  account: Wallet,
  loanId: string
): Promise<void> {
  const client = await getClient();

  const tx: LoanDelete = {
    TransactionType: "LoanDelete",
    Account: account.classicAddress,
    LoanID: loanId,
  };

  const result = await client.submitAndWait(tx, { wallet: account });
  const meta = result.result.meta as { TransactionResult?: string } | undefined;
  if (meta?.TransactionResult !== "tesSUCCESS") {
    throw new Error(`LoanDelete failed: ${meta?.TransactionResult ?? "unknown"}`);
  }
}

export const LOAN_FLAGS = {
  tfLoanOverpayment: 0x00010000,
  tfLoanFullPayment: 0x00020000,
  tfLoanLatePayment: 0x00040000,
} as const;

export const LOAN_MANAGE_FLAGS = {
  tfLoanDefault: 0x00010000,
  tfLoanImpair: 0x00020000,
  tfLoanUnimpair: 0x00040000,
} as const;
