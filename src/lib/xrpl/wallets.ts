import { Wallet } from "xrpl";
import { getClient } from "./client";

export interface FundedWallet {
  wallet: Wallet;
  balance: number;
}

export function getProvider(): Wallet {
  return Wallet.fromSeed(process.env.XRPL_PROVIDER_SEED!);
}

export function getBorrower(): Wallet {
  return Wallet.fromSeed(process.env.XRPL_BORROWER_SEED!);
}

export function getLoanBroker(): Wallet {
  return Wallet.fromSeed(process.env.XRPL_LOANBROKER_SEED!);
}

export function getDemoWallets() {
  return {
    provider: getProvider(),
    borrower: getBorrower(),
    loanBroker: getLoanBroker(),
  };
}

export async function createFundedWallet(): Promise<FundedWallet> {
  const client = await getClient();
  const { wallet, balance } = await client.fundWallet();
  return { wallet, balance };
}
