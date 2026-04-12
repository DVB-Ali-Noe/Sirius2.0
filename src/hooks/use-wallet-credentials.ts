"use client";

import { useQuery } from "@tanstack/react-query";
import { useWalletStore } from "@/stores/wallet";
import { apiGet } from "@/lib/api-client";

interface Credential {
  credentialType: string;
  issuer: string;
  subject: string;
  accepted: boolean;
}

export function useWalletCredentials() {
  const { address, connected } = useWalletStore();

  return useQuery({
    queryKey: ["wallet-credentials", address],
    queryFn: () =>
      apiGet<{ credentials: Credential[] }>(
        `/api/xrpl/credentials/check?address=${address}`
      ).then((r) => r.credentials),
    enabled: connected && !!address,
    refetchInterval: 15_000,
  });
}
