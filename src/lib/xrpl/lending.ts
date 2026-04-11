import { Wallet, LoanSet, LoanDelete } from "xrpl";
import { getClient } from "./client";

interface LoanTerms {
  loanBrokerId: string;
  principalAmount: string;
  interestRate: number;
  paymentTotal: number;
  paymentInterval: number;
  gracePeriod?: number;
}

export async function createLoan(
  borrower: Wallet,
  terms: LoanTerms
): Promise<string> {
  const client = await getClient();

  const tx: LoanSet = {
    TransactionType: "LoanSet",
    Account: borrower.classicAddress,
    LoanBrokerID: terms.loanBrokerId,
    PrincipalRequested: terms.principalAmount,
    InterestRate: terms.interestRate,
    PaymentTotal: terms.paymentTotal,
    PaymentInterval: terms.paymentInterval,
    ...(terms.gracePeriod && { GracePeriod: terms.gracePeriod }),
  };

  const result = await client.submitAndWait(tx, { wallet: borrower });

  const createdNode = (
    result.result.meta as { AffectedNodes?: Array<{ CreatedNode?: { LedgerEntryType: string; LedgerIndex: string } }> }
  )?.AffectedNodes?.find(
    (n) => n.CreatedNode?.LedgerEntryType === "Loan"
  );

  const loanId = createdNode?.CreatedNode?.LedgerIndex;
  if (!loanId) {
    throw new Error("Loan creation failed: no loan ID");
  }

  return loanId;
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

  await client.submitAndWait(tx, { wallet: account });
}
