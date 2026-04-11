import { Wallet, Payment } from "xrpl";
import { getClient } from "./client";
import { addPayment, getLoan, checkDefault, type LoanRecord } from "./loan-state";

export interface RepaymentInfo {
  totalDue: number;
  totalPaid: number;
  remaining: number;
  nextPaymentDue: number | null;
  isOverdue: boolean;
  paymentsCompleted: number;
  paymentsTotal: number;
}

export function getRepaymentInfo(loanId: string): RepaymentInfo {
  const loan = getLoan(loanId);
  if (!loan) throw new Error(`Loan ${loanId} not found`);

  const principalXrp = parseFloat(loan.principalAmount);
  const interestMultiplier = loan.interestRate / 10000;
  const totalDue = principalXrp * (1 + interestMultiplier);
  const perPayment = totalDue / loan.paymentTotal;
  const totalPaid = loan.payments.length * perPayment;

  let nextPaymentDue: number | null = null;
  let isOverdue = false;

  if (loan.activatedAt && loan.status !== "COMPLETED" && loan.status !== "DEFAULTED") {
    const nextIdx = loan.payments.length;
    if (nextIdx < loan.paymentTotal) {
      nextPaymentDue = loan.activatedAt + (nextIdx + 1) * loan.paymentInterval * 1000;
      isOverdue = Date.now() > nextPaymentDue + loan.gracePeriod * 1000;
    }
  }

  return {
    totalDue,
    totalPaid,
    remaining: totalDue - totalPaid,
    nextPaymentDue,
    isOverdue,
    paymentsCompleted: loan.payments.length,
    paymentsTotal: loan.paymentTotal,
  };
}

export async function makeRepayment(
  borrower: Wallet,
  loanBrokerAddress: string,
  loanId: string,
  amountXrp: string
): Promise<LoanRecord> {
  const client = await getClient();

  const tx: Payment = {
    TransactionType: "Payment",
    Account: borrower.classicAddress,
    Destination: loanBrokerAddress,
    Amount: String(Math.floor(parseFloat(amountXrp) * 1_000_000)),
  };

  const result = await client.submitAndWait(tx, { wallet: borrower });
  const txHash = result.result.hash;

  return addPayment(loanId, {
    txHash,
    amount: amountXrp,
    timestamp: Date.now(),
  });
}

export function checkAndTriggerDefault(loanId: string): boolean {
  return checkDefault(loanId);
}
