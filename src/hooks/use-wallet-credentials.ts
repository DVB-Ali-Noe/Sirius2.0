"use client";

import { useQuery } from "@tanstack/react-query";
import { useWalletStore } from "@/stores/wallet";

interface Credential {
  credentialType: string;
  issuer: string;
  subject: string;
}

async function fetchCredentials(address: string): Promise<Credential[]> {
  const res = await fetch(
    `https://s.devnet.rippletest.net:51234`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "account_objects",
        params: [
          {
            account: address,
            type: "credential",
            ledger_index: "validated",
          },
        ],
      }),
    }
  );

  const data = await res.json();
  const objects = data.result?.account_objects ?? [];

  return objects.map((obj: { CredentialType: string; Issuer: string; Subject: string }) => ({
    credentialType: Buffer.from(obj.CredentialType, "hex").toString("utf-8"),
    issuer: obj.Issuer,
    subject: obj.Subject,
  }));
}

export function useWalletCredentials() {
  const { address, connected } = useWalletStore();

  return useQuery({
    queryKey: ["wallet-credentials", address],
    queryFn: () => fetchCredentials(address!),
    enabled: connected && !!address,
    refetchInterval: 30_000,
  });
}
