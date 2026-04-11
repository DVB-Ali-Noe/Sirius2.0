import { create } from "zustand";

interface WalletState {
  address: string | null;
  network: string | null;
  connected: boolean;
  connecting: boolean;
  setConnected: (address: string, network: string) => void;
  setDisconnected: () => void;
  setConnecting: (connecting: boolean) => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  address: null,
  network: null,
  connected: false,
  connecting: false,
  setConnected: (address, network) =>
    set({ address, network, connected: true, connecting: false }),
  setDisconnected: () =>
    set({ address: null, network: null, connected: false, connecting: false }),
  setConnecting: (connecting) => set({ connecting }),
}));
