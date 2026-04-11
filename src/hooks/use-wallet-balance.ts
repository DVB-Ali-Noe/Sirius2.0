"use client";

import { useQuery } from "@tanstack/react-query";
import { useWalletStore } from "@/stores/wallet";

async function fetchBalance(address: string): Promise<string> {
  const res = await fetch(
    `https://s.devnet.rippletest.net:51234`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "account_info",
        params: [{ account: address, ledger_index: "validated" }],
      }),
    }
  );

  const data = await res.json();
  const drops = data.result?.account_data?.Balance;
  if (!drops) return "0";

  return (parseInt(drops) / 1_000_000).toFixed(2);
}

export function useWalletBalance() {
  const { address, connected } = useWalletStore();

  return useQuery({
    queryKey: ["wallet-balance", address],
    queryFn: () => fetchBalance(address!),
    enabled: connected && !!address,
    refetchInterval: 10_000,
  });
}
