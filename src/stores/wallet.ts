import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WalletRole = "loanbroker" | "provider" | "borrower" | null;

interface WalletState {
  address: string | null;
  network: string | null;
  connected: boolean;
  connecting: boolean;
  role: WalletRole;
  setConnected: (address: string, network: string) => void;
  setDisconnected: () => void;
  setConnecting: (connecting: boolean) => void;
  setRole: (role: WalletRole) => void;
}

function detectInitialRole(address: string): WalletRole {
  const loanBrokerAddress = process.env.NEXT_PUBLIC_LOANBROKER_ADDRESS;
  if (loanBrokerAddress && address === loanBrokerAddress) return "loanbroker";
  // Provider/borrower roles are detected from on-chain credentials via useRoleDetection hook
  return null;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      address: null,
      network: null,
      connected: false,
      connecting: false,
      role: null,
      setConnected: (address, network) =>
        set({
          address,
          network,
          connected: true,
          connecting: false,
          role: detectInitialRole(address),
        }),
      setDisconnected: () =>
        set({ address: null, network: null, connected: false, connecting: false, role: null }),
      setConnecting: (connecting) => set({ connecting }),
      setRole: (role) => set({ role }),
    }),
    {
      name: "datalend-wallet",
      partialize: (state) => ({
        address: state.address,
        network: state.network,
        connected: state.connected,
      }),
    }
  )
);
