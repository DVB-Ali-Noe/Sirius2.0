"use client";

import { useWalletStore } from "@/stores/wallet";
import { truncateAddress } from "@/lib/utils";
import { useWalletBalance } from "@/hooks/use-wallet-balance";

export function WalletInfo() {
  const { connected, address } = useWalletStore();
  const { data: balance } = useWalletBalance();

  if (!connected || !address) return null;

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-surface px-4 py-3">
      <div className="flex flex-col">
        <span className="text-xs text-muted">Wallet</span>
        <span className="text-sm text-foreground">{truncateAddress(address)}</span>
      </div>
      {balance !== undefined && (
        <div className="flex flex-col">
          <span className="text-xs text-muted">Balance</span>
          <span className="text-sm text-foreground">{balance} XRP</span>
        </div>
      )}
    </div>
  );
}
