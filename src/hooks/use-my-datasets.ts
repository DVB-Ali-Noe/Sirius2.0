"use client";

import { useQuery } from "@tanstack/react-query";
import { useWalletStore } from "@/stores/wallet";
import { apiGet } from "@/lib/api-client";

export interface OnChainDataset {
  mptIssuanceId: string;
  name: string;
  category: string;
  ipfs: string;
  entryCount: number;
  duplicateRate: string;
  qualityScore: number;
  schema: string;
  zkProof: string;
  createdAt: number;
}

export function useMyDatasets() {
  const { address, connected } = useWalletStore();

  return useQuery({
    queryKey: ["my-datasets", address],
    queryFn: () =>
      apiGet<{ datasets: OnChainDataset[]; count: number }>(
        `/api/provider/datasets?address=${address}`
      ),
    enabled: connected && !!address,
    refetchInterval: 15_000,
  });
}
