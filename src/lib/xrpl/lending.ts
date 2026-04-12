import { Wallet } from "xrpl";
import { getClient } from "./client";
import { submitRawTx } from "./raw-tx";

interface LoanTerms {
  loanBrokerId: string;
  principalAmount: string;
  interestRate: number;
  paymentTotal: number;
  paymentInterval: number;
  gracePeriod?: number;
}

export async function createLoanBroker(
  owner: Wallet,
  vaultId: string,
  managementFeeRate: number = 1000
): Promise<string> {
  const client = await getClient();

  const result = await submitRawTx(client, owner, {
    TransactionType: "LoanBrokerSet",
    VaultID: vaultId,
    ManagementFeeRate: managementFeeRate,
  });

  const affectedNodes = (result.meta as { AffectedNodes?: Array<{ CreatedNode?: { LedgerEntryType: string; LedgerIndex: string } }> })?.AffectedNodes;
  const brokerNode = affectedNodes?.find((n) => n.CreatedNode?.LedgerEntryType === "LoanBroker");
  return brokerNode?.CreatedNode?.LedgerIndex ?? result.hash;
}

export async function loanBrokerCoverDeposit(
  broker: Wallet,
  loanBrokerId: string,
  amountDrops: string
): Promise<string> {
  const client = await getClient();

  const result = await submitRawTx(client, broker, {
    TransactionType: "LoanBrokerCoverDeposit",
    LoanBrokerID: loanBrokerId,
    Amount: amountDrops,
  });

  return result.hash;
}

export async function createLoan(
  borrower: Wallet,
  terms: LoanTerms
): Promise<string> {
  const client = await getClient();

  const result = await submitRawTx(client, borrower, {
    TransactionType: "LoanSet",
    LoanBrokerID: terms.loanBrokerId,
    PrincipalRequested: terms.principalAmount,
    InterestRate: terms.interestRate,
    PaymentTotal: terms.paymentTotal,
    PaymentInterval: terms.paymentInterval,
    ...(terms.gracePeriod && { GracePeriod: terms.gracePeriod }),
  });

  const affectedNodes = (result.meta as { AffectedNodes?: Array<{ CreatedNode?: { LedgerEntryType: string; LedgerIndex: string } }> })?.AffectedNodes;
  const loanNode = affectedNodes?.find((n) => n.CreatedNode?.LedgerEntryType === "Loan");
  const loanId = loanNode?.CreatedNode?.LedgerIndex ?? result.hash;

  return loanId;
}

export async function payLoan(
  borrower: Wallet,
  loanId: string,
  amountDrops: string,
  flags: number = 0
): Promise<string> {
  const client = await getClient();

  const result = await submitRawTx(client, borrower, {
    TransactionType: "LoanPay",
    LoanID: loanId,
    Amount: amountDrops,
    ...(flags && { Flags: flags }),
  });

  return result.hash;
}

export async function manageLoan(
  broker: Wallet,
  loanId: string,
  flags: number
): Promise<string> {
  const client = await getClient();

  const result = await submitRawTx(client, broker, {
    TransactionType: "LoanManage",
    LoanID: loanId,
    Flags: flags,
  });

  return result.hash;
}

export async function deleteLoan(
  account: Wallet,
  loanId: string
): Promise<void> {
  const client = await getClient();

  await submitRawTx(client, account, {
    TransactionType: "LoanDelete",
    LoanID: loanId,
  });
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
