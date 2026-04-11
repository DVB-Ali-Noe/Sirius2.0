"use client";

import { useQuery } from "@tanstack/react-query";
import { useWalletStore } from "@/stores/wallet";
import { DEVNET_JSON_RPC_URL } from "@/lib/xrpl/constants";

interface Credential {
  credentialType: string;
  issuer: string;
  subject: string;
}

async function fetchCredentials(address: string): Promise<Credential[]> {
  const res = await fetch(
    DEVNET_JSON_RPC_URL,
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

  return objects.map((obj: { CredentialType?: string; Issuer: string; Subject: string }) => {
    let credentialType = obj.CredentialType ?? "";
    try {
      const bytes = new Uint8Array(
        (credentialType.match(/.{1,2}/g) ?? []).map((b) => parseInt(b, 16))
      );
      credentialType = new TextDecoder().decode(bytes);
    } catch {}
    return { credentialType, issuer: obj.Issuer, subject: obj.Subject };
  });
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
