"use client";

import {
  WalletManager,
  GemWalletAdapter,
  CrossmarkAdapter,
  XamanAdapter,
} from "xrpl-connect";

let manager: WalletManager | null = null;

export function getWalletManager(): WalletManager {
  if (manager) return manager;

  const adapters = [
    new GemWalletAdapter(),
    new CrossmarkAdapter(),
  ];

  const xamanKey = process.env.NEXT_PUBLIC_XAMAN_API_KEY;
  if (xamanKey) {
    adapters.push(new XamanAdapter({ apiKey: xamanKey }));
  }

  manager = new WalletManager({
    adapters,
    network: "devnet",
    autoConnect: true,
  });

  return manager;
}
