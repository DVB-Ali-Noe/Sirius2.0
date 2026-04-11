import { Wallet, Payment } from "xrpl";
import { getClient } from "./client";
import { getLoan } from "./loan-state";

interface ShareHolder {
  address: string;
  sharePercent: number;
}

export interface DistributionResult {
  loanId: string;
  totalInterest: number;
  distributions: Array<{
    address: string;
    amount: number;
    txHash: string;
  }>;
}

export function calculateInterest(loanId: string): number {
  const loan = getLoan(loanId);
  if (!loan) throw new Error(`Loan ${loanId} not found`);

  const principal = parseFloat(loan.principalAmount);
  const rate = loan.interestRate / 10000;
  return principal * rate;
}

export async function distributeInterest(
  loanBroker: Wallet,
  loanId: string,
  shareHolders: ShareHolder[]
): Promise<DistributionResult> {
  const client = await getClient();
  const totalInterest = calculateInterest(loanId);

  const distributions: DistributionResult["distributions"] = [];

  for (const holder of shareHolders) {
    const amount = totalInterest * (holder.sharePercent / 100);
    if (amount <= 0) continue;

    const drops = String(Math.floor(amount * 1_000_000));

    const tx: Payment = {
      TransactionType: "Payment",
      Account: loanBroker.classicAddress,
      Destination: holder.address,
      Amount: drops,
    };

    const result = await client.submitAndWait(tx, { wallet: loanBroker });

    distributions.push({
      address: holder.address,
      amount,
      txHash: result.result.hash,
    });
  }

  return { loanId, totalInterest, distributions };
}
