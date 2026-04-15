"use client";

import { useEffect } from "react";
import { useWalletStore, type WalletRole } from "@/stores/wallet";
import { useWalletCredentials } from "./use-wallet-credentials";

export function useRoleDetection() {
  const { address, connected, role, setRole } = useWalletStore();
  const { data: credentials } = useWalletCredentials();

  useEffect(() => {
    if (!connected || !address) return;

    // LoanBroker / Admin detected by env var (platform operators)
    const loanBrokerAddress = process.env.NEXT_PUBLIC_LOANBROKER_ADDRESS;
    const adminAddress = process.env.NEXT_PUBLIC_ADMIN_ADDRESS;
    if ((loanBrokerAddress && address === loanBrokerAddress) || (adminAddress && address === adminAddress)) {
      if (role !== "loanbroker") setRole("loanbroker");
      return;
    }

    if (!credentials || credentials.length === 0) {
      if (role !== null) setRole(null);
      return;
    }

    // Check credentials on-chain
    const hasProvider = credentials.some((c) => c.credentialType === "DataProviderCertified");
    const hasBorrower = credentials.some((c) => c.credentialType === "BorrowerKYB");

    let detectedRole: WalletRole = null;
    if (hasProvider) detectedRole = "provider";
    else if (hasBorrower) detectedRole = "borrower";

    if (role !== detectedRole) setRole(detectedRole);
  }, [connected, address, credentials, role, setRole]);
}
