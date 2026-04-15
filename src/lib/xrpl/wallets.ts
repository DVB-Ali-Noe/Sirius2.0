import { Wallet } from "xrpl";
import { getClient } from "./client";

export interface FundedWallet {
  wallet: Wallet;
  balance: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function getProvider(): Wallet {
  return Wallet.fromSeed(requireEnv("XRPL_PROVIDER_SEED"));
}

export function getBorrower(): Wallet {
  return Wallet.fromSeed(requireEnv("XRPL_BORROWER_SEED"));
}

export function getLoanBroker(): Wallet {
  return Wallet.fromSeed(requireEnv("XRPL_ADMIN_SEED"));
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
